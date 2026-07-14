'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const codex = require('./codex');
const { attachDebugHelp } = require('./debug-help');
const { JobManager, clampMaxConcurrent } = require('./job-manager');
const mediaAnalysis = require('./media-analysis');
const security = require('./security');
const { statusPageHtml } = require('./status-page');
const { resetTempDebugLogs } = require('./temp-debug-logs');
const video = require('./video');
const { PRODUCT_NAME, SHORT_NAME, LEGACY_PRODUCT_NAME } = require('./brand');
const { createBackendRegistry } = require('./backend-registry');
const relaySettings = require('./relay-settings');
const { createStatusCache } = require('./status-cache');
const packageInfo = require('../package.json');
const { appendLog, safeError, safeProcessSend } = require('./diagnostics');

let pairingCode = security.createPairingCode();
const faviconPath = path.join(__dirname, '..', 'assets', 'favicon.ico');

function maxConcurrentJobs() {
	return clampMaxConcurrent(process.env.ALORBACH_CODEX_MAX_CONCURRENT_JOBS || 2);
}

function sendJobState(jobManager) {
	safeProcessSend({ type: 'job-state', jobs: jobManager.snapshot() }, { logName: 'server' });
}

function sendJobStateSnapshot(snapshot) {
	safeProcessSend({ type: 'job-state', jobs: snapshot }, { logName: 'server' });
}

function sseHeaders(origin = '') {
	const headers = {
		'Content-Type': 'text/event-stream; charset=utf-8',
		'Cache-Control': 'no-store, no-transform',
		Connection: 'keep-alive',
		'X-Accel-Buffering': 'no',
	};
	if (origin) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Alorbach-Bridge-Token, X-Alorbach-Request-Id';
		headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
		headers.Vary = 'Origin';
	}
	return headers;
}

function createStatusEvents() {
	const clients = new Set();
	function remove(client, reason = '') {
		if (!client || client.closed) {
			return;
		}
		client.closed = true;
		if (client.heartbeatTimer) {
			clearInterval(client.heartbeatTimer);
			client.heartbeatTimer = null;
		}
		clients.delete(client);
		if (reason) {
			appendLog('server', 'Status event stream closed.', { reason });
		}
	}
	return {
		add(res, options = {}) {
			const client = {
				res,
				events: new Set(options.events || ['jobs']),
				heartbeatTimer: null,
				closed: false,
			};
			clients.add(client);
			res.on('close', () => remove(client));
			res.on('error', (error) => remove(client, error && error.message ? error.message : 'response error'));
			try {
				res.writeHead(200, sseHeaders(options.origin || ''));
				res.write('retry: 3000\n\n');
			} catch (error) {
				remove(client, error && error.message ? error.message : 'initial write failed');
				return;
			}
			for (const [event, payload] of options.initialEvents || []) {
				this.send(client, event, payload);
			}
			if (client.closed) {
				return;
			}
			client.heartbeatTimer = setInterval(() => {
				this.send(client, 'heartbeat', { time: new Date().toISOString() });
			}, 15000);
			if (typeof client.heartbeatTimer.unref === 'function') {
				client.heartbeatTimer.unref();
			}
		},
		broadcast(event, payload) {
			for (const client of clients) {
				this.send(client, event, payload);
			}
		},
		send(client, event, payload) {
			if (!client.events.has(event) && event !== 'heartbeat') {
				return;
			}
			if (client.closed || client.res.destroyed || client.res.writableEnded) {
				remove(client);
				return;
			}
			let data;
			try {
				data = JSON.stringify(payload);
			} catch (error) {
				appendLog('server', 'Status event payload could not be serialized.', { event, error: safeError(error) });
				return;
			}
			try {
				client.res.write(`event: ${event}\n`);
				client.res.write(`data: ${data}\n\n`);
			} catch (error) {
				remove(client, error && error.message ? error.message : 'write failed');
			}
		},
	};
}

