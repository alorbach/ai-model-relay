'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { createBoundedCollector } = require('./diagnostics');
const { killProcessTree } = require('./cuda-torch-venv');

const TIMEOUT_MS = 15000;
const MAX_CLI_MODELS = 50;
const MAX_CLI_MODEL_OUTPUT_CHARS = 256 * 1024;
const MAX_CHAT_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_CHAT_IMAGE_BASE64_CHARS = Math.ceil(MAX_CHAT_IMAGE_BYTES / 3) * 4 + 4;
const CHAT_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

function cleanText(value) {
	return String(value || '').replace(/\x1b\[[0-9;]*m/g, '').replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
}

const UNAUTHENTICATED_RE = /not logged in|not authenticated|no auth credentials|login required/i;
const LOGGED_IN_RE = /you are logged in|logged in with/i;

function safeDiagnostic(value) {
	const text = cleanText(value).replace(/\b(authorization|bearer|token|api[_ -]?key)(?:\s*[:=]\s*|\s+)(?:bearer\s+)?[^\s,;]+/ig, '$1: <redacted>');
	if (UNAUTHENTICATED_RE.test(text)) return 'Not authenticated.';
	if (/access is denied|permission denied/i.test(text)) return 'Authentication state could not be read by this process.';
	if (/timed out/i.test(text)) return 'CLI probe timed out.';
	return text || 'CLI is unavailable.';
}

function normalizeModelId(value) {
	let candidate = String(value == null ? '' : value).replace(/\x1b\[[0-9;]*m/g, '').trim();
	candidate = candidate.replace(/^[`"']+|[`"']+$/g, '');
	candidate = candidate.replace(/^(?:[-*•]|\d+[.)])\s+/, '');
	if (candidate.includes('|')) candidate = candidate.split('|')[0].trim();
	candidate = candidate.replace(/\s+(?:\([^)]*\)|\[[^\]]*\])\s*$/, '').trim();
	candidate = candidate.replace(/\s+[-–—]\s+.*$/, '').trim();
	if (!/^[A-Za-z0-9][A-Za-z0-9_.:/@+-]{0,127}$/.test(candidate)) return '';
	if (/^(?:available|authenticated|authentication|default|id|logged|login|model|models|name|status|success|true|false|version)$/i.test(candidate)) return '';
	return candidate;
}

function collectModelIds(value, add, depth = 0) {
	if (value == null || depth > 4) return;
	if (typeof value === 'string') {
		const text = value.replace(/\x1b\[[0-9;]*m/g, '').slice(0, MAX_CLI_MODEL_OUTPUT_CHARS);
		if (depth < 3) {
			try {
				const parsed = JSON.parse(text.trim());
				collectModelIds(parsed, add, depth + 1);
				return;
			} catch (error) {}
		}
		const defaultMatch = text.match(/default\s+models?\s*[:=]\s*([^\s,;]+)/i);
		if (defaultMatch) add(defaultMatch[1]);
		const availableMatch = text.match(/available\s+models?\s*[:=]\s*([\s\S]+)/i);
		if (availableMatch) {
			for (const token of availableMatch[1].split(/\s*[*,•]\s+|\s+-\s+|,\s+/)) add(token);
		}
		for (const rawLine of text.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line) continue;
			const labeled = line.match(/^(?:available\s+)?models?\s*[:=]\s*(.+)$/i);
			if (labeled) {
				for (const token of labeled[1].split(/[\s,]+/)) add(token);
				continue;
			}
			if (line.includes('|')) {
				for (const cell of line.split('|')) add(cell);
				continue;
			}
			if (line.includes(',')) {
				for (const token of line.split(',')) add(token);
				continue;
			}
			add(line);
		}
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectModelIds(item, add, depth + 1);
		return;
	}
	if (typeof value !== 'object') return;
	for (const key of ['id', 'model', 'model_id', 'modelId', 'slug', 'name']) {
		if (Object.prototype.hasOwnProperty.call(value, key)) add(value[key]);
	}
	for (const key of ['models', 'data', 'items', 'results', 'choices']) {
		if (Object.prototype.hasOwnProperty.call(value, key)) collectModelIds(value[key], add, depth + 1);
	}
}

function parseCliModelList(output, maxModels = MAX_CLI_MODELS) {
	const limit = Math.max(1, Math.min(MAX_CLI_MODELS, Number(maxModels) || MAX_CLI_MODELS));
	const models = ['auto'];
	const seen = new Set(models);
	const add = (value) => {
		const model = normalizeModelId(value);
		if (!model || seen.has(model) || models.length >= limit) return;
		seen.add(model);
		models.push(model);
	};
	collectModelIds(String(output || '').slice(0, MAX_CLI_MODEL_OUTPUT_CHARS), add);
	return models;
}

function parseCliDefaultModel(output) {
	const text = String(output || '').replace(/\x1b\[[0-9;]*m/g, '').slice(0, MAX_CLI_MODEL_OUTPUT_CHARS);
	if (!text.trim()) return '';
	try {
		const parsed = JSON.parse(text.trim());
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			for (const key of ['default_model', 'defaultModel', 'default']) {
				const id = normalizeModelId(parsed[key]);
				if (id && id !== 'auto') return id;
			}
		}
	} catch (error) {}
	const labeled = text.match(/default\s+models?\s*[:=]\s*([^\s,;]+)/i);
	if (labeled) {
		const id = normalizeModelId(labeled[1]);
		if (id) return id;
	}
	for (const rawLine of text.split(/\r?\n/)) {
		if (!/\(\s*default\s*\)/i.test(rawLine)) continue;
		const id = normalizeModelId(rawLine);
		if (id) return id;
	}
	const marked = text.match(/([A-Za-z0-9][A-Za-z0-9_.:/@+-]{0,127})\s*\(\s*default\s*\)/i);
	return marked ? normalizeModelId(marked[1]) : '';
}

function cliAuthLooksPositive(authText) {
	const text = String(authText || '');
	if (UNAUTHENTICATED_RE.test(text)) return false;
	if (LOGGED_IN_RE.test(text)) return true;
	if (parseCliDefaultModel(text)) return true;
	return parseCliModelList(text).length > 1;
}

function isCliAuthFailure(auth, authText) {
	if (!auth) return false;
	return UNAUTHENTICATED_RE.test(String(authText || ''));
}

function isCliAuthProbeUnreliable(auth, authText) {
	if (!auth || isCliAuthFailure(auth, authText) || cliAuthLooksPositive(authText)) return false;
	return !!(auth.error || (auth.status !== 0 && auth.status != null));
}

function retainCliReadiness(previous, next) {
	if (!next) return previous;
	if (!previous || previous.ready !== true) return next;
	if (next.ready === true) return next;
	if (next.installed === false) return next;
	if (next.state === 'not_authenticated' && next.authenticated === false) return next;
	return previous;
}

function cliDetectAuthFields(base, version, auth, authText, models, defaultModel) {
	const versionText = cleanText(version && (version.stdout || version.stderr));
	if (isCliAuthFailure(auth, authText)) {
		return { ...base, version: versionText, authenticated: false, ready: false, state: 'not_authenticated', diagnostic: 'Not authenticated.', models, default_model: '' };
	}
	if (isCliAuthProbeUnreliable(auth, authText)) {
		return { ...base, version: versionText, authenticated: null, ready: false, state: 'unavailable', diagnostic: safeDiagnostic(auth.error && auth.error.message || authText), models, default_model: defaultModel };
	}
	return { ...base, version: versionText, authenticated: auth ? true : null, ready: !!auth, state: auth ? 'ready' : 'installed', diagnostic: auth ? 'Ready.' : 'Authentication not checked yet.', models, default_model: defaultModel };
}

function defaultModelFrom(models, text) {
	return parseCliDefaultModel(text) || (Array.isArray(models) ? models.find((id) => id && id !== 'auto') : '') || '';
}

function modelListArguments(definition) {
	if (!Array.isArray(definition.modelListArgs)) return [];
	if (!definition.modelListArgs.length) return [];
	return Array.isArray(definition.modelListArgs[0])
		? definition.modelListArgs.filter((args) => Array.isArray(args) && args.length).map((args) => args.map(String))
		: [definition.modelListArgs.map(String)];
}

function modelsFromProbe(output, fallback) {
	const parsed = parseCliModelList(output);
	return parsed.length > 1 ? parsed : fallback;
}

function probeModelListSync(command, definition, options, fallback) {
	for (const args of modelListArguments(definition)) {
		const result = run(command, args, options);
		if (!result.error && result.status === 0) {
			const models = modelsFromProbe(`${result.stdout || ''}\n${result.stderr || ''}`, fallback);
			if (models !== fallback || parseCliModelList(`${result.stdout || ''}\n${result.stderr || ''}`).length > 1) return models;
		}
	}
	return fallback;
}

async function probeModelListAsync(command, definition, options, fallback) {
	for (const args of modelListArguments(definition)) {
		const result = await runAsync(command, args, options);
		if (!result.error && result.status === 0) {
			const models = modelsFromProbe(`${result.stdout || ''}\n${result.stderr || ''}`, fallback);
			if (models !== fallback || parseCliModelList(`${result.stdout || ''}\n${result.stderr || ''}`).length > 1) return models;
		}
	}
	return fallback;
}

function expandWindowsEnvironmentVariables(value, env = process.env) {
	const input = String(value || '');
	const keys = Object.keys(env || {});
	return input.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (match, name) => {
		const key = keys.find((candidate) => candidate.toUpperCase() === name.toUpperCase());
		const resolved = key ? env[key] : '';
		return typeof resolved === 'string' && resolved ? resolved : match;
	});
}

