'use strict';

const dns = require('dns');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveMaxTokens } = require('./token-policy');

const MAX_FRAMES = 6;
const MAX_FRAME_DATA_URL_CHARS = 2 * 1024 * 1024;
const MAX_MEDIA_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_DATA_URL_CHARS = 10 * 1024 * 1024;
const VIDEO_MIME_TYPES = new Map([
	['video/mp4', 'mp4'],
	['video/quicktime', 'mov'],
	['video/webm', 'webm'],
	['video/x-msvideo', 'avi'],
]);

const MEDIA_ANALYSIS_SCHEMA = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		summary: { type: 'string' },
		visible_text: { type: 'string' },
		issues: { type: 'array', items: { type: 'string' } },
		confidence: { type: 'string' },
		notes: { type: 'string' },
	},
	additionalProperties: true,
};

function writeAnalysisSchema(tempDir) {
	const schemaPath = path.join(tempDir, 'media-analysis.schema.json');
	fs.writeFileSync(schemaPath, `${JSON.stringify(MEDIA_ANALYSIS_SCHEMA, null, 2)}\n`, 'utf8');
	return schemaPath;
}

function outputSchemaSupported(codexAdapter) {
	try {
		if (codexAdapter && typeof codexAdapter.execCapabilities === 'function') {
			return codexAdapter.execCapabilities().output_schema === true;
		}
		const capabilities = codexAdapter && typeof codexAdapter.capabilities === 'function'
			? codexAdapter.capabilities()
			: null;
		return !!(capabilities && capabilities.bridge_features && capabilities.bridge_features.output_schema);
	} catch (error) {
		return false;
	}
}

function parseStructuredAnalysis(value) {
	const text = typeof value === 'string' ? value.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim() : '';
	if (!text) {
		return null;
	}
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		return null;
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return null;
	}
	let knownField = false;
	for (const field of ['summary', 'visible_text', 'confidence', 'notes']) {
		if (parsed[field] !== undefined) {
			knownField = true;
			if (typeof parsed[field] !== 'string') {
				return null;
			}
		}
	}
	if (parsed.issues !== undefined) {
		knownField = true;
		if (!Array.isArray(parsed.issues) || parsed.issues.some((issue) => typeof issue !== 'string')) {
			return null;
		}
	}
	return knownField ? parsed : null;
}

function humanReadableAnalysis(structured, originalText) {
	const summary = typeof structured.summary === 'string' ? structured.summary.trim() : '';
	if (summary) {
		return summary;
	}
	const lines = [];
	if (typeof structured.visible_text === 'string' && structured.visible_text.trim()) {
		lines.push(`Visible text: ${structured.visible_text.trim()}`);
	}
	if (Array.isArray(structured.issues) && structured.issues.length) {
		lines.push(`Issues: ${structured.issues.join('; ')}`);
	}
	if (typeof structured.confidence === 'string' && structured.confidence.trim()) {
		lines.push(`Confidence: ${structured.confidence.trim()}`);
	}
	return lines.join('\n') || originalText;
}

function capabilities() {
	const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: false });
	return {
		enabled: true,
		provider: 'local-codex-vision',
		supported_inputs: ['frames_data_urls', 'https_media_url', 'video_data_url'],
		ffmpeg_available: !ffmpeg.error && ffmpeg.status === 0,
		max_frames: MAX_FRAMES,
		max_media_download_bytes: MAX_MEDIA_DOWNLOAD_BYTES,
	};
}

function normalizeVideoDataUrl(value) {
	const text = String(value || '').trim();
	if (!text || text.length > MAX_VIDEO_DATA_URL_CHARS) return null;
	const match = text.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i);
	if (!match) return null;
	const mimeType = String(match[1] || '').toLowerCase();
	const extension = VIDEO_MIME_TYPES.get(mimeType);
	if (!extension) return null;
	const encoded = match[2].replace(/\s+/g, '');
	if (!encoded || encoded.length % 4 === 1) return null;
	const bytes = Buffer.from(encoded, 'base64');
	if (!bytes.length || bytes.length > MAX_MEDIA_DOWNLOAD_BYTES) return null;
	return { bytes, mime_type: mimeType, extension };
}

