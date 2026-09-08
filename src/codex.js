'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const asr = require('./asr');
const { appendLog, createBoundedCollector, safeError } = require('./diagnostics');
const { killProcessTree } = require('./cuda-torch-venv');
const { beginLocalModelDebugLog } = require('./temp-debug-logs');
const { resolveMaxTokens } = require('./token-policy');

const defaultCodexBinary = process.env.ALORBACH_CODEX_BINARY || 'codex';
let configuredCodexBinary = '';
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const authPath = path.join(codexHome, 'auth.json');
const generatedImagesDir = path.join(codexHome, 'generated_images');
const MAX_CODEX_IMAGE_BYTES = 20 * 1024 * 1024;
let execHelpSnapshot = null;

function collectCodexExe(root, matches, depth = 0) {
	if (!root || depth > 6 || !fs.existsSync(root)) {
		return;
	}
	let entries = [];
	try {
		entries = fs.readdirSync(root, { withFileTypes: true });
	} catch (error) {
		return;
	}
	for (const entry of entries) {
		const fullPath = path.join(root, entry.name);
		if (entry.isFile() && entry.name.toLowerCase() === 'codex.exe') {
			matches.push(fullPath);
			continue;
		}
		if (!entry.isDirectory()) {
			continue;
		}
		const name = entry.name.toLowerCase();
		if (depth === 0 && name.indexOf('openai.chatgpt-') !== 0 && root.toLowerCase().indexOf('programs') === -1) {
			continue;
		}
		collectCodexExe(fullPath, matches, depth + 1);
	}
}

function findWindowsCodexExtensionBinary() {
	const home = os.homedir();
	const roots = [
		path.join(home, '.vscode', 'extensions'),
		path.join(home, '.cursor', 'extensions'),
		path.join(process.env.LOCALAPPDATA || '', 'Programs'),
	].filter(Boolean);
	const matches = [];
	for (const root of roots) {
		collectCodexExe(root, matches);
	}
	matches.sort((a, b) => b.localeCompare(a));
	return matches[0] || '';
}

function setCodexBinary(value) {
	const nextBinary = typeof value === 'string' ? value.trim() : '';
	if (nextBinary !== configuredCodexBinary) {
		execHelpSnapshot = null;
	}
	configuredCodexBinary = nextBinary;
}

