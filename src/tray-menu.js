'use strict';

// Pure builder for the tray context menu template. src/main.js turns the result into an Electron Menu;
// scripts/capture-screenshots.js renders the same template as the tray-menu documentation screenshot,
// so a regenerated screenshot always matches the real menu. Nothing here touches Electron, the file system,
// or process state: everything it needs comes in through `model` and `actions`.

const { PRODUCT_NAME, LEGACY_PRODUCT_NAME } = require('./brand');

function shortPath(value) {
	const text = String(value || '');
	return text.length > 52 ? '...' + text.slice(-49) : text;
}

function shortText(value, maxLength = 42) {
	const text = String(value || '').trim();
	return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function formatElapsed(ms) {
	const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function jobLabel(job) {
	const id = job.short_request_id || job.request_id || job.id || 'job';
	const model = job.model ? ` ${shortText(job.model, 28)}` : '';
	return `${id}: ${job.type}${model} (${formatElapsed(job.elapsed_ms)})`;
}

function buildJobMenuItems(jobState) {
	const state = jobState || {};
	const items = [
		{ label: `Jobs: Running ${state.running_count || 0} / Queued ${state.queued_count || 0}`, enabled: false },
	];
	if (state.active && state.active.length) {
		for (const job of state.active.slice(0, 5)) {
			items.push({ label: `Running: ${jobLabel(job)}`, enabled: false });
		}
	}
	if (state.queued && state.queued.length) {
		for (const job of state.queued.slice(0, 5)) {
			const id = job.short_request_id || job.request_id || job.id || 'job';
			const model = job.model ? ` ${shortText(job.model, 28)}` : '';
			items.push({ label: `Queued: ${id}: ${job.type}${model}`, enabled: false });
		}
	}
	return items;
}

function buildPairedSitesMenu(pairedOrigins, actions) {
	if (!pairedOrigins.length) {
		return [{ label: 'No paired WordPress sites', enabled: false }];
	}
	return pairedOrigins.flatMap((origin) => [
		{
			label: origin,
			click: () => actions.copyText(origin),
		},
		{
			label: 'Unpair this site',
			click: () => actions.unpairSite(origin),
		},
		{ type: 'separator' },
	]).slice(0, -1);
}

/*
 * model:   { displayVersion, bridgeState, bridgeUrl, codexStatus, jobState, pairingCode,
 *            pairingCodePersistent, pairedOrigins, launchOnLogin }
 * actions: one function per name in TRAY_ACTION_NAMES. copyPairingCode and copyBridgeUrl read the live
 *          value when the item is clicked (the menu can be open while the code or URL changes); the labels use `model`.
 *          A missing action throws, so a typo in the caller cannot ship a dead menu item. A screenshot
 *          passes noopTrayActions().
 */
const TRAY_ACTION_NAMES = [
	'copyText',
	'copyPairingCode',
	'copyBridgeUrl',
	'copyDiagnostics',
	'refreshCodexStatus',
	'openStatusPage',
	'openStatusJson',
	'openDataFolder',
	'setLaunchOnLogin',
	'openCodexLoginHelp',
	'unpairSite',
	'restartBridge',
	'quit',
];

function noopTrayActions() {
	return Object.fromEntries(TRAY_ACTION_NAMES.map((name) => [name, () => {}]));
}

function buildTrayMenuTemplate(model, actions) {
	const m = model || {};
	const act = actions || {};
	const missing = TRAY_ACTION_NAMES.filter((name) => typeof act[name] !== 'function');
	if (missing.length) {
		throw new Error('Tray menu actions missing: ' + missing.join(', '));
	}
	const status = m.codexStatus || {};
	const pairedOrigins = Array.isArray(m.pairedOrigins) ? m.pairedOrigins : [];
	const details = status.details || {};
	const codexLabel = status.success ? 'Codex: Ready' : 'Codex: Needs attention';
	const pairingCode = m.pairingCode || '';
	const bridgeRunning = m.bridgeState === 'Running';
	return [
		{ label: `${PRODUCT_NAME} ${m.displayVersion}`, enabled: false },
		{ label: `formerly ${LEGACY_PRODUCT_NAME}`, enabled: false },
		{ label: `Bridge: ${m.bridgeState}`, enabled: false },
		{ label: `URL: ${m.bridgeUrl}`, enabled: false },
		{ label: codexLabel, enabled: false },
		{ label: status.message || 'Status unavailable', enabled: false },
		...buildJobMenuItems(m.jobState),
		{ type: 'separator' },
		{ label: 'Pairing code' + (m.pairingCodePersistent ? ' (fixed)' : '') + ': ' + (pairingCode || 'starting'), enabled: false },
		{
			label: 'Copy pairing code',
			enabled: !!pairingCode,
			click: () => act.copyPairingCode(),
		},
		{
			label: 'Copy bridge URL',
			click: () => act.copyBridgeUrl(),
		},
		{
			label: 'Copy diagnostics',
			click: () => act.copyDiagnostics(),
		},
		{
			label: 'Refresh Codex status',
			click: () => act.refreshCodexStatus(),
		},
		{
			label: 'Open status page',
			enabled: bridgeRunning,
			click: () => act.openStatusPage(),
		},
		{
			label: 'Open status JSON',
			enabled: bridgeRunning,
			click: () => act.openStatusJson(),
		},
		{
			label: 'Open relay data folder',
			click: () => act.openDataFolder(),
		},
		{
			label: 'Launch on login',
			type: 'checkbox',
			checked: !!m.launchOnLogin,
			click: (item) => act.setLaunchOnLogin(item.checked),
		},
		{ type: 'separator' },
		{
			label: 'Codex details',
			submenu: [
				{ label: `Binary: ${shortPath(details.codex_binary || 'not found')}`, enabled: false },
				{ label: `Home: ${shortPath(details.codex_home || '')}`, enabled: false },
				{ label: `Version: ${shortPath(details.version || 'unknown')}`, enabled: false },
				{
					label: 'Copy Codex binary path',
					enabled: !!details.codex_binary,
					click: () => act.copyText(details.codex_binary || ''),
				},
			],
		},
		{
			label: 'Open Codex login help',
			click: () => act.openCodexLoginHelp(),
		},
		{ type: 'separator' },
		{
			label: `Paired WordPress sites (${pairedOrigins.length})`,
			submenu: buildPairedSitesMenu(pairedOrigins, act),
		},
		{ type: 'separator' },
		{ label: 'Restart bridge', click: () => act.restartBridge() },
		{ type: 'separator' },
		{ label: 'Quit', click: () => act.quit() },
	];
}

module.exports = {
	buildJobMenuItems,
	buildTrayMenuTemplate,
	formatElapsed,
	noopTrayActions,
	shortPath,
	shortText,
	TRAY_ACTION_NAMES,
};
