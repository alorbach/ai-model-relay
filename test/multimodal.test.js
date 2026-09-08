'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createServer } = require('../src/server');
const { extractFrames, framesFromPayload, hostnameHasPrivateAddress, materializeMedia, validateRemoteMediaUrl } = require('../src/media-analysis');
const { EventEmitter } = require('events');

const framePng = 'data:image/png;base64,iVBORw0KGgo=';

function requestJson(port, method, pathname, body, headers = {}) {
	return new Promise((resolve, reject) => {
		const data = body ? JSON.stringify(body) : '';
		const req = http.request({
			hostname: '127.0.0.1',
			port,
			path: pathname,
			method,
			headers: {
				Origin: 'http://127.0.0.1:8787',
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(data),
				'X-Alorbach-Bridge-Token': 'test-token',
				...headers,
			},
		}, (res) => {
			let raw = '';
			res.setEncoding('utf8');
			res.on('data', (chunk) => {
				raw += chunk;
			});
			res.on('end', () => {
				try {
					resolve({ statusCode: res.statusCode, body: raw ? JSON.parse(raw) : {} });
				} catch (error) {
					reject(error);
				}
			});
		});
		req.on('error', reject);
		if (data) {
			req.write(data);
		}
		req.end();
	});
}

function createMockSecurity(maxBytes = 12 * 1024 * 1024) {
	return {
		MAX_BODY_BYTES: maxBytes,
		createPairingCode: () => '123456',
		createToken: () => 'test-token',
		getPairing: () => ({ token: 'test-token', paired_at: 'now' }),
		getPairings: () => ({ 'http://127.0.0.1:8787': { token: 'test-token', paired_at: 'now' } }),
		isLocalAddress: () => true,
		normalizeOrigin: (origin) => {
			try {
				return new URL(origin).origin;
			} catch (error) {
				return '';
			}
		},
		removePairing: () => {},
		savePairing: () => {},
		validateBridgeToken: (origin, token) => !!origin && token === 'test-token',
	};
}

function jobBody(id, payload) {
	return {
		job_token: 'job-token',
		request_hash: `hash-${id}`,
		request_id: `request-${id}`,
		payload,
	};
}