function resolveCodexBinary() {
	const codexBinary = configuredCodexBinary || defaultCodexBinary;
	if (process.platform !== 'win32' || /[\\/]/.test(codexBinary)) {
		return codexBinary;
	}
	const extensionBinary = findWindowsCodexExtensionBinary();
	if (extensionBinary) {
		return extensionBinary;
	}
	const lookup = spawnSync('where.exe', [codexBinary], { encoding: 'utf8', shell: false });
	if (lookup.status === 0) {
		const matches = (lookup.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
		return matches.find((line) => /\.exe$/i.test(line)) || matches.find((line) => /\.(cmd|bat)$/i.test(line)) || matches[0] || codexBinary;
	}
	return codexBinary;
}

function runCodex(args, options = {}) {
	return spawnSync(resolveCodexBinary(), args, {
		encoding: 'utf8',
		shell: false,
		timeout: Number(process.env.ALORBACH_CODEX_STATUS_TIMEOUT_MS || 15000),
		env: {
			...process.env,
			CODEX_HOME: codexHome,
		},
		...options,
	});
}

function parseExecHelpCapabilities(help) {
	const helpText = `${help && help.stdout || ''}\n${help && help.stderr || ''}`;
	return {
		help_available: !!(help && !help.error && help.status === 0),
		json: /(?:^|\s)--json(?:\s|,|$)/im.test(helpText),
		output_schema: /(?:^|\s)--output-schema(?:\s|<|$)/im.test(helpText),
		sandbox: /(?:^|\s)--sandbox(?:\s|<|$)/im.test(helpText),
		image_attachments: /(?:^|\s)--image(?:\s|<|$)/im.test(helpText),
	};
}

function rememberExecHelp(help) {
	if (!execHelpSnapshot) {
		execHelpSnapshot = parseExecHelpCapabilities(help);
	}
	return execHelpSnapshot;
}

function execCapabilities() {
	if (!execHelpSnapshot) {
		execHelpSnapshot = parseExecHelpCapabilities(runCodex(['exec', '--help']));
	}
	return { ...execHelpSnapshot };
}

function runCodexAsync(args, options = {}) {
	const { timeout, onOutput, input, ...spawnOptions } = options;
	const emitOutput = typeof onOutput === 'function' ? onOutput : () => {};
	const stdinInput = typeof input === 'string' || Buffer.isBuffer(input) ? input : null;
	return new Promise((resolve) => {
		let child;
		const stdoutCollector = createBoundedCollector({
			maxChars: Number(process.env.ALORBACH_CODEX_OUTPUT_MAX_CHARS || 1024 * 1024),
		});
		const stderrCollector = createBoundedCollector({
			maxChars: Number(process.env.ALORBACH_CODEX_OUTPUT_MAX_CHARS || 1024 * 1024),
		});
		let spawnError = null;
		let timedOut = false;
		try {
			child = spawn(resolveCodexBinary(), args, {
				shell: false,
				windowsHide: true,
				stdio: [stdinInput === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
				env: {
					...process.env,
					CODEX_HOME: codexHome,
				},
				...spawnOptions,
			});
		} catch (error) {
			appendLog('server', 'Codex CLI spawn failed.', { error: safeError(error), args });
			resolve({ stdout: '', stderr: '', status: null, signal: null, error });
			return;
		}
		if (stdinInput !== null && child.stdin) {
			if (typeof child.stdin.once === 'function') {
				child.stdin.once('error', (error) => {
					spawnError = spawnError || error;
				});
			}
			child.stdin.end(stdinInput);
		}

		const timer = timeout ? setTimeout(() => {
			timedOut = true;
			killProcessTree(child);
		}, timeout) : null;

		if (timer && typeof timer.unref === 'function') {
			timer.unref();
		}
		child.stdout.on('data', (chunk) => {
			const text = String(chunk || '');
			stdoutCollector.append(text);
			emitOutput('stdout', text);
		});
		child.stderr.on('data', (chunk) => {
			const text = String(chunk || '');
			stderrCollector.append(text);
			emitOutput('stderr', text);
		});
		child.once('error', (error) => {
			spawnError = error;
		});
		child.once('close', (status, signal) => {
			if (timer) {
				clearTimeout(timer);
			}
			const stdout = stdoutCollector.value();
			const stderr = stderrCollector.value();
			const stdoutStats = stdoutCollector.stats();
			const stderrStats = stderrCollector.stats();
			if (stdoutStats.truncated_chars || stderrStats.truncated_chars) {
				appendLog('server', 'Codex CLI output was truncated.', {
					stdout: stdoutStats,
					stderr: stderrStats,
					status,
					signal,
				});
			}
			const result = {
				stdout,
				stderr,
				status,
				signal,
				error: spawnError || (timedOut ? new Error('Codex CLI execution timed out.') : null),
			};
			if (args.length === 2 && args[0] === 'exec' && args[1] === '--help') {
				rememberExecHelp(result);
			}
			resolve(result);
		});
	});
}

function checkStatus() {
	const version = runCodex(['--version']);
	if (version.error) {
		return {
			success: false,
			message: 'Codex CLI is not installed or not on PATH.',
			details: { codex_binary: resolveCodexBinary(), error: version.error.message || String(version.error) },
		};
	}
	if (version.status !== 0) {
		return {
			success: false,
			message: 'Codex CLI was found, but `codex --version` failed.',
			details: { codex_binary: resolveCodexBinary(), stderr: (version.stderr || '').trim() },
		};
	}
	const login = runCodex(['login', 'status']);
	const loginText = `${login.stdout || ''}\n${login.stderr || ''}`;
	const loggedIn = !login.error && login.status === 0 && /logged in/i.test(loginText) && fs.existsSync(authPath);
	return {
		success: loggedIn,
		message: loggedIn ? 'Local Codex CLI is installed and logged in.' : 'Codex CLI is installed, but this user is not logged in.',
		details: {
			codex_binary: resolveCodexBinary(),
			codex_home: codexHome,
			auth_path: authPath,
			generated_images_dir: generatedImagesDir,
			version: (version.stdout || version.stderr || '').trim(),
			login_status: (login.stdout || login.stderr || '').trim(),
		},
	};
}

async function checkStatusAsync() {
	const [version, login] = await Promise.all([runCodexAsync(['--version'], { timeout: Number(process.env.ALORBACH_CODEX_STATUS_TIMEOUT_MS || 15000) }), runCodexAsync(['login', 'status'], { timeout: Number(process.env.ALORBACH_CODEX_STATUS_TIMEOUT_MS || 15000) })]);
	if (version.error || version.status !== 0) return { success: false, message: 'Codex CLI is not installed or not on PATH.', details: { codex_binary: resolveCodexBinary(), error: version.error && version.error.message || (version.stderr || '').trim() } };
	const loginText = `${login.stdout || ''}\n${login.stderr || ''}`;
	const loggedIn = !login.error && login.status === 0 && /logged in/i.test(loginText) && fs.existsSync(authPath);
	return { success: loggedIn, message: loggedIn ? 'Local Codex CLI is installed and logged in.' : 'Codex CLI is installed, but this user is not logged in.', details: { codex_binary: resolveCodexBinary(), codex_home: codexHome, auth_path: authPath, generated_images_dir: generatedImagesDir, version: (version.stdout || version.stderr || '').trim(), login_status: (login.stdout || login.stderr || '').trim() } };
}

function normalizeTokenCount(rawValue) {
	const digits = String(rawValue || '').replace(/[^\d]/g, '');
	return digits ? Number.parseInt(digits, 10) || 0 : 0;
}

function parseUsage(stdout, stderr, structured) {
	if (structured && structured.usage) {
		return structured.usage;
	}
	const combined = `${stdout || ''}\n${stderr || ''}`;
	const patterns = [
		/tokens used\s*[:\-]?\s*([\d,]+)/i,
		/tokens used[\s\S]{0,80}?([\d,]+)/i,
	];
	for (const pattern of patterns) {
		const match = combined.match(pattern);
		if (match && match[1]) {
			const total = normalizeTokenCount(match[1]);
			if (total > 0) {
				return { total_tokens: total };
			}
		}
	}
	return { total_tokens: 0, local_unmetered: true };
}

function textFromUnknown(value) {
	if (typeof value === 'string') {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(textFromUnknown).filter(Boolean).join('\n');
	}
	if (!value || typeof value !== 'object') {
		return '';
	}
	for (const key of ['text', 'content', 'message', 'output', 'result']) {
		const text = textFromUnknown(value[key]);
		if (text) {
			return text;
		}
	}
	return '';
}

function eventUsage(event) {
	if (!event || typeof event !== 'object') {
		return null;
	}
	const usage = event.usage || (event.turn && event.turn.usage) || (event.payload && event.payload.usage);
	if (!usage || typeof usage !== 'object') {
		return null;
	}
	const total = normalizeTokenCount(usage.total_tokens || usage.total || usage.tokens_used);
	if (total > 0) {
		return { total_tokens: total };
	}
	return null;
}

function codexEventError(event) {
	if (!event || typeof event !== 'object') {
		return '';
	}
	const error = event.error || (event.payload && event.payload.error);
	if (typeof error === 'string') {
		return error;
	}
	if (error && typeof error === 'object') {
		return String(error.message || error.code || JSON.stringify(error));
	}
	if (/failed|error/i.test(String(event.type || event.event || ''))) {
		return textFromUnknown(event) || String(event.type || event.event || 'Codex event failed.');
	}
	return '';
}

function summarizeCodexEvent(event) {
	const type = String((event && (event.type || event.event)) || '').trim();
	if (!type) {
		return '';
	}
	const item = event.item || (event.payload && event.payload.item) || {};
	const itemType = String(item.type || item.kind || '').trim();
	const error = codexEventError(event);
	if (error) {
		return `${type}: ${error}`;
	}
	if (/message|agent/i.test(itemType)) {
		const text = textFromUnknown(item);
		return text ? `${type}/${itemType}: ${text.slice(0, 500)}` : `${type}/${itemType}`;
	}
	if (/command|exec|shell/i.test(itemType)) {
		const command = textFromUnknown(item.command || item.args || item);
		return command ? `${type}/${itemType}: ${command.slice(0, 500)}` : `${type}/${itemType}`;
	}
	if (/thread|turn/.test(type)) {
		return type;
	}
	return '';
}

function parseCodexJsonEvents(stdout) {
	const events = [];
	const errors = [];
	const finalMessages = [];
	const invalidLines = [];
	let usage = null;
	for (const line of String(stdout || '').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		let event;
		try {
			event = JSON.parse(trimmed);
		} catch (error) {
			invalidLines.push(trimmed.slice(0, 1000));
			continue;
		}
		events.push(event);
		const errorText = codexEventError(event);
		if (errorText) {
			errors.push(errorText);
		}
		const eventType = String(event.type || event.event || '');
		const item = event.item || (event.payload && event.payload.item) || {};
		const itemType = String(item.type || item.kind || '');
		if (/completed|message|item/.test(eventType) && /message|agent/i.test(itemType)) {
			const text = textFromUnknown(item);
			if (text) {
				finalMessages.push(text);
			}
		}
		const nextUsage = eventUsage(event);
		if (nextUsage) {
			usage = nextUsage;
		}
	}
	return {
		events,
		errors,
		finalMessages,
		invalidLines,
		summary: events.map(summarizeCodexEvent).filter(Boolean).slice(-40),
		usage,
	};
}

function codexJsonUnsupported(run) {
	const combined = `${run && run.stdout || ''}\n${run && run.stderr || ''}`;
	return !!(run && run.status !== 0 && /(?:unknown|unexpected|unrecognized).{0,80}(?:--json|json)|(?:--json|json).{0,80}(?:unknown|unexpected|unrecognized)/i.test(combined));
}

function codexOutputSchemaUnsupported(run) {
	const combined = `${run && run.stdout || ''}\n${run && run.stderr || ''}`;
	return !!(run && run.status !== 0 && /(?:unknown|unexpected|unrecognized).{0,80}(?:--output-schema|output schema)|(?:--output-schema|output schema).{0,80}(?:unknown|unexpected|unrecognized)/i.test(combined));
}

function removeCodexArgPair(args, flag) {
	const result = [];
	for (let index = 0; index < args.length; index += 1) {
		if (args[index] === flag) {
			index += 1;
			continue;
		}
		result.push(args[index]);
	}
	return result;
}

function createJsonOutputCollector(onOutput) {
	let pending = '';
	const parsedLines = [];
	const emit = typeof onOutput === 'function' ? onOutput : () => {};
	function consume(line) {
		const trimmed = line.trim();
		if (!trimmed) {
			return;
		}
		parsedLines.push(trimmed);
		try {
			const event = JSON.parse(trimmed);
			const summary = summarizeCodexEvent(event);
			if (summary) {
				emit('event', summary);
			}
		} catch (error) {}
	}
	return {
		append(chunk) {
			pending += String(chunk || '');
			const lines = pending.split(/\r?\n/);
			pending = lines.pop() || '';
			for (const line of lines) {
				consume(line);
			}
		},
		flush() {
			if (pending) {
				consume(pending);
				pending = '';
			}
		},
		raw() {
			return parsedLines.join('\n');
		},
	};
}

async function runCodexExec(args, options = {}) {
	const jsonArgs = args[0] === 'exec' ? ['exec', '--json', ...args.slice(1)] : ['--json', ...args];
	const onOutput = typeof options.onOutput === 'function' ? options.onOutput : () => {};
	const collector = createJsonOutputCollector(onOutput);
	const run = await runCodexAsync(jsonArgs, {
		...options,
		onOutput: (stream, chunk) => {
			if (stream === 'stdout') {
				collector.append(chunk);
				return;
			}
			onOutput(stream, chunk);
		},
	});
	collector.flush();
	run.structured = parseCodexJsonEvents(run.stdout || collector.raw());
	run.used_json = true;
	if (!codexJsonUnsupported(run)) {
		return run;
	}
	const fallback = await runCodexAsync(args, options);
	fallback.structured = parseCodexJsonEvents('');
	fallback.used_json = false;
	fallback.json_fallback_reason = 'Codex CLI does not support `codex exec --json`.';
	return fallback;
}

function codexImageFailureFromOutput(stdout, stderr, generatedImagesPath = generatedImagesDir, structured = null) {
	const cleanStdout = String(stdout || '').trim();
	const cleanStderr = String(stderr || '').trim();
	const combined = `${cleanStdout}\n${cleanStderr}`;
	const details = { generated_images_dir: generatedImagesPath, stdout: cleanStdout, stderr: cleanStderr };
	if (structured && structured.summary && structured.summary.length) {
		details.structured_events = structured.summary;
	}
	if (structured && structured.errors && structured.errors.length) {
		details.event_errors = structured.errors;
	}
	if (/rate limit|rate-limit|rate limiting|too many requests/i.test(combined)) {
		return {
			success: false,
			code: 'codex_rate_limited',
			category: 'rate_limit',
			retryable: true,
			message: 'Codex image generation was rate limited. Please wait and retry.',
			details,
		};
	}
	return {
		success: false,
		code: 'codex_no_image_output',
		category: 'output_detection',
		retryable: false,
		message: 'Codex CLI completed, but no new generated image file was detected.',
		details,
	};
}

function imageExtensionForMime(mime) {
	const normalized = String(mime || '').toLowerCase();
	if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
		return 'jpg';
	}
	if (normalized === 'image/png') {
		return 'png';
	}
	if (normalized === 'image/webp') {
		return 'webp';
	}
	if (normalized === 'image/gif') {
		return 'gif';
	}
	return 'bin';
}

function tryWriteDataImage(value, tempDir, index) {
	if (!tempDir) {
		return null;
	}
	const text = String(value || '').trim();
	const match = text.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
	if (!match) {
		return null;
	}
	const mime = match[1].toLowerCase();
	const extension = imageExtensionForMime(mime);
	if (extension === 'bin') {
		return null;
	}
	const base64 = match[2].replace(/\s+/g, '');
	const bytes = Buffer.from(base64, 'base64');
	if (!bytes.length) {
		return null;
	}
	const imagePath = path.join(tempDir, `input-image-${index}.${extension}`);
	fs.writeFileSync(imagePath, bytes);
	return {
		bytes: bytes.length,
		mime,
		path: imagePath,
	};
}

function mimeFromImagePath(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === '.jpg' || ext === '.jpeg') {
		return 'image/jpeg';
	}
	if (ext === '.png') {
		return 'image/png';
	}
	if (ext === '.webp') {
		return 'image/webp';
	}
	if (ext === '.gif') {
		return 'image/gif';
	}
	return '';
}

