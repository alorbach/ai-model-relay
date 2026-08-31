'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CHECKOUT_MARKER, INSTALL, MODELS, createLocalUpscaleDriver, modelConfig } = require('../src/local-upscale');

(async () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-local-upscale-test-'));
	const weight = path.join(directory, 'swinir-x2.pth');
	fs.writeFileSync(weight, Buffer.from('test-pinned-weight'));
	fs.writeFileSync(path.join(directory, CHECKOUT_MARKER), `${INSTALL.swinir.commit}\n`);
	const checksum = crypto.createHash('sha256').update(fs.readFileSync(weight)).digest('hex');
	const testSwinirManifest = { swinir: { ...INSTALL.swinir, weight_sha256: checksum, weight_bytes: fs.statSync(weight).size } };
	const cudaProbe = { status: 0, stdout: '{"available":true,"version":"2.8.0+cu128","cuda_version":"12.8","device_count":1}\n', stderr: '' };
	function mockSetupCommands(options = {}) {
		const commit = options.commit || INSTALL.swinir.commit;
		const torchByIndex = options.torchByIndex || [];
		let cudaCount = 0;
		return async (command, args) => {
			if (args[0] === '-m' && args[1] === 'venv' && options.venv) {
				fs.mkdirSync(path.join(options.venv, process.platform === 'win32' ? 'Scripts' : 'bin'), { recursive: true });
				fs.writeFileSync(path.join(options.venv, process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python'), '');
				return { status: 0, stdout: '', stderr: '' };
			}
			if (args[0] === 'clone' && options.checkout) {
				fs.mkdirSync(options.checkout, { recursive: true });
				fs.writeFileSync(path.join(options.checkout, options.script || 'main_test_swinir.py'), '');
				return { status: 0, stdout: '', stderr: '' };
			}
			if (args[0] === '-c') {
				cudaCount += 1;
				if (options.onCudaProbe) return options.onCudaProbe(cudaCount, args);
				if (torchByIndex.length) return torchByIndex[Math.min(cudaCount - 1, torchByIndex.length - 1)];
				return cudaProbe;
			}
			if (args[1] === 'pip' && args.includes('freeze')) {
				return { status: 0, stdout: 'torch==2.8.0+cu128\ntorchvision==0.23.0+cu128\n', stderr: '' };
			}
			if (args.includes('--constraint') && options.packageInstalls) options.packageInstalls.push(args.slice());
			if (args[0] === 'rev-parse') return { status: 0, stdout: `${commit}\n`, stderr: '' };
			if (args.includes('torch') && args.includes('torchvision') && options.torchInstall) return options.torchInstall;
			if (args[0] === '-V') return { status: 0, stdout: options.pythonVersion || 'Python 3.10.11\n', stderr: '' };
			return { status: 0, stdout: options.pythonVersion || 'Python 3.10.11\n', stderr: '' };
		};
	}
	try {
		const env = {
			AI_MODEL_RELAY_SWINIR_MODEL_PATH: weight,
			AI_MODEL_RELAY_SWINIR_WEIGHT_SHA256: checksum,
			AI_MODEL_RELAY_SWINIR_ROOT: directory,
			AI_MODEL_RELAY_REALESRGAN_MODEL_PATH: '',
			AI_MODEL_RELAY_REALESRGAN_WEIGHT_SHA256: '',
			AI_MODEL_RELAY_REALESRGAN_ROOT: '',
		};
		const untrusted = modelConfig('model-relay:local-upscale:swinir-classical-x2', env);
		const valid = modelConfig('model-relay:local-upscale:swinir-classical-x2', env, testSwinirManifest);
		const invalid = modelConfig('model-relay:local-upscale:realesrgan-x2plus', env, testSwinirManifest);
		assert.strictEqual(untrusted.manifest_valid, false, 'a saved self-reported checksum must not make an arbitrary weight trusted');
		assert.strictEqual(valid.manifest_valid, true);
		assert.strictEqual(valid.state, 'installed');
		assert.strictEqual(invalid.state, 'not_installed');
		assert.strictEqual(Object.keys(MODELS).length, 2);

		const driver = createLocalUpscaleDriver({ env, manifests: testSwinirManifest, runnerPath: __filename });
		const capability = driver.capabilities();
		assert.ok(capability.models.some((model) => model.id === valid.id && model.manifest_valid), 'a freshly constructed driver must expose an already installed pinned model');
		assert.strictEqual(capability.features.cuda_only, true);
		assert.strictEqual(capability.features.cpu_fallback, false);
		assert.strictEqual(capability.features.binary_transfer, true);
		assert.strictEqual(capability.features.cancellation, true);
		assert.strictEqual(capability.features.max_gpu_jobs, 1);
		assert.ok(capability.models.some((model) => model.id === valid.id && model.manifest_valid));
		assert.ok(!JSON.stringify(capability).includes(weight));
		const runner = fs.readFileSync(path.join(__dirname, '..', 'src', 'upscale-runner.py'), 'utf8');
		assert.ok(runner.includes('"--model_path", str(model["model_path"])'), 'both official runners must receive the checksum-pinned weight path');
		assert.ok(runner.includes("kwargs['weights_only'] = False"), 'the checksum-verified legacy SwinIR checkpoint must use the explicit trusted compatibility loader with current PyTorch');
		assert.ok(runner.includes('"cuda_runtime_invalid"'), 'an incomplete PyTorch import must report a safe CUDA-runtime diagnostic instead of raising an unhandled attribute error');
		assert.ok(runner.includes('"--gpu-id", str(int(job.get("cuda_device", 0)))'), 'Real-ESRGAN must receive the selected CUDA device');
		assert.ok(runner.includes('int(job.get("timeout_seconds", 1800))'), 'the CUDA subprocess must use the Node-configured timeout');
		const driverSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'local-upscale.js'), 'utf8');
		assert.ok(driverSource.includes('safeOutput({ output, provenance: metadata.provenance, local_job_id: session.jobId }, model.id)'), 'completion must report the requested relay model id');
		assert.ok(driverSource.includes("stopReason === 'cancelled'"), 'cancel must wait for the CUDA process to exit before releasing the GPU slot');
		assert.ok(driverSource.includes("spawn('taskkill'"), 'Windows cancel must kill the CUDA process tree');
		assert.ok(!driverSource.includes('setTimeout(() => settle({ [reason]: true'), 'cancel must not free the GPU slot before the runner closes');
		assert.ok(driverSource.includes("web_ui_setup: true"), 'status-page setup is the operator install path');
		assert.ok(!driverSource.includes('--extra-index-url'), 'CUDA torch setup must not add PyPI as an extra index');
		assert.ok(driverSource.includes("'--constraint'"), 'follow-on pip installs must pin CUDA torch instead of skipping package dependencies');
		assert.ok(driverSource.includes("'--no-deps', '-e'"), 'the Real-ESRGAN editable checkout must stay --no-deps so its setup.py cannot replace CUDA torch');
		assert.ok(INSTALL.swinir.commit.length === 40 && INSTALL.realesrgan.commit.length === 40, 'official checkouts must be pinned to a git commit');
		assert.ok(runner.includes('checkout_mismatch'), 'jobs must refuse an unpinned official checkout before the pickle compatibility loader runs');

		const checkout = path.join(directory, 'swinir');
		const venv = path.join(directory, 'venv');
		const saved = {};
		const installedWeight = Buffer.from('ui-installed-weight');
		const installedManifest = { swinir: { ...INSTALL.swinir, weight_sha256: crypto.createHash('sha256').update(installedWeight).digest('hex'), weight_bytes: installedWeight.length } };
		const packageInstalls = [];
		const setupResult = await require('../src/local-upscale').setup({
			engine: 'swinir',
			install: installedManifest,
			pythonCommand: process.execPath,
			gitCommand: 'git',
			settings: { python_path: process.execPath, venv_path: venv, swinir_root: checkout, swinir_model_path: '', swinir_weight_sha256: '', realesrgan_root: path.join(directory, 'realesrgan'), realesrgan_model_path: '', realesrgan_weight_sha256: '' },
			runCommand: mockSetupCommands({ venv, checkout, packageInstalls }),
			downloadFile: async (url, dest) => { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, installedWeight); return dest; },
			saveSettings: (next) => Object.assign(saved, next),
		});
		assert.strictEqual(setupResult.success, true);
		assert.strictEqual(setupResult.model.state, 'installed');
		assert.ok(saved.swinir_weight_sha256);
		assert.ok(fs.existsSync(saved.swinir_model_path));
		assert.ok(String(setupResult.details && setupResult.details.log || '').includes('Installing CUDA PyTorch'));
		assert.strictEqual(fs.readFileSync(path.join(checkout, CHECKOUT_MARKER), 'utf8').trim(), INSTALL.swinir.commit);
		assert.ok(fs.existsSync(path.join(venv, 'cuda-torch-constraint.txt')));
		assert.ok(packageInstalls.some((args) => args.includes('--constraint') && args.includes('timm') && !args.includes('--no-deps')));

		const failVenv = path.join(directory, 'fail-venv');
		const failed = await require('../src/local-upscale').setup({
			engine: 'swinir',
			pythonCommand: process.execPath,
			gitCommand: 'git',
			settings: { python_path: process.execPath, venv_path: failVenv, swinir_root: path.join(directory, 'fail-swinir'), swinir_model_path: '', swinir_weight_sha256: '', realesrgan_root: path.join(directory, 'fail-realesrgan'), realesrgan_model_path: '', realesrgan_weight_sha256: '' },
			runCommand: mockSetupCommands({
				venv: failVenv,
				pythonVersion: 'Python 3.13.5\n',
				torchInstall: { status: 1, stdout: 'ERROR: Could not find a version that satisfies the requirement torch', stderr: '', error: null },
			}),
			downloadFile: async () => '',
			saveSettings: () => ({}),
		});
		assert.strictEqual(failed.success, false);
		assert.strictEqual(failed.code, 'local_upscale_torch_failed');
		assert.ok(String(failed.details.log || failed.details.stdout).includes('Could not find a version'));
		assert.ok(String(failed.details.python_version).includes('3.13'));
		assert.ok(failed.details.python);
		assert.ok(failed.details.index_url);

		const cpuVenv = path.join(directory, 'cpu-venv');
		const cpuTorch = await require('../src/local-upscale').setup({
			engine: 'swinir',
			pythonCommand: process.execPath,
			gitCommand: 'git',
			settings: { python_path: process.execPath, venv_path: cpuVenv, swinir_root: path.join(directory, 'cpu-swinir'), swinir_model_path: '', swinir_weight_sha256: '', realesrgan_root: path.join(directory, 'cpu-realesrgan'), realesrgan_model_path: '', realesrgan_weight_sha256: '' },
			runCommand: mockSetupCommands({
				venv: cpuVenv,
				onCudaProbe: () => ({ status: 1, stdout: '{"available":false,"version":"2.13.0+cpu","cuda_version":null,"device_count":0}\n', stderr: '' }),
			}),
			downloadFile: async () => '',
			saveSettings: () => ({}),
		});
		assert.strictEqual(cpuTorch.success, false);
		assert.strictEqual(cpuTorch.code, 'local_upscale_cpu_torch');
		assert.ok(String(cpuTorch.message).includes('2.13.0+cpu'));

		const replacedVenv = path.join(directory, 'replaced-venv');
		const replacedCheckout = path.join(directory, 'replaced-swinir');
		const replacedAfterPackages = await require('../src/local-upscale').setup({
			engine: 'swinir',
			pythonCommand: process.execPath,
			gitCommand: 'git',
			settings: { python_path: process.execPath, venv_path: replacedVenv, swinir_root: replacedCheckout, swinir_model_path: '', swinir_weight_sha256: '', realesrgan_root: path.join(directory, 'replaced-realesrgan'), realesrgan_model_path: '', realesrgan_weight_sha256: '' },
			runCommand: mockSetupCommands({
				venv: replacedVenv,
				checkout: replacedCheckout,
				onCudaProbe: (index) => (index === 1
					? cudaProbe
					: { status: 1, stdout: '{"available":false,"version":"2.13.0+cpu","cuda_version":null,"device_count":0}\n', stderr: '' }),
			}),
			downloadFile: async () => '',
			saveSettings: () => ({}),
		});
		assert.strictEqual(replacedAfterPackages.success, false);
		assert.strictEqual(replacedAfterPackages.code, 'local_upscale_cpu_torch');

		const junkPath = path.join(directory, 'partial-weight.pth');
		const junkCheckout = path.join(directory, 'junk-swinir');
		const junkVenv = path.join(directory, 'junk-venv');
		fs.mkdirSync(junkCheckout, { recursive: true });
		fs.writeFileSync(path.join(junkCheckout, 'main_test_swinir.py'), '');
		fs.writeFileSync(junkPath, Buffer.from('partial-or-wrong-weight'));
		const junkSaved = {};
		let downloadedJunkPath = '';
		const replacementWeight = Buffer.from('official-x2-weight');
		const replacementManifest = { swinir: { ...INSTALL.swinir, weight_sha256: crypto.createHash('sha256').update(replacementWeight).digest('hex'), weight_bytes: replacementWeight.length } };
		const replaced = await require('../src/local-upscale').setup({
			engine: 'swinir',
			install: replacementManifest,
			pythonCommand: process.execPath,
			gitCommand: 'git',
			settings: { python_path: process.execPath, venv_path: junkVenv, swinir_root: junkCheckout, swinir_model_path: junkPath, swinir_weight_sha256: '', realesrgan_root: path.join(directory, 'junk-realesrgan'), realesrgan_model_path: '', realesrgan_weight_sha256: '' },
			runCommand: mockSetupCommands({ venv: junkVenv, checkout: junkCheckout }),
			downloadFile: async (url, dest) => {
				downloadedJunkPath = dest;
				fs.mkdirSync(path.dirname(dest), { recursive: true });
				fs.writeFileSync(dest, replacementWeight);
				return dest;
			},
			saveSettings: (next) => Object.assign(junkSaved, next),
		});
		assert.strictEqual(replaced.success, true);
		assert.strictEqual(downloadedJunkPath, junkPath);
		assert.strictEqual(fs.readFileSync(junkPath, 'utf8'), 'official-x2-weight');
		assert.strictEqual(junkSaved.swinir_weight_sha256, crypto.createHash('sha256').update(replacementWeight).digest('hex'));
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}

	console.log('local upscale tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
