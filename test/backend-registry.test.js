'use strict';

const assert = require('assert');
const process = require('process');
const {
	createBackendRegistry,
	createCliProcessDriver,
	createXaiApiDriver,
	providerFromPayload,
} = require('../src/backend-registry');

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

	const capabilities = registry.capabilities();
	assert.ok(capabilities.some((backend) => backend.id === 'codex-cli' && backend.ready === true));
	assert.ok(capabilities.some((backend) => backend.id === 'local-asr' && backend.enabled === true));
	assert.ok(capabilities.some((backend) => backend.id === 'xai-api' && backend.configured === true));
	assert.ok(!JSON.stringify(capabilities).includes('secret-xai-key'));

	const models = registry.models();
	assert.ok(models.some((model) => model.id === 'model-relay:codex:auto' && model.legacy_id === 'codex-local:auto'));
	assert.ok(models.some((model) => model.id === 'model-relay:local-asr:qwen3-asr-0.6b'));
	assert.ok(models.some((model) => model.id === 'model-relay:xai:grok-4.3'));
	assert.ok(models.some((model) => model.id === 'model-relay:openai-videos:sora-2'));

	const codexResult = await registry.run('chat', { model: 'model-relay:codex:gpt-5', messages: [{ role: 'user', content: 'hi' }] });
	assert.strictEqual(codexResult.response.model, 'codex-local:gpt-5');

	const asrResult = await registry.run('transcribe', { model: 'model-relay:local-asr:qwen3-asr-0.6b' });
	assert.strictEqual(asrResult.response.model, 'local-asr:qwen3-asr-0.6b');
	const asrAutoResult = await registry.run('transcribe', { model: 'model-relay:local-asr:auto' });
	assert.strictEqual(asrAutoResult.response.model, 'local-asr');
	const legacyAsrResult = await registry.run('transcribe', { model: 'codex-local:audio:whisper-large-v3' });
	assert.strictEqual(legacyAsrResult.response.model, 'local-asr:whisper-large-v3');

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

	const missingXai = createXaiApiDriver({ apiKey: '', fetch: async () => ({}) });
	const missingResult = await missingXai.chat({ model: 'model-relay:xai:grok-4.3' });
	assert.strictEqual(missingResult.success, false);
	assert.strictEqual(missingResult.category, 'configuration');

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

	console.log('backend registry tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
