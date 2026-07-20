'use strict';

const security = require('./security');

const DEFAULTS = {
	chat: 'model-relay:codex:auto',
	images: 'model-relay:codex:image',
	videos: 'model-relay:openai-videos:sora-2',
	transcribe: 'model-relay:local-asr:auto',
	'media.analyze': 'model-relay:codex:auto',
	'music.analyze': 'model-relay:music-analysis:core',
};

const CLI_PATH_KEYS = [
	'codex-cli',
	'grok-cli',
	'antigravity-cli',
	'cursor-cli',
	'cli-process',
];

function normalizeDefaults(value = {}) {
	const source = value && typeof value === 'object' ? value : {};
	const normalized = {};
	for (const [jobType, fallback] of Object.entries(DEFAULTS)) {
		const selected = String(source[jobType] || '').trim();
		normalized[jobType] = selected || fallback;
	}
	return normalized;
}

function normalizeCliPaths(value = {}) {
	const source = value && typeof value === 'object' ? value : {};
	const paths = {};
	for (const key of CLI_PATH_KEYS) {
		const candidate = source[key];
		paths[key] = typeof candidate === 'string' ? candidate.trim().slice(0, 32767) : '';
	}
	return paths;
}

function settings() {
	const state = security.readState();
	return {
		defaults: normalizeDefaults(state.relay && state.relay.defaults),
		cli_paths: normalizeCliPaths(state.relay && state.relay.cli_paths),
	};
}

function saveSettings(next = {}) {
	const state = security.readState();
	const relay = state.relay && typeof state.relay === 'object' ? state.relay : {};
	const hasCliPaths = Object.prototype.hasOwnProperty.call(next, 'cli_paths');
	state.relay = {
		...relay,
		defaults: normalizeDefaults(next.defaults || next),
		cli_paths: hasCliPaths
			? normalizeCliPaths(next.cli_paths)
			: normalizeCliPaths(relay.cli_paths),
	};
	security.writeState(state);
	return settings();
}

module.exports = { CLI_PATH_KEYS, DEFAULTS, normalizeCliPaths, normalizeDefaults, saveSettings, settings };
