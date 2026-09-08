'use strict';

const security = require('./security');
const { expandWindowsEnvironmentVariables } = require('./local-cli');
const { normalizeTokenDefault, normalizeTokenDefaults } = require('./token-policy');

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

const TIMEOUT_SPECS = {
	codex_chat_ms: { env: 'ALORBACH_CODEX_CHAT_TIMEOUT_MS', fallback: 600000 },
	codex_image_ms: { env: 'ALORBACH_CODEX_IMAGE_TIMEOUT_MS', fallback: 1800000 },
	codex_status_ms: { env: 'ALORBACH_CODEX_STATUS_TIMEOUT_MS', fallback: 15000 },
	grok_media_ms: { env: 'AI_MODEL_RELAY_GROK_MEDIA_TIMEOUT_MS', fallback: 450000 },
	named_cli_chat_ms: { env: '', fallback: 600000 },
	antigravity_chat_ms: { env: 'AI_MODEL_RELAY_ANTIGRAVITY_CHAT_TIMEOUT_MS', fallback: 600000 },
	antigravity_image_ms: { env: 'AI_MODEL_RELAY_ANTIGRAVITY_IMAGE_TIMEOUT_MS', fallback: 1800000 },
	antigravity_media_ms: { env: 'AI_MODEL_RELAY_ANTIGRAVITY_MEDIA_TIMEOUT_MS', fallback: 600000 },
	cli_process_ms: { env: 'AI_MODEL_RELAY_CLI_TIMEOUT_MS', fallback: 600000 },
	cli_probe_ms: { env: 'AI_MODEL_RELAY_CLI_PROBE_TIMEOUT_MS', fallback: 10000 },
	provider_fetch_ms: { env: 'AI_MODEL_RELAY_PROVIDER_FETCH_TIMEOUT_MS', fallback: 60000 },
	xai_poll_timeout_ms: { env: 'ALORBACH_VIDEO_POLL_TIMEOUT_MS', fallback: 600000 },
	xai_poll_interval_ms: { env: 'ALORBACH_VIDEO_POLL_INTERVAL_MS', fallback: 3000 },
	openai_poll_timeout_ms: { env: 'ALORBACH_VIDEO_POLL_TIMEOUT_MS', fallback: 600000 },
	openai_poll_interval_ms: { env: 'ALORBACH_VIDEO_POLL_INTERVAL_MS', fallback: 3000 },
};

const MAX_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_JOBS = 32;

function defaultFor(jobType, providers) {
	if (jobType === 'videos' && resolvedXaiApiKey(providers)) {
		return 'model-relay:xai:imagine-video';
	}
	return DEFAULTS[jobType];
}

