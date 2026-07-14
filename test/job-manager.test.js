'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JobManager, collectSessionOutput, normalizeDiagnosticText, truncateOutput } = require('../src/job-manager');

function tick() {
	return new Promise((resolve) => setImmediate(resolve));
}

function deferredRunner(label, started, resolvers, result = { success: true }) {
	return () => new Promise((resolve) => {
		started.push(label);
		resolvers[label] = () => resolve({ ...result, label });
	});
}

(async () => {
	{
		const started = [];
		const resolvers = {};
		const manager = new JobManager({ maxConcurrent: 2 });
		const first = manager.run({ requestId: 'request-1', type: 'chat', model: 'codex-local:auto' }, deferredRunner('first', started, resolvers));
		const second = manager.run({ requestId: 'request-2', type: 'chat', model: 'codex-local:auto' }, deferredRunner('second', started, resolvers));
		const third = manager.run({ requestId: 'request-3', type: 'chat', model: 'codex-local:auto' }, deferredRunner('third', started, resolvers));
		await tick();
		assert.deepStrictEqual(started, ['first', 'second']);
		assert.strictEqual(manager.snapshot().running_count, 2);
		assert.strictEqual(manager.snapshot().queued_count, 1);

		resolvers.second();
		assert.strictEqual((await second).label, 'second');
		await tick();
		assert.deepStrictEqual(started, ['first', 'second', 'third']);

		resolvers.first();
		resolvers.third();
		await Promise.all([first, third]);
		assert.strictEqual(manager.snapshot().running_count, 0);
		assert.strictEqual(manager.snapshot().queued_count, 0);
	}

	{
		const manager = new JobManager({ maxConcurrent: 1 });
		let finishLive;
		const live = manager.run({ requestId: 'request-live', type: 'chat', provider: 'codex-cli', providerLabel: 'Codex CLI', workflow: 'chat' }, (session) => new Promise((resolve) => {
			session.appendSessionInput('stdin', 'Use token: hidden-value to answer.');
			session.appendSessionOutput('stdout', "I'm using the image-generation workflow\nC:\\Users\\al\\.codex\\skills\\.system\\imagegen\\SKILL.md");
			finishLive = () => resolve({ success: true });
		}));
		await tick();
		assert.strictEqual(manager.snapshot().active[0].provider, 'codex-cli');
		assert.strictEqual(manager.snapshot().active[0].provider_label, 'Codex CLI');
		assert.strictEqual(manager.snapshot().active[0].workflow, 'image-generation');
		assert.deepStrictEqual(manager.snapshot().active[0].skills, ['imagegen']);
		assert.strictEqual(manager.snapshot().active[0].session_input, 'STDIN:\nUse token: <redacted> to answer.');
		finishLive();
		await live;
		assert.strictEqual(manager.snapshot().recent[0].status, 'completed');
		assert.strictEqual(manager.snapshot().recent[0].workflow, 'image-generation');
		assert.deepStrictEqual(manager.snapshot().recent[0].skills, ['imagegen']);

		const failed = await manager.run({ requestId: 'request-fail', type: 'chat' }, () => ({ success: false, message: 'failed', details: { stderr: 'session stderr' } }));
		assert.strictEqual(failed.success, false);
		assert.strictEqual(manager.snapshot().recent[0].status, 'failed');
		assert.strictEqual(manager.snapshot().recent[0].session_output, 'STDERR:\nsession stderr');
		const next = await manager.run({ requestId: 'request-next', type: 'chat' }, () => ({ success: true }));
		assert.strictEqual(next.success, true);
	}

	{
		const debugDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-manager-debug-'));
		fs.writeFileSync(path.join(debugDir, 'prompt.txt'), 'full prompt');
		fs.writeFileSync(path.join(debugDir, 'output.txt'), 'full ai response');
		const manager = new JobManager({ maxConcurrent: 1 });
		const result = await manager.run({ requestId: 'request-debug', type: 'chat' }, () => ({
			success: true,
			response: {
				provider_details: {
					debug_log_dir: debugDir,
				},
			},
		}));
		assert.strictEqual(result.success, true);
		assert.strictEqual(manager.snapshot().recent[0].debug_logs[0].prompt, 'full prompt');
		assert.strictEqual(manager.snapshot().recent[0].debug_logs[0].output, 'full ai response');
		fs.rmSync(debugDir, { recursive: true, force: true });
	}

	{
		const manager = new JobManager({ maxConcurrent: 1 });
		await manager.run({ requestId: 'request-image', type: 'images' }, () => ({
			success: true,
			response: { data: [{ b64_json: Buffer.from('generated image bytes').toString('base64'), mime_type: 'image/png' }] },
		}));
		const artifact = manager.snapshot().recent[0].artifacts[0];
		assert.strictEqual(artifact.mime_type, 'image/png');
		assert.strictEqual(artifact.url, '/v1/status/jobs/1/artifacts/0');
		assert.strictEqual(manager.artifact(1, 0).bytes.toString(), 'generated image bytes');
		assert.strictEqual(manager.artifact(1, 1), null);
	}

	{
		const manager = new JobManager({ maxConcurrent: 1 });
		await manager.run({ requestId: 'request-video', type: 'videos' }, () => ({
			success: true,
			response: { b64_video: Buffer.from('generated video bytes').toString('base64'), mime_type: 'video/mp4' },
		}));
		const artifact = manager.snapshot().recent[0].artifacts[0];
		assert.strictEqual(artifact.mime_type, 'video/mp4');
		assert.strictEqual(artifact.url, '/v1/status/jobs/1/artifacts/0');
		assert.strictEqual(manager.artifact(1, 0).bytes.toString(), 'generated video bytes');
	}

	{
		const started = [];
		const resolvers = {};
		const manager = new JobManager({ maxConcurrent: 2 });
		const chatOne = manager.run({ requestId: 'chat-1', type: 'chat' }, deferredRunner('chat-one', started, resolvers));
		const image = manager.run({ requestId: 'image-1', type: 'images' }, deferredRunner('image', started, resolvers));
		const chatTwo = manager.run({ requestId: 'chat-2', type: 'chat' }, deferredRunner('chat-two', started, resolvers));
		await tick();
		assert.deepStrictEqual(started, ['chat-one', 'image']);
		assert.strictEqual(manager.snapshot().queued_count, 1);

		resolvers['chat-one']();
		await chatOne;
		await tick();
		assert.deepStrictEqual(started, ['chat-one', 'image', 'chat-two']);
		assert.strictEqual(manager.snapshot().running_count, 2);
		resolvers['chat-two']();
		resolvers.image();
		await Promise.all([image, chatTwo]);
		assert.strictEqual(manager.snapshot().running_count, 0);
	}

	{
		const started = [];
		const resolvers = {};
		const manager = new JobManager({ maxConcurrent: 2 });
		const imageOne = manager.run({ requestId: 'image-1', type: 'images' }, deferredRunner('image-one', started, resolvers));
		const imageTwo = manager.run({ requestId: 'image-2', type: 'images' }, deferredRunner('image-two', started, resolvers));
		await tick();
		assert.deepStrictEqual(started, ['image-one']);
		assert.strictEqual(manager.snapshot().running_count, 1);
		assert.strictEqual(manager.snapshot().queued_count, 1);

		resolvers['image-one']();
		await imageOne;
		await tick();
		assert.deepStrictEqual(started, ['image-one', 'image-two']);
		resolvers['image-two']();
		await imageTwo;
		assert.strictEqual(manager.snapshot().running_count, 0);
	}

	assert.ok(collectSessionOutput({ details: { stdout: 'out', stderr: 'err', response_text: 'last' } }).includes('STDOUT:\nout'));
	assert.ok(collectSessionOutput({ details: { stdout: 'out', stderr: 'err', response_text: 'last' } }).includes('STDERR:\nerr'));
	assert.ok(collectSessionOutput({ details: { stdout: 'out', stderr: 'err', response_text: 'last' } }).includes('RESPONSE_TEXT:\nlast'));
	assert.strictEqual(normalizeDiagnosticText('I\u00e2\u0080\u0099m ready \u00e2\u0080\u0094 wait\u00e2\u0080\u00a6'), "I'm ready - wait...");
	assert.strictEqual(collectSessionOutput({ details: { stderr: 'I\u00e2\u0080\u0099m ready' } }), "STDERR:\nI'm ready");
	assert.ok(truncateOutput('x'.repeat(13000)).includes('[truncated'));

	console.log('job manager tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
