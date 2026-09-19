'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const statePaths = require('./state-paths');

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const stateDir = statePaths.stateDir;
const statePath = statePaths.statePath;
const stateBackupPath = `${statePath}.bak`;
const stateLockPath = `${statePath}.lock`;
const STATE_LOCK_TIMEOUT_MS = 5000;
const STATE_LOCK_STALE_MS = 30000;

function timingSafeEqual(left, right) {
	const a = Buffer.from(String(left || ''), 'utf8');
	const b = Buffer.from(String(right || ''), 'utf8');
	const size = Math.max(a.length, b.length, 1);
	const leftPadded = Buffer.alloc(size);
	const rightPadded = Buffer.alloc(size);
	a.copy(leftPadded);
	b.copy(rightPadded);
	const sameBytes = crypto.timingSafeEqual(leftPadded, rightPadded);
	return sameBytes && a.length === b.length;
}

function normalizeOrigin(origin) {
	try {
		const parsed = new URL(String(origin || '').trim());
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return '';
		}
		return parsed.origin;
	} catch (error) {
		return '';
	}
}

function ensureStateDir() {
	fs.mkdirSync(stateDir, { recursive: true });
}

function readStateFile(filePath) {
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		const state = JSON.parse(raw);
		return state && typeof state === 'object' ? state : null;
	} catch (error) {
		return null;
	}
}

function readState() {
	for (const filePath of [statePath, stateBackupPath]) {
		const state = readStateFile(filePath);
		if (state) {
			return state;
		}
	}
	return {};
}

function sleepSync(milliseconds) {
	const waitBuffer = new Int32Array(new SharedArrayBuffer(4));
	Atomics.wait(waitBuffer, 0, 0, milliseconds);
}

function lockOwnerPath() {
	return path.join(stateLockPath, 'owner.json');
}

function isProcessAlive(pid) {
	const numericPid = Number(pid);
	if (!Number.isInteger(numericPid) || numericPid <= 0) return false;
	try {
		process.kill(numericPid, 0);
		return true;
	} catch (error) {
		return !!(error && error.code === 'EPERM');
	}
}

function readLockOwner() {
	try {
		const owner = JSON.parse(fs.readFileSync(lockOwnerPath(), 'utf8'));
		return owner && typeof owner === 'object' ? owner : null;
	} catch (error) {
		return null;
	}
}

function writeLockOwner() {
	fs.writeFileSync(lockOwnerPath(), JSON.stringify({ pid: process.pid, createdAt: Date.now() }), 'utf8');
}

function touchStateLock() {
	try {
		const now = new Date();
		fs.utimesSync(stateLockPath, now, now);
	} catch (error) {}
}

function canStealStateLock() {
	const owner = readLockOwner();
	if (owner && Number(owner.pid) === process.pid) {
		return true;
	}
	if (owner && isProcessAlive(owner.pid)) {
		return false;
	}
	try {
		const lockStat = fs.statSync(stateLockPath);
		if (owner && !isProcessAlive(owner.pid)) {
			return true;
		}
		return Date.now() - lockStat.mtimeMs > STATE_LOCK_STALE_MS;
	} catch (error) {
		return error && error.code === 'ENOENT';
	}
}

function removeStateLockDir() {
	try {
		fs.rmSync(stateLockPath, { recursive: true, force: true });
	} catch (error) {
		if (!error || error.code !== 'ENOENT') {
			throw error;
		}
	}
}

function acquireStateLock() {
	ensureStateDir();
	const startedAt = Date.now();
	for (;;) {
		try {
			fs.mkdirSync(stateLockPath);
			writeLockOwner();
			const heartbeat = setInterval(touchStateLock, 5000);
			if (typeof heartbeat.unref === 'function') heartbeat.unref();
			return { path: stateLockPath, heartbeat };
		} catch (error) {
			if (!error || error.code !== 'EEXIST') {
				throw error;
			}
			try {
				if (canStealStateLock()) {
					removeStateLockDir();
					continue;
				}
			} catch (statError) {
				if (statError && statError.code !== 'ENOENT') {
					throw statError;
				}
			}
			if (Date.now() - startedAt >= STATE_LOCK_TIMEOUT_MS) {
				throw new Error('Timed out waiting for the Relay state file lock.');
			}
			sleepSync(10);
		}
	}
}

function releaseStateLock(lock) {
	const lockPath = lock && typeof lock === 'object' ? lock.path : lock;
	if (lock && lock.heartbeat) {
		clearInterval(lock.heartbeat);
	}
	if (!lockPath) return;
	try {
		fs.rmSync(lockPath, { recursive: true, force: true });
	} catch (error) {
		if (!error || error.code !== 'ENOENT') {
			throw error;
		}
	}
}