function resolveCommand(candidates, options = {}) {
	const lookup = options.lookup || ((name) => spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], { encoding: 'utf8', shell: false }));
	for (const rawCandidate of candidates.filter(Boolean)) {
		const candidate = process.platform === 'win32' ? expandWindowsEnvironmentVariables(rawCandidate) : rawCandidate;
		if (/[\\/]/.test(candidate) && fs.existsSync(candidate)) return candidate;
		const result = lookup(candidate);
		if (result && result.status === 0) {
			const matches = String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
			const match = matches.find((line) => /\.(exe|cmd|bat)$/i.test(line)) || matches[0];
			if (/\.ps1$/i.test(match)) {
				return match;
			}
			if (/\.(cmd|bat)$/i.test(match)) {
				const script = match.replace(/\.(cmd|bat)$/i, '.ps1');
				if (fs.existsSync(script)) return script;
			}
			if (match) return match;
		}
	}
	return '';
}

function commandAndArgs(command, args) {
	if (process.platform === 'win32' && /\.ps1$/i.test(command)) {
		return { command: process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', command, ...args] };
	}
	return { command, args };
}

function run(command, args, options = {}) {
	const spawnImpl = options.spawnSync || spawnSync;
	const invocation = commandAndArgs(command, args);
	const maxBuffer = Math.max(1024, Math.min(MAX_CLI_MODEL_OUTPUT_CHARS, Number(options.maxBuffer || MAX_CLI_MODEL_OUTPUT_CHARS) || MAX_CLI_MODEL_OUTPUT_CHARS));
	return spawnImpl(invocation.command, invocation.args, { encoding: 'utf8', shell: false, windowsHide: true, timeout: Number(options.timeoutMs || TIMEOUT_MS), maxBuffer });
}

function runAsync(command, args, options = {}) {
	return new Promise((resolve) => {
		const maxOutputChars = Math.max(1024, Math.min(MAX_CLI_MODEL_OUTPUT_CHARS, Number(options.maxOutputChars || MAX_CLI_MODEL_OUTPUT_CHARS) || MAX_CLI_MODEL_OUTPUT_CHARS));
		const out = createBoundedCollector({ maxChars: maxOutputChars });
		const err = createBoundedCollector({ maxChars: maxOutputChars });
		let child; let timedOut = false; let oversized = false; let settled = false; let timer;
		const finish = (result) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			resolve({ ...result, stdout: out.value(), stderr: err.value() });
		};
		try { const invocation = commandAndArgs(command, args); child = (options.spawn || spawn)(invocation.command, invocation.args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { finish({ error, status: null }); return; }
		timer = setTimeout(() => { timedOut = true; killProcessTree(child); }, Number(options.timeoutMs || TIMEOUT_MS));
		const capture = (collector, chunk) => {
			collector.append(chunk);
			if (!oversized && collector.stats().total_chars > maxOutputChars) {
				oversized = true;
				killProcessTree(child);
			}
		};
		child.stdout.on('data', (chunk) => capture(out, chunk)); child.stderr.on('data', (chunk) => capture(err, chunk));
		child.once('error', (error) => finish({ error, status: null }));
		child.once('close', (status) => finish({ error: timedOut ? new Error('CLI probe timed out.') : (oversized ? new Error('CLI probe output exceeded the maximum size.') : null), status }));
	});
}

function detectCli(definition, options = {}) {
	const command = definition.command || resolveCommand(definition.candidates || [], options);
	const base = { id: definition.id, label: definition.label, kind: 'local-cli', command: command || '', installed: !!command, ready: false, authenticated: null, job_types: definition.jobTypes || [], features: definition.features || {} };
	if (!command) return { ...base, state: 'unavailable', diagnostic: 'CLI executable was not found.' };
	const version = run(command, definition.versionArgs || ['--version'], options);
	if (version.error || version.status !== 0) return { ...base, state: 'unavailable', diagnostic: safeDiagnostic(version.error && version.error.message || version.stderr || version.stdout) };
	const auth = definition.authArgs && !options.skipAuth ? run(command, definition.authArgs, options) : null;
	const authText = auth ? `${auth.stdout || ''}\n${auth.stderr || ''}` : '';
	const unauthenticated = isCliAuthFailure(auth, authText);
	const fallbackModels = definition.models || ['auto'];
	const authModels = auth && !unauthenticated && !isCliAuthProbeUnreliable(auth, authText) ? modelsFromProbe(authText, fallbackModels) : fallbackModels;
	const models = authModels.length > 1 ? authModels : (!unauthenticated && !isCliAuthProbeUnreliable(auth, authText) ? probeModelListSync(command, definition, options, fallbackModels) : fallbackModels);
	const default_model = unauthenticated ? '' : defaultModelFrom(models, authText);
	return cliDetectAuthFields({ ...base, command }, version, auth, authText, models, default_model);
}

async function detectCliAsync(definition, options = {}) {
	const command = definition.command || resolveCommand(definition.candidates || [], options);
	const base = { id: definition.id, label: definition.label, kind: 'local-cli', command: command || '', installed: !!command, ready: false, authenticated: null, job_types: definition.jobTypes || [], features: definition.features || {} };
	if (!command) return { ...base, state: 'unavailable', diagnostic: 'CLI executable was not found.' };
	const version = await runAsync(command, definition.versionArgs || ['--version'], options);
	if (version.error || version.status !== 0) return { ...base, state: 'unavailable', diagnostic: safeDiagnostic(version.error && version.error.message || version.stderr || version.stdout) };
	const auth = definition.authArgs ? await runAsync(command, definition.authArgs, options) : null;
	const authText = auth ? `${auth.stdout || ''}\n${auth.stderr || ''}` : '';
	const unauthenticated = isCliAuthFailure(auth, authText);
	const fallbackModels = definition.models || ['auto'];
	const authModels = auth && !unauthenticated && !isCliAuthProbeUnreliable(auth, authText) ? modelsFromProbe(authText, fallbackModels) : fallbackModels;
	const models = authModels.length > 1 ? authModels : (!unauthenticated && !isCliAuthProbeUnreliable(auth, authText) ? await probeModelListAsync(command, definition, options, fallbackModels) : fallbackModels);
	const default_model = unauthenticated ? '' : defaultModelFrom(models, authText);
	return cliDetectAuthFields({ ...base, command }, version, auth, authText, models, default_model);
}

function runTextCommand(command, args, input, session = {}, options = {}) {
	return new Promise((resolve) => {
		const out = createBoundedCollector({ maxChars: 1024 * 1024 });
		const err = createBoundedCollector({ maxChars: 1024 * 1024 });
		let child; let settled = false;
		try { const invocation = commandAndArgs(command, args); child = (options.spawn || spawn)(invocation.command, invocation.args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], ...(options.cwd ? { cwd: options.cwd } : {}) }); } catch (error) { resolve({ success: false, category: 'configuration', code: 'cli_spawn_failed', message: safeDiagnostic(error.message) }); return; }
		const timeoutMs = Number(options.timeoutMs || 600000);
		const timeoutSeconds = Math.ceil(timeoutMs / 1000);
		const timer = setTimeout(() => { if (!settled) { settled = true; killProcessTree(child); resolve({ success: false, category: 'timeout', code: 'cli_timeout', message: `CLI request timed out after ${timeoutSeconds} second${timeoutSeconds === 1 ? '' : 's'}.`, details: { timeout_ms: timeoutMs, stdout: out.value(), stderr: err.value() } }); } }, timeoutMs);
		child.stdout.on('data', (chunk) => { out.append(chunk); session.appendSessionOutput && session.appendSessionOutput('stdout', String(chunk)); });
		child.stderr.on('data', (chunk) => { err.append(chunk); session.appendSessionOutput && session.appendSessionOutput('stderr', String(chunk)); });
		child.on('error', (error) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ success: false, category: 'configuration', code: 'cli_spawn_failed', message: safeDiagnostic(error.message) }); } });
		child.on('close', (status) => { if (settled) return; settled = true; clearTimeout(timer); if (status !== 0) { resolve({ success: false, category: 'cli_process', code: 'cli_request_failed', message: safeDiagnostic(err.value() || out.value()), details: { status } }); return; } resolve({ success: true, text: out.value().trim(), stderr: err.value().trim() }); });
		if (child.stdin) {
			if (typeof child.stdin.once === 'function') child.stdin.once('error', () => {});
			child.stdin.end(String(input || ''));
		}
	});
}

