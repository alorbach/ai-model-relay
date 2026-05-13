'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const stateDir = path.join(os.homedir(), '.alorbach-codex-bridge');
const statePath = path.join(stateDir, 'state.json');

function timingSafeEqual(left, right) {
	const a = Buffer.from(String(left || ''), 'utf8');
	const b = Buffer.from(String(right || ''), 'utf8');
	if (a.length !== b.length) {
		return false;
	}
	return crypto.timingSafeEqual(a, b);
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
	fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
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
	stateDir,
	statePath,
	createPairingCode,
	createToken,
	getPairing,
	getPairings,
	isLocalAddress,
	normalizeOrigin,
	removePairing,
	savePairing,
	validateBridgeToken,
};
