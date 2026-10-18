'use strict';

/*
 * Captures anonymized screenshots of the local status page for the docs.
 *
 * Run it with Electron (it needs a real browser window), from a checkout that has node_modules:
 *
 *   npx electron scripts/capture-screenshots.js        (or: npm run screenshots)
 *
 * Options:
 *   --out <dir>        output directory (default docs/images)
 *   --port <number>    port for the temporary Relay (default: a free port from 8920)
 *   --only a,b         capture only the named shots (for example overview-light,tests-light,tray-menu)
 *   --no-demo-jobs     do not add the three illustrative jobs shown in Overview and Live
 *   --keep-temp        keep the temporary state directory (for debugging)
 *
 * What it does:
 *   1. Creates a fresh temporary state directory (with an empty state.json) and points
 *      AI_MODEL_RELAY_STATE_DIR at it BEFORE the Relay is loaded, so neither the real state file nor
 *      the legacy-state migration can bring in real pairings, keys, or settings. API-key style
 *      environment variables are removed from this process for the same reason.
 *   2. Starts the Relay in-process, opens http://127.0.0.1:<port>/status#<route> in hidden Electron
 *      windows, waits until the page shows live data, and anonymizes the DOM (user name, home path,
 *      host name, e-mail addresses, key suffixes, pairing code) before every capture.
 *   3. Writes the PNGs, stops the Relay, and deletes the temporary directories.
 *
 * The tray-menu shot is different: native tray menus cannot be captured headlessly, so it renders an HTML
 * replica of the Windows 11 dark context menu. The menu items come from the real template builder
 * (src/tray-menu.js, the same function src/main.js uses) filled with demo values, so the image cannot
 * drift from the actual menu. It needs no Relay data and shows no real code, path, or site.
 *
 * Provider detection reflects the machine the script runs on (installed CLIs and versions); only
 * the paths are anonymized. Always look at the resulting images before committing them.
 */

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

let electron = null;
try {
	electron = require('electron');
} catch (error) {
	electron = null;
}
if (!electron || typeof electron === 'string' || !electron.app) {
	process.stderr.write('This script must run inside Electron: npx electron scripts/capture-screenshots.js (or npm run screenshots).\n');
	process.exit(1);
}
const { app, BrowserWindow } = electron;

const REPO_ROOT = path.resolve(__dirname, '..');
const args = parseArgs(process.argv.slice(1));
const outDir = path.resolve(args.out || path.join(REPO_ROOT, 'docs', 'images'));

// --- Isolated state: must exist before src/server.js (and so src/state-paths.js) is required. ---
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-shots-'));
const stateDir = path.join(tempRoot, 'state');
const userDataDir = path.join(tempRoot, 'electron-user-data');
fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(userDataDir, { recursive: true });
fs.writeFileSync(path.join(stateDir, 'state.json'), '{}\n');
process.env.AI_MODEL_RELAY_STATE_DIR = stateDir;
delete process.env.ALORBACH_MODEL_RELAY_STATE_DIR;
for (const name of Object.keys(process.env)) {
	if (/(API_KEY|ADMIN_KEY|_TOKEN|SECRET|PASSWORD)/i.test(name) && name !== 'AI_MODEL_RELAY_STATE_DIR') delete process.env[name];
}

app.setPath('userData', userDataDir);
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration();