function tryCopyImagePath(filePath, tempDir, index) {
	if (!tempDir) {
		return null;
	}
	const resolved = path.resolve(String(filePath || '').trim());
	const root = path.resolve(tempDir);
	if (!resolved || (resolved !== root && !resolved.startsWith(`${root}${path.sep}`))) {
		return null;
	}
	const mime = mimeFromImagePath(resolved);
	if (!mime) {
		return null;
	}
	const extension = imageExtensionForMime(mime);
	if (extension === 'bin') {
		return null;
	}
	let bytes;
	try {
		bytes = fs.readFileSync(resolved);
	} catch (error) {
		return null;
	}
	if (!bytes.length) {
		return null;
	}
	const imagePath = path.join(tempDir, `input-image-${index}.${extension}`);
	fs.writeFileSync(imagePath, bytes);
	return {
		bytes: bytes.length,
		mime,
		path: imagePath,
		source_path: resolved,
	};
}

function attachmentFromReferenceImage(entry, tempDir, index) {
	const b64 = String(entry && entry.b64_json || '').trim();
	if (!b64) {
		return null;
	}
	const mime = String(entry.mime_type || 'image/jpeg').toLowerCase();
	const dataUrl = `data:${mime};base64,${b64}`;
	const attachment = tryWriteDataImage(dataUrl, tempDir, index);
	if (!attachment) {
		return null;
	}
	if (entry.label) {
		attachment.label = String(entry.label);
	}
	return attachment;
}