function normalizeDefaults(value = {}, providers) {
	const source = value && typeof value === 'object' ? value : {};
	const normalized = {};
	for (const jobType of Object.keys(DEFAULTS)) {
		const selected = String(source[jobType] || '').trim();
		normalized[jobType] = selected || defaultFor(jobType, providers);
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

function optionalPositiveInt(value, previous = '', max = MAX_TIMEOUT_MS) {
	if (value === undefined) return previous === undefined || previous === null ? '' : previous;
	if (value === '' || value === null) return '';
	const parsed = Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return previous || '';
	return Math.min(parsed, max);
}

function optionalString(value, previous = '', maxLength = 32767) {
	if (value === undefined) return previous || '';
	if (typeof value !== 'string') return previous || '';
	return value.trim().slice(0, maxLength);
}

function optionalBoolean(value, previous = null) {
	if (value === undefined) return previous === true || previous === false ? previous : null;
	if (value === null || value === '') return null;
	if (value === true || value === 'true' || value === '1' || value === 1) return true;
	if (value === false || value === 'false' || value === '0' || value === 0) return false;
	return previous === true || previous === false ? previous : null;
}

function nextSecret(group, previousGroup) {
	const next = group && typeof group === 'object' ? group : {};
	const previous = previousGroup && typeof previousGroup === 'object' ? previousGroup : {};
	if (next.clear_api_key === true) return '';
	const incoming = typeof next.api_key === 'string' ? next.api_key.trim() : '';
	if (!incoming) return String(previous.api_key || '');
	return incoming.slice(0, 8192);
}

function normalizeRuntime(value = {}, previous = {}) {
	const source = value && typeof value === 'object' ? value : {};
	const prior = previous && typeof previous === 'object' ? previous : {};
	const timeoutSource = source.timeouts && typeof source.timeouts === 'object' ? source.timeouts : {};
	const priorTimeouts = prior.timeouts && typeof prior.timeouts === 'object' ? prior.timeouts : {};
	const timeouts = {};
	for (const key of Object.keys(TIMEOUT_SPECS)) {
		timeouts[key] = optionalPositiveInt(
			Object.prototype.hasOwnProperty.call(timeoutSource, key) ? timeoutSource[key] : undefined,
			priorTimeouts[key] || '',
		);
	}
	return {
		max_concurrent_jobs: optionalPositiveInt(
			Object.prototype.hasOwnProperty.call(source, 'max_concurrent_jobs') ? source.max_concurrent_jobs : undefined,
			prior.max_concurrent_jobs || '',
			MAX_CONCURRENT_JOBS,
		),
		timeouts,
	};
}

function normalizeProviders(value = {}, previous = {}) {
	const source = value && typeof value === 'object' ? value : {};
	const prior = previous && typeof previous === 'object' ? previous : {};
	const xai = source.xai && typeof source.xai === 'object' ? source.xai : {};
	const priorXai = prior.xai && typeof prior.xai === 'object' ? prior.xai : {};
	const openai = source.openai_videos && typeof source.openai_videos === 'object' ? source.openai_videos : {};
	const priorOpenai = prior.openai_videos && typeof prior.openai_videos === 'object' ? prior.openai_videos : {};
	const apiKeyChat = source.api_key_chat && typeof source.api_key_chat === 'object' ? source.api_key_chat : {};
	const priorApiKeyChat = prior.api_key_chat && typeof prior.api_key_chat === 'object' ? prior.api_key_chat : {};
	const cliProcess = source.cli_process && typeof source.cli_process === 'object' ? source.cli_process : {};
	const priorCli = prior.cli_process && typeof prior.cli_process === 'object' ? prior.cli_process : {};
	const grok = source.grok && typeof source.grok === 'object' ? source.grok : {};
	const priorGrok = prior.grok && typeof prior.grok === 'object' ? prior.grok : {};
	const antigravity = source.antigravity && typeof source.antigravity === 'object' ? source.antigravity : {};
	const priorAntigravity = prior.antigravity && typeof prior.antigravity === 'object' ? prior.antigravity : {};
	return {
		xai: {
			api_key: nextSecret(xai, priorXai),
			base_url: optionalString(xai.base_url, priorXai.base_url),
			models: optionalString(xai.models, priorXai.models),
		},
		openai_videos: {
			enabled: optionalBoolean(openai.enabled, priorOpenai.enabled),
			api_key: nextSecret(openai, priorOpenai),
		},
		api_key_chat: {
			api_key: nextSecret(apiKeyChat, priorApiKeyChat),
			base_url: optionalString(apiKeyChat.base_url, priorApiKeyChat.base_url),
			provider_id: optionalString(apiKeyChat.provider_id, priorApiKeyChat.provider_id, 128),
			model: optionalString(apiKeyChat.model, priorApiKeyChat.model, 256),
		},
		cli_process: {
			args: optionalString(cliProcess.args, priorCli.args),
		},
		grok: {
			imagine_skill: optionalString(grok.imagine_skill, priorGrok.imagine_skill),
		},
		antigravity: {
			state_dir: optionalString(antigravity.state_dir, priorAntigravity.state_dir),
		},
	};
}

function emptyRuntime() {
	return normalizeRuntime({}, {});
}

function emptyProviders() {
	return normalizeProviders({}, {});
}

function storedRelay() {
	const state = security.readState();
	return state.relay && typeof state.relay === 'object' ? state.relay : {};
}

function settings() {
	const relay = storedRelay();
	const providers = normalizeProviders(relay.providers, emptyProviders());
	return {
		defaults: normalizeDefaults(relay.defaults, providers),
		cli_paths: normalizeCliPaths(relay.cli_paths),
		token_defaults: normalizeTokenDefaults(relay.token_defaults),
		runtime: normalizeRuntime(relay.runtime, emptyRuntime()),
		providers,
	};
}

function maskSecret(value) {
	const text = String(value || '');
	if (!text) return { configured: false, suffix: '' };
	return { configured: true, suffix: text.slice(-4) };
}

function publicProviders(providers) {
	const source = providers && typeof providers === 'object' ? providers : emptyProviders();
	return {
		xai: {
			api_key: maskSecret(source.xai && source.xai.api_key),
			base_url: source.xai && source.xai.base_url || '',
			models: source.xai && source.xai.models || '',
		},
		openai_videos: {
			enabled: source.openai_videos && source.openai_videos.enabled,
			api_key: maskSecret(source.openai_videos && source.openai_videos.api_key),
		},
		api_key_chat: {
			api_key: maskSecret(source.api_key_chat && source.api_key_chat.api_key),
			base_url: source.api_key_chat && source.api_key_chat.base_url || '',
			provider_id: source.api_key_chat && source.api_key_chat.provider_id || '',
			model: source.api_key_chat && source.api_key_chat.model || '',
		},
		cli_process: {
			args: source.cli_process && source.cli_process.args || '',
		},
		grok: {
			imagine_skill: source.grok && source.grok.imagine_skill || '',
		},
		antigravity: {
			state_dir: source.antigravity && source.antigravity.state_dir || '',
		},
	};
}

function publicSettings() {
	const stored = settings();
	return {
		defaults: stored.defaults,
		cli_paths: stored.cli_paths,
		token_defaults: stored.token_defaults,
		runtime: stored.runtime,
		providers: publicProviders(stored.providers),
	};
}

function clampConcurrent(value) {
	const parsed = Number.parseInt(String(value || ''), 10);
	return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_CONCURRENT_JOBS) : 2;
}

function resolvedNumber(stored, envName, fallback) {
	const fromSettings = Number.parseInt(String(stored || ''), 10);
	if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;
	if (envName) {
		const fromEnv = Number.parseInt(String(process.env[envName] || ''), 10);
		if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
	}
	return fallback;
}

function resolvedString(stored, envNames, fallback = '') {
	if (stored && String(stored).trim()) return String(stored).trim();
	for (const name of Array.isArray(envNames) ? envNames : [envNames]) {
		if (name && process.env[name] && String(process.env[name]).trim()) return String(process.env[name]).trim();
	}
	return fallback;
}

function resolvedTimeout(key, storedRuntime) {
	const spec = TIMEOUT_SPECS[key] || { env: '', fallback: 0 };
	const stored = storedRuntime && storedRuntime.timeouts ? storedRuntime.timeouts[key] : '';
	return resolvedNumber(stored, spec.env, spec.fallback);
}

function resolvedXaiApiKey(providers) {
	const source = providers || (storedRelay().providers || {});
	const stored = source.xai && source.xai.api_key;
	return resolvedString(stored, ['XAI_API_KEY', 'AI_MODEL_RELAY_XAI_API_KEY']);
}

function resolvedOpenaiEnabled(providers) {
	const source = providers || (storedRelay().providers || {});
	const stored = source.openai_videos && source.openai_videos.enabled;
	if (stored === true || stored === false) return stored;
	return /^(1|true|yes|on)$/i.test(String(process.env.ALORBACH_CODEX_ENABLE_VIDEO || ''));
}

function resolvedOpenaiApiKey(providers) {
	const source = providers || (storedRelay().providers || {});
	const stored = source.openai_videos && source.openai_videos.api_key;
	return resolvedString(stored, ['ALORBACH_OPENAI_API_KEY', 'OPENAI_API_KEY']);
}

function resolved() {
	const stored = settings();
	const timeouts = {};
	for (const key of Object.keys(TIMEOUT_SPECS)) {
		timeouts[key] = resolvedTimeout(key, stored.runtime);
	}
	return {
		runtime: {
			max_concurrent_jobs: stored.runtime.max_concurrent_jobs
				? clampConcurrent(stored.runtime.max_concurrent_jobs)
				: clampConcurrent(process.env.ALORBACH_CODEX_MAX_CONCURRENT_JOBS || 2),
			timeouts,
		},
		providers: {
			xai: {
				api_key: resolvedXaiApiKey(stored.providers),
				base_url: resolvedString(stored.providers.xai.base_url, ['XAI_BASE_URL', 'AI_MODEL_RELAY_XAI_BASE_URL'], 'https://api.x.ai/v1'),
				models: resolvedString(stored.providers.xai.models, ['AI_MODEL_RELAY_XAI_MODELS']),
			},
			openai_videos: {
				enabled: resolvedOpenaiEnabled(stored.providers),
				api_key: resolvedOpenaiApiKey(stored.providers),
			},
			api_key_chat: {
				api_key: resolvedString(stored.providers.api_key_chat.api_key, ['AI_MODEL_RELAY_CHAT_API_KEY']),
				base_url: resolvedString(stored.providers.api_key_chat.base_url, ['AI_MODEL_RELAY_CHAT_BASE_URL']),
				provider_id: resolvedString(stored.providers.api_key_chat.provider_id, ['AI_MODEL_RELAY_CHAT_PROVIDER_ID'], 'api-key-chat'),
				model: resolvedString(stored.providers.api_key_chat.model, ['AI_MODEL_RELAY_CHAT_MODEL'], 'default'),
			},
			cli_process: {
				args: resolvedString(stored.providers.cli_process.args, ['AI_MODEL_RELAY_CLI_ARGS']),
			},
			grok: {
				imagine_skill: resolvedString(stored.providers.grok.imagine_skill, ['AI_MODEL_RELAY_GROK_IMAGINE_SKILL']),
			},
			antigravity: {
				state_dir: resolvedString(stored.providers.antigravity.state_dir, ['AI_MODEL_RELAY_ANTIGRAVITY_STATE_DIR']),
			},
		},
	};
}

function driverOptions() {
	const values = resolved();
	const timeouts = values.runtime.timeouts;
	return {
		fetchTimeoutMs: timeouts.provider_fetch_ms,
		grok: {
			timeoutMs: timeouts.named_cli_chat_ms,
			probeTimeoutMs: timeouts.cli_probe_ms,
			mediaTimeoutMs: timeouts.grok_media_ms,
			imagineSkillPath: expandWindowsEnvironmentVariables(values.providers.grok.imagine_skill),
		},
		cursor: {
			timeoutMs: timeouts.named_cli_chat_ms,
			probeTimeoutMs: timeouts.cli_probe_ms,
		},
		antigravity: {
			stateRoot: expandWindowsEnvironmentVariables(values.providers.antigravity.state_dir),
			chatTimeoutMs: timeouts.antigravity_chat_ms,
			imageTimeoutMs: timeouts.antigravity_image_ms,
			mediaTimeoutMs: timeouts.antigravity_media_ms,
			probeTimeoutMs: timeouts.cli_probe_ms,
			timeoutMs: timeouts.antigravity_chat_ms,
		},
		xai: {
			apiKey: values.providers.xai.api_key,
			baseUrl: values.providers.xai.base_url,
			models: values.providers.xai.models,
			pollTimeoutMs: timeouts.xai_poll_timeout_ms,
			pollIntervalMs: timeouts.xai_poll_interval_ms,
			fetchTimeoutMs: timeouts.provider_fetch_ms,
		},
		apiKeyChat: {
			apiKey: values.providers.api_key_chat.api_key,
			baseUrl: values.providers.api_key_chat.base_url,
			providerId: values.providers.api_key_chat.provider_id,
			model: values.providers.api_key_chat.model,
			fetchTimeoutMs: timeouts.provider_fetch_ms,
		},
		cli: {
			args: values.providers.cli_process.args,
			timeoutMs: timeouts.cli_process_ms,
		},
		video: {
			enabled: values.providers.openai_videos.enabled,
			apiKey: values.providers.openai_videos.api_key,
			pollTimeoutMs: timeouts.openai_poll_timeout_ms,
			pollIntervalMs: timeouts.openai_poll_interval_ms,
		},
	};
}

function saveSettings(next = {}) {
	security.updateState((state) => {
		const relay = state.relay && typeof state.relay === 'object' ? state.relay : {};
		const hasCliPaths = Object.prototype.hasOwnProperty.call(next, 'cli_paths');
		const hasDefaults = Object.prototype.hasOwnProperty.call(next, 'defaults');
		const hasTokenDefaults = Object.prototype.hasOwnProperty.call(next, 'token_defaults');
		const hasRuntime = Object.prototype.hasOwnProperty.call(next, 'runtime');
		const hasProviders = Object.prototype.hasOwnProperty.call(next, 'providers');
		const keepExisting = hasCliPaths || hasTokenDefaults || hasRuntime || hasProviders;
		const defaultsSource = hasDefaults
			? next.defaults
			: (keepExisting ? relay.defaults : next);
		const tokenDefaultsSource = hasTokenDefaults ? next.token_defaults : relay.token_defaults;
		const providers = hasProviders
			? normalizeProviders(next.providers, relay.providers)
			: normalizeProviders(relay.providers, emptyProviders());
		state.relay = {
			...relay,
			defaults: normalizeDefaults(defaultsSource, providers),
			cli_paths: hasCliPaths
				? normalizeCliPaths(next.cli_paths)
				: normalizeCliPaths(relay.cli_paths),
			token_defaults: normalizeSavedTokenDefaults(tokenDefaultsSource, relay.token_defaults),
			runtime: hasRuntime
				? normalizeRuntime(next.runtime, relay.runtime)
				: normalizeRuntime(relay.runtime, emptyRuntime()),
			providers,
		};
		return state;
	});
	return settings();
}

module.exports = {
	CLI_PATH_KEYS,
	DEFAULTS,
	TIMEOUT_SPECS,
	driverOptions,
	maskSecret,
	normalizeCliPaths,
	normalizeDefaults,
	normalizeProviders,
	normalizeRuntime,
	normalizeSavedTokenDefaults,
	normalizeTokenDefaults,
	publicSettings,
	resolved,
	saveSettings,
	settings,
};
