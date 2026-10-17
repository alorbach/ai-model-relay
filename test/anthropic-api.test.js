'use strict';

const assert = require('assert');
const { createAnthropicApiDriver, createBackendRegistry, providerFromPayload } = require('../src/backend-registry');
const { createAnthropicUsage, rateLimitSnapshot, resetRateLimitSnapshot } = require('../src/anthropic-usage');

const savedEnv = {};
for (const name of ['ANTHROPIC_API_KEY', 'AI_MODEL_RELAY_ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'AI_MODEL_RELAY_ANTHROPIC_MODELS', 'AI_MODEL_RELAY_ANTHROPIC_FALLBACKS']) {
	savedEnv[name] = process.env[name];
	delete process.env[name];
}

const KEY = 'sk-ant-api03-SECRETKEYVALUE1234';

function fakeResponse(status, body, headers = {}) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: new Headers(headers),
		json: async () => body,
		text: async () => JSON.stringify(body),
	};
}

function recorder(responder) {
	const calls = [];
	const fetch = async (url, init = {}) => {
		calls.push({ url, init, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null });
		return responder(url, init, calls.length);
	};
	return { calls, fetch };
}

const okBody = (extra = {}) => ({
	id: 'msg_1',
	model: 'claude-opus-5-5',
	stop_reason: 'end_turn',
	content: [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' world' }],
	usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 3, cache_read_input_tokens: 2 },
	...extra,
});

async function testDriverRequest() {
	const rec = recorder(() => fakeResponse(200, okBody()));
	const driver = createAnthropicApiDriver({ apiKey: KEY, fetch: rec.fetch, baseUrl: 'https://x.test/v1/' });
	const png = 'data:image/png;base64,AAAA';
	const result = await driver.chat({
		model: 'model-relay:anthropic:claude-opus-5-5',
		temperature: 0.2,
		top_p: 0.9,
		effort: 'high',
		messages: [
			{ role: 'system', content: 'Be brief.' },
			{ role: 'developer', content: 'Use plain text.' },
			{ role: 'user', content: [
				{ type: 'text', text: 'Look' },
				{ type: 'image_url', image_url: { url: png } },
				{ type: 'image_url', image_url: { url: 'https://img.test/a.jpg' } },
			] },
		],
	});
	assert.strictEqual(result.success, true);
	const call = rec.calls[0];
	assert.strictEqual(call.url, 'https://x.test/v1/messages');
	assert.strictEqual(call.init.method, 'POST');
	assert.strictEqual(call.headers['x-api-key'], KEY);
	assert.strictEqual(call.headers['anthropic-version'], '2023-06-01');
	// Custom gateways never get the fallback beta.
	assert.ok(!('anthropic-beta' in call.headers));
	assert.ok(!('fallbacks' in call.body));
	assert.strictEqual(call.body.model, 'claude-opus-5-5');
	assert.strictEqual(call.body.system, 'Be brief.\n\nUse plain text.');
	assert.ok(!('temperature' in call.body));
	assert.ok(!('top_p' in call.body));
	assert.deepStrictEqual(call.body.output_config, { effort: 'high' });
	assert.strictEqual(call.body.messages.length, 1);
	assert.deepStrictEqual(call.body.messages[0].content, [
		{ type: 'text', text: 'Look' },
		{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
		{ type: 'image', source: { type: 'url', url: 'https://img.test/a.jpg' } },
	]);

	// Direct api.anthropic.com calls get fallbacks for listed models.
	const directRec = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: directRec.fetch }).chat({ model: 'model-relay:anthropic:claude-opus-5-5', prompt: 'hi' });
	assert.strictEqual(directRec.calls[0].headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
	assert.strictEqual(directRec.calls[0].body.fallbacks, 'default');
	const gatewayRec = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: gatewayRec.fetch, baseUrl: 'https://x.test' }).chat({ model: 'model-relay:anthropic:claude-opus-5-5', prompt: 'hi' });
	assert.ok(!('anthropic-beta' in gatewayRec.calls[0].headers));
	assert.ok(!('fallbacks' in gatewayRec.calls[0].body));

	// No fallbacks for models outside the list, or when disabled.
	const haikuRec = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: haikuRec.fetch }).chat({ model: 'model-relay:anthropic:claude-haiku-5-5', prompt: 'hi' });
	assert.strictEqual(haikuRec.calls[0].url, 'https://api.anthropic.com/v1/messages');
	assert.ok(!('anthropic-beta' in haikuRec.calls[0].headers));
	assert.ok(!('fallbacks' in haikuRec.calls[0].body));
	assert.ok(!('output_config' in haikuRec.calls[0].body));
	const offRec = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: offRec.fetch, fallbacks: false }).chat({ model: 'model-relay:anthropic:claude-opus-5-5', prompt: 'hi' });
	assert.ok(!('anthropic-beta' in offRec.calls[0].headers));
	assert.ok(!('fallbacks' in offRec.calls[0].body));

	// auto resolves to the first configured model.
	const autoRec = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: autoRec.fetch, models: 'claude-sonnet-5-5, claude-haiku-5-5' }).chat({ model: 'model-relay:anthropic:auto', prompt: 'hi' });
	assert.strictEqual(autoRec.calls[0].body.model, 'claude-sonnet-5-5');
}

