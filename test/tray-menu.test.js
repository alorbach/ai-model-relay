'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildTrayMenuTemplate, buildJobMenuItems, formatElapsed, shortPath, shortText } = require('../src/tray-menu');

function flatten(template) {
	return template.map((item) => (item.type === 'separator' ? '---' : item.label));
}

const model = {
	displayVersion: '1.0.12 (26)',
	bridgeState: 'Running',
	bridgeUrl: 'http://127.0.0.1:8765',
	codexStatus: { success: true, message: 'Local Codex CLI is installed and logged in.', details: { codex_binary: 'C:\\Tools\\codex.exe', codex_home: 'C:\\Users\\demo\\.codex', version: 'codex-cli 0.0.0' } },
	jobState: { running_count: 0, queued_count: 0, active: [], queued: [] },
	pairingCode: '000000',
	pairingCodePersistent: false,
	pairedOrigins: ['https://example.com', 'https://shop.example.org'],
	launchOnLogin: true,
};

// The order and labels of the main menu. scripts/capture-screenshots.js renders this same template as docs/images/tray-menu.png.
assert.deepStrictEqual(flatten(buildTrayMenuTemplate(model, {})), [
	'AI Model Relay 1.0.12 (26)',
	'formerly Codex Local Bridge',
	'Bridge: Running',
	'URL: http://127.0.0.1:8765',
	'Codex: Ready',
	'Local Codex CLI is installed and logged in.',
	'Jobs: Running 0 / Queued 0',
	'---',
	'Pairing code: 000000',
	'Copy pairing code',
	'Copy bridge URL',
	'Copy diagnostics',
	'Refresh Codex status',
	'Open status page',
	'Open status JSON',
	'Open relay data folder',
	'Launch on login',
	'---',
	'Codex details',
	'Open Codex login help',
	'---',
	'Paired WordPress sites (2)',
	'---',
	'Restart bridge',
	'---',
	'Quit',
]);

const template = buildTrayMenuTemplate(model, {});
const byLabel = (label) => template.find((item) => item.label === label);
assert.strictEqual(byLabel('Launch on login').type, 'checkbox');
assert.strictEqual(byLabel('Launch on login').checked, true);
assert.strictEqual(byLabel('Open status page').enabled, true);
assert.strictEqual(byLabel('Copy pairing code').enabled, true);
assert.ok(Array.isArray(byLabel('Codex details').submenu));
assert.deepStrictEqual(flatten(byLabel('Codex details').submenu), ['Binary: C:\\Tools\\codex.exe', 'Home: C:\\Users\\demo\\.codex', 'Version: codex-cli 0.0.0', 'Copy Codex binary path']);
assert.deepStrictEqual(flatten(byLabel('Paired WordPress sites (2)').submenu), ['https://example.com', 'Unpair this site', '---', 'https://shop.example.org', 'Unpair this site']);

// Not-ready states: stopped bridge, failed Codex check, fixed code that is not known yet, no paired sites.
const degraded = buildTrayMenuTemplate({ ...model, bridgeState: 'Stopped', codexStatus: { success: false }, pairingCode: '', pairingCodePersistent: true, pairedOrigins: [], launchOnLogin: false }, {});
const degradedByLabel = (label) => degraded.find((item) => item.label === label);
assert.strictEqual(degradedByLabel('Bridge: Stopped').enabled, false);
assert.strictEqual(degradedByLabel('Codex: Needs attention').enabled, false);
assert.ok(degradedByLabel('Status unavailable'));
assert.ok(degradedByLabel('Pairing code (fixed): starting'));
assert.strictEqual(degradedByLabel('Copy pairing code').enabled, false);
assert.strictEqual(degradedByLabel('Open status page').enabled, false);
assert.strictEqual(degradedByLabel('Open status JSON').enabled, false);
assert.strictEqual(degradedByLabel('Launch on login').checked, false);
assert.deepStrictEqual(degradedByLabel('Paired WordPress sites (0)').submenu, [{ label: 'No paired WordPress sites', enabled: false }]);
assert.deepStrictEqual(flatten(degradedByLabel('Codex details').submenu).slice(0, 3), ['Binary: not found', 'Home: ', 'Version: unknown']);
assert.strictEqual(degradedByLabel('Codex details').submenu[3].enabled, false);

