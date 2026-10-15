'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const security = require('../src/security');
const {
	collectImageAttachments,
	imagePrompt,
	images,
	capabilities,
} = require('../src/codex');

const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

(async () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alorbach-codex-image-attachments-'));
	const imagePath = path.join(tempDir, 'ref.png');
	fs.writeFileSync(imagePath, Buffer.from(tinyPng, 'base64'));

	const fromRefs = collectImageAttachments({
		reference_images: [
			{ b64_json: tinyPng, mime_type: 'image/png', label: 'product' },
			{ b64_json: tinyPng, mime_type: 'image/jpeg', label: 'layout' },
		],
	}, tempDir);
	assert.strictEqual(fromRefs.length, 2);
	assert.strictEqual(fromRefs[0].label, 'product');
	assert.ok(fs.existsSync(fromRefs[0].path));

	const fromPaths = collectImageAttachments({
		referenced_image_paths: [imagePath],
	}, tempDir);
	assert.strictEqual(fromPaths.length, 1);
	assert.strictEqual(fromPaths[0].source_path, path.resolve(imagePath));

	const outside = path.join(os.tmpdir(), `relay-outside-ref-${Date.now()}.png`);
	fs.writeFileSync(outside, Buffer.from(tinyPng, 'base64'));
	try {
		const rejectedOutside = collectImageAttachments({ referenced_image_paths: [outside] }, tempDir);
		assert.strictEqual(rejectedOutside.length, 0);
	} finally {
		fs.rmSync(outside, { force: true });
	}

	const fromFrames = collectImageAttachments({
		frames: [`data:image/png;base64,${tinyPng}`],
	}, tempDir);
	assert.strictEqual(fromFrames.length, 1);

	const prompt = imagePrompt({ prompt: 'TELE ad', size: '1536x1024', quality: 'high' }, fromRefs);
	assert.ok(prompt.includes('Use a landscape composition. Prefer high visual detail. Scene: TELE ad'));
	assert.ok(prompt.includes('Those are not tool arguments.'));
	assert.ok(!prompt.includes('1536x1024'));
	const autoQuality = imagePrompt({ prompt: 'TELE ad', size: '1536x1024', quality: 'auto' });
	assert.ok(autoQuality.includes('Use a landscape composition. Scene: TELE ad'));
	assert.ok(!/Prefer .* visual detail/.test(autoQuality));
	const omittedQuality = imagePrompt({ prompt: 'TELE ad', size: '1536x1024' });
	assert.ok(omittedQuality.includes('Use a landscape composition. Scene: TELE ad'));
	assert.ok(imagePrompt({ prompt: 'TELE ad', size: '1024x1024' }).includes('Use a square composition. Scene: TELE ad'));
	assert.ok(imagePrompt({ prompt: 'TELE ad', size: '1024x1536' }).includes('Use a portrait composition. Scene: TELE ad'));
	assert.ok(prompt.includes('Pass the following text verbatim as the image_gen prompt'));
	assert.ok(prompt.includes('Image 1 (product)'));
	assert.ok(prompt.includes('Image 2 (layout)'));
	assert.ok(prompt.includes('Merge products from Image 1'));

	const caps = capabilities();
	assert.strictEqual(caps.bridge_features.image_reference_attachments, true);

	const previousHome = process.env.CODEX_HOME;
	const previousFetch = global.fetch;
	const previousReadState = security.readState;
	const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'alorbach-codex-generations-'));
	const logged = [];
	const accessToken = 'test-access-token';
	try {
		process.env.CODEX_HOME = codexHome;
		fs.writeFileSync(path.join(codexHome, 'config.toml'), 'model_provider = "relaytest"\n[model_providers.relaytest]\nbase_url = "https://example.test/backend-api/codex"\n');
		fs.writeFileSync(path.join(codexHome, 'auth.json'), JSON.stringify({ tokens: { access_token: accessToken, account_id: 'acct-1' } }));
		security.readState = () => ({ relay: { codex_image_tool: 'generations' } });
		global.fetch = async (url, options) => {
			const body = JSON.parse(options.body);
			logged.push({ url: String(url), body });
			const authorization = options.headers && options.headers.Authorization;
			assert.strictEqual(typeof authorization === 'string' && authorization.startsWith('Bearer ') && authorization.slice('Bearer '.length) === accessToken, true);
			assert.strictEqual(options.headers['chatgpt-account-id'], 'acct-1');
			assert.strictEqual(options.headers['Content-Type'], 'application/json');
			return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ b64_json: tinyPng }] }) };
		};
		const generated = await images({
			prompt: 'a glass orb',
			size: '1536x1024',
			quality: 'high',
			output_format: 'image/png',
		});
		assert.strictEqual(generated.success, true);
		assert.strictEqual(generated.response.data[0].mime_type, 'image/png');
		assert.strictEqual(logged.length, 1);
		assert.strictEqual(logged[0].url, 'https://example.test/backend-api/codex/images/generations');
		assert.strictEqual(logged[0].body.model, 'gpt-image-2.5-sunburst');
		assert.strictEqual(logged[0].body.prompt, 'a glass orb');
		assert.strictEqual(logged[0].body.size, '1536x1024');
		assert.strictEqual(logged[0].body.quality, 'high');
		assert.strictEqual(logged[0].body.output_format, 'png');
		assert.strictEqual(logged[0].body.background, undefined);
		assert.ok(!logged[0].body.prompt.includes('image_gen'));
		assert.strictEqual(JSON.stringify(logged).includes('Authorization'), false);
		assert.strictEqual(JSON.stringify(logged).includes(accessToken), false);
		assert.strictEqual(JSON.stringify(generated).includes(accessToken), false);
		const lowQuality = await images({ prompt: 'soft orb', size: '1024x1024', quality: 'low', output_format: 'image/png' });
		assert.strictEqual(lowQuality.success, true);
		assert.strictEqual(logged[logged.length - 1].body.quality, 'low');
		assert.strictEqual(logged[logged.length - 1].body.output_format, 'png');
		const mediumQuality = await images({ prompt: 'medium orb', size: '1024x1536', quality: 'medium', output_format: 'png' });
		assert.strictEqual(mediumQuality.success, true);
		assert.strictEqual(logged[logged.length - 1].body.quality, 'medium');
		assert.strictEqual(logged[logged.length - 1].url, 'https://example.test/backend-api/codex/images/generations');
		const omitted = await images({ prompt: 'provider chooses', size: 'auto', quality: 'auto', output_format: 'image/png' });
		assert.strictEqual(omitted.success, true);
		const omittedBody = logged[logged.length - 1].body;
		assert.strictEqual(omittedBody.model, 'gpt-image-2.5-sunburst');
		assert.strictEqual(omittedBody.prompt, 'provider chooses');
		assert.strictEqual(omittedBody.size, 'auto');
		assert.strictEqual(omittedBody.quality, undefined);
		assert.strictEqual(omittedBody.background, undefined);
		assert.strictEqual(omittedBody.output_format, 'png');
		assert.ok(!omittedBody.prompt.includes('image_gen'));
		const edited = await images({
			prompt: 'edit the orb',
			size: '1024x1024',
			output_format: 'image/png',
			reference_images: [{ b64_json: tinyPng, mime_type: 'image/png' }],
		});
		assert.strictEqual(edited.success, true);
		const editCall = logged[logged.length - 1];
		assert.strictEqual(editCall.url, 'https://example.test/backend-api/codex/images/edits');
		assert.strictEqual(editCall.body.images.length, 1);
		assert.ok(String(editCall.body.images[0].image_url).startsWith('data:image/png;base64,'));
		assert.strictEqual(editCall.body.images[0].path, undefined);
		global.fetch = async () => ({ ok: false, status: 401, text: async () => `Bearer ${accessToken}` });
		const authFailure = await images({ prompt: 'rejected', size: '1024x1024' });
		assert.strictEqual(authFailure.code, 'codex_image_auth_failed');
		assert.strictEqual(JSON.stringify(authFailure).includes(accessToken), false);
		assert.strictEqual(JSON.stringify(authFailure).includes('Authorization'), false);
		fs.writeFileSync(path.join(codexHome, 'auth.json'), JSON.stringify({ tokens: {} }));
		let fetchCalled = false;
		global.fetch = async () => { fetchCalled = true; return { ok: true, status: 200, text: async () => '{}' }; };
		const missingLogin = await images({ prompt: 'needs login', size: '1024x1024' });
		assert.strictEqual(fetchCalled, false);
		assert.strictEqual(missingLogin.category, 'configuration');
		assert.match(missingLogin.message, /Codex CLI/);
		assert.strictEqual(JSON.stringify(missingLogin).includes(accessToken), false);
	} finally {
		if (previousHome === undefined) delete process.env.CODEX_HOME;
		else process.env.CODEX_HOME = previousHome;
		global.fetch = previousFetch;
		security.readState = previousReadState;
		fs.rmSync(codexHome, { recursive: true, force: true });
	}

	fs.rmSync(tempDir, { recursive: true, force: true });
	console.log('image-attachments tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