function collectImageAttachments(payload, tempDir) {
	const attachments = [];
	const seen = new Set();

	function push(attachment) {
		if (!attachment || !attachment.path || seen.has(attachment.path.toLowerCase())) {
			return;
		}
		seen.add(attachment.path.toLowerCase());
		attachments.push(attachment);
	}

	for (const entry of Array.isArray(payload.reference_images) ? payload.reference_images : []) {
		push(attachmentFromReferenceImage(entry, tempDir, attachments.length + 1));
	}
	for (const filePath of Array.isArray(payload.referenced_image_paths) ? payload.referenced_image_paths : []) {
		push(tryCopyImagePath(filePath, tempDir, attachments.length + 1));
	}
	for (const frame of Array.isArray(payload.frames) ? payload.frames : []) {
		push(tryWriteDataImage(frame, tempDir, attachments.length + 1));
	}

	return attachments;
}

function safeStringifyForPrompt(value) {
	return JSON.stringify(value, (key, item) => {
		if (typeof item === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(item)) {
			return `[data image omitted from text prompt, ${item.length} chars]`;
		}
		return item;
	});
}

function imageValueFromPart(part) {
	if (!part || typeof part !== 'object') {
		return '';
	}
	if (typeof part.image_url === 'string') {
		return part.image_url;
	}
	if (part.image_url && typeof part.image_url === 'object' && typeof part.image_url.url === 'string') {
		return part.image_url.url;
	}
	if (typeof part.url === 'string') {
		return part.url;
	}
	return '';
}

function contentPartsToPrompt(content, tempDir, attachments) {
	if (typeof content === 'string') {
		return content;
	}
	if (!Array.isArray(content)) {
		return safeStringifyForPrompt(content || '');
	}
	const lines = [];
	for (const part of content) {
		if (typeof part === 'string') {
			lines.push(part);
			continue;
		}
		if (!part || typeof part !== 'object') {
			continue;
		}
		const type = String(part.type || '').toLowerCase();
		if (type === 'input_text' || type === 'text') {
			lines.push(String(part.text || part.content || ''));
			continue;
		}
		if (type === 'input_image' || type === 'image_url') {
			const imageValue = imageValueFromPart(part);
			const attachment = tryWriteDataImage(imageValue, tempDir, attachments.length + 1);
			if (attachment) {
				attachments.push(attachment);
				lines.push(`[Attached image ${attachments.length}: ${attachment.mime}, ${attachment.bytes} bytes, passed to Codex as an image attachment.]`);
			} else if (imageValue && /^data:image\/[a-z0-9.+-]+;base64,/i.test(imageValue)) {
				lines.push('[Image attachment could not be decoded and was omitted from the text prompt.]');
			} else if (imageValue) {
				lines.push(`[Image URL attachment: ${imageValue.slice(0, 512)}]`);
			} else {
				lines.push('[Image attachment without readable image data.]');
			}
			continue;
		}
		lines.push(safeStringifyForPrompt(part));
	}
	return lines.filter(Boolean).join('\n');
}

function buildChatPrompt(messages, maxTokens, tempDir) {
	const attachments = [];
	const resolvedMaxTokens = resolveMaxTokens('chat', maxTokens);
	const parts = [
		'Respond to the following WordPress Gateway chat transcript.',
		'Do not access local files, run shell commands, or modify the filesystem.',
		`Maximum response tokens hint: ${resolvedMaxTokens}.`,
		'',
	];
	for (const message of Array.isArray(messages) ? messages : []) {
		const role = String(message.role || 'user');
		const content = contentPartsToPrompt(message.content, tempDir, attachments);
		parts.push(`${role.toUpperCase()}: ${content}`);
	}
	parts.push('', 'ASSISTANT:');
	return {
		attachments,
		prompt: parts.join('\n'),
	};
}

function messagesToPrompt(messages, maxTokens) {
	return buildChatPrompt(messages, maxTokens, '').prompt;
}

function nativeCodexChatModel(value) {
	let model = String(value == null ? '' : value).trim();
	if (/^model-relay:codex:/i.test(model)) model = model.replace(/^model-relay:codex:/i, '');
	if (/^codex-local:/i.test(model)) model = model.replace(/^codex-local:/i, '');
	model = model.trim();
	if (!model || model === 'image' || /^model-relay:/i.test(model)) return 'auto';
	return model;
}

function codexRunDiagnosticText(run) {
	const structured = run && run.structured && typeof run.structured === 'object' ? run.structured : {};
	const errors = Array.isArray(structured.errors) ? structured.errors.join('\n') : '';
	return `${run && run.stdout || ''}\n${run && run.stderr || ''}\n${errors}`;
}

function codexChatModelUnsupported(run) {
	if (!run || run.status === 0) return false;
	const text = codexRunDiagnosticText(run);
	return /model is not supported when using Codex with a ChatGPT account/i.test(text)
		|| /Model metadata for [`']?[^`'\n]+[`']? not found/i.test(text)
		|| /invalid_request_error[\s\S]{0,240}model is not supported/i.test(text);
}