// Electron keeps files in its user-data directory open until the process exits, so the state directory
// is removed here and the rest is removed by a short-lived detached helper after this process is gone.
process.on('exit', () => {
	if (args['keep-temp']) {
		process.stdout.write('Temporary directory kept: ' + tempRoot + '\n');
		return;
	}
	try {
		fs.rmSync(stateDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	} catch (error) {
		process.stderr.write('Could not delete ' + stateDir + ': ' + error.message + '\n');
	}
	try {
		const helper = 'const fs=require("fs");let n=0;const t=setInterval(()=>{try{fs.rmSync(process.argv[1],{recursive:true,force:true});clearInterval(t);}catch(e){if(++n>20)clearInterval(t);}},500);';
		require('child_process').spawn(process.execPath, ['-e', helper, tempRoot], { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }).unref();
	} catch (error) {
		process.stderr.write('Could not schedule cleanup of ' + tempRoot + ': ' + error.message + '\n');
	}
});

// Each shot opens and closes its own window; do not quit in between.
app.on('window-all-closed', () => {});

const SHOTS = [
	{ name: 'overview-light', route: 'overview', theme: 'light', width: 1440, height: 900, ready: 'overview' },
	{ name: 'providers-dark', route: 'providers/codex-cli', theme: 'dark', width: 1440, height: 900, ready: 'providers', expandProvider: 'codex-cli' },
	{ name: 'tests-light', route: 'tests/chat', theme: 'light', width: 1440, height: 900, ready: 'tests' },
	{ name: 'live-dark', route: 'live', theme: 'dark', width: 1440, height: 900, ready: 'live', selectDemoJob: true },
	{ name: 'status-page-mobile', route: 'overview', theme: 'dark', width: 390, height: 844, ready: 'overview' },
	{ name: 'tray-menu', kind: 'tray' },
];
const DEFAULT_COPY = { from: 'overview-light', to: 'status-page' };

function parseArgs(argv) {
	const result = {};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (!arg.startsWith('--')) continue;
		const key = arg.slice(2);
		const next = argv[index + 1];
		if (next !== undefined && !next.startsWith('--')) {
			result[key] = next;
			index += 1;
		} else {
			result[key] = true;
		}
	}
	return result;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function findFreePort(start) {
	return new Promise((resolve, reject) => {
		const tryPort = (port) => {
			if (port > start + 200) {
				reject(new Error('No free port found near ' + start));
				return;
			}
			const probe = net.createServer();
			probe.once('error', () => tryPort(port + 1));
			probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(port)));
		};
		tryPort(start);
	});
}

