'use strict';

const { spawn } = require('child_process');
const { createBoundedCollector } = require('./diagnostics');

const RELAY_MODEL_PREFIX = 'model-relay';

function truthy(value) {
	return /^(1|true|yes|on)$/i.test(String(value || ''));
}

function splitArgs(value) {
	return String(value || '').match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, '')) || [];
}

function textFromMessages(messages = []) {
	return (Array.isArray(messages) ? messages : []).map((message) => {
		const role = message && message.role ? String(message.role) : 'user';
		const content = Array.isArray(message && message.content)
			? message.content.map((part) => typeof part === 'string' ? part : (part && (part.text || part.content) || '')).join('\n')
			: String(message && message.content || '');
		return `${role}: ${content}`;
	}).join('\n\n');
}

function relayModel(provider, id) {
	const model = String(id || '').replace(/^model-relay:[^:]+:/, '').replace(/^codex-local:/, '').trim();
	return `${RELAY_MODEL_PREFIX}:${provider}:${model || 'default'}`;
}

function providerFromPayload(payload = {}) {
	const explicit = String(payload.provider || payload.backend || '').trim().toLowerCase();
	if (explicit) {
		return explicit;
	}
	const model = String(payload.model || '').trim().toLowerCase();
	if (model.startsWith('model-relay:xai:')) {
		return 'xai-api';
	}
	if (model.startsWith('model-relay:grok:')) {
		return 'xai-api';
	}
	if (model.startsWith('model-relay:cli:')) {
		return 'cli-process';
	}
	if (model.startsWith('model-relay:api-key-chat:')) {
		return 'api-key-chat';
	}
	if (model.startsWith('model-relay:codex:')) {
		return 'codex-cli';
	}
	if (model.startsWith('model-relay:local-asr:')) {
		return 'local-asr';
	}
	if (model === 'local-asr' || model.startsWith('local-asr:')) {
		return 'local-asr';
	}
	if (model.startsWith('codex-local:')) {
		return 'codex-cli';
	}
	return '';
}

function codexModelFromRelay(model) {
	const text = String(model || '').trim();
	if (text.startsWith('model-relay:codex:')) {
		const slug = text.replace(/^model-relay:codex:/, '') || 'auto';
		return slug === 'image' ? 'codex-local:image' : `codex-local:${slug}`;
	}
	return text || 'codex-local:auto';
}

function asrModelFromRelay(model) {
	const text = String(model || '').trim();
	if (text.startsWith('model-relay:local-asr:')) {
		const slug = text.replace(/^model-relay:local-asr:/, '');
		return slug ? `local-asr:${slug}` : 'local-asr';
	}
	return text || 'local-asr';
}

function xaiModelFromRelay(model) {
	return String(model || '').replace(/^model-relay:(?:xai|grok):/, '').trim() || process.env.AI_MODEL_RELAY_XAI_MODEL || 'grok-4.3';
}

function openAiCompatText(response) {
	const choice = response && Array.isArray(response.choices) ? response.choices[0] : null;
	if (choice && choice.message && typeof choice.message.content === 'string') {
		return choice.message.content;
	}
	if (response && Array.isArray(response.output)) {
		return response.output.map((item) => Array.isArray(item.content)
			? item.content.map((part) => part && (part.text || part.output_text || '')).join('')
			: '').join('');
	}
	return '';
}

function normalizeChatResponse(provider, model, parsed, fallbackText = '') {
	if (parsed && Array.isArray(parsed.choices)) {
		return {
			success: true,
			response: {
				...parsed,
				model: relayModel(provider, parsed.model || model),
				provider_details: {
					...(parsed.provider_details || {}),
					provider,
					raw_model: parsed.model || model,
				},
			},
		};
	}
	const text = openAiCompatText(parsed) || fallbackText;
	return {
		success: true,
		response: {
			id: `${provider}-${Date.now()}`,
			object: 'chat.completion',
			model: relayModel(provider, model),
			choices: [
				{
					index: 0,
					message: { role: 'assistant', content: text },
					finish_reason: 'stop',
				},
			],
			usage: parsed && parsed.usage || { total_tokens: 0 },
			provider_details: {
				provider,
				raw_model: model,
			},
		},
	};
}

