'use strict';

const assert = require('assert');
const http = require('http');
const { createServer } = require('../src/server');

function requestJson(port, method, pathname, body, headers = {}) {
	return new Promise((resolve, reject) => {
		const data = body ? JSON.stringify(body) : '';
		const req = http.request({
			hostname: '127.0.0.1',
			port,
			path: pathname,
			method,
			headers: {
				Origin: 'http://127.0.0.1:8787',
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(data),
				'X-Alorbach-Bridge-Token': 'test-token',
				...headers,
			},
		}, (res) => {
			let raw = '';
			res.setEncoding('utf8');
			res.on('data', (chunk) => {
				raw += chunk;
			});
			res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: raw ? JSON.parse(raw) : {} }));
		});
		req.on('error', reject);
		if (data) {
			req.write(data);
		}
		req.end();
	});
}

function requestBinary(port, method, pathname, body, headers = {}) {
	return new Promise((resolve, reject) => {
		const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body || '');
		const req = http.request({
			hostname: '127.0.0.1', port, path: pathname, method,
			headers: { Origin: 'http://127.0.0.1:8787', 'Content-Type': 'image/png', 'Content-Length': bytes.length, 'X-Alorbach-Bridge-Token': 'test-token', ...headers },
		}, (res) => {
			const chunks = [];
			res.on('data', (chunk) => chunks.push(chunk));
			res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
		});
		req.on('error', reject);
		if (bytes.length) req.write(bytes);
		req.end();
	});
}

function requestPlain(port, pathname, headers = {}) {
	return new Promise((resolve, reject) => {
		http.get({ hostname: '127.0.0.1', port, path: pathname, headers }, (res) => {
			const chunks = [];
			res.on('data', (chunk) => chunks.push(chunk));
			res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
		}).on('error', reject);
	});
}

function createMockSecurity() {
	return {
		MAX_BODY_BYTES: 12 * 1024 * 1024,
		createPairingCode: () => '123456',
		createToken: () => 'test-token',
		getPairing: () => ({ token: 'test-token', paired_at: 'now' }),
		getPairings: () => ({ 'http://127.0.0.1:8787': { token: 'test-token', paired_at: 'now' } }),
		isLocalAddress: () => true,
		normalizeOrigin: (origin) => {
			try {
				return new URL(origin).origin;
			} catch (error) {
				return '';
			}
		},
		removePairing: () => {},
		savePairing: () => {},
		validateBridgeToken: (origin, token) => !!origin && token === 'test-token',
	};
}