function createJobManager(options = {}) {
	let manager = null;
	manager = new JobManager({
		maxConcurrent: options.maxConcurrent || maxConcurrentJobs(),
		onChange: options.onJobState || (() => sendJobState(manager)),
	});
	return manager;
}

function sendJson(res, statusCode, payload, origin) {
	const headers = {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-store',
	};
	if (origin) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Alorbach-Bridge-Token, X-Alorbach-Request-Id';
		headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
		headers.Vary = 'Origin';
	}
	res.writeHead(statusCode, headers);
	res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
	res.writeHead(statusCode, {
		'Content-Type': 'text/html; charset=utf-8',
		'Cache-Control': 'no-store',
	});
	res.end(html);
}

function sendFavicon(res) {
	try {
		const icon = fs.readFileSync(faviconPath);
		res.writeHead(200, {
			'Content-Type': 'image/x-icon',
			'Content-Length': icon.length,
			'Cache-Control': 'public, max-age=86400',
			'X-Content-Type-Options': 'nosniff',
		});
		res.end(icon);
	} catch (error) {
		res.writeHead(404, { 'Cache-Control': 'no-store' });
		res.end();
	}
}

function sendArtifact(res, artifact, origin) {
	const headers = {
		'Content-Type': artifact.mime_type,
		'Content-Length': artifact.bytes.length,
		'Cache-Control': 'no-store',
		'Content-Disposition': 'inline',
		'X-Content-Type-Options': 'nosniff',
	};
	if (origin) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers.Vary = 'Origin';
	}
	res.writeHead(200, headers);
	res.end(artifact.bytes);
}

function sendErrorJson(req, res, statusCode, payload, origin, options = {}) {
	sendJson(res, statusCode, attachDebugHelp(req, payload, {
		...options,
		statusCode,
	}), origin);
}

function readBody(req, maxBytes) {
	return new Promise((resolve, reject) => {
		let body = '';
		let size = 0;
		let rejected = false;
		req.setEncoding('utf8');
		req.on('data', (chunk) => {
			size += Buffer.byteLength(chunk, 'utf8');
			if (size > maxBytes) {
				if (!rejected) {
					rejected = true;
					reject(new Error('Request body is too large.'));
				}
				return;
			}
			body += chunk;
		});
		req.on('end', () => {
			if (rejected) {
				return;
			}
			if (!body.trim()) {
				resolve({});
				return;
			}
			try {
				resolve(JSON.parse(body));
			} catch (error) {
				reject(new Error('Request body was not valid JSON.'));
			}
		});
		req.on('error', reject);
	});
}

function exposeOrigin(req, bridgeSecurity) {
	return bridgeSecurity.normalizeOrigin(req.headers.origin || '');
}

function pairedOriginForCors(req, bridgeSecurity) {
	const origin = exposeOrigin(req, bridgeSecurity);
	return origin && bridgeSecurity.getPairing(origin) ? origin : '';
}

function requirePairing(req, res, bridgeSecurity) {
	const origin = exposeOrigin(req, bridgeSecurity);
	const token = req.headers['x-alorbach-bridge-token'];
	if (!origin || !bridgeSecurity.validateBridgeToken(origin, token)) {
		sendErrorJson(req, res, 403, { success: false, message: 'This WordPress origin is not paired with the local Codex bridge.' }, origin);
		return null;
	}
	return origin;
}

function modelFromPayload(payload, fallback) {
	return String((payload && payload.model) || fallback || 'codex-local:auto');
}

