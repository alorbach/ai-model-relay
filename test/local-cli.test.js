'use strict';

const assert = require('assert');
const { detectCli, safeDiagnostic } = require('../src/local-cli');

const definition = { id: 'grok-cli', label: 'Grok CLI', candidates: ['grok'], versionArgs: ['--version'], authArgs: ['models'], jobTypes: ['chat'], models: ['auto'] };

function lookup() { return { status: 0, stdout: 'C:\\Tools\\grok.exe\n' }; }

let calls = 0;
const ready = detectCli(definition, { lookup, spawnSync: () => (++calls === 1 ? { status: 0, stdout: 'grok 1.2.3' } : { status: 0, stdout: 'Available models: grok-build' }) });
assert.strictEqual(ready.installed, true);
assert.strictEqual(ready.ready, true);
assert.strictEqual(ready.version, 'grok 1.2.3');

calls = 0;
const unauthenticated = detectCli(definition, { lookup, spawnSync: () => (++calls === 1 ? { status: 0, stdout: 'grok 1.2.3' } : { status: 1, stderr: 'Not authenticated; token: secret-value' }) });
assert.strictEqual(unauthenticated.state, 'not_authenticated');
assert.strictEqual(unauthenticated.ready, false);
assert.ok(!JSON.stringify(unauthenticated).includes('secret-value'));

const absent = detectCli(definition, { lookup: () => ({ status: 1, stdout: '' }) });
assert.strictEqual(absent.installed, false);
assert.strictEqual(absent.state, 'unavailable');
assert.strictEqual(safeDiagnostic('Authorization: abc123'), 'Authorization: <redacted>');

console.log('local cli tests passed');