function buildChatArgs(tempDir, outputFile, model, attachments, options = {}) {
	const args = [
		'exec',
		'--skip-git-repo-check',
		'--ephemeral',
	];
	if (options.sandboxReadOnly) {
		args.push('--sandbox', 'read-only');
	}
	args.push(
		'--cd',
		tempDir,
		'--output-last-message',
		outputFile,
	);
	if (options.outputSchemaPath) {
		args.push('--output-schema', options.outputSchemaPath);
	}
	if (model !== 'auto') {
		args.push('--model', model);
	}
	for (const attachment of Array.isArray(attachments) ? attachments : []) {
		args.push('--image', attachment.path);
	}
	args.push('-');
	return args;
}

async function chat(payload, session = {}, internalOptions = {}) {
	const status = await checkStatusAsync();
	if (!status.success) {
		return status;
	}
	const messages = Array.isArray(payload.messages) ? payload.messages : [];
	if (!messages.length) {
		return { success: false, message: 'No chat messages were provided.' };
	}
	let model = nativeCodexChatModel(payload.model);
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alorbach-codex-chat-'));
	try {
	const outputFile = path.join(tempDir, 'last-message.txt');
	const { attachments, prompt } = buildChatPrompt(messages, payload.max_tokens, tempDir);
	const resolvedMaxTokens = resolveMaxTokens('chat', payload.max_tokens);
	const debugLog = beginLocalModelDebugLog({
		kind: 'chat',
		model: `codex-local:${model}`,
		provider: 'codex-cli',
		requestId: session.requestId,
		route: '/v1/chat',
	});
	if (debugLog) {
		debugLog.writePrompt(prompt);
		debugLog.writeJson('request', {
			model: `codex-local:${model}`,
			requested_model: payload.model || '',
			max_tokens: resolvedMaxTokens,
			attachment_count: attachments.length,
			temp_dir: tempDir,
			output_file: outputFile,
		});
	}
	const execFeatures = execCapabilities();
	const outputSchemaPath = typeof internalOptions.outputSchemaPath === 'string' ? internalOptions.outputSchemaPath.trim() : '';
	let schemaPath = execFeatures.output_schema ? outputSchemaPath : '';
	const makeArgs = (nativeModel) => buildChatArgs(tempDir, outputFile, nativeModel, attachments, {
		sandboxReadOnly: execFeatures.sandbox,
		outputSchemaPath: schemaPath,
	});
	if (typeof session.appendSessionInput === 'function') session.appendSessionInput('stdin', prompt);
	const runOptions = { cwd: tempDir, timeout: Number(process.env.ALORBACH_CODEX_CHAT_TIMEOUT_MS || 600000), onOutput: session.appendSessionOutput, input: prompt };
	let run = await runCodexExec(makeArgs(model), runOptions);
	if (schemaPath && codexOutputSchemaUnsupported(run)) {
		schemaPath = '';
		run = await runCodexExec(makeArgs(model), runOptions);
		run.output_schema_fallback_reason = 'Codex CLI rejected `--output-schema`; retried with free-text output.';
	}
	if (model !== 'auto' && !run.error && run.status !== 0 && codexChatModelUnsupported(run)) {
		model = 'auto';
		const retried = await runCodexExec(makeArgs(model), runOptions);
		retried.output_schema_fallback_reason = run.output_schema_fallback_reason;
		retried.chatgpt_model_fallback_reason = 'Codex ChatGPT account rejected the requested model; retried with the account default.';
		run = retried;
	}
	const stdout = (run.stdout || '').trim();
	const stderr = (run.stderr || '').trim();
	let responseText = '';
	if (fs.existsSync(outputFile)) {
		responseText = fs.readFileSync(outputFile, 'utf8').trim();
	}
	if (!responseText && run.structured && run.structured.finalMessages.length) {
		responseText = run.structured.finalMessages[run.structured.finalMessages.length - 1].trim();
	}
	if (debugLog) {
		debugLog.writeOutput(responseText || stdout);
		debugLog.writeStdout(run.stdout || '');
		debugLog.writeStderr(run.stderr || '');
		debugLog.writeJson('structured', run.structured || {});
		debugLog.finish({
			status: run.status,
			signal: run.signal || '',
			error: run.error && (run.error.message || String(run.error)) || '',
			response_chars: String(responseText || stdout || '').length,
		});
	}
	if (run.error) {
		return { success: false, message: 'Codex CLI could not be executed for chat.', details: { error: run.error.message || String(run.error), stdout, stderr, status: run.status, signal: run.signal, structured_events: run.structured && run.structured.summary, event_errors: run.structured && run.structured.errors, debug_log_dir: debugLog && debugLog.dir || '' } };
	}
	if (run.status !== 0) {
		return { success: false, message: 'Codex CLI chat request failed.', details: { stdout, stderr, response_text: responseText, structured_events: run.structured && run.structured.summary, event_errors: run.structured && run.structured.errors, debug_log_dir: debugLog && debugLog.dir || '' } };
	}
	return {
		success: true,
		response: {
			id: `local-codex-${Date.now()}`,
			object: 'chat.completion',
			model: `codex-local:${model}`,
			choices: [
				{
					index: 0,
					message: { role: 'assistant', content: responseText || stdout },
					finish_reason: 'stop',
				},
			],
			usage: parseUsage(stdout, stderr, run.structured),
			provider_details: {
				structured_events: !!run.used_json,
				json_fallback_reason: run.json_fallback_reason || undefined,
				output_schema_fallback_reason: run.output_schema_fallback_reason || undefined,
				chatgpt_model_fallback_reason: run.chatgpt_model_fallback_reason || undefined,
				debug_log_dir: debugLog && debugLog.dir || undefined,
			},
		},
	};
	} finally {
		try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (error) {}
	}
}