// --- Page-side anonymizer. Serialized with toString() and run inside the page. ---
function installAnonymizer(options) {
	const escapeRe = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const rules = [];
	const addRule = (pattern, replacement) => rules.push({ pattern, replacement });
	const homeVariants = new Set();
	for (const home of options.homes) {
		if (!home) continue;
		homeVariants.add(home);
		homeVariants.add(home.replace(/\\/g, '/'));
		homeVariants.add(home.replace(/\\/g, '\\\\'));
		homeVariants.add(home.replace(/\\/g, '%5C'));
	}
	for (const variant of Array.from(homeVariants).sort((a, b) => b.length - a.length)) {
		const forward = variant.indexOf('/') >= 0 && variant.indexOf('\\') < 0;
		const doubled = variant.indexOf('\\\\') >= 0;
		const fakeHome = forward ? 'C:/Users/demo' : (doubled ? 'C:\\\\Users\\\\demo' : 'C:\\Users\\demo');
		addRule(new RegExp(escapeRe(variant), 'gi'), fakeHome);
	}
	const user = options.username;
	if (user) {
		addRule(new RegExp('([\\\\/]Users(?:[\\\\/]|%5C|%2F)+)' + escapeRe(user) + '(?![A-Za-z0-9_])', 'gi'), '$1demo');
		if (user.length >= 4) addRule(new RegExp('(?<![A-Za-z0-9_])' + escapeRe(user) + '(?![A-Za-z0-9_])', 'gi'), 'demo');
	}
	for (const host of options.hostnames) {
		if (host && host.length >= 3) addRule(new RegExp('(?<![A-Za-z0-9_-])' + escapeRe(host) + '(?![A-Za-z0-9_-])', 'gi'), 'demo-pc');
	}
	addRule(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 'user@example.com');
	addRule(/\b(sk-[A-Za-z0-9_-]{6,}|xai-[A-Za-z0-9_-]{6,}|AIza[A-Za-z0-9_-]{10,})\b/g, 'sk-••••');
	addRule(/(ends with )\S+/g, '$1••••');

	const scrub = (text) => {
		let value = String(text);
		for (const rule of rules) value = value.replace(rule.pattern, rule.replacement);
		return value;
	};

	let running = false;
	const run = () => {
		if (running) return;
		running = true;
		try {
			const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
			let node = walker.nextNode();
			while (node) {
				const parent = node.parentNode;
				const tag = parent && parent.nodeName;
				if (tag !== 'SCRIPT' && tag !== 'STYLE') {
					const next = scrub(node.nodeValue);
					if (next !== node.nodeValue) node.nodeValue = next;
				}
				node = walker.nextNode();
			}
			for (const element of document.querySelectorAll('*')) {
				for (const attribute of Array.from(element.attributes)) {
					const next = scrub(attribute.value);
					if (next !== attribute.value) element.setAttribute(attribute.name, next);
				}
				if ((element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') && typeof element.value === 'string' && element.type !== 'checkbox' && element.type !== 'radio') {
					const next = scrub(element.value);
					if (next !== element.value) element.value = next;
				}
			}
			const pairing = document.getElementById('persistentPairingCodeInput');
			if (pairing) pairing.value = '';
			document.title = scrub(document.title);
		} finally {
			running = false;
		}
	};

	let scheduled = false;
	const observer = new MutationObserver(() => {
		if (scheduled || running) return;
		scheduled = true;
		setTimeout(() => {
			scheduled = false;
			run();
			observer.takeRecords();
		}, 30);
	});
	observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
	run();

	// Lists whatever sensitive token is still present in text, attributes, or input values.
	const audit = () => {
		const hits = [];
		const probes = [];
		const add = (label, text) => { if (text && text.length >= 2) probes.push({ label, re: new RegExp(escapeRe(text), 'i') }); };
		for (const home of options.homes) { add('home', home); add('home/', home.replace(/\\/g, '/')); add('home\\\\', home.replace(/\\/g, '\\\\')); }
		for (const host of options.hostnames) add('hostname', host);
		if (user) {
			probes.push({ label: 'user path', re: new RegExp('[\\\\/]' + escapeRe(user) + '(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])' + escapeRe(user) + '[\\\\/]', 'i') });
			if (user.length >= 4) add('username', user);
		}
		probes.push({ label: 'email', re: /[A-Z0-9._%+-]+@(?!example\.com)[A-Z0-9.-]+\.[A-Z]{2,}/i });
		const check = (where, text) => {
			for (const probe of probes) if (probe.re.test(text)) hits.push(probe.label + ' in ' + where + ': ' + text.slice(0, 120));
		};
		const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
		let node = walker.nextNode();
		while (node) {
			const tag = node.parentNode && node.parentNode.nodeName;
			if (tag !== 'SCRIPT' && tag !== 'STYLE') check('text', node.nodeValue);
			node = walker.nextNode();
		}
		for (const element of document.querySelectorAll('*')) {
			for (const attribute of Array.from(element.attributes)) check('attribute ' + attribute.name, attribute.value);
			if ((element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') && typeof element.value === 'string') check('value', element.value);
		}
		return hits;
	};

	window.__relayAnonymizer = { run, audit };
	return true;
}

async function waitFor(win, expression, label, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	let lastError = null;
	while (Date.now() < deadline) {
		try {
			if (await win.webContents.executeJavaScript('Boolean(' + expression + ')', true)) return true;
		} catch (error) {
			lastError = error;
		}
		await sleep(250);
	}
	process.stderr.write('Warning: timed out waiting for ' + label + (lastError ? ' (' + lastError.message + ')' : '') + '\n');
	return false;
}

const READY = {
	common: "document.getElementById('connectionPill') && /^(Connected|Polling fallback)/.test(document.getElementById('connectionPill').textContent.trim())",
	overview: "document.querySelectorAll('#overviewProviderGrid .provider-tile').length > 0 && !/Checking|Waiting/i.test(document.getElementById('overviewProviderGrid').textContent + document.getElementById('overviewProviderSummarySub').textContent + document.getElementById('codexPill').textContent) && !/Loading/.test(document.getElementById('claudeUsagePanel').textContent) && /Reachable/.test(document.getElementById('bridgePill').textContent)",
	providers: "document.querySelectorAll('#providerSettings .provider-card').length > 0 && !document.querySelector('#providerSettings .provider-card[data-provider-state=\"checking\"]')",
	tests: "document.querySelectorAll('#providerChatTests [data-card-key], #providerChatTests .provider-media-test').length > 0",
	live: "document.querySelectorAll('#liveJobList button, #liveJobList [data-request-id], #liveJobList li, #liveJobList a').length > 0 || /Select a job/.test(document.getElementById('liveDetailEmpty').textContent)",
};

async function warmUp(base) {
	const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true } });
	try {
		await win.loadURL(base + '/status#overview');
		await waitFor(win, READY.overview, 'the first provider detection', 90000);
	} finally {
		await closeWindow(win);
	}
}

