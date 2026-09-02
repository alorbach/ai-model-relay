'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { detectCli, detectCliAsync, expandWindowsEnvironmentVariables, materializeChatImages, parseCliModelList, safeDiagnostic, writePromptFile } = require('../src/local-cli');

const definition = { id: 'grok-cli', label: 'Grok CLI', candidates: ['grok'], versionArgs: ['--version'], authArgs: ['models'], jobTypes: ['chat'], models: ['auto'] };

function lookup() { return { status: 0, stdout: 'C:\\Tools\\grok.exe\n' }; }

let calls = 0;
const ready = detectCli(definition, { lookup, spawnSync: () => (++calls === 1 ? { status: 0, stdout: 'grok 1.2.3' } : { status: 0, stdout: 'Available models: grok-build' }) });
assert.strictEqual(ready.installed, true);
assert.strictEqual(ready.ready, true);
assert.strictEqual(ready.version, 'grok 1.2.3');
assert.deepStrictEqual(ready.models, ['auto', 'grok-build']);

assert.deepStrictEqual(parseCliModelList('Available models:\n- grok-4.6 (default)\n- grok-4.5\n'), ['auto', 'grok-4.6', 'grok-4.5']);
assert.deepStrictEqual(parseCliModelList(JSON.stringify({ models: [{ id: 'cursor-gpt-5' }, { model: 'claude-4' }] })), ['auto', 'cursor-gpt-5', 'claude-4']);
assert.deepStrictEqual(parseCliModelList('not a model list'), ['auto']);
assert.strictEqual(parseCliModelList(Array.from({ length: 80 }, (_, index) => `model-${index}`)).length, 50);

let cursorProbeCalls = 0;
const cursorModels = detectCli({ id: 'cursor-cli', label: 'Cursor Agent', candidates: ['cursor-agent'], versionArgs: ['--version'], authArgs: ['status'], modelListArgs: [['models'], ['--list-models']], jobTypes: ['chat'], models: ['auto'] }, {
	lookup,
	spawnSync: (command, args) => {
		cursorProbeCalls += 1;
		if (cursorProbeCalls === 1) return { status: 0, stdout: 'cursor-agent 1.0.0' };
		if (cursorProbeCalls === 2) return { status: 0, stdout: 'Logged in' };
		if (cursorProbeCalls === 3) return { status: 1, stderr: 'unknown command' };
		assert.deepStrictEqual(args, ['--list-models']);
		return { status: 0, stdout: 'gpt-5\nclaude-4-sonnet\n' };
	},
});
assert.deepStrictEqual(cursorModels.models, ['auto', 'gpt-5', 'claude-4-sonnet']);

let oversizedProbeKilled = false;
const oversizedProbeCheck = detectCliAsync({ id: 'bounded-cli', label: 'Bounded CLI', command: 'bounded-cli', versionArgs: ['--version'], authArgs: ['models'], models: ['auto'] }, {
	spawn: () => {
		const child = new EventEmitter();
		child.stdout = new PassThrough();
		child.stderr = new PassThrough();
		child.kill = () => {
			oversizedProbeKilled = true;
			child.stdout.end();
			child.stderr.end();
			child.emit('close', 1);
		};
		process.nextTick(() => child.stdout.write('x'.repeat(300 * 1024)));
		return child;
	},
}).then((oversizedProbe) => {
	assert.strictEqual(oversizedProbeKilled, true);
	assert.strictEqual(oversizedProbe.state, 'unavailable');
});

let syncModelProbeOptions = null;
const syncBoundedModels = detectCli({ id: 'sync-bounded-cli', label: 'Sync Bounded CLI', command: 'sync-bounded-cli', versionArgs: ['--version'], authArgs: ['status'], modelListArgs: ['models'], models: ['auto'] }, {
	spawnSync: (command, args, options) => {
		if (args[0] === 'models') {
			syncModelProbeOptions = options;
			return { error: new Error('spawnSync maxBuffer exceeded'), status: null, stdout: '', stderr: '' };
		}
		return { status: 0, stdout: args[0] === '--version' ? 'sync-bounded 1.0.0' : 'Logged in' };
	},
});
assert.deepStrictEqual(syncBoundedModels.models, ['auto']);
assert.ok(syncModelProbeOptions && syncModelProbeOptions.maxBuffer <= 256 * 1024);

