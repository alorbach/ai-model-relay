'use strict';

const http = require('http');
const codex = require('./codex');
const security = require('./security');

let pairingCode = security.createPairingCode();

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

function readBody(req) {
	return new Promise((resolve, reject) => {
		let body = '';
		let size = 0;
		req.setEncoding('utf8');
		req.on('data', (chunk) => {
			size += Buffer.byteLength(chunk, 'utf8');
			if (size > security.MAX_BODY_BYTES) {
				reject(new Error('Request body is too large.'));
				req.destroy();
				return;
			}
			body += chunk;
		});
		req.on('end', () => {
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

function exposeOrigin(req) {
	return security.normalizeOrigin(req.headers.origin || '');
}

function pairedOriginForCors(req) {
	const origin = exposeOrigin(req);
	return origin && security.getPairing(origin) ? origin : '';
}

function requirePairing(req, res) {
	const origin = exposeOrigin(req);
	const token = req.headers['x-alorbach-bridge-token'];
	if (!origin || !security.validateBridgeToken(origin, token)) {
		sendJson(res, 403, { success: false, message: 'This WordPress origin is not paired with the local Codex bridge.' }, origin);
		return null;
	}
	return origin;
}

async function route(req, res) {
	const origin = exposeOrigin(req);
	if (!security.isLocalAddress(req)) {
		sendJson(res, 403, { success: false, message: 'Local Codex bridge only accepts localhost requests.' });
		return;
	}

	if (req.method === 'OPTIONS') {
		sendJson(res, 204, {}, origin || pairedOriginForCors(req));
		return;
	}

	const url = new URL(req.url, 'http://127.0.0.1');
	if (req.method === 'GET' && url.pathname === '/v1/status') {
		const status = codex.checkStatus();
		sendJson(res, status.success ? 200 : 503, {
			...status,
			bridge: {
				version: require('../package.json').version,
				paired_origins: Object.keys(security.getPairings()),
			},
		}, origin || pairedOriginForCors(req));
		return;
	}

	if (req.method === 'GET' && url.pathname === '/v1/models') {
		const pairedOrigin = requirePairing(req, res);
		if (!pairedOrigin) {
			return;
		}
		sendJson(res, 200, codex.models(), pairedOrigin);
		return;
	}

	if (req.method !== 'POST') {
		sendJson(res, 405, { success: false, message: 'Method not allowed.' }, origin);
		return;
	}

	let body;
	try {
		body = await readBody(req);
	} catch (error) {
		sendJson(res, 400, { success: false, message: error.message || 'Invalid request.' }, origin);
		return;
	}

	if (url.pathname === '/v1/pair') {
		const safeOrigin = security.normalizeOrigin(body.origin || origin);
		if (!safeOrigin) {
			sendJson(res, 400, { success: false, message: 'A valid WordPress origin is required.' }, origin);
			return;
		}
		if (String(body.pairing_code || '') !== pairingCode) {
			sendJson(res, 403, { success: false, message: 'Pairing code did not match the local tray app.' }, safeOrigin);
			return;
		}
		const token = security.createToken();
		security.savePairing(safeOrigin, token);
		pairingCode = security.createPairingCode();
		if (process.send) {
			process.send({ type: 'pairing-code', pairingCode });
		}
		sendJson(res, 200, { success: true, origin: safeOrigin, token }, safeOrigin);
		return;
	}

	if (url.pathname === '/v1/unpair') {
		const pairedOrigin = requirePairing(req, res);
		if (!pairedOrigin) {
			return;
		}
		security.removePairing(pairedOrigin);
		sendJson(res, 200, { success: true }, pairedOrigin);
		return;
	}

	const pairedOrigin = requirePairing(req, res);
	if (!pairedOrigin) {
		return;
	}
	if (!body.job_token || !body.request_hash || !body.request_id) {
		sendJson(res, 400, { success: false, message: 'Signed WordPress job token, request hash, and request id are required.' }, pairedOrigin);
		return;
	}

	if (url.pathname === '/v1/chat') {
		const result = codex.chat(body.payload || {});
		sendJson(res, result.success ? 200 : 500, result, pairedOrigin);
		return;
	}
	if (url.pathname === '/v1/images') {
		const result = codex.images(body.payload || {});
		sendJson(res, result.success ? 200 : 500, result, pairedOrigin);
		return;
	}
	sendJson(res, 404, { success: false, message: 'Unknown local bridge route.' }, pairedOrigin);
}

function createServer() {
	return http.createServer((req, res) => {
		route(req, res).catch((error) => {
			sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'Unexpected bridge failure.' }, exposeOrigin(req));
		});
	});
}

function startServer(options = {}) {
	const requestedPort = Number(options.port || process.env.ALORBACH_CODEX_BRIDGE_PORT || 8765);
	const server = createServer();
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(requestedPort, '127.0.0.1', () => {
			server.off('error', reject);
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
		if (process.send) {
			process.send({ type: 'ready', port: result.port, pairingCode });
		}
		process.stdout.write(`Codex Local Bridge listening on http://127.0.0.1:${result.port}\n`);
		process.stdout.write(`Pairing code: ${pairingCode}\n`);
	}).catch((error) => {
		if (process.send) {
			process.send({ type: 'error', message: error && error.message ? error.message : String(error) });
		}
		process.stderr.write((error && error.message ? error.message : String(error)) + '\n');
		process.exit(1);
	});
}

module.exports = {
	createServer,
	getPairingCode: () => pairingCode,
	startServer,
};
