'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { createBoundedCollector } = require('./diagnostics');
const security = require('./security');

const MODEL_ID = 'model-relay:music-analysis:core';
const RUNNER_PATH = runnerPath('music-analysis-runner.py');
const MAX_AUDIO_BASE64_LENGTH = 67108864;
const DEFAULT_TIMEOUT_MS = Number(process.env.ALORBACH_MUSIC_ANALYSIS_TIMEOUT_MS || 1800000);
const DEFAULT_PROBE_TTL_MS = Number(process.env.ALORBACH_MUSIC_ANALYSIS_PROBE_TTL_MS || 30000);
const DEFAULT_VENV_PATH = path.join(security.stateDir, 'music-analysis-venv');
const DEFAULT_PYTHON310 = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'python.exe');
const DEFAULT_PYTHON312 = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe');
const REQUIRED_MODULES = ['numpy', 'scipy', 'soundfile', 'librosa', 'pyloudnorm'];
let probeCache = null;

function unpackedAsarPath(sourcePath) {
	const normalized = String(sourcePath || '');
	const marker = `${path.sep}app.asar${path.sep}`;
	const index = normalized.indexOf(marker);
	return index === -1 ? normalized : `${normalized.slice(0, index)}${path.sep}app.asar.unpacked${path.sep}${normalized.slice(index + marker.length)}`;
}

function runnerPath(filename, baseDir = __dirname) {
	return unpackedAsarPath(path.join(baseDir, filename));
}

function readState() {
	try {
		const state = JSON.parse(fs.readFileSync(security.statePath, 'utf8'));
		return state && typeof state === 'object' ? state : {};
	} catch (error) {
		return {};
	}
}

function writeState(state) {
	fs.mkdirSync(security.stateDir, { recursive: true });
	fs.writeFileSync(security.statePath, JSON.stringify(state, null, 2));
}

function defaultSettings() {
	return {
		python_path: process.env.ALORBACH_MUSIC_ANALYSIS_PYTHON || '',
		venv_path: process.env.ALORBACH_MUSIC_ANALYSIS_VENV || DEFAULT_VENV_PATH,
		sample_rate: Math.max(8000, Number(process.env.ALORBACH_MUSIC_ANALYSIS_SAMPLE_RATE || 22050) || 22050),
		max_sections: Math.max(2, Math.min(24, Number(process.env.ALORBACH_MUSIC_ANALYSIS_MAX_SECTIONS || 12) || 12)),
	};
}

function normalizeSettings(raw) {
	const defaults = defaultSettings();
	const source = raw && typeof raw === 'object' ? raw : {};
	return {
		python_path: String(source.python_path || defaults.python_path || '').trim(),
		venv_path: String(source.venv_path || defaults.venv_path || '').trim() || defaults.venv_path,
		sample_rate: Math.max(8000, Math.min(96000, Number(source.sample_rate || defaults.sample_rate) || defaults.sample_rate)),
		max_sections: Math.max(2, Math.min(24, Number(source.max_sections || defaults.max_sections) || defaults.max_sections)),
	};
}

function settings() {
	return normalizeSettings(readState().music_analysis || {});
}

function invalidateProbeCache() {
	probeCache = null;
}

function saveSettings(nextSettings) {
	const state = readState();
	state.music_analysis = normalizeSettings(nextSettings);
	writeState(state);
	invalidateProbeCache();
	return settings();
}

function venvPythonPath(config = settings()) {
	return path.join(config.venv_path, process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
}

function executableAvailable(command) {
	if (!command) return false;
	const probe = spawnSync(command, ['--version'], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 10000 });
	return !probe.error && probe.status === 0;
}

function pythonInfo(command, source) {
	if (!command || !executableAvailable(command)) {
		return { available: false, command: command || '', source: source || '', version: '' };
	}
	const version = spawnSync(command, ['--version'], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 10000 });
	return { available: true, command, source, version: String(version.stdout || version.stderr || '').trim() };
}

function discoverBasePython(config = settings()) {
	const candidates = [
		[config.python_path, 'configured'],
		[process.env.ALORBACH_MUSIC_ANALYSIS_PYTHON, 'environment'],
		[DEFAULT_PYTHON310, 'python310'],
		[DEFAULT_PYTHON312, 'python312'],
		['python', 'path'],
	].filter(([value], index, all) => value && all.findIndex(([candidate]) => candidate === value) === index);
	for (const [candidate, source] of candidates) {
		const info = pythonInfo(candidate, source);
		if (info.available) return info;
	}
	return { available: false, command: config.python_path || '', source: '', version: '' };
}

