'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createGrokCliDriver, GROK_MEDIA_TIMEOUT_MS, grokImageEditNeedsAspectExpansion, grokImageToolGuidance, isCompleteImageCapabilityContract } = require('../src/backend-registry');

function toolForArgs(args) {
	const prompt = args[args.indexOf('--single') + 1] || '';
	const match = /Call the (\w+) tool exactly once/.exec(prompt);
	return match ? match[1] : '';
}

function assertExactToolAllowlist(args, tool) {
	assert.strictEqual(args.filter((arg) => arg === '--tools').length, 1);
	assert.strictEqual(args[args.indexOf('--tools') + 1], tool);
}

function buildJpeg(width, height) {
	const buffer = Buffer.alloc(16);
	buffer[0] = 0xff;
	buffer[1] = 0xd8;
	buffer[2] = 0xff;
	buffer[3] = 0xc0;
	buffer.writeUInt16BE(17, 4);
	buffer[6] = 8;
	buffer.writeUInt16BE(height, 7);
	buffer.writeUInt16BE(width, 9);
	buffer[11] = 0xff;
	buffer[12] = 0xd9;
	return buffer;
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
	const driverOptions = { candidates: ['grok-test'], lookup: () => ({ status: 0, stdout: 'grok-test\n' }), spawn, grokSessionsRoot: sessionsRoot, timeoutMs: 100, mediaTimeoutMs: options.mediaTimeoutMs };
	if (!options.bundledSkillOnly) {
		fs.writeFileSync(skill, '---\nname: imagine\n---\nimage_gen image_edit image_to_video reference_to_video');
		driverOptions.imagineSkillPath = skill;
	}
	return { root, calls, driver: createGrokCliDriver(driverOptions) };
}