function capabilitiesPayload(context) {
	if (context.statusCache) {
		return { ...context.statusCache.capabilities(), product: { name: PRODUCT_NAME, short_name: SHORT_NAME, legacy_name: LEGACY_PRODUCT_NAME }, bridge: { version: packageInfo.version }, frontend_interfaces: { legacy_v1: true, relay_v1: true, legacy_routes: ['/v1/status', '/v1/capabilities', '/v1/models', '/v1/chat', '/v1/images', '/v1/transcribe', '/v1/videos', '/v1/media/analyze'], relay_routes: ['/v1/relay/status', '/v1/relay/capabilities', '/v1/relay/models', '/v1/relay/jobs/chat', '/v1/relay/jobs/images', '/v1/relay/jobs/transcribe', '/v1/relay/jobs/videos', '/v1/relay/jobs/media/analyze'] } };
	}
	const codexCapabilities = context.codex.capabilities ? context.codex.capabilities() : { success: true, bridge_features: {} };
	return {
		success: true,
		product: {
			name: PRODUCT_NAME,
			short_name: SHORT_NAME,
			legacy_name: LEGACY_PRODUCT_NAME,
		},
		bridge: {
			version: packageInfo.version,
		},
		codex: codexCapabilities.codex || {},
		asr: codexCapabilities.asr || {},
		features: codexCapabilities.bridge_features || {},
		backends: context.backends.capabilities(),
		frontend_interfaces: {
			legacy_v1: true,
			relay_v1: true,
			legacy_routes: ['/v1/status', '/v1/capabilities', '/v1/models', '/v1/chat', '/v1/images', '/v1/transcribe', '/v1/videos', '/v1/media/analyze'],
			relay_routes: ['/v1/relay/status', '/v1/relay/capabilities', '/v1/relay/models', '/v1/relay/jobs/chat', '/v1/relay/jobs/images', '/v1/relay/jobs/transcribe', '/v1/relay/jobs/videos', '/v1/relay/jobs/media/analyze'],
		},
		video: context.video.capabilities ? context.video.capabilities() : { enabled: false },
		media_analysis: context.mediaAnalysis.capabilities ? context.mediaAnalysis.capabilities() : { enabled: false },
	};
}

function statusPayload(context, options = {}) {
	if (context.statusCache) {
		const cached = context.statusCache.status();
		if (options.includePairedOrigins !== false) cached.bridge = { ...(cached.bridge || {}), paired_origins: Object.keys(context.security.getPairings()) };
		return cached;
	}
	const status = context.codex.checkStatus();
	const bridge = {
		version: packageInfo.version,
		product_name: PRODUCT_NAME,
		short_name: SHORT_NAME,
		legacy_name: LEGACY_PRODUCT_NAME,
	};
	if (options.includePairedOrigins !== false) {
		bridge.paired_origins = Object.keys(context.security.getPairings());
	}
	return {
		...status,
		bridge,
		asr: context.codex.asrStatus ? context.codex.asrStatus() : {},
		jobs: context.jobManager.snapshot(),
	};
}

function modelsPayload(context) {
	const modelPayload = context.codex.models();
	const videoCapabilities = context.video.capabilities ? context.video.capabilities() : { enabled: false, models: [] };
	if (modelPayload && modelPayload.models && videoCapabilities.enabled) {
		modelPayload.models.video = (videoCapabilities.models || []).map((id) => `openai-video:${id}`);
	}
	modelPayload.models = modelPayload.models || {};
	const backendModels = context.backends.models();
	modelPayload.models.relay = backendModels.map((model) => model.id);
	modelPayload.backends = backendModels;
	return modelPayload;
}

function relayPayloadFor(context, jobType, payload = {}) {
	const requested = payload && typeof payload === 'object' ? payload : {};
	const explicit = String(requested.model || '').trim() || String(requested.provider || requested.backend || '').trim();
	const model = explicit ? String(requested.model || '').trim() : context.relaySettings.settings().defaults[jobType];
	const resolvedPayload = explicit ? requested : { ...requested, model };
	const resolved = context.backends.resolve
		? context.backends.resolve(jobType, resolvedPayload)
		: (() => {
			const driver = context.backends.getDriver(jobType, resolvedPayload);
			const capabilities = driver && driver.capabilities ? driver.capabilities() : null;
			return driver && capabilities && capabilities.ready && (driver.job_types || []).includes(jobType) ? { driver, capabilities } : { error: { success: false, category: 'configuration', code: 'backend_unavailable', message: `Selected provider is unavailable: ${model || requested.provider || requested.backend}.` } };
		})();
	if (resolved.error) {
		const code = explicit ? resolved.error.code : 'relay_default_unavailable';
		return { error: { ...resolved.error, code, message: explicit ? resolved.error.message : `Configured default for ${jobType} is unavailable: ${model}. ${resolved.error.message}` } };
	}
	return { payload: resolvedPayload, resolved };
}

