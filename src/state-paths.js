'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const LEGACY_STATE_DIR = path.join(os.homedir(), '.alorbach-codex-bridge');
const MODEL_RELAY_STATE_DIR = path.join(os.homedir(), '.ai-model-relay');

function normalizeDir(value) {
	const text = String(value || '').trim();
	return text ? path.resolve(text) : '';
}

function activeStateDir() {
	const explicit = normalizeDir(process.env.AI_MODEL_RELAY_STATE_DIR || process.env.ALORBACH_MODEL_RELAY_STATE_DIR || '');
	if (explicit) {
		return explicit;
	}
	if (fs.existsSync(MODEL_RELAY_STATE_DIR)) {
		return MODEL_RELAY_STATE_DIR;
	}
	return LEGACY_STATE_DIR;
}

const stateDir = activeStateDir();
const statePath = path.join(stateDir, 'state.json');
const legacyStatePath = path.join(LEGACY_STATE_DIR, 'state.json');

function migrateLegacyStateIfNeeded() {
	if (stateDir === LEGACY_STATE_DIR || fs.existsSync(statePath) || !fs.existsSync(legacyStatePath)) {
		return false;
	}
	try {
		fs.mkdirSync(stateDir, { recursive: true });
		fs.copyFileSync(legacyStatePath, statePath);
		return true;
	} catch (error) {
		return false;
	}
}

const migratedLegacyState = migrateLegacyStateIfNeeded();

module.exports = {
	LEGACY_STATE_DIR,
	MODEL_RELAY_STATE_DIR,
	legacyStatePath,
	migratedLegacyState,
	stateDir,
	statePath,
};
