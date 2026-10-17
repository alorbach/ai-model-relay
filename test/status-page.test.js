'use strict';

const assert = require('assert');
const { statusPageHtml } = require('../src/status-page');

const html = statusPageHtml();
const inlineScript = /<script>([\s\S]*)<\/script>/.exec(html);
assert.ok(inlineScript, 'status page should include its client script');
new Function(inlineScript[1]);
assert.ok(html.includes('Unavailable saved selection:'));
assert.ok(html.includes('id="claudeUsagePanel"'));
assert.ok(html.includes('/v1/relay/providers/anthropic/usage'));
for (const id of ['relayAnthropicApiKey', 'relayAnthropicAdminKey', 'relayAnthropicBaseUrl', 'relayAnthropicModels', 'relayAnthropicMonthlyLimit', 'relayAnthropicCreditBalance']) assert.ok(html.includes(id), id);
assert.ok(html.includes('clear_admin_api_key'));
assert.ok(html.includes('selected disabled'));
assert.ok(html.includes('backend.job_types.includes(jobType)'));
assert.ok(html.includes("backend.ready === true"));
assert.ok(html.includes('Refresh detection'));
assert.ok(html.includes('Save paths &amp; routing'));
assert.ok(html.includes('id="relayCliPaths"'));
assert.ok(html.includes('id="relayTokenDefaults"'));
assert.ok(html.includes('data-relay-token-default'));
assert.ok(html.includes("{ jobType: 'chat'"));
assert.ok(html.includes("{ jobType: 'media.analyze'"));
assert.ok(html.includes('min="512" max="128000"'));
assert.ok(html.includes('Antigravity CLI executable'));
assert.ok(html.includes('data-relay-cli-path'));
assert.ok(html.includes('id="relayCodexImageTool"'));
assert.ok(html.includes('Codex login images request'));
assert.ok(html.includes('Codex exec image_gen tool'));
assert.ok(html.includes('image_gen is the default. It asks Codex exec to pass size and quality inside the image_gen prompt.'));
assert.ok(!html.includes('Direct Sunburst image route'));
assert.ok(html.includes('codex_image_tool'));
assert.ok(html.includes('Saving executable paths'));
assert.ok(html.includes('saveRelaySettings({ quiet: true })'));
assert.ok(html.includes('function followProviderRefresh(refreshState)'));
assert.ok(html.includes('payload.refresh_started === true'));
assert.ok(html.includes('Provider media and audio tests'));
assert.ok(html.includes('aria-label="Provider test types"'));
assert.ok(html.includes('id="provider-test-tab-images"'));
assert.ok(html.includes('id="provider-test-tab-videos"'));
assert.ok(html.includes('id="provider-test-tab-analysis"'));
assert.ok(html.includes('id="provider-test-tab-audio"'));
assert.ok(html.includes('data-provider-test-tab'));
assert.ok(!html.includes('id="provider-test-tab-media"'));
assert.ok(!html.includes('data-provider-media-tab'));
assert.ok(html.includes('id="providerImageTests"'));
assert.ok(html.includes('id="providerVideoTests"'));
assert.ok(html.includes('id="providerAnalysisTests"'));
assert.ok(html.includes('id="providerAudioTests"'));
assert.ok(html.includes('function initProviderTestTabs()'));
assert.ok(!html.includes('function initProviderMediaTabs()'));
assert.ok(html.includes("const imageTests = readyMediaModels(models, backends, 'images', 'image')"));
assert.ok(html.includes('Ultrarealistic scene Cool Kungfu Cat'));
assert.ok(html.includes("const videoModels = readyMediaModels(models, backends, 'videos', 'video')"));
assert.ok(html.includes('function providerTestControls(model, jobType)'));
assert.ok(html.includes('model.test_options'));
assert.ok(html.includes('data-test-option'));
assert.ok(html.includes("entry.input.type === 'text'"), 'Status page must support free-form model test options');
assert.ok(html.includes('generation guidance'));
assert.ok(html.includes('sent directly'));
assert.ok(html.includes('Video analysis'));
assert.ok(html.includes('Local Music Analysis Settings'));
assert.ok(html.includes("const musicAnalysisSettingsUrl = '/v1/music-analysis/settings'"));
assert.ok(html.includes('Selecting xAI Speech-to-Text uploads the chosen audio to xAI'));
assert.ok(html.includes("const relayTestUrl = '/v1/relay/test'"));
assert.ok(html.includes('test_request_id: requestId'));
assert.ok(html.includes('function updateProviderTestProgress('));
assert.ok(html.includes('data-test-progress'));
assert.ok(html.includes('data-test-progress-bar'));
assert.ok(html.includes('function setProviderTestActivity(card, active, state)'));
assert.ok(html.includes('function settleProviderTestCard(card, job)'));
assert.ok(html.includes('Continuing to follow it here.'));
assert.ok(html.includes("document.querySelector('[data-provider-media-test][data-test-request-id]')"));
assert.ok(html.includes('data-test-result'));
assert.ok(html.includes('function renderProviderTestResult(card, job)'));
assert.ok(html.includes('\\/(?:v1)\\/status\\/jobs\\/\\d+\\/artifacts\\/\\d+'));
assert.ok(!html.includes('\\/(?:v1)\\/status\\/jobs\\/d+\\/artifacts\\/d+'));
assert.ok(html.includes('data-media-preview'));
assert.ok(html.includes('function openMediaLightbox(url, mimeType)'));
assert.ok(html.includes('id="mediaLightboxVideo"'));
assert.ok(html.includes('const video = /^video\\//i.test'));
assert.ok(html.includes('data-provider-test'));
assert.ok(html.includes("const isAudio = jobType === 'transcribe' || jobType === 'music.analyze'"));
assert.ok(html.includes('Reference image (optional)'));
assert.ok(html.includes('data-test-media'));
assert.ok(html.includes('data-test-audio'));
assert.ok(html.includes('Choose a small video file before running this test.'));
assert.ok(html.includes('Choose an audio file before running this test.'));
assert.ok(html.includes('<video src="'));
assert.ok(html.includes('muted preload="metadata" playsinline'));
assert.ok(html.includes('Grok CLI request'));
assert.ok(html.includes('Grok CLI stdout / stderr'));
assert.ok(html.includes('Local CUDA Upscale Settings'));
assert.ok(html.includes("const upscaleSettingsUrl = '/v1/upscale/settings'"));
assert.ok(html.includes("const upscaleSetupUrl = '/v1/upscale/setup'"));
assert.ok(html.includes('id="upscaleInstallActions"'));
assert.ok(html.includes('data-upscale-install'));
assert.ok(html.includes('data-upscale-restricted'));
assert.ok(html.includes('APISR academic-only and GPL-3.0 restriction'));
assert.ok(html.includes('Use Settings → Local CUDA Upscale to install an available pinned model'));
assert.ok(html.includes('Native ×2 and ×4 outputs are never downsampled'));
assert.ok(html.includes('Jobs never download a model, downsample native output, or fall back to CPU'));
assert.ok(html.includes('id="upscaleSetupLog"'));
assert.ok(html.includes('<div class="label">Local Image Generation</div>'));
assert.ok(html.includes("const imageSettingsUrl = '/v1/image/settings'"));
assert.ok(html.includes('payload.capabilities?.resolution_choices'), 'Saving image settings must preserve resolution choices from the capabilities response');
assert.ok(html.includes("const imageSetupUrl = '/v1/image/setup'"));
assert.ok(html.includes('id="imageInstallActions"'));
assert.ok(html.includes('data-image-install'));
assert.ok(html.includes('Repair / Reinstall Model'));
assert.ok(html.includes('id="imageDefaultResolution"'));
assert.ok(html.includes('resolution_choices'));
assert.ok(html.includes('Default resolution'));
assert.ok(html.includes('id="imageSetupLog"'));
assert.ok(html.includes('data-settings-section="image"'));
assert.ok(html.includes('Use Settings → Local Image to set up the Diffusers runtime'));
assert.ok(html.includes('text-to-image only'), 'Model cards must clearly identify text-to-image-only models');
assert.ok(html.includes('referenceLimit === 0 ?'), 'The provider test must hide reference-image input for text-to-image-only models');
assert.ok(html.includes('function setupFailureText(payload, fallback)'));
assert.ok(html.includes("const asrSetupUrl = '/v1/asr/setup'"));
assert.ok(html.includes('data-install-asr-model'));
assert.ok(html.includes('Install model'));
assert.ok(html.includes('id="asrSetupLog"'));
assert.ok(html.includes('function setupAsrModel(button)'));
assert.ok(html.includes("payload.details && payload.details.log"));
assert.ok(html.includes('That download is explicit'));
assert.ok(html.includes('id="settings-nav"'));
assert.ok(html.includes('data-settings-section="providers"'));
assert.ok(html.includes('data-settings-section="runtime"'));
assert.ok(html.includes('data-settings-section="tests"'));
assert.ok(html.includes('id="relayRuntimeSettings"'));
assert.ok(html.includes('id="relayProviderOptions"'));
assert.ok(html.includes('id="saveRelayRuntimeSettings"'));
assert.ok(html.includes('function collectRelaySettingsPayload(section)'));
assert.ok(html.includes("saveRelaySettings({ section: 'runtime' })"));
assert.ok(html.includes('function restoreRelaySection(section, preserved)'));
assert.ok(html.includes("captureFormSnapshots(['relay', 'runtime'])"));
assert.ok(html.includes("captureFormSnapshots([section])"));
assert.ok(html.includes('id="asrTranscribeTimeout"'));
assert.ok(html.includes('id="asrCudaPaths"'));
assert.ok(html.includes('id="asrQwenTorchIndexUrl"'));
assert.ok(html.includes('id="musicAnalysisTimeout"'));
assert.ok(html.includes('id="upscaleApisrVenvPath"'));
assert.ok(html.includes('id="upscaleTimeout"'));
assert.ok(html.includes('id="upscaleTile"'));
assert.ok(html.includes('id="upscalePrecision"'));
assert.ok(html.includes('function parseHash()'));
assert.ok(html.includes('function selectSettingsSection(section'));
assert.ok(html.includes('function renderLiveJobList(jobs)'));
assert.ok(html.includes('function renderLiveDetail(job)'));
assert.ok(html.includes('id="liveJobList"'));
assert.ok(html.includes('id="liveDetailBody"'));
assert.ok(html.includes('id="debugHealthList"'));
assert.ok(html.includes('id="debugFailureList"'));
assert.ok(html.includes('id="rawStatusFilter"'));
assert.ok(html.includes('function renderDebugHealth(payload, ok)'));
assert.ok(html.includes('function captureFormSnapshots(keys)'));
assert.ok(html.includes('class="app-shell"'));
assert.ok(html.includes('id="healthGrid"'));
assert.ok(html.includes('data-live-filter'));
assert.ok(html.includes('data-live-filter="completed"'));
assert.ok(html.includes('data-live-filter-count="all"'));
assert.ok(html.includes('id="liveJobSearch"'));
assert.ok(html.includes('function pendingLiveJob(requestId)'));
assert.ok(html.includes('function liveJobMatchesSearch(job)'));
assert.ok(html.includes('Waiting for this job to appear in live updates.'));
assert.ok(html.includes("liveFilter === 'completed'"));
assert.ok(html.includes('class="live-status-pill'));
assert.ok(html.includes('id="liveDetailStatus"'));
assert.ok(html.includes('class="live-artifact-download"'));
assert.ok(html.includes('currentStatus.jobs = jobs'));
assert.ok(html.includes('let livePinned = false'));
assert.ok(html.includes("setHash('live')"));
assert.ok(html.includes('jobs.active'));
assert.ok(html.includes('!seenLiveRequestIds.has(selectedLiveRequestId)'));
assert.ok(html.includes('min-height: 240px'));
assert.ok(html.includes('data-open-live-job'));
assert.ok(html.includes('--accent:'));

