'use strict';

process.env.ALORBACH_CODEX_BINARY = process.execPath;

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildChatArgs, codexChatModelUnsupported, codexImageFailureFromOutput, codexJsonUnsupported, codexOutputSchemaUnsupported, detectNewImage, imagePathsFromJsonEvents, listGeneratedImages, nativeCodexChatModel, parseCodexJsonEvents, readGeneratedImage, runCodexAsync } = require('../src/codex');

(async () => {
	const input = `start\n${'x'.repeat(128 * 1024)}\nend`;
	const script = [
		"let input = '';",
		"process.stdin.setEncoding('utf8');",
		"process.stdin.on('data', (chunk) => { input += chunk; });",
		"process.stdin.on('end', () => {",
		"  process.stdout.write(JSON.stringify({",
		"    argv: process.argv.slice(1),",
		"    inputLength: input.length,",
		"    startsWith: input.slice(0, 5),",
		"    endsWith: input.slice(-3)",
		"  }));",
		"});",
	].join('');

	const result = await runCodexAsync(['-e', script, 'exec', '--skip-git-repo-check', '-'], {
		input,
		timeout: 5000,
	});

	assert.strictEqual(result.status, 0);
	assert.ifError(result.error);
	const payload = JSON.parse(result.stdout);
	assert.deepStrictEqual(payload.argv.slice(-3), ['exec', '--skip-git-repo-check', '-']);
	assert.strictEqual(payload.inputLength, input.length);
	assert.strictEqual(payload.startsWith, 'start');
	assert.strictEqual(payload.endsWith, 'end');

	const oldOutputLimit = process.env.ALORBACH_CODEX_OUTPUT_MAX_CHARS;
	process.env.ALORBACH_CODEX_OUTPUT_MAX_CHARS = '2048';
	try {
		const noisyScript = [
			"process.stdout.write('start-' + 'x'.repeat(8192) + '-end');",
		].join('');
		const noisy = await runCodexAsync(['-e', noisyScript], { timeout: 5000 });
		assert.strictEqual(noisy.status, 0);
		assert.ifError(noisy.error);
		assert.ok(noisy.stdout.startsWith('start-'));
		assert.ok(noisy.stdout.endsWith('-end'));
		assert.ok(noisy.stdout.includes('[truncated'));
		assert.ok(noisy.stdout.length < 2300);
	} finally {
		if (oldOutputLimit === undefined) {
			delete process.env.ALORBACH_CODEX_OUTPUT_MAX_CHARS;
		} else {
			process.env.ALORBACH_CODEX_OUTPUT_MAX_CHARS = oldOutputLimit;
		}
	}

	const rateLimitFailure = codexImageFailureFromOutput('', 'Image generation failed due to rate limiting.', 'C:\\Users\\AL\\.codex\\generated_images');
	assert.strictEqual(rateLimitFailure.success, false);
	assert.strictEqual(rateLimitFailure.code, 'codex_rate_limited');
	assert.strictEqual(rateLimitFailure.category, 'rate_limit');
	assert.strictEqual(rateLimitFailure.retryable, true);
	assert.strictEqual(rateLimitFailure.message, 'Codex image generation was rate limited. Please wait and retry.');
	assert.strictEqual(rateLimitFailure.details.stderr, 'Image generation failed due to rate limiting.');
	assert.strictEqual(rateLimitFailure.details.generated_images_dir, 'C:\\Users\\AL\\.codex\\generated_images');

	const missingOutputFailure = codexImageFailureFromOutput('No image created.', '', '/tmp/generated_images');
	assert.strictEqual(missingOutputFailure.success, false);
	assert.strictEqual(missingOutputFailure.code, 'codex_no_image_output');
	assert.strictEqual(missingOutputFailure.category, 'output_detection');
	assert.strictEqual(missingOutputFailure.retryable, false);
	assert.strictEqual(missingOutputFailure.message, 'Codex CLI completed, but no new generated image file was detected.');
	assert.strictEqual(missingOutputFailure.details.stdout, 'No image created.');
	assert.strictEqual(missingOutputFailure.details.generated_images_dir, '/tmp/generated_images');

	const structured = parseCodexJsonEvents([
		JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }),
		JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'final answer' }, usage: { total_tokens: 123 } }),
		JSON.stringify({ type: 'turn.failed', error: { message: 'model failed' } }),
		'not json',
	].join('\n'));
	assert.strictEqual(structured.events.length, 3);
	assert.deepStrictEqual(structured.finalMessages, ['final answer']);
	assert.deepStrictEqual(structured.usage, { total_tokens: 123 });
	assert.ok(structured.errors.includes('model failed'));
	assert.deepStrictEqual(structured.invalidLines, ['not json']);

	assert.strictEqual(codexJsonUnsupported({ status: 2, stderr: "error: unexpected argument '--json'" }), true);
	assert.strictEqual(codexJsonUnsupported({ status: 1, stderr: 'model failed' }), false);
	assert.strictEqual(codexOutputSchemaUnsupported({ status: 2, stderr: "error: unexpected argument '--output-schema'" }), true);
	assert.strictEqual(codexOutputSchemaUnsupported({ status: 1, stderr: 'model failed' }), false);

	const imageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-image-detection-test-'));
	try {
		const existingPath = path.join(imageRoot, 'existing.png');
		fs.writeFileSync(existingPath, Buffer.from('existing image'));
		const before = listGeneratedImages(imageRoot);
		const expectedStartTime = Date.now();
		const stalePath = path.join(imageRoot, 'stale.png');
		fs.writeFileSync(stalePath, Buffer.from('stale image'));
		fs.utimesSync(stalePath, new Date(expectedStartTime - 1000), new Date(expectedStartTime - 1000));
		const namedPath = path.join(imageRoot, 'named.png');
		fs.writeFileSync(namedPath, Buffer.from('named image'));
		fs.utimesSync(namedPath, new Date(expectedStartTime + 1000), new Date(expectedStartTime + 1000));
		const newestPath = path.join(imageRoot, 'newest.png');
		fs.writeFileSync(newestPath, Buffer.from('newest image'));
		fs.utimesSync(newestPath, new Date(expectedStartTime + 2000), new Date(expectedStartTime + 2000));
		const after = listGeneratedImages(imageRoot);
		const structuredImageEvents = parseCodexJsonEvents(JSON.stringify({
			type: 'item.completed',
			item: { type: 'image_generation', output: { file_path: namedPath } },
		}));
		assert.deepStrictEqual(imagePathsFromJsonEvents(structuredImageEvents), [path.resolve(namedPath)]);
		const detected = detectNewImage(before, after, { startedAt: expectedStartTime, namedPaths: imagePathsFromJsonEvents(structuredImageEvents) });
		assert.strictEqual(detected[0].path, namedPath);
		assert.ok(!detected.some((item) => item.path === stalePath));
		assert.strictEqual(detectNewImage(before, after, { startedAt: Date.now() + 60000 }).length, 0);
		const oversizedPath = path.join(imageRoot, 'oversized.png');
		fs.writeFileSync(oversizedPath, Buffer.alloc(20 * 1024 * 1024 + 1));
		assert.ok(listGeneratedImages(imageRoot).some((item) => item.path === oversizedPath));
		assert.match(readGeneratedImage(imageRoot, oversizedPath).error, /20 MB size limit/i);
		const linkPath = path.join(imageRoot, 'linked.png');
		try {
			fs.symlinkSync(existingPath, linkPath, 'file');
			assert.strictEqual(listGeneratedImages(imageRoot).some((item) => item.path === linkPath), false);
			assert.match(readGeneratedImage(imageRoot, linkPath).error, /regular file|safely/i);
		} catch (error) {
			if (!['EPERM', 'EACCES', 'UNKNOWN'].includes(error && error.code)) throw error;
		}
	} finally {
		fs.rmSync(imageRoot, { recursive: true, force: true });
	}

	const chatArgs = buildChatArgs('C:\\temp\\chat', 'C:\\temp\\chat\\last-message.txt', 'auto', [], {
		sandboxReadOnly: true,
		outputSchemaPath: 'C:\\temp\\media\\media-analysis.schema.json',
	});
	assert.ok(chatArgs.includes('--sandbox'));
	assert.deepStrictEqual(chatArgs.slice(chatArgs.indexOf('--sandbox'), chatArgs.indexOf('--sandbox') + 2), ['--sandbox', 'read-only']);
	assert.deepStrictEqual(chatArgs.slice(chatArgs.indexOf('--output-schema'), chatArgs.indexOf('--output-schema') + 2), ['--output-schema', 'C:\\temp\\media\\media-analysis.schema.json']);
	assert.ok(!buildChatArgs('C:\\temp\\chat', 'C:\\temp\\chat\\last-message.txt', 'auto', [], { sandboxReadOnly: false }).includes('--sandbox'));

	assert.strictEqual(nativeCodexChatModel('model-relay:codex:auto'), 'auto');
	assert.strictEqual(nativeCodexChatModel('model-relay:codex:gpt-5.6-terra'), 'gpt-5.6-terra');
	assert.strictEqual(nativeCodexChatModel('codex-local:auto'), 'auto');
	assert.strictEqual(nativeCodexChatModel('codex-local:gpt-5'), 'gpt-5');
	assert.ok(!buildChatArgs('C:\\temp\\chat', 'C:\\temp\\chat\\last-message.txt', nativeCodexChatModel('model-relay:codex:auto'), []).includes('--model'));
	assert.deepStrictEqual(buildChatArgs('C:\\temp\\chat', 'C:\\temp\\chat\\last-message.txt', nativeCodexChatModel('model-relay:codex:gpt-5'), []).slice(-3), ['--model', 'gpt-5', '-']);
	const chatgptModelFailure = parseCodexJsonEvents([
		JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'error', message: 'Model metadata for `model-relay:codex:auto` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.' } }),
		JSON.stringify({ type: 'error', message: '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'model-relay:codex:auto\' model is not supported when using Codex with a ChatGPT account."}}' }),
		JSON.stringify({ type: 'turn.failed', error: { message: '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'model-relay:codex:auto\' model is not supported when using Codex with a ChatGPT account."}}' } }),
	].join('\n'));
	assert.strictEqual(codexChatModelUnsupported({ status: 1, stdout: '', stderr: '', structured: chatgptModelFailure }), true);
	assert.strictEqual(codexChatModelUnsupported({ status: 1, stderr: 'model failed' }), false);

	console.log('codex runner tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
