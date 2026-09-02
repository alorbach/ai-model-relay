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
const MAX_4X_OUTPUT_BYTES = 256 * 1024 * 1024;
const SETUP_TIMEOUT_MS = Number(process.env.AI_MODEL_RELAY_UPSCALE_SETUP_TIMEOUT_MS || 1800000);
const DOWNLOAD_TIMEOUT_MS = Number(process.env.AI_MODEL_RELAY_UPSCALE_DOWNLOAD_TIMEOUT_MS || 600000);
const CHECKOUT_MARKER = '.ai-model-relay-commit';
const DEFAULT_PYTHON310 = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'python.exe');
const DEFAULT_PYTHON312 = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe');
const UPSCALE_CAPABILITIES_VERSION = 1;
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const PNG_OUTPUT = ['image/png'];
const MODELS = {
	'model-relay:local-upscale:swinir-classical-x2': { id: 'model-relay:local-upscale:swinir-classical-x2', engine: 'swinir', install_key: 'swinir', label: 'SwinIR classical ×2', native_scale: 2, output_policy: 'retain_native_x2', model_class: 'classical', runtime_group: 'basicsr-cuda', preferred_tile: 512, precision: ['fp16', 'fp32'], license: { spdx: 'Apache-2.0', commercial_use: true } },
	'model-relay:local-upscale:realesrgan-x2plus': { id: 'model-relay:local-upscale:realesrgan-x2plus', engine: 'realesrgan', install_key: 'realesrgan', label: 'Real-ESRGAN ×2plus (restoration)', native_scale: 2, output_policy: 'retain_native_x2', model_class: 'real_world', runtime_group: 'basicsr-cuda', preferred_tile: 512, precision: ['fp16', 'fp32'], license: { spdx: 'BSD-3-Clause', commercial_use: true } },
	'model-relay:local-upscale:drct-classical-x2': { id: 'model-relay:local-upscale:drct-classical-x2', engine: 'drct', install_key: 'drct_x2', label: 'DRCT classical ×2', native_scale: 2, output_policy: 'retain_native_x2', model_class: 'classical', runtime_group: 'basicsr-cuda', preferred_tile: 384, precision: ['fp16', 'fp32'], license: { spdx: 'MIT', commercial_use: true }, operator_weight_required: true },
	'model-relay:local-upscale:drct-classical-x4': { id: 'model-relay:local-upscale:drct-classical-x4', engine: 'drct', install_key: 'drct_x4', label: 'DRCT classical ×4', native_scale: 4, output_policy: 'retain_native_x4', model_class: 'classical', runtime_group: 'basicsr-cuda', preferred_tile: 256, precision: ['fp16', 'fp32'], license: { spdx: 'MIT', commercial_use: true }, max_output_bytes: MAX_4X_OUTPUT_BYTES },
	'model-relay:local-upscale:hat-s-classical-x2': { id: 'model-relay:local-upscale:hat-s-classical-x2', engine: 'hat-s', install_key: 'hat_s_x2', label: 'HAT-S classical ×2', native_scale: 2, output_policy: 'retain_native_x2', model_class: 'classical', runtime_group: 'basicsr-cuda', preferred_tile: 384, precision: ['fp16', 'fp32'], license: { spdx: 'Apache-2.0', commercial_use: true } },
	'model-relay:local-upscale:hat-s-classical-x4': { id: 'model-relay:local-upscale:hat-s-classical-x4', engine: 'hat-s', install_key: 'hat_s_x4', label: 'HAT-S classical ×4', native_scale: 4, output_policy: 'retain_native_x4', model_class: 'classical', runtime_group: 'basicsr-cuda', preferred_tile: 256, precision: ['fp16', 'fp32'], license: { spdx: 'Apache-2.0', commercial_use: true }, max_output_bytes: MAX_4X_OUTPUT_BYTES },
	'model-relay:local-upscale:apisr-anime-x2': { id: 'model-relay:local-upscale:apisr-anime-x2', engine: 'apisr', install_key: 'apisr_x2', label: 'APISR anime ×2 (experimental)', native_scale: 2, output_policy: 'retain_native_x2', model_class: 'anime', runtime_group: 'apisr-cuda', preferred_tile: 256, precision: ['fp16', 'fp32'], experimental: true, academic_only: true, installation_acknowledgement_required: true, license: { spdx: 'GPL-3.0-only', commercial_use: false, usage_restriction: 'Academic and experimental use only; do not present as commercially suitable.' } },
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
	drct_x2: {
		engine: 'drct', repo: 'https://github.com/ming053l/DRCT.git', commit: 'c0a8b51e69241cf7f8ae598053235ff498517935', script: 'drct/archs/drct_arch.py',
		weight_name: 'DRCT_SRx2_operator_verified.pth', packages: ['numpy', 'basicsr==1.3.4.9', 'opencv-python-headless', 'pillow', 'timm'], operator_weight_required: true,
	},
	drct_x4: {
		engine: 'drct', repo: 'https://github.com/ming053l/DRCT.git', commit: 'c0a8b51e69241cf7f8ae598053235ff498517935', script: 'drct/archs/drct_arch.py',
		weight_name: 'DRCT_SRx4.pth', weight_url: 'https://drive.usercontent.google.com/download?id=1jw2UWAersWZecPq-c_g5RM3mDOoc_cbd&export=download&confirm=t', weight_bytes: 245582817, weight_sha256: 'fe104903aa8fe897b85605a733c8c7907e40c02f066e53c6cbac2f3f0c838dd9', packages: ['numpy', 'basicsr==1.3.4.9', 'opencv-python-headless', 'pillow', 'timm'],
	},
	hat_s_x2: {
		engine: 'hat-s', repo: 'https://github.com/XPixelGroup/HAT.git', commit: '1638a9a822581657811867bf670717f8371fc3e5', script: 'hat/archs/hat_arch.py',
		weight_name: 'HAT_SRx2.pth', weight_url: 'https://drive.usercontent.google.com/download?id=1Y7-3IgWfIAui9BMQIsFT9CzZXVMlx__e&export=download&confirm=t', weight_bytes: 79906461, weight_sha256: '3e249a901c2aed6b82548875e21847ef6c015a40c814237a7a0abb10c69d5ddf', packages: ['numpy', 'basicsr==1.3.4.9', 'opencv-python-headless', 'pillow', 'timm'],
	},
	hat_s_x4: {
		engine: 'hat-s', repo: 'https://github.com/XPixelGroup/HAT.git', commit: '1638a9a822581657811867bf670717f8371fc3e5', script: 'hat/archs/hat_arch.py',
		weight_name: 'HAT_SRx4.pth', weight_url: 'https://drive.usercontent.google.com/download?id=1YvU9PF1XqlP8TVzH7P0bg-YlfP1TKDPC&export=download&confirm=t', weight_bytes: 81089561, weight_sha256: 'a92f81bd2c0c1aaa371a6e4d6cac69e749fde2e36196885ee47a4a3667542c9a', packages: ['numpy', 'basicsr==1.3.4.9', 'opencv-python-headless', 'pillow', 'timm'],
	},
	apisr_x2: {
		engine: 'apisr', repo: 'https://github.com/Kiteretsu77/APISR.git', commit: 'c0c0407ba68c0bc5026e43da05f0e7c1cf7b9b95', script: 'test_code/test_utils.py',
		weight_name: '2x_APISR_RRDB_GAN_generator.pth', weight_url: 'https://github.com/Kiteretsu77/APISR/releases/download/v0.1.0/2x_APISR_RRDB_GAN_generator.pth', weight_bytes: 17960938, weight_sha256: '3b0d2b3a3c0461ac17d00f4f32240666fb832b738ea5a48449b1acf07fbb07e5', packages: ['numpy', 'opencv-python-headless', 'pillow', 'tqdm'], isolated_runtime: true,
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
		apisr_venv_path: process.env.AI_MODEL_RELAY_APISR_VENV || path.join(security.stateDir, 'upscale-apisr-venv'),
		swinir_root: process.env.AI_MODEL_RELAY_SWINIR_ROOT || path.join(security.stateDir, 'upscale', 'swinir'),
		swinir_model_path: process.env.AI_MODEL_RELAY_SWINIR_MODEL_PATH || '',
		swinir_weight_sha256: String(process.env.AI_MODEL_RELAY_SWINIR_WEIGHT_SHA256 || '').toLowerCase(),
		realesrgan_root: process.env.AI_MODEL_RELAY_REALESRGAN_ROOT || path.join(security.stateDir, 'upscale', 'realesrgan'),
		realesrgan_model_path: process.env.AI_MODEL_RELAY_REALESRGAN_MODEL_PATH || '',
		realesrgan_weight_sha256: String(process.env.AI_MODEL_RELAY_REALESRGAN_WEIGHT_SHA256 || '').toLowerCase(),
		model_records: {},
	};
}