async function closeWindow(win) {
	try { win.webContents.debugger.detach(); } catch (error) { /* not attached */ }
	// close() (not destroy()) lets the page drop its event-stream connection; destroy() makes the next load fail.
	await new Promise((resolve) => {
		win.once('closed', resolve);
		win.close();
		setTimeout(resolve, 3000);
	});
}

async function capture(shot, base, context) {
	const win = new BrowserWindow({
		show: false,
		width: shot.width,
		height: shot.height,
		useContentSize: true,
		resizable: true,
		backgroundColor: shot.theme === 'dark' ? '#111418' : '#ffffff',
		webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true },
	});
	win.setContentSize(shot.width, shot.height);
	try {
		// Light or dark is chosen by emulating prefers-color-scheme for this window (the page's own toggle stays on
		// System). Switching nativeTheme.themeSource between shots crashes some Electron builds.
		await win.loadURL('about:blank');
		win.webContents.debugger.attach('1.3');
		await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: shot.theme }] });
		let route = shot.route;
		if (shot.selectDemoJob && context.demoRequestId) route = 'live/' + context.demoRequestId;
		await win.loadURL(base + '/status#' + route);
		await waitFor(win, READY.common, 'the Connected pill', 30000);
		await waitFor(win, READY[shot.ready], 'the ' + shot.ready + ' view to load', 90000);
		if (shot.expandProvider) {
			await waitFor(win, "document.querySelector('.provider-card[data-provider-id=\"" + shot.expandProvider + "\"]')", 'the ' + shot.expandProvider + ' card', 15000);
			await win.webContents.executeJavaScript(
				"(function(){var card=document.querySelector('.provider-card[data-provider-id=\"" + shot.expandProvider + "\"]');"
				+ "if(card&&card.getAttribute('data-expanded')!=='true'){var t=card.querySelector('[data-provider-toggle]');if(t)t.click();}"
				+ "if(card){card.scrollIntoView({block:'start'});window.scrollBy(0,-72);}return true;})()", true);
		}
		await win.webContents.insertCSS('*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}');
		await win.webContents.executeJavaScript('(' + installAnonymizer.toString() + ')(' + JSON.stringify(context.anonymizer) + ')', true);
		await sleep(900);
		await win.webContents.executeJavaScript('window.__relayAnonymizer.run()', true);
		const hits = await win.webContents.executeJavaScript('window.__relayAnonymizer.audit()', true);
		if (hits.length) {
			throw new Error('Anonymization audit failed for ' + shot.name + ':\n  ' + hits.slice(0, 10).join('\n  '));
		}
		// Heavy pages can make the event stream reconnect while they render: make sure the pill reads Connected.
		await waitFor(win, READY.common, 'the Connected pill before capture', 30000);
		await sleep(500);
		const pill = await win.webContents.executeJavaScript("document.getElementById('connectionPill').textContent.trim()", true);
		if (!/^Connected/.test(pill)) process.stderr.write('Warning: the connection pill reads "' + pill + '" in ' + shot.name + '\n');
		const image = await win.webContents.capturePage();
		const size = image.getSize();
		const file = path.join(outDir, shot.name + '.png');
		fs.writeFileSync(file, image.toPNG());
		process.stdout.write('Wrote ' + path.relative(process.cwd(), file) + ' (' + size.width + 'x' + size.height + ', ' + fs.statSync(file).size + ' bytes)\n');
	} finally {
		await closeWindow(win);
	}
}

// --- Tray menu replica ---
// Demo values only: a placeholder pairing code, no real paths or sites. The build number is a demo value too.
function trayDemoModel() {
	const packageInfo = require(path.join(REPO_ROOT, 'package.json'));
	return {
		displayVersion: packageInfo.version + ' (26)',
		bridgeState: 'Running',
		bridgeUrl: 'http://127.0.0.1:8765',
		codexStatus: { success: true, message: 'Local Codex CLI is installed and logged in.', details: { codex_binary: 'C:\\Tools\\codex\\codex.exe', codex_home: 'C:\\Users\\demo\\.codex', version: 'codex-cli 0.0.0' } },
		jobState: { running_count: 0, queued_count: 0, max_concurrent: 2, active: [], queued: [], recent: [] },
		pairingCode: '000000',
		pairingCodePersistent: false,
		pairedOrigins: ['https://example.com', 'https://shop.example.org'],
		launchOnLogin: true,
	};
}

