'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const process = require('process');
const {
	createAntigravityCliDriver,
	createBackendRegistry,
	createCliProcessDriver,
	createXaiApiDriver,
	providerFromPayload,
} = require('../src/backend-registry');
const mediaAnalysis = require('../src/media-analysis');

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
				assert.strictEqual(body.model, 'grok-4.3');
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
	assert.deepStrictEqual(codexImageModel.test_options[0].choices.map((choice) => choice.value), ['auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2560x1440', '1440x2560', '3840x2160', '2160x3840']);
	assert.deepStrictEqual(codexImageModel.test_options[1].choices.map((choice) => choice.value), ['auto', 'low', 'medium', 'high']);
	assert.ok(codexImageModel.test_options.every((option) => option.delivery === 'guidance'));
	const openAiVideoModel = models.find((model) => model.id === 'model-relay:openai-videos:sora-2');
	assert.deepStrictEqual(openAiVideoModel.test_options.map((option) => option.key), ['size', 'seconds', 'model']);
	assert.ok(openAiVideoModel.test_options.every((option) => option.delivery === 'direct'));
	assert.ok(!models.some((model) => model.backend === 'cursor-cli' && model.type === 'image'));

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

	const xaiResult = await registry.run('chat', { model: 'model-relay:xai:grok-4.3', messages: [{ role: 'user', content: 'hi' }] });
	assert.strictEqual(xaiResult.success, true);
	assert.strictEqual(xaiResult.response.model, 'model-relay:xai:grok-4.3');
	assert.strictEqual(xaiResult.response.provider_details.provider, 'xai');
	assert.ok(!JSON.stringify(xaiResult).includes('secret-xai-key'));
	const xaiChatOnImage = await registry.run('chat', { model: 'model-relay:xai:imagine-image', prompt: 'hi' });
	assert.strictEqual(xaiChatOnImage.code, 'backend_model_incompatible');

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

		const antigravityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-antigravity-test-'));
		const antigravityPrompts = [];
		const antigravityCommands = [];
	let antigravityCandidates = [];
	const antigravityOptions = {
		stateRoot: antigravityRoot,
		detectCliAsync: async (definition) => {
			antigravityCandidates = definition.candidates;
			return { id: 'antigravity-cli', label: 'Antigravity CLI', command: 'agy', installed: true, ready: false, state: 'installed', diagnostic: 'Authentication not checked yet.' };
		},
			runTextCommand: async (command, args) => {
				if (args[0] === '--help') return { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' };
				antigravityCommands.push(args);
			const prompt = args[1];
			antigravityPrompts.push(prompt);
			const name = /ImageName\s+("[^"]+")/.exec(prompt);
			if (name) {
				const imageName = JSON.parse(name[1]);
				const artifactDir = path.join(antigravityRoot, 'brain', 'test-artifacts');
				fs.mkdirSync(artifactDir, { recursive: true });
				fs.writeFileSync(path.join(artifactDir, `${imageName.replace(/-/g, '_')}_${Date.now()}.png`), Buffer.from('generated image'));
				return { success: true, text: JSON.stringify({ text: 'image created' }) };
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
		assert.deepStrictEqual(antigravityImageModel.test_options.map((option) => option.key), ['size']);
		assert.deepStrictEqual(antigravityImageModel.test_options[0].choices.map((choice) => choice.value), ['auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2560x1440', '1440x2560', '3840x2160', '2160x3840']);
		assert.strictEqual(antigravityImageModel.test_options[0].delivery, 'guidance');
		const antigravityChat = await antigravity.chat({ prompt: 'hello from Antigravity' });
		assert.strictEqual(antigravityChat.response.choices[0].message.content, 'Antigravity answer');
                const antigravityImage = await antigravity.images({
                        prompt: 'make a relay icon',
                        size: '1536x1024',
                        quality: 'high',
                        reference_images: [{ b64_json: Buffer.from('reference image').toString('base64'), mime_type: 'image/png' }],
                });
		assert.strictEqual(antigravityImage.success, true);
		assert.strictEqual(antigravityImage.response.data[0].mime_type, 'image/png');
                                assert.strictEqual(antigravityImage.response.provider_details.tool, 'generate_image');
                                assert.ok(antigravityPrompts.some((prompt) => prompt.includes('ImagePaths')));
                                assert.ok(antigravityPrompts.some((prompt) => prompt.includes('Requested output resolution: 1536x1024.')));
                                assert.ok(antigravityPrompts.some((prompt) => prompt.includes('Preferred quality: high.')));
				assert.ok(antigravityCommands.some((args) => args[0] === '-p' && !args.includes('-o') && !args.includes('--output-format')));
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

		const missingArtifact = createAntigravityCliDriver(mediaAnalysis, {
			...antigravityOptions,
			runTextCommand: async (command, args) => args[0] === '--help'
				? { success: true, text: '', stderr: 'Usage: agy.exe --print PROMPT\n  -p  Short alias for --print' }
				: { success: true, text: JSON.stringify({ text: 'no artifact' }) },
		});
		const missingArtifactResult = await missingArtifact.images({ prompt: 'missing artifact' });
		assert.strictEqual(missingArtifactResult.code, 'antigravity_image_artifact_missing');
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
		fs.rmSync(antigravityRoot, { recursive: true, force: true });
	}

	console.log('backend registry tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