function normalizeSettings(raw) {
	const defaults = defaultSettings();
	const source = raw && typeof raw === 'object' ? raw : {};
	return {
		python_path: String(source.python_path || defaults.python_path || '').trim(),
		venv_path: String(source.venv_path || defaults.venv_path || '').trim() || defaults.venv_path,
		apisr_venv_path: String(source.apisr_venv_path || defaults.apisr_venv_path || '').trim() || defaults.apisr_venv_path,
		swinir_root: String(source.swinir_root || defaults.swinir_root || '').trim() || defaults.swinir_root,
		swinir_model_path: String(source.swinir_model_path || defaults.swinir_model_path || '').trim(),
		swinir_weight_sha256: String(source.swinir_weight_sha256 || defaults.swinir_weight_sha256 || '').trim().toLowerCase(),
		realesrgan_root: String(source.realesrgan_root || defaults.realesrgan_root || '').trim() || defaults.realesrgan_root,
		realesrgan_model_path: String(source.realesrgan_model_path || defaults.realesrgan_model_path || '').trim(),
		realesrgan_weight_sha256: String(source.realesrgan_weight_sha256 || defaults.realesrgan_weight_sha256 || '').trim().toLowerCase(),
		model_records: source.model_records && typeof source.model_records === 'object' ? source.model_records : {},
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

function resolveModelFiles(model, env = process.env) {
	const saved = env === process.env ? settings() : {};
	const engine = typeof model === 'string' ? model : model.engine;
	const legacy = engine === 'swinir' ? 'swinir' : (engine === 'realesrgan' ? 'realesrgan' : '');
	const prefix = legacy === 'swinir' ? 'AI_MODEL_RELAY_SWINIR' : (legacy === 'realesrgan' ? 'AI_MODEL_RELAY_REALESRGAN' : '');
	const record = model && typeof model === 'object' ? (saved.model_records && saved.model_records[model.id] || {}) : {};
	const envKey = model && typeof model === 'object' ? String(model.install_key || '').toUpperCase() : '';
	return {
		model_path: (prefix && cleanPath(env[`${prefix}_MODEL_PATH`])) || cleanPath(env[`AI_MODEL_RELAY_UPSCALE_${envKey}_MODEL_PATH`]) || cleanPath(record.model_path) || (legacy && cleanPath(saved[`${legacy}_model_path`])),
		root: (prefix && cleanPath(env[`${prefix}_ROOT`])) || cleanPath(env[`AI_MODEL_RELAY_UPSCALE_${envKey}_ROOT`]) || cleanPath(record.root) || (legacy && cleanPath(saved[`${legacy}_root`])) || path.join(security.stateDir, 'upscale', String(model && model.install_key || engine || 'model')),
		expected_checksum: ((prefix && cleanPath(env[`${prefix}_WEIGHT_SHA256`])) || cleanPath(env[`AI_MODEL_RELAY_UPSCALE_${envKey}_WEIGHT_SHA256`]) || cleanPath(record.weight_sha256) || (legacy && cleanPath(saved[`${legacy}_weight_sha256`]))).toLowerCase(),
	};
}

function modelConfig(id, env = process.env, manifests = INSTALL) {
	const model = MODELS[id];
	if (!model) return null;
	const files = resolveModelFiles(model, env);
	const manifest = manifests[model.install_key] || manifests[model.engine] || {};
	const actualChecksum = files.model_path && fs.existsSync(files.model_path) ? sha256File(files.model_path) : '';
	const expectedChecksum = cleanPath(manifest.weight_sha256 || (model.operator_weight_required ? files.expected_checksum : '')).toLowerCase();
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
		state: model.operator_weight_required && !/^[a-f0-9]{64}$/.test(expectedChecksum) ? 'operator_weight_required' : (!files.model_path || !fs.existsSync(files.model_path) ? 'not_installed' : (!/^[a-f0-9]{64}$/.test(expectedChecksum) ? 'manifest_missing' : (!manifestValid ? 'checksum_mismatch' : (!checkoutValid ? 'checkout_unpinned' : 'installed')))),
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

function pythonCommand(env = process.env, model = null) {
	if (env === process.env) {
		const config = settings();
		const venvPython = venvPythonPath(model && model.runtime_group === 'apisr-cuda' ? config.apisr_venv_path : config.venv_path);
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

function publicUpscaleCapabilities(model, state) {
	return {
		contract_version: UPSCALE_CAPABILITIES_VERSION,
		native_scale: model.native_scale,
		output_policy: model.output_policy,
		input_formats: IMAGE_MIME_TYPES,
		output_formats: PNG_OUTPUT,
		cuda_only: true,
		tile: { supported: true, recommended: model.preferred_tile },
		precision: model.precision,
		explicit_install: true,
		runtime_group: model.runtime_group,
		model_class: model.model_class,
		experimental: !!model.experimental,
		academic_only: !!model.academic_only,
		license: model.license,
		installation_acknowledgement_required: !!model.installation_acknowledgement_required,
		operator_weight_required: !!model.operator_weight_required,
		output_max_bytes: Number(model.max_output_bytes || MAX_BYTES),
		readiness: { state: state && state.state || 'not_checked', installed: !!(state && state.installed), ready: !!(state && state.manifest_valid && state.checkout_valid) },
	};
}

function publicModelState(model) {
	return { id: model.id, label: model.label, engine: model.engine, state: model.state, installed: model.installed, manifest_valid: model.manifest_valid, checkout_valid: model.checkout_valid, upscale_capabilities: publicUpscaleCapabilities(model, model) };
}

function publicSettings() {
	const config = settings();
	const models = Object.keys(MODELS).map((id) => publicModelState(modelConfig(id)));
	return { success: true, settings: config, models, venv_exists: fs.existsSync(venvPythonPath(config.venv_path)), apisr_venv_exists: fs.existsSync(venvPythonPath(config.apisr_venv_path)), gpu: gpuStatus() };
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
	const manifests = options.install || INSTALL;
	const legacyModel = String(options.engine || '').trim() || 'swinir';
	const modelId = String(options.model || '').trim() || Object.keys(MODELS).find((id) => MODELS[id].install_key === legacyModel || MODELS[id].engine === legacyModel) || 'model-relay:local-upscale:swinir-classical-x2';
	const profile = MODELS[modelId];
	if (!profile) return { success: false, category: 'validation', code: 'local_upscale_model_invalid', message: 'Choose a supported local CUDA upscale model on the status page.' };
	const spec = manifests[profile.install_key] || manifests[profile.engine];
	if (!spec) return { success: false, category: 'validation', code: 'local_upscale_manifest_missing', message: `The ${profile.label} installation manifest is unavailable.` };
	if (profile.installation_acknowledgement_required && options.accept_restricted !== true) return { success: false, category: 'validation', code: 'local_upscale_restriction_acknowledgement_required', message: 'APISR is experimental, GPL-3.0-only, and academic-only. Confirm that restriction before installation.' };
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
	const config = normalizeSettings(options.settings || settings());
	const basePython = options.pythonCommand || discoverBasePython(config);
	if (!basePython) return setupFailure('local_upscale_python_missing', 'Local CUDA upscale setup needs a Python executable. Set the Python path in Settings or AI_MODEL_RELAY_UPSCALE_PYTHON.');
	const runtimeVenv = profile.runtime_group === 'apisr-cuda' ? config.apisr_venv_path : config.venv_path;
	const venvPython = venvPythonPath(runtimeVenv);
	if (!fs.existsSync(venvPython)) {
		emit('stdout', `Creating ${profile.runtime_group} CUDA virtual environment at ${runtimeVenv}\n`);
		fs.mkdirSync(path.dirname(runtimeVenv), { recursive: true });
		const created = await run(basePython, ['-m', 'venv', runtimeVenv], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (created.error || created.status !== 0) return setupFailure('local_upscale_venv_failed', 'Could not create the local CUDA upscale virtual environment.', created, { python: basePython, venv_path: runtimeVenv });
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
	const torchConstraintFile = constraintPath(runtimeVenv);
	fs.mkdirSync(runtimeVenv, { recursive: true });
	fs.writeFileSync(torchConstraintFile, constraintText);
	if (spec.packages.length) {
		emit('stdout', `Installing ${profile.label} packages with CUDA PyTorch pinned at ${String(firstProbe.torch && firstProbe.torch.version || 'installed')}.\n`);
		const packages = await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--progress-bar', 'off', '--constraint', torchConstraintFile, ...spec.packages], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (packages.error || packages.status !== 0) return setupFailure('local_upscale_packages_failed', `Could not install ${spec.engine} Python packages.`, packages, { python: venvPython, python_version: pythonVersion, constraint: torchConstraintFile });
	}
	const legacyKey = profile.engine === 'swinir' ? 'swinir' : (profile.engine === 'realesrgan' ? 'realesrgan' : '');
	const savedRecord = config.model_records && config.model_records[profile.id] || {};
	const root = (legacyKey && config[`${legacyKey}_root`]) || savedRecord.root || path.join(security.stateDir, 'upscale', profile.install_key);
	const pinned = await ensurePinnedCheckout(run, git, root, spec, emit);
	if (pinned) return pinned;
	// Real-ESRGAN's checkout generates realesrgan/version.py during package
	// installation.  Cloning alone leaves the official inference script unable
	// to import its own package, even when the pinned weight is present.
	if (profile.engine === 'realesrgan') {
		const editable = await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-deps', '-e', root], { cwd: root, timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (editable.error || editable.status !== 0) return setupFailure('local_upscale_realesrgan_package_failed', 'Could not install the official Real-ESRGAN checkout into the local upscale environment.', editable, { python: venvPython, root });
	}
	const afterPackages = await upscaleEvaluateCudaTorch(run, venvPython, emit, pythonVersion);
	if (!afterPackages.success) return afterPackages;
	if (profile.operator_weight_required || spec.operator_weight_required) {
		const saved = persist({ ...config, model_records: { ...(config.model_records || {}), [profile.id]: { root, model_path: cleanPath(savedRecord.model_path), weight_sha256: cleanPath(savedRecord.weight_sha256).toLowerCase() } } });
		return { success: false, category: 'configuration', code: 'local_upscale_operator_weight_required', message: 'DRCT ×2 runtime and checkout are pinned, but no official ×2 checkpoint is published. Provide an operator-verified local weight and SHA-256 through the model-record environment variables before jobs can run.', settings: saved, details: { python: venvPython, log: collectedLog() } };
	}
	const modelPath = (legacyKey && config[`${legacyKey}_model_path`]) || savedRecord.model_path || path.join(security.stateDir, 'upscale', 'weights', spec.weight_name);
	const expected = String(spec.weight_sha256 || '').toLowerCase();
	const expectedBytes = Number(spec.weight_bytes || 0);
	const existingChecksum = fs.existsSync(modelPath) ? sha256File(modelPath) : '';
	const existingBytes = fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0;
	if (!existingChecksum || !expected || existingChecksum !== expected || (expectedBytes && existingBytes !== expectedBytes)) {
		emit('stdout', `Downloading ${spec.weight_name}\n`);
		try { await download(spec.weight_url, modelPath); }
		catch (error) { return setupFailure('local_upscale_weight_download_failed', error.message || 'The official model weight could not be downloaded.'); }
	}
	const checksum = sha256File(modelPath);
	const bytes = fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0;
	if (!/^[a-f0-9]{64}$/.test(checksum)) return setupFailure('local_upscale_weight_invalid', 'The downloaded model weight could not be checksummed.');
	if (!expected || checksum !== expected || (expectedBytes && bytes !== expectedBytes)) return setupFailure('local_upscale_checksum_mismatch', 'The downloaded ×2 weight did not match the pinned SHA-256 and byte size.');
	const saved = persist({ ...config,
		...(legacyKey ? { [`${legacyKey}_root`]: root, [`${legacyKey}_model_path`]: modelPath, [`${legacyKey}_weight_sha256`]: checksum } : {}),
		model_records: { ...(config.model_records || {}), [profile.id]: { root, model_path: modelPath, weight_sha256: checksum } },
	});
	return { success: true, engine: profile.engine, settings: saved, model: { id: profile.id, label: profile.label, state: 'installed', manifest_valid: true, checkout_valid: true, upscale_capabilities: publicUpscaleCapabilities(profile, { state: 'installed', installed: true, manifest_valid: true, checkout_valid: true }) }, details: { python: venvPython, python_version: pythonVersion, index_url: DEFAULT_TORCH_INDEX, log: collectedLog(), torch: afterPackages.torch } };
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

function nativeContractValid(model, payload = {}) {
	const outputPrint = payload.output_print && typeof payload.output_print === 'object' ? payload.output_print : {};
	const cropPixels = payload.crop_pixels && typeof payload.crop_pixels === 'object' ? payload.crop_pixels : {};
	const targetPrint = payload.target_print && typeof payload.target_print === 'object' ? payload.target_print : {};
	const scale = Number(model && model.native_scale);
	return !!model && Number(payload.scale) === scale && payload.output_policy === model.output_policy
		&& Number.isInteger(Number(outputPrint.width)) && Number.isInteger(Number(outputPrint.height))
		&& Number(cropPixels.width) > 0 && Number(cropPixels.height) > 0 && Number(targetPrint.width) > 0 && Number(targetPrint.height) > 0
		&& Number(outputPrint.width) >= Number(targetPrint.width) && Number(outputPrint.height) >= Number(targetPrint.height)
		&& Number(outputPrint.width) === Number(cropPixels.width) * scale && Number(outputPrint.height) === Number(cropPixels.height) * scale;
}

function createLocalUpscaleDriver(options = {}) {
	const env = options.env || process.env;
	const manifests = options.manifests || INSTALL;
	const runner = options.runnerPath || runnerPath('upscale-runner.py');
	let snapshot = { id: 'local-upscale', label: 'Local CUDA Upscale', kind: 'local-runtime', ready: false, state: 'checking', diagnostic: 'Checking local CUDA upscale readiness.', gpu: gpuStatus(), models: [] };
	function inspect() {
		const gpu = gpuStatus();
		const models = Object.keys(MODELS).map((id) => modelConfig(id, env, manifests));
		const runtimes = {};
		for (const runtimeGroup of ['basicsr-cuda', 'apisr-cuda']) {
			const profile = Object.values(MODELS).find((candidate) => candidate.runtime_group === runtimeGroup);
			const python = pythonCommand(env, profile);
			const torch = probeTorchStatus(python);
			runtimes[runtimeGroup] = { python: python ? '<detected>' : '', torch: { available: torch.ok, state: torch.state, version: torch.version || '' } };
		}
		const runnersReady = fs.existsSync(runner);
		const ready = runnersReady && gpu.available && models.some((model) => model.manifest_valid && model.checkout_valid && runtimes[model.runtime_group] && runtimes[model.runtime_group].torch.available);
		const torch = runtimes['basicsr-cuda'].torch;
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
			python: runtimes['basicsr-cuda'].python,
			gpu,
			torch,
			runtimes,
			models: models.map(publicModelState),
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
		capabilities: () => ({ ...snapshot, job_types: ['upscale'], upscale_capabilities_version: UPSCALE_CAPABILITIES_VERSION, features: { local_upscale: true, binary_transfer: true, cuda_only: true, cpu_fallback: false, cancellation: true, max_gpu_jobs: 1, web_ui_setup: true, native_x4: true } }),
		models: () => Object.keys(MODELS).map((id) => { const profile = MODELS[id]; const current = snapshot.models.find((model) => model.id === id); const runtime = snapshot.runtimes && snapshot.runtimes[profile.runtime_group]; return { id, type: 'image', backend: 'local-upscale', ready: !!current && current.manifest_valid && current.checkout_valid && !!snapshot.gpu.available && !!(runtime && runtime.torch && runtime.torch.available), job_types: ['upscale'], label: profile.label, upscale_capabilities: publicUpscaleCapabilities(profile, current) }; }),
		refresh: async () => inspect(),
		async upscale(payload = {}, session = {}) {
			const state = inspect();
			const model = modelConfig(payload.model, env, manifests);
			const runtime = model && state.runtimes && state.runtimes[model.runtime_group];
			if (!model || !model.manifest_valid || !model.checkout_valid || !state.gpu.available || !(runtime && runtime.torch && runtime.torch.available)) return { success: false, category: 'configuration', code: 'local_upscale_not_ready', message: 'Pinned model, pinned checkout, or CUDA readiness is unavailable. CPU fallback is disabled.', details: { state: model ? model.state : 'unknown_model', gpu: state.gpu.state, torch: runtime && runtime.torch && runtime.torch.state } };
			const source = Buffer.isBuffer(payload.source_bytes) ? payload.source_bytes : null;
			if (!source || !source.length || source.length > MAX_BYTES || !['image/png', 'image/jpeg', 'image/webp'].includes(String(payload.source_mime_type || '').toLowerCase())) return { success: false, category: 'validation', code: 'local_upscale_source_invalid', message: 'The local upscale source must be a bounded PNG, JPEG, or WebP binary.' };
			const outputPrint = payload.output_print && typeof payload.output_print === 'object' ? payload.output_print : {};
			const cropPixels = payload.crop_pixels && typeof payload.crop_pixels === 'object' ? payload.crop_pixels : {};
			const scale = Number(model.native_scale);
			if (!nativeContractValid(model, payload)) return { success: false, category: 'validation', code: 'local_upscale_contract_invalid', message: `The signed local-upscale request must retain the approved native ×${scale} output.` };
			const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-upscale-'));
			const sourcePath = path.join(workdir, 'source'); const outputPath = path.join(workdir, 'result.png'); const jobPath = path.join(workdir, 'job.json');
			try {
				fs.writeFileSync(sourcePath, source);
				fs.writeFileSync(jobPath, JSON.stringify({ model, source_path: sourcePath, output_path: outputPath, source_mime_type: payload.source_mime_type, crop_pixels: cropPixels, target_print: payload.target_print, output_print: outputPrint, output_policy: payload.output_policy, scale, cuda_device: 0, tile: Number(env.AI_MODEL_RELAY_UPSCALE_TILE || model.preferred_tile), precision: String(env.AI_MODEL_RELAY_UPSCALE_PRECISION || 'fp16'), output_max_bytes: Number(model.max_output_bytes || MAX_BYTES), timeout_seconds: Math.max(1, Math.ceil(Number(env.AI_MODEL_RELAY_UPSCALE_TIMEOUT_MS || 1800000) / 1000)) }));
				const python = pythonCommand(env, model);
				const result = await new Promise((resolve) => {
					const stdoutCollector = createBoundedCollector({ maxChars: Number(process.env.AI_MODEL_RELAY_UPSCALE_OUTPUT_MAX_CHARS || 1024 * 1024) });
					const stderrCollector = createBoundedCollector({ maxChars: Number(process.env.AI_MODEL_RELAY_UPSCALE_OUTPUT_MAX_CHARS || 1024 * 1024) });
					let settled = false; let timeout = null; let stopReason = ''; let removeAbort = () => {};
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
					child.stdout.on('data', (chunk) => { stdoutCollector.append(String(chunk)); session.appendSessionOutput && session.appendSessionOutput('stdout', String(chunk)); });
					child.stderr.on('data', (chunk) => { stderrCollector.append(String(chunk)); session.appendSessionOutput && session.appendSessionOutput('stderr', String(chunk)); });
					child.on('error', (error) => settle({ error, stdout: stdoutCollector.value(), stderr: stderrCollector.value() }));
					child.on('close', (status) => {
						const stdout = stdoutCollector.value();
						const stderr = stderrCollector.value();
						if (stopReason === 'cancelled') settle({ cancelled: true, stdout, stderr });
						else if (stopReason === 'timeout') settle({ timeout: true, stdout, stderr });
						else settle({ status, stdout, stderr });
					});
				});
				if (result.cancelled) return { success: false, category: 'cancelled', code: 'local_upscale_cancelled', message: 'The local CUDA upscale was cancelled; source bytes were preserved.' };
				if (result.timeout) return { success: false, category: 'timeout', code: 'local_upscale_timeout', message: 'The local CUDA upscale job timed out; source bytes were preserved.', details: { stderr: result.stderr } };
				if (result.error || result.status !== 0) return { success: false, category: 'configuration', code: 'local_upscale_failed', message: 'The local CUDA upscale runner did not complete; source bytes were preserved.', details: { stderr: String(result.stderr || '').slice(-4000) } };
				const metadata = JSON.parse(String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
				if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1 || fs.statSync(outputPath).size > Number(model.max_output_bytes || MAX_BYTES)) return { success: false, category: 'validation', code: 'local_upscale_output_missing', message: 'The local CUDA runner did not produce a bounded PNG result.' };
				const outputChecksum = sha256File(outputPath);
				const output = { ...metadata.output, path: outputPath, checksum: outputChecksum, mime_type: 'image/png', byte_size: fs.statSync(outputPath).size };
				if (!metadata.success || !outputChecksum || output.width !== Number(outputPrint.width) || output.height !== Number(outputPrint.height) || !metadata.provenance || metadata.provenance.downsampler !== 'none' || Number(metadata.provenance.native_scale) !== scale) return { success: false, category: 'validation', code: 'local_upscale_manifest_invalid', message: `The local CUDA output did not retain the signed native ×${scale} dimensions.` };
				const value = safeOutput({ output, provenance: metadata.provenance, local_job_id: session.jobId }, model.id);
				return value;
			} catch (error) { return { success: false, category: 'configuration', code: 'local_upscale_failed', message: 'The local CUDA upscale runner failed; source bytes were preserved.' }; }
			finally { setTimeout(() => { try { fs.rmSync(workdir, { recursive: true, force: true }); } catch (error) {} }, 30000).unref?.(); }
		},
	};
}

module.exports = { MAX_BYTES, MAX_4X_OUTPUT_BYTES, MODELS, INSTALL, CHECKOUT_MARKER, createLocalUpscaleDriver, gpuStatus, modelConfig, nativeContractValid, probeTorchStatus, publicSettings, runnerPath, saveSettings, settings, setup };
