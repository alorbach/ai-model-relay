'use strict';

/*
 * CUDA-only print-upscale driver. Jobs never download a model or fall back to
 * CPU. The status-page Setup action is the explicit operator install: it
 * clones the official checkout, fetches the ×2 weight, and records the
 * SHA-256 for later job-time verification.
 */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { appendLog, createBoundedCollector } = require('./diagnostics');
const {
	constraintPath,
	DEFAULT_TORCH_INDEX,
	evaluateCudaTorch,
	killProcessTree,
	probeTorchStatus,
	torchConstraintText,
} = require('./cuda-torch-venv');
const { resolveCommand } = require('./local-cli');
const security = require('./security');

const MAX_BYTES = 64 * 1024 * 1024;
const SETUP_TIMEOUT_MS = Number(process.env.AI_MODEL_RELAY_UPSCALE_SETUP_TIMEOUT_MS || 1800000);
const DOWNLOAD_TIMEOUT_MS = Number(process.env.AI_MODEL_RELAY_UPSCALE_DOWNLOAD_TIMEOUT_MS || 600000);
const CHECKOUT_MARKER = '.ai-model-relay-commit';
const DEFAULT_PYTHON310 = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'python.exe');
const DEFAULT_PYTHON312 = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe');
const MODELS = {
	'model-relay:local-upscale:swinir-classical-x2': { id: 'model-relay:local-upscale:swinir-classical-x2', engine: 'swinir', label: 'SwinIR classical ×2' },
	'model-relay:local-upscale:realesrgan-x2plus': { id: 'model-relay:local-upscale:realesrgan-x2plus', engine: 'realesrgan', label: 'Real-ESRGAN ×2plus (restoration)' },
};

/** Resolve Python runners outside Electron's read-only app.asar archive. */
function unpackedAsarPath(sourcePath) {
	const normalized = String(sourcePath || '');
	const marker = `${path.sep}app.asar${path.sep}`;
	const index = normalized.indexOf(marker);
	return index === -1 ? normalized : `${normalized.slice(0, index)}${path.sep}app.asar.unpacked${path.sep}${normalized.slice(index + marker.length)}`;
}

function runnerPath(filename, baseDir = __dirname) {
	return unpackedAsarPath(path.join(baseDir, filename));
}
const INSTALL = {
	swinir: {
		engine: 'swinir',
		repo: 'https://github.com/JingyunLiang/SwinIR.git',
		commit: '6545850fbf8df298df73d81f3e8cba638787c8bd',
		script: 'main_test_swinir.py',
		weight_name: '001_classicalSR_DF2K_s64w8_SwinIR-M_x2.pth',
		weight_url: 'https://github.com/JingyunLiang/SwinIR/releases/download/v0.0/001_classicalSR_DF2K_s64w8_SwinIR-M_x2.pth',
		weight_bytes: 67277475,
		weight_sha256: '2032ebf8f401dd3ce2fae5f3852117cb72101ec6ed8358faa64c2a3fa09ed4ac',
		packages: ['numpy', 'opencv-python-headless', 'pillow', 'timm'],
	},
	realesrgan: {
		engine: 'realesrgan',
		repo: 'https://github.com/xinntao/Real-ESRGAN.git',
		commit: 'a4abfb2979a7bbff3f69f58f58ae324608821e27',
		script: 'inference_realesrgan.py',
		weight_name: 'RealESRGAN_x2plus.pth',
		weight_url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth',
		weight_bytes: 67061725,
		weight_sha256: '49fafd45f8fd7aa8d31ab2a22d14d91b536c34494a5cfe31eb5d89c2fa266abb',
		packages: ['numpy', 'basicsr', 'facexlib', 'gfpgan', 'opencv-python-headless', 'pillow', 'tqdm'],
	},
};

function sha256File(filePath) {
	try { const hash = crypto.createHash('sha256'); const stream = fs.readFileSync(filePath); hash.update(stream); return hash.digest('hex'); } catch (error) { return ''; }
}

function cleanPath(value) { return String(value || '').trim(); }

function readState() {
	try {
		const state = JSON.parse(fs.readFileSync(security.statePath, 'utf8'));
		return state && typeof state === 'object' ? state : {};
	} catch (error) { return {}; }
}

function writeState(state) {
	fs.mkdirSync(security.stateDir, { recursive: true });
	fs.writeFileSync(security.statePath, JSON.stringify(state, null, 2));
}

