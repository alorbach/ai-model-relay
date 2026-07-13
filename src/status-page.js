'use strict';

const { PRODUCT_NAME, LEGACY_PRODUCT_NAME } = require('./brand');

function statusPageHtml() {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${PRODUCT_NAME} Status</title>
	<style>
		:root {
			color-scheme: dark;
			--bg: #0b0f14;
			--panel: #121923;
			--panel-2: #172231;
			--line: #263445;
			--text: #edf4fb;
			--muted: #9cadbf;
			--ok: #34d399;
			--warn: #fbbf24;
			--bad: #fb7185;
			--info: #60a5fa;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			background: var(--bg);
			color: var(--text);
			font: 14px/1.45 "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
			overflow-x: hidden;
		}
		main {
			width: min(1120px, calc(100vw - 32px));
			margin: 24px auto;
			overflow-x: hidden;
		}
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
			margin-bottom: 18px;
		}
		h1 {
			margin: 0;
			font-size: 24px;
			font-weight: 650;
			letter-spacing: 0;
		}
		.updated {
			color: var(--muted);
			font-size: 12px;
			white-space: nowrap;
		}
		.status-meta {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			flex-wrap: wrap;
			gap: 8px;
		}
		.connection-pill {
			font-size: 12px;
			padding: 5px 9px;
		}
		.grid {
			display: grid;
			grid-template-columns: repeat(12, 1fr);
			gap: 12px;
			min-width: 0;
		}
		.panel {
			background: var(--panel);
			border: 1px solid var(--line);
			border-radius: 8px;
			padding: 14px;
			min-width: 0;
			max-width: 100%;
			overflow: hidden;
		}
		.span-4 { grid-column: span 4; }
		.span-6 { grid-column: span 6; }
		.span-12 { grid-column: span 12; }
		.label {
			color: var(--muted);
			font-size: 12px;
			margin-bottom: 6px;
		}
		.value {
			font-size: 18px;
			font-weight: 650;
			overflow-wrap: anywhere;
		}
		.pill {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			border-radius: 999px;
			padding: 6px 10px;
			background: var(--panel-2);
			border: 1px solid var(--line);
			font-weight: 650;
		}
		.dot {
			width: 9px;
			height: 9px;
			border-radius: 50%;
			background: var(--muted);
		}
		.ok .dot { background: var(--ok); }
		.warn .dot { background: var(--warn); }
		.bad .dot { background: var(--bad); }
		.status-text {
			font-weight: 650;
		}
		.status-completed { color: var(--ok); }
		.status-failed { color: var(--bad); }
		.status-running { color: var(--info); }
		.status-queued { color: var(--warn); }
		.table {
			width: 100%;
			border-collapse: collapse;
			table-layout: fixed;
		}
		.table th,
		.table td {
			border-bottom: 1px solid var(--line);
			padding: 9px 8px;
			text-align: left;
			vertical-align: top;
			overflow-wrap: anywhere;
			word-break: break-word;
		}
		.table th {
			color: var(--muted);
			font-size: 12px;
			font-weight: 600;
		}
		.table tr:last-child td { border-bottom: 0; }
		.muted { color: var(--muted); }
		.help-list {
			margin: 0;
			padding-left: 18px;
			color: var(--muted);
		}
		.help-list li { margin: 4px 0; }
		.feature-grid {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 8px;
		}
		.feature-pill {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			min-width: 0;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 9px 10px;
		}
		.feature-pill .name {
			flex: 1 1 auto;
			min-width: 0;
			overflow-wrap: anywhere;
		}
		.feature-pill .state {
			flex: 0 0 auto;
			max-width: 10rem;
			overflow-wrap: anywhere;
			color: var(--muted);
			font-size: 12px;
			font-weight: 650;
		}
		.feature-pill.enabled .state { color: var(--ok); }
		.feature-pill.disabled .state { color: var(--bad); }
		.session-output-block {
			min-width: 0;
			border: 1px solid var(--line);
			border-radius: 8px;
			background: #0e1520;
			margin-bottom: 10px;
		}
		.session-output-summary {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding: 10px 12px;
			cursor: pointer;
			list-style: none;
			user-select: none;
		}
		.session-output-summary::-webkit-details-marker {
			display: none;
		}
		.session-output-summary::before {
			content: ">";
			flex: 0 0 auto;
			color: var(--text);
			transition: transform 0.15s ease;
		}
		.session-output-block[open] .session-output-summary::before {
			transform: rotate(90deg);
		}
		.session-output-summary .label {
			margin: 0 auto 0 0;
		}
		.copy-session-output {
			appearance: none;
			border: 1px solid var(--line);
			border-radius: 6px;
			background: var(--panel-2);
			color: var(--text);
			cursor: pointer;
			font: inherit;
			font-size: 12px;
			line-height: 1;
			padding: 7px 10px;
			white-space: nowrap;
		}
		.copy-value {
			appearance: none;
			border: 1px solid var(--line);
			border-radius: 5px;
			background: #0e1520;
			color: #d7e7ff;
			cursor: pointer;
			font: inherit;
			font-size: 12px;
			padding: 2px 6px;
			max-width: 100%;
			overflow-wrap: anywhere;
			text-align: left;
		}
		.copy-session-output:hover,
		.copy-session-output:focus-visible,
		.copy-value:hover,
		.copy-value:focus-visible {
			border-color: var(--info);
			outline: none;
		}
		details.panel {
			padding: 0;
		}
		summary {
			cursor: pointer;
			list-style: none;
			padding: 14px;
			color: var(--muted);
			font-size: 12px;
			user-select: none;
		}
		summary::-webkit-details-marker { display: none; }
		summary::before {
			content: ">";
			display: inline-block;
			margin-right: 8px;
			color: var(--text);
			transition: transform 0.15s ease;
		}
		details[open] summary::before {
			transform: rotate(90deg);
		}
		code {
			color: #d7e7ff;
			background: #0e1520;
			border: 1px solid var(--line);
			border-radius: 5px;
			padding: 2px 5px;
			overflow-wrap: anywhere;
		}
		pre {
			margin: 0;
			padding: 12px;
			background: #0e1520;
			border: 1px solid var(--line);
			border-radius: 8px;
			color: #d7e7ff;
			overflow: auto;
			max-height: 320px;
			font-size: 12px;
			max-width: 100%;
			white-space: pre-wrap;
			overflow-wrap: anywhere;
			word-break: break-word;
		}
		.session-output {
			border-width: 1px 0 0;
			border-radius: 0 0 8px 8px;
			max-height: none;
		}
		.live-session-output {
			scroll-behavior: smooth;
		}
		.raw-status {
			border-width: 1px 0 0;
			border-radius: 0;
			max-height: 420px;
		}
		.raw-actions {
			display: flex;
			justify-content: flex-end;
			padding: 0 14px 12px;
		}
		.settings-editor {
			display: grid;
			gap: 14px;
		}
		.settings-grid {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 10px;
		}
		.field {
			display: grid;
			gap: 5px;
			min-width: 0;
		}
		.field span,
		.checkbox-row span {
			color: var(--muted);
			font-size: 12px;
			font-weight: 600;
		}
		.field input,
		.field select,
		.settings-editor textarea {
			width: 100%;
			background: #0e1520;
			border: 1px solid var(--line);
			color: #d7e7ff;
			border-radius: 6px;
			font: inherit;
			padding: 8px 9px;
			min-width: 0;
		}
		.settings-editor textarea {
			min-height: 220px;
			resize: vertical;
			font: 12px/1.45 Consolas, "SFMono-Regular", monospace;
		}
		.checkbox-row {
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 9px 10px;
		}
		.checkbox-row input {
			flex: 0 0 auto;
		}
		.model-settings-grid {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 10px;
		}
		.model-settings-card {
			display: grid;
			gap: 8px;
			background: var(--panel-2);
			border: 1px solid var(--line);
			border-radius: 8px;
			padding: 12px;
			min-width: 0;
		}
		.model-settings-card .model-heading {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			font-weight: 650;
			overflow-wrap: anywhere;
		}
		.settings-advanced {
			border: 1px solid var(--line);
			border-radius: 8px;
			background: var(--panel-2);
		}
		.settings-advanced summary {
			padding: 10px 12px;
		}
		.settings-advanced textarea {
			border-width: 1px 0 0;
			border-radius: 0 0 8px 8px;
		}
		.settings-actions {
			display: flex;
			align-items: center;
			gap: 10px;
			justify-content: flex-end;
		}
		.settings-actions .label {
			margin-right: auto;
			margin-bottom: 0;
		}
		.settings-actions button {
			appearance: none;
			border: 1px solid var(--line);
			border-radius: 6px;
			background: var(--panel-2);
			color: var(--text);
			cursor: pointer;
			font: inherit;
			font-size: 12px;
			padding: 8px 11px;
		}
		.settings-actions button:hover,
		.settings-actions button:focus-visible {
			border-color: var(--info);
			outline: none;
		}
		.tabs {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
			border-bottom: 1px solid var(--line);
			overflow-x: auto;
		}
		.tab-button {
			appearance: none;
			border: 1px solid transparent;
			border-bottom: 0;
			border-radius: 8px 8px 0 0;
			background: transparent;
			color: var(--muted);
			cursor: pointer;
			font: inherit;
			font-weight: 650;
			padding: 10px 13px;
			white-space: nowrap;
		}
		.tab-button:hover,
		.tab-button:focus-visible {
			color: var(--text);
			outline: none;
		}
		.tab-button[aria-selected="true"] {
			background: var(--panel);
			border-color: var(--line);
			color: var(--text);
		}
		.tab-panel[hidden] {
			display: none;
		}
		@media (max-width: 760px) {
			main { width: min(100% - 20px, 1080px); margin-top: 12px; }
			header { align-items: flex-start; flex-direction: column; }
			.status-meta { justify-content: flex-start; }
			.tabs { gap: 4px; }
			.tab-button { padding: 9px 10px; }
			.span-4,
			.span-6 { grid-column: span 12; }
			.feature-grid { grid-template-columns: 1fr; }
			.settings-grid,
			.model-settings-grid { grid-template-columns: 1fr; }
			.table { display: block; overflow-x: auto; }
		}
	</style>