(async () => {
	const calls = [];
	let backendRefreshes = 0;
	let localUpscaleRefreshes = 0;
	const codex = {
		checkStatus: () => ({ success: true, message: 'ready', details: {} }),
		models: () => ({ success: true, models: { text: ['codex-local:auto'], image: ['codex-local:image'], audio: ['local-asr'] } }),
		capabilities: () => ({ success: true, bridge_features: { chat: true }, codex: {}, asr: { enabled: true, models: ['local-asr'] } }),
		asrStatus: () => ({ enabled: true, ready: null, runtime_checked: false, models: ['local-asr'] }),
		asrSettings: () => ({ success: true, settings: {}, capabilities: { enabled: true, models: ['local-asr'] } }),
		saveAsrSettings: (settings) => settings,
		setupAsr: (options) => Promise.resolve({ success: true, model_id: 'local-asr:' + (options.model_id || 'whisper-small'), label: 'Local Whisper Small', downloaded: [{ repo_id: 'org/small' }] }),
		chat: (payload) => {
			calls.push({ route: 'legacy-chat', payload });
			return Promise.resolve({ success: true, response: { id: 'legacy-chat' } });
		},
		images: (payload) => {
			calls.push({ route: 'legacy-images', payload });
			return Promise.resolve({ success: true, response: { data: [] } });
		},
		transcribe: (payload) => {
			calls.push({ route: 'legacy-transcribe', payload });
			return Promise.resolve({ success: true, response: { words: [] } });
		},
	};
	const backends = {
		refresh: async () => { backendRefreshes += 1; },
		capabilities: () => [
			{ id: 'codex-cli', label: 'Codex CLI', ready: true },
			{ id: 'xai-api', label: 'Grok / xAI API', configured: true, ready: true },
			{ id: 'local-upscale', label: 'Local CUDA Upscale', ready: true, diagnostic: 'ready', models: [{ id: 'model-relay:local-upscale:swinir-classical-x2', manifest_valid: true }] },
		],
		models: () => [
			{ id: 'model-relay:codex:auto', legacy_id: 'codex-local:auto', type: 'text', backend: 'codex-cli' },
			{ id: 'model-relay:xai:grok-4.3', type: 'text', backend: 'xai-api' },
			{ id: 'model-relay:xai:stt', type: 'audio', backend: 'xai-api' },
			{ id: 'model-relay:music-analysis:core', type: 'audio', backend: 'music-analysis' },
			{ id: 'model-relay:local-upscale:swinir-classical-x2', type: 'image', backend: 'local-upscale', job_types: ['upscale'] },
		],
		getDriver: (type, payload = {}) => String(payload.model || '').startsWith('model-relay:local-upscale:') ? ({ id: 'local-upscale', job_types: ['upscale'], capabilities: () => ({ ready: true, models: [{ id: 'model-relay:local-upscale:swinir-classical-x2', manifest_valid: true }] }) }) : ({ id: 'codex-cli', job_types: ['chat', 'images', 'videos', 'transcribe', 'media.analyze', 'music.analyze'], checkStatus: () => ({ success: true, message: 'ready', details: {} }), capabilities: () => ({ ready: true }) }),
		getDriverById: (id) => String(id) === 'local-upscale' ? ({ id: 'local-upscale', refresh: async () => { localUpscaleRefreshes += 1; } }) : null,
		run: (type, payload, session = {}) => {
			calls.push({ route: `relay-${type}`, payload });
			if (type === 'upscale') return Promise.resolve({ success: true, local_job_id: session.jobId, response: { output: { checksum: 'a'.repeat(64), mime_type: 'image/png', width: 2550, height: 3300, byte_size: 11 }, provenance: { model_id: payload.model, model_version: 'test', weight_checksum: 'b'.repeat(64), cuda_device: 'RTX test', precision: 'fp16', tile: 512, downsampler: 'lanczos' } }, artifact: { mime_type: 'image/png', bytes: Buffer.from('derived-png') } });
			if (payload.prompt === 'rate limited') {
				return Promise.resolve({ success: false, category: 'rate_limit', code: 'provider_quota_exhausted', message: 'Provider quota is exhausted.', retryable: true });
			}
			return Promise.resolve({
				success: true,
				response: {
					id: `relay-${type}`,
					object: type === 'chat' ? 'chat.completion' : undefined,
					model: payload.model,
					choices: type === 'chat' ? [{ index: 0, message: { role: 'assistant', content: 'relay ok' }, finish_reason: 'stop' }] : undefined,
					data: type === 'images' ? [] : undefined,
					words: type === 'transcribe' ? [] : undefined,
					provider_details: { provider: payload.provider || payload.backend || 'auto' },
				},
			});
		},
	};
	let savedRelaySettingsInput = null;
	const server = createServer({
		backgroundRefresh: false,
		codex,
		backends,
		security: createMockSecurity(),
		maxConcurrent: 2,
		video: {
			capabilities: () => ({ enabled: false, configured: false, models: ['sora-2'] }),
			run: () => Promise.resolve({ success: true, response: {} }),
		},
		mediaAnalysis: {
			capabilities: () => ({ enabled: true }),
			analyze: () => Promise.resolve({ success: true, response: { text: 'media ok' } }),
		},
		musicAnalysis: {
			capabilities: () => ({ enabled: true, ready: true, models: ['model-relay:music-analysis:core'] }),
			publicSettings: () => ({ success: true, settings: {}, capabilities: { enabled: true, ready: true } }),
			saveSettings: () => ({}),
			setup: () => Promise.resolve({ success: true }),
			analyze: (payload) => Promise.resolve({ success: true, response: { model: payload.model || 'model-relay:music-analysis:core', music_analysis: {} } }),
		},
		localUpscale: {
			publicSettings: () => ({ success: true, settings: { python_path: '' }, models: [{ id: 'model-relay:local-upscale:swinir-classical-x2', state: 'not_installed' }] }),
			saveSettings: (settings) => settings,
			setup: (options) => Promise.resolve({ success: true, engine: options.engine || 'swinir', model: { id: 'model-relay:local-upscale:swinir-classical-x2', state: 'installed', manifest_valid: true } }),
		},
		relaySettings: {
			settings: () => ({ defaults: { chat: 'model-relay:codex:auto', images: 'model-relay:codex:image', videos: 'model-relay:openai-videos:sora-2', transcribe: 'model-relay:local-asr:auto', 'media.analyze': 'model-relay:codex:auto', 'music.analyze': 'model-relay:music-analysis:core' } }),
			saveSettings: (settings) => {
				savedRelaySettingsInput = settings;
				return { defaults: settings.defaults, cli_paths: settings.cli_paths || {} };
			},
		},
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;
	try {
		const capabilities = await requestJson(port, 'GET', '/v1/relay/capabilities');
		assert.strictEqual(capabilities.statusCode, 200);
		assert.strictEqual(capabilities.body.product.name, 'AI Model Relay');
		assert.strictEqual(capabilities.body.product.legacy_name, 'Codex Local Bridge');
		assert.strictEqual(capabilities.body.frontend_interfaces.relay_v1, true);
		assert.ok(capabilities.body.frontend_interfaces.legacy_routes.includes('/v1/chat'));
		assert.ok(capabilities.body.frontend_interfaces.relay_routes.includes('/v1/relay/jobs/music/analyze'));
		assert.ok(!JSON.stringify(capabilities.body).includes('test-token'));

		const models = await requestJson(port, 'GET', '/v1/relay/models');
		assert.strictEqual(models.statusCode, 200);
		assert.ok(models.body.models.text.includes('codex-local:auto'));
		assert.ok(models.body.models.relay.includes('model-relay:xai:grok-4.3'));
		assert.ok(models.body.models.relay.includes('model-relay:xai:stt'));
		assert.ok(models.body.models.relay.includes('model-relay:music-analysis:core'));
		assert.ok(models.body.models.relay.includes('model-relay:local-upscale:swinir-classical-x2'));
		assert.ok(models.body.backends.some((model) => model.backend === 'xai-api'));

		const relaySettings = await requestJson(port, 'GET', '/v1/relay/settings');
		assert.strictEqual(relaySettings.statusCode, 200);
		assert.strictEqual(relaySettings.body.settings.defaults.chat, 'model-relay:codex:auto');
		const musicSettings = await requestJson(port, 'GET', '/v1/music-analysis/settings');
		assert.strictEqual(musicSettings.statusCode, 200);
		const pageOrigin = { Origin: `http://127.0.0.1:${port}` };
		const savedMusicSettings = await requestJson(port, 'POST', '/v1/music-analysis/settings', { settings: { sample_rate: 24000 } }, pageOrigin);
		assert.strictEqual(savedMusicSettings.statusCode, 200);
		const musicSetup = await requestJson(port, 'POST', '/v1/music-analysis/setup', {}, pageOrigin);
		assert.strictEqual(musicSetup.statusCode, 200);
		const upscaleSettings = await requestJson(port, 'GET', '/v1/upscale/settings');
		assert.strictEqual(upscaleSettings.statusCode, 200);
		const savedUpscaleSettings = await requestJson(port, 'POST', '/v1/upscale/settings', { settings: { venv_path: 'C:\\Models\\upscale-venv' } }, pageOrigin);
		assert.strictEqual(savedUpscaleSettings.statusCode, 200);
		assert.strictEqual(localUpscaleRefreshes, 1, 'saving local model settings refreshes the blocked local-upscale driver');
		const upscaleSetup = await requestJson(port, 'POST', '/v1/upscale/setup', { engine: 'swinir' }, pageOrigin);
		assert.strictEqual(upscaleSetup.statusCode, 200);
		assert.strictEqual(upscaleSetup.body.model.state, 'installed');
		assert.strictEqual(localUpscaleRefreshes, 2, 'a completed local model install refreshes the local-upscale driver even when it was previously unavailable');
		const asrSetup = await requestJson(port, 'POST', '/v1/asr/setup', { model_id: 'whisper-small' }, pageOrigin);
		assert.strictEqual(asrSetup.statusCode, 200);
		assert.strictEqual(asrSetup.body.model_id, 'local-asr:whisper-small');
		const foreignSetup = await requestJson(port, 'POST', '/v1/upscale/setup', { engine: 'swinir' }, { Origin: 'https://evil.example' });
		assert.strictEqual(foreignSetup.statusCode, 403);
		assert.ok(!foreignSetup.headers['access-control-allow-origin']);
		const savedRelaySettings = await requestJson(port, 'POST', '/v1/relay/settings', { settings: { defaults: { chat: 'model-relay:cursor-cli:auto' }, cli_paths: { 'antigravity-cli': 'C:\\Tools\\agy.exe' } } });
		assert.strictEqual(savedRelaySettings.statusCode, 200);
		assert.strictEqual(savedRelaySettingsInput.cli_paths['antigravity-cli'], 'C:\\Tools\\agy.exe');
		assert.strictEqual(savedRelaySettings.body.refresh_started, true);
		const refresh = await requestJson(port, 'POST', '/v1/relay/refresh', {});
		assert.strictEqual(refresh.statusCode, 202);
		assert.strictEqual(refresh.body.checking, true);
		assert.strictEqual(refresh.body.refresh.active, true);
		assert.ok(refresh.body.refresh.id > 0);

		const body = {
			job_token: 'job-token',
			request_hash: 'hash',
			request_id: 'relay-request',
			payload: {
				model: 'model-relay:xai:grok-4.3',
				provider: 'xai-api',
				messages: [{ role: 'user', content: 'hi' }],
			},
		};
		const relayChat = await requestJson(port, 'POST', '/v1/relay/jobs/chat', body);
		assert.strictEqual(relayChat.statusCode, 200);
		assert.strictEqual(relayChat.body.response.id, 'relay-chat');
		assert.strictEqual(calls[calls.length - 1].route, 'relay-chat');
		assert.strictEqual(calls[calls.length - 1].payload.model, 'model-relay:xai:grok-4.3');

		const defaultRelayChat = await requestJson(port, 'POST', '/v1/relay/jobs/chat', { ...body, payload: { messages: [{ role: 'user', content: 'default' }] } });
		assert.strictEqual(defaultRelayChat.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].payload.model, 'model-relay:codex:auto');

		const legacyChat = await requestJson(port, 'POST', '/v1/chat', { ...body, payload: { model: 'codex-local:auto', messages: [] } });
		assert.strictEqual(legacyChat.statusCode, 200);
		assert.strictEqual(legacyChat.body.response.id, 'legacy-chat');
		assert.strictEqual(calls[calls.length - 1].route, 'legacy-chat');

		const relayImages = await requestJson(port, 'POST', '/v1/relay/jobs/images', { ...body, payload: { model: 'model-relay:codex:image', prompt: 'x' } });
		assert.strictEqual(relayImages.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].route, 'relay-images');

		const upscalePayload = { model: 'model-relay:local-upscale:swinir-classical-x2', source_asset_uuid: 'source-uuid', source_checksum: 'c'.repeat(64), crop: { x: 0, y: 0, width: 1, height: 1 }, target_print: { width: 2550, height: 3300, dpi: 300 }, scale: 2, output_format: 'png' };
		const binaryUpscale = await requestBinary(port, 'POST', '/v1/relay/jobs/upscale', Buffer.from('protected-source-png'), { 'X-Alorbach-Request-Id': 'upscale-request', 'X-Alorbach-Job-Token': 'job-token', 'X-Alorbach-Request-Hash': 'hash', 'X-Alorbach-Upscale-Payload': Buffer.from(JSON.stringify(upscalePayload)).toString('base64url') });
		assert.strictEqual(binaryUpscale.statusCode, 200);
		const binaryResult = JSON.parse(binaryUpscale.body.toString('utf8'));
		assert.strictEqual(binaryResult.artifact_url, '/v1/relay/jobs/upscale-request/artifact');
		assert.ok(!binaryUpscale.body.toString('utf8').includes('protected-source-png'));
		assert.strictEqual(calls[calls.length - 1].route, 'relay-upscale');
		assert.strictEqual(calls[calls.length - 1].payload.source_bytes.toString(), 'protected-source-png');
		const unpairedRelayArtifact = await requestPlain(port, binaryResult.artifact_url);
		assert.strictEqual(unpairedRelayArtifact.statusCode, 403);
		const artifact = await requestBinary(port, 'GET', binaryResult.artifact_url, Buffer.alloc(0));
		assert.strictEqual(artifact.statusCode, 200);
		assert.strictEqual(artifact.headers['content-type'], 'image/png');
		assert.strictEqual(artifact.body.toString(), 'derived-png');
		const foreignArtifact = await requestBinary(port, 'GET', binaryResult.artifact_url, Buffer.alloc(0), { Origin: 'http://127.0.0.1:9999' });
		assert.strictEqual(foreignArtifact.statusCode, 404);
		const statusPreview = await requestPlain(port, `/v1/status/jobs/${binaryResult.local_job_id}/artifacts/0`);
		assert.strictEqual(statusPreview.statusCode, 200);
		assert.strictEqual(statusPreview.body.toString(), 'derived-png');
		const corsPreview = await requestPlain(port, `/v1/status/jobs/${binaryResult.local_job_id}/artifacts/0`, { Origin: 'https://evil.example' });
		assert.strictEqual(corsPreview.statusCode, 200);
		assert.ok(!corsPreview.headers['access-control-allow-origin']);
		const invalidBinaryUpscale = await requestBinary(port, 'POST', '/v1/relay/jobs/upscale', Buffer.from('protected-source-png'), { 'X-Alorbach-Request-Id': 'upscale-request' });
		assert.strictEqual(invalidBinaryUpscale.statusCode, 400);

		const refreshesBeforeImageTest = backendRefreshes;
		const localTestRequestId = 'status-test-ui-route-image';
                const localImageTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:codex:image', prompt: 'test image', size: '1536x1024', quality: 'high', test_request_id: localTestRequestId });
		assert.strictEqual(localImageTest.statusCode, 200);
		assert.strictEqual(localImageTest.body.success, true);
		assert.strictEqual(localImageTest.body.request_id, localTestRequestId);
		assert.ok(backendRefreshes > refreshesBeforeImageTest, 'provider test should refresh detection before model preflight');
                assert.strictEqual(calls[calls.length - 1].route, 'relay-images');
                assert.strictEqual(calls[calls.length - 1].payload.prompt, 'test image');
                assert.strictEqual(calls[calls.length - 1].payload.size, '1536x1024');
		assert.strictEqual(calls[calls.length - 1].payload.quality, 'high');
		const rateLimitedImageTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:codex:image', prompt: 'rate limited' });
		assert.strictEqual(rateLimitedImageTest.statusCode, 429);
		assert.strictEqual(rateLimitedImageTest.body.category, 'rate_limit');
		assert.strictEqual(rateLimitedImageTest.body.code, 'provider_quota_exhausted');
		const invalidTestRequestId = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:codex:image', prompt: 'test image', test_request_id: 'invalid value' });
		assert.strictEqual(invalidTestRequestId.statusCode, 400);
		assert.match(invalidTestRequestId.body.message, /request IDs must start with status-test/i);

                const localVideoTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'videos', model: 'model-relay:openai-videos:sora-2', prompt: 'test video', input_reference_data_url: 'data:image/png;base64,AA==', size: '1280x720', seconds: '8' });
		assert.strictEqual(localVideoTest.statusCode, 200);
                assert.strictEqual(calls[calls.length - 1].route, 'relay-videos');
                assert.strictEqual(calls[calls.length - 1].payload.input_reference_data_url, 'data:image/png;base64,AA==');
                assert.strictEqual(calls[calls.length - 1].payload.size, '1280x720');
                assert.strictEqual(calls[calls.length - 1].payload.seconds, '8');
		const localGrokOptionsTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:codex:image', prompt: 'test image guidance', aspect_ratio: '16:9', resolution: '2k' });
		assert.strictEqual(localGrokOptionsTest.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].payload.aspect_ratio, '16:9');
		assert.strictEqual(calls[calls.length - 1].payload.resolution, '2k');
		const localMediaTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'media.analyze', model: 'model-relay:codex:auto', prompt: 'test media', media_data_url: `data:video/mp4;base64,${Buffer.from('mp4').toString('base64')}` });
		assert.strictEqual(localMediaTest.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].route, 'relay-media.analyze');
		assert.ok(String(calls[calls.length - 1].payload.media_data_url).startsWith('data:video/mp4;base64,'));

		const missingTestModel = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', prompt: 'x' });
		assert.strictEqual(missingTestModel.statusCode, 400);
		assert.match(missingTestModel.body.message, /specific provider model/i);

		const relayTranscribe = await requestJson(port, 'POST', '/v1/relay/jobs/transcribe', { ...body, payload: { model: 'model-relay:local-asr:auto' } });
		assert.strictEqual(relayTranscribe.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].route, 'relay-transcribe');
		const xaiTranscribeTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'transcribe', model: 'model-relay:xai:stt', audio_base64: Buffer.from('audio').toString('base64'), audio_format: 'mp3' });
		assert.strictEqual(xaiTranscribeTest.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].route, 'relay-transcribe');
		assert.strictEqual(calls[calls.length - 1].payload.audio_format, 'mp3');

		const relayMusic = await requestJson(port, 'POST', '/v1/relay/jobs/music/analyze', { ...body, payload: { model: 'model-relay:music-analysis:core', audio_base64: Buffer.from('audio').toString('base64'), audio_format: 'wav' } });
		assert.strictEqual(relayMusic.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].route, 'relay-music.analyze');
		const legacyMusic = await requestJson(port, 'POST', '/v1/music/analyze', { ...body, payload: { audio_base64: Buffer.from('audio').toString('base64'), audio_format: 'wav' } });
		assert.strictEqual(legacyMusic.statusCode, 200);
		assert.strictEqual(legacyMusic.body.response.model, 'model-relay:music-analysis:core');

		const relayMedia = await requestJson(port, 'POST', '/v1/relay/jobs/media/analyze', { ...body, payload: { model: 'model-relay:codex:auto' } });
		assert.strictEqual(relayMedia.statusCode, 200);
		assert.strictEqual(relayMedia.body.response.id, 'relay-media.analyze');
		assert.strictEqual(calls[calls.length - 1].route, 'relay-media.analyze');
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}

	console.log('relay route tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
