'use strict';

const DEFAULT_MODELS = ['sora-2', 'sora-2-pro'];
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'expired']);

function enabledFromEnv() {
	return /^(1|true|yes|on)$/i.test(String(process.env.ALORBACH_CODEX_ENABLE_VIDEO || ''));
}

function apiKeyFromEnv() {
	return process.env.ALORBACH_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
}

function resolveVideoModel(value) {
	const raw = String(value == null ? '' : value).trim();
	const model = (raw || 'sora-2').replace(/^model-relay:openai-videos:/i, '').replace(/^openai-video:/i, '') || 'sora-2';
	return DEFAULT_MODELS.includes(model) ? model : '';
}

function capabilities() {
	const enabled = enabledFromEnv();
	const configured = !!apiKeyFromEnv();
	return {
		enabled: enabled && configured,
		configured,
		requires: ['ALORBACH_CODEX_ENABLE_VIDEO=1', 'ALORBACH_OPENAI_API_KEY or OPENAI_API_KEY'],
		provider: 'openai-videos-api',
		models: DEFAULT_MODELS,
		operations: ['create', 'retrieve', 'download', 'remix', 'delete'],
	};
}

function disabledResult() {
	const caps = capabilities();
	return {
		success: false,
		code: caps.configured ? 'video_disabled' : 'video_not_configured',
		category: 'configuration',
		retryable: false,
		message: caps.configured
			? 'Video generation is disabled. Set ALORBACH_CODEX_ENABLE_VIDEO=1 to enable the OpenAI Videos API provider.'
			: 'Video generation requires ALORBACH_OPENAI_API_KEY or OPENAI_API_KEY and ALORBACH_CODEX_ENABLE_VIDEO=1.',
		details: caps,
	};
}

function unknownModelResult(value) {
	return {
		success: false,
		code: 'video_model_unknown',
		category: 'validation',
		retryable: false,
		message: `Unknown OpenAI Videos model: ${String(value || '').trim() || 'sora-2'}.`,
	};
}

function normalizeAction(payload) {
	const explicit = String(payload.action || '').trim().toLowerCase();
	if (explicit) {
		return explicit;
	}
	if (payload.remix_video_id || payload.video_id && payload.prompt) {
		return 'remix';
	}
	if (payload.video_id && payload.download) {
		return 'download';
	}
	if (payload.video_id) {
		return 'retrieve';
	}
	return 'create';
}

function parseDataUrl(value) {
	const match = String(value || '').match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
	if (!match) {
		return null;
	}
	const mime = match[1].toLowerCase();
	if (!/^image\/(jpeg|jpg|png|webp)$/.test(mime)) {
		return null;
	}
	const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
	if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
		return null;
	}
	return { bytes, mime };
}

const FETCH_TIMEOUT_MS = Number(process.env.ALORBACH_VIDEO_FETCH_TIMEOUT_MS || 60000);
const MAX_VIDEO_DOWNLOAD_BYTES = 100 * 1024 * 1024;

async function parseResponse(response, maxBytes = MAX_VIDEO_DOWNLOAD_BYTES) {
	const contentType = response.headers && response.headers.get ? String(response.headers.get('content-type') || '') : '';
	if (/application\/json/i.test(contentType)) {
		return response.json();
	}
	const length = Number(response.headers.get && response.headers.get('content-length') || 0);
	if (length > maxBytes) {
		throw new Error('OpenAI Videos download exceeds the maximum size.');
	}
	if (response.body && typeof response.body.getReader === 'function') {
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
				throw new Error('OpenAI Videos download exceeds the maximum size.');
			}
			chunks.push(chunk);
		}
		return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
	}
	const arrayBuffer = await response.arrayBuffer();
	const bytes = Buffer.from(arrayBuffer);
	if (bytes.length > maxBytes) {
		throw new Error('OpenAI Videos download exceeds the maximum size.');
	}
	return bytes;
}

function requestSignal(options = {}) {
	const timeout = AbortSignal.timeout(Number(options.timeoutMs || FETCH_TIMEOUT_MS));
	if (options.signal && typeof AbortSignal.any === 'function') {
		return AbortSignal.any([timeout, options.signal]);
	}
	return options.signal || timeout;
}

async function requestOpenAi(pathname, options = {}) {
	const { timeoutMs, signal, ...fetchOptions } = options;
	const response = await fetch(`https://api.openai.com/v1${pathname}`, {
		...fetchOptions,
		signal: requestSignal({ timeoutMs, signal }),
		headers: {
			Authorization: `Bearer ${apiKeyFromEnv()}`,
			...(fetchOptions.headers || {}),
		},
	});
	const parsed = await parseResponse(response);
	if (!response.ok) {
		const message = parsed && parsed.error && parsed.error.message ? parsed.error.message : `OpenAI Videos API request failed with HTTP ${response.status}.`;
		return { ok: false, status: response.status, parsed, message };
	}
	return { ok: true, status: response.status, parsed };
}

