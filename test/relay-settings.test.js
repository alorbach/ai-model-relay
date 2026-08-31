'use strict';

const assert = require('assert');
const security = require('../src/security');
const relaySettings = require('../src/relay-settings');

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

	const preserved = relaySettings.saveSettings({ defaults: { chat: 'model-relay:codex:auto' } });
	assert.strictEqual(preserved.cli_paths['antigravity-cli'], 'C:\\Tools\\agy.exe');

	const pathsOnly = relaySettings.saveSettings({ cli_paths: { 'antigravity-cli': 'C:\\Tools\\agy.exe', 'codex-cli': 'C:\\Tools\\codex.exe' } });
	assert.strictEqual(pathsOnly.defaults.chat, 'model-relay:codex:auto');
	assert.strictEqual(pathsOnly.cli_paths['codex-cli'], 'C:\\Tools\\codex.exe');

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