function venvPythonPath(venvPath) {
	return path.join(venvPath, process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
}

function defaultSettings() {
	return {
		python_path: process.env.AI_MODEL_RELAY_UPSCALE_PYTHON || '',
		venv_path: process.env.AI_MODEL_RELAY_UPSCALE_VENV || path.join(security.stateDir, 'upscale-venv'),
		swinir_root: process.env.AI_MODEL_RELAY_SWINIR_ROOT || path.join(security.stateDir, 'upscale', 'swinir'),
		swinir_model_path: process.env.AI_MODEL_RELAY_SWINIR_MODEL_PATH || '',
		swinir_weight_sha256: String(process.env.AI_MODEL_RELAY_SWINIR_WEIGHT_SHA256 || '').toLowerCase(),
		realesrgan_root: process.env.AI_MODEL_RELAY_REALESRGAN_ROOT || path.join(security.stateDir, 'upscale', 'realesrgan'),
		realesrgan_model_path: process.env.AI_MODEL_RELAY_REALESRGAN_MODEL_PATH || '',
		realesrgan_weight_sha256: String(process.env.AI_MODEL_RELAY_REALESRGAN_WEIGHT_SHA256 || '').toLowerCase(),
	};
}

function normalizeSettings(raw) {
	const defaults = defaultSettings();
	const source = raw && typeof raw === 'object' ? raw : {};
	return {
		python_path: String(source.python_path || defaults.python_path || '').trim(),
		venv_path: String(source.venv_path || defaults.venv_path || '').trim() || defaults.venv_path,
		swinir_root: String(source.swinir_root || defaults.swinir_root || '').trim() || defaults.swinir_root,
		swinir_model_path: String(source.swinir_model_path || defaults.swinir_model_path || '').trim(),
		swinir_weight_sha256: String(source.swinir_weight_sha256 || defaults.swinir_weight_sha256 || '').trim().toLowerCase(),
		realesrgan_root: String(source.realesrgan_root || defaults.realesrgan_root || '').trim() || defaults.realesrgan_root,
		realesrgan_model_path: String(source.realesrgan_model_path || defaults.realesrgan_model_path || '').trim(),
		realesrgan_weight_sha256: String(source.realesrgan_weight_sha256 || defaults.realesrgan_weight_sha256 || '').trim().toLowerCase(),
	};
}

function settings() {
	return normalizeSettings({ ...defaultSettings(), ...(readState().local_upscale || {}) });
}

function saveSettings(nextSettings) {
	const state = readState();
	state.local_upscale = normalizeSettings({ ...settings(), ...(nextSettings || {}) });
	writeState(state);
	return settings();
}

function resolveModelFiles(engine, env = process.env) {
	const saved = env === process.env ? settings() : {};
	const prefix = engine === 'swinir' ? 'AI_MODEL_RELAY_SWINIR' : 'AI_MODEL_RELAY_REALESRGAN';
	const key = engine === 'swinir' ? 'swinir' : 'realesrgan';
	return {
		model_path: cleanPath(env[`${prefix}_MODEL_PATH`]) || cleanPath(saved[`${key}_model_path`]),
		root: cleanPath(env[`${prefix}_ROOT`]) || cleanPath(saved[`${key}_root`]),
		expected_checksum: cleanPath(env[`${prefix}_WEIGHT_SHA256`]).toLowerCase() || cleanPath(saved[`${key}_weight_sha256`]).toLowerCase(),
	};
}

function modelConfig(id, env = process.env, manifests = INSTALL) {
	const model = MODELS[id];
	if (!model) return null;
	const files = resolveModelFiles(model.engine, env);
	const manifest = manifests[model.engine] || {};
	const actualChecksum = files.model_path && fs.existsSync(files.model_path) ? sha256File(files.model_path) : '';
	const expectedChecksum = cleanPath(manifest.weight_sha256).toLowerCase();
	const expectedBytes = Number(manifest.weight_bytes || 0);
	const actualBytes = files.model_path && fs.existsSync(files.model_path) ? fs.statSync(files.model_path).size : 0;
	const expectedCommit = String(manifest.commit || '').trim().toLowerCase();
	const actualCommit = readCheckoutCommit(files.root);
	const checkoutValid = /^[a-f0-9]{40}$/.test(expectedCommit) && actualCommit === expectedCommit;
	const manifestValid = /^[a-f0-9]{64}$/.test(expectedChecksum) && actualChecksum && actualChecksum === expectedChecksum && (!expectedBytes || actualBytes === expectedBytes);
	return {
		...model,
		model_path: files.model_path,
		root: files.root,
		expected_checksum: expectedChecksum,
		expected_bytes: expectedBytes,
		actual_checksum: actualChecksum,
		actual_bytes: actualBytes,
		expected_commit: expectedCommit,
		actual_commit: actualCommit,
		checkout_valid: checkoutValid,
		installed: !!files.model_path && fs.existsSync(files.model_path),
		manifest_valid: !!manifestValid,
		state: !files.model_path || !fs.existsSync(files.model_path) ? 'not_installed' : (!/^[a-f0-9]{64}$/.test(expectedChecksum) ? 'manifest_missing' : (!manifestValid ? 'checksum_mismatch' : (!checkoutValid ? 'checkout_unpinned' : 'installed'))),
	};
}

function readCheckoutCommit(root) {
	try {
		const value = String(fs.readFileSync(path.join(root, CHECKOUT_MARKER), 'utf8') || '').trim().toLowerCase();
		return /^[a-f0-9]{40}$/.test(value) ? value : '';
	} catch (error) {
		return '';
	}
}

function pythonCommand(env = process.env) {
	if (env === process.env) {
		const config = settings();
		const venvPython = venvPythonPath(config.venv_path);
		if (fs.existsSync(venvPython)) return venvPython;
		return resolveCommand([env.AI_MODEL_RELAY_UPSCALE_PYTHON, config.python_path, 'python.exe', 'python']);
	}
	return resolveCommand([env.AI_MODEL_RELAY_UPSCALE_PYTHON, 'python.exe', 'python']);
}

function gpuStatus() {
	const command = resolveCommand([process.env.AI_MODEL_RELAY_NVIDIA_SMI, 'nvidia-smi']);
	if (!command) return { available: false, state: 'nvidia_smi_missing', devices: [] };
	try {
		const result = spawnSync(command, ['--query-gpu=index,name,memory.free,memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 10000 });
		if (result.error || result.status !== 0) return { available: false, state: 'gpu_probe_failed', devices: [] };
		const devices = String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
			const [index, name, free, total] = line.split(',').map((part) => part.trim());
			return { index: Number(index), name, free_vram_mib: Number(free), total_vram_mib: Number(total) };
		}).filter((device) => Number.isInteger(device.index) && device.total_vram_mib > 0);
		return { available: devices.length > 0, state: devices.length ? 'available' : 'no_cuda_device', devices };
	} catch (error) { return { available: false, state: 'gpu_probe_failed', devices: [] }; }
}

function publicSettings() {
	const config = settings();
	const models = Object.keys(MODELS).map((id) => {
		const model = modelConfig(id);
		return { id: model.id, label: model.label, engine: model.engine, state: model.state, installed: model.installed, manifest_valid: model.manifest_valid };
	});
	return { success: true, settings: config, models, venv_exists: fs.existsSync(venvPythonPath(config.venv_path)), gpu: gpuStatus() };
}

function runCommand(command, args, options = {}) {
	const emit = typeof options.onOutput === 'function' ? options.onOutput : () => {};
	return new Promise((resolve) => {
		let child;
		const stdout = createBoundedCollector({ maxChars: 1024 * 1024 });
		const stderr = createBoundedCollector({ maxChars: 1024 * 1024 });
		let error = null;
		let settled = false;
		const finish = (value) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
		try { child = spawn(command, args, { cwd: options.cwd, env: options.env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
		catch (spawnError) { resolve({ status: null, stdout: '', stderr: '', error: spawnError }); return; }
		const timer = setTimeout(() => { killProcessTree(child); finish({ status: null, stdout: stdout.value(), stderr: stderr.value(), error: new Error('Local upscale setup timed out.') }); }, Number(options.timeout || SETUP_TIMEOUT_MS));
		if (typeof timer.unref === 'function') timer.unref();
		child.stdout.on('data', (chunk) => { const text = String(chunk || ''); stdout.append(text); emit('stdout', text); });
		child.stderr.on('data', (chunk) => { const text = String(chunk || ''); stderr.append(text); emit('stderr', text); });
		child.once('error', (spawnError) => { error = spawnError; });
		child.once('close', (status) => finish({ status, stdout: stdout.value(), stderr: stderr.value(), error }));
	});
}

function downloadHttpsFile(url, destination, redirects = 0, limits = {}) {
	return new Promise((resolve, reject) => {
		if (redirects > 5) { reject(new Error('Weight download followed too many redirects.')); return; }
		const maxBytes = Number(limits.maxBytes || 0) > 0 ? Number(limits.maxBytes) : 256 * 1024 * 1024;
		const timeoutMs = Number(limits.timeoutMs || DOWNLOAD_TIMEOUT_MS);
		const client = String(url).startsWith('http://') ? http : https;
		const req = client.get(url, { headers: { 'User-Agent': 'ai-model-relay' } }, (res) => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				res.resume();
				downloadHttpsFile(new URL(res.headers.location, url).toString(), destination, redirects + 1, limits).then(resolve, reject);
				return;
			}
			if (res.statusCode !== 200) { res.resume(); reject(new Error(`Weight download failed with HTTP ${res.statusCode}.`)); return; }
			const declared = Number.parseInt(String(res.headers['content-length'] || ''), 10);
			if (Number.isFinite(declared) && declared > maxBytes) { res.resume(); reject(new Error('Weight download exceeded the pinned byte size.')); return; }
			fs.mkdirSync(path.dirname(destination), { recursive: true });
			const out = fs.createWriteStream(destination);
			let received = 0;
			let failed = false;
			const fail = (error) => {
				if (failed) return;
				failed = true;
				try { req.destroy(); } catch (destroyError) {}
				try { out.destroy(); } catch (destroyError) {}
				try { fs.unlinkSync(destination); } catch (unlinkError) {}
				reject(error);
			};
			res.on('data', (chunk) => {
				received += chunk.length;
				if (received > maxBytes) { fail(new Error('Weight download exceeded the pinned byte size.')); return; }
				if (!out.write(chunk)) res.pause();
			});
			out.on('drain', () => res.resume());
			res.on('end', () => { if (!failed) out.end(); });
			out.on('finish', () => { if (!failed) out.close(() => resolve(destination)); });
			out.on('error', fail);
			res.on('error', fail);
		});
		req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Weight download timed out.')); });
		req.on('error', reject);
	});
}

function commandDetails(result, extra = {}) {
	const stdout = String(result && result.stdout || '').trim();
	const stderr = String(result && result.stderr || '').trim();
	const error = result && result.error ? (result.error.message || String(result.error)) : '';
	const python = extra.python || '';
	return {
		...extra,
		python,
		python_exists: python ? fs.existsSync(python) : extra.python_exists,
		status: result && result.status != null ? result.status : null,
		error,
		stdout: stdout.slice(-8000),
		stderr: stderr.slice(-8000),
		log: [stderr, stdout, error].filter(Boolean).join('\n').slice(-12000),
	};
}

function setupFailure(code, message, result, extra = {}) {
	const details = commandDetails(result, extra);
	appendLog('upscale-setup', message, { code, ...details });
	return { success: false, category: 'configuration', code, message, details };
}

function discoverBasePython(config = settings()) {
	const candidates = [config.python_path, process.env.AI_MODEL_RELAY_UPSCALE_PYTHON, DEFAULT_PYTHON310, DEFAULT_PYTHON312, 'python.exe', 'python'].filter(Boolean);
	for (const candidate of candidates) {
		const command = resolveCommand([candidate]);
		if (command) return command;
	}
	return '';
}

async function upscaleEvaluateCudaTorch(run, venvPython, emit, pythonVersion) {
	const evaluated = await evaluateCudaTorch(run, venvPython, emit, {
		indexUrl: DEFAULT_TORCH_INDEX,
		pythonVersion,
		cpuTorchCode: 'local_upscale_cpu_torch',
		cudaUnavailableCode: 'local_upscale_cuda_unavailable',
		cudaUnavailableMessage: 'CUDA PyTorch is installed but torch.cuda is not usable. CPU fallback is disabled.',
	});
	if (!evaluated.success) {
		if (evaluated.code === 'local_upscale_cpu_torch') {
			const version = evaluated.extras && evaluated.extras.torch && evaluated.extras.torch.version || '';
			return setupFailure(evaluated.code, `pip installed a CPU PyTorch wheel (${version}) instead of a CUDA build from ${DEFAULT_TORCH_INDEX}. Local upscale does not fall back to CPU.`, evaluated.result, evaluated.extras);
		}
		return setupFailure(evaluated.code, evaluated.message, evaluated.result, evaluated.extras);
	}
	return { success: true, torch: evaluated.torch };
}

async function readGitHead(run, git, root) {
	if (!git) return readCheckoutCommit(root);
	const result = await run(git, ['rev-parse', 'HEAD'], { cwd: root, timeout: 15000 });
	const head = String(result && result.stdout || '').trim().toLowerCase();
	return /^[a-f0-9]{40}$/.test(head) ? head : readCheckoutCommit(root);
}

async function ensurePinnedCheckout(run, git, root, spec, emit) {
	const commit = String(spec.commit || '').trim().toLowerCase();
	if (!/^[a-f0-9]{40}$/.test(commit)) return setupFailure('local_upscale_checkout_unpinned', `The ${spec.engine} checkout is missing a pinned git commit.`);
	const scriptPath = path.join(root, spec.script);
	if (!fs.existsSync(scriptPath)) {
		if (!git) return setupFailure('local_upscale_git_missing', 'git is required on PATH to clone the official upscale checkout.');
		emit('stdout', `Cloning ${spec.repo} at ${commit}\n`);
		fs.mkdirSync(path.dirname(root), { recursive: true });
		const cloned = await run(git, ['clone', spec.repo, root], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (cloned.error || cloned.status !== 0) return setupFailure('local_upscale_clone_failed', `Could not clone ${spec.engine} from GitHub.`, cloned, { repo: spec.repo, destination: root, commit });
	}
	if (!fs.existsSync(scriptPath)) return { success: false, category: 'configuration', code: 'local_upscale_checkout_missing', message: `The official ${spec.engine} checkout is missing ${spec.script}.` };
	let head = await readGitHead(run, git, root);
	if (head !== commit) {
		if (!git) return setupFailure('local_upscale_checkout_unpinned', `The ${spec.engine} checkout is not the pinned commit ${commit}.`);
		emit('stdout', `Checking out pinned ${spec.engine} commit ${commit}\n`);
		await run(git, ['fetch', '--depth', '1', 'origin', commit], { cwd: root, timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		const checked = await run(git, ['checkout', '--force', commit], { cwd: root, timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (checked.error || checked.status !== 0) return setupFailure('local_upscale_checkout_pin_failed', `Could not check out the pinned ${spec.engine} commit.`, checked, { repo: spec.repo, commit });
		head = await readGitHead(run, git, root);
	}
	if (head !== commit) return setupFailure('local_upscale_checkout_mismatch', `The ${spec.engine} checkout HEAD did not match the pinned commit ${commit}.`, {}, { repo: spec.repo, commit, head });
	fs.mkdirSync(root, { recursive: true });
	fs.writeFileSync(path.join(root, CHECKOUT_MARKER), `${commit}\n`);
	return null;
}

async function setup(options = {}) {
	const engine = String(options.engine || '').trim() || 'swinir';
	const manifests = options.install || INSTALL;
	const spec = manifests[engine];
	if (!spec) return { success: false, category: 'validation', code: 'local_upscale_engine_invalid', message: 'Choose SwinIR or Real-ESRGAN on the status page to install a local CUDA upscale model.' };
	const logChunks = [];
	const emit = (stream, text) => {
		if (text) logChunks.push(String(text));
		if (typeof options.onOutput === 'function') options.onOutput(stream, text);
	};
	const collectedLog = () => logChunks.join('').slice(-12000);
	const run = options.runCommand || runCommand;
	const maxDownloadBytes = Math.max(Number(spec.weight_bytes || 0) * 2, 64 * 1024 * 1024);
	const download = options.downloadFile || ((url, dest) => downloadHttpsFile(url, dest, 0, { maxBytes: maxDownloadBytes, timeoutMs: DOWNLOAD_TIMEOUT_MS }));
	const persist = options.saveSettings || saveSettings;
	const git = options.gitCommand || resolveCommand(['git']);
	const config = options.settings || settings();
	const basePython = options.pythonCommand || discoverBasePython(config);
	if (!basePython) return setupFailure('local_upscale_python_missing', 'Local CUDA upscale setup needs a Python executable. Set the Python path in Settings or AI_MODEL_RELAY_UPSCALE_PYTHON.');
	const venvPython = venvPythonPath(config.venv_path);
	if (!fs.existsSync(venvPython)) {
		emit('stdout', `Creating CUDA upscale virtual environment at ${config.venv_path}\n`);
		fs.mkdirSync(path.dirname(config.venv_path), { recursive: true });
		const created = await run(basePython, ['-m', 'venv', config.venv_path], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (created.error || created.status !== 0) return setupFailure('local_upscale_venv_failed', 'Could not create the local CUDA upscale virtual environment.', created, { python: basePython, venv_path: config.venv_path });
	}
	const versionResult = await run(venvPython, ['-V'], { timeout: 15000, onOutput: emit });
	const pythonVersion = String(versionResult.stdout || versionResult.stderr || '').trim();
	await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--upgrade', 'pip'], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
	emit('stdout', 'Removing any existing CPU PyTorch wheels so pip cannot keep 2.x+cpu.\n');
	await run(venvPython, ['-m', 'pip', 'uninstall', '-y', 'torch', 'torchvision', 'torchaudio'], { timeout: 120000, onOutput: emit });
	emit('stdout', `Installing CUDA PyTorch for local upscale (${pythonVersion || venvPython}) from ${DEFAULT_TORCH_INDEX} only.\n`);
	const torch = await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--progress-bar', 'off', '--force-reinstall', '--no-cache-dir', 'torch', 'torchvision', '--index-url', DEFAULT_TORCH_INDEX], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
	if (torch.error || torch.status !== 0) return setupFailure('local_upscale_torch_failed', 'CUDA PyTorch could not be installed for local upscale. CPU fallback is disabled.', torch, { python: venvPython, python_version: pythonVersion, index_url: DEFAULT_TORCH_INDEX });
	const firstProbe = await upscaleEvaluateCudaTorch(run, venvPython, emit, pythonVersion);
	if (!firstProbe.success) return firstProbe;
	const freeze = await run(venvPython, ['-m', 'pip', 'freeze'], { timeout: 30000, onOutput: emit });
	const constraintText = torchConstraintText(freeze && freeze.stdout, firstProbe.torch && firstProbe.torch.version);
	if (!/^torch==/im.test(constraintText)) return setupFailure('local_upscale_torch_constraint_failed', 'CUDA PyTorch was installed but could not be pinned before follow-on package installs.', freeze, { python: venvPython, python_version: pythonVersion, torch: firstProbe.torch });
	const torchConstraintFile = constraintPath(config.venv_path);
	fs.mkdirSync(config.venv_path, { recursive: true });
	fs.writeFileSync(torchConstraintFile, constraintText);
	if (spec.packages.length) {
		emit('stdout', `Installing ${spec.engine} packages with CUDA PyTorch pinned at ${String(firstProbe.torch && firstProbe.torch.version || 'installed')}.\n`);
		const packages = await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--progress-bar', 'off', '--constraint', torchConstraintFile, ...spec.packages], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (packages.error || packages.status !== 0) return setupFailure('local_upscale_packages_failed', `Could not install ${spec.engine} Python packages.`, packages, { python: venvPython, python_version: pythonVersion, constraint: torchConstraintFile });
	}
	const key = engine === 'swinir' ? 'swinir' : 'realesrgan';
	const root = config[`${key}_root`];
	const pinned = await ensurePinnedCheckout(run, git, root, spec, emit);
	if (pinned) return pinned;
	// Real-ESRGAN's checkout generates realesrgan/version.py during package
	// installation.  Cloning alone leaves the official inference script unable
	// to import its own package, even when the pinned weight is present.
	if (engine === 'realesrgan') {
		const editable = await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-deps', '-e', root], { cwd: root, timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (editable.error || editable.status !== 0) return setupFailure('local_upscale_realesrgan_package_failed', 'Could not install the official Real-ESRGAN checkout into the local upscale environment.', editable, { python: venvPython, root });
	}
	const afterPackages = await upscaleEvaluateCudaTorch(run, venvPython, emit, pythonVersion);
	if (!afterPackages.success) return afterPackages;
	const modelPath = config[`${key}_model_path`] || path.join(security.stateDir, 'upscale', 'weights', spec.weight_name);
	const expected = String(spec.weight_sha256 || '').toLowerCase();
	const expectedBytes = Number(spec.weight_bytes || 0);
	const existingChecksum = fs.existsSync(modelPath) ? sha256File(modelPath) : '';
	const existingBytes = fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0;
	if (!existingChecksum || !expected || existingChecksum !== expected || (expectedBytes && existingBytes !== expectedBytes)) {
		emit('stdout', `Downloading ${spec.weight_name}\n`);
		try { await download(spec.weight_url, modelPath); }
		catch (error) { return setupFailure('local_upscale_weight_download_failed', error.message || 'The official ×2 weight could not be downloaded.'); }
	}
	const checksum = sha256File(modelPath);
	const bytes = fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0;
	if (!/^[a-f0-9]{64}$/.test(checksum)) return setupFailure('local_upscale_weight_invalid', 'The downloaded ×2 weight could not be checksummed.');
	if (!expected || checksum !== expected || (expectedBytes && bytes !== expectedBytes)) return setupFailure('local_upscale_checksum_mismatch', 'The downloaded ×2 weight did not match the pinned SHA-256 and byte size.');
	const saved = persist({
		...config,
		[`${key}_root`]: root,
		[`${key}_model_path`]: modelPath,
		[`${key}_weight_sha256`]: checksum,
	});
	const modelId = engine === 'swinir' ? 'model-relay:local-upscale:swinir-classical-x2' : 'model-relay:local-upscale:realesrgan-x2plus';
	return { success: true, engine, settings: saved, model: { id: modelId, label: MODELS[modelId].label, state: 'installed', manifest_valid: true, checkout_valid: true }, details: { python: venvPython, python_version: pythonVersion, index_url: DEFAULT_TORCH_INDEX, log: collectedLog(), torch: afterPackages.torch } };
}

function safeOutput(result, modelId) {
	const output = result && result.output && typeof result.output === 'object' ? result.output : {};
	const { path: privatePath, ...manifest } = output;
	return {
		success: true,
		response: { output: manifest, provenance: result.provenance || {}, model: modelId, local_unmetered: true },
		artifact: { mime_type: 'image/png', bytes: fs.readFileSync(privatePath) },
		local_job_id: result.local_job_id,
	};
}

function createLocalUpscaleDriver(options = {}) {
	const env = options.env || process.env;
	const manifests = options.manifests || INSTALL;
	const runner = options.runnerPath || runnerPath('upscale-runner.py');
	let snapshot = { id: 'local-upscale', label: 'Local CUDA Upscale', kind: 'local-runtime', ready: false, state: 'checking', diagnostic: 'Checking local CUDA upscale readiness.', gpu: gpuStatus(), models: [] };
	function inspect() {
		const python = pythonCommand(env);
		const gpu = gpuStatus();
		const torch = probeTorchStatus(python);
		const models = Object.keys(MODELS).map((id) => modelConfig(id, env, manifests));
		const runnersReady = fs.existsSync(runner) && !!python;
		const ready = runnersReady && gpu.available && torch.ok && models.some((model) => model.manifest_valid && model.checkout_valid);
		snapshot = {
			id: 'local-upscale',
			label: 'Local CUDA Upscale',
			kind: 'local-runtime',
			ready,
			state: ready ? 'ready' : 'not_ready',
			diagnostic: ready
				? 'CUDA PyTorch and at least one pinned local upscale checkout are ready.'
				: (torch.state === 'cpu_torch'
					? `The upscale venv has CPU PyTorch (${torch.version || 'unknown'}); jobs never fall back to CPU.`
					: 'Use Settings to install a local CUDA upscale model; jobs never download weights or fall back to CPU.'),
			python: python ? '<detected>' : '',
			gpu,
			torch: { available: torch.ok, state: torch.state, version: torch.version || '' },
			models: models.map((model) => ({ id: model.id, label: model.label, engine: model.engine, installed: model.installed, manifest_valid: model.manifest_valid, checkout_valid: model.checkout_valid, state: model.state })),
		};
		return snapshot;
	}
	/*
	 * Start with a real readiness snapshot.  The status page can install a
	 * model before any generic provider refresh runs; advertising the initial
	 * placeholder here would otherwise make the newly installed model appear
	 * unavailable until an unrelated refresh succeeds.
	 */
	inspect();
	return {
		id: 'local-upscale', label: 'Local CUDA Upscale', kind: 'local-runtime', job_types: ['upscale'],
		checkStatus: () => ({ success: snapshot.ready, message: snapshot.diagnostic, details: snapshot }),
		capabilities: () => ({ ...snapshot, job_types: ['upscale'], features: { local_upscale: true, binary_transfer: true, cuda_only: true, cpu_fallback: false, cancellation: true, max_gpu_jobs: 1, web_ui_setup: true } }),
		models: () => Object.keys(MODELS).map((id) => ({ id, type: 'image', backend: 'local-upscale', ready: !!snapshot.models.find((model) => model.id === id && model.manifest_valid && model.checkout_valid) && !!snapshot.gpu.available && !!(snapshot.torch && snapshot.torch.available), job_types: ['upscale'], label: MODELS[id].label })),
		refresh: async () => inspect(),
		async upscale(payload = {}, session = {}) {
			const state = inspect();
			const model = modelConfig(payload.model, env, manifests);
			if (!model || !model.manifest_valid || !model.checkout_valid || !state.gpu.available || !(state.torch && state.torch.available)) return { success: false, category: 'configuration', code: 'local_upscale_not_ready', message: 'Pinned model, pinned checkout, or CUDA readiness is unavailable. CPU fallback is disabled.', details: { state: model ? model.state : 'unknown_model', gpu: state.gpu.state, torch: state.torch && state.torch.state } };
			const source = Buffer.isBuffer(payload.source_bytes) ? payload.source_bytes : null;
			if (!source || !source.length || source.length > MAX_BYTES || !['image/png', 'image/jpeg', 'image/webp'].includes(String(payload.source_mime_type || '').toLowerCase())) return { success: false, category: 'validation', code: 'local_upscale_source_invalid', message: 'The local upscale source must be a bounded PNG, JPEG, or WebP binary.' };
			const outputPrint = payload.output_print && typeof payload.output_print === 'object' ? payload.output_print : {};
			const cropPixels = payload.crop_pixels && typeof payload.crop_pixels === 'object' ? payload.crop_pixels : {};
			if (payload.output_policy !== 'retain_native_x2' || !Number.isInteger(Number(outputPrint.width)) || !Number.isInteger(Number(outputPrint.height)) || Number(outputPrint.width) < Number(payload.target_print && payload.target_print.width) || Number(outputPrint.height) < Number(payload.target_print && payload.target_print.height) || Number(outputPrint.width) !== Number(cropPixels.width) * 2 || Number(outputPrint.height) !== Number(cropPixels.height) * 2) return { success: false, category: 'validation', code: 'local_upscale_contract_invalid', message: 'The signed local-upscale request must retain the approved native ×2 output.' };
			const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-upscale-'));
			const sourcePath = path.join(workdir, 'source'); const outputPath = path.join(workdir, 'result.png'); const jobPath = path.join(workdir, 'job.json');
			try {
				fs.writeFileSync(sourcePath, source);
				fs.writeFileSync(jobPath, JSON.stringify({ model, source_path: sourcePath, output_path: outputPath, source_mime_type: payload.source_mime_type, crop_pixels: cropPixels, target_print: payload.target_print, output_print: outputPrint, output_policy: payload.output_policy, scale: payload.scale, cuda_device: 0, tile: Number(env.AI_MODEL_RELAY_UPSCALE_TILE || 512), precision: String(env.AI_MODEL_RELAY_UPSCALE_PRECISION || 'fp16'), timeout_seconds: Math.max(1, Math.ceil(Number(env.AI_MODEL_RELAY_UPSCALE_TIMEOUT_MS || 1800000) / 1000)) }));
				const python = pythonCommand(env);
				const result = await new Promise((resolve) => {
					let stdout = ''; let stderr = ''; let settled = false; let timeout = null; let stopReason = ''; let removeAbort = () => {};
					const child = spawn(python, [runner, '--job-json', jobPath], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...env, PYTHONUNBUFFERED: '1' } });
					const settle = (value) => { if (settled) return; settled = true; if (timeout) clearTimeout(timeout); removeAbort(); resolve(value); };
					const requestStop = (reason) => {
						if (settled || stopReason) return;
						stopReason = reason;
						killProcessTree(child);
					};
					timeout = setTimeout(() => requestStop('timeout'), Number(env.AI_MODEL_RELAY_UPSCALE_TIMEOUT_MS || 1800000));
					const onAbort = () => requestStop('cancelled');
					if (session.signal) {
						if (session.signal.aborted) onAbort();
						else { session.signal.addEventListener('abort', onAbort, { once: true }); removeAbort = () => session.signal.removeEventListener('abort', onAbort); }
					}
					child.stdout.on('data', (chunk) => { stdout += String(chunk); session.appendSessionOutput && session.appendSessionOutput('stdout', String(chunk)); });
					child.stderr.on('data', (chunk) => { stderr += String(chunk); session.appendSessionOutput && session.appendSessionOutput('stderr', String(chunk)); });
					child.on('error', (error) => settle({ error, stdout, stderr }));
					child.on('close', (status) => {
						if (stopReason === 'cancelled') settle({ cancelled: true, stdout, stderr });
						else if (stopReason === 'timeout') settle({ timeout: true, stdout, stderr });
						else settle({ status, stdout, stderr });
					});
				});
				if (result.cancelled) return { success: false, category: 'cancelled', code: 'local_upscale_cancelled', message: 'The local CUDA upscale was cancelled; source bytes were preserved.' };
				if (result.timeout) return { success: false, category: 'timeout', code: 'local_upscale_timeout', message: 'The local CUDA upscale job timed out; source bytes were preserved.', details: { stderr: result.stderr } };
				if (result.error || result.status !== 0) return { success: false, category: 'configuration', code: 'local_upscale_failed', message: 'The local CUDA upscale runner did not complete; source bytes were preserved.', details: { stderr: String(result.stderr || '').slice(-4000) } };
				const metadata = JSON.parse(String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
				if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1 || fs.statSync(outputPath).size > MAX_BYTES) return { success: false, category: 'validation', code: 'local_upscale_output_missing', message: 'The local CUDA runner did not produce a bounded PNG result.' };
				const outputChecksum = sha256File(outputPath);
				const output = { ...metadata.output, path: outputPath, checksum: outputChecksum, mime_type: 'image/png', byte_size: fs.statSync(outputPath).size };
				if (!metadata.success || !outputChecksum || output.width !== Number(outputPrint.width) || output.height !== Number(outputPrint.height) || !metadata.provenance || metadata.provenance.downsampler !== 'none') return { success: false, category: 'validation', code: 'local_upscale_manifest_invalid', message: 'The local CUDA output did not retain the signed native ×2 dimensions.' };
				const value = safeOutput({ output, provenance: metadata.provenance, local_job_id: session.jobId }, model.id);
				return value;
			} catch (error) { return { success: false, category: 'configuration', code: 'local_upscale_failed', message: 'The local CUDA upscale runner failed; source bytes were preserved.' }; }
			finally { setTimeout(() => { try { fs.rmSync(workdir, { recursive: true, force: true }); } catch (error) {} }, 30000).unref?.(); }
		},
	};
}

module.exports = { MAX_BYTES, MODELS, INSTALL, CHECKOUT_MARKER, createLocalUpscaleDriver, gpuStatus, modelConfig, probeTorchStatus, publicSettings, runnerPath, saveSettings, settings, setup };