assert.ok(html.includes('data-settings-section="pairing"'));
assert.ok(html.includes('id="persistentPairingCodeInput"'));
assert.ok(html.includes('type="password"'));
assert.ok(html.includes("const pairingCodeSettingsUrl = '/v1/relay/pairing-code'"));
assert.ok(html.includes('The code is never returned to this page after saving.'));

// Claude API settings: text money inputs, re-baseline control, chat timeout field, client-side USD validation.
assert.ok(/id="relayAnthropicMonthlyLimit"/.test(html) && !/type="number"[^>]*id="relayAnthropicMonthlyLimit"/.test(html));
assert.ok(/<input type="text" inputmode="decimal" id="relayAnthropicCreditBalance"/.test(html));
assert.ok(html.includes('id="relayAnthropicCreditRebaseline"'));
assert.ok(html.includes('Recount spend from today'));
assert.ok(!html.includes('anthropicCreditEdited'), 'typing in the balance field must not force a re-baseline');
assert.ok(html.includes("credit_balance_rebaseline: !!(document.getElementById('relayAnthropicCreditRebaseline') && document.getElementById('relayAnthropicCreditRebaseline').checked)"));
assert.ok(html.includes("{ key: 'anthropic_chat_ms', label: 'Claude API chat timeout (ms)', placeholder: '600000' }"));
assert.ok(html.includes('Relay subtracts the Cost API spend from the start of the UTC day you saved it.'));
assert.ok(html.includes('Credit balance must be a dollar amount like 500 or 500.25 (max 100,000,000).'));
assert.ok(html.includes('Monthly spend limit must be a dollar amount like 500 or 500.25 (max 100,000,000).'));
assert.ok(html.includes("Number.parseFloat(check.value.replace(',', '.')) > 100000000"));
const usdRegexSource = /!\/(\^[^/\n]*\$)\/\.test\(check\.value\)/.exec(inlineScript[1]);
assert.ok(usdRegexSource, 'client-side USD validation should be present');
const usdRegex = new RegExp(usdRegexSource[1]);
for (const ok of ['500', '500.25', '0,5', '7']) assert.ok(usdRegex.test(ok), ok);
for (const bad of ['1e3', '-5', 'abc', '12.345', '1,000.50']) assert.ok(!usdRegex.test(bad), bad);

// loadClaudeUsage ignores stale responses and the timed poll skips hidden tabs.
{
	const loader = inlineScript[1].slice(inlineScript[1].indexOf('let claudeUsageSequence'), inlineScript[1].indexOf('async function saveRelaySettings'));
	assert.ok(loader.includes('const sequence = ++claudeUsageSequence;'));
	assert.strictEqual(loader.split('if (sequence !== claudeUsageSequence) return;').length - 1, 2, 'both the success and error paths must drop stale requests');
	assert.ok(inlineScript[1].includes('setInterval(() => { if (!document.hidden) loadClaudeUsage({ force: false }); }, 5 * 60 * 1000);'));
}

// renderClaudeUsage: unknown remaining credits must not show the saved balance as the headline.
{
	const start = inlineScript[1].indexOf('function claudeNum(value)');
	const end = inlineScript[1].indexOf('async function loadClaudeUsage');
	assert.ok(start > 0 && end > start);
	const panel = { innerHTML: '' };
	const factory = new Function('document', 'escapeHtml', 'formatUsd', 'formatLocalDate', 'formatLocalDateTime', 'formatRelativeTime', inlineScript[1].slice(start, end) + '\nreturn { renderClaudeUsage, claudeNum };');
	const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	const formatUsd = (value) => '$' + Number(value).toFixed(2);
	const { renderClaudeUsage } = factory({ getElementById: () => panel }, escapeHtml, formatUsd, () => '17 Oct 2026', () => '17 Oct 2026, 10:00', () => '1m ago');
	const base = { configured: { api_key: true }, month: {}, rate_limits: null };
	renderClaudeUsage({ ...base, credits: { balance_usd: 250, as_of: '2026-10-17T10:00:00Z', remaining_usd: null, spent_since_usd: null }, cost_report: { reason: 'Admin API key not configured' } });
	assert.ok(panel.innerHTML.includes('Organization credits (estimated)</span><span class="health-value">—</span>'), 'headline must be a dash when remaining credits are unknown');
	assert.ok(!panel.innerHTML.includes('health-value">$250.00'));
	assert.ok(panel.innerHTML.includes('Saved balance $250.00 on 17 Oct 2026; spend since then unavailable — Admin API key not configured'));
	renderClaudeUsage({ ...base, credits: { balance_usd: null, remaining_usd: null }, cost_report: {} });
	assert.ok(panel.innerHTML.includes('Enter your dashboard credit balance in Settings'));
	renderClaudeUsage({ ...base, credits: { balance_usd: 250, as_of: '2026-10-17T10:00:00Z', remaining_usd: 200, spent_since_usd: 50 }, cost_report: {} });
	assert.ok(panel.innerHTML.includes('health-value">$200.00'));
	renderClaudeUsage({ ...base, credits: { balance_usd: 250, as_of: '2026-10-17T10:00:00Z', remaining_usd: null }, cost_report: { reason: '<b>x</b>' } });
	assert.ok(!panel.innerHTML.includes('<b>x</b>'));
	renderClaudeUsage({ ...base, credits: { balance_usd: 250, as_of: '2026-10-17T10:00:00Z', remaining_usd: null, reason: 'Too old <i>x</i>' }, cost_report: { available: true } });
	assert.ok(panel.innerHTML.includes('spend since then unavailable — Too old &lt;i&gt;x&lt;/i&gt;'));
	assert.ok(!panel.innerHTML.includes('<i>x</i>'));
}

// Provider test cards: the real functions are extracted from the emitted page script and run against a stub DOM.
const providerTestScript = inlineScript[1];
const providerTestLines = providerTestScript.split('\n');
function extractPageFunction(name) {
	const start = providerTestLines.findIndex((line) => new RegExp('^\\s*(async )?function ' + name + '\\(').test(line));
	assert.ok(start >= 0, 'page function ' + name + ' exists');
	const indent = /^\s*/.exec(providerTestLines[start])[0];
	const end = providerTestLines.findIndex((line, index) => index > start && line === indent + '}');
	assert.ok(end > start, 'page function ' + name + ' ends');
	return providerTestLines.slice(start, end + 1).join('\n');
}
const PROVIDER_TEST_FUNCTIONS = ['text', 'escapeHtml', 'elapsed', 'jobRequestId', 'readyMediaModels', 'providerTestControls', 'renderProviderMediaTests', 'renderProviderChatTests', 'setProviderTestPanel', 'copyProviderTestCardState', 'providerTestTerminal', 'providerTestsBusy', 'renderProviderTestPanels', 'flushPendingProviderTestRender', 'waitForProviderTestSettled', 'providerTestSettled', 'updateChatRunAllState', 'chatRunAllSummaryText', 'runAllChatTests', 'cancelChatRunAll', 'chatReplyText', 'chatElapsed', 'renderChatTestResult', 'renderChatTestFailure', 'createProviderTestRequestId', 'providerTestJob', 'setProviderTestActivity', 'restoreProviderTestButton', 'chatTestOutcomeMessage', 'settleProviderTestCard', 'updateProviderTestProgress', 'renderProviderTestResult', 'runProviderMediaTest'];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const unescapeAttr = (value) => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Raw status filter: escapeRegExp must survive the template literal, so special characters match literally and never throw.
assert.ok(inlineScript[1].includes("return String(value).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');"), 'the emitted escapeRegExp is the standard one');
{
	const escapeRegExp = new Function(extractPageFunction('escapeRegExp') + '\nreturn escapeRegExp;')();
	for (const sample of ['(', '*', '[', '?', '.', '+', ']', '\\', '$&', 'a{2}']) {
		assert.ok(new RegExp(escapeRegExp(sample)).test(sample), 'escaped ' + sample + ' matches itself');
		assert.ok(new RegExp('(' + escapeRegExp(sample) + ')', 'ig').test('x' + sample + 'y'), 'escaped ' + sample + ' matches inside text');
	}
	assert.ok(!new RegExp(escapeRegExp('a.c')).test('abc'), '. is literal');
	const rawStatus = { textContent: '', innerHTML: '' };
	const applyFilter = new Function('fields', 'currentStatus', 'escapeHtml', 'escapeRegExp', extractPageFunction('applyRawStatusFilter') + '\nreturn applyRawStatusFilter;');
	const escapeHtmlForFilter = new Function(extractPageFunction('text') + '\n' + extractPageFunction('escapeHtml') + '\nreturn escapeHtml;')();
	for (const query of ['(', '*', '[', '?', 'a{2}', '\\']) {
		const run = applyFilter({ rawStatus, rawStatusFilter: { value: query } }, { note: 'x(y)*[z]? a{2} \\ end' }, escapeHtmlForFilter, escapeRegExp);
		assert.doesNotThrow(run, 'raw filter with ' + query);
		assert.ok(rawStatus.innerHTML.includes('<mark>' + escapeHtmlForFilter(query) + '</mark>'), 'raw filter highlights ' + query);
	}
	// If the pattern still cannot be built, it falls back to a plain case-insensitive substring highlight.
	rawStatus.innerHTML = '';
	applyFilter({ rawStatus, rawStatusFilter: { value: 'NOTE' } }, { note: 'x' }, escapeHtmlForFilter, () => '(')();
	assert.ok(rawStatus.innerHTML.includes('<mark>note</mark>'), 'fallback highlights case-insensitively');
}