function workflowForJob(jobType, provider) {
	const key = `${provider || ''}:${jobType}`;
	const workflows = {
		'codex-cli:images': 'image-generation',
		'codex-cli:chat': 'Codex chat',
		'codex-cli:media.analyze': 'media analysis',
		'grok-cli:images': 'Grok Imagine: image_gen',
		'grok-cli:videos': 'Grok Imagine: image_to_video',
		'grok-cli:chat': 'Grok chat',
		'cursor-cli:chat': 'Cursor Agent',
		'local-asr:transcribe': 'Local ASR',
		'openai-videos:videos': 'OpenAI Videos API',
		'xai-api:chat': 'xAI Chat Completions API',
		'api-key-chat:chat': 'Chat Completions API',
	};
	return workflows[key] || '';
}

function jobDisplayMeta(context, jobType, payload, fallbackProvider = '', fallbackLabel = '', resolved = null) {
	const driver = resolved && resolved.driver || (context.backends && context.backends.getDriver ? context.backends.getDriver(jobType, payload || {}) : null);
	const provider = driver && driver.id || fallbackProvider;
	return {
		provider,
		providerLabel: driver && driver.label || fallbackLabel,
		workflow: workflowForJob(jobType, provider),
	};
}

function errorStatusForResult(result) {
	if (result && result.category === 'validation') {
		return 400;
	}
	if (result && result.category === 'configuration') {
		return 503;
	}
	return 500;
}