async function testResponseNormalization() {
	resetRateLimitSnapshot();
	const rec = recorder(() => fakeResponse(200, okBody({ stop_reason: 'max_tokens' })));
	const result = await createAnthropicApiDriver({ apiKey: KEY, fetch: rec.fetch }).chat({ model: 'model-relay:anthropic:claude-opus-5-5', prompt: 'hi' });
	assert.strictEqual(result.success, true);
	assert.strictEqual(result.response.choices[0].message.content, 'Hello world');
	assert.strictEqual(result.response.choices[0].finish_reason, 'length');
	assert.strictEqual(result.response.model, 'model-relay:anthropic:claude-opus-5-5');
	assert.deepStrictEqual(result.response.usage, { prompt_tokens: 15, completion_tokens: 5, total_tokens: 20 });
	const normal = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => fakeResponse(200, okBody())).fetch }).chat({ model: 'model-relay:anthropic:claude-opus-5-5', prompt: 'hi' });
	assert.strictEqual(normal.response.choices[0].finish_reason, 'stop');
}

async function testErrors() {
	const refusal = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => fakeResponse(200, okBody({ stop_reason: 'refusal', stop_details: { category: 'x', explanation: 'No.' } }))).fetch }).chat({ prompt: 'hi' });
	assert.strictEqual(refusal.success, false);
	assert.strictEqual(refusal.code, 'anthropic_refusal');

	const unauthorized = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => fakeResponse(401, { error: { type: 'authentication_error', message: `invalid x-api-key ${KEY}` } })).fetch }).chat({ prompt: 'hi' });
	assert.strictEqual(unauthorized.success, false);
	assert.strictEqual(unauthorized.category, 'configuration');
	assert.ok(!JSON.stringify(unauthorized).includes(KEY));

	const limited = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => fakeResponse(429, { error: { type: 'rate_limit_error', message: 'slow down' } })).fetch }).chat({ prompt: 'hi' });
	assert.strictEqual(limited.category, 'rate_limit');
	assert.strictEqual(limited.retryable, true);

	const overloaded = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => fakeResponse(529, { error: { type: 'overloaded_error', message: 'busy' } })).fetch }).chat({ prompt: 'hi' });
	assert.strictEqual(overloaded.success, false);
	assert.strictEqual(overloaded.retryable, true);

	const missing = await createAnthropicApiDriver({ fetch: recorder(() => fakeResponse(200, okBody())).fetch }).chat({ prompt: 'hi' });
	assert.strictEqual(missing.success, false);
	assert.strictEqual(missing.code, 'anthropic_api_key_missing');
}