</head>
<body>
	<main>
		<header>
			<div>
				<h1>${PRODUCT_NAME}</h1>
				<div class="updated">formerly ${LEGACY_PRODUCT_NAME}</div>
			</div>
			<div class="status-meta">
				<span class="pill connection-pill warn" id="connectionPill"><span class="dot"></span><span>Connecting</span></span>
				<div class="updated" id="updated">Loading</div>
				<div class="updated" id="lastEvent">No live events yet</div>
			</div>
		</header>
		<nav class="tabs" role="tablist" aria-label="Status page sections">
			<button class="tab-button" type="button" role="tab" id="tab-overview" aria-controls="panel-overview" aria-selected="true">Overview</button>
			<button class="tab-button" type="button" role="tab" id="tab-live" aria-controls="panel-live" aria-selected="false" tabindex="-1">Live</button>
			<button class="tab-button" type="button" role="tab" id="tab-settings" aria-controls="panel-settings" aria-selected="false" tabindex="-1">Settings</button>
			<button class="tab-button" type="button" role="tab" id="tab-debug" aria-controls="panel-debug" aria-selected="false" tabindex="-1">Debug</button>
		</nav>
		<section class="tab-panel grid" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
			<div class="panel span-4">
				<div class="label">Bridge</div>
				<div class="value"><span class="pill" id="bridgePill"><span class="dot"></span><span>Checking</span></span></div>
			</div>
			<div class="panel span-4">
				<div class="label">Codex</div>
				<div class="value"><span class="pill" id="codexPill"><span class="dot"></span><span>Checking</span></span></div>
			</div>
			<div class="panel span-4">
				<div class="label">Jobs</div>
				<div class="value" id="jobCounts">Running 0 / Queued 0</div>
			</div>
			<div class="panel span-6">
				<div class="label">Bridge Version</div>
				<div class="value" id="version">-</div>
			</div>
			<div class="panel span-6">
				<div class="label">Max Parallel Jobs</div>
				<div class="value" id="maxConcurrent">-</div>
			</div>
			<div class="panel span-6">
				<div class="label">Codex CLI Version</div>
				<div class="value" id="codexCliVersion">-</div>
			</div>
			<div class="panel span-6">
				<div class="label">Codex Binary</div>
				<div class="value"><code id="codexBinary">-</code></div>
			</div>
			<div class="panel span-12">
				<div class="label">Local ASR Runtime</div>
				<table class="table">
					<tbody id="asrDetails"><tr><td class="muted">Loading</td></tr></tbody>
				</table>
			</div>
		</section>
		<section class="tab-panel grid" id="panel-live" role="tabpanel" aria-labelledby="tab-live" hidden>
			<div class="panel span-12">
				<div class="label">Active Jobs</div>
				<table class="table">
					<thead><tr><th>Request</th><th>Type</th><th>Model</th><th>Provider / API</th><th>Workflow / Skill</th><th>Status</th><th>Elapsed</th></tr></thead>
					<tbody id="activeJobs"><tr><td colspan="7" class="muted">No active jobs</td></tr></tbody>
				</table>
			</div>
			<div class="panel span-12">
				<div class="label">Queued Jobs</div>
				<table class="table">
					<thead><tr><th>Request</th><th>Type</th><th>Model</th><th>Provider / API</th><th>Workflow / Skill</th><th>Status</th><th>Waited</th></tr></thead>
					<tbody id="queuedJobs"><tr><td colspan="7" class="muted">No queued jobs</td></tr></tbody>
				</table>
			</div>
			<div class="panel span-12">
				<div class="label">Recent Activity</div>
				<table class="table">
					<thead><tr><th>Request</th><th>Type</th><th>Model</th><th>Provider / API</th><th>Workflow / Skill</th><th>Status</th><th>Elapsed</th><th>Finished</th></tr></thead>
					<tbody id="recentActivity"><tr><td colspan="8" class="muted">No recent activity</td></tr></tbody>
				</table>
			</div>
		</section>
		<section class="tab-panel grid" id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" hidden>
			<div class="panel span-12">
				<div class="label">Providers and Model Routing</div>
				<div class="feature-grid" id="providerSettings">Loading providers</div>
				<form class="settings-editor" id="relaySettingsForm">
					<div class="settings-grid" id="relayDefaultSettings"></div>
					<div class="settings-actions"><span class="muted" id="relaySettingsMessage">Loading routing settings</span><button type="button" id="refreshRelayProviders">Refresh detection</button><button type="button" id="saveRelaySettings">Save routing</button></div>
				</form>
			</div>
			<div class="panel span-12">
				<div class="label">Local ASR Settings</div>
				<form class="settings-editor" id="asrSettingsForm">
					<div class="settings-grid" id="asrGeneralSettings"></div>
					<div>
						<div class="settings-actions">
							<span class="label">Models</span>
							<button type="button" id="addAsrModel">Add model</button>
						</div>
						<div class="model-settings-grid" id="asrModelSettings"></div>
					</div>
					<details class="settings-advanced">
						<summary>Advanced JSON</summary>
						<textarea id="asrSettingsJson" spellcheck="false"></textarea>
						<div class="settings-actions">
							<button type="button" id="applyAsrSettingsJson">Apply JSON to form</button>
						</div>
					</details>
					<div class="settings-actions">
						<span class="muted" id="asrSettingsMessage">Loading settings</span>
						<button type="button" id="reloadAsrSettings">Reload</button>
						<button type="button" id="refreshAsrRuntime">Refresh runtime</button>
						<button type="button" id="saveAsrSettings">Save settings</button>
					</div>
				</form>
			</div>
		</section>
		<section class="tab-panel grid" id="panel-debug" role="tabpanel" aria-labelledby="tab-debug" hidden>
			<div class="panel span-12">
				<div class="label">Detected Features</div>
				<div class="feature-grid" id="detectedFeatures"></div>
			</div>
			<div class="panel span-12">
				<div class="label">Backend Drivers</div>
				<div class="feature-grid" id="backendDrivers"></div>
			</div>
			<div class="panel span-12">
				<div class="label">Paired Sites</div>
				<div id="pairedSites" class="muted">None</div>
			</div>
			<div class="panel span-12">
				<div class="label">Debug Help</div>
				<ul class="help-list">
					<li>Check the Live tab after a request; recent jobs keep bounded Codex session output.</li>
					<li>Use the tray menu Copy diagnostics action for a safe diagnostic payload without bearer tokens.</li>
					<li>Run <code>codex login status</code> in the same Windows account as the tray app.</li>
					<li>Confirm the browser origin is paired and the request includes the bridge token.</li>
					<li>Use <code>/v1/status</code> for the raw status JSON included in failure debug output.</li>
				</ul>
			</div>
			<div class="panel span-12">
				<div class="label">Codex Details</div>
				<table class="table">
					<tbody id="codexDetails"></tbody>
				</table>
			</div>
			<details class="panel span-12">
				<summary>Raw Status</summary>
				<div class="raw-actions"><button type="button" class="copy-session-output" id="copyRawStatus">Copy diagnostics JSON</button></div>
				<pre class="raw-status" id="rawStatus">{}</pre>
			</details>
		</section>
	</main>
	<script>
		const statusUrl = '/v1/status';
		const capabilitiesUrl = '/v1/capabilities';
		const asrSettingsUrl = '/v1/asr/settings';
		const relaySettingsUrl = '/v1/relay/settings';
		const jobEventsUrl = '/v1/status/events';
		let currentStatus = {};
		let currentCapabilities = {};
		let currentAsrSettings = null;
		let settingsLoaded = false;
		let fallbackPollTimer = null;
		let providerRefreshPollTimer = null;
		let jobEvents = null;
		const fields = {
			tabButtons: Array.from(document.querySelectorAll('[role="tab"]')),
			tabPanels: Array.from(document.querySelectorAll('[role="tabpanel"]')),
			updated: document.getElementById('updated'),
			lastEvent: document.getElementById('lastEvent'),
			connectionPill: document.getElementById('connectionPill'),
			bridgePill: document.getElementById('bridgePill'),
			codexPill: document.getElementById('codexPill'),
			jobCounts: document.getElementById('jobCounts'),
			version: document.getElementById('version'),
			maxConcurrent: document.getElementById('maxConcurrent'),
			codexCliVersion: document.getElementById('codexCliVersion'),
			codexBinary: document.getElementById('codexBinary'),
			detectedFeatures: document.getElementById('detectedFeatures'),
			backendDrivers: document.getElementById('backendDrivers'),
			providerSettings: document.getElementById('providerSettings'),
			relaySettingsForm: document.getElementById('relaySettingsForm'),
			relayDefaultSettings: document.getElementById('relayDefaultSettings'),
			relaySettingsMessage: document.getElementById('relaySettingsMessage'),
			refreshRelayProviders: document.getElementById('refreshRelayProviders'),
			saveRelaySettings: document.getElementById('saveRelaySettings'),
			asrDetails: document.getElementById('asrDetails'),
			asrSettingsForm: document.getElementById('asrSettingsForm'),
			asrGeneralSettings: document.getElementById('asrGeneralSettings'),
			asrModelSettings: document.getElementById('asrModelSettings'),
			asrSettingsJson: document.getElementById('asrSettingsJson'),
			asrSettingsMessage: document.getElementById('asrSettingsMessage'),
			reloadAsrSettings: document.getElementById('reloadAsrSettings'),
			refreshAsrRuntime: document.getElementById('refreshAsrRuntime'),
			saveAsrSettings: document.getElementById('saveAsrSettings'),
			applyAsrSettingsJson: document.getElementById('applyAsrSettingsJson'),
			addAsrModel: document.getElementById('addAsrModel'),
			activeJobs: document.getElementById('activeJobs'),
			queuedJobs: document.getElementById('queuedJobs'),
			recentActivity: document.getElementById('recentActivity'),
			pairedSites: document.getElementById('pairedSites'),
			codexDetails: document.getElementById('codexDetails'),
			rawStatus: document.getElementById('rawStatus'),
			copyRawStatus: document.getElementById('copyRawStatus'),
		};

		function selectTab(tabId, options = {}) {
			const nextButton = fields.tabButtons.find((button) => button.id === tabId) || fields.tabButtons[0];
			if (!nextButton) {
				return;
			}
			const nextPanelId = nextButton.getAttribute('aria-controls');
			for (const button of fields.tabButtons) {
				const selected = button === nextButton;
				button.setAttribute('aria-selected', selected ? 'true' : 'false');
				button.tabIndex = selected ? 0 : -1;
			}
			for (const panel of fields.tabPanels) {
				panel.hidden = panel.id !== nextPanelId;
			}
			if (options.focus) {
				nextButton.focus();
			}
			if (nextButton.id === 'tab-settings' && !settingsLoaded) {
				settingsLoaded = true;
				loadAsrSettings();
				loadRelaySettings();
			}
		}

		function initTabs() {
			fields.tabButtons.forEach((button, index) => {
				button.addEventListener('click', () => selectTab(button.id));
				button.addEventListener('keydown', (event) => {
					if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
						return;
					}
					event.preventDefault();
					let nextIndex = index;
					if (event.key === 'Home') {
						nextIndex = 0;
					} else if (event.key === 'End') {
						nextIndex = fields.tabButtons.length - 1;
					} else {
						const direction = event.key === 'ArrowRight' ? 1 : -1;
						nextIndex = (index + direction + fields.tabButtons.length) % fields.tabButtons.length;
					}
					selectTab(fields.tabButtons[nextIndex].id, { focus: true });
				});
			});
			selectTab('tab-overview');
		}

		function text(value, fallback = '-') {
			const normalized = String(value ?? '').trim();
			return normalized || fallback;
		}

		function normalizeText(value) {
			return String(value || '')
				.replace(/\u00e2\u0080\u0098/g, "'")
				.replace(/\u00e2\u0080\u0099/g, "'")
				.replace(/\u00e2\u0080\u009c/g, '"')
				.replace(/\u00e2\u0080\u009d/g, '"')
				.replace(/\u00e2\u0080\u0093/g, '-')
				.replace(/\u00e2\u0080\u0094/g, '-')
				.replace(/\u00e2\u0080\u00a6/g, '...')
				.replace(/\u00c2\u00a0/g, ' ')
				.replace(/\u00c2/g, '');
		}

		function escapeHtml(value) {
			return text(value, '').replace(/[&<>"']/g, (char) => ({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			}[char]));
		}

		function elapsed(ms) {
			const seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
			const minutes = Math.floor(seconds / 60);
			return minutes > 0 ? minutes + 'm ' + (seconds % 60) + 's' : seconds + 's';
		}

		function setPill(element, state, label) {
			element.className = 'pill ' + state;
			element.querySelector('span:last-child').textContent = label;
		}

		function setConnection(state, label) {
			fields.connectionPill.className = 'pill connection-pill ' + state;
			fields.connectionPill.querySelector('span:last-child').textContent = label;
		}

		function markLiveEvent(label) {
			fields.lastEvent.textContent = label + ' event ' + new Date().toLocaleTimeString();
		}

		function requestButton(job) {
			const requestId = text(job.request_id || job.id || job.short_request_id);
			const label = text(job.short_request_id || job.request_id || job.id);
			return '<button type="button" class="copy-value" data-copy-value="' + escapeHtml(requestId) + '" title="Copy request id">' + escapeHtml(label) + '</button>';
		}

		function providerCell(job) {
			const provider = text(job.provider || 'Unknown');
			const label = text(job.provider_label || '');
			return '<td><code>' + escapeHtml(provider) + '</code>' + (label && label !== provider ? '<div class="muted">' + escapeHtml(label) + '</div>' : '') + '</td>';
		}

		function workflowCell(job) {
			const workflow = text(job.workflow || 'Pending');
			const skills = Array.isArray(job.skills) ? job.skills.filter(Boolean) : [];
			return '<td>' + escapeHtml(workflow) + (skills.length ? '<div class="muted">Skill: ' + escapeHtml(skills.join(', ')) + '</div>' : '') + '</td>';
		}

		function statusClass(status) {
			const normalized = String(status || '').toLowerCase();
			if (normalized === 'completed') {
				return 'status-completed';
			}
			if (normalized === 'failed') {
				return 'status-failed';
			}
			if (normalized === 'running') {
				return 'status-running';
			}
			if (normalized === 'queued') {
				return 'status-queued';
			}
			return '';
		}

		function statusText(status) {
			return '<span class="status-text ' + statusClass(status) + '">' + escapeHtml(status) + '</span>';
		}

		function elapsedSpan(job, live) {
			const base = Number(job.elapsed_ms || 0);
			return '<span class="elapsed" data-live-elapsed="' + (live ? 'true' : 'false') + '" data-elapsed-base="' + base + '" data-elapsed-captured="' + Date.now() + '">' + elapsed(base) + '</span>';
		}

		function sessionOutputBlock(label, options = {}) {
			const live = !!options.live;
			const key = text(options.key, '');
			return '<details class="session-output-block">' +
				'<summary class="session-output-summary">' +
					'<span class="label">' + escapeHtml(label) + '</span>' +
					'<button type="button" class="copy-session-output">Copy</button>' +
				'</summary>' +
				'<pre class="session-output' + (live ? ' live-session-output' : '') + '" data-session-key="' + escapeHtml(key) + '"></pre>' +
			'</details>';
		}

		function debugLogBlocks(job, key) {
			const logs = Array.isArray(job.debug_logs) ? job.debug_logs : [];
			const blocks = [];
			logs.forEach((log, index) => {
				const suffix = logs.length > 1 ? ' ' + (index + 1) : '';
				if (log.prompt) {
					blocks.push(sessionOutputBlock('Prompt' + suffix, { key: key + ':prompt:' + index }));
				}
				if (log.output) {
					blocks.push(sessionOutputBlock('AI Response' + suffix, { key: key + ':output:' + index }));
				}
			});
			return blocks.join('');
		}

		function updateDebugLogBlocks(row, job, key) {
			const logs = Array.isArray(job.debug_logs) ? job.debug_logs : [];
			const outputs = Array.from(row.querySelectorAll('.session-output'));
			const byKey = (value) => outputs.find((output) => output.dataset.sessionKey === value);
			logs.forEach((log, index) => {
				const promptOutput = byKey(key + ':prompt:' + index);
				if (promptOutput) {
					updateSessionOutput(promptOutput, log.prompt || '');
				}
				const responseOutput = byKey(key + ':output:' + index);
				if (responseOutput) {
					updateSessionOutput(responseOutput, log.output || '');
				}
			});
		}

		function rowFor(tbody, key, kind) {
			return Array.from(tbody.querySelectorAll('tr[data-session-row-key]')).find((row) => (
				row.dataset.sessionRowKey === key && row.dataset.sessionRowKind === kind
			));
		}

		function createSessionRow(key, kind) {
			const row = document.createElement('tr');
			row.dataset.sessionRowKey = key;
			row.dataset.sessionRowKind = kind;
			return row;
		}

		function jobKey(prefix, job) {
			return prefix + ':' + text(job.request_id || job.id || job.short_request_id);
		}

		function activeSummaryCells(job) {
			return '<td>' + requestButton(job) + '</td>' +
				'<td>' + escapeHtml(job.type) + '</td>' +
				'<td>' + escapeHtml(job.model) + '</td>' +
				providerCell(job) +
				workflowCell(job) +
				'<td>' + statusText(job.status) + '</td>' +
				'<td>' + elapsedSpan(job, true) + '</td>';
		}

		function queuedSummaryCells(job) {
			return '<td>' + requestButton(job) + '</td>' +
				'<td>' + escapeHtml(job.type) + '</td>' +
				'<td>' + escapeHtml(job.model) + '</td>' +
				providerCell(job) +
				workflowCell(job) +
				'<td>' + statusText(job.status || 'queued') + '</td>' +
				'<td>' + elapsedSpan(job, true) + '</td>';
		}

		function recentSummaryCells(job) {
			return '<td>' + requestButton(job) + '</td>' +
				'<td>' + escapeHtml(job.type) + '</td>' +
				'<td>' + escapeHtml(job.model) + '</td>' +
				providerCell(job) +
				workflowCell(job) +
				'<td>' + statusText(job.status) + (job.error_message ? '<div class="muted">' + escapeHtml(job.error_message) + '</div>' : '') + '</td>' +
				'<td>' + elapsedSpan(job, false) + '</td>' +
				'<td>' + (job.finished_at ? new Date(job.finished_at).toLocaleTimeString() : '-') + '</td>';
		}

		function updateSessionOutput(output, nextValue) {
			const next = normalizeText(text(nextValue, ''));
			const current = output.textContent || '';
			if (next === current) {
				return;
			}
			if (next.startsWith(current)) {
				output.appendChild(document.createTextNode(next.slice(current.length)));
				return;
			}
			output.textContent = next;
		}

		function renderJobTable(tbody, jobs, options) {
			const visibleJobs = options.filter ? jobs.filter(options.filter) : jobs;
			const colspan = Number(options.colspan || 5);
			if (!visibleJobs.length) {
				tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="muted">' + escapeHtml(options.emptyText) + '</td></tr>';
				return;
			}

			const wanted = new Set();
			Array.from(tbody.children).forEach((row) => {
				if (!row.dataset.sessionRowKey) {
					row.remove();
				}
			});

			for (const job of visibleJobs) {
				const key = jobKey(options.keyPrefix, job);
				wanted.add(key);

				let summaryRow = rowFor(tbody, key, 'summary');
				if (!summaryRow) {
					summaryRow = createSessionRow(key, 'summary');
				}
				summaryRow.innerHTML = options.summaryCells(job);
				tbody.appendChild(summaryRow);

				let outputRow = rowFor(tbody, key, 'output');
				const debugLogs = Array.isArray(job.debug_logs) ? job.debug_logs : [];
				const hasDebugOutput = debugLogs.some((log) => log && (log.prompt || log.output));
				const hasInput = !!job.session_input;
				const hasOutput = hasInput || !!job.session_output || hasDebugOutput;
				if (hasOutput) {
					const signature = JSON.stringify({
						input: !!job.session_input,
						session: !!job.session_output,
						debug: debugLogs.map((log) => [!!(log && log.prompt), !!(log && log.output)]),
					});
					if (!outputRow || outputRow.dataset.outputSignature !== signature) {
						if (!outputRow) {
							outputRow = createSessionRow(key, 'output');
						}
						outputRow.dataset.outputSignature = signature;
					let blocks = '';
						if (job.session_input) {
							blocks += sessionOutputBlock(options.inputLabel, { live: !!options.live, key: key + ':input' });
						}
						if (job.session_output) {
							blocks += sessionOutputBlock(options.outputLabel, {
								live: !!options.live,
								key: key + ':output',
							});
						}
						blocks += debugLogBlocks(job, key);
						outputRow.innerHTML = '<td colspan="' + colspan + '">' + blocks + '</td>';
					}
					tbody.appendChild(outputRow);
					if (job.session_output) {
						const output = Array.from(outputRow.querySelectorAll('.session-output')).find((item) => item.dataset.sessionKey === key + ':output');
						if (output) {
							updateSessionOutput(output, job.session_output);
						}
					}
					if (job.session_input) {
						const input = Array.from(outputRow.querySelectorAll('.session-output')).find((item) => item.dataset.sessionKey === key + ':input');
						if (input) updateSessionOutput(input, job.session_input);
					}
					if (hasDebugOutput) {
						updateDebugLogBlocks(outputRow, job, key);
					}
				} else if (outputRow) {
					outputRow.remove();
				}
			}

			Array.from(tbody.querySelectorAll('tr[data-session-row-key]')).forEach((row) => {
				if (!wanted.has(row.dataset.sessionRowKey)) {
					row.remove();
				}
			});
		}

		function renderActiveJobs(jobs) {
			renderJobTable(fields.activeJobs, jobs, {
				emptyText: 'No active jobs',
				keyPrefix: 'active',
				live: true,
				inputLabel: 'Live stdin',
				outputLabel: 'Live Session Output',
				summaryCells: activeSummaryCells,
				colspan: 7,
			});
		}

		function renderQueuedJobs(jobs) {
			renderJobTable(fields.queuedJobs, jobs, {
				emptyText: 'No queued jobs',
				keyPrefix: 'queued',
				live: true,
				inputLabel: 'Queued stdin',
				outputLabel: 'Queued Session Output',
				summaryCells: queuedSummaryCells,
				colspan: 7,
			});
		}

		function renderRecentActivity(jobs) {
			renderJobTable(fields.recentActivity, jobs, {
				emptyText: 'No recent activity',
				keyPrefix: 'recent',
				inputLabel: 'stdin',
				outputLabel: 'Session Output',
				summaryCells: recentSummaryCells,
				colspan: 8,
			});
		}

		function renderDetails(details) {
			const rows = [
				['Binary', details.codex_binary],
				['Home', details.codex_home],
				['Auth', details.auth_path],
				['Generated Images', details.generated_images_dir],
				['Version', details.version],
				['Login', details.login_status],
			];
			return rows.map(([label, value]) => '<tr><th>' + escapeHtml(label) + '</th><td><code>' + escapeHtml(value) + '</code></td></tr>').join('');
		}

		function renderAsrDetails(asr) {
			asr = asr || {};
			const runtime = asr.runtime || {};
			const python = runtime.python || {};
			const gpu = runtime.gpu || {};
			const selected = asr.selected || {};
			const checked = runtime.checked !== false && asr.runtime_checked !== false;
			const availability = (value, yes, no) => value === null || value === undefined ? 'Not checked' : (value ? yes : no);
			const torchCuda = runtime.qwen_torch_cuda || {};
			const torchCudaText = torchCuda.available === null || torchCuda.available === undefined
				? 'Not checked'
				: (torchCuda.available ? ((torchCuda.version || 'torch') + ' / CUDA ' + (torchCuda.cuda_version || '?') + ' / devices ' + (torchCuda.device_count || 0)) : (torchCuda.reason || 'Unavailable'));
			const rows = [
				['Runtime Check', checked ? (runtime.cached ? 'Cached' : 'Checked') : 'Not checked'],
				['Ready', availability(asr.ready, 'Yes', 'No')],
				['Auto Model', asr.auto_model],
				['Selected Device', selected.device ? selected.device + ' / ' + selected.compute_type : ''],
				['Selected Provider', selected.provider || ''],
				['Selected Model Path', selected.model_path],
				['Selected Aligner Path', selected.aligner_model_path || ''],
				['Python', checked ? (python.available ? python.command + ' ' + (python.version || '') : 'Not found') : 'Not checked'],
				['Venv', runtime.venv_python],
				['faster-whisper', availability(runtime.faster_whisper_installed, 'Installed', 'Missing')],
				['Qwen Python', checked && runtime.qwen_python ? (runtime.qwen_python.available ? runtime.qwen_python.command + ' ' + (runtime.qwen_python.version || '') : 'Not found') : 'Not checked'],
				['Qwen Venv', runtime.qwen_venv_python],
				['qwen-asr', availability(runtime.qwen_asr_installed, 'Installed', 'Missing')],
				['Qwen torch CUDA', torchCudaText],
				['ffmpeg', availability(runtime.ffmpeg_available, 'Available', 'Missing')],
				['ffprobe', availability(runtime.ffprobe_available, 'Available', 'Missing')],
				['GPU', gpu.available === null || gpu.available === undefined ? 'Not checked' : (gpu.available ? gpu.name + ' (' + gpu.free_mb + ' MB free / ' + gpu.total_mb + ' MB)' : 'Unavailable')],
			];
			fields.asrDetails.innerHTML = rows.map(([label, value]) => '<tr><th>' + escapeHtml(label) + '</th><td><code>' + escapeHtml(value) + '</code></td></tr>').join('');
		}

		function featureState(value) {
			if (value === null || value === undefined) {
				return 'disabled';
			}
			return value ? 'enabled' : 'disabled';
		}

		function featureLabel(value) {
			if (value === null || value === undefined) {
				return 'Not checked';
			}
			return value ? 'Yes' : 'No';
		}

		function featurePill(name, value) {
			const state = featureState(value);
			return '<div class="feature-pill ' + state + '">' +
				'<span class="name">' + escapeHtml(name) + '</span>' +
				'<span class="state">' + featureLabel(value) + '</span>' +
			'</div>';
		}

		function renderBackendDrivers(backends) {
			const items = Array.isArray(backends) ? backends : [];
			if (!items.length) {
				fields.backendDrivers.innerHTML = '<div class="muted">No backend metadata reported</div>';
				return;
			}
			fields.backendDrivers.innerHTML = items.map((backend) => {
				const ready = backend.ready === true || (backend.configured === true && backend.enabled !== false);
				const state = ready ? 'enabled' : 'disabled';
				const label = backend.ready === true ? 'Ready' : (backend.configured === false ? 'Not configured' : (backend.enabled === false ? 'Disabled' : 'Available'));
				const name = (backend.label || backend.id || 'Backend') + (backend.kind ? ' (' + backend.kind + ')' : '');
				return '<div class="feature-pill ' + state + '">' +
					'<span class="name">' + escapeHtml(name) + '</span>' +
					'<span class="state">' + escapeHtml(label) + '</span>' +
				'</div>';
			}).join('');
		}

		function renderCapabilities(payload) {
			currentCapabilities = payload || {};
			const codex = currentCapabilities.codex || {};
			const features = currentCapabilities.features || {};
			const video = currentCapabilities.video || {};
			const mediaAnalysis = currentCapabilities.media_analysis || {};
			fields.codexCliVersion.textContent = text(codex.version);
			fields.codexBinary.textContent = text(codex.binary);
			fields.detectedFeatures.innerHTML = [
				featurePill('Structured exec JSON', features.structured_exec_json),
				featurePill('Output schema', features.output_schema),
				featurePill('Image attachments', features.image_attachments),
				featurePill('Codex app server', features.app_server),
				featurePill('Local image generation', features.images),
				featurePill('Local ASR', currentCapabilities.asr && currentCapabilities.asr.enabled),
				featurePill('Local ASR ready', currentCapabilities.asr && currentCapabilities.asr.ready),
				featurePill('Media analysis route', mediaAnalysis.enabled),
				featurePill('ffmpeg frame extraction', mediaAnalysis.ffmpeg_available),
				featurePill('OpenAI video route', video.enabled),
				featurePill('Video API configured', video.configured),
			].join('');
			renderBackendDrivers(currentCapabilities.backends || []);
			renderAsrDetails(currentCapabilities.asr || {});
			currentStatus.capabilities = currentCapabilities;
			fields.rawStatus.textContent = JSON.stringify(currentStatus, null, 2);
		}

		function renderRelaySettings(payload) {
			const settings = payload && payload.settings || {};
			const defaults = settings.defaults || {};
			const models = Array.isArray(payload && payload.models) ? payload.models : [];
			const backends = Array.isArray(payload && payload.backends) ? payload.backends : (currentCapabilities.backends || []);
			fields.providerSettings.innerHTML = backends.map((backend) => {
				const status = backend.ready ? 'Ready' : (backend.state === 'not_authenticated' ? 'Not authenticated' : (backend.state === 'installed' ? 'Authentication unchecked' : (backend.installed === false ? 'Not installed' : 'Unavailable')));
				const features = Object.keys(backend.features || {}).filter((key) => backend.features[key]).join(', ') || (backend.job_types || []).join(', ') || 'No supported jobs';
				const detail = backend.version || backend.command || features;
				const diagnostic = backend.diagnostic && backend.diagnostic !== 'Ready.' && backend.diagnostic !== 'Authentication not checked yet.' ? '<br><small class="muted">' + escapeHtml(backend.diagnostic) + '</small>' : '';
				return '<div class="feature-pill ' + (backend.ready ? 'enabled' : 'disabled') + '"><span class="name"><strong>' + escapeHtml(backend.label || backend.id) + '</strong><br><small class="muted">' + escapeHtml(detail) + '</small>' + diagnostic + '</span><span class="state">' + escapeHtml(status) + '</span></div>';
			}).join('') || '<div class="muted">No provider metadata reported</div>';
			const labels = { chat: 'Chat and coding', images: 'Image generation', videos: 'Video generation', transcribe: 'Transcription', 'media.analyze': 'Media analysis' };
			fields.relayDefaultSettings.innerHTML = Object.keys(labels).map((jobType) => {
				const current = defaults[jobType] || '';
				const compatible = models.filter((model) => (jobType === 'chat' || jobType === 'media.analyze') ? model.type === 'text' : model.type === ({ images: 'image', videos: 'video', transcribe: 'audio' }[jobType]));
				const selectedKnown = compatible.some((model) => model.id === current);
				const options = (selectedKnown ? [] : ['<option value="' + escapeHtml(current) + '" selected>Unavailable: ' + escapeHtml(current) + '</option>']).concat(compatible.map((model) => '<option value="' + escapeHtml(model.id) + '"' + optionAttr(model.id, current) + '>' + escapeHtml(model.id) + (model.ready === false ? ' (unavailable)' : '') + '</option>'));
				return '<label class="field"><span>' + labels[jobType] + '</span><select data-relay-job="' + jobType + '">' + options.join('') + '</select></label>';
			}).join('');
		}

		async function loadRelaySettings() {
			try { const response = await fetch(relaySettingsUrl, { cache: 'no-store' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.message || 'Routing settings unavailable'); renderRelaySettings(payload); if (!fields.refreshRelayProviders.disabled) fields.relaySettingsMessage.textContent = 'Routing settings loaded'; } catch (error) { if (!fields.refreshRelayProviders.disabled) fields.relaySettingsMessage.textContent = error.message || 'Routing settings load failed'; }
		}

		async function saveRelaySettings() {
			const defaults = {}; fields.relayDefaultSettings.querySelectorAll('[data-relay-job]').forEach((select) => { defaults[select.getAttribute('data-relay-job')] = select.value; });
			try { const response = await fetch(relaySettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { defaults } }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.message || 'Routing settings save failed'); renderRelaySettings(payload); fields.relaySettingsMessage.textContent = 'Routing settings saved'; } catch (error) { fields.relaySettingsMessage.textContent = error.message || 'Routing settings save failed'; }
		}

		function checkedAttr(value) {
			return value ? ' checked' : '';
		}

		function optionAttr(value, selected) {
			return String(value) === String(selected) ? ' selected' : '';
		}

		function numberValue(value, fallback) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : fallback;
		}

		function renderAsrSettingsJson(settings) {
			fields.asrSettingsJson.value = JSON.stringify(settings || {}, null, 2);
		}

		function renderAsrSettingsForm(settings) {
			currentAsrSettings = settings || {};
			const models = Array.isArray(currentAsrSettings.models) ? currentAsrSettings.models : [];
			const defaultModel = currentAsrSettings.default_model || '';
			const defaultModelOptions = [
				'<option value=""' + optionAttr('', defaultModel) + '>Auto</option>',
				...models.filter((model) => model && model.id && model.enabled !== false && model.provider !== 'qwen-aligner').map((model) => (
					'<option value="' + escapeHtml(model.id || '') + '"' + optionAttr(model.id || '', defaultModel) + '>' + escapeHtml(model.label || model.id || 'Model') + '</option>'
				)),
			].join('');
			fields.asrGeneralSettings.innerHTML = [
				'<label class="checkbox-row"><input type="checkbox" id="asrAllowPackageInstall"' + checkedAttr(currentAsrSettings.allow_package_install !== false) + '><span>Install Python packages automatically</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrAllowModelDownloads"' + checkedAttr(currentAsrSettings.allow_model_downloads === true) + '><span>Allow ASR model downloads</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrAllowQwenCpuOffload"' + checkedAttr(currentAsrSettings.allow_qwen_cpu_offload !== false) + '><span>Allow Qwen CPU offload</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrVadFilter"' + checkedAttr(currentAsrSettings.vad_filter === true) + '><span>Use VAD filter</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrConditionPrevious"' + checkedAttr(currentAsrSettings.condition_on_previous_text !== false) + '><span>Condition on previous text</span></label>',
				'<label class="field"><span>Default model</span><select id="asrDefaultModel">' + defaultModelOptions + '</select></label>',
				'<label class="field"><span>Whisper Python path</span><input id="asrPythonPath" value="' + escapeHtml(currentAsrSettings.python_path || '') + '" placeholder="Auto-detect Python 3.10"></label>',
				'<label class="field"><span>Whisper venv path</span><input id="asrVenvPath" value="' + escapeHtml(currentAsrSettings.venv_path || '') + '"></label>',
				'<label class="field"><span>Qwen Python path</span><input id="asrQwenPythonPath" value="' + escapeHtml(currentAsrSettings.qwen_python_path || '') + '" placeholder="Auto-detect Python 3.12"></label>',
				'<label class="field"><span>Qwen venv path</span><input id="asrQwenVenvPath" value="' + escapeHtml(currentAsrSettings.qwen_venv_path || '') + '"></label>',
				'<label class="field"><span>Qwen chunk seconds</span><input id="asrQwenChunkSeconds" type="number" min="5" max="180" value="' + escapeHtml(currentAsrSettings.qwen_chunk_seconds || 30) + '"></label>',
				'<label class="field"><span>Qwen max word seconds</span><input id="asrQwenMaxWordDurationSeconds" type="number" min="1" max="60" value="' + escapeHtml(currentAsrSettings.qwen_max_word_duration_seconds || 12) + '"></label>',
				'<label class="field"><span>CPU threads</span><input id="asrCpuThreads" type="number" min="1" max="64" value="' + escapeHtml(currentAsrSettings.cpu_threads || 4) + '"></label>',
				'<label class="field"><span>Workers</span><input id="asrNumWorkers" type="number" min="1" max="8" value="' + escapeHtml(currentAsrSettings.num_workers || 1) + '"></label>',
				'<label class="field"><span>Beam size</span><input id="asrBeamSize" type="number" min="1" max="20" value="' + escapeHtml(currentAsrSettings.beam_size || 5) + '"></label>',
				'<label class="field"><span>Best of</span><input id="asrBestOf" type="number" min="1" max="20" value="' + escapeHtml(currentAsrSettings.best_of || 5) + '"></label>',
			].join('');

			fields.asrModelSettings.innerHTML = models.map((model, index) => (
				'<div class="model-settings-card" data-model-index="' + index + '">' +
					'<div class="model-heading"><span>' + escapeHtml(model.label || model.id || 'Model') + '</span><label><input type="checkbox" data-field="enabled"' + checkedAttr(model.enabled !== false) + '> Enabled</label></div>' +
					'<label class="field"><span>Model id</span><input data-field="id" value="' + escapeHtml(model.id || '') + '"></label>' +
					'<label class="field"><span>Label</span><input data-field="label" value="' + escapeHtml(model.label || '') + '"></label>' +
					'<label class="field"><span>Provider</span><select data-field="provider">' +
						'<option value="faster-whisper"' + optionAttr('faster-whisper', model.provider || 'faster-whisper') + '>faster-whisper</option>' +
						'<option value="qwen-asr"' + optionAttr('qwen-asr', model.provider || 'faster-whisper') + '>qwen-asr</option>' +
						'<option value="qwen-aligner"' + optionAttr('qwen-aligner', model.provider || 'faster-whisper') + '>qwen-aligner</option>' +
					'</select></label>' +
					'<label class="field"><span>CPU repo id</span><input data-field="repo_id" value="' + escapeHtml(model.repo_id || '') + '"></label>' +
					'<label class="field"><span>GPU repo id</span><input data-field="gpu_repo_id" value="' + escapeHtml(model.gpu_repo_id || '') + '"></label>' +
					'<label class="field"><span>Aligner repo id</span><input data-field="aligner_repo_id" value="' + escapeHtml(model.aligner_repo_id || '') + '"></label>' +
					'<label class="field"><span>Local model path</span><input data-field="local_path" value="' + escapeHtml(model.local_path || '') + '"></label>' +
					'<label class="field"><span>Aligner local path</span><input data-field="aligner_local_path" value="' + escapeHtml(model.aligner_local_path || '') + '"></label>' +
					'<label class="field"><span>Minimum VRAM MB</span><input data-field="min_vram_mb" type="number" min="0" step="256" value="' + escapeHtml(model.min_vram_mb || 0) + '"></label>' +
					'<label class="field"><span>Preferred device</span><select data-field="preferred_device">' +
						'<option value="auto"' + optionAttr('auto', model.preferred_device || 'auto') + '>Auto</option>' +
						'<option value="cpu"' + optionAttr('cpu', model.preferred_device || 'auto') + '>CPU</option>' +
						'<option value="cuda"' + optionAttr('cuda', model.preferred_device || 'auto') + '>CUDA</option>' +
					'</select></label>' +
				'</div>'
			)).join('');
			renderAsrSettingsJson(currentAsrSettings);
		}

		function serializeAsrSettingsForm() {
			const modelCards = Array.from(fields.asrModelSettings.querySelectorAll('.model-settings-card'));
			return {
				allow_package_install: !!document.getElementById('asrAllowPackageInstall').checked,
				allow_model_downloads: !!document.getElementById('asrAllowModelDownloads').checked,
				allow_qwen_cpu_offload: !!document.getElementById('asrAllowQwenCpuOffload').checked,
				default_model: document.getElementById('asrDefaultModel').value.trim(),
				python_path: document.getElementById('asrPythonPath').value.trim(),
				venv_path: document.getElementById('asrVenvPath').value.trim(),
				qwen_python_path: document.getElementById('asrQwenPythonPath').value.trim(),
				qwen_venv_path: document.getElementById('asrQwenVenvPath').value.trim(),
				qwen_chunk_seconds: numberValue(document.getElementById('asrQwenChunkSeconds').value, 30),
				qwen_max_word_duration_seconds: numberValue(document.getElementById('asrQwenMaxWordDurationSeconds').value, 12),
				cpu_threads: numberValue(document.getElementById('asrCpuThreads').value, 4),
				num_workers: numberValue(document.getElementById('asrNumWorkers').value, 1),
				beam_size: numberValue(document.getElementById('asrBeamSize').value, 5),
				best_of: numberValue(document.getElementById('asrBestOf').value, 5),
				vad_filter: !!document.getElementById('asrVadFilter').checked,
				condition_on_previous_text: !!document.getElementById('asrConditionPrevious').checked,
				models: modelCards.map((card) => ({
					id: (card.querySelector('[data-field="id"]') || {}).value || '',
					label: (card.querySelector('[data-field="label"]') || {}).value || '',
					provider: (card.querySelector('[data-field="provider"]') || {}).value || 'faster-whisper',
					repo_id: (card.querySelector('[data-field="repo_id"]') || {}).value || '',
					gpu_repo_id: (card.querySelector('[data-field="gpu_repo_id"]') || {}).value || '',
					aligner_repo_id: (card.querySelector('[data-field="aligner_repo_id"]') || {}).value || '',
					local_path: (card.querySelector('[data-field="local_path"]') || {}).value || '',
					aligner_local_path: (card.querySelector('[data-field="aligner_local_path"]') || {}).value || '',
					min_vram_mb: numberValue((card.querySelector('[data-field="min_vram_mb"]') || {}).value, 0),
					enabled: !!(card.querySelector('[data-field="enabled"]') || {}).checked,
					preferred_device: (card.querySelector('[data-field="preferred_device"]') || {}).value || 'auto',
				})),
			};
		}

		async function loadAsrSettings(options = {}) {
			const refreshRuntime = !!options.refreshRuntime;
			fields.asrSettingsMessage.textContent = refreshRuntime ? 'Checking runtime' : 'Loading settings';
			try {
				const response = await fetch(asrSettingsUrl + (refreshRuntime ? '?refresh=1' : ''), { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					throw new Error(payload.message || 'Settings unavailable');
				}
				renderAsrSettingsForm(payload.settings || {});
				fields.asrSettingsMessage.textContent = refreshRuntime ? 'Runtime checked' : 'Settings loaded';
				if (payload.capabilities) {
					renderAsrDetails(payload.capabilities);
				}
			} catch (error) {
				fields.asrSettingsMessage.textContent = error.message || 'Settings load failed';
			}
		}

		async function saveAsrSettings() {
			const settings = serializeAsrSettingsForm();
			renderAsrSettingsJson(settings);
			fields.asrSettingsMessage.textContent = 'Saving';
			try {
				const response = await fetch(asrSettingsUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ settings }),
				});
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					throw new Error(payload.message || 'Save failed');
				}
				renderAsrSettingsForm(payload.settings || settings);
				fields.asrSettingsMessage.textContent = 'Saved';
				if (payload.capabilities) {
					renderAsrDetails(payload.capabilities);
				}
				refresh();
			} catch (error) {
				fields.asrSettingsMessage.textContent = error.message || 'Save failed';
			}
		}

		function markAsrSettingsDirty() {
			try {
				renderAsrSettingsJson(serializeAsrSettingsForm());
				fields.asrSettingsMessage.textContent = 'Unsaved changes';
			} catch (error) {
				fields.asrSettingsMessage.textContent = 'Settings need review';
			}
		}

		function applyAsrSettingsJson() {
			try {
				const settings = JSON.parse(fields.asrSettingsJson.value || '{}');
				renderAsrSettingsForm(settings);
				fields.asrSettingsMessage.textContent = 'JSON applied - save to persist';
			} catch (error) {
				fields.asrSettingsMessage.textContent = 'Invalid JSON';
			}
		}

		function addAsrModel() {
			const settings = serializeAsrSettingsForm();
			settings.models.push({
				id: 'custom-whisper-model',
				label: 'Custom Whisper Model',
				provider: 'faster-whisper',
				repo_id: '',
				gpu_repo_id: '',
				aligner_repo_id: '',
				local_path: '',
				aligner_local_path: '',
				min_vram_mb: 0,
				enabled: true,
				preferred_device: 'auto',
			});
			renderAsrSettingsForm(settings);
			fields.asrSettingsMessage.textContent = 'Model added - edit and save';
		}

		function captureSessionOutputScrolls() {
			const states = new Map();
			document.querySelectorAll('.session-output[data-session-key]').forEach((output) => {
				const maxScrollTop = Math.max(0, output.scrollHeight - output.clientHeight);
				states.set(output.dataset.sessionKey, {
					atBottom: maxScrollTop - output.scrollTop <= 8,
					scrollTop: output.scrollTop,
				});
			});
			return states;
		}

		function restoreSessionOutputScrolls(scrollStates) {
			document.querySelectorAll('.session-output[data-session-key]').forEach((output) => {
				const state = scrollStates.get(output.dataset.sessionKey);
				const maxScrollTop = Math.max(0, output.scrollHeight - output.clientHeight);
				if (state) {
					output.scrollTop = output.classList.contains('live-session-output') && state.atBottom
						? maxScrollTop
						: Math.min(state.scrollTop, maxScrollTop);
					return;
				}
				if (output.classList.contains('live-session-output')) {
					output.scrollTop = maxScrollTop;
				}
			});
		}

		function queueRestoreSessionOutputScrolls(scrollStates) {
			const restore = () => restoreSessionOutputScrolls(scrollStates);
			if (typeof requestAnimationFrame === 'function') {
				requestAnimationFrame(restore);
				return;
			}
			setTimeout(restore, 0);
		}

		async function copyToClipboard(value) {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(value);
				return;
			}
			const textarea = document.createElement('textarea');
			textarea.value = value;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			textarea.remove();
		}

		document.addEventListener('click', async (event) => {
			const copyValue = event.target.closest('.copy-value');
			if (copyValue) {
				const original = copyValue.textContent;
				try {
					await copyToClipboard(copyValue.dataset.copyValue || original || '');
					copyValue.textContent = 'Copied';
				} catch (error) {
					copyValue.textContent = 'Copy failed';
				}
				setTimeout(() => {
					copyValue.textContent = original;
				}, 1800);
				return;
			}
			const button = event.target.closest('.copy-session-output');
			if (!button) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const block = button.closest('.session-output-block');
			const output = button === fields.copyRawStatus ? fields.rawStatus : (block ? block.querySelector('.session-output') : null);
			if (!output) {
				return;
			}
			const original = button.textContent;
			try {
				await copyToClipboard(output.textContent || '');
				button.textContent = 'Copied';
			} catch (error) {
				button.textContent = 'Copy failed';
			}
			setTimeout(() => {
				button.textContent = original;
			}, 1800);
		});

		function renderJobs(jobs) {
			const scrollStates = captureSessionOutputScrolls();
			fields.jobCounts.textContent = 'Running ' + Number(jobs.running_count || 0) + ' / Queued ' + Number(jobs.queued_count || 0);
			fields.maxConcurrent.textContent = text(jobs.max_concurrent);
			renderActiveJobs(Array.isArray(jobs.active) ? jobs.active : []);
			renderQueuedJobs(Array.isArray(jobs.queued) ? jobs.queued : []);
			renderRecentActivity(Array.isArray(jobs.recent) ? jobs.recent : []);
			currentStatus.jobs = jobs;
			fields.rawStatus.textContent = JSON.stringify(currentStatus, null, 2);
			fields.updated.textContent = 'Live updates on - updated ' + new Date().toLocaleTimeString();
			queueRestoreSessionOutputScrolls(scrollStates);
		}

		function tickElapsedCells() {
			document.querySelectorAll('.elapsed[data-live-elapsed="true"]').forEach((cell) => {
				const base = Number(cell.dataset.elapsedBase || 0);
				const captured = Number(cell.dataset.elapsedCaptured || Date.now());
				cell.textContent = elapsed(base + Math.max(0, Date.now() - captured));
			});
		}

		function renderStatus(payload, ok) {
			currentStatus = payload;
			if (Object.keys(currentCapabilities).length) {
				currentStatus.capabilities = currentCapabilities;
			}
			const jobs = payload.jobs || {};
			const bridge = payload.bridge || {};
			const details = payload.details || {};
			const paired = Array.isArray(bridge.paired_origins) ? bridge.paired_origins : [];
			setPill(fields.bridgePill, ok ? 'ok' : 'bad', ok ? 'Reachable' : 'Error');
			setPill(fields.codexPill, payload.success ? 'ok' : 'warn', payload.success ? 'Ready' : 'Needs attention');
			fields.version.textContent = text(bridge.version);
			fields.pairedSites.innerHTML = paired.length ? paired.map((origin) => '<code>' + escapeHtml(origin) + '</code>').join(' ') : '<span class="muted">None</span>';
			fields.codexDetails.innerHTML = renderDetails(details);
			renderAsrDetails(payload.asr || currentCapabilities.asr || {});
			if (!Object.keys(currentCapabilities).length) {
				fields.codexCliVersion.textContent = text(details.version);
				fields.codexBinary.textContent = text(details.codex_binary);
				fields.detectedFeatures.innerHTML = '<div class="muted">Loading detected features</div>';
				fields.backendDrivers.innerHTML = '<div class="muted">Loading backend drivers</div>';
			}
			renderJobs(jobs);
			updateProviderRefreshState(payload.refresh);
		}

		function updateProviderRefreshState(refreshState) {
			if (!settingsLoaded || !refreshState) return;
			const expectedId = Number(fields.refreshRelayProviders.dataset.refreshId || 0);
			if (expectedId && Number(refreshState.id || 0) !== expectedId) return;
			if (refreshState.active) {
				fields.refreshRelayProviders.disabled = true;
				fields.refreshRelayProviders.textContent = 'Checking…';
				fields.relaySettingsMessage.textContent = 'Checking providers in background…';
				return;
			}
			if (!expectedId) return;
			clearInterval(providerRefreshPollTimer);
			providerRefreshPollTimer = null;
			fields.refreshRelayProviders.disabled = false;
			fields.refreshRelayProviders.textContent = 'Refresh detection';
			delete fields.refreshRelayProviders.dataset.refreshId;
			if (refreshState.error) {
				fields.relaySettingsMessage.textContent = 'Detection refresh failed: ' + refreshState.error;
				return;
			}
			fields.relaySettingsMessage.textContent = 'Detection refreshed ' + new Date(refreshState.completed_at || Date.now()).toLocaleTimeString();
			loadRelaySettings();
		}

		function pollProviderRefresh() {
			refresh().catch(() => {});
		}

		async function refreshProviderDetection() {
			if (fields.refreshRelayProviders.disabled) return;
			fields.refreshRelayProviders.disabled = true;
			fields.refreshRelayProviders.textContent = 'Checking…';
			fields.relaySettingsMessage.textContent = 'Starting provider detection…';
			try {
				const response = await fetch('/v1/relay/refresh', { method: 'POST' });
				const payload = await response.json();
				if (!response.ok) throw new Error(payload.message || 'Detection refresh could not be started');
				const refreshState = payload.refresh || {};
				fields.refreshRelayProviders.dataset.refreshId = String(refreshState.id || '');
				fields.relaySettingsMessage.textContent = 'Checking providers in background…';
				clearInterval(providerRefreshPollTimer);
				providerRefreshPollTimer = setInterval(pollProviderRefresh, 1000);
				pollProviderRefresh();
			} catch (error) {
				fields.refreshRelayProviders.disabled = false;
				fields.refreshRelayProviders.textContent = 'Refresh detection';
				fields.relaySettingsMessage.textContent = 'Detection refresh failed: ' + (error.message || 'unknown error');
			}
		}

		async function refresh() {
			try {
				const [response, capabilitiesResponse] = await Promise.all([
					fetch(statusUrl, { cache: 'no-store' }),
					fetch(capabilitiesUrl, { cache: 'no-store' }).catch(() => null),
				]);
				const payload = await response.json();
				renderStatus(payload, response.ok);
				if (capabilitiesResponse && capabilitiesResponse.ok) {
					renderCapabilities(await capabilitiesResponse.json());
				}
				fields.updated.textContent = 'Polled - updated ' + new Date().toLocaleTimeString();
			} catch (error) {
				renderStatus({ success: false, message: error.message, jobs: {} }, false);
			}
		}

		function startFallbackPolling() {
			if (fallbackPollTimer) {
				return;
			}
			setConnection('warn', 'Polling fallback');
			fields.updated.textContent = 'Live updates unavailable - polling';
			refresh();
			fallbackPollTimer = setInterval(refresh, 5000);
		}

		function connectJobEvents() {
			if (!window.EventSource) {
				startFallbackPolling();
				return;
			}
			jobEvents = new EventSource(jobEventsUrl);
			jobEvents.addEventListener('open', () => {
				setConnection('ok', 'Connected');
				fields.updated.textContent = 'Live updates connected';
			});
			jobEvents.addEventListener('status', (event) => {
				try {
					markLiveEvent('Status');
					const payload = JSON.parse(event.data || '{}');
					renderStatus(payload, payload.success !== false);
				} catch (error) {}
			});
			jobEvents.addEventListener('capabilities', (event) => {
				try {
					markLiveEvent('Capabilities');
					renderCapabilities(JSON.parse(event.data || '{}'));
					if (settingsLoaded) loadRelaySettings();
				} catch (error) {}
			});
			jobEvents.addEventListener('jobs', (event) => {
				try {
					markLiveEvent('Jobs');
					renderJobs(JSON.parse(event.data || '{}'));
				} catch (error) {}
			});
			jobEvents.addEventListener('heartbeat', () => {
				markLiveEvent('Heartbeat');
			});
			jobEvents.onerror = () => {
				setConnection('warn', 'Reconnecting');
				if (jobEvents) {
					jobEvents.close();
					jobEvents = null;
				}
				startFallbackPolling();
			};
		}

		initTabs();
		setInterval(tickElapsedCells, 1000);
		fields.asrSettingsForm.addEventListener('submit', (event) => {
			event.preventDefault();
			saveAsrSettings();
		});
		fields.asrSettingsForm.addEventListener('input', (event) => {
			if (event.target === fields.asrSettingsJson) {
				fields.asrSettingsMessage.textContent = 'JSON edited - apply or reload';
				return;
			}
			markAsrSettingsDirty();
		});
		fields.asrSettingsForm.addEventListener('change', (event) => {
			if (event.target !== fields.asrSettingsJson) {
				markAsrSettingsDirty();
			}
		});
		fields.reloadAsrSettings.addEventListener('click', loadAsrSettings);
		fields.refreshAsrRuntime.addEventListener('click', () => loadAsrSettings({ refreshRuntime: true }));
		fields.saveAsrSettings.addEventListener('click', saveAsrSettings);
		fields.applyAsrSettingsJson.addEventListener('click', applyAsrSettingsJson);
		fields.addAsrModel.addEventListener('click', addAsrModel);
		fields.relaySettingsForm.addEventListener('submit', (event) => { event.preventDefault(); saveRelaySettings(); });
		fields.saveRelaySettings.addEventListener('click', saveRelaySettings);
		fields.refreshRelayProviders.addEventListener('click', refreshProviderDetection);
		refresh().then(connectJobEvents).catch(() => {
			startFallbackPolling();
		});
	</script>
</body>
</html>`;
}

module.exports = {
	statusPageHtml,
};