function escapeHtml(text) {
	return String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function renderTrayMenuHtml(template, scale) {
	const check = '<svg class="check" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	const chevron = '<svg class="chevron" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	const rows = template.map((item) => {
		if (item.type === 'separator') return '<div class="sep"></div>';
		const classes = ['item'];
		if (item.enabled === false) classes.push('disabled');
		return '<div class="' + classes.join(' ') + '"><span class="gutter">' + (item.type === 'checkbox' && item.checked ? check : '') + '</span><span class="label">' + escapeHtml(item.label) + '</span>' + (item.submenu ? chevron : '') + '</div>';
	}).join('');
	return '<!doctype html><html><head><meta charset="utf-8"><style>'
		+ 'html,body{margin:0;background:transparent;overflow:hidden}'
		+ '#frame{display:inline-block;padding:20px 28px 36px 28px;zoom:' + scale + '}'
		+ '#menu{display:inline-block;min-width:260px;box-sizing:border-box;padding:4px 0;background:#2b2b2b;color:#ffffff;border:1px solid #454545;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.45),0 1px 3px rgba(0,0,0,.3);font:12px/16px "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;white-space:nowrap}'
		+ '.item{display:flex;align-items:center;height:30px;margin:0 4px;padding:0 10px 0 0;border-radius:4px}'
		+ '.item.disabled{color:#8f8f8f}'
		+ '.gutter{flex:0 0 32px;display:flex;align-items:center;justify-content:center;color:#ffffff}'
		+ '.label{flex:1 1 auto;padding-right:28px}'
		+ '.chevron{flex:0 0 auto;color:#ffffff;margin-right:2px}'
		+ '.sep{height:1px;margin:4px 0;background:#484848}'
		+ '</style></head><body><div id="frame"><div id="menu">' + rows + '</div></div></body></html>';
}

async function captureTrayMenu(shot) {
	const { buildTrayMenuTemplate } = require(path.join(REPO_ROOT, 'src', 'tray-menu.js'));
	const template = buildTrayMenuTemplate(trayDemoModel());
	const scale = shot.scale || 2;
	// CSS zoom (not device scale) because hidden windows only capture at the display scale; the text is re-rasterized, so it stays crisp.
	const html = renderTrayMenuHtml(template, scale);
	const win = new BrowserWindow({ show: false, width: 520, height: 800, useContentSize: true, transparent: true, backgroundColor: '#00000000', webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true } });
	try {
		await win.loadURL('about:blank');
		await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
		await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true);
		const box = await win.webContents.executeJavaScript('(function(){var r=document.getElementById("frame").getBoundingClientRect();return {width:Math.ceil(r.width),height:Math.ceil(r.height)};})()', true);
		win.setContentSize(box.width, box.height);
		await sleep(400);
		const image = await win.webContents.capturePage();
		const size = image.getSize();
		const file = path.join(outDir, shot.name + '.png');
		fs.writeFileSync(file, image.toPNG());
		process.stdout.write('Wrote ' + path.relative(process.cwd(), file) + ' (' + size.width + 'x' + size.height + ', ' + fs.statSync(file).size + ' bytes)\n');
	} finally {
		await closeWindow(win);
	}
}

// Three illustrative jobs so Live and the Overview job count are not empty. They never reach a provider.
async function addDemoJobs(jobManager) {
	const origin = 'https://example.com';
	const specs = [
		{ requestId: 'req_demo_summary', model: 'model-relay:codex-cli:gpt-5.5', provider: 'codex-cli', providerLabel: 'Codex CLI', delay: 2600, input: 'Summarize the product description below in one sentence.', output: 'This lightweight desk lamp offers adjustable brightness and a warm reading mode.' },
		{ requestId: 'req_demo_translate', model: 'model-relay:grok-cli:grok-4', provider: 'grok-cli', providerLabel: 'Grok CLI', delay: 1400, input: 'Translate "Good morning" into German.', fail: 'The model is not signed in. Run the CLI login on this computer, then press Refresh detection on the Providers page.' },
	];
	const pending = [];
	for (const spec of specs) {
		pending.push(jobManager.run({ requestId: spec.requestId, origin, type: 'chat', model: spec.model, provider: spec.provider, providerLabel: spec.providerLabel }, async (job) => {
			job.appendSessionInput('stdin', spec.input);
			await sleep(spec.delay);
			if (spec.fail) throw new Error(spec.fail);
			job.appendSessionOutput('stdout', spec.output);
			return { success: true };
		}).catch(() => null));
	}
	await Promise.all(pending);
	// One job stays running until the end of the run.
	let release = null;
	const hold = new Promise((resolve) => { release = resolve; });
	jobManager.run({ requestId: 'req_demo_running', origin, type: 'chat', model: 'model-relay:codex-cli:gpt-5.5', provider: 'codex-cli', providerLabel: 'Codex CLI' }, async (job) => {
		job.appendSessionInput('stdin', 'Draft a friendly reminder e-mail about tomorrow\'s team meeting.');
		job.appendSessionOutput('stdout', 'Subject: Reminder - team meeting tomorrow\n\nHi everyone, a quick reminder that we meet tomorrow at 10:00...');
		await hold;
		return { success: true };
	}).catch(() => null);
	await sleep(300);
	return { requestId: 'req_demo_summary', release };
}

