'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { createBoundedCollector } = require('./diagnostics');

const TIMEOUT_MS = 15000;

function cleanText(value) {
	return String(value || '').replace(/\x1b\[[0-9;]*m/g, '').replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
}

function safeDiagnostic(value) {
	const text = cleanText(value).replace(/(bearer|token|api[_ -]?key|authorization)\s*[:=]\s*\S+/ig, '$1: <redacted>');
	if (/not logged in|not authenticated|no auth credentials|login required/i.test(text)) return 'Not authenticated.';
	if (/access is denied|permission denied/i.test(text)) return 'Authentication state could not be read by this process.';
	if (/timed out/i.test(text)) return 'CLI probe timed out.';
	return text || 'CLI is unavailable.';
}

function resolveCommand(candidates, options = {}) {
	const lookup = options.lookup || ((name) => spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], { encoding: 'utf8', shell: false }));
	for (const candidate of candidates.filter(Boolean)) {
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
	return spawnImpl(invocation.command, invocation.args, { encoding: 'utf8', shell: false, windowsHide: true, timeout: Number(options.timeoutMs || TIMEOUT_MS) });
}

function runAsync(command, args, options = {}) {
	return new Promise((resolve) => {
		let child; let stdout = ''; let stderr = ''; let timedOut = false;
		try { const invocation = commandAndArgs(command, args); child = (options.spawn || spawn)(invocation.command, invocation.args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { resolve({ error, status: null, stdout, stderr }); return; }
		const timer = setTimeout(() => { timedOut = true; child.kill(); }, Number(options.timeoutMs || TIMEOUT_MS));
		child.stdout.on('data', (chunk) => { stdout += String(chunk); }); child.stderr.on('data', (chunk) => { stderr += String(chunk); });
		child.once('error', (error) => { clearTimeout(timer); resolve({ error, status: null, stdout, stderr }); });
		child.once('close', (status) => { clearTimeout(timer); resolve({ error: timedOut ? new Error('CLI probe timed out.') : null, status, stdout, stderr }); });
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
	const unauthenticated = auth && (/not logged in|not authenticated|no auth credentials|login required/i.test(authText) || auth.status !== 0);
	return { ...base, version: cleanText(version.stdout || version.stderr), authenticated: auth ? !unauthenticated : null, ready: auth ? !unauthenticated : false, state: unauthenticated ? 'not_authenticated' : (auth ? 'ready' : 'installed'), diagnostic: unauthenticated ? safeDiagnostic(authText) : (auth ? 'Ready.' : 'Authentication not checked yet.'), models: definition.models || [] };
}

async function detectCliAsync(definition, options = {}) {
	const command = definition.command || resolveCommand(definition.candidates || [], options);
	const base = { id: definition.id, label: definition.label, kind: 'local-cli', command: command || '', installed: !!command, ready: false, authenticated: null, job_types: definition.jobTypes || [], features: definition.features || {} };
	if (!command) return { ...base, state: 'unavailable', diagnostic: 'CLI executable was not found.' };
	const version = await runAsync(command, definition.versionArgs || ['--version'], options);
	if (version.error || version.status !== 0) return { ...base, state: 'unavailable', diagnostic: safeDiagnostic(version.error && version.error.message || version.stderr || version.stdout) };
	const auth = definition.authArgs ? await runAsync(command, definition.authArgs, options) : null;
	const authText = auth ? `${auth.stdout || ''}\n${auth.stderr || ''}` : '';
	const unauthenticated = auth && (/not logged in|not authenticated|no auth credentials|login required/i.test(authText) || auth.status !== 0);
	return { ...base, version: cleanText(version.stdout || version.stderr), authenticated: auth ? !unauthenticated : null, ready: !!auth && !unauthenticated, state: unauthenticated ? 'not_authenticated' : 'ready', diagnostic: unauthenticated ? safeDiagnostic(authText) : 'Ready.', models: definition.models || [] };
}

function runTextCommand(command, args, input, session = {}, options = {}) {
	return new Promise((resolve) => {
		const out = createBoundedCollector({ maxChars: 1024 * 1024 });
		const err = createBoundedCollector({ maxChars: 1024 * 1024 });
		let child; let settled = false;
		try { const invocation = commandAndArgs(command, args); child = (options.spawn || spawn)(invocation.command, invocation.args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (error) { resolve({ success: false, category: 'configuration', code: 'cli_spawn_failed', message: safeDiagnostic(error.message) }); return; }
		const timer = setTimeout(() => { if (!settled) { child.kill(); settled = true; resolve({ success: false, category: 'timeout', code: 'cli_timeout', message: 'CLI request timed out.' }); } }, Number(options.timeoutMs || 600000));
		child.stdout.on('data', (chunk) => { out.append(chunk); session.appendSessionOutput && session.appendSessionOutput('stdout', String(chunk)); });
		child.stderr.on('data', (chunk) => { err.append(chunk); session.appendSessionOutput && session.appendSessionOutput('stderr', String(chunk)); });
		child.on('error', (error) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ success: false, category: 'configuration', code: 'cli_spawn_failed', message: safeDiagnostic(error.message) }); } });
		child.on('close', (status) => { if (settled) return; settled = true; clearTimeout(timer); if (status !== 0) { resolve({ success: false, category: 'cli_process', code: 'cli_request_failed', message: safeDiagnostic(err.value() || out.value()), details: { status } }); return; } resolve({ success: true, text: out.value().trim() }); });
		child.stdin.end(String(input || ''));
	});
}

function messagesToText(payload = {}) { return payload.input || payload.prompt || (payload.messages || []).map((m) => `${m.role || 'user'}: ${Array.isArray(m.content) ? m.content.map((p) => p.text || p.content || '').join('\n') : m.content || ''}`).join('\n\n'); }

module.exports = { detectCli, detectCliAsync, messagesToText, resolveCommand, runTextCommand, safeDiagnostic };
