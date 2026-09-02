'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JobManager, collectSessionOutput, normalizeDiagnosticText, publicJobsSnapshot, redactSessionInput, truncateOutput } = require('../src/job-manager');

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
		const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
		await manager.run({ requestId: 'request-image', type: 'images' }, () => ({
			success: true,
			response: { data: [{ b64_json: tinyPng.toString('base64'), mime_type: 'image/png' }] },
		}));
		const artifact = manager.snapshot().recent[0].artifacts[0];
		assert.strictEqual(artifact.mime_type, 'image/png');
		assert.strictEqual(artifact.width, 1);
		assert.strictEqual(artifact.height, 1);
		assert.strictEqual(artifact.url, '/v1/status/jobs/1/artifacts/0');
		assert.strictEqual(manager.artifact(1, 0).bytes.toString('base64'), tinyPng.toString('base64'));
		assert.strictEqual(manager.artifact(1, 1), null);
		assert.strictEqual(manager.artifactByRequestId('request-image').bytes.toString('base64'), tinyPng.toString('base64'));
		assert.strictEqual(manager.artifactByRequestId('missing'), null);
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
		const first = manager.run({ requestId: 'upscale-1', type: 'upscale', model: 'model-relay:local-upscale:swinir-classical-x2', provider: 'local-upscale' }, deferredRunner('upscale-one', started, resolvers));
		const second = manager.run({ requestId: 'upscale-2', type: 'upscale', model: 'model-relay:local-upscale:realesrgan-x2plus', provider: 'local-upscale' }, deferredRunner('upscale-two', started, resolvers));
		await tick();
		assert.deepStrictEqual(started, ['upscale-one']);
		assert.strictEqual(manager.snapshot().queued_count, 1);
		resolvers['upscale-one']();
		await first;
		await tick();
		assert.deepStrictEqual(started, ['upscale-one', 'upscale-two']);
		resolvers['upscale-two']();
		await second;
	}

	{
		const manager = new JobManager({ maxConcurrent: 1 });
		let aborted = false;
		const running = manager.run({ requestId: 'upscale-cancel', type: 'upscale', provider: 'local-upscale' }, (session) => new Promise((resolve) => {
			session.signal.addEventListener('abort', () => { aborted = true; resolve({ success: false, category: 'cancelled', code: 'local_upscale_cancelled', message: 'cancelled' }); }, { once: true });
		}));
		await tick();
		assert.strictEqual(manager.cancelByRequestId('upscale-cancel'), true);
		const cancelled = await running;
		assert.strictEqual(cancelled.code, 'local_upscale_cancelled');
		assert.strictEqual(aborted, true);
		assert.strictEqual(manager.snapshot().recent[0].status, 'cancelled');
	}

	{
		const manager = new JobManager({ maxConcurrent: 1 });
		const running = manager.run({ requestId: 'late-success', type: 'upscale', provider: 'local-upscale' }, (session) => new Promise((resolve) => {
			session.signal.addEventListener('abort', () => resolve({ success: true, response: { output: { checksum: 'x' } } }), { once: true });
		}));
		await tick();
		assert.strictEqual(manager.cancelByRequestId('late-success'), true);
		const cancelled = await running;
		assert.strictEqual(cancelled.success, false);
		assert.strictEqual(cancelled.category, 'cancelled');
		assert.strictEqual(manager.snapshot().recent[0].status, 'cancelled');
	}

	{
		const started = [];
		const resolvers = {};
		const manager = new JobManager({ maxConcurrent: 1 });
		const running = manager.run({ requestId: 'chat-keep', type: 'chat', provider: 'codex-cli' }, deferredRunner('chat-keep', started, resolvers));
		await tick();
		assert.strictEqual(manager.cancelByRequestId('chat-keep', 'upscale'), false);
		assert.strictEqual(manager.snapshot().running_count, 1);
		resolvers['chat-keep']();
		await running;
	}

	{
		const manager = new JobManager({ maxConcurrent: 1 });
		await manager.run({ requestId: 'owned-artifact', type: 'upscale', origin: 'http://site-a', provider: 'local-upscale' }, () => Promise.resolve({ success: true, artifact: { mime_type: 'image/png', bytes: Buffer.from('owned-png') } }));
		assert.strictEqual(manager.artifactByRequestId('owned-artifact', 'http://site-a').bytes.toString(), 'owned-png');
		assert.strictEqual(manager.artifactByRequestId('owned-artifact', 'http://site-b'), null);
		assert.ok(!JSON.stringify(manager.snapshot()).includes('http://site-a'));
	}

	{
		const manager = new JobManager({ maxConcurrent: 1 });
		const running = manager.run({ requestId: 'owned-cancel', type: 'upscale', origin: 'http://site-a', provider: 'local-upscale' }, (session) => new Promise((resolve) => {
			session.signal.addEventListener('abort', () => resolve({ success: false, category: 'cancelled' }), { once: true });
		}));
		await tick();
		assert.strictEqual(manager.cancelByRequestId('owned-cancel', 'upscale', 'http://site-b'), false);
		assert.strictEqual(manager.cancelByRequestId('owned-cancel', 'upscale', 'http://site-a'), true);
		await running;
	}

	{
		const started = [];
		const resolvers = {};
		const manager = new JobManager({ maxConcurrent: 2 });
		const imageOne = manager.run({ requestId: 'image-1', type: 'images', model: 'model-relay:codex:image', provider: 'codex-cli' }, deferredRunner('image-one', started, resolvers));
		const imageTwo = manager.run({ requestId: 'image-2', type: 'images', model: 'model-relay:codex:image', provider: 'codex-cli' }, deferredRunner('image-two', started, resolvers));
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

	{
		const started = [];
		const resolvers = {};
		const manager = new JobManager({ maxConcurrent: 2 });
		const codexImage = manager.run({ requestId: 'image-codex', type: 'images', model: 'model-relay:codex:image', provider: 'codex-cli' }, deferredRunner('image-codex', started, resolvers));
		const antigravityImage = manager.run({ requestId: 'image-antigravity', type: 'images', model: 'model-relay:antigravity-cli:image', provider: 'antigravity-cli' }, deferredRunner('image-antigravity', started, resolvers));
		await tick();
		assert.deepStrictEqual(started, ['image-codex', 'image-antigravity']);
		assert.strictEqual(manager.snapshot().running_count, 2);
		assert.strictEqual(manager.snapshot().queued_count, 0);
		resolvers['image-codex']();
		resolvers['image-antigravity']();
		await Promise.all([codexImage, antigravityImage]);
		assert.strictEqual(manager.snapshot().running_count, 0);
	}

	assert.ok(collectSessionOutput({ details: { stdout: 'out', stderr: 'err', response_text: 'last' } }).includes('STDOUT:\nout'));
	assert.ok(collectSessionOutput({ details: { stdout: 'out', stderr: 'err', response_text: 'last' } }).includes('STDERR:\nerr'));
	assert.ok(collectSessionOutput({ details: { stdout: 'out', stderr: 'err', response_text: 'last' } }).includes('RESPONSE_TEXT:\nlast'));
	assert.strictEqual(normalizeDiagnosticText('I\u00e2\u0080\u0099m ready \u00e2\u0080\u0094 wait\u00e2\u0080\u00a6'), "I'm ready - wait...");
	assert.strictEqual(collectSessionOutput({ details: { stderr: 'I\u00e2\u0080\u0099m ready' } }), "STDERR:\nI'm ready");
	assert.ok(truncateOutput('x'.repeat(13000)).includes('[truncated'));
	assert.strictEqual(redactSessionInput('Authorization: Bearer sk-abc123'), 'Authorization: <redacted>');
	assert.strictEqual(redactSessionInput('Authorization: Bearer sk-abc123 leftover'), 'Authorization: <redacted> leftover');
	assert.ok(!redactSessionInput('Authorization: Bearer sk-abc123').includes('sk-abc123'));
	const publicJobs = publicJobsSnapshot({
		running_count: 1,
		recent: [{ request_id: 'job-1', session_input: 'STDIN:\nsecret', session_output: 'STDOUT:\nout', debug_logs: [{ prompt: 'full prompt' }], artifacts: [{ url: '/v1/status/jobs/1/artifacts/0' }] }],
	});
	assert.strictEqual(publicJobs.recent[0].request_id, 'job-1');
	assert.ok(!Object.prototype.hasOwnProperty.call(publicJobs.recent[0], 'session_input'));
	assert.ok(!Object.prototype.hasOwnProperty.call(publicJobs.recent[0], 'session_output'));
	assert.ok(!Object.prototype.hasOwnProperty.call(publicJobs.recent[0], 'debug_logs'));
	assert.ok(!Object.prototype.hasOwnProperty.call(publicJobs.recent[0], 'artifacts'));

	console.log('job manager tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