// Minimal stand-in for the panel containers: innerHTML is parsed into card objects the page functions can query.
function makeStubDom() {
	const containers = [];
	function makeCard(markup, container) {
		const attr = (pattern) => { const match = pattern.exec(markup); return match ? unescapeAttr(match[1]) : ''; };
		const dataset = { cardKey: attr(/data-card-key="([^"]*)"/) };
		if (/data-test-job-type="chat"/.test(markup)) dataset.testJobType = 'chat';
		const button = { dataset: { providerTest: attr(/data-provider-test="([^"]*)"/), model: attr(/data-model="([^"]*)"/) }, textContent: 'Run test', disabled: false };
		const els = {
			'[data-provider-test]': button,
			'[data-test-message]': { textContent: 'Ready' },
			'[data-test-progress]': { textContent: 'Idle' },
			'[data-test-result]': { innerHTML: '' },
			'[data-test-progress-bar]': { hidden: true, setAttribute() {} },
		};
		if (/data-test-prompt/.test(markup)) els['[data-test-prompt]'] = { value: attr(/data-test-prompt[^>]*value="([^"]*)"/) };
		if (/data-chat-system/.test(markup)) els['[data-chat-system]'] = { value: '' };
		if (/data-chat-max-tokens/.test(markup)) els['[data-chat-max-tokens]'] = { value: attr(/data-chat-max-tokens value="([^"]*)"/) };
		if (/data-chat-image/.test(markup)) els['[data-chat-image]'] = { files: [], accept: attr(/accept="([^"]*)" data-chat-image/) };
		const card = {
			dataset,
			markup,
			els,
			querySelector: (selector) => els[selector] || null,
			querySelectorAll: () => [],
			replaceWith(other) { const index = container.cards.indexOf(card); if (index >= 0) container.cards[index] = other; },
		};
		button.closest = () => card;
		return card;
	}
	function makeContainer() {
		const container = {
			cards: [],
			html: '',
			writes: 0,
			get innerHTML() { return this.html; },
			set innerHTML(value) {
				this.html = String(value);
				this.writes += 1;
				this.cards = (this.html.match(/<article[\s\S]*?<\/article>/g) || []).map((markup) => makeCard(markup, container));
			},
			querySelectorAll(selector) { return selector === '[data-provider-media-test]' ? this.cards.slice() : []; },
			querySelector(selector) { return selector === '[data-provider-media-test]' ? this.cards[0] || null : null; },
		};
		containers.push(container);
		return container;
	}
	const allCards = () => containers.flatMap((container) => container.cards);
	const document = {
		querySelector: (selector) => (selector.includes('data-test-request-id') ? allCards().find((card) => card.dataset.testRequestId) || null : null),
		querySelectorAll: (selector) => (selector.includes('data-test-request-id') ? allCards().filter((card) => card.dataset.testRequestId) : []),
		body: { contains: (card) => allCards().includes(card) },
	};
	return { makeContainer, document };
}

// Loads the real page functions. `override` replaces named functions with test doubles.
function loadProviderTestApi(deps = {}) {
	const override = deps.override || {};
	const names = PROVIDER_TEST_FUNCTIONS.concat(deps.extra || []).filter((name) => !(name in override));
	const source = names.map(extractPageFunction).join('\n\n');
	const factory = new Function('fields', 'chatRunAll', 'document', 'fetch', 'refresh', 'currentStatus', 'selectTab', 'selectLiveJob', 'relayTestUrl', 'overrides',
		'const {' + Object.keys(override).join(',') + '} = overrides;\nconst providerTestWaiters = new WeakMap(); const providerTestPanels = new WeakMap(); let pendingProviderTestRender = null; let providerTestStatusSerial = 0; let providerTestLastKnownJobs = (currentStatus && currentStatus.jobs) || null; let providerTestLastFreshAt = 0; let providerTestFeedStale = false; let providerTestStaleSince = 0; const providerTestStatusTimeoutMs = 120000; const providerTestMissingMinMs = 45000; const providerTestMissingMinSnapshots = 3; const providerTestNotFoundMs = 60000; const providerTestPollMs = 5000; let providerTestPollInFlight = false; let providerTestLastPollAt = 0;\n' + source +
		'\nreturn { ' + names.join(', ') + ', pending: () => pendingProviderTestRender, getStatus: () => currentStatus };');
	return factory(deps.fields, deps.chatRunAll, deps.document, deps.fetch, deps.refresh || (async () => {}), deps.currentStatus, deps.selectTab || (() => false), deps.selectLiveJob || (() => {}), '/v1/relay/test', override);
}

const TEST_BACKENDS = [
	{ id: 'cli-a', label: 'CLI A', kind: 'driver', provider_kind: 'local-cli', ready: true, job_types: ['chat', 'images'] },
	{ id: 'api-b', label: 'API B', kind: 'driver', provider_kind: 'api', ready: true, job_types: ['chat'] },
];
const TEST_MODELS = [
	{ id: 'm-cli', type: 'text', backend: 'cli-a', job_types: ['chat'] },
	{ id: 'm-api', type: 'text', backend: 'api-b', job_types: ['chat'] },
	{ id: 'm-img', type: 'image', backend: 'cli-a', job_types: ['images'] },
];

