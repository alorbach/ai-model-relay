'use strict';

const assert = require('assert');
const security = require('../src/security');
const relaySettings = require('../src/relay-settings');
const { resolveMaxTokens } = require('../src/token-policy');

const originalReadState = security.readState;
const originalWriteState = security.writeState;
let state = {};

try {
	security.readState = () => JSON.parse(JSON.stringify(state));
	security.writeState = (next) => { state = JSON.parse(JSON.stringify(next)); };

	const initial = relaySettings.settings();
	assert.deepStrictEqual(initial.cli_paths, {
		'codex-cli': '',
		'grok-cli': '',
		'antigravity-cli': '',
		'cursor-cli': '',
		'cli-process': '',
	});
	assert.deepStrictEqual(initial.token_defaults, { chat: '', 'media.analyze': '' });

	const saved = relaySettings.saveSettings({
		defaults: { chat: 'model-relay:antigravity-cli:auto' },
		cli_paths: {
			'antigravity-cli': '  C:\\Tools\\agy.exe  ',
			'grok-cli': 42,
			unexpected: 'ignored',
		},
	});
	assert.strictEqual(saved.defaults.chat, 'model-relay:antigravity-cli:auto');
	assert.strictEqual(saved.cli_paths['antigravity-cli'], 'C:\\Tools\\agy.exe');
	assert.strictEqual(saved.cli_paths['grok-cli'], '');
	assert.strictEqual(Object.prototype.hasOwnProperty.call(saved.cli_paths, 'unexpected'), false);
	assert.strictEqual(state.relay.cli_paths['antigravity-cli'], 'C:\\Tools\\agy.exe');
	assert.deepStrictEqual(saved.token_defaults, { chat: '', 'media.analyze': '' });
	assert.deepStrictEqual(state.relay.token_defaults, {});

	const tokenOverrides = relaySettings.saveSettings({ token_defaults: { chat: '16384', 'media.analyze': 512 } });
	assert.deepStrictEqual(tokenOverrides.token_defaults, { chat: 16384, 'media.analyze': 512 });
	assert.deepStrictEqual(state.relay.token_defaults, { chat: 16384, 'media.analyze': 512 });
	const invalidTokens = relaySettings.saveSettings({ token_defaults: { chat: 'not-a-number', 'media.analyze': 128001 } });
	assert.deepStrictEqual(invalidTokens.token_defaults, { chat: 16384, 'media.analyze': 512 });
	const clearedToken = relaySettings.saveSettings({ token_defaults: { chat: '', 'media.analyze': '   ' } });
	assert.deepStrictEqual(clearedToken.token_defaults, { chat: '', 'media.analyze': '' });
	assert.deepStrictEqual(state.relay.token_defaults, {});

	const preserved = relaySettings.saveSettings({ defaults: { chat: 'model-relay:codex:auto' } });
	assert.strictEqual(preserved.cli_paths['antigravity-cli'], 'C:\\Tools\\agy.exe');

	const pathsOnly = relaySettings.saveSettings({ cli_paths: { 'antigravity-cli': 'C:\\Tools\\agy.exe', 'codex-cli': 'C:\\Tools\\codex.exe' } });
	assert.strictEqual(pathsOnly.defaults.chat, 'model-relay:codex:auto');
	assert.strictEqual(pathsOnly.cli_paths['codex-cli'], 'C:\\Tools\\codex.exe');
	state = { relay: { token_defaults: { chat: 32768, 'media.analyze': Number.NaN, unexpected: 9999 } } };
	assert.deepStrictEqual(relaySettings.settings().token_defaults, { chat: 32768, 'media.analyze': '' });
	assert.strictEqual(resolveMaxTokens('chat'), 32768);
	assert.strictEqual(resolveMaxTokens('media.analyze'), 4096);

	const previousXaiKey = process.env.XAI_API_KEY;
	const previousRelayXaiKey = process.env.AI_MODEL_RELAY_XAI_API_KEY;
	try {
		delete process.env.XAI_API_KEY;
		delete process.env.AI_MODEL_RELAY_XAI_API_KEY;
		state = {};
		assert.strictEqual(relaySettings.settings().defaults.videos, 'model-relay:openai-videos:sora-2');
		process.env.XAI_API_KEY = 'test-xai-key';
		state = {};
		assert.strictEqual(relaySettings.settings().defaults.videos, 'model-relay:xai:imagine-video');
	} finally {
		if (previousXaiKey === undefined) delete process.env.XAI_API_KEY;
		else process.env.XAI_API_KEY = previousXaiKey;
		if (previousRelayXaiKey === undefined) delete process.env.AI_MODEL_RELAY_XAI_API_KEY;
		else process.env.AI_MODEL_RELAY_XAI_API_KEY = previousRelayXaiKey;
	}

	console.log('relay settings tests passed');
} finally {
	security.readState = originalReadState;
	security.writeState = originalWriteState;
}