function isStateReplacementConflict(error) {
	return !!(error && ['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(error.code) && fs.existsSync(statePath));
}

function replaceStateFile(tmpPath) {
	try {
		fs.renameSync(tmpPath, statePath);
		return;
	} catch (error) {
		if (!isStateReplacementConflict(error)) {
			throw error;
		}
	}

	try {
		fs.unlinkSync(stateBackupPath);
	} catch (error) {
		if (error && error.code !== 'ENOENT') {
			throw error;
		}
	}
	let movedPreviousState = false;
	try {
		fs.renameSync(statePath, stateBackupPath);
		movedPreviousState = true;
		fs.renameSync(tmpPath, statePath);
	} catch (error) {
		if (movedPreviousState && !fs.existsSync(statePath)) {
			try {
				fs.renameSync(stateBackupPath, statePath);
			} catch (restoreError) {
				error.restoreError = restoreError;
			}
		}
		throw error;
	}
	try {
		fs.unlinkSync(stateBackupPath);
	} catch (error) {
		/* The new state is valid; an old backup can be recovered or replaced later. */
	}
}

function persistStateUnlocked(state) {
	touchStateLock();
	const tmpPath = `${statePath}.${process.pid}.${Date.now().toString(36)}.${crypto.randomBytes(8).toString('hex')}.tmp`;
	try {
		const fileDescriptor = fs.openSync(tmpPath, 'wx');
		try {
			fs.writeFileSync(fileDescriptor, JSON.stringify(state, null, 2), 'utf8');
			fs.fsyncSync(fileDescriptor);
		} finally {
			fs.closeSync(fileDescriptor);
		}
		touchStateLock();
		replaceStateFile(tmpPath);
	} finally {
		try {
			fs.unlinkSync(tmpPath);
		} catch (error) {
			if (error && error.code !== 'ENOENT') {
				/* Preserve the original write error when cleanup cannot remove a temp file. */
			}
		}
	}
}

function writeState(state) {
	const lock = acquireStateLock();
	try {
		persistStateUnlocked(state);
	} finally {
		releaseStateLock(lock);
	}
}

function updateState(mutator) {
	const lock = acquireStateLock();
	try {
		const current = readState();
		const next = typeof mutator === 'function' ? mutator(current) : current;
		const resolved = next && typeof next === 'object' ? next : current;
		persistStateUnlocked(resolved);
		return resolved;
	} finally {
		releaseStateLock(lock);
	}
}

const PAIRING_MAX_FAILURES = 5;
const PAIRING_WINDOW_MS = 60000;

function createPairingLimiter(options = {}) {
	const maxFailures = Number(options.maxFailures || PAIRING_MAX_FAILURES) || PAIRING_MAX_FAILURES;
	const windowMs = Number(options.windowMs || PAIRING_WINDOW_MS) || PAIRING_WINDOW_MS;
	const now = typeof options.now === 'function' ? options.now : () => Date.now();
	const persistent = options.persistent === true;
	const failures = [];

	function recentFailures(at) {
		const cutoff = at - windowMs;
		if (persistent) {
			const stored = readState().pairing_failures;
			return (Array.isArray(stored) ? stored : [])
				.map(Number)
				.filter((timestamp) => Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= at)
				.sort((left, right) => left - right);
		}
		while (failures.length && failures[0] < cutoff) failures.shift();
		return failures;
	}

	return {
		allow() {
			return recentFailures(now()).length < maxFailures;
		},
		recordFailure() {
			const at = now();
			if (persistent) {
				updateState((state) => {
					const cutoff = at - windowMs;
					const recent = (Array.isArray(state.pairing_failures) ? state.pairing_failures : [])
						.map(Number)
						.filter((timestamp) => Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= at);
					recent.push(at);
					state.pairing_failures = recent;
					return state;
				});
				return;
			}
			recentFailures(at).push(at);
		},
		reset() {
			if (persistent) {
				updateState((state) => {
					state.pairing_failures = [];
					return state;
				});
				return;
			}
			failures.length = 0;
		},
		retryAfterMs() {
			const at = now();
			const recent = recentFailures(at);
			if (recent.length < maxFailures) return 0;
			return Math.max(0, (recent[0] + windowMs) - at);
		},
	};
}

function getPairings() {
	const state = readState();
	return state.pairings && typeof state.pairings === 'object' ? state.pairings : {};
}

function savePairing(origin, token) {
	const safeOrigin = normalizeOrigin(origin);
	if (!safeOrigin) {
		throw new Error('Invalid WordPress origin.');
	}
	updateState((state) => {
		state.pairings = state.pairings && typeof state.pairings === 'object' ? state.pairings : {};
		state.pairings[safeOrigin] = {
			token,
			paired_at: new Date().toISOString(),
		};
		return state;
	});
}

function removePairing(origin) {
	const safeOrigin = normalizeOrigin(origin);
	if (!safeOrigin) return;
	updateState((state) => {
		if (state.pairings && state.pairings[safeOrigin]) {
			delete state.pairings[safeOrigin];
		}
		return state;
	});
}

function getPairing(origin) {
	const safeOrigin = normalizeOrigin(origin);
	if (!safeOrigin) {
		return null;
	}
	const pairings = getPairings();
	return pairings[safeOrigin] || null;
}

function validateBridgeToken(origin, token) {
	const pairing = getPairing(origin);
	return !!(pairing && pairing.token && token && timingSafeEqual(pairing.token, token));
}

function createToken() {
	return crypto.randomBytes(32).toString('base64url');
}

function createPairingCode() {
	return String(crypto.randomInt(100000, 1000000));
}

function isLocalAddress(req) {
	const address = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '';
	return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

module.exports = {
	MAX_BODY_BYTES,
	PAIRING_MAX_FAILURES,
	PAIRING_WINDOW_MS,
	stateDir,
	statePath,
	createPairingCode,
	createPairingLimiter,
	createToken,
	getPairing,
	getPairings,
	isLocalAddress,
	normalizeOrigin,
	removePairing,
	savePairing,
	timingSafeEqual,
	validateBridgeToken,
	readState,
	updateState,
	writeState,
};