function createCodexCliDriver(codex) {
	return {
		id: 'codex-cli',
		label: 'Codex CLI',
		kind: 'local-cli',
		job_types: ['chat', 'images', 'media.analyze'],
		checkStatus: () => codex.checkStatus(),
		capabilities: () => {
			const caps = codex.capabilities ? codex.capabilities() : { success: false };
			return {
				id: 'codex-cli',
				label: 'Codex CLI',
				kind: 'local-cli',
				enabled: true,
				ready: !!caps.success,
				features: caps.bridge_features || {},
				details: caps.codex || {},
			};
		},
		models: () => {
			const payload = codex.models ? codex.models() : { models: {} };
			const models = payload.models || {};
			return [
				...(models.text || []).map((id) => ({ id: relayModel('codex', id), legacy_id: id, type: 'text', backend: 'codex-cli' })),
				...(models.image || []).map((id) => ({ id: relayModel('codex', id.replace(/^codex-local:/, '')), legacy_id: id, type: 'image', backend: 'codex-cli' })),
			];
		},
		chat: (payload, session) => codex.chat({ ...payload, model: codexModelFromRelay(payload.model) }, session),
		images: (payload, session) => codex.images({ ...payload, model: codexModelFromRelay(payload.model || 'model-relay:codex:image') }, session),
	};
}

function createLocalAsrDriver(codex) {
	return {
		id: 'local-asr',
		label: 'Local ASR',
		kind: 'local-runtime',
		job_types: ['transcribe'],
		checkStatus: () => ({ success: true, message: 'Local ASR driver is available.', details: codex.asrStatus ? codex.asrStatus() : {} }),
		capabilities: () => {
			const caps = codex.asrStatus ? codex.asrStatus() : {};
			return {
				id: 'local-asr',
				label: 'Local ASR',
				kind: 'local-runtime',
				enabled: caps.enabled !== false,
				ready: caps.ready,
				runtime_checked: caps.runtime_checked,
				models: caps.models || [],
			};
		},
		models: () => {
			const caps = codex.asrStatus ? codex.asrStatus() : {};
			return (caps.models || []).map((id) => ({
				id: id === 'local-asr' ? 'model-relay:local-asr:auto' : relayModel('local-asr', id.replace(/^local-asr:/, '')),
				legacy_id: id,
				type: 'audio',
				backend: 'local-asr',
			}));
		},
		transcribe: (payload, session) => codex.transcribe({ ...payload, model: asrModelFromRelay(payload.model) }, session),
	};
}

function createOpenAiVideosDriver(video) {
	return {
		id: 'openai-videos',
		label: 'OpenAI Videos',
		kind: 'api',
		job_types: ['videos'],
		checkStatus: () => ({ success: true, message: 'OpenAI video driver loaded.', details: video.capabilities ? video.capabilities() : {} }),
		capabilities: () => {
			const caps = video.capabilities ? video.capabilities() : { enabled: false };
			return {
				id: 'openai-videos',
				label: 'OpenAI Videos',
				kind: 'api',
				enabled: !!caps.enabled,
				configured: !!caps.configured,
				ready: !!caps.enabled,
				models: caps.models || [],
			};
		},
		models: () => {
			const caps = video.capabilities ? video.capabilities() : { models: [] };
			return (caps.models || []).map((id) => ({ id: relayModel('openai-videos', id), legacy_id: `openai-video:${id}`, type: 'video', backend: 'openai-videos' }));
		},
		videos: (payload, session) => video.run(payload, session),
	};
}