function ipv4FromMapped6(host) {
	const dotted = String(host || '').match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
	if (dotted) return dotted[1];
	const hex = String(host || '').match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
	if (!hex) return '';
	const high = Number.parseInt(hex[1], 16);
	const low = Number.parseInt(hex[2], 16);
	if (!Number.isInteger(high) || !Number.isInteger(low)) return '';
	return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

function isPrivateIp(hostname) {
	const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
	if (host === 'localhost') {
		return true;
	}
	const mapped = ipv4FromMapped6(host);
	if (mapped) {
		return isPrivateIp(mapped);
	}
	const ipVersion = net.isIP(host);
	if (ipVersion === 4) {
		const parts = host.split('.').map((part) => Number.parseInt(part, 10));
		return parts[0] === 10
			|| parts[0] === 127
			|| (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
			|| (parts[0] === 192 && parts[1] === 168)
			|| (parts[0] === 169 && parts[1] === 254)
			|| parts[0] === 0;
	}
	if (ipVersion === 6) {
		return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80');
	}
	return false;
}

async function hostnameHasPrivateAddress(hostname, lookupFn = dns.promises.lookup) {
	const host = String(hostname || '').replace(/^\[|\]$/g, '');
	if (!host || isPrivateIp(host)) return true;
	let records;
	try {
		records = await lookupFn(host, { all: true, verbatim: true });
	} catch (error) {
		return true;
	}
	const addresses = Array.isArray(records) ? records : (records ? [records] : []);
	if (!addresses.length) return true;
	return addresses.some((entry) => isPrivateIp(entry && entry.address ? entry.address : entry));
}

function validateRemoteMediaUrl(value) {
	let parsed;
	try {
		parsed = new URL(String(value || '').trim());
	} catch (error) {
		return { ok: false, message: 'A valid HTTPS media URL is required.' };
	}
	if (parsed.protocol !== 'https:') {
		return { ok: false, message: 'Only HTTPS media URLs are accepted for media analysis.' };
	}
	if (parsed.username || parsed.password) {
		return { ok: false, message: 'Media URLs must not include credentials.' };
	}
	if (isPrivateIp(parsed.hostname)) {
		return { ok: false, message: 'Localhost and private-network media URLs are not accepted.' };
	}
	return { ok: true, url: parsed.toString() };
}

function normalizeFrameDataUrl(value) {
	const text = String(value || '').trim();
	if (text.length > MAX_FRAME_DATA_URL_CHARS) {
		return '';
	}
	const match = text.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([\s\S]+)$/i);
	if (!match) {
		return '';
	}
	return `data:${match[1].toLowerCase()};base64,${match[2].replace(/\s+/g, '')}`;
}

function framesFromPayload(payload) {
	const rawFrames = Array.isArray(payload.frames) ? payload.frames : [];
	return rawFrames.map(normalizeFrameDataUrl).filter(Boolean).slice(0, MAX_FRAMES);
}

async function downloadMedia(url, tempDir, fetchImpl = globalThis.fetch, lookupFn = dns.promises.lookup) {
	let currentUrl = String(url || '');
	let response;
	for (let redirects = 0; redirects <= 3; redirects += 1) {
		const parsed = new URL(currentUrl);
		if (await hostnameHasPrivateAddress(parsed.hostname, lookupFn)) {
			throw new Error('Localhost and private-network media URLs are not accepted.');
		}
		response = await fetchImpl(currentUrl, { redirect: 'manual' });
		if (![301, 302, 303, 307, 308].includes(response.status)) break;
		const location = response.headers.get('location');
		const redirected = location ? new URL(location, currentUrl).toString() : '';
		const validation = validateRemoteMediaUrl(redirected);
		if (!validation.ok) throw new Error('Media download redirected to an invalid or private URL.');
		currentUrl = validation.url;
		response = null;
	}
	if (!response) throw new Error('Media download redirected too many times.');
	if (!response.ok) {
		throw new Error(`Media download failed with HTTP ${response.status}.`);
	}
	const mimeType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
	if (mimeType && !VIDEO_MIME_TYPES.has(mimeType) && !['application/octet-stream', 'binary/octet-stream'].includes(mimeType)) {
		throw new Error('Media URL did not return a supported MP4, MOV, WebM, or AVI video.');
	}
	const contentLength = Number.parseInt(String(response.headers.get('content-length') || ''), 10);
	if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_DOWNLOAD_BYTES) {
		throw new Error('Media file is too large for local analysis.');
	}
	const arrayBuffer = await response.arrayBuffer();
	const bytes = Buffer.from(arrayBuffer);
	if (bytes.length > MAX_MEDIA_DOWNLOAD_BYTES) {
		throw new Error('Media file is too large for local analysis.');
	}
	const mediaPath = path.join(tempDir, `input-media.${VIDEO_MIME_TYPES.get(mimeType) || 'bin'}`);
	fs.writeFileSync(mediaPath, bytes);
	return mediaPath;
}

async function materializeMedia(payload = {}, tempDir, fetchImpl = globalThis.fetch, lookupFn = dns.promises.lookup) {
	if (payload.media_data_url) {
		const video = normalizeVideoDataUrl(payload.media_data_url);
		if (!video) return { error: 'Provide a bounded MP4, MOV, WebM, or AVI data URL for media analysis.' };
		const mediaPath = path.join(tempDir, `input-media.${video.extension}`);
		fs.writeFileSync(mediaPath, video.bytes);
		return { path: mediaPath, source: 'data_url', mime_type: video.mime_type };
	}
	if (payload.media_url) {
		const validation = validateRemoteMediaUrl(payload.media_url);
		if (!validation.ok) return { error: validation.message };
		return { path: await downloadMedia(validation.url, tempDir, fetchImpl, lookupFn), source: 'url' };
	}
	return null;
}

