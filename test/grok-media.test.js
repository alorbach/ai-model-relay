'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createGrokCliDriver, GROK_MEDIA_TIMEOUT_MS } = require('../src/backend-registry');

function toolForArgs(args) {
	const prompt = args[args.indexOf('--single') + 1] || '';
	const match = /Call the (\w+) tool exactly once/.exec(prompt);
	return match ? match[1] : '';
}

function createFakeGrok(options = {}) {
	const calls = [];
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-media-test-'));
	const sessionsRoot = path.join(root, 'sessions');
	const spawn = (command, args) => {
		const child = new EventEmitter();
		child.stdout = new EventEmitter();
		child.stderr = new EventEmitter();
		child.stdin = { end: () => {} };
		child.kill = () => child.emit('close', 1);
		calls.push(args);
		process.nextTick(() => {
			if (args.includes('--version')) {
				child.stdout.emit('data', 'grok test'); child.emit('close', 0); return;
			}
			if (args[0] === 'models') {
				child.stdout.emit('data', 'model'); child.emit('close', 0); return;
			}
			const prompt = args[args.indexOf('--single') + 1];
			const tool = /Call the (\w+) tool exactly once/.exec(prompt)[1];
			if (options.unsupportedTool === tool) {
				child.stderr.emit('data', 'unknown tool'); child.emit('close', 1); return;
			}
			if (options.upstreamTimeout === tool) {
				child.stdout.emit('data', JSON.stringify({ text: 'Video generation did not complete within 300s.', requestId: 'upstream-timeout-id' })); child.emit('close', 0); return;
			}
			if (options.usageExhausted === tool) {
				child.stderr.emit('data', 'Error: Internal error: {"message":"Abort (status 402 Payment Required): Grok Build usage balance exhausted\\n\\nRequest URL: https://cli-chat-proxy.grok.com/v1/responses", "http_status":402}'); child.emit('close', 1); return;
			}
			if (options.hangTool === tool) return;
			const workspace = args[args.indexOf('--cwd') + 1];
			const sessionId = '11111111-2222-4333-8444-555555555555';
			const output = path.join(sessionsRoot, encodeURIComponent(path.resolve(workspace)), sessionId, tool.includes('video') ? 'videos' : 'images');
			fs.mkdirSync(output, { recursive: true });
			fs.writeFileSync(path.join(output, tool.includes('video') ? 'generated.mp4' : 'generated.png'), tool.includes('video') ? 'generated video' : 'generated image');
			child.stdout.emit('data', JSON.stringify({ sessionId, text: `Generated ${tool}.` })); child.emit('close', 0);
		});
		return child;
	};
	const skill = path.join(root, 'SKILL.md');
	fs.writeFileSync(skill, '---\nname: imagine\n---\nimage_gen image_edit image_to_video reference_to_video');
	return { root, calls, driver: createGrokCliDriver({ candidates: ['grok-test'], lookup: () => ({ status: 0, stdout: 'grok-test\n' }), spawn, imagineSkillPath: skill, grokSessionsRoot: sessionsRoot, timeoutMs: 100, mediaTimeoutMs: options.mediaTimeoutMs }) };
}