function createXaiApiDriver(options = {}) {
	const fetchImpl = options.fetch || globalThis.fetch;
	const apiKey = options.apiKey || process.env.XAI_API_KEY || process.env.AI_MODEL_RELAY_XAI_API_KEY || '';
	const baseUrl = String(options.baseUrl || process.env.XAI_BASE_URL || process.env.AI_MODEL_RELAY_XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/+$/, '');
	const defaultModels = String(options.models || process.env.AI_MODEL_RELAY_XAI_MODELS || 'grok-4.3,latest').split(',').map((id) => id.trim()).filter(Boolean);
	return {
		id: 'xai-api',
		label: 'Grok / xAI API',
		kind: 'api',
		job_types: ['chat'],
		checkStatus: () => ({ success: !!apiKey, message: apiKey ? 'xAI API key is configured.' : 'xAI API key is not configured.', details: { provider: 'xai-api', configured: !!apiKey, base_url: baseUrl } }),
		capabilities: () => ({
			id: 'xai-api',
			label: 'Grok / xAI API',
			kind: 'api',
			enabled: !!apiKey,
			configured: !!apiKey,
			ready: !!apiKey,
			models: defaultModels.map((id) => relayModel('xai', id)),
			requires: ['XAI_API_KEY or AI_MODEL_RELAY_XAI_API_KEY'],
		}),
		models: () => defaultModels.map((id) => ({ id: relayModel('xai', id), type: 'text', backend: 'xai-api' })),
		async chat(payload = {}) {
			if (!apiKey) {
				return { success: false, category: 'configuration', code: 'xai_api_key_missing', message: 'Grok/xAI API requires XAI_API_KEY or AI_MODEL_RELAY_XAI_API_KEY.' };
			}
			if (!fetchImpl) {
				return { success: false, category: 'configuration', code: 'fetch_unavailable', message: 'This Node runtime does not provide fetch for API-backed drivers.' };
			}
			const model = xaiModelFromRelay(payload.model);
			const body = {
				model,
				messages: Array.isArray(payload.messages) ? payload.messages : [{ role: 'user', content: String(payload.prompt || '') }],
			};
			for (const key of ['max_tokens', 'temperature', 'top_p', 'stream']) {
				if (payload[key] !== undefined) {
					body[key] = payload[key];
				}
			}
			const response = await fetchImpl(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			});
			const text = await response.text();
			let parsed = null;
			try {
				parsed = text ? JSON.parse(text) : {};
			} catch (error) {}
			if (!response.ok) {
				const message = parsed && parsed.error && parsed.error.message || `xAI API request failed with HTTP ${response.status}.`;
				return { success: false, category: response.status === 401 || response.status === 403 ? 'configuration' : 'api', code: 'xai_api_failed', message, details: { status: response.status, provider: 'xai-api' } };
			}
			return normalizeChatResponse('xai', model, parsed, text);
		},
	};
}

