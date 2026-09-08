'use strict';

const crypto = require('crypto');
const fs = require('fs');
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

function acquireStateLock() {
	ensureStateDir();
	const startedAt = Date.now();
	for (;;) {
		try {
			fs.mkdirSync(stateLockPath);
			return stateLockPath;
		} catch (error) {
			if (!error || error.code !== 'EEXIST') {
				throw error;
			}
			try {
				const lockStat = fs.statSync(stateLockPath);
				if (Date.now() - lockStat.mtimeMs > STATE_LOCK_STALE_MS) {
					fs.rmdirSync(stateLockPath);
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

function releaseStateLock(lockPath) {
	try {
		fs.rmdirSync(lockPath);
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

function writeState(state) {
	const lockPath = acquireStateLock();
	const tmpPath = `${statePath}.${process.pid}.${Date.now().toString(36)}.${crypto.randomBytes(8).toString('hex')}.tmp`;
	try {
		const fileDescriptor = fs.openSync(tmpPath, 'wx');
		try {
			fs.writeFileSync(fileDescriptor, JSON.stringify(state, null, 2), 'utf8');
			fs.fsyncSync(fileDescriptor);
		} finally {
			fs.closeSync(fileDescriptor);
		}
		replaceStateFile(tmpPath);
	} finally {
		try {
			fs.unlinkSync(tmpPath);
		} catch (error) {
			if (error && error.code !== 'ENOENT') {
				/* Preserve the original write error when cleanup cannot remove a temp file. */
			}
		}
		releaseStateLock(lockPath);
	}
}

const PAIRING_MAX_FAILURES = 5;
const PAIRING_WINDOW_MS = 60000;

function createPairingLimiter(options = {}) {
	const maxFailures = Number(options.maxFailures || PAIRING_MAX_FAILURES) || PAIRING_MAX_FAILURES;
	const windowMs = Number(options.windowMs || PAIRING_WINDOW_MS) || PAIRING_WINDOW_MS;
	const now = typeof options.now === 'function' ? options.now : () => Date.now();
	const failures = [];
	function prune(at) {
		const cutoff = at - windowMs;
		while (failures.length && failures[0] < cutoff) {
			failures.shift();
		}
	}
	return {
		allow() {
			const at = now();
			prune(at);
			return failures.length < maxFailures;
		},
		recordFailure() {
			const at = now();
			prune(at);
			failures.push(at);
		},
		reset() {
			failures.length = 0;
		},
		retryAfterMs() {
			const at = now();
			prune(at);
			if (failures.length < maxFailures || !failures.length) {
				return 0;
			}
			return Math.max(0, (failures[0] + windowMs) - at);
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
	const state = readState();
	state.pairings = state.pairings && typeof state.pairings === 'object' ? state.pairings : {};
	state.pairings[safeOrigin] = {
		token,
		paired_at: new Date().toISOString(),
	};
	writeState(state);
}

function removePairing(origin) {
	const safeOrigin = normalizeOrigin(origin);
	const state = readState();
	if (safeOrigin && state.pairings && state.pairings[safeOrigin]) {
		delete state.pairings[safeOrigin];
		writeState(state);
	}
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
	writeState,
};
