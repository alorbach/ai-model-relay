'use strict';

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

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

function isPrivateIp(hostname) {
	const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
	if (host === 'localhost') {
		return true;
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

async function downloadMedia(url, tempDir, fetchImpl = globalThis.fetch) {
	let currentUrl = String(url || '');
	let response;
	for (let redirects = 0; redirects <= 3; redirects += 1) {
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

async function materializeMedia(payload = {}, tempDir, fetchImpl = globalThis.fetch) {
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
		return { path: await downloadMedia(validation.url, tempDir, fetchImpl), source: 'url' };
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
		{ type: 'input_text', text: transcript ? `${prompt}\n\nProvided audio transcript:\n${transcript.slice(0, 12000)}` : prompt },
	];
	for (const frame of frames) {
		content.push({ type: 'input_image', image_url: frame });
	}
	return [{ role: 'user', content }];
}

async function analyze(payload = {}, codexAdapter, session = {}) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alorbach-codex-media-'));
	let frames = framesFromPayload(payload);
	try {
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
		const result = await codexAdapter.chat({
			model: payload.model || 'codex-local:auto',
			max_tokens: payload.max_tokens || 1200,
			messages: buildAnalysisMessages(payload, frames),
		}, session);
		if (!result.success) {
			return result;
		}
		result.response.provider_details = {
			...(result.response.provider_details || {}),
			media_analysis: {
				frames_analyzed: frames.length,
				transcript_supplied: !!String(payload.transcript || '').trim(),
				extracted_from_media_url: !!payload.media_url,
				extracted_from_media_data_url: !!payload.media_data_url,
			},
		};
		return result;
	} catch (error) {
		return { success: false, code: 'media_analysis_failed', category: 'media_processing', retryable: false, message: error.message || String(error) };
	}
}

module.exports = {
	analyze,
	capabilities,
	framesFromPayload,
	isPrivateIp,
	materializeMedia,
	normalizeVideoDataUrl,
	validateRemoteMediaUrl,
};