function hasRequiredModules(pythonPath) {
	if (!pythonPath || !fs.existsSync(pythonPath)) return false;
	const code = `import ${REQUIRED_MODULES.join(',')}; print('ready')`;
	const result = spawnSync(pythonPath, ['-c', code], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 30000 });
	return !result.error && result.status === 0;
}

function commandAvailable(command) {
	const result = spawnSync(command, ['-version'], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 10000 });
	return !result.error && result.status === 0;
}

function lightRuntime(config = settings()) {
	const venvPython = venvPythonPath(config);
	return {
		checked: false,
		cached: false,
		base_python: { available: null, command: config.python_path || '', source: '', version: '' },
		venv_path: config.venv_path,
		venv_python: venvPython,
		venv_exists: fs.existsSync(venvPython),
		runtime_installed: null,
		ffmpeg_available: null,
		ffprobe_available: null,
	};
}

function probe(config = settings()) {
	const venvPython = venvPythonPath(config);
	const ffmpeg = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
	const ffprobe = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
	return {
		checked: true,
		cached: false,
		base_python: discoverBasePython(config),
		venv_path: config.venv_path,
		venv_python: venvPython,
		venv_exists: fs.existsSync(venvPython),
		runtime_installed: hasRequiredModules(venvPython),
		ffmpeg_available: commandAvailable(ffmpeg),
		ffprobe_available: commandAvailable(ffprobe),
	};
}

function probeCacheKey(config) {
	return JSON.stringify({ python_path: config.python_path, venv_path: config.venv_path, sample_rate: config.sample_rate, max_sections: config.max_sections });
}

function cachedProbe(config = settings(), options = {}) {
	const ttlMs = Math.max(0, Number(options.ttlMs ?? DEFAULT_PROBE_TTL_MS) || 0);
	const key = probeCacheKey(config);
	if (!options.refresh && probeCache && probeCache.key === key && Date.now() < probeCache.expires_at) {
		return { ...probeCache.value, cached: true, cache_expires_at: probeCache.expires_at };
	}
	const value = { ...probe(config), checked_at: new Date().toISOString() };
	probeCache = { key, value, expires_at: Date.now() + ttlMs };
	return { ...value, cache_expires_at: probeCache.expires_at };
}

function runtimeForOptions(config = settings(), options = {}) {
	if (options.runtime) return options.runtime;
	if (options.refresh) return cachedProbe(config, { refresh: true, ttlMs: options.ttlMs });
	if (probeCache && probeCache.key === probeCacheKey(config) && Date.now() < probeCache.expires_at) {
		return { ...probeCache.value, cached: true, cache_expires_at: probeCache.expires_at };
	}
	return lightRuntime(config);
}

function runtimeReady(runtime) {
	return !!(runtime && runtime.venv_exists && runtime.runtime_installed && runtime.ffmpeg_available && runtime.ffprobe_available);
}

function capabilities(options = {}) {
	const config = settings();
	const runtime = runtimeForOptions(config, options);
	return {
		enabled: true,
		ready: runtime.checked === false ? null : runtimeReady(runtime),
		runtime_checked: runtime.checked !== false,
		runtime_cached: !!runtime.cached,
		models: [MODEL_ID],
		settings: config,
		runtime,
	};
}

function publicSettings(options = {}) {
	return { success: true, settings: settings(), capabilities: capabilities(options) };
}

