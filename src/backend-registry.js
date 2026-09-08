'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { spawn } = require('child_process');
const { createBoundedCollector } = require('./diagnostics');
const { attachProcessAbort, killProcessTree } = require('./cuda-torch-venv');
const { detectCli, detectCliAsync, materializeChatImages, messagesToPromptJson, messagesToText, retainCliReadiness, runTextCommand, writePromptFile } = require('./local-cli');
const { createLocalUpscaleDriver } = require('./local-upscale');
const { resolveMaxTokens } = require('./token-policy');
const { IMAGE_CAPABILITY_CONTRACT_VERSION, imageCapabilityContract, isCompleteImageCapabilityContract, findRelayImageModel, normalizeImageOutputFormat, normalizeImagePayloadForModel, relayCatalogEntrySupportsImages } = require('./image-capabilities');
const { readImageDimensions } = require('./image-dimensions');
const { antigravityAuthenticationFailure, antigravityResultText, createAntigravityImageArtifactResolver, findAntigravityImagePath, isAntigravityAuthenticationError } = require('./antigravity-cli');

const RELAY_MODEL_PREFIX = 'model-relay';
const GROK_MEDIA_TIMEOUT_MS = 450000;
const MAX_AUDIO_BASE64_LENGTH = 67108864;
const MAX_CLI_PROMPT_JSON_ARG_CHARS = 8192;
const PROVIDER_FETCH_TIMEOUT_MS = Number(process.env.AI_MODEL_RELAY_PROVIDER_FETCH_TIMEOUT_MS || 60000);
const MAX_PROVIDER_DOWNLOAD_BYTES = 100 * 1024 * 1024;
const MAX_PROVIDER_JSON_BYTES = 8 * 1024 * 1024;

function combineAbortSignals(...signals) {
	const active = signals.filter(Boolean);
	if (!active.length) return undefined;
	if (active.length === 1) return active[0];
	return typeof AbortSignal.any === 'function' ? AbortSignal.any(active) : active[0];
}

function withFetchTimeout(fetchImpl, timeoutMs = PROVIDER_FETCH_TIMEOUT_MS) {
	if (typeof fetchImpl !== 'function') return fetchImpl;
	return (url, options = {}) => fetchImpl(url, {
		...options,
		signal: combineAbortSignals(options.signal, AbortSignal.timeout(Number(timeoutMs) || PROVIDER_FETCH_TIMEOUT_MS)),
	});
}

function cancelledProviderResult() {
	return {
		success: false,
		category: 'cancelled',
		code: 'local_job_cancelled',
		message: 'The local Relay job was cancelled; source bytes were preserved.',
	};
}

async function fetchWithSession(fetchImpl, url, requestOptions, session) {
	if (session && session.signal && session.signal.aborted) {
		return { error: cancelledProviderResult() };
	}
	try {
		const options = session && session.signal ? { ...requestOptions, signal: session.signal } : requestOptions;
		return { response: await fetchImpl(url, options) };
	} catch (error) {
		if (session && session.signal && session.signal.aborted) {
			return { error: cancelledProviderResult() };
		}
		throw error;
	}
}

async function readBoundedBytes(response, maxBytes = MAX_PROVIDER_DOWNLOAD_BYTES) {
	const length = Number(response && response.headers && typeof response.headers.get === 'function' ? response.headers.get('content-length') || 0 : 0);
	if (length > maxBytes) throw new Error('Provider download exceeds the maximum size.');
	if (response && response.body && typeof response.body.getReader === 'function') {
		const reader = response.body.getReader();
		const chunks = [];
		let size = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = Buffer.from(value);
			size += chunk.length;
			if (size > maxBytes) {
				try { await reader.cancel(); } catch (error) {}
				throw new Error('Provider download exceeds the maximum size.');
			}
			chunks.push(chunk);
		}
		return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
	}
	if (response && typeof response.arrayBuffer === 'function') {
		const bytes = Buffer.from(await response.arrayBuffer());
		if (bytes.length > maxBytes) throw new Error('Provider download exceeds the maximum size.');
		return bytes;
	}
	const text = typeof response.text === 'function' ? await response.text() : '';
	const bytes = Buffer.from(String(text || ''), 'utf8');
	if (bytes.length > maxBytes) throw new Error('Provider download exceeds the maximum size.');
	return bytes;
}

async function readBoundedText(response, maxBytes = MAX_PROVIDER_JSON_BYTES) {
	const bytes = await readBoundedBytes(response, maxBytes);
	return bytes.toString('utf8');
}

function decodeBoundedBase64(value, maxBytes) {
	const encoded = String(value || '').replace(/\s+/g, '');
	if (!encoded || encoded.length > Math.ceil(maxBytes / 3) * 4 + 8) return null;
	const bytes = Buffer.from(encoded, 'base64');
	if (!bytes.length || bytes.length > maxBytes) return null;
	return bytes;
}

function truthy(value) {
	return /^(1|true|yes|on)$/i.test(String(value || ''));
}

function splitArgs(value) {
	return String(value || '').match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, '')) || [];
}