async function testRequestValidationAndShape() {
	const model = 'model-relay:anthropic:claude-opus-5-5';
	const jpg = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: jpg.fetch }).chat({ model, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/jpg;base64,AAAA' } }] }] });
	assert.strictEqual(jpg.calls[0].body.messages[0].content[0].source.media_type, 'image/jpeg');

	const bmp = recorder(() => fakeResponse(200, okBody()));
	const unsupported = await createAnthropicApiDriver({ apiKey: KEY, fetch: bmp.fetch }).chat({ model, messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }, { type: 'image_url', image_url: { url: 'data:image/bmp;base64,AAAA' } }] }] });
	assert.strictEqual(unsupported.success, false);
	assert.strictEqual(unsupported.category, 'validation');
	assert.strictEqual(unsupported.code, 'anthropic_image_unsupported');
	assert.strictEqual(bmp.calls.length, 0);

	// Image references that are neither supported data URLs nor http(s) URLs are rejected, never silently dropped.
	for (const ref of ['C:\\Users\\x\\photo.png', 'file:///tmp/photo.png', 'images/photo.png']) {
		const local = recorder(() => fakeResponse(200, okBody()));
		const withText = await createAnthropicApiDriver({ apiKey: KEY, fetch: local.fetch }).chat({ model, messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }, { type: 'image_url', image_url: { url: ref } }] }] });
		assert.strictEqual(withText.code, 'anthropic_image_unsupported', ref);
		assert.strictEqual(withText.message, 'Claude API accepts PNG, JPEG, GIF, or WebP images as data URLs or http(s) URLs.');
		assert.strictEqual(local.calls.length, 0);
	}
	const imageOnly = recorder(() => fakeResponse(200, okBody()));
	const onlyFile = await createAnthropicApiDriver({ apiKey: KEY, fetch: imageOnly.fetch }).chat({ model, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'file:///tmp/photo.png' } }] }] });
	assert.strictEqual(onlyFile.code, 'anthropic_image_unsupported');
	assert.strictEqual(imageOnly.calls.length, 0);

	// Base64 payload whitespace is stripped; invalid base64 is rejected.
	const wrapped = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: wrapped.fetch }).chat({ model, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA\nBBBB\r\nCC==' } }] }] });
	assert.strictEqual(wrapped.calls[0].body.messages[0].content[0].source.data, 'AAAABBBBCC==');
	const badBase64 = recorder(() => fakeResponse(200, okBody()));
	const badResult = await createAnthropicApiDriver({ apiKey: KEY, fetch: badBase64.fetch }).chat({ model, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA!A' } }] }] });
	assert.strictEqual(badResult.code, 'anthropic_image_unsupported');
	assert.strictEqual(badBase64.calls.length, 0);

	const lead = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: lead.fetch }).chat({ model, messages: [{ role: 'assistant', content: 'hi there' }, { role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }] });
	assert.deepStrictEqual(lead.calls[0].body.messages.map((m) => m.role), ['user', 'assistant']);

	// A single object content part is converted like a one-element array; other non-array content is dropped, never "[object Object]".
	const single = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: single.fetch }).chat({ model, messages: [{ role: 'user', content: { type: 'text', text: 'solo' } }] });
	assert.deepStrictEqual(single.calls[0].body.messages[0].content, [{ type: 'text', text: 'solo' }]);
	const numeric = recorder(() => fakeResponse(200, okBody()));
	const numericResult = await createAnthropicApiDriver({ apiKey: KEY, fetch: numeric.fetch }).chat({ model, messages: [{ role: 'user', content: 42 }, { role: 'user', content: { foo: 'bar' } }] });
	assert.strictEqual(numericResult.success, false);
	assert.strictEqual(numericResult.code, 'anthropic_messages_empty');
	assert.ok(!JSON.stringify(numeric.calls).includes('[object Object]'));

	const empty = recorder(() => fakeResponse(200, okBody()));
	const none = await createAnthropicApiDriver({ apiKey: KEY, fetch: empty.fetch }).chat({ model, messages: [{ role: 'assistant', content: 'only me' }] });
	assert.strictEqual(none.success, false);
	assert.strictEqual(none.code, 'anthropic_messages_empty');
	assert.strictEqual(empty.calls.length, 0);

	// HTTP 200 with a non-JSON or content-less body is an error, not an empty success.
	const badText = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => ({ ok: true, status: 200, headers: new Headers(), text: async () => 'not json' })).fetch }).chat({ model, prompt: 'hi' });
	assert.strictEqual(badText.success, false);
	assert.strictEqual(badText.code, 'anthropic_api_failed');
	assert.strictEqual(badText.message, 'Claude API returned an unexpected response.');
	assert.strictEqual(badText.details.status, 200);
	const noContent = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => fakeResponse(200, { id: 'x' })).fetch }).chat({ model, prompt: 'hi' });
	assert.strictEqual(noContent.code, 'anthropic_api_failed');

	// Body read failures: timeout, cancellation.
	const failingBody = (error) => ({ ok: true, status: 200, headers: new Headers(), text: async () => { throw error; } });
	const timeoutError = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
	const timedOut = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => failingBody(timeoutError)).fetch }).chat({ model, prompt: 'hi' });
	assert.strictEqual(timedOut.category, 'timeout');
	assert.strictEqual(timedOut.code, 'anthropic_api_timeout');
	assert.strictEqual(timedOut.retryable, true);
	const controller = new AbortController();
	const cancelled = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => { controller.abort(); return failingBody(Object.assign(new Error('aborted'), { name: 'AbortError' })); }).fetch }).chat({ model, prompt: 'hi' }, { signal: controller.signal });
	assert.strictEqual(cancelled.category, 'cancelled');

	// Only the size-limit error maps to the size message; other read failures are retryable network errors.
	const tooBig = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => failingBody(new Error('Provider download exceeds the maximum size.'))).fetch }).chat({ model, prompt: 'hi' });
	assert.strictEqual(tooBig.code, 'anthropic_api_failed');
	assert.strictEqual(tooBig.message, 'Claude API response exceeded the maximum size.');
	const reset = await createAnthropicApiDriver({ apiKey: KEY, fetch: recorder(() => failingBody(new Error('terminated'))).fetch }).chat({ model, prompt: 'hi' });
	assert.strictEqual(reset.success, false);
	assert.strictEqual(reset.category, 'api');
	assert.strictEqual(reset.code, 'anthropic_api_network');
	assert.strictEqual(reset.message, 'Claude API connection failed while reading the response.');
	assert.strictEqual(reset.retryable, true);
	assert.deepStrictEqual(reset.details, { provider: 'anthropic-api' });

	// fetch rejecting before headers resolves to a result instead of rejecting.
	const refused = await createAnthropicApiDriver({ apiKey: KEY, fetch: async () => { throw new TypeError('fetch failed'); } }).chat({ model, prompt: 'hi' });
	assert.strictEqual(refused.success, false);
	assert.strictEqual(refused.code, 'anthropic_api_network');
	assert.strictEqual(refused.retryable, true);
	const fetchTimeout = await createAnthropicApiDriver({ apiKey: KEY, fetch: async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); } }).chat({ model, prompt: 'hi' });
	assert.strictEqual(fetchTimeout.category, 'timeout');
	assert.strictEqual(fetchTimeout.code, 'anthropic_api_timeout');
	const fetchController = new AbortController();
	const fetchCancelled = await createAnthropicApiDriver({ apiKey: KEY, fetch: async () => { fetchController.abort(); throw Object.assign(new Error('aborted'), { name: 'AbortError' }); } }).chat({ model, prompt: 'hi' }, { signal: fetchController.signal });
	assert.strictEqual(fetchCancelled.category, 'cancelled');

	// Whitespace-only text parts are dropped like whitespace-only string content.
	const ws = recorder(() => fakeResponse(200, okBody()));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: ws.fetch }).chat({ model, messages: [{ role: 'user', content: [{ type: 'text', text: '  \n' }, '   ', { type: 'text', text: 'real' }] }] });
	assert.deepStrictEqual(ws.calls[0].body.messages[0].content, [{ type: 'text', text: 'real' }]);
	const wsOnly = recorder(() => fakeResponse(200, okBody()));
	const wsResult = await createAnthropicApiDriver({ apiKey: KEY, fetch: wsOnly.fetch }).chat({ model, messages: [{ role: 'user', content: [{ type: 'text', text: ' ' }] }] });
	assert.strictEqual(wsResult.code, 'anthropic_messages_empty');
	assert.strictEqual(wsOnly.calls.length, 0);
}