function runAsync(command, args, options = {}) {
	const emitOutput = typeof options.onOutput === 'function' ? options.onOutput : () => {};
	return new Promise((resolve) => {
		let child;
		const stdout = createBoundedCollector({ maxChars: Number(process.env.ALORBACH_MUSIC_ANALYSIS_OUTPUT_MAX_CHARS || 1024 * 1024) });
		const stderr = createBoundedCollector({ maxChars: Number(process.env.ALORBACH_MUSIC_ANALYSIS_OUTPUT_MAX_CHARS || 1024 * 1024) });
		let error = null;
		let timedOut = false;
		try {
			child = spawn(command, args, { cwd: options.cwd, env: options.env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
		} catch (spawnError) {
			resolve({ status: null, signal: null, stdout: '', stderr: '', error: spawnError });
			return;
		}
		const timer = setTimeout(() => { timedOut = true; child.kill(); }, Math.max(1, Number(options.timeout || DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS));
		if (typeof timer.unref === 'function') timer.unref();
		child.stdout.on('data', (chunk) => { const text = String(chunk || ''); stdout.append(text); emitOutput('stdout', text); });
		child.stderr.on('data', (chunk) => { const text = String(chunk || ''); stderr.append(text); emitOutput('stderr', text); });
		child.once('error', (spawnError) => { error = spawnError; });
		child.once('close', (status, signal) => {
			clearTimeout(timer);
			resolve({ status, signal, stdout: stdout.value(), stderr: stderr.value(), error: error || (timedOut ? new Error('Music analysis timed out.') : null) });
		});
		child.stdin.end(options.input || '');
	});
}

async function setup(session = {}) {
	const config = settings();
	const basePython = discoverBasePython(config);
	if (!basePython.available) {
		return { success: false, category: 'configuration', code: 'music_analysis_python_missing', message: 'Music analysis setup requires Python 3.10+; configure ALORBACH_MUSIC_ANALYSIS_PYTHON or the Music Analysis Python path.' };
	}
	const output = typeof session.appendSessionOutput === 'function' ? session.appendSessionOutput : () => {};
	output('stdout', `Creating Music Analysis virtual environment at ${config.venv_path}\n`);
	let result = await runAsync(basePython.command, ['-m', 'venv', config.venv_path], { timeout: DEFAULT_TIMEOUT_MS, onOutput: output });
	if (result.error || result.status !== 0) {
		return { success: false, category: 'configuration', code: 'music_analysis_venv_create_failed', message: 'Could not create the Music Analysis virtual environment.', details: { status: result.status, stderr: result.stderr } };
	}
	const venvPython = venvPythonPath(config);
	output('stdout', 'Installing local music-analysis packages (numpy, scipy, soundfile, librosa, pyloudnorm).\n');
	result = await runAsync(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', 'numpy', 'scipy', 'soundfile', 'librosa', 'pyloudnorm'], { timeout: DEFAULT_TIMEOUT_MS, onOutput: output });
	invalidateProbeCache();
	if (result.error || result.status !== 0) {
		return { success: false, category: 'configuration', code: 'music_analysis_package_install_failed', message: 'Music analysis packages could not be installed.', details: { status: result.status, stderr: result.stderr } };
	}
	const ready = capabilities({ refresh: true });
	return ready.ready ? { success: true, capabilities: ready } : { success: false, category: 'configuration', code: 'music_analysis_runtime_unavailable', message: 'Music analysis setup completed, but the runtime is still not ready.', details: ready };
}

function audioExtensionForFormat(value) {
	const raw = String(value || '').toLowerCase().replace(/^audio\//, '').replace(/[^a-z0-9]/g, '');
	return ({ mpeg: 'mp3', mp3: 'mp3', wav: 'wav', xwav: 'wav', flac: 'flac', m4a: 'm4a', mp4: 'm4a', ogg: 'ogg', opus: 'opus', webm: 'webm', aac: 'aac' })[raw] || 'bin';
}

function decodeAudio(value) {
	const encoded = String(value || '').replace(/\s+/g, '');
	if (!encoded || encoded.length > MAX_AUDIO_BASE64_LENGTH || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
		return null;
	}
	const bytes = Buffer.from(encoded, 'base64');
	return bytes.length ? bytes : null;
}

function finiteNumber(value, fallback = null) {
	const number = Number(value);
	return Number.isFinite(number) ? number : fallback;
}

function normalizeRunnerOutput(value) {
	const source = value && typeof value === 'object' ? value : {};
	const duration = finiteNumber(source.duration_seconds ?? source.duration);
	if (!(duration > 0)) return null;
	const beatGrid = Array.isArray(source.beat_grid_seconds) ? source.beat_grid_seconds.map((item) => finiteNumber(item)).filter((item) => item !== null && item >= 0 && item <= duration).slice(0, 100000) : [];
	const key = source.key && typeof source.key === 'object' ? source.key : {};
	const tonic = /^[A-G](?:#|b)?$/i.test(String(key.tonic || '')) ? String(key.tonic) : '';
	const mode = ['major', 'minor'].includes(String(key.mode || '').toLowerCase()) ? String(key.mode).toLowerCase() : '';
	const sections = (Array.isArray(source.sections) ? source.sections : []).map((section, index) => {
		const start = finiteNumber(section && section.start_seconds);
		const end = finiteNumber(section && section.end_seconds);
		if (start === null || end === null || start < 0 || end <= start || end > duration + 0.01) return null;
		return { label: `section_${String(index + 1).padStart(2, '0')}`, start_seconds: start, end_seconds: Math.min(end, duration) };
	}).filter(Boolean).slice(0, 24);
	return {
		duration_seconds: duration,
		tempo: { bpm: finiteNumber(source.tempo && source.tempo.bpm, 0), beat_grid_seconds: beatGrid },
		key: { tonic, mode, confidence: Math.max(0, Math.min(1, finiteNumber(key.confidence, 0))) },
		loudness: {
			integrated_lufs: finiteNumber(source.loudness && source.loudness.integrated_lufs),
			loudness_range_lu: finiteNumber(source.loudness && source.loudness.loudness_range_lu),
			peak_dbfs: finiteNumber(source.loudness && source.loudness.peak_dbfs),
			rms_dbfs: finiteNumber(source.loudness && source.loudness.rms_dbfs),
			dynamic_range_db: finiteNumber(source.loudness && source.loudness.dynamic_range_db),
		},
		spectral: {
			centroid_hz_mean: finiteNumber(source.spectral && source.spectral.centroid_hz_mean),
			rolloff_hz_mean: finiteNumber(source.spectral && source.spectral.rolloff_hz_mean),
			flatness_mean: finiteNumber(source.spectral && source.spectral.flatness_mean),
			contrast_db_mean: finiteNumber(source.spectral && source.spectral.contrast_db_mean),
		},
		sections,
	};
}

async function analyze(payload = {}, session = {}) {
	const audioBytes = decodeAudio(payload.audio_base64);
	if (!audioBytes) {
		return { success: false, category: 'validation', code: 'music_analysis_audio_invalid', message: 'Audio payload is missing, invalid, or too large.' };
	}
	const config = settings();
	const runtime = runtimeForOptions(config, { refresh: true });
	if (!runtimeReady(runtime)) {
		return { success: false, category: 'configuration', code: 'music_analysis_runtime_unavailable', message: 'Local music analysis is not ready. Use the explicit Music Analysis setup action, then refresh runtime detection.', details: runtime };
	}
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-music-analysis-'));
	try {
		const audioPath = path.join(tempDir, `audio.${audioExtensionForFormat(payload.audio_format)}`);
		fs.writeFileSync(audioPath, audioBytes);
		if (typeof session.appendSessionOutput === 'function') session.appendSessionOutput('stdout', 'Running local music analysis with librosa.\n');
		const run = await runAsync(runtime.venv_python, [RUNNER_PATH], {
			cwd: tempDir,
			timeout: DEFAULT_TIMEOUT_MS,
			input: JSON.stringify({ audio_path: audioPath, sample_rate: config.sample_rate, max_sections: config.max_sections }),
			onOutput: session.appendSessionOutput,
		});
		if (run.error || run.status !== 0) {
			return { success: false, category: 'music_analysis_runtime', code: 'music_analysis_failed', message: 'Local music analysis failed.', details: { status: run.status, stderr: run.stderr, stdout: run.stdout } };
		}
		let parsed;
		try {
			parsed = JSON.parse(String(run.stdout || '').trim());
		} catch (error) {
			return { success: false, category: 'output_detection', code: 'music_analysis_invalid_output', message: 'Local music analysis did not return valid JSON.', details: { stdout: run.stdout, stderr: run.stderr } };
		}
		const analysis = normalizeRunnerOutput(parsed);
		if (!analysis) {
			return { success: false, category: 'output_detection', code: 'music_analysis_invalid_output', message: 'Local music analysis returned incomplete or invalid measurements.' };
		}
		return {
			success: true,
			response: {
				model: MODEL_ID,
				duration_seconds: analysis.duration_seconds,
				music_analysis: analysis,
				provider_details: { provider: 'music-analysis', local: true, runtime: 'librosa', sample_rate: config.sample_rate },
			},
		};
	} finally {
		try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (error) {}
	}
}

module.exports = {
	MODEL_ID,
	REQUIRED_MODULES,
	analyze,
	capabilities,
	cachedProbe,
	decodeAudio,
	defaultSettings,
	invalidateProbeCache,
	lightRuntime,
	normalizeRunnerOutput,
	normalizeSettings,
	probe,
	publicSettings,
	runnerPath,
	saveSettings,
	settings,
	setup,
	venvPythonPath,
};