function pathIsInside(parent, candidate) {
	const root = path.resolve(String(parent || ''));
	const target = path.resolve(String(candidate || ''));
	const comparableRoot = process.platform === 'win32' ? root.toLowerCase() : root;
	const comparableTarget = process.platform === 'win32' ? target.toLowerCase() : target;
	return comparableTarget === comparableRoot || comparableTarget.startsWith(`${comparableRoot}${path.sep}`);
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
	if (model.startsWith('model-relay:local-upscale:')) {
		return 'local-upscale';
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

const DEFAULT_XAI_CHAT_MODELS = 'grok-4.6,grok-4.5,grok-4.3,latest';
const XAI_IMAGINE_IMAGE_MODEL = 'grok-imagine-image-2.0';
const XAI_IMAGINE_VIDEO_MODEL = 'grok-imagine-video-1.5';
const MAX_IMAGE_REFERENCE_BYTES = 20 * 1024 * 1024;
const XAI_IMAGE_REFERENCE_LIMIT = 3;
const XAI_VIDEO_REFERENCE_LIMIT = 7;
const XAI_IMAGE_ASPECT_RATIOS = new Set(['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20', '21:9', '5:2']);
const XAI_VIDEO_ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']);
const XAI_IMAGE_RESOLUTIONS = new Set(['1k', '2k']);
const XAI_VIDEO_RESOLUTIONS = new Set(['480p', '720p', '1080p']);

function xaiModelFromRelay(model) {
	return String(model || '').replace(/^model-relay:(?:xai|grok):/, '').trim() || process.env.AI_MODEL_RELAY_XAI_MODEL || 'grok-4.6';
}

function xaiImagineImageModel(model) {
	const slug = String(model || '').replace(/^model-relay:(?:xai|grok):/, '').trim();
	if (!slug || slug === 'imagine-image' || slug === 'image') return XAI_IMAGINE_IMAGE_MODEL;
	return slug;
}

function xaiImagineVideoModel(model) {
	const slug = String(model || '').replace(/^model-relay:(?:xai|grok):/, '').trim();
	if (!slug || slug === 'imagine-video' || slug === 'video') return XAI_IMAGINE_VIDEO_MODEL;
	return slug;
}

function decodeImageDataUri(value) {
	const match = String(value || '').match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
	if (!match) return null;
	const encoded = match[2].replace(/\s+/g, '');
	if (!encoded || encoded.length % 4 === 1) return null;
	const bytes = Buffer.from(encoded, 'base64');
	if (!bytes.length || bytes.length > MAX_IMAGE_REFERENCE_BYTES) return null;
	const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
	return `data:${mime};base64,${bytes.toString('base64')}`;
}

function xaiImageReferences(payload = {}, maxCount = XAI_IMAGE_REFERENCE_LIMIT) {
	const entries = [payload.input_reference_data_url, payload.input_reference, ...(Array.isArray(payload.reference_images) ? payload.reference_images : []), ...(Array.isArray(payload.frames) ? payload.frames : [])].filter(Boolean);
	const uris = [];
	for (const entry of entries) {
		const uri = typeof entry === 'object' && !Buffer.isBuffer(entry)
			? decodeImageDataUri(`data:${String(entry.mime_type || 'image/jpeg').toLowerCase()};base64,${String(entry.b64_json || '')}`)
			: decodeImageDataUri(entry);
		if (!uri) return { error: 'xAI image references must be PNG, JPEG, or WebP data URLs or { b64_json, mime_type } objects smaller than 20 MB.' };
		uris.push(uri);
	}
	if (uris.length > maxCount) {
		return { error: `xAI Imagine accepts at most ${maxCount} reference images.` };
	}
	return { uris };
}

function xaiImagineUrlRef(uri, withType = false) {
	return withType ? { url: uri, type: 'image_url' } : { url: uri };
}

function xaiImagineImageInputs(uris) {
	if (uris.length === 1) return { image: xaiImagineUrlRef(uris[0], true) };
	if (uris.length > 1) return { images: uris.map((uri) => xaiImagineUrlRef(uri)) };
	return {};
}

function xaiImagineVideoInputs(uris) {
	if (uris.length === 1) return { image: xaiImagineUrlRef(uris[0]) };
	if (uris.length > 1) return { reference_images: uris.map((uri) => xaiImagineUrlRef(uri)) };
	return {};
}

function mimeFromImageBytes(bytes) {
	if (!bytes || !bytes.length) return 'image/jpeg';
	if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
	if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
	return 'image/jpeg';
}

function wantsGeneratedAudio(payload = {}) {
	if (payload.generate_audio === undefined || payload.generate_audio === null || payload.generate_audio === '') return true;
	return payload.generate_audio !== false && !/^(0|false|no|off)$/i.test(String(payload.generate_audio));
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
	if (response && typeof response.text === 'string') return response.text;
	if (response && typeof response.result === 'string') return response.result;
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

function assignChatSampling(body, payload = {}, jobType = 'chat') {
	const maxTokens = resolveMaxTokens(jobType, payload.max_tokens);
	body.max_tokens = maxTokens;
	body.max_completion_tokens = maxTokens;
	for (const key of ['temperature', 'top_p']) {
		if (payload[key] !== undefined) {
			body[key] = payload[key];
		}
	}
	return body;
}

function generationPreferences(payload = {}, kind) {
	const safeValue = (value, maxLength = 64) => String(value || '').trim().replace(/[\r\n]+/g, ' ').slice(0, maxLength);
	const preferences = [];
	const size = safeValue(payload.size);
	const quality = safeValue(payload.quality);
	const aspectRatio = safeValue(payload.aspect_ratio);
	const resolution = safeValue(payload.resolution);
	const seconds = Number(payload.seconds);
	if (size) preferences.push(`Requested output resolution: ${size}.`);
	if (aspectRatio) preferences.push(`Requested aspect ratio: ${aspectRatio}.`);
	if (resolution) preferences.push(`Requested resolution tier: ${resolution}.`);
	if (kind === 'videos' && Number.isFinite(seconds) && seconds > 0 && seconds <= 120) preferences.push(`Requested clip length: ${seconds} seconds.`);
	if (kind === 'videos' && payload.generate_audio !== undefined && payload.generate_audio !== null && payload.generate_audio !== '') {
		preferences.push(wantsGeneratedAudio(payload) ? 'Include a native audio soundtrack.' : 'Request a silent video without a soundtrack.');
	}
	if (quality) preferences.push(`Preferred quality: ${quality}.`);
	return preferences.join(' ');
}

function parseAspectRatio(value) {
	const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
	if (!match) return 0;
	const width = Number(match[1]);
	const height = Number(match[2]);
	return width > 0 && height > 0 ? width / height : 0;
}

function aspectRatioFromBytes(bytes) {
	const dimensions = readImageDimensions(bytes);
	return dimensions && dimensions.width > 0 && dimensions.height > 0 ? dimensions.width / dimensions.height : 0;
}

function aspectRatiosMatch(left, right, tolerance = 0.04) {
	return !!(left && right && Math.abs(left - right) / right <= tolerance);
}

function requestedGrokAspectRatio(payload = {}) {
	const value = String(payload && payload.aspect_ratio || '').trim();
	return value && !/^auto$/i.test(value) ? value : '';
}

/* Grok Imagine image_edit keeps a single source canvas and ignores aspect_ratio.
 * Multi-image edits honor aspect_ratio, so a mismatched single reference is
 * duplicated into a second path before the tool call. */
function grokImageEditNeedsAspectExpansion(referencePath, payload = {}) {
	const aspect = requestedGrokAspectRatio(payload);
	if (!aspect || !referencePath) return false;
	const requested = parseAspectRatio(aspect);
	if (!requested) return false;
	try {
		const actual = aspectRatioFromBytes(fs.readFileSync(referencePath));
		return !actual || !aspectRatiosMatch(actual, requested);
	} catch (error) {
		return true;
	}
}

function grokImageToolGuidance(payload = {}, toolName, options = {}) {
	const safeValue = (value, maxLength = 64) => String(value || '').trim().replace(/[\r\n]+/g, ' ').slice(0, maxLength);
	const parts = [];
	const aspectRatio = safeValue(payload.aspect_ratio);
	const resolution = safeValue(payload.resolution).toLowerCase();
	const outputFormat = normalizeImageOutputFormat(payload.output_format);
	if (aspectRatio && aspectRatio !== 'auto') {
		parts.push(`Pass aspect_ratio ${JSON.stringify(aspectRatio)} as the ${toolName} tool argument.`);
	}
	if (toolName === 'image_edit' && aspectRatio && aspectRatio !== 'auto' && Number(options.referenceCount || 0) > 1) {
		parts.push(`Pass every listed reference path in the image array so this is a multi-image edit; a single-image ${toolName} call ignores aspect_ratio and keeps the source canvas.`);
		parts.push(`Compose a new scene at aspect_ratio ${JSON.stringify(aspectRatio)}; use the references only for identity, costume, and likeness, not as the output canvas.`);
	}
	if (resolution === '2k') {
		parts.push('In the tool prompt string, request 2K output with the long edge around 2048 pixels.');
	} else if (resolution === '1k') {
		parts.push('In the tool prompt string, request 1K output with the long edge around 1024 pixels.');
	}
	parts.push(`In the tool prompt string, request output_format ${JSON.stringify(outputFormat)}.`);
	parts.push('Do not pass a resolution or output_format tool parameter; Grok Imagine image tools only accept prompt and aspect_ratio.');
	return parts.join(' ');
}

function antigravityImageToolGuidance(payload = {}) {
	const safeValue = (value, maxLength = 64) => String(value || '').trim().replace(/[\r\n]+/g, ' ').slice(0, maxLength);
	const parts = [];
	const aspectRatio = safeValue(payload.aspect_ratio);
	const imageSize = safeValue(payload.image_size || payload.imageSize).toUpperCase();
	const outputFormat = normalizeImageOutputFormat(payload.output_format);
	if (aspectRatio && aspectRatio !== 'auto') {
		parts.push(`Call generate_image with aspectRatio ${JSON.stringify(aspectRatio)}.`);
	}
	if (imageSize === '1K' || imageSize === '2K' || imageSize === '4K') {
		parts.push(`Call generate_image with imageSize ${JSON.stringify(imageSize)}.`);
	}
	parts.push(`Call generate_image with output_format ${JSON.stringify(outputFormat)}.`);
	return parts.join(' ');
}

function testOption(key, label, delivery, choices) {
	return { key, label, delivery, choices };
}

const CODEX_IMAGE_SIZE_CHOICES = [
	{ value: 'auto', label: 'Auto · provider chooses' },
	{ value: '1024x1024', label: 'Square · 1024 × 1024' },
	{ value: '1536x1024', label: 'Landscape · 1536 × 1024' },
	{ value: '1024x1536', label: 'Portrait · 1024 × 1536' },
	{ value: '2048x2048', label: '2K square · 2048 × 2048 (requested, not guaranteed)' },
	{ value: '2560x1440', label: '2K landscape · 2560 × 1440 (requested, not guaranteed)' },
	{ value: '1440x2560', label: '2K portrait · 1440 × 2560 (requested, not guaranteed)' },
	{ value: '3840x2160', label: '4K landscape · 3840 × 2160 (requested, not guaranteed)' },
	{ value: '2160x3840', label: '4K portrait · 2160 × 3840 (requested, not guaranteed)' },
];

const CODEX_IMAGE_TEST_OPTIONS = [
	testOption('size', 'Resolution', 'guidance', CODEX_IMAGE_SIZE_CHOICES),
	testOption('quality', 'Quality', 'guidance', [
		{ value: 'auto', label: 'Auto · provider chooses' },
		{ value: 'low', label: 'Low' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'high', label: 'High' },
	]),
];

const ANTIGRAVITY_IMAGE_ASPECT_CHOICES = [
	{ value: 'auto', label: 'Auto · provider chooses' },
	{ value: '1:1', label: 'Square · 1:1' },
	{ value: '16:9', label: 'Landscape · 16:9' },
	{ value: '9:16', label: 'Portrait · 9:16' },
	{ value: '4:3', label: 'Landscape · 4:3' },
	{ value: '3:4', label: 'Portrait · 3:4' },
	{ value: '3:2', label: 'Landscape · 3:2' },
	{ value: '2:3', label: 'Portrait · 2:3' },
	{ value: '21:9', label: 'Cinema · 21:9' },
];

const ANTIGRAVITY_IMAGE_TEST_OPTIONS = [
	testOption('aspect_ratio', 'Aspect ratio', 'guidance', ANTIGRAVITY_IMAGE_ASPECT_CHOICES),
	testOption('image_size', 'Resolution', 'guidance', [
		{ value: '2K', label: '2K · ~2048px long edge' },
		{ value: '4K', label: '4K · ~4096px long edge' },
		{ value: '1K', label: '1K · ~1024px long edge' },
	]),
];

const GROK_IMAGE_ASPECT_CHOICES = [
	{ value: 'auto', label: 'Auto · provider chooses' },
	{ value: '1:1', label: 'Square · 1:1' },
	{ value: '16:9', label: 'Landscape · 16:9' },
	{ value: '9:16', label: 'Portrait · 9:16' },
	{ value: '4:3', label: 'Landscape · 4:3' },
	{ value: '3:4', label: 'Portrait · 3:4' },
	{ value: '3:2', label: 'Landscape · 3:2' },
	{ value: '2:3', label: 'Portrait · 2:3' },
	{ value: '2:1', label: 'Wide · 2:1' },
	{ value: '1:2', label: 'Tall · 1:2' },
	{ value: '19.5:9', label: 'Phone wide · 19.5:9' },
	{ value: '9:19.5', label: 'Phone tall · 9:19.5' },
	{ value: '20:9', label: 'Ultra-wide · 20:9' },
	{ value: '9:20', label: 'Ultra-tall · 9:20' },
	{ value: '21:9', label: 'Cinema · 21:9' },
	{ value: '5:2', label: 'Banner · 5:2' },
];

const GROK_IMAGE_TEST_OPTIONS = [
	testOption('aspect_ratio', 'Aspect ratio', 'tool-arg', GROK_IMAGE_ASPECT_CHOICES),
	testOption('resolution', 'Resolution', 'guidance', [
		{ value: '2k', label: '2K · prompt guidance only' },
		{ value: '1k', label: '1K · prompt guidance only' },
	]),
];

const GROK_VIDEO_TEST_OPTIONS = [
	testOption('aspect_ratio', 'Aspect ratio', 'guidance', [
		{ value: '16:9', label: 'Landscape · 16:9' },
		{ value: '9:16', label: 'Portrait · 9:16' },
		{ value: '1:1', label: 'Square · 1:1' },
		{ value: '4:3', label: 'Landscape · 4:3' },
		{ value: '3:4', label: 'Portrait · 3:4' },
		{ value: '3:2', label: 'Landscape · 3:2' },
		{ value: '2:3', label: 'Portrait · 2:3' },
	]),
	testOption('resolution', 'Resolution', 'guidance', [
		{ value: '480p', label: '480p' },
		{ value: '720p', label: '720p' },
		{ value: '1080p', label: '1080p' },
	]),
	testOption('seconds', 'Clip length', 'guidance', [
		{ value: '5', label: '5 seconds' },
		{ value: '8', label: '8 seconds' },
		{ value: '10', label: '10 seconds' },
		{ value: '15', label: '15 seconds' },
	]),
	testOption('generate_audio', 'Soundtrack', 'guidance', [
		{ value: 'true', label: 'Native audio' },
		{ value: 'false', label: 'Silent' },
	]),
];

const XAI_IMAGE_TEST_OPTIONS = [
	testOption('aspect_ratio', 'Aspect ratio', 'direct', GROK_IMAGE_ASPECT_CHOICES),
	testOption('resolution', 'Resolution', 'direct', [
		{ value: '2k', label: '2K' },
		{ value: '1k', label: '1K' },
	]),
	testOption('quality', 'Quality', 'direct', [
		{ value: 'medium', label: 'Medium' },
		{ value: 'low', label: 'Low' },
	]),
];

const CODEX_IMAGE_CAPABILITIES = imageCapabilityContract(CODEX_IMAGE_TEST_OPTIONS, { resolutionKey: 'size', referenceImagesMax: 4 });
const GROK_IMAGE_CAPABILITIES = imageCapabilityContract(GROK_IMAGE_TEST_OPTIONS, { resolutionKey: 'resolution', referenceImagesMax: 4 });
const ANTIGRAVITY_IMAGE_CAPABILITIES = imageCapabilityContract(ANTIGRAVITY_IMAGE_TEST_OPTIONS, { resolutionKey: 'image_size', referenceImagesMax: 4 });
const XAI_IMAGE_CAPABILITIES = imageCapabilityContract(XAI_IMAGE_TEST_OPTIONS, { resolutionKey: 'resolution', referenceImagesMax: XAI_IMAGE_REFERENCE_LIMIT, candidateCountMax: 3, cloudUpload: true, outputFormats: ['image/png'] });

const XAI_VIDEO_TEST_OPTIONS = [
	testOption('aspect_ratio', 'Aspect ratio', 'direct', [
		{ value: '16:9', label: 'Landscape · 16:9' },
		{ value: '9:16', label: 'Portrait · 9:16' },
		{ value: '1:1', label: 'Square · 1:1' },
		{ value: '4:3', label: 'Landscape · 4:3' },
		{ value: '3:4', label: 'Portrait · 3:4' },
		{ value: '3:2', label: 'Landscape · 3:2' },
		{ value: '2:3', label: 'Portrait · 2:3' },
	]),
	testOption('resolution', 'Resolution', 'direct', [
		{ value: '480p', label: '480p' },
		{ value: '720p', label: '720p' },
		{ value: '1080p', label: '1080p' },
	]),
	testOption('seconds', 'Clip length', 'direct', [
		{ value: '5', label: '5 seconds' },
		{ value: '8', label: '8 seconds' },
		{ value: '10', label: '10 seconds' },
		{ value: '15', label: '15 seconds' },
	]),
	testOption('generate_audio', 'Soundtrack', 'direct', [
		{ value: 'true', label: 'Native audio' },
		{ value: 'false', label: 'Silent' },
	]),
];

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
				...(models.image || []).map((id) => ({ id: relayModel('codex', id.replace(/^codex-local:/, '')), legacy_id: id, type: 'image', backend: 'codex-cli', job_types: ['images'], test_options: CODEX_IMAGE_TEST_OPTIONS, image_capabilities: CODEX_IMAGE_CAPABILITIES })),
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

function grokCliDefaultModel(state = {}) {
	const known = (state.models || []).filter((id) => id && id !== 'auto');
	return String(state.default_model || known[0] || '').trim();
}

function resolveGrokNativeModel(requested, state = {}) {
	const known = (state.models || []).filter((id) => id && id !== 'auto');
	const defaultModel = grokCliDefaultModel(state);
	if (!requested || requested === 'auto' || !known.includes(requested)) {
		return defaultModel || requested || 'auto';
	}
	return requested;
}

function isInvalidCliModelFailure(result) {
	const details = result && result.details && typeof result.details === 'object' ? result.details : {};
	const message = [result && result.message, details.stderr, details.stdout, result && result.text].filter(Boolean).join('\n');
	return /unknown model|invalid model|unrecognized model|model .* not (?:found|available|supported)|no such model/i.test(message);
}

function createNamedCliDriver(definition, options = {}) {
	let cached = { id: definition.id, label: definition.label, kind: 'local-cli', installed: null, ready: false, state: 'checking', diagnostic: 'Checking in background.', models: definition.models || ['auto'], job_types: definition.jobTypes || ['chat'] };
	const detector = options.detectCliAsync || detectCliAsync;
	const commandRunner = options.runTextCommand || runTextCommand;
	function detect() { return cached; }
	return {
		id: definition.id,
		label: definition.label,
		kind: 'local-cli',
		job_types: definition.jobTypes || ['chat'],
		checkStatus: () => { const state = detect(); return { success: state.ready, message: state.diagnostic, details: state }; },
		capabilities: () => {
			const state = detect();
			return { ...state, id: definition.id, label: definition.label, job_types: definition.jobTypes || ['chat'], enabled: state.installed, features: { chat: true, coding: true, images: false, videos: false } };
		},
		models: () => {
			const state = detect();
			return (state.models && state.models.length ? state.models : ['auto']).map((id) => ({ id: relayModel(definition.id, id), type: 'text', backend: definition.id, ready: state.ready, job_types: definition.jobTypes || ['chat'] }));
		},
		refresh: async () => {
			const previous = cached;
			cached = retainCliReadiness(previous, await detector(definition, { ...options, timeoutMs: Number(options.probeTimeoutMs || process.env.AI_MODEL_RELAY_CLI_PROBE_TIMEOUT_MS || 10000) }));
			return cached;
		},
		async chat(payload = {}, session = {}) {
			let state = detect();
			if (state.ready !== true) state = await this.refresh();
			if (!state.ready) return { success: false, category: 'configuration', code: `${definition.id}_unavailable`, message: `${definition.label} is unavailable: ${state.diagnostic}` };
			const requested = cliModelFromRelay(payload.model, definition.id);
			let model = typeof definition.nativeModel === 'function' ? definition.nativeModel(requested, state) || requested : requested;
			const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `ai-model-relay-${definition.id}-`));
			try {
				const materialized = materializeChatImages(payload, workspace);
				if (materialized.error) return { success: false, category: 'validation', code: 'cli_chat_image_invalid', message: materialized.error };
				const prompt = messagesToText(payload, { imageReferences: materialized.references });
				const promptPath = writePromptFile(workspace, prompt);
				const request = { prompt, promptPath, workspace, imageReferences: materialized.references, promptJsonSupported: state.prompt_json_supported === true, promptJson: state.prompt_json_supported === true ? messagesToPromptJson(payload, materialized.references) : null };
				const runWithModel = (nativeModel) => commandRunner(state.command, definition.requestArgs(nativeModel, promptPath, workspace, request), '', session, { ...options, cwd: workspace, timeoutMs: Number(options.timeoutMs || 600000), signal: session.signal });
				let result = await runWithModel(model);
				if (!result.success && definition.retryInvalidModel && isInvalidCliModelFailure(result)) {
					const fallback = String((typeof definition.defaultNativeModel === 'function' && definition.defaultNativeModel(state)) || state.default_model || '').trim();
					if (fallback && fallback !== 'auto' && fallback !== model) {
						result = await runWithModel(fallback);
						if (result.success) model = fallback;
					}
				}
				if (!result.success) return result;
				let parsed = null; try { parsed = JSON.parse(result.text); } catch (error) {}
				return normalizeChatResponse(definition.id, model, parsed, result.text);
			} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
		},
	};
}

function createGrokCliDriver(options = {}) {
	const definition = { id: 'grok-cli', label: 'Grok CLI', candidates: [options.command, process.env.AI_MODEL_RELAY_GROK_BINARY, 'grok'], versionArgs: ['--version'], authArgs: ['models'], jobTypes: ['chat'], models: ['auto'], nativeModel: resolveGrokNativeModel, defaultNativeModel: grokCliDefaultModel, retryInvalidModel: true, requestArgs: (model, promptPath, workspace, request = {}) => {
		const promptJson = request.promptJsonSupported && request.promptJson ? JSON.stringify(request.promptJson) : '';
		const usePromptJson = !!promptJson && promptJson.length <= MAX_CLI_PROMPT_JSON_ARG_CHARS;
		return [usePromptJson ? '--prompt-json' : '--prompt-file', usePromptJson ? promptJson : promptPath, '--output-format', 'json', '--cwd', workspace, '--disallowed-tools', 'run_terminal_cmd', '--permission-mode', 'dontAsk', '--no-subagents', '--disable-web-search', ...(model && model !== 'auto' ? ['--model', model] : [])];
	} };
	const configuredMediaTimeout = Number(options.mediaTimeoutMs || process.env.AI_MODEL_RELAY_GROK_MEDIA_TIMEOUT_MS || GROK_MEDIA_TIMEOUT_MS);
	const mediaTimeoutMs = Number.isFinite(configuredMediaTimeout) && configuredMediaTimeout > 0 ? configuredMediaTimeout : GROK_MEDIA_TIMEOUT_MS;
	const driver = createNamedCliDriver(definition, options);
	const baseCapabilities = driver.capabilities;
	const baseModels = driver.models;
	const baseRefresh = driver.refresh;
	const promptCommandRunner = options.runTextCommand || runTextCommand;
	let promptJsonChecked = false;
	let promptJsonSupported = false;
	let imagine = { checked: false, path: '', images: false, videos: false, video_verified: false, diagnostic: 'Imagine tooling has not been checked yet.' };
	let unavailableTools = { images: false, videos: false };

	async function probePromptJson(state) {
		if (promptJsonChecked || !state || !state.ready || !state.command) return;
		promptJsonChecked = true;
		if (!options.runTextCommand && options.spawn) return;
		const help = await promptCommandRunner(state.command, ['--help'], '', {}, { ...options, timeoutMs: 15000 });
		const helpText = `${help && help.text || ''}\n${help && help.stderr || ''}`;
		promptJsonSupported = !!help && help.success === true && /(?:^|[\s,])--prompt-json(?:[\s=]|$)/i.test(helpText);
	}

	function probeImagine() {
		const candidates = [
			options.imagineSkillPath,
			process.env.AI_MODEL_RELAY_GROK_IMAGINE_SKILL,
			path.join(os.homedir(), '.grok', 'skills', 'imagine', 'SKILL.md'),
			path.join(os.homedir(), '.grok', 'bundled', 'skills', 'imagine', 'SKILL.md'),
		].filter(Boolean);
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
			if (!pathIsInside(inputDir, source)) return { error: 'Grok media reference paths must be files the Relay created for this request.' };
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
		return [...base, { id: 'model-relay:grok-cli:image', type: 'image', backend: 'grok-cli', ready: true, job_types: ['images'], test_options: GROK_IMAGE_TEST_OPTIONS, image_capabilities: GROK_IMAGE_CAPABILITIES }, ...(imagine.videos ? [{ id: 'model-relay:grok-cli:video', type: 'video', backend: 'grok-cli', ready: true, job_types: ['videos'], experimental: true, verified: imagine.video_verified, test_options: GROK_VIDEO_TEST_OPTIONS }] : [])];
	};
	driver.refresh = async (refreshOptions = {}) => {
		const state = await baseRefresh();
		await probePromptJson(state);
		if (refreshOptions.resetMedia) unavailableTools = { images: false, videos: false };
		const detected = probeImagine();
		imagine = { ...detected, images: detected.images && !unavailableTools.images, videos: detected.videos && !unavailableTools.videos, video_verified: refreshOptions.resetMedia ? false : (imagine.video_verified && detected.videos) };
		return { ...state, prompt_json_supported: promptJsonSupported, imagine };
	};
	async function media(kind, payload = {}, session = {}) {
		let state = driver.capabilities();
		if (state.ready !== true) state = await driver.refresh();
		if (!state.ready) return { success: false, category: 'configuration', code: 'grok_cli_unavailable', message: `Grok CLI is unavailable: ${state.diagnostic}` };
		if (!driver.supports(kind)) return { success: false, category: 'configuration', code: 'grok_imagine_unavailable', message: `Grok ${kind === 'images' ? 'image' : 'video'} generation is unavailable: ${imagine.diagnostic}` };
		const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-grok-'));
		try {
			const inputDir = path.join(workspace, 'input');
			const outputDir = path.join(workspace, 'output');
			fs.mkdirSync(inputDir); fs.mkdirSync(outputDir);
			const references = materializeReferences(payload, inputDir);
			if (references.error) return { success: false, category: 'validation', code: 'grok_reference_invalid', message: references.error };
			if (kind === 'images' && references.paths.length === 1 && grokImageEditNeedsAspectExpansion(references.paths[0], payload)) {
				const source = references.paths[0];
				const duplicate = path.join(inputDir, `reference-aspect${path.extname(source)}`);
				fs.copyFileSync(source, duplicate);
				references.paths.push(duplicate);
			}
			const runImagineTool = async (toolName, targetDir, sourcePaths = [], outputLabel = kind === 'images' ? 'image' : 'video') => {
				const instruction = `Call the ${toolName} tool exactly once to create the requested ${outputLabel}${sourcePaths.length ? ` using ${sourcePaths.join(', ')}` : ''}.`;
				const preferences = kind === 'images' ? grokImageToolGuidance(payload, toolName, { referenceCount: sourcePaths.length }) : generationPreferences(payload, kind);
				const prompt = `${instruction} The tool saves the generated file in its managed Grok session directory; do not search for, copy, or move it. Do not call any other tool.${preferences ? ` ${preferences}` : ''} User request: ${String(payload.prompt || '').trim()}`;
				if (session.appendSessionInput) {
					session.appendSessionInput('grok cli request', `Tool: ${toolName}\nWorkspace: ${workspace}\n\nPrompt (passed with --single; stdin is empty):\n${prompt}`);
				}
				const result = await runTextCommand(state.command, ['--single', prompt, '--output-format', 'json', '--cwd', workspace, '--tools', toolName, '--disallowed-tools', 'run_terminal_cmd', '--permission-mode', 'dontAsk', '--no-subagents', '--disable-web-search', '--max-turns', '2'], '', session, { ...options, timeoutMs: mediaTimeoutMs, signal: session.signal });
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
	const artifactResolver = createAntigravityImageArtifactResolver({ stateRoot, maxBytes: MAX_IMAGE_REFERENCE_BYTES });
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
			if (!pathIsInside(inputDir, source)) return { error: 'Antigravity image reference paths must be files the Relay created for this request.' };
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

	function resultFailure(result, operation) {
		if (result && result.success) {
			snapshot = { ...snapshot, authenticated: true, state: 'ready', diagnostic: 'Ready.' };
			return null;
		}
		const output = antigravityResultText(result);
		const quotaExhausted = /(?:quota|usage|capacity|credits?).{0,120}(?:exhausted|depleted|exceeded)|(?:exhausted|depleted).{0,120}(?:quota|usage|capacity|credits?)/i.test(output);
		const rateLimited = /\b429\b|too many requests|rate limit|quota exhaustion/i.test(output);
		if (quotaExhausted || rateLimited) {
			return {
				success: false,
				category: 'rate_limit',
				code: quotaExhausted ? 'antigravity_quota_exhausted' : 'antigravity_rate_limited',
				message: quotaExhausted
					? `Antigravity ${operation} quota is exhausted. Wait for the quota to reset, then retry.`
					: `Antigravity ${operation} rate limit reached. Wait a moment, then retry.`,
				retryable: true,
				details: { provider: 'antigravity-cli', upstream_status: /\b429\b/.test(output) ? 429 : undefined },
			};
		}
		const message = String(result && result.message || 'Antigravity CLI request failed.');
		if (isAntigravityAuthenticationError(output)) {
			snapshot = { ...snapshot, authenticated: false, ready: false, state: 'not_authenticated', diagnostic: 'Not authenticated.' };
			return antigravityAuthenticationFailure();
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

	async function runPrompt(workspace, prompt, timeoutMs, session, operation = 'CLI request') {
		const args = ['-p', prompt];
		if (snapshot.print_json_supported) args.push('--output-format', 'json');
		// Keep -p invocations free of --model/--effort until a concrete, verified
		// Antigravity flag contract exists; prefer auto over risking a hanging job.
		const result = await commandRunner(snapshot.command, args, '', session, { ...options, cwd: workspace, timeoutMs, signal: session && session.signal });
		return resultFailure(result, operation) || result;
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
			{ id: 'model-relay:antigravity-cli:image', type: 'image', backend: definition.id, ready: true, job_types: ['images'], test_options: ANTIGRAVITY_IMAGE_TEST_OPTIONS, image_capabilities: ANTIGRAVITY_IMAGE_CAPABILITIES },
			{ id: 'model-relay:antigravity-cli:media', type: 'text', backend: definition.id, ready: true, job_types: ['media.analyze'] },
		] : [],
		async refresh() {
			const detected = await detector(definition, { ...options, timeoutMs: Number(options.probeTimeoutMs || process.env.AI_MODEL_RELAY_CLI_PROBE_TIMEOUT_MS || 10000) });
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
			const printJsonSupported = /--output-format/i.test(helpText);
			const modelSupported = /(?:^|[\s,])--model\b/i.test(helpText);
			const effortSupported = /(?:^|[\s,])--effort\b/i.test(helpText);
			snapshot = { ...snapshot, ...detected, print_json_supported: printJsonSupported, model_supported: modelSupported, effort_supported: effortSupported, ready: snapshot.authenticated !== false, authenticated: snapshot.authenticated, state: snapshot.authenticated === false ? 'not_authenticated' : 'ready', diagnostic: snapshot.authenticated === false ? 'Not authenticated.' : (printJsonSupported ? 'Ready; authentication will be confirmed on the first request.' : 'Ready; CLI print-mode text output will be normalized locally.') };
			return snapshot;
		},
		async chat(payload = {}, session = {}) {
			const state = await driver.refresh();
			if (!state.ready) return { success: false, category: 'configuration', code: state.state === 'not_authenticated' ? 'antigravity_cli_not_authenticated' : 'antigravity_cli_unavailable', message: `Antigravity CLI is unavailable: ${state.diagnostic}` };
			const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-antigravity-'));
			try {
				const materialized = materializeChatImages(payload, workspace);
				if (materialized.error) return { success: false, category: 'validation', code: 'cli_chat_image_invalid', message: materialized.error };
				const prompt = String(messagesToText(payload, { imageReferences: materialized.references }) || '');
				const promptPath = writePromptFile(workspace, prompt);
				const result = await runPrompt(workspace, `Read the user's full request from @${promptPath} and respond to it.`, chatTimeoutMs, session, 'chat');
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
				const preferences = antigravityImageToolGuidance(payload);
				const prompt = `Call generate_image exactly once with ImageName ${JSON.stringify(imageName)}.${referenceInstruction} After the tool runs, print a single line exactly in this form: IMAGE_PATH: <absolute path to the saved image> and nothing else of that form. Do not call shell, file, browser, subagent, or any other tools.${preferences ? ` ${preferences}` : ''} User image request: ${String(payload.prompt || '').trim().slice(0, 24000)}`;
				const startedAt = Date.now();
				const result = await runPrompt(workspace, prompt, imageTimeoutMs, session, 'image-generation');
				if (!result.success) return result;
				const marker = findAntigravityImagePath(result);
				let images;
				if (marker) {
					const validated = artifactResolver.validatePath(marker.path, workspace);
					if (validated.error) return { success: false, category: 'output_detection', code: 'antigravity_image_artifact_invalid', message: validated.error };
					images = [validated];
				} else {
					images = artifactResolver.findGeneratedImages(imageName, startedAt);
				}
				if (!images.length) return { success: false, category: 'output_detection', code: 'antigravity_image_artifact_missing', message: 'Antigravity CLI completed without creating the requested image artifact.' };
				const data = [];
				for (const image of images) {
					try {
						const bytes = fs.readFileSync(image.path);
						if (!bytes.length || bytes.length > MAX_IMAGE_REFERENCE_BYTES) return { success: false, category: 'output_detection', code: 'antigravity_image_artifact_invalid', message: 'Antigravity generated an empty or oversized image artifact.' };
						const extension = path.extname(image.path).toLowerCase();
						data.push({ b64_json: bytes.toString('base64'), mime_type: extension === '.png' ? 'image/png' : (extension === '.webp' ? 'image/webp' : 'image/jpeg') });
					} catch (error) {
						return { success: false, category: 'output_detection', code: 'antigravity_image_artifact_missing', message: 'Antigravity CLI completed without creating the requested image artifact.' };
					}
				}
				return {
					success: true,
					response: {
						data,
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
					? await mediaAnalysis.materializeMedia(payload, workspace, undefined, undefined, { signal: session && session.signal })
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
				const result = await runPrompt(workspace, prompt, mediaTimeoutMs, session, 'media-analysis');
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
	return createNamedCliDriver({ id: 'cursor-cli', label: 'Cursor Agent', candidates: [options.command, process.env.AI_MODEL_RELAY_CURSOR_BINARY, 'cursor-agent'], versionArgs: ['--version'], authArgs: ['status'], modelListArgs: [['models'], ['--list-models']], jobTypes: ['chat'], models: ['auto'], requestArgs: (model, promptPath, workspace) => ['--print', '--output-format', 'json', '--mode=ask', '--trust', ...(model !== 'auto' ? ['--model', model] : []), 'Respond to the user request in prompt.txt.', '--workspace', workspace] }, options);
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
				ready: caps.ready === true,
				runtime_checked: caps.runtime_checked,
				diagnostic: caps.ready === true ? '' : (caps.ready === false ? 'Install a model under Local ASR Settings or press Refresh runtime.' : 'Press Refresh runtime in Local ASR Settings to probe the Python environment.'),
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
			const models = (caps.models || []).map((id) => ({ id: relayModel('openai-videos', id), legacy_id: `openai-video:${id}`, type: 'video', backend: 'openai-videos' }));
			const testOptions = [
				testOption('size', 'Resolution', 'direct', [
					{ value: '1280x720', label: 'Landscape · 1280 × 720' },
					{ value: '720x1280', label: 'Portrait · 720 × 1280' },
					{ value: '1792x1024', label: 'Wide · 1792 × 1024' },
					{ value: '1024x1792', label: 'Tall · 1024 × 1792' },
				]),
				testOption('seconds', 'Clip length', 'direct', [
					{ value: '4', label: '4 seconds' },
					{ value: '8', label: '8 seconds' },
					{ value: '12', label: '12 seconds' },
				]),
				testOption('model', 'Quality', 'direct', models.map((entry) => ({ value: entry.id, label: /pro/i.test(entry.id) ? 'Pro · Sora 2 Pro' : 'Standard · Sora 2' }))),
			];
			return models.map((model) => ({ ...model, test_options: testOptions }));
		},
		videos: (payload, session) => video.run(payload, session),
	};
}

function createXaiApiDriver(options = {}) {
	const fetchImpl = withFetchTimeout(options.fetch || globalThis.fetch, Number(options.fetchTimeoutMs || process.env.AI_MODEL_RELAY_PROVIDER_FETCH_TIMEOUT_MS || 60000));
	const apiKey = options.apiKey || process.env.XAI_API_KEY || process.env.AI_MODEL_RELAY_XAI_API_KEY || '';
	const baseUrl = String(options.baseUrl || process.env.XAI_BASE_URL || process.env.AI_MODEL_RELAY_XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/+$/, '');
	const defaultModels = String(options.models || process.env.AI_MODEL_RELAY_XAI_MODELS || DEFAULT_XAI_CHAT_MODELS).split(',').map((id) => id.trim()).filter(Boolean);
	const pollTimeoutMs = Number(options.pollTimeoutMs || process.env.ALORBACH_VIDEO_POLL_TIMEOUT_MS || 600000);
	const pollIntervalMs = Number(options.pollIntervalMs || process.env.ALORBACH_VIDEO_POLL_INTERVAL_MS || 3000);
	const sleep = typeof options.sleep === 'function' ? options.sleep : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	function xaiFailure(code, response, parsed, fallback) {
		const message = redactProviderSecret(parsed && parsed.error && parsed.error.message || fallback, apiKey);
		return {
			success: false,
			category: response.status === 401 || response.status === 403 ? 'configuration' : (response.status === 413 ? 'validation' : (response.status === 429 ? 'rate_limit' : 'api')),
			code,
			message,
			retryable: response.status === 429 || response.status >= 500,
			details: { status: response.status, provider: 'xai-api' },
		};
	}
	async function readJsonResponse(response) {
		let text = '';
		try {
			text = await readBoundedText(response);
		} catch (error) {
			return { text: '', parsed: null, error };
		}
		let parsed = null;
		try { parsed = text ? JSON.parse(text) : {}; } catch (parseError) {}
		return { text, parsed };
	}
	return {
		id: 'xai-api',
		label: 'Grok / xAI API',
		kind: 'api',
		job_types: ['chat', 'transcribe', 'images', 'videos'],
		checkStatus: () => ({ success: !!apiKey, message: apiKey ? 'xAI API key is configured.' : 'xAI API key is not configured.', details: { provider: 'xai-api', configured: !!apiKey, base_url: baseUrl } }),
		capabilities: () => ({
			id: 'xai-api',
			label: 'Grok / xAI API',
			kind: 'api',
			enabled: !!apiKey,
			configured: !!apiKey,
			ready: !!apiKey,
			job_types: ['chat', 'transcribe', 'images', 'videos'],
			models: [...defaultModels.map((id) => relayModel('xai', id)), 'model-relay:xai:stt', 'model-relay:xai:imagine-image', 'model-relay:xai:imagine-video'],
			features: { chat: true, speech_to_text: true, cloud_audio: true, images: true, videos: true, image_edit: true, native_audio: true },
			requires: ['XAI_API_KEY or AI_MODEL_RELAY_XAI_API_KEY'],
		}),
		models: () => [
			...defaultModels.map((id) => ({ id: relayModel('xai', id), type: 'text', backend: 'xai-api', job_types: ['chat'] })),
			{ id: 'model-relay:xai:stt', type: 'audio', backend: 'xai-api', job_types: ['transcribe'] },
			{ id: 'model-relay:xai:imagine-image', type: 'image', backend: 'xai-api', job_types: ['images'], ready: !!apiKey, test_options: XAI_IMAGE_TEST_OPTIONS, image_capabilities: XAI_IMAGE_CAPABILITIES },
			{ id: 'model-relay:xai:imagine-video', type: 'video', backend: 'xai-api', job_types: ['videos'], ready: !!apiKey, test_options: XAI_VIDEO_TEST_OPTIONS },
		],
		async chat(payload = {}, session = {}) {
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
			assignChatSampling(body, payload);
			const fetched = await fetchWithSession(fetchImpl, `${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			}, session);
			if (fetched.error) return fetched.error;
			const response = fetched.response;
			const { text, parsed, error } = await readJsonResponse(response);
			if (error) {
				return { success: false, category: 'api', code: 'xai_api_failed', message: 'xAI API response exceeded the maximum size.', details: { provider: 'xai-api' } };
			}
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
			let parsed;
			try {
				const fetched = await fetchWithSession(fetchImpl, `${baseUrl}/stt`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form }, session);
				if (fetched.error) return fetched.error;
				response = fetched.response;
				const body = await readJsonResponse(response);
				if (body.error) {
					return { success: false, category: 'api', code: 'xai_stt_failed', message: 'xAI Speech-to-Text response exceeded the maximum size.', details: { provider: 'xai-api' } };
				}
				text = body.text;
				parsed = body.parsed;
			} catch (error) {
				return { success: false, category: 'api', code: 'xai_stt_request_failed', message: 'xAI Speech-to-Text could not be reached.', retryable: true, details: { provider: 'xai-api' } };
			}
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
		async images(payload = {}, session = {}) {
			if (!apiKey) {
				return { success: false, category: 'configuration', code: 'xai_api_key_missing', message: 'Grok/xAI API requires XAI_API_KEY or AI_MODEL_RELAY_XAI_API_KEY.' };
			}
			if (!fetchImpl) {
				return { success: false, category: 'configuration', code: 'fetch_unavailable', message: 'This Node runtime does not provide fetch for API-backed drivers.' };
			}
			const prompt = String(payload.prompt || '').trim();
			if (!prompt) {
				return { success: false, category: 'validation', code: 'xai_image_prompt_required', message: 'An image prompt is required.' };
			}
			const references = xaiImageReferences(payload, XAI_IMAGE_REFERENCE_LIMIT);
			if (references.error) {
				return { success: false, category: 'validation', code: 'xai_image_reference_invalid', message: references.error };
			}
			const model = xaiImagineImageModel(payload.model);
			const requestedCount = payload.candidate_count !== undefined ? payload.candidate_count : payload.n;
			const n = Math.min(10, Math.max(1, Number(requestedCount) || 1));
			const body = { model, prompt, n, response_format: 'b64_json' };
			const aspectRatio = String(payload.aspect_ratio || '').trim();
			if (aspectRatio && XAI_IMAGE_ASPECT_RATIOS.has(aspectRatio)) body.aspect_ratio = aspectRatio;
			const resolution = String(payload.resolution || '').trim().toLowerCase();
			if (XAI_IMAGE_RESOLUTIONS.has(resolution)) body.resolution = resolution;
			const quality = String(payload.quality || '').trim().toLowerCase();
			if (quality === 'low' || quality === 'medium') body.quality = quality;
			Object.assign(body, xaiImagineImageInputs(references.uris));
			const imagePath = references.uris.length ? '/images/edits' : '/images/generations';
			if (typeof session.appendSessionOutput === 'function') session.appendSessionOutput('stdout', 'Submitting xAI Imagine image request.\n');
			let response;
			try {
				const fetched = await fetchWithSession(fetchImpl, `${baseUrl}${imagePath}`, {
					method: 'POST',
					headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				}, session);
				if (fetched.error) return fetched.error;
				response = fetched.response;
			} catch (error) {
				return { success: false, category: 'api', code: 'xai_image_request_failed', message: 'xAI Imagine image generation could not be reached.', retryable: true, details: { provider: 'xai-api' } };
			}
			const { parsed } = await readJsonResponse(response);
			if (!response.ok) return xaiFailure('xai_image_failed', response, parsed, `xAI Imagine image request failed with HTTP ${response.status}.`);
			const items = Array.isArray(parsed && parsed.data) ? parsed.data : (parsed && parsed.url ? [parsed] : []);
			const data = [];
			for (const item of items.slice(0, n)) {
				if (item && item.b64_json) {
					const bytes = decodeBoundedBase64(item.b64_json, MAX_IMAGE_REFERENCE_BYTES);
					if (!bytes) continue;
					data.push({ b64_json: bytes.toString('base64'), mime_type: mimeFromImageBytes(bytes) });
					continue;
				}
				const url = String(item && (item.url || item.image_url) || '').trim();
				if (!url || !/^https:\/\//i.test(url)) continue;
				try {
					const downloadedFetch = await fetchWithSession(fetchImpl, url, { headers: { Authorization: `Bearer ${apiKey}` } }, session);
					if (downloadedFetch.error) return downloadedFetch.error;
					const downloaded = downloadedFetch.response;
					if (!downloaded.ok || typeof downloaded.arrayBuffer !== 'function') continue;
					let bytes;
					try { bytes = await readBoundedBytes(downloaded); } catch (error) { continue; }
					if (!bytes.length) continue;
					data.push({ b64_json: bytes.toString('base64'), mime_type: mimeFromImageBytes(bytes) });
				} catch (error) {}
			}
			if (!data.length) {
				return { success: false, category: 'api', code: 'xai_image_artifact_missing', message: 'xAI Imagine completed without returning image data.' };
			}
			return { success: true, response: { data, provider_details: { provider: 'xai-api', raw_model: model, cloud: true } } };
		},
		async videos(payload = {}, session = {}) {
			if (!apiKey) {
				return { success: false, category: 'configuration', code: 'xai_api_key_missing', message: 'Grok/xAI API requires XAI_API_KEY or AI_MODEL_RELAY_XAI_API_KEY.' };
			}
			if (!fetchImpl) {
				return { success: false, category: 'configuration', code: 'fetch_unavailable', message: 'This Node runtime does not provide fetch for API-backed drivers.' };
			}
			const prompt = String(payload.prompt || '').trim();
			if (!prompt) {
				return { success: false, category: 'validation', code: 'xai_video_prompt_required', message: 'A video prompt is required.' };
			}
			const references = xaiImageReferences(payload, XAI_VIDEO_REFERENCE_LIMIT);
			if (references.error) {
				return { success: false, category: 'validation', code: 'xai_video_reference_invalid', message: references.error };
			}
			const model = xaiImagineVideoModel(payload.model);
			const seconds = Number(payload.seconds ?? payload.duration);
			const body = { model, prompt, generate_audio: wantsGeneratedAudio(payload) };
			if (Number.isFinite(seconds) && seconds >= 1 && seconds <= 15) body.duration = Math.round(seconds);
			const aspectRatio = String(payload.aspect_ratio || '').trim();
			if (aspectRatio && XAI_VIDEO_ASPECT_RATIOS.has(aspectRatio)) body.aspect_ratio = aspectRatio;
			let resolution = String(payload.resolution || '').trim().toLowerCase();
			if (references.uris.length > 1 && resolution === '1080p') resolution = '720p';
			if (XAI_VIDEO_RESOLUTIONS.has(resolution)) body.resolution = resolution;
			Object.assign(body, xaiImagineVideoInputs(references.uris));
			if (typeof session.appendSessionOutput === 'function') session.appendSessionOutput('stdout', 'Submitting xAI Imagine video request.\n');
			let created;
			try {
				const createdFetch = await fetchWithSession(fetchImpl, `${baseUrl}/videos/generations`, {
					method: 'POST',
					headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				}, session);
				if (createdFetch.error) return createdFetch.error;
				created = createdFetch.response;
			} catch (error) {
				return { success: false, category: 'api', code: 'xai_video_request_failed', message: 'xAI Imagine video generation could not be reached.', retryable: true, details: { provider: 'xai-api' } };
			}
			const createdBody = await readJsonResponse(created);
			if (!created.ok) return xaiFailure('xai_video_failed', created, createdBody.parsed, `xAI Imagine video request failed with HTTP ${created.status}.`);
			const requestId = String(createdBody.parsed && (createdBody.parsed.request_id || createdBody.parsed.id) || '').trim();
			let result = createdBody.parsed;
			if (requestId) {
				const started = Date.now();
				while (true) {
					if (session && session.signal && session.signal.aborted) return cancelledProviderResult();
					let polled;
					try {
						const polledFetch = await fetchWithSession(fetchImpl, `${baseUrl}/videos/${encodeURIComponent(requestId)}`, { headers: { Authorization: `Bearer ${apiKey}` } }, session);
						if (polledFetch.error) return polledFetch.error;
						polled = polledFetch.response;
					} catch (error) {
						return { success: false, category: 'api', code: 'xai_video_request_failed', message: 'xAI Imagine video polling could not be reached.', retryable: true, details: { provider: 'xai-api' } };
					}
					const polledBody = await readJsonResponse(polled);
					if (!polled.ok) return xaiFailure('xai_video_failed', polled, polledBody.parsed, `xAI Imagine video poll failed with HTTP ${polled.status}.`);
					result = polledBody.parsed;
					const status = String(result && result.status || '').toLowerCase();
					if (status === 'done' || status === 'completed') break;
					if (status === 'failed' || status === 'expired' || status === 'error') {
						return { success: false, category: status === 'expired' ? 'timeout' : 'api', code: 'xai_video_failed', message: redactProviderSecret(result && result.error && result.error.message || `xAI Imagine video ${status}.`, apiKey), details: { status: polled.status, provider: 'xai-api', request_id: requestId } };
					}
					if (Date.now() - started >= pollTimeoutMs) {
						return { success: false, category: 'timeout', code: 'xai_video_timeout', message: 'xAI Imagine video generation timed out.', details: { timeout_ms: pollTimeoutMs, provider: 'xai-api', request_id: requestId } };
					}
					if (typeof session.appendSessionOutput === 'function') session.appendSessionOutput('stdout', `xAI Imagine video ${status || 'pending'}.\n`);
					await sleep(pollIntervalMs);
				}
			}
			const video = result && result.video && typeof result.video === 'object' ? result.video : result;
			const videoUrl = String(video && (video.url || video.video_url) || '').trim();
			if (video && video.b64_video) {
				const bytes = decodeBoundedBase64(video.b64_video, MAX_PROVIDER_DOWNLOAD_BYTES);
				if (!bytes) {
					return { success: false, category: 'api', code: 'xai_video_artifact_missing', message: 'xAI Imagine video payload exceeded the maximum size.' };
				}
				return { success: true, response: { b64_video: bytes.toString('base64'), mime_type: String(video.mime_type || 'video/mp4'), provider_details: { provider: 'xai-api', raw_model: model, request_id: requestId, cloud: true } } };
			}
			if (!videoUrl || !/^https:\/\//i.test(videoUrl)) {
				return { success: false, category: 'api', code: 'xai_video_artifact_missing', message: 'xAI Imagine completed without returning a video URL.' };
			}
			let downloaded;
			try {
				const downloadedFetch = await fetchWithSession(fetchImpl, videoUrl, { headers: { Authorization: `Bearer ${apiKey}` } }, session);
				if (downloadedFetch.error) return downloadedFetch.error;
				downloaded = downloadedFetch.response;
			} catch (error) {
				return { success: false, category: 'api', code: 'xai_video_download_failed', message: 'xAI Imagine video could not be downloaded.', retryable: true, details: { provider: 'xai-api', request_id: requestId } };
			}
			if (!downloaded.ok || typeof downloaded.arrayBuffer !== 'function') {
				return { success: false, category: 'api', code: 'xai_video_download_failed', message: 'xAI Imagine video download failed.', details: { status: downloaded.status, provider: 'xai-api', request_id: requestId } };
			}
			let bytes;
			try { bytes = await readBoundedBytes(downloaded); } catch (error) {
				return { success: false, category: 'api', code: 'xai_video_download_failed', message: 'xAI Imagine video download exceeded the maximum size.', details: { provider: 'xai-api', request_id: requestId } };
			}
			if (!bytes.length) {
				return { success: false, category: 'api', code: 'xai_video_artifact_missing', message: 'xAI Imagine video download was empty.' };
			}
			return {
				success: true,
				response: {
					b64_video: bytes.toString('base64'),
					mime_type: 'video/mp4',
					provider_details: { provider: 'xai-api', raw_model: model, request_id: requestId, duration: video && video.duration, cloud: true },
				},
			};
		},
	};
}

function createApiKeyChatDriver(options = {}) {
	const fetchImpl = withFetchTimeout(options.fetch || globalThis.fetch, Number(options.fetchTimeoutMs || process.env.AI_MODEL_RELAY_PROVIDER_FETCH_TIMEOUT_MS || 60000));
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
		async chat(payload = {}, session = {}) {
			if (!(apiKey && baseUrl)) {
				return { success: false, category: 'configuration', code: 'api_key_chat_not_configured', message: 'API-key chat provider requires AI_MODEL_RELAY_CHAT_API_KEY and AI_MODEL_RELAY_CHAT_BASE_URL.' };
			}
			if (!fetchImpl) {
				return { success: false, category: 'configuration', code: 'fetch_unavailable', message: 'This Node runtime does not provide fetch for API-backed drivers.' };
			}
			const rawModel = String(payload.model || model).replace(/^model-relay:api-key-chat:/, '') || model;
			const body = assignChatSampling({
				model: rawModel,
				messages: payload.messages || [{ role: 'user', content: String(payload.prompt || '') }],
			}, payload);
			const fetched = await fetchWithSession(fetchImpl, `${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			}, session);
			if (fetched.error) return fetched.error;
			const response = fetched.response;
			let text;
			try {
				text = await readBoundedText(response);
			} catch (error) {
				return { success: false, category: 'api', code: 'api_key_chat_failed', message: 'API-key chat response exceeded the maximum size.', details: { provider: providerId } };
			}
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
	const args = Array.isArray(options.args) ? options.args : splitArgs(options.args || process.env.AI_MODEL_RELAY_CLI_ARGS || '');
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
				let detachAbort = () => {};
				const finish = (result) => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					detachAbort();
					resolve(result);
				};
				const timer = setTimeout(() => {
					killProcessTree(child);
					finish({ success: false, category: 'timeout', code: 'cli_process_timeout', message: 'CLI process timed out.', details: { timeout_ms: timeoutMs } });
				}, timeoutMs);
				detachAbort = attachProcessAbort(child, session.signal, () => {
					finish({ success: false, category: 'cancelled', code: 'local_job_cancelled', message: 'The local Relay job was cancelled; source bytes were preserved.' });
				});
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
					finish({ success: false, category: 'configuration', code: 'cli_process_spawn_failed', message: 'CLI process could not be started.', details: { error: error.message || String(error) } });
				});
				child.on('close', (status, signal) => {
					const out = stdout.value().trim();
					const err = stderr.value().trim();
					if (status !== 0) {
						finish({ success: false, category: 'cli_process', code: 'cli_process_failed', message: 'CLI process request failed.', details: { status, signal, stdout: out, stderr: err } });
						return;
					}
					let parsed = null;
					try {
						parsed = JSON.parse(out);
					} catch (error) {}
					finish(normalizeChatResponse('cli', 'default', parsed, out));
				});
				const input = payload.input || payload.prompt || textFromMessages(payload.messages);
				if (child.stdin) {
					if (typeof child.stdin.once === 'function') child.stdin.once('error', () => {});
					child.stdin.end(String(input || ''));
				}
			});
		},
	};
}

function createBackendRegistry(options = {}) {
	const cliPaths = options.cliPaths && typeof options.cliPaths === 'object' ? options.cliPaths : {};
	const configuredCliOptions = (driverOptions, key) => {
		const command = typeof cliPaths[key] === 'string' ? cliPaths[key].trim() : '';
		const merged = { ...(driverOptions || {}) };
		if (command) merged.command = command;
		if (typeof merged.args === 'string') merged.args = splitArgs(merged.args);
		return merged;
	};
	const fetchTimeoutMs = Number(options.fetchTimeoutMs || process.env.AI_MODEL_RELAY_PROVIDER_FETCH_TIMEOUT_MS || 60000);
	const drivers = [
		createCodexCliDriver(options.codex, options.mediaAnalysis),
		createGrokCliDriver(configuredCliOptions(options.grok, 'grok-cli')),
		createAntigravityCliDriver(options.mediaAnalysis, configuredCliOptions(options.antigravity, 'antigravity-cli')),
		createCursorCliDriver(configuredCliOptions(options.cursor, 'cursor-cli')),
		createLocalAsrDriver(options.codex),
		createLocalUpscaleDriver(options.upscale || {}),
		createMusicAnalysisDriver(options.musicAnalysis),
		createOpenAiVideosDriver(options.video),
		createXaiApiDriver({ fetchTimeoutMs, ...(options.xai || {}) }),
		createCliProcessDriver(configuredCliOptions(options.cli, 'cli-process')),
		createApiKeyChatDriver({ fetchTimeoutMs, ...(options.apiKeyChat || {}) }),
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
		'local-upscale': 'local-upscale',
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
		return ({ chat: 'text', images: 'image', videos: 'video', transcribe: 'audio', upscale: 'image', 'media.analyze': 'text', 'music.analyze': 'audio' })[jobType] || '';
	}

	function capabilitiesFor(driver) {
		if (!driver || !driver.capabilities) return null;
		const capabilities = driver.capabilities();
		return { ...capabilities, kind: 'driver', job_types: capabilities.job_types || driver.job_types || [] };
	}

	function publishedModelJobTypes(model, capabilities) {
		const own = Array.isArray(model && model.job_types) ? model.job_types.filter(Boolean) : [];
		if (model && model.type === 'image') {
			if (own.includes('images') && !own.includes('chat')) return own;
			return ['images'];
		}
		return own.length ? own : (Array.isArray(capabilities && capabilities.job_types) ? capabilities.job_types : []);
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
		const modelEntries = (selection.model || jobType === 'images') && driver.models ? driver.models() : [];
		const model = selection.model && Array.isArray(modelEntries)
			? modelEntries.find((entry) => entry.id === selection.model || entry.legacy_id === selection.model)
			: null;
		const expected = expectedModelType(jobType);
		if (selection.model && !model && jobType === 'images') {
			return { error: { success: false, category: 'configuration', code: 'backend_model_unknown', message: `Selected image model is unavailable for ${driver.id}: ${selection.model}.`, details: { job_type: jobType, provider: driver.id, model: selection.model } } };
		}
		if (model && expected && model.type !== expected) return { error: { success: false, category: 'configuration', code: 'backend_model_incompatible', message: `Selected model is incompatible with ${jobType}: ${selection.model}.`, details: { job_type: jobType, provider: driver.id, model: selection.model } } };
		if (model && Array.isArray(model.job_types) && model.job_types.length && !model.job_types.includes(jobType)) return { error: { success: false, category: 'configuration', code: 'backend_model_incompatible', message: `Selected model does not support ${jobType}: ${selection.model}.`, details: { job_type: jobType, provider: driver.id, model: selection.model } } };
		if (jobType === 'images') {
			const imageModel = model || (Array.isArray(modelEntries) ? modelEntries.find((entry) => entry && entry.type === 'image' && (!Array.isArray(entry.job_types) || !entry.job_types.length || entry.job_types.includes('images')) && entry.image_capabilities) : null);
			if (!imageModel) return { error: { success: false, category: 'configuration', code: 'backend_image_capability_missing', message: `Selected provider does not publish an image capability contract: ${driver.id}.`, details: { job_type: jobType, provider: driver.id, model: selection.model } } };
			const normalized = normalizeImagePayloadForModel(payload, imageModel);
			if (normalized.error) return { error: normalized.error };
			const stamped = { ...normalized.payload };
			if (!String(stamped.model || '').trim()) stamped.model = imageModel.id;
			return { driver, capabilities, provider: driver.id, payload: stamped };
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
			return driver.models().map((model) => ({ ...model, ready: model.ready !== undefined ? model.ready : !!capabilities.ready, job_types: publishedModelJobTypes(model, capabilities) }));
		}),
		refresh: () => Promise.all(drivers.map((driver) => driver.refresh ? driver.refresh({ resetMedia: true }) : driver.capabilities())),
		getDriver: (jobType, payload) => driverFor(jobType, payload),
		/* Used by explicit local setup to refresh a driver before it is ready. */
		getDriverById: (id) => byId.get(aliases[String(id || '').trim()] || String(id || '').trim()) || null,
		driverFor,
		resolve,
		run(jobType, payload, session) {
			const resolved = resolve(jobType, payload || {});
			if (resolved.error) return Promise.resolve(resolved.error);
			return Promise.resolve(resolved.driver[jobType](resolved.payload || payload || {}, session || {}));
		},
	};
}

module.exports = {
	ANTIGRAVITY_IMAGE_CAPABILITIES,
	GROK_IMAGE_CAPABILITIES,
	IMAGE_CAPABILITY_CONTRACT_VERSION,
	isCompleteImageCapabilityContract,
	findRelayImageModel,
	relayCatalogEntrySupportsImages,
	createApiKeyChatDriver,
	createAntigravityCliDriver,
	createBackendRegistry,
	createCliProcessDriver,
	createCodexCliDriver,
	createCursorCliDriver,
	createGrokCliDriver,
	createLocalAsrDriver,
	createLocalUpscaleDriver,
	createMusicAnalysisDriver,
	createOpenAiVideosDriver,
	createXaiApiDriver,
	GROK_MEDIA_TIMEOUT_MS,
	providerFromPayload,
	antigravityImageToolGuidance,
	grokImageToolGuidance,
	grokImageEditNeedsAspectExpansion,
	generationPreferences,
	normalizeImagePayloadForModel,
};