// Chat provider tests: tab, run-all control, card rendering, and escaped result rendering.
{
	const script = providerTestScript;
	for (const id of ['provider-test-tab-chat', 'provider-test-panel-chat', 'providerChatTests', 'runAllChatTests', 'cancelAllChatTests']) assert.ok(html.includes('id="' + id + '"'), id);
	assert.ok(html.includes('Run all chat tests'));
	assert.ok(html.indexOf('id="provider-test-tab-chat"') < html.indexOf('id="provider-test-tab-images"'), 'Chat must be the first test tab');
	assert.ok(html.includes('id="provider-test-tab-chat" data-provider-test-tab aria-controls="provider-test-panel-chat" aria-selected="true"'));
	assert.ok(html.includes('id="provider-test-panel-images" role="tabpanel" aria-labelledby="provider-test-tab-images" hidden'));
	assert.ok(script.includes("selectProviderTestTab('provider-test-tab-chat')"));
	assert.ok(script.includes("readyMediaModels(models, backends, 'chat', 'text')"));
	assert.ok(script.includes('await runProviderMediaTest(button);'), 'Run all awaits each test before starting the next');
	assert.ok(script.includes('replace(/\\s+/g, ') && !script.includes("replace(/s+/g"), 'regex escapes survive the page template literal');
	assert.ok(script.includes('=\\s]+)$/i') && !script.includes('=s]+)$/i'), 'the audio data-URL parser keeps its \\s escape');

	const dom = makeStubDom();
	const container = dom.makeContainer();
	const fields = { providerChatTests: container, runAllChatTests: { disabled: false }, cancelAllChatTests: { hidden: true, disabled: false }, chatRunAllSummary: { textContent: '' } };
	const chatRunAll = { running: false, cancelled: false };
	const api = loadProviderTestApi({ fields, chatRunAll, document: dom.document, currentStatus: {} });

	const backends = [
		{ id: 'codex-cli', label: 'Codex CLI', kind: 'local-cli', ready: true, job_types: ['chat', 'images'] },
		{ id: 'xai-api', label: 'Grok / xAI API', kind: 'api', ready: true, job_types: ['chat', 'images'] },
		{ id: 'antigravity-cli', label: 'Antigravity CLI', kind: 'local-cli', ready: true, job_types: ['chat', 'media.analyze'] },
		{ id: 'cli-process', label: 'CLI Process', kind: 'local-cli', ready: false, job_types: ['chat'] },
	];
	const models = [
		{ id: 'model-relay:xai:grok-4.3', type: 'text', backend: 'xai-api', job_types: ['chat'] },
		{ id: 'model-relay:codex:auto', type: 'text', backend: 'codex-cli', job_types: ['chat', 'media.analyze'] },
		{ id: 'model-relay:antigravity-cli:auto', type: 'text', backend: 'antigravity-cli', ready: true, job_types: ['chat'] },
		{ id: 'model-relay:antigravity-cli:media', type: 'text', backend: 'antigravity-cli', ready: true, job_types: ['media.analyze'] },
		{ id: 'model-relay:cli:default', type: 'text', backend: 'cli-process', ready: false, job_types: ['chat'] },
		{ id: 'model-relay:codex:image', type: 'image', backend: 'codex-cli', job_types: ['images'] },
	];
	api.renderProviderChatTests(models, backends);
	const rendered = container.innerHTML;
	assert.strictEqual((rendered.match(/data-provider-test="chat"/g) || []).length, 3, 'one card per ready chat model');
	assert.ok(!rendered.includes('antigravity-cli:media') && !rendered.includes('cli:default') && !rendered.includes('codex:image'));
	assert.ok(rendered.indexOf('Antigravity CLI') < rendered.indexOf('Codex CLI') && rendered.indexOf('Codex CLI') < rendered.indexOf('Grok / xAI API'), 'cards are sorted by backend label');
	assert.ok(rendered.includes('Reply with exactly: OK') && rendered.includes('System prompt (optional)') && rendered.includes('Image (optional, vision check)') && rendered.includes('data-chat-max-tokens') && rendered.includes('value="256"'));
	assert.strictEqual((rendered.match(/usage charges may apply/g) || []).length, 1, 'only API backends show the cost hint');
	assert.ok(rendered.includes('This request is sent to Grok / xAI API; usage charges may apply.'));
	assert.strictEqual(fields.runAllChatTests.disabled, false);
	// Image formats follow the provider: CLI drivers take PNG/JPEG/WebP, API providers also take GIF.
	const acceptFor = (modelId) => container.cards.find((card) => card.els['[data-provider-test]'].dataset.model === modelId).els['[data-chat-image]'].accept;
	assert.strictEqual(acceptFor('model-relay:codex:auto'), 'image/png,image/jpeg,image/webp');
	assert.strictEqual(acceptFor('model-relay:antigravity-cli:auto'), 'image/png,image/jpeg,image/webp');
	assert.strictEqual(acceptFor('model-relay:xai:grok-4.3'), 'image/png,image/jpeg,image/webp,image/gif');
	api.renderProviderChatTests(models.map((model) => model.backend === 'xai-api' ? model : model), backends.map((backend) => backend.id === 'xai-api' ? { ...backend, kind: 'driver', provider_kind: 'api' } : backend));
	assert.strictEqual(acceptFor('model-relay:xai:grok-4.3'), 'image/png,image/jpeg,image/webp,image/gif', 'provider_kind api is honored when kind is the generic driver kind');
	// The generic CLI Process driver always rejects images: no image input there; other CLI and API cards keep it.
	{
		const readyBackends = backends.map((backend) => (backend.id === 'cli-process' ? { ...backend, ready: true } : backend));
		api.renderProviderChatTests(models.map((model) => (model.backend === 'cli-process' ? { ...model, ready: true } : model)), readyBackends);
		const cardFor = (modelId) => container.cards.find((card) => card.els['[data-provider-test]'].dataset.model === modelId);
		assert.ok(cardFor('model-relay:cli:default') && !cardFor('model-relay:cli:default').markup.includes('data-chat-image'), 'cli-process has no image input');
		assert.ok(cardFor('model-relay:codex:auto').markup.includes('data-chat-image') && cardFor('model-relay:xai:grok-4.3').markup.includes('data-chat-image'));
		assert.strictEqual(container.cards.length, 4);
		// CLI providers with an image input get a hint that the image only reaches them as a local file reference.
		const cliHint = 'CLI providers receive the image as a local file reference; check that the reply actually describes the image.';
		assert.ok(cardFor('model-relay:codex:auto').markup.includes(cliHint) && cardFor('model-relay:antigravity-cli:auto').markup.includes(cliHint), 'codex-cli and antigravity-cli show the hint');
		assert.ok(!cardFor('model-relay:xai:grok-4.3').markup.includes(cliHint) && !cardFor('model-relay:cli:default').markup.includes(cliHint), 'API and CLI Process cards do not');
		const cliHintBackends = ['grok-cli', 'cursor-cli'].map((id) => ({ id, label: id, kind: 'local-cli', ready: true, job_types: ['chat'] }));
		api.renderProviderChatTests(cliHintBackends.map((backend) => ({ id: 'm-' + backend.id, type: 'text', backend: backend.id })), cliHintBackends);
		assert.ok(container.cards.length === 2 && container.cards.every((card) => card.markup.includes(cliHint)), 'grok-cli and cursor-cli show the hint');
	}
	// Card keys are unique: the same model id on two backends stays two cards, and a true duplicate gets a suffix.
	{
		const two = [{ id: 'cli-a', label: 'A', kind: 'driver', ready: true, job_types: ['chat'] }, { id: 'api-b', label: 'B', kind: 'driver', ready: true, job_types: ['chat'] }];
		api.renderProviderChatTests([{ id: 'same', type: 'text', backend: 'cli-a' }, { id: 'same', type: 'text', backend: 'api-b' }], two);
		assert.strictEqual(container.cards.length, 2);
		assert.strictEqual(new Set(container.cards.map((card) => card.dataset.cardKey)).size, 2);
		api.renderProviderChatTests([{ id: 'dup', type: 'text', backend: 'api-b' }, { id: 'dup', type: 'text', backend: 'api-b' }], two);
		assert.strictEqual(container.cards.length, 2);
		assert.strictEqual(new Set(container.cards.map((card) => card.dataset.cardKey)).size, 2, 'a duplicate key gets a suffix instead of collapsing');
		assert.ok(container.cards[1].dataset.cardKey.endsWith('#1'));
	}
	api.renderProviderChatTests([], backends);
	assert.ok(container.innerHTML.includes('No ready chat providers'));
	assert.strictEqual(fields.runAllChatTests.disabled, true, 'Run all is disabled without cards');

	const makeResultCard = (payload, startedAt) => ({ chatTestPayload: payload, dataset: { testStartedAt: String(startedAt) }, result: { innerHTML: '' }, querySelector(selector) { return selector === '[data-test-result]' ? this.result : null; } });
	const card = makeResultCard({ success: true, response: { model: 'grok-4.3', choices: [{ message: { role: 'assistant', content: '<img src=x onerror=alert(1)> OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 }, provider_details: { stop_reason: 'end_turn', cache_read_input_tokens: 0, api_key: 'sk-secret' } } }, Date.now());
	api.renderChatTestResult(card, { request_id: 'status-test-1', elapsed_ms: 1500 });
	assert.ok(card.result.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt; OK'));
	assert.ok(!card.result.innerHTML.includes('<img'));
	assert.ok(card.result.innerHTML.includes('Model: grok-4.3') && card.result.innerHTML.includes('Elapsed: 1.5s'));
	assert.ok(card.result.innerHTML.includes('Tokens (prompt / completion / total): 12 / 3 / 15'));
	assert.ok(card.result.innerHTML.includes('Finish reason: stop') && card.result.innerHTML.includes('stop_reason: end_turn') && card.result.innerHTML.includes('cache_read_input_tokens: 0'));
	assert.ok(!card.result.innerHTML.includes('sk-secret') && !card.result.innerHTML.includes('Open completed result in Live'));
	assert.strictEqual(card.dataset.testOutcome, 'passed');

	const longCard = makeResultCard({ success: true, response: { choices: [{ message: { content: 'a'.repeat(4500) } }] } }, Date.now());
	api.renderChatTestResult(longCard, null);
	assert.ok(longCard.result.innerHTML.includes('Reply truncated: showing 4000 of 4500 characters.'));
	assert.ok(!longCard.result.innerHTML.includes('a'.repeat(4001)));

	const emptyCard = makeResultCard({ success: true, response: { choices: [{ message: { content: '  ' } }] } }, Date.now());
	api.renderChatTestResult(emptyCard, null);
	assert.ok(emptyCard.result.innerHTML.includes('The provider returned an empty reply.'));
	assert.strictEqual(emptyCard.dataset.testOutcome, 'failed');

	const missingCard = makeResultCard(null, Date.now());
	api.renderChatTestResult(missingCard, { request_id: 'status-test-2' });
	assert.ok(missingCard.result.innerHTML.includes('reply not returned to this page') && missingCard.result.innerHTML.includes('data-open-live-job="status-test-2"') && missingCard.result.innerHTML.includes('Open job in Live'));
	assert.strictEqual(missingCard.dataset.testOutcome, 'noreply', 'a completed job without a returned reply is a warning, not a failure');

	const failedCard = makeResultCard(null, Date.now());
	const failure = Object.assign(new Error('Bad <key>'), { code: 'anthropic_api_failed', httpStatus: 503 });
	api.renderChatTestFailure(failedCard, failure);
	assert.ok(failedCard.result.innerHTML.includes('Bad &lt;key&gt;') && failedCard.result.innerHTML.includes('Code: anthropic_api_failed') && failedCard.result.innerHTML.includes('HTTP status: 503'));
	assert.strictEqual(failedCard.dataset.testOutcome, 'failed');

	assert.ok(['completed', 'failed', 'cancelled', 'timeout', 'error'].every((state) => api.providerTestTerminal(state)));
	assert.ok(!['queued', 'running', 'cancelling', ''].some((state) => api.providerTestTerminal(state)));
}

// Chat test hardening: image pre-check, deferred renders, per-card completion in Run all, and Run-all button locking.
(async () => {
	const script = providerTestScript;
	const fileUrlAt = script.indexOf('body.image_data_url = await fileAsDataUrl(imageFile)');
	const sizeGuardAt = script.indexOf("imageFile.size > 5 * 1024 * 1024) throw new Error('Image is larger than 5 MB.')");
	assert.ok(sizeGuardAt > 0 && sizeGuardAt < fileUrlAt, 'the chat image size is checked before the file is read and sent');
	assert.ok(!script.includes('waited < 900'), 'Run all must not poll with a fixed timeout');

	const makeCard = () => {
		const button = { disabled: false };
		return { dataset: {}, button, querySelector(selector) { return selector === '[data-provider-test]' ? button : null; } };
	};
	const setup = (cards) => {
		const renders = [];
		const state = { runs: [] };
		const fields = {
			providerChatTests: { querySelectorAll: () => cards, querySelector: () => cards[0] || null },
			runAllChatTests: { disabled: false },
			cancelAllChatTests: { hidden: true, disabled: false },
			chatRunAllSummary: { textContent: '' },
		};
		const chatRunAll = { running: false, cancelled: false };
		const document = { querySelector: () => cards.find((card) => card.dataset.testRequestId) || null, body: { contains: () => true } };
		const api = loadProviderTestApi({
			fields, chatRunAll, document, currentStatus: {},
			override: {
				runProviderMediaTest: (button) => state.runProvider(button),
				renderProviderMediaTests: (models, backends) => renders.push(['media', models, backends]),
				renderProviderChatTests: (models, backends) => renders.push(['chat', models, backends]),
				updateProviderTestProgress: () => {},
			},
		});
		return { api, fields, chatRunAll, renders, state };
	};

	// Renders are deferred while a card is in flight and run once, with the latest data, when the last card settles.
	{
		const cards = [makeCard(), makeCard()];
		const { api, renders } = setup(cards);
		api.renderProviderTestPanels(['m0'], ['b0']);
		assert.deepStrictEqual(renders.map((entry) => entry[0]), ['media', 'chat'], 'idle panels render immediately');
		renders.length = 0;
		cards[0].dataset.testRequestId = 'status-test-a';
		cards[1].dataset.testRequestId = 'status-test-b';
		api.renderProviderTestPanels(['m1'], ['b1']);
		api.renderProviderTestPanels(['m2'], ['b2']);
		assert.strictEqual(renders.length, 0, 'no render while tests are in flight');
		delete cards[0].dataset.testRequestId;
		api.providerTestSettled(cards[0]);
		assert.strictEqual(renders.length, 0, 'still waiting for the last in-flight card');
		delete cards[1].dataset.testRequestId;
		api.providerTestSettled(cards[1]);
		assert.deepStrictEqual(renders, [['media', ['m2'], ['b2']], ['chat', ['m2'], ['b2']]], 'only the latest pending data is rendered, once');
		api.providerTestSettled(cards[1]);
		assert.strictEqual(renders.length, 2, 'settling again does not re-render');
	}

	// Run all: per-card completion (no polling), settled outcomes counted, buttons locked, deferred render after the run.
	{
		const cards = [makeCard(), makeCard(), makeCard()];
		const { api, fields, chatRunAll, renders, state } = setup(cards);
		const observed = { disabledDuringRun: [] };
		state.runProvider = async (button) => {
			const card = cards.find((entry) => entry.button === button);
			const index = cards.indexOf(card);
			state.runs.push(index);
			observed.disabledDuringRun.push(cards.map((entry) => entry.button.disabled));
			card.dataset.testRequestId = 'status-test-' + index;
			button.disabled = true;
			if (index === 0) api.renderProviderTestPanels(['mid'], ['mid']);
			// The request returns early (tracked job); the card settles later, like settleProviderTestCard.
			setTimeout(() => {
				card.dataset.testOutcome = index === 0 ? 'passed' : 'failed';
				delete card.dataset.testRequestId;
				button.disabled = chatRunAll.running;
				api.providerTestSettled(card);
			}, 40);
			if (index === 1) chatRunAll.cancelled = true;
		};
		await api.runAllChatTests();
		assert.deepStrictEqual(state.runs, [0, 1], 'cancel stops starting new tests; the running one finishes');
		assert.strictEqual(fields.chatRunAllSummary.textContent, '1 passed / 1 failed · 1 not run (cancelled)');
		assert.deepStrictEqual(observed.disabledDuringRun[0], [true, true, true], 'idle chat buttons are disabled while Run all runs');
		assert.ok(cards.every((card) => card.button.disabled === false), 'buttons are restored after Run all');
		assert.strictEqual(chatRunAll.running, false);
		assert.deepStrictEqual(renders, [['media', ['mid'], ['mid']], ['chat', ['mid'], ['mid']]], 'the render requested during Run all runs afterwards');
	}

	// A card already in flight when Run all starts is skipped and keeps its own button state.
	{
		const cards = [makeCard(), makeCard()];
		cards[0].dataset.testRequestId = 'status-test-busy';
		cards[0].button.disabled = true;
		const { api, fields, state } = setup(cards);
		state.runProvider = async (button) => {
			const card = cards.find((entry) => entry.button === button);
			state.runs.push(cards.indexOf(card));
			card.dataset.testOutcome = 'passed';
			api.providerTestSettled(card);
		};
		await api.runAllChatTests();
		assert.deepStrictEqual(state.runs, [1]);
		assert.strictEqual(fields.chatRunAllSummary.textContent, '1 passed / 0 failed · 1 skipped (already running)');
		assert.strictEqual(cards[0].button.disabled, true, 'a card that is itself in flight stays disabled');
		assert.strictEqual(cards[1].button.disabled, false);
	}

	// ---- End-to-end behavior with the real page functions against a stub DOM and a scripted Relay ----
	function build(options = {}) {
		const { sse = true, post = 'ok', jobEnd = 'completed', jobEndDelayMs = 40, models = TEST_MODELS, backends = TEST_BACKENDS } = options;
		const dom = makeStubDom();
		const panels = {
			providerImageTests: dom.makeContainer(), providerVideoTests: dom.makeContainer(), providerAnalysisTests: dom.makeContainer(), providerAudioTests: dom.makeContainer(), providerChatTests: dom.makeContainer(),
		};
		const fields = { ...panels, runAllChatTests: { disabled: false }, cancelAllChatTests: { hidden: true, disabled: false }, chatRunAllSummary: { textContent: '' } };
		const currentStatus = { jobs: { active: [], queued: [], recent: [] } };
		const chatRunAll = { running: false, cancelled: false };
		const env = { dom, panels, fields, currentStatus, chatRunAll, posted: [], models, backends };
		const finishJob = (id, status, jobType) => {
			currentStatus.jobs.active = currentStatus.jobs.active.filter((job) => job.request_id !== id);
			if (status === 'evicted') return;
			const job = { request_id: id, status, elapsed_ms: 1200 };
			if (status === 'completed' && jobType === 'images') job.artifacts = [{ url: '/v1/status/jobs/1/artifacts/0', mime_type: 'image/png' }];
			currentStatus.jobs.recent.unshift(job);
		};
		env.finishJob = finishJob;
		const reply = (id) => ({ success: true, request_id: id, response: { model: 'm', choices: [{ message: { role: 'assistant', content: 'OK-' + id }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 } } });
		const fetch = async (url, init) => {
			const body = JSON.parse(init.body);
			const id = body.test_request_id;
			env.posted.push(body);
			if (post === 'validation') {
				await delay(2);
				return { ok: false, status: 400, json: async () => ({ success: false, category: 'validation', message: 'Bad request.' }) };
			}
			currentStatus.jobs.active.push({ request_id: id, status: 'running', elapsed_ms: 1 });
			// The Relay broadcasts a capabilities event for every test; the page reloads settings and re-renders the panels.
			if (sse) env.api.renderProviderTestPanels(env.models.map((model) => ({ ...model })), env.backends.map((backend) => ({ ...backend })));
			if (post === 'network') {
				if (jobEnd !== 'never') {
					if (jobEndDelayMs === 0) finishJob(id, jobEnd, body.job_type);
					else setTimeout(() => finishJob(id, jobEnd, body.job_type), jobEndDelayMs);
				}
				await delay(3);
				throw new TypeError('Failed to fetch');
			}
			await delay(3);
			finishJob(id, 'completed', body.job_type);
			return { ok: true, status: 200, json: async () => (body.job_type === 'chat' ? reply(id) : { success: true, request_id: id, response: {} }) };
		};
		env.api = loadProviderTestApi({ fields, chatRunAll, document: dom.document, fetch, currentStatus });
		env.api.renderProviderTestPanels(env.models, env.backends);
		env.chatCards = () => panels.providerChatTests.cards;
		env.imageCards = () => panels.providerImageTests.cards;
		return env;
	}
	const result = (card) => card.els['[data-test-result]'].innerHTML;
	const hasReply = (card) => result(card).includes('provider-chat-reply');
	const summary = (env) => env.fields.chatRunAllSummary.textContent;
	const ticking = async (env, work, fresh = false) => {
		const ticker = setInterval(() => env.api.updateProviderTestProgress(fresh ? { fresh: true } : undefined), 10);
		try { return await work(); } finally { clearInterval(ticker); }
	};
	const within = (promise, ms = 3000) => Promise.race([promise.then(() => 'done'), delay(ms).then(() => 'TIMEOUT')]);

	// (a) A single chat test keeps its reply when a capabilities event re-renders the panels during and after the run.
	{
		const env = build();
		assert.strictEqual(env.chatCards().length, 2);
		const card = env.chatCards()[0];
		const button = card.els['[data-provider-test]'];
		const writesBefore = env.panels.providerChatTests.writes;
		await ticking(env, () => env.api.runProviderMediaTest(button));
		assert.ok(hasReply(card), 'the reply is rendered after the test settles');
		env.api.renderProviderTestPanels(env.models.map((model) => ({ ...model })), env.backends.map((backend) => ({ ...backend })));
		assert.ok(hasReply(card), 'the reply survives a later re-render with unchanged data');
		assert.strictEqual(env.chatCards()[0], card, 'the same card element stays in place');
		assert.strictEqual(env.panels.providerChatTests.writes, writesBefore, 'an unchanged card set never rewrites the panel');
		assert.strictEqual(card.dataset.testOutcome, 'passed');
		assert.strictEqual(env.api.pending(), null, 'no deferred render is left behind');
	}

	// (b) Run all over two cards keeps both replies.
	{
		const env = build();
		const [first, second] = env.chatCards();
		assert.strictEqual(await within(ticking(env, () => env.api.runAllChatTests())), 'done');
		assert.ok(hasReply(first) && hasReply(second), 'both replies are visible after Run all');
		assert.strictEqual(summary(env), '2 passed / 0 failed');
		assert.ok(env.chatCards()[0] === first && env.chatCards()[1] === second, 'the same card elements stay in place');
	}

	// (c) A media test card keeps its artifact through the same event sequence.
	{
		const env = build();
		assert.strictEqual(env.imageCards().length, 1);
		const card = env.imageCards()[0];
		await ticking(env, () => env.api.runProviderMediaTest(card.els['[data-provider-test]']));
		assert.ok(result(card).includes('data-media-preview="/v1/status/jobs/1/artifacts/0"'), 'the generated image is shown');
		env.api.renderProviderTestPanels(env.models.map((model) => ({ ...model })), env.backends.map((backend) => ({ ...backend })));
		assert.ok(result(card).includes('data-media-preview'), 'the artifact survives the re-render');
		assert.strictEqual(env.imageCards()[0], card);
	}

	// (d) A genuinely new model adds its card while existing results stay; changed markup carries values and results over.
	{
		const env = build();
		const first = env.chatCards()[0];
		first.els['[data-test-prompt]'].value = 'custom prompt';
		await ticking(env, () => env.api.runProviderMediaTest(first.els['[data-provider-test]']));
		assert.ok(hasReply(first));
		const writesBefore = env.panels.providerChatTests.writes;
		env.api.renderProviderTestPanels([...env.models, { id: 'm-new', type: 'text', backend: 'api-b', job_types: ['chat'] }], env.backends);
		assert.strictEqual(env.panels.providerChatTests.writes, writesBefore + 1, 'the changed card set is rendered');
		assert.strictEqual(env.chatCards().length, 3);
		assert.ok(env.chatCards().includes(first), 'the existing card element is reused');
		assert.ok(hasReply(first) && first.els['[data-test-prompt]'].value === 'custom prompt');
		assert.ok(env.chatCards().some((card) => card.els['[data-provider-test]'].dataset.model === 'm-new'));
		// Changed markup for an existing model (new label): a new element inherits the entered values and last result.
		env.api.renderProviderTestPanels([...env.models, { id: 'm-new', type: 'text', backend: 'api-b', job_types: ['chat'] }], env.backends.map((backend) => backend.id === 'api-b' ? { ...backend, label: 'API Renamed' } : backend));
		const renamed = env.chatCards().find((card) => card.els['[data-provider-test]'].dataset.model === 'm-api');
		assert.ok(renamed.markup.includes('API Renamed'));
		assert.ok(hasReply(renamed) && renamed.els['[data-test-prompt]'].value === 'custom prompt', 'the replacement card inherits the last result and entered values');
		assert.ok(renamed !== first, 'a card with changed markup is a new element');
		assert.strictEqual(env.chatCards().length, 3);
		// A model that disappears loses its card.
		env.api.renderProviderTestPanels(env.models.filter((model) => model.id !== 'm-cli'), env.backends);
		assert.ok(!env.chatCards().some((card) => card.els['[data-provider-test]'].dataset.model === 'm-cli'));
	}

	// Changed markup during a run is deferred and applied after settle without losing the reply.
	{
		const env = build({ sse: false });
		const card = env.chatCards().find((entry) => entry.els['[data-provider-test]'].dataset.model === 'm-cli');
		const running = env.api.runProviderMediaTest(card.els['[data-provider-test]']);
		await delay(1);
		env.api.renderProviderTestPanels([...env.models, { id: 'm-late', type: 'text', backend: 'api-b', job_types: ['chat'] }], env.backends);
		assert.strictEqual(env.chatCards().length, 2, 'rendering waits for the test');
		await ticking(env, () => running);
		assert.strictEqual(env.chatCards().length, 3, 'the deferred render is applied once the test settles');
		assert.ok(env.chatCards().includes(card) && hasReply(card));
	}

	// POST fails at network level, the job stays tracked and is then evicted from the status: Run all must not hang.
	// A tracked job is only dropped after 3 fresh snapshots AND 45 s since the first miss, so the clock runs fast here (3 s per tick).
	{
		const env = build({ sse: false, post: 'network', jobEnd: 'evicted', jobEndDelayMs: 40 });
		const realNow = Date.now;
		let offset = 0;
		Date.now = () => realNow.call(Date) + offset;
		let outcome;
		const ticker = setInterval(() => { offset += 3000; env.api.updateProviderTestProgress({ fresh: true }); }, 10);
		try { outcome = await within(env.api.runAllChatTests()); } finally { clearInterval(ticker); Date.now = realNow; }
		assert.strictEqual(outcome, 'done', 'Run all finishes when the tracked job disappears');
		assert.strictEqual(summary(env), '0 passed / 2 failed');
		for (const card of env.chatCards()) {
			assert.strictEqual(card.els['[data-test-message]'].textContent, 'Test job is no longer tracked by the Relay.');
			assert.ok(!card.dataset.testRequestId && !card.dataset.testContinuing);
		}
		assert.strictEqual(env.chatRunAll.running, false);
		// Renders are no longer blocked.
		env.api.renderProviderTestPanels([...env.models, { id: 'm-after', type: 'text', backend: 'api-b', job_types: ['chat'] }], env.backends);
		assert.strictEqual(env.chatCards().length, 3, 'a render requested afterwards is applied');
	}

	// POST fails at network level and the job ends as cancelled (a terminal state other than completed/failed).
	{
		const env = build({ sse: false, post: 'network', jobEnd: 'cancelled', jobEndDelayMs: 40 });
		const outcome = await within(ticking(env, () => env.api.runAllChatTests()));
		assert.strictEqual(outcome, 'done');
		assert.strictEqual(summary(env), '0 passed / 2 failed');
		assert.ok(env.chatCards().every((card) => card.els['[data-test-progress]'].textContent.startsWith('Cancelled')));
		assert.ok(env.chatCards().every((card) => !card.dataset.testRequestId));
	}

	// Cancel during an awaited card stops waiting promptly and leaves the job running.
	{
		const env = build({ sse: false, post: 'network', jobEnd: 'never' });
		const running = env.api.runAllChatTests();
		await ticking(env, async () => {
			await delay(60);
			env.api.cancelChatRunAll();
			assert.strictEqual(await within(running, 500), 'done', 'Run all exits promptly after Cancel');
		});
		const [first, second] = env.chatCards();
		assert.strictEqual(summary(env), '0 passed / 0 failed · 1 cancelled (still running in Live) · 1 not run (cancelled)');
		assert.ok(first.dataset.testRequestId && first.dataset.testDetached === '1', 'the job keeps running and the card keeps following it');
		assert.ok(first.els['[data-test-message]'].textContent.includes('Still running in Live'));
		assert.ok(!second.dataset.testRequestId, 'no further test was started');
		assert.strictEqual(env.chatRunAll.running, false);
		assert.strictEqual(env.fields.cancelAllChatTests.hidden, true);
		// The detached job finishes later: the card settles by itself and a deferred render runs.
		env.api.renderProviderTestPanels([...env.models, { id: 'm-after-cancel', type: 'text', backend: 'api-b', job_types: ['chat'] }], env.backends);
		assert.strictEqual(env.chatCards().length, 2, 'rendering still waits for the card that is running');
		env.finishJob(first.dataset.testRequestId, 'completed', 'chat');
		env.api.updateProviderTestProgress();
		assert.ok(!first.dataset.testRequestId && !first.dataset.testDetached);
		assert.strictEqual(env.chatCards().length, 3, 'the deferred render runs once the detached card settles');
	}

	// A chat job that completed after the POST connection dropped is a warning, not a failure.
	for (const jobEndDelayMs of [30, 0]) {
		const env = build({ sse: false, post: 'network', jobEnd: 'completed', jobEndDelayMs });
		const card = env.chatCards()[0];
		assert.strictEqual(await within(ticking(env, () => env.api.runAllChatTests())), 'done');
		assert.strictEqual(card.dataset.testOutcome, 'noreply');
		assert.ok(card.els['[data-test-message]'].textContent.includes('reply not returned to this page; open in Live'));
		assert.ok(result(card).includes('data-open-live-job') && result(card).includes('Open job in Live'));
		assert.strictEqual(summary(env), '2 passed / 0 failed · 2 without reply', 'delay ' + jobEndDelayMs);
	}

	// A request rejected before any job exists is a plain failure with the server message.
	{
		const env = build({ sse: false, post: 'validation' });
		assert.strictEqual(await within(ticking(env, () => env.api.runAllChatTests())), 'done');
		assert.strictEqual(summary(env), '0 passed / 2 failed');
		assert.ok(result(env.chatCards()[0]).includes('Bad request.'));
	}

	// ---- Status feed failures: a failed status refresh is not evidence that a job is gone ----
	// Uses the real refresh / renderStatus / renderJobs against a scripted Relay whose status endpoint can fail.
	function buildFeed(options = {}) {
		const { post = 'network', jobEnd = 'completed', jobEndDelayMs = 150 } = options;
		const dom = makeStubDom();
		const panels = { providerImageTests: dom.makeContainer(), providerVideoTests: dom.makeContainer(), providerAnalysisTests: dom.makeContainer(), providerAudioTests: dom.makeContainer(), providerChatTests: dom.makeContainer() };
		const base = { ...panels, runAllChatTests: { disabled: false }, cancelAllChatTests: { hidden: true, disabled: false }, chatRunAllSummary: { textContent: '' } };
		const fields = new Proxy(base, { get: (target, key) => (key in target ? target[key] : (target[key] = { textContent: '', innerHTML: '', hidden: false, disabled: false })) });
		const env = { panels, fields, serverJobs: new Map(), statusDown: false, statusFailAfter: null, statusFetches: 0, paused: true, health: [], live: [], badges: [], debug: [], chatRunAll: { running: false, cancelled: false } };
		env.snapshot = () => {
			const active = []; const recent = [];
			for (const job of env.serverJobs.values()) (job.status === 'running' || job.status === 'queued' ? active : recent).push({ ...job });
			return { active, queued: [], recent, running_count: active.length, queued_count: 0 };
		};
		const fetch = async (url, init) => {
			if (url === '/status') {
				env.statusFetches += 1;
				// statusFailAfter: number of status fetches that still succeed before the feed goes down (null = no limit).
				if (env.statusDown || (env.statusFailAfter !== null && env.statusFailAfter-- <= 0)) throw new TypeError('Failed to fetch');
				return { ok: true, status: 200, json: async () => ({ success: true, jobs: env.snapshot(), refresh: env.refreshActive ? { active: true } : { active: false } }) };
			}
			if (url === '/caps') return { ok: true, status: 200, json: async () => ({}) };
			const body = JSON.parse(init.body);
			const id = body.test_request_id;
			if (post === 'validation') return { ok: false, status: 400, json: async () => ({ success: false, category: 'validation', message: 'Bad request.' }) };
			if (post === 'drop') { await delay(3); throw new TypeError('Failed to fetch'); }
			env.serverJobs.set(id, { request_id: id, status: 'running', elapsed_ms: 1 });
			setTimeout(() => {
				if (jobEnd === 'evicted') env.serverJobs.delete(id);
				else if (env.serverJobs.has(id)) Object.assign(env.serverJobs.get(id), { status: jobEnd, elapsed_ms: jobEndDelayMs });
			}, jobEndDelayMs);
			await delay(3);
			throw new TypeError('Failed to fetch');
		};
		const noop = () => {};
		const overrides = { statusUrl: '/status', capabilitiesUrl: '/caps', currentCapabilities: {}, renderCapabilities: noop, setPill: noop, renderDetails: () => '', renderAsrDetails: noop,
			updateHealthCards: (payload, ok) => env.health.push({ success: payload.success, ok }), renderDebugHealth: noop, updateProviderRefreshState: noop, captureSessionOutputScrolls: () => [],
			renderLiveJobList: (jobs) => env.live.push(jobs), livePinned: false, selectedLiveRequestId: '', renderLiveDetail: noop, findJobByRequestId: () => null, seenLiveRequestIds: new Set(), pendingLiveJob: () => null,
			autoSelectLiveJob: noop, updateTabBadges: (jobs) => env.badges.push(jobs), renderDebugFailures: (jobs) => env.debug.push(jobs), applyRawStatusFilter: noop, queueRestoreSessionOutputScrolls: noop };
		env.api = loadProviderTestApi({ fields, chatRunAll: env.chatRunAll, document: dom.document, fetch, currentStatus: { jobs: { active: [], queued: [], recent: [] } }, override: overrides, extra: ['refresh', 'renderStatus', 'renderJobs'] });
		env.api.renderProviderTestPanels(TEST_MODELS, TEST_BACKENDS);
		env.cards = () => panels.providerChatTests.cards;
		// Ticker: 10 ms progress tick (not a fresh snapshot) plus a 25 ms Relay jobs feed unless paused.
		env.run = async (work) => {
			const tick = setInterval(() => env.api.updateProviderTestProgress(), 10);
			const feed = setInterval(() => { if (!env.paused) env.api.renderJobs(env.snapshot()); }, 25);
			try { return await work(); } finally { clearInterval(tick); clearInterval(feed); }
		};
		return env;
	}

	// E2: the POST connection drops, the first status refresh after it succeeds (the job is known) and later refreshes fail.
	// The card must keep following (not report "Failed to fetch"), and when the job completes later it settles as completed
	// without a reply; Run all counts it passed.
	{
		const env = buildFeed({ post: 'network', jobEndDelayMs: 150 });
		const [first, second] = env.cards();
		env.statusFailAfter = 1;
		const running = env.run(() => env.api.runAllChatTests());
		await delay(40);
		assert.ok(first.dataset.testRequestId && first.dataset.testContinuing === '1', 'the card keeps following after the POST drop and failed refreshes');
		assert.ok(!first.dataset.testOutcome, 'no outcome is reported yet');
		assert.strictEqual(first.els['[data-test-message]'].textContent, 'Relay unreachable — waiting for status…', 'an unknown job under a failing status feed says the Relay is unreachable');
		assert.ok(!first.els['[data-test-progress]'].textContent.startsWith('Failed'));
		assert.ok(!result(first).includes('provider-chat-warning'), 'no failure is rendered');
		assert.ok(!first.els['[data-test-message]'].textContent.includes('Failed to fetch'));
		assert.deepStrictEqual(env.health[env.health.length - 1], { success: false, ok: false }, 'health consumers still see the failed refresh');
		env.statusFailAfter = null;
		env.paused = false;
		assert.strictEqual(await within(running, 4000), 'done', 'Run all finishes once the job completes');
		for (const card of [first, second]) {
			assert.strictEqual(card.dataset.testOutcome, 'noreply');
			assert.ok(!card.dataset.testRequestId && !card.dataset.testContinuing);
			assert.ok(card.els['[data-test-message]'].textContent.includes('reply not returned to this page; open in Live'));
		}
		assert.strictEqual(summary(env), '2 passed / 0 failed · 2 without reply');
		assert.ok([...env.serverJobs.values()].every((job) => job.status === 'completed'));
	}

	// E1: failed status refreshes (and plain ticks) never evict a followed job; only three fresh snapshots lacking it, spread
	// over at least 45 s, do. The clock is faked so the 45 s can pass.
	{
		const env = buildFeed({ post: 'network', jobEnd: 'evicted', jobEndDelayMs: 20 });
		env.statusFailAfter = 1;
		const card = env.cards()[0];
		const realNow = Date.now;
		let offset = 0;
		Date.now = () => realNow.call(Date) + offset;
		try {
			await env.run(async () => {
				await env.api.runProviderMediaTest(card.els['[data-provider-test]']);
				await delay(120);
				for (let attempt = 0; attempt < 6; attempt += 1) await env.api.refresh();
				assert.ok(card.dataset.testRequestId && card.dataset.testContinuing === '1', 'failed refreshes and ticks do not evict the job');
				assert.ok(!card.providerTestMissing, 'the missing-job counter has not started');
				assert.strictEqual(env.api.getStatus().success, false);
				env.statusFailAfter = null;
				await env.api.refresh();
				await env.api.refresh();
				assert.ok(card.dataset.testRequestId, 'two fresh snapshots lacking the job are not enough');
				await env.api.refresh();
				assert.ok(card.dataset.testRequestId, 'three fresh snapshots lacking the job are not enough before 45 s have passed');
				offset += 44000;
				await env.api.refresh();
				await delay(30);
				assert.ok(card.dataset.testRequestId && card.dataset.testContinuing === '1', 'still within 45 s of the first miss');
				offset += 2000;
				await delay(30);
				assert.ok(!card.dataset.testRequestId && !card.dataset.testContinuing, 'three fresh snapshots over 45 s evict the job');
				assert.strictEqual(card.dataset.testOutcome, 'failed');
				assert.strictEqual(card.els['[data-test-message]'].textContent, 'Test job is no longer tracked by the Relay.');
			});
		} finally {
			Date.now = realNow;
		}
	}

	// A job the Relay only creates late (the request spent time in provider probes before the job existed) is not evicted:
	// early fresh snapshots lacking it do not count until 45 s have passed, and once it appears the miss tracker resets.
	{
		const env = buildFeed({ post: 'network', jobEnd: 'completed', jobEndDelayMs: 20 });
		const card = env.cards()[0];
		const realNow = Date.now;
		let offset = 0;
		Date.now = () => realNow.call(Date) + offset;
		try {
			const lateId = 'status-test-ui-late-job';
			card.dataset.testRequestId = lateId;
			card.dataset.testStartedAt = String(Date.now());
			card.dataset.testContinuing = '1';
			for (let index = 0; index < 8; index += 1) {
				env.api.getStatus().jobs = { active: [], queued: [], recent: [] };
				env.api.updateProviderTestProgress({ fresh: true });
				offset += 5000;
				assert.ok(card.dataset.testRequestId, 'snapshot ' + (index + 1) + ' within 40 s does not evict the card');
			}
			// The job shows up in the next snapshot.
			env.api.getStatus().jobs = { active: [{ request_id: lateId, status: 'running', elapsed_ms: 1 }], queued: [], recent: [] };
			env.api.updateProviderTestProgress({ fresh: true });
			assert.strictEqual(card.providerTestMissing, null, 'the miss tracker resets once the job is seen');
			assert.ok(card.dataset.testRequestId && card.dataset.testContinuing === '1');
		} finally {
			Date.now = realNow;
		}
	}

	// A healthy status feed with a silent running job (an API chat produces no session output) never times out; the
	// two-minute "Status unknown" rule only applies while the feed is stale, measured from when it became stale.
	{
		const env = buildFeed({ post: 'network', jobEnd: 'never', jobEndDelayMs: 0 });
		const [card] = env.cards();
		const realNow = Date.now;
		let now = realNow.call(Date);
		Date.now = () => now;
		try {
			env.statusFailAfter = 1;
			const running = env.api.runProviderMediaTest(card.els['[data-provider-test]']);
			await delay(30);
			env.statusFailAfter = null;
			await env.api.refresh();
			assert.ok(card.dataset.testRequestId && card.dataset.testContinuing === '1', 'the card follows the running job');
			for (let second = 0; second < 600; second += 1) {
				now += 1000;
				if (second % 5 === 0) env.api.updateProviderTestProgress({ fresh: true });
				else env.api.updateProviderTestProgress();
			}
			assert.ok(card.dataset.testRequestId && card.dataset.testContinuing === '1', 'a silent job on a healthy feed is still followed after 10 minutes');
			assert.ok(card.els['[data-test-message]'].textContent.startsWith('Running'), 'it is presented as running');
			// Even with only the one-second ticker and no snapshot (SSE without job changes) the card keeps following.
			now += 700000;
			env.api.updateProviderTestProgress();
			assert.ok(card.dataset.testRequestId, 'ticks alone never time out a healthy feed');
			// The feed becomes stale: the two minutes are measured from that moment.
			env.api.updateProviderTestProgress({ fresh: false });
			now += 119000;
			env.api.updateProviderTestProgress({ fresh: false });
			assert.ok(card.dataset.testRequestId, 'still waiting 119 s after the feed went stale');
			now += 2000;
			env.api.updateProviderTestProgress();
			assert.ok(!card.dataset.testRequestId, 'settles after 121 s of stale feed');
			assert.strictEqual(card.dataset.testOutcome, 'failed');
			assert.strictEqual(card.els['[data-test-message]'].textContent, 'Status unknown — the Relay did not report status for 2 minutes; check Live.');
			assert.strictEqual(card.els['[data-provider-test]'].disabled, false);
			assert.strictEqual(await within(running), 'done');
		} finally {
			Date.now = realNow;
		}
	}

	// The POST fails at network level, the follow-up status refresh fails too and no job with this request id is known: the
	// Relay is down. The card fails at once instead of following a job that may never have been created, and Run all moves on.
	{
		const env = buildFeed({ post: 'network' });
		env.statusDown = true;
		const started = Date.now();
		assert.strictEqual(await within(env.run(() => env.api.runAllChatTests()), 2000), 'done', 'Run all finishes promptly with the Relay down');
		assert.ok(Date.now() - started < 2000);
		assert.strictEqual(summary(env), '0 passed / 2 failed');
		for (const card of env.cards()) {
			assert.strictEqual(card.dataset.testOutcome, 'failed');
			assert.strictEqual(card.els['[data-test-message]'].textContent, 'Relay unreachable — the test could not be confirmed. Check that AI Model Relay is running.');
			assert.ok(result(card).includes('Relay unreachable — the test could not be confirmed. Check that AI Model Relay is running.'));
			assert.ok(card.els['[data-test-progress]'].textContent.startsWith('Failed'));
			assert.ok(!card.dataset.testRequestId && !card.dataset.testContinuing);
			assert.strictEqual(card.els['[data-provider-test]'].disabled, false, 'the button is re-enabled');
		}
		assert.strictEqual(env.chatRunAll.running, false);
	}

	// A failed refresh shows the error state page-wide, exactly like before this feature: no running jobs, counts, badges or
	// live list entries are rendered from the last known snapshot. Only the provider-test tracker keeps following its job.
	{
		const env = buildFeed({ post: 'network', jobEndDelayMs: 1000 });
		env.serverJobs.set('known', { request_id: 'known', status: 'running', elapsed_ms: 1 });
		await env.api.refresh();
		assert.strictEqual(env.api.getStatus().jobs.active.length, 1);
		assert.strictEqual(env.fields.jobCounts.textContent, 'Running 1 / Queued 0');
		assert.strictEqual(env.live[env.live.length - 1].active.length, 1);
		const [card] = env.cards();
		env.statusFailAfter = 1;
		const running = env.api.runProviderMediaTest(card.els['[data-provider-test]']);
		await delay(60);
		assert.ok(card.dataset.testRequestId && card.dataset.testContinuing === '1', 'the card keeps following through the failed refresh');
		const status = env.api.getStatus();
		assert.strictEqual(status.success, false);
		assert.deepStrictEqual(status.jobs, {}, 'page-wide state matches the pre-feature failed refresh: empty jobs');
		assert.strictEqual(env.fields.jobCounts.textContent, 'Running 0 / Queued 0', 'Overview shows no running jobs');
		for (const snapshot of [env.live[env.live.length - 1], env.badges[env.badges.length - 1], env.debug[env.debug.length - 1]]) {
			assert.deepStrictEqual(snapshot, {}, 'Live list, tab badges and Debug get no stale jobs');
		}
		assert.deepStrictEqual(env.health[env.health.length - 1], { success: false, ok: false });
		const progress = card.els['[data-test-progress]'].textContent;
		assert.ok(!progress.startsWith('Running') && !card.els['[data-test-message]'].textContent.startsWith('Running'), 'the test card does not claim the job is running');
		assert.strictEqual(card.els['[data-test-message]'].textContent, 'Relay unreachable — waiting for status…');
		// Fresh status returns: the card settles from the Relay's report.
		env.serverJobs.get(card.dataset.testRequestId).status = 'completed';
		env.statusFailAfter = null;
		await env.api.refresh();
		assert.strictEqual(await within(running), 'done');
		assert.strictEqual(card.dataset.testOutcome, 'noreply');
		assert.ok(!card.dataset.testRequestId && !card.dataset.testContinuing);
		assert.strictEqual(env.fields.jobCounts.textContent, 'Running 1 / Queued 0', 'fresh status renders normally again');
	}

	// A followed card whose status feed never recovers settles after two minutes of stale feed.
	{
		const env = buildFeed({ post: 'network', jobEndDelayMs: 500 });
		const [card] = env.cards();
		const realNow = Date.now;
		let now = realNow.call(Date);
		Date.now = () => now;
		try {
			await env.api.refresh();
			env.statusFailAfter = 1;
			const running = env.api.runProviderMediaTest(card.els['[data-provider-test]']);
			await delay(30);
			assert.ok(card.dataset.testRequestId && card.dataset.testContinuing === '1');
			now += 119000;
			env.api.updateProviderTestProgress({ fresh: false });
			assert.ok(card.dataset.testRequestId, 'still waiting just before two minutes');
			assert.strictEqual(card.els['[data-test-message]'].textContent, 'Relay unreachable — waiting for status…');
			now += 2000;
			env.api.updateProviderTestProgress();
			assert.ok(!card.dataset.testRequestId && !card.dataset.testContinuing, 'the card stops following');
			assert.strictEqual(card.dataset.testOutcome, 'failed');
			assert.strictEqual(card.els['[data-test-message]'].textContent, 'Status unknown — the Relay did not report status for 2 minutes; check Live.');
			assert.strictEqual(card.els['[data-provider-test]'].disabled, false, 'the button is re-enabled');
			assert.strictEqual(await within(running), 'done');
			// A fresh snapshot resets the clock.
			const other = env.cards()[1];
			env.statusFailAfter = null;
			const again = env.api.runProviderMediaTest(other.els['[data-provider-test]']);
			await delay(30);
			assert.ok(other.dataset.testContinuing === '1');
			now += 100000;
			await env.api.refresh();
			now += 100000;
			env.api.updateProviderTestProgress();
			assert.ok(other.dataset.testRequestId, 'a fresh snapshot within two minutes keeps the card following');
			env.serverJobs.get(other.dataset.testRequestId).status = 'completed';
			await env.api.refresh();
			assert.strictEqual(await within(again), 'done');
			assert.strictEqual(other.dataset.testOutcome, 'noreply');
		} finally {
			Date.now = realNow;
		}
	}

	// An idle Relay sends no snapshots, so a card following a job it has never seen polls the status itself (at most every 5 s)
	// and gives up after 60 s with a "not found" message. The clock is faked so the 60 s can pass.
	{
		const realNow = Date.now;
		let now = realNow.call(Date);
		Date.now = () => now;
		const tickUntil = async (env, done, maxSeconds, each) => {
			for (let second = 1; second <= maxSeconds && !done(); second += 1) {
				now += 1000;
				env.api.updateProviderTestProgress();
				await delay(2);
				if (each) each(second);
			}
		};
		const notFound = 'Test job was not found on the Relay; it may not have started. Check Live.';
		try {
			// POST dropped and no job is ever created.
			{
				const env = buildFeed({ post: 'drop' });
				const [card] = env.cards();
				await env.api.runProviderMediaTest(card.els['[data-provider-test]']);
				assert.ok(card.dataset.testRequestId && card.dataset.testContinuing === '1', 'the card follows after the dropped POST');
				assert.strictEqual(env.fields.runAllChatTests.disabled, true, 'Run all is disabled while the card is in flight');
				const baseline = env.statusFetches;
				await tickUntil(env, () => !card.dataset.testRequestId, 59);
				assert.ok(card.dataset.testRequestId, 'still following at 59 s');
				assert.strictEqual(card.els['[data-test-message]'].textContent, 'Connection lost — following the job in Live…');
				await tickUntil(env, () => !card.dataset.testRequestId, 5);
				assert.ok(!card.dataset.testRequestId && !card.dataset.testContinuing, 'settled at about 60 s');
				assert.strictEqual(card.dataset.testOutcome, 'failed');
				assert.strictEqual(card.els['[data-test-message]'].textContent, notFound);
				assert.ok(card.els['[data-test-progress]'].textContent.startsWith('Failed'));
				assert.strictEqual(card.els['[data-provider-test]'].disabled, false, 'the button is re-enabled');
				assert.strictEqual(env.fields.runAllChatTests.disabled, false, 'Run all is enabled again');
				const polls = env.statusFetches - baseline;
				assert.ok(polls >= 10 && polls <= 12, 'about one status refresh every 5 s, not every second: ' + polls);
				const after = env.statusFetches;
				await tickUntil(env, () => false, 30);
				assert.strictEqual(env.statusFetches, after, 'no polling once nothing is following');
			}

			// While a provider detection refresh is active the Relay may still be probing before it creates the job: the 60 s
			// "not found" clock does not run, and restarts once the refresh is over. The ticker's polls do not touch the
			// header live-status text (SSE stays "connected").
			{
				const env = buildFeed({ post: 'drop' });
				const [card] = env.cards();
				env.refreshActive = true;
				env.fields.updated.textContent = 'Live updates connected';
				await env.api.runProviderMediaTest(card.els['[data-provider-test]']);
				await tickUntil(env, () => !card.dataset.testRequestId, 150);
				assert.ok(card.dataset.testRequestId, 'still following after 150 s while a detection refresh is active');
				assert.ok(env.statusFetches > 0, 'the ticker polled');
				assert.ok(!env.fields.updated.textContent.startsWith('Polled'), 'the ticker poll does not replace the live-status text with "Polled"');
				env.refreshActive = false;
				await tickUntil(env, () => !card.dataset.testRequestId, 50);
				assert.ok(card.dataset.testRequestId, 'the clock restarts when the refresh ends, so no give-up after 50 s');
				await tickUntil(env, () => !card.dataset.testRequestId, 30);
				assert.ok(!card.dataset.testRequestId, 'given up about 60 s after the refresh ended');
				assert.strictEqual(card.els['[data-test-message]'].textContent, notFound);
				assert.ok(!env.fields.updated.textContent.startsWith('Polled'));
				await env.api.refresh();
				assert.ok(env.fields.updated.textContent.startsWith('Polled - updated'), 'a regular refresh still reports the poll');
				env.fields.updated.textContent = 'Live updates connected';
				await env.api.refresh({ silent: true });
				assert.ok(!env.fields.updated.textContent.startsWith('Polled'), 'a silent refresh does not report "Polled"');
			}

			// Run all continues with the next card after the first one is given up on.
			{
				const env = buildFeed({ post: 'drop' });
				const running = env.api.runAllChatTests();
				let finished = false;
				running.then(() => { finished = true; });
				await delay(30);
				await tickUntil(env, () => finished, 200);
				assert.ok(finished, 'Run all finished');
				assert.strictEqual(summary(env), '0 passed / 2 failed');
				for (const card of env.cards()) {
					assert.strictEqual(card.els['[data-test-message]'].textContent, notFound);
					assert.ok(!card.dataset.testRequestId);
				}
			}

			// The job only appears at 20 s: the card keeps following it (no 60 s give-up, no polling while it is present) and
			// settles normally when it completes.
			{
				const env = buildFeed({ post: 'drop' });
				const [card] = env.cards();
				await env.api.runProviderMediaTest(card.els['[data-provider-test]']);
				const id = card.dataset.testRequestId;
				await tickUntil(env, () => false, 20);
				assert.ok(id && card.dataset.testRequestId === id, 'still following at 20 s');
				env.serverJobs.set(id, { request_id: id, status: 'running', elapsed_ms: 1 });
				await tickUntil(env, () => false, 5);
				assert.ok(card.dataset.testRequestId === id, 'the next poll finds the job');
				assert.ok(card.els['[data-test-message]'].textContent.startsWith('Running'), 'it is presented as running');
				const baseline = env.statusFetches;
				await tickUntil(env, () => false, 90);
				assert.ok(card.dataset.testRequestId === id && card.dataset.testContinuing === '1', 'a job seen once is followed past 60 s');
				assert.strictEqual(env.statusFetches, baseline, 'no polling while the job is present in the snapshots');
				env.serverJobs.get(id).status = 'completed';
				env.paused = false;
				env.api.renderJobs(env.snapshot());
				await delay(5);
				assert.ok(!card.dataset.testRequestId, 'settled on completion');
				assert.strictEqual(card.dataset.testOutcome, 'noreply');
				assert.ok(card.els['[data-test-message]'].textContent.includes('reply not returned to this page; open in Live'));
			}

			// A job that was seen and then vanishes keeps the 3-snapshot / 45 s eviction rule (with its own message).
			{
				const env = buildFeed({ post: 'drop' });
				const [card] = env.cards();
				await env.api.runProviderMediaTest(card.els['[data-provider-test]']);
				const id = card.dataset.testRequestId;
				env.serverJobs.set(id, { request_id: id, status: 'running', elapsed_ms: 1 });
				await tickUntil(env, () => false, 6);
				env.serverJobs.delete(id);
				// The Relay announces the eviction in jobs events (the job is in the last snapshot, so the ticker does not poll).
				await tickUntil(env, () => !card.dataset.testRequestId, 120, (second) => { if (second % 5 === 0) env.api.renderJobs(env.snapshot()); });
				assert.strictEqual(card.dataset.testOutcome, 'failed');
				assert.strictEqual(card.els['[data-test-message]'].textContent, 'Test job is no longer tracked by the Relay.');
			}

			// Nothing following: the ticker never asks for a status.
			{
				const env = buildFeed({ post: 'drop' });
				await tickUntil(env, () => false, 30);
				assert.strictEqual(env.statusFetches, 0);
			}
		} finally {
			Date.now = realNow;
		}
	}

	// Run all is disabled while any chat card is in flight (also one started on its own card) and enabled again afterwards.
	{
		const env = buildFeed({ post: 'network', jobEndDelayMs: 150 });
		const [first] = env.cards();
		assert.strictEqual(env.fields.runAllChatTests.disabled, false, 'enabled when idle');
		env.paused = false;
		await env.run(async () => {
			const running = env.api.runProviderMediaTest(first.els['[data-provider-test]']);
			await delay(20);
			assert.ok(first.dataset.testRequestId);
			assert.strictEqual(env.fields.runAllChatTests.disabled, true, 'disabled while a chat card is busy');
			await running;
			await delay(300);
		});
		assert.ok(!first.dataset.testRequestId);
		assert.strictEqual(env.fields.runAllChatTests.disabled, false, 'enabled again once no card is busy');
	}

	// A request rejected by the server (HTTP error response) is a definite failure even if the status feed is down,
	// and so is a local validation error raised before any request is sent.
	{
		const env = buildFeed({ post: 'validation' });
		env.statusDown = true;
		assert.strictEqual(await within(env.run(() => env.api.runAllChatTests())), 'done');
		assert.strictEqual(summary(env), '0 passed / 2 failed');
		assert.ok(result(env.cards()[0]).includes('Bad request.'));
		assert.ok(env.cards().every((card) => !card.dataset.testRequestId && !card.dataset.testContinuing));
		const local = buildFeed({ post: 'network' });
		local.statusDown = true;
		local.cards()[0].els['[data-test-prompt]'].value = '';
		assert.strictEqual(await within(local.api.runProviderMediaTest(local.cards()[0].els['[data-provider-test]'])), 'done');
		assert.strictEqual(local.cards()[0].dataset.testOutcome, 'failed');
		assert.ok(result(local.cards()[0]).includes('Enter a test prompt'));
		assert.ok(!local.cards()[0].dataset.testContinuing && !local.cards()[0].dataset.testRequestId);
	}
})().then(() => {
	console.log('status page tests passed');
}, (error) => {
	console.error(error);
	process.exit(1);
});