function createVideo(payload, requestOptions = {}) {
	const model = resolveVideoModel(payload.model);
	if (!model) {
		return { ok: false, status: 400, parsed: {}, message: `Unknown OpenAI Videos model: ${String(payload.model || '').trim() || 'sora-2'}.` };
	}
	const form = new FormData();
	form.set('model', model);
	form.set('prompt', String(payload.prompt || '').trim());
	if (payload.size) {
		form.set('size', String(payload.size));
	}
	if (payload.seconds) {
		form.set('seconds', String(payload.seconds));
	}
	const imageReference = parseDataUrl(payload.input_reference_data_url || payload.input_reference);
	if (imageReference) {
		form.set('input_reference', new Blob([imageReference.bytes], { type: imageReference.mime }), `reference.${imageReference.mime.split('/')[1].replace('jpeg', 'jpg')}`);
	}
	return requestOpenAi('/videos', { method: 'POST', body: form, signal: requestOptions.signal });
}

async function retrieveVideo(videoId, requestOptions = {}) {
	return requestOpenAi(`/videos/${encodeURIComponent(videoId)}`, { method: 'GET', signal: requestOptions.signal });
}

async function remixVideo(payload, requestOptions = {}) {
	const videoId = String(payload.remix_video_id || payload.video_id || '').trim();
	return requestOpenAi(`/videos/${encodeURIComponent(videoId)}/remix`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ prompt: String(payload.prompt || '').trim() }),
		signal: requestOptions.signal,
	});
}

async function deleteVideo(videoId, requestOptions = {}) {
	return requestOpenAi(`/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE', signal: requestOptions.signal });
}

async function downloadVideo(videoId, requestOptions = {}) {
	const result = await requestOpenAi(`/videos/${encodeURIComponent(videoId)}/content`, { method: 'GET', signal: requestOptions.signal });
	if (!result.ok) {
		return result;
	}
	const bytes = Buffer.isBuffer(result.parsed) ? result.parsed : Buffer.from(JSON.stringify(result.parsed));
	return {
		ok: true,
		status: result.status,
		parsed: {
			video_id: videoId,
			b64_video: bytes.toString('base64'),
			mime_type: 'video/mp4',
			bytes: bytes.length,
		},
	};
}

async function pollVideo(videoId, timeoutMs, intervalMs, requestOptions = {}) {
	const started = Date.now();
	let latest = null;
	do {
		const retrieved = await retrieveVideo(videoId, requestOptions);
		if (!retrieved.ok) {
			return retrieved;
		}
		latest = retrieved.parsed;
		if (TERMINAL_STATUSES.has(String(latest.status || '').toLowerCase())) {
			return retrieved;
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	} while (Date.now() - started < timeoutMs);
	return {
		ok: true,
		status: 200,
		parsed: latest || { id: videoId, status: 'in_progress' },
		timed_out: true,
	};
}

function successPayload(operation, parsed, extra = {}) {
	return {
		success: true,
		response: parsed,
		provider_details: {
			provider: 'openai-videos-api',
			operation,
			...extra,
		},
	};
}

function failurePayload(result) {
	return {
		success: false,
		code: 'openai_video_api_failed',
		category: 'provider',
		retryable: result.status >= 500 || result.status === 429,
		message: result.message || 'OpenAI Videos API request failed.',
		details: {
			status: result.status,
			response: result.parsed,
		},
	};
}

async function run(payload = {}, session = {}) {
	if (!capabilities().enabled) {
		return disabledResult();
	}
	const requestOptions = { signal: session && session.signal };
	const action = normalizeAction(payload);
	if ((action === 'create' || action === 'remix') && !resolveVideoModel(payload.model || 'sora-2')) {
		return unknownModelResult(payload.model);
	}
	if ((action === 'create' || action === 'remix') && !String(payload.prompt || '').trim()) {
		return { success: false, code: 'video_prompt_required', category: 'validation', retryable: false, message: 'A video prompt is required.' };
	}
	if (['retrieve', 'download', 'delete', 'remix'].includes(action) && !String(payload.video_id || payload.remix_video_id || '').trim()) {
		return { success: false, code: 'video_id_required', category: 'validation', retryable: false, message: 'A video id is required for this video operation.' };
	}

	let result;
	if (action === 'create') {
		result = await createVideo(payload, requestOptions);
	} else if (action === 'retrieve') {
		result = await retrieveVideo(payload.video_id, requestOptions);
	} else if (action === 'download') {
		result = await downloadVideo(payload.video_id, requestOptions);
	} else if (action === 'remix') {
		result = await remixVideo(payload, requestOptions);
	} else if (action === 'delete') {
		result = await deleteVideo(payload.video_id, requestOptions);
	} else {
		return { success: false, code: 'video_action_invalid', category: 'validation', retryable: false, message: 'Unsupported video action.' };
	}
	if (!result.ok) {
		return failurePayload(result);
	}

	let response = result.parsed;
	let polled = false;
	if ((action === 'create' || action === 'remix') && payload.poll && response && response.id) {
		const pollResult = await pollVideo(response.id, Number(process.env.ALORBACH_VIDEO_POLL_TIMEOUT_MS || 600000), Number(process.env.ALORBACH_VIDEO_POLL_INTERVAL_MS || 3000), requestOptions);
		if (!pollResult.ok) {
			return failurePayload(pollResult);
		}
		response = pollResult.parsed;
		polled = true;
		if (payload.download && String(response.status || '').toLowerCase() === 'completed') {
			const downloaded = await downloadVideo(response.id, requestOptions);
			if (!downloaded.ok) {
				return failurePayload(downloaded);
			}
			response = { ...response, content: downloaded.parsed };
		}
	}
	return successPayload(action, response, { polled });
}

module.exports = {
	capabilities,
	disabledResult,
	resolveVideoModel,
	run,
};