function listGeneratedImages(dir) {
	const results = [];
	if (!fs.existsSync(dir)) {
		return results;
	}
	let rootRealPath;
	try { rootRealPath = fs.realpathSync(dir); } catch (error) { return results; }
	const stack = [dir];
	while (stack.length) {
		const current = stack.pop();
		let entries = [];
		try {
			entries = fs.readdirSync(current, { withFileTypes: true });
		} catch (error) {
			continue;
		}
		for (const entry of entries) {
			const fullPath = path.join(current, entry.name);
			if (entry.isDirectory() && !entry.isSymbolicLink()) {
				stack.push(fullPath);
			} else if (!entry.isSymbolicLink() && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
				try {
					const realPath = fs.realpathSync(fullPath);
					const comparableRoot = process.platform === 'win32' ? rootRealPath.toLowerCase() : rootRealPath;
					const comparablePath = process.platform === 'win32' ? realPath.toLowerCase() : realPath;
					if (comparablePath !== comparableRoot && !comparablePath.startsWith(`${comparableRoot}${path.sep}`)) continue;
					const stat = fs.statSync(fullPath);
					if (!stat.isFile()) continue;
					results.push({ path: fullPath, mtimeMs: stat.mtimeMs, size: stat.size });
				} catch (error) {}
			}
		}
	}
	return results;
}

function readGeneratedImage(dir, candidate) {
	let rootRealPath;
	let realPath;
	try {
		rootRealPath = fs.realpathSync(dir);
		const resolvedCandidate = path.resolve(String(candidate || ''));
		realPath = fs.realpathSync(resolvedCandidate);
		const comparableRoot = process.platform === 'win32' ? rootRealPath.toLowerCase() : rootRealPath;
		const comparablePath = process.platform === 'win32' ? realPath.toLowerCase() : realPath;
		if (comparablePath !== comparableRoot && !comparablePath.startsWith(`${comparableRoot}${path.sep}`)) return { error: 'Codex generated image was outside the generated image directory.' };
		const initialLinkStat = fs.lstatSync(resolvedCandidate);
		if (!initialLinkStat.isFile() || initialLinkStat.isSymbolicLink()) return { error: 'Codex generated image was not a regular file.' };
		const initialStat = fs.statSync(resolvedCandidate);
		if (!initialStat.isFile()) return { error: 'Codex generated image was not a regular file.' };
		if (initialStat.size <= 0 || initialStat.size > MAX_CODEX_IMAGE_BYTES) return { error: 'Codex generated image exceeded the 20 MB size limit.' };
		const descriptor = fs.openSync(resolvedCandidate, 'r');
		try {
			const descriptorStat = fs.fstatSync(descriptor);
			if (!descriptorStat.isFile() || descriptorStat.size !== initialStat.size || descriptorStat.size > MAX_CODEX_IMAGE_BYTES) return { error: 'Codex generated image changed during validation.' };
			const bytes = fs.readFileSync(descriptor);
			const finalLinkStat = fs.lstatSync(resolvedCandidate);
			const finalRealPath = fs.realpathSync(resolvedCandidate);
			if (!finalLinkStat.isFile() || finalLinkStat.isSymbolicLink() || imagePathKey(finalRealPath) !== imagePathKey(realPath)) return { error: 'Codex generated image changed during validation.' };
			if (bytes.length <= 0 || bytes.length > MAX_CODEX_IMAGE_BYTES) return { error: 'Codex generated image exceeded the 20 MB size limit.' };
			return { bytes };
		} finally {
			fs.closeSync(descriptor);
		}
	} catch (error) {
		return { error: 'Codex generated image could not be read safely.' };
	}
}