(async () => {
	assert.strictEqual(GROK_MEDIA_TIMEOUT_MS, 450000);
	const fixture = createFakeGrok();
	try {
		await fixture.driver.refresh();
		assert.ok(fixture.driver.models().some((model) => model.id === 'model-relay:grok-cli:image'));
		assert.ok(fixture.driver.models().some((model) => model.id === 'model-relay:grok-cli:video'));

		const image = await fixture.driver.images({ prompt: 'edit', reference_images: [{ b64_json: Buffer.from('input image').toString('base64'), mime_type: 'image/png' }] });
		assert.strictEqual(image.success, true);
		assert.strictEqual(Buffer.from(image.response.data[0].b64_json, 'base64').toString(), 'generated image');
		assert.ok(fixture.calls.some((args) => toolForArgs(args) === 'image_edit'));

		const noReference = await fixture.driver.videos({ prompt: 'animate' });
		assert.strictEqual(noReference.success, true);
		assert.strictEqual(noReference.response.provider_details.generated_source_image, true);
		assert.ok(fixture.calls.some((args) => toolForArgs(args) === 'image_gen'));
		assert.ok(fixture.calls.some((args) => toolForArgs(args) === 'image_to_video'));

		const oneReference = await fixture.driver.videos({ prompt: 'animate', frames: [`data:image/png;base64,${Buffer.from('frame').toString('base64')}`] });
		assert.strictEqual(oneReference.success, true);
		assert.strictEqual(Buffer.from(oneReference.response.b64_video, 'base64').toString(), 'generated video');
		assert.strictEqual(oneReference.response.provider_details.generated_source_image, false);
		assert.ok(fixture.calls.some((args) => toolForArgs(args) === 'image_to_video'));

		const sessionInput = [];
		const sessionOutput = [];
		const visibleStreams = await fixture.driver.videos({ prompt: 'animate', input_reference: `data:image/png;base64,${Buffer.from('stream frame').toString('base64')}` }, {
			appendSessionInput: (stream, chunk) => sessionInput.push([stream, chunk]),
			appendSessionOutput: (stream, chunk) => sessionOutput.push([stream, chunk]),
		});
		assert.strictEqual(visibleStreams.success, true);
		assert.ok(sessionInput.some(([stream, chunk]) => stream === 'grok cli request' && chunk.includes('Prompt (passed with --single; stdin is empty):')));
		assert.ok(sessionOutput.some(([stream, chunk]) => stream === 'stdout' && chunk.includes('sessionId')));

		const first = path.join(fixture.root, 'one.png');
		const second = path.join(fixture.root, 'two.jpg');
		fs.writeFileSync(first, 'one'); fs.writeFileSync(second, 'two');
		const multipleReferences = await fixture.driver.videos({ prompt: 'animate', referenced_image_paths: [first, second] });
		assert.strictEqual(multipleReferences.success, true);
		assert.ok(fixture.calls.some((args) => toolForArgs(args) === 'reference_to_video'));
		const mediaArgs = fixture.calls.find((args) => toolForArgs(args) === 'image_edit');
		assert.ok(!mediaArgs.includes('--tools'));
		assert.strictEqual(mediaArgs[mediaArgs.indexOf('--permission-mode') + 1], 'dontAsk');
		assert.strictEqual(mediaArgs[mediaArgs.indexOf('--disallowed-tools') + 1], 'run_terminal_cmd');
		assert.ok(mediaArgs.includes('--no-subagents'));
		assert.ok(mediaArgs.includes('--disable-web-search'));
		assert.strictEqual(mediaArgs[mediaArgs.indexOf('--max-turns') + 1], '2');
		assert.strictEqual(fixture.driver.capabilities().imagine.video_verified, true);
	} finally {
		fs.rmSync(fixture.root, { recursive: true, force: true });
	}

	const unsupported = createFakeGrok({ unsupportedTool: 'image_to_video' });
	try {
		const result = await unsupported.driver.videos({ prompt: 'animate', input_reference: `data:image/png;base64,${Buffer.from('frame').toString('base64')}` });
		assert.strictEqual(result.code, 'grok_imagine_tool_unavailable');
		assert.strictEqual(unsupported.driver.capabilities().features.videos, false);
	} finally {
		fs.rmSync(unsupported.root, { recursive: true, force: true });
	}

	const upstreamTimeout = createFakeGrok({ upstreamTimeout: 'image_to_video' });
	try {
		const result = await upstreamTimeout.driver.videos({ prompt: 'animate', input_reference: `data:image/png;base64,${Buffer.from('frame').toString('base64')}` });
		assert.strictEqual(result.code, 'grok_media_timeout');
		assert.strictEqual(result.message, 'Grok Imagine image_to_video timed out after 300 seconds. Request ID: upstream-timeout-id.');
		assert.strictEqual(result.details.upstream_timeout_seconds, 300);
		assert.strictEqual(result.details.upstream_request_id, 'upstream-timeout-id');
	} finally {
		fs.rmSync(upstreamTimeout.root, { recursive: true, force: true });
	}

	const usageExhausted = createFakeGrok({ usageExhausted: 'image_gen' });
	try {
		const result = await usageExhausted.driver.images({ prompt: 'generate an image' });
		assert.strictEqual(result.success, false);
		assert.strictEqual(result.category, 'rate_limit');
		assert.strictEqual(result.code, 'grok_usage_exhausted');
		assert.strictEqual(result.message, 'Grok usage balance is exhausted. Add or renew Grok usage, then retry this request.');
		assert.strictEqual(result.retryable, true);
		assert.strictEqual(result.details.upstream_status, 402);
		assert.ok(!JSON.stringify(result).includes('cli-chat-proxy.grok.com'));
	} finally {
		fs.rmSync(usageExhausted.root, { recursive: true, force: true });
	}

	const malformed = createFakeGrok();
	try {
		fs.writeFileSync(path.join(malformed.root, 'SKILL.md'), 'name: not-imagine');
		await malformed.driver.refresh();
		assert.strictEqual(malformed.driver.capabilities().features.images, false);
	} finally {
		fs.rmSync(malformed.root, { recursive: true, force: true });
	}

	const timedOut = createFakeGrok({ hangTool: 'image_to_video', mediaTimeoutMs: 10 });
	try {
		const result = await timedOut.driver.videos({ prompt: 'animate', input_reference: `data:image/png;base64,${Buffer.from('frame').toString('base64')}` });
		assert.strictEqual(result.code, 'grok_media_timeout');
		assert.strictEqual(result.message, 'CLI request timed out after 1 second.');
		assert.strictEqual(result.details.timeout_ms, 10);
	} finally {
		fs.rmSync(timedOut.root, { recursive: true, force: true });
	}

	console.log('grok media tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