function extractFrames(mediaPath, tempDir, frameCount) {
	const outputPattern = path.join(tempDir, 'frame-%03d.jpg');
	const run = spawnSync('ffmpeg', [
		'-hide_banner',
		'-loglevel',
		'error',
		'-y',
		'-i',
		mediaPath,
		'-vf',
		`thumbnail,scale='min(1024,iw)':-2`,
		'-frames:v',
		String(frameCount),
		outputPattern,
	], { encoding: 'utf8', shell: false });
	if (run.error) {
		throw new Error(`ffmpeg could not extract media frames: ${run.error.message || String(run.error)}`);
	}
	if (run.status !== 0) {
		throw new Error(`ffmpeg could not extract media frames: ${(run.stderr || '').trim() || 'unknown error'}`);
	}
	const frames = [];
	for (const entry of fs.readdirSync(tempDir)) {
		if (!/^frame-\d+\.jpg$/i.test(entry)) {
			continue;
		}
		const bytes = fs.readFileSync(path.join(tempDir, entry));
		frames.push(`data:image/jpeg;base64,${bytes.toString('base64')}`);
	}
	return frames.slice(0, frameCount);
}

function buildAnalysisMessages(payload, frames) {
	const prompt = String(payload.prompt || 'Analyze this media and summarize the important visual content, text, timing, and likely user-facing issues.').trim();
	const transcript = String(payload.transcript || '').trim();
	const content = [
		{ type: 'input_text', text: `${transcript ? `${prompt}\n\nProvided audio transcript:\n${transcript.slice(0, 32000)}` : prompt}\n\nIf the CLI requests structured output, fill its schema fields. Otherwise return a concise human-readable analysis.` },
	];
	for (const frame of frames) {
		content.push({ type: 'input_image', image_url: frame });
	}
	return [{ role: 'user', content }];
}

async function analyze(payload = {}, codexAdapter, session = {}) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alorbach-codex-media-'));
	let schemaPath = '';
	let frames = framesFromPayload(payload);
	try {
		schemaPath = writeAnalysisSchema(tempDir);
		if (!frames.length && (payload.media_url || payload.media_data_url)) {
			const materialized = await materializeMedia(payload, tempDir);
			if (materialized && materialized.error) {
				return { success: false, code: 'media_input_invalid', category: 'validation', retryable: false, message: materialized.error };
			}
			if (!capabilities().ffmpeg_available) {
				return { success: false, code: 'ffmpeg_unavailable', category: 'configuration', retryable: false, message: 'ffmpeg is required to extract frames from media URLs or video data URLs.' };
			}
			frames = extractFrames(materialized.path, tempDir, Math.min(MAX_FRAMES, Number.parseInt(String(payload.frame_count || MAX_FRAMES), 10) || MAX_FRAMES));
		}
		if (!frames.length) {
			return { success: false, code: 'media_frames_required', category: 'validation', retryable: false, message: 'Provide bounded image frames, an HTTPS media URL, or a bounded video data URL for analysis.' };
		}
		const chatPayload = {
			model: payload.model || 'codex-local:auto',
			max_tokens: resolveMaxTokens('media.analyze', payload.max_tokens),
			messages: buildAnalysisMessages(payload, frames),
		};
		const useOutputSchema = outputSchemaSupported(codexAdapter);
		const result = useOutputSchema
			? await codexAdapter.chat(chatPayload, session, { outputSchemaPath: schemaPath })
			: await codexAdapter.chat(chatPayload, session);
		if (!result.success) {
			return result;
		}
		const message = result.response && result.response.choices && result.response.choices[0] && result.response.choices[0].message;
		const messageContent = message && typeof message.content === 'string' ? message.content : '';
		const structured = parseStructuredAnalysis(messageContent);
		if (structured && message) {
			message.content = humanReadableAnalysis(structured, messageContent);
		}
		result.response.provider_details = {
			...(result.response.provider_details || {}),
			media_analysis: {
				frames_analyzed: frames.length,
				transcript_supplied: !!String(payload.transcript || '').trim(),
				extracted_from_media_url: !!payload.media_url,
				extracted_from_media_data_url: !!payload.media_data_url,
				...(structured ? { structured } : {}),
			},
		};
		return result;
	} catch (error) {
		return { success: false, code: 'media_analysis_failed', category: 'media_processing', retryable: false, message: error.message || String(error) };
	} finally {
		try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (cleanupError) {}
	}
}

module.exports = {
	analyze,
	capabilities,
	framesFromPayload,
	hostnameHasPrivateAddress,
	isPrivateIp,
	materializeMedia,
	normalizeVideoDataUrl,
	validateRemoteMediaUrl,
};
