'use strict';

const security = require('./security');
const { normalizeTokenDefault, normalizeTokenDefaults } = require('./token-policy');

const DEFAULTS = {
	chat: 'model-relay:codex:auto',
	images: 'model-relay:codex:image',
	videos: 'model-relay:openai-videos:sora-2',
	transcribe: 'model-relay:local-asr:auto',
	'media.analyze': 'model-relay:codex:auto',
	'music.analyze': 'model-relay:music-analysis:core',
};

function defaultFor(jobType) {
	if (jobType === 'videos' && (process.env.XAI_API_KEY || process.env.AI_MODEL_RELAY_XAI_API_KEY)) {
		return 'model-relay:xai:imagine-video';
	}
	return DEFAULTS[jobType];
}

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
	for (const jobType of Object.keys(DEFAULTS)) {
		const selected = String(source[jobType] || '').trim();
		normalized[jobType] = selected || defaultFor(jobType);
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

function normalizeSavedTokenDefaults(value, previous = {}) {
	const source = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
	const prior = normalizeTokenDefaults(previous);
	const normalized = {};
	if (!source) {
		for (const jobType of ['chat', 'media.analyze']) {
			if (prior[jobType]) normalized[jobType] = prior[jobType];
		}
		return normalized;
	}
	for (const jobType of ['chat', 'media.analyze']) {
		if (!Object.prototype.hasOwnProperty.call(source, jobType)) {
			if (prior[jobType]) normalized[jobType] = prior[jobType];
			continue;
		}
		const candidate = source[jobType];
		if (typeof candidate === 'string' && candidate.trim() === '') {
			continue;
		}
		const parsed = normalizeTokenDefault(candidate);
		if (parsed || prior[jobType]) normalized[jobType] = parsed || prior[jobType];
	}
	return normalized;
}

function settings() {
	const state = security.readState();
	return {
		defaults: normalizeDefaults(state.relay && state.relay.defaults),
		cli_paths: normalizeCliPaths(state.relay && state.relay.cli_paths),
		token_defaults: normalizeTokenDefaults(state.relay && state.relay.token_defaults),
	};
}

function saveSettings(next = {}) {
	security.updateState((state) => {
		const relay = state.relay && typeof state.relay === 'object' ? state.relay : {};
		const hasCliPaths = Object.prototype.hasOwnProperty.call(next, 'cli_paths');
		const hasDefaults = Object.prototype.hasOwnProperty.call(next, 'defaults');
		const hasTokenDefaults = Object.prototype.hasOwnProperty.call(next, 'token_defaults');
		const defaultsSource = hasDefaults
			? next.defaults
			: (hasCliPaths || hasTokenDefaults ? relay.defaults : next);
		const tokenDefaultsSource = hasTokenDefaults ? next.token_defaults : relay.token_defaults;
		state.relay = {
			...relay,
			defaults: normalizeDefaults(defaultsSource),
			cli_paths: hasCliPaths
				? normalizeCliPaths(next.cli_paths)
				: normalizeCliPaths(relay.cli_paths),
			token_defaults: normalizeSavedTokenDefaults(tokenDefaultsSource, relay.token_defaults),
		};
		return state;
	});
	return settings();
}

module.exports = { CLI_PATH_KEYS, DEFAULTS, normalizeCliPaths, normalizeDefaults, normalizeSavedTokenDefaults, normalizeTokenDefaults, saveSettings, settings };