async function route(req, res, context) {
	const bridgeSecurity = context.security;
	const codexAdapter = context.codex;
	const jobManager = context.jobManager;
	const origin = exposeOrigin(req, bridgeSecurity);
	if (!bridgeSecurity.isLocalAddress(req)) {
		sendErrorJson(req, res, 403, { success: false, message: 'AI Model Relay only accepts localhost requests.' });
		return;
	}

	if (req.method === 'OPTIONS') {
		sendJson(res, 204, {}, origin || pairedOriginForCors(req, bridgeSecurity));
		return;
	}

	const url = new URL(req.url, 'http://127.0.0.1');
	if (req.method === 'GET' && url.pathname === '/favicon.ico') {
		sendFavicon(res);
		return;
	}
	if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/status')) {
		sendHtml(res, 200, statusPageHtml());
		return;
	}
	const artifactMatch = url.pathname.match(/^\/v1\/status\/jobs\/(\d+)\/artifacts\/(\d+)$/);
	if (req.method === 'GET' && artifactMatch) {
		const artifact = jobManager.artifact(artifactMatch[1], artifactMatch[2]);
		if (!artifact) {
			sendJson(res, 404, { success: false, message: 'Generated job artifact was not found.' }, origin || pairedOriginForCors(req, bridgeSecurity));
			return;
		}
		sendArtifact(res, artifact, origin || pairedOriginForCors(req, bridgeSecurity));
		return;
	}

	if (req.method === 'GET' && (url.pathname === '/v1/status' || url.pathname === '/v1/relay/status')) {
		const status = statusPayload(context);
		sendJson(res, status.success ? 200 : 503, status, origin || pairedOriginForCors(req, bridgeSecurity));
		return;
	}

	if (req.method === 'GET' && (url.pathname === '/v1/capabilities' || url.pathname === '/v1/relay/capabilities')) {
		sendJson(res, 200, capabilitiesPayload(context), origin || pairedOriginForCors(req, bridgeSecurity));
		return;
	}

	if (req.method === 'GET' && url.pathname === '/v1/asr/settings') {
		const payload = context.codex.asrSettings ? context.codex.asrSettings({ refresh: url.searchParams.get('refresh') === '1' }) : { success: false, message: 'ASR settings are unavailable.' };
		sendJson(res, payload.success === false ? 500 : 200, payload, origin || pairedOriginForCors(req, bridgeSecurity));
		return;
	}
	if (req.method === 'GET' && url.pathname === '/v1/relay/settings') {
		sendJson(res, 200, { success: true, settings: context.relaySettings.settings(), models: context.backends.models(), backends: context.backends.capabilities() }, origin || pairedOriginForCors(req, bridgeSecurity));
		return;
	}

	if (req.method === 'GET' && url.pathname === '/v1/status/events') {
		context.statusEvents.add(res, {
			events: ['status', 'capabilities', 'jobs'],
			initialEvents: [
				['status', statusPayload(context)],
				['capabilities', capabilitiesPayload(context)],
				['jobs', jobManager.snapshot()],
			],
		});
		return;
	}

	if (req.method === 'GET' && url.pathname === '/v1/status/stream') {
		const pairedOrigin = requirePairing(req, res, bridgeSecurity);
		if (!pairedOrigin) {
			return;
		}
		context.statusEvents.add(res, {
			origin: pairedOrigin,
			events: ['status', 'capabilities', 'jobs'],
			initialEvents: [
				['status', statusPayload(context, { includePairedOrigins: false })],
				['capabilities', capabilitiesPayload(context)],
				['jobs', jobManager.snapshot()],
			],
		});
		return;
	}

	if (req.method === 'GET' && (url.pathname === '/v1/models' || url.pathname === '/v1/relay/models')) {
		const pairedOrigin = requirePairing(req, res, bridgeSecurity);
		if (!pairedOrigin) {
			return;
		}
		sendJson(res, 200, modelsPayload(context), pairedOrigin);
		return;
	}

	if (req.method !== 'POST') {
		sendErrorJson(req, res, 405, { success: false, message: 'Method not allowed.' }, origin);
		return;
	}

	let body;
	try {
		body = await readBody(req, bridgeSecurity.MAX_BODY_BYTES || security.MAX_BODY_BYTES);
	} catch (error) {
		sendErrorJson(req, res, 400, { success: false, message: error.message || 'Invalid request.' }, origin);
		return;
	}

	if (url.pathname === '/v1/pair') {
		const safeOrigin = bridgeSecurity.normalizeOrigin(body.origin || origin);
		if (!safeOrigin) {
			sendErrorJson(req, res, 400, { success: false, message: 'A valid WordPress origin is required.' }, origin);
			return;
		}
		if (String(body.pairing_code || '') !== pairingCode) {
			sendErrorJson(req, res, 403, { success: false, message: 'Pairing code did not match the local tray app.' }, safeOrigin);
			return;
		}
		const token = bridgeSecurity.createToken();
		bridgeSecurity.savePairing(safeOrigin, token);
		pairingCode = bridgeSecurity.createPairingCode();
		safeProcessSend({ type: 'pairing-code', pairingCode }, { logName: 'server' });
		sendJson(res, 200, { success: true, origin: safeOrigin, token }, safeOrigin);
		return;
	}

	if (url.pathname === '/v1/unpair') {
		const pairedOrigin = requirePairing(req, res, bridgeSecurity);
		if (!pairedOrigin) {
			return;
		}
		bridgeSecurity.removePairing(pairedOrigin);
		sendJson(res, 200, { success: true }, pairedOrigin);
		return;
	}

	if (url.pathname === '/v1/asr/settings') {
		if (!context.codex.saveAsrSettings || !context.codex.asrSettings) {
			sendErrorJson(req, res, 500, { success: false, message: 'ASR settings are unavailable.' }, origin);
			return;
		}
		const settings = context.codex.saveAsrSettings(body.settings || body || {});
		const payload = context.codex.asrSettings();
		context.statusEvents.broadcast('status', statusPayload(context));
		context.statusEvents.broadcast('capabilities', capabilitiesPayload(context));
		sendJson(res, 200, { success: true, settings, capabilities: payload.capabilities }, origin);
		return;
	}
	if (url.pathname === '/v1/relay/settings') {
		const settings = context.relaySettings.saveSettings(body.settings || body || {});
		context.statusEvents.broadcast('capabilities', capabilitiesPayload(context));
		sendJson(res, 200, { success: true, settings, models: context.backends.models() }, origin || pairedOriginForCors(req, bridgeSecurity));
		return;
	}
	if (url.pathname === '/v1/relay/refresh') {
		context.statusCache.refresh();
		const current = context.statusCache.status();
		sendJson(res, 202, { success: true, checking: true, refresh: current.refresh || null }, origin || pairedOriginForCors(req, bridgeSecurity));
		return;
	}

	const pairedOrigin = requirePairing(req, res, bridgeSecurity);
	if (!pairedOrigin) {
		return;
	}
	if (!body.job_token || !body.request_hash || !body.request_id) {
		sendErrorJson(req, res, 400, { success: false, message: 'Signed WordPress job token, request hash, and request id are required.' }, pairedOrigin, { requestId: body.request_id });
		return;
	}

	if (url.pathname === '/v1/chat' || url.pathname === '/v1/relay/jobs/chat') {
		const isRelayRoute = url.pathname === '/v1/relay/jobs/chat';
		const resolved = isRelayRoute ? relayPayloadFor(context, 'chat', body.payload || {}) : { payload: body.payload || {} };
		if (resolved.error) { sendErrorJson(req, res, 503, resolved.error, pairedOrigin, { requestId: body.request_id, route: url.pathname }); return; }
		const display = isRelayRoute ? jobDisplayMeta(context, 'chat', resolved.payload, '', '', resolved.resolved) : { provider: 'codex-cli', providerLabel: 'Codex CLI', workflow: workflowForJob('chat', 'codex-cli') };
		const result = await jobManager.run({
			requestId: body.request_id,
			type: 'chat',
			model: modelFromPayload(resolved.payload, 'codex-local:auto'),
			...display,
		}, (session) => isRelayRoute ? context.backends.run('chat', resolved.payload, session) : codexAdapter.chat(resolved.payload, session));
		if (!result.success) {
			sendErrorJson(req, res, errorStatusForResult(result), result, pairedOrigin, { requestId: body.request_id, route: url.pathname });
			return;
		}
		sendJson(res, 200, result, pairedOrigin);
		return;
	}
	if (url.pathname === '/v1/images' || url.pathname === '/v1/relay/jobs/images') {
		const isRelayRoute = url.pathname === '/v1/relay/jobs/images';
		const resolved = isRelayRoute ? relayPayloadFor(context, 'images', body.payload || {}) : { payload: body.payload || {} };
		if (resolved.error) { sendErrorJson(req, res, 503, resolved.error, pairedOrigin, { requestId: body.request_id, route: url.pathname }); return; }
		const display = isRelayRoute ? jobDisplayMeta(context, 'images', resolved.payload, '', '', resolved.resolved) : { provider: 'codex-cli', providerLabel: 'Codex CLI', workflow: workflowForJob('images', 'codex-cli') };
		const result = await jobManager.run({
			requestId: body.request_id,
			type: 'images',
			model: modelFromPayload(resolved.payload, 'codex-local:image'),
			...display,
		}, (session) => isRelayRoute ? context.backends.run('images', resolved.payload, session) : codexAdapter.images(resolved.payload, session));
		if (!result.success) {
			sendErrorJson(req, res, errorStatusForResult(result), result, pairedOrigin, { requestId: body.request_id, route: url.pathname });
			return;
		}
		sendJson(res, 200, result, pairedOrigin);
		return;
	}
	if (url.pathname === '/v1/transcribe' || url.pathname === '/v1/relay/jobs/transcribe') {
		const isRelayRoute = url.pathname === '/v1/relay/jobs/transcribe';
		const resolved = isRelayRoute ? relayPayloadFor(context, 'transcribe', body.payload || {}) : { payload: body.payload || {} };
		if (resolved.error) { sendErrorJson(req, res, 503, resolved.error, pairedOrigin, { requestId: body.request_id, route: url.pathname }); return; }
		const display = isRelayRoute ? jobDisplayMeta(context, 'transcribe', resolved.payload, '', '', resolved.resolved) : { provider: 'local-asr', providerLabel: 'Local ASR', workflow: workflowForJob('transcribe', 'local-asr') };
		const result = await jobManager.run({
			requestId: body.request_id,
			type: 'transcribe',
			model: modelFromPayload(resolved.payload, 'local-asr'),
			...display,
		}, (session) => isRelayRoute ? context.backends.run('transcribe', resolved.payload, session) : codexAdapter.transcribe(resolved.payload, session));
		if (!result.success) {
			sendErrorJson(req, res, errorStatusForResult(result), result, pairedOrigin, { requestId: body.request_id, route: url.pathname });
			return;
		}
		sendJson(res, 200, result, pairedOrigin);
		return;
	}
	if (url.pathname === '/v1/videos' || url.pathname === '/v1/relay/jobs/videos') {
		const isRelayRoute = url.pathname === '/v1/relay/jobs/videos';
		const resolved = isRelayRoute ? relayPayloadFor(context, 'videos', body.payload || {}) : { payload: body.payload || {} };
		if (resolved.error) { sendErrorJson(req, res, 503, resolved.error, pairedOrigin, { requestId: body.request_id, route: url.pathname }); return; }
		const display = isRelayRoute ? jobDisplayMeta(context, 'videos', resolved.payload, '', '', resolved.resolved) : { provider: 'openai-videos', providerLabel: 'OpenAI Videos', workflow: workflowForJob('videos', 'openai-videos') };
		const result = await jobManager.run({
			requestId: body.request_id,
			type: 'videos',
			model: modelFromPayload(resolved.payload, 'sora-2'),
			...display,
		}, (session) => isRelayRoute ? context.backends.run('videos', resolved.payload, session) : context.video.run(resolved.payload, session));
		if (!result.success) {
			sendErrorJson(req, res, errorStatusForResult(result), result, pairedOrigin, { requestId: body.request_id, route: url.pathname });
			return;
		}
		sendJson(res, 200, result, pairedOrigin);
		return;
	}
	if (url.pathname === '/v1/media/analyze' || url.pathname === '/v1/relay/jobs/media/analyze') {
		const isRelayRoute = url.pathname === '/v1/relay/jobs/media/analyze';
		const resolved = isRelayRoute ? relayPayloadFor(context, 'media.analyze', body.payload || {}) : { payload: body.payload || {} };
		if (resolved.error) { sendErrorJson(req, res, 503, resolved.error, pairedOrigin, { requestId: body.request_id, route: url.pathname }); return; }
		const display = isRelayRoute ? jobDisplayMeta(context, 'media.analyze', resolved.payload, '', '', resolved.resolved) : { provider: 'codex-cli', providerLabel: 'Codex CLI', workflow: workflowForJob('media.analyze', 'codex-cli') };
		const result = await jobManager.run({
			requestId: body.request_id,
			type: 'media_analysis',
			model: modelFromPayload(resolved.payload, 'codex-local:auto'),
			...display,
		}, (session) => context.mediaAnalysis.analyze(resolved.payload, codexAdapter, session));
		if (!result.success) {
			sendErrorJson(req, res, errorStatusForResult(result), result, pairedOrigin, { requestId: body.request_id, route: url.pathname });
			return;
		}
		sendJson(res, 200, result, pairedOrigin);
		return;
	}
	sendErrorJson(req, res, 404, { success: false, message: 'Unknown local bridge route.' }, pairedOrigin, { requestId: body.request_id });
}