function imagePathKey(value) {
	const resolved = path.resolve(String(value || '').trim());
	return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

const imageEventPathKeys = new Set([
	'path',
	'file_path',
	'filepath',
	'image_path',
	'imagepath',
	'output_path',
	'outputpath',
	'output_file',
	'outputfile',
	'artifact_path',
	'artifactpath',
	'file',
	'file_name',
	'filename',
	'image',
]);

function collectImageEventPaths(value, paths = [], seen = new Set()) {
	if (!value || typeof value !== 'object' || seen.has(value)) {
		return paths;
	}
	seen.add(value);
	if (Array.isArray(value)) {
		for (const item of value) {
			collectImageEventPaths(item, paths, seen);
		}
		return paths;
	}
	for (const [key, nested] of Object.entries(value)) {
		const normalizedKey = String(key).toLowerCase().replace(/[-\s]/g, '_');
		if (imageEventPathKeys.has(normalizedKey) && typeof nested === 'string' && nested.trim()) {
			paths.push(nested.trim());
		}
		collectImageEventPaths(nested, paths, seen);
	}
	return paths;
}

function imagePathsFromJsonEvents(structured) {
	const paths = [];
	const seen = new Set();
	const source = structured && Array.isArray(structured.events) ? structured.events : structured;
	for (const value of collectImageEventPaths(source || [])) {
		const resolved = path.resolve(String(value || '').trim());
		const key = imagePathKey(resolved);
		if (!seen.has(key)) {
			seen.add(key);
			paths.push(resolved);
		}
	}
	return paths;
}

function detectNewImage(before, after, options = {}) {
	const settings = typeof options === 'number' ? { startedAt: options } : (options || {});
	const startedAt = Number(settings.startedAt || 0);
	const known = new Set((Array.isArray(before) ? before : []).map((item) => imagePathKey(item && item.path)));
	const fresh = (Array.isArray(after) ? after : [])
		.filter((item) => item && item.path && !known.has(imagePathKey(item.path)))
		.filter((item) => !startedAt || Number(item.mtimeMs) >= startedAt)
		.sort((a, b) => Number(b.mtimeMs || 0) - Number(a.mtimeMs || 0));
	if (!Array.isArray(settings.namedPaths) || !settings.namedPaths.length) {
		return fresh;
	}
	const freshByPath = new Map(fresh.map((item) => [imagePathKey(item.path), item]));
	const preferred = [];
	const selected = new Set();
	for (const namedPath of settings.namedPaths) {
		const key = imagePathKey(namedPath);
		const match = freshByPath.get(key);
		if (match && !selected.has(key)) {
			preferred.push(match);
			selected.add(key);
		}
	}
	return [...preferred, ...fresh.filter((item) => !selected.has(imagePathKey(item.path)))];
}

function imagePrompt(payload, attachments = []) {
	const prompt = String(payload.prompt || '').trim();
	const size = String(payload.size || '1024x1024').trim();
	const quality = String(payload.quality || 'auto').trim();
	const outputFormat = String(payload.output_format || 'image/png').trim();
	const formatName = /png/i.test(outputFormat) ? 'PNG' : (/webp/i.test(outputFormat) ? 'WebP' : 'JPEG');
	const sizePart = size === 'auto' ? '' : ` at ${size}`;
	const qualityPart = quality === 'auto' ? '' : `, quality ${quality}`;
	const generationPrompt = `Create one ${formatName} image${sizePart}${qualityPart}. Scene: ${prompt}`;
	const lines = [
		'Generate exactly one image using your built-in image_gen tool.',
		'Pass the following text verbatim as the image_gen prompt (do not shorten or omit the size or quality):',
		generationPrompt,
		'Do not access unrelated local files or modify anything except generated image output.',
	];
	if (attachments.length) {
		lines.push(
			'Attached reference images are provided via --image flags. Use them as exact visual references; do not invent substitutes.',
		);
		for (let i = 0; i < attachments.length; i++) {
			const label = attachments[i].label ? ` (${attachments[i].label})` : '';
			lines.push(`- Image ${i + 1}${label}: exact reference from attachment ${i + 1}.`);
		}
		if (attachments.length >= 2) {
			lines.push('- Merge products from Image 1 into the layout structure of Image 2 photorealistically.');
		}
	}
	lines.push(
		`Requested output format: ${outputFormat}. Produce this exact file format.`,
		'After the image has been generated, reply with a short plain-text confirmation only.',
	);
	return lines.join('\n');
}

async function images(payload, session = {}) {
	const status = await checkStatusAsync();
	if (!status.success) {
		return status;
	}
	const prompt = String(payload.prompt || '').trim();
	if (!prompt) {
		return { success: false, message: 'No image prompt was provided.' };
	}
	fs.mkdirSync(generatedImagesDir, { recursive: true });
	const before = listGeneratedImages(generatedImagesDir);
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alorbach-codex-image-'));
	try {
	const outputFile = path.join(tempDir, 'last-message.txt');
	const attachments = collectImageAttachments(payload, tempDir);
	const promptText = imagePrompt(payload, attachments);
	const debugLog = beginLocalModelDebugLog({
		kind: 'image',
		model: 'codex-local:image',
		provider: 'codex-cli',
		requestId: session.requestId,
		route: '/v1/images',
	});
	if (debugLog) {
		debugLog.writePrompt(promptText);
		debugLog.writeJson('request', {
			model: 'codex-local:image',
			size: payload.size || '',
			quality: payload.quality || '',
			attachment_count: attachments.length,
			temp_dir: tempDir,
			output_file: outputFile,
			image_detection_initial_file_count: before.length,
		});
	}
	const args = [
		'exec',
		'--skip-git-repo-check',
		'--ephemeral',
		'--cd',
		tempDir,
		'--output-last-message',
		outputFile,
	];
	for (const attachment of attachments) {
		args.push('--image', attachment.path);
	}
	args.push('-');
	if (typeof session.appendSessionInput === 'function') session.appendSessionInput('stdin', promptText);
	const expectedStartTime = Date.now();
	if (debugLog) {
		debugLog.writeJson('image_detection', {
			image_detection_start_time: expectedStartTime,
			image_detection_initial_file_count: before.length,
		});
	}
	const run = await runCodexExec(args, { cwd: tempDir, timeout: Number(process.env.ALORBACH_CODEX_IMAGE_TIMEOUT_MS || 1800000), onOutput: session.appendSessionOutput, input: promptText });
	const after = listGeneratedImages(generatedImagesDir);
	const newImages = detectNewImage(before, after, {
		startedAt: expectedStartTime,
		namedPaths: imagePathsFromJsonEvents(run.structured),
	});
	const stdout = (run.stdout || '').trim();
	const stderr = (run.stderr || '').trim();
	if (debugLog) {
		debugLog.writeOutput(newImages.length ? `Generated image: ${newImages[0].path}` : stdout);
		debugLog.writeStdout(run.stdout || '');
		debugLog.writeStderr(run.stderr || '');
		debugLog.writeJson('structured', run.structured || {});
		debugLog.writeJson('generated_images', newImages);
		debugLog.finish({
			status: run.status,
			signal: run.signal || '',
			error: run.error && (run.error.message || String(run.error)) || '',
			generated_image: newImages[0] && newImages[0].path || '',
		});
	}
	if (run.error) {
		return { success: false, message: 'Codex CLI could not be executed for image generation.', details: { error: run.error.message || String(run.error), stdout, stderr, status: run.status, signal: run.signal, structured_events: run.structured && run.structured.summary, event_errors: run.structured && run.structured.errors, debug_log_dir: debugLog && debugLog.dir || '' } };
	}
	if (run.status !== 0) {
		const failure = codexImageFailureFromOutput(stdout, stderr, generatedImagesDir, run.structured);
		if (failure.code === 'codex_rate_limited') {
			failure.details = { ...(failure.details || {}), debug_log_dir: debugLog && debugLog.dir || '' };
			return failure;
		}
		return { success: false, code: 'codex_cli_image_failed', category: 'codex_cli', message: 'Codex CLI image generation failed.', details: { stdout, stderr, structured_events: run.structured && run.structured.summary, event_errors: run.structured && run.structured.errors, debug_log_dir: debugLog && debugLog.dir || '' } };
	}
	if (!newImages.length) {
		const failure = codexImageFailureFromOutput(stdout, stderr, generatedImagesDir, run.structured);
		failure.details = { ...(failure.details || {}), debug_log_dir: debugLog && debugLog.dir || '' };
		return failure;
	}
	const imageRead = readGeneratedImage(generatedImagesDir, newImages[0].path);
	if (imageRead.error) {
		return { success: false, code: 'codex_image_output_invalid', category: 'codex_cli', message: imageRead.error, details: { debug_log_dir: debugLog && debugLog.dir || '' } };
	}
	const bytes = imageRead.bytes;
	const mimeType = mimeFromImagePath(newImages[0].path);
	if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
		return { success: false, code: 'codex_image_output_format_invalid', category: 'codex_cli', message: 'Codex CLI returned an unsupported image file format.', details: { debug_log_dir: debugLog && debugLog.dir || '' } };
	}
	return {
		success: true,
		response: {
			data: [{ b64_json: bytes.toString('base64'), mime_type: mimeType }],
			usage: parseUsage(stdout, stderr, run.structured),
			provider_details: {
				image_path: newImages[0].path,
				generated_images_dir: generatedImagesDir,
				structured_events: !!run.used_json,
				json_fallback_reason: run.json_fallback_reason || undefined,
				reference_attachment_count: attachments.length,
				refs_forwarded_to_codex: attachments.length > 0,
				debug_log_dir: debugLog && debugLog.dir || undefined,
			},
		},
	};
	} finally {
		try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (error) {}
	}
}