calls = 0;
const unauthenticated = detectCli(definition, { lookup, spawnSync: () => (++calls === 1 ? { status: 0, stdout: 'grok 1.2.3' } : { status: 1, stderr: 'Not authenticated; token: secret-value' }) });
assert.strictEqual(unauthenticated.state, 'not_authenticated');
assert.strictEqual(unauthenticated.ready, false);
assert.ok(!JSON.stringify(unauthenticated).includes('secret-value'));

const absent = detectCli(definition, { lookup: () => ({ status: 1, stdout: '' }) });
assert.strictEqual(absent.installed, false);
assert.strictEqual(absent.state, 'unavailable');
assert.strictEqual(safeDiagnostic('Authorization: abc123'), 'Authorization: <redacted>');
assert.strictEqual(safeDiagnostic('Authorization: Bearer sk-abc123'), 'Authorization: <redacted>');
assert.ok(!safeDiagnostic('Authorization: Bearer sk-abc123').includes('sk-abc123'));
assert.strictEqual(expandWindowsEnvironmentVariables('%LOCALAPPDATA%\\agy\\bin\\agy.exe', { LocalAppData: 'C:\\Users\\AL\\AppData\\Local' }), 'C:\\Users\\AL\\AppData\\Local\\agy\\bin\\agy.exe');
assert.strictEqual(expandWindowsEnvironmentVariables('%UNKNOWN_VALUE%\\agy.exe', {}), '%UNKNOWN_VALUE%\\agy.exe');

const promptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-local-cli-test-'));
try {
	const promptPath = writePromptFile(promptDir, 'prompt with unicode: äöü');
	assert.strictEqual(path.basename(promptPath), 'prompt.txt');
	assert.strictEqual(fs.readFileSync(promptPath, 'utf8'), 'prompt with unicode: äöü');
} finally {
	fs.rmSync(promptDir, { recursive: true, force: true });
}

const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-local-cli-images-'));
try {
	const imageWorkspace = path.join(imageDir, 'workspace');
	fs.mkdirSync(imageWorkspace);
	const oversizedPath = path.join(imageDir, 'oversized.png');
	fs.writeFileSync(oversizedPath, Buffer.alloc(20 * 1024 * 1024 + 1));
	const oversizedImage = materializeChatImages({ messages: [{ role: 'user', content: [{ type: 'input_image', image_url: oversizedPath }] }] }, imageWorkspace);
	assert.match(oversizedImage.error, /non-empty PNG, JPEG, or WebP data URLs|existing PNG, JPEG, or WebP file/i);
	const oversizedDataImage = materializeChatImages({ messages: [{ role: 'user', content: [{ type: 'input_image', image_url: `data:image/png;base64,${'A'.repeat(28 * 1024 * 1024)}` }] }] }, imageWorkspace);
	assert.match(oversizedDataImage.error, /non-empty PNG, JPEG, or WebP data URLs/i);
	const mismatchedPath = path.join(imageDir, 'mismatched.jpg');
	fs.writeFileSync(mismatchedPath, Buffer.from('not an image'));
	const mismatchedImage = materializeChatImages({ messages: [{ role: 'user', content: [{ type: 'input_image', image_url: mismatchedPath, mime_type: 'image/png' }] }] }, imageWorkspace);
	assert.match(mismatchedImage.error, /existing PNG, JPEG, or WebP file/i);
	const remoteImage = materializeChatImages({ messages: [{ role: 'user', content: [{ type: 'input_image', image_url: 'https://example.invalid/image.png' }] }] }, imageWorkspace);
	assert.match(remoteImage.error, /URLs are not downloaded/i);
} finally {
	fs.rmSync(imageDir, { recursive: true, force: true });
}

oversizedProbeCheck.then(() => console.log('local cli tests passed'), (error) => {
	console.error(error);
	process.exitCode = 1;
});
