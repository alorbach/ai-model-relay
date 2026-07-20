'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { spawn } = require('child_process');
const { createBoundedCollector } = require('./diagnostics');
const { detectCli, detectCliAsync, messagesToText, runTextCommand } = require('./local-cli');

const RELAY_MODEL_PREFIX = 'model-relay';
const GROK_MEDIA_TIMEOUT_MS = 450000;
const MAX_AUDIO_BASE64_LENGTH = 67108864;

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
	if (model.startsWith('model-relay:antigravity-cli:')) return 'antigravity-cli';
	if (model.startsWith('model-relay:cursor-cli:')) return 'cursor-cli';
	if (model.startsWith('model-relay:local-asr:')) {
		return 'local-asr';
	}
	if (model.startsWith('model-relay:music-analysis:')) {
		return 'music-analysis';
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

function decodeAudioBase64(value) {
	const encoded = String(value || '').replace(/\s+/g, '');
	if (!encoded || encoded.length > MAX_AUDIO_BASE64_LENGTH || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
	const bytes = Buffer.from(encoded, 'base64');
	return bytes.length ? bytes : null;
}

function xaiAudioFileInfo(value) {
	const raw = String(value || '').toLowerCase().replace(/^audio\//, '').replace(/[^a-z0-9]/g, '');
	const details = {
		mpeg: ['mp3', 'audio/mpeg'], mp3: ['mp3', 'audio/mpeg'], wav: ['wav', 'audio/wav'], xwav: ['wav', 'audio/wav'],
		flac: ['flac', 'audio/flac'], m4a: ['m4a', 'audio/mp4'], mp4: ['m4a', 'audio/mp4'], ogg: ['ogg', 'audio/ogg'],
		opus: ['opus', 'audio/ogg'], webm: ['webm', 'audio/webm'], aac: ['aac', 'audio/aac'],
	}[raw];
	return { extension: details ? details[0] : 'bin', mime_type: details ? details[1] : 'application/octet-stream' };
}

function normalizeXaiWords(words) {
	return (Array.isArray(words) ? words : []).map((entry) => {
		const word = String(entry && (entry.word || entry.text || entry.token) || '').trim();
		const start = Number(entry && (entry.start ?? entry.start_seconds));
		const end = Number(entry && (entry.end ?? entry.end_seconds));
		if (!word || !Number.isFinite(start) || !Number.isFinite(end)) return null;
		const normalized = { word, start, end };
		if (Number.isInteger(Number(entry && entry.speaker))) normalized.speaker = Number(entry.speaker);
		return normalized;
	}).filter(Boolean);
}

function redactProviderSecret(value, secret) {
	const text = String(value || '');
	const token = String(secret || '').trim();
	return token ? text.split(token).join('[redacted]') : text;
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

function generationPreferences(payload = {}, kind) {
        const safeValue = (value, maxLength = 64) => String(value || '').trim().replace(/[\r\n]+/g, ' ').slice(0, maxLength);
        const preferences = [];
        const size = safeValue(payload.size);
        const quality = safeValue(payload.quality);
        const seconds = Number(payload.seconds);
        if (size) preferences.push(`Requested output resolution: ${size}.`);
        if (kind === 'videos' && Number.isFinite(seconds) && seconds > 0 && seconds <= 120) preferences.push(`Requested clip length: ${seconds} seconds.`);
        if (quality) preferences.push(`Preferred quality: ${quality}.`);
        return preferences.join(' ');
}

function createCodexCliDriver(codex, mediaAnalysis) {
	const jobTypes = ['chat', 'images', ...(mediaAnalysis && typeof mediaAnalysis.analyze === 'function' ? ['media.analyze'] : [])];
	let snapshot = !codex.runCodexAsync && codex.capabilities ? codex.capabilities() : { success: false, bridge_features: { chat: true, images: true, media_analysis: true }, codex: { checking: true } };
	let status = { success: false, message: 'Checking Codex CLI in background.', details: { checking: true } };
	return {
		id: 'codex-cli',
		label: 'Codex CLI',
		kind: 'local-cli',
		job_types: jobTypes,
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
				...(models.text || []).map((id) => ({ id: relayModel('codex', id), legacy_id: id, type: 'text', backend: 'codex-cli', job_types: ['chat', ...(jobTypes.includes('media.analyze') ? ['media.analyze'] : [])] })),
				...(models.image || []).map((id) => ({ id: relayModel('codex', id.replace(/^codex-local:/, '')), legacy_id: id, type: 'image', backend: 'codex-cli', job_types: ['images'] })),
			];
		},
		chat: (payload, session) => codex.chat({ ...payload, model: codexModelFromRelay(payload.model) }, session),
		images: (payload, session) => codex.images({ ...payload, model: codexModelFromRelay(payload.model || 'model-relay:codex:image') }, session),
		'media.analyze': (payload, session) => mediaAnalysis && typeof mediaAnalysis.analyze === 'function'
			? mediaAnalysis.analyze({ ...payload, model: codexModelFromRelay(payload.model) }, codex, session)
			: Promise.resolve({ success: false, category: 'configuration', code: 'media_analysis_unavailable', message: 'Codex media analysis is unavailable.' }),
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
		job_types: ['chat', 'transcribe'],
		checkStatus: () => { const state = detect(); return { success: state.ready, message: state.diagnostic, details: state }; },
		capabilities: () => {
			const state = detect();
			return { ...state, id: definition.id, label: definition.label, enabled: state.installed, features: { chat: true, coding: true, images: false, videos: false } };
		},
		models: () => {
			const state = detect();
			return (state.models && state.models.length ? state.models : ['auto']).map((id) => ({ id: relayModel(definition.id, id), type: 'text', backend: definition.id, ready: state.ready, job_types: definition.jobTypes || ['chat'] }));
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
	const definition = { id: 'grok-cli', label: 'Grok CLI', candidates: [options.command, process.env.AI_MODEL_RELAY_GROK_BINARY, 'grok'], versionArgs: ['--version'], authArgs: ['models'], jobTypes: ['chat'], models: ['auto'], requestArgs: (model, prompt) => ['--single', prompt, '--output-format', 'json', ...(model !== 'auto' ? ['--model', model] : [])] };
	const configuredMediaTimeout = Number(options.mediaTimeoutMs || process.env.AI_MODEL_RELAY_GROK_MEDIA_TIMEOUT_MS || GROK_MEDIA_TIMEOUT_MS);
	const mediaTimeoutMs = Number.isFinite(configuredMediaTimeout) && configuredMediaTimeout > 0 ? configuredMediaTimeout : GROK_MEDIA_TIMEOUT_MS;
	const driver = createNamedCliDriver(definition, options);
	const baseCapabilities = driver.capabilities;
	const baseModels = driver.models;
	const baseRefresh = driver.refresh;
	let imagine = { checked: false, path: '', images: false, videos: false, video_verified: false, diagnostic: 'Imagine tooling has not been checked yet.' };
	let unavailableTools = { images: false, videos: false };

	function probeImagine() {
		const candidates = [options.imagineSkillPath, process.env.AI_MODEL_RELAY_GROK_IMAGINE_SKILL, path.join(os.homedir(), '.grok', 'skills', 'imagine', 'SKILL.md')].filter(Boolean);
		const skillPath = candidates.find((candidate) => {
			try { return fs.statSync(candidate).isFile(); } catch (error) { return false; }
		});
		if (!skillPath) return { checked: true, path: '', images: false, videos: false, video_verified: false, diagnostic: 'Grok Imagine skill was not found.' };
		try {
			const content = fs.readFileSync(skillPath, 'utf8').slice(0, 128 * 1024);
			const namedImagine = /^\s*name:\s*imagine\s*$/mi.test(content);
			const images = namedImagine && /\bimage_gen\b/.test(content) && /\bimage_edit\b/.test(content);
			const videos = images && /\bimage_to_video\b/.test(content) && /\breference_to_video\b/.test(content);
			return { checked: true, path: skillPath, images, videos, video_verified: false, diagnostic: images ? (videos ? 'Grok Imagine image and experimental video workflows detected.' : 'Grok Imagine image workflows detected; video workflow is unavailable.') : 'Grok Imagine skill does not declare the required image tools.' };
		} catch (error) {
			return { checked: true, path: '', images: false, videos: false, video_verified: false, diagnostic: 'Grok Imagine skill could not be read.' };
		}
	}

	function extensionForMime(mime) {
		return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp' }[String(mime || '').toLowerCase()] || '';
	}

	function decodeDataUrl(value) {
		const match = String(value || '').match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
		if (!match) return null;
		const encoded = match[2].replace(/\s/g, '');
		if (!encoded || encoded.length % 4 === 1) return null;
		const bytes = Buffer.from(encoded, 'base64');
		return bytes.length ? { mime_type: match[1].toLowerCase(), bytes } : null;
	}

	function materializeReferences(payload, inputDir) {
		const entries = [payload.input_reference_data_url, payload.input_reference, ...(Array.isArray(payload.reference_images) ? payload.reference_images : []), ...(Array.isArray(payload.frames) ? payload.frames : [])].filter(Boolean);
		const paths = Array.isArray(payload.referenced_image_paths) ? payload.referenced_image_paths.filter(Boolean) : [];
		const materialized = [];
		const write = (image) => {
			if (!image || !image.bytes || image.bytes.length > 20 * 1024 * 1024) return false;
			const extension = extensionForMime(image.mime_type);
			if (!extension) return false;
			const target = path.join(inputDir, `reference-${materialized.length + 1}.${extension}`);
			fs.writeFileSync(target, image.bytes);
			materialized.push(target);
			return true;
		};
		for (const entry of entries) {
			const image = typeof entry === 'object' && !Buffer.isBuffer(entry)
				? decodeDataUrl(`data:${String(entry.mime_type || 'image/jpeg').toLowerCase()};base64,${String(entry.b64_json || '')}`)
				: decodeDataUrl(entry);
			if (!write(image)) return { error: 'Grok media references must be PNG, JPEG, or WebP data URLs or { b64_json, mime_type } objects.' };
		}
		for (const source of paths) {
			try {
				const bytes = fs.readFileSync(String(source));
				const extension = path.extname(String(source)).toLowerCase();
				const mime_type = extension === '.png' ? 'image/png' : (extension === '.webp' ? 'image/webp' : (extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : ''));
				if (!write({ mime_type, bytes })) return { error: 'Grok media reference paths must point to PNG, JPEG, or WebP files smaller than 20 MB.' };
			} catch (error) { return { error: 'A Grok media reference path could not be read.' }; }
		}
		return { paths: materialized };
	}

	function collectOutputFiles(root, extensions) {
		const found = [];
		const walk = (folder) => {
			for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
				const full = path.join(folder, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (extensions.test(entry.name)) found.push(full);
			}
		};
		walk(root);
		return found;
	}

	function importGrokSessionArtifacts(resultText, workspace, targetDir, extensions) {
		let payload;
		try { payload = JSON.parse(String(resultText || '')); } catch (error) { return []; }
		const sessionId = String(payload && payload.sessionId || '');
		if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return [];
		const sessionsRoot = path.resolve(options.grokSessionsRoot || path.join(os.homedir(), '.grok', 'sessions'));
		const sessionDir = path.resolve(sessionsRoot, encodeURIComponent(path.resolve(workspace)), sessionId);
		if (sessionDir !== sessionsRoot && !sessionDir.startsWith(`${sessionsRoot}${path.sep}`)) return [];
		let files = [];
		try { files = collectOutputFiles(sessionDir, extensions); } catch (error) { return []; }
		return files.map((source, index) => {
			const extension = path.extname(source).toLowerCase();
			const target = path.join(targetDir, `generated-${index + 1}${extension}`);
			fs.copyFileSync(source, target);
			return target;
		});
	}

	function upstreamGrokMediaTimeout(resultText, toolName) {
		let payload;
		try { payload = JSON.parse(String(resultText || '')); } catch (error) { return null; }
		const responseText = String(payload && payload.text || '');
		const timeout = responseText.match(/(?:timed out after|did not complete within)\s*(\d+)\s*(?:s|seconds?)\b/i);
		if (!timeout) return null;
		const seconds = Number(timeout[1]);
		if (!Number.isFinite(seconds) || seconds <= 0) return null;
		const requestId = String(payload && payload.requestId || '').trim();
		return {
			success: false,
			category: 'timeout',
			code: 'grok_media_timeout',
			message: `Grok Imagine ${toolName} timed out after ${seconds} seconds.${requestId ? ` Request ID: ${requestId}.` : ''}`,
			details: { upstream_timeout_seconds: seconds, upstream_request_id: requestId },
		};
	}

	function mediaFailure(result, toolName) {
		const message = String(result && result.message || 'Grok Imagine request failed.');
		if (result && result.code === 'grok_media_timeout') return result;
		const upstreamStatus = /(?:http(?:_status|\s+status)?["'\s:=]+|\bstatus\s+)(402|429)\b/i.exec(message);
		const statusCode = upstreamStatus ? Number(upstreamStatus[1]) : 0;
		const usageExhausted = statusCode === 402 || /(?:usage|balance|quota|credits?).{0,96}(?:exhausted|depleted|exceeded)|(?:exhausted|depleted).{0,96}(?:usage|balance|quota|credits?)/i.test(message);
		if (usageExhausted) {
			return {
				success: false,
				category: 'rate_limit',
				code: 'grok_usage_exhausted',
				message: 'Grok usage balance is exhausted. Add or renew Grok usage, then retry this request.',
				retryable: true,
				details: { provider: 'grok-cli', ...(statusCode ? { upstream_status: statusCode } : {}) },
			};
		}
		if (statusCode === 429 || /rate limit|too many requests|request limit/i.test(message)) {
			return {
				success: false,
				category: 'rate_limit',
				code: 'grok_rate_limited',
				message: 'Grok rate limit reached. Wait a moment, then retry this request.',
				retryable: true,
				details: { provider: 'grok-cli', ...(statusCode ? { upstream_status: statusCode } : {}) },
			};
		}
		if (/moderation|safety policy|content policy|blocked/i.test(message)) return { success: false, category: 'moderation', code: 'grok_media_moderated', message: 'Grok Imagine blocked this media request.' };
		if (/unknown tool|unsupported tool|tool .*not found|not available|unrecognized/i.test(message)) {
			if (toolName === 'image_to_video' || toolName === 'reference_to_video') { unavailableTools.videos = true; imagine = { ...imagine, videos: false, diagnostic: 'Grok Imagine video tools are unavailable.' }; }
			else { unavailableTools = { images: true, videos: true }; imagine = { ...imagine, images: false, videos: false, diagnostic: 'Grok Imagine image tools are unavailable.' }; }
			return { success: false, category: 'configuration', code: 'grok_imagine_tool_unavailable', message: imagine.diagnostic };
		}
		return { ...result, code: result && result.code === 'cli_timeout' ? 'grok_media_timeout' : 'grok_media_failed', message };
	}

	driver.job_types = ['chat', 'images', 'videos'];
	driver.supports = (jobType) => jobType === 'chat' || (jobType === 'images' && imagine.images) || (jobType === 'videos' && imagine.videos);
	driver.capabilities = () => {
		const base = baseCapabilities();
		const mediaReady = !!base.ready && imagine.images;
		return { ...base, job_types: ['chat', ...(mediaReady ? ['images'] : []), ...(mediaReady && imagine.videos ? ['videos'] : [])], features: { chat: true, coding: true, images: mediaReady, image_edit: mediaReady, videos: mediaReady && imagine.videos ? 'experimental' : false, image_references: mediaReady, imagine_detected: imagine.checked }, imagine: { detected: imagine.images, path: imagine.path ? '<detected>' : '', video_verified: imagine.video_verified, diagnostic: imagine.diagnostic } };
	};
	driver.models = () => {
		const base = baseModels();
		const state = baseCapabilities();
		if (!state.ready || !imagine.images) return base;
		return [...base, { id: 'model-relay:grok-cli:image', type: 'image', backend: 'grok-cli', ready: true }, ...(imagine.videos ? [{ id: 'model-relay:grok-cli:video', type: 'video', backend: 'grok-cli', ready: true, experimental: true, verified: imagine.video_verified }] : [])];
	};
	driver.refresh = async (refreshOptions = {}) => {
		const state = await baseRefresh();
		if (refreshOptions.resetMedia) unavailableTools = { images: false, videos: false };
		const detected = probeImagine();
		imagine = { ...detected, images: detected.images && !unavailableTools.images, videos: detected.videos && !unavailableTools.videos, video_verified: refreshOptions.resetMedia ? false : (imagine.video_verified && detected.videos) };
		return { ...state, imagine };
	};
	async function media(kind, payload = {}, session = {}) {
		const state = await driver.refresh();
		if (!state.ready) return { success: false, category: 'configuration', code: 'grok_cli_unavailable', message: `Grok CLI is unavailable: ${state.diagnostic}` };
		if (!driver.supports(kind)) return { success: false, category: 'configuration', code: 'grok_imagine_unavailable', message: `Grok ${kind === 'images' ? 'image' : 'video'} generation is unavailable: ${imagine.diagnostic}` };
		const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-grok-'));
		try {
			const inputDir = path.join(workspace, 'input');
			const outputDir = path.join(workspace, 'output');
			fs.mkdirSync(inputDir); fs.mkdirSync(outputDir);
			const references = materializeReferences(payload, inputDir);
			if (references.error) return { success: false, category: 'validation', code: 'grok_reference_invalid', message: references.error };
			const runImagineTool = async (toolName, targetDir, sourcePaths = [], outputLabel = kind === 'images' ? 'image' : 'video') => {
				const instruction = `Call the ${toolName} tool exactly once to create the requested ${outputLabel}${sourcePaths.length ? ` using ${sourcePaths.join(', ')}` : ''}.`;
                                const preferences = generationPreferences(payload, kind);
                                const prompt = `${instruction} The tool saves the generated file in its managed Grok session directory; do not search for, copy, or move it. Do not call any other tool.${preferences ? ` ${preferences}` : ''} User request: ${String(payload.prompt || '').trim()}`;
				if (session.appendSessionInput) {
					session.appendSessionInput('grok cli request', `Tool: ${toolName}\nWorkspace: ${workspace}\n\nPrompt (passed with --single; stdin is empty):\n${prompt}`);
				}
				const result = await runTextCommand(state.command, ['--single', prompt, '--output-format', 'json', '--cwd', workspace, '--disallowed-tools', 'run_terminal_cmd', '--permission-mode', 'dontAsk', '--no-subagents', '--disable-web-search', '--max-turns', '2'], '', session, { ...options, timeoutMs: mediaTimeoutMs });
				if (result.success) {
					const upstreamTimeout = upstreamGrokMediaTimeout(result.text, toolName);
					if (upstreamTimeout) return upstreamTimeout;
					importGrokSessionArtifacts(result.text, workspace, targetDir, outputLabel === 'video' ? /\.(mp4|webm|mov)$/i : /\.(png|jpe?g|webp)$/i);
				}
				return result;
			};
			let generatedSource = false;
			if (kind === 'videos' && !references.paths.length) {
				const sourceDir = path.join(outputDir, 'source');
				fs.mkdirSync(sourceDir);
				const sourceResult = await runImagineTool('image_gen', sourceDir, [], 'source image');
				if (!sourceResult.success) return mediaFailure(sourceResult, 'image_gen');
				const sourceFiles = collectOutputFiles(sourceDir, /\.(png|jpe?g|webp)$/i);
				if (!sourceFiles.length) return { success: false, category: 'grok_media', code: 'grok_media_source_missing', message: 'Grok could not create a source image for the video request.' };
				references.paths.push(sourceFiles[0]);
				generatedSource = true;
			}
			const toolName = kind === 'images' ? (references.paths.length ? 'image_edit' : 'image_gen') : (references.paths.length > 1 && !generatedSource ? 'reference_to_video' : 'image_to_video');
			const result = await runImagineTool(toolName, outputDir, references.paths);
			if (!result.success) return mediaFailure(result, toolName);
			const files = collectOutputFiles(outputDir, kind === 'images' ? /\.(png|jpe?g|webp)$/i : /\.(mp4|webm|mov)$/i);
			if (!files.length) return { success: false, category: 'grok_media', code: 'grok_media_artifact_missing', message: `Grok completed without saving a ${kind === 'images' ? 'generated image' : 'generated video'} in the request workspace.` };
			if (kind === 'images') return { success: true, response: { data: files.map((file) => ({ b64_json: fs.readFileSync(file).toString('base64'), mime_type: file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg' })), provider_details: { provider: 'grok-cli', imagine_tool: toolName } } };
			imagine = { ...imagine, video_verified: true };
			const bytes = fs.readFileSync(files[0]); return { success: true, response: { b64_video: bytes.toString('base64'), mime_type: files[0].endsWith('.webm') ? 'video/webm' : 'video/mp4', provider_details: { provider: 'grok-cli', imagine_tool: toolName, generated_source_image: generatedSource, experimental: true } } };
		} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
	}
	driver.images = (payload, session) => media('images', payload, session);
	driver.videos = (payload, session) => media('videos', payload, session);
	return driver;
}

function createAntigravityCliDriver(mediaAnalysis, options = {}) {
	// Antigravity's Windows installer currently places the executable here.  This
	// is an explicit, read-only discovery fallback: it neither modifies PATH nor
	// invokes the CLI installer.  An explicit Relay setting and environment
	// override still take precedence.
	const installedWindowsBinary = process.platform === 'win32'
		? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'agy', 'bin', 'agy.exe')
		: '';
	const definition = {
		id: 'antigravity-cli',
		label: 'Antigravity CLI',
		candidates: [options.command, process.env.AI_MODEL_RELAY_ANTIGRAVITY_BINARY, installedWindowsBinary, 'agy'].filter(Boolean),
		versionArgs: ['--version'],
		jobTypes: ['chat', 'images', 'media.analyze'],
		models: ['auto'],
	};
	const stateRoot = path.resolve(options.stateRoot || process.env.AI_MODEL_RELAY_ANTIGRAVITY_STATE_DIR || path.join(os.homedir(), '.gemini', 'antigravity-cli'));
	const detector = options.detectCliAsync || detectCliAsync;
	const commandRunner = options.runTextCommand || runTextCommand;
	const imageTimeoutMs = Number(options.imageTimeoutMs || process.env.AI_MODEL_RELAY_ANTIGRAVITY_IMAGE_TIMEOUT_MS || 1800000);
	const mediaTimeoutMs = Number(options.mediaTimeoutMs || process.env.AI_MODEL_RELAY_ANTIGRAVITY_MEDIA_TIMEOUT_MS || 600000);
	const chatTimeoutMs = Number(options.chatTimeoutMs || process.env.AI_MODEL_RELAY_ANTIGRAVITY_CHAT_TIMEOUT_MS || 600000);
	let snapshot = { id: definition.id, label: definition.label, kind: 'local-cli', installed: null, ready: false, authenticated: null, state: 'checking', diagnostic: 'Checking Antigravity CLI in background.', job_types: definition.jobTypes, features: {} };

	function imageExtension(mime) {
		return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp' }[String(mime || '').toLowerCase()] || '';
	}

	function decodeImage(value) {
		const match = String(value || '').match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
		if (!match) return null;
		const encoded = match[2].replace(/\s+/g, '');
		if (!encoded || encoded.length % 4 === 1) return null;
		const bytes = Buffer.from(encoded, 'base64');
		return bytes.length ? { mime_type: match[1].toLowerCase(), bytes } : null;
	}

	function materializeImageReferences(payload, inputDir) {
		const entries = [payload.input_reference_data_url, payload.input_reference, ...(Array.isArray(payload.reference_images) ? payload.reference_images : []), ...(Array.isArray(payload.frames) ? payload.frames : [])].filter(Boolean);
		const sourcePaths = Array.isArray(payload.referenced_image_paths) ? payload.referenced_image_paths.filter(Boolean) : [];
		const paths = [];
		const write = (image) => {
			if (!image || !image.bytes || image.bytes.length > 20 * 1024 * 1024) return false;
			const extension = imageExtension(image.mime_type);
			if (!extension) return false;
			const target = path.join(inputDir, `reference-${paths.length + 1}.${extension}`);
			fs.writeFileSync(target, image.bytes);
			paths.push(target);
			return true;
		};
		for (const entry of entries) {
			const image = typeof entry === 'object' && !Buffer.isBuffer(entry)
				? decodeImage(`data:${String(entry.mime_type || 'image/jpeg').toLowerCase()};base64,${String(entry.b64_json || '')}`)
				: decodeImage(entry);
			if (!write(image)) return { error: 'Antigravity image references must be PNG, JPEG, or WebP data URLs or { b64_json, mime_type } objects smaller than 20 MB.' };
		}
		for (const source of sourcePaths) {
			try {
				const bytes = fs.readFileSync(String(source));
				const extension = path.extname(String(source)).toLowerCase();
				const mime_type = extension === '.png' ? 'image/png' : (extension === '.webp' ? 'image/webp' : (extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : ''));
				if (!write({ mime_type, bytes })) return { error: 'Antigravity image reference paths must point to PNG, JPEG, or WebP files smaller than 20 MB.' };
			} catch (error) {
				return { error: 'An Antigravity image reference path could not be read.' };
			}
		}
		return { paths };
	}

	function findGeneratedImages(imageName, startedAt) {
		const found = [];
		const root = stateRoot;
		const acceptedStems = [imageName, imageName.replace(/-/g, '_')];
		if (!fs.existsSync(root)) return found;
		const maxEntries = 5000;
		let scanned = 0;
		const walk = (folder, depth) => {
			if (depth > 8 || scanned >= maxEntries) return;
			let entries;
			try { entries = fs.readdirSync(folder, { withFileTypes: true }); } catch (error) { return; }
			for (const entry of entries) {
				if (scanned >= maxEntries) return;
				scanned += 1;
				const target = path.resolve(folder, entry.name);
				if (target !== root && !target.startsWith(`${root}${path.sep}`)) continue;
				if (entry.isDirectory()) { walk(target, depth + 1); continue; }
				if (!entry.isFile()) continue;
				const extension = path.extname(entry.name).toLowerCase();
				const stem = path.basename(entry.name, extension);
				const matchingName = acceptedStems.some((candidate) => stem === candidate || stem.startsWith(`${candidate}-`) || stem.startsWith(`${candidate}_`));
				if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension) || !matchingName) continue;
				try {
					const stat = fs.statSync(target);
					if (stat.size > 0 && stat.size <= 20 * 1024 * 1024 && stat.mtimeMs >= startedAt - 5000) found.push({ path: target, mtimeMs: stat.mtimeMs });
				} catch (error) {}
			}
		};
		walk(root, 0);
		return found.sort((left, right) => right.mtimeMs - left.mtimeMs);
	}

	function resultFailure(result, operation) {
		if (result && result.success) {
			snapshot = { ...snapshot, authenticated: true, state: 'ready', diagnostic: 'Ready.' };
			return null;
		}
		const message = String(result && result.message || 'Antigravity CLI request failed.');
		if (/not logged in|not authenticated|no auth credentials|login required|sign in/i.test(message)) {
			snapshot = { ...snapshot, authenticated: false, ready: false, state: 'not_authenticated', diagnostic: 'Not authenticated.' };
			return { success: false, category: 'configuration', code: 'antigravity_cli_not_authenticated', message: 'Antigravity CLI is not authenticated. Run agy interactively and sign in with the same Windows account.' };
		}
		if (/unknown tool|tool .*not found|generate_image.*unavailable|unsupported tool/i.test(message)) {
			return { ...result, code: 'antigravity_cli_tool_unavailable', message: `Antigravity CLI ${operation} tooling is unavailable.` };
		}
		if (result && result.code === 'cli_timeout') return { ...result, code: 'antigravity_cli_timeout', message: `Antigravity CLI ${operation} timed out.` };
		if (result && result.code === 'cli_request_failed') return { ...result, code: 'antigravity_cli_request_failed', message: `Antigravity CLI ${operation} failed: ${message}` };
		return result || { success: false, category: 'cli_process', code: 'antigravity_cli_request_failed', message };
	}

	function parseText(value) {
		if (!value || typeof value !== 'object') return '';
		for (const key of ['text', 'content', 'message', 'response', 'result', 'output']) {
			const candidate = value[key];
			if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
			if (candidate && typeof candidate === 'object') {
				const nested = parseText(candidate);
				if (nested) return nested;
			}
		}
		return '';
	}

	async function runPrompt(workspace, prompt, timeoutMs, session) {
		const args = ['-p', prompt];
		if (snapshot.print_json_supported) args.push('-o', 'json');
		const result = await commandRunner(snapshot.command, args, '', session, { ...options, cwd: workspace, timeoutMs });
		return resultFailure(result, 'request') || result;
	}

	const driver = {
		id: definition.id,
		label: definition.label,
		kind: 'local-cli',
		job_types: definition.jobTypes,
		checkStatus: () => ({ success: snapshot.ready, message: snapshot.diagnostic, details: snapshot }),
		capabilities: () => ({
			...snapshot,
			id: definition.id,
			label: definition.label,
			kind: 'local-cli',
			features: { chat: true, images: !!snapshot.ready, image_edit: !!snapshot.ready, media_analysis: !!snapshot.ready, video_input: !!snapshot.ready },
			state_root: fs.existsSync(stateRoot) ? '<detected>' : '',
			requires: ['AI_MODEL_RELAY_ANTIGRAVITY_BINARY or agy on PATH', 'Authenticated Antigravity CLI session'],
		}),
		models: () => snapshot.ready ? [
			{ id: 'model-relay:antigravity-cli:auto', type: 'text', backend: definition.id, ready: true, job_types: ['chat'] },
			{ id: 'model-relay:antigravity-cli:image', type: 'image', backend: definition.id, ready: true, job_types: ['images'] },
			{ id: 'model-relay:antigravity-cli:media', type: 'text', backend: definition.id, ready: true, job_types: ['media.analyze'] },
		] : [],
		async refresh() {
			const detected = await detector(definition, options);
			if (!detected || !detected.installed || !detected.command) {
				snapshot = { ...snapshot, ...(detected || {}), ready: false, authenticated: null, state: 'unavailable', diagnostic: detected && detected.diagnostic || 'Antigravity CLI executable was not found.' };
				return snapshot;
			}
			const help = await commandRunner(detected.command, ['--help'], '', {}, { ...options, timeoutMs: 15000 });
			const helpText = `${help && help.text || ''}\n${help && help.stderr || ''}`;
			const supportsPrompt = /(?:^|[\s,])-p(?:[\s,]|$)|--(?:print|prompt)\b/i.test(helpText);
			if (!help || !help.success || !supportsPrompt) {
				snapshot = { ...snapshot, ...detected, ready: false, authenticated: null, state: 'unsupported', diagnostic: 'Installed Antigravity CLI does not expose non-interactive -p/--print support.' };
				return snapshot;
			}
			const printJsonSupported = /(?:^|[\s,])-o(?:[\s,]|$)|--output-format/i.test(helpText);
			snapshot = { ...snapshot, ...detected, print_json_supported: printJsonSupported, ready: snapshot.authenticated !== false, authenticated: snapshot.authenticated, state: snapshot.authenticated === false ? 'not_authenticated' : 'ready', diagnostic: snapshot.authenticated === false ? 'Not authenticated.' : (printJsonSupported ? 'Ready; authentication will be confirmed on the first request.' : 'Ready; CLI print-mode text output will be normalized locally.') };
			return snapshot;
		},
		async chat(payload = {}, session = {}) {
			const state = await driver.refresh();
			if (!state.ready) return { success: false, category: 'configuration', code: state.state === 'not_authenticated' ? 'antigravity_cli_not_authenticated' : 'antigravity_cli_unavailable', message: `Antigravity CLI is unavailable: ${state.diagnostic}` };
			const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-antigravity-'));
			try {
				const prompt = String(messagesToText(payload) || '').trim().slice(0, 24000);
				const result = await runPrompt(workspace, prompt || 'Respond concisely to the user request.', chatTimeoutMs, session);
				if (!result.success) return result;
				let parsed = null;
				try { parsed = JSON.parse(result.text); } catch (error) {}
				return normalizeChatResponse('antigravity-cli', 'auto', parsed, parseText(parsed) || result.text);
			} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
		},
		async images(payload = {}, session = {}) {
			const state = await driver.refresh();
			if (!state.ready) return { success: false, category: 'configuration', code: state.state === 'not_authenticated' ? 'antigravity_cli_not_authenticated' : 'antigravity_cli_unavailable', message: `Antigravity CLI is unavailable: ${state.diagnostic}` };
			const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-antigravity-'));
			try {
				const inputDir = path.join(workspace, 'input');
				fs.mkdirSync(inputDir);
				const references = materializeImageReferences(payload, inputDir);
				if (references.error) return { success: false, category: 'validation', code: 'antigravity_reference_invalid', message: references.error };
				const imageName = `relay-${Date.now()}-${randomUUID()}`;
				const referenceInstruction = references.paths.length ? ` Use these exact ImagePaths: ${JSON.stringify(references.paths)}.` : ' Do not use ImagePaths.';
                                const preferences = generationPreferences(payload, 'images');
                                const prompt = `Call generate_image exactly once with ImageName ${JSON.stringify(imageName)}.${referenceInstruction} Do not call shell, file, browser, subagent, or any other tools.${preferences ? ` ${preferences}` : ''} User image request: ${String(payload.prompt || '').trim().slice(0, 24000)}`;
				const startedAt = Date.now();
				const result = await runPrompt(workspace, prompt, imageTimeoutMs, session);
				if (!result.success) return result;
				const images = findGeneratedImages(imageName, startedAt);
				if (!images.length) return { success: false, category: 'output_detection', code: 'antigravity_image_artifact_missing', message: 'Antigravity CLI completed without creating the requested image artifact.' };
				return {
					success: true,
					response: {
						data: images.map((image) => {
							const extension = path.extname(image.path).toLowerCase();
							return { b64_json: fs.readFileSync(image.path).toString('base64'), mime_type: extension === '.png' ? 'image/png' : (extension === '.webp' ? 'image/webp' : 'image/jpeg') };
						}),
						provider_details: { provider: 'antigravity-cli', tool: 'generate_image', artifact_imported: true, reference_images: references.paths.length },
					},
				};
			} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
		},
		async 'media.analyze'(payload = {}, session = {}) {
			const state = await driver.refresh();
			if (!state.ready) return { success: false, category: 'configuration', code: state.state === 'not_authenticated' ? 'antigravity_cli_not_authenticated' : 'antigravity_cli_unavailable', message: `Antigravity CLI is unavailable: ${state.diagnostic}` };
			const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-antigravity-'));
			try {
				const materialized = mediaAnalysis && typeof mediaAnalysis.materializeMedia === 'function'
					? await mediaAnalysis.materializeMedia(payload, workspace)
					: null;
				if (materialized && materialized.error) return { success: false, category: 'validation', code: 'antigravity_media_invalid', message: materialized.error };
				let attachments = materialized && materialized.path ? [`@${materialized.path}`] : [];
				let frameCount = 0;
				if (!attachments.length) {
					const inputDir = path.join(workspace, 'input');
					fs.mkdirSync(inputDir);
					const references = materializeImageReferences({ frames: mediaAnalysis && mediaAnalysis.framesFromPayload ? mediaAnalysis.framesFromPayload(payload) : payload.frames || [] }, inputDir);
					if (references.error) return { success: false, category: 'validation', code: 'antigravity_media_invalid', message: references.error };
					attachments = references.paths.map((item) => `@${item}`);
					frameCount = references.paths.length;
				}
				if (!attachments.length) return { success: false, category: 'validation', code: 'media_frames_required', message: 'Provide bounded image frames, an HTTPS media URL, or a bounded video data URL for Antigravity analysis.' };
				const prompt = `Analyze the attached media ${attachments.join(' ')}. Do not call shell, file, browser, subagent, or any other tools. Return a concise, factual answer focused on the user request: ${String(payload.prompt || 'Analyze the visual content, visible text, timing, and user-facing issues.').trim().slice(0, 24000)}`;
				const result = await runPrompt(workspace, prompt, mediaTimeoutMs, session);
				if (!result.success) return result;
				let parsed = null;
				try { parsed = JSON.parse(result.text); } catch (error) {}
				const normalized = normalizeChatResponse('antigravity-cli', 'media', parsed, parseText(parsed) || result.text);
				normalized.response.provider_details = {
					...(normalized.response.provider_details || {}),
					media_analysis: { provider: 'antigravity-cli', video_attached: !!(materialized && materialized.path), source: materialized && materialized.source || 'frames', frames_supplied: frameCount },
				};
				return normalized;
			} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
		},
	};
	return driver;
}

function createCursorCliDriver(options = {}) {
	return createNamedCliDriver({ id: 'cursor-cli', label: 'Cursor Agent', candidates: [options.command, process.env.AI_MODEL_RELAY_CURSOR_BINARY, 'cursor-agent'], versionArgs: ['--version'], authArgs: ['status'], jobTypes: ['chat'], models: ['auto'], requestArgs: (model, prompt) => ['--print', '--output-format', 'json', ...(model !== 'auto' ? ['--model', model] : []), prompt] }, options);
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

function createMusicAnalysisDriver(musicAnalysis) {
	const model = musicAnalysis && musicAnalysis.MODEL_ID || 'model-relay:music-analysis:core';
	return {
		id: 'music-analysis',
		label: 'Local Music Analysis',
		kind: 'local-runtime',
		job_types: ['music.analyze'],
		checkStatus: () => {
			const caps = musicAnalysis && musicAnalysis.capabilities ? musicAnalysis.capabilities() : { enabled: false, ready: false };
			return { success: caps.ready === true, message: caps.ready === true ? 'Local music analysis runtime is ready.' : 'Local music analysis runtime has not been set up or checked.', details: caps };
		},
		capabilities: () => {
			const caps = musicAnalysis && musicAnalysis.capabilities ? musicAnalysis.capabilities() : { enabled: false, ready: false, models: [] };
			return {
				id: 'music-analysis',
				label: 'Local Music Analysis',
				kind: 'local-runtime',
				enabled: caps.enabled !== false,
				ready: caps.ready === true,
				runtime_checked: caps.runtime_checked,
				models: caps.models || [model],
				diagnostic: caps.ready === false ? 'Set up or refresh the local music-analysis runtime.' : '',
			};
		},
		models: () => [{ id: model, type: 'audio', backend: 'music-analysis' }],
		'music.analyze': (payload, session) => musicAnalysis.analyze(payload, session),
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
		job_types: ['chat', 'transcribe'],
		checkStatus: () => ({ success: !!apiKey, message: apiKey ? 'xAI API key is configured.' : 'xAI API key is not configured.', details: { provider: 'xai-api', configured: !!apiKey, base_url: baseUrl } }),
		capabilities: () => ({
			id: 'xai-api',
			label: 'Grok / xAI API',
			kind: 'api',
			enabled: !!apiKey,
			configured: !!apiKey,
			ready: !!apiKey,
			models: [...defaultModels.map((id) => relayModel('xai', id)), 'model-relay:xai:stt'],
			features: { chat: true, speech_to_text: true, cloud_audio: true },
			requires: ['XAI_API_KEY or AI_MODEL_RELAY_XAI_API_KEY'],
		}),
		models: () => [...defaultModels.map((id) => ({ id: relayModel('xai', id), type: 'text', backend: 'xai-api' })), { id: 'model-relay:xai:stt', type: 'audio', backend: 'xai-api' }],
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
				const message = redactProviderSecret(parsed && parsed.error && parsed.error.message || `xAI API request failed with HTTP ${response.status}.`, apiKey);
				return { success: false, category: response.status === 401 || response.status === 403 ? 'configuration' : 'api', code: 'xai_api_failed', message, details: { status: response.status, provider: 'xai-api' } };
			}
			return normalizeChatResponse('xai', model, parsed, text);
		},
		async transcribe(payload = {}, session = {}) {
			if (!apiKey) {
				return { success: false, category: 'configuration', code: 'xai_api_key_missing', message: 'Grok/xAI API requires XAI_API_KEY or AI_MODEL_RELAY_XAI_API_KEY.' };
			}
			if (!fetchImpl || typeof FormData === 'undefined' || typeof Blob === 'undefined') {
				return { success: false, category: 'configuration', code: 'xai_stt_runtime_unavailable', message: 'This Node runtime does not provide multipart upload support for xAI Speech-to-Text.' };
			}
			const audioBytes = decodeAudioBase64(payload.audio_base64);
			if (!audioBytes) {
				return { success: false, category: 'validation', code: 'xai_stt_audio_invalid', message: 'Audio payload is missing, invalid, or too large.' };
			}
			const form = new FormData();
			const options = payload.xai_options && typeof payload.xai_options === 'object' ? payload.xai_options : payload;
			const language = String(options.language || options.locale || '').trim();
			if (language) form.append('language', language);
			for (const key of ['format', 'diarize', 'filler_words', 'multichannel', 'channels']) {
				if (options[key] !== undefined && options[key] !== null && options[key] !== '') form.append(key, String(options[key]));
			}
			const keyterms = Array.isArray(options.keyterms) ? options.keyterms : (Array.isArray(options.key_terms) ? options.key_terms : []);
			for (const keyterm of keyterms.slice(0, 100)) {
				const value = String(keyterm || '').trim().slice(0, 50);
				if (value) form.append('keyterm', value);
			}
			const file = xaiAudioFileInfo(payload.audio_format);
			// xAI requires the file to be the final multipart field.
			form.append('file', new Blob([audioBytes], { type: file.mime_type }), `audio.${file.extension}`);
			if (typeof session.appendSessionOutput === 'function') session.appendSessionOutput('stdout', 'Uploading audio to xAI Speech-to-Text.\n');
			let response;
			let text;
			try {
				response = await fetchImpl(`${baseUrl}/stt`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
				text = await response.text();
			} catch (error) {
				return { success: false, category: 'api', code: 'xai_stt_request_failed', message: 'xAI Speech-to-Text could not be reached.', retryable: true, details: { provider: 'xai-api' } };
			}
			let parsed = null;
			try { parsed = text ? JSON.parse(text) : {}; } catch (error) {}
			if (!response.ok) {
				const message = redactProviderSecret(parsed && parsed.error && parsed.error.message || `xAI Speech-to-Text request failed with HTTP ${response.status}.`, apiKey);
				return {
					success: false,
					category: response.status === 401 || response.status === 403 ? 'configuration' : (response.status === 413 ? 'validation' : (response.status === 429 ? 'rate_limit' : 'api')),
					code: 'xai_stt_failed',
					message,
					retryable: response.status === 429 || response.status >= 500,
					details: { status: response.status, provider: 'xai-api' },
				};
			}
			const words = normalizeXaiWords(parsed && parsed.words);
			return {
				success: true,
				response: {
					text: String(parsed && parsed.text || '').trim() || words.map((word) => word.word).join(' '),
					words,
					language: String(parsed && parsed.language || '').trim() || undefined,
					duration_seconds: Number(parsed && (parsed.duration_seconds ?? parsed.duration) || 0) || undefined,
					channels: Array.isArray(parsed && parsed.channels) ? parsed.channels : undefined,
					model: 'model-relay:xai:stt',
					provider_details: { provider: 'xai-api', raw_model: 'stt', cloud: true },
				},
			};
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
	const cliPaths = options.cliPaths && typeof options.cliPaths === 'object' ? options.cliPaths : {};
	const configuredCliOptions = (driverOptions, key) => {
		const command = typeof cliPaths[key] === 'string' ? cliPaths[key].trim() : '';
		return command ? { ...(driverOptions || {}), command } : (driverOptions || {});
	};
	const drivers = [
		createCodexCliDriver(options.codex, options.mediaAnalysis),
		createGrokCliDriver(configuredCliOptions(options.grok, 'grok-cli')),
		createAntigravityCliDriver(options.mediaAnalysis, configuredCliOptions(options.antigravity, 'antigravity-cli')),
		createCursorCliDriver(configuredCliOptions(options.cursor, 'cursor-cli')),
		createLocalAsrDriver(options.codex),
		createMusicAnalysisDriver(options.musicAnalysis),
		createOpenAiVideosDriver(options.video),
		createXaiApiDriver(options.xai || {}),
		createCliProcessDriver(configuredCliOptions(options.cli, 'cli-process')),
		createApiKeyChatDriver(options.apiKeyChat || {}),
	].filter(Boolean);
	const byId = new Map(drivers.map((driver) => [driver.id, driver]));
	const aliases = {
		codex: 'codex-cli',
		'codex-cli': 'codex-cli',
		grok: 'grok-cli',
		'grok-cli': 'grok-cli',
		antigravity: 'antigravity-cli',
		'antigravity-cli': 'antigravity-cli',
		cursor: 'cursor-cli',
		'cursor-cli': 'cursor-cli',
		asr: 'local-asr',
		'local-asr': 'local-asr',
		'music-analysis': 'music-analysis',
		xai: 'xai-api',
		'xai-api': 'xai-api',
		cli: 'cli-process',
		'cli-process': 'cli-process',
		'api-key-chat': 'api-key-chat',
		video: 'openai-videos',
		'openai-videos': 'openai-videos',
	};

	function requestedSelection(payload = {}) {
		const provider = providerFromPayload(payload);
		const model = String(payload && payload.model || '').trim();
		return { provider, model, explicit: !!(provider || model) };
	}

	function expectedModelType(jobType) {
		return ({ chat: 'text', images: 'image', videos: 'video', transcribe: 'audio', 'media.analyze': 'text', 'music.analyze': 'audio' })[jobType] || '';
	}

	function capabilitiesFor(driver) {
		if (!driver || !driver.capabilities) return null;
		const capabilities = driver.capabilities();
		return { ...capabilities, job_types: capabilities.job_types || driver.job_types || [] };
	}

	function resolve(jobType, payload = {}) {
		const selection = requestedSelection(payload);
		if (!selection.explicit) return { error: { success: false, category: 'configuration', code: 'backend_selection_missing', message: `No provider or model was selected for ${jobType}.` } };
		const id = aliases[selection.provider] || selection.provider;
		const driver = byId.get(id);
		if (!driver) return { error: { success: false, category: 'configuration', code: 'backend_unknown', message: `Selected provider is unavailable: ${selection.model || selection.provider}.`, details: { job_type: jobType, provider: selection.provider, model: selection.model } } };
		const capabilities = capabilitiesFor(driver);
		const supported = driver.supports ? driver.supports(jobType) : (capabilities.job_types || []).includes(jobType);
		if (!supported || typeof driver[jobType] !== 'function') return { error: { success: false, category: 'configuration', code: 'backend_unsupported', message: `Selected provider does not support ${jobType}: ${selection.model || selection.provider}.`, details: { job_type: jobType, provider: driver.id, model: selection.model } } };
		if (!capabilities.ready) return { error: { success: false, category: 'configuration', code: 'backend_unavailable', message: `Selected provider is unavailable: ${selection.model || selection.provider}. ${capabilities.diagnostic || 'Refresh provider detection or select another provider.'}`, details: { job_type: jobType, provider: driver.id, model: selection.model } } };
		if (selection.model) {
			const model = (driver.models ? driver.models() : []).find((entry) => entry.id === selection.model || entry.legacy_id === selection.model);
			const expected = expectedModelType(jobType);
			if (model && expected && model.type !== expected) return { error: { success: false, category: 'configuration', code: 'backend_model_incompatible', message: `Selected model is incompatible with ${jobType}: ${selection.model}.`, details: { job_type: jobType, provider: driver.id, model: selection.model } } };
			if (model && Array.isArray(model.job_types) && model.job_types.length && !model.job_types.includes(jobType)) return { error: { success: false, category: 'configuration', code: 'backend_model_incompatible', message: `Selected model does not support ${jobType}: ${selection.model}.`, details: { job_type: jobType, provider: driver.id, model: selection.model } } };
		}
		return { driver, capabilities, provider: driver.id };
	}

	function driverFor(jobType, payload = {}) {
		return resolve(jobType, payload).driver || null;
	}

	return {
		list: () => drivers.slice(),
		capabilities: () => drivers.map((driver) => capabilitiesFor(driver)),
		models: () => drivers.flatMap((driver) => {
			const capabilities = capabilitiesFor(driver);
			return driver.models().map((model) => ({ ...model, ready: model.ready !== undefined ? model.ready : !!capabilities.ready, job_types: model.job_types || capabilities.job_types }));
		}),
		refresh: () => Promise.all(drivers.map((driver) => driver.refresh ? driver.refresh({ resetMedia: true }) : driver.capabilities())),
		getDriver: (jobType, payload) => driverFor(jobType, payload),
		driverFor,
		resolve,
		run(jobType, payload, session) {
			const resolved = resolve(jobType, payload || {});
			if (resolved.error) return Promise.resolve(resolved.error);
			return Promise.resolve(resolved.driver[jobType](payload || {}, session || {}));
		},
	};
}

module.exports = {
	createApiKeyChatDriver,
	createAntigravityCliDriver,
	createBackendRegistry,
	createCliProcessDriver,
	createCodexCliDriver,
	createCursorCliDriver,
	createGrokCliDriver,
	createLocalAsrDriver,
	createMusicAnalysisDriver,
	createOpenAiVideosDriver,
	createXaiApiDriver,
	GROK_MEDIA_TIMEOUT_MS,
	providerFromPayload,
};
