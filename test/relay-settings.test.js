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

	console.log('relay settings tests passed');
} finally {
	security.readState = originalReadState;
	security.writeState = originalWriteState;
}
