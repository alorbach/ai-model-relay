'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { createBoundedCollector, safeProcessSend } = require('../src/diagnostics');
const { createStatusEvents } = require('../src/server');
const { beginLocalModelDebugLog, debugRoot, resetTempDebugLogs } = require('../src/temp-debug-logs');

class FakeResponse extends EventEmitter {
	constructor() {
		super();
		this.destroyed = false;
		this.writableEnded = false;
		this.headers = null;
		this.writes = [];
		this.failWrites = false;
	}

	writeHead(statusCode, headers) {
		this.statusCode = statusCode;
		this.headers = headers;
	}

	write(chunk) {
		if (this.failWrites) {
			throw new Error('fake client socket closed');
		}
		this.writes.push(String(chunk));
		return true;
	}
}

(() => {
	const belowLimit = createBoundedCollector({ maxChars: 1024, headChars: 128 });
	belowLimit.append('a'.repeat(900));
	assert.strictEqual(belowLimit.value(), 'a'.repeat(900));
	assert.strictEqual(belowLimit.stats().truncated_chars, 0);

	const collector = createBoundedCollector({ maxChars: 1024, headChars: 128 });
	collector.append('start-');
	collector.append('x'.repeat(4096));
	collector.append('-end');
	const value = collector.value();
	const stats = collector.stats();
	assert.ok(value.startsWith('start-'));
	assert.ok(value.endsWith('-end'));
	assert.ok(value.includes('[truncated'));
	assert.ok(stats.truncated_chars > 0);
	assert.ok(stats.retained_chars <= 1024);

	resetTempDebugLogs();
	const stalePath = path.join(debugRoot, 'stale.txt');
	fs.writeFileSync(stalePath, 'old');
	assert.ok(fs.existsSync(stalePath));
	resetTempDebugLogs();
	assert.ok(!fs.existsSync(stalePath));
	const debugLog = beginLocalModelDebugLog({
		kind: 'chat',
		model: 'codex-local:auto',
		provider: 'codex-cli',
		requestId: 'request-1',
		route: '/v1/chat',
	});
	assert.ok(debugLog.dir.startsWith(debugRoot));
	debugLog.writePrompt('full prompt');
	debugLog.writeOutput('full output');
	debugLog.writeStdout('stdout');
	debugLog.writeStderr('stderr');
	debugLog.finish({ status: 0 });
	assert.strictEqual(fs.readFileSync(path.join(debugLog.dir, 'prompt.txt'), 'utf8'), 'full prompt');
	assert.strictEqual(fs.readFileSync(path.join(debugLog.dir, 'output.txt'), 'utf8'), 'full output');
	assert.ok(fs.readFileSync(path.join(debugLog.dir, 'metadata.json'), 'utf8').includes('request-1'));

	const originalSend = process.send;
	const ipcError = new Error('Channel closed');
	ipcError.code = 'ERR_IPC_CHANNEL_CLOSED';
	process.send = () => {
		throw ipcError;
	};
	try {
		assert.strictEqual(safeProcessSend({ type: 'test-message' }, { logName: 'test' }), false);
	} finally {
		if (originalSend) {
			process.send = originalSend;
		} else {
			delete process.send;
		}
	}

	const statusEvents = createStatusEvents();
	const response = new FakeResponse();
	statusEvents.add(response, {
		events: ['jobs'],
		initialEvents: [['jobs', { running_count: 0 }]],
	});
	assert.strictEqual(response.statusCode, 200);
	assert.ok(response.writes.join('').includes('event: jobs'));
	response.failWrites = true;
	assert.doesNotThrow(() => statusEvents.broadcast('jobs', { running_count: 1 }));
	assert.doesNotThrow(() => statusEvents.broadcast('heartbeat', { time: 'now' }));

	const closedResponse = new FakeResponse();
	statusEvents.add(closedResponse, { events: ['jobs'] });
	closedResponse.destroyed = true;
	assert.doesNotThrow(() => statusEvents.broadcast('jobs', { running_count: 2 }));

	console.log('diagnostics tests passed');
})();
