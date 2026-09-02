'use strict';

const crypto = require('crypto');
const fs = require('fs');
const statePaths = require('./state-paths');

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const stateDir = statePaths.stateDir;
const statePath = statePaths.statePath;

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

function readState() {
	try {
		const raw = fs.readFileSync(statePath, 'utf8');
		const state = JSON.parse(raw);
		return state && typeof state === 'object' ? state : {};
	} catch (error) {
		return {};
	}
}

function writeState(state) {
	ensureStateDir();
	const tmpPath = `${statePath}.tmp`;
	fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2));
	try {
		fs.renameSync(tmpPath, statePath);
	} catch (error) {
		try {
			fs.unlinkSync(statePath);
		} catch (unlinkError) {}
		fs.renameSync(tmpPath, statePath);
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