function writePromptFile(dir, text) {
	const promptPath = path.join(dir, 'prompt.txt');
	fs.writeFileSync(promptPath, String(text == null ? '' : text), 'utf8');
	return promptPath;
}

function imageValueFromPart(part) {
	if (!part || typeof part !== 'object') return '';
	if (typeof part.image_url === 'string') return part.image_url;
	if (part.image_url && typeof part.image_url === 'object' && typeof part.image_url.url === 'string') return part.image_url.url;
	if (typeof part.url === 'string') return part.url;
	for (const key of ['path', 'file_path', 'image_path']) if (typeof part[key] === 'string') return part[key];
	return '';
}

function isImagePart(part) {
	return !!part && typeof part === 'object' && ['input_image', 'image_url', 'image'].includes(String(part.type || '').toLowerCase());
}

function imageMimeAndBytes(value) {
	const match = String(value || '').match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
	if (!match) return null;
	if (match[2].length > MAX_CHAT_IMAGE_BASE64_CHARS) return null;
	const encoded = match[2].replace(/\s+/g, '');
	if (!encoded || encoded.length > MAX_CHAT_IMAGE_BASE64_CHARS || encoded.length % 4 === 1) return null;
	const bytes = Buffer.from(encoded, 'base64');
	if (!bytes.length || bytes.length > MAX_CHAT_IMAGE_BYTES) return null;
	const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
	return { mime_type: mimeType, bytes };
}