function createServer(options = {}) {
	const statusEvents = createStatusEvents();
	const onJobState = (snapshot) => {
		if (typeof options.onJobState === 'function') {
			options.onJobState(snapshot);
		} else {
			sendJobStateSnapshot(snapshot);
		}
		statusEvents.broadcast('jobs', snapshot);
	};
	const context = {
		codex: options.codex || codex,
		mediaAnalysis: options.mediaAnalysis || mediaAnalysis,
		security: options.security || security,
		video: options.video || video,
		jobManager: options.jobManager || createJobManager({ ...options, onJobState }),
		statusEvents,
		relaySettings: options.relaySettings || relaySettings,
	};
	context.backends = options.backends || createBackendRegistry({
		codex: context.codex,
		video: context.video,
		xai: options.xai,
		cli: options.cli,
		apiKeyChat: options.apiKeyChat,
	});
	context.statusCache = options.statusCache || createStatusCache(context, (status, capabilities) => { context.statusEvents.broadcast('status', statusPayload(context)); context.statusEvents.broadcast('capabilities', capabilitiesPayload(context)); });
	if (options.backgroundRefresh !== false) {
		const initialRefreshTimer = setTimeout(() => context.statusCache.refresh(), 1000);
		if (typeof initialRefreshTimer.unref === 'function') initialRefreshTimer.unref();
	}
	const server = http.createServer((req, res) => {
		route(req, res, context).catch((error) => {
			appendLog('server', 'Unhandled route failure.', {
				error: safeError(error),
				url: req.url,
				method: req.method,
			});
			try {
				if (!res.headersSent && !res.destroyed && !res.writableEnded) {
					sendErrorJson(req, res, 500, { success: false, message: error && error.message ? error.message : 'Unexpected bridge failure.' }, exposeOrigin(req, context.security));
				}
			} catch (sendError) {
				appendLog('server', 'Failed to send route error response.', { error: safeError(sendError) });
			}
		});
	});
	server.jobManager = context.jobManager;
	return server;
}