async function withServer(options, callback) {
	const server = createServer({ backgroundRefresh: false, ...options });
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	try {
		await callback(server.address().port);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
}

(async () => {
	assert.strictEqual(validateRemoteMediaUrl('http://example.com/video.mp4').ok, false);
	assert.strictEqual(validateRemoteMediaUrl('https://127.0.0.1/video.mp4').ok, false);
	assert.strictEqual(validateRemoteMediaUrl('https://[::ffff:127.0.0.1]/video.mp4').ok, false);
	assert.strictEqual(validateRemoteMediaUrl('https://example.com/video.mp4').ok, true);
	assert.strictEqual(await hostnameHasPrivateAddress('rebind.example', async () => [{ address: '127.0.0.1', family: 4 }]), true);
	assert.strictEqual(await hostnameHasPrivateAddress('rebind.example', async () => [{ address: '::ffff:169.254.169.254', family: 6 }]), true);
	assert.strictEqual(await hostnameHasPrivateAddress('rebind.example', async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]), true);
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-media-ssrf-'));
	try {
		await assert.rejects(
			() => materializeMedia(
				{ media_url: 'https://rebind.example/video.mp4' },
				tmp,
				async () => { throw new Error('fetch should not run for a private DNS result'); },
				async () => [{ address: '169.254.169.254', family: 4 }],
			),
			/private-network/i,
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}

	const downloadTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-media-download-'));
	try {
		let cancelled = false;
		const oversizedChunk = Buffer.alloc(40 * 1024 * 1024, 1);
		await assert.rejects(
			() => materializeMedia(
				{ media_url: 'https://cdn.example/video.mp4' },
				downloadTmp,
				async () => {
					let index = 0;
					const chunks = [oversizedChunk, oversizedChunk];
					return {
						ok: true,
						status: 200,
						headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? 'video/mp4' : '' },
						body: {
							getReader() {
								return {
									read: async () => index >= chunks.length ? { done: true, value: undefined } : { done: false, value: chunks[index++] },
									cancel: async () => { cancelled = true; },
								};
							},
						},
					};
				},
				async () => [{ address: '1.1.1.1', family: 4 }],
			),
			/too large/i,
		);
		assert.strictEqual(cancelled, true);
		await assert.rejects(
			() => materializeMedia(
				{ media_url: 'https://cdn.example/video.mp4' },
				downloadTmp,
				async (url, options) => new Promise((_, reject) => {
					options.signal.addEventListener('abort', () => {
						const error = new Error('The operation was aborted');
						error.name = 'AbortError';
						reject(error);
					});
				}),
				async () => [{ address: '1.1.1.1', family: 4 }],
				{ timeoutMs: 20 },
			),
			/abort/i,
		);
		await assert.rejects(
			() => extractFrames(path.join(downloadTmp, 'missing.mp4'), downloadTmp, 1, {
				timeoutMs: 30,
				spawn: () => {
					const child = new EventEmitter();
					child.stderr = new EventEmitter();
					child.kill = () => child.emit('close', null, 'SIGKILL');
					return child;
				},
			}),
			/timed out/i,
		);
	} finally {
		fs.rmSync(downloadTmp, { recursive: true, force: true });
	}
	assert.strictEqual(framesFromPayload({ frames: Array(10).fill(framePng) }).length, 6);

	const video = {
		capabilities: () => ({ enabled: true, models: ['sora-2', 'sora-2-pro'], operations: ['create', 'retrieve', 'download', 'remix', 'delete'] }),
		run: (payload) => {
			if (payload.action === 'download') {
				return { success: true, response: { video_id: payload.video_id, b64_video: Buffer.from('mp4').toString('base64') } };
			}
			return { success: true, response: { id: payload.video_id || 'video-123', status: payload.status || 'queued', model: payload.model || 'sora-2' } };
		},
	};
	const codex = {
		lastChatPayload: null,
		outputSchema: true,
		structuredResponse: false,
		lastSchemaPath: null,
		lastSchemaContents: null,
		lastChatInternalOptions: null,
		execCapabilities: () => ({ output_schema: codex.outputSchema }),
		capabilities: () => ({ success: true, bridge_features: { structured_exec_json: true, output_schema: codex.outputSchema, app_server: true }, codex: { version: 'codex-cli test' } }),
		checkStatus: () => ({ success: true, message: 'ready', details: {} }),
		models: () => ({ success: true, models: { text: ['codex-local:auto'], image: ['codex-local:image'] } }),
		chat: (payload, session, internalOptions) => {
			codex.lastChatPayload = payload;
			codex.lastChatInternalOptions = internalOptions || null;
			if (internalOptions && internalOptions.outputSchemaPath) {
				codex.lastSchemaPath = internalOptions.outputSchemaPath;
				codex.lastSchemaContents = fs.readFileSync(internalOptions.outputSchemaPath, 'utf8');
			}
			const content = codex.structuredResponse
				? JSON.stringify({ summary: 'A structured media summary.', visible_text: 'A visible sign.', issues: ['Low contrast.'], confidence: 'high', notes: 'Additional context.' })
				: `analyzed ${payload.messages[0].content.length} parts`;
			return Promise.resolve({
				success: true,
				response: {
					choices: [{ message: { role: 'assistant', content } }],
					provider_details: {},
				},
			});
		},
	};
	const mediaAnalysis = require('../src/media-analysis');

	await withServer({ codex, video, mediaAnalysis, security: createMockSecurity(), maxConcurrent: 2 }, async (port) => {
		const capabilities = await requestJson(port, 'GET', '/v1/capabilities');
		assert.strictEqual(capabilities.statusCode, 200);
		assert.strictEqual(capabilities.body.features.structured_exec_json, true);
		assert.strictEqual(capabilities.body.video.enabled, true);

		const models = await requestJson(port, 'GET', '/v1/models');
		assert.strictEqual(models.statusCode, 200);
		assert.deepStrictEqual(models.body.models.video, ['openai-video:sora-2', 'openai-video:sora-2-pro']);

		for (const status of ['queued', 'in_progress', 'completed', 'failed', 'expired']) {
			const result = await requestJson(port, 'POST', '/v1/videos', jobBody(`video-${status}`, { action: 'retrieve', video_id: `video-${status}`, status }));
			assert.strictEqual(result.statusCode, 200);
			assert.strictEqual(result.body.response.status, status);
		}

		const downloaded = await requestJson(port, 'POST', '/v1/videos', jobBody('video-download', { action: 'download', video_id: 'video-completed' }));
		assert.strictEqual(downloaded.statusCode, 200);
		assert.strictEqual(downloaded.body.response.b64_video, Buffer.from('mp4').toString('base64'));

		const analyzed = await requestJson(port, 'POST', '/v1/media/analyze', jobBody('media', {
			frames: [framePng],
			prompt: 'What is visible?',
			transcript: `${'a'.repeat(32000)}b`,
		}));
		assert.strictEqual(analyzed.statusCode, 200);
		assert.strictEqual(analyzed.body.response.provider_details.media_analysis.frames_analyzed, 1);
		assert.strictEqual(codex.lastChatPayload.max_tokens, 4096);
		const analysisText = codex.lastChatPayload.messages[0].content[0].text;
		assert.ok(analysisText.includes(`Provided audio transcript:\n${'a'.repeat(32000)}\n\nIf the CLI requests structured output`));
		assert.ok(!analysisText.includes('a'.repeat(32000) + 'b'));
		assert.strictEqual(codex.lastChatPayload.output_schema_path, undefined);
		assert.ok(codex.lastChatInternalOptions.outputSchemaPath.endsWith('media-analysis.schema.json'));
		const schema = JSON.parse(codex.lastSchemaContents);
		assert.deepStrictEqual(schema.properties.issues, { type: 'array', items: { type: 'string' } });
		assert.strictEqual(schema.additionalProperties, true);

		codex.structuredResponse = true;
		const structured = await requestJson(port, 'POST', '/v1/media/analyze', jobBody('media-structured', {
			frames: [framePng],
			prompt: 'Return structured analysis.',
		}));
		assert.strictEqual(structured.statusCode, 200);
		assert.deepStrictEqual(structured.body.response.provider_details.media_analysis.structured, {
			summary: 'A structured media summary.',
			visible_text: 'A visible sign.',
			issues: ['Low contrast.'],
			confidence: 'high',
			notes: 'Additional context.',
		});
		assert.strictEqual(structured.body.response.choices[0].message.content, 'A structured media summary.');

		codex.structuredResponse = false;
		codex.outputSchema = false;
		const freeText = await requestJson(port, 'POST', '/v1/media/analyze', jobBody('media-free-text', {
			frames: [framePng],
			prompt: 'Use free text.',
		}));
		assert.strictEqual(freeText.statusCode, 200);
		assert.strictEqual(freeText.body.response.provider_details.media_analysis.structured, undefined);
		assert.ok(freeText.body.response.choices[0].message.content.startsWith('analyzed '));
		assert.strictEqual(codex.lastChatPayload.output_schema_path, undefined);
		assert.strictEqual(codex.lastChatInternalOptions, null);
	});

	await withServer({
		codex,
		video: {
			capabilities: () => ({ enabled: false, configured: false }),
			run: () => ({ success: false, category: 'configuration', code: 'video_not_configured', message: 'disabled' }),
		},
		mediaAnalysis,
		security: createMockSecurity(),
	}, async (port) => {
		const disabled = await requestJson(port, 'POST', '/v1/videos', jobBody('disabled', { prompt: 'make video' }));
		assert.strictEqual(disabled.statusCode, 503);
		assert.strictEqual(disabled.body.code, 'video_not_configured');
	});

	await withServer({ codex, video, mediaAnalysis, security: createMockSecurity(64) }, async (port) => {
		const oversized = await requestJson(port, 'POST', '/v1/media/analyze', jobBody('large', { frames: ['x'.repeat(200)] }));
		assert.strictEqual(oversized.statusCode, 413);
		assert.strictEqual(oversized.body.message, 'Request body is too large.');
	});

	console.log('multimodal tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
