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
			res.on('end', () => resolve({ statusCode: res.statusCode, body: raw ? JSON.parse(raw) : {} }));
		});
		req.on('error', reject);
		if (data) {
			req.write(data);
		}
		req.end();
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
	const codex = {
		checkStatus: () => ({ success: true, message: 'ready', details: {} }),
		models: () => ({ success: true, models: { text: ['codex-local:auto'], image: ['codex-local:image'], audio: ['local-asr'] } }),
		capabilities: () => ({ success: true, bridge_features: { chat: true }, codex: {}, asr: { enabled: true, models: ['local-asr'] } }),
		asrStatus: () => ({ enabled: true, ready: null, runtime_checked: false, models: ['local-asr'] }),
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
		],
		models: () => [
			{ id: 'model-relay:codex:auto', legacy_id: 'codex-local:auto', type: 'text', backend: 'codex-cli' },
			{ id: 'model-relay:xai:grok-4.3', type: 'text', backend: 'xai-api' },
			{ id: 'model-relay:xai:stt', type: 'audio', backend: 'xai-api' },
			{ id: 'model-relay:music-analysis:core', type: 'audio', backend: 'music-analysis' },
		],
		getDriver: () => ({ id: 'codex-cli', job_types: ['chat', 'images', 'videos', 'transcribe', 'media.analyze', 'music.analyze'], checkStatus: () => ({ success: true, message: 'ready', details: {} }), capabilities: () => ({ ready: true }) }),
		run: (type, payload) => {
			calls.push({ route: `relay-${type}`, payload });
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
		relaySettings: {
			settings: () => ({ defaults: { chat: 'model-relay:codex:auto', images: 'model-relay:codex:image', videos: 'model-relay:openai-videos:sora-2', transcribe: 'model-relay:local-asr:auto', 'media.analyze': 'model-relay:codex:auto', 'music.analyze': 'model-relay:music-analysis:core' } }),
			saveSettings: (settings) => ({ defaults: settings.defaults }),
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
		assert.ok(models.body.backends.some((model) => model.backend === 'xai-api'));

		const relaySettings = await requestJson(port, 'GET', '/v1/relay/settings');
		assert.strictEqual(relaySettings.statusCode, 200);
		assert.strictEqual(relaySettings.body.settings.defaults.chat, 'model-relay:codex:auto');
		const musicSettings = await requestJson(port, 'GET', '/v1/music-analysis/settings');
		assert.strictEqual(musicSettings.statusCode, 200);
		const savedMusicSettings = await requestJson(port, 'POST', '/v1/music-analysis/settings', { settings: { sample_rate: 24000 } });
		assert.strictEqual(savedMusicSettings.statusCode, 200);
		const musicSetup = await requestJson(port, 'POST', '/v1/music-analysis/setup', {});
		assert.strictEqual(musicSetup.statusCode, 200);
		const savedRelaySettings = await requestJson(port, 'POST', '/v1/relay/settings', { settings: { defaults: { chat: 'model-relay:cursor-cli:auto' } } });
		assert.strictEqual(savedRelaySettings.statusCode, 200);
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

		const refreshesBeforeImageTest = backendRefreshes;
		const localImageTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:codex:image', prompt: 'test image' });
		assert.strictEqual(localImageTest.statusCode, 200);
		assert.strictEqual(localImageTest.body.success, true);
		assert.ok(backendRefreshes > refreshesBeforeImageTest, 'provider test should refresh detection before model preflight');
		assert.strictEqual(calls[calls.length - 1].route, 'relay-images');
		assert.strictEqual(calls[calls.length - 1].payload.prompt, 'test image');

		const localVideoTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'videos', model: 'model-relay:openai-videos:sora-2', prompt: 'test video', input_reference_data_url: 'data:image/png;base64,AA==' });
		assert.strictEqual(localVideoTest.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].route, 'relay-videos');
		assert.strictEqual(calls[calls.length - 1].payload.input_reference_data_url, 'data:image/png;base64,AA==');

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
		assert.strictEqual(relayMedia.body.response.text, 'media ok');
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}

	console.log('relay route tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
