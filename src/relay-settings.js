'use strict';

const security = require('./security');

const DEFAULTS = {
	chat: 'model-relay:codex:auto',
	images: 'model-relay:codex:image',
	videos: 'model-relay:openai-videos:sora-2',
	transcribe: 'model-relay:local-asr:auto',
	'media.analyze': 'model-relay:codex:auto',
};

function normalizeDefaults(value = {}) {
	const source = value && typeof value === 'object' ? value : {};
	const normalized = {};
	for (const [jobType, fallback] of Object.entries(DEFAULTS)) {
		const selected = String(source[jobType] || '').trim();
		normalized[jobType] = selected || fallback;
	}
	return normalized;
}

function settings() {
	const state = security.readState();
	return { defaults: normalizeDefaults(state.relay && state.relay.defaults) };
}

function saveSettings(next = {}) {
	const state = security.readState();
	state.relay = { ...(state.relay && typeof state.relay === 'object' ? state.relay : {}), defaults: normalizeDefaults(next.defaults || next) };
	security.writeState(state);
	return settings();
}

module.exports = { DEFAULTS, normalizeDefaults, saveSettings, settings };