async function main() {
	// Loaded only now, after AI_MODEL_RELAY_STATE_DIR points at the temporary directory.
	const statePaths = require(path.join(REPO_ROOT, 'src', 'state-paths.js'));
	if (path.resolve(statePaths.stateDir) !== path.resolve(stateDir) || statePaths.migratedLegacyState) {
		throw new Error('The Relay is not using the isolated state directory; refusing to continue.');
	}
	const stateText = fs.readFileSync(statePaths.statePath, 'utf8').trim();
	if (stateText !== '{}') throw new Error('The temporary state file is not empty; refusing to continue.');

	const port = await findFreePort(Number(args.port) || 8920);
	process.env.ALORBACH_CODEX_BRIDGE_PORT = String(port);
	const { startServer } = require(path.join(REPO_ROOT, 'src', 'server.js'));
	const started = await startServer({ port });
	const base = 'http://127.0.0.1:' + started.port;

	process.stdout.write('Relay listening on ' + base + ' with temporary state in ' + stateDir + '\n');

	fs.mkdirSync(outDir, { recursive: true });
	const username = os.userInfo().username;
	const context = {
		anonymizer: {
			username,
			homes: Array.from(new Set([os.homedir(), os.homedir().toLowerCase(), process.env.USERPROFILE || '', process.env.HOME || ''].filter(Boolean))),
			hostnames: Array.from(new Set([os.hostname(), process.env.COMPUTERNAME || ''].filter(Boolean))),
		},
		demoRequestId: '',
	};
	let demo = null;
	try {
		// The first page load makes the Relay probe the installed CLIs, which can block it for several seconds.
		// Load the page once and wait for that to finish, so the demo jobs below get realistic timings.
		const only = args.only ? String(args.only).split(',').map((item) => item.trim()).filter(Boolean) : null;
		const selected = SHOTS.filter((shot) => !only || only.includes(shot.name));
		const needsRelay = selected.some((shot) => shot.kind !== 'tray');
		if (needsRelay) await warmUp(base);
		if (needsRelay && !args['no-demo-jobs']) {
			demo = await addDemoJobs(started.server.jobManager);
			context.demoRequestId = demo.requestId;
		}
		for (const shot of selected) {
			if (shot.kind === 'tray') await captureTrayMenu(shot);
			else await capture(shot, base, context);
		}
		const source = path.join(outDir, DEFAULT_COPY.from + '.png');
		if (fs.existsSync(source) && (!only || only.includes(DEFAULT_COPY.from))) {
			fs.copyFileSync(source, path.join(outDir, DEFAULT_COPY.to + '.png'));
			process.stdout.write('Copied ' + DEFAULT_COPY.from + '.png to ' + DEFAULT_COPY.to + '.png\n');
		}
	} finally {
		if (demo && demo.release) demo.release();
		await new Promise((resolve) => {
			try { started.server.closeAllConnections && started.server.closeAllConnections(); } catch (error) { /* ignore */ }
			started.server.close(() => resolve());
			setTimeout(resolve, 2000);
		});
	}
}

app.whenReady().then(main).then(() => {
	app.exit(0);
}).catch((error) => {
	process.stderr.write((error && error.stack ? error.stack : String(error)) + '\n');
	app.exit(1);
});