function startServer(options = {}) {
	const requestedPort = Number(options.port || process.env.ALORBACH_CODEX_BRIDGE_PORT || 8765);
	resetTempDebugLogs();
	const server = createServer(options);
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(requestedPort, '127.0.0.1', () => {
			server.off('error', reject);
			sendJobState(server.jobManager);
			resolve({ server, port: server.address().port, pairingCode });
		});
	});
}

	if (require.main === module) {
	if (process.argv.includes('--check')) {
		const status = codex.checkStatus();
		process.stdout.write(JSON.stringify(status, null, 2) + '\n');
		process.exit(status.success ? 0 : 1);
	}
	const portArg = process.argv.find((arg) => arg.indexOf('--port=') === 0);
	const port = portArg ? Number(portArg.replace('--port=', '')) : undefined;
	startServer({ port }).then((result) => {
		safeProcessSend({ type: 'ready', port: result.port, pairingCode }, { logName: 'server' });
		process.stdout.write(`${PRODUCT_NAME} listening on http://127.0.0.1:${result.port}\n`);
		process.stdout.write(`Pairing code: ${pairingCode}\n`);
	}).catch((error) => {
		appendLog('server', 'Server failed to start.', { error: safeError(error) });
		safeProcessSend({ type: 'error', message: error && error.message ? error.message : String(error) }, { logName: 'server' });
		process.stderr.write((error && error.message ? error.message : String(error)) + '\n');
		process.exit(1);
	});
}

module.exports = {
	createServer,
	createStatusEvents,
	createJobManager,
	getPairingCode: () => pairingCode,
	startServer,
};