function audioExtensionForFormat(format) {
	const normalized = String(format || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	if (['mp3', 'wav', 'm4a', 'mp4', 'ogg', 'opus', 'flac', 'webm'].includes(normalized)) {
		return normalized === 'opus' ? 'ogg' : normalized;
	}
	return 'audio';
}

function secondsFromTimestamp(value) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	const text = String(value || '').trim();
	if (!text) {
		return null;
	}
	if (/^\d+(?:\.\d+)?$/.test(text)) {
		return Number(text);
	}
	const match = text.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
	if (!match) {
		return null;
	}
	const hours = match[1] ? Number(match[1]) : 0;
	const minutes = Number(match[2]);
	const seconds = Number(match[3]);
	return (hours * 3600) + (minutes * 60) + seconds;
}

function parseLegacyTimedLines(text) {
	const words = [];
	for (const line of String(text || '').split(/\r?\n/)) {
		const match = line.trim().match(/^([^=]+)=([^=]+)=([\s\S]+)$/);
		if (!match) {
			continue;
		}
		const start = secondsFromTimestamp(match[1]);
		const end = secondsFromTimestamp(match[2]);
		const word = String(match[3] || '').trim();
		if (start === null || end === null || !word) {
			continue;
		}
		words.push({ word, start, end });
	}
	return words;
}

function wordsFromJsonValue(value) {
	if (!value || typeof value !== 'object') {
		return [];
	}
	const source = Array.isArray(value)
		? value
		: (Array.isArray(value.words) ? value.words : (Array.isArray(value.word_timestamps) ? value.word_timestamps : (Array.isArray(value.word_timings) ? value.word_timings : [])));
	const words = [];
	for (const item of source) {
		if (!item || typeof item !== 'object') {
			continue;
		}
		const start = secondsFromTimestamp(item.start ?? item.start_time);
		const end = secondsFromTimestamp(item.end ?? item.end_time);
		const word = String(item.word ?? item.text ?? '').trim();
		if (start === null || end === null || !word) {
			continue;
		}
		words.push({ word, start, end });
	}
	return words;
}

function parseTimedWords(text) {
	const legacy = parseLegacyTimedLines(text);
	if (legacy.length) {
		return legacy;
	}
	const trimmed = String(text || '').trim().replace(/^```(?:json|text)?\s*/i, '').replace(/```$/i, '').trim();
	if (!trimmed) {
		return [];
	}
	try {
		const parsed = JSON.parse(trimmed);
		const words = wordsFromJsonValue(parsed);
		if (words.length) {
			return words;
		}
	} catch (error) {}
	const jsonLines = [];
	for (const line of trimmed.split(/\r?\n/)) {
		try {
			const words = wordsFromJsonValue(JSON.parse(line));
			if (words.length === 1) {
				jsonLines.push(words[0]);
			}
		} catch (error) {}
	}
	return jsonLines;
}

function transcriptionPrompt(payload, audioPath) {
	const prompt = String(payload.prompt || '').trim();
	const format = String(payload.audio_format || '').trim() || 'unknown';
	const duration = Number(payload.duration_seconds || 0);
	return [
		'Transcribe the attached audio file into exact per-word lyrics timing.',
		`Audio file: ${audioPath}`,
		`Audio format: ${format}`,
		duration > 0 ? `Approximate duration: ${duration} seconds` : '',
		'Return only one JSON object with this shape: {"words":[{"start":1.25,"end":1.75,"word":"Forbidden"}]}.',
		'Every sung word must have numeric start and end seconds. Do not group phrases. Do not omit repeated words.',
		'Do not include prose, markdown, summaries, metadata, or plain lyrics outside the JSON object.',
		prompt ? `Additional transcription instructions: ${prompt}` : '',
	].filter(Boolean).join('\n');
}

async function transcribe(payload, session = {}) {
	return asr.transcribe(payload, session);
}

function models() {
	const cachePath = path.join(codexHome, 'models_cache.json');
	const text = ['auto'];
	try {
		const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
		const items = Array.isArray(raw) ? raw : (Array.isArray(raw.models) ? raw.models : []);
		for (const item of items) {
			const id = String(item.id || item.slug || '').trim();
			if (id && !text.includes(id)) {
				text.push(id);
			}
		}
	} catch (error) {}
	return {
		success: true,
		models: {
			text: text.map((id) => `codex-local:${id}`),
			image: ['codex-local:image'],
			audio: asr.modelIds(),
		},
	};
}

function capabilities() {
	const version = runCodex(['--version']);
	const exec = execCapabilities();
	const appServer = runCodex(['app-server', '--help']);
	return {
		success: !version.error && version.status === 0,
		bridge_features: {
			chat: true,
			images: true,
			audio_transcription: true,
			media_analysis: true,
			structured_exec_json: exec.json,
			output_schema: exec.output_schema,
			sandbox: exec.sandbox,
			image_attachments: exec.image_attachments,
			image_reference_attachments: true,
			app_server: !appServer.error && appServer.status === 0,
		},
		codex: {
			binary: resolveCodexBinary(),
			version: (version.stdout || version.stderr || '').trim(),
			exec_help_available: exec.help_available,
			app_server_available: !appServer.error && appServer.status === 0,
		},
		asr: asr.capabilities(),
	};
}

module.exports = {
	buildChatArgs,
	buildChatPrompt,
	capabilities,
	chat,
	checkStatus,
	checkStatusAsync,
	codexChatModelUnsupported,
	codexImageFailureFromOutput,
	codexJsonUnsupported,
	codexOutputSchemaUnsupported,
	collectImageAttachments,
	detectNewImage,
	execCapabilities,
	imagePrompt,
	imagePathsFromJsonEvents,
	images,
	listGeneratedImages,
	messagesToPrompt,
	models,
	nativeCodexChatModel,
	parseCodexJsonEvents,
	parseTimedWords,
	readGeneratedImage,
	runCodexAsync,
	runCodexExec,
	transcribe,
	asrStatus: asr.capabilities,
	asrSettings: asr.publicSettings,
	saveAsrSettings: asr.saveSettings,
	setupAsr: asr.setup,
	resolveCodexBinary,
	setCodexBinary,
};