async function testRateLimitHeaders() {
	resetRateLimitSnapshot();
	assert.strictEqual(rateLimitSnapshot(), null);
	const rec = recorder(() => fakeResponse(200, okBody(), {
		'anthropic-ratelimit-requests-limit': '1000',
		'anthropic-ratelimit-requests-remaining': '999',
		'anthropic-ratelimit-requests-reset': '2026-10-17T10:00:00Z',
		'anthropic-ratelimit-input-tokens-limit': '450000',
		'anthropic-ratelimit-input-tokens-remaining': '449000',
		'anthropic-ratelimit-input-tokens-reset': '2026-10-17T10:00:01Z',
	}));
	await createAnthropicApiDriver({ apiKey: KEY, fetch: rec.fetch }).chat({ prompt: 'hi' });
	const snapshot = rateLimitSnapshot();
	assert.strictEqual(snapshot.requests_limit, 1000);
	assert.strictEqual(snapshot.requests_remaining, 999);
	assert.strictEqual(snapshot.requests_reset, '2026-10-17T10:00:00Z');
	assert.strictEqual(snapshot.input_tokens_limit, 450000);
	assert.strictEqual(snapshot.input_tokens_remaining, 449000);
	assert.strictEqual(typeof snapshot.input_tokens_reset, 'string');
	assert.ok(Number.isFinite(Date.parse(snapshot.observed_at)));
	assert.ok(!('tokens_limit' in snapshot));
	resetRateLimitSnapshot();
	assert.strictEqual(rateLimitSnapshot(), null);
}

