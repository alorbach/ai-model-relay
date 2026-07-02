'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const debugRoot = path.join(os.tmpdir(), 'alorbach-codex-local-bridge-debug');
let counter = 0;

function safeSegment(value, fallback = 'local-model') {
	const text = String(value || fallback).trim() || fallback;
	return text.replace(/[^a-z0-9_.-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || fallback;
}

function timestampSegment(date = new Date()) {
	return date.toISOString().replace(/[:.]/g, '-');
}

function ensureDebugRoot() {
	fs.mkdirSync(debugRoot, { recursive: true });
	return debugRoot;
}

function resetTempDebugLogs() {
	try {
		fs.rmSync(debugRoot, { recursive: true, force: true });
	} catch (error) {}
	ensureDebugRoot();
	return debugRoot;
}

function writeText(filePath, value) {
	fs.writeFileSync(filePath, String(value ?? ''), 'utf8');
}

function writeJsonFile(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function beginLocalModelDebugLog(options = {}) {
	try {
		ensureDebugRoot();
		const index = String(++counter).padStart(4, '0');
		const kind = safeSegment(options.kind || options.type || 'local-model');
		const model = safeSegment(options.model || 'model');
		const requestId = safeSegment(options.requestId || options.request_id || 'no-request');
		const dir = path.join(debugRoot, `${timestampSegment()}-${index}-${kind}-${model}-${requestId}`);
		fs.mkdirSync(dir, { recursive: true });
		const metadata = {
			time: new Date().toISOString(),
			kind: options.kind || options.type || 'local-model',
			model: options.model || '',
			provider: options.provider || '',
			request_id: options.requestId || options.request_id || '',
			route: options.route || '',
			debug_dir: dir,
		};
		writeJsonFile(path.join(dir, 'metadata.json'), metadata);
		return {
			dir,
			metadataPath: path.join(dir, 'metadata.json'),
			promptPath: path.join(dir, 'prompt.txt'),
			outputPath: path.join(dir, 'output.txt'),
			stdoutPath: path.join(dir, 'stdout.txt'),
			stderrPath: path.join(dir, 'stderr.txt'),
			writePrompt(value) {
				writeText(path.join(dir, 'prompt.txt'), value);
			},
			writeOutput(value) {
				writeText(path.join(dir, 'output.txt'), value);
			},
			writeStdout(value) {
				writeText(path.join(dir, 'stdout.txt'), value);
			},
			writeStderr(value) {
				writeText(path.join(dir, 'stderr.txt'), value);
			},
			writeJson(name, value) {
				writeJsonFile(path.join(dir, safeSegment(name, 'data') + '.json'), value);
			},
			finish(details = {}) {
				writeJsonFile(path.join(dir, 'metadata.json'), {
					...metadata,
					finished_at: new Date().toISOString(),
					...details,
					debug_dir: dir,
				});
			},
		};
	} catch (error) {
		return null;
	}
}

module.exports = {
	beginLocalModelDebugLog,
	debugRoot,
	resetTempDebugLogs,
};