function createApiKeyChatDriver(options = {}) {
	const fetchImpl = options.fetch || globalThis.fetch;
	const apiKey = options.apiKey || process.env.AI_MODEL_RELAY_CHAT_API_KEY || '';
	const baseUrl = String(options.baseUrl || process.env.AI_MODEL_RELAY_CHAT_BASE_URL || '').replace(/\/+$/, '');
	const providerId = String(options.providerId || process.env.AI_MODEL_RELAY_CHAT_PROVIDER_ID || 'api-key-chat').replace(/[^a-z0-9_.-]/gi, '-').toLowerCase();
	const model = String(options.model || process.env.AI_MODEL_RELAY_CHAT_MODEL || 'default');
	return {
		id: 'api-key-chat',
		label: 'API Key Chat',
		kind: 'api',
		job_types: ['chat'],
		checkStatus: () => ({ success: !!(apiKey && baseUrl), message: apiKey && baseUrl ? 'API-key chat provider is configured.' : 'API-key chat provider is not configured.', details: { provider: providerId, configured: !!(apiKey && baseUrl), base_url: baseUrl || '' } }),
		capabilities: () => ({
			id: 'api-key-chat',
			label: 'API Key Chat',
			kind: 'api',
			enabled: !!(apiKey && baseUrl),
			configured: !!(apiKey && baseUrl),
			ready: !!(apiKey && baseUrl),
			models: [relayModel('api-key-chat', model)],
			requires: ['AI_MODEL_RELAY_CHAT_API_KEY', 'AI_MODEL_RELAY_CHAT_BASE_URL'],
		}),
		models: () => [{ id: relayModel('api-key-chat', model), type: 'text', backend: 'api-key-chat' }],
		async chat(payload = {}) {
			if (!(apiKey && baseUrl)) {
				return { success: false, category: 'configuration', code: 'api_key_chat_not_configured', message: 'API-key chat provider requires AI_MODEL_RELAY_CHAT_API_KEY and AI_MODEL_RELAY_CHAT_BASE_URL.' };
			}
			if (!fetchImpl) {
				return { success: false, category: 'configuration', code: 'fetch_unavailable', message: 'This Node runtime does not provide fetch for API-backed drivers.' };
			}
			const rawModel = String(payload.model || model).replace(/^model-relay:api-key-chat:/, '') || model;
			const response = await fetchImpl(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ model: rawModel, messages: payload.messages || [{ role: 'user', content: String(payload.prompt || '') }] }),
			});
			const text = await response.text();
			let parsed = null;
			try {
				parsed = text ? JSON.parse(text) : {};
			} catch (error) {}
			if (!response.ok) {
				return { success: false, category: response.status === 401 || response.status === 403 ? 'configuration' : 'api', code: 'api_key_chat_failed', message: parsed && parsed.error && parsed.error.message || `API-key chat request failed with HTTP ${response.status}.`, details: { status: response.status, provider: providerId } };
			}
			return normalizeChatResponse('api-key-chat', rawModel, parsed, text);
		},
	};
}

function createCliProcessDriver(options = {}) {
	const command = options.command || process.env.AI_MODEL_RELAY_CLI_COMMAND || '';
	const args = Array.isArray(options.args) ? options.args : splitArgs(process.env.AI_MODEL_RELAY_CLI_ARGS || '');
	const timeoutMs = Number(options.timeoutMs || process.env.AI_MODEL_RELAY_CLI_TIMEOUT_MS || 600000);
	return {
		id: 'cli-process',
		label: 'CLI Process',
		kind: 'local-cli',
		job_types: ['chat'],
		checkStatus: () => ({ success: !!command, message: command ? 'CLI process driver is configured.' : 'CLI process driver is not configured.', details: { configured: !!command, command: command ? '<configured>' : '' } }),
		capabilities: () => ({
			id: 'cli-process',
			label: 'CLI Process',
			kind: 'local-cli',
			enabled: !!command,
			configured: !!command,
			ready: !!command,
			models: ['model-relay:cli:default'],
			requires: ['AI_MODEL_RELAY_CLI_COMMAND'],
		}),
		models: () => [{ id: 'model-relay:cli:default', type: 'text', backend: 'cli-process' }],
		chat(payload = {}, session = {}) {
			if (!command) {
				return Promise.resolve({ success: false, category: 'configuration', code: 'cli_process_not_configured', message: 'CLI process driver requires AI_MODEL_RELAY_CLI_COMMAND.' });
			}
			return new Promise((resolve) => {
				const stdout = createBoundedCollector({ maxChars: Number(process.env.AI_MODEL_RELAY_CLI_OUTPUT_MAX_CHARS || 1024 * 1024) });
				const stderr = createBoundedCollector({ maxChars: Number(process.env.AI_MODEL_RELAY_CLI_OUTPUT_MAX_CHARS || 1024 * 1024) });
				const child = spawn(command, args, { shell: false, windowsHide: true });
				let settled = false;
				const timer = setTimeout(() => {
					if (settled) {
						return;
					}
					child.kill();
					settled = true;
					resolve({ success: false, category: 'timeout', code: 'cli_process_timeout', message: 'CLI process timed out.', details: { timeout_ms: timeoutMs } });
				}, timeoutMs);
				child.stdout.on('data', (chunk) => {
					stdout.append(chunk);
					if (session.appendSessionOutput) {
						session.appendSessionOutput('stdout', chunk.toString());
					}
				});
				child.stderr.on('data', (chunk) => {
					stderr.append(chunk);
					if (session.appendSessionOutput) {
						session.appendSessionOutput('stderr', chunk.toString());
					}
				});
				child.on('error', (error) => {
					if (settled) {
						return;
					}
					settled = true;
					clearTimeout(timer);
					resolve({ success: false, category: 'configuration', code: 'cli_process_spawn_failed', message: 'CLI process could not be started.', details: { error: error.message || String(error) } });
				});
				child.on('close', (status, signal) => {
					if (settled) {
						return;
					}
					settled = true;
					clearTimeout(timer);
					const out = stdout.value().trim();
					const err = stderr.value().trim();
					if (status !== 0) {
						resolve({ success: false, category: 'cli_process', code: 'cli_process_failed', message: 'CLI process request failed.', details: { status, signal, stdout: out, stderr: err } });
						return;
					}
					let parsed = null;
					try {
						parsed = JSON.parse(out);
					} catch (error) {}
					resolve(normalizeChatResponse('cli', 'default', parsed, out));
				});
				const input = payload.input || payload.prompt || textFromMessages(payload.messages);
				child.stdin.end(String(input || ''));
			});
		},
	};
}