(async () => {
	assert.strictEqual(GROK_MEDIA_TIMEOUT_MS, 450000);
	const fixture = createFakeGrok();
	try {
		await fixture.driver.refresh();
		const grokImageModel = fixture.driver.models().find((model) => model.id === 'model-relay:grok-cli:image');
		assert.ok(grokImageModel);
		assert.deepStrictEqual(grokImageModel.job_types, ['images']);
		assert.ok(grokImageModel.image_capabilities);
		assert.deepStrictEqual(Object.keys(grokImageModel.image_capabilities.provider_options).sort(), ['aspect_ratio', 'resolution']);
		assert.strictEqual(grokImageModel.image_capabilities.provider_options.aspect_ratio.delivery, 'native');
		assert.ok(isCompleteImageCapabilityContract(grokImageModel));
		assert.deepStrictEqual(grokImageModel.test_options.map((option) => option.key), ['aspect_ratio', 'resolution']);
		assert.ok(grokImageModel.test_options.every((option) => option.key === 'aspect_ratio' ? option.delivery === 'tool-arg' : option.delivery === 'guidance'));
		assert.ok(grokImageModel.test_options[0].choices.some((choice) => choice.value === '21:9'));
		assert.ok(grokImageModel.test_options[0].choices.some((choice) => choice.value === '5:2'));
		const grokVideoModel = fixture.driver.models().find((model) => model.id === 'model-relay:grok-cli:video');
		assert.ok(grokVideoModel);
		assert.deepStrictEqual(grokVideoModel.job_types, ['videos']);
		assert.deepStrictEqual(grokVideoModel.test_options.map((option) => option.key), ['aspect_ratio', 'resolution', 'seconds', 'generate_audio']);
		assert.ok(grokVideoModel.test_options.every((option) => option.delivery === 'guidance'));
		assert.ok(grokVideoModel.test_options.find((option) => option.key === 'resolution').choices.some((choice) => choice.value === '1080p'));

		const image = await fixture.driver.images({ prompt: 'edit', aspect_ratio: '16:9', resolution: '2k', reference_images: [{ b64_json: Buffer.from('input image').toString('base64'), mime_type: 'image/png' }] });
		assert.strictEqual(image.success, true);
		assert.strictEqual(Buffer.from(image.response.data[0].b64_json, 'base64').toString(), 'generated image');
		assert.ok(fixture.calls.some((args) => toolForArgs(args) === 'image_edit'));
		const imageEditPrompt = fixture.calls.find((args) => toolForArgs(args) === 'image_edit')[fixture.calls.find((args) => toolForArgs(args) === 'image_edit').indexOf('--single') + 1];
		assert.ok(imageEditPrompt.includes('Pass aspect_ratio "16:9" as the image_edit tool argument.'));
		assert.ok(imageEditPrompt.includes('request 2K output with the long edge around 2048 pixels.'));
		assert.ok(imageEditPrompt.includes('Do not pass a resolution or output_format tool parameter'));
		assert.ok(imageEditPrompt.includes('reference-aspect'));
		assert.ok(imageEditPrompt.includes('multi-image edit'));
		assert.ok(imageEditPrompt.includes('not as the output canvas'));
		assertExactToolAllowlist(fixture.calls.find((args) => toolForArgs(args) === 'image_edit'), 'image_edit');

		const matchingLandscape = await fixture.driver.images({
			prompt: 'keep canvas',
			aspect_ratio: '16:9',
			reference_images: [{ b64_json: buildJpeg(1600, 900).toString('base64'), mime_type: 'image/jpeg' }],
		});
		assert.strictEqual(matchingLandscape.success, true);
		const matchingPrompt = fixture.calls.filter((args) => toolForArgs(args) === 'image_edit').pop()[fixture.calls.filter((args) => toolForArgs(args) === 'image_edit').pop().indexOf('--single') + 1];
		assert.ok(matchingPrompt.includes('Pass aspect_ratio "16:9" as the image_edit tool argument.'));
		assert.ok(!matchingPrompt.includes('reference-aspect'));
		assert.ok(!matchingPrompt.includes('multi-image edit'));

		const portraitToWide = await fixture.driver.images({
			prompt: 'storyboard begin frame',
			aspect_ratio: '16:9',
			resolution: '2k',
			reference_images: [{ b64_json: buildJpeg(683, 1024).toString('base64'), mime_type: 'image/jpeg' }],
		});
		assert.strictEqual(portraitToWide.success, true);
		const portraitPromptArgs = fixture.calls.filter((args) => toolForArgs(args) === 'image_edit').pop();
		const portraitPrompt = portraitPromptArgs[portraitPromptArgs.indexOf('--single') + 1];
		assert.ok(portraitPrompt.includes('using '));
		assert.ok(portraitPrompt.includes('reference-1.jpg, ') && portraitPrompt.includes('reference-aspect.jpg'));
		assert.ok(portraitPrompt.includes('Pass every listed reference path in the image array so this is a multi-image edit'));
		assert.ok(portraitPrompt.includes('Compose a new scene at aspect_ratio "16:9"'));
		assert.ok(grokImageEditNeedsAspectExpansion(path.join(os.tmpdir(), 'missing.jpg'), { aspect_ratio: '16:9' }));
		assert.ok(!grokImageEditNeedsAspectExpansion('', { aspect_ratio: '16:9' }));
		const matchingFile = path.join(fixture.root, 'wide.jpg');
		fs.writeFileSync(matchingFile, buildJpeg(1920, 1080));
		assert.ok(!grokImageEditNeedsAspectExpansion(matchingFile, { aspect_ratio: '16:9' }));
		assert.ok(grokImageEditNeedsAspectExpansion(matchingFile, { aspect_ratio: '9:16' }));
		assert.match(grokImageToolGuidance({ aspect_ratio: '16:9' }, 'image_edit', { referenceCount: 2 }), /multi-image edit/);
		assert.doesNotMatch(grokImageToolGuidance({ aspect_ratio: '16:9' }, 'image_edit', { referenceCount: 1 }), /multi-image edit/);

		const noReference = await fixture.driver.videos({ prompt: 'animate' });
		assert.strictEqual(noReference.success, true);
		assert.strictEqual(noReference.response.provider_details.generated_source_image, true);
		const generatedSourceArgs = fixture.calls.find((args) => toolForArgs(args) === 'image_gen');
		assert.ok(generatedSourceArgs);
		assertExactToolAllowlist(generatedSourceArgs, 'image_gen');
		const imageToVideoArgs = fixture.calls.find((args) => toolForArgs(args) === 'image_to_video');
		assert.ok(imageToVideoArgs);
		assertExactToolAllowlist(imageToVideoArgs, 'image_to_video');

		const oneReference = await fixture.driver.videos({ prompt: 'animate', frames: [`data:image/png;base64,${Buffer.from('frame').toString('base64')}`], seconds: 10, resolution: '1080p', generate_audio: false });
		assert.strictEqual(oneReference.success, true);
		assert.strictEqual(Buffer.from(oneReference.response.b64_video, 'base64').toString(), 'generated video');
		assert.strictEqual(oneReference.response.provider_details.generated_source_image, false);
		const oneReferenceArgs = fixture.calls.filter((args) => toolForArgs(args) === 'image_to_video').pop();
		assert.ok(oneReferenceArgs);
		assertExactToolAllowlist(oneReferenceArgs, 'image_to_video');
		assert.ok(fixture.calls.some((args) => toolForArgs(args) === 'image_to_video' && args[args.indexOf('--single') + 1].includes('Requested clip length: 10 seconds.')));
		assert.ok(fixture.calls.some((args) => toolForArgs(args) === 'image_to_video' && args[args.indexOf('--single') + 1].includes('Requested resolution tier: 1080p.')));
		assert.ok(fixture.calls.some((args) => toolForArgs(args) === 'image_to_video' && args[args.indexOf('--single') + 1].includes('Request a silent video without a soundtrack.')));

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
		const rejectedPaths = await fixture.driver.videos({ prompt: 'animate', referenced_image_paths: [first, second] });
		assert.strictEqual(rejectedPaths.success, false);
		assert.strictEqual(rejectedPaths.code, 'grok_reference_invalid');
		const multipleReferences = await fixture.driver.videos({
			prompt: 'animate',
			reference_images: [
				{ b64_json: Buffer.from('one').toString('base64'), mime_type: 'image/png' },
				{ b64_json: Buffer.from('two').toString('base64'), mime_type: 'image/jpeg' },
			],
		});
		assert.strictEqual(multipleReferences.success, true);
		const referenceToVideoArgs = fixture.calls.find((args) => toolForArgs(args) === 'reference_to_video');
		assert.ok(referenceToVideoArgs);
		assertExactToolAllowlist(referenceToVideoArgs, 'reference_to_video');
		const mediaArgs = fixture.calls.find((args) => toolForArgs(args) === 'image_edit');
		assertExactToolAllowlist(mediaArgs, 'image_edit');
		assert.strictEqual(mediaArgs[mediaArgs.indexOf('--permission-mode') + 1], 'dontAsk');
		assert.strictEqual(mediaArgs[mediaArgs.indexOf('--disallowed-tools') + 1], 'run_terminal_cmd');
		assert.ok(mediaArgs.includes('--no-subagents'));
		assert.ok(mediaArgs.includes('--disable-web-search'));
		assert.strictEqual(mediaArgs[mediaArgs.indexOf('--max-turns') + 1], '2');
		assert.strictEqual(fixture.driver.capabilities().imagine.video_verified, true);
	} finally {
		fs.rmSync(fixture.root, { recursive: true, force: true });
	}

	const bundledHome = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-bundled-home-'));
	const bundledSkillDir = path.join(bundledHome, '.grok', 'bundled', 'skills', 'imagine');
	fs.mkdirSync(bundledSkillDir, { recursive: true });
	fs.writeFileSync(path.join(bundledSkillDir, 'SKILL.md'), '---\nname: imagine\n---\nimage_gen image_edit image_to_video reference_to_video');
	const originalHomedir = os.homedir;
	os.homedir = () => bundledHome;
	const bundledFixture = createFakeGrok({ bundledSkillOnly: true });
	try {
		await bundledFixture.driver.refresh();
		assert.ok(bundledFixture.driver.models().some((model) => model.id === 'model-relay:grok-cli:image'));
		assert.ok(bundledFixture.driver.models().some((model) => model.id === 'model-relay:grok-cli:video'));
		assert.strictEqual(bundledFixture.driver.capabilities().imagine.detected, true);
	} finally {
		os.homedir = originalHomedir;
		fs.rmSync(bundledHome, { recursive: true, force: true });
		fs.rmSync(bundledFixture.root, { recursive: true, force: true });
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
