'use strict';

const assert = require('assert');
const http = require('http');
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
					resolve({ statusCode: res.statusCode, headers: res.headers, body: raw ? JSON.parse(raw) : {} });
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

function waitFor(predicate) {
	return new Promise((resolve, reject) => {
		const started = Date.now();
		function check() {
			if (predicate()) {
				resolve();
				return;
			}
			if (Date.now() - started > 2000) {
				reject(new Error('Timed out waiting for condition.'));
				return;
			}
			setTimeout(check, 10);
		}
		check();
	});
}

function requestEvents(port, pathname, headers, eventNames) {
	return new Promise((resolve, reject) => {
		const wanted = new Set(eventNames);
		const events = {};
		let raw = '';
		let done = false;
		const finish = (req, result) => {
			if (done) {
				return;
			}
			done = true;
			clearTimeout(timer);
			req.destroy();
			resolve(result);
		};
		const timer = setTimeout(() => {
			if (done) {
				return;
			}
			done = true;
			req.destroy();
			reject(new Error('Timed out waiting for status events.'));
		}, 2000);
		const req = http.get({ hostname: '127.0.0.1', port, path: pathname, headers }, (res) => {
			res.setEncoding('utf8');
			res.on('data', (chunk) => {
				raw += chunk;
				const regex = /event: ([^\n]+)\ndata: ([^\n]+)\n\n/g;
				let match;
				while ((match = regex.exec(raw))) {
					if (wanted.has(match[1]) && !events[match[1]]) {
						events[match[1]] = JSON.parse(match[2]);
					}
				}
				if (eventNames.every((eventName) => events[eventName])) {
					finish(req, {
						statusCode: res.statusCode,
						contentType: res.headers['content-type'],
						allowOrigin: res.headers['access-control-allow-origin'],
						events,
						raw,
					});
				}
			});
		});
		req.on('error', (error) => {
			if (!done && error.code !== 'ECONNRESET') {
				done = true;
				clearTimeout(timer);
				reject(error);
			}
		});
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
	const pending = [];
	const stateUpdates = [];
	const asrSettingsCalls = [];
	const codex = {
		checkStatus: () => ({ success: true, message: 'ready', details: {} }),
		models: () => ({ success: true, models: { text: ['codex-local:auto'], image: ['codex-local:image'] } }),
		capabilities: () => ({ success: true, bridge_features: { chat: true, images: true, audio_transcription: true }, codex: {}, asr: { enabled: true, ready: null, runtime_checked: false, runtime: { checked: false }, models: ['local-asr'] } }),
		asrStatus: () => ({ enabled: true, ready: null, runtime_checked: false, runtime: { checked: false }, models: ['local-asr'] }),
		asrSettings: (options = {}) => {
			asrSettingsCalls.push(options);
			return {
				success: true,
				settings: { allow_model_downloads: false, models: [] },
				capabilities: {
					enabled: true,
					ready: options.refresh ? true : null,
					runtime_checked: !!options.refresh,
					runtime: { checked: !!options.refresh },
					models: ['local-asr'],
				},
			};
		},
		saveAsrSettings: (settings) => settings,
		setupAsr: (options) => Promise.resolve({ success: true, model_id: 'local-asr:' + (options.model_id || 'whisper-small') }),
		chat: (payload, session = {}) => new Promise((resolve) => {
			if (session.appendSessionOutput) {
				session.appendSessionOutput('stderr', `live output for ${payload.model || 'unknown'}`);
			}
			pending.push({ payload, resolve });
		}),
		images: () => Promise.resolve({ success: true, response: { data: [] } }),
	};
	let server;
	const statusCache = {
		status: () => ({
			success: true,
			message: 'ready',
			details: {},
			bridge: {},
			asr: codex.asrStatus(),
			music_analysis: {},
			jobs: server ? server.jobManager.snapshot() : {},
			checking: false,
		}),
		capabilities: () => ({ success: true, codex: {}, asr: codex.asrStatus(), music_analysis: {}, features: {}, backends: {}, video: {}, media_analysis: {}, checking: false }),
		refresh: async () => {},
		sync: () => {},
	};
	server = createServer({
		backgroundRefresh: false,
		codex,
		statusCache,
		security: createMockSecurity(),
		maxConcurrent: 2,
		onJobState: (snapshot) => stateUpdates.push(JSON.parse(JSON.stringify(snapshot))),
	});

	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;

	try {
		const body = (id) => ({
			job_token: 'job-token',
			request_hash: `hash-${id}`,
			request_id: `request-${id}`,
			payload: {
				model: id === 2 ? 'codex-local:gpt-5.4' : 'codex-local:auto',
				messages: [{ role: 'user', content: `secret prompt ${id}` }],
			},
		});

		const first = requestJson(port, 'POST', '/v1/chat', body(1));
		const second = requestJson(port, 'POST', '/v1/chat', body(2));
		const third = requestJson(port, 'POST', '/v1/chat', body(3));

		await waitFor(() => pending.length === 2);
		const page = await new Promise((resolve, reject) => {
			http.get({ hostname: '127.0.0.1', port, path: '/status' }, (res) => {
				let raw = '';
				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					raw += chunk;
				});
				res.on('end', () => resolve({ statusCode: res.statusCode, contentType: res.headers['content-type'], body: raw }));
			}).on('error', reject);
		});
		assert.strictEqual(page.statusCode, 200);
		assert.ok(page.contentType.includes('text/html'));
		assert.ok(page.body.includes('Codex Local Bridge'));
		assert.ok(page.body.includes('/v1/status'));
		assert.ok(page.body.includes('/v1/capabilities'));
		assert.ok(page.body.includes('/v1/status/events'));
		assert.ok(page.body.includes('role="tablist"'));
		assert.ok(page.body.includes('id="sidebar-nav"'));
		for (const route of ['overview', 'live', 'providers', 'debug']) {
			assert.ok(page.body.includes('data-route="' + route + '"'));
			assert.ok(page.body.includes('id="view-' + route + '"'));
		}
		assert.ok(page.body.includes('selectRoute'));
		assert.ok(page.body.includes('id="liveJobList"'));
		assert.ok(page.body.includes('renderLiveJobList'));
		assert.ok(page.body.includes('id="debugHealthList"'));
		assert.ok(page.body.includes('connectionPill'));
		assert.ok(page.body.includes('copyRawStatus'));
		assert.ok(page.body.includes('tickElapsedCells'));
		assert.ok(page.body.includes('heartbeat'));
		assert.ok(page.body.includes('Codex CLI details'));
		assert.ok(page.body.includes('Detected features'));
		assert.ok(page.body.includes('Local ASR Settings'));
		assert.ok(page.body.includes('id="asrSettingsForm"'));
		assert.ok(page.body.includes('id="addAsrModel"'));
		assert.ok(page.body.includes('id="applyAsrSettingsJson"'));
		assert.ok(page.body.includes('id="refreshAsrRuntime"'));
		assert.ok(page.body.includes('?refresh=1'));
		assert.ok(page.body.includes('Structured exec JSON'));
		assert.ok(page.body.includes('OpenAI video route'));
		assert.ok(page.body.includes('new window.EventSource(eventsUrl)'));
		assert.ok(page.body.includes("'/v1/status/stream'"));
		assert.ok(page.body.includes('startFallbackPolling'));
		assert.ok(page.body.includes('<details class="card disclosure" id="rawStatusDetails">'));
		assert.ok(page.body.includes('<span class="disclosure-title">Raw status JSON</span>'));
		assert.ok(page.body.includes('white-space: pre-wrap'));
		assert.ok(page.body.includes('overflow-x: hidden'));
		assert.ok(page.body.includes('live-session-output'));
		assert.ok(page.body.includes('<div class="session-output-block'));
		assert.ok(page.body.includes('Prompt'));
		assert.ok(page.body.includes('AI Response'));
		assert.ok(page.body.includes('debug_logs'));
		assert.ok(page.body.includes('data-session-key'));
		assert.ok(page.body.includes('captureSessionOutputScrolls'));
		assert.ok(page.body.includes('restoreSessionOutputScrolls'));
		assert.ok(page.body.includes('state.atBottom'));
		assert.ok(page.body.includes('updateSessionOutput'));
		assert.ok(page.body.includes('output.appendChild(document.createTextNode'));
		assert.ok(page.body.includes('copy-session-output'));
		assert.ok(page.body.includes('navigator.clipboard.writeText'));
		assert.ok(page.body.includes("button.textContent = 'Copied'"));
		assert.ok(!page.body.includes('setInterval(refresh, 2000)'));

		const status = await requestJson(port, 'GET', '/v1/status');
		assert.strictEqual(status.statusCode, 200);
		assert.strictEqual(status.body.bridge.version, require('../package.json').version);
		assert.strictEqual(status.body.bridge.product_name, 'AI Model Relay');
		assert.ok(!Object.prototype.hasOwnProperty.call(status.body.bridge, 'paired_origins'));
		assert.strictEqual(status.body.jobs.running_count, 2);
		assert.strictEqual(status.body.jobs.queued_count, 1);
		assert.strictEqual(status.body.jobs.max_concurrent, 2);
		assert.strictEqual(status.body.asr.runtime_checked, false);
		assert.deepStrictEqual(status.body.jobs.active.map((job) => job.request_id), ['request-1', 'request-2']);
		assert.ok(status.body.jobs.active[0].session_output.includes('live output for codex-local:auto'));
		const unpairedStatus = await requestJson(port, 'GET', '/v1/status', null, { Origin: 'https://evil.example', 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(unpairedStatus.statusCode, 200);
		assert.strictEqual(unpairedStatus.headers['access-control-allow-origin'], 'https://evil.example');
		assert.strictEqual(unpairedStatus.body.bridge.version, require('../package.json').version);
		assert.ok(!Object.prototype.hasOwnProperty.call(unpairedStatus.body.bridge, 'paired_origins'));
		// Unpaired callers learn nothing about any job (ids, models, errors belong to paired origins).
		assert.deepStrictEqual(unpairedStatus.body.jobs.active.concat(unpairedStatus.body.jobs.queued, unpairedStatus.body.jobs.recent), []);
		assert.deepStrictEqual([unpairedStatus.body.jobs.running_count, unpairedStatus.body.jobs.queued_count], [0, 0]);
		assert.ok(!JSON.stringify(unpairedStatus.body).includes('request-1'));
		const serializedState = JSON.stringify(stateUpdates);
		assert.ok(serializedState.includes('request-1'));
		assert.ok(serializedState.includes('codex-local:gpt-5.4'));
		assert.ok(!serializedState.includes('secret prompt'));

		const capabilities = await requestJson(port, 'GET', '/v1/capabilities');
		assert.strictEqual(capabilities.statusCode, 200);
		assert.strictEqual(capabilities.body.asr.runtime_checked, false);

		const asrSettings = await requestJson(port, 'GET', '/v1/asr/settings');
		assert.strictEqual(asrSettings.statusCode, 200);
		assert.strictEqual(asrSettings.body.capabilities.runtime_checked, false);
		const asrRuntimeRefresh = await requestJson(port, 'GET', '/v1/asr/settings?refresh=1');
		assert.strictEqual(asrRuntimeRefresh.statusCode, 200);
		assert.strictEqual(asrRuntimeRefresh.body.capabilities.runtime_checked, true);
		assert.strictEqual(asrSettingsCalls.some((options) => options.refresh === true), true);

		const streamPayload = await new Promise((resolve, reject) => {
			let done = false;
			const timer = setTimeout(() => {
				if (done) {
					return;
				}
				done = true;
				req.destroy();
				reject(new Error('Timed out waiting for status events.'));
			}, 2000);
			const req = http.get({ hostname: '127.0.0.1', port, path: '/v1/status/events', headers: { Referer: `http://127.0.0.1:${port}/status` } }, (res) => {
				let raw = '';
				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					raw += chunk;
					const match = raw.match(/event: jobs\ndata: (.+)\n\n/);
					if (match && !done) {
						done = true;
						clearTimeout(timer);
						req.destroy();
						resolve({ statusCode: res.statusCode, contentType: res.headers['content-type'], body: JSON.parse(match[1]) });
					}
				});
			});
			req.on('error', (error) => {
				if (!done && error.code !== 'ECONNRESET') {
					done = true;
					clearTimeout(timer);
					reject(error);
				}
			});
		});
		assert.strictEqual(streamPayload.statusCode, 200);
		assert.ok(streamPayload.contentType.includes('text/event-stream'));
		assert.strictEqual(streamPayload.body.running_count, 2);
		assert.strictEqual(streamPayload.body.queued_count, 1);

		const rejectedStream = await requestJson(port, 'GET', '/v1/status/stream', null, { 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(rejectedStream.statusCode, 403);

		const pairedStream = await requestEvents(port, '/v1/status/stream', {
			Origin: 'http://127.0.0.1:8787',
			'X-Alorbach-Bridge-Token': 'test-token',
		}, ['status', 'capabilities', 'jobs']);
		assert.strictEqual(pairedStream.statusCode, 200);
		assert.ok(pairedStream.contentType.includes('text/event-stream'));
		assert.strictEqual(pairedStream.allowOrigin, 'http://127.0.0.1:8787');
		assert.strictEqual(pairedStream.events.status.success, true);
		assert.ok(!Object.prototype.hasOwnProperty.call(pairedStream.events.status.bridge, 'paired_origins'));
		assert.strictEqual(pairedStream.events.capabilities.success, true);
		assert.strictEqual(pairedStream.events.jobs.running_count, 2);
		assert.strictEqual(pairedStream.events.jobs.queued_count, 1);
		assert.ok(!pairedStream.raw.includes('test-token'));
		assert.ok(!pairedStream.raw.includes('secret prompt'));

		const localStatusEvents = await requestEvents(port, '/v1/status/events', { Referer: `http://127.0.0.1:${port}/status` }, ['status']);
		assert.strictEqual(localStatusEvents.statusCode, 200);
		assert.ok(Array.isArray(localStatusEvents.events.status.bridge.paired_origins));

		// A paired origin only sees the jobs it created. Every job above belongs to http://127.0.0.1:8787.
		const otherOrigin = { Origin: 'http://127.0.0.1:9999', 'X-Alorbach-Bridge-Token': 'test-token' };
		const ownStream = await requestEvents(port, '/v1/status/stream', { Origin: 'http://127.0.0.1:8787', 'X-Alorbach-Bridge-Token': 'test-token' }, ['status', 'jobs']);
		assert.strictEqual(ownStream.events.jobs.running_count, 2);
		assert.strictEqual(ownStream.events.status.jobs.running_count, 2);
		const otherStream = await requestEvents(port, '/v1/status/stream', otherOrigin, ['status', 'jobs']);
		assert.strictEqual(otherStream.statusCode, 200);
		assert.deepStrictEqual([otherStream.events.jobs.running_count, otherStream.events.jobs.queued_count], [0, 0]);
		assert.deepStrictEqual(otherStream.events.jobs.active.concat(otherStream.events.jobs.queued, otherStream.events.jobs.recent), []);
		assert.deepStrictEqual(otherStream.events.status.jobs.active, []);
		assert.ok(!otherStream.raw.includes('request-1'));
		assert.ok(!otherStream.raw.includes('live output'));
		const otherStatus = await requestJson(port, 'GET', '/v1/status', null, otherOrigin);
		assert.strictEqual(otherStatus.statusCode, 200);
		assert.deepStrictEqual(otherStatus.body.jobs.active, []);
		assert.ok(!JSON.stringify(otherStatus.body).includes('request-1'));
		assert.ok(!Object.prototype.hasOwnProperty.call(otherStatus.body.bridge, 'paired_origins'));
		// Integration clients paired from a plain-HTTP site keep the stream and artifact access they had before remote status pages.
		const httpSite = { Origin: 'http://wp.test', 'X-Alorbach-Bridge-Token': 'test-token' };
		const httpSiteStream = await requestEvents(port, '/v1/status/stream', httpSite, ['jobs']);
		assert.strictEqual(httpSiteStream.statusCode, 200);
		assert.strictEqual((await requestJson(port, 'GET', '/v1/status/jobs/999/artifacts/0', null, httpSite)).statusCode, 404);
		assert.strictEqual((await requestJson(port, 'GET', '/v1/relay/jobs/none/artifact', null, httpSite)).statusCode, 404);
		assert.strictEqual((await requestJson(port, 'GET', '/v1/relay/jobs/none/artifact?bridge_token=test-token', null, { ...httpSite, 'X-Alorbach-Bridge-Token': '' })).statusCode, 400);
		const ownStatus = await requestJson(port, 'GET', '/v1/status');
		assert.strictEqual(ownStatus.body.jobs.active.length, 2);

		// Host and Origin are client-controlled: a proxied request must never count as the local viewer.
		const localPage = { Origin: `http://127.0.0.1:${port}`, 'X-Alorbach-Bridge-Token': '' };
		for (const forwarding of [{ 'X-Forwarded-For': '203.0.113.9' }, { 'X-Forwarded-Host': 'relay.example' }, { 'X-Forwarded-Proto': 'https' }, { Forwarded: 'for=203.0.113.9' }, { 'X-Real-IP': '203.0.113.9' }, { 'CF-Connecting-IP': '203.0.113.9' }, { Via: '1.1 proxy' }, { 'X-Forwarded-Server': 'proxy' }, { 'X-Original-Host': 'relay.example' }, { 'X-Host': 'relay.example' }, { 'X-Forwarded-SSL': 'on' }]) {
			const headers = { ...localPage, ...forwarding };
			const label = Object.keys(forwarding)[0];
			const forwardedStatus = await requestJson(port, 'GET', '/v1/status', null, headers);
			assert.ok(!Object.prototype.hasOwnProperty.call(forwardedStatus.body.bridge, 'paired_origins'), label);
			assert.deepStrictEqual(forwardedStatus.body.jobs.active, [], label);
			assert.ok(!JSON.stringify(forwardedStatus.body).includes('request-1'), label);
			assert.strictEqual((await requestJson(port, 'GET', '/v1/status/events', null, headers)).statusCode, 403, label);
			assert.strictEqual((await requestJson(port, 'GET', '/v1/relay/pairing-code', null, headers)).statusCode, 403, label);
			assert.strictEqual((await requestJson(port, 'POST', '/v1/relay/pairing-code', { pairing_code: '123456' }, headers)).statusCode, 403, label);
			assert.strictEqual((await requestJson(port, 'POST', '/v1/relay/refresh', {}, headers)).statusCode, 403, label);
			assert.strictEqual((await requestJson(port, 'POST', '/v1/relay/settings', {}, headers)).statusCode, 403, label);
			assert.strictEqual((await requestJson(port, 'GET', '/v1/relay/providers/anthropic/usage', null, headers)).statusCode, 403, label);
		}
		// Header-less loopback requests are never the local viewer, and the usage 403 carries the stable code.
		const bareStatus = await requestJson(port, 'GET', '/v1/status', null, { Origin: null, 'X-Alorbach-Bridge-Token': '' });
		assert.deepStrictEqual(bareStatus.body.jobs.active.concat(bareStatus.body.jobs.queued, bareStatus.body.jobs.recent), []);
		assert.ok(!Object.prototype.hasOwnProperty.call(bareStatus.body.bridge, 'paired_origins'));
		const bareUsage = await requestJson(port, 'GET', '/v1/relay/providers/anthropic/usage', null, { Origin: null, 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(bareUsage.statusCode, 403);
		assert.strictEqual(bareUsage.body.code, 'origin_not_paired');
		for (const header of ['X-Client-IP', 'Fastly-Client-IP', 'X-Cluster-Client-IP', 'X-Azure-ClientIP', 'X-Original-Forwarded-For']) {
			assert.strictEqual((await requestJson(port, 'GET', '/v1/relay/pairing-code', null, { ...localPage, [header]: '203.0.113.9' })).statusCode, 403, header);
		}
		// An IPv6 loopback page origin with a matching Host counts as local.
		const ipv6Page = { Origin: `http://[::1]:${port}`, Host: `[::1]:${port}`, 'X-Alorbach-Bridge-Token': '' };
		assert.strictEqual((await requestJson(port, 'GET', '/v1/relay/pairing-code', null, ipv6Page)).statusCode, 200);
		// Without forwarding headers the same local page request is still trusted.
		const directStatus = await requestJson(port, 'GET', '/v1/status', null, localPage);
		assert.ok(Array.isArray(directStatus.body.bridge.paired_origins));
		assert.strictEqual((await requestJson(port, 'GET', '/v1/relay/pairing-code', null, localPage)).statusCode, 200);

		// Tokens in the URL are not accepted on the status-page routes.
		const usageQueryToken = await requestJson(port, 'GET', '/v1/relay/providers/anthropic/usage?bridge_token=test-token', null, { Origin: 'https://remote.example', 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(usageQueryToken.statusCode, 400);
		const testQueryToken = await requestJson(port, 'POST', '/v1/relay/test?bridge_token=test-token', {}, { Origin: 'https://remote.example', 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(testQueryToken.statusCode, 400);
		const streamQueryToken = await requestJson(port, 'GET', '/v1/status/stream?bridge_token=test-token', null, { Origin: 'https://remote.example', 'X-Alorbach-Bridge-Token': '' });
		assert.strictEqual(streamQueryToken.statusCode, 400);
		const statusQueryToken = await requestJson(port, 'GET', '/v1/status?bridge_token=test-token', null, { Origin: 'https://remote.example', 'X-Alorbach-Bridge-Token': '' });
		assert.deepStrictEqual(statusQueryToken.body.jobs.active, [], 'a query token does not unlock status diagnostics');

		pending[1].resolve({ success: true, response: { id: 'second' } });
		const secondResult = await second;
		assert.strictEqual(secondResult.statusCode, 200);
		await waitFor(() => pending.length === 3);

		pending[0].resolve({ success: true, response: { id: 'first' } });
		pending[2].resolve({ success: true, response: { id: 'third' } });
		const [firstResult, thirdResult] = await Promise.all([first, third]);
		assert.strictEqual(firstResult.statusCode, 200);
		assert.strictEqual(thirdResult.statusCode, 200);
		const completedStatus = await requestJson(port, 'GET', '/v1/status');
		assert.ok(completedStatus.body.jobs.recent.some((job) => job.status === 'completed' && String(job.session_output || '').includes('live output for codex-local:auto')));

		const failed = requestJson(port, 'POST', '/v1/chat', body('failed'));
		await waitFor(() => pending.length === 4);
		pending[3].resolve({ success: false, message: 'Codex CLI chat request failed.', details: { stderr: 'mock failure' } });
		const failedResult = await failed;
		assert.strictEqual(failedResult.statusCode, 500);
		assert.strictEqual(failedResult.body.debug_help.request_id, 'request-failed');
		assert.ok(failedResult.body.debug_help.status_page.includes('/status'));
		assert.ok(failedResult.body.debug_help.status_json.includes('/v1/status'));
		assert.ok(Array.isArray(failedResult.body.debug_help.checks));

		const failedStatus = await requestJson(port, 'GET', '/v1/status');
		assert.strictEqual(failedStatus.body.jobs.recent[0].status, 'failed');
		assert.strictEqual(failedStatus.body.jobs.recent[0].error_message, 'Codex CLI chat request failed.');
		assert.ok(failedStatus.body.jobs.recent[0].session_output.includes('STDERR:\nmock failure'));
		assert.ok(!JSON.stringify(failedStatus.body.jobs).includes('secret prompt'));
	} finally {
		if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	}

	console.log('server job tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