function createBackendRegistry(options = {}) {
	const drivers = [
		createCodexCliDriver(options.codex),
		createLocalAsrDriver(options.codex),
		createOpenAiVideosDriver(options.video),
		createXaiApiDriver(options.xai || {}),
		createCliProcessDriver(options.cli || {}),
		createApiKeyChatDriver(options.apiKeyChat || {}),
	].filter(Boolean);
	const byId = new Map(drivers.map((driver) => [driver.id, driver]));

	function driverFor(jobType, payload = {}) {
		const requested = providerFromPayload(payload);
		const aliases = {
			codex: 'codex-cli',
			'codex-cli': 'codex-cli',
			asr: 'local-asr',
			'local-asr': 'local-asr',
			xai: 'xai-api',
			grok: 'xai-api',
			'xai-api': 'xai-api',
			cli: 'cli-process',
			'cli-process': 'cli-process',
			'api-key-chat': 'api-key-chat',
			video: 'openai-videos',
			'openai-videos': 'openai-videos',
		};
		const id = aliases[requested] || requested;
		if (id && byId.has(id)) {
			return byId.get(id);
		}
		if (jobType === 'transcribe') {
			return byId.get('local-asr');
		}
		if (jobType === 'images') {
			return byId.get('codex-cli');
		}
		if (jobType === 'videos') {
			return byId.get('openai-videos');
		}
		return byId.get('codex-cli');
	}

	return {
		list: () => drivers.slice(),
		capabilities: () => drivers.map((driver) => driver.capabilities()),
		models: () => drivers.flatMap((driver) => driver.models()),
		driverFor,
		run(jobType, payload, session) {
			const driver = driverFor(jobType, payload);
			if (!driver || typeof driver[jobType] !== 'function') {
				return Promise.resolve({ success: false, category: 'configuration', code: 'backend_unsupported', message: `No backend driver supports ${jobType}.` });
			}
			return Promise.resolve(driver[jobType](payload || {}, session || {}));
		},
	};
}

module.exports = {
	createApiKeyChatDriver,
	createBackendRegistry,
	createCliProcessDriver,
	createCodexCliDriver,
	createLocalAsrDriver,
	createOpenAiVideosDriver,
	createXaiApiDriver,
	providerFromPayload,
};
