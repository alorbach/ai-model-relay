'use strict';

const JOB_MAX_TOKENS = Object.freeze({
	chat: 8192,
	'media.analyze': 4096,
});

const TINY_MAX_TOKENS_CEILING = 512;
const TOKEN_DEFAULT_MIN = 512;
const TOKEN_DEFAULT_MAX = 128000;

function normalizeTokenDefault(value) {
	if (typeof value === 'number') {
		return Number.isInteger(value) && value >= TOKEN_DEFAULT_MIN && value <= TOKEN_DEFAULT_MAX ? value : '';
	}
	if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
		return '';
	}
	const normalized = Number(value.trim());
	return Number.isSafeInteger(normalized) && normalized >= TOKEN_DEFAULT_MIN && normalized <= TOKEN_DEFAULT_MAX ? normalized : '';
}

function normalizeTokenDefaults(value = {}) {
	const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
	return {
		chat: normalizeTokenDefault(source.chat),
		'media.analyze': normalizeTokenDefault(source['media.analyze']),
	};
}

function persistedTokenDefaults() {
	try {
		const relaySettings = require('./relay-settings');
		return relaySettings && typeof relaySettings.settings === 'function'
			? relaySettings.settings().token_defaults
			: null;
	} catch (error) {
		return null;
	}
}

function resolveMaxTokens(jobType, requested, settings) {
	const normalizedSettings = normalizeTokenDefaults(settings === undefined ? persistedTokenDefaults() : settings && settings.token_defaults ? settings.token_defaults : settings);
	const configuredDefault = Object.prototype.hasOwnProperty.call(normalizedSettings, jobType) ? normalizedSettings[jobType] : '';
	const defaultMaxTokens = configuredDefault || (Object.prototype.hasOwnProperty.call(JOB_MAX_TOKENS, jobType)
		? JOB_MAX_TOKENS[jobType]
		: JOB_MAX_TOKENS.chat);
	const numericRequested = typeof requested === 'number'
		? requested
		: typeof requested === 'string' && requested.trim() !== ''
			? Number(requested)
			: NaN;

	if (!Number.isFinite(numericRequested) || numericRequested < TINY_MAX_TOKENS_CEILING) {
		return defaultMaxTokens;
	}

	return Math.floor(numericRequested);
}

module.exports = {
	JOB_MAX_TOKENS,
	TINY_MAX_TOKENS_CEILING,
	TOKEN_DEFAULT_MIN,
	TOKEN_DEFAULT_MAX,
	normalizeTokenDefault,
	normalizeTokenDefaults,
	resolveMaxTokens,
};
