'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const process = require('process');
const { randomUUID } = require('crypto');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const {
	createAntigravityCliDriver,
	createApiKeyChatDriver,
	createBackendRegistry,
	createCliProcessDriver,
	createCursorCliDriver,
	createGrokCliDriver,
	createXaiApiDriver,
	ANTIGRAVITY_IMAGE_CAPABILITIES,
	GROK_IMAGE_CAPABILITIES,
	isCompleteImageCapabilityContract,
	relayCatalogEntrySupportsImages,
	antigravityImageToolGuidance,
	grokImageToolGuidance,
	normalizeImagePayloadForModel,
	providerFromPayload,
} = require('../src/backend-registry');
const mediaAnalysis = require('../src/media-analysis');

function readyCli(definition) {
	return { id: definition.id, label: definition.label, command: `${definition.id}-test`, installed: true, ready: true, authenticated: true, state: 'ready', diagnostic: 'Ready.', models: ['auto'] };
}

function captureCliSpawn(calls) {
	return (command, args, options) => {
		const promptPath = path.join(options.cwd, 'prompt.txt');
		calls.push({ command, args: args.slice(), cwd: options.cwd, promptPath, promptExists: fs.existsSync(promptPath), prompt: fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : '', chatImageExists: fs.existsSync(path.join(options.cwd, 'chat-image-1.png')) });
		const child = new EventEmitter();
		child.stdin = new PassThrough();
		child.stdout = new PassThrough();
		child.stderr = new PassThrough();
		process.nextTick(() => {
			child.stdout.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: 'test response' }, finish_reason: 'stop' }] }));
			child.stderr.end();
			child.emit('close', 0);
		});
		return child;
	};
}

