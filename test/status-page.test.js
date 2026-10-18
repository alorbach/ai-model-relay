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
assert.ok(html.includes('Save changes') && html.includes('id="discardRelaySettings"'), 'the sticky bar has Save and Discard');
assert.ok(!html.includes('Save paths &amp; routing') && !html.includes('id="relayCliPaths"'), 'the old long form is gone');
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
assert.ok(html.includes('saveRelaySettings({ quiet: true, cliPathsOnly: true })'));
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
// The saved pairing token is cleared on the stable server error code, not on message text.
assert.ok(html.includes("payload.code === 'origin_not_paired'"));
assert.ok(!html.includes("payload.message === 'This browser origin is not paired"));
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
assert.ok(html.includes('Use the CUDA Upscale page to install an available pinned model'));
assert.ok(html.includes('Native ×2 and ×4 outputs are never downsampled'));
assert.ok(html.includes('Jobs never download a model, downsample native output, or fall back to CPU'));
assert.ok(html.includes('id="upscaleSetupLog"'));
assert.ok(html.includes('<h2 class="card-title">Local Image Generation</h2>'));
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
assert.ok(html.includes('data-route="image"'));
assert.ok(html.includes('Use the Local Image page to set up the Diffusers runtime'));
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
assert.ok(html.includes('id="sidebar-nav"'));
for (const route of ['overview', 'live', 'providers', 'tests', 'runtime', 'asr', 'image', 'upscale', 'music', 'pairing', 'debug']) {
	assert.ok(html.includes('data-route="' + route + '"'), 'sidebar entry ' + route);
	assert.ok(html.includes('id="view-' + route + '"'), 'view ' + route);
}
assert.ok(!html.includes('id="settings-nav"'), 'the settings sub-navigation is gone');
assert.ok(html.includes('id="relayRuntimeSettings"'));
assert.ok(!html.includes('id="relayProviderOptions"'), 'provider options live on the provider cards');
assert.ok(html.includes('id="saveRelayRuntimeSettings"'));
assert.ok(html.includes('function collectRelaySettingsPayload(section)'));
assert.ok(html.includes("saveRelaySettings({ section: 'runtime' })"));
assert.ok(html.includes('function restoreRelaySection(section, preserved)'));
assert.ok(html.includes('reapplyRelayEdits(edits)') && html.includes('function diffFormEdits('), 'a background reload re-baselines and re-applies only the fields the user edited');
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
assert.ok(html.includes('function selectRoute(routeId'));
assert.ok(html.includes('function renderLiveJobList(jobs)'));
assert.ok(html.includes('function renderLiveDetail(job)'));
assert.ok(html.includes('id="liveJobList"'));
assert.ok(!html.includes('role="listbox"') && !html.includes("'role', 'option'"), 'the job list is a plain list of buttons, not a listbox without arrow-key handling');
assert.ok(html.includes("card.setAttribute('aria-pressed', requestId === selectedLiveRequestId"));
assert.ok(/@media \(max-width: 420px\) \{\s*\.segmented \{ flex-wrap: wrap;/.test(html), 'the segmented test-type control wraps on narrow screens');
assert.ok(html.includes('id="liveDetailBody"'));
assert.ok(html.includes('id="debugHealthList"'));
assert.ok(html.includes('id="debugFailureList"'));
assert.ok(html.includes('id="rawStatusFilter"'));
assert.ok(html.includes('function renderDebugHealth(payload, ok)'));
assert.ok(html.includes('function captureFormSnapshots(keys)'));
assert.ok(html.includes('class="app-shell"'));
assert.ok(html.includes('id="overviewProviderGrid"'));
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

assert.ok(html.includes('data-route="pairing"'));
assert.ok(html.includes('id="persistentPairingCodeInput"'));
assert.ok(html.includes('type="password"'));
assert.ok(html.includes("const pairingCodeSettingsUrl = '/v1/relay/pairing-code'"));
assert.ok(html.includes('The code is never returned to this page after saving.'));

// Claude API settings: text money inputs, re-baseline control, chat timeout field, client-side USD validation.
// (The rendered Claude card is checked in the provider-card block below.)
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
	assert.ok(panel.innerHTML.includes('Enter your dashboard credit balance in Providers'));
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
// Page-level state of the settings load / retry / save logic, for functions extracted into a bare scope.
const RELAY_LOAD_STATE = 'let relaySettingsRetryTimer = null; let relaySettingsRetryDelay = 5000; const relaySettingsRetryMaxMs = 30000; let relaySettingsSaveGeneration = 0; let relaySettingsQueuedOptions = null; const settingsLoadTimeoutMs = 15000; const settingsPostTimeoutMs = 30000; const statusFetchTimeoutMs = 10000;\n';
// The connectivity model's page-level state, for functions extracted into a bare scope.
const CONNECTION_STATE_PRELUDE = "const connectionState = { lastGoodAt: 0, lastSource: '', failureCount: 0, failureSince: 0, sseLive: false, sseSince: 0, polling: false, lastError: '' };";
// Manual clock: setTimeout / clearTimeout that only fire when advance() moves time forward.
function fakeTimers() {
	let now = 0;
	let nextId = 1;
	const timers = new Map();
	return {
		setTimeout(fn, ms) { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
		clearTimeout(id) { timers.delete(id); },
		pending: () => timers.size,
		pendingDelays: () => Array.from(timers.values()).map((timer) => timer.at - now),
		async advance(ms) {
			const target = now + ms;
			for (;;) {
				const due = Array.from(timers.entries()).filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
				if (!due) break;
				timers.delete(due[0]);
				now = Math.max(now, due[1].at);
				due[1].fn();
				for (let i = 0; i < 20; i += 1) await Promise.resolve();
				await delay(0);
			}
			now = target;
		},
	};
}
const PROVIDER_TEST_FUNCTIONS = ['text', 'escapeHtml', 'elapsed', 'jobRequestId', 'readyMediaModels', 'chatTestImageField', 'providerTestControls', 'renderProviderMediaTests', 'renderProviderChatTests', 'setProviderTestPanel', 'copyProviderTestCardState', 'providerTestTerminal', 'providerTestsBusy', 'renderProviderTestPanels', 'flushPendingProviderTestRender', 'waitForProviderTestSettled', 'providerTestSettled', 'updateChatRunAllState', 'chatRunAllSummaryText', 'chatRunAllCountChips', 'renderChatRunAllSummary', 'runAllChatTests', 'cancelChatRunAll', 'chatReplyText', 'chatElapsed', 'renderChatTestResult', 'renderChatTestFailure', 'createProviderTestRequestId', 'providerTestJob', 'setProviderTestActivity', 'restoreProviderTestButton', 'chatTestOutcomeMessage', 'settleProviderTestCard', 'updateProviderTestProgress', 'renderProviderTestResult', 'runProviderMediaTest'];
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
	// The filter matches the raw JSON text, not its HTML-escaped form: 'quot' does not hit &quot;, and a quote or ampersand can be searched.
	const status = { note: 'say "hi" a & b <quot>' };
	const rawJson = JSON.stringify(status, null, 2);
	const runQuery = (query) => { rawStatus.innerHTML = ''; applyFilter({ rawStatus, rawStatusFilter: { value: query } }, status, escapeHtmlForFilter, escapeRegExp)(); return rawStatus.innerHTML; };
	let html = runQuery('quot');
	assert.strictEqual(html.split('<mark>').length - 1, 1, 'only the real "quot" text is highlighted');
	assert.ok(html.includes('&lt;<mark>quot</mark>&gt;') && !html.includes('&<mark>') && !html.includes('&amp;<mark>'), 'no highlight inside an entity');
	html = runQuery('"');
	assert.strictEqual(html.split('<mark>&quot;</mark>').length - 1, rawJson.split('"').length - 1, 'every quote is highlighted');
	assert.ok(!html.includes('&<mark>'));
	html = runQuery('&');
	assert.ok(html.includes('<mark>&amp;</mark>') && html.split('<mark>').length - 1 === 1, 'an ampersand is highlighted as one match');
	html = runQuery('QUOT');
	assert.ok(html.includes('<mark>quot</mark>'), 'matching stays case-insensitive and keeps the original text');
	html = runQuery('<quot>');
	assert.ok(html.includes('<mark>&lt;quot&gt;</mark>'), 'markup in the data is escaped inside the highlight');
}

// Minimal stand-in for the panel containers: innerHTML is parsed into card objects the page functions can query.
function makeStubDom() {
	const containers = [];
	function makeCard(markup, container) {
		const attr = (pattern) => { const match = pattern.exec(markup); return match ? unescapeAttr(match[1]) : ''; };
		const dataset = { cardKey: attr(/data-card-key="([^"]*)"/) };
		if (/data-test-job-type="chat"/.test(markup)) dataset.testJobType = 'chat';
		if (/data-card-test="1"/.test(markup)) dataset.cardTest = '1';
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
	const source = names.map(extractPageFunction).join('\n\n') + (names.includes('refresh') ? '\n\n' + extractPageFunction('fetchJsonWithTimeout') : '');
	const factory = new Function('fields', 'chatRunAll', 'document', 'fetch', 'refresh', 'currentStatus', 'selectRoute', 'selectLiveJob', 'relayTestUrl', 'overrides', 'relayPairingHeaders', 'clearRemotePairingToken',
		'const statusFetchTimeoutMs = 10000; const statusFailureHardCount = 3; const statusFailureHardMs = 30000; let statusRefreshPending = null; ' + CONNECTION_STATE_PRELUDE + ' const {' + Object.keys(override).join(',') + '} = overrides;\nconst providerTestWaiters = new WeakMap(); const providerTestPanels = new WeakMap(); let pendingProviderTestRender = null; let providerTestStatusSerial = 0; let providerTestLastKnownJobs = (currentStatus && currentStatus.jobs) || null; let providerTestLastFreshAt = 0; let providerTestFeedStale = false; let providerTestStaleSince = 0; const providerTestStatusTimeoutMs = 120000; const providerTestMissingMinMs = 45000; const providerTestMissingMinSnapshots = 3; const providerTestNotFoundMs = 60000; const providerTestPollMs = 5000; let providerTestPollInFlight = false; let providerTestLastPollAt = 0;\n' + source +
		'\nreturn { ' + names.join(', ') + ', pending: () => pendingProviderTestRender, getStatus: () => currentStatus, connectionState };');
	return factory(deps.fields, deps.chatRunAll, deps.document, deps.fetch, deps.refresh || (async () => {}), deps.currentStatus, deps.selectRoute || (() => false), deps.selectLiveJob || (() => {}), '/v1/relay/test', override, (extra = {}) => ({ ...extra }), deps.clearRemotePairingToken || (() => {}));
}

// ---- Redesign shell: routes, theme preference, Overview provider tiles ----
{
	const script = inlineScript[1];
	const load = (names, params = [], prelude = '', args = [], returns) => new Function(...params, prelude + '\n' + names.map(extractPageFunction).join('\n\n') + '\nreturn ' + (returns || '{ ' + names.join(', ') + ' }') + ';')(...args);

	// Old hashes keep working and map to the new routes.
	{
		const { resolveRoute, routeIds, hashForRoute, testTabIdForType, testTypeForTabId } = load(['routeIds', 'settingsRouteIds', 'safeDecode', 'testTypeIds', 'normalizeTestType', 'testTabIdForType', 'testTypeForTabId', 'resolveRoute', 'hashForRoute']);
		const expectRoute = (hash, route, liveRequestId = '', providerId = '', testType = '') => assert.deepStrictEqual(resolveRoute(hash), { route, liveRequestId, providerId, testType }, hash);
		expectRoute('', 'overview');
		expectRoute('#overview', 'overview');
		expectRoute('#live', 'live');
		expectRoute('#live/abc%20def', 'live', 'abc def');
		expectRoute('#settings', 'providers');
		expectRoute('#settings/providers', 'providers');
		for (const section of ['runtime', 'tests', 'asr', 'upscale', 'image', 'music', 'pairing']) {
			expectRoute('#settings/' + section, section);
			expectRoute('#' + section, section);
		}
		expectRoute('#settings/bogus', 'providers');
		expectRoute('#SETTINGS/ASR', 'asr');
		expectRoute('#debug', 'debug');
		expectRoute('#providers', 'providers');
		expectRoute('#providers/codex-cli', 'providers', '', 'codex-cli');
		expectRoute('#providers/a%2Fb', 'providers', '', 'a/b');
		expectRoute('#settings/providers/grok-cli', 'providers', '', 'grok-cli');
		expectRoute('#nope', 'overview');
		expectRoute('#tests/extra', 'tests');
		// Tests deep links: #tests/<type> selects the segment, #tests/<type>/<backend id> also highlights that provider's cards.
		expectRoute('#tests/chat', 'tests', '', '', 'chat');
		expectRoute('#tests/images/xai-api', 'tests', '', 'xai-api', 'images');
		expectRoute('#tests/image/xai-api', 'tests', '', 'xai-api', 'images');
		expectRoute('#tests/video/openai-videos', 'tests', '', 'openai-videos', 'videos');
		expectRoute('#tests/analysis/antigravity-cli', 'tests', '', 'antigravity-cli', 'analysis');
		expectRoute('#tests/media.analyze/antigravity-cli', 'tests', '', 'antigravity-cli', 'analysis');
		expectRoute('#tests/audio/local-asr', 'tests', '', 'local-asr', 'audio');
		expectRoute('#tests/transcribe/a%2Fb', 'tests', '', 'a/b', 'audio');
		expectRoute('#TESTS/Images/X', 'tests', '', 'X', 'images');
		expectRoute('#tests/bogus/xai-api', 'tests');
		expectRoute('#tests/constructor', 'tests');
		expectRoute('#settings/tests', 'tests');
		expectRoute('#settings/tests/audio/local-asr', 'tests', '', 'local-asr', 'audio');
		expectRoute('#settings/providers/images/x', 'providers', '', 'images');
		assert.strictEqual(hashForRoute({ route: 'tests', liveRequestId: '', providerId: 'xai-api', testType: 'images' }), 'tests/images/xai-api');
		assert.strictEqual(hashForRoute({ route: 'tests', liveRequestId: '', providerId: 'a/b', testType: 'audio' }), 'tests/audio/a%2Fb');
		assert.strictEqual(hashForRoute({ route: 'tests', liveRequestId: '', providerId: 'orphan', testType: '' }), 'tests', 'a provider without a valid type is dropped');
		assert.strictEqual(hashForRoute({ route: 'tests', liveRequestId: '', providerId: '', testType: 'chat' }), 'tests/chat');
		assert.strictEqual(hashForRoute('tests'), 'tests');
		for (const hash of ['#tests/images/xai-api', '#tests/chat', '#tests/audio/a%2Fb']) assert.deepStrictEqual(resolveRoute('#' + hashForRoute(resolveRoute(hash))), resolveRoute(hash), 'round trip ' + hash);
		assert.strictEqual(testTabIdForType('image'), 'provider-test-tab-images');
		assert.strictEqual(testTabIdForType('analysis'), 'provider-test-tab-analysis');
		assert.strictEqual(testTypeForTabId('provider-test-tab-videos'), 'videos');
		assert.strictEqual(testTypeForTabId('provider-test-tab-bogus'), '');
		// Every segment of the control has a matching route type and a panel.
		for (const tab of Array.from(html.matchAll(/id="provider-test-tab-([a-z]+)"/g)).map((match) => match[1])) {
			assert.strictEqual(testTypeForTabId('provider-test-tab-' + tab), tab, 'tab ' + tab + ' is a route type');
			assert.ok(html.includes('id="provider-test-panel-' + tab + '"'), 'panel for ' + tab);
		}
		assert.doesNotThrow(() => resolveRoute('#providers/%E0%A4%A'), 'a malformed escape never throws');
		assert.strictEqual(hashForRoute({ route: 'live', liveRequestId: 'a b', providerId: '' }), 'live/a%20b');
		assert.strictEqual(hashForRoute({ route: 'providers', liveRequestId: '', providerId: 'a/b' }), 'providers/a%2Fb');
		assert.strictEqual(hashForRoute('debug'), 'debug');
		// Every sidebar entry has a view, and every in-page navigation target resolves to a route that exists.
		const sidebarRoutes = Array.from(html.matchAll(/data-route="([a-z]+)"/g)).map((match) => match[1]);
		assert.deepStrictEqual(sidebarRoutes, routeIds(), 'sidebar order matches the route table');
		for (const route of routeIds()) assert.ok(html.includes('id="view-' + route + '" data-view="' + route + '"'), 'view ' + route);
		const navTargets = new Set(Array.from(script.matchAll(/data-nav-hash="([^"]+)"/g)).map((match) => match[1]).concat(Array.from(html.matchAll(/data-nav-hash="([^"]+)"/g)).map((match) => match[1])).filter((target) => /^[a-z\/-]+$/.test(target)));
		assert.ok(navTargets.size >= 4, 'in-page links exist');
		for (const target of navTargets) assert.ok(routeIds().includes(resolveRoute(target).route) && (resolveRoute(target).route !== 'overview' || target === 'overview'), 'nav target ' + target + ' resolves');
		for (const route of routeIds()) assert.strictEqual(resolveRoute('#' + hashForRoute(resolveRoute('#' + route))).route, route, 'round trip ' + route);
	}

	// selectRoute / applyRoute / navigateTo: view switching, aria-current, hash, and the unsaved-changes guard.
	{
		const makeEl = (attrs) => ({ attrs: { ...attrs }, hidden: false, getAttribute(name) { return this.attrs[name] === undefined ? null : this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = String(value); }, removeAttribute(name) { delete this.attrs[name]; }, focus() { this.focused = true; }, classList: { contains: () => false } });
		const ids = ['overview', 'live', 'providers', 'tests', 'runtime', 'asr', 'image', 'upscale', 'music', 'pairing', 'debug'];
		const build = (options = {}) => {
			const state = { hashes: [], loaded: 0, pairing: 0, autoSelect: 0, liveSelections: [], confirms: 0, dirty: !!options.dirty, confirmAnswer: options.confirmAnswer !== false, focusCalls: [], testTabs: [], testFocus: 0, testNotices: [] };
			const fields = { routeViews: ids.map((id) => makeEl({ 'data-view': id })), navItems: ids.map((id) => makeEl({ 'data-route': id })), pageTitle: Object.assign(makeEl({}), { textContent: '' }), sidebar: null, sidebarBackdrop: null, menuToggle: null };
			const document = { title: '' };
			const window = { confirm: () => { state.confirms += 1; return state.confirmAnswer; } };
			const api = load(['routeIds', 'settingsRouteIds', 'isSettingsRoute', 'routeTitle', 'safeDecode', 'testTypeIds', 'normalizeTestType', 'testTabIdForType', 'testTypeForTabId', 'resolveRoute', 'hashForRoute', 'selectRoute', 'applyRoute', 'navigateTo'],
				['fields', 'document', 'window', 'setHash', 'autoSelectLiveJob', 'selectLiveJob', 'ensureSettingsLoaded', 'loadPairingSettings', 'isFormDirty', 'setDrawerOpen', 'applyProviderFocus', 'selectProviderTestTab', 'applyTestFocus', 'showTestFocusNotice'],
				"let currentRoute = 'overview'; let pendingProviderFocus = ''; let pendingTestFocus = null; let livePinned = false; let selectedLiveRequestId = ''; const currentStatus = {}; const baseDocumentTitle = 'Relay Status';",
				[fields, document, window, (route) => state.hashes.push(route), () => { state.autoSelect += 1; }, (id, opts) => state.liveSelections.push([id, opts]), () => { state.loaded += 1; }, () => { state.pairing += 1; }, () => state.dirty, () => {}, () => false, (tabId, opts) => state.testTabs.push([tabId, opts]), () => { state.testFocus += 1; return false; }, (message) => state.testNotices.push(message)],
				'{ selectRoute, applyRoute, navigateTo, resolveRoute, current: () => currentRoute, pending: () => pendingProviderFocus, pinned: () => livePinned, testPending: () => pendingTestFocus }');
			return { api, state, fields, document };
		};
		const visible = (env) => env.fields.routeViews.filter((view) => !view.hidden).map((view) => view.attrs['data-view']);
		const current = (env) => env.fields.navItems.filter((item) => item.attrs['aria-current'] === 'page').map((item) => item.attrs['data-route']);
		const env = build();
		assert.strictEqual(env.api.navigateTo('settings/asr'), true);
		assert.deepStrictEqual(visible(env), ['asr'], 'only the mapped view is visible');
		assert.deepStrictEqual(current(env), ['asr'], 'aria-current follows the route');
		assert.strictEqual(env.fields.pageTitle.textContent, 'Local ASR');
		assert.strictEqual(env.document.title, 'Local ASR · Relay Status');
		assert.deepStrictEqual(env.state.hashes, ['asr'], 'the old hash target is rewritten to the new route');
		assert.strictEqual(env.state.loaded, 1, 'settings load once a settings route opens');
		env.api.navigateTo('pairing');
		assert.strictEqual(env.state.pairing, 1, 'pairing status loads on the Pairing route');
		env.api.navigateTo('providers/grok-cli');
		assert.deepStrictEqual(env.state.hashes.slice(-1), ['providers/grok-cli']);
		assert.strictEqual(env.api.pending(), 'grok-cli', 'the provider id waits until the card is rendered');
		env.api.navigateTo('debug');
		assert.strictEqual(env.api.pending(), '', 'leaving Providers drops a pending provider focus');
		// Tests deep links select the segment (without rewriting the hash twice), remember the provider to highlight, and
		// the sidebar route alone keeps the current segment.
		env.api.navigateTo('tests/images/xai-api');
		assert.deepStrictEqual(env.state.testTabs.slice(-1), [['provider-test-tab-images', { skipHash: true }]], 'the segment is selected from the route');
		assert.deepStrictEqual(env.api.testPending(), { type: 'images', providerId: 'xai-api' }, 'the provider waits until its cards are rendered');
		assert.strictEqual(env.state.testFocus, 1, 'focus is attempted right away');
		assert.deepStrictEqual(env.state.hashes.slice(-1), ['tests/images/xai-api'], 'the hash keeps the full deep link');
		assert.strictEqual(env.fields.pageTitle.textContent, 'Tests');
		env.api.navigateTo('settings/tests/audio/local-asr');
		assert.deepStrictEqual(env.state.testTabs.slice(-1), [['provider-test-tab-audio', { skipHash: true }]], 'an old settings hash maps to the new Tests route');
		assert.deepStrictEqual(env.state.hashes.slice(-1), ['tests/audio/local-asr']);
		env.api.navigateTo('tests/chat');
		assert.strictEqual(env.api.testPending(), null, 'a type without provider has nothing to highlight');
		const tabCalls = env.state.testTabs.length;
		env.api.navigateTo('tests');
		assert.strictEqual(env.state.testTabs.length, tabCalls, 'the plain Tests route keeps the selected segment');
		assert.deepStrictEqual(env.state.testNotices.slice(-1), [''], 'the focus notice is cleared');
		env.api.navigateTo('tests/video/openai-videos');
		assert.ok(env.api.testPending());
		env.api.navigateTo('debug');
		assert.strictEqual(env.api.testPending(), null, 'leaving Tests drops a pending test focus');
		env.api.navigateTo('live/req%201');
		assert.deepStrictEqual(env.state.liveSelections.slice(-1), [['req 1', { skipHash: true, pin: true }]], 'a live job id in the hash is selected and pinned');
		env.api.navigateTo('live');
		assert.strictEqual(env.api.pinned(), false);
		assert.strictEqual(env.api.navigateTo('bogus'), true);
		assert.deepStrictEqual(visible(env), ['overview'], 'unknown routes fall back to Overview');

		// Unsaved settings never block navigation: there is no confirm() guard. The forms stay in the DOM (views are only
		// hidden), so edits survive a route change and the sidebar keeps its unsaved-changes dot.
		const dirty = build({ dirty: true, confirmAnswer: false });
		dirty.api.navigateTo('runtime');
		assert.strictEqual(dirty.api.navigateTo('live'), true, 'leaving a dirty settings route is allowed');
		assert.strictEqual(dirty.api.current(), 'live');
		assert.strictEqual(dirty.api.navigateTo('providers'), true);
		assert.strictEqual(dirty.state.confirms, 0, 'no confirm() prompt is ever shown');
		assert.ok(!html.includes('confirmUnsavedSettings') && !/window\.confirm\(/.test(inlineScript[1]), 'the confirm()-based route guard is gone');
		assert.ok(!html.includes('skipGuard'), 'no guard options remain');
	}

	// Theme preference: System / Light / Dark, persistence, and a throwing localStorage.
	{
		const theme = load(['normalizeThemePreference', 'readThemePreference', 'saveThemePreference', 'applyThemePreference'], ['themeStorageKey'], '', ['relay-status-theme']);
		const makeStorage = (initial) => { const data = new Map(Object.entries(initial || {})); return { data, getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => { data.set(key, String(value)); }, removeItem: (key) => { data.delete(key); } }; };
		const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
		assert.strictEqual(theme.readThemePreference(makeStorage()), 'system');
		assert.strictEqual(theme.readThemePreference(makeStorage({ 'relay-status-theme': 'dark' })), 'dark');
		assert.strictEqual(theme.readThemePreference(makeStorage({ 'relay-status-theme': 'light' })), 'light');
		assert.strictEqual(theme.readThemePreference(makeStorage({ 'relay-status-theme': 'system' })), 'system');
		assert.strictEqual(theme.readThemePreference(makeStorage({ 'relay-status-theme': 'solarized' })), 'system', 'unknown values mean System');
		assert.strictEqual(theme.readThemePreference(null), 'system');
		assert.strictEqual(theme.readThemePreference(throwing), 'system', 'a throwing localStorage reads as System');
		const storage = makeStorage();
		assert.strictEqual(theme.saveThemePreference(storage, 'dark'), true);
		assert.strictEqual(storage.data.get('relay-status-theme'), 'dark');
		assert.strictEqual(theme.saveThemePreference(storage, 'light'), true);
		assert.strictEqual(storage.data.get('relay-status-theme'), 'light');
		assert.strictEqual(theme.saveThemePreference(storage, 'system'), true);
		assert.ok(!storage.data.has('relay-status-theme'), 'System clears the saved choice');
		assert.strictEqual(theme.saveThemePreference(storage, 'nonsense'), true);
		assert.ok(!storage.data.has('relay-status-theme'), 'invalid choices are stored as System');
		assert.strictEqual(theme.saveThemePreference(throwing, 'dark'), false, 'a throwing localStorage never throws out of save');
		assert.strictEqual(theme.saveThemePreference(null, 'dark'), false);
		const root = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; } };
		assert.strictEqual(theme.applyThemePreference(root, 'dark'), 'dark');
		assert.strictEqual(root.attrs['data-theme'], 'dark');
		assert.strictEqual(theme.applyThemePreference(root, 'light'), 'light');
		assert.strictEqual(root.attrs['data-theme'], 'light');
		assert.strictEqual(theme.applyThemePreference(root, 'system'), 'system');
		assert.ok(!('data-theme' in root.attrs), 'System removes the attribute so prefers-color-scheme decides');
		assert.strictEqual(theme.applyThemePreference(root, 'bogus'), 'system');
		assert.ok(!('data-theme' in root.attrs));

		// The head snippet applies a saved choice before first paint, with the same key, and survives a throwing localStorage.
		const head = /<script id="relay-theme-init">([\s\S]*?)<\/script>/.exec(html);
		assert.ok(head, 'the early theme snippet is in the head');
		assert.ok(html.indexOf('id="relay-theme-init"') < html.indexOf('<style>'), 'the snippet runs before the styles paint');
		assert.ok(head[1].includes("'relay-status-theme'") && inlineScript[1].includes("const themeStorageKey = 'relay-status-theme'"), 'both use the same storage key');
		const runHead = (win) => { const el = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } }; new Function('window', 'document', head[1])(win, { documentElement: el }); return el.attrs; };
		assert.deepStrictEqual(runHead({ localStorage: makeStorage({ 'relay-status-theme': 'dark' }) }), { 'data-theme': 'dark' });
		assert.deepStrictEqual(runHead({ localStorage: makeStorage({ 'relay-status-theme': 'light' }) }), { 'data-theme': 'light' });
		assert.deepStrictEqual(runHead({ localStorage: makeStorage() }), {});
		assert.deepStrictEqual(runHead({ localStorage: makeStorage({ 'relay-status-theme': 'sepia' }) }), {});
		assert.deepStrictEqual(runHead({ localStorage: throwing }), {});
		assert.doesNotThrow(() => runHead({ get localStorage() { throw new Error('blocked'); } }));
		// Tokens: explicit body background, dark values under the media query (unless Light is forced) and under [data-theme="dark"].
		const css = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
		assert.ok(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{/.test(css));
		assert.ok(css.includes(':root[data-theme="dark"] {'));
		assert.ok(/body \{[^}]*background: var\(--bg\);/.test(css), 'body has an explicit background');
		assert.ok(css.includes('"Segoe UI Variable') && !/https?:\/\//.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'system fonts only, no external assets');
		assert.ok(['System', 'Light', 'Dark'].every((label) => html.includes('>' + label + '</button>')) && html.includes('data-theme-choice="system"'));
	}

	// Overview provider tiles: status mapping, summary, deep links, and escaping.
	{
		const helpers = ['text', 'escapeHtml', 'backendStatusInfo', 'summarizeProviders', 'providerDiagnosticLine', 'providerStatusPill', 'renderProviderTiles'];
		const overview = load(helpers);
		const backends = [
			{ id: 'codex-cli', label: 'Codex CLI', ready: true, job_types: ['chat', 'images'] },
			{ id: 'grok-cli', label: 'Grok CLI', ready: false, state: 'not_authenticated', diagnostic: 'Not authenticated.' },
			{ id: 'antigravity-cli', label: 'Antigravity', ready: false, state: 'unsupported', diagnostic: 'No print mode.' },
			{ id: 'cursor-cli', label: 'Cursor Agent', ready: false, state: 'installed', installed: true, diagnostic: 'Authentication not checked yet.', version: '2026.10' },
			{ id: 'xai-api', label: 'Grok / xAI API', ready: false, enabled: false, configured: false, job_types: ['chat'] },
			{ id: 'local-asr', label: 'Local ASR', ready: false, enabled: true, provider_kind: 'local-runtime', diagnostic: 'Install a model.' },
			{ id: 'gone', label: 'Gone CLI', ready: false, state: 'unavailable', installed: false },
			{ id: 'busy', label: 'Busy CLI', ready: false, state: 'checking', diagnostic: 'Checking in background.' },
			{ id: 'broken', label: 'Broken CLI', ready: false, state: 'error' },
		];
		const info = Object.fromEntries(backends.map((backend) => [backend.id, overview.backendStatusInfo(backend)]));
		assert.deepStrictEqual(info['codex-cli'], { state: 'ok', label: 'Ready' });
		assert.deepStrictEqual(info['grok-cli'], { state: 'warn', label: 'Not authenticated' });
		assert.deepStrictEqual(info['antigravity-cli'], { state: 'warn', label: 'Unsupported CLI' });
		assert.deepStrictEqual(info['cursor-cli'], { state: 'unknown', label: 'Not verified' });
		assert.deepStrictEqual(info['xai-api'], { state: 'unknown', label: 'Disabled' });
		assert.deepStrictEqual(info['local-asr'], { state: 'unknown', label: 'Not set up' });
		assert.deepStrictEqual(info.gone, { state: 'unknown', label: 'Not installed' });
		assert.deepStrictEqual(info.busy, { state: 'checking', label: 'Checking' });
		assert.deepStrictEqual(info.broken, { state: 'error', label: 'Error' });
		assert.deepStrictEqual(overview.backendStatusInfo(undefined), { state: 'warn', label: 'Unavailable' });
		assert.deepStrictEqual(overview.summarizeProviders(backends), { total: 9, ready: 1, attention: 3, inactive: 4, checking: 1 });
		assert.deepStrictEqual(overview.summarizeProviders(null), { total: 0, ready: 0, attention: 0, inactive: 0, checking: 0 });
		assert.strictEqual(overview.providerDiagnosticLine(backends[1], info['grok-cli']), 'Not authenticated.');
		assert.strictEqual(overview.providerDiagnosticLine(backends[3], info['cursor-cli']), '2026.10', 'a generic diagnostic falls back to the version');
		assert.strictEqual(overview.providerDiagnosticLine(backends[0], info['codex-cli']), 'chat, images');

		const markup = overview.renderProviderTiles(backends);
		assert.strictEqual((markup.match(/<a class="provider-tile"/g) || []).length, backends.length, 'one tile per backend');
		assert.ok(markup.includes('href="#providers/grok-cli" data-nav-hash="providers/grok-cli" data-provider-tile="grok-cli"'), 'tiles link to #providers/<id>');
		assert.ok(markup.includes('<span class="pill ok"><span class="dot"></span><span>Ready</span></span>'));
		assert.ok(markup.includes('<span class="pill warn"><span class="dot"></span><span>Not authenticated</span></span>'));
		assert.ok(markup.includes('<span class="pill unknown"><span class="dot"></span><span>Disabled</span></span>'));
		assert.ok(markup.includes('<span class="pill checking"><span class="dot"></span><span>Checking</span></span>'));
		assert.ok(markup.includes('<span class="pill error"><span class="dot"></span><span>Error</span></span>'));
		assert.ok(overview.renderProviderTiles([]).includes('empty-state'));
		const hostile = overview.renderProviderTiles([{ id: '<img src=x onerror=1>', label: '"><script>alert(1)</script>', diagnostic: '<b>bold</b> & "quoted"', ready: false, state: 'error' }]);
		assert.ok(!/<img|<script|<b>/.test(hostile), 'ids, labels, and diagnostics are escaped');
		assert.ok(hostile.includes('href="#providers/%3Cimg%20src%3Dx%20onerror%3D1%3E"'), 'the id is URL-encoded in the link');
		assert.ok(hostile.includes('&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;'));
		assert.ok(overview.providerStatusPill('"><x>', 'Label').startsWith('<span class="pill unknown">'), 'an unexpected state never reaches the class attribute');

		// renderOverviewProviders writes the grid and the "n ready / n need attention" summary; unchanged markup is not rewritten.
		const grid = { writes: 0, html: '', set innerHTML(value) { this.writes += 1; this.html = value; }, get innerHTML() { return this.html; } };
		const fields = { overviewProviderGrid: grid, overviewProviderSummary: { textContent: '' }, overviewProviderSummarySub: { textContent: '' } };
		const render = load([...helpers, 'renderOverviewProviders'], ['fields'], 'let overviewProviderMarkup = null;', [fields], 'renderOverviewProviders');
		render(backends);
		assert.strictEqual(fields.overviewProviderSummary.textContent, '1 ready / 3 need attention');
		assert.strictEqual(fields.overviewProviderSummarySub.textContent, '4 not set up · 1 checking');
		assert.strictEqual(grid.writes, 1);
		render(backends);
		assert.strictEqual(grid.writes, 1, 'identical tiles are not rewritten (keeps keyboard focus)');
		render([backends[0]]);
		assert.strictEqual(grid.writes, 2);
		assert.strictEqual(fields.overviewProviderSummary.textContent, '1 ready / 0 need attention');
		render([]);
		assert.strictEqual(fields.overviewProviderSummary.textContent, 'No providers reported');
		// The Overview shows each fact once: the old duplicated panels are gone.
		for (const id of ['healthGrid', 'healthBridge', 'healthCodex', 'healthJobs', 'healthAsr']) assert.ok(!html.includes('id="' + id + '"'), id + ' removed');
		for (const id of ['bridgePill', 'jobCounts', 'version', 'maxConcurrent', 'overviewPairedCount', 'overviewPort', 'overviewProviderSummary', 'overviewProviderGrid', 'claudeUsagePanel', 'asrDetails', 'codexBinary', 'codexCliVersion']) assert.strictEqual((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id + ' appears once');
		assert.ok(/<details class="card disclosure" id="overviewAsrDetails">/.test(html) && /<details class="card disclosure" id="overviewCodexDetails">/.test(html), 'ASR runtime and Codex binary details are behind disclosures');
	}
}

// ---- Providers view: one expandable card per backend, Routing card, sticky save bar, inline validation, secrets ----
{
	const load = (names, params = [], prelude = '', args = [], returns) => new Function(...params, prelude + '\n' + names.map(extractPageFunction).join('\n\n') + '\nreturn ' + (returns || '{ ' + names.join(', ') + ' }') + ';')(...args);
	const cardFunctions = ['text', 'escapeHtml', 'claudeNum', 'formatUsd', 'formatLocalDateTime', 'optionAttr', 'backendStatusInfo', 'providerDiagnosticLine', 'providerStatusPill', 'readyMediaModels', 'providerCardSpecs', 'providerCardEntries', 'providerKindLabel', 'providerCardIsOpen', 'fieldErrorSlot', 'providerInputField', 'secretStatusText', 'providerSecretField', 'providerCodexImageToolField', 'providerFieldGroup', 'providerCliPathField', 'providerModelChips', 'providerTestTabTargets', 'providerMediaTestLinks', 'chatTestImageField', 'providerCardChatTestMarkup', 'yesNoLabel', 'providerDetailsMarkup', 'claudeCardUsageMarkup', 'renderProviderCard', 'renderProviderCards'];
	const makeCards = (open) => load(cardFunctions, [], 'const providerCardOpen = new Map(Object.entries(' + JSON.stringify(open || {}) + ')); let pendingProviderFocus = ""; let lastClaudeUsage = null;', [], '{ ' + cardFunctions.join(', ') + ', providerCardOpen, setPending: (value) => { pendingProviderFocus = value; }, setUsage: (value) => { lastClaudeUsage = value; } }');
	const chat = (id, label, extra = {}) => ({ id, label, ready: true, state: 'ready', provider_kind: 'local-cli', kind: 'driver', job_types: ['chat'], ...extra });
	const backends = [
		chat('codex-cli', 'Codex CLI', { job_types: ['chat', 'images', 'media.analyze'], version: 'codex 1.2.3', command: 'C:\\Tools\\codex.exe', features: { structured_exec_json: true, output_schema: false } }),
		chat('anthropic-api', 'Claude API (Anthropic)', { provider_kind: 'api', diagnostic: 'Ready.' }),
		{ id: 'xai-api', label: 'Grok / xAI API', ready: false, enabled: false, configured: false, provider_kind: 'api', job_types: ['chat', 'images'] },
		{ id: 'grok-cli', label: 'Grok CLI', ready: false, state: 'not_authenticated', diagnostic: 'Run grok login.', provider_kind: 'local-cli', job_types: ['chat'] },
		{ id: 'openai-videos', label: 'OpenAI Videos', ready: true, provider_kind: 'api', job_types: ['videos'] },
		{ id: 'local-asr', label: 'Local ASR', ready: false, enabled: true, provider_kind: 'local-runtime', job_types: ['transcribe'], diagnostic: 'Install a model.' },
		{ id: 'local-upscale', label: 'Local CUDA Upscale', ready: true, provider_kind: 'local-runtime', job_types: ['upscale'], models: [{ id: 'm1', label: 'Real <ESRGAN>', state: 'installed' }] },
		{ id: 'mystery', label: 'Mystery Provider', ready: false, state: 'error', diagnostic: 'Broke.', job_types: [] },
	];
	const models = [
		{ id: 'model-relay:codex:auto', type: 'text', backend: 'codex-cli', job_types: ['chat'] },
		{ id: 'model-relay:codex:fast', type: 'text', backend: 'codex-cli', job_types: ['chat'], experimental: true },
		{ id: 'model-relay:codex:image', type: 'image', backend: 'codex-cli', job_types: ['images'] },
		{ id: 'model-relay:anthropic:claude-opus-5-5', type: 'text', backend: 'anthropic-api', job_types: ['chat'] },
	];
	const settings = {
		cli_paths: { 'codex-cli': 'C:\\Tools\\codex.exe' },
		codex_image_tool: 'generations',
		providers: {
			anthropic: { api_key: { configured: true, suffix: 'abcd', value: 'sk-ant-FULL-SECRET' }, admin_api_key: { configured: false }, base_url: '', models: ['claude-opus-5-5', 'claude-haiku-5-5'], monthly_limit_usd: 500, credit_balance_usd: 250, credit_balance_as_of: '2026-10-01T00:00:00Z' },
			xai: { api_key: { configured: true, suffix: '<x>' }, base_url: 'https://api.x.ai/v1', models: 'grok-4.3' },
			openai_videos: { enabled: true, api_key: { configured: false } },
			api_key_chat: { api_key: { configured: false }, base_url: '"><script>', provider_id: 'p1', model: 'm1' },
			cli_process: { args: '--flag' },
			grok: { imagine_skill: 'C:\\skill.md' },
			antigravity: { state_dir: 'C:\\agy' },
		},
	};
	const api = makeCards();
	const markup = api.renderProviderCards(backends, models, settings);
	const attrs = () => Array.from(markup.matchAll(/data-provider-id="([^"]*)"/g)).map((match) => match[1]);

	// One card per backend (in a stable order), plus a card for every provider that owns settings fields even when unreported.
	assert.deepStrictEqual(attrs(), ['codex-cli', 'anthropic-api', 'xai-api', 'grok-cli', 'cursor-cli', 'antigravity-cli', 'openai-videos', 'api-key-chat', 'cli-process', 'local-asr', 'local-upscale', 'mystery'], 'spec order, synthetic cards for unreported settings providers, unknown backends last');
	assert.ok(!attrs().includes('local-image') && !attrs().includes('music-analysis'), 'engines are listed only when reported');
	const ids = Array.from(markup.matchAll(/ id="([^"]+)"/g)).map((match) => match[1]);
	assert.strictEqual(new Set(ids).size, ids.length, 'element ids are unique');
	assert.ok(api.renderProviderCards([], [], {}).includes('data-provider-id="codex-cli"') && api.renderProviderCards([], [], {}).includes('data-provider-id="cli-process"'), 'settings providers render even without capabilities');
	assert.ok(api.renderProviderCards([], [], {}).includes('Not reported by this Relay.') && !api.renderProviderCards([], [], {}).includes('data-provider-id="local-asr"'));
	assert.ok(['CLI', 'API', 'Local'].every((kind) => markup.includes('<span class="kind-badge">' + kind + '</span>')));

	// Header: label, kind, status pill from the Overview mapping, one-line diagnostic; accessible disclosure button.
	const cardMarkup = (id) => { const start = markup.indexOf('<article class="card provider-card" data-provider-id="' + id + '"'); assert.ok(start >= 0, id); const end = markup.indexOf('</article>', start); return markup.slice(start, end); };
	const grok = cardMarkup('grok-cli');
	assert.ok(grok.includes('<span class="pill warn"><span class="dot"></span><span>Not authenticated</span></span>') && grok.includes('data-provider-diag>Run grok login.</span>'));
	assert.ok(/<button type="button" class="provider-card-toggle" data-provider-toggle aria-expanded="true" aria-controls="providerCardBody-3">/.test(grok) && grok.includes('id="providerCardBody-3" data-provider-body>'), 'a card that needs attention starts expanded, with aria-controls pointing at its body');
	const codex = cardMarkup('codex-cli');
	assert.ok(/aria-expanded="false" aria-controls="providerCardBody-0"/.test(codex) && /id="providerCardBody-0" data-provider-body hidden>/.test(codex), 'a ready card starts collapsed');
	assert.ok(cardMarkup('xai-api').includes('aria-expanded="false"') && cardMarkup('mystery').includes('aria-expanded="true"'), 'unknown/disabled collapse, error expands');

	// Fields moved from the old form keep their ids; CLI paths keep data-relay-cli-path.
	assert.ok(codex.includes('data-relay-cli-path="codex-cli" value="C:\\Tools\\codex.exe"') && codex.includes('id="relayCodexImageTool"') && codex.includes('<option value="generations" selected>'));
	const claude = cardMarkup('anthropic-api');
	for (const id of ['relayAnthropicApiKey', 'relayAnthropicAdminKey', 'relayAnthropicBaseUrl', 'relayAnthropicModels', 'relayAnthropicMonthlyLimit', 'relayAnthropicCreditBalance', 'relayAnthropicCreditRebaseline']) assert.ok(claude.includes('id="' + id + '"'), id);
	assert.ok(/<input type="text" inputmode="decimal" id="relayAnthropicCreditBalance"/.test(claude) && /<input type="text" inputmode="decimal" id="relayAnthropicMonthlyLimit"/.test(claude) && !/type="number"[^>]*id="relayAnthropicMonthlyLimit"/.test(claude), 'money fields are text inputs');
	assert.ok(claude.includes('value="claude-opus-5-5,claude-haiku-5-5"') && claude.includes('value="500"') && claude.includes('value="250"') && claude.includes('Recount spend from today') && claude.includes(' Saved '), 'models, limits, saved date');
	assert.ok(claude.includes('data-field-key="relayAnthropicMonthlyLimit"') && claude.includes('id="fieldError-relayAnthropicMonthlyLimit"') && claude.includes('aria-describedby="fieldError-relayAnthropicCreditBalance"'), 'USD fields have an inline error slot');
	assert.ok(claude.includes('data-claude-card-usage') && claude.includes('data-nav-hash="overview"'), 'compact usage summary links to the Overview panel');
	assert.ok(cardMarkup('xai-api').includes('id="relayXaiApiKey"') && cardMarkup('xai-api').includes('id="relayXaiBaseUrl"') && cardMarkup('xai-api').includes('id="relayXaiModels"'));
	const videos = cardMarkup('openai-videos');
	assert.ok(videos.includes('id="relayOpenaiEnabled"') && videos.includes('<option value="true" selected>') && videos.includes('id="relayOpenaiApiKey"'));
	assert.ok(cardMarkup('api-key-chat').includes('id="relayApiKeyChatKey"') && cardMarkup('api-key-chat').includes('id="relayApiKeyChatProviderId"') && cardMarkup('api-key-chat').includes('id="relayApiKeyChatModel"') && cardMarkup('api-key-chat').includes('id="relayApiKeyChatBaseUrl"'));
	assert.ok(cardMarkup('cli-process').includes('data-relay-cli-path="cli-process"') && cardMarkup('cli-process').includes('id="relayCliProcessArgs"'));
	assert.ok(cardMarkup('grok-cli').includes('id="relayGrokImagineSkill"') && cardMarkup('grok-cli').includes('data-relay-cli-path="grok-cli"'));
	assert.ok(cardMarkup('antigravity-cli').includes('id="relayAntigravityStateDir"') && cardMarkup('antigravity-cli').includes('Windows auto-detects %LOCALAPPDATA%'));
	assert.ok(cardMarkup('cursor-cli').includes('data-relay-cli-path="cursor-cli"'));

	// Secrets: only the suffix is shown, never a value; configured keys get Replace / Clear, unconfigured ones a plain input.
	assert.ok(claude.includes('Saved key ends with abcd.') && !markup.includes('sk-ant-FULL-SECRET'), 'masked secret shows the suffix only');
	assert.ok(!/<input type="password"[^>]*value=/.test(markup), 'password inputs never carry a value');
	assert.ok(claude.includes('data-secret-action="replace" data-secret-id="relayAnthropicApiKey" aria-expanded="false" aria-controls="relayAnthropicApiKey"') && claude.includes('data-secret-action="clear" data-secret-id="relayAnthropicApiKey" aria-pressed="false"'));
	assert.ok(/<input type="password"[^>]*id="relayAnthropicApiKey"[^>]* hidden>/.test(claude) && claude.includes('<input type="checkbox" id="relayAnthropicApiKeyClear" hidden>'), 'the input starts hidden; the clear flag is the existing checkbox');
	assert.ok(claude.includes('data-secret-configured="0"') && claude.includes('Leave blank to use ANTHROPIC_ADMIN_KEY.') && !/<input type="checkbox" id="relayAnthropicAdminKeyClear"/.test(claude), 'an unconfigured key is a plain input with the env hint');
	assert.ok(cardMarkup('xai-api').includes('Saved key ends with &lt;x&gt;.') && !cardMarkup('xai-api').includes('<x>'), 'a hostile suffix is escaped');

	// Models, actions, Details.
	assert.ok(codex.includes('<ul class="chip-list" aria-label="Models">') && codex.includes('<code>model-relay:codex:fast</code><span class="chip-note">experimental</span>'));
	assert.ok(!codex.includes('model-relay:anthropic') && claude.includes('model-relay:anthropic:claude-opus-5-5'), 'chips come from the models of that backend');
	assert.ok(cardMarkup('local-upscale').includes('Real &lt;ESRGAN&gt; — installed'), 'engines fall back to their own model states');
	assert.ok(codex.includes('<details class="provider-card-details"><summary>Details</summary>') && codex.includes('codex 1.2.3') && codex.includes('data-copy-value="C:\\Tools\\codex.exe"') && codex.includes('structured_exec_json'), 'version/command/features are behind a Details disclosure');
	assert.ok(!codex.includes('output_schema'), 'only enabled features are listed');

	// Test actions: chat providers get an inline chat test; media providers link to the Tests route; local engines link to their page.
	assert.ok(codex.includes('provider-card-chat-test') && codex.includes('data-provider-test="chat" data-model="model-relay:codex:auto" aria-label="Test Codex CLI"') && codex.includes('<select data-test-option="model">'), 'several chat models get a model select');
	assert.ok(claude.includes('data-provider-test="chat" data-model="model-relay:anthropic:claude-opus-5-5"') && !claude.includes('<select data-test-option="model">') && claude.includes('This request is sent to Claude API (Anthropic); usage charges may apply.'), 'a single model needs no select; API cards show the cost hint');
	assert.ok(codex.includes('data-test-prompt maxlength="8000" value="Reply with exactly: OK"') && codex.includes('data-chat-max-tokens'), 'the default prompt is used; options sit behind a disclosure');
	assert.ok(codex.includes('data-open-test-tab="provider-test-tab-images"') && codex.includes('data-open-test-tab="provider-test-tab-analysis"') && !codex.includes('data-open-test-tab="provider-test-tab-videos"'), 'media test links follow the job types');
	assert.ok(videos.includes('data-open-test-tab="provider-test-tab-videos"') && !videos.includes('data-provider-test="chat"'), 'a media-only provider links to the Tests route');
	assert.ok(cardMarkup('xai-api').includes('<button type="button" disabled>Test</button>') && cardMarkup('xai-api').includes('Chat tests need a ready provider.'), 'a chat provider that is not ready has a disabled Test');
	assert.ok(!grok.includes('data-provider-test="chat"') && grok.includes('<button type="button" disabled>Test</button>'));
	const asr = cardMarkup('local-asr');
	assert.ok(asr.includes('href="#asr" data-nav-hash="asr"') && asr.includes('Open Local ASR settings') && !/<input /.test(asr) && !asr.includes('data-provider-test="chat"') && asr.includes('data-open-test-tab="provider-test-tab-audio"'), 'a local engine links to its own page and duplicates no form');
	assert.ok(cardMarkup('local-upscale').includes('data-nav-hash="upscale"') && cardMarkup('local-upscale').includes('Use the CUDA Upscale page to install an available pinned model.'));

	// Escaping: hostile labels, diagnostics, versions, commands, models, ids, and cli paths never reach the DOM as markup.
	{
		const hostile = '<img src=x onerror=alert(1)>';
		const evil = makeCards().renderProviderCards([
			{ id: hostile, label: '"><script>alert(1)</script>', diagnostic: '<b>bold</b> & "quoted"', version: '<i>v</i>', command: '<svg onload=1>', state: 'error', job_types: ['chat', 'images'], features: { '<u>': true }, models: ['<m>'] },
			chat('codex-cli', '<s>Codex</s>', { diagnostic: '<marquee>' }),
		], [{ id: hostile + 'model', type: 'text', backend: hostile, job_types: ['chat'] }, { id: '<em>m</em>', type: 'text', backend: 'codex-cli', job_types: ['chat'] }, { id: '<em>n</em>', type: 'text', backend: 'codex-cli', job_types: ['chat'] }], { cli_paths: { 'codex-cli': '"><script>1</script>' }, providers: { anthropic: { models: '"><b>', base_url: '<u>' } } });
		assert.ok(!/<img|<script|<svg|<b>|<i>|<u>|<s>|<marquee|<em>|<m>/.test(evil), 'no hostile markup survives');
		assert.ok(evil.includes('&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;') && evil.includes('&lt;img src=x onerror=alert(1)&gt;'));
		assert.ok(evil.includes('aria-controls="providerCardBody-') && /data-provider-id="&lt;img/.test(evil), 'ids are escaped inside attributes');
	}

	// Compact Claude usage summary.
	{
		assert.ok(api.claudeCardUsageMarkup(null).includes('Usage loads on the Overview panel.'));
		assert.ok(api.claudeCardUsageMarkup({ configured: {} }).includes('No key saved yet'));
		const usage = api.claudeCardUsageMarkup({ configured: { api_key: true }, month: { spend_usd: 12.3, limit_usd: 500 }, credits: { remaining_usd: 200 } });
		assert.ok(usage.includes('Spend this month $12.30 of $500.00 limit · Credits (estimated) $200.00') && usage.includes('data-nav-hash="overview"'));
		assert.ok(api.claudeCardUsageMarkup({ configured: { admin_api_key: true }, month: {}, credits: {} }).includes('No spend report yet'));
		api.setUsage({ configured: { api_key: true }, month: { spend_usd: 1, limit_usd: null } });
		assert.ok(api.renderProviderCards(backends, models, settings).includes('Spend this month $1.00'), 'the card shows the last loaded usage');
	}

	// Expand state: needs attention or deep link => expanded by default; the user's own choice wins; unknown ids never throw.
	{
		const expanded = (open, pending) => { const fns = makeCards(open); if (pending) fns.setPending(pending); return Array.from(fns.renderProviderCards(backends, models, settings).matchAll(/data-provider-id="([^"]*)" data-provider-state="[a-z]+" data-expanded="(true|false)"/g)).filter((match) => match[2] === 'true').map((match) => match[1]); };
		assert.deepStrictEqual(expanded(), ['grok-cli', 'mystery'], 'only cards that need attention start expanded');
		assert.deepStrictEqual(expanded({}, 'xai-api'), ['xai-api', 'grok-cli', 'mystery'], 'a deep-linked card starts expanded');
		assert.deepStrictEqual(expanded({ 'grok-cli': false, 'codex-cli': true }), ['codex-cli', 'mystery'], 'the remembered choice overrides the status default');
		assert.doesNotThrow(() => expanded({}, 'no-such-provider'));
	}
}

// setProviderCardOpen / applyProviderFocus (deep links) with stub elements.
{
	const makeCardEl = (id) => {
		const toggle = { attrs: { 'aria-expanded': 'false' }, setAttribute(name, value) { this.attrs[name] = String(value); }, getAttribute(name) { return this.attrs[name]; } };
		const body = { hidden: true };
		const card = {
			attrs: { 'data-provider-id': id, 'data-expanded': 'false' }, toggle, body, scrolled: 0, focused: 0, classes: new Set(),
			getAttribute(name) { return this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = String(value); },
			querySelector(selector) { return selector === '[data-provider-toggle]' ? toggle : (selector === '[data-provider-body]' ? body : null); },
			scrollIntoView() { this.scrolled += 1; }, focus() { this.focused += 1; },
			classList: { add: (name) => card.classes.add(name), remove: (name) => card.classes.delete(name) },
			get offsetWidth() { return 1; },
		};
		return card;
	};
	const cards = new Map([['codex-cli', makeCardEl('codex-cli')], ['grok-cli', makeCardEl('grok-cli')]]);
	const fields = { providerSettings: { querySelector: (selector) => { const match = /data-provider-id="([^"]*)"/.exec(selector); return match && cards.get(match[1]) || null; } } };
	const names = ['setProviderCardOpen', 'applyProviderFocus'];
	const fns = new Function('fields', 'CSS', 'setTimeout', 'const providerCardOpen = new Map(); let pendingProviderFocus = ""; let currentRoute = "providers";\n' + names.map(extractPageFunction).join('\n') + '\nreturn { setProviderCardOpen, applyProviderFocus, providerCardOpen, setPending: (value) => { pendingProviderFocus = value; }, getPending: () => pendingProviderFocus, setRoute: (value) => { currentRoute = value; } };')(fields, { escape: (value) => value }, () => 0);
	fns.setProviderCardOpen(cards.get('codex-cli'), true);
	assert.strictEqual(cards.get('codex-cli').toggle.attrs['aria-expanded'], 'true');
	assert.strictEqual(cards.get('codex-cli').body.hidden, false);
	assert.strictEqual(cards.get('codex-cli').attrs['data-expanded'], 'true');
	assert.strictEqual(fns.providerCardOpen.get('codex-cli'), true, 'the choice is remembered for re-renders');
	fns.setProviderCardOpen(cards.get('codex-cli'), false);
	assert.strictEqual(cards.get('codex-cli').body.hidden, true);
	assert.strictEqual(fns.providerCardOpen.get('codex-cli'), false);
	assert.doesNotThrow(() => fns.setProviderCardOpen(null, true));
	// Deep link: the matching card is expanded, scrolled to, focused, and highlighted.
	fns.setPending('grok-cli');
	assert.strictEqual(fns.applyProviderFocus(), true);
	const target = cards.get('grok-cli');
	assert.strictEqual(target.body.hidden, false, 'a deep link expands the card');
	assert.strictEqual(target.toggle.attrs['aria-expanded'], 'true');
	assert.strictEqual(fns.providerCardOpen.get('grok-cli'), true);
	assert.ok(target.scrolled === 1 && target.focused === 1 && target.classes.has('is-highlighted'));
	assert.strictEqual(fns.getPending(), '', 'the pending focus is consumed');
	assert.strictEqual(cards.get('codex-cli').body.hidden, true, 'other cards stay as they were');
	// Not on the Providers route, or not rendered yet: keep waiting.
	fns.setPending('codex-cli'); fns.setRoute('overview');
	assert.strictEqual(fns.applyProviderFocus(), false);
	fns.setRoute('providers'); fns.setPending('not-rendered');
	assert.strictEqual(fns.applyProviderFocus(), false);
	assert.strictEqual(fns.getPending(), 'not-rendered');
}

// Secrets: Replace / Clear map onto the existing settings payload (api_key / clear_api_key).
{
	const makeEl = (extra = {}) => ({ attrs: {}, setAttribute(name, value) { this.attrs[name] = String(value); }, getAttribute(name) { return this.attrs[name]; }, focus() { this.focused = true; }, ...extra });
	const build = (configured = true) => {
		const els = {
			relayAnthropicApiKeyField: makeEl({ dataset: { secretConfigured: configured ? '1' : '0', secretSuffix: 'abcd' } }),
			relayAnthropicApiKey: makeEl({ hidden: configured, value: '' }),
			relayAnthropicApiKeyClear: makeEl({ checked: false }),
			relayAnthropicApiKeyStatus: makeEl({ textContent: 'Saved key ends with abcd.' }),
			relayAnthropicApiKeyReplaceBtn: makeEl({ textContent: 'Replace' }),
			relayAnthropicApiKeyClearBtn: makeEl({ textContent: 'Clear' }),
		};
		const document = { getElementById: (id) => els[id] || null };
		const empty = { querySelectorAll: () => [] };
		const wrapper = { getAttribute: (name) => (name === 'data-secret-field' ? 'relayAnthropicApiKey' : null) };
		const fields = { relayDefaultSettings: empty, relayTokenDefaults: empty, relayRuntimeSettings: empty, providerSettings: { querySelectorAll: (selector) => (selector.includes('data-secret-configured') && configured ? [wrapper] : []) } };
		const names = ['collectRelaySettingsPayload', 'secretStatusText', 'secretFieldMode', 'setSecretMode', 'applySecretAction', 'syncSecretFields'];
		const fns = new Function('document', 'fields', names.map(extractPageFunction).join('\n') + '\nreturn { ' + names.join(', ') + ' };')(document, fields);
		return { els, fns, anthropic: () => fns.collectRelaySettingsPayload('relay').providers.anthropic };
	};
	{
		const { els, fns, anthropic } = build();
		assert.strictEqual(anthropic().api_key, '');
		assert.strictEqual(anthropic().clear_api_key, false, 'untouched: keep the saved key');
		assert.strictEqual(fns.secretFieldMode('relayAnthropicApiKey'), 'keep');
		// Replace reveals the input and focuses it; the typed key becomes api_key.
		assert.strictEqual(fns.applySecretAction('relayAnthropicApiKey', 'replace', { focus: true }), true);
		assert.strictEqual(els.relayAnthropicApiKey.hidden, false);
		assert.strictEqual(els.relayAnthropicApiKey.focused, true);
		assert.strictEqual(els.relayAnthropicApiKeyReplaceBtn.textContent, 'Cancel replace');
		assert.strictEqual(els.relayAnthropicApiKeyReplaceBtn.attrs['aria-expanded'], 'true');
		assert.ok(els.relayAnthropicApiKeyStatus.textContent.includes('replaces the saved key'));
		els.relayAnthropicApiKey.value = 'sk-new-key';
		assert.strictEqual(anthropic().api_key, 'sk-new-key');
		assert.strictEqual(anthropic().clear_api_key, false);
		// Clear drops whatever was typed, hides the input, and sets the clear flag.
		fns.applySecretAction('relayAnthropicApiKey', 'clear');
		assert.strictEqual(els.relayAnthropicApiKey.hidden, true);
		assert.strictEqual(els.relayAnthropicApiKey.value, '');
		assert.strictEqual(anthropic().api_key, '');
		assert.strictEqual(anthropic().clear_api_key, true);
		assert.strictEqual(els.relayAnthropicApiKeyClearBtn.textContent, 'Undo clear');
		assert.strictEqual(els.relayAnthropicApiKeyClearBtn.attrs['aria-pressed'], 'true');
		assert.ok(els.relayAnthropicApiKeyStatus.textContent.includes('will be removed'));
		assert.strictEqual(fns.secretFieldMode('relayAnthropicApiKey'), 'clear');
		// Replace after Clear cancels the clear; Clear again toggles; Cancel replace returns to keep.
		fns.applySecretAction('relayAnthropicApiKey', 'replace');
		assert.strictEqual(anthropic().clear_api_key, false);
		assert.strictEqual(els.relayAnthropicApiKey.hidden, false);
		fns.applySecretAction('relayAnthropicApiKey', 'replace');
		assert.strictEqual(fns.secretFieldMode('relayAnthropicApiKey'), 'keep');
		assert.strictEqual(els.relayAnthropicApiKeyStatus.textContent, 'Saved key ends with abcd.');
		fns.applySecretAction('relayAnthropicApiKey', 'clear');
		fns.applySecretAction('relayAnthropicApiKey', 'clear');
		assert.strictEqual(anthropic().clear_api_key, false);
		assert.strictEqual(els.relayAnthropicApiKeyClearBtn.textContent, 'Clear');
		assert.strictEqual(fns.applySecretAction('relayAnthropicApiKey', 'bogus'), false);
		// After values were restored into the inputs (a re-render), the controls follow them.
		els.relayAnthropicApiKey.value = 'typed'; els.relayAnthropicApiKey.hidden = true;
		fns.syncSecretFields();
		assert.strictEqual(els.relayAnthropicApiKey.hidden, false, 'a restored value reveals the input');
		assert.strictEqual(anthropic().api_key, 'typed');
		els.relayAnthropicApiKeyClear.checked = true;
		fns.syncSecretFields();
		assert.strictEqual(fns.secretFieldMode('relayAnthropicApiKey'), 'clear');
		assert.strictEqual(els.relayAnthropicApiKey.value, '', 'clear wins over a restored value');
		assert.strictEqual(anthropic().clear_api_key, true);
	}
	{
		// An unconfigured key has no Replace / Clear: the actions are ignored and the input stays visible.
		const { els, fns } = build(false);
		assert.strictEqual(fns.applySecretAction('relayAnthropicApiKey', 'replace'), false);
		assert.strictEqual(fns.applySecretAction('relayAnthropicApiKey', 'clear'), false);
		assert.strictEqual(els.relayAnthropicApiKey.hidden, false);
		assert.strictEqual(els.relayAnthropicApiKeyClear.checked, false);
		assert.strictEqual(fns.applySecretAction('missing', 'replace'), false);
	}
}

// Inline validation: one message per field key, shown next to the field; Save is blocked and says where.
{
	const { relayFieldErrors, relayFieldWarnings } = new Function(['relayFieldProblems', 'relayFieldErrors', 'relayFieldWarnings'].map(extractPageFunction).join('\n') + '\nreturn { relayFieldErrors, relayFieldWarnings };')();
	const relay = (anthropic, tokens) => ({ providers: { anthropic }, token_defaults: tokens || {} });
	assert.deepStrictEqual(relayFieldErrors(relay({ monthly_limit_usd: '500', credit_balance_usd: '250.25' }), 'relay'), {});
	assert.deepStrictEqual(relayFieldErrors(relay({ monthly_limit_usd: '', credit_balance_usd: '' }), 'relay'), {}, 'blank is valid');
	const usd = relayFieldErrors(relay({ monthly_limit_usd: '12.345', credit_balance_usd: '1e3' }), 'relay');
	assert.strictEqual(usd.relayAnthropicMonthlyLimit, 'Monthly spend limit must be a dollar amount like 500 or 500.25 (max 100,000,000).');
	assert.strictEqual(usd.relayAnthropicCreditBalance, 'Credit balance must be a dollar amount like 500 or 500.25 (max 100,000,000).');
	assert.ok(relayFieldErrors(relay({ monthly_limit_usd: '100000001' }), 'relay').relayAnthropicMonthlyLimit, 'over the cap');
	assert.deepStrictEqual(relayFieldErrors(relay({ monthly_limit_usd: '0,5' }), 'relay'), {}, 'a decimal comma is accepted');
	assert.ok(relayFieldErrors(relay({}, { chat: '100', 'media.analyze': '4096' }), 'relay')['token:chat'] && !relayFieldErrors(relay({}, { chat: '100', 'media.analyze': '4096' }), 'relay')['token:media.analyze'], 'token defaults outside 512-128000');
	assert.ok(relayFieldErrors(relay({}, { chat: '200000' }), 'relay')['token:chat'] && relayFieldErrors(relay({}, { chat: '12.5' }), 'relay')['token:chat'] && !relayFieldErrors(relay({}, { chat: '' }), 'relay')['token:chat']);
	assert.deepStrictEqual(relayFieldErrors({ runtime: { max_concurrent_jobs: '4', timeouts: { codex_chat_ms: '1000', cli_probe_ms: '' } } }, 'runtime'), {});
	const runtimeErrors = relayFieldErrors({ runtime: { max_concurrent_jobs: '99', timeouts: { codex_chat_ms: '0', cli_probe_ms: 'abc' } } }, 'runtime');
	assert.deepStrictEqual(Object.keys(runtimeErrors).sort(), ['runtime:max_concurrent_jobs', 'timeout:cli_probe_ms', 'timeout:codex_chat_ms']);
	assert.deepStrictEqual(relayFieldErrors(relay({ monthly_limit_usd: 'x' }), 'runtime'), {}, 'the runtime section ignores provider fields');
	assert.deepStrictEqual(relayFieldErrors({ runtime: { max_concurrent_jobs: '99' } }, 'relay'), {}, 'the relay section ignores runtime fields');

	// Softening: an invalid value that is unchanged from the last loaded settings (an old stored value) is a warning, never a
	// blocking error. Only a newly edited invalid value blocks Save.
	{
		const warning = 'Stored value is outside the supported range and will be clamped by the Relay.';
		const loaded = { providers: { anthropic: { monthly_limit_usd: '12.345', credit_balance_usd: '250' } }, token_defaults: { chat: '100', 'media.analyze': '4096' } };
		const same = JSON.parse(JSON.stringify(loaded));
		assert.deepStrictEqual(relayFieldErrors(same, 'relay', loaded), {}, 'unchanged stored values do not block');
		assert.deepStrictEqual(relayFieldWarnings(same, 'relay', loaded), { relayAnthropicMonthlyLimit: warning, 'token:chat': warning }, 'they show as warnings next to the field');
		// Editing the invalid value (even to another invalid one) blocks again and drops the warning.
		const edited = JSON.parse(JSON.stringify(loaded));
		edited.providers.anthropic.monthly_limit_usd = '12.3456';
		edited.token_defaults.chat = '99';
		assert.deepStrictEqual(Object.keys(relayFieldErrors(edited, 'relay', loaded)).sort(), ['relayAnthropicMonthlyLimit', 'token:chat']);
		assert.deepStrictEqual(relayFieldWarnings(edited, 'relay', loaded), {});
		// One field stays a warning while another edited field blocks.
		const mixed = JSON.parse(JSON.stringify(loaded));
		mixed.providers.anthropic.credit_balance_usd = 'abc';
		assert.deepStrictEqual(Object.keys(relayFieldErrors(mixed, 'relay', loaded)), ['relayAnthropicCreditBalance']);
		assert.deepStrictEqual(Object.keys(relayFieldWarnings(mixed, 'relay', loaded)).sort(), ['relayAnthropicMonthlyLimit', 'token:chat']);
		// Fixing the value clears both.
		const fixed = JSON.parse(JSON.stringify(loaded));
		fixed.providers.anthropic.monthly_limit_usd = '500';
		fixed.token_defaults.chat = '4096';
		assert.deepStrictEqual(relayFieldErrors(fixed, 'relay', loaded), {});
		assert.deepStrictEqual(relayFieldWarnings(fixed, 'relay', loaded), {});
		// Runtime section: legacy stored values are tolerated the same way.
		const runtimeLoaded = { runtime: { max_concurrent_jobs: '64', timeouts: { codex_chat_ms: '0', cli_probe_ms: '1000' } } };
		assert.deepStrictEqual(relayFieldErrors(JSON.parse(JSON.stringify(runtimeLoaded)), 'runtime', runtimeLoaded), {});
		assert.deepStrictEqual(Object.keys(relayFieldWarnings(JSON.parse(JSON.stringify(runtimeLoaded)), 'runtime', runtimeLoaded)).sort(), ['runtime:max_concurrent_jobs', 'timeout:codex_chat_ms']);
		const runtimeEdited = JSON.parse(JSON.stringify(runtimeLoaded));
		runtimeEdited.runtime.max_concurrent_jobs = '99';
		assert.deepStrictEqual(Object.keys(relayFieldErrors(runtimeEdited, 'runtime', runtimeLoaded)), ['runtime:max_concurrent_jobs']);
		// Without a baseline (settings not loaded yet) nothing is excused; a missing key in the baseline counts as blank.
		assert.deepStrictEqual(Object.keys(relayFieldErrors(same, 'relay', null)).sort(), ['relayAnthropicMonthlyLimit', 'token:chat']);
		assert.deepStrictEqual(Object.keys(relayFieldErrors(same, 'relay', {})).sort(), ['relayAnthropicMonthlyLimit', 'token:chat']);
	}

	// applyFieldErrors writes the message next to the field, sets aria-invalid, and returns the first invalid input.
	const makeInput = (key) => ({ attrs: { 'data-field-key': key }, getAttribute(name) { return this.attrs[name] === undefined ? null : this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = String(value); }, removeAttribute(name) { delete this.attrs[name]; } });
	const inputs = [makeInput('relayAnthropicMonthlyLimit'), makeInput('relayAnthropicCreditBalance')];
	const slots = { 'fieldError-relayAnthropicMonthlyLimit': { textContent: '', hidden: true }, 'fieldError-relayAnthropicCreditBalance': { textContent: '', hidden: true } };
	const apply = new Function('document', extractPageFunction('applyFieldErrors') + '\nreturn applyFieldErrors;')({ getElementById: (id) => slots[id] || null });
	{
		// A warning is shown in the same slot with the warning look and role=status, and never marks the field invalid or blocks.
		const warnInputs = [makeInput('relayAnthropicMonthlyLimit'), makeInput('relayAnthropicCreditBalance')];
		const makeSlot = () => { const slot = { textContent: '', hidden: true, attrs: { role: 'alert' }, flags: new Set(), setAttribute(name, value) { this.attrs[name] = value; } }; slot.classList = { toggle(name, on) { if (on) slot.flags.add(name); else slot.flags.delete(name); } }; return slot; };
		const warnSlots = { 'fieldError-relayAnthropicMonthlyLimit': makeSlot(), 'fieldError-relayAnthropicCreditBalance': makeSlot() };
		const applyWarn = new Function('document', extractPageFunction('applyFieldErrors') + '\nreturn applyFieldErrors;')({ getElementById: (id) => warnSlots[id] || null });
		const warnRoot = { querySelectorAll: () => warnInputs };
		assert.strictEqual(applyWarn(warnRoot, {}, { relayAnthropicMonthlyLimit: 'Stored value is outside the supported range and will be clamped by the Relay.' }), null, 'a warning is not an invalid field');
		const monthly = warnSlots['fieldError-relayAnthropicMonthlyLimit'];
		assert.strictEqual(monthly.textContent, 'Stored value is outside the supported range and will be clamped by the Relay.');
		assert.strictEqual(monthly.hidden, false);
		assert.ok(monthly.flags.has('is-warning') && monthly.attrs.role === 'status');
		assert.strictEqual(warnInputs[0].attrs['aria-invalid'], undefined, 'no aria-invalid for a warning');
		assert.strictEqual(warnSlots['fieldError-relayAnthropicCreditBalance'].hidden, true);
		// An error wins over a warning on the same field.
		assert.strictEqual(applyWarn(warnRoot, { relayAnthropicMonthlyLimit: 'Bad' }, { relayAnthropicMonthlyLimit: 'warn' }), warnInputs[0]);
		assert.strictEqual(monthly.textContent, 'Bad');
		assert.ok(!monthly.flags.has('is-warning') && monthly.attrs.role === 'alert' && warnInputs[0].attrs['aria-invalid'] === 'true');
	}
	const root = { querySelectorAll: () => inputs };
	assert.strictEqual(apply(root, { relayAnthropicCreditBalance: 'Bad balance' }), inputs[1]);
	assert.strictEqual(slots['fieldError-relayAnthropicCreditBalance'].textContent, 'Bad balance');
	assert.strictEqual(slots['fieldError-relayAnthropicCreditBalance'].hidden, false);
	assert.strictEqual(inputs[1].attrs['aria-invalid'], 'true');
	assert.strictEqual(inputs[0].attrs['aria-invalid'], undefined);
	assert.strictEqual(slots['fieldError-relayAnthropicMonthlyLimit'].hidden, true);
	assert.strictEqual(apply(root, {}), null, 'a fixed field clears its message');
	assert.strictEqual(slots['fieldError-relayAnthropicCreditBalance'].hidden, true);
	assert.strictEqual(slots['fieldError-relayAnthropicCreditBalance'].textContent, '');
	assert.strictEqual(inputs[1].attrs['aria-invalid'], undefined);
	assert.strictEqual(apply(null, {}), null);
}

// saveRelaySettings: validation blocks the request and points at the field; a valid save posts the unchanged payload.
(async () => {
	const names = ['relayFieldProblems', 'relayFieldErrors', 'applyFieldErrors', 'validateRelaySection', 'setSaveBarText', 'isPlainFormObject', 'diffFormEdits', 'collectFormEdits', 'applyFormEdits', 'relayFormEdits', 'reapplyRelayEdits', 'relayFocusAttributes', 'relayFocusContainers', 'captureRelayFocus', 'restoreRelayFocus', 'fetchJsonWithTimeout', 'saveRelaySettings'];
	const build = (payload, snapshots = { relay: '', runtime: '' }) => {
		const state = { posts: [], opened: [], focused: 0, rendered: [], snapshots: [], restored: [], usage: 0 };
		const slot = { textContent: '', hidden: true };
		const owner = { id: 'anthropic-api' };
		const invalidInput = { attrs: { 'data-field-key': 'relayAnthropicMonthlyLimit' }, getAttribute(name) { return this.attrs[name] === undefined ? null : this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = String(value); }, removeAttribute(name) { delete this.attrs[name]; }, closest: () => owner, focus() { state.focused += 1; } };
		const fields = { relaySettingsForm: { querySelectorAll: () => [invalidInput] }, relayRuntimeSettings: { querySelectorAll: () => [] }, relaySettingsMessage: { textContent: '' }, relayRuntimeMessage: { textContent: '' }, relaySaveBarText: { textContent: 'Unsaved changes' }, runtimeSaveBarText: { textContent: 'Unsaved changes' } };
		const fetch = async (url, init) => { state.posts.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ success: true, settings: {} }) }; };
		const fns = new Function('document', 'fields', 'fetch', 'relaySettingsUrl', 'formSnapshots', 'collectRelaySettingsPayload', 'setProviderCardOpen', 'renderRelaySettings', 'restoreRelaySection', 'followProviderRefresh', 'captureFormSnapshots', 'loadClaudeUsage', 'updateSettingsDirtyState',
			RELAY_LOAD_STATE + 'let providerFormRendered = true;\n' + names.map(extractPageFunction).join('\n') + '\nreturn { ' + names.join(', ') + ' };')(
			{ getElementById: () => slot }, fields, fetch, '/v1/relay/settings', snapshots, (section) => payload(section), (card, open) => state.opened.push([card.id, open]), (result) => state.rendered.push(result), (section, preserved) => state.restored.push(section), () => false, (keys) => state.snapshots.push(keys), () => { state.usage += 1; }, () => { state.dirtyUpdates = (state.dirtyUpdates || 0) + 1; });
		return { state, fields, fns, slot, invalidInput };
	};
	const relayPayload = (monthly) => (section) => (section === 'runtime' ? { runtime: { timeouts: {} } } : { defaults: { chat: 'm' }, cli_paths: { 'codex-cli': 'x' }, token_defaults: { chat: '' }, codex_image_tool: 'image_gen', providers: { anthropic: { api_key: '', clear_api_key: true, monthly_limit_usd: monthly, credit_balance_usd: '' } } });
	{
		const { state, fields, fns, slot, invalidInput } = build(relayPayload('abc'));
		const outcome = await fns.saveRelaySettings();
		assert.strictEqual(outcome.success, false);
		assert.strictEqual(outcome.message, 'Monthly spend limit must be a dollar amount like 500 or 500.25 (max 100,000,000).');
		assert.strictEqual(state.posts.length, 0, 'nothing is sent while a field is invalid');
		assert.strictEqual(slot.textContent, outcome.message, 'the message is shown next to the field');
		assert.strictEqual(invalidInput.attrs['aria-invalid'], 'true');
		assert.deepStrictEqual(state.opened, [['anthropic-api', true]], 'the card that holds the field is expanded');
		assert.strictEqual(state.focused, 1, 'the field is focused');
		assert.strictEqual(fields.relaySaveBarText.textContent, outcome.message, 'the sticky bar says what is wrong');
		assert.strictEqual(fields.relaySettingsMessage.textContent, outcome.message);
		// Refresh detection saves quietly: it fails with the same message but does not steal focus or rewrite the bar.
		fields.relaySaveBarText.textContent = 'Unsaved changes'; state.focused = 0;
		const quiet = await fns.saveRelaySettings({ quiet: true });
		assert.strictEqual(quiet.success, false);
		assert.strictEqual(state.focused, 0);
		assert.strictEqual(fields.relaySaveBarText.textContent, 'Unsaved changes');
	}
	{
		const { state, fns } = build(relayPayload('500.25'));
		const outcome = await fns.saveRelaySettings();
		assert.strictEqual(outcome.success, true);
		assert.strictEqual(state.posts.length, 1);
		assert.strictEqual(state.posts[0].url, '/v1/relay/settings');
		assert.deepStrictEqual(state.posts[0].body, { settings: relayPayload('500.25')('relay') }, 'the settings payload contract is unchanged: { settings: <collected section> }');
		assert.deepStrictEqual(state.snapshots, [['relay', 'runtime']], 'both sections are re-baselined from the saved settings');
		assert.deepStrictEqual(state.restored, [], 'no edited field is put back when nothing changed during the save');
		assert.strictEqual(state.usage, 1);
	}
	{
		// A stored out-of-range value that was not edited does not block Save; it shows as a warning next to the field.
		const loaded = relayPayload('12.345')('relay');
		const { state, fns, slot, invalidInput } = build(relayPayload('12.345'), { relay: JSON.stringify(loaded), runtime: '' });
		const outcome = await fns.saveRelaySettings();
		assert.strictEqual(outcome.success, true, 'the unchanged stored value is not a blocking error');
		assert.strictEqual(state.posts.length, 1, 'the settings are posted');
		assert.strictEqual(invalidInput.attrs['aria-invalid'], undefined);
		assert.strictEqual(slot.textContent, 'Stored value is outside the supported range and will be clamped by the Relay.');
		assert.strictEqual(slot.hidden, false, 'the warning stays visible next to the field');
		// The same field edited to another invalid value blocks again.
		const edited = build(relayPayload('12.3456'), { relay: JSON.stringify(loaded), runtime: '' });
		const blocked = await edited.fns.saveRelaySettings();
		assert.strictEqual(blocked.success, false);
		assert.strictEqual(edited.state.posts.length, 0);
		assert.strictEqual(edited.slot.textContent, 'Monthly spend limit must be a dollar amount like 500 or 500.25 (max 100,000,000).');
		// A malformed snapshot is ignored (everything invalid blocks, as before the first load).
		const broken = build(relayPayload('12.345'), { relay: '{not json', runtime: '' });
		assert.strictEqual((await broken.fns.saveRelaySettings()).success, false);
	}
	{
		// A runtime save only validates the runtime section.
		const { state, fns } = build((section) => (section === 'runtime' ? { runtime: { max_concurrent_jobs: '4', timeouts: {} } } : relayPayload('abc')(section)));
		const outcome = await fns.saveRelaySettings({ section: 'runtime' });
		assert.strictEqual(outcome.success, true, 'a runtime save is not blocked by an invalid provider field');
		assert.strictEqual(state.posts.length, 1);
	}
})().then(() => {}, (error) => { console.error(error); process.exit(1); });

// Reloads keep only the fields the user edited: the new settings are rendered and become the baseline, then the edited fields are put back.
(async () => {
	const clone = (value) => JSON.parse(JSON.stringify(value));
	const sharedNames = ['isPlainFormObject', 'diffFormEdits', 'collectFormEdits', 'applyFormEdits', 'isFormDirty'];
	const initialSettings = () => ({
		relay: { defaults: { chat: 'm1' }, cli_paths: { codex: 'codex' }, token_defaults: { chat: '' }, codex_image_tool: 'image_gen', providers: { anthropic: { api_key: '', clear_api_key: false, base_url: 'https://api.anthropic.com', models: '', monthly_limit_usd: '500' } } },
		runtime: { runtime: { max_concurrent_jobs: '2', timeouts: { codex_chat_ms: '600000' } } },
	});
	const buildRelay = () => {
		const env = { form: initialSettings(), server: initialSettings(), snapshots: { relay: '', runtime: '', asr: '', music: '', upscale: '', image: '' }, posts: [], onPost: null, timers: fakeTimers(), gets: 0, refreshPosts: 0, polls: 0, getGate: null, hangPosts: false };
		const fields = { refreshRelayProviders: { disabled: false, textContent: 'Refresh detection', dataset: {} }, relaySettingsMessage: { textContent: '' }, relayRuntimeMessage: { textContent: '' }, providerSettings: { contains: () => false } };
		const collect = (section) => clone(env.form[section]);
		const names = sharedNames.concat(['relayFormEdits', 'reapplyRelayEdits', 'relayFocusAttributes', 'relayFocusContainers', 'captureRelayFocus', 'restoreRelayFocus', 'fetchJsonWithTimeout', 'cancelRelaySettingsRetry', 'scheduleRelaySettingsRetry', 'loadRelaySettings', 'saveRelaySettings', 'cliPathsEdited', 'refreshProviderDetection']);
		const fetch = async (url, init) => {
			if (init && init.signal) env.signals = (env.signals || []).concat(init.signal);
			if (url === '/v1/relay/refresh') {
				env.refreshPosts += 1;
				if (env.hangPosts) return new Promise(() => {});
				return { ok: true, json: async () => ({ success: true, refresh: { id: 9, active: true } }) };
			}
			if (init && init.method === 'POST') {
				const body = JSON.parse(init.body);
				env.posts.push(body.settings);
				if (env.onPost) env.onPost();
				if (env.hangPosts) return new Promise(() => {});
				const keys = Object.keys(body.settings);
				if (keys.length === 1 && keys[0] === 'cli_paths') env.server.relay.cli_paths = clone(body.settings.cli_paths);
				else env.server[body.settings.runtime && !body.settings.defaults ? 'runtime' : 'relay'] = clone(body.settings);
				return { ok: true, json: async () => ({ success: true, settings: clone(env.server) }) };
			}
			env.gets += 1;
			// The settings as they were when the request was made, delivered when the gate (if any) opens.
			const snapshot = clone(env.server);
			if (env.getGate) { const gate = env.getGate; env.getGate = null; await gate; }
			return { ok: true, json: async () => ({ success: true, settings: snapshot }) };
		};
		env.fns = new Function('document', 'fields', 'fetch', 'relaySettingsUrl', 'formSnapshots', 'collectRelaySettingsPayload', 'renderRelaySettings', 'restoreRelaySection', 'captureFormSnapshots', 'updateSettingsDirtyState', 'validateRelaySection', 'followProviderRefresh', 'loadClaudeUsage', 'setSaveBarText', 'setProviderCardOpen', 'setTimeout', 'clearTimeout', 'pollProviderRefresh', 'setInterval', 'clearInterval',
			RELAY_LOAD_STATE + 'let providerRefreshPollTimer = null; let providerFormRendered = true; let relaySettingsLoading = false; let relaySettingsReloadQueued = false; let relaySettingsLastAttemptAt = 0;\n' + names.map(extractPageFunction).join('\n') + '\nreturn { ' + names.join(', ') + ' };')(
			{ activeElement: null, getElementById: () => null }, fields, fetch, '/v1/relay/settings', env.snapshots, collect,
			(payload) => { env.form.relay = clone(payload.settings.relay); env.form.runtime = clone(payload.settings.runtime); },
			(section, merged) => { env.form[section] = clone(merged); },
			(keys) => keys.forEach((key) => { if (env.form[key]) env.snapshots[key] = JSON.stringify(env.form[key]); }),
			() => {}, () => ({ errors: {}, warnings: {}, first: null }), () => false, () => {}, () => {}, () => {},
			(fn, ms) => env.timers.setTimeout(fn, ms), (id) => env.timers.clearTimeout(id), () => { env.polls += 1; }, () => 1, () => {});
		env.fns.baseline = () => { env.snapshots.relay = JSON.stringify(env.form.relay); env.snapshots.runtime = JSON.stringify(env.form.runtime); };
		env.fields = fields;
		return env;
	};

	// A reload with an unsaved edit elsewhere: untouched fields show the new server values, the edit is kept, Save sends both.
	{
		const env = buildRelay();
		env.fns.baseline();
		env.form.relay.providers.anthropic.base_url = 'https://proxy.example';
		env.server.relay.providers.anthropic.monthly_limit_usd = '900'; // changed in a second tab or client
		env.server.runtime.runtime.max_concurrent_jobs = '4';
		await env.fns.loadRelaySettings();
		assert.strictEqual(env.form.relay.providers.anthropic.monthly_limit_usd, '900', 'the untouched field shows the new server value');
		assert.strictEqual(env.form.relay.providers.anthropic.base_url, 'https://proxy.example', 'the edited field is kept');
		assert.strictEqual(env.form.runtime.runtime.max_concurrent_jobs, '4', 'the clean section is simply reloaded');
		assert.ok(env.fns.isFormDirty('relay'), 'the dirty bar is still shown');
		assert.ok(!env.fns.isFormDirty('runtime'));
		assert.deepStrictEqual(JSON.parse(env.snapshots.relay).providers.anthropic, { api_key: '', clear_api_key: false, base_url: 'https://api.anthropic.com', models: '', monthly_limit_usd: '900' }, 'the baseline is the freshly loaded settings');
		const outcome = await env.fns.saveRelaySettings();
		assert.strictEqual(outcome.success, true);
		assert.strictEqual(env.posts[0].providers.anthropic.monthly_limit_usd, '900', 'Save does not revert the change made elsewhere');
		assert.strictEqual(env.posts[0].providers.anthropic.base_url, 'https://proxy.example');
		assert.ok(!env.fns.isFormDirty('relay'), 'clean after the save');
		// A second reload without edits just takes the server values.
		env.server.relay.providers.anthropic.monthly_limit_usd = '950';
		await env.fns.loadRelaySettings();
		assert.strictEqual(env.form.relay.providers.anthropic.monthly_limit_usd, '950');
		assert.ok(!env.fns.isFormDirty('relay'));
	}

	// A settings GET that started before a save may finish after it: its (pre-save) answer is discarded and a fresh one is loaded.
	{
		const env = buildRelay();
		env.fns.baseline();
		let release;
		env.getGate = new Promise((resolve) => { release = resolve; });
		const staleLoad = env.fns.loadRelaySettings(); // the server still has the old base_url when this request is made
		await delay(0);
		assert.strictEqual(env.gets, 1);
		env.form.relay.providers.anthropic.base_url = 'https://proxy.example';
		const outcome = await env.fns.saveRelaySettings();
		assert.strictEqual(outcome.success, true);
		assert.strictEqual(env.server.relay.providers.anthropic.base_url, 'https://proxy.example');
		assert.ok(!env.fns.isFormDirty('relay'), 'the form is clean after the save');
		release();
		await staleLoad;
		await delay(5);
		assert.strictEqual(env.gets, 2, 'the answer that predates the save was thrown away and loaded again');
		assert.strictEqual(env.form.relay.providers.anthropic.base_url, 'https://proxy.example', 'the saved value is not replaced by the pre-save one');
		assert.ok(!env.fns.isFormDirty('relay'));
		assert.strictEqual(JSON.parse(env.snapshots.relay).providers.anthropic.base_url, 'https://proxy.example', 'and it is the clean baseline');
		// A GET that starts after the save is used as it is.
		env.server.relay.providers.anthropic.monthly_limit_usd = '700';
		await env.fns.loadRelaySettings();
		assert.strictEqual(env.gets, 3);
		assert.strictEqual(env.form.relay.providers.anthropic.monthly_limit_usd, '700');
	}

	// A save request that hangs is abandoned after 30 s with a clear message.
	{
		const env = buildRelay();
		env.fns.baseline();
		env.hangPosts = true;
		let outcome = null;
		const saving = env.fns.saveRelaySettings().then((result) => { outcome = result; });
		await delay(0);
		await env.timers.advance(29999);
		assert.strictEqual(outcome, null, 'still waiting before 30 s');
		await env.timers.advance(1);
		await saving;
		assert.strictEqual(outcome.success, false);
		assert.strictEqual(outcome.message, 'Saving routing settings timed out after 30 s');
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Saving routing settings timed out after 30 s');
		assert.strictEqual(env.timers.pending(), 0, 'no timer is left behind');
		assert.ok(env.signals && env.signals[0] && env.signals[0].aborted, 'the request itself was aborted');
		// The page can save again afterwards.
		env.hangPosts = false;
		assert.strictEqual((await env.fns.saveRelaySettings()).success, true);
	}

	// Refresh detection saves only the executable paths: a typed API key, routing and other edits are not sent and stay unsaved.
	{
		const env = buildRelay();
		env.fns.baseline();
		env.form.relay.cli_paths.codex = '/opt/codex';
		env.form.relay.providers.anthropic.api_key = 'sk-typed-secret';
		env.form.relay.defaults.chat = 'm2';
		env.form.runtime.runtime.max_concurrent_jobs = '8';
		assert.ok(env.fns.cliPathsEdited());
		await env.fns.refreshProviderDetection();
		assert.deepStrictEqual(env.posts, [{ cli_paths: { codex: '/opt/codex' } }], 'only cli_paths is posted');
		assert.ok(!JSON.stringify(env.posts).includes('sk-typed-secret'), 'the typed key never leaves the page');
		assert.strictEqual(env.server.relay.cli_paths.codex, '/opt/codex');
		assert.strictEqual(env.server.relay.providers.anthropic.api_key, '', 'the key was not saved');
		assert.strictEqual(env.refreshPosts, 1, 'detection was started');
		assert.strictEqual(env.form.relay.providers.anthropic.api_key, 'sk-typed-secret', 'the typed key is still in the form');
		assert.strictEqual(env.form.relay.defaults.chat, 'm2', 'routing edits are still in the form');
		assert.strictEqual(env.form.runtime.runtime.max_concurrent_jobs, '8');
		assert.ok(env.fns.isFormDirty('relay'), 'the Providers form is still dirty (Save stays available)');
		assert.ok(env.fns.isFormDirty('runtime'));
		assert.deepStrictEqual(env.fns.relayFormEdits('relay').map((edit) => edit.path.join('.')).sort(), ['defaults.chat', 'providers.anthropic.api_key'], 'the paths are the new baseline; the other edits remain edits');
		assert.strictEqual(env.fields.refreshRelayProviders.dataset.refreshId, '9');
		// The next Save sends the pending edits as usual (and the paths, which are unchanged now).
		const saved = await env.fns.saveRelaySettings();
		assert.strictEqual(saved.success, true);
		assert.strictEqual(env.posts[1].providers.anthropic.api_key, 'sk-typed-secret');
		assert.strictEqual(env.posts[1].defaults.chat, 'm2');
	}
	// Unchanged executable paths: nothing is posted to the settings route at all.
	{
		const env = buildRelay();
		env.fns.baseline();
		env.form.relay.providers.anthropic.api_key = 'sk-typed-secret';
		assert.ok(!env.fns.cliPathsEdited());
		await env.fns.refreshProviderDetection();
		assert.deepStrictEqual(env.posts, [], 'no settings POST');
		assert.strictEqual(env.refreshPosts, 1);
		assert.strictEqual(env.form.relay.providers.anthropic.api_key, 'sk-typed-secret');
		assert.ok(env.fns.isFormDirty('relay'));
	}
	// A path typed while the paths were being saved stays an unsaved edit.
	{
		const env = buildRelay();
		env.fns.baseline();
		env.form.relay.cli_paths.codex = '/opt/codex';
		env.onPost = () => { env.form.relay.cli_paths.codex = '/opt/codex2'; };
		await env.fns.refreshProviderDetection();
		assert.strictEqual(env.form.relay.cli_paths.codex, '/opt/codex2');
		assert.ok(env.fns.cliPathsEdited(), 'the newer path is still pending');
	}
	// A start request that hangs releases the busy state with a clear message.
	{
		const env = buildRelay();
		env.fns.baseline();
		env.hangPosts = true;
		const starting = env.fns.refreshProviderDetection();
		await delay(0);
		assert.strictEqual(env.fields.refreshRelayProviders.disabled, true);
		assert.strictEqual(env.fields.refreshRelayProviders.dataset.refreshStarting, '1');
		await env.timers.advance(30000);
		await starting;
		assert.strictEqual(env.fields.refreshRelayProviders.disabled, false, 'the button comes back');
		assert.strictEqual(env.fields.refreshRelayProviders.dataset.refreshStarting, undefined, 'the starting guard is released');
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Detection refresh failed: Starting provider detection timed out after 30 s');
	}

	// Secrets: only typed replacement values and clear flags survive a reload; a field that no longer exists is dropped.
	{
		const env = buildRelay();
		env.fns.baseline();
		env.form.relay.providers.anthropic.api_key = 'sk-typed';
		env.form.relay.providers.anthropic.clear_api_key = true;
		env.form.relay.cli_paths.codex = '/opt/codex';
		env.server.relay.cli_paths = {};
		env.server.relay.providers.anthropic.base_url = 'https://moved.example';
		await env.fns.loadRelaySettings();
		assert.strictEqual(env.form.relay.providers.anthropic.api_key, 'sk-typed');
		assert.strictEqual(env.form.relay.providers.anthropic.clear_api_key, true);
		assert.deepStrictEqual(env.form.relay.cli_paths, {}, 'an edit of a field the new settings no longer have is dropped');
		assert.strictEqual(env.form.relay.providers.anthropic.base_url, 'https://moved.example');
		const clean = buildRelay();
		clean.fns.baseline();
		clean.server.relay.providers.anthropic.base_url = 'https://moved.example';
		await clean.fns.loadRelaySettings();
		assert.strictEqual(clean.form.relay.providers.anthropic.api_key, '', 'untouched secret fields stay blank');
		assert.strictEqual(clean.form.relay.providers.anthropic.clear_api_key, false);
	}

	// Typing while a save is in flight: the response becomes the baseline and the newly typed field stays, leaving the section dirty.
	{
		const env = buildRelay();
		env.fns.baseline();
		env.form.relay.providers.anthropic.base_url = 'https://sent.example';
		env.onPost = () => { env.form.relay.providers.anthropic.models = 'typed-during-save'; env.form.relay.providers.anthropic.base_url = 'https://typed-during-save.example'; };
		const outcome = await env.fns.saveRelaySettings();
		assert.strictEqual(outcome.success, true);
		assert.strictEqual(env.posts[0].providers.anthropic.base_url, 'https://sent.example');
		assert.strictEqual(env.form.relay.providers.anthropic.base_url, 'https://typed-during-save.example', 'text typed during the save is not dropped');
		assert.strictEqual(env.form.relay.providers.anthropic.models, 'typed-during-save');
		assert.strictEqual(JSON.parse(env.snapshots.relay).providers.anthropic.base_url, 'https://sent.example', 'the saved settings are the new baseline');
		assert.ok(env.fns.isFormDirty('relay'), 'the section stays dirty');
	}
	{
		// Nothing typed during the save: clean afterwards. The other section keeps its edit and sees a newer server value elsewhere.
		const env = buildRelay();
		env.fns.baseline();
		env.form.relay.providers.anthropic.base_url = 'https://sent.example';
		env.form.runtime.runtime.timeouts.codex_chat_ms = '123456';
		env.onPost = () => { env.server.runtime.runtime.max_concurrent_jobs = '8'; };
		await env.fns.saveRelaySettings();
		assert.ok(!env.fns.isFormDirty('relay'));
		assert.strictEqual(env.form.runtime.runtime.timeouts.codex_chat_ms, '123456', 'the other section keeps its edit');
		assert.strictEqual(env.form.runtime.runtime.max_concurrent_jobs, '8', 'its untouched fields take the server values');
		assert.ok(env.fns.isFormDirty('runtime'));
	}

	// Local engine forms (ASR with a model list, and upscale): a background reload keeps only the edited fields.
	const engineEnv = () => {
		const env = { form: {}, snapshots: { relay: '', runtime: '', asr: '', music: '', upscale: '', image: '' }, server: {}, dirtyUpdates: 0, rendered: [] };
		const names = sharedNames.concat(['engineFormEdits', 'reapplyEngineEdits', 'loadAsrSettings', 'loadUpscaleSettings']);
		const prelude = `
			let currentAsrSettings = {}; let currentUpscaleSettings = {};
			const engineBaselines = { asr: null, music: null, upscale: null, image: null };
			function renderAsrSettingsForm(settings) { currentAsrSettings = settings || {}; env.form.asr = { python_path: currentAsrSettings.python_path || '', beam_size: currentAsrSettings.beam_size || 5, models: (currentAsrSettings.models || []).map((model) => ({ id: model.id, label: model.label || '' })) }; }
			function serializeAsrSettingsForm() { return JSON.parse(JSON.stringify(env.form.asr)); }
			function renderUpscaleSettings(settings, models) { currentUpscaleSettings = settings || {}; env.rendered.push(models); env.form.upscale = { python_path: currentUpscaleSettings.python_path || '', tile: currentUpscaleSettings.tile || 0 }; }
			function serializeUpscaleSettings() { return JSON.parse(JSON.stringify(env.form.upscale)); }
			function captureFormSnapshots(keys) { keys.forEach((key) => { env.snapshots[key] = JSON.stringify(key === 'asr' ? serializeAsrSettingsForm() : serializeUpscaleSettings()); }); }
			function updateSettingsDirtyState() { env.dirtyUpdates += 1; }
			function renderAsrDetails() {}
		`;
		const fields = { asrSettingsMessage: { textContent: '' }, upscaleSettingsMessage: { textContent: '' } };
		const fetch = async (url) => ({ ok: true, json: async () => (url.startsWith('/asr') ? { settings: clone(env.server.asr) } : { settings: clone(env.server.upscale), models: clone(env.server.upscaleModels) }) });
		env.fns = new Function('env', 'fields', 'fetch', 'formSnapshots', 'asrSettingsUrl', 'upscaleSettingsUrl', prelude + names.map(extractPageFunction).join('\n') + '\nreturn { ' + names.join(', ') + ' };')(env, fields, fetch, env.snapshots, '/asr', '/upscale');
		env.fields = fields;
		return env;
	};
	{
		const env = engineEnv();
		env.server.asr = { python_path: 'py', beam_size: 5, models: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] };
		await env.fns.loadAsrSettings();
		assert.strictEqual(env.fields.asrSettingsMessage.textContent, 'Settings loaded');
		assert.ok(!env.fns.isFormDirty('asr'));
		env.form.asr.python_path = 'C:/py312';
		env.form.asr.models[1].label = 'B edited';
		env.server.asr = { python_path: 'py', beam_size: 8, models: [{ id: 'a', label: 'A2' }, { id: 'b', label: 'B' }] };
		await env.fns.loadAsrSettings({ refreshRuntime: true });
		assert.strictEqual(env.form.asr.python_path, 'C:/py312', 'the edited field is kept');
		assert.strictEqual(env.form.asr.models[1].label, 'B edited', 'an edited model field is kept');
		assert.strictEqual(env.form.asr.beam_size, 8, 'untouched fields show the new settings');
		assert.strictEqual(env.form.asr.models[0].label, 'A2');
		assert.ok(env.fns.isFormDirty('asr'), 'still dirty');
		assert.strictEqual(JSON.parse(env.snapshots.asr).python_path, 'py', 'the baseline is the new settings');
		assert.strictEqual(env.fields.asrSettingsMessage.textContent, 'Runtime checked - unsaved edits kept');
		// An added model (different list length) is kept as a whole.
		env.form.asr.models.push({ id: 'c', label: 'C' });
		await env.fns.loadAsrSettings();
		assert.deepStrictEqual(env.form.asr.models.map((model) => model.id), ['a', 'b', 'c']);
		assert.ok(env.fns.isFormDirty('asr'));
		// The explicit Reload button discards the edits.
		await env.fns.loadAsrSettings({ discardEdits: true });
		assert.deepStrictEqual(env.form.asr, { python_path: 'py', beam_size: 8, models: [{ id: 'a', label: 'A2' }, { id: 'b', label: 'B' }] });
		assert.ok(!env.fns.isFormDirty('asr'));
	}
	{
		const env = engineEnv();
		env.server.upscale = { python_path: 'py', tile: 0 };
		env.server.upscaleModels = [{ id: 'm1' }];
		await env.fns.loadUpscaleSettings();
		env.form.upscale.tile = 64;
		env.server.upscale = { python_path: 'py2', tile: 0 };
		env.server.upscaleModels = [{ id: 'm1' }, { id: 'm2' }];
		await env.fns.loadUpscaleSettings(); // e.g. after a model install
		assert.deepStrictEqual(env.form.upscale, { python_path: 'py2', tile: 64 });
		assert.ok(env.fns.isFormDirty('upscale'));
		assert.deepStrictEqual(env.rendered[env.rendered.length - 1], [{ id: 'm1' }, { id: 'm2' }], 'the model list is the new one');
		await env.fns.loadUpscaleSettings({ discardEdits: true });
		assert.deepStrictEqual(env.form.upscale, { python_path: 'py2', tile: 0 });
		assert.ok(!env.fns.isFormDirty('upscale'));
		// A click handler passes the event as the first argument; it must not be mistaken for options.
		env.form.upscale.tile = 32;
		await env.fns.loadUpscaleSettings({ type: 'click' });
		assert.strictEqual(env.form.upscale.tile, 32);
	}
})().then(() => {}, (error) => { console.error(error); process.exit(1); });

// Local engine saves keep fields typed while the request was in flight, re-baseline from setup saves, and refuse to run before the first load.
(async () => {
	const clone = (value) => JSON.parse(JSON.stringify(value));
	const sharedNames = ['isPlainFormObject', 'diffFormEdits', 'collectFormEdits', 'applyFormEdits', 'isFormDirty'];
	const names = sharedNames.concat(['engineFormEdits', 'reapplyEngineEdits', 'engineSettingsMissing', 'applyEngineSaveResult', 'engineSavedText',
		'applyAsrSaveResult', 'applyMusicSaveResult', 'applyUpscaleSaveResult', 'applyImageSaveResult', 'persistAsrSettings',
		'saveAsrSettings', 'setupAsrModel', 'loadAsrSettings', 'loadMusicAnalysisSettings', 'saveMusicAnalysisSettings', 'saveUpscaleSettings', 'setupUpscale', 'loadUpscaleSettings',
		'saveImageSettings', 'setupImage', 'loadImageSettings']);
	const prelude = `
		const engineBaselines = { asr: null, music: null, upscale: null, image: null };
		let currentAsrSettings = {}; let currentMusicAnalysisSettings = {}; let currentUpscaleSettings = {}; let currentImageSettings = {};
		const setupLogs = [];
		function renderAsrSettingsForm(settings) { currentAsrSettings = settings || {}; env.form.asr = clone(currentAsrSettings); }
		function renderMusicAnalysisSettings(settings) { currentMusicAnalysisSettings = settings || {}; env.form.music = clone(currentMusicAnalysisSettings); }
		function renderUpscaleSettings(settings, models) { currentUpscaleSettings = settings || {}; env.form.upscale = clone(currentUpscaleSettings); env.rendered.upscale = models; }
		function renderImageSettings(settings, models, choices) { currentImageSettings = settings || {}; env.form.image = clone(currentImageSettings); env.rendered.image = { models, choices }; }
		function renderAsrSettingsJson() {}
		function renderAsrDetails() {}
		function serializeAsrSettingsForm() { return clone(env.form.asr); }
		function serializeMusicAnalysisSettings() { return clone(env.form.music); }
		function serializeUpscaleSettings() { return clone(env.form.upscale); }
		function serializeImageSettings() { return clone(env.form.image); }
		function captureFormSnapshots(keys) { keys.forEach((key) => { env.snapshots[key] = JSON.stringify(env.form[key]); }); }
		function updateSettingsDirtyState() { env.dirtyUpdates += 1; }
		function showSetupLog() {}
		function setupFailureText(payload, fallback) { return fallback; }
		async function refresh() { env.refreshes += 1; }
		async function loadRelaySettings() {}
		const asrSettingsUrl = '/asr'; const asrSetupUrl = '/asr-setup'; const musicAnalysisSettingsUrl = '/music'; const upscaleSettingsUrl = '/upscale'; const upscaleSetupUrl = '/upscale-setup'; const imageSettingsUrl = '/image'; const imageSetupUrl = '/image-setup';
		const numberValue = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
	`;
	const urlKey = (url) => url.replace(/^\//, '').replace(/-setup$/, '').replace(/\?.*$/, '');
	const build = () => {
		const env = {
			form: {}, server: {}, snapshots: { relay: '', runtime: '', asr: '', music: '', upscale: '', image: '' }, posts: [], setups: [], rendered: {}, dirtyUpdates: 0, refreshes: 0,
			normalize: {}, onPost: null, models: { upscale: [{ id: 'u1' }], image: [{ id: 'i1' }] },
		};
		const fields = {
			asrSettingsMessage: { textContent: '' }, musicAnalysisSettingsMessage: { textContent: '' }, upscaleSettingsMessage: { textContent: '' }, imageSettingsMessage: { textContent: '' },
			asrModelSettings: { querySelectorAll: () => [] }, upscaleInstallActions: { querySelectorAll: () => [] }, imageInstallActions: { querySelectorAll: () => [] },
			setupImageEnvironment: { disabled: false, textContent: 'Set up' }, asrSetupLog: {}, upscaleSetupLog: {}, imageSetupLog: {},
		};
		const fetch = async (url, init) => {
			const key = urlKey(url);
			const isSetup = /-setup$/.test(url);
			if (init && init.method === 'POST' && !isSetup) {
				const settings = JSON.parse(init.body).settings;
				env.posts.push({ key, settings });
				if (env.onPost) env.onPost(key);
				env.server[key] = env.normalize[key] ? env.normalize[key](clone(settings)) : clone(settings);
				return { ok: true, json: async () => ({ success: true, settings: clone(env.server[key]), models: clone(env.models[key] || []), resolution_choices: [] }) };
			}
			if (init && init.method === 'POST') {
				env.setups.push(key);
				return { ok: true, json: async () => ({ success: true, label: 'Model', model: { label: 'Model' }, details: {} }) };
			}
			return { ok: true, json: async () => ({ success: true, settings: clone(env.server[key]), models: clone(env.models[key] || []), resolution_choices: [] }) };
		};
		env.fns = new Function('env', 'fields', 'fetch', 'formSnapshots', 'clone', prelude + names.map(extractPageFunction).join('\n') + '\nreturn { ' + names.join(', ') + ', engineBaselines };')(env, fields, fetch, env.snapshots, clone);
		env.fields = fields;
		return env;
	};
	const button = (text = 'Install') => ({ textContent: text, isConnected: true, closest: () => null, getAttribute: () => 'm1' });

	// ASR: fields typed while the save is in flight survive; the response is the baseline; the form stays dirty and does not claim a full save.
	{
		const env = build();
		env.server.asr = { python_path: 'py', beam_size: 5, qwen_chunk_seconds: 30 };
		await env.fns.loadAsrSettings();
		env.form.asr.python_path = 'C:/py-sent';
		env.onPost = () => { env.form.asr.beam_size = 9; env.form.asr.python_path = 'C:/py-typed-later'; };
		await env.fns.saveAsrSettings();
		assert.strictEqual(env.posts[0].settings.python_path, 'C:/py-sent');
		assert.strictEqual(env.form.asr.python_path, 'C:/py-typed-later', 'text typed during the save is not replaced by the response');
		assert.strictEqual(env.form.asr.beam_size, 9);
		assert.strictEqual(JSON.parse(env.snapshots.asr).python_path, 'C:/py-sent', 'the saved settings are the baseline');
		assert.strictEqual(JSON.parse(env.snapshots.asr).beam_size, 5);
		assert.ok(env.fns.isFormDirty('asr'), 'the form stays dirty');
		assert.ok(/still unsaved/.test(env.fields.asrSettingsMessage.textContent), env.fields.asrSettingsMessage.textContent);
		// Nothing typed during the save: clean, plain message, and the server's normalized value is shown.
		env.normalize.asr = (settings) => Object.assign(settings, { beam_size: 8 });
		env.onPost = null;
		env.form.asr.python_path = 'C:/py-final';
		await env.fns.saveAsrSettings();
		assert.strictEqual(env.fields.asrSettingsMessage.textContent, 'Saved');
		assert.strictEqual(env.form.asr.beam_size, 8);
		assert.ok(!env.fns.isFormDirty('asr'));
	}

	// Image: the setting typed while the POST is in flight is kept (the handler goes on to await refresh()).
	{
		const env = build();
		env.server.image = { python_path: 'p', default_steps: 40, cpu_offload: true };
		await env.fns.loadImageSettings();
		env.form.image.python_path = 'p-sent';
		env.onPost = () => { env.form.image.default_steps = 60; env.form.image.cpu_offload = false; };
		await env.fns.saveImageSettings();
		assert.deepStrictEqual(env.form.image, { python_path: 'p-sent', default_steps: 60, cpu_offload: false });
		assert.deepStrictEqual(JSON.parse(env.snapshots.image), { python_path: 'p-sent', default_steps: 40, cpu_offload: true });
		assert.ok(env.fns.isFormDirty('image'));
		assert.ok(/still unsaved/.test(env.fields.imageSettingsMessage.textContent));
		assert.deepStrictEqual(env.rendered.image.models, [{ id: 'i1' }], 'the model list of the response is rendered');
		assert.ok(env.refreshes >= 1);
		env.onPost = null;
		await env.fns.saveImageSettings();
		assert.strictEqual(env.fields.imageSettingsMessage.textContent, 'Saved');
		assert.ok(!env.fns.isFormDirty('image'));
	}

	// Upscale and music analysis use the same in-flight protection.
	{
		const env = build();
		env.server.upscale = { python_path: 'u', tile: 0 };
		env.server.music = { python_path: 'm', sample_rate: 22050 };
		await env.fns.loadUpscaleSettings();
		await env.fns.loadMusicAnalysisSettings({});
		env.form.upscale.python_path = 'u-sent';
		env.form.music.python_path = 'm-sent';
		env.onPost = (key) => { if (key === 'upscale') env.form.upscale.tile = 64; else env.form.music.sample_rate = 44100; };
		await env.fns.saveUpscaleSettings();
		await env.fns.saveMusicAnalysisSettings();
		assert.deepStrictEqual(env.form.upscale, { python_path: 'u-sent', tile: 64 });
		assert.deepStrictEqual(env.form.music, { python_path: 'm-sent', sample_rate: 44100 });
		assert.ok(env.fns.isFormDirty('upscale') && env.fns.isFormDirty('music'));
		assert.deepStrictEqual(env.rendered.upscale, [{ id: 'u1' }]);
	}

	// A setup action saves first: the saved (and possibly clamped) values become the baseline before the follow-up reload.
	{
		const env = build();
		env.server.asr = { python_path: 'py', qwen_chunk_seconds: 30 };
		await env.fns.loadAsrSettings();
		env.normalize.asr = (settings) => Object.assign(settings, { qwen_chunk_seconds: Math.max(5, settings.qwen_chunk_seconds) });
		env.form.asr.qwen_chunk_seconds = 2;
		await env.fns.setupAsrModel(button('Install model'));
		assert.deepStrictEqual(env.setups, ['asr']);
		assert.strictEqual(env.form.asr.qwen_chunk_seconds, 5, 'the clamped value is shown, not the pre-save 2');
		assert.ok(!env.fns.isFormDirty('asr'), 'the Save bar does not reappear');
		assert.strictEqual(JSON.parse(env.snapshots.asr).qwen_chunk_seconds, 5);
		// A field typed while the install runs is still kept by the reload.
		env.form.asr.python_path = 'py-before';
		env.onPost = () => { env.form.asr.python_path = 'py-typed-in-flight'; };
		await env.fns.setupAsrModel(button('Install model'));
		assert.strictEqual(env.form.asr.python_path, 'py-typed-in-flight');
		assert.ok(env.fns.isFormDirty('asr'));
	}
	{
		const env = build();
		env.server.image = { python_path: 'p', default_steps: 40 };
		env.server.upscale = { python_path: 'u', tile: 0 };
		await env.fns.loadImageSettings();
		await env.fns.loadUpscaleSettings();
		env.normalize.image = (settings) => Object.assign(settings, { default_steps: Math.min(100, settings.default_steps) });
		env.normalize.upscale = (settings) => Object.assign(settings, { tile: Math.max(0, settings.tile) });
		env.form.image.default_steps = 500;
		env.form.upscale.tile = -64;
		await env.fns.setupImage({ button: button('Install Model'), model: 'i1', download_model: true });
		await env.fns.setupUpscale('u1', button('Install'), false);
		assert.deepStrictEqual(env.setups, ['image', 'upscale']);
		assert.strictEqual(env.form.image.default_steps, 100);
		assert.strictEqual(env.form.upscale.tile, 0);
		assert.ok(!env.fns.isFormDirty('image') && !env.fns.isFormDirty('upscale'));
	}

	// Before the first successful load nothing is saved or installed: the form is empty and would blank the stored settings.
	{
		const env = build();
		env.server.asr = { python_path: 'py' };
		await env.fns.saveAsrSettings();
		await env.fns.setupAsrModel(button());
		await env.fns.saveMusicAnalysisSettings();
		await env.fns.saveUpscaleSettings();
		await env.fns.setupUpscale('u1', button(), false);
		await env.fns.saveImageSettings();
		await env.fns.setupImage({ button: button(), model: 'i1', download_model: true });
		assert.deepStrictEqual(env.posts, []);
		assert.deepStrictEqual(env.setups, []);
		for (const message of ['asrSettingsMessage', 'musicAnalysisSettingsMessage', 'upscaleSettingsMessage', 'imageSettingsMessage']) assert.ok(/not loaded yet/.test(env.fields[message].textContent), message);
	}
})().then(() => {}, (error) => { console.error(error); process.exit(1); });

// A routing default that became unavailable after a reload stays visible when an edit is put back.
{
	const fns = new Function('fields', 'document', 'syncSecretFields', ['text', 'escapeHtml', 'setRoutingSelectValue', 'restoreRelaySection'].map(extractPageFunction).join('\n') + '\nreturn { restoreRelaySection, setRoutingSelectValue };');
	const makeSelect = (job, optionValues, selected) => {
		const select = {
			job, value: selected, options: [],
			getAttribute(name) { return name === 'data-relay-job' ? this.job : null; },
			get innerHTML() { return this.options.map((option) => '<option value="' + option.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">x</option>').join(''); },
			set innerHTML(html) {
				select.html = html;
				select.options = Array.from(html.matchAll(/<option value="([^"]*)"/g)).map((match) => ({ value: unescapeAttr(match[1]) }));
			},
		};
		let current = selected;
		Object.defineProperty(select, 'value', { get: () => current, set: (value) => { current = select.options.some((option) => option.value === value) ? value : ''; } });
		select.options = optionValues.map((value) => ({ value }));
		return select;
	};
	const chat = makeSelect('chat', ['m1', 'm2'], 'm1');
	const images = makeSelect('images', ['img1'], 'img1');
	const fields = {
		relayDefaultSettings: { querySelectorAll: () => [chat, images] },
		providerSettings: { querySelectorAll: () => [] },
		relayTokenDefaults: { querySelectorAll: () => [] },
	};
	const api = fns(fields, { getElementById: () => null }, () => {});
	const gone = 'gone<model>&"x"';
	api.restoreRelaySection('relay', { defaults: { chat: gone, images: 'img1' } });
	assert.strictEqual(chat.value, gone, 'the edited value is selected instead of a blank select');
	assert.ok(chat.options.some((option) => option.value === gone), 'the id is parsed back as the same value');
	assert.ok(chat.html.includes('Unavailable selection: gone&lt;model&gt;&amp;&quot;x&quot;') && chat.html.includes('selected disabled'));
	assert.ok(!chat.html.includes('<model>'), 'the id is never injected as markup');
	assert.strictEqual(images.value, 'img1');
	assert.deepStrictEqual(images.options, [{ value: 'img1' }], 'a model that is still offered gets no extra option');
	// An id that needs no escaping round-trips as the value.
	const plain = makeSelect('chat', ['m1'], 'm1');
	fields.relayDefaultSettings.querySelectorAll = () => [plain];
	api.restoreRelaySection('relay', { defaults: { chat: 'retired-model' } });
	assert.strictEqual(plain.value, 'retired-model');
	assert.ok(plain.html.includes('Unavailable selection: retired-model'));
	// A model that is offered is simply selected.
	api.restoreRelaySection('relay', { defaults: { chat: 'm1' } });
	assert.strictEqual(plain.value, 'm1');
}

// Provider settings that were never loaded are not saved: Refresh detection and every provider save wait for the first render.
(async () => {
	assert.ok(/<button[^>]*id="refreshRelayProviders"[^>]*\sdisabled[\s>]/.test(html), 'Refresh detection starts disabled');
	assert.ok(/id="saveRelaySettings" disabled/.test(html) && /id="saveRelayRuntimeSettings" disabled/.test(html), 'Save starts disabled');
	const save = (rendered, calls) => new Function('fields', 'fetch', 'collectRelaySettingsPayload', 'validateRelaySection', 'setProviderCardOpen', 'setSaveBarText', 'collectFormEdits', 'relayFormEdits', 'renderRelaySettings', 'captureFormSnapshots', 'reapplyRelayEdits', 'captureRelayFocus', 'restoreRelayFocus', 'followProviderRefresh', 'loadClaudeUsage', 'relaySettingsUrl',
		RELAY_LOAD_STATE + 'let providerFormRendered = ' + rendered + ';\n' + extractPageFunction('fetchJsonWithTimeout') + '\n' + extractPageFunction('saveRelaySettings') + '\nreturn saveRelaySettings;')(
		{ relaySettingsMessage: { textContent: '' }, relayRuntimeMessage: { textContent: '' } },
		async (url, init) => { calls.push(url); return { ok: true, json: async () => ({ success: true, settings: {} }) }; },
		() => { calls.push('collect'); return { defaults: {}, cli_paths: {} }; }, () => ({ errors: {}, warnings: {}, first: null }), () => {}, () => {}, () => [], () => [], () => {}, () => {}, () => 0, () => null, () => {}, () => false, () => {}, '/v1/relay/settings');
	const calls = [];
	const blocked = await save(false, calls)();
	assert.deepStrictEqual(blocked, { success: false, message: 'Provider settings are not loaded yet.' });
	assert.deepStrictEqual(calls, [], 'nothing is collected or posted');
	assert.deepStrictEqual(await save(false, calls)({ section: 'runtime', quiet: true }), { success: false, message: 'Provider settings are not loaded yet.' });
	assert.deepStrictEqual(calls, []);
	assert.strictEqual((await save(true, calls)()).success, true, 'a loaded form saves as before');
	assert.ok(calls.includes('/v1/relay/settings'));

	// Refresh detection: a plain detection refresh when nothing was loaded, save-then-refresh when the form is loaded.
	const refreshWith = async (rendered, pathsEdited = true) => {
		const events = [];
		const button = { disabled: false, textContent: 'Refresh detection', dataset: {} };
		const fields = { refreshRelayProviders: button, relaySettingsMessage: { textContent: '' } };
		const run = new Function('fields', 'saveRelaySettings', 'fetch', 'pollProviderRefresh', 'setInterval', 'clearInterval', 'cliPathsEdited',
			RELAY_LOAD_STATE + 'let providerFormRendered = ' + rendered + '; let providerRefreshPollTimer = null;\n' + extractPageFunction('fetchJsonWithTimeout') + '\n' + extractPageFunction('refreshProviderDetection') + '\nreturn refreshProviderDetection;')(
			fields, async (options) => { events.push(['save', options]); return { success: true, refreshStarted: false }; },
			async (url, init) => { events.push(['fetch', url, init && init.method]); return { ok: true, json: async () => ({ refresh: { id: 7 } }) }; },
			() => { events.push(['poll']); }, () => 1, () => {}, () => pathsEdited);
		await run();
		return { events, button };
	};
	{
		const { events, button } = await refreshWith(false);
		assert.deepStrictEqual(events, [['fetch', '/v1/relay/refresh', 'POST'], ['poll']], 'detection is refreshed without saving settings');
		assert.strictEqual(button.dataset.refreshId, '7');
	}
	{
		const { events } = await refreshWith(true);
		assert.deepStrictEqual(events.map((event) => event[0]), ['save', 'fetch', 'poll']);
		assert.deepStrictEqual(events[0][1], { quiet: true, cliPathsOnly: true }, 'only the executable paths are saved');
	}
	{
		const { events } = await refreshWith(true, false);
		assert.deepStrictEqual(events.map((event) => event[0]), ['fetch', 'poll'], 'unchanged executable paths: nothing is saved, detection just runs');
	}

	// The first successful render marks the form loaded and enables Refresh detection, unless a refresh is already running.
	const renderWith = (buttonState) => {
		const fields = {
			providerSettings: { innerHTML: '' }, relayDefaultSettings: { innerHTML: '' }, relayTokenDefaults: { innerHTML: '' }, relayRuntimeSettings: null,
			relayRuntimeMessage: { textContent: '' }, refreshRelayProviders: Object.assign({ disabled: true, textContent: 'Refresh detection', dataset: {} }, buttonState),
		};
		const api = new Function('fields', 'currentCapabilities', 'collectProviderCardTests', 'renderProviderCards', 'restoreProviderCardTests', 'escapeHtml', 'optionAttr', 'fieldErrorSlot', 'setSaveBarText', 'renderProviderTestPanels', 'updateProviderTestCounts', 'applyProviderFocus', 'applyTestFocus',
			'let lastRelaySettingsPayload = null; let providerFormRendered = false;\n' + extractPageFunction('renderRelaySettings') + '\nreturn { renderRelaySettings, loaded: () => providerFormRendered };')(
			fields, {}, () => ({}), () => '', () => {}, (value) => String(value), () => '', () => '', () => {}, () => {}, () => {}, () => {}, () => {});
		return { fields, api };
	};
	{
		const { fields, api } = renderWith({});
		assert.strictEqual(api.loaded(), false);
		api.renderRelaySettings({ settings: {}, models: [], backends: [] });
		assert.strictEqual(api.loaded(), true);
		assert.strictEqual(fields.refreshRelayProviders.disabled, false, 'Refresh detection is enabled after the first render');
		fields.refreshRelayProviders.disabled = true;
		api.renderRelaySettings({ settings: {}, models: [], backends: [] });
		assert.strictEqual(fields.refreshRelayProviders.disabled, true, 'only the first render enables it');
		const running = renderWith({ textContent: 'Checking…' });
		running.api.renderRelaySettings({ settings: {}, models: [], backends: [] });
		assert.strictEqual(running.fields.refreshRelayProviders.disabled, true, 'a running detection keeps it disabled');
		assert.strictEqual(running.api.loaded(), true);
	}
	assert.ok(extractPageFunction('loadRelaySettings').includes('captureRelayFocus()') && extractPageFunction('loadRelaySettings').includes('restoreRelayFocus(focus)'), 'a background reload restores focus');
})().then(() => {}, (error) => { console.error(error); process.exit(1); });

// Focus survives a re-render: fields are found again by id or by their data attribute, and the caret of text inputs is restored.
{
	const names = ['relayFocusAttributes', 'relayFocusContainers', 'captureRelayFocus', 'restoreRelayFocus'];
	const makeInput = (attrs, extra = {}) => {
		const input = Object.assign({ id: '', attrs, focused: [], carets: [], getAttribute(name) { return this.attrs[name] === undefined ? null : this.attrs[name]; }, focus(options) { this.focused.push(options); } }, extra);
		return input;
	};
	const makeContainer = (elements) => ({
		elements,
		contains(element) { return this.elements.includes(element); },
		querySelectorAll(selector) {
			const attribute = /^\[([a-z-]+)\]$/.exec(selector)[1];
			return this.elements.filter((element) => element.getAttribute(attribute) !== null);
		},
	});
	const caretInput = (attrs, start, end, direction = 'forward') => makeInput(attrs, { selectionStart: start, selectionEnd: end, selectionDirection: direction, setSelectionRange(a, b, c) { this.carets.push([a, b, c]); } });
	const setup = (active, containerDefs) => {
		const document = { activeElement: active, byId: {}, getElementById(id) { return this.byId[id] || null; } };
		const fields = {};
		Object.keys(containerDefs).forEach((key) => { fields[key] = makeContainer(containerDefs[key]); });
		const api = new Function('document', 'fields', names.map(extractPageFunction).join('\n') + '\nreturn { captureRelayFocus, restoreRelayFocus };')(document, fields);
		return { document, fields, api };
	};
	// A CLI path input without an id: found again by data-relay-cli-path, caret restored.
	{
		const before = caretInput({ 'data-relay-cli-path': 'codex-cli' }, 2, 5, 'backward');
		const { fields, api } = setup(before, { providerSettings: [before] });
		const focus = api.captureRelayFocus();
		assert.ok(focus && focus.attribute === 'data-relay-cli-path' && focus.value === 'codex-cli');
		const other = caretInput({ 'data-relay-cli-path': 'grok-cli' }, 0, 0);
		const after = caretInput({ 'data-relay-cli-path': 'codex-cli' }, 0, 0);
		fields.providerSettings.elements = [other, after];
		assert.strictEqual(api.restoreRelayFocus(focus), true);
		assert.deepStrictEqual(after.focused, [{ preventScroll: true }]);
		assert.deepStrictEqual(after.carets, [[2, 5, 'backward']]);
		assert.strictEqual(other.focused.length, 0);
	}
	// Token default, timeout and routing select live in other containers; selects have no caret.
	{
		const token = caretInput({ 'data-relay-token-default': 'chat' }, 1, 1);
		const timeout = caretInput({ 'data-relay-timeout': 'codex_chat_ms' }, 3, 3);
		const select = makeInput({ 'data-relay-job': 'images' });
		for (const [element, container] of [[token, 'relayTokenDefaults'], [timeout, 'relayRuntimeSettings'], [select, 'relayDefaultSettings']]) {
			const { fields, api } = setup(element, { [container]: [element] });
			const focus = api.captureRelayFocus();
			assert.ok(focus, container);
			const again = element === select ? makeInput(Object.assign({}, element.attrs)) : caretInput(Object.assign({}, element.attrs), 0, 0);
			fields[container].elements = [again];
			assert.strictEqual(api.restoreRelayFocus(focus), true, container);
			assert.strictEqual(again.focused.length, 1);
			if (element === select) assert.strictEqual(again.carets.length, 0, 'no caret for a select');
			else assert.deepStrictEqual(again.carets, [[element.selectionStart, element.selectionEnd, 'forward']]);
		}
	}
	// An id wins and is looked up with getElementById; number inputs whose caret access throws still get focus.
	{
		const numberInput = makeInput({}, { id: 'relayMaxConcurrent', setSelectionRange() { throw new Error('InvalidStateError'); } });
		Object.defineProperty(numberInput, 'selectionStart', { get() { throw new Error('InvalidStateError'); } });
		const { document, api } = setup(numberInput, { relayRuntimeSettings: [numberInput] });
		const focus = api.captureRelayFocus();
		assert.strictEqual(focus.id, 'relayMaxConcurrent');
		assert.strictEqual(focus.start, null);
		const again = makeInput({}, { id: 'relayMaxConcurrent' });
		document.byId.relayMaxConcurrent = again;
		assert.strictEqual(api.restoreRelayFocus(focus), true);
		assert.strictEqual(again.focused.length, 1);
	}
	// Nothing to restore: focus outside the provider forms, no identifying attribute, or an element that is gone.
	{
		const outside = makeInput({ 'data-relay-cli-path': 'x' });
		assert.strictEqual(setup(outside, { providerSettings: [] }).api.captureRelayFocus(), null);
		assert.strictEqual(setup(null, { providerSettings: [] }).api.captureRelayFocus(), null);
		const anonymous = makeInput({});
		assert.strictEqual(setup(anonymous, { providerSettings: [anonymous] }).api.captureRelayFocus(), null);
		const field = caretInput({ 'data-field-key': 'timeout:cli_probe_ms' }, 1, 1);
		const { fields, api } = setup(field, { relayRuntimeSettings: [field] });
		const focus = api.captureRelayFocus();
		assert.strictEqual(focus.attribute, 'data-field-key');
		fields.relayRuntimeSettings.elements = [];
		assert.strictEqual(api.restoreRelayFocus(focus), false);
		assert.strictEqual(api.restoreRelayFocus(null), false);
	}
}

// Sticky Save / Discard bar: shown only while the form differs from the last loaded settings; Discard restores them.
{
	const dirty = { relay: false, runtime: false, asr: false, music: false, upscale: false, image: false };
	const badge = () => ({ hidden: true });
	const badges = { providers: badge(), runtime: badge(), asr: badge(), music: badge(), upscale: badge(), image: badge() };
	const fields = { relaySaveBar: { hidden: true }, runtimeSaveBar: { hidden: true }, saveRelaySettings: { disabled: true }, saveRelayRuntimeSettings: { disabled: true }, saveAsrSettings: { disabled: true }, saveMusicAnalysisSettings: { disabled: true }, saveUpscaleSettings: { disabled: true }, saveImageSettings: { disabled: true } };
	const update = new Function('fields', 'navBadge', 'isFormDirty', extractPageFunction('updateSettingsDirtyState') + '\nreturn updateSettingsDirtyState;')(fields, (route) => badges[route] || null, (key) => dirty[key]);
	update();
	assert.ok(fields.relaySaveBar.hidden && fields.runtimeSaveBar.hidden, 'no bar while the forms are clean');
	assert.ok(fields.saveRelaySettings.disabled && badges.providers.hidden);
	dirty.relay = true;
	update();
	assert.strictEqual(fields.relaySaveBar.hidden, false, 'the Providers bar appears when its form is dirty');
	assert.strictEqual(fields.runtimeSaveBar.hidden, true, 'the Runtime bar is independent');
	assert.strictEqual(fields.saveRelaySettings.disabled, false);
	assert.strictEqual(badges.providers.hidden, false, 'the sidebar dot is on');
	dirty.runtime = true; dirty.relay = false;
	update();
	assert.ok(fields.relaySaveBar.hidden && !fields.runtimeSaveBar.hidden && fields.saveRelaySettings.disabled && !fields.saveRelayRuntimeSettings.disabled);
	dirty.runtime = false;
	update();
	assert.ok(fields.relaySaveBar.hidden && fields.runtimeSaveBar.hidden, 'the bar hides again once the form matches the loaded settings');
	// Other settings pages keep their own Save buttons and dots; they get no sticky bar.
	dirty.asr = true;
	update();
	assert.ok(fields.relaySaveBar.hidden && !fields.saveAsrSettings.disabled && !badges.asr.hidden);

	// Discard re-renders from the last loaded settings and re-baselines only its own section.
	const discardWith = (payload, calls = [], fields = { relaySettingsMessage: { textContent: 'Unsaved' }, relayRuntimeMessage: { textContent: 'Unsaved' } }) => new Function('fields', 'collectRelaySettingsPayload', 'renderRelaySettings', 'restoreRelaySection', 'captureFormSnapshots', 'payload', 'let lastRelaySettingsPayload = payload;\n' + extractPageFunction('discardRelaySection') + '\nreturn discardRelaySection;')(
		fields, (section) => { calls.push(['collect', section]); return { kept: section }; }, (value) => calls.push(['render', value]), (section, preserved) => calls.push(['restore', section, preserved]), (keys) => calls.push(['snapshot', keys]), payload);
	assert.strictEqual(discardWith(null)('relay'), false, 'nothing to restore before the first load');
	{
		const payload = { settings: { marker: 1 } };
		const calls = [];
		const fields = { relaySettingsMessage: { textContent: 'Unsaved' }, relayRuntimeMessage: { textContent: 'Unsaved' } };
		const discard = discardWith(payload, calls, fields);
		assert.strictEqual(discard('relay'), true);
		assert.deepStrictEqual(calls, [['collect', 'runtime'], ['render', payload], ['restore', 'runtime', { kept: 'runtime' }], ['snapshot', ['relay']]], 'the runtime edits survive a Providers discard, and only relay is re-baselined');
		assert.strictEqual(fields.relaySettingsMessage.textContent, 'Changes discarded');
		calls.length = 0;
		assert.strictEqual(discard('runtime'), true);
		assert.deepStrictEqual(calls, [['collect', 'relay'], ['render', payload], ['restore', 'relay', { kept: 'relay' }], ['snapshot', ['runtime']]]);
		assert.strictEqual(fields.relayRuntimeMessage.textContent, 'Changes discarded');
	}
	assert.ok(html.includes('id="relaySaveBar"') && html.includes('id="runtimeSaveBar"') && html.includes('id="discardRelaySettings"') && html.includes('id="discardRuntimeSettings"') && /id="relaySaveBar"[^>]* hidden>/.test(html) && /id="runtimeSaveBar"[^>]* hidden>/.test(html), 'both bars exist and start hidden');
	assert.ok(html.includes('position: sticky;') && /\.save-bar \{[^}]*position: sticky;[^}]*bottom:/.test(html), 'the bar is sticky at the bottom');
	assert.ok(/id="relaySettingsForm"[^>]*novalidate/.test(html) && html.indexOf('id="relaySaveBar"') > html.indexOf('id="relaySettingsForm"') && html.indexOf('id="relaySaveBar"') < html.indexOf('</form>', html.indexOf('id="relaySettingsForm"')), 'the Providers bar lives in the Providers form');
	// Refresh detection is a header action of the view, and the Routing card holds routing and token defaults.
	assert.ok(html.indexOf('id="refreshRelayProviders"') < html.indexOf('id="providerSettings"') && html.indexOf('id="providerSettings"') < html.indexOf('id="routingTitle"') && html.indexOf('id="routingTitle"') < html.indexOf('id="relayDefaultSettings"') && html.indexOf('id="relayDefaultSettings"') < html.indexOf('id="relayTokenDefaults"'));
	// Background reloads keep unsaved edits instead of re-rendering over them.
	assert.ok(html.includes('A background reload (capabilities event, detection refresh) must not wipe edits'));
}

// ---- Phase E: Tests segmented control, Live filters and detail, Debug view, reachability, event stream reconnect ----
{
	const script = inlineScript[1];
	const load = (names, params = [], prelude = '', args = [], returns) => new Function(...params, prelude + '\n' + names.map(extractPageFunction).join('\n\n') + '\nreturn ' + (returns || '{ ' + names.join(', ') + ' }') + ';')(...args);
	const makeEl = (attrs = {}) => ({ attrs: { ...attrs }, hidden: false, dataset: {}, getAttribute(name) { return this.attrs[name] === undefined ? null : this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = String(value); }, removeAttribute(name) { delete this.attrs[name]; } });

	// ---- Tests: accessible segmented control, keyboard arrows, hash mirroring, deep-link focus, counts ----
	{
		const tablist = /<div class="segmented provider-test-tabs" role="tablist" aria-label="Provider test types">([\s\S]*?)<\/p>/.exec(html);
		assert.ok(tablist, 'the test types are a segmented tablist');
		const tabs = Array.from(tablist[1].matchAll(/<button class="seg-button" type="button" role="tab" id="(provider-test-tab-[a-z]+)" data-provider-test-tab aria-controls="(provider-test-panel-[a-z]+)" aria-selected="(true|false)"([^>]*)>/g));
		assert.deepStrictEqual(tabs.map((tab) => tab[1].replace('provider-test-tab-', '')), ['chat', 'images', 'videos', 'analysis', 'audio'], 'Chat, Image, Video, Video analysis, Audio in this order');
		assert.deepStrictEqual(tabs.map((tab) => tab[3]), ['true', 'false', 'false', 'false', 'false'], 'one selected segment');
		assert.ok(tabs.slice(1).every((tab) => tab[4].includes('tabindex="-1"')) && !tabs[0][4].includes('tabindex'), 'roving tabindex: only the selected tab is in the tab order');
		for (const tab of tabs) assert.ok(new RegExp('id="' + tab[2] + '" role="tabpanel" aria-labelledby="' + tab[1] + '"').test(html), 'panel ' + tab[2] + ' is labelled by its tab');
		assert.ok(['Chat', 'Image', 'Video', 'Video analysis', 'Audio'].every((label) => tablist[1].includes('<span>' + label + '</span>')));
		assert.ok(tablist[1].includes('data-test-count="chat"') && tablist[1].includes('class="seg-count"'), 'segments can show how many tests they hold');
		assert.ok(html.includes('id="testFocusNotice"') && html.includes('role="status"'), 'a notice explains a deep link without a ready test');
		// The Chat tab opens with a prominent summary bar.
		const chatPanel = html.slice(html.indexOf('id="provider-test-panel-chat"'), html.indexOf('id="provider-test-panel-images"'));
		assert.ok(chatPanel.indexOf('id="chatSummaryBar"') < chatPanel.indexOf('id="providerChatTests"') && chatPanel.includes('class="btn-primary" id="runAllChatTests"') && chatPanel.includes('id="chatRunAllCounts"') && /id="chatRunAllProgress" role="progressbar"/.test(chatPanel), 'Run all, live summary, colored counts, and progress sit above the chat cards');
		const css = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
		for (const rule of ['.segmented {', '.seg-button[aria-selected="true"]', '.test-summary-bar {', '.count-chip.ok', '.count-chip.bad', '.provider-chat-reply {', 'button[hidden]']) assert.ok(css.includes(rule), rule + ' is styled');
		assert.ok(!css.includes('.tab-button') && !html.includes('class="tab-button"'), 'the old underline tabs are gone');
		const replyRule = /\.provider-chat-reply \{[^}]*max-height: (\d+)px/.exec(css);
		assert.ok(replyRule && Number(replyRule[1]) >= 360, 'the chat reply area is large');

		// Keyboard and click behavior of the control.
		const makeButton = (id) => Object.assign(makeEl({ 'aria-controls': 'provider-test-panel-' + id.replace('provider-test-tab-', '') }), { id, tabIndex: 0, focused: 0, listeners: {}, focus() { this.focused += 1; }, addEventListener(type, fn) { this.listeners[type] = fn; }, querySelector: () => null });
		const build = (route) => {
			const buttons = ['chat', 'images', 'videos', 'analysis', 'audio'].map((type) => makeButton('provider-test-tab-' + type));
			const panels = buttons.map((button) => ({ id: button.attrs['aria-controls'], hidden: false }));
			const notices = [];
			const hashes = [];
			const fields = { providerTestTabButtons: buttons, providerTestTabPanels: panels, testFocusNotice: { textContent: 'old', hidden: false } };
			const api = load(['testTypeIds', 'normalizeTestType', 'testTabIdForType', 'testTypeForTabId', 'hashForRoute', 'selectProviderTestTab', 'testPanelForType', 'showTestFocusNotice', 'initProviderTestTabs'], ['fields', 'setHash'], 'let currentRoute = ' + JSON.stringify(route) + '; let pendingTestFocus = { type: "images", providerId: "x" };', [fields, (hash) => hashes.push(hash)], '{ selectProviderTestTab, initProviderTestTabs, pending: () => pendingTestFocus }');
			return { buttons, panels, fields, hashes, api };
		};
		const selected = (env) => env.buttons.filter((button) => button.attrs['aria-selected'] === 'true').map((button) => button.id.replace('provider-test-tab-', ''));
		const visiblePanels = (env) => env.panels.filter((panel) => !panel.hidden).map((panel) => panel.id.replace('provider-test-panel-', ''));
		const env = build('tests');
		env.api.initProviderTestTabs();
		assert.deepStrictEqual(selected(env), ['chat']);
		assert.deepStrictEqual(visiblePanels(env), ['chat'], 'only the selected panel is visible');
		assert.deepStrictEqual(env.buttons.map((button) => button.tabIndex), [0, -1, -1, -1, -1]);
		assert.deepStrictEqual(env.hashes, [], 'the initial selection never rewrites the hash');
		const key = (index, name) => { let prevented = 0; env.buttons[index].listeners.keydown({ key: name, preventDefault() { prevented += 1; } }); assert.strictEqual(prevented, 1, name + ' is handled'); };
		key(0, 'ArrowRight');
		assert.deepStrictEqual(selected(env), ['images']);
		assert.strictEqual(env.buttons[1].focused, 1, 'arrow keys move focus with the selection');
		assert.deepStrictEqual(env.buttons.map((button) => button.tabIndex), [-1, 0, -1, -1, -1]);
		key(1, 'ArrowLeft');
		assert.deepStrictEqual(selected(env), ['chat']);
		key(0, 'ArrowLeft');
		assert.deepStrictEqual(selected(env), ['audio'], 'ArrowLeft wraps to the last segment');
		key(4, 'ArrowRight');
		assert.deepStrictEqual(selected(env), ['chat'], 'ArrowRight wraps to the first segment');
		key(0, 'End');
		assert.deepStrictEqual(selected(env), ['audio']);
		key(4, 'Home');
		assert.deepStrictEqual(selected(env), ['chat']);
		let ignored = 0;
		env.buttons[0].listeners.keydown({ key: 'a', preventDefault() { ignored += 1; } });
		assert.strictEqual(ignored, 0, 'other keys are left alone');
		assert.deepStrictEqual(env.hashes.slice(-1), ['tests/chat'], 'a manual choice is mirrored in the hash');
		env.buttons[2].listeners.click();
		assert.deepStrictEqual(selected(env), ['videos']);
		assert.deepStrictEqual(env.hashes.slice(-1), ['tests/videos']);
		assert.strictEqual(env.api.pending(), null, 'a manual choice drops a pending deep-link focus');
		assert.deepStrictEqual(env.fields.testFocusNotice, { textContent: '', hidden: true }, 'and clears the notice');
		const before = env.hashes.length;
		env.api.selectProviderTestTab('provider-test-tab-audio', { skipHash: true });
		assert.strictEqual(env.hashes.length, before, 'route-driven selection does not rewrite the hash');
		assert.deepStrictEqual(selected(env), ['audio']);
		env.api.selectProviderTestTab('provider-test-tab-bogus');
		assert.deepStrictEqual(selected(env), ['chat'], 'an unknown tab id falls back to the first segment');
		const away = build('overview');
		away.api.initProviderTestTabs();
		away.buttons[3].listeners.click();
		assert.deepStrictEqual(away.hashes, [], 'the hash is only mirrored while the Tests route is shown');

		// Deep link: highlight and scroll to the matching cards, or explain why there are none.
		const focusEnv = (route, pending, payload) => {
			const timers = [];
			const makeCard = (backend) => { const card = { backend, flags: new Set(), offsetWidth: 0, scrolled: 0, classList: { add: (name) => card.flags.add(name), remove: (name) => card.flags.delete(name) }, scrollIntoView(opts) { card.scrolled += 1; card.scrollOpts = opts; } }; return card; };
			const cards = { 'xai-api': [makeCard('xai-api'), makeCard('xai-api')], 'codex-cli': [makeCard('codex-cli')] };
			const images = { id: 'provider-test-panel-images', querySelectorAll: (selector) => { const match = /data-test-backend="([^"]*)"/.exec(selector); return match ? (cards[match[1]] || []) : []; } };
			const fields = { providerTestTabPanels: [images, { id: 'provider-test-panel-chat', querySelectorAll: () => [] }], testFocusNotice: { textContent: '', hidden: true } };
			const api = load(['testTypeIds', 'normalizeTestType', 'testTypeLabel', 'testPanelForType', 'showTestFocusNotice', 'applyTestFocus'], ['fields', 'CSS', 'setTimeout'], 'let currentRoute = ' + JSON.stringify(route) + '; let pendingTestFocus = ' + JSON.stringify(pending) + '; let lastRelaySettingsPayload = ' + JSON.stringify(payload) + ';', [fields, { escape: (value) => value }, (fn, ms) => timers.push([fn, ms])], '{ applyTestFocus, pending: () => pendingTestFocus }');
			return { api, fields, cards, timers };
		};
		{
			const found = focusEnv('tests', { type: 'images', providerId: 'xai-api' }, {});
			assert.strictEqual(found.api.applyTestFocus(), true);
			assert.ok(found.cards['xai-api'].every((card) => card.flags.has('is-highlighted')), 'every card of the provider is highlighted');
			assert.strictEqual(found.cards['xai-api'][0].scrolled, 1, 'the first card is scrolled into view');
			assert.strictEqual(found.cards['xai-api'][1].scrolled, 0);
			assert.strictEqual(found.cards['codex-cli'][0].flags.size, 0, 'other providers are untouched');
			assert.strictEqual(found.api.pending(), null);
			assert.deepStrictEqual(found.timers.map((timer) => timer[1]), [2600, 2600], 'the highlight fades by itself');
			found.timers[0][0]();
			assert.ok(!found.cards['xai-api'][0].flags.has('is-highlighted'));
			assert.strictEqual(found.fields.testFocusNotice.hidden, true);
		}
		{
			const waiting = focusEnv('tests', { type: 'images', providerId: 'missing' }, null);
			assert.strictEqual(waiting.api.applyTestFocus(), false);
			assert.deepStrictEqual(waiting.api.pending(), { type: 'images', providerId: 'missing' }, 'before settings load the focus waits for the render');
			assert.strictEqual(waiting.fields.testFocusNotice.hidden, true);
			const loaded = focusEnv('tests', { type: 'images', providerId: 'missing' }, { backends: [{ id: 'missing', label: 'Grok <CLI>' }] });
			assert.strictEqual(loaded.api.applyTestFocus(), false);
			assert.strictEqual(loaded.api.pending(), null, 'after settings load an absent provider is final');
			assert.strictEqual(loaded.fields.testFocusNotice.hidden, false);
			assert.strictEqual(loaded.fields.testFocusNotice.textContent, 'No ready image test is available for Grok <CLI>. Check that the provider is ready on the Providers page.', 'the notice names the provider (rendered with textContent)');
			const away = focusEnv('overview', { type: 'images', providerId: 'xai-api' }, {});
			assert.strictEqual(away.api.applyTestFocus(), false);
			assert.deepStrictEqual(away.api.pending(), { type: 'images', providerId: 'xai-api' }, 'other routes never consume the focus');
			assert.strictEqual(focusEnv('tests', null, {}).api.applyTestFocus(), false);
			assert.strictEqual(focusEnv('tests', { type: 'bogus', providerId: 'x' }, {}).api.applyTestFocus(), false, 'an unknown type has no panel');
		}
		// Counts on the segments follow the cards each panel holds.
		{
			const badge = () => ({ textContent: '0', hidden: true });
			const types = ['chat', 'images', 'videos', 'analysis', 'audio'];
			const counts = { chat: 3, images: 0, videos: 1, analysis: 0, audio: 2 };
			const buttons = types.map((type) => ({ id: 'provider-test-tab-' + type, badge: badge(), querySelector(selector) { return selector === '[data-test-count]' ? this.badge : null; } }));
			const panels = types.map((type) => ({ id: 'provider-test-panel-' + type, querySelectorAll: () => new Array(counts[type]).fill({}) }));
			const { updateProviderTestCounts } = load(['testTypeIds', 'normalizeTestType', 'testTypeForTabId', 'testPanelForType', 'updateProviderTestCounts'], ['fields'], '', [{ providerTestTabButtons: buttons, providerTestTabPanels: panels }]);
			updateProviderTestCounts();
			assert.deepStrictEqual(buttons.map((button) => [button.badge.textContent, button.badge.hidden]), [['3', false], ['0', true], ['1', false], ['0', true], ['2', false]]);
		}
		// Provider cards link to the matching test type AND provider: #tests/<type>/<backend id>.
		{
			const { providerMediaTestLinks } = load(['text', 'escapeHtml', 'providerTestTabTargets', 'providerMediaTestLinks']);
			const links = providerMediaTestLinks({ id: 'xai-api', job_types: ['chat', 'images', 'videos', 'transcribe', 'music.analyze'] });
			assert.strictEqual(links.length, 3, 'one link per test type (transcribe and music analysis share Audio)');
			assert.ok(links[0].includes('href="#tests/images/xai-api"') && links[0].includes('data-open-test-tab="provider-test-tab-images"') && links[0].includes('data-test-provider="xai-api"'));
			assert.ok(links[2].includes('href="#tests/audio/xai-api"') && links[2].includes('Open audio test'));
			assert.ok(providerMediaTestLinks({ id: 'a/b"c', job_types: ['images'] })[0].includes('href="#tests/images/a%2Fb%22c"'), 'the provider id is URL-encoded in the link');
			assert.ok(providerMediaTestLinks({ id: '"><x>', job_types: ['images'] })[0].includes('data-test-provider="&quot;&gt;&lt;x&gt;"') && !providerMediaTestLinks({ id: '"><x>', job_types: ['images'] })[0].includes('<x>'));
			assert.deepStrictEqual(providerMediaTestLinks({ id: 'q', job_types: ['chat'] }), []);
		}
		// The provider-card links and the click handler agree on the route.
		assert.ok(script.includes("navigateTo(hashForRoute({ route: 'tests', liveRequestId: '', providerId: openTestTab.getAttribute('data-test-provider') || '', testType: testTypeForTabId(openTestTab.getAttribute('data-open-test-tab')) }))"), 'the link click navigates to the Tests deep link');
		assert.ok(script.includes('data-test-backend="\' + escapeHtml(model.backend) + \'"'), 'test cards carry their backend id for the deep link');
	}

	// ---- Chat summary bar: live progress and colored counts ----
	{
		const makeFields = () => ({ chatRunAllSummary: { textContent: '' }, chatRunAllCounts: { innerHTML: '' }, chatSummaryBar: { dataset: {} }, chatRunAllProgress: { hidden: true, attrs: {}, firstElementChild: { style: {} }, setAttribute(name, value) { this.attrs[name] = value; } } });
		const fields = makeFields();
		const { renderChatRunAllSummary, chatRunAllCountChips } = load(['text', 'escapeHtml', 'chatRunAllCountChips', 'renderChatRunAllSummary'], ['fields'], '', [fields]);
		assert.strictEqual(chatRunAllCountChips({ passed: 3, failed: 0 }), '<span class="count-chip ok"><b>3</b> passed</span><span class="count-chip bad"><b>0</b> failed</span>', 'passed and failed are always listed');
		const all = chatRunAllCountChips({ passed: 1, failed: 2, noReply: 1, cancelled: 1, busy: 1, notRun: 4 });
		for (const piece of ['count-chip warn"><b>1</b> without reply', 'count-chip muted"><b>1</b> cancelled', 'count-chip muted"><b>1</b> skipped', 'count-chip muted"><b>4</b> not run']) assert.ok(all.includes(piece), piece);
		renderChatRunAllSummary('running', 'Running 2 of 5 · 1 passed / 0 failed', { passed: 1, failed: 0 }, 0.2);
		assert.strictEqual(fields.chatRunAllSummary.textContent, 'Running 2 of 5 · 1 passed / 0 failed', 'the live line says which test is running');
		assert.ok(fields.chatRunAllCounts.innerHTML.includes('<b>1</b> passed'));
		assert.strictEqual(fields.chatSummaryBar.dataset.state, 'running');
		assert.strictEqual(fields.chatRunAllProgress.hidden, false, 'the progress bar shows while running');
		assert.strictEqual(fields.chatRunAllProgress.attrs['aria-valuenow'], '20');
		assert.strictEqual(fields.chatRunAllProgress.firstElementChild.style.width, '20%');
		renderChatRunAllSummary('done', '4 passed / 1 failed', { passed: 4, failed: 1 }, 1);
		assert.strictEqual(fields.chatRunAllProgress.hidden, true, 'and hides when done');
		assert.deepStrictEqual(fields.chatSummaryBar.dataset, { state: 'done', outcome: 'bad' }, 'a failure colors the bar red');
		renderChatRunAllSummary('done', '5 passed / 0 failed', { passed: 5, failed: 0 }, 1);
		assert.strictEqual(fields.chatSummaryBar.dataset.outcome, 'ok');
		renderChatRunAllSummary('done', '4 passed / 0 failed · 1 without reply', { passed: 4, failed: 0, noReply: 1 }, 1);
		assert.strictEqual(fields.chatSummaryBar.dataset.outcome, 'warn');
		renderChatRunAllSummary('idle', 'Idle text', null, 0);
		assert.strictEqual(fields.chatRunAllCounts.innerHTML, '');
		assert.strictEqual(fields.chatSummaryBar.dataset.outcome, '');
		// Missing optional elements never throw (the page may be partially rendered).
		assert.doesNotThrow(() => load(['text', 'escapeHtml', 'chatRunAllCountChips', 'renderChatRunAllSummary'], ['fields'], '', [{ chatRunAllSummary: { textContent: '' } }]).renderChatRunAllSummary('running', 'x', { passed: 0 }, 2));
		// A hostile count can never become markup.
		assert.ok(!chatRunAllCountChips({ passed: '<img src=x>', failed: 0 }).includes('<img'));
	}

	// ---- Live: status pills, filters, type select, search, detail ----
	const liveHelpers = ['text', 'escapeHtml', 'elapsed', 'normalizeText', 'shortLiveRequestId', 'jobRequestId', 'formatArtifactBytes', 'artifactMetaLabel', 'statusClass', 'statusText', 'elapsedSpan', 'liveJobStatus', 'liveTypeLabel', 'liveJobMatchesFilter', 'liveJobMatchesType', 'liveJobMatchesSearch', 'liveJobVisible', 'liveFiltersActive', 'updateLiveTypeOptions', 'collectUnifiedJobs', 'updateLiveFilterCounts', 'liveMetaCard', 'liveJobCardMarkup', 'formatCharCount', 'sessionOutputBlock', 'liveErrorBlock'];
	const liveState = 'let liveFilter = "all"; let liveTypeFilter = "all"; let liveSearchQuery = ""; let liveTypeOptionsSignature = ""; const seenLiveRequestIds = new Set(); let liveOutputWrap = true; let liveAutoScroll = true; let livePinned = false; let selectedLiveRequestId = ""; const cancellingLiveImageRequests = new Set();';
	const liveSetter = '{ set: (state) => { if ("liveFilter" in state) liveFilter = state.liveFilter; if ("liveTypeFilter" in state) liveTypeFilter = state.liveTypeFilter; if ("liveSearchQuery" in state) liveSearchQuery = state.liveSearchQuery; if ("liveOutputWrap" in state) liveOutputWrap = state.liveOutputWrap; if ("liveAutoScroll" in state) liveAutoScroll = state.liveAutoScroll; if ("livePinned" in state) livePinned = state.livePinned; if ("selectedLiveRequestId" in state) selectedLiveRequestId = state.selectedLiveRequestId; }';
	const jobs = [
		{ request_id: 'r-run', short_request_id: 'r-run', type: 'chat', model: 'claude-sonnet', provider: 'anthropic-api', provider_label: 'Claude API', status: 'running' },
		{ request_id: 'r-cancelling', type: 'images', model: 'flux', provider: 'local-image', provider_label: 'Local Image', status: 'cancelling' },
		{ request_id: 'r-queued', type: 'images', model: 'flux', provider: 'local-image', provider_label: 'Local Image', status: 'queued' },
		{ request_id: 'r-pending', type: 'job', status: 'pending' },
		{ request_id: 'r-done', type: 'chat', model: 'grok-4', provider: 'xai-api', provider_label: 'Grok / xAI API', status: 'completed' },
		{ request_id: 'r-failed', type: 'videos', model: 'xai-video', provider: 'xai-api', provider_label: 'Grok / xAI API', status: 'failed' },
		{ request_id: 'r-cancelled', type: 'media_analysis', model: 'gemini', provider: 'antigravity-cli', provider_label: 'Antigravity CLI', status: 'cancelled' },
	];
	{
		const live = load(liveHelpers, ['fields', 'document'], liveState, [{}, {}], '{ ' + liveHelpers.join(', ') + ', ' + liveSetter.slice(2) + ' }');
		// Status pills: one distinct look per state; cancelled is no longer the same as failed.
		assert.strictEqual(live.statusClass('running'), 'status-running');
		assert.strictEqual(live.statusClass('queued'), 'status-queued');
		assert.strictEqual(live.statusClass('completed'), 'status-completed');
		assert.strictEqual(live.statusClass('failed'), 'status-failed');
		assert.strictEqual(live.statusClass('cancelled'), 'status-cancelled');
		assert.strictEqual(live.statusClass('Cancelled'), 'status-cancelled');
		assert.ok(live.statusText('cancelled').includes('live-status-pill status-cancelled') && live.statusText('failed').includes('status-failed'));
		assert.ok(!live.statusText('<img src=x>').includes('<img'), 'status text is escaped');
		const css = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
		for (const state of ['running', 'queued', 'completed', 'failed', 'cancelled']) assert.ok(css.includes('.live-status-pill.status-' + state), 'pill style for ' + state);

		// Status filter chips.
		const visible = () => jobs.filter((job) => live.liveJobVisible(job)).map((job) => job.request_id);
		assert.strictEqual(visible().length, jobs.length, 'All shows everything');
		assert.ok(!live.liveFiltersActive());
		const expectFilter = (filter, ids) => { live.set({ liveFilter: filter }); assert.deepStrictEqual(visible(), ids, filter); };
		expectFilter('running', ['r-run', 'r-cancelling']);
		expectFilter('queued', ['r-queued', 'r-pending']);
		expectFilter('completed', ['r-done']);
		expectFilter('failed', ['r-failed']);
		expectFilter('cancelled', ['r-cancelled']);
		assert.ok(live.liveFiltersActive());
		expectFilter('bogus-filter', jobs.map((job) => job.request_id));
		live.set({ liveFilter: 'all' });
		// Type filter.
		live.set({ liveTypeFilter: 'images' });
		assert.deepStrictEqual(visible(), ['r-cancelling', 'r-queued']);
		live.set({ liveTypeFilter: 'chat', liveFilter: 'completed' });
		assert.deepStrictEqual(visible(), ['r-done'], 'status and type filters combine');
		live.set({ liveTypeFilter: 'all', liveFilter: 'all' });
		// Search: id, model, provider label and id, type label, status.
		const search = (query) => { live.set({ liveSearchQuery: query }); return visible(); };
		assert.deepStrictEqual(search('GROK'), ['r-done', 'r-failed'], 'case-insensitive provider label match');
		assert.deepStrictEqual(search('antigravity-cli'), ['r-cancelled'], 'provider id');
		assert.deepStrictEqual(search('flux'), ['r-cancelling', 'r-queued'], 'model');
		assert.deepStrictEqual(search('video analysis'), ['r-cancelled'], 'friendly type label');
		assert.deepStrictEqual(search('r-fail'), ['r-failed'], 'request id');
		assert.deepStrictEqual(search('  cancelled '), ['r-cancelled'], 'status, trimmed');
		assert.deepStrictEqual(search('nothing-matches'), []);
		live.set({ liveTypeFilter: 'images', liveFilter: 'queued', liveSearchQuery: 'flux' });
		assert.deepStrictEqual(visible(), ['r-queued'], 'status + type + search together');
		live.set({ liveTypeFilter: 'all', liveFilter: 'all', liveSearchQuery: '' });

		// Type select: only existing types, friendly (escaped) labels, the chosen type stays selectable, no needless rewrites.
		const select = { writes: 0, html: '', value: '', set innerHTML(value) { this.writes += 1; this.html = value; }, get innerHTML() { return this.html; } };
		const selectApi = load(['text', 'escapeHtml', 'liveTypeLabel', 'updateLiveTypeOptions'], ['fields'], liveState, [{ liveTypeFilter: select }], '{ updateLiveTypeOptions, set: (value) => { liveTypeFilter = value; } }');
		selectApi.updateLiveTypeOptions(jobs);
		assert.ok(select.html.startsWith('<option value="all">All types</option>'));
		for (const piece of ['<option value="chat">Chat</option>', '<option value="images">Image</option>', '<option value="videos">Video</option>', '<option value="media_analysis">Video analysis</option>', '<option value="job">Job</option>']) assert.ok(select.html.includes(piece), piece);
		assert.strictEqual(select.writes, 1);
		selectApi.updateLiveTypeOptions(jobs);
		assert.strictEqual(select.writes, 1, 'an unchanged type set does not rebuild the select');
		selectApi.set('upscale');
		selectApi.updateLiveTypeOptions(jobs);
		assert.ok(select.html.includes('<option value="upscale">Upscale</option>') && select.value === 'upscale', 'the active type stays listed even without jobs');
		selectApi.updateLiveTypeOptions([{ type: '<b>x</b>' }]);
		assert.ok(select.html.includes('value="&lt;b&gt;x&lt;/b&gt;"') && !select.html.includes('<b>'), 'job types are escaped');

		// Counts on the chips.
		const badges = ['all', 'running', 'queued', 'completed', 'failed', 'cancelled'].map((key) => Object.assign(makeEl({ 'data-live-filter-count': key }), { textContent: '' }));
		const countApi = load(['text', 'jobRequestId', 'collectUnifiedJobs', 'liveJobStatus', 'updateLiveFilterCounts'], ['document'], 'const seenLiveRequestIds = new Set();', [{ querySelectorAll: () => badges }]);
		countApi.updateLiveFilterCounts({ active: [jobs[0], jobs[1]], queued: [jobs[2], jobs[3]], recent: [jobs[4], jobs[5], jobs[6]] });
		assert.deepStrictEqual(badges.map((badge) => badge.textContent), ['7', '2', '2', '1', '1', '1'], 'cancelling counts as running, pending as queued, cancelled apart from failed');

		// List rows are escaped and show provider, model, type and elapsed.
		const row = live.liveJobCardMarkup({ request_id: 'x1', short_request_id: '<s>1', type: 'chat', model: '"><m>', provider: 'p', provider_label: '<i>Prov</i>', status: 'running', elapsed_ms: 65000 }, 'x1');
		assert.ok(row.includes('&lt;s&gt;1') && row.includes('&lt;i&gt;Prov&lt;/i&gt;') && row.includes('&quot;&gt;&lt;m&gt;') && !/<(s|i|m)>/.test(row), 'job fields are escaped');
		assert.ok(row.includes('class="live-job-tag">Chat<') && row.includes('live-status-pill status-running') && row.includes('data-live-elapsed="true"') && row.includes('1m 5s'), 'type label, status pill, and a ticking elapsed time');
		assert.ok(live.liveJobCardMarkup({ request_id: 'x2', status: 'completed', elapsed_ms: 4000 }, 'x2').includes('data-live-elapsed="false"'), 'finished jobs do not tick');
		assert.ok(live.liveJobCardMarkup({ request_id: 'x2', status: 'queued' }, 'x2').includes('Waiting for job'), 'a job without a model says it is waiting');

		// Session output / error blocks.
		const block = live.sessionOutputBlock('Live <Session> Output', { live: true, key: 'detail:"x":output' });
		assert.ok(block.includes('Live &lt;Session&gt; Output') && block.includes('data-session-key="detail:&quot;x&quot;:output"') && block.includes('class="session-output live-session-output"') && block.includes('is-live') && block.includes('class="copy-session-output"') && block.includes('data-session-size'), 'label and key escaped; live blocks follow the output; Copy and size are present');
		assert.ok(!live.sessionOutputBlock('stdin', { key: 'k' }).includes('live-session-output'), 'finished blocks do not auto-follow');
		assert.strictEqual(live.formatCharCount(0), '0 chars');
		assert.strictEqual(live.formatCharCount(1), '1 char');
		assert.strictEqual(live.formatCharCount(1234), '1.2k chars');
		assert.strictEqual(live.formatCharCount(25000), '25k chars');
		const error = live.liveErrorBlock({ error_message: '<script>alert(1)</script>\nsecond "line"' }, 'failed');
		assert.ok(error.includes('role="alert"') && error.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && error.includes('second &quot;line&quot;') && !error.includes('<script>') && error.includes('class="copy-session-output"'), 'error details are escaped and copyable');
		assert.ok(error.includes('>Error<'));
		assert.ok(live.liveErrorBlock({}, 'failed').includes('The job failed without an error message.'), 'a failed job always explains itself');
		assert.strictEqual(live.liveErrorBlock({}, 'completed'), '');
		assert.strictEqual(live.liveErrorBlock({}, 'cancelled'), '', 'cancelled without a message shows nothing');
		assert.ok(live.liveErrorBlock({ error_message: 'by user' }, 'cancelled').includes('>Cancelled<'));
	}

	// ---- Live: detail panel rendering (escaping, toggles, auto-scroll) ----
	{
		const detailFns = liveHelpers.concat(['artifactPreviewBlock', 'providerSessionLabel', 'debugLogBlocks', 'updateDebugLogBlocks', 'updateSessionOutput', 'applyLiveViewOptions', 'followLiveOutputs', 'renderLiveDetail']);
		const build = (state = {}) => {
			const outputs = new Map();
			const makeOutput = (key) => { const output = { key, dataset: { sessionKey: key }, textContent: '', scrollTop: 0, scrollHeight: 500, appended: [], appendChild(node) { this.appended.push(node); this.textContent += node.data; }, closest: () => ({ querySelector: () => ({ textContent: '' }) }) }; outputs.set(key, output); return output; };
			const ensure = (key) => outputs.get(key) || makeOutput(key);
			// The stub body creates a <pre> for every data-session-key in the markup it was given.
			const keys = (pattern) => Array.from(body.innerHTML.matchAll(pattern)).map((match) => unescapeAttr(match[1]));
			const body = { dataset: {}, innerHTML: '', flags: new Set(), classList: { toggle(name, on) { if (on) body.flags.add(name); else body.flags.delete(name); } },
				querySelector(selector) { const match = /data-session-key="([^"]+)"/.exec(selector); return match && keys(/data-session-key="([^"]*)"/g).includes(match[1]) ? ensure(match[1]) : null; },
				querySelectorAll(selector) { if (selector === '.session-output') return keys(/data-session-key="([^"]*)"/g).map(ensure); if (selector === '.live-session-output') return keys(/live-session-output" data-session-key="([^"]*)"/g).map(ensure); return []; } };
			const fields = { liveDetailEmpty: { hidden: false }, liveDetailContent: { hidden: true }, liveDetailBody: body, liveDetailTitle: { textContent: '' }, liveDetailStatus: { innerHTML: '' }, liveDetailSubtitle: { textContent: '' }, liveDetailCopyId: { dataset: {} }, liveDetailCancel: Object.assign(makeEl(), { hidden: true, disabled: false, textContent: '' }), liveFollowToggle: Object.assign(makeEl(), { hidden: true }), liveWrapToggle: makeEl() };
			const api = load(detailFns, ['fields', 'document', 'CSS'], liveState, [fields, { createTextNode: (data) => ({ data }), querySelectorAll: () => [] }, { escape: (value) => value }], '{ renderLiveDetail, applyLiveViewOptions, followLiveOutputs, ' + liveSetter.slice(2) + ' }');
			if (Object.keys(state).length) api.set(state);
			return { api, fields, body, outputs };
		};
		// Failed job: error panel first, hostile text escaped everywhere, no follow toggle for a finished job.
		{
			const env = build();
			const hostile = '<img src=x onerror=alert(1)>';
			env.api.renderLiveDetail({ request_id: 'req-' + hostile, short_request_id: 'req-<b>', type: 'videos', model: hostile, provider: 'xai-api', provider_label: hostile, status: 'failed', error_message: 'HTTP 429 ' + hostile, started_at: 1700000000000, finished_at: 1700000030000, elapsed_ms: 30000, session_input: 'prompt ' + hostile, session_output: 'out ' + hostile, debug_logs: [{ prompt: 'p ' + hostile, output: 'o ' + hostile }], artifacts: [{ url: '/v1/status/jobs/1/artifacts/0', mime_type: 'image/png', width: 64, height: 32, size_bytes: 2048 }, { url: 'javascript:alert(1)', mime_type: 'image/png' }] });
			const markup = env.body.innerHTML;
			assert.ok(!/<img src=x/.test(markup) && !markup.includes('onerror=alert(1)>') || !/<img src=x onerror/.test(markup), 'no hostile element is created');
			assert.ok(!markup.includes(hostile), 'the raw hostile string never reaches the markup');
			assert.ok(markup.indexOf('live-error') < markup.indexOf('live-detail-meta') && markup.includes('HTTP 429 &lt;img src=x onerror=alert(1)&gt;'), 'the error is shown first, escaped');
			assert.ok(markup.includes('live-detail-meta') && markup.includes('>Provider<') && markup.includes('>Started<') && markup.includes('>Finished<'), 'meta cards include provider, start and finish');
			assert.strictEqual((markup.match(/class="live-artifact-card"/g) || []).length, 1, 'only well-formed artifact URLs are previewed');
			assert.ok(markup.includes('data-media-preview="/v1/status/jobs/1/artifacts/0"') && markup.includes('class="live-artifact-download"') && markup.includes('64 × 32'), 'artifact preview with download and size');
			assert.ok(!markup.includes('javascript:'));
			assert.strictEqual((markup.match(/class="session-output-block/g) || []).length, 5, 'error, stdin, session output, debug prompt, debug response');
			assert.strictEqual(env.fields.liveDetailTitle.textContent, 'req-<b>', 'titles use textContent');
			assert.ok(env.fields.liveDetailStatus.innerHTML.includes('status-failed'));
			assert.strictEqual(env.fields.liveFollowToggle.hidden, true, 'no auto-scroll toggle for a finished job');
			// Session text goes in as text, never as markup.
			const out = env.outputs.get('detail:req-' + hostile + ':output');
			assert.ok(out && out.textContent === 'out ' + hostile && out.appended.length === 1 && out.appended[0].data === 'out ' + hostile, 'session output is appended as a text node');
			assert.strictEqual(env.outputs.get('detail:req-' + hostile + ':input').textContent, 'prompt ' + hostile);
			assert.strictEqual(env.outputs.get('detail:req-' + hostile + ':prompt:0').textContent, 'p ' + hostile);
			assert.strictEqual(env.outputs.get('detail:req-' + hostile + ':output:0').textContent, 'o ' + hostile);
			assert.strictEqual(env.fields.liveDetailCancel.hidden, true);
		}
		// Running job: follow toggle, auto-scroll on update, wrap toggle.
		{
			const env = build();
			const running = { request_id: 'r1', type: 'chat', model: 'm', provider: 'p', status: 'running', elapsed_ms: 1000, session_output: 'first' };
			env.api.renderLiveDetail(running);
			assert.strictEqual(env.fields.liveFollowToggle.hidden, false, 'the auto-scroll toggle appears while the job runs');
			assert.strictEqual(env.fields.liveFollowToggle.attrs['aria-pressed'], 'true');
			assert.strictEqual(env.fields.liveWrapToggle.attrs['aria-pressed'], 'true');
			assert.ok(!env.body.flags.has('nowrap'));
			const output = env.outputs.get('detail:r1:output');
			assert.strictEqual(output.scrollTop, 500, 'the newest output is scrolled into view');
			output.scrollTop = 10; output.scrollHeight = 900;
			env.api.renderLiveDetail({ ...running, session_output: 'first and more' });
			assert.strictEqual(output.textContent, 'first and more', 'streamed output is appended');
			assert.strictEqual(output.appended.length, 2, 'only the new part is appended');
			assert.strictEqual(output.scrollTop, 900, 'auto-scroll follows streamed output');
			// Auto-scroll off: the reader keeps their position.
			env.api.set({ liveAutoScroll: false });
			env.api.applyLiveViewOptions();
			assert.strictEqual(env.fields.liveFollowToggle.attrs['aria-pressed'], 'false');
			output.scrollTop = 20; output.scrollHeight = 1200;
			env.api.renderLiveDetail({ ...running, session_output: 'first and more and even more' });
			assert.strictEqual(output.scrollTop, 20, 'no auto-scroll when the toggle is off');
			// Wrap off: the detail body switches to horizontal scrolling.
			env.api.set({ liveOutputWrap: false });
			env.api.applyLiveViewOptions();
			assert.ok(env.body.flags.has('nowrap'));
			assert.strictEqual(env.fields.liveWrapToggle.attrs['aria-pressed'], 'false');
			env.api.set({ liveOutputWrap: true });
			env.api.applyLiveViewOptions();
			assert.ok(!env.body.flags.has('nowrap'));
			// Switching to a finished state hides the toggle again.
			env.api.renderLiveDetail({ ...running, status: 'completed', finished_at: 1700000000000 });
			assert.strictEqual(env.fields.liveFollowToggle.hidden, true);
		}
		// Local image jobs can be cancelled; other jobs cannot. An unknown job shows the placeholder note.
		{
			const env = build();
			env.api.renderLiveDetail({ request_id: 'img', type: 'images', provider: 'local-image', status: 'running' });
			assert.strictEqual(env.fields.liveDetailCancel.hidden, false);
			env.api.renderLiveDetail({ request_id: 'chat', type: 'chat', provider: 'p', status: 'running' });
			assert.strictEqual(env.fields.liveDetailCancel.hidden, true);
			env.api.renderLiveDetail({ request_id: 'later', type: 'job', status: 'pending', _pending: true });
			assert.ok(env.body.innerHTML.includes('Waiting for this job to appear in live updates.'));
			env.api.renderLiveDetail({ request_id: 'gone', type: 'job', status: 'expired', _pending: true, _expired: true });
			assert.ok(env.body.innerHTML.includes('no longer in the 15-minute live retention window'));
			env.api.renderLiveDetail(null);
			assert.strictEqual(env.fields.liveDetailEmpty.hidden, false);
			assert.strictEqual(env.fields.liveDetailContent.hidden, true);
			assert.strictEqual(env.body.innerHTML, '');
		}
		// Selecting nothing (a filter or search with no results) and then the same job again rebuilds the whole detail: the empty
		// body must not be mistaken for the unchanged one.
		{
			const env = build();
			const job = { request_id: 'req-1', short_request_id: 'req-1', type: 'chat', model: 'm', provider: 'codex-cli', status: 'completed', session_output: 'hello world', error_message: '', elapsed_ms: 1000, finished_at: 1700000000000, artifacts: [{ url: '/v1/status/jobs/1/artifacts/0', mime_type: 'image/png', width: 64, height: 32, size_bytes: 2048 }] };
			const stable = (markup) => markup.replace(/data-elapsed-captured="\d+"/g, '');
			env.api.renderLiveDetail(job);
			const first = env.body.innerHTML;
			assert.ok(first.includes('live-detail-meta') && first.includes('Session Output') && first.includes('/v1/status/jobs/1/artifacts/0'), 'the first render builds meta, session output and artifacts');
			env.api.renderLiveDetail(null);
			assert.strictEqual(env.body.innerHTML, '');
			assert.strictEqual(env.body.dataset.detailSignature, undefined, 'the empty body forgets what it showed');
			env.api.renderLiveDetail(job);
			assert.strictEqual(stable(env.body.innerHTML), stable(first), 're-selecting the same job after an empty selection restores meta, session output and artifacts');
			// Unchanged data still skips the rebuild (the body keeps its DOM, scroll positions and open sections).
			env.body.innerHTML = first + '<!-- marker -->';
			env.api.renderLiveDetail(job);
			assert.ok(env.body.innerHTML.endsWith('<!-- marker -->'), 'an identical job does not rebuild the body');
			// Same again for a failed job and for a different job in between.
			const failed = { request_id: 'req-2', type: 'chat', model: 'm', provider: 'codex-cli', status: 'failed', error_message: 'HTTP 500 upstream', elapsed_ms: 5, finished_at: 1700000001000 };
			env.api.renderLiveDetail(failed);
			const failedHtml = env.body.innerHTML;
			assert.ok(failedHtml.includes('HTTP 500 upstream'));
			env.api.renderLiveDetail(null);
			env.api.renderLiveDetail(failed);
			assert.strictEqual(stable(env.body.innerHTML), stable(failedHtml), 'the error block is back');
		}
		// The page keeps the Live behaviors the redesign must not lose.
		for (const keep of ['function selectLiveJob(requestId, options = {})', "setHash('live/' + encodeURIComponent(selectedLiveRequestId))", 'data-open-live-job', 'data-open-live', "const eventsUrl = isLocalStatusPage() ? jobEventsUrl : '/v1/status/stream';", 'new window.EventSource(eventsUrl)', 'function openMediaLightbox(url, mimeType)', 'pendingLiveJob(selectedLiveRequestId)']) assert.ok(script.includes(keep), keep);
		for (const markup of ['id="liveTypeFilter"', 'data-live-filter="cancelled"', 'id="liveWrapToggle"', 'id="liveFollowToggle"', 'aria-pressed="true" title="Wrap long lines', 'id="liveJobSearch"', 'role="toolbar" aria-label="Job filters"']) assert.ok(html.includes(markup), markup);
	}

	// ---- Live: selection follows the filters, filter reset ----
	{
		const names = ['text', 'jobRequestId', 'collectUnifiedJobs', 'liveJobStatus', 'liveTypeLabel', 'liveJobMatchesFilter', 'liveJobMatchesType', 'liveJobMatchesSearch', 'liveJobVisible', 'findJobByRequestId', 'pendingLiveJob', 'shortLiveRequestId', 'autoSelectLiveJob', 'refreshLiveView', 'setLiveFilter', 'clearLiveFilters'];
		const state = { details: [], lists: 0 };
		const filterButtons = ['all', 'running', 'queued', 'completed', 'failed', 'cancelled'].map((key) => makeEl({ 'data-live-filter': key, 'aria-pressed': key === 'all' ? 'true' : 'false' }));
		const search = { value: 'zzz' };
		const type = { value: 'images' };
		const api = load(names, ['fields', 'document', 'currentStatus', 'renderLiveJobList', 'renderLiveDetail'], liveState + ' liveSearchQuery = "zzz"; liveTypeFilter = "images"; liveFilter = "failed";', [{ liveJobSearch: search, liveTypeFilter: type }, { querySelectorAll: () => filterButtons }, { jobs: {} }, () => { state.lists += 1; }, (job) => state.details.push(job && job.request_id || null)], '{ autoSelectLiveJob, refreshLiveView, clearLiveFilters, selected: () => selectedLiveRequestId, filters: () => [liveFilter, liveTypeFilter, liveSearchQuery] }');
		const jobsSnapshot = { active: [{ request_id: 'a-img', type: 'images', status: 'running' }, { request_id: 'a-chat', type: 'chat', status: 'running' }], queued: [{ request_id: 'q-chat', type: 'chat', status: 'queued' }], recent: [{ request_id: 'f-vid', type: 'videos', status: 'failed' }] };
		api.clearLiveFilters();
		assert.deepStrictEqual(api.filters(), ['all', 'all', ''], 'Clear filters resets status, type and search');
		assert.strictEqual(search.value, '');
		assert.strictEqual(type.value, 'all');
		assert.deepStrictEqual(filterButtons.map((button) => button.attrs['aria-pressed']), ['true', 'false', 'false', 'false', 'false', 'false']);
		assert.ok(state.lists >= 1, 'the list is re-rendered');
	}
	{
		const names = ['text', 'jobRequestId', 'collectUnifiedJobs', 'liveJobStatus', 'liveTypeLabel', 'liveJobMatchesFilter', 'liveJobMatchesType', 'liveJobMatchesSearch', 'liveJobVisible', 'findJobByRequestId', 'pendingLiveJob', 'shortLiveRequestId', 'autoSelectLiveJob'];
		const details = [];
		const api = load(names, ['currentStatus', 'renderLiveJobList', 'renderLiveDetail'], liveState, [{ jobs: {} }, () => {}, (job) => details.push(job && job.request_id || null)], '{ autoSelectLiveJob, selected: () => selectedLiveRequestId, ' + liveSetter.slice(2) + ' }');
		const snapshot = { active: [{ request_id: 'a-img', type: 'images', status: 'running' }, { request_id: 'a-chat', type: 'chat', status: 'running' }], queued: [{ request_id: 'q-chat', type: 'chat', status: 'queued' }], recent: [{ request_id: 'f-vid', type: 'videos', status: 'failed' }] };
		api.autoSelectLiveJob(snapshot);
		assert.strictEqual(api.selected(), 'a-img', 'a running job is selected first');
		api.set({ liveTypeFilter: 'chat' });
		api.autoSelectLiveJob(snapshot);
		assert.strictEqual(api.selected(), 'a-chat', 'the selection respects the type filter');
		api.set({ liveFilter: 'queued' });
		api.autoSelectLiveJob(snapshot);
		assert.strictEqual(api.selected(), 'q-chat', 'queued jobs are next');
		api.set({ liveFilter: 'failed', liveTypeFilter: 'all' });
		api.autoSelectLiveJob(snapshot);
		assert.strictEqual(api.selected(), 'f-vid', 'finished jobs are selected when nothing active matches');
		api.set({ liveSearchQuery: 'nothing' });
		api.autoSelectLiveJob(snapshot);
		assert.strictEqual(api.selected(), '', 'no match selects nothing');
		assert.strictEqual(details[details.length - 1], null, 'and the detail panel shows its empty state');
		api.set({ liveFilter: 'all', liveSearchQuery: '', livePinned: true, selectedLiveRequestId: 'f-vid' });
		api.autoSelectLiveJob(snapshot);
		assert.strictEqual(details[details.length - 1], 'f-vid', 'a pinned (deep-linked or clicked) job stays selected whatever the filters say');
	}

	// ---- Debug: raw JSON collapsed by default with filter and copy; health summary; failures ----
	{
		const rawDetails = /<details class="card disclosure" id="rawStatusDetails">([\s\S]*?)<\/details>/.exec(html);
		assert.ok(rawDetails, 'raw status is a disclosure without the open attribute');
		assert.ok(!/id="rawStatusDetails"[^>]* open/.test(html), 'collapsed by default');
		assert.ok(rawDetails[1].includes('id="rawStatusFilter"') && rawDetails[1].includes('id="copyRawStatus"') && rawDetails[1].includes('id="rawStatus"'), 'filter, copy button and JSON live inside the collapsed section');
		assert.ok(html.indexOf('id="debugHealthList"') < html.indexOf('id="debugFailureList"') && html.indexOf('id="debugFailureList"') < html.indexOf('id="detectedFeatures"') && html.indexOf('id="detectedFeatures"') < html.indexOf('id="rawStatusDetails"'), 'order: health, failures, details cards, raw JSON');
		for (const id of ['debugHealthSummary', 'debugHealthOverall', 'detectedFeatures', 'backendDrivers', 'pairedSites', 'codexDetails']) assert.strictEqual((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id);
		assert.ok(html.includes('class="debug-grid"') && html.includes('class="driver-list" id="backendDrivers"'), 'features, drivers, paired sites and Codex details are cards in a grid');

		const rawStatus = { textContent: '', innerHTML: '' };
		const details = { open: false };
		const apply = load(['text', 'escapeHtml', 'escapeRegExp', 'applyRawStatusFilter'], ['fields', 'currentStatus'], '', [{ rawStatus, rawStatusFilter: { value: '' }, rawStatusDetails: details }, { a: 'x', nested: { b: '<i>' } }], 'applyRawStatusFilter');
		apply();
		assert.strictEqual(rawStatus.textContent, '', 'nothing is rendered while the disclosure is closed');
		details.open = true;
		apply();
		assert.ok(rawStatus.textContent.includes('"nested"') && rawStatus.textContent.includes('"<i>"'), 'opening renders the JSON');
		const filtered = load(['text', 'escapeHtml', 'escapeRegExp', 'applyRawStatusFilter'], ['fields', 'currentStatus'], '', [{ rawStatus, rawStatusFilter: { value: 'nested' }, rawStatusDetails: details }, { a: 'x', nested: { b: '<i>' } }], 'applyRawStatusFilter');
		filtered();
		assert.ok(rawStatus.innerHTML.includes('<mark>nested</mark>') && rawStatus.innerHTML.includes('&lt;i&gt;'), 'the filter highlights matches and stays escaped');
		assert.ok(script.includes("fields.rawStatusDetails.addEventListener('toggle', applyRawStatusFilter)"), 'opening the disclosure renders the JSON');
		assert.ok(script.includes("button === fields.copyRawStatus ? fields.rawStatus"), 'the copy button copies the JSON text');
	}
	{
		const build = (payload, ok) => {
			const fields = { debugHealthSummary: { innerHTML: '' }, debugHealthOverall: makeEl(), debugHealthList: { innerHTML: '' } };
			const pills = [];
			const api = load(['text', 'escapeHtml', 'jobRequestId', 'isCodexChecking', 'backendStatusInfo', 'providerStatusPill', 'debugHealthChecks', 'debugHealthSummary', 'renderDebugHealth'], ['fields', 'currentCapabilities', 'setPill'], '', [fields, {}, (element, state, label) => pills.push([state, label])], 'renderDebugHealth');
			api(payload, ok);
			return { fields, pills };
		};
		const healthy = { success: true, bridge: { paired_origins: ['https://a.test'] }, jobs: { queued_count: 0, recent: [] }, asr: { ready: true } };
		let env = build(healthy, true);
		assert.deepStrictEqual(env.pills, [['ok', 'All checks passed']]);
		assert.ok(env.fields.debugHealthSummary.innerHTML.includes('<b>6</b> passing') && !env.fields.debugHealthSummary.innerHTML.includes('warning'), 'the summary counts the checks');
		assert.strictEqual((env.fields.debugHealthList.innerHTML.match(/class="debug-health-item ok"/g) || []).length, 6);
		assert.ok(env.fields.debugHealthList.innerHTML.includes('pill ok') && env.fields.debugHealthList.innerHTML.includes('>OK<'), 'state is a labeled pill, not color only');
		// The 503 while Codex is still being checked: Relay reachable, Codex checking (not a failure).
		env = build({ ...healthy, success: false, checking: true, message: 'Checking local model providers in background.', details: { checking: true } }, true);
		assert.deepStrictEqual(env.pills, [['checking', 'Checking…']]);
		assert.ok(env.fields.debugHealthList.innerHTML.includes('Codex CLI is still being checked.') && env.fields.debugHealthList.innerHTML.includes('class="debug-health-item checking"') && env.fields.debugHealthList.innerHTML.includes('Relay reachable'));
		assert.ok(env.fields.debugHealthSummary.innerHTML.includes('<b>5</b> passing') && env.fields.debugHealthSummary.innerHTML.includes('<b>1</b> checking'));
		// A real Codex problem is a warning with the Relay's message (escaped).
		env = build({ ...healthy, success: false, message: 'Codex <b>missing</b>' }, true);
		assert.deepStrictEqual(env.pills, [['warn', 'Needs attention']]);
		assert.ok(env.fields.debugHealthList.innerHTML.includes('Codex &lt;b&gt;missing&lt;/b&gt;') && !env.fields.debugHealthList.innerHTML.includes('<b>missing'));
		// Unreachable Relay is the only problem state of that check.
		env = build({ success: false, message: 'Failed to fetch', jobs: {} }, false);
		assert.deepStrictEqual(env.pills, [['error', 'Problems found']]);
		assert.ok(env.fields.debugHealthList.innerHTML.includes('class="debug-health-item bad"') && env.fields.debugHealthList.innerHTML.includes('could not reach the Relay') && env.fields.debugHealthList.innerHTML.includes('Codex status is unknown while the Relay is unreachable.'));
		// A failed job is a problem with an Inspect action.
		env = build({ ...healthy, jobs: { queued_count: 2, recent: [{ request_id: 'rf', type: 'chat', status: 'failed', error_message: '<x>boom' }] } }, true);
		assert.deepStrictEqual(env.pills, [['error', 'Problems found']]);
		assert.ok(env.fields.debugHealthSummary.innerHTML.includes('<b>1</b> problem') && env.fields.debugHealthSummary.innerHTML.includes('<b>1</b> warning') && env.fields.debugHealthList.innerHTML.includes('data-open-live-job="rf"') && env.fields.debugHealthList.innerHTML.includes('&lt;x&gt;boom'));
		assert.ok(!/<x>/.test(env.fields.debugHealthList.innerHTML));
	}
	{
		const buildFailures = () => {
			const open = new Set();
			const detailsList = [];
			const container = { writes: 0, html: '', get innerHTML() { return this.html; }, set innerHTML(value) { this.writes += 1; this.html = value; detailsList.length = 0; (value.match(/data-failure-id="([^"]*)"/g) || []).forEach((match) => { const id = match.slice(17, -1); detailsList.push({ id, open: false, getAttribute: () => id }); }); }, querySelectorAll: () => detailsList };
			const state = { cache: null };
			const api = load(['text', 'escapeHtml', 'elapsed', 'shortLiveRequestId', 'jobRequestId', 'liveTypeLabel', 'debugFailureItem', 'renderDebugFailures'], ['fields', 'debugFailureOpen'], 'let debugFailureMarkup = null;', [{ debugFailureList: container }, open], 'renderDebugFailures');
			return { container, detailsList, open, api };
		};
		const env = buildFailures();
		env.api({ recent: [] });
		assert.strictEqual(env.container.html, '<div class="muted">No recent failures</div>');
		const failed = (id, extra = {}) => ({ request_id: id, short_request_id: id, type: 'videos', model: 'xai-video', provider: 'xai-api', provider_label: 'Grok / xAI API', workflow: 'wf', status: 'failed', finished_at: 1700000000000, elapsed_ms: 31000, error_message: 'HTTP 429\nretry after 30s', ...extra });
		const snapshot = { recent: [failed('f1'), { request_id: 'ok1', status: 'completed' }, { request_id: 'c1', status: 'cancelled', error_message: 'user' }, failed('f2', { error_message: '<img src=x onerror=alert(1)> & "q"' })] };
		env.api(snapshot);
		const markup = env.container.html;
		assert.strictEqual((markup.match(/<details class="debug-failure"/g) || []).length, 2, 'only failed jobs, as expandable rows');
		assert.ok(!markup.includes('data-failure-id="ok1"') && !markup.includes('data-failure-id="c1"'));
		assert.ok(markup.includes('<summary>') && markup.includes('class="debug-failure-msg">HTTP 429<') && markup.includes('class="live-job-tag">Video<'), 'the collapsed row shows the first line of the error and the type');
		assert.ok(markup.includes('Grok / xAI API') && markup.includes('xai-video') && markup.includes('31s') && markup.includes('data-open-live-job="f1"'), 'details: provider, model, elapsed, inspect action');
		assert.ok(markup.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;') && !markup.includes('<img'), 'hostile errors are escaped in the headline, body and copy value');
		assert.ok(markup.includes('data-copy-value="HTTP 429\nretry after 30s"'), 'Copy error carries the full text');
		assert.strictEqual(env.container.writes, 2);
		env.api(JSON.parse(JSON.stringify(snapshot)));
		assert.strictEqual(env.container.writes, 2, 'unchanged failures are not re-rendered (keeps focus and expanded rows)');
		env.open.add('f2');
		env.api({ recent: [failed('f1'), failed('f2', { error_message: 'changed' })] });
		assert.strictEqual(env.container.writes, 3);
		assert.deepStrictEqual(env.detailsList.map((details) => [details.id, details.open]), [['f1', false], ['f2', true]], 'an expanded row stays expanded across re-renders');
		env.api({ recent: Array.from({ length: 12 }, (_, index) => failed('many' + index)) });
		assert.strictEqual(env.detailsList.length, 8, 'at most eight failures are listed');
		const fallback = buildFailures();
		fallback.api({ recent: [failed('nomsg', { error_message: '' })] });
		assert.ok(fallback.container.html.includes('Failed without an error message.'));
		assert.ok(script.includes("}, true);") && script.includes("debugFailureOpen.add(id)"), 'toggle events (capture phase) remember expanded rows');
	}

	// ---- Reachability: a JSON answer (even 503 while checking) means reachable; only a network failure is unreachable ----
	{
		const pills = load(['relayPillInfo', 'isCodexChecking', 'codexPillInfo']);
		assert.deepStrictEqual(pills.relayPillInfo(true), { state: 'ok', label: 'Reachable' });
		assert.deepStrictEqual(pills.relayPillInfo(false), { state: 'error', label: 'Unreachable' });
		assert.deepStrictEqual(pills.relayPillInfo(undefined), { state: 'ok', label: 'Reachable' }, 'only an explicit failure means unreachable');
		const checking = { success: false, checking: true, message: 'Checking local model providers in background.', details: { checking: true } };
		assert.strictEqual(pills.isCodexChecking(checking), true);
		assert.strictEqual(pills.isCodexChecking({ success: false, details: { checking: true } }), true, 'details.checking alone counts');
		assert.strictEqual(pills.isCodexChecking({ success: false, refresh: { active: true } }), true, 'an active provider refresh counts');
		assert.strictEqual(pills.isCodexChecking({ success: true, checking: true }), false, 'a ready Codex is never "checking"');
		assert.strictEqual(pills.isCodexChecking({ success: false, message: 'Codex not found' }), false);
		assert.strictEqual(pills.isCodexChecking(null), false);
		assert.deepStrictEqual(pills.codexPillInfo(checking, true), { state: 'checking', label: 'Checking…' }, 'startup shows Checking…, not Error');
		assert.deepStrictEqual(pills.codexPillInfo({ success: true }, true), { state: 'ok', label: 'Ready' });
		assert.deepStrictEqual(pills.codexPillInfo({ success: true, refresh: { active: true } }, true), { state: 'ok', label: 'Ready' }, 'a refresh does not flip a ready Codex');
		assert.deepStrictEqual(pills.codexPillInfo({ success: false, message: 'x' }, true), { state: 'warn', label: 'Needs attention' });
		assert.deepStrictEqual(pills.codexPillInfo(checking, false), { state: 'unknown', label: 'Unknown' }, 'Codex is unknown while the Relay is unreachable');

		// renderStatus wires the pills from reachability.
		const run = (payload, ok) => {
			const calls = { pills: [], health: [], debug: [] };
			const fields = { bridgePill: 'bridge', codexPill: 'codex', version: {}, pairedSites: {}, codexDetails: {}, codexCliVersion: {}, codexBinary: {}, detectedFeatures: {}, backendDrivers: {} };
			const render = load(['relayPillInfo', 'isCodexChecking', 'codexPillInfo', 'renderStatus'], ['fields', 'currentCapabilities', 'setPill', 'text', 'escapeHtml', 'renderDetails', 'renderAsrDetails', 'updateHealthCards', 'renderDebugHealth', 'renderJobs', 'updateProviderRefreshState'],
				'let currentStatus = {};', [fields, {}, (element, state, label) => calls.pills.push([element, state, label]), (value, fallback = '-') => String(value ?? fallback), (value) => String(value), () => '', () => {}, (p, reachable) => calls.health.push(reachable), (p, reachable) => calls.debug.push(reachable), () => {}, () => {}], 'renderStatus');
			render(payload, ok);
			return calls;
		};
		let calls = run(checking, true);
		assert.deepStrictEqual(calls.pills, [['bridge', 'ok', 'Reachable'], ['codex', 'checking', 'Checking…']], '503 while checking: Relay Reachable, Codex Checking…');
		assert.deepStrictEqual(calls.debug, [true]);
		calls = run({ success: true, jobs: {} }, true);
		assert.deepStrictEqual(calls.pills, [['bridge', 'ok', 'Reachable'], ['codex', 'ok', 'Ready']]);
		calls = run({ success: false, message: 'Failed to fetch', jobs: {} }, false);
		assert.deepStrictEqual(calls.pills, [['bridge', 'error', 'Unreachable'], ['codex', 'unknown', 'Unknown']], 'a network failure is the only "unreachable"');
		assert.deepStrictEqual(calls.debug, [false]);
		assert.ok(!script.includes("ok ? 'Reachable' : 'Error'"), 'the old Error label is gone');
		assert.ok(script.includes("handleLiveEvent('Status', event, (payload) => renderStatus(payload, statusReachable()))"), 'an event-stream status event is a Relay answer even while success is false');
	}
	// ---- Connectivity model: pure helpers against a fake clock ----
	{
		const clock = { now: 1700000000000 };
		class FakeDate extends Date { static now() { return clock.now; } }
		const buildModel = () => {
			const prelude = 'const statusFailureHardCount = 3; const statusFailureHardMs = 30000; ' + CONNECTION_STATE_PRELUDE;
			return load(['recordStatusSuccess', 'recordStatusFailure', 'connectionView'], ['Date'], prelude, [FakeDate], '{ recordStatusSuccess, recordStatusFailure, connectionView, state: connectionState }');
		};
		const at = (ms) => new Date(ms).toLocaleTimeString();
		let model = buildModel();
		const view = () => model.connectionView(clock.now);
		// Nothing has happened yet.
		assert.deepStrictEqual(view(), { pill: 'connecting', pillLabel: 'Connecting', label: 'Loading', keepLastGood: true, hardError: false });
		// A healthy poll without a live stream.
		model.recordStatusSuccess('poll');
		const polled = clock.now;
		assert.deepStrictEqual(view(), { pill: 'connecting', pillLabel: 'Connecting', label: 'Polled · updated ' + at(polled), keepLastGood: true, hardError: false });
		model.state.polling = true;
		assert.deepStrictEqual(view(), { pill: 'polling', pillLabel: 'Polling fallback', label: 'Polled · updated ' + at(polled), keepLastGood: true, hardError: false }, 'healthy polling');
		// Live and healthy.
		model.state.polling = false;
		model.state.sseLive = true;
		assert.deepStrictEqual(view(), { pill: 'connected', pillLabel: 'Connected', label: 'Live updates on · updated ' + at(polled), keepLastGood: true, hardError: false });
		clock.now += 4000;
		model.recordStatusSuccess('sse');
		assert.strictEqual(view().label, 'Live updates on · updated ' + at(clock.now), 'an event moves the update time');
		// A stream that opened but delivered nothing yet.
		model = buildModel();
		model.state.sseLive = true;
		assert.deepStrictEqual(view(), { pill: 'connected', pillLabel: 'Connected', label: 'Live updates connected', keepLastGood: true, hardError: false });
		// The stream dropped, polling has not answered yet: the last event is not a "poll".
		model.recordStatusSuccess('sse');
		model.state.sseLive = false;
		model.state.polling = true;
		assert.strictEqual(view().label, 'Live updates unavailable - polling');

		// Isolated failures with live events in between never become a hard error, however long the page runs.
		model = buildModel();
		model.state.sseLive = true;
		model.recordStatusSuccess('sse');
		for (let round = 0; round < 40; round += 1) {
			clock.now += 20000;
			model.recordStatusFailure(new Error('poll ' + round));
			const failed = view();
			assert.strictEqual(failed.hardError, false, 'one failed poll with a live stream is not a hard error (round ' + round + ')');
			assert.strictEqual(failed.keepLastGood, true);
			assert.strictEqual(failed.pill, 'delayed');
			assert.ok(/^Status delayed — last update \S+/.test(failed.label), failed.label);
			assert.ok(!failed.label.includes('Live updates on'), 'never "Live updates on" while delayed');
			clock.now += 3000;
			model.recordStatusSuccess('sse');
			assert.strictEqual(model.state.failureCount, 0, 'an event resets the streak');
			assert.strictEqual(model.state.failureSince, 0);
			assert.strictEqual(view().pill, 'connected');
		}
		// The delayed note names the last good time, an event included.
		clock.now += 1000;
		const lastEvent = clock.now;
		model.recordStatusSuccess('sse');
		clock.now += 1000;
		model.recordStatusFailure(new Error('x'));
		assert.strictEqual(view().label, 'Status delayed — last update ' + at(lastEvent));
		assert.strictEqual(view().pillLabel, view().label);

		// Three consecutive failures with no success in between: hard error.
		model = buildModel();
		model.recordStatusSuccess('poll');
		const good = clock.now;
		model.recordStatusFailure(new Error('one'));
		assert.strictEqual(view().hardError, false);
		clock.now += 5000;
		model.recordStatusFailure(new Error('two'));
		assert.deepStrictEqual(view(), { pill: 'delayed', pillLabel: 'Status delayed — last update ' + at(good), label: 'Status delayed — last update ' + at(good), keepLastGood: true, hardError: false });
		clock.now += 5000;
		model.recordStatusFailure(new Error('three'));
		assert.deepStrictEqual(view(), { pill: 'unreachable', pillLabel: 'Relay unreachable', label: 'Relay unreachable — last update ' + at(good), keepLastGood: false, hardError: true });
		assert.strictEqual(model.state.lastError, 'three');
		model.state.sseLive = true;
		assert.strictEqual(view().hardError, true, 'a live stream that delivers nothing does not hide three failures');
		assert.ok(!view().label.includes('Live updates on'));
		model.recordStatusSuccess('poll');
		assert.strictEqual(view().hardError, false, 'a success ends the error state');
		assert.strictEqual(model.state.failureCount, 0);

		// A failure streak lasting 30 s: hard error, even with only two failures (and even if only time passes).
		model = buildModel();
		model.recordStatusSuccess('poll');
		model.recordStatusFailure(new Error('a'));
		clock.now += 29999;
		model.recordStatusFailure(new Error('b'));
		assert.strictEqual(view().hardError, false, 'just under 30 s');
		clock.now += 1;
		assert.strictEqual(view().hardError, true, 'the streak reached 30 s');
		assert.strictEqual(view().label.startsWith('Relay unreachable — last update '), true);
		model = buildModel();
		model.recordStatusSuccess('poll');
		model.recordStatusFailure(new Error('a'));
		clock.now += 30000;
		model.recordStatusFailure(new Error('b'));
		assert.strictEqual(view().hardError, true);

		// Nothing good to keep: hard at once, unless a live stream proves the Relay is there.
		model = buildModel();
		model.recordStatusFailure(new Error('first'));
		assert.deepStrictEqual(view(), { pill: 'unreachable', pillLabel: 'Relay unreachable', label: 'Relay unreachable', keepLastGood: false, hardError: true });
		model = buildModel();
		model.state.sseLive = true;
		model.recordStatusFailure(new Error('first'));
		assert.strictEqual(view().hardError, false);
		assert.strictEqual(view().label, 'Status delayed');
		// A success resets the streak: the next failure starts a new one.
		model = buildModel();
		model.recordStatusSuccess('poll');
		model.recordStatusFailure(new Error('a'));
		model.recordStatusFailure(new Error('b'));
		model.recordStatusSuccess('poll');
		clock.now += 60000;
		model.recordStatusFailure(new Error('c'));
		assert.strictEqual(view().hardError, false, 'a later isolated failure is not a continuation');
		assert.strictEqual(model.state.failureSince, clock.now);
		assert.strictEqual(model.state.failureCount, 1);
	}
	(async () => {
		// refresh(): every JSON answer is "reachable"; fetch rejection or a non-JSON answer is "unreachable".
		const build = (statusBehavior) => {
			const calls = { goodAtRender: [], status: [], connection: [], caps: [], retries: 0, timers: fakeTimers(), stale: [], statusFetches: 0, capsFetches: 0, consoleErrors: [] };
			const clock = { now: 1700000000000 };
			class FakeDate extends Date { static now() { return clock.now; } }
			const fields = { updated: { textContent: '' }, renderError: { hidden: true, textContent: '' } };
			const fetch = async (url) => {
				if (url === '/caps') { calls.capsFetches += 1; if (statusBehavior.capsFail) throw new TypeError('caps down'); return { ok: true, json: async () => ({ backends: [] }) }; }
				calls.statusFetches += 1;
				return statusBehavior.respond();
			};
			let model = null;
			const renderStatus = (payload, ok, options) => {
				calls.goodAtRender.push(model.lastGoodAt);
				if (statusBehavior.renderThrows) throw new Error('render boom');
				calls.status.push({ payload, ok, options });
			};
			const prelude = 'const statusFetchTimeoutMs = 10000; const statusFailureHardCount = 3; const statusFailureHardMs = 30000; let statusRefreshPending = null; ' + CONNECTION_STATE_PRELUDE;
			const names = ['fetchJsonWithTimeout', 'refresh', 'refreshStatusOnce', 'handleStatusPollFailure', 'recordStatusSuccess', 'recordStatusFailure', 'connectionView', 'applyConnectionView', 'statusReachable', 'reportRenderError', 'guardedRender'];
			const api = load(names, ['fields', 'fetch', 'statusUrl', 'capabilitiesUrl', 'renderStatus', 'renderCapabilities', 'updateProviderTestProgress', 'retryRelaySettingsLoad', 'setConnection', 'setTimeout', 'clearTimeout', 'Date', 'console', 'relayPairingHeaders'], prelude,
				[fields, fetch, '/status', '/caps', renderStatus, (payload) => calls.caps.push(payload), (options) => calls.stale.push(options), () => { calls.retries += 1; },
					(state, label) => { if (statusBehavior.setConnectionThrows && statusBehavior.setConnectionThrows-- > 0) throw new Error('pill boom'); calls.connection.push([state, label]); },
					(fn, ms) => calls.timers.setTimeout(fn, ms), (id) => calls.timers.clearTimeout(id), FakeDate, { error: (...args) => calls.consoleErrors.push(args) }, () => ({})], '{ ' + names.join(', ') + ', connectionState }');
			model = api.connectionState;
			return { api: api.refresh, state: api.connectionState, calls, fields, clock, behavior: statusBehavior, lastPill: () => calls.connection[calls.connection.length - 1] };
		};
		const at = (ms) => new Date(ms).toLocaleTimeString();
		const delayedNotes = (env) => env.calls.connection.filter(([, label]) => label.startsWith('Status delayed'));
		let env = build({ respond: async () => ({ ok: false, status: 503, json: async () => ({ success: false, checking: true, details: { checking: true }, bridge: {}, jobs: { active: [], queued: [], recent: [] } }) }) });
		await env.api();
		assert.strictEqual(env.calls.status.length, 1);
		assert.strictEqual(env.calls.status[0].ok, true, 'a 503 JSON answer means the Relay is reachable');
		assert.deepStrictEqual(env.calls.status[0].options, { stale: false }, 'its jobs are a real report');
		assert.strictEqual(env.state.failureCount, 0);
		assert.strictEqual(env.state.lastGoodAt, env.clock.now, 'a 503 answer is a success');
		assert.strictEqual(env.calls.retries, 1, 'a successful poll lets the page retry a failed first settings load');
		assert.strictEqual(env.calls.caps.length, 1);
		assert.strictEqual(env.fields.updated.textContent, 'Polled · updated ' + at(env.clock.now));
		assert.deepStrictEqual(env.lastPill(), ['warn', 'Connecting']);
		env = build({ respond: async () => ({ ok: false, status: 503, json: async () => ({ success: false, message: 'busy' }) }) });
		await env.api();
		assert.strictEqual(env.calls.status[0].ok, true, 'even without jobs the answer proves the Relay is up');
		assert.deepStrictEqual(env.calls.status[0].options, { stale: true }, 'but jobs missing means the jobs list is stale');
		env = build({ respond: async () => { throw new TypeError('Failed to fetch'); } });
		await env.api();
		assert.strictEqual(env.calls.status[0].ok, false, 'a network failure is unreachable');
		assert.deepStrictEqual(env.calls.status[0].options, { stale: true });
		assert.deepStrictEqual(env.calls.status[0].payload, { success: false, message: 'Failed to fetch', jobs: {} });
		assert.deepStrictEqual(env.lastPill(), ['error', 'Relay unreachable']);
		assert.strictEqual(env.fields.updated.textContent, 'Relay unreachable');
		env = build({ respond: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }) });
		await env.api();
		assert.strictEqual(env.calls.status[0].ok, false, 'a non-JSON answer (a proxy error page) is not the Relay');
		env = build({ respond: async () => ({ ok: true, status: 200, json: async () => null }) });
		await env.api();
		assert.strictEqual(env.calls.status[0].ok, false, 'a null body is not a status');
		env = build({ capsFail: true, respond: async () => ({ ok: true, status: 200, json: async () => ({ success: true, jobs: {} }) }) });
		await env.api({ silent: true });
		assert.strictEqual(env.calls.status[0].ok, true, 'capabilities failing does not make the Relay unreachable');
		// A status request that never answers is given up after 10 s and reported like any other failure.
		env = build({ respond: () => new Promise(() => {}) });
		const polling = env.api();
		await delay(0);
		await env.calls.timers.advance(9999);
		assert.strictEqual(env.calls.status.length, 0, 'still waiting before 10 s');
		await env.calls.timers.advance(1);
		await polling;
		assert.strictEqual(env.calls.status[0].ok, false);
		assert.strictEqual(env.calls.status[0].payload.message, 'Status request timed out after 10 s');
		assert.strictEqual(env.state.lastError, 'Status request timed out after 10 s');
		assert.strictEqual(env.calls.timers.pending(), 0);

		// ---- A slow or failed status poll keeps the last good picture; only a persistent failure shows the error state ----
		const good = async () => ({ ok: true, status: 200, json: async () => ({ success: true, jobs: { active: [{ request_id: 'a' }], queued: [], recent: [] } }) });
		const hang = () => new Promise(() => {});
		const refuse = async () => { throw new TypeError('Failed to fetch'); };
		const slowPoll = async (env, options) => { const polling = env.api(options); await delay(0); await env.calls.timers.advance(10000); await polling; };
		// A single slow answer: the last good status stays, the topbar says how old it is, and the tracker sees a non-fresh feed.
		env = build({ respond: good });
		await env.api();
		const firstGood = env.clock.now;
		assert.strictEqual(env.calls.status.length, 1);
		env.clock.now += 1000;
		env.behavior.respond = hang;
		await slowPoll(env);
		assert.strictEqual(env.calls.status.length, 1, 'a timed-out poll renders nothing: jobs, pills, Live list and selection stay as they were');
		assert.strictEqual(env.state.failureCount, 1);
		assert.deepStrictEqual(env.calls.stale, [{ fresh: false }], 'the provider-test tracker treats the timed-out refresh as not fresh');
		assert.strictEqual(delayedNotes(env).length, 1);
		assert.strictEqual(env.fields.updated.textContent, 'Status delayed — last update ' + at(firstGood));
		assert.deepStrictEqual(env.lastPill(), ['warn', 'Status delayed — last update ' + at(firstGood)], 'the pill carries the note too');
		// A second failure still keeps the picture; the third in a row shows the error state.
		await slowPoll(env);
		assert.strictEqual(env.calls.status.length, 1);
		assert.strictEqual(env.calls.stale.length, 2);
		await slowPoll(env);
		assert.strictEqual(env.calls.status.length, 2, 'three failures in a row: the hard error state');
		assert.strictEqual(env.calls.status[1].ok, false);
		assert.deepStrictEqual(env.calls.status[1].payload, { success: false, message: 'Status request timed out after 10 s', jobs: {} });
		assert.deepStrictEqual(env.lastPill(), ['error', 'Relay unreachable']);
		assert.strictEqual(env.fields.updated.textContent, 'Relay unreachable — last update ' + at(firstGood));
		// The Relay answers again: normal rendering, the counter starts over and the "delayed" label gives way.
		env.behavior.respond = good;
		await env.api({ silent: true });
		assert.strictEqual(env.calls.status.length, 3);
		assert.strictEqual(env.calls.status[2].ok, true);
		assert.ok(env.fields.updated.textContent.startsWith('Polled · updated'), 'even a silent recovery replaces the delayed note');
		const notesBefore = delayedNotes(env).length;
		env.behavior.respond = refuse;
		await env.api(); await env.api();
		assert.strictEqual(env.calls.status.length, 3, 'two new failures after a recovery are still tolerated');
		assert.strictEqual(delayedNotes(env).length - notesBefore, 2, 'one note per tolerated failure');
		// Persistence by time: a failure still going 30 s after the first one is enough.
		env = build({ respond: good });
		await env.api();
		env.behavior.respond = refuse;
		await env.api();
		assert.strictEqual(env.calls.status.length, 1);
		env.clock.now += 29999;
		await env.api();
		assert.strictEqual(env.calls.status.length, 1, 'still tolerated just before 30 s');
		env.clock.now += 1;
		await env.api();
		assert.strictEqual(env.calls.status.length, 2, 'failing for 30 s shows the error state');
		assert.strictEqual(env.calls.status[1].ok, false);
		// A ticker poll that fails while the stream is live: the label says delayed (never "Live updates on"), the tracker
		// hears "not fresh"; the next live event ends it.
		env = build({ respond: good });
		await env.api();
		env.state.sseLive = true;
		env.behavior.respond = refuse;
		await env.api({ silent: true });
		assert.ok(env.fields.updated.textContent.startsWith('Status delayed — last update'), env.fields.updated.textContent);
		assert.strictEqual(delayedNotes(env).length, 1);
		assert.deepStrictEqual(env.calls.stale, [{ fresh: false }]);
		assert.strictEqual(env.calls.status.length, 1, 'one failed poll with a live stream never renders the error state');
		// The very first poll failing has nothing to keep: the error state shows at once.
		env = build({ respond: refuse });
		await env.api();
		assert.strictEqual(env.calls.status.length, 1);
		assert.strictEqual(env.calls.status[0].ok, false);
		assert.deepStrictEqual(env.lastPill(), ['error', 'Relay unreachable']);
		assert.deepStrictEqual(delayedNotes(env), []);
		assert.deepStrictEqual(env.calls.stale, []);
		env = build({ respond: hang });
		await slowPoll(env);
		assert.strictEqual(env.calls.status[0].ok, false, 'a first-ever timeout is also an immediate error state');
		// A non-503 error answer is not "good": a 500 JSON shows the error state, and it is not something to keep.
		const failing = async () => ({ ok: false, status: 500, json: async () => ({ success: false, message: 'boom', jobs: { active: [], queued: [], recent: [] } }) });
		env = build({ respond: failing });
		await env.api();
		assert.strictEqual(env.calls.status[0].ok, false, 'HTTP 500 with a JSON body is the error state');
		assert.deepStrictEqual(env.calls.status[0].options, { stale: false });
		assert.strictEqual(env.calls.status[0].payload.message, 'boom', 'the error answer itself is rendered');
		assert.strictEqual(env.state.lastGoodAt, 0, 'a 500 answer is never a good status to keep');
		env.behavior.respond = refuse;
		await env.api();
		assert.strictEqual(env.calls.status.length, 2);
		assert.strictEqual(env.calls.status[1].ok, false);
		env = build({ respond: async () => ({ ok: false, status: 503, json: async () => ({ success: false, checking: true, jobs: {} }) }) });
		await env.api();
		assert.strictEqual(env.calls.status[0].ok, true, '503 is still "reachable"');

		// ---- A render exception after a 200 never freezes connectivity and is never swallowed silently ----
		env = build({ respond: good, renderThrows: true });
		await env.api();
		assert.strictEqual(env.state.failureCount, 0, 'the Relay answered; a render exception is not a failed poll');
		assert.strictEqual(env.state.lastGoodAt, env.clock.now, 'connectivity was recorded');
		assert.strictEqual(env.fields.updated.textContent, 'Polled · updated ' + at(env.clock.now), 'the label follows connectivity');
		assert.strictEqual(env.fields.renderError.hidden, false, 'a small inline error is shown');
		assert.strictEqual(env.fields.renderError.textContent, 'Status page error while rendering — see console');
		assert.strictEqual(env.calls.consoleErrors.length, 1);
		assert.strictEqual(env.calls.consoleErrors[0][1].message, 'render boom', 'the exception is logged with console.error');
		assert.strictEqual(env.calls.caps.length, 1, 'the other render steps still run');
		assert.strictEqual(env.calls.retries, 1);
		// Connectivity is recorded before the render runs (the render hook saw a recorded success, even though it threw).
		assert.deepStrictEqual(env.calls.goodAtRender, [env.state.lastGoodAt]);
		// Later polls keep working, and a good render takes the inline error away.
		env.behavior.renderThrows = false;
		env.clock.now += 5000;
		await env.api({ timer: true });
		assert.strictEqual(env.calls.status.length, 1, 'the next poll renders normally');
		assert.strictEqual(env.fields.renderError.hidden, true);
		assert.strictEqual(env.fields.updated.textContent, 'Polled · updated ' + at(env.clock.now));
		// A render exception during a hard-error render is reported too.
		env = build({ respond: refuse, renderThrows: true });
		await env.api();
		assert.strictEqual(env.fields.renderError.hidden, false);
		assert.deepStrictEqual(env.lastPill(), ['error', 'Relay unreachable']);
		assert.ok(!extractPageFunction('renderJobs').includes('fields.updated'), 'rendering jobs never writes the #updated label');

		// ---- One status request at a time for timer-driven polls ----
		env = build({ respond: hang });
		const firstTick = env.api({ timer: true });
		await delay(0);
		const secondTick = env.api({ timer: true });
		env.api({ timer: true, silent: true });
		await delay(0);
		assert.strictEqual(env.calls.statusFetches, 1, 'ticks while a status request is pending do not start another');
		assert.strictEqual(env.calls.capsFetches, 1);
		assert.strictEqual(secondTick, firstTick, 'a skipped tick joins the pending request');
		await env.calls.timers.advance(10000);
		await firstTick;
		env.behavior.respond = good;
		await env.api({ timer: true });
		assert.strictEqual(env.calls.statusFetches, 2, 'the next tick polls again once the pending request is done');
		// An explicit call waits for the pending request and then asks for a fresh answer of its own.
		env = build({ respond: hang });
		const tick = env.api({ timer: true });
		await delay(0);
		const explicit = env.api();
		await delay(0);
		assert.strictEqual(env.calls.statusFetches, 1);
		env.behavior.respond = good;
		await env.calls.timers.advance(10000);
		await tick;
		await explicit;
		assert.strictEqual(env.calls.statusFetches, 2, 'the explicit refresh made its own request after the pending one ended');
		assert.strictEqual(env.calls.status[env.calls.status.length - 1].ok, true);
		assert.strictEqual(env.calls.timers.pending(), 0);
		// ... also when the pending poll rejects (here the pill update throws while the failed poll is being recorded).
		env = build({ respond: hang, setConnectionThrows: 1 });
		const rejecting = env.api({ timer: true });
		const rejected = rejecting.then(() => 'resolved', () => 'rejected');
		await delay(0);
		const queued = env.api();
		await delay(0);
		env.behavior.respond = good;
		await env.calls.timers.advance(10000);
		assert.strictEqual(await rejected, 'rejected', 'the pending poll did reject');
		await queued;
		assert.strictEqual(env.calls.statusFetches, 2, 'the explicit refresh still issued its own request');
		assert.strictEqual(env.calls.status[env.calls.status.length - 1].ok, true);
		assert.strictEqual(env.calls.timers.pending(), 0);
	})().then(() => {}, (error) => { console.error(error); process.exit(1); });
	// The 1 s provider-detection poll is timer-driven too.
	{
		const seen = [];
		const { pollProviderRefresh } = load(['pollProviderRefresh'], ['refresh'], '', [(options) => { seen.push(options); return Promise.resolve(); }], '{ pollProviderRefresh }');
		pollProviderRefresh();
		assert.deepStrictEqual(seen, [{ timer: true }]);
	}
	{
		// Fake EventSource and fake timers: the real connect / schedule / fallback functions run against them.
		const build = (options = {}) => {
			const env = { sources: [], timeouts: new Map(), intervals: new Map(), nextId: 1, connection: [], refreshes: 0, rendered: { status: [], capabilities: [], jobs: [] }, loaded: 0, updated: { textContent: '' }, renderError: { hidden: true, textContent: '' }, consoleErrors: [], clock: { now: 1700000000000 }, cleared: [] };
			class FakeDate extends Date { static now() { return env.clock.now; } }
			class FakeEventSource {
				constructor(url) { if (options.throwOnCreate) throw new Error('no EventSource'); this.url = url; this.listeners = {}; this.closed = false; this.onerror = null; env.sources.push(this); }
				addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
				close() { this.closed = true; }
				emit(type, data) { (this.listeners[type] || []).forEach((fn) => fn({ data: data === undefined ? '' : JSON.stringify(data) })); }
				fail() { if (this.onerror) this.onerror(); }
			}
			const names = ['nextJobEventsRetryDelay', 'scheduleJobEventsReconnect', 'startFallbackPolling', 'stopFallbackPolling', 'connectJobEvents', 'handleLiveEvent', 'recordStatusSuccess', 'recordStatusFailure', 'connectionView', 'applyConnectionView', 'statusReachable', 'reportRenderError', 'clearRenderError', 'guardedRender', 'checkJobEventsStall'];
			const prelude = 'const statusFailureHardCount = 3; const statusFailureHardMs = 30000; ' + CONNECTION_STATE_PRELUDE + ' let jobEvents = null; let jobEventsRetryTimer = null; const jobEventsRetryMinMs = 2000; const jobEventsRetryMaxMs = 30000; const jobEventsStallMs = 35000; let jobEventsRetryDelay = jobEventsRetryMinMs; let fallbackPollTimer = null; let settingsLoaded = ' + (options.settingsLoaded ? 'true' : 'false') + ';';
			const api = load(names, ['fields', 'window', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setConnection', 'refresh', 'markLiveEvent', 'renderStatus', 'renderCapabilities', 'renderJobs', 'jobEventsUrl', 'loadRelaySettings', 'Date', 'console', 'isLocalStatusPage'], prelude,
				[{ updated: env.updated, renderError: env.renderError }, options.noEventSource ? {} : { EventSource: FakeEventSource },
					(fn, ms) => { const id = env.nextId++; env.timeouts.set(id, { fn, ms }); return id; }, (id) => { env.cleared.push(id); env.timeouts.delete(id); },
					(fn, ms) => { const id = env.nextId++; env.intervals.set(id, { fn, ms }); return id; }, (id) => { env.cleared.push(id); env.intervals.delete(id); },
					(state, label) => env.connection.push([state, label]), (options) => { env.refreshes += 1; (env.refreshArgs = env.refreshArgs || []).push(options); }, () => {},
					(payload, ok) => { if (env.throwOn === 'status') throw new Error('status render boom'); env.rendered.status.push([payload, ok]); }, (payload) => { if (env.throwOn === 'capabilities') throw new Error('capabilities render boom'); env.rendered.capabilities.push(payload); }, (payload) => { if (env.throwOn === 'jobs') throw new Error('jobs render boom'); env.rendered.jobs.push(payload); }, '/v1/status/events', () => { env.loaded += 1; }, FakeDate, { error: (...args) => env.consoleErrors.push(args) }, () => !options.remotePage],
				'{ ' + names.join(', ') + ', state: () => ({ jobEvents, jobEventsLive: connectionState.sseLive, jobEventsRetryTimer, jobEventsRetryDelay, fallbackPollTimer }), connectionState }');
			env.api = api;
			env.open = () => env.sources.filter((source) => !source.closed);
			// Runs the single pending reconnect timer and returns the delay it was scheduled with.
			env.fireRetry = () => { const [id, timer] = Array.from(env.timeouts.entries())[0]; env.timeouts.delete(id); timer.fn(); return timer.ms; };
			return env;
		};

		// The delay grows 2 s -> 4 s -> 8 s -> 16 s and is capped at 30 s.
		{
			const { nextJobEventsRetryDelay } = build().api;
			assert.deepStrictEqual([2000, 4000, 8000, 16000, 30000, 30000].map((value) => nextJobEventsRetryDelay(value)), [4000, 8000, 16000, 30000, 30000, 30000]);
			assert.strictEqual(nextJobEventsRetryDelay(undefined), 4000);
			assert.strictEqual(nextJobEventsRetryDelay('garbage'), 4000);
			assert.strictEqual(nextJobEventsRetryDelay(1), 4000, 'never below the 2 s minimum');
			assert.strictEqual(nextJobEventsRetryDelay(1e9), 30000);
		}
		// A remote (paired) status page opens the cookie-authenticated stream instead of the local-only events route.
		{
			const env = build({ remotePage: true });
			env.api.connectJobEvents();
			assert.strictEqual(env.sources[0].url, '/v1/status/stream');
		}
		// One EventSource at a time; opening it switches to live updates.
		{
			const env = build();
			env.api.connectJobEvents();
			env.api.connectJobEvents();
			env.api.connectJobEvents();
			assert.strictEqual(env.sources.length, 1, 'repeated connect calls reuse the existing stream');
			assert.strictEqual(env.sources[0].url, '/v1/status/events');
			assert.strictEqual(env.api.state().jobEventsLive, false, 'not live until the stream opens');
			env.sources[0].emit('open');
			assert.strictEqual(env.api.state().jobEventsLive, true);
			assert.deepStrictEqual(env.connection, [['ok', 'Connected']]);
			assert.strictEqual(env.updated.textContent, 'Live updates connected');
			assert.strictEqual(env.api.state().fallbackPollTimer, null, 'no polling while the stream is live');
			// Events are rendered; a status event counts as the Relay answering even when success is false (Codex checking).
			env.sources[0].emit('status', { success: false, checking: true });
			assert.deepStrictEqual(env.rendered.status, [[{ success: false, checking: true }, true]]);
			env.sources[0].emit('jobs', { running_count: 1 });
			assert.deepStrictEqual(env.rendered.jobs, [{ running_count: 1 }]);
			env.sources[0].emit('capabilities', { backends: [] });
			assert.deepStrictEqual(env.rendered.capabilities, [{ backends: [] }]);
			assert.strictEqual(env.loaded, 0, 'routing settings reload only once they were loaded');
			env.sources[0].emit('heartbeat');
			env.sources[0].listeners.jobs.forEach((fn) => fn({ data: '{not json' }));
			assert.strictEqual(env.rendered.jobs.length, 1, 'a malformed event is ignored');
		}
		{
			const env = build({ settingsLoaded: true });
			env.api.connectJobEvents();
			env.sources[0].emit('capabilities', { backends: [] });
			assert.strictEqual(env.loaded, 1, 'a capabilities event refreshes the loaded routing settings');
		}
		// Every live event is a success (it resets the failure streak and moves the update time); the label says "Live updates on" only then.
		{
			const env = build();
			const at = () => new Date(env.clock.now).toLocaleTimeString();
			env.api.connectJobEvents();
			env.sources[0].emit('open');
			assert.strictEqual(env.updated.textContent, 'Live updates connected');
			for (const [type, payload] of [['status', { success: true }], ['jobs', { running_count: 0 }], ['capabilities', { backends: [] }], ['heartbeat', undefined]]) {
				env.clock.now += 1000;
				env.api.recordStatusFailure(new Error('poll failed'));
				env.api.recordStatusFailure(new Error('poll failed again'));
				assert.strictEqual(env.api.connectionState.failureCount, 2);
				env.sources[0].emit(type, payload);
				assert.strictEqual(env.api.connectionState.failureCount, 0, type + ' resets the failure streak');
				assert.strictEqual(env.api.connectionState.lastGoodAt, env.clock.now, type + ' moves lastGoodAt');
				assert.strictEqual(env.updated.textContent, 'Live updates on · updated ' + at(), type);
				assert.deepStrictEqual(env.connection[env.connection.length - 1], ['ok', 'Connected']);
			}
			// A second isolated failure much later is not a continuation of an earlier one: events in between reset the streak.
			for (let round = 0; round < 5; round += 1) {
				env.clock.now += 120000;
				env.api.recordStatusFailure(new Error('late poll failure'));
				assert.strictEqual(env.api.connectionView(env.clock.now).hardError, false);
				assert.ok(env.api.connectionView(env.clock.now).label.startsWith('Status delayed — last update'));
				env.clock.now += 1000;
				env.sources[0].emit('jobs', { running_count: round });
			}
			assert.strictEqual(env.api.connectionState.failureSince, 0);
			// Rendering still gets only real event payloads.
			assert.deepStrictEqual(env.rendered.jobs.slice(-1), [{ running_count: 4 }]);
		}
		// An exception while rendering an event is logged and shown inline; connectivity stays correct and later events work.
		for (const type of ['status', 'jobs', 'capabilities']) {
			const env = build();
			env.api.connectJobEvents();
			env.sources[0].emit('open');
			env.throwOn = type;
			env.clock.now += 1000;
			env.sources[0].emit(type, { x: 1 });
			assert.strictEqual(env.api.connectionState.lastGoodAt, env.clock.now, type + ': the event counted as a success despite the render exception');
			assert.strictEqual(env.api.connectionState.failureCount, 0);
			assert.strictEqual(env.updated.textContent, 'Live updates on · updated ' + new Date(env.clock.now).toLocaleTimeString());
			assert.strictEqual(env.renderError.hidden, false, type + ': inline error shown');
			assert.strictEqual(env.renderError.textContent, 'Status page error while rendering — see console');
			assert.strictEqual(env.consoleErrors.length, 1);
			assert.strictEqual(env.consoleErrors[0][1].message, type + ' render boom');
			env.throwOn = null;
			env.sources[0].emit(type, { x: 2 });
			assert.strictEqual(env.renderError.hidden, true, type + ': the next good render clears the inline error');
			assert.strictEqual(env.consoleErrors.length, 1);
		}
		// A malformed event is not a success.
		{
			const env = build();
			env.api.connectJobEvents();
			env.sources[0].emit('open');
			env.api.recordStatusFailure(new Error('x'));
			env.sources[0].listeners.jobs.forEach((fn) => fn({ data: '{not json' }));
			assert.strictEqual(env.api.connectionState.failureCount, 1, 'a malformed event does not reset the streak');
			assert.strictEqual(env.renderError.hidden, false);
			assert.strictEqual(env.renderError.textContent, 'Received an unreadable live update — see console', 'a parse error has its own message');
			assert.strictEqual(env.consoleErrors.length, 1);
		}
		// The unreadable-update banner is cleared by the next valid event of any type, heartbeat included.
		for (const type of ['status', 'jobs', 'capabilities', 'heartbeat']) {
			const env = build();
			env.api.connectJobEvents();
			env.sources[0].emit('open');
			env.sources[0].listeners.jobs.forEach((fn) => fn({ data: '{not json' }));
			assert.strictEqual(env.renderError.hidden, false, type);
			env.sources[0].emit(type, type === 'heartbeat' ? undefined : { x: 1 });
			assert.strictEqual(env.renderError.hidden, true, type + ': a valid event clears the unreadable-update banner');
		}
		// A render exception still shows the render message, and a heartbeat clears it too.
		{
			const env = build();
			env.api.connectJobEvents();
			env.sources[0].emit('open');
			env.throwOn = 'jobs';
			env.sources[0].emit('jobs', {});
			assert.strictEqual(env.renderError.textContent, 'Status page error while rendering — see console');
			env.sources[0].emit('heartbeat');
			assert.strictEqual(env.renderError.hidden, true);
		}
		// Stall watchdog: a stream that stays open but goes silent is dropped after 35 s; heartbeats keep it alive.
		{
			const env = build();
			env.api.connectJobEvents();
			env.sources[0].emit('open');
			env.clock.now += 1000;
			env.sources[0].emit('heartbeat');
			assert.strictEqual(env.refreshes, 0);
			// Heartbeats every 15 s for ten minutes: the 1 s ticker never fires the watchdog.
			for (let second = 1; second <= 600; second += 1) {
				env.clock.now += 1000;
				if (second % 15 === 0) env.sources[0].emit('heartbeat');
				assert.strictEqual(env.api.checkJobEventsStall(), false, 'healthy stream at +' + second + ' s');
			}
			assert.strictEqual(env.sources.length, 1);
			assert.strictEqual(env.open().length, 1);
			assert.strictEqual(env.api.state().jobEventsLive, true);
			assert.strictEqual(env.refreshes, 0, 'no polling while heartbeats arrive');
			assert.strictEqual(env.timeouts.size, 0);
			// Heartbeats stop (process suspended): still fine at 35 s, stalled right after.
			const silentFrom = env.clock.now;
			env.clock.now = silentFrom + 35000;
			assert.strictEqual(env.api.checkJobEventsStall(), false, 'exactly 35 s of silence is not yet a stall');
			env.clock.now = silentFrom + 36000;
			env.connection.length = 0;
			assert.strictEqual(env.api.checkJobEventsStall(), true);
			const state = env.api.state();
			assert.strictEqual(env.sources[0].closed, true, 'the stalled stream is closed');
			assert.strictEqual(state.jobEvents, null);
			assert.strictEqual(state.jobEventsLive, false);
			assert.ok(state.fallbackPollTimer, 'fallback polling started');
			assert.strictEqual(env.refreshes, 1, 'polling starts with an immediate refresh');
			assert.strictEqual(env.timeouts.size, 1, 'a reconnect is scheduled');
			assert.strictEqual(env.connection[env.connection.length - 1][1], 'Polling fallback');
			// Repeated ticks do nothing more.
			assert.strictEqual(env.api.checkJobEventsStall(), false);
			assert.strictEqual(env.refreshes, 1);
			assert.strictEqual(env.timeouts.size, 1);
			assert.strictEqual(env.intervals.size, 1);
			// The reconnect uses the normal backoff and keeps a single EventSource.
			assert.strictEqual(env.fireRetry(), 2000);
			assert.strictEqual(env.sources.length, 2);
			assert.strictEqual(env.open().length, 1);
			// A new stream that opens but stays silent is judged from its open time, not from the old lastGoodAt.
			env.sources[1].emit('open');
			assert.strictEqual(env.api.checkJobEventsStall(), false, 'a fresh stream is not stalled at once');
			env.clock.now += 36000;
			assert.strictEqual(env.api.checkJobEventsStall(), true);
			assert.strictEqual(env.sources[1].closed, true);
			assert.strictEqual(env.open().length, 0);
			// Events of the closed stalled stream are ignored.
			env.sources[1].emit('heartbeat');
			assert.strictEqual(env.api.state().jobEventsLive, false);
		}
		// The ticker runs the watchdog.
		assert.ok(/function tickElapsedCells\(\) \{\s*checkJobEventsStall\(\);/.test(script), 'tickElapsedCells checks for a stalled stream');
		assert.ok(script.includes('setInterval(tickElapsedCells, 1000);'));
		// A hard error shows the Relay as unreachable until the stream delivers again.
		{
			const env = build();
			env.api.connectJobEvents();
			env.sources[0].emit('open');
			env.sources[0].emit('jobs', {});
			for (let i = 0; i < 3; i += 1) env.api.recordStatusFailure(new Error('down'));
			env.api.applyConnectionView();
			assert.deepStrictEqual(env.connection[env.connection.length - 1], ['error', 'Relay unreachable']);
			assert.ok(env.updated.textContent.startsWith('Relay unreachable — last update'));
			env.sources[0].emit('status', { success: true });
			assert.deepStrictEqual(env.connection[env.connection.length - 1], ['ok', 'Connected']);
			assert.deepStrictEqual(env.rendered.status[env.rendered.status.length - 1], [{ success: true }, true]);
		}
		// Drop -> polling fallback + scheduled reconnect with backoff; reconnect -> live again, polling stops.
		{
			const env = build();
			env.api.connectJobEvents();
			const first = env.sources[0];
			first.emit('open');
			env.connection.length = 0;
			first.fail();
			let state = env.api.state();
			assert.ok(first.closed && state.jobEvents === null && state.jobEventsLive === false, 'the dropped stream is closed and forgotten');
			assert.deepStrictEqual(env.connection, [['warn', 'Polling fallback']]);
			assert.strictEqual(env.refreshes, 1, 'polling starts with an immediate refresh');
			Array.from(env.intervals.values())[0].fn();
			assert.deepStrictEqual(env.refreshArgs, [undefined, { timer: true }], 'the 5 s poll is timer-driven (skipped while a status request is pending); the first refresh is explicit');
			assert.strictEqual(env.intervals.size, 1);
			assert.strictEqual(Array.from(env.intervals.values())[0].ms, 5000, 'polling every 5 s');
			assert.ok(state.jobEventsRetryTimer, 'a reconnect is scheduled');
			assert.strictEqual(env.timeouts.size, 1);
			const pollId = state.fallbackPollTimer;
			// Backoff: 2 s, 4 s, 8 s, 16 s, 30 s, 30 s while the server stays down; exactly one stream exists at any time.
			const delays = [];
			for (let attempt = 0; attempt < 6; attempt += 1) {
				delays.push(env.fireRetry());
				assert.strictEqual(env.sources.length, attempt + 2, 'every retry opens one new stream');
				assert.strictEqual(env.open().length, 1, 'never more than one live EventSource');
				assert.strictEqual(env.api.state().jobEvents, env.sources[env.sources.length - 1]);
				env.sources[env.sources.length - 1].fail();
				assert.strictEqual(env.open().length, 0);
				assert.strictEqual(env.timeouts.size, 1, 'one retry pending');
				assert.strictEqual(env.api.state().fallbackPollTimer, pollId, 'the same polling timer keeps running (no second one)');
				assert.strictEqual(env.intervals.size, 1);
			}
			assert.deepStrictEqual(delays, [2000, 4000, 8000, 16000, 30000, 30000], 'backoff grows and is capped at 30 s');
			// The server is back: the next retry opens and stays open.
			assert.strictEqual(env.fireRetry(), 30000);
			const live = env.sources[env.sources.length - 1];
			env.connection.length = 0;
			live.emit('open');
			state = env.api.state();
			assert.strictEqual(state.jobEventsLive, true, 'back to live updates');
			assert.deepStrictEqual(env.connection, [['ok', 'Connected']], 'the pill says Connected again, not Polling fallback');
			assert.strictEqual(state.fallbackPollTimer, null, 'polling stops once the stream is back');
			assert.strictEqual(env.intervals.size, 0);
			assert.ok(env.cleared.includes(pollId), 'the polling interval was cleared');
			assert.strictEqual(state.jobEventsRetryDelay, 2000, 'the backoff resets after a successful connect');
			assert.strictEqual(env.timeouts.size, 0, 'no reconnect is pending while live');
			assert.strictEqual(env.open().length, 1);
			// A later drop starts over at 2 s.
			live.fail();
			assert.strictEqual(env.fireRetry(), 2000);
			assert.strictEqual(env.intervals.size, 1, 'polling resumes during the new outage');
		}
		// Events of a stream that was replaced or closed are ignored.
		{
			const env = build();
			env.api.connectJobEvents();
			const old = env.sources[0];
			old.fail();
			env.fireRetry();
			assert.strictEqual(env.sources.length, 2);
			old.emit('status', { success: true });
			old.emit('jobs', { running_count: 3 });
			old.emit('open');
			old.fail();
			assert.deepStrictEqual(env.rendered.status, [], 'a stale stream renders nothing');
			assert.deepStrictEqual(env.rendered.jobs, []);
			assert.strictEqual(env.api.state().jobEvents, env.sources[1], 'a stale error does not close the current stream');
			assert.strictEqual(env.sources[1].closed, false);
			assert.strictEqual(env.api.state().jobEventsLive, false, 'a stale open does not make the page live');
		}
		// Reconnecting twice while a retry is pending or a stream exists never schedules or opens a second one.
		{
			const env = build();
			env.api.connectJobEvents();
			env.sources[0].fail();
			env.api.scheduleJobEventsReconnect();
			env.api.scheduleJobEventsReconnect();
			assert.strictEqual(env.timeouts.size, 1, 'a pending retry is not duplicated');
			env.api.connectJobEvents();
			assert.strictEqual(env.sources.length, 2, 'connecting by hand replaces the pending retry with a stream');
			assert.strictEqual(env.timeouts.size, 0, 'and cancels that retry');
			env.api.scheduleJobEventsReconnect();
			assert.strictEqual(env.timeouts.size, 0, 'no retry is scheduled while a stream exists');
		}
		// No EventSource support: polling only. A constructor that throws falls back and retries.
		{
			const env = build({ noEventSource: true });
			env.api.connectJobEvents();
			assert.strictEqual(env.sources.length, 0);
			assert.strictEqual(env.intervals.size, 1, 'polling is the only update path');
			assert.strictEqual(env.timeouts.size, 0, 'nothing to retry without EventSource');
			const throwing = build({ throwOnCreate: true });
			throwing.api.connectJobEvents();
			assert.strictEqual(throwing.intervals.size, 1);
			assert.strictEqual(throwing.timeouts.size, 1, 'a failing constructor still schedules a retry');
			assert.strictEqual(throwing.fireRetry(), 2000);
			assert.strictEqual(throwing.intervals.size, 1, 'still a single polling timer');
		}
		assert.ok(script.includes('refresh().then(connectJobEvents)'), 'the stream is opened after the first refresh');
	}

	// ---- Local engine pages: sticky Save / Discard bars ----
	{
		for (const [prefix, form, save, discard] of [['asr', 'asrSettingsForm', 'saveAsrSettings', 'discardAsrSettings'], ['image', 'imageSettingsForm', 'saveImageSettings', 'discardImageSettings'], ['upscale', 'upscaleSettingsForm', 'saveUpscaleSettings', 'discardUpscaleSettings'], ['music', 'musicAnalysisSettingsForm', 'saveMusicAnalysisSettings', 'discardMusicAnalysisSettings']]) {
			const start = html.indexOf('id="' + form + '"');
			const formHtml = html.slice(start, html.indexOf('</form>', start));
			assert.ok(new RegExp('<div class="save-bar" id="' + prefix + 'SaveBar" role="region" aria-label="Unsaved [A-Za-z ]+ changes" hidden>').test(formHtml), prefix + ' form has a hidden sticky bar');
			assert.ok(formHtml.includes('id="' + prefix + 'SaveBarText" aria-live="polite"') && formHtml.includes('id="' + discard + '">Discard</button>') && formHtml.includes('class="btn-primary" id="' + save + '" disabled>Save settings</button>'), prefix + ' bar holds Discard and Save');
			assert.ok(formHtml.indexOf('class="save-bar"') > formHtml.indexOf('class="settings-actions"'), prefix + ' bar comes after the form actions');
			assert.strictEqual((html.match(new RegExp('id="' + save + '"', 'g')) || []).length, 1, save + ' exists once');
		}
		const fields = { asrSaveBar: { hidden: true }, musicSaveBar: { hidden: true }, upscaleSaveBar: { hidden: true }, imageSaveBar: { hidden: true }, relaySaveBar: { hidden: true }, runtimeSaveBar: { hidden: true } };
		const dirty = { asr: false, music: false, upscale: false, image: false, relay: false, runtime: false };
		const update = load(['updateSettingsDirtyState'], ['fields', 'navBadge', 'isFormDirty'], '', [fields, () => null, (key) => dirty[key]], 'updateSettingsDirtyState');
		update();
		assert.ok(Object.values(fields).every((field) => field.hidden), 'no bar while every form is clean');
		dirty.upscale = true;
		update();
		assert.deepStrictEqual(Object.entries(fields).filter(([, field]) => !field.hidden).map(([key]) => key), ['upscaleSaveBar'], 'only the dirty page shows its bar');
		dirty.upscale = false; dirty.asr = true; dirty.image = true; dirty.music = true;
		update();
		assert.deepStrictEqual(Object.entries(fields).filter(([, field]) => !field.hidden).map(([key]) => key).sort(), ['asrSaveBar', 'imageSaveBar', 'musicSaveBar']);
		dirty.asr = false; dirty.image = false; dirty.music = false;
		update();
		assert.ok(Object.values(fields).every((field) => field.hidden), 'bars hide again when the form matches the loaded settings');

		// Discard puts each form back to what it last loaded or saved, and re-baselines it.
		const calls = [];
		const messages = { asrSettingsMessage: { textContent: 'Unsaved changes' }, musicAnalysisSettingsMessage: { textContent: 'Unsaved changes' }, upscaleSettingsMessage: { textContent: 'Unsaved changes' }, imageSettingsMessage: { textContent: 'Unsaved changes' } };
		const baselines = { asr: { settings: { a: 1 } }, music: { settings: { m: 1 } }, upscale: { settings: { u: 1 }, models: ['um'] }, image: { settings: { i: 1 }, models: ['im'], resolutionChoices: ['rc'] } };
		const discard = load(['discardEngineSettings'], ['fields', 'engineBaselines', 'renderAsrSettingsForm', 'renderMusicAnalysisSettings', 'renderUpscaleSettings', 'renderImageSettings', 'captureFormSnapshots'], '', [messages, baselines,
			(settings) => calls.push(['asr', settings]), (settings) => calls.push(['music', settings]), (settings, models) => calls.push(['upscale', settings, models]), (settings, models, choices) => calls.push(['image', settings, models, choices]), (keys) => calls.push(['capture', keys])], 'discardEngineSettings');
		assert.strictEqual(discard('asr'), true);
		assert.strictEqual(discard('music'), true);
		assert.strictEqual(discard('upscale'), true);
		assert.strictEqual(discard('image'), true);
		assert.deepStrictEqual(calls, [['asr', { a: 1 }], ['capture', ['asr']], ['music', { m: 1 }], ['capture', ['music']], ['upscale', { u: 1 }, ['um']], ['capture', ['upscale']], ['image', { i: 1 }, ['im'], ['rc']], ['capture', ['image']]]);
		assert.ok(Object.values(messages).every((message) => message.textContent === 'Changes discarded'));
		assert.strictEqual(discard('bogus'), false);
		baselines.asr = null;
		assert.strictEqual(discard('asr'), false, 'nothing to restore before the first load');
		// The baselines are taken in every load and save path.
		for (const marker of ['engineBaselines.asr = { settings: currentAsrSettings };', 'engineBaselines.music = { settings: currentMusicAnalysisSettings };', 'engineBaselines.upscale = { settings: currentUpscaleSettings, models: payload.models || [] };', 'engineBaselines.image = { settings: currentImageSettings, models: payload.models || [], resolutionChoices }']) assert.ok(script.includes(marker), marker);
		assert.strictEqual((script.match(/engineBaselines\.asr = /g) || []).length, 2, 'ASR baseline after load and after save');
		assert.strictEqual((script.match(/engineBaselines\.music = /g) || []).length, 2);
		assert.strictEqual((script.match(/engineBaselines\.upscale = /g) || []).length, 2);
		assert.strictEqual((script.match(/engineBaselines\.image = /g) || []).length, 2);
	}

	// ---- Stored-value warnings appear right after the settings load ----
	{
		const validated = [];
		const snapshots = { relay: '', runtime: '' };
		const build = (throwing) => load(['captureFormSnapshots'], ['formSnapshots', 'fields', 'collectRelaySettingsPayload', 'serializeAsrSettingsForm', 'serializeMusicAnalysisSettings', 'serializeUpscaleSettings', 'serializeImageSettings', 'updateSettingsDirtyState', 'validateRelaySection'],
			'', [snapshots, { relaySettingsForm: {}, relayRuntimeSettings: {} }, (section) => ({ section }), () => ({}), () => ({}), () => ({}), () => ({}), () => {}, (section) => { validated.push(section); if (throwing) throw new Error('boom'); }], 'captureFormSnapshots');
		build(false)(['relay']);
		assert.deepStrictEqual(validated, ['relay'], 'loading the relay form shows its stored-value warnings');
		assert.strictEqual(snapshots.relay, JSON.stringify({ section: 'relay' }), 'the baseline is the collected payload');
		build(false)(['runtime']);
		assert.deepStrictEqual(validated, ['relay', 'runtime']);
		build(false)(['asr', 'image']);
		assert.deepStrictEqual(validated, ['relay', 'runtime'], 'other pages do not validate');
		assert.doesNotThrow(() => build(true)(['relay', 'runtime']), 'a validation error never breaks loading');
	}
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
	assert.ok(script.includes("selectProviderTestTab('provider-test-tab-chat', { skipHash: true })"));
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

	// (c2) The Test button inside a provider card runs the same chat flow (same endpoint, default prompt) and shows the reply,
	// usage, and error compactly in the card; it survives re-renders and is not locked by Run all.
	{
		const env = build();
		const markupFns = new Function(['text', 'escapeHtml', 'chatTestImageField', 'providerCardChatTestMarkup'].map(extractPageFunction).join('\n') + '\nreturn { providerCardChatTestMarkup };')();
		const chatBackend = { id: 'api-b', label: 'API B <x>', kind: 'driver', provider_kind: 'api', ready: true, job_types: ['chat'] };
		const inCard = env.dom.makeContainer();
		const mount = (markup) => { inCard.innerHTML = markup.replace(/^<div /, '<article ').replace(/<\/div>$/, '</article>'); return inCard.cards[0]; };
		let card = mount(markupFns.providerCardChatTestMarkup(chatBackend, [{ id: 'm-api', type: 'text', backend: 'api-b' }]));
		const button = card.els['[data-provider-test]'];
		assert.strictEqual(button.dataset.providerTest, 'chat');
		assert.strictEqual(button.dataset.model, 'm-api');
		assert.strictEqual(card.dataset.testJobType, 'chat');
		assert.strictEqual(card.els['[data-test-prompt]'].value, 'Reply with exactly: OK', 'the default prompt is used');
		assert.strictEqual(card.els['[data-chat-max-tokens]'].value, '256');
		assert.ok(card.markup.includes('API B &lt;x&gt;') && !card.markup.includes('<x>'), 'the provider label is escaped');
		await ticking(env, () => env.api.runProviderMediaTest(button));
		assert.strictEqual(env.posted.length, 1, 'one request to the existing test endpoint');
		assert.strictEqual(env.posted[0].job_type, 'chat');
		assert.strictEqual(env.posted[0].model, 'm-api');
		assert.strictEqual(env.posted[0].prompt, 'Reply with exactly: OK');
		assert.strictEqual(env.posted[0].max_tokens, 256);
		assert.ok(result(card).includes('provider-chat-reply') && result(card).includes('OK-' + env.posted[0].test_request_id), 'the reply is shown in the card');
		assert.ok(result(card).includes('Tokens (prompt / completion / total): 5 / 1 / 6') && result(card).includes('Model: m'), 'usage is shown compactly');
		assert.strictEqual(card.dataset.testOutcome, 'passed');
		assert.strictEqual(card.els['[data-test-message]'].textContent, 'Completed. The reply is shown below.');
		assert.strictEqual(button.disabled, false, 'the button is usable again after the test');
		// Run all only drives the Tests tab: it never locks the buttons inside provider cards.
		env.chatRunAll.running = true;
		env.api.restoreProviderTestButton(card);
		assert.strictEqual(button.disabled, false, 'Run all does not lock an in-card test');
		const tabCard = env.chatCards()[0];
		tabCard.els['[data-provider-test]'].disabled = false;
		env.api.restoreProviderTestButton(tabCard);
		assert.strictEqual(tabCard.els['[data-provider-test]'].disabled, true, 'but it still locks the Tests tab cards');
		env.chatRunAll.running = false;
		// A rejected request reports the error compactly in the same card.
		const failing = build({ post: 'validation' });
		const failMount = failing.dom.makeContainer();
		failMount.innerHTML = markupFns.providerCardChatTestMarkup(chatBackend, [{ id: 'm-api', type: 'text', backend: 'api-b' }]).replace(/^<div /, '<article ').replace(/<\/div>$/, '</article>');
		const failCard = failMount.cards[0];
		await ticking(failing, () => failing.api.runProviderMediaTest(failCard.els['[data-provider-test]']));
		assert.ok(result(failCard).includes('Bad request.') && failCard.dataset.testOutcome === 'failed', 'an error shows in the card');
		// Empty prompt: nothing is sent.
		failCard.els['[data-test-prompt]'].value = '   ';
		const sent = failing.posted.length;
		await ticking(failing, () => failing.api.runProviderMediaTest(failCard.els['[data-provider-test]']));
		assert.strictEqual(failing.posted.length, sent);
		assert.ok(failCard.els['[data-test-message]'].textContent.includes('Enter a test prompt'));
		// Several chat models give a model select whose value is sent as the model.
		const multi = markupFns.providerCardChatTestMarkup(chatBackend, [{ id: 'm1', type: 'text', backend: 'api-b' }, { id: 'm2<b>', type: 'text', backend: 'api-b' }]);
		assert.ok(multi.includes('<select data-test-option="model"><option value="m1" selected>m1</option><option value="m2&lt;b&gt;">m2&lt;b&gt;</option></select>') && !multi.includes('<b>'));
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
			if (post === 'badgateway') return { ok: false, status: 502, json: async () => ({ success: false, category: 'upstream', code: 'upstream_failed', message: 'Upstream provider returned 502.' }) };
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
		const overrides = { statusUrl: '/status', capabilitiesUrl: '/caps', currentCapabilities: {}, setConnection: noop, retryRelaySettingsLoad: noop, renderCapabilities: noop, setPill: noop, renderDetails: () => '', renderAsrDetails: noop,
			updateHealthCards: (payload, ok) => env.health.push({ success: payload.success, ok }), renderDebugHealth: noop, updateProviderRefreshState: noop, captureSessionOutputScrolls: () => [],
			renderLiveJobList: (jobs) => env.live.push(jobs), livePinned: false, selectedLiveRequestId: '', renderLiveDetail: noop, findJobByRequestId: () => null, seenLiveRequestIds: new Set(), pendingLiveJob: () => null,
			autoSelectLiveJob: noop, updateTabBadges: (jobs) => env.badges.push(jobs), renderDebugFailures: (jobs) => env.debug.push(jobs), applyRawStatusFilter: noop, queueRestoreSessionOutputScrolls: noop };
		env.api = loadProviderTestApi({ fields, chatRunAll: env.chatRunAll, document: dom.document, fetch, currentStatus: { jobs: { active: [], queued: [], recent: [] } }, override: overrides, extra: ['refresh', 'refreshStatusOnce', 'handleStatusPollFailure', 'recordStatusSuccess', 'recordStatusFailure', 'connectionView', 'applyConnectionView', 'statusReachable', 'reportRenderError', 'guardedRender', 'renderStatus', 'renderJobs', 'relayPillInfo', 'codexPillInfo', 'isCodexChecking'] });
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
		assert.deepStrictEqual(env.health[env.health.length - 1], { success: true, ok: true }, 'a first failed refresh keeps the last good picture on screen');
		for (let i = 0; i < 3; i += 1) await env.api.refresh();
		assert.deepStrictEqual(env.health[env.health.length - 1], { success: false, ok: false }, 'health consumers see the failure once it persists');
		assert.ok(first.dataset.testRequestId && first.dataset.testContinuing === '1', 'the persistent failure does not evict the followed job either');
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
		// One failed (or slow) poll keeps the last good picture; the tracker already treats the feed as stale.
		assert.strictEqual(env.api.getStatus().success, true, 'a single failed refresh keeps the last good status');
		assert.notStrictEqual(env.fields.jobCounts.textContent, 'Running 0 / Queued 0');
		assert.strictEqual(card.els['[data-test-message]'].textContent, 'Relay unreachable — waiting for status…', 'but the card knows the feed is stale');
		for (let i = 0; i < 3; i += 1) await env.api.refresh();
		const status = env.api.getStatus();
		assert.strictEqual(status.success, false, 'a persistent failure shows the error state');
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
				env.api.connectionState.sseLive = true;
				await env.api.runProviderMediaTest(card.els['[data-provider-test]']);
				await tickUntil(env, () => !card.dataset.testRequestId, 150);
				assert.ok(card.dataset.testRequestId, 'still following after 150 s while a detection refresh is active');
				assert.ok(env.statusFetches > 0, 'the ticker polled');
				assert.ok(env.fields.updated.textContent.startsWith('Live updates on'), 'with the stream live, the ticker poll keeps the live-status text instead of "Polled"');
				env.refreshActive = false;
				await tickUntil(env, () => !card.dataset.testRequestId, 50);
				assert.ok(card.dataset.testRequestId, 'the clock restarts when the refresh ends, so no give-up after 50 s');
				await tickUntil(env, () => !card.dataset.testRequestId, 30);
				assert.ok(!card.dataset.testRequestId, 'given up about 60 s after the refresh ended');
				assert.strictEqual(card.els['[data-test-message]'].textContent, notFound);
				assert.ok(env.fields.updated.textContent.startsWith('Live updates on'));
				await env.api.refresh();
				assert.ok(env.fields.updated.textContent.startsWith('Live updates on · updated'), 'a regular refresh with the stream live is still live');
				env.api.connectionState.sseLive = false;
				await env.api.refresh();
				assert.ok(env.fields.updated.textContent.startsWith('Polled · updated'), 'without a live stream a healthy poll says Polled');
				env.api.connectionState.sseLive = true;
				await env.api.refresh({ silent: true });
				assert.ok(env.fields.updated.textContent.startsWith('Live updates on'), 'a silent refresh does not report "Polled" while the stream is live');
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

	// An HTTP error (502) from the test endpoint, where no job was created and the status feed is healthy: the failure report is
	// final. The refreshes around it must not write "Submitting provider test…" / "Submitting · 0s" next to the error.
	{
		const env = buildFeed({ post: 'badgateway' });
		const [card] = env.cards();
		const writes = [];
		for (const key of ['[data-test-progress]', '[data-test-message]']) {
			const node = card.els[key];
			let value = node.textContent;
			Object.defineProperty(node, 'textContent', { get: () => value, set: (next) => { value = next; writes.push(String(next)); } });
		}
		assert.strictEqual(await within(env.run(() => env.api.runProviderMediaTest(card.els['[data-provider-test]']))), 'done');
		const message = 'Upstream provider returned 502.';
		assert.strictEqual(card.els['[data-test-message]'].textContent, message);
		assert.ok(/^Failed · \d/.test(card.els['[data-test-progress]'].textContent), 'progress ends as Failed · <elapsed>: ' + card.els['[data-test-progress]'].textContent);
		const lastFailed = writes.lastIndexOf(message);
		assert.ok(lastFailed >= 0 && writes.slice(lastFailed).every((entry) => !entry.startsWith('Submitting')), 'nothing replaces the report with a Submitting text afterwards: ' + JSON.stringify(writes));
		assert.ok(!writes.some((entry, index) => index > writes.findIndex((value) => value.startsWith('Failed')) && entry.startsWith('Submitting')));
		assert.ok(!card.dataset.testRequestId && !card.dataset.testContinuing && !card.dataset.testStartedAt, 'the test state is cleared');
		assert.strictEqual(card.dataset.testOutcome, 'failed');
		assert.ok(result(card).includes(message));
		assert.strictEqual(card.els['[data-provider-test]'].disabled, false);
		// Later status refreshes and ticks do not touch it either.
		await env.api.refresh();
		env.api.updateProviderTestProgress();
		assert.ok(/^Failed/.test(card.els['[data-test-progress]'].textContent) && card.els['[data-test-message]'].textContent === message);
	}
})().then(() => {
	console.log('status page tests passed');
}, (error) => {
	console.error(error);
	process.exit(1);
});

// Detection-run button state: real status-cache broadcasts are fed into the extracted updateProviderRefreshState.
(async () => {
	const { createStatusCache } = require('../src/status-cache');
	const foreignMessage = /const foreignRefreshMessage = [^;]+;/.exec(providerTestScript);
	assert.ok(foreignMessage, 'the neutral foreign-run message is defined');
	const ownMessages = /const ownRefreshMessages = \[[^\]]*\];/.exec(providerTestScript);
	assert.ok(ownMessages, 'the page-owned checking messages are defined');
	const makeEnv = ({ formRendered = true } = {}) => {
		const env = { loads: 0, timerCleared: 0, snapshots: [], resolvers: [] };
		env.button = { disabled: false, textContent: 'Refresh detection', dataset: {} };
		env.message = { textContent: 'Routing settings loaded' };
		env.update = new Function('fields', 'loadRelaySettings', 'clearInterval',
			'let settingsLoaded = true; let providerFormRendered = ' + formRendered + '; let providerRefreshPollTimer = 7; let providerRefreshLastSeenId = 0; let providerRefreshLastSeenStart = 0; let providerRefreshDoneId = 0; let providerRefreshDoneStart = 0;\n' + foreignMessage[0] + '\n' + ownMessages[0] + '\n' + ['refreshStartMs', 'refreshCompletionText', 'updateProviderRefreshState'].map(extractPageFunction).join('\n') + '\nreturn updateProviderRefreshState;')(
			{ refreshRelayProviders: env.button, relaySettingsMessage: env.message }, (options) => { env.loads += 1; env.loadOptions = options; }, () => { env.timerCleared += 1; });
		const backends = {
			list: () => [{ id: 'codex-cli', checkStatus: () => ({ success: true, message: 'ok' }), capabilities: () => ({ details: {}, features: {} }) }],
			capabilities: () => [],
			refresh: () => new Promise((resolve) => env.resolvers.push(resolve)),
		};
		// One simulated Relay process: its broadcasts are what the page receives as the status "refresh" object.
		env.relay = () => {
			const cache = createStatusCache({ backends, codex: {}, musicAnalysis: { capabilities: () => ({}) }, mediaAnalysis: { capabilities: () => ({}) }, video: { capabilities: () => ({}) }, jobManager: { snapshot: () => ({}) } }, (status) => { env.snapshots.push(status.refresh); env.update(status.refresh); });
			return {
				// The Relay starts a detection run by itself (settings save, startup); the returned function finishes it.
				run: async () => {
					const pending = cache.refresh();
					return async () => { env.resolvers.shift()(); await pending; };
				},
			};
		};
		return env;
	};

	// A run the page did not start: busy while active, fully restored when it ends, and no completion text for it.
	{
		const env = makeEnv();
		const finish = await env.relay().run();
		assert.strictEqual(env.snapshots[0].active, true);
		assert.strictEqual(env.button.disabled, true);
		assert.strictEqual(env.button.textContent, 'Checking…');
		assert.strictEqual(env.message.textContent, 'Checking providers…', 'neutral wording, not the page-started text');
		await finish();
		assert.strictEqual(env.snapshots[env.snapshots.length - 1].active, false);
		assert.strictEqual(env.button.disabled, false, 'a foreign run end re-enables the button');
		assert.strictEqual(env.button.textContent, 'Refresh detection');
		assert.strictEqual(env.message.textContent, 'Routing settings loaded', 'the previous message comes back');
		assert.strictEqual(env.loads, 0, 'a foreign completion does not trigger a settings reload');
		assert.strictEqual(env.button.dataset.refreshId, undefined);
		assert.strictEqual(env.button.dataset.refreshNotice, undefined);
	}
	// A save message set while a foreign run is active (or just before it) is never replaced by the neutral text.
	{
		const env = makeEnv();
		const relay = env.relay();
		let finish = await relay.run();
		env.message.textContent = 'Settings saved';
		await finish();
		assert.strictEqual(env.message.textContent, 'Settings saved', 'a message written during the run survives it');
		finish = await relay.run();
		assert.strictEqual(env.button.disabled, true);
		await finish();
		assert.strictEqual(env.message.textContent, 'Settings saved', 'a save message from before the run is put back');
		assert.strictEqual(env.button.disabled, false);
	}
	// A run this page started keeps its own wording and ends with the completion summary and a settings reload.
	{
		const env = makeEnv();
		env.button.disabled = true;
		env.button.textContent = 'Checking…';
		env.button.dataset.refreshId = '1';
		env.message.textContent = 'CLI paths saved; checking providers in background…';
		const finish = await env.relay().run();
		assert.strictEqual(env.message.textContent, 'CLI paths saved; checking providers in background…', 'the save text is not replaced while the run is active');
		assert.strictEqual(env.button.disabled, true);
		await finish();
		assert.ok(env.message.textContent.startsWith('Detection refreshed '), env.message.textContent);
		assert.strictEqual(env.button.disabled, false);
		assert.strictEqual(env.button.textContent, 'Refresh detection');
		assert.strictEqual(env.button.dataset.refreshId, undefined);
		assert.strictEqual(env.loads, 1);
	}
	// A failed page-started run reports the error.
	{
		const env = makeEnv();
		env.button.dataset.refreshId = '1';
		env.update({ active: true, id: 1 });
		env.update({ active: false, id: 1, error: 'boom' });
		assert.strictEqual(env.message.textContent, 'Detection refresh failed: boom');
		assert.strictEqual(env.button.disabled, false);
	}
	// Ids start over after a Relay restart: a tracked id higher than anything the new process reports cannot block the button.
	{
		const env = makeEnv();
		const first = env.relay();
		for (let i = 0; i < 5; i += 1) await (await first.run())();
		const finish6 = await first.run();
		env.button.dataset.refreshId = '6'; // the page started run 6
		assert.strictEqual(env.snapshots[env.snapshots.length - 1].id, 6);
		assert.strictEqual(env.button.disabled, true);
		// The Relay restarts before run 6 ends; the new process starts counting at 1 again.
		env.resolvers.length = 0;
		const second = env.relay();
		const finish1 = await second.run();
		assert.strictEqual(env.snapshots[env.snapshots.length - 1].id, 1);
		assert.strictEqual(env.button.dataset.refreshId, undefined, 'the stale tracked id is dropped');
		assert.strictEqual(env.button.disabled, true, 'run 1 is active');
		await finish1();
		assert.strictEqual(env.button.disabled, false, 'the button is not stuck behind id 6');
		assert.strictEqual(env.button.textContent, 'Refresh detection');
		void finish6;
	}
	// The completed page-started run reloads the settings without replacing "Detection refreshed ..." by "Routing settings loaded".
	{
		const env = makeEnv();
		env.button.dataset.refreshId = '3';
		env.update({ active: true, id: 3 });
		env.update({ active: false, id: 3, completed_at: '2026-10-17T10:00:00Z' });
		assert.ok(env.message.textContent.startsWith('Detection refreshed '));
		assert.strictEqual(env.loads, 1);
		assert.deepStrictEqual(env.loadOptions, { keepMessage: true }, 'the reload that follows a detection run keeps the completion message');
	}
	// The page's own "checking" text never outlives the run it describes.
	{
		const checking = 'Checking providers in background…';
		const owned = (id = 2) => {
			const env = makeEnv();
			env.button.disabled = true;
			env.button.textContent = 'Checking…';
			env.button.dataset.refreshId = String(id);
			env.message.textContent = checking;
			return env;
		};
		const done = { completed_at: '2026-10-17T10:00:00Z' };
		const clean = (env, label) => {
			assert.strictEqual(env.button.disabled, false, label + ': the button is enabled');
			assert.strictEqual(env.button.textContent, 'Refresh detection', label);
			assert.ok(!/checking/i.test(env.message.textContent), label + ': no checking text is left: ' + env.message.textContent);
			assert.strictEqual(env.button.dataset.refreshNotice, undefined, label);
		};
		// A restarted Relay (ids start over, no start times to compare) drops ownership; the new process's run ends it all.
		{
			const env = owned();
			env.update({ id: 2, active: true });
			env.update({ id: 1, active: true });
			assert.strictEqual(env.message.textContent, 'Checking providers…', 'the neutral wording takes over once the tracked run is gone');
			env.update({ id: 1, active: false, ...done });
			clean(env, 'restart mid-run');
			assert.ok(env.message.textContent.startsWith('Detection refreshed '), env.message.textContent);
		}
		// The same with a snapshot that is already finished: the stale own text is replaced on ANY inactive snapshot.
		{
			const env = owned();
			env.update({ id: 2, active: true });
			env.update({ id: 1, active: false, ...done });
			clean(env, 'restart, only the finished snapshot arrives');
		}
		// A lower id with a start time older than the run being followed is a late answer, not a restart.
		{
			const env = owned();
			env.update({ id: 2, active: true, started_at: '2026-10-17T10:00:10Z' });
			env.update({ id: 1, active: true, started_at: '2026-10-17T10:00:00Z' });
			assert.strictEqual(env.message.textContent, checking, 'a stale answer changes nothing');
			assert.strictEqual(env.button.dataset.refreshId, '2');
			env.update({ id: 2, active: false, started_at: '2026-10-17T10:00:10Z', ...done });
			clean(env, 'stale lower id');
			assert.strictEqual(env.loads, 1, 'the page-started run still ends with a settings reload');
		}
		// A lower id with a later start time is a restarted Relay.
		{
			const env = owned();
			env.update({ id: 2, active: true, started_at: '2026-10-17T10:00:00Z' });
			env.update({ id: 1, active: true, started_at: '2026-10-17T10:05:00Z' });
			assert.strictEqual(env.button.dataset.refreshId, undefined, 'ownership of the dead process run is dropped');
			assert.strictEqual(env.message.textContent, 'Checking providers…');
			env.update({ id: 1, active: false, started_at: '2026-10-17T10:05:00Z', ...done });
			clean(env, 'restart with start times');
		}
		// Without start times, a lower id arriving while run 2 is followed is ambiguous; whichever it was, nothing stays stuck.
		{
			const env = owned();
			env.update({ id: 2, active: true });
			env.update({ id: 1, active: true });
			env.update({ id: 2, active: false, ...done });
			clean(env, 'late lower-id reply during run 2');
		}
		// A late "active" answer for a run that already finished must not disable the button again.
		{
			const env = owned();
			env.update({ id: 2, active: true });
			env.update({ id: 2, active: false, ...done });
			clean(env, 'completed');
			env.update({ id: 2, active: true });
			clean(env, 'late active reply after completion');
			env.update({ id: 1, active: true });
			clean(env, 'late lower active reply after completion');
			// A genuinely new run is still followed.
			env.update({ id: 3, active: true });
			assert.strictEqual(env.button.disabled, true);
			env.update({ id: 3, active: false, ...done });
			clean(env, 'next run');
		}
		// After a completed run a restarted Relay (earlier id, later start time) is recognised and followed.
		{
			const env = owned(5);
			env.update({ id: 5, active: true, started_at: '2026-10-17T10:00:00Z' });
			env.update({ id: 5, active: false, started_at: '2026-10-17T10:00:00Z', ...done });
			env.update({ id: 1, active: true, started_at: '2026-10-17T11:00:00Z' });
			assert.strictEqual(env.button.disabled, true, 'run 1 of the new process is followed');
			env.update({ id: 1, active: false, started_at: '2026-10-17T11:00:00Z', ...done });
			clean(env, 'restart after a completed run');
		}
		// The inactive rule holds for a page-owned text even when the run was never tracked (nothing replaced it).
		{
			const env = makeEnv();
			env.message.textContent = 'CLI paths saved; checking providers in background…';
			env.update({ id: 4, active: false, ...done });
			assert.ok(env.message.textContent.startsWith('Detection refreshed '), env.message.textContent);
		}
	}
	// While the page is still starting a run (saving paths, posting), snapshots do not release the button.
	{
		const env = makeEnv();
		env.button.disabled = true;
		env.button.textContent = 'Checking…';
		env.button.dataset.refreshStarting = '1';
		env.update({ active: false, id: 3 });
		assert.strictEqual(env.button.disabled, true);
		assert.strictEqual(env.button.textContent, 'Checking…');
	}
	// A late snapshot older than the run the page started is ignored.
	{
		const env = makeEnv();
		env.update({ active: false, id: 4 });
		env.button.disabled = true;
		env.button.dataset.refreshId = '5';
		env.update({ active: false, id: 4 });
		assert.strictEqual(env.button.disabled, true);
		assert.strictEqual(env.button.dataset.refreshId, '5');
	}
	// Before the provider form ever loaded the button stays disabled when a run ends (the first render enables it).
	{
		const env = makeEnv({ formRendered: false });
		env.button.disabled = true;
		const finish = await env.relay().run();
		await finish();
		assert.strictEqual(env.button.disabled, true);
		assert.strictEqual(env.button.textContent, 'Refresh detection');
	}
	// refreshProviderDetection holds the "starting" guard while it saves and posts, and always releases it.
	{
		const run = async (rendered, fetchImpl, saveImpl) => {
			const button = { disabled: false, textContent: 'Refresh detection', dataset: {} };
			const seen = [];
			const fn = new Function('fields', 'saveRelaySettings', 'fetch', 'pollProviderRefresh', 'setInterval', 'clearInterval', 'cliPathsEdited',
				RELAY_LOAD_STATE + 'let providerFormRendered = ' + rendered + '; let providerRefreshPollTimer = null;\n' + extractPageFunction('fetchJsonWithTimeout') + '\n' + extractPageFunction('refreshProviderDetection') + '\nreturn refreshProviderDetection;')(
				{ refreshRelayProviders: button, relaySettingsMessage: { textContent: '' } }, async () => { seen.push(button.dataset.refreshStarting); return saveImpl(); },
				async () => { seen.push(button.dataset.refreshStarting); return fetchImpl(); }, () => {}, () => 1, () => {}, () => true);
			await fn();
			return { button, seen };
		};
		let result = await run(true, async () => ({ ok: true, json: async () => ({ refresh: { id: 2 } }) }), async () => ({ success: true }));
		assert.deepStrictEqual(result.seen, ['1', '1']);
		assert.strictEqual(result.button.dataset.refreshStarting, undefined);
		assert.strictEqual(result.button.dataset.refreshId, '2');
		result = await run(true, async () => ({ ok: true, json: async () => ({}) }), async () => ({ success: false, message: 'nope' }));
		assert.strictEqual(result.button.dataset.refreshStarting, undefined, 'released after a failed save');
		assert.strictEqual(result.button.disabled, false);
	}
})().catch((error) => { console.error(error); process.exit(1); });

// Provider settings loading: a failed first load is retried while the form is empty and can be reloaded by hand.
(async () => {
	assert.ok(/<button type="button" id="reloadRelaySettings">Reload<\/button>/.test(html), 'the Providers header has a Reload button that is enabled from the start');
	assert.ok(html.indexOf('id="reloadRelaySettings"') < html.indexOf('id="refreshRelayProviders"'), 'Reload sits next to Refresh detection');
	assert.ok(html.includes('loadRelaySettings({ manual: true })'), 'the Reload button reloads the settings');
	const escapeHtml = new Function(extractPageFunction('text') + '\n' + extractPageFunction('escapeHtml') + '\nreturn escapeHtml;')();
	const makeEnv = ({ responses, rendered = false, buttonDisabled = true }) => {
		const env = { now: 10000, fetches: 0, renders: 0, timers: fakeTimers(), fetchInits: [] };
		env.fields = { refreshRelayProviders: { disabled: buttonDisabled }, relaySettingsMessage: { textContent: 'Loading routing settings' }, providerSettings: { innerHTML: '<div class="empty-state">Loading providers</div>' } };
		const fetch = async (url, init) => {
			env.fetches += 1;
			env.fetchInits.push(init);
			const next = responses[Math.min(env.fetches, responses.length) - 1];
			if (next.hang) return new Promise(() => {});
			if (next.reject) throw new TypeError(next.reject);
			return { ok: next.ok !== false, status: next.status, json: async () => next.body || {} };
		};
		const prelude = RELAY_LOAD_STATE + 'let settingsLoaded = true; let providerFormRendered = ' + rendered + '; let relaySettingsLoading = false; let relaySettingsReloadQueued = false; let relaySettingsLastAttemptAt = 0; const relaySettingsRetryMs = 5000;\n'
			+ 'function renderRelaySettings() { providerFormRendered = true; env.renders += 1; }\n';
		const names = ['fetchJsonWithTimeout', 'cancelRelaySettingsRetry', 'scheduleRelaySettingsRetry', 'loadRelaySettings', 'retryRelaySettingsLoad'];
		env.api = new Function('env', 'fields', 'fetch', 'Date', 'setTimeout', 'clearTimeout', 'relaySettingsUrl', 'relayFormEdits', 'captureRelayFocus', 'captureFormSnapshots', 'reapplyRelayEdits', 'updateSettingsDirtyState', 'restoreRelayFocus', 'escapeHtml',
			prelude + names.map(extractPageFunction).join('\n') + '\nreturn { loadRelaySettings, retryRelaySettingsLoad, rendered: () => providerFormRendered, retryPending: () => relaySettingsRetryTimer !== null, noteSave: () => { relaySettingsSaveGeneration += 1; } };')(
			env, env.fields, fetch, { now: () => env.now }, (fn, ms) => env.timers.setTimeout(fn, ms), (id) => env.timers.clearTimeout(id), '/v1/relay/settings', () => ({}), () => null, () => {}, () => {}, () => {}, () => {}, escapeHtml);
		return env;
	};

	// The first load fails: the reason is shown inline (even though Refresh detection is still disabled) and the form stays unloaded.
	{
		const env = makeEnv({ responses: [{ ok: false, status: 500, body: { message: 'Settings store <locked>' } }, { reject: 'Failed to fetch' }, { body: { settings: {} } }] });
		await env.api.loadRelaySettings();
		assert.strictEqual(env.api.rendered(), false);
		assert.ok(env.fields.providerSettings.innerHTML.includes('role="alert"') && env.fields.providerSettings.innerHTML.includes('Settings store &lt;locked&gt;'), env.fields.providerSettings.innerHTML);
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Routing settings load failed: Settings store <locked>');
		// The failed load schedules its own retry (5 s), so an SSE-connected page - which never polls - still retries.
		assert.deepStrictEqual(env.timers.pendingDelays(), [5000], 'one retry timer');
		assert.ok(env.api.retryPending());
		// The status poll hook leaves a scheduled retry alone: no double retries.
		env.now += 60000;
		env.api.retryRelaySettingsLoad();
		await delay(0);
		assert.strictEqual(env.fetches, 1, 'the polling hook does not retry while a retry is scheduled');
		assert.strictEqual(env.timers.pending(), 1);
		await env.timers.advance(4999);
		assert.strictEqual(env.fetches, 1);
		await env.timers.advance(1);
		assert.strictEqual(env.fetches, 2, 'retried after 5 s');
		assert.ok(env.fields.relaySettingsMessage.textContent.includes('Failed to fetch'), env.fields.relaySettingsMessage.textContent);
		assert.deepStrictEqual(env.timers.pendingDelays(), [10000], 'backoff doubles');
		await env.timers.advance(10000);
		assert.strictEqual(env.fetches, 3);
		assert.strictEqual(env.api.rendered(), true, 'the form loads once the Relay answers');
		assert.strictEqual(env.renders, 1);
		assert.strictEqual(env.timers.pending(), 0, 'no timer is left after a successful load');
		env.now += 60000;
		env.api.retryRelaySettingsLoad();
		await env.timers.advance(60000);
		assert.strictEqual(env.fetches, 3, 'no retries once the form is loaded');
	}
	// Backoff goes 5 s, 10 s, 20 s, 30 s and stays at 30 s; there is never more than one timer.
	{
		const env = makeEnv({ responses: [{ reject: 'down' }] });
		await env.api.loadRelaySettings();
		const seen = [];
		for (let i = 0; i < 6; i += 1) {
			seen.push(env.timers.pendingDelays().join());
			assert.strictEqual(env.timers.pending(), 1);
			await env.timers.advance(env.timers.pendingDelays()[0]);
		}
		assert.deepStrictEqual(seen, ['5000', '10000', '20000', '30000', '30000', '30000']);
		assert.strictEqual(env.fetches, 7);
	}
	// A manual Reload replaces the scheduled retry and restarts the backoff; success clears it.
	{
		const env = makeEnv({ responses: [{ reject: 'down' }, { reject: 'down' }, { reject: 'down' }, { body: { settings: {} } }] });
		await env.api.loadRelaySettings();
		await env.timers.advance(5000);
		assert.deepStrictEqual(env.timers.pendingDelays(), [10000]);
		await env.api.loadRelaySettings({ manual: true });
		assert.strictEqual(env.fetches, 3);
		assert.deepStrictEqual(env.timers.pendingDelays(), [5000], 'the manual attempt restarted the backoff and left a single timer');
		await env.api.loadRelaySettings({ manual: true });
		assert.strictEqual(env.api.rendered(), true);
		assert.strictEqual(env.timers.pending(), 0, 'a successful manual reload cancels the pending retry');
	}
	// The polling hook still fills in when no retry is scheduled, throttled to 5 s.
	{
		const env = makeEnv({ responses: [{ body: { settings: {} } }] });
		env.api.retryRelaySettingsLoad();
		await delay(5);
		assert.strictEqual(env.fetches, 1);
		assert.strictEqual(env.api.rendered(), true);
	}
	// No retry before the page first asked for the settings.
	{
		const loads = new Function('let settingsLoaded = false; let providerFormRendered = false; let relaySettingsLoading = false; let relaySettingsLastAttemptAt = 0; const relaySettingsRetryMs = 5000; let loads = 0; function loadRelaySettings() { loads += 1; }\n' + extractPageFunction('retryRelaySettingsLoad') + '\nretryRelaySettingsLoad(); return loads;')();
		assert.strictEqual(loads, 0);
	}
	// The manual Reload works while Refresh detection is still disabled, announces itself, and reports a failure reason.
	{
		const env = makeEnv({ responses: [{ reject: 'connect ECONNREFUSED' }, { body: { settings: {} } }] });
		await env.api.loadRelaySettings();
		assert.ok(env.fields.relaySettingsMessage.textContent.includes('connect ECONNREFUSED'));
		env.fields.refreshRelayProviders.disabled = false;
		const manual = env.api.loadRelaySettings({ manual: true });
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Reloading routing settings…');
		await manual;
		assert.strictEqual(env.api.rendered(), true);
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Routing settings loaded');
	}
	// A reload requested while one is in flight is queued, not dropped and not run in parallel.
	{
		const env = makeEnv({ responses: [{ body: {} }], rendered: true, buttonDisabled: false });
		const first = env.api.loadRelaySettings();
		const second = env.api.loadRelaySettings({ manual: true });
		await Promise.all([first, second]);
		await delay(5);
		assert.strictEqual(env.fetches, 2, 'one request after the other');
	}
	// A stale answer (a save finished while the GET was in flight) is discarded and re-asked with the options queued meanwhile
	// merged in, not replaced: a detection run's keepMessage survives.
	{
		const env = makeEnv({ responses: [{ body: { settings: {} } }, { body: { settings: {} } }], rendered: true, buttonDisabled: false });
		env.fields.relaySettingsMessage.textContent = 'Detection refreshed 10:00:00';
		const first = env.api.loadRelaySettings();
		const queued = env.api.loadRelaySettings({ keepMessage: true });
		env.api.noteSave();
		await Promise.all([first, queued]);
		await delay(10);
		assert.strictEqual(env.fetches, 2, 'the discarded answer is asked for again');
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Detection refreshed 10:00:00', 'keepMessage queued during the stale GET is not lost');
	}

	// A settings GET that hangs is abandoned after 15 s: the loading flag is released, the reason is shown, and the retry goes on.
	{
		const env = makeEnv({ responses: [{ hang: true }, { body: { settings: {} } }] });
		const loading = env.api.loadRelaySettings();
		await delay(0);
		assert.ok(env.fetchInits[0].signal, 'the request carries an abort signal');
		await env.timers.advance(14999);
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Loading routing settings', 'still waiting at 14.999 s');
		await env.timers.advance(1);
		await loading;
		assert.strictEqual(env.fetchInits[0].signal.aborted, true, 'the hung request is aborted');
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Routing settings load failed: Loading routing settings timed out after 15 s');
		assert.ok(env.fields.providerSettings.innerHTML.includes('timed out after 15 s'));
		assert.deepStrictEqual(env.timers.pendingDelays(), [5000], 'the busy flag is free and the automatic retry is scheduled');
		await env.timers.advance(5000);
		assert.strictEqual(env.api.rendered(), true, 'the retry loads the form');
	}
	// A reload after a detection run keeps "Detection refreshed ..."; any other reload still says "Routing settings loaded".
	{
		const env = makeEnv({ responses: [{ body: {} }], rendered: true, buttonDisabled: false });
		env.fields.relaySettingsMessage.textContent = 'Detection refreshed 10:00:00';
		await env.api.loadRelaySettings({ keepMessage: true });
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Detection refreshed 10:00:00');
		await env.api.loadRelaySettings();
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Routing settings loaded');
		// A manual Reload queued behind it still reports itself.
		env.fields.relaySettingsMessage.textContent = 'Detection refreshed 10:00:00';
		const first = env.api.loadRelaySettings({ keepMessage: true });
		const second = env.api.loadRelaySettings({ manual: true });
		await Promise.all([first, second]);
		await delay(5);
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Routing settings loaded');
		// A queued load that merely follows a detection run keeps the message.
		env.fields.relaySettingsMessage.textContent = 'Detection refreshed 10:00:00';
		const a = env.api.loadRelaySettings({ keepMessage: true });
		const b = env.api.loadRelaySettings({ keepMessage: true });
		await Promise.all([a, b]);
		await delay(5);
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'Detection refreshed 10:00:00');
	}
	// A save that finishes while a GET is in flight makes that answer stale: it is not rendered and one more GET is made.
	{
		const env = makeEnv({ responses: [{ body: {} }], rendered: true, buttonDisabled: false });
		const first = env.api.loadRelaySettings();
		env.api.noteSave();
		await first;
		await delay(5);
		assert.strictEqual(env.fetches, 2, 'asked again');
		assert.strictEqual(env.renders, 1, 'only the fresh answer was rendered');
	}
	// An already loaded form keeps its content and just reports a failed reload (no error panel replaces the form).
	{
		const env = makeEnv({ responses: [{ reject: 'offline' }], rendered: true, buttonDisabled: false });
		await env.api.loadRelaySettings({ manual: true });
		assert.ok(env.fields.providerSettings.innerHTML.includes('Loading providers'), 'the rendered form is not replaced');
		assert.strictEqual(env.fields.relaySettingsMessage.textContent, 'offline');
	}
})().catch((error) => { console.error(error); process.exit(1); });
