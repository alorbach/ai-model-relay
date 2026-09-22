'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

const {
	MODELS,
	QWEN_IMAGE_TEST_OPTIONS,
	QWEN_IMAGE_CAPABILITIES,
	QWEN_IMAGE_RESOLUTION_CHOICES,
	createLocalImageDriver,
	probeRunnerStatus,
	publicSettings,
	resolveOutputSize,
	runnerPath,
	saveSettings,
	settings,
	setup,
	validateRunnerProbe,
} = require('../src/local-image');

(async () => {
	// --- runnerPath ---
	const sourceRunner = runnerPath('image-qwen-runner.py', path.join('D:', 'relay', 'src'));
	assert.strictEqual(sourceRunner, path.join('D:', 'relay', 'src', 'image-qwen-runner.py'));
	const packagedRunner = runnerPath('image-qwen-runner.py', path.join('C:', 'Program Files', 'AI Model Relay', 'resources', 'app.asar', 'src'));
	assert.strictEqual(packagedRunner, path.join('C:', 'Program Files', 'AI Model Relay', 'resources', 'app.asar.unpacked', 'src', 'image-qwen-runner.py'));
	assert.ok(require('../package.json').build.asarUnpack.includes('src/image-qwen-runner.py'), 'image-qwen-runner.py must be in asarUnpack');

	// --- MODELS ---
	assert.ok(Object.keys(MODELS).length >= 1, 'At least one model must be defined');
	const qwenModel = MODELS['model-relay:local-image:qwen-image-2.1'];
	assert.ok(qwenModel, 'Qwen-Image-2.1 model must exist');
	assert.strictEqual(qwenModel.id, 'model-relay:local-image:qwen-image-2.1');
	assert.ok(Array.isArray(qwenModel.precision) && qwenModel.precision.includes('bf16'), 'Model must list bf16 precision');
	assert.strictEqual(qwenModel.default_precision, 'bf16', 'Default precision must be bf16');
	assert.ok(qwenModel.reference_images_max >= 10, 'Model must support at least 10 reference images');

	// --- QWEN_IMAGE_TEST_OPTIONS ---
	assert.ok(Array.isArray(QWEN_IMAGE_TEST_OPTIONS), 'Test options must be an array');
	const aspectRatioOption = QWEN_IMAGE_TEST_OPTIONS.find((opt) => opt.key === 'aspect_ratio');
	assert.ok(aspectRatioOption, 'aspect_ratio option must exist');
	assert.ok(Array.isArray(aspectRatioOption.choices) && aspectRatioOption.choices.length > 0, 'aspect_ratio must have choices');
	const resolutionOption = QWEN_IMAGE_TEST_OPTIONS.find((opt) => opt.key === 'resolution');
	assert.ok(resolutionOption, 'resolution option must exist');
	assert.ok(resolutionOption.choices.some((c) => c.value === '1024x1024'), 'resolution must include 1024x1024');
	assert.ok(resolutionOption.choices.some((c) => c.value === '2048x2048'), 'resolution must include 2048x2048');
	assert.ok(resolutionOption.choices.some((c) => c.value === '2752x1536'), 'resolution must include native 16:9 2K');
	assert.ok(resolutionOption.choices.some((c) => c.value === '1536x2752'), 'resolution must include native 9:16 2K');
	assert.ok(resolutionOption.choices.length >= 14, 'resolution must list all native 1K/2K presets');
	assert.strictEqual(QWEN_IMAGE_RESOLUTION_CHOICES.length, 14);
	assert.deepStrictEqual(resolveOutputSize({ resolution: '2752x1536' }), { width: 2752, height: 1536 });
	assert.deepStrictEqual(resolveOutputSize({ resolution: '2k', aspect_ratio: '16:9' }), { width: 2752, height: 1536 });
	assert.deepStrictEqual(resolveOutputSize({ resolution: '1024x1024', aspect_ratio: '16:9' }), { width: 1344, height: 768 });
	assert.deepStrictEqual(resolveOutputSize({ resolution: '2048x2048', aspect_ratio: '4:3' }), { width: 2400, height: 1792 });
	assert.deepStrictEqual(resolveOutputSize({ width: 1792, height: 2400 }), { width: 1792, height: 2400 });

	const qualityOption = QWEN_IMAGE_TEST_OPTIONS.find((opt) => opt.key === 'quality');
	assert.ok(qualityOption, 'quality/precision option must exist');
	assert.ok(qualityOption.choices.some((c) => c.value === 'fp8'), 'precision must include fp8');
	assert.ok(qualityOption.choices.some((c) => c.value === 'bf16'), 'precision must include bf16');

	// --- QWEN_IMAGE_CAPABILITIES contract ---
	assert.ok(QWEN_IMAGE_CAPABILITIES && typeof QWEN_IMAGE_CAPABILITIES === 'object', 'Capabilities must be an object');
	assert.strictEqual(QWEN_IMAGE_CAPABILITIES.contract_version, 1);
	assert.ok(QWEN_IMAGE_CAPABILITIES.reference_images === true, 'Must declare reference images support');
	assert.strictEqual(QWEN_IMAGE_CAPABILITIES.reference_images_max, 10);
	assert.ok(Array.isArray(QWEN_IMAGE_CAPABILITIES.supported_output_formats) && QWEN_IMAGE_CAPABILITIES.supported_output_formats.includes('image/png'), 'Must support PNG output');
	assert.strictEqual(QWEN_IMAGE_CAPABILITIES.candidate_count_max, 1);

	// --- runtime probe requires the imports used by actual generation ---
	const readyProbe = { cuda_available: true, diffusers_ready: true, transformers_ready: true, qwen_pipeline_ready: true };
	assert.strictEqual(validateRunnerProbe(readyProbe).ok, true);
	assert.strictEqual(validateRunnerProbe({ ...readyProbe, transformers_ready: false }).state, 'transformers_missing');
	assert.strictEqual(validateRunnerProbe({ ...readyProbe, qwen_pipeline_ready: false }).state, 'diffusers_pipeline_missing');

	// --- settings / saveSettings round-trip (isolated) ---
	const originalSecurity = require('../src/security');
	const tempStateFile = path.join(os.tmpdir(), `relay-local-image-test-state-${Date.now()}.json`);
	const savedReadState = originalSecurity.readState;
	const savedWriteState = originalSecurity.writeState;
	let tempState = {};
	originalSecurity.readState = () => tempState;
	originalSecurity.writeState = (state) => { tempState = state; };

	try {
		const defaults = settings();
		assert.strictEqual(defaults.precision, 'bf16', 'Default precision must be bf16');
		assert.strictEqual(defaults.cpu_offload, true, 'CPU offload must be enabled by default');
		assert.strictEqual(defaults.vae_tiling, true, 'VAE tiling must be enabled by default');
		assert.strictEqual(defaults.allow_model_downloads, false, 'Model downloads must be disabled by default');

		const saved = saveSettings({ precision: 'fp8', default_steps: 20 });
		assert.strictEqual(saved.precision, 'fp8');
		assert.strictEqual(saved.default_steps, 20);
		assert.strictEqual(saved.cpu_offload, true, 'CPU offload preserved after partial update');

		const readBack = settings();
		assert.strictEqual(readBack.precision, 'fp8');
		assert.strictEqual(readBack.default_steps, 20);

		// publicSettings
		const pub = publicSettings();
		assert.ok(pub.success === true, 'publicSettings must return success:true');
		assert.ok(Array.isArray(pub.models) && pub.models.length > 0, 'publicSettings must list models');
		assert.strictEqual(pub.settings.precision, 'fp8');

		// restore defaults for next test
		saveSettings({ precision: 'bf16', default_steps: 40 });
	} finally {
		originalSecurity.readState = savedReadState;
		originalSecurity.writeState = savedWriteState;
	}

	// --- probeRunnerStatus - missing python (empty string) ---
	const missingPythonProbe = probeRunnerStatus('', 'nonexistent.py');
	assert.strictEqual(missingPythonProbe.ok, false);
	assert.strictEqual(missingPythonProbe.state, 'python_missing');

	// --- probeRunnerStatus - nonexistent python path ---
	const nonexistentPythonProbe = probeRunnerStatus('C:\\nonexistent-python.exe', 'nonexistent-runner.py');
	assert.strictEqual(nonexistentPythonProbe.ok, false);
	assert.strictEqual(nonexistentPythonProbe.state, 'python_missing');

	// --- probeRunnerStatus - runner_missing (only tested when a real python exists) ---
	const pythonCandidates = [
		'C:\\Users\\AL\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
		'C:\\Users\\AL\\AppData\\Local\\Programs\\Python\\Python310\\python.exe',
	];
	const existingPython = pythonCandidates.find((p) => fs.existsSync(p));
	if (existingPython) {
		const missingRunnerProbe = probeRunnerStatus(existingPython, path.join(os.tmpdir(), `nonexistent-runner-${Date.now()}.py`));
		assert.strictEqual(missingRunnerProbe.ok, false);
		assert.strictEqual(missingRunnerProbe.state, 'runner_missing');
	}

	// --- createLocalImageDriver snapshot structure ---
	const driver = createLocalImageDriver({
		env: {},
		runnerPath: path.join(os.tmpdir(), 'nonexistent-image-runner.py'),
	});
	assert.strictEqual(driver.id, 'local-image');
	assert.strictEqual(driver.label, 'Local Image (Qwen-Image-2.1)');
	assert.ok(Array.isArray(driver.job_types) && driver.job_types.includes('images'), 'Driver must support images job type');
	assert.ok(typeof driver.capabilities === 'function', 'Driver must expose capabilities()');
	assert.ok(typeof driver.models === 'function', 'Driver must expose models()');
	assert.ok(typeof driver.images === 'function', 'Driver must expose images() job handler');
	assert.ok(typeof driver.refresh === 'function', 'Driver must expose refresh()');
	assert.ok(typeof driver.checkStatus === 'function', 'Driver must expose checkStatus()');

	const caps = driver.capabilities();
	assert.strictEqual(caps.id, 'local-image');
	assert.ok(Array.isArray(caps.job_types) && caps.job_types.includes('images'));
	assert.ok(caps.features && caps.features.fp8_acceleration === false, 'Features must declare naive fp8 acceleration is unavailable');

	const models = driver.models();
	assert.ok(Array.isArray(models) && models.length >= 1, 'Driver must expose at least one model');
	const firstModel = models[0];
	assert.strictEqual(firstModel.type, 'image');
	assert.strictEqual(firstModel.backend, 'local-image');
	assert.ok(Array.isArray(firstModel.job_types) && firstModel.job_types.includes('images'));
	assert.ok(firstModel.image_capabilities && firstModel.image_capabilities.contract_version === 1, 'Model must publish image_capabilities');
	assert.ok(Array.isArray(firstModel.test_options) && firstModel.test_options.length > 0, 'Model must publish test_options');

	// --- images() - not-ready path ---
	const notReadyResult = await driver.images({ prompt: 'test' });
	assert.strictEqual(notReadyResult.success, false);
	assert.strictEqual(notReadyResult.category, 'configuration');
	assert.strictEqual(notReadyResult.code, 'local_image_not_ready');

	// --- runtime readiness does not imply that model weights are installed ---
	const modelId = 'model-relay:local-image:qwen-image-2.1';
	const readyRuntimeSettings = {
		...settings(),
		venv_path: path.join(os.tmpdir(), `relay-local-image-ready-venv-${Date.now()}`),
		model_records: {},
	};
	let readinessProbeCalls = 0;
	const readinessOptions = {
		getSettings: () => readyRuntimeSettings,
		probeRuntime: () => {
			readinessProbeCalls += 1;
			return { ok: true, state: 'ready', probe: { cuda_available: true, diffusers_ready: true } };
		},
	};
	const noWeightsDriver = createLocalImageDriver(readinessOptions);
	assert.strictEqual(readinessProbeCalls, 1, 'Driver should probe the runtime once at creation');
	assert.strictEqual(noWeightsDriver.checkStatus().success, false, 'Runtime must not be ready when model weights are absent');
	assert.strictEqual(noWeightsDriver.capabilities().runtime_ready, true, 'Runtime readiness should remain visible separately');
	assert.strictEqual(noWeightsDriver.models()[0].ready, false, 'Model must be unavailable until its weights are installed');
	assert.strictEqual((await noWeightsDriver.images({ prompt: 'test' })).code, 'local_image_not_ready');
	await noWeightsDriver.refresh();
	assert.strictEqual(readinessProbeCalls, 1, 'Ordinary refresh should use the cached runtime probe');
	await noWeightsDriver.refresh({ forceProbe: true });
	assert.strictEqual(readinessProbeCalls, 2, 'Explicit setup refresh must force a new runtime probe');

	// --- standard input_reference_data_url reaches the local runner job ---
	readyRuntimeSettings.model_records[modelId] = { installed: true, repo_id: MODELS[modelId].repo_id };
	readyRuntimeSettings.allow_model_downloads = true;
	let capturedJob = null;
	const inputReference = 'data:image/png;base64,aGVsbG8=';
	const secondInputReference = 'data:image/png;base64,d29ybGQ=';
	const thirdInputReference = 'data:image/png;base64,dGhpcmQ=';
	const frameReference = 'data:image/png;base64,Zm91cnRo';
	const sourceImagePath = path.join(os.tmpdir(), `relay-local-image-reference-${Date.now()}.png`);
	fs.writeFileSync(sourceImagePath, Buffer.from('source image bytes'));
	let capturedReferenceBytes = null;
	let imageSpawnCount = 0;
	const readyDriver = createLocalImageDriver({
		...readinessOptions,
		spawn: (python, args) => {
			imageSpawnCount += 1;
			const child = new EventEmitter();
			child.stdout = new PassThrough();
			child.stderr = new PassThrough();
			process.nextTick(() => {
				capturedJob = JSON.parse(fs.readFileSync(args[2], 'utf8'));
				capturedReferenceBytes = capturedJob.reference_images.map((referencePath) => fs.readFileSync(referencePath));
				fs.writeFileSync(capturedJob.output_path, Buffer.from('fake png bytes'));
				child.stdout.end(JSON.stringify({ width: capturedJob.width, height: capturedJob.height }));
				child.stderr.end();
				child.emit('close', 0);
			});
			return child;
		},
	});
	assert.strictEqual(readinessProbeCalls, 3, 'Each driver probes once at creation');
	try {
		const editResult = await readyDriver.images({
			prompt: 'edit reference',
			input_reference_data_url: inputReference,
			input_reference: secondInputReference,
			reference_images: [thirdInputReference],
			frames: [frameReference],
			referenced_image_paths: [sourceImagePath],
		});
		assert.strictEqual(editResult.success, true, 'Installed model should accept a reference edit request');
		assert.strictEqual(capturedJob.local_files_only, true, 'Image jobs must not download missing model files, even when Setup downloads are enabled');
		assert.strictEqual(capturedJob.reference_images.length, 5, 'All inline, frame, and filesystem references must reach the runner');
		assert.ok(capturedJob.reference_images.every((referencePath) => path.dirname(referencePath) === path.dirname(capturedJob.output_path)), 'Every runner reference must be a job-local file');
		assert.deepStrictEqual(capturedReferenceBytes, [
			Buffer.from(inputReference.split(',')[1], 'base64'),
			Buffer.from(secondInputReference.split(',')[1], 'base64'),
			Buffer.from(thirdInputReference.split(',')[1], 'base64'),
			Buffer.from(frameReference.split(',')[1], 'base64'),
			Buffer.from('source image bytes'),
		], 'Inline references and copied path contents must reach the runner');
		const rawPathResult = await readyDriver.images({ prompt: 'invalid path reference', reference_images: [sourceImagePath] });
		assert.strictEqual(rawPathResult.code, 'local_image_reference_invalid', 'Filesystem paths in inline fields must be rejected');
		assert.strictEqual(imageSpawnCount, 1, 'Invalid inline paths must be rejected before starting the runner');
		const oversizedB64 = 'A'.repeat(Math.ceil((20 * 1024 * 1024) / 3) * 4 + 4);
		const oversizedResult = await readyDriver.images({ prompt: 'oversized reference', input_reference_data_url: `data:image/png;base64,${oversizedB64}` });
		assert.strictEqual(oversizedResult.code, 'local_image_reference_invalid', 'Inline image references must enforce the 20 MB cap');
		assert.strictEqual(imageSpawnCount, 1, 'Oversized references must be rejected before starting the runner');
		assert.strictEqual(readinessProbeCalls, 3, 'Image jobs must not spawn a synchronous Python readiness probe');
	} finally {
		fs.rmSync(sourceImagePath, { force: true });
	}

	// --- setup - missing python path (empty string must not fall through to discovery) ---
	const setupResult = await setup({
		runCommand: async () => ({ status: 1, stdout: '', stderr: 'python not found' }),
		pythonCommand: '',
		saveSettings: () => ({}),
	});
	assert.strictEqual(setupResult.success, false);
	assert.strictEqual(setupResult.code, 'local_image_python_missing');

	// --- setup - nonexistent absolute python path ---
	const setupMissingPath = await setup({
		runCommand: async () => ({ status: 0, stdout: '', stderr: '' }),
		pythonCommand: path.join(os.tmpdir(), `missing-python-${Date.now()}.exe`),
		saveSettings: () => ({}),
	});
	assert.strictEqual(setupMissingPath.success, false);
	assert.strictEqual(setupMissingPath.code, 'local_image_python_missing');

	// --- setup - venv creation failure ---
	const setupVenvFail = await setup({
		runCommand: async (cmd, args) => {
			if (args[0] === '-m' && args[1] === 'venv') return { status: 1, stdout: '', stderr: 'venv failed' };
			return { status: 0, stdout: '', stderr: '' };
		},
		pythonCommand: process.execPath,
		saveSettings: () => ({}),
		settings: { venv_path: path.join(os.tmpdir(), `nonexistent-venv-${Date.now()}`) },
	});
	assert.strictEqual(setupVenvFail.success, false);
	assert.strictEqual(setupVenvFail.code, 'local_image_venv_failed');

	// --- backend-registry integration: local-image model routing ---
	const { providerFromPayload } = require('../src/backend-registry');
	assert.strictEqual(providerFromPayload({ model: 'model-relay:local-image:qwen-image-2.1' }), 'local-image');

	// --- backend-registry integration: createLocalImageDriver exported ---
	const { createLocalImageDriver: registryExport } = require('../src/backend-registry');
	assert.ok(typeof registryExport === 'function', 'createLocalImageDriver must be exported from backend-registry');

	// --- runner script exists and is in asarUnpack ---
	const runnerScriptPath = path.join(__dirname, '..', 'src', 'image-qwen-runner.py');
	assert.ok(fs.existsSync(runnerScriptPath), 'image-qwen-runner.py must exist in src/');
	const runnerContent = fs.readFileSync(runnerScriptPath, 'utf8');
	assert.ok(runnerContent.includes('run_probe'), 'Runner must define run_probe function');
	assert.ok(runnerContent.includes('run_job'), 'Runner must define run_job function');
	assert.ok(runnerContent.includes('from diffusers import QwenImage21Pipeline'), 'Runtime probe must import the actual generation pipeline');
	assert.ok(runnerContent.includes('enable_model_cpu_offload'), 'Runner must use enable_model_cpu_offload');
	const offloadBlock = runnerContent.split('if cpu_offload:', 2)[1].split('else:', 1)[0];
	assert.ok(offloadBlock.includes('cpu_offload_failed'), 'CPU offload failure must report a clear runtime error');
	assert.ok(!offloadBlock.includes('pipe.to("cuda")'), 'CPU offload failure must not fall back to loading all model weights on CUDA');
	assert.ok(runnerContent.includes('true_cfg_scale'), 'Runner must use true_cfg_scale for QwenImage21Pipeline');
	assert.ok(runnerContent.includes('enable_vae_tiling') || runnerContent.includes('enable_tiling'), 'Runner must attempt VAE tiling');
	assert.ok(runnerContent.includes('fp8'), 'Runner must mention fp8 precision');
	assert.ok(runnerContent.includes('using BF16 with CPU offload instead'), 'Runner must refuse naive float8 casting');
	assert.ok(!runnerContent.includes('.to(torch.float8_e4m3fn)'), 'Runner must not cast transformer weights to float8_e4m3fn');
	assert.ok(runnerContent.includes('--probe'), 'Runner must support --probe argument');
	assert.ok(runnerContent.includes('--job-json'), 'Runner must support --job-json argument');
	assert.ok(!/\"guidance_scale\":\s*guidance_scale/.test(runnerContent), 'Runner must not pass guidance_scale into QwenImage21Pipeline.__call__');

	// --- local-image.js structural checks ---
	const driverSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'local-image.js'), 'utf8');
	assert.ok(driverSource.includes("job_types: ['images']"), 'Driver must declare images job type');
	assert.ok(driverSource.includes("'local-image'"), 'Driver id must be local-image');
	assert.ok(driverSource.includes('cpu_offload'), 'Driver must reference cpu_offload');
	assert.ok(driverSource.includes('vae_tiling'), 'Driver must reference vae_tiling');
	assert.ok(driverSource.includes('fp8'), 'Driver must reference fp8 precision');
	assert.ok(driverSource.includes('killProcessTree'), 'Driver must use killProcessTree for child process cleanup');
	assert.ok(driverSource.includes("'local_image_not_ready'"), 'Driver must return local_image_not_ready when not configured');
	assert.ok(driverSource.includes('chat_template.jinja'), 'Model install must verify processor/chat_template.jinja');
	assert.ok(driverSource.includes('snapshot_download'), 'Model install must use snapshot_download');
	assert.ok(!driverSource.includes('allow_patterns'), 'Model install must download the full snapshot so nested templates are not skipped');

	console.log('local image tests passed');
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