function extensionForImageMime(mimeType) {
	return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp' }[String(mimeType || '').toLowerCase()] || '';
}

function chatImageParts(payload = {}) {
	const parts = [];
	for (const message of Array.isArray(payload.messages) ? payload.messages : []) {
		if (!Array.isArray(message && message.content)) continue;
		for (const part of message.content) if (isImagePart(part)) parts.push(part);
	}
	return parts;
}

function materializeChatImages(payload = {}, workspace) {
	const references = [];
	for (const [index, part] of chatImageParts(payload).entries()) {
		const imageValue = imageValueFromPart(part);
		const dataImage = imageMimeAndBytes(imageValue);
		let image = dataImage;
		if (!image && imageValue && !/^https?:\/\//i.test(imageValue) && !/^data:/i.test(imageValue)) {
			try {
				const stat = fs.statSync(imageValue);
				const extension = path.extname(imageValue).toLowerCase();
				const extensionMimeType = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extension] || '';
				const declaredMimeType = String(part.mime_type || part.mimeType || '').toLowerCase().replace('image/jpg', 'image/jpeg');
				if (stat.isFile() && extensionMimeType && stat.size > 0 && stat.size <= MAX_CHAT_IMAGE_BYTES && (!declaredMimeType || declaredMimeType === extensionMimeType)) {
					const bytes = fs.readFileSync(imageValue);
					image = { mime_type: extensionMimeType, bytes };
				}
			} catch (error) {}
		}
		if (!image) {
			if (/^https?:\/\//i.test(imageValue)) return { error: 'CLI chat image URLs are not downloaded; provide a PNG, JPEG, or WebP data URL or an existing local image path.' };
			if (/^data:/i.test(imageValue)) return { error: 'CLI chat images must be non-empty PNG, JPEG, or WebP data URLs smaller than 20 MB.' };
			return { error: 'A CLI chat image must be an existing PNG, JPEG, or WebP file.' };
		}
		const extension = extensionForImageMime(image.mime_type);
		if (!extension) return { error: 'CLI chat images must be PNG, JPEG, or WebP files.' };
		const imagePath = path.join(workspace, `chat-image-${index + 1}.${extension}`);
		fs.writeFileSync(imagePath, image.bytes);
		references.push({ path: imagePath, mime_type: image.mime_type, bytes: image.bytes.length });
	}
	return { references };
}

