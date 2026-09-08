'use strict';

const assert = require('assert');
const http = require('http');
const { createServer, getPairingCode, publicStatusProjection } = require('../src/server');
const { GROK_IMAGE_CAPABILITIES, isCompleteImageCapabilityContract, findRelayImageModel, relayCatalogEntrySupportsImages } = require('../src/backend-registry');

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
		getPairing: (origin) => origin === 'http://127.0.0.1:8787' ? ({ token: 'test-token', paired_at: 'now' }) : null,
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
	const publicStatus = publicStatusProjection({ success: true, details: { auth_path: 'C:\\private\\auth.json', generated_images_dir: 'C:\\private\\images' }, message: 'ready' });
	assert.strictEqual(publicStatus.details, undefined);
	assert.strictEqual(publicStatus.message, 'ready');
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
			{ id: 'codex-cli', label: 'Codex CLI', ready: true, job_types: ['chat', 'images'] },
			{ id: 'grok-cli', label: 'Grok CLI', ready: true, job_types: ['chat', 'images'] },
			{ id: 'xai-api', label: 'Grok / xAI API', configured: true, ready: true, job_types: ['chat', 'images'] },
			{ id: 'local-upscale', label: 'Local CUDA Upscale', ready: true, diagnostic: 'ready', models: [{ id: 'model-relay:local-upscale:swinir-classical-x2', manifest_valid: true }] },
		],
		models: () => [
			{ id: 'model-relay:codex:auto', legacy_id: 'codex-local:auto', type: 'text', backend: 'codex-cli' },
			{ id: 'model-relay:xai:grok-4.3', type: 'text', backend: 'xai-api' },
			{ id: 'model-relay:xai:grok-4.6', type: 'text', backend: 'xai-api' },
			{ id: 'model-relay:xai:stt', type: 'audio', backend: 'xai-api' },
			{ id: 'model-relay:xai:imagine-image', type: 'image', backend: 'xai-api', image_capabilities: { contract_version: 1, cloud_upload: true } },
			{ id: 'model-relay:antigravity-cli:image', type: 'image', backend: 'antigravity-cli', image_capabilities: { contract_version: 1, provider_options: { image_size: { type: 'enum', values: ['1K', '2K', '4K'] } } } },
			{ id: 'model-relay:grok-cli:image', type: 'image', backend: 'grok-cli', ready: true, job_types: ['images'], image_capabilities: GROK_IMAGE_CAPABILITIES },
			{ id: 'model-relay:xai:imagine-video', type: 'video', backend: 'xai-api' },
			{ id: 'model-relay:music-analysis:core', type: 'audio', backend: 'music-analysis' },
			{ id: 'model-relay:local-upscale:swinir-classical-x2', type: 'image', backend: 'local-upscale', job_types: ['upscale'], upscale_capabilities: { contract_version: 1, native_scale: 2, output_policy: 'retain_native_x2', input_formats: ['image/png'], output_formats: ['image/png'], cuda_only: true, explicit_install: true } },
		],
		getDriver: (type, payload = {}) => String(payload.model || '').startsWith('model-relay:local-upscale:') ? ({ id: 'local-upscale', job_types: ['upscale'], capabilities: () => ({ ready: true, models: [{ id: 'model-relay:local-upscale:swinir-classical-x2', manifest_valid: true }] }) }) : ({ id: 'codex-cli', job_types: ['chat', 'images', 'videos', 'transcribe', 'media.analyze', 'music.analyze'], checkStatus: () => ({ success: true, message: 'ready', details: {} }), capabilities: () => ({ ready: true }) }),
		resolve(jobType, payload = {}) {
			if (jobType === 'images' && String(payload.aspect_ratio || '') === 'not-a-ratio') {
				return { error: { success: false, category: 'validation', code: 'relay_image_options_unsupported', message: 'The requested aspect ratio is not supported by the selected Relay image model.' } };
			}
			const driver = this.getDriver(jobType, payload);
			const capabilities = driver && driver.capabilities ? driver.capabilities() : { ready: true };
			if (!driver || !capabilities.ready) return { error: { success: false, category: 'configuration', code: 'backend_unavailable', message: 'Selected provider is unavailable.' } };
			return { driver, capabilities, provider: driver.id, payload };
		},
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
	const maskSecret = (value) => {
		const text = String(value || '');
		return text ? { configured: true, suffix: text.slice(-4) } : { configured: false, suffix: '' };
	};
	const storedRelay = {
		defaults: { chat: 'model-relay:codex:auto', images: 'model-relay:codex:image', videos: 'model-relay:openai-videos:sora-2', transcribe: 'model-relay:local-asr:auto', 'media.analyze': 'model-relay:codex:auto', 'music.analyze': 'model-relay:music-analysis:core' },
		cli_paths: {},
		token_defaults: { chat: '', 'media.analyze': '' },
		runtime: { max_concurrent_jobs: '', timeouts: {} },
		providers: { xai: { api_key: '', base_url: '', models: '' }, openai_videos: { enabled: null, api_key: '' }, api_key_chat: { api_key: '', base_url: '', provider_id: '', model: '' }, cli_process: { args: '' }, grok: { imagine_skill: '' }, antigravity: { state_dir: '' } },
	};
	function nextSecret(group, previous) {
		const next = group && typeof group === 'object' ? group : {};
		if (next.clear_api_key === true) return '';
		const incoming = typeof next.api_key === 'string' ? next.api_key.trim() : '';
		return incoming || previous || '';
	}
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
			settings: () => JSON.parse(JSON.stringify(storedRelay)),
			publicSettings: () => {
				const copy = JSON.parse(JSON.stringify(storedRelay));
				copy.providers.xai.api_key = maskSecret(copy.providers.xai.api_key);
				copy.providers.openai_videos.api_key = maskSecret(copy.providers.openai_videos.api_key);
				copy.providers.api_key_chat.api_key = maskSecret(copy.providers.api_key_chat.api_key);
				return copy;
			},
			resolved: () => ({
				runtime: {
					max_concurrent_jobs: Number.parseInt(String(storedRelay.runtime.max_concurrent_jobs || ''), 10) || 2,
					timeouts: storedRelay.runtime.timeouts || {},
				},
				providers: JSON.parse(JSON.stringify(storedRelay.providers)),
			}),
			driverOptions: () => ({}),
			saveSettings: (settings) => {
				savedRelaySettingsInput = settings;
				if (settings.cli_paths) storedRelay.cli_paths = { ...storedRelay.cli_paths, ...settings.cli_paths };
				if (settings.token_defaults) storedRelay.token_defaults = { ...storedRelay.token_defaults, ...settings.token_defaults };
				if (settings.runtime) {
					storedRelay.runtime = {
						...storedRelay.runtime,
						...settings.runtime,
						timeouts: { ...(storedRelay.runtime.timeouts || {}), ...((settings.runtime && settings.runtime.timeouts) || {}) },
					};
				}
				if (settings.providers) {
					const next = settings.providers;
					storedRelay.providers.xai = {
						...storedRelay.providers.xai,
						...(next.xai || {}),
						api_key: nextSecret(next.xai, storedRelay.providers.xai.api_key),
					};
					storedRelay.providers.openai_videos = {
						...storedRelay.providers.openai_videos,
						...(next.openai_videos || {}),
						api_key: nextSecret(next.openai_videos, storedRelay.providers.openai_videos.api_key),
					};
					storedRelay.providers.api_key_chat = {
						...storedRelay.providers.api_key_chat,
						...(next.api_key_chat || {}),
						api_key: nextSecret(next.api_key_chat, storedRelay.providers.api_key_chat.api_key),
					};
					if (next.cli_process) storedRelay.providers.cli_process = { ...storedRelay.providers.cli_process, ...next.cli_process };
					if (next.grok) storedRelay.providers.grok = { ...storedRelay.providers.grok, ...next.grok };
					if (next.antigravity) storedRelay.providers.antigravity = { ...storedRelay.providers.antigravity, ...next.antigravity };
				}
				return JSON.parse(JSON.stringify(storedRelay));
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
		assert.ok(models.body.models.relay.includes('model-relay:xai:grok-4.6'));
		assert.ok(models.body.models.relay.includes('model-relay:xai:imagine-video'));
		assert.ok(models.body.models.relay.includes('model-relay:xai:stt'));
		assert.ok(models.body.models.relay.includes('model-relay:music-analysis:core'));
		assert.ok(models.body.models.relay.includes('model-relay:local-upscale:swinir-classical-x2'));
		assert.ok(models.body.backends.some((model) => model.backend === 'xai-api'));
		assert.ok(models.body.backends.some((item) => item.id === 'grok-cli' && item.ready === true && item.job_types.includes('images')));
		assert.strictEqual(models.body.image_capability_contract_version, 1);
		assert.strictEqual(models.body.image_capability_minimum_relay_version, '1.0.10');
		const relayAntigravityImage = models.body.backends.find((model) => model.id === 'model-relay:antigravity-cli:image');
		assert.deepStrictEqual(Object.keys(relayAntigravityImage.image_capabilities.provider_options), ['image_size']);
		const relayGrokImage = models.body.backends.find((model) => model.id === 'model-relay:grok-cli:image');
		assert.ok(isCompleteImageCapabilityContract(relayGrokImage));
		assert.ok(relayCatalogEntrySupportsImages(models.body, relayGrokImage));
		const requestedGrokImageId = 'model-relay:grok-cli:image';
		const naiveGrokLookup = models.body.backends.find((entry) => requestedGrokImageId.includes(entry.id));
		assert.strictEqual(naiveGrokLookup.id, requestedGrokImageId);
		assert.ok(isCompleteImageCapabilityContract(naiveGrokLookup));
		assert.ok(models.body.backends.indexOf(relayGrokImage) < models.body.backends.findIndex((item) => item.id === 'grok-cli'));
		assert.strictEqual(findRelayImageModel(models.body, requestedGrokImageId).id, requestedGrokImageId);
		assert.ok(!relayCatalogEntrySupportsImages({ backends: models.body.backends.filter((item) => item.id !== 'grok-cli') }, relayGrokImage), 'clients require a grok-cli driver record in the same backends array');
		const relayUpscale = models.body.backends.find((model) => model.id === 'model-relay:local-upscale:swinir-classical-x2');
		assert.strictEqual(relayUpscale.upscale_capabilities.native_scale, 2);
		assert.strictEqual(relayUpscale.upscale_capabilities.output_policy, 'retain_native_x2');

		const relaySettings = await requestJson(port, 'GET', '/v1/relay/settings');
		assert.strictEqual(relaySettings.statusCode, 200);
		assert.strictEqual(relaySettings.body.settings.defaults.chat, 'model-relay:codex:auto');
		assert.strictEqual(typeof relaySettings.body.listen_port, 'number');
		assert.deepStrictEqual(relaySettings.body.settings.providers.xai.api_key, { configured: false, suffix: '' });
		const musicSettings = await requestJson(port, 'GET', '/v1/music-analysis/settings');
		assert.strictEqual(musicSettings.statusCode, 200);
		const pageOrigin = { Origin: `http://127.0.0.1:${port}` };
		const bootstrapCors = await requestJson(port, 'OPTIONS', '/v1/status', null, { Origin: 'https://evil.example', 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(bootstrapCors.statusCode, 204);
		assert.strictEqual(bootstrapCors.headers['access-control-allow-origin'], 'https://evil.example');
		const mutatorCors = await requestJson(port, 'OPTIONS', '/v1/relay/settings', null, { Origin: 'https://evil.example' });
		assert.strictEqual(mutatorCors.statusCode, 403);
		assert.ok(!mutatorCors.headers['access-control-allow-origin']);
		const jobCors = await requestJson(port, 'OPTIONS', '/v1/relay/jobs/chat', null, { Origin: 'https://evil.example' });
		assert.strictEqual(jobCors.statusCode, 204);
		assert.ok(!jobCors.headers['access-control-allow-origin']);
		const unpairedStatus = await requestJson(port, 'GET', '/v1/status', null, { Origin: 'https://evil.example', 'X-Alorbach-Bridge-Token': '' });
		assert.ok(unpairedStatus.statusCode === 200 || unpairedStatus.statusCode === 503);
		assert.strictEqual(unpairedStatus.headers['access-control-allow-origin'], 'https://evil.example');
		assert.ok(!Object.prototype.hasOwnProperty.call(unpairedStatus.body.bridge || {}, 'paired_origins'));
		assert.strictEqual(unpairedStatus.body.bridge.version, require('../package.json').version);
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
		const foreignRelaySettings = await requestJson(port, 'POST', '/v1/relay/settings', { settings: { defaults: { chat: 'model-relay:cursor-cli:auto' } } }, { Origin: 'https://evil.example' });
		assert.strictEqual(foreignRelaySettings.statusCode, 403);
		assert.ok(!foreignRelaySettings.headers['access-control-allow-origin']);
		const anonymousRelaySettings = await requestJson(port, 'POST', '/v1/relay/settings', { settings: { defaults: { chat: 'model-relay:cursor-cli:auto' } } }, { Origin: '' });
		assert.strictEqual(anonymousRelaySettings.statusCode, 403);
		const savedRelaySettings = await requestJson(port, 'POST', '/v1/relay/settings', { settings: { defaults: { chat: 'model-relay:cursor-cli:auto' }, cli_paths: { 'antigravity-cli': 'C:\\Tools\\agy.exe' } } }, pageOrigin);
		assert.strictEqual(savedRelaySettings.statusCode, 200);
		assert.strictEqual(savedRelaySettingsInput.cli_paths['antigravity-cli'], 'C:\\Tools\\agy.exe');
		assert.strictEqual(savedRelaySettings.body.refresh_started, true);
		const secret = 'xai-super-secret-key-9999';
		const savedSecrets = await requestJson(port, 'POST', '/v1/relay/settings', { settings: { runtime: { max_concurrent_jobs: 4 }, providers: { xai: { api_key: secret } } } }, pageOrigin);
		assert.strictEqual(savedSecrets.statusCode, 200);
		assert.ok(!JSON.stringify(savedSecrets.body).includes(secret));
		assert.strictEqual(savedSecrets.body.settings.providers.xai.api_key.configured, true);
		assert.strictEqual(savedSecrets.body.settings.providers.xai.api_key.suffix, '9999');
		assert.strictEqual(server.jobManager.maxConcurrent, 4);
		const reloadedRelaySettings = await requestJson(port, 'GET', '/v1/relay/settings');
		assert.ok(!JSON.stringify(reloadedRelaySettings.body).includes(secret));
		assert.strictEqual(reloadedRelaySettings.body.settings.providers.xai.api_key.configured, true);
		assert.strictEqual(reloadedRelaySettings.body.settings.runtime.max_concurrent_jobs, 4);
		const refresh = await requestJson(port, 'POST', '/v1/relay/refresh', {}, pageOrigin);
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
		const defaultImageOptions = await requestJson(port, 'POST', '/v1/relay/jobs/images', { ...body, payload: { prompt: 'x', aspect_ratio: 'not-a-ratio' } });
		assert.strictEqual(defaultImageOptions.statusCode, 400);
		assert.strictEqual(defaultImageOptions.body.code, 'relay_image_options_unsupported');

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
		const statusPreview = await requestPlain(port, `/v1/status/jobs/${binaryResult.local_job_id}/artifacts/0`, { Origin: `http://127.0.0.1:${port}` });
		assert.strictEqual(statusPreview.statusCode, 200);
		assert.strictEqual(statusPreview.body.toString(), 'derived-png');
		const corsPreview = await requestPlain(port, `/v1/status/jobs/${binaryResult.local_job_id}/artifacts/0`, { Origin: 'https://evil.example' });
		assert.strictEqual(corsPreview.statusCode, 403);
		assert.ok(!corsPreview.headers['access-control-allow-origin']);
		const invalidBinaryUpscale = await requestBinary(port, 'POST', '/v1/relay/jobs/upscale', Buffer.from('protected-source-png'), { 'X-Alorbach-Request-Id': 'upscale-request' });
		assert.strictEqual(invalidBinaryUpscale.statusCode, 400);

		const refreshesBeforeImageTest = backendRefreshes;
		const localTestRequestId = 'status-test-ui-route-image';
                const localImageTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:codex:image', prompt: 'test image', size: '1536x1024', quality: 'high', test_request_id: localTestRequestId }, pageOrigin);
		assert.strictEqual(localImageTest.statusCode, 200);
		assert.strictEqual(localImageTest.body.success, true);
		assert.strictEqual(localImageTest.body.request_id, localTestRequestId);
		assert.ok(backendRefreshes > refreshesBeforeImageTest, 'provider test should refresh detection before model preflight');
                assert.strictEqual(calls[calls.length - 1].route, 'relay-images');
                assert.strictEqual(calls[calls.length - 1].payload.prompt, 'test image');
		assert.strictEqual(calls[calls.length - 1].payload.size, '1536x1024');
		assert.strictEqual(calls[calls.length - 1].payload.quality, 'high');
		const foreignStatusTestArtifact = await requestPlain(port, `/v1/relay/jobs/${encodeURIComponent(localTestRequestId)}/artifact`, { Origin: 'http://127.0.0.1:8787', 'X-Alorbach-Bridge-Token': 'test-token' });
		assert.strictEqual(foreignStatusTestArtifact.statusCode, 404, 'status-page test artifacts remain owned by the local status page origin');
		const rateLimitedImageTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:codex:image', prompt: 'rate limited' }, pageOrigin);
		assert.strictEqual(rateLimitedImageTest.statusCode, 429);
		assert.strictEqual(rateLimitedImageTest.body.category, 'rate_limit');
		assert.strictEqual(rateLimitedImageTest.body.code, 'provider_quota_exhausted');
		const invalidTestRequestId = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:codex:image', prompt: 'test image', test_request_id: 'invalid value' }, pageOrigin);
		assert.strictEqual(invalidTestRequestId.statusCode, 400);
		assert.match(invalidTestRequestId.body.message, /request IDs must start with status-test/i);

                const localVideoTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'videos', model: 'model-relay:openai-videos:sora-2', prompt: 'test video', input_reference_data_url: 'data:image/png;base64,AA==', size: '1280x720', seconds: '8' }, pageOrigin);
		assert.strictEqual(localVideoTest.statusCode, 200);
                assert.strictEqual(calls[calls.length - 1].route, 'relay-videos');
                assert.strictEqual(calls[calls.length - 1].payload.input_reference_data_url, 'data:image/png;base64,AA==');
                assert.strictEqual(calls[calls.length - 1].payload.size, '1280x720');
                assert.strictEqual(calls[calls.length - 1].payload.seconds, '8');
		const localImagineVideoTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'videos', model: 'model-relay:xai:imagine-video', prompt: 'test imagine video', seconds: '10', resolution: '1080p', aspect_ratio: '9:16', generate_audio: 'false' }, pageOrigin);
		assert.strictEqual(localImagineVideoTest.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].payload.model, 'model-relay:xai:imagine-video');
		assert.strictEqual(calls[calls.length - 1].payload.seconds, '10');
		assert.strictEqual(calls[calls.length - 1].payload.resolution, '1080p');
		assert.strictEqual(calls[calls.length - 1].payload.aspect_ratio, '9:16');
		assert.strictEqual(calls[calls.length - 1].payload.generate_audio, 'false');
		const localXaiImageTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:xai:imagine-image', prompt: 'test imagine image', aspect_ratio: '16:9', resolution: '2k' }, pageOrigin);
		assert.strictEqual(localXaiImageTest.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].payload.model, 'model-relay:xai:imagine-image');
		assert.strictEqual(calls[calls.length - 1].payload.cloud_upload_confirmed, true);
		const localGrokOptionsTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:codex:image', prompt: 'test image guidance', aspect_ratio: '16:9', resolution: '2k' }, pageOrigin);
		assert.strictEqual(localGrokOptionsTest.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].payload.aspect_ratio, '16:9');
		assert.strictEqual(calls[calls.length - 1].payload.resolution, '2k');
		const localAntigravityImageTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', model: 'model-relay:antigravity-cli:image', prompt: 'test antigravity image', aspect_ratio: '16:9', image_size: '2K' }, pageOrigin);
		assert.strictEqual(localAntigravityImageTest.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].payload.aspect_ratio, '16:9');
		assert.strictEqual(calls[calls.length - 1].payload.image_size, '2K');
		const localMediaTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'media.analyze', model: 'model-relay:codex:auto', prompt: 'test media', media_data_url: `data:video/mp4;base64,${Buffer.from('mp4').toString('base64')}` }, pageOrigin);
		assert.strictEqual(localMediaTest.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].route, 'relay-media.analyze');
		assert.ok(String(calls[calls.length - 1].payload.media_data_url).startsWith('data:video/mp4;base64,'));

		const missingTestModel = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'images', prompt: 'x' }, pageOrigin);
		assert.strictEqual(missingTestModel.statusCode, 400);
		assert.match(missingTestModel.body.message, /specific provider model/i);

		const relayTranscribe = await requestJson(port, 'POST', '/v1/relay/jobs/transcribe', { ...body, payload: { model: 'model-relay:local-asr:auto' } });
		assert.strictEqual(relayTranscribe.statusCode, 200);
		assert.strictEqual(calls[calls.length - 1].route, 'relay-transcribe');
		const xaiTranscribeTest = await requestJson(port, 'POST', '/v1/relay/test', { job_type: 'transcribe', model: 'model-relay:xai:stt', audio_base64: Buffer.from('audio').toString('base64'), audio_format: 'mp3' }, pageOrigin);
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

		const pairOk = await requestJson(port, 'POST', '/v1/pair', { origin: 'https://wp.example', pairing_code: getPairingCode() }, { Origin: 'https://wp.example', 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(pairOk.statusCode, 200);
		assert.strictEqual(pairOk.body.success, true);
		assert.strictEqual(pairOk.headers['access-control-allow-origin'], 'https://wp.example');
		const pairMismatch = await requestJson(port, 'POST', '/v1/pair', { origin: 'https://wp.example', pairing_code: '000000' }, { Origin: 'https://evil.example', 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(pairMismatch.statusCode, 403);
		assert.ok(!pairMismatch.headers['access-control-allow-origin']);
		for (let i = 0; i < 5; i++) {
			const fail = await requestJson(port, 'POST', '/v1/pair', { origin: 'https://wp.example', pairing_code: '000000' }, { Origin: 'https://wp.example', 'X-Alorbach-Bridge-Token': '' });
			assert.strictEqual(fail.statusCode, 403);
		}
		const otherOriginFail = await requestJson(port, 'POST', '/v1/pair', { origin: 'https://other.example', pairing_code: '000000' }, { Origin: 'https://other.example', 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(otherOriginFail.statusCode, 403, 'pairing failures are scoped to the requesting origin');
		const limited = await requestJson(port, 'POST', '/v1/pair', { origin: 'https://wp.example', pairing_code: '000000' }, { Origin: 'https://wp.example', 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(limited.statusCode, 429);
		assert.strictEqual(limited.body.code, 'pairing_rate_limited');
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}

	console.log('relay route tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