const codexStub = {
	checkStatus: () => ({ success: true, message: 'ready' }),
	capabilities: () => ({ success: true, bridge_features: { chat: true, images: true }, codex: { version: 'codex mock' } }),
	models: () => ({ success: true, models: { text: ['codex-local:auto'], image: [] } }),
	asrStatus: () => ({ enabled: false, ready: false, models: [] }),
	chat: (payload) => Promise.resolve({ success: true, response: { model: payload.model } }),
};

async function testRegistry() {
	assert.strictEqual(providerFromPayload({ model: 'model-relay:anthropic:claude-opus-5-5' }), 'anthropic-api');
	assert.strictEqual(providerFromPayload({ model: 'model-relay:claude:claude-opus-5-5' }), 'anthropic-api');
	const rec = recorder(() => fakeResponse(200, okBody()));
	const registry = createBackendRegistry({ codex: codexStub, anthropic: { apiKey: 'k', fetch: rec.fetch } });
	const resolved = registry.resolve('chat', { model: 'model-relay:anthropic:claude-opus-5-5' });
	assert.ok(!resolved.error, JSON.stringify(resolved.error));
	assert.strictEqual(resolved.driver.id, 'anthropic-api');
	const ran = await registry.run('chat', { model: 'model-relay:anthropic:claude-opus-5-5', prompt: 'hi' });
	assert.strictEqual(ran.success, true);
	assert.strictEqual(rec.calls.length, 1);
	const listed = registry.list().find((driver) => driver.id === 'anthropic-api');
	assert.strictEqual(listed.capabilities().ready, true);
	const unready = createBackendRegistry({ codex: codexStub }).list().find((driver) => driver.id === 'anthropic-api');
	assert.strictEqual(unready.capabilities().ready, false);
	const caps = createAnthropicApiDriver({ apiKey: 'k' }).capabilities();
	assert.strictEqual(caps.ready, true);
	assert.deepStrictEqual(caps.models, ['model-relay:anthropic:claude-opus-5-5', 'model-relay:anthropic:claude-sonnet-5-5', 'model-relay:anthropic:claude-haiku-5-5']);
	assert.strictEqual(createAnthropicApiDriver({}).capabilities().ready, false);
}

