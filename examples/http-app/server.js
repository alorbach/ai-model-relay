'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const host = process.env.ALORBACH_EXAMPLE_HOST || '127.0.0.1';
const port = Number(process.env.ALORBACH_EXAMPLE_PORT || 8787);
const publicDir = path.join(__dirname, 'public');

const contentTypes = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
};

function send(res, status, body, headers = {}) {
	res.writeHead(status, {
		'Cache-Control': 'no-store',
		...headers,
	});
	res.end(body);
}

function resolveRequestPath(urlPath) {
	const pathname = decodeURIComponent(new URL(urlPath, `http://${host}:${port}`).pathname);
	const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
	const resolved = path.resolve(publicDir, relative);
	if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) {
		return '';
	}
	return resolved;
}

const server = http.createServer((req, res) => {
	if (req.method !== 'GET') {
		send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
		return;
	}

	const filePath = resolveRequestPath(req.url);
	if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
		send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
		return;
	}

	const ext = path.extname(filePath).toLowerCase();
	send(res, 200, fs.readFileSync(filePath), { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
});

server.listen(port, host, () => {
	process.stdout.write(`Local bridge example listening on http://${host}:${port}\n`);
});
