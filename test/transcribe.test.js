'use strict';

const assert = require('assert');
const http = require('http');
const { parseTimedWords } = require('../src/codex');
const { createServer } = require('../src/server');

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

function createMockSecurity() {
	return {
		MAX_BODY_BYTES: 12 * 1024 * 1024,
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

(async () => {
	assert.deepStrictEqual(parseTimedWords('0:01.250=0:01.750=Forbidden\n0:01.750=0:02.400=heaven'), [
		{ start: 1.25, end: 1.75, word: 'Forbidden' },
		{ start: 1.75, end: 2.4, word: 'heaven' },
	]);
	assert.deepStrictEqual(parseTimedWords('{"words":[{"start":1.25,"end":1.75,"word":"Forbidden"}]}'), [
		{ start: 1.25, end: 1.75, word: 'Forbidden' },
	]);
	assert.deepStrictEqual(parseTimedWords('{"words":[{"start":1.25,"word":"Forbidden"}]}'), []);

	const pending = [];
	const stateUpdates = [];
	const codex = {
		checkStatus: () => ({ success: true, message: 'ready', details: {} }),
		models: () => ({ success: true, models: { text: ['codex-local:auto'], image: ['codex-local:image'], audio: ['local-asr', 'local-asr:whisper-large-v3'] } }),
		capabilities: () => ({ success: true, bridge_features: { chat: true, images: true, audio_transcription: true }, codex: {}, asr: { enabled: true, ready: true, models: ['local-asr', 'local-asr:whisper-large-v3'] } }),
		chat: () => Promise.resolve({ success: true, response: { choices: [] } }),
		images: () => Promise.resolve({ success: true, response: { data: [] } }),
		transcribe: (payload, session = {}) => new Promise((resolve) => {
			if (session.appendSessionOutput) {
				session.appendSessionOutput('stdout', `transcribing ${payload.model || 'unknown'}`);
			}
			pending.push({ payload, resolve });
		}),
	};
	const server = createServer({
		codex,
		security: createMockSecurity(),
		maxConcurrent: 1,
		onJobState: (snapshot) => stateUpdates.push(JSON.parse(JSON.stringify(snapshot))),
	});

	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;

	try {
		const missingSignature = await requestJson(port, 'POST', '/v1/transcribe', { payload: {} });
		assert.strictEqual(missingSignature.statusCode, 400);
		assert.ok(String(missingSignature.body.message || '').includes('Signed WordPress job token'));

		const first = requestJson(port, 'POST', '/v1/transcribe', {
			job_token: 'job-token',
			request_hash: 'hash-1',
			request_id: 'request-1',
			payload: {
				model: 'local-asr:whisper-large-v3',
				audio_base64: Buffer.from('audio').toString('base64'),
				audio_format: 'mp3',
				duration_seconds: 3,
			},
		});
		const second = requestJson(port, 'POST', '/v1/transcribe', {
			job_token: 'job-token',
			request_hash: 'hash-2',
			request_id: 'request-2',
			payload: {
				model: 'local-asr',
				audio_base64: Buffer.from('audio').toString('base64'),
				audio_format: 'mp3',
				duration_seconds: 3,
			},
		});

		await new Promise((resolve, reject) => {
			const started = Date.now();
			function poll() {
				if (pending.length === 1) {
					resolve();
				} else if (Date.now() - started > 2000) {
					reject(new Error('Timed out waiting for transcribe job.'));
				} else {
					setTimeout(poll, 10);
				}
			}
			poll();
		});

		const status = await requestJson(port, 'GET', '/v1/status');
		assert.strictEqual(status.body.jobs.running_count, 1);
		assert.strictEqual(status.body.jobs.queued_count, 1);
		assert.strictEqual(status.body.jobs.active[0].type, 'transcribe');
		assert.strictEqual(status.body.jobs.active[0].model, 'local-asr:whisper-large-v3');
		assert.ok(status.body.jobs.active[0].session_output.includes('transcribing local-asr:whisper-large-v3'));

		pending.shift().resolve({ success: true, response: { text: 'Forbidden heaven', words: [{ word: 'Forbidden', start: 1.25, end: 1.75 }], model: 'local-asr:whisper-large-v3' } });
		const firstResult = await first;
		assert.strictEqual(firstResult.statusCode, 200);
		assert.strictEqual(firstResult.body.response.words[0].word, 'Forbidden');

		await new Promise((resolve, reject) => {
			const started = Date.now();
			function poll() {
				if (pending.length === 1) {
					resolve();
				} else if (Date.now() - started > 2000) {
					reject(new Error('Timed out waiting for second transcribe job.'));
				} else {
					setTimeout(poll, 10);
				}
			}
			poll();
		});
		pending.shift().resolve({ success: false, category: 'output_detection', message: 'Missing timestamps.' });
		const secondResult = await second;
		assert.strictEqual(secondResult.statusCode, 500);
		assert.strictEqual(secondResult.body.message, 'Missing timestamps.');
		assert.ok(JSON.stringify(stateUpdates).includes('request-2'));
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