async function testUsage() {
	resetRateLimitSnapshot();
	// No admin key: nothing is fetched.
	const noKey = recorder(() => { throw new Error('fetch must not be called'); });
	const noKeyReport = await createAnthropicUsage({ fetch: noKey.fetch, getConfig: () => ({ api_key: KEY }), now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(noKeyReport.cost_report.available, false);
	assert.strictEqual(noKey.calls.length, 0);
	assert.deepStrictEqual(noKeyReport.configured, { api_key: true, admin_api_key: false });

	const ADMIN = 'sk-ant-admin01-ADMINSECRET9876';
	const bucket = (start, cents) => ({ starting_at: start, ending_at: start, results: [{ amount: cents, currency: 'USD' }] });
	const pages = [
		{ data: [bucket('2026-09-29T00:00:00Z', '1000'), bucket('2026-09-30T00:00:00Z', '200'), bucket('2026-10-01T00:00:00Z', '1234.5')], has_more: true, next_page: 'cursor-2' },
		{ data: [bucket('2026-10-10T00:00:00Z', '500'), { starting_at: '2026-10-16T00:00:00Z', results: [{ amount: '100' }, { amount: '50.5' }] }], has_more: false, next_page: null },
	];
	const monthPage = { data: [bucket('2026-10-01T00:00:00Z', '1234.5'), bucket('2026-10-10T00:00:00Z', '500'), { starting_at: '2026-10-16T00:00:00Z', results: [{ amount: '100' }, { amount: '50.5' }] }], has_more: false, next_page: null };
	// A balance from the previous month is fetched separately from the month range (month first).
	const rec = recorder((url) => fakeResponse(200, new URL(url).searchParams.get('starting_at') === '2026-10-01T00:00:00.000Z' ? monthPage : (url.includes('page=cursor-2') ? pages[1] : pages[0])));
	// as_of in the previous month (2026-09-30 15:00 UTC) -> counts from 2026-09-30 00:00 UTC.
	const config = { api_key: KEY, admin_api_key: ADMIN, monthly_limit_usd: '100', credit_balance_usd: '50', credit_balance_as_of: '2026-09-30T15:00:00.000Z' };
	const usage = createAnthropicUsage({ fetch: rec.fetch, getConfig: () => config, now: () => new Date('2026-10-17T12:00:00Z'), cacheMs: 60000 });
	const report = await usage.report();
	assert.strictEqual(rec.calls.length, 3);
	const first = new URL(rec.calls[0].url);
	assert.strictEqual(first.pathname, '/v1/organizations/cost_report');
	assert.strictEqual(first.origin, 'https://api.anthropic.com');
	assert.strictEqual(first.searchParams.get('bucket_width'), '1d');
	assert.strictEqual(first.searchParams.get('limit'), '31');
	assert.strictEqual(first.searchParams.get('starting_at'), '2026-10-01T00:00:00.000Z');
	assert.strictEqual(first.searchParams.get('ending_at'), '2026-10-18T00:00:00.000Z');
	assert.strictEqual(first.searchParams.get('page'), null);
	const balanceCall = new URL(rec.calls[1].url);
	assert.strictEqual(balanceCall.searchParams.get('starting_at'), '2026-09-30T00:00:00.000Z');
	assert.strictEqual(balanceCall.searchParams.get('ending_at'), '2026-10-18T00:00:00.000Z');
	assert.strictEqual(new URL(rec.calls[2].url).searchParams.get('page'), 'cursor-2');
	assert.strictEqual(rec.calls[0].headers['x-api-key'], ADMIN);
	assert.strictEqual(rec.calls[0].headers['anthropic-version'], '2023-06-01');
	assert.strictEqual(report.cost_report.available, true);
	// Month: 1234.5 + 500 + 150.5 cents = 1885 cents.
	assert.strictEqual(report.month.spend_usd, 18.85);
	assert.strictEqual(report.month.remaining_usd, 81.15);
	assert.strictEqual(report.month.limit_usd, 100);
	// Credits: 200 + 1234.5 + 500 + 150.5 = 2085 cents (the 09-29 bucket is before the as_of day).
	assert.strictEqual(report.credits.spent_since_usd, 20.85);
	assert.strictEqual(report.credits.remaining_usd, 29.15);

	// Trailing /v1 on the configured base URL is stripped case-insensitively.
	const upperRec = recorder(() => fakeResponse(200, { data: [], has_more: false, next_page: null }));
	await createAnthropicUsage({ fetch: upperRec.fetch, getConfig: () => ({ ...config, base_url: 'https://x.test/V1/' }), now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.ok(upperRec.calls[0].url.startsWith('https://x.test/v1/organizations/cost_report?'), upperRec.calls[0].url);

	// Caching.
	await usage.report();
	assert.strictEqual(rec.calls.length, 3);
	await usage.report({ force: true });
	assert.strictEqual(rec.calls.length, 6);

	// Balance range too long to read: month spend is still reported, credits are null with a reason.
	const longRec = recorder((url) => new URL(url).searchParams.get('starting_at') === '2026-10-01T00:00:00.000Z'
		? fakeResponse(200, monthPage)
		: fakeResponse(200, { data: [], has_more: true, next_page: 'again' }));
	const longReport = await createAnthropicUsage({ fetch: longRec.fetch, getConfig: () => config, now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(longReport.cost_report.available, true);
	assert.strictEqual(longReport.month.spend_usd, 18.85);
	assert.strictEqual(longReport.month.remaining_usd, 81.15);
	assert.strictEqual(longReport.credits.remaining_usd, null);
	assert.strictEqual(longReport.credits.spent_since_usd, null);
	assert.ok(/too old to recount/.test(longReport.credits.reason));
	assert.ok(/Recount spend from today/.test(longReport.cost_report.credits_reason));
	// Balance range request fails outright (not an overflow): month data still stands.
	const failRec = recorder((url) => new URL(url).searchParams.get('starting_at') === '2026-10-01T00:00:00.000Z'
		? fakeResponse(200, monthPage)
		: fakeResponse(500, { error: { message: 'boom ' + ADMIN } }));
	const failReport = await createAnthropicUsage({ fetch: failRec.fetch, getConfig: () => config, now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(failReport.month.spend_usd, 18.85);
	assert.strictEqual(failReport.credits.remaining_usd, null);
	assert.ok(failReport.credits.reason && !failReport.credits.reason.includes(ADMIN));

	// as_of within the current month: only buckets on/after that UTC day count for credits.
	const rec2 = recorder(() => fakeResponse(200, { data: [bucket('2026-10-01T00:00:00Z', '1000'), bucket('2026-10-10T00:00:00Z', '300'), bucket('2026-10-12T00:00:00Z', '700')], has_more: false }));
	const report2 = await createAnthropicUsage({ fetch: rec2.fetch, getConfig: () => ({ ...config, credit_balance_as_of: '2026-10-10T08:00:00.000Z' }), now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(new URL(rec2.calls[0].url).searchParams.get('starting_at'), '2026-10-01T00:00:00.000Z');
	assert.strictEqual(report2.month.spend_usd, 20);
	assert.strictEqual(report2.credits.spent_since_usd, 10);
	assert.strictEqual(report2.credits.remaining_usd, 40);
	assert.strictEqual(rec2.calls.length, 1);
	assert.strictEqual(report2.credits.reason, undefined);

	// 401 -> unavailable, key never leaked.
	const denied = recorder(() => fakeResponse(401, { error: { type: 'authentication_error', message: 'bad key ' + ADMIN } }));
	const deniedReport = await createAnthropicUsage({ fetch: denied.fetch, getConfig: () => config, now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(deniedReport.cost_report.available, false);
	assert.ok(/Admin API key/.test(deniedReport.cost_report.reason));
	// Malformed body, and endless pagination, are reported instead of returning partial data.
	const malformed = await createAnthropicUsage({ fetch: recorder(() => fakeResponse(200, { oops: true })).fetch, getConfig: () => config, now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(malformed.cost_report.available, false);
	assert.strictEqual(malformed.cost_report.reason, 'Cost report returned an unexpected response.');
	assert.strictEqual(malformed.month.spend_usd, null);
	const endless = recorder(() => fakeResponse(200, { data: [], has_more: true, next_page: 'again' }));
	const endlessReport = await createAnthropicUsage({ fetch: endless.fetch, getConfig: () => config, now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(endlessReport.cost_report.available, false);
	assert.ok(/more pages than Relay reads/.test(endlessReport.cost_report.reason));
	assert.strictEqual(endlessReport.credits.remaining_usd, null);
	// has_more without a cursor, a non-numeric amount, or an unparseable bucket date fail the whole report instead of undercounting.
	const noCursor = await createAnthropicUsage({ fetch: recorder(() => fakeResponse(200, { data: [bucket('2026-10-10T00:00:00Z', '500')], has_more: true })).fetch, getConfig: () => config, now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(noCursor.cost_report.available, false);
	assert.strictEqual(noCursor.cost_report.reason, 'Cost report returned an unexpected response.');
	assert.strictEqual(noCursor.month.spend_usd, null);
	const badAmount = await createAnthropicUsage({ fetch: recorder(() => fakeResponse(200, { data: [bucket('2026-10-10T00:00:00Z', 'oops')], has_more: false })).fetch, getConfig: () => config, now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(badAmount.cost_report.available, false);
	assert.strictEqual(badAmount.cost_report.reason, 'Cost report returned an unexpected response.');
	assert.strictEqual(badAmount.month.spend_usd, null);
	const badDate = await createAnthropicUsage({ fetch: recorder(() => fakeResponse(200, { data: [bucket('not-a-date', '500')], has_more: false })).fetch, getConfig: () => config, now: () => new Date('2026-10-17T12:00:00Z') }).report();
	assert.strictEqual(badDate.cost_report.available, false);
	assert.strictEqual(badDate.cost_report.reason, 'Cost report returned an unexpected response.');
	assert.strictEqual(badDate.credits.remaining_usd, null);

	// Inflight dedupe: same config shares a build; force or a changed config starts its own.
	let release;
	const gate = new Promise((resolve) => { release = resolve; });
	let current = { ...config };
	const slow = recorder(async () => { await gate; return fakeResponse(200, { data: [], has_more: false }); });
	const dedupe = createAnthropicUsage({ fetch: slow.fetch, getConfig: () => current, now: () => new Date('2026-10-17T12:00:00Z') });
	const a = dedupe.report();
	const b = dedupe.report();
	const c = dedupe.report({ force: true });
	await new Promise((resolve) => setImmediate(resolve));
	assert.strictEqual(slow.calls.length, 2);
	current = { ...config, monthly_limit_usd: '5' };
	const d = dedupe.report();
	await new Promise((resolve) => setImmediate(resolve));
	assert.strictEqual(slow.calls.length, 3);
	release();
	const results = await Promise.all([a, b, c, d]);
	assert.strictEqual(results[0], results[1]);
	assert.strictEqual(results[3].month.limit_usd, 5);

	const serialized = JSON.stringify(deniedReport);
	assert.ok(!serialized.includes(ADMIN));
	assert.ok(!serialized.includes(KEY));
}

(async () => {
	try {
		await testDriverRequest();
		await testResponseNormalization();
		await testErrors();
		await testRequestValidationAndShape();
		await testRateLimitHeaders();
		await testRegistry();
		await testUsage();
		console.log('anthropic api tests passed');
	} finally {
		resetRateLimitSnapshot();
		for (const [name, value] of Object.entries(savedEnv)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