function messagesToText(payload = {}, options = {}) {
	if (!Array.isArray(payload.messages) || !payload.messages.length) return payload.input || payload.prompt || '';
	const imageReferences = Array.isArray(options.imageReferences) ? options.imageReferences : [];
	let imageIndex = 0;
	return (payload.messages || []).map((message) => `${message.role || 'user'}: ${Array.isArray(message.content) ? message.content.map((part) => {
		if (isImagePart(part)) {
			const reference = imageReferences[imageIndex++];
			return reference && reference.path ? `Image attachment ${imageIndex}: @${reference.path}` : '[Image attachment omitted]';
		}
		return typeof part === 'string' ? part : part && (part.text || part.content) || '';
	}).join('\n') : message.content || ''}`).join('\n\n');
}

function messagesToPromptJson(payload = {}, imageReferences = []) {
	const blocks = [];
	let imageIndex = 0;
	for (const message of Array.isArray(payload.messages) ? payload.messages : []) {
		const role = message && message.role ? String(message.role) : 'user';
		if (!Array.isArray(message && message.content)) {
			blocks.push({ type: 'text', text: `${role}: ${String(message && message.content || '')}` });
			continue;
		}
		blocks.push({ type: 'text', text: `${role}:` });
		for (const part of message.content) {
			if (isImagePart(part)) {
				const reference = imageReferences[imageIndex++];
				if (reference && reference.path) blocks.push({ type: 'image', path: reference.path, mimeType: reference.mime_type });
				continue;
			}
			const text = typeof part === 'string' ? part : part && (part.text || part.content) || '';
			if (text) blocks.push({ type: 'text', text: String(text) });
		}
	}
	if (!blocks.length) blocks.push({ type: 'text', text: String(payload.input || payload.prompt || '') });
	return blocks;
}

module.exports = { detectCli, detectCliAsync, expandWindowsEnvironmentVariables, materializeChatImages, messagesToPromptJson, messagesToText, parseCliDefaultModel, parseCliModelList, retainCliReadiness, resolveCommand, runTextCommand, safeDiagnostic, writePromptFile };