// Job lines.
const jobs = buildJobMenuItems({
	running_count: 1,
	queued_count: 2,
	active: [{ short_request_id: 'req_a', type: 'chat', model: 'model-relay:codex-cli:gpt-5.5', elapsed_ms: 65000 }],
	queued: [{ request_id: 'req_b', type: 'images', model: '' }, { id: 'req_c', type: 'chat', model: 'm' }],
});
assert.deepStrictEqual(jobs.map((item) => item.label), [
	'Jobs: Running 1 / Queued 2',
	'Running: req_a: chat model-relay:codex-cli:gpt... (1m 5s)',
	'Queued: req_b: images',
	'Queued: req_c: chat m',
]);
assert.ok(jobs.every((item) => item.enabled === false));
assert.strictEqual(buildJobMenuItems(undefined)[0].label, 'Jobs: Running 0 / Queued 0');

// Clicks are routed to the supplied actions; missing actions are harmless no-ops.
const calls = [];
const actions = {
	copyText: (text) => calls.push(['copyText', text]),
	copyDiagnostics: () => calls.push(['copyDiagnostics']),
	refreshCodexStatus: () => calls.push(['refreshCodexStatus']),
	openStatusPage: () => calls.push(['openStatusPage']),
	openStatusJson: () => calls.push(['openStatusJson']),
	openDataFolder: () => calls.push(['openDataFolder']),
	setLaunchOnLogin: (checked) => calls.push(['setLaunchOnLogin', checked]),
	openCodexLoginHelp: () => calls.push(['openCodexLoginHelp']),
	unpairSite: (origin) => calls.push(['unpairSite', origin]),
	restartBridge: () => calls.push(['restartBridge']),
	quit: () => calls.push(['quit']),
};
const wired = buildTrayMenuTemplate(model, actions);
const wiredByLabel = (label) => wired.find((item) => item.label === label);
wiredByLabel('Copy pairing code').click();
wiredByLabel('Copy bridge URL').click();
wiredByLabel('Copy diagnostics').click();
wiredByLabel('Refresh Codex status').click();
wiredByLabel('Open status page').click();
wiredByLabel('Open status JSON').click();
wiredByLabel('Open relay data folder').click();
wiredByLabel('Launch on login').click({ checked: false });
wiredByLabel('Open Codex login help').click();
wiredByLabel('Codex details').submenu[3].click();
wiredByLabel('Paired WordPress sites (2)').submenu[0].click();
wiredByLabel('Paired WordPress sites (2)').submenu[1].click();
wiredByLabel('Restart bridge').click();
wiredByLabel('Quit').click();
assert.deepStrictEqual(calls, [
	['copyText', '000000'],
	['copyText', 'http://127.0.0.1:8765'],
	['copyDiagnostics'],
	['refreshCodexStatus'],
	['openStatusPage'],
	['openStatusJson'],
	['openDataFolder'],
	['setLaunchOnLogin', false],
	['openCodexLoginHelp'],
	['copyText', 'C:\\Tools\\codex.exe'],
	['copyText', 'https://example.com'],
	['unpairSite', 'https://example.com'],
	['restartBridge'],
	['quit'],
]);
assert.doesNotThrow(() => { for (const item of template) if (typeof item.click === 'function') item.click({ checked: true }); });

// Helpers kept from main.js.
assert.strictEqual(formatElapsed(0), '0s');
assert.strictEqual(formatElapsed(125000), '2m 5s');
assert.strictEqual(shortText('x'.repeat(50), 10), 'xxxxxxx...');
assert.strictEqual(shortPath('a'.repeat(60)).length, 52);

// src/main.js builds its menu from this template and no longer carries its own copy of the labels.
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
assert.ok(mainSource.includes("require('./tray-menu')") && mainSource.includes('buildTrayMenuTemplate('), 'main.js must use the shared tray menu template');
assert.ok(!mainSource.includes("'Copy pairing code'") && !mainSource.includes("'Open relay data folder'"), 'main.js must not duplicate tray menu labels');

console.log('tray menu tests passed');
