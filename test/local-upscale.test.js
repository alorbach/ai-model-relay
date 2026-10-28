'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { CHECKOUT_MARKER, INSTALL, MODELS, createLocalUpscaleDriver, modelConfig, nativeContractValid, runnerPath } = require('../src/local-upscale');

(async () => {
	const sourceRunner = runnerPath('upscale-runner.py', path.join('D:', 'relay', 'src'));
	assert.strictEqual(sourceRunner, path.join('D:', 'relay', 'src', 'upscale-runner.py'));
	const packagedRunner = runnerPath('upscale-runner.py', path.join('C:', 'Program Files', 'AI Model Relay', 'resources', 'app.asar', 'src'));
	assert.strictEqual(packagedRunner, path.join('C:', 'Program Files', 'AI Model Relay', 'resources', 'app.asar.unpacked', 'src', 'upscale-runner.py'));
	assert.ok(require('../package.json').build.asarUnpack.includes('src/upscale-runner.py'));
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
		assert.strictEqual(Object.keys(MODELS).length, 8);
		const realesrganX4Id = 'model-relay:local-upscale:realesrgan-x4plus';
		const realesrganX2Id = 'model-relay:local-upscale:realesrgan-x2plus';
		const realesrganX4 = MODELS[realesrganX4Id];
		assert.strictEqual(realesrganX4.native_scale, 4);
		assert.strictEqual(realesrganX4.output_policy, 'retain_native_x4');
		assert.strictEqual(realesrganX4.max_output_bytes, 256 * 1024 * 1024);
		assert.strictEqual(INSTALL.realesrgan.weight_name, 'RealESRGAN_x2plus.pth');
		assert.strictEqual(INSTALL.realesrgan_x4.weight_name, 'RealESRGAN_x4plus.pth');
		const x2Weight = path.join(directory, 'RealESRGAN_x2plus.pth');
		const x4Weight = path.join(directory, 'RealESRGAN_x4plus.pth');
		fs.writeFileSync(x2Weight, 'test-x2-weight');
		fs.writeFileSync(x4Weight, 'test-x4-weight');
		const esrganManifest = (key, file) => ({ ...INSTALL[key], weight_sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), weight_bytes: fs.statSync(file).size });
		const esrganManifests = { realesrgan: esrganManifest('realesrgan', x2Weight), realesrgan_x4: esrganManifest('realesrgan_x4', x4Weight) };
		const esrganRoot = path.join(directory, 'esrgan');
		fs.mkdirSync(esrganRoot);
		fs.writeFileSync(path.join(esrganRoot, CHECKOUT_MARKER), INSTALL.realesrgan.commit);
		const esrganEnv = { AI_MODEL_RELAY_REALESRGAN_MODEL_PATH: x2Weight, AI_MODEL_RELAY_REALESRGAN_ROOT: esrganRoot };
		assert.strictEqual(modelConfig(realesrganX2Id, esrganEnv, esrganManifests).state, 'installed');
		assert.strictEqual(modelConfig(realesrganX4Id, esrganEnv, esrganManifests).state, 'not_installed', 'x4 must never reuse the legacy x2 model path');
		Object.assign(esrganEnv, { AI_MODEL_RELAY_UPSCALE_REALESRGAN_X4_MODEL_PATH: x4Weight, AI_MODEL_RELAY_UPSCALE_REALESRGAN_X4_ROOT: esrganRoot });
		assert.strictEqual(modelConfig(realesrganX4Id, esrganEnv, esrganManifests).state, 'installed');
		assert.strictEqual(modelConfig(realesrganX2Id, esrganEnv, esrganManifests).model_path, x2Weight);
		assert.strictEqual(modelConfig(realesrganX4Id, { ...esrganEnv, AI_MODEL_RELAY_UPSCALE_REALESRGAN_X4_MODEL_PATH: x2Weight }, esrganManifests).state, 'checksum_mismatch', 'x2 weights cannot satisfy x4 even with the same checkout');
		assert.strictEqual(modelConfig(realesrganX2Id, { ...esrganEnv, AI_MODEL_RELAY_REALESRGAN_MODEL_PATH: '' }, esrganManifests).state, 'not_installed', 'installing x4 must not make x2 installed');
		const x4 = MODELS['model-relay:local-upscale:drct-classical-x4'];
		const apisr = MODELS['model-relay:local-upscale:apisr-anime-x2'];
		assert.strictEqual(x4.native_scale, 4);
		assert.strictEqual(x4.output_policy, 'retain_native_x4');
		assert.strictEqual(x4.max_output_bytes, 256 * 1024 * 1024);
		assert.strictEqual(apisr.experimental, true);
		assert.strictEqual(apisr.academic_only, true);
		assert.strictEqual(apisr.license.spdx, 'GPL-3.0-only');
		{
			const security = require('../src/security');
			const originalReadState = security.readState;
			const originalWriteState = security.writeState;
			const originalUpdateState = security.updateState;
			let state = {};
			security.readState = () => JSON.parse(JSON.stringify(state));
			security.writeState = (next) => { state = JSON.parse(JSON.stringify(next)); };
			security.updateState = (mutator) => {
				const next = mutator(JSON.parse(JSON.stringify(state)));
				state = JSON.parse(JSON.stringify(next));
				return state;
			};
			try {
				const { saveSettings } = require('../src/local-upscale');
				const savedUpscale = saveSettings({ timeout_ms: 90000, tile: 256, precision: 'fp32', apisr_venv_path: 'D:\\apisr-venv' });
				assert.strictEqual(savedUpscale.timeout_ms, 90000);
				assert.strictEqual(savedUpscale.tile, 256);
				assert.strictEqual(savedUpscale.precision, 'fp32');
				assert.strictEqual(savedUpscale.apisr_venv_path, 'D:\\apisr-venv');
			} finally {
				security.readState = originalReadState;
				security.writeState = originalWriteState;
				security.updateState = originalUpdateState;
			}
		}
		const native4x = { scale: 4, output_policy: 'retain_native_x4', crop_pixels: { width: 320, height: 180 }, target_print: { width: 1000, height: 700 }, output_print: { width: 1280, height: 720 } };
		assert.strictEqual(nativeContractValid(x4, native4x), true, 'native x4 must retain exactly four times the approved crop');
		assert.strictEqual(nativeContractValid(x4, { ...native4x, scale: 2 }), false, 'x4 must reject a declared x2 scale');
		assert.strictEqual(nativeContractValid(x4, { ...native4x, output_policy: 'retain_native_x2' }), false, 'x4 must reject x2 policy/downsample requests');
		assert.strictEqual(nativeContractValid(x4, { ...native4x, output_print: { width: 640, height: 360 } }), false, 'x4 must reject non-native output dimensions');
		assert.strictEqual(nativeContractValid(realesrganX4, native4x), true);
		assert.strictEqual(nativeContractValid(realesrganX4, { ...native4x, scale: 2 }), false);
		assert.strictEqual(nativeContractValid(realesrganX4, { ...native4x, output_policy: 'retain_native_x2' }), false);
		assert.strictEqual(nativeContractValid(realesrganX4, { ...native4x, output_print: { width: 640, height: 360 } }), false);

		const driver = createLocalUpscaleDriver({ env, manifests: testSwinirManifest, runnerPath: __filename });
		const capability = driver.capabilities();
		assert.ok(capability.models.some((model) => model.id === valid.id && model.manifest_valid), 'a freshly constructed driver must expose an already installed pinned model');
		assert.strictEqual(capability.features.cuda_only, true);
		assert.strictEqual(capability.features.cpu_fallback, false);
		assert.strictEqual(capability.features.binary_transfer, true);
		assert.strictEqual(capability.features.cancellation, true);
		assert.strictEqual(capability.features.max_gpu_jobs, 1);
		assert.ok(capability.models.some((model) => model.id === valid.id && model.manifest_valid));
		const publicX4 = capability.models.find((model) => model.id === x4.id);
		assert.strictEqual(publicX4.upscale_capabilities.contract_version, 1);
		assert.strictEqual(publicX4.upscale_capabilities.native_scale, 4);
		assert.strictEqual(publicX4.upscale_capabilities.output_policy, 'retain_native_x4');
		const recommendedX4 = capability.models.filter((model) => model.upscale_capabilities.native_scale === 4 && model.upscale_capabilities.default_for_scale);
		assert.deepStrictEqual(recommendedX4.map((model) => model.id), [realesrganX4Id]);
		assert.strictEqual(recommendedX4[0].upscale_capabilities.output_max_bytes, 256 * 1024 * 1024);
		assert.strictEqual(capability.models.find((model) => model.id === realesrganX2Id).upscale_capabilities.native_scale, 2);
		assert.ok(!JSON.stringify(publicX4).includes('weight_sha256'));
		assert.ok(!JSON.stringify(capability).includes(weight));
		const runner = fs.readFileSync(path.join(__dirname, '..', 'src', 'upscale-runner.py'), 'utf8');
		assert.ok(runner.includes('"--model_path", str(model["model_path"])'), 'both official runners must receive the checksum-pinned weight path');
		assert.ok(runner.includes("kwargs['weights_only'] = False"), 'the checksum-verified legacy SwinIR checkpoint must use the explicit trusted compatibility loader with current PyTorch');
		assert.ok(runner.includes('"cuda_runtime_invalid"'), 'an incomplete PyTorch import must report a safe CUDA-runtime diagnostic instead of raising an unhandled attribute error');
		assert.ok(runner.includes('"--gpu-id", str(int(job.get("cuda_device", 0)))'), 'Real-ESRGAN must receive the selected CUDA device');
		assert.ok(runner.includes('int(job.get("timeout_seconds", 1800))'), 'the CUDA subprocess must use the Node-configured timeout');
		assert.ok(runner.includes('native_policy = "retain_native_x" + str(native_scale)'), 'the runner must require the retained native output contract for its declared scale');
		assert.ok(runner.includes('width != (right - left) * native_scale'), 'the runner must reject an engine result that is not its native dimensions');
		assert.ok(runner.includes('("hat-s", "drct", "apisr")'), 'the runner must expose verified adapters for HAT-S, DRCT, and APISR');
		assert.ok(runner.includes('"downsampler": "none"'), 'the runner must record that no post-upscale downsampling occurred');
		const driverSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'local-upscale.js'), 'utf8');
		const cudaTorchSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'cuda-torch-venv.js'), 'utf8');
		assert.ok(driverSource.includes('safeOutput({ output, provenance: metadata.provenance, local_job_id: session.jobId }, model.id)'), 'completion must report the requested relay model id');
		assert.ok(driverSource.includes("stopReason === 'cancelled'"), 'cancel must wait for the CUDA process to exit before releasing the GPU slot');
		assert.ok(cudaTorchSource.includes("spawn('taskkill'") || driverSource.includes("spawn('taskkill'"), 'Windows cancel must kill the CUDA process tree');
		assert.ok(!driverSource.includes('setTimeout(() => settle({ [reason]: true'), 'cancel must not free the GPU slot before the runner closes');
		assert.ok(driverSource.includes("web_ui_setup: true"), 'status-page setup is the operator install path');
		assert.ok(!driverSource.includes('--extra-index-url'), 'CUDA torch setup must not add PyPI as an extra index');
		assert.ok(driverSource.includes("'--constraint'"), 'follow-on pip installs must pin CUDA torch instead of skipping package dependencies');
		assert.ok(driverSource.includes("'--no-deps', '-e'"), 'the Real-ESRGAN editable checkout must stay --no-deps so its setup.py cannot replace CUDA torch');
		assert.ok(driverSource.includes('nativeContractValid(model, payload)'), 'the relay must reject a local-upscale request that does not retain the selected native output policy and scale');
		assert.ok(driverSource.includes('model.max_output_bytes || MAX_BYTES'), 'the relay must use the separate bounded output ceiling for native x4 models');
		assert.ok(driverSource.includes("metadata.provenance.downsampler !== 'none'"), 'the relay must reject a result whose provenance reports post-upscale downsampling');
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
		const x4Checkout = path.join(directory, 'setup-realesrgan-x4');
		const x4InstallPath = path.join(directory, 'setup-RealESRGAN_x4plus.pth');
		let x4Saved;
		const x4Setup = await require('../src/local-upscale').setup({
			model: realesrganX4Id,
			install: esrganManifests,
			pythonCommand: process.execPath,
			gitCommand: 'git',
			settings: { venv_path: venv, realesrgan_root: esrganRoot, realesrgan_model_path: x2Weight, model_records: { [realesrganX4Id]: { root: x4Checkout, model_path: x4InstallPath }, [realesrganX2Id]: { root: esrganRoot, model_path: x2Weight } } },
			runCommand: mockSetupCommands({ checkout: x4Checkout, commit: INSTALL.realesrgan_x4.commit, script: 'inference_realesrgan.py' }),
			downloadFile: async (url, dest) => {
				assert.strictEqual(url, INSTALL.realesrgan_x4.weight_url);
				assert.strictEqual(dest, x4InstallPath);
				fs.writeFileSync(dest, fs.readFileSync(x4Weight));
			},
			saveSettings: (next) => { x4Saved = next; return next; },
		});
		assert.strictEqual(x4Setup.success, true);
		assert.strictEqual(x4Setup.model.id, realesrganX4Id);
		assert.strictEqual(x4Saved.realesrgan_model_path, x2Weight, 'x4 install must preserve legacy x2 configuration');
		assert.strictEqual(x4Saved.model_records[realesrganX2Id].model_path, x2Weight);
		assert.strictEqual(x4Saved.model_records[realesrganX4Id].model_path, x4InstallPath);
		assert.strictEqual(fs.readFileSync(x2Weight, 'utf8'), 'test-x2-weight');
		assert.strictEqual(fs.readFileSync(path.join(x4Checkout, CHECKOUT_MARKER), 'utf8').trim(), INSTALL.realesrgan_x4.commit);

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

	// Runner tests use only the Python standard library; no GPU, torch or Pillow is needed.
	const pythonCommands = process.env.AI_MODEL_RELAY_TEST_PYTHON
		? [process.env.AI_MODEL_RELAY_TEST_PYTHON]
		: (process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']);
	let runnerTestsExecuted = false;
	for (const python of pythonCommands) {
		const result = spawnSync(python, ['-B', path.join(__dirname, 'upscale-runner.test.py')], { encoding: 'utf8', timeout: 30000, windowsHide: true });
		if (result.error && result.error.code === 'ENOENT') continue;
		assert.ifError(result.error);
		assert.strictEqual(result.status, 0, `Python upscale runner tests failed: ${result.stdout}\n${result.stderr}`);
		runnerTestsExecuted = true;
		break;
	}
	if (!runnerTestsExecuted) {
		assert.ok(!process.env.CI && !process.env.AI_MODEL_RELAY_TEST_PYTHON, 'Python is required for upscale runner tests in CI; set AI_MODEL_RELAY_TEST_PYTHON to its executable');
		console.log('SKIP Python upscale runner tests: Python is unavailable (set AI_MODEL_RELAY_TEST_PYTHON).');
	}
	console.log('local upscale tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