(async () => {
	const codex = {
		checkStatus: () => ({ success: true, message: 'ready' }),
		capabilities: () => ({
			success: true,
			bridge_features: { chat: true, images: true },
			codex: { version: 'codex mock' },
		}),
		models: () => ({
			success: true,
			models: {
				text: ['codex-local:auto', 'codex-local:gpt-5'],
				image: ['codex-local:image'],
			},
		}),
		asrStatus: () => ({
			enabled: true,
			ready: true,
			runtime_checked: false,
			models: ['local-asr', 'local-asr:qwen3-asr-0.6b'],
		}),
		chat: (payload) => Promise.resolve({ success: true, response: { model: payload.model } }),
		images: (payload) => Promise.resolve({ success: true, response: { model: payload.model, data: [] } }),
		transcribe: (payload) => Promise.resolve({ success: true, response: { model: payload.model, words: [] } }),
	};
	const video = {
		capabilities: () => ({ enabled: true, configured: true, models: ['sora-2'] }),
		run: () => Promise.resolve({ success: true, response: { id: 'video' } }),
	};
	const xaiChatBodies = [];
	const registry = createBackendRegistry({
		codex,
		video,
		musicAnalysis: {
			MODEL_ID: 'model-relay:music-analysis:core',
			capabilities: () => ({ enabled: true, ready: true, runtime_checked: true, models: ['model-relay:music-analysis:core'] }),
			analyze: () => Promise.resolve({ success: true, response: { model: 'model-relay:music-analysis:core', music_analysis: {} } }),
		},
		xai: {
			apiKey: 'secret-xai-key',
			fetch: async (url, options) => {
				assert.ok(String(url).endsWith('/chat/completions'));
				assert.strictEqual(options.headers.Authorization, 'Bearer secret-xai-key');
				const body = JSON.parse(options.body);
				xaiChatBodies.push(body);
				assert.strictEqual(body.model, 'grok-4.3');
				assert.strictEqual(body.max_completion_tokens, body.max_tokens);
				assert.strictEqual(body.stream, undefined);
				return {
					ok: true,
					status: 200,
					text: async () => JSON.stringify({
						id: 'chat-1',
						object: 'chat.completion',
						model: 'grok-4.3',
						choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
						usage: { total_tokens: 9 },
					}),
				};
			},
		},
	});

	assert.strictEqual(providerFromPayload({ model: 'model-relay:xai:grok-4.3' }), 'xai-api');
	assert.strictEqual(providerFromPayload({ backend: 'cli-process' }), 'cli-process');
	assert.strictEqual(providerFromPayload({ model: 'local-asr:qwen3-asr-0.6b' }), 'local-asr');
	assert.strictEqual(providerFromPayload({ model: 'codex-local:audio:whisper-large-v3' }), 'local-asr');
	assert.strictEqual(providerFromPayload({ model: 'model-relay:music-analysis:core' }), 'music-analysis');

	const capabilities = registry.capabilities();
	assert.ok(capabilities.some((backend) => backend.id === 'codex-cli' && backend.ready === true));
	assert.ok(capabilities.some((backend) => backend.id === 'local-asr' && backend.enabled === true));
	assert.ok(capabilities.some((backend) => backend.id === 'music-analysis' && backend.ready === true));
	assert.ok(capabilities.some((backend) => backend.id === 'xai-api' && backend.configured === true));
	assert.ok(!JSON.stringify(capabilities).includes('secret-xai-key'));

	const models = registry.models();
	assert.ok(models.some((model) => model.id === 'model-relay:codex:auto' && model.legacy_id === 'codex-local:auto'));
	assert.ok(models.some((model) => model.id === 'model-relay:local-asr:qwen3-asr-0.6b'));
	assert.ok(models.some((model) => model.id === 'model-relay:xai:grok-4.6'));
	assert.ok(models.some((model) => model.id === 'model-relay:xai:grok-4.3'));
	assert.ok(models.some((model) => model.id === 'model-relay:xai:stt' && model.type === 'audio'));
	assert.ok(models.some((model) => model.id === 'model-relay:xai:imagine-image' && model.type === 'image'));
	assert.ok(models.some((model) => model.id === 'model-relay:xai:imagine-video' && model.type === 'video'));
	const xaiImageModel = models.find((model) => model.id === 'model-relay:xai:imagine-image');
	assert.ok(xaiImageModel.test_options.every((option) => option.delivery === 'direct'));
	assert.ok(xaiImageModel.test_options.find((option) => option.key === 'aspect_ratio').choices.some((choice) => choice.value === '21:9'));
	assert.ok(xaiImageModel.test_options.find((option) => option.key === 'aspect_ratio').choices.some((choice) => choice.value === '5:2'));
	const xaiVideoModel = models.find((model) => model.id === 'model-relay:xai:imagine-video');
	assert.deepStrictEqual(xaiVideoModel.test_options.map((option) => option.key), ['aspect_ratio', 'resolution', 'seconds', 'generate_audio']);
	assert.ok(xaiVideoModel.test_options.find((option) => option.key === 'resolution').choices.some((choice) => choice.value === '1080p'));
	assert.ok(models.some((model) => model.id === 'model-relay:music-analysis:core' && model.type === 'audio'));
	assert.ok(models.some((model) => model.id === 'model-relay:openai-videos:sora-2'));
	const codexImageModel = models.find((model) => model.id === 'model-relay:codex:image');
	assert.deepStrictEqual(codexImageModel.test_options.map((option) => option.key), ['size', 'quality']);
	assert.strictEqual(codexImageModel.image_capabilities.contract_version, 1);
	assert.deepStrictEqual(codexImageModel.image_capabilities.supported_sizes, ['1024x1024', '1536x1024', '1024x1536', '2048x2048', '2560x1440', '1440x2560', '3840x2160', '2160x3840']);
	assert.deepStrictEqual(Object.keys(codexImageModel.image_capabilities.provider_options), ['size']);
	assert.deepStrictEqual(codexImageModel.test_options[0].choices.map((choice) => choice.value), ['auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2560x1440', '1440x2560', '3840x2160', '2160x3840']);
	assert.deepStrictEqual(codexImageModel.test_options[1].choices.map((choice) => choice.value), ['auto', 'low', 'medium', 'high']);
	assert.ok(codexImageModel.test_options.every((option) => option.delivery === 'guidance'));
	const openAiVideoModel = models.find((model) => model.id === 'model-relay:openai-videos:sora-2');
	assert.deepStrictEqual(openAiVideoModel.test_options.map((option) => option.key), ['size', 'seconds', 'model']);
	assert.ok(openAiVideoModel.test_options.every((option) => option.delivery === 'direct'));
	assert.ok(!models.some((model) => model.backend === 'cursor-cli' && model.type === 'image'));
	const grokImageModel = { id: 'model-relay:grok-cli:image', type: 'image', backend: 'grok-cli', ready: true, job_types: ['images'], image_capabilities: GROK_IMAGE_CAPABILITIES };
	assert.deepStrictEqual(Object.keys(grokImageModel.image_capabilities.provider_options).sort(), ['aspect_ratio', 'resolution']);
	assert.strictEqual(grokImageModel.image_capabilities.provider_options.aspect_ratio.delivery, 'native');
	assert.strictEqual(grokImageModel.image_capabilities.resolution_mode, 'guidance');
	assert.strictEqual(grokImageModel.image_capabilities.aspect_ratio_delivery, 'native');
	assert.ok(isCompleteImageCapabilityContract(grokImageModel));
	assert.ok(!relayCatalogEntrySupportsImages({ backends: [grokImageModel] }, grokImageModel), 'Persona-style clients fail when /v1/relay/models omits the grok-cli driver record');
	assert.ok(relayCatalogEntrySupportsImages({ backends: [{ id: 'grok-cli', ready: true, job_types: ['chat', 'images'] }, grokImageModel] }, grokImageModel));
	assert.ok(!relayCatalogEntrySupportsImages({ backends: models }, xaiImageModel), 'model-only catalogs are not enough for image clients');
	assert.ok(relayCatalogEntrySupportsImages({ backends: [...capabilities, ...models] }, xaiImageModel));
	assert.ok(!isCompleteImageCapabilityContract({ ...grokImageModel, job_types: ['chat', 'images', 'videos'] }), 'mixed chat/image job_types is not a complete image contract');
	assert.ok(!isCompleteImageCapabilityContract({ ...grokImageModel, image_capabilities: { ...GROK_IMAGE_CAPABILITIES, provider_options: { resolution: GROK_IMAGE_CAPABILITIES.provider_options.resolution } } }), 'native aspect_ratio must appear in provider_options');
	const antigravityImageModel = { id: 'model-relay:antigravity-cli:image', type: 'image', backend: 'antigravity-cli', ready: true, job_types: ['images'], image_capabilities: ANTIGRAVITY_IMAGE_CAPABILITIES };
	assert.deepStrictEqual(antigravityImageModel.image_capabilities.supported_sizes, ['2K', '4K', '1K']);
	assert.deepStrictEqual(Object.keys(antigravityImageModel.image_capabilities.provider_options), ['image_size']);
	assert.deepStrictEqual(models.find((model) => model.id === 'model-relay:xai:imagine-image').image_capabilities.supported_qualities, ['medium', 'low']);
	assert.deepStrictEqual(Object.keys(xaiImageModel.image_capabilities.provider_options).sort(), ['aspect_ratio', 'quality', 'resolution']);
	assert.ok(isCompleteImageCapabilityContract(codexImageModel));
	assert.ok(isCompleteImageCapabilityContract(antigravityImageModel));
	assert.ok(isCompleteImageCapabilityContract(xaiImageModel));
	const normalizedAntigravity = normalizeImagePayloadForModel({ model: antigravityImageModel.id, prompt: 'x', size: '1536x1024', provider_options: { image_size: '2K' }, aspect_ratio: '16:9' }, antigravityImageModel);
	assert.strictEqual(normalizedAntigravity.error, undefined);
	assert.strictEqual(normalizedAntigravity.payload.size, undefined, 'generic pixel size must not leak to Antigravity');
	assert.strictEqual(normalizedAntigravity.payload.image_size, '2K');
	assert.match(normalizeImagePayloadForModel({ model: antigravityImageModel.id, prompt: 'x', quality: 'high' }, antigravityImageModel).error.message, /quality/i);
	assert.match(normalizeImagePayloadForModel({ model: codexImageModel.id, prompt: 'x', size: '1536x1024', provider_options: { size: '1024x1024' } }, codexImageModel).error.message, /conflicting/i);
	const nestedAutoKeepsSize = normalizeImagePayloadForModel({ model: codexImageModel.id, prompt: 'x', size: '1536x1024', provider_options: { size: 'auto' }, output_format: 'image/png' }, codexImageModel);
	assert.strictEqual(nestedAutoKeepsSize.error, undefined);
	assert.strictEqual(nestedAutoKeepsSize.payload.size, '1536x1024');
	const candidateCountOnly = normalizeImagePayloadForModel({ model: xaiImageModel.id, prompt: 'x', candidate_count: 3, cloud_upload_confirmed: true }, xaiImageModel);
	assert.strictEqual(candidateCountOnly.error, undefined);
	assert.strictEqual(candidateCountOnly.payload.candidate_count, 3);
	assert.strictEqual(candidateCountOnly.payload.n, 3, 'candidate_count must be normalized to xAI n');
	const unknownImageFields = normalizeImagePayloadForModel({ model: antigravityImageModel.id, prompt: 'x', provider_options: { image_size: '2K' }, output_format: 'image/png', requested_size: '1536x1024', unexpected: 'drop-me' }, antigravityImageModel);
	assert.strictEqual(unknownImageFields.error, undefined);
	assert.strictEqual(unknownImageFields.payload.requested_size, undefined, 'internal requested size must not reach the image driver');
	assert.strictEqual(unknownImageFields.payload.unexpected, undefined, 'unknown image fields must not reach the image driver');
	assert.strictEqual(unknownImageFields.payload.image_size, '2K', 'declared provider-native fields remain available to the driver');
	const conflictingCandidateCount = normalizeImagePayloadForModel({ model: xaiImageModel.id, prompt: 'x', candidate_count: 3, n: 1, cloud_upload_confirmed: true }, xaiImageModel);
	assert.strictEqual(conflictingCandidateCount.error, undefined);
	assert.strictEqual(conflictingCandidateCount.payload.n, 3, 'candidate_count must take precedence over a conflicting n');
	const grokGuidance = grokImageToolGuidance({ output_format: 'image/webp' }, 'image_gen');
	assert.match(grokGuidance, /In the tool prompt string, request output_format "image\/webp"/);
	assert.doesNotMatch(grokGuidance, /Pass output_format .* as the image_gen tool argument/);
	assert.match(grokImageToolGuidance({ aspect_ratio: '16:9' }, 'image_edit', { referenceCount: 2 }), /not as the output canvas/);
	assert.doesNotMatch(grokImageToolGuidance({ aspect_ratio: '16:9' }, 'image_gen', { referenceCount: 2 }), /multi-image edit/);
	assert.match(antigravityImageToolGuidance({ output_format: 'image/jpeg' }), /output_format "image\/jpeg"/);
	const providerOnlyImage = registry.resolve('images', { provider: 'xai-api', prompt: 'x', output_format: 'png', candidate_count: 3, cloud_upload_confirmed: true });
	assert.strictEqual(providerOnlyImage.error, undefined);
	assert.strictEqual(providerOnlyImage.payload.model, 'model-relay:xai:imagine-image');
	assert.strictEqual(providerOnlyImage.payload.output_format, 'image/png');
	assert.strictEqual(providerOnlyImage.payload.n, 3);
	assert.deepStrictEqual(xaiImageModel.image_capabilities.supported_output_formats, ['image/png']);
	const xaiJpegUnsupported = await registry.run('images', { provider: 'xai-api', prompt: 'x', output_format: 'image/jpeg', cloud_upload_confirmed: true });
	assert.strictEqual(xaiJpegUnsupported.code, 'relay_image_options_unsupported');
	const foldedAntigravitySize = normalizeImagePayloadForModel({ model: antigravityImageModel.id, prompt: 'x', image_size: '2k', output_format: 'image/png' }, antigravityImageModel);
	assert.strictEqual(foldedAntigravitySize.error, undefined);
	assert.strictEqual(foldedAntigravitySize.payload.image_size, '2K');
	const foldedXaiResolution = normalizeImagePayloadForModel({ model: xaiImageModel.id, prompt: 'x', resolution: '2K', cloud_upload_confirmed: true, output_format: 'image/png' }, xaiImageModel);
	assert.strictEqual(foldedXaiResolution.error, undefined);
	assert.strictEqual(foldedXaiResolution.payload.resolution, '2k');
	const providerOnlyUnsupportedOption = await registry.run('images', { provider: 'xai-api', prompt: 'x', output_format: 'image/tiff', cloud_upload_confirmed: true });
	assert.strictEqual(providerOnlyUnsupportedOption.category, 'validation');
	assert.strictEqual(providerOnlyUnsupportedOption.code, 'relay_image_options_unsupported');
	const unknownImageModel = await registry.run('images', { provider: 'xai-api', model: 'model-relay:xai:unknown-image', prompt: 'x', cloud_upload_confirmed: true });
	assert.strictEqual(unknownImageModel.code, 'backend_model_unknown');

	const codexResult = await registry.run('chat', { model: 'model-relay:codex:gpt-5', messages: [{ role: 'user', content: 'hi' }] });
	assert.strictEqual(codexResult.response.model, 'codex-local:gpt-5');
	const codexAutoResult = await registry.run('chat', { model: 'model-relay:codex:auto', messages: [{ role: 'user', content: 'hi' }] });
	assert.strictEqual(codexAutoResult.response.model, 'codex-local:auto');

	const asrResult = await registry.run('transcribe', { model: 'model-relay:local-asr:qwen3-asr-0.6b' });
	assert.strictEqual(asrResult.response.model, 'local-asr:qwen3-asr-0.6b');
	const asrAutoResult = await registry.run('transcribe', { model: 'model-relay:local-asr:auto' });
	assert.strictEqual(asrAutoResult.response.model, 'local-asr');
	const legacyAsrResult = await registry.run('transcribe', { model: 'codex-local:audio:whisper-large-v3' });
	assert.strictEqual(legacyAsrResult.response.model, 'local-asr:whisper-large-v3');
	const musicResult = await registry.run('music.analyze', { model: 'model-relay:music-analysis:core' });
	assert.strictEqual(musicResult.response.model, 'model-relay:music-analysis:core');
	let codexMediaPayload = null;
	const codexMediaRegistry = createBackendRegistry({
		codex,
		video,
		mediaAnalysis: {
			analyze: (payload) => {
				codexMediaPayload = payload;
				return Promise.resolve({ success: true, response: { model: payload.model } });
			},
		},
		musicAnalysis: {
			MODEL_ID: 'model-relay:music-analysis:core',
			capabilities: () => ({ enabled: true, ready: true, models: ['model-relay:music-analysis:core'] }),
			analyze: () => Promise.resolve({ success: true, response: {} }),
		},
	});
	const codexMediaResult = await codexMediaRegistry.run('media.analyze', { model: 'model-relay:codex:auto', frames: [] });
	assert.strictEqual(codexMediaResult.success, true);
	assert.strictEqual(codexMediaPayload.model, 'codex-local:auto');

	const unknownProvider = await registry.run('chat', { provider: 'not-a-provider', prompt: 'hi' });
	assert.strictEqual(unknownProvider.code, 'backend_unknown');
	const incompatibleModel = await registry.run('chat', { model: 'model-relay:codex:image', prompt: 'hi' });
	assert.strictEqual(incompatibleModel.code, 'backend_model_incompatible');
	const grokAlias = registry.resolve('chat', { provider: 'grok', prompt: 'hi' });
	assert.strictEqual(grokAlias.error.details.provider, 'grok-cli');

	const xaiResult = await registry.run('chat', { model: 'model-relay:xai:grok-4.3', messages: [{ role: 'user', content: 'hi' }], stream: true });
	assert.strictEqual(xaiResult.success, true);
	assert.strictEqual(xaiResult.response.model, 'model-relay:xai:grok-4.3');
	assert.strictEqual(xaiResult.response.provider_details.provider, 'xai');
	assert.ok(!JSON.stringify(xaiResult).includes('secret-xai-key'));
	const xaiExplicitResult = await registry.run('chat', { model: 'model-relay:xai:grok-4.3', max_tokens: 12000, temperature: 0.4, top_p: 0.8, messages: [{ role: 'user', content: 'hi' }] });
	assert.strictEqual(xaiExplicitResult.success, true);
	assert.strictEqual(xaiChatBodies.length, 2);
	assert.strictEqual(xaiChatBodies[0].max_tokens, 8192);
	assert.strictEqual(xaiChatBodies[0].max_completion_tokens, 8192);
	assert.strictEqual(xaiChatBodies[1].max_tokens, 12000);
	assert.strictEqual(xaiChatBodies[1].max_completion_tokens, 12000);
	assert.strictEqual(xaiChatBodies[1].temperature, 0.4);
	assert.strictEqual(xaiChatBodies[1].top_p, 0.8);
	const xaiChatOnImage = await registry.run('chat', { model: 'model-relay:xai:imagine-image', prompt: 'hi' });
	assert.strictEqual(xaiChatOnImage.code, 'backend_model_incompatible');

	let apiKeyChatBody = null;
	const apiKeyChat = createApiKeyChatDriver({
		apiKey: 'secret-chat-key',
		baseUrl: 'https://chat.example.test/v1/',
		model: 'provider-default',
		fetch: async (url, options) => {
			assert.strictEqual(url, 'https://chat.example.test/v1/chat/completions');
			assert.strictEqual(options.headers.Authorization, 'Bearer secret-chat-key');
			apiKeyChatBody = JSON.parse(options.body);
			return {
				ok: true,
				status: 200,
				text: async () => JSON.stringify({
					id: 'api-key-chat-1',
					object: 'chat.completion',
					model: 'provider-model',
					choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
				}),
			};
		},
	});
	const apiKeyChatResult = await apiKeyChat.chat({
		model: 'model-relay:api-key-chat:provider-model',
		messages: [{ role: 'user', content: 'hi' }],
		stream: true,
		temperature: 0.7,
	});
	assert.strictEqual(apiKeyChatResult.success, true);
	assert.strictEqual(apiKeyChatBody.model, 'provider-model');
	assert.strictEqual(apiKeyChatBody.max_tokens, 8192);
	assert.strictEqual(apiKeyChatBody.max_completion_tokens, 8192);
	assert.strictEqual(apiKeyChatBody.temperature, 0.7);
	assert.strictEqual(apiKeyChatBody.stream, undefined);

	const xaiStt = createXaiApiDriver({
		apiKey: 'secret-xai-key',
		fetch: async (url, options) => {
			assert.ok(String(url).endsWith('/stt'));
			assert.strictEqual(options.headers.Authorization, 'Bearer secret-xai-key');
			const parts = Array.from(options.body.entries());
			assert.deepStrictEqual(parts.slice(0, -1).map(([key]) => key), ['language', 'format', 'diarize', 'keyterm', 'keyterm']);
			assert.strictEqual(parts[parts.length - 1][0], 'file');
			assert.strictEqual(parts[parts.length - 1][1].name, 'audio.mp3');
			return {
				ok: true,
				status: 200,
				text: async () => JSON.stringify({ text: 'hello world', language: 'en', duration: 1.5, words: [{ text: 'hello', start: 0, end: 0.5, speaker: 2 }, { text: 'world', start: 0.5, end: 1.0 }] }),
			};
		},
	});
	const sttResult = await xaiStt.transcribe({
		audio_base64: Buffer.from('audio').toString('base64'),
		audio_format: 'audio/mpeg',
		language: 'en',
		format: true,
		diarize: false,
		keyterms: ['Codex', 'xAI'],
	});
	assert.strictEqual(sttResult.success, true);
	assert.strictEqual(sttResult.response.model, 'model-relay:xai:stt');
	assert.deepStrictEqual(sttResult.response.words[0], { word: 'hello', start: 0, end: 0.5, speaker: 2 });
	assert.ok(!JSON.stringify(sttResult).includes('secret-xai-key'));
	const invalidStt = await xaiStt.transcribe({ audio_base64: 'bad%%%' });
	assert.strictEqual(invalidStt.category, 'validation');
	const rateLimitedStt = createXaiApiDriver({ apiKey: 'secret-xai-key', fetch: async () => ({ ok: false, status: 429, text: async () => JSON.stringify({ error: { message: 'slow down' } }) }) });
	const rateLimitedResult = await rateLimitedStt.transcribe({ audio_base64: Buffer.from('audio').toString('base64') });
	assert.strictEqual(rateLimitedResult.code, 'xai_stt_failed');
	assert.strictEqual(rateLimitedResult.category, 'rate_limit');
	assert.strictEqual(rateLimitedResult.retryable, true);
	const rejectedStt = createXaiApiDriver({ apiKey: 'secret-xai-key', fetch: async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: { message: 'Invalid key secret-xai-key' } }) }) });
	const rejectedResult = await rejectedStt.transcribe({ audio_base64: Buffer.from('audio').toString('base64') });
	assert.strictEqual(rejectedResult.category, 'configuration');
	assert.ok(!JSON.stringify(rejectedResult).includes('secret-xai-key'));
	const offlineStt = createXaiApiDriver({ apiKey: 'secret-xai-key', fetch: async () => { throw new Error('secret-xai-key offline'); } });
	const offlineResult = await offlineStt.transcribe({ audio_base64: Buffer.from('audio').toString('base64') });
	assert.strictEqual(offlineResult.code, 'xai_stt_request_failed');
	assert.ok(!JSON.stringify(offlineResult).includes('secret-xai-key'));

	const missingXai = createXaiApiDriver({ apiKey: '', fetch: async () => ({}) });
	const missingResult = await missingXai.chat({ model: 'model-relay:xai:grok-4.3' });
	assert.strictEqual(missingResult.success, false);
	assert.strictEqual(missingResult.category, 'configuration');
	const missingSttResult = await missingXai.transcribe({ audio_base64: Buffer.from('audio').toString('base64') });
	assert.strictEqual(missingSttResult.code, 'xai_api_key_missing');
	const missingImageResult = await missingXai.images({ prompt: 'a cat' });
	assert.strictEqual(missingImageResult.code, 'xai_api_key_missing');
	const missingVideoResult = await missingXai.videos({ prompt: 'animate' });
	assert.strictEqual(missingVideoResult.code, 'xai_api_key_missing');

	const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
	const xaiImagineCalls = [];
	const xaiImagine = createXaiApiDriver({
		apiKey: 'secret-xai-key',
		sleep: async () => {},
		pollTimeoutMs: 1000,
		pollIntervalMs: 1,
		fetch: async (url, options = {}) => {
			const target = String(url);
			xaiImagineCalls.push({ target, body: options.body ? JSON.parse(options.body) : null });
			if (target.endsWith('/images/generations') || target.endsWith('/images/edits')) {
				const body = JSON.parse(options.body);
				assert.strictEqual(body.model, 'grok-imagine-image-2.0');
				assert.strictEqual(body.response_format, 'b64_json');
				return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ b64_json: pngBytes.toString('base64') }] }) };
			}
			if (target.endsWith('/videos/generations')) {
				return { ok: true, status: 200, text: async () => JSON.stringify({ request_id: 'vid-1' }) };
			}
			if (target.endsWith('/videos/vid-1')) {
				return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'done', video: { url: 'https://vidgen.x.ai/clip.mp4', duration: 10 } }) };
			}
			if (target === 'https://vidgen.x.ai/clip.mp4') {
				return { ok: true, status: 200, arrayBuffer: async () => Buffer.from('generated video') };
			}
			throw new Error(`unexpected xAI Imagine request: ${target}`);
		},
	});
	const imagineImage = await xaiImagine.images({
		model: 'model-relay:xai:imagine-image',
		prompt: 'a cat',
		aspect_ratio: '21:9',
		resolution: '2k',
		quality: 'low',
		candidate_count: 2,
		output_format: 'image/png',
	});
	assert.strictEqual(imagineImage.success, true);
	assert.strictEqual(imagineImage.response.data[0].mime_type, 'image/png');
	assert.strictEqual(Buffer.from(imagineImage.response.data[0].b64_json, 'base64').equals(pngBytes), true);
	assert.ok(!JSON.stringify(imagineImage).includes('secret-xai-key'));
	const generateCall = xaiImagineCalls.find((entry) => entry.target.endsWith('/images/generations'));
	assert.ok(generateCall);
	assert.strictEqual(generateCall.body.aspect_ratio, '21:9');
	assert.strictEqual(generateCall.body.resolution, '2k');
	assert.strictEqual(generateCall.body.quality, 'low');
	assert.strictEqual(generateCall.body.n, 2);
	assert.strictEqual(generateCall.body.response_format, 'b64_json');
	assert.strictEqual(generateCall.body.output_format, undefined);
	assert.strictEqual(generateCall.body.image, undefined);
	const imagineEdit = await xaiImagine.images({
		model: 'model-relay:xai:imagine-image',
		prompt: 'edit a cat',
		aspect_ratio: '16:9',
		input_reference_data_url: `data:image/png;base64,${pngBytes.toString('base64')}`,
	});
	assert.strictEqual(imagineEdit.success, true);
	const editCall = xaiImagineCalls.find((entry) => entry.target.endsWith('/images/edits'));
	assert.ok(editCall);
	assert.strictEqual(editCall.body.aspect_ratio, '16:9');
	assert.strictEqual(editCall.body.image.type, 'image_url');
	assert.ok(String(editCall.body.image.url).startsWith('data:image/png;base64,'));
	assert.strictEqual(editCall.body.images, undefined);
	const imagineMultiEdit = await xaiImagine.images({
		prompt: 'combine',
		reference_images: [
			{ b64_json: pngBytes.toString('base64'), mime_type: 'image/png' },
			{ b64_json: pngBytes.toString('base64'), mime_type: 'image/png' },
		],
	});
	assert.strictEqual(imagineMultiEdit.success, true);
	const multiEditCall = xaiImagineCalls.filter((entry) => entry.target.endsWith('/images/edits')).pop();
	assert.strictEqual(multiEditCall.body.image, undefined);
	assert.strictEqual(multiEditCall.body.images.length, 2);
	assert.ok(String(multiEditCall.body.images[0].url).startsWith('data:image/png;base64,'));
	const imagineVideo = await xaiImagine.videos({
		model: 'model-relay:xai:imagine-video',
		prompt: 'animate',
		seconds: 10,
		resolution: '1080p',
		aspect_ratio: '9:16',
		generate_audio: false,
	});
	assert.strictEqual(imagineVideo.success, true);
	assert.strictEqual(Buffer.from(imagineVideo.response.b64_video, 'base64').toString(), 'generated video');
	assert.strictEqual(imagineVideo.response.provider_details.raw_model, 'grok-imagine-video-1.5');
	const videoCreate = xaiImagineCalls.find((entry) => entry.target.endsWith('/videos/generations'));
	assert.strictEqual(videoCreate.body.duration, 10);
	assert.strictEqual(videoCreate.body.resolution, '1080p');
	assert.strictEqual(videoCreate.body.generate_audio, false);
	assert.strictEqual(videoCreate.body.aspect_ratio, '9:16');
	assert.strictEqual(videoCreate.body.image, undefined);
	const oneRefVideo = await xaiImagine.videos({
		prompt: 'animate one ref',
		input_reference_data_url: `data:image/png;base64,${pngBytes.toString('base64')}`,
	});
	assert.strictEqual(oneRefVideo.success, true);
	const oneRefCreate = xaiImagineCalls.filter((entry) => entry.target.endsWith('/videos/generations')).pop();
	assert.ok(String(oneRefCreate.body.image.url).startsWith('data:image/png;base64,'));
	assert.strictEqual(oneRefCreate.body.reference_images, undefined);
	const refVideo = await xaiImagine.videos({
		prompt: 'animate two refs',
		resolution: '1080p',
		reference_images: [
			{ b64_json: pngBytes.toString('base64'), mime_type: 'image/png' },
			{ b64_json: pngBytes.toString('base64'), mime_type: 'image/png' },
		],
	});
	assert.strictEqual(refVideo.success, true);
	const refCreate = xaiImagineCalls.filter((entry) => entry.target.endsWith('/videos/generations')).pop();
	assert.strictEqual(refCreate.body.resolution, '720p');
	assert.strictEqual(refCreate.body.image, undefined);
	assert.strictEqual(refCreate.body.reference_images.length, 2);
	assert.ok(String(refCreate.body.reference_images[0].url).startsWith('data:image/png;base64,'));
	const fourRefs = Array.from({ length: 4 }, () => ({ b64_json: pngBytes.toString('base64'), mime_type: 'image/png' }));
	const tooManyImageRefs = await xaiImagine.images({ prompt: 'too many', reference_images: fourRefs });
	assert.strictEqual(tooManyImageRefs.success, false);
	assert.strictEqual(tooManyImageRefs.code, 'xai_image_reference_invalid');
	const fourRefVideo = await xaiImagine.videos({ prompt: 'animate four refs', reference_images: fourRefs });
	assert.strictEqual(fourRefVideo.success, true);
	const fourRefCreate = xaiImagineCalls.filter((entry) => entry.target.endsWith('/videos/generations')).pop();
	assert.strictEqual(fourRefCreate.body.reference_images.length, 4);
	const tooManyVideoRefs = await xaiImagine.videos({
		prompt: 'too many',
		reference_images: Array.from({ length: 8 }, () => ({ b64_json: pngBytes.toString('base64'), mime_type: 'image/png' })),
	});
	assert.strictEqual(tooManyVideoRefs.success, false);
	assert.strictEqual(tooManyVideoRefs.code, 'xai_video_reference_invalid');

	const cliDriver = createCliProcessDriver({
		command: process.execPath,
		args: ['-e', "let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify({choices:[{index:0,message:{role:'assistant',content:input.toUpperCase()},finish_reason:'stop'}],model:'local-cli'})));"],
		timeoutMs: 5000,
	});
	const cliResult = await cliDriver.chat({ messages: [{ role: 'user', content: 'hello cli' }] });
	assert.strictEqual(cliResult.success, true);
	assert.strictEqual(cliResult.response.choices[0].message.content.includes('HELLO CLI'), true);

	const failedCli = createCliProcessDriver({
		command: process.execPath,
		args: ['-e', "process.stderr.write('boom');process.exit(2);"],
		timeoutMs: 5000,
	});
	const failedCliResult = await failedCli.chat({ prompt: 'fail' });
	assert.strictEqual(failedCliResult.success, false);
	assert.strictEqual(failedCliResult.code, 'cli_process_failed');
	assert.strictEqual(failedCliResult.details.stderr, 'boom');

	const longCliTranscript = 'x'.repeat(30000);
	const grokCalls = [];
	const grokCli = createGrokCliDriver({
		detectCliAsync: async (definition) => readyCli(definition),
		spawn: captureCliSpawn(grokCalls),
	});
	const grokCliResult = await grokCli.chat({ model: 'model-relay:grok-cli:auto', prompt: longCliTranscript });
	assert.strictEqual(grokCliResult.success, true);
	assert.strictEqual(grokCalls.length, 1);
	assert.strictEqual(grokCalls[0].promptExists, true);
	assert.strictEqual(grokCalls[0].prompt, longCliTranscript);
	assert.strictEqual(grokCalls[0].args[0], '--prompt-file');
	assert.strictEqual(grokCalls[0].args[1], grokCalls[0].promptPath);
	assert.strictEqual(grokCalls[0].args[grokCalls[0].args.indexOf('--output-format') + 1], 'json');
	assert.ok(!grokCalls[0].args.includes('--single'));
	assert.ok(!grokCalls[0].args.join(' ').includes(longCliTranscript));
	assert.strictEqual(fs.existsSync(grokCalls[0].cwd), false);

	const cursorCalls = [];
	const cursorCli = createCursorCliDriver({
		detectCliAsync: async (definition) => readyCli(definition),
		spawn: captureCliSpawn(cursorCalls),
	});
	const cursorCliResult = await cursorCli.chat({ model: 'model-relay:cursor-cli:auto', prompt: longCliTranscript });
	assert.strictEqual(cursorCliResult.success, true);
	assert.strictEqual(cursorCalls.length, 1);
	assert.strictEqual(cursorCalls[0].promptExists, true);
	assert.strictEqual(cursorCalls[0].prompt, longCliTranscript);
	assert.ok(cursorCalls[0].args.includes('--print'));
	assert.ok(cursorCalls[0].args.includes('--output-format'));
	assert.strictEqual(cursorCalls[0].args[cursorCalls[0].args.indexOf('--output-format') + 1], 'json');
	assert.ok(cursorCalls[0].args.includes('--mode=ask'));
	assert.ok(cursorCalls[0].args.includes('--trust'));
	assert.ok(!cursorCalls[0].args.includes('--force'));
	assert.ok(!cursorCalls[0].args.includes('--yolo'));
	assert.ok(cursorCalls[0].args.includes('Respond to the user request in prompt.txt.'));
	assert.ok(cursorCalls[0].args.includes('--workspace'));
	assert.strictEqual(cursorCalls[0].args[cursorCalls[0].args.indexOf('--workspace') + 1], cursorCalls[0].cwd);
	assert.ok(!cursorCalls[0].args.join(' ').includes(longCliTranscript));
	assert.strictEqual(fs.existsSync(cursorCalls[0].cwd), false);
	assert.deepStrictEqual(cursorCli.job_types, ['chat']);
	assert.deepStrictEqual(cursorCli.capabilities().job_types, ['chat']);
	assert.ok(!cursorCli.capabilities().features.transcribe);
	assert.ok(!cursorCli.models().some((model) => model.job_types.includes('transcribe')));
	assert.ok(!JSON.stringify(grokCli.capabilities()).includes('transcribe'));
	assert.ok(grokCli.capabilities().job_types.includes('chat'));
	assert.ok(!grokCli.models().some((model) => model.job_types && model.job_types.includes('transcribe')));
	assert.ok(!grokCli.job_types.includes('transcribe'));
	assert.ok(grokCalls[0].args.includes('--cwd'));
	assert.strictEqual(grokCalls[0].args[grokCalls[0].args.indexOf('--cwd') + 1], grokCalls[0].cwd);
	assert.strictEqual(grokCalls[0].args[grokCalls[0].args.indexOf('--disallowed-tools') + 1], 'run_terminal_cmd');
	assert.ok(grokCalls[0].args.includes('--permission-mode'));
	assert.strictEqual(grokCalls[0].args[grokCalls[0].args.indexOf('--permission-mode') + 1], 'dontAsk');
	assert.ok(grokCalls[0].args.includes('--no-subagents'));
	assert.ok(grokCalls[0].args.includes('--disable-web-search'));
	assert.ok(!grokCalls[0].args.includes('--max-turns'));

	const discoveredGrok = createGrokCliDriver({ detectCliAsync: async (definition) => ({ ...readyCli(definition), models: ['auto', 'grok-4.6', 'grok-4.5'] }) });
	await discoveredGrok.refresh();
	assert.deepStrictEqual(discoveredGrok.models().filter((model) => model.type === 'text').map((model) => model.id), ['model-relay:grok-cli:auto', 'model-relay:grok-cli:grok-4.6', 'model-relay:grok-cli:grok-4.5']);
	assert.ok(discoveredGrok.models().filter((model) => model.type === 'text').every((model) => model.job_types.length === 1 && model.job_types[0] === 'chat'));
	const discoveredCursor = createCursorCliDriver({ detectCliAsync: async (definition) => ({ ...readyCli(definition), models: ['auto', 'gpt-5', 'claude-4-sonnet'] }) });
	await discoveredCursor.refresh();
	assert.deepStrictEqual(discoveredCursor.models().map((model) => model.id), ['model-relay:cursor-cli:auto', 'model-relay:cursor-cli:gpt-5', 'model-relay:cursor-cli:claude-4-sonnet']);
	assert.ok(discoveredCursor.models().every((model) => model.job_types.length === 1 && model.job_types[0] === 'chat'));

	const chatPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
	const visionCalls = [];
	const visionRunner = async (command, args, input, session, runOptions = {}) => {
		if (args[0] === '--help') return { success: true, text: 'Usage: grok --prompt-json <JSON> --prompt-file <PATH>', stderr: '' };
		visionCalls.push({ args: args.slice(), cwd: runOptions.cwd, prompt: fs.readFileSync(path.join(runOptions.cwd, 'prompt.txt'), 'utf8'), imageExists: fs.existsSync(path.join(runOptions.cwd, 'chat-image-1.png')) });
		return { success: true, text: JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: 'vision response' }, finish_reason: 'stop' }] }) };
	};
	const visionGrok = createGrokCliDriver({ detectCliAsync: async (definition) => readyCli(definition), runTextCommand: visionRunner });
	const visionResult = await visionGrok.chat({ model: 'model-relay:grok-cli:auto', messages: [{ role: 'user', content: [{ type: 'input_text', text: 'Describe this image.' }, { type: 'input_image', image_url: `data:image/png;base64,${chatPng}` }] }] });
	assert.strictEqual(visionResult.success, true);
	assert.strictEqual(visionCalls.length, 1);
	assert.ok(visionCalls[0].args.includes('--prompt-json'));
	assert.strictEqual(visionCalls[0].imageExists, true);
	assert.ok(!visionCalls[0].args.join(' ').includes(chatPng));
	assert.ok(!visionCalls[0].prompt.includes(chatPng));
	const promptJson = JSON.parse(visionCalls[0].args[visionCalls[0].args.indexOf('--prompt-json') + 1]);
	assert.ok(promptJson.some((block) => block.type === 'image' && block.path.endsWith('chat-image-1.png')));

	const fallbackVisionCalls = [];
	const fallbackVisionGrok = createGrokCliDriver({
		detectCliAsync: async (definition) => readyCli(definition),
		runTextCommand: async (command, args, input, session, runOptions = {}) => {
			if (args[0] === '--help') return { success: true, text: 'Usage: grok --prompt-file <PATH>', stderr: '' };
			fallbackVisionCalls.push({ args: args.slice(), prompt: fs.readFileSync(path.join(runOptions.cwd, 'prompt.txt'), 'utf8'), imageExists: fs.existsSync(path.join(runOptions.cwd, 'chat-image-1.png')) });
			return { success: true, text: JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: 'fallback vision response' }, finish_reason: 'stop' }] }) };
		},
	});
	const fallbackVisionResult = await fallbackVisionGrok.chat({ messages: [{ role: 'user', content: [{ type: 'input_text', text: 'Describe this image.' }, { type: 'input_image', image_url: `data:image/png;base64,${chatPng}` }] }] });
	assert.strictEqual(fallbackVisionResult.success, true);
	assert.strictEqual(fallbackVisionCalls.length, 1);
	assert.ok(fallbackVisionCalls[0].args.includes('--prompt-file'));
	assert.ok(fallbackVisionCalls[0].prompt.includes('@'));
	assert.ok(fallbackVisionCalls[0].prompt.includes('chat-image-1.png'));
	assert.strictEqual(fallbackVisionCalls[0].imageExists, true);
	assert.ok(!fallbackVisionCalls[0].args.join(' ').includes(chatPng));
	assert.ok(!fallbackVisionCalls[0].prompt.includes(chatPng));
	const nativeGrok = createGrokCliDriver({
		detectCliAsync: async (definition) => readyCli(definition),
		runTextCommand: async (command, args) => args[0] === '--help'
			? { success: true, text: 'Usage: grok --prompt-file <PATH>', stderr: '' }
			: { success: true, text: JSON.stringify({ text: 'native Grok response' }) },
	});
	const nativeGrokResult = await nativeGrok.chat({ messages: [{ role: 'user', content: 'hello' }] });
	assert.strictEqual(nativeGrokResult.response.choices[0].message.content, 'native Grok response');
	const nativeCursor = createCursorCliDriver({
		detectCliAsync: async (definition) => readyCli(definition),
		runTextCommand: async () => ({ success: true, text: JSON.stringify({ result: 'native Cursor response' }) }),
	});
	const nativeCursorResult = await nativeCursor.chat({ messages: [{ role: 'user', content: 'hello' }] });
	assert.strictEqual(nativeCursorResult.response.choices[0].message.content, 'native Cursor response');
	const longPromptJsonCalls = [];
	const longPromptJsonGrok = createGrokCliDriver({
		detectCliAsync: async (definition) => readyCli(definition),
		runTextCommand: async (command, args, input, session, runOptions = {}) => {
			if (args[0] === '--help') return { success: true, text: 'Usage: grok --prompt-json <JSON> --prompt-file <PATH>', stderr: '' };
			longPromptJsonCalls.push({ args: args.slice(), promptPath: path.join(runOptions.cwd, 'prompt.txt'), prompt: fs.readFileSync(path.join(runOptions.cwd, 'prompt.txt'), 'utf8') });
			return { success: true, text: JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: 'long prompt response' }, finish_reason: 'stop' }] }) };
		},
	});
	const longPromptJsonResult = await longPromptJsonGrok.chat({ messages: [{ role: 'user', content: 'x'.repeat(12000) }] });
	assert.strictEqual(longPromptJsonResult.success, true);
	assert.strictEqual(longPromptJsonCalls[0].args[0], '--prompt-file');
	assert.strictEqual(longPromptJsonCalls[0].args[1], longPromptJsonCalls[0].promptPath);
	assert.strictEqual(longPromptJsonCalls[0].prompt.length, 12006);

		const antigravityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-antigravity-test-'));
		const antigravityPrompts = [];
		const antigravityPromptFiles = [];
		const antigravityCommands = [];
		let outsideMarker = '';
	let antigravityCandidates = [];
	const antigravityOptions = {
		stateRoot: antigravityRoot,
		detectCliAsync: async (definition) => {
			antigravityCandidates = definition.candidates;
			return { id: 'antigravity-cli', label: 'Antigravity CLI', command: 'agy', installed: true, ready: false, state: 'installed', diagnostic: 'Authentication not checked yet.' };
		},
			runTextCommand: async (command, args, input, session, runOptions = {}) => {
				if (args[0] === '--help') return { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' };
				antigravityCommands.push(args);
			const prompt = args[1];
			antigravityPrompts.push(prompt);
			if (runOptions.cwd) {
				const promptPath = path.join(runOptions.cwd, 'prompt.txt');
				antigravityPromptFiles.push({ args: args.slice(), cwd: runOptions.cwd, promptPath, promptExists: fs.existsSync(promptPath), prompt: fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : '' });
			}
			const name = /ImageName\s+("[^"]+")/.exec(prompt);
			if (name) {
				const imageName = JSON.parse(name[1]);
				const outputFormat = /output_format\s+"(image\/(?:png|jpeg|webp))"/i.exec(prompt)?.[1] || 'image/png';
				const extension = outputFormat === 'image/webp' ? 'webp' : outputFormat === 'image/jpeg' ? 'jpg' : 'png';
				const artifactDir = runOptions.cwd ? runOptions.cwd : path.join(antigravityRoot, 'brain', 'test-artifacts');
				fs.mkdirSync(artifactDir, { recursive: true });
				const artifactPath = runOptions.cwd ? path.join(artifactDir, `generated-image.${extension}`) : path.join(artifactDir, `${imageName.replace(/-/g, '_')}_${Date.now()}.${extension}`);
				fs.writeFileSync(artifactPath, Buffer.from('generated image'));
				return { success: true, text: JSON.stringify({ text: runOptions.cwd ? `image created\nIMAGE_PATH: ${artifactPath}` : 'image created' }) };
			}
			return { success: true, text: JSON.stringify({ text: 'Antigravity answer' }) };
		},
	};
	try {
		const antigravity = createAntigravityCliDriver(mediaAnalysis, antigravityOptions);
		await antigravity.refresh();
		if (process.platform === 'win32') assert.ok(antigravityCandidates.includes(path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'agy', 'bin', 'agy.exe')));
		assert.strictEqual(antigravity.capabilities().ready, true);
		assert.deepStrictEqual(antigravity.models().map((model) => model.id), ['model-relay:antigravity-cli:auto', 'model-relay:antigravity-cli:image', 'model-relay:antigravity-cli:media']);
		const antigravityImageModel = antigravity.models().find((model) => model.id === 'model-relay:antigravity-cli:image');
		assert.deepStrictEqual(antigravityImageModel.test_options.map((option) => option.key), ['aspect_ratio', 'image_size']);
		assert.deepStrictEqual(antigravityImageModel.test_options[1].choices.map((choice) => choice.value), ['2K', '4K', '1K']);
		assert.strictEqual(antigravityImageModel.test_options[0].delivery, 'guidance');
		const antigravityChat = await antigravity.chat({ prompt: 'hello from Antigravity' });
		assert.strictEqual(antigravityChat.response.choices[0].message.content, 'Antigravity answer');
		assert.strictEqual(antigravityPromptFiles[0].promptExists, true);
		assert.strictEqual(antigravityPromptFiles[0].prompt, 'hello from Antigravity');
		assert.ok(/@.*prompt\.txt/.test(antigravityPromptFiles[0].args[1]));
		assert.ok(!antigravityPromptFiles[0].args.join(' ').includes('hello from Antigravity'));
		assert.strictEqual(fs.existsSync(antigravityPromptFiles[0].cwd), false);
		const longAntigravityPrompt = 'y'.repeat(30000);
		const longAntigravityChat = await antigravity.chat({ prompt: longAntigravityPrompt });
		assert.strictEqual(longAntigravityChat.success, true);
		assert.strictEqual(antigravityPromptFiles[1].promptExists, true);
		assert.strictEqual(antigravityPromptFiles[1].prompt, longAntigravityPrompt);
		assert.strictEqual(antigravityPromptFiles[1].prompt.length, 30000);
		assert.ok(!antigravityPromptFiles[1].args.join(' ').includes(longAntigravityPrompt));
		assert.strictEqual(fs.existsSync(antigravityPromptFiles[1].cwd), false);
                const antigravityImage = await antigravity.images({
                        prompt: 'make a relay icon',
                        aspect_ratio: '16:9',
                        image_size: '2K',
                        output_format: 'image/webp',
                        reference_images: [{ b64_json: Buffer.from('reference image').toString('base64'), mime_type: 'image/png' }],
                });
		assert.strictEqual(antigravityImage.success, true);
		assert.strictEqual(antigravityImage.response.data[0].mime_type, 'image/webp');
                                assert.strictEqual(antigravityImage.response.provider_details.tool, 'generate_image');
                                assert.ok(antigravityPrompts.some((prompt) => prompt.includes('ImagePaths')));
                                assert.ok(antigravityPrompts.some((prompt) => prompt.includes('IMAGE_PATH: <absolute path to the saved image>')));
                                assert.ok(antigravityPrompts.some((prompt) => prompt.includes('aspectRatio "16:9"')));
                                assert.ok(antigravityPrompts.some((prompt) => prompt.includes('imageSize "2K"')));
				assert.ok(antigravityPrompts.some((prompt) => prompt.includes('output_format "image/webp"')));
				assert.ok(antigravityCommands.some((args) => args[0] === '-p' && !args.includes('-o') && !args.includes('--output-format')));
		if (process.platform === 'win32') {
			const caseVariantPath = path.join(antigravityRoot, 'brain', 'case-variant.png');
			fs.mkdirSync(path.dirname(caseVariantPath), { recursive: true });
			fs.writeFileSync(caseVariantPath, Buffer.from('case-variant image'));
			const caseVariantMarker = caseVariantPath.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
			const caseVariantDriver = createAntigravityCliDriver(mediaAnalysis, {
				...antigravityOptions,
				runTextCommand: async (command, args) => args[0] === '--help'
					? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
					: { success: true, text: JSON.stringify({ wrapper: { text: `IMAGE_PATH: ${caseVariantMarker}` } }) },
			});
			const caseVariantImage = await caseVariantDriver.images({ prompt: 'case variant marker' });
			assert.strictEqual(caseVariantImage.success, true);
			assert.strictEqual(Buffer.from(caseVariantImage.response.data[0].b64_json, 'base64').toString(), 'case-variant image');
		}
		const arrayMarkerPath = path.join(antigravityRoot, 'array-marker.png');
		fs.writeFileSync(arrayMarkerPath, Buffer.from('array marker image'));
		const arrayMarkerDriver = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			runTextCommand: async (command, args) => args[0] === '--help'
				? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
				: { success: true, text: JSON.stringify([{ arbitrary: [{ text: `IMAGE_PATH: ${arrayMarkerPath}` }] }]) },
		});
		const arrayMarkerImage = await arrayMarkerDriver.images({ prompt: 'array marker' });
		assert.strictEqual(arrayMarkerImage.success, true);
		assert.strictEqual(Buffer.from(arrayMarkerImage.response.data[0].b64_json, 'base64').toString(), 'array marker image');
		const antigravityMedia = await antigravity['media.analyze']({
			prompt: 'describe this test video',
			media_data_url: `data:video/mp4;base64,${Buffer.from('mp4 test video').toString('base64')}`,
		});
		assert.strictEqual(antigravityMedia.success, true);
		assert.strictEqual(antigravityMedia.response.provider_details.media_analysis.video_attached, true);
		assert.ok(antigravityPrompts.some((prompt) => /@.*input-media\.mp4/.test(prompt)));
		const invalidAntigravityMedia = await antigravity['media.analyze']({ media_data_url: 'data:video/mpeg;base64,AAAA' });
		assert.strictEqual(invalidAntigravityMedia.code, 'antigravity_media_invalid');
		const outsideImage = path.join(antigravityRoot, 'secret.png');
		fs.writeFileSync(outsideImage, Buffer.from('secret'));
		const rejectedPaths = await antigravity.images({ prompt: 'steal', referenced_image_paths: [outsideImage] });
		assert.strictEqual(rejectedPaths.code, 'antigravity_reference_invalid');

		const fallbackRoot = path.join(antigravityRoot, 'fallback-state');
		const fallbackDriver = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			stateRoot: fallbackRoot,
			runTextCommand: async (command, args) => {
				if (args[0] === '--help') return { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' };
				const prompt = args[1];
				const name = /ImageName\s+("[^"]+")/.exec(prompt);
				const imageName = JSON.parse(name[1]);
				const artifactDir = path.join(fallbackRoot, 'brain', 'fallback-artifacts');
				fs.mkdirSync(artifactDir, { recursive: true });
				fs.writeFileSync(path.join(artifactDir, `${imageName}_${Date.now()}.png`), Buffer.from('fallback image'));
				return { success: true, text: JSON.stringify({ text: 'image created without marker' }) };
			},
		});
		const fallbackImage = await fallbackDriver.images({ prompt: 'fallback image' });
		assert.strictEqual(fallbackImage.success, true);
		assert.strictEqual(Buffer.from(fallbackImage.response.data[0].b64_json, 'base64').toString(), 'fallback image');
		if (process.platform === 'win32') {
			const fallbackCaseRoot = fallbackRoot.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
			const fallbackCaseDriver = createAntigravityCliDriver(mediaAnalysis, {
				...antigravityOptions,
				stateRoot: fallbackCaseRoot,
				runTextCommand: async (command, args) => {
					if (args[0] === '--help') return { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' };
					const prompt = args[1];
					const name = /ImageName\s+("[^"]+")/.exec(prompt);
					const imageName = JSON.parse(name[1]);
					const artifactDir = path.join(fallbackCaseRoot, 'brain', 'fallback-case-artifacts');
					fs.mkdirSync(artifactDir, { recursive: true });
					fs.writeFileSync(path.join(artifactDir, `${imageName}_${Date.now()}.png`), Buffer.from('fallback case image'));
					return { success: true, text: JSON.stringify({ text: 'image created without marker' }) };
				},
			});
			const fallbackCaseImage = await fallbackCaseDriver.images({ prompt: 'fallback case image' });
			assert.strictEqual(fallbackCaseImage.success, true);
			assert.strictEqual(Buffer.from(fallbackCaseImage.response.data[0].b64_json, 'base64').toString(), 'fallback case image');
		}

		outsideMarker = path.join(os.tmpdir(), `ai-model-relay-antigravity-outside-${randomUUID()}.png`);
		fs.writeFileSync(outsideMarker, Buffer.from('outside marker'));
		const invalidMarkerDriver = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			runTextCommand: async (command, args) => args[0] === '--help'
				? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
				: { success: true, text: JSON.stringify({ text: `IMAGE_PATH: ${outsideMarker}` }) },
		});
		const invalidMarker = await invalidMarkerDriver.images({ prompt: 'outside marker' });
		assert.strictEqual(invalidMarker.code, 'antigravity_image_artifact_invalid');

		const missingArtifact = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			runTextCommand: async (command, args) => args[0] === '--help'
				? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
				: { success: true, text: JSON.stringify({ text: 'no artifact' }) },
		});
		const missingArtifactResult = await missingArtifact.images({ prompt: 'missing artifact' });
		assert.strictEqual(missingArtifactResult.code, 'antigravity_image_artifact_missing');
		const authenticationOutput = {
			message: 'Authentication required. Please visit https://accounts.google.com/o/oauth2/auth?code_challenge=secret',
			text: 'Authentication required. Please visit https://accounts.google.com/o/oauth2/auth?code_challenge=secret',
			stdout: 'Authentication required. Please visit https://accounts.google.com/o/oauth2/auth?code_challenge=secret',
			stderr: 'Authentication required. Please visit https://accounts.google.com/o/oauth2/auth?code_challenge=secret',
		};
		for (const channel of Object.keys(authenticationOutput)) {
			const authenticationDriver = createAntigravityCliDriver(mediaAnalysis, {
				...antigravityOptions,
				runTextCommand: async (command, args) => args[0] === '--help'
					? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
					: { success: false, category: 'cli_process', code: 'cli_request_failed', [channel]: authenticationOutput[channel] },
			});
			const authenticationResult = await authenticationDriver.images({ prompt: `authentication ${channel}` });
			assert.strictEqual(authenticationResult.code, 'antigravity_cli_not_authenticated');
			assert.match(authenticationResult.message, /Run agy interactively/i);
			assert.doesNotMatch(authenticationResult.message, /accounts\.google\.com|code_challenge/i);
		}
		const structuredRoot = path.join(antigravityRoot, 'structured-output');
		const structuredArtifact = path.join(structuredRoot, 'brain', 'structured-output.jpg');
		fs.mkdirSync(path.dirname(structuredArtifact), { recursive: true });
		fs.writeFileSync(structuredArtifact, Buffer.from('structured image'));
		const structuredDriver = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			stateRoot: structuredRoot,
			runTextCommand: async (command, args) => args[0] === '--help'
				? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
				: { success: true, text: JSON.stringify({ response: { image_path: path.relative(structuredRoot, structuredArtifact) } }) },
		});
		const structuredImage = await structuredDriver.images({ prompt: 'structured artifact path' });
		assert.strictEqual(structuredImage.success, true);
		assert.strictEqual(Buffer.from(structuredImage.response.data[0].b64_json, 'base64').toString(), 'structured image');
		const unrelatedRoot = path.join(antigravityRoot, 'unrelated-output');
		const unrelatedArtifact = path.join(unrelatedRoot, 'brain', 'other-request_123.jpg');
		fs.mkdirSync(path.dirname(unrelatedArtifact), { recursive: true });
		fs.writeFileSync(unrelatedArtifact, Buffer.from('unrelated image'));
		const unrelatedDriver = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			stateRoot: unrelatedRoot,
			runTextCommand: async (command, args) => args[0] === '--help'
				? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
				: { success: true, text: 'completed without a request-correlated artifact' },
		});
		const unrelatedImage = await unrelatedDriver.images({ prompt: 'do not import another job image' });
		assert.strictEqual(unrelatedImage.code, 'antigravity_image_artifact_missing');
		const quotaExhausted = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			runTextCommand: async (command, args) => args[0] === '--help'
				? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
				: { success: false, message: 'The image generation service returned a quota exhaustion error (429 Too Many Requests). The capacity for this model has been exhausted.', text: 'quota exhausted' },
		});
		const quotaExhaustedResult = await quotaExhausted.images({ prompt: 'quota test' });
		assert.strictEqual(quotaExhaustedResult.category, 'rate_limit');
		assert.strictEqual(quotaExhaustedResult.code, 'antigravity_quota_exhausted');
		assert.strictEqual(quotaExhaustedResult.retryable, true);
		assert.match(quotaExhaustedResult.message, /quota is exhausted/i);

		const quotaInSuccessText = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			runTextCommand: async (command, args) => args[0] === '--help'
				? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
				: { success: true, text: JSON.stringify({ text: 'Users should retry after quota is exhausted; this answer is otherwise complete.' }) },
		});
		const quotaInSuccessChat = await quotaInSuccessText.chat({ messages: [{ role: 'user', content: 'explain quotas' }] });
		assert.strictEqual(quotaInSuccessChat.success, true);
		assert.ok(!quotaInSuccessChat.code);
		const quotaInSuccessMedia = await quotaInSuccessText['media.analyze']({
			prompt: 'describe this test video',
			media_data_url: `data:video/mp4;base64,${Buffer.from('mp4 test video').toString('base64')}`,
		});
		assert.strictEqual(quotaInSuccessMedia.success, true);

		const agy114Commands = [];
		const agy114Help = [
			'Usage of agy.exe:',
			'  --add-dir Add a directory to the workspace',
			'  --agent Agent for the current CLI session',
			'  -c Short alias for --continue',
			'  -p  Short alias for --print',
		].join('\n');
		const agy114 = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			runTextCommand: async (command, args) => {
				if (args[0] === '--help') return { success: true, text: '', stderr: agy114Help };
				agy114Commands.push(args);
				return antigravityOptions.runTextCommand(command, args);
			},
		});
		await agy114.refresh();
		assert.strictEqual(agy114.capabilities().print_json_supported, false);
		const agy114Image = await agy114.images({ prompt: 'no json flag' });
		assert.strictEqual(agy114Image.success, true);
		const agy114ImageArgs = agy114Commands.find((args) => args[0] === '-p');
		assert.ok(agy114ImageArgs);
		assert.ok(!agy114ImageArgs.includes('-o'));
		assert.ok(!agy114ImageArgs.includes('--output-format'));

		const antigravityRegistry = createBackendRegistry({
			codex,
			video,
			mediaAnalysis,
			musicAnalysis: {
				MODEL_ID: 'model-relay:music-analysis:core',
				capabilities: () => ({ enabled: true, ready: true, models: ['model-relay:music-analysis:core'] }),
				analyze: () => Promise.resolve({ success: true, response: {} }),
			},
			antigravity: antigravityOptions,
		});
			await antigravityRegistry.list().find((driver) => driver.id === 'antigravity-cli').refresh();
			assert.strictEqual(providerFromPayload({ model: 'model-relay:antigravity-cli:image' }), 'antigravity-cli');
			const wrongAntigravityOperation = await antigravityRegistry.run('media.analyze', { model: 'model-relay:antigravity-cli:auto' });
			assert.strictEqual(wrongAntigravityOperation.code, 'backend_model_incompatible');

			let configuredCandidates = [];
			const configuredPathRegistry = createBackendRegistry({
				codex,
				video,
				mediaAnalysis,
				musicAnalysis: {
					MODEL_ID: 'model-relay:music-analysis:core',
					capabilities: () => ({ enabled: true, ready: true, models: ['model-relay:music-analysis:core'] }),
					analyze: () => Promise.resolve({ success: true, response: {} }),
				},
				antigravity: {
					...antigravityOptions,
					detectCliAsync: async (definition) => {
						configuredCandidates = definition.candidates.slice();
						return { id: 'antigravity-cli', label: 'Antigravity CLI', command: definition.candidates[0], installed: true, ready: false, state: 'installed', diagnostic: 'Authentication not checked yet.' };
					},
				},
				cliPaths: { 'antigravity-cli': 'C:\\Tools\\agy.exe' },
			});
			await configuredPathRegistry.list().find((driver) => driver.id === 'antigravity-cli').refresh();
			assert.strictEqual(configuredCandidates[0], 'C:\\Tools\\agy.exe');
		} finally {
		if (outsideMarker) fs.rmSync(outsideMarker, { force: true });
		fs.rmSync(antigravityRoot, { recursive: true, force: true });
	}

	console.log('backend registry tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
