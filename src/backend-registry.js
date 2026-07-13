'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createBoundedCollector } = require('./diagnostics');
const { detectCli, detectCliAsync, messagesToText, runTextCommand } = require('./local-cli');

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
	if (model.startsWith('model-relay:grok-cli:')) return 'grok-cli';
	if (model.startsWith('model-relay:cursor-cli:')) return 'cursor-cli';
	if (model.startsWith('model-relay:local-asr:')) {
		return 'local-asr';
	}
	if (model === 'local-asr' || model.startsWith('local-asr:')) {
		return 'local-asr';
	}
	if (model === 'codex-local:audio' || model.startsWith('codex-local:audio:')) {
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
		return slug && slug !== 'auto' ? `local-asr:${slug}` : 'local-asr';
	}
	if (text === 'codex-local:audio') {
		return 'local-asr';
	}
	if (text.startsWith('codex-local:audio:')) {
		const slug = text.replace(/^codex-local:audio:/, '');
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
	let snapshot = !codex.runCodexAsync && codex.capabilities ? codex.capabilities() : { success: false, bridge_features: { chat: true, images: true, media_analysis: true }, codex: { checking: true } };
	let status = { success: false, message: 'Checking Codex CLI in background.', details: { checking: true } };
	return {
		id: 'codex-cli',
		label: 'Codex CLI',
		kind: 'local-cli',
		job_types: ['chat', 'images', 'media.analyze'],
		checkStatus: () => status,
		capabilities: () => {
			const caps = snapshot;
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
		async refresh() {
			const [nextStatus, version, help, appServer] = await Promise.all([
				codex.checkStatusAsync ? codex.checkStatusAsync() : Promise.resolve(codex.checkStatus()),
				codex.runCodexAsync ? codex.runCodexAsync(['--version'], { timeout: 15000 }) : Promise.resolve(null),
				codex.runCodexAsync ? codex.runCodexAsync(['exec', '--help'], { timeout: 15000 }) : Promise.resolve(null),
				codex.runCodexAsync ? codex.runCodexAsync(['app-server', '--help'], { timeout: 15000 }) : Promise.resolve(null),
			]);
			status = nextStatus;
			if (version) { const helpText = `${help && help.stdout || ''}\n${help && help.stderr || ''}`; snapshot = { success: !version.error && version.status === 0, bridge_features: { chat: true, images: true, audio_transcription: true, media_analysis: true, structured_exec_json: /--json/.test(helpText), output_schema: /--output-schema/.test(helpText), image_attachments: /--image/.test(helpText), image_reference_attachments: true, app_server: !appServer.error && appServer.status === 0 }, codex: { binary: status.details && status.details.codex_binary || '', version: (version.stdout || version.stderr || '').trim(), exec_help_available: !help.error && help.status === 0, app_server_available: !appServer.error && appServer.status === 0 } }; }
			return snapshot;
		},
	};
}

function cliModelFromRelay(model, provider) {
	const prefix = `model-relay:${provider}:`;
	const value = String(model || '').trim();
	return value.startsWith(prefix) ? value.slice(prefix.length) || 'auto' : 'auto';
}

function createNamedCliDriver(definition, options = {}) {
	let cached = { id: definition.id, label: definition.label, kind: 'local-cli', installed: null, ready: false, state: 'checking', diagnostic: 'Checking in background.', models: definition.models || ['auto'], job_types: ['chat'] };
	function detect() { return cached; }
	return {
		id: definition.id,
		label: definition.label,
		kind: 'local-cli',
		job_types: ['chat'],
		checkStatus: () => { const state = detect(); return { success: state.ready, message: state.diagnostic, details: state }; },
		capabilities: () => {
			const state = detect();
			return { ...state, id: definition.id, label: definition.label, enabled: state.installed, features: { chat: true, coding: true, images: false, videos: false } };
		},
		models: () => {
			const state = detect();
			return (state.models && state.models.length ? state.models : ['auto']).map((id) => ({ id: relayModel(definition.id, id), type: 'text', backend: definition.id, ready: state.ready }));
		},
		refresh: async () => { cached = await detectCliAsync(definition, { ...options, timeoutMs: Number(options.timeoutMs || process.env.AI_MODEL_RELAY_CLI_PROBE_TIMEOUT_MS || 10000) }); return cached; },
		async chat(payload = {}, session = {}) {
			const state = await this.refresh();
			if (!state.ready) return { success: false, category: 'configuration', code: `${definition.id}_unavailable`, message: `${definition.label} is unavailable: ${state.diagnostic}` };
			const model = cliModelFromRelay(payload.model, definition.id);
			const prompt = messagesToText(payload);
			const args = definition.requestArgs(model, prompt);
			const result = await runTextCommand(state.command, args, '', session, options);
			if (!result.success) return result;
			let parsed = null; try { parsed = JSON.parse(result.text); } catch (error) {}
			return normalizeChatResponse(definition.id, model, parsed, result.text);
		},
	};
}

function createGrokCliDriver(options = {}) {
	const driver = createNamedCliDriver({ id: 'grok-cli', label: 'Grok CLI', candidates: [process.env.AI_MODEL_RELAY_GROK_BINARY, 'grok'], versionArgs: ['--version'], authArgs: ['models'], jobTypes: ['chat', 'images', 'videos'], models: ['auto'], requestArgs: (model, prompt) => ['--single', prompt, '--output-format', 'json', ...(model !== 'auto' ? ['--model', model] : [])] }, options);
	const baseCapabilities = driver.capabilities;
	const baseModels = driver.models;
	driver.job_types = ['chat', 'images', 'videos'];
	driver.capabilities = () => ({ ...baseCapabilities(), features: { chat: true, coding: true, images: true, image_edit: true, videos: 'experimental', image_references: true } });
	driver.models = () => [...baseModels(), { id: 'model-relay:grok-cli:image', type: 'image', backend: 'grok-cli', experimental: false }, { id: 'model-relay:grok-cli:video', type: 'video', backend: 'grok-cli', experimental: true }];
	function collectFiles(root, extensions) {
		const found = []; const walk = (folder) => { for (const entry of fs.readdirSync(folder, { withFileTypes: true })) { const full = path.join(folder, entry.name); if (entry.isDirectory()) walk(full); else if (extensions.test(entry.name)) found.push(full); } }; walk(root); return found;
	}
	async function media(kind, payload = {}, session = {}) {
		const state = await driver.refresh();
		if (!state.ready) return { success: false, category: 'configuration', code: 'grok_cli_unavailable', message: `Grok CLI is unavailable: ${state.diagnostic}` };
		const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-grok-'));
		try {
			const references = [payload.input_reference_data_url || payload.input_reference, ...(Array.isArray(payload.reference_images) ? payload.reference_images : [])].filter(Boolean);
			const referencePaths = references.map((reference, index) => { const text = String(reference); const match = text.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([\s\S]+)$/i); if (!match) return ''; const file = path.join(workspace, `reference-${index}.${match[1].split('/')[1].replace('jpeg', 'jpg')}`); fs.writeFileSync(file, Buffer.from(match[2], 'base64')); return file; }).filter(Boolean);
			if (references.length && referencePaths.length !== references.length) return { success: false, category: 'validation', code: 'grok_reference_invalid', message: 'Grok media references must be image data URLs.' };
			const toolNames = kind === 'images' ? (referencePaths.length ? 'image_edit' : 'image_gen') : (referencePaths.length > 1 ? 'reference_to_video' : 'image_to_video');
			const instruction = kind === 'images' ? `Use the ${toolNames} tool to create the requested image${referencePaths.length ? ` using ${referencePaths.join(', ')}` : ''}.` : `Use the ${toolNames} tool to create the requested video${referencePaths.length ? ` using ${referencePaths.join(', ')}` : ''}.`;
			const prompt = `${instruction} Save the final generated ${kind === 'images' ? 'image' : 'video'} file inside ${workspace}. Do not use shell commands or edit files outside this workspace. User request: ${String(payload.prompt || '').trim()}`;
			const result = await runTextCommand(state.command, ['--single', prompt, '--output-format', 'json', '--cwd', workspace, '--tools', toolNames, '--permission-mode', 'auto'], '', session, options);
			if (!result.success) return { ...result, code: result.code === 'cli_request_failed' ? 'grok_media_failed' : result.code };
			const files = collectFiles(workspace, kind === 'images' ? /\.(png|jpe?g|webp)$/i : /\.(mp4|webm|mov)$/i);
			if (!files.length) return { success: false, category: 'grok_media', code: 'grok_media_artifact_missing', message: `Grok completed without saving a ${kind === 'images' ? 'generated image' : 'generated video'} in the request workspace.` };
			if (kind === 'images') return { success: true, response: { data: files.map((file) => ({ b64_json: fs.readFileSync(file).toString('base64'), mime_type: file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg' })), provider_details: { provider: 'grok-cli', imagine_tool: toolNames } } };
			const bytes = fs.readFileSync(files[0]); return { success: true, response: { b64_video: bytes.toString('base64'), mime_type: files[0].endsWith('.webm') ? 'video/webm' : 'video/mp4', provider_details: { provider: 'grok-cli', imagine_tool: toolNames, experimental: true } } };
		} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
	}
	driver.images = (payload, session) => media('images', payload, session);
	driver.videos = (payload, session) => media('videos', payload, session);
	return driver;
}

function createCursorCliDriver(options = {}) {
	return createNamedCliDriver({ id: 'cursor-cli', label: 'Cursor Agent', candidates: [process.env.AI_MODEL_RELAY_CURSOR_BINARY, 'cursor-agent'], versionArgs: ['--version'], authArgs: ['status'], jobTypes: ['chat'], models: ['auto'], requestArgs: (model, prompt) => ['--print', '--output-format', 'json', ...(model !== 'auto' ? ['--model', model] : []), prompt] }, options);
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
		createGrokCliDriver(options.grok || {}),
		createCursorCliDriver(options.cursor || {}),
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
			'grok-cli': 'grok-cli',
			grok: 'grok-cli',
			'cursor-cli': 'cursor-cli',
			cursor: 'cursor-cli',
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
		refresh: () => Promise.all(drivers.map((driver) => driver.refresh ? driver.refresh() : driver.capabilities())),
		getDriver: (jobType, payload) => driverFor(jobType, payload),
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
	createCursorCliDriver,
	createGrokCliDriver,
	createLocalAsrDriver,
	createOpenAiVideosDriver,
	createXaiApiDriver,
	providerFromPayload,
};
