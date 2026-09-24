'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { appendLog, createBoundedCollector, safeError } = require('./diagnostics');
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
const { imageCapabilityContract } = require('./image-capabilities');

const MODEL_PREFIX = 'model-relay:local-image';
const DEFAULT_VENV_PATH = path.join(security.stateDir, 'qwen-image-venv');
const DEFAULT_PYTHON310 = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'python.exe');
const DEFAULT_PYTHON312 = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe');
const SETUP_TIMEOUT_MS = Number(process.env.AI_MODEL_RELAY_IMAGE_SETUP_TIMEOUT_MS || 1800000);
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_MODEL_RELAY_IMAGE_TIMEOUT_MS || 900000);
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_IMAGE_REFERENCE_BYTES = 20 * 1024 * 1024;
const IMAGE_REFERENCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const MODELS = {
	'model-relay:local-image:qwen-image-2.1': {
		id: 'model-relay:local-image:qwen-image-2.1',
		label: 'Qwen-Image-2.1 (Local FP8/BF16)',
		provider: 'qwen-image',
		repo_id: 'Qwen/Qwen-Image-2.1',
		min_vram_mb: 8192,
		precision: ['bf16', 'fp8'],
		default_precision: 'bf16',
		precision_from_settings: true,
		preferred_steps: 40,
		reference_images_max: 10,
		probe_requirements: ['qwen_pipeline_ready'],
		enabled: true,
		license: { spdx: 'Qwen-Research', commercial_use: false },
	},
	'model-relay:local-image:qwen-image-2512-4bit': {
		id: 'model-relay:local-image:qwen-image-2512-4bit',
		label: 'Qwen-Image-2512 4-bit NF4 (BF16 compute)',
		provider: 'qwen-image',
		repo_id: 'ovedrive/Qwen-Image-2512-4bit',
		min_vram_mb: 16384,
		recommended_vram_mb: 20480,
		vram_note: '16 GB may work; 20 GB recommended.',
		precision: ['nf4-bf16'],
		default_precision: 'nf4-bf16',
		weights_quantization: 'nf4',
		compute_dtype: 'bf16',
		preferred_steps: 20,
		preferred_guidance_scale: 4.0,
		default_resolution: '1328x1328',
		reference_images_max: 1,
		pipeline: 'QwenImagePipeline',
		img2img_pipeline: 'QwenImageImg2ImgPipeline',
		probe_requirements: ['qwen_image_pipeline_ready', 'qwen_image_img2img_pipeline_ready', 'bitsandbytes_ready'],
		required_packages: ['bitsandbytes'],
		required_snapshot_paths: ['model_index.json', 'quantization_info.json', 'transformer'],
		enabled: true,
		license: { spdx: 'CC-BY-NC-SA-4.0', commercial_use: false },
	},
	'model-relay:local-image:flux-2-dev-nf4': {
		id: 'model-relay:local-image:flux-2-dev-nf4',
		label: 'FLUX.2-dev NF4 (BF16 compute)',
		provider: 'flux2',
		repo_id: 'diffusers/FLUX.2-dev-bnb-4bit',
		min_vram_mb: 20480,
		recommended_vram_mb: 24576,
		vram_note: 'Plan for about 20 GB free VRAM; CPU offload is recommended.',
		precision: ['nf4-bf16'],
		default_precision: 'nf4-bf16',
		weights_quantization: 'nf4',
		compute_dtype: 'bf16',
		preferred_steps: 28,
		preferred_guidance_scale: 4.0,
		default_resolution: '1024x1024',
		reference_images_max: 10,
		pipeline: 'Flux2Pipeline',
		img2img_pipeline: 'Flux2Pipeline',
		guidance_argument: 'guidance_scale',
		probe_requirements: ['flux2_pipeline_ready', 'bitsandbytes_ready'],
		required_packages: ['bitsandbytes'],
		required_snapshot_paths: ['model_index.json', 'transformer'],
		license: { spdx: 'flux-dev-non-commercial-license', commercial_use: false },
	},
	'model-relay:local-image:sana-1600m-4k': {
		id: 'model-relay:local-image:sana-1600m-4k',
		label: 'NVIDIA Sana 1.6B BF16 (2K / 4K)',
		provider: 'sana',
		repo_id: 'Efficient-Large-Model/Sana_1600M_4Kpx_BF16_diffusers',
		min_vram_mb: 12288,
		recommended_vram_mb: 16384,
		vram_note: 'About 16 GB VRAM recommended for 4K; VAE tiling is applied automatically.',
		precision: ['bf16', 'nf4-bf16'],
		default_precision: 'bf16',
		pretrained_variant: 'bf16',
		timeout_ms: 1800000,
		large_output_timeout_ms: 3600000,
		large_output_threshold_px: 4000,
		gpu_only_precisions: ['nf4-bf16'],
		precision_requirements: { 'nf4-bf16': ['bitsandbytes_ready'] },
		preferred_steps: 20,
		preferred_guidance_scale: 5.0,
		default_resolution: '2048x2048',
		reference_images_max: 0,
		reference_images_unsupported_message: 'NVIDIA Sana supports text-to-image only. Choose a Qwen or FLUX.2 model to edit a reference image.',
		pipeline: 'SanaPipeline',
		guidance_argument: 'guidance_scale',
		probe_requirements: ['sana_pipeline_ready'],
		required_packages: ['sentencepiece', 'bitsandbytes'],
		required_snapshot_paths: ['model_index.json', 'transformer', 'text_encoder', 'tokenizer', 'vae'],
		vae_tiling_for_4k: {
			tile_sample_min_height: 1024,
			tile_sample_min_width: 1024,
			tile_sample_stride_height: 896,
			tile_sample_stride_width: 896,
		},
		license: { spdx: 'Apache-2.0', commercial_use: true },
	},
};

const QWEN_IMAGE_ASPECT_CHOICES = [
	{ value: '1:1', label: 'Square · 1:1' },
	{ value: '16:9', label: 'Landscape · 16:9' },
	{ value: '9:16', label: 'Portrait · 9:16' },
	{ value: '4:3', label: 'Landscape · 4:3' },
	{ value: '3:4', label: 'Portrait · 3:4' },
	{ value: '3:2', label: 'Landscape · 3:2' },
	{ value: '2:3', label: 'Portrait · 2:3' },
];

const QWEN_IMAGE_SIZE_TABLE = {
	'1k': {
		'1:1': [1024, 1024],
		'4:3': [1152, 864],
		'3:4': [864, 1152],
		'3:2': [1216, 832],
		'2:3': [832, 1216],
		'16:9': [1344, 768],
		'9:16': [768, 1344],
	},
	'2k': {
		'1:1': [2048, 2048],
		'4:3': [2400, 1792],
		'3:4': [1792, 2400],
		'3:2': [2528, 1696],
		'2:3': [1696, 2528],
		'16:9': [2752, 1536],
		'9:16': [1536, 2752],
	},
};

const QWEN_IMAGE_RESOLUTION_CHOICES = [
	{ value: '1024x1024', label: '1K · 1:1 · 1024×1024' },
	{ value: '1152x864', label: '1K · 4:3 · 1152×864' },
	{ value: '864x1152', label: '1K · 3:4 · 864×1152' },
	{ value: '1216x832', label: '1K · 3:2 · 1216×832' },
	{ value: '832x1216', label: '1K · 2:3 · 832×1216' },
	{ value: '1344x768', label: '1K · 16:9 · 1344×768' },
	{ value: '768x1344', label: '1K · 9:16 · 768×1344' },
	{ value: '2048x2048', label: '2K · 1:1 · 2048×2048' },
	{ value: '2400x1792', label: '2K · 4:3 · 2400×1792' },
	{ value: '1792x2400', label: '2K · 3:4 · 1792×2400' },
	{ value: '2528x1696', label: '2K · 3:2 · 2528×1696' },
	{ value: '1696x2528', label: '2K · 2:3 · 1696×2528' },
	{ value: '2752x1536', label: '2K · 16:9 · 2752×1536' },
	{ value: '1536x2752', label: '2K · 9:16 · 1536×2752' },
];

const QWEN_IMAGE_2512_SIZE_TABLE = {
	'1:1': [1328, 1328],
	'16:9': [1664, 928],
	'9:16': [928, 1664],
	'4:3': [1472, 1140],
	'3:4': [1140, 1472],
	'3:2': [1584, 1056],
	'2:3': [1056, 1584],
};

const QWEN_IMAGE_2512_RESOLUTION_CHOICES = Object.entries(QWEN_IMAGE_2512_SIZE_TABLE).map(([aspectRatio, [width, height]]) => ({
	value: `${width}x${height}`,
	label: `Native · ${aspectRatio} · ${width}×${height}`,
}));

const QWEN_IMAGE_TEST_OPTIONS = [
	{
		key: 'aspect_ratio',
		label: 'Aspect ratio',
		delivery: 'direct',
		choices: QWEN_IMAGE_ASPECT_CHOICES,
	},
	{
		key: 'resolution',
		label: 'Resolution',
		delivery: 'direct',
		choices: QWEN_IMAGE_RESOLUTION_CHOICES,
	},
	{
		key: 'quality',
		label: 'Precision',
		delivery: 'direct',
		choices: [
			{ value: 'bf16', label: 'BF16 (recommended with CPU offload)' },
			{ value: 'fp8', label: 'FP8 (falls back to BF16 until proper quant lands)' },
		],
	},
];

const QWEN_IMAGE_CAPABILITIES = imageCapabilityContract(QWEN_IMAGE_TEST_OPTIONS, {
	resolutionKey: 'resolution',
	referenceImagesMax: 10,
	candidateCountMax: 1,
	outputFormats: ['image/png'],
});

const QWEN_IMAGE_2512_TEST_OPTIONS = QWEN_IMAGE_TEST_OPTIONS.map((option) => option.key === 'quality'
	? { ...option, choices: [{ value: 'nf4-bf16', label: 'NF4 weights / BF16 compute' }] }
	: option.key === 'resolution' ? { ...option, choices: QWEN_IMAGE_2512_RESOLUTION_CHOICES }
	: option);

const QWEN_IMAGE_2512_CAPABILITIES = imageCapabilityContract(QWEN_IMAGE_2512_TEST_OPTIONS, {
	resolutionKey: 'resolution',
	referenceImagesMax: 1,
	candidateCountMax: 1,
	outputFormats: ['image/png'],
});

const FLUX2_RESOLUTION_CHOICES = QWEN_IMAGE_RESOLUTION_CHOICES.filter((choice) => Object.values(QWEN_IMAGE_SIZE_TABLE['1k'])
	.some(([width, height]) => choice.value === `${width}x${height}`));
const FLUX2_TEST_OPTIONS = QWEN_IMAGE_TEST_OPTIONS.map((option) => option.key === 'quality'
	? { ...option, choices: [{ value: 'nf4-bf16', label: 'NF4 weights / BF16 compute' }] }
	: option.key === 'resolution' ? { ...option, choices: FLUX2_RESOLUTION_CHOICES }
	: option);
const FLUX2_CAPABILITIES = imageCapabilityContract(FLUX2_TEST_OPTIONS, {
	resolutionKey: 'resolution',
	referenceImagesMax: 10,
	candidateCountMax: 1,
	outputFormats: ['image/png'],
});

const SANA_RESOLUTION_CHOICES = [
	{ value: '2048x2048', label: '2K - 2048 x 2048' },
	{ value: '2752x1536', label: '2K landscape - 16:9 - 2752 x 1536' },
	{ value: '1536x2752', label: '2K portrait - 9:16 - 1536 x 2752' },
	{ value: '2400x1792', label: '2K landscape - 4:3 - 2400 x 1792' },
	{ value: '1792x2400', label: '2K portrait - 3:4 - 1792 x 2400' },
	{ value: '2528x1696', label: '2K landscape - 3:2 - 2528 x 1696' },
	{ value: '1696x2528', label: '2K portrait - 2:3 - 1696 x 2528' },
	{ value: '1024x1024', label: '1K - 1024 x 1024 (faster)' },
	{ value: '1344x768', label: '1K landscape - 16:9 - 1344 x 768' },
	{ value: '768x1344', label: '1K portrait - 9:16 - 768 x 1344' },
	{ value: '1152x864', label: '1K landscape - 4:3 - 1152 x 864' },
	{ value: '864x1152', label: '1K portrait - 3:4 - 864 x 1152' },
	{ value: '1216x832', label: '1K landscape - 3:2 - 1216 x 832' },
	{ value: '832x1216', label: '1K portrait - 2:3 - 832 x 1216' },
	{ value: '4096x4096', label: '4K - 4096 x 4096 (VAE tiled)' },
	{ value: '4096x2304', label: '4K landscape - 16:9 - 4096 x 2304 (VAE tiled)' },
	{ value: '2304x4096', label: '4K portrait - 9:16 - 2304 x 4096 (VAE tiled)' },
	{ value: '4096x3072', label: '4K landscape - 4:3 - 4096 x 3072 (VAE tiled)' },
	{ value: '3072x4096', label: '4K portrait - 3:4 - 3072 x 4096 (VAE tiled)' },
	{ value: '4032x2688', label: '4K landscape - 3:2 - 4032 x 2688 (VAE tiled)' },
	{ value: '2688x4032', label: '4K portrait - 2:3 - 2688 x 4032 (VAE tiled)' },
];
const SANA_TEST_OPTIONS = [
	{
		key: 'resolution',
		label: 'Resolution',
		delivery: 'direct',
		choices: SANA_RESOLUTION_CHOICES,
	},
	{
		key: 'quality',
		label: 'Precision',
		delivery: 'direct',
		choices: [
			{ value: 'bf16', label: 'BF16 (official checkpoint)' },
			{ value: 'nf4-bf16', label: 'NF4 weights / BF16 compute (GPU only)' },
		],
	},
];
const SANA_CAPABILITIES = imageCapabilityContract(SANA_TEST_OPTIONS, {
	resolutionKey: 'resolution',
	referenceImagesMax: 0,
	candidateCountMax: 1,
	outputFormats: ['image/png'],
});

function parseWxH(value) {
	const match = String(value || '').trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
	if (!match) return null;
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
	return { width, height };
}

function imageJobTimeoutMs(payload, modelProfile, outputSize) {
	if (payload && payload.timeout_ms) return Number(payload.timeout_ms);
	const largestDimension = Math.max(Number(outputSize && outputSize.width) || 0, Number(outputSize && outputSize.height) || 0);
	const largeOutputThreshold = Number(modelProfile && modelProfile.large_output_threshold_px) || 4096;
	if (modelProfile && modelProfile.large_output_timeout_ms && largestDimension >= largeOutputThreshold) {
		return Number(modelProfile.large_output_timeout_ms);
	}
	return Number(modelProfile && modelProfile.timeout_ms || DEFAULT_TIMEOUT_MS);
}

function sizeFromAspect(aspectRatio, tier = '1k') {
	const table = QWEN_IMAGE_SIZE_TABLE[String(tier || '1k').toLowerCase() === '2k' ? '2k' : '1k'];
	const pair = table[String(aspectRatio || '1:1').trim()] || table['1:1'];
	return { width: pair[0], height: pair[1] };
}

function decodeReferenceImage(item) {
	let mime;
	let encoded;
	if (typeof item === 'string') {
		const match = item.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
		if (!match) return null;
		mime = match[1].toLowerCase();
		encoded = match[2];
	} else if (item && typeof item === 'object' && typeof item.b64_json === 'string') {
		mime = String(item.mime_type || 'image/jpeg').toLowerCase();
		encoded = item.b64_json;
	} else {
		return null;
	}

	const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp' }[mime];
	if (!extension) return null;
	const normalized = String(encoded).replace(/\s+/g, '');
	if (!normalized || normalized.length % 4 === 1 || normalized.length > Math.ceil(MAX_IMAGE_REFERENCE_BYTES / 3) * 4) return null;
	const bytes = Buffer.from(normalized, 'base64');
	if (!bytes.length || bytes.length > MAX_IMAGE_REFERENCE_BYTES) return null;
	return { bytes, extension };
}

function resolveOutputSize(payload = {}, current = {}, modelId = 'model-relay:local-image:qwen-image-2.1') {
	const is2512 = modelId === 'model-relay:local-image:qwen-image-2512-4bit';
	const isFlux2 = modelId === 'model-relay:local-image:flux-2-dev-nf4';
	const isSana = modelId === 'model-relay:local-image:sana-1600m-4k';
	const modelSizeFromAspect = (aspectRatio, scale = 1) => {
		const pair = QWEN_IMAGE_2512_SIZE_TABLE[String(aspectRatio || '1:1').trim()] || QWEN_IMAGE_2512_SIZE_TABLE['1:1'];
		return { width: pair[0] * scale, height: pair[1] * scale };
	};
	const explicitWidth = Number(payload.width);
	const explicitHeight = Number(payload.height);
	if (Number.isFinite(explicitWidth) && Number.isFinite(explicitHeight) && explicitWidth > 0 && explicitHeight > 0) {
		return { width: Math.round(explicitWidth), height: Math.round(explicitHeight) };
	}

	const sizeRaw = String(payload.size || payload.resolution || current.default_resolution || '1024x1024').trim().toLowerCase();
	const parsed = parseWxH(sizeRaw);
	const aspectRatio = String(payload.aspect_ratio || '1:1').trim() || '1:1';
	if (parsed) {
		// The 2512 profile exposes its native sizes as explicit resolution choices.
		// Preserve a chosen size even when the request also carries the UI's default ratio.
		if ((is2512 || isFlux2 || isSana) && (payload.resolution || payload.size)) return parsed;
		if (!payload.aspect_ratio) return parsed;
		if (is2512) return modelSizeFromAspect(aspectRatio, Math.max(parsed.width, parsed.height) >= 1792 ? 2 : 1);
		const tier = Math.max(parsed.width, parsed.height) >= 1792 ? '2k' : '1k';
		return sizeFromAspect(aspectRatio, tier);
	}

	if (sizeRaw === '1k' || sizeRaw === '2k' || sizeRaw === 'high' || sizeRaw === 'native') {
		if (is2512) return modelSizeFromAspect(aspectRatio, sizeRaw === '2k' ? 2 : 1);
		return sizeFromAspect(aspectRatio, sizeRaw === '1k' ? '1k' : '2k');
	}

	if (is2512) return modelSizeFromAspect(aspectRatio);
	return sizeFromAspect(aspectRatio, '1k');
}

function unpackedAsarPath(sourcePath) {
	const normalized = String(sourcePath || '');
	const marker = `${path.sep}app.asar${path.sep}`;
	const index = normalized.indexOf(marker);
	return index === -1 ? normalized : `${normalized.slice(0, index)}${path.sep}app.asar.unpacked${path.sep}${normalized.slice(index + marker.length)}`;
}

function runnerPath(filename = 'image-qwen-runner.py', baseDir = __dirname) {
	return unpackedAsarPath(path.join(baseDir, filename));
}

function defaultSettings() {
	return {
		python_path: process.env.AI_MODEL_RELAY_IMAGE_PYTHON || '',
		venv_path: process.env.AI_MODEL_RELAY_IMAGE_VENV || DEFAULT_VENV_PATH,
		precision: process.env.AI_MODEL_RELAY_IMAGE_PRECISION || 'bf16',
		default_resolution: '1024x1024',
		default_steps: 40,
		guidance_scale: 1.0,
		cpu_offload: true,
		vae_tiling: true,
		allow_package_install: true,
		allow_model_downloads: false,
		model_records: {},
	};
}

function settings() {
	try {
		const state = security.readState();
		const current = state && typeof state.local_image_settings === 'object' && state.local_image_settings !== null
			? state.local_image_settings
			: {};
		return { ...defaultSettings(), ...current };
	} catch (error) {
		return defaultSettings();
	}
}

function saveSettings(updates = {}) {
	const state = security.readState() || {};
	const current = state.local_image_settings && typeof state.local_image_settings === 'object'
		? state.local_image_settings
		: {};
	const merged = { ...defaultSettings(), ...current, ...updates };
	state.local_image_settings = merged;
	security.writeState(state);
	return merged;
}

function publicSettings() {
	const current = settings();
	return {
		success: true,
		settings: {
			python_path: current.python_path,
			venv_path: current.venv_path,
			precision: current.precision,
			default_resolution: current.default_resolution,
			default_steps: current.default_steps,
			guidance_scale: current.guidance_scale,
			cpu_offload: current.cpu_offload,
			vae_tiling: current.vae_tiling,
			allow_model_downloads: current.allow_model_downloads,
		},
		resolution_choices: QWEN_IMAGE_RESOLUTION_CHOICES,
		models: Object.keys(MODELS).map((id) => ({
			id,
			label: MODELS[id].label,
			state: current.model_records && current.model_records[id] && current.model_records[id].installed ? 'installed' : 'not_installed',
			precision: MODELS[id].default_precision,
			reference_images_max: MODELS[id].reference_images_max,
			min_vram_mb: MODELS[id].min_vram_mb,
			recommended_vram_mb: MODELS[id].recommended_vram_mb,
			vram_note: MODELS[id].vram_note,
			license: MODELS[id].license,
		})),
	};
}

function venvPythonPath(venvDir) {
	return process.platform === 'win32'
		? path.join(venvDir, 'Scripts', 'python.exe')
		: path.join(venvDir, 'bin', 'python');
}

function discoverBasePython(config = {}) {
	const explicit = String(config.python_path || process.env.AI_MODEL_RELAY_IMAGE_PYTHON || '').trim();
	if (explicit && fs.existsSync(explicit)) return explicit;
	for (const candidate of [DEFAULT_PYTHON312, DEFAULT_PYTHON310]) {
		if (fs.existsSync(candidate)) return candidate;
	}
	const resolved = resolveCommand(['python', 'py']);
	return resolved || '';
}

function validateRunnerProbe(probe = {}) {
	if (!probe.cuda_available) return { ok: false, state: 'cuda_unavailable', probe };
	if (!probe.diffusers_ready) return { ok: false, state: 'diffusers_missing', probe };
	if (!probe.transformers_ready) return { ok: false, state: 'transformers_missing', probe };
	if (!probe.qwen_pipeline_ready && !probe.qwen_image_pipeline_ready && !probe.flux2_pipeline_ready && !probe.sana_pipeline_ready) return { ok: false, state: 'diffusers_pipeline_missing', probe };
	return { ok: true, state: 'ready', probe };
}

function modelPipelineReady(model, probe = {}) {
	return (model && Array.isArray(model.probe_requirements) ? model.probe_requirements : [])
		.every((key) => probe[key] === true);
}

function probeRunnerStatus(pythonPath, runnerFile) {
	if (!pythonPath || !fs.existsSync(pythonPath)) {
		return { ok: false, state: 'python_missing', message: 'Python is not installed in the image virtual environment.' };
	}
	if (!runnerFile || !fs.existsSync(runnerFile)) {
		return { ok: false, state: 'runner_missing', message: 'The local image runner script was not found.' };
	}
	try {
		const result = spawnSync(pythonPath, [runnerFile, '--probe'], {
			encoding: 'utf8',
			shell: false,
			windowsHide: true,
			timeout: 30000,
		});
		if (result.error || result.status !== 0) {
			return { ok: false, state: 'probe_failed', error: result.error ? result.error.message : result.stderr };
		}
		let probe = {};
		try {
			probe = JSON.parse(String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
		} catch (e) {
			probe = {};
		}
		return validateRunnerProbe(probe);
	} catch (err) {
		return { ok: false, state: 'probe_exception', error: err.message };
	}
}

async function runProcess(command, args, options = {}) {
	return new Promise((resolve) => {
		const stdoutCollector = createBoundedCollector({ maxChars: 512 * 1024 });
		const stderrCollector = createBoundedCollector({ maxChars: 512 * 1024 });
		let settled = false;
		let timeoutId = null;
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: { ...process.env, ...(options.env || {}) },
			shell: false,
			windowsHide: true,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const finish = (result) => {
			if (settled) return;
			settled = true;
			if (timeoutId) clearTimeout(timeoutId);
			resolve(result);
		};
		if (options.timeout) {
			timeoutId = setTimeout(() => {
				killProcessTree(child);
				finish({ status: 124, timeout: true, stdout: stdoutCollector.value(), stderr: stderrCollector.value() });
			}, options.timeout);
		}
		child.stdout.on('data', (chunk) => {
			stdoutCollector.append(String(chunk));
			if (typeof options.onOutput === 'function') options.onOutput('stdout', String(chunk));
		});
		child.stderr.on('data', (chunk) => {
			stderrCollector.append(String(chunk));
			if (typeof options.onOutput === 'function') options.onOutput('stderr', String(chunk));
		});
		child.on('error', (error) => finish({ error, status: 1, stdout: stdoutCollector.value(), stderr: stderrCollector.value() }));
		child.on('close', (status) => finish({ status, stdout: stdoutCollector.value(), stderr: stderrCollector.value() }));
	});
}

async function setup(options = {}) {
	const logChunks = [];
	const emit = (stream, text) => {
		if (text) logChunks.push(String(text));
		if (typeof options.onOutput === 'function') options.onOutput(stream, text);
	};
	const collectedLog = () => logChunks.join('').slice(-12000);
	const run = options.runCommand || runProcess;
	const persist = options.saveSettings || saveSettings;
	const current = options.settings
		? { ...defaultSettings(), ...options.settings }
		: settings();
	const modelId = String(options.model || 'model-relay:local-image:qwen-image-2.1').trim();
	const modelProfile = MODELS[modelId];
	if (!modelProfile) {
		return { success: false, category: 'configuration', code: 'local_image_model_unknown', message: `Unknown local image model: ${modelId}.` };
	}
	let basePython = Object.prototype.hasOwnProperty.call(options, 'pythonCommand')
		? String(options.pythonCommand || '').trim()
		: discoverBasePython(current);
	if (basePython && !fs.existsSync(basePython)) {
		const resolved = resolveCommand([basePython]);
		basePython = resolved && fs.existsSync(resolved) ? resolved : '';
	}
	if (!basePython) {
		return { success: false, category: 'configuration', code: 'local_image_python_missing', message: 'Local image setup needs a Python executable. Install Python 3.10+ or set the path in Settings.' };
	}

	const venvDir = current.venv_path || DEFAULT_VENV_PATH;
	const venvPython = venvPythonPath(venvDir);

	if (!fs.existsSync(venvPython)) {
		emit('stdout', `Creating local image virtual environment at ${venvDir}\n`);
		fs.mkdirSync(path.dirname(venvDir), { recursive: true });
		const created = await run(basePython, ['-m', 'venv', venvDir], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (created.error || created.status !== 0) {
			return { success: false, category: 'configuration', code: 'local_image_venv_failed', message: 'Could not create the local image virtual environment.', details: { error: created.stderr || created.stdout, log: collectedLog() } };
		}
	}

	const versionResult = await run(venvPython, ['-V'], { timeout: 15000, onOutput: emit });
	const pythonVersion = String(versionResult.stdout || versionResult.stderr || '').trim();

	emit('stdout', `Upgrading pip in ${venvDir}...\n`);
	await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--upgrade', 'pip'], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });

	emit('stdout', `Installing CUDA PyTorch from ${DEFAULT_TORCH_INDEX}...\n`);
	const torch = await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--progress-bar', 'off', 'torch', 'torchvision', 'torchaudio', '--index-url', DEFAULT_TORCH_INDEX], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
	if (torch.error || torch.status !== 0) {
		return { success: false, category: 'configuration', code: 'local_image_torch_failed', message: 'CUDA PyTorch could not be installed for local image generation.', details: { error: torch.stderr || torch.stdout, log: collectedLog() } };
	}

	const cudaProbe = await evaluateCudaTorch(run, venvPython, emit, { pythonVersion, probeTimeout: 60000 });
	if (!cudaProbe.success) return cudaProbe;

	const freeze = await run(venvPython, ['-m', 'pip', 'freeze'], { timeout: 30000, onOutput: emit });
	const constraintText = torchConstraintText(freeze && freeze.stdout, cudaProbe.torch && cudaProbe.torch.version);
	const torchConstraintFile = constraintPath(venvDir);
	fs.writeFileSync(torchConstraintFile, constraintText);

	const packages = ['transformers>=5.17', 'git+https://github.com/huggingface/diffusers', 'accelerate', 'pillow', 'huggingface_hub', ...(modelProfile.required_packages || [])];
	emit('stdout', 'Installing Diffusers and dependencies with CUDA PyTorch pinned...\n');
	const pkgsResult = await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--progress-bar', 'off', '--constraint', torchConstraintFile, ...packages], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
	if (pkgsResult.error || pkgsResult.status !== 0) {
		return { success: false, category: 'configuration', code: 'local_image_packages_failed', message: 'Could not install Diffusers and required image generation packages.', details: { error: pkgsResult.stderr || pkgsResult.stdout, log: collectedLog() } };
	}

	const downloadModel = options.download_model === true || current.allow_model_downloads === true;
	const updatedRecords = { ...(current.model_records || {}) };

	if (downloadModel) {
		emit('stdout', `Prefetching full model snapshot for ${modelProfile.repo_id} from Hugging Face...\n`);
		const downloadScript = [
			'import os',
			'from huggingface_hub import snapshot_download',
			`path = snapshot_download(repo_id="${modelProfile.repo_id}")`,
			`required_paths = ${JSON.stringify(modelProfile.required_snapshot_paths || ['processor/chat_template.jinja'])}`,
			'missing = [item for item in required_paths if not os.path.exists(os.path.join(path, item))]',
			'if missing:',
			'\traise SystemExit("Incomplete snapshot: missing required model paths: " + ", ".join(missing))',
			'print("MODEL_SNAPSHOT_OK=" + path)',
		].join('\n');
		const dlResult = await run(venvPython, ['-c', downloadScript], { timeout: SETUP_TIMEOUT_MS, onOutput: emit });
		if (dlResult.error || dlResult.status !== 0) {
			return { success: false, category: 'configuration', code: 'local_image_model_download_failed', message: `Failed to download model weights for ${modelProfile.repo_id}.`, details: { error: dlResult.stderr || dlResult.stdout, log: collectedLog() } };
		}
		updatedRecords[modelId] = {
			installed: true,
			installed_at: new Date().toISOString(),
			repo_id: modelProfile.repo_id,
		};
	}

	persist({
		...current,
		python_path: current.python_path || basePython,
		venv_path: venvDir,
		model_records: updatedRecords,
	});

	const modelInstalled = !!(updatedRecords[modelId] && updatedRecords[modelId].installed);
	return {
		success: true,
		model: {
			id: modelId,
			label: modelProfile.label,
			state: modelInstalled ? 'installed' : 'environment_ready',
		},
		details: {
			python: venvPython,
			python_version: pythonVersion,
			torch: cudaProbe.torch,
			model_downloaded: downloadModel,
			log: collectedLog(),
		},
	};
}

function createLocalImageDriver(options = {}) {
	const env = options.env || process.env;
	const runner = options.runnerPath || runnerPath('image-qwen-runner.py');
	const readSettings = options.getSettings || settings;
	const probeRuntime = options.probeRuntime || probeRunnerStatus;
	const spawnJob = options.spawn || spawn;
	let probeCache = null;
	let snapshot = {
		id: 'local-image',
		label: 'Local Image (Diffusers)',
		kind: 'local-runtime',
		ready: false,
		state: 'checking',
		diagnostic: 'Checking local image model runtime readiness.',
		models: [],
	};

	function inspect(forceProbe = false) {
		const current = readSettings();
		const venvPython = venvPythonPath(current.venv_path || DEFAULT_VENV_PATH);
		const probeKey = JSON.stringify({ python: venvPython, runner, modelRecords: current.model_records || {} });
		if (forceProbe || !probeCache || probeCache.key !== probeKey) {
			probeCache = { key: probeKey, result: probeRuntime(venvPython, runner) };
		}
		const probe = probeCache.result;
		const runtimeReady = !!probe.ok;
		const models = Object.keys(MODELS).map((id) => {
			const profile = MODELS[id];
			const installed = !!(current.model_records && current.model_records[id] && current.model_records[id].installed === true);
			const modelProbe = probe.probe || {};
			const missingRequirements = (profile.probe_requirements || []).filter((key) => modelProbe[key] !== true);
			const pipelineReady = runtimeReady && modelPipelineReady(profile, modelProbe);
			return {
				id,
				label: profile.label,
				ready: pipelineReady && installed,
				state: !pipelineReady ? missingRequirements.includes('bitsandbytes_ready') ? 'dependency_missing' : 'runtime_unavailable' : installed ? 'installed' : 'not_installed',
				missing_requirements: missingRequirements,
				precision: profile.default_precision,
				min_vram_mb: profile.min_vram_mb,
				recommended_vram_mb: profile.recommended_vram_mb,
				vram_note: profile.vram_note,
			};
		});
		const ready = runtimeReady && models.some((model) => model.ready);
		const diagnostic = !runtimeReady
			? (probe.state === 'cuda_unavailable'
				? 'CUDA is not available in the local image environment.'
				: 'Use Setup on the Status Page to configure the local image runtime.')
			: !ready
				? (models.find((model) => model.state === 'dependency_missing')
					? `${models.find((model) => model.state === 'dependency_missing').label} requires bitsandbytes. Run Setup for this model to install the missing package.`
					: 'The local image runtime is ready, but no supported model weights are installed. Run Setup and install a model.')
				: 'CUDA PyTorch, Diffusers, and at least one local image model are ready.';

		snapshot = {
			id: 'local-image',
			label: 'Local Image (Diffusers)',
			kind: 'local-runtime',
			ready,
			runtime_ready: runtimeReady,
			state: ready ? 'ready' : runtimeReady ? 'model_not_installed' : 'not_ready',
			diagnostic,
			python: venvPython,
			probe,
			models,
		};
		return snapshot;
	}

	inspect();

	return {
		id: 'local-image',
		label: 'Local Image (Diffusers)',
		kind: 'local-runtime',
		job_types: ['images'],
		checkStatus: () => ({ success: snapshot.ready, message: snapshot.diagnostic, details: snapshot }),
		capabilities: () => ({
			...snapshot,
			job_types: ['images'],
			features: {
				local_image: true,
				cancellation: true,
				native_transparency: true,
				multi_reference: true,
				fp8_acceleration: false,
				vae_tiling: true,
				cpu_offload: true,
			},
		}),
		models: () => Object.keys(MODELS).map((id) => {
			const profile = MODELS[id];
			const modelState = snapshot.models.find((model) => model.id === id);
			return {
				id,
				type: 'image',
				backend: 'local-image',
				ready: !!(modelState && modelState.ready),
				state: modelState ? modelState.state : 'not_checked',
				job_types: ['images'],
				label: profile.label,
				repo_id: profile.repo_id,
				pipeline: profile.pipeline,
				precision: profile.default_precision,
				reference_images_max: profile.reference_images_max,
				missing_requirements: modelState ? modelState.missing_requirements : [],
				default_resolution: profile.default_resolution,
				test_options: id === 'model-relay:local-image:flux-2-dev-nf4' ? FLUX2_TEST_OPTIONS : id === 'model-relay:local-image:sana-1600m-4k' ? SANA_TEST_OPTIONS : profile.reference_images_max > 1 ? QWEN_IMAGE_TEST_OPTIONS : QWEN_IMAGE_2512_TEST_OPTIONS,
				image_capabilities: id === 'model-relay:local-image:flux-2-dev-nf4' ? FLUX2_CAPABILITIES : id === 'model-relay:local-image:sana-1600m-4k' ? SANA_CAPABILITIES : profile.reference_images_max > 1 ? QWEN_IMAGE_CAPABILITIES : QWEN_IMAGE_2512_CAPABILITIES,
				license: profile.license,
				min_vram_mb: profile.min_vram_mb,
				recommended_vram_mb: profile.recommended_vram_mb,
				vram_note: profile.vram_note,
			};
		}),
		refresh: async (refreshOptions = {}) => inspect(refreshOptions.forceProbe === true),
		async images(payload = {}, session = {}) {
			const state = inspect();
			if (!state.runtime_ready) {
				return {
					success: false,
					category: 'configuration',
					code: 'local_image_not_ready',
					message: state.diagnostic || 'Local image runtime is not ready. Run setup on the Status Page.',
					details: state,
				};
			}
			const modelId = String(payload.model || 'model-relay:local-image:qwen-image-2.1').trim();
			const modelProfile = MODELS[modelId];
			if (!modelProfile) {
				return { success: false, category: 'configuration', code: 'local_image_model_unknown', message: `Unknown local image model: ${modelId}.` };
			}
			const modelState = state.models.find((model) => model.id === modelId);
			if (!modelState || !modelState.ready) {
				return { success: false, category: 'configuration', code: 'local_image_model_not_ready', message: `${modelProfile.label} is not installed or its Diffusers pipeline is unavailable. Install this model from the Status Page first.`, details: { model: modelId, state: modelState || null } };
			}

			const prompt = String(payload.prompt || '').trim();
			if (!prompt) {
				return { success: false, category: 'validation', code: 'local_image_prompt_required', message: 'An image prompt is required.' };
			}

			const current = readSettings();
			const defaultPrecision = modelProfile.precision_from_settings ? current.precision : modelProfile.default_precision;
			const precision = String(payload.quality || defaultPrecision || modelProfile.default_precision || 'bf16').toLowerCase();
			if (!modelProfile.precision.includes(precision)) {
				return { success: false, category: 'validation', code: 'local_image_precision_unsupported', message: `Precision ${precision} is not supported by ${modelProfile.label}.`, details: { model: modelId, supported: modelProfile.precision } };
			}
			const missingPrecisionRequirement = (modelProfile.precision_requirements && modelProfile.precision_requirements[precision] || [])
				.find((requirement) => !state.probe || !state.probe.probe || state.probe.probe[requirement] !== true);
			if (missingPrecisionRequirement) {
				return {
					success: false,
					category: 'configuration',
					code: 'local_image_dependency_missing',
					message: `${modelProfile.label} ${precision} mode requires bitsandbytes. Run Setup for this model to install the optional GPU quantization dependency.`,
					details: { model: modelId, precision, missing_requirement: missingPrecisionRequirement },
				};
			}
			const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-image-'));
			const outputPath = path.join(workdir, 'generated.png');
			const jobPath = path.join(workdir, 'job.json');

			const resolutionSettings = modelProfile.default_resolution && current.default_resolution === '1024x1024'
				? { ...current, default_resolution: modelProfile.default_resolution }
				: current;
			const outputSize = resolveOutputSize(payload, resolutionSettings, modelId);
			const aspectRatio = String(payload.aspect_ratio || '').trim();
			const configuredSteps = Number(current.default_steps || 40);
			const steps = Number(payload.steps || payload.num_inference_steps || (configuredSteps === 40 ? modelProfile.preferred_steps || configuredSteps : configuredSteps));
			const configuredGuidance = Number(current.guidance_scale ?? 1.0);
			const guidanceScale = Number(payload.true_cfg_scale ?? payload.guidance_scale ?? (configuredGuidance === 1.0 ? modelProfile.preferred_guidance_scale ?? configuredGuidance : configuredGuidance));
			const seed = payload.seed !== undefined ? Number(payload.seed) : undefined;

			// Handle reference images
			const referenceImages = [];
			const rawImages = [
				payload.input_reference_data_url,
				payload.input_reference,
				payload.image,
				payload.images,
				payload.reference_images,
				payload.frames,
			].flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean);

			const jobConfig = {
				prompt,
				negative_prompt: String(payload.negative_prompt || ''),
				output_path: outputPath,
				width: outputSize.width,
				height: outputSize.height,
				aspect_ratio: aspectRatio,
				steps,
				true_cfg_scale: guidanceScale,
				guidance_scale: guidanceScale,
				seed,
				precision,
				cpu_offload: (modelProfile.gpu_only_precisions || []).includes(precision) ? false : current.cpu_offload !== false,
				vae_tiling: current.vae_tiling !== false,
				reference_images: referenceImages,
				model_id: modelId,
				model_path: modelProfile.repo_id,
				local_files_only: true,
			};

			try {
				const referencePaths = Array.isArray(payload.referenced_image_paths) ? payload.referenced_image_paths.filter(Boolean) : [];
				if (rawImages.length + referencePaths.length > modelProfile.reference_images_max) {
					return { success: false, category: 'validation', code: 'local_image_reference_limit', message: modelProfile.reference_images_unsupported_message || `${modelProfile.label} accepts at most ${modelProfile.reference_images_max} reference image${modelProfile.reference_images_max === 1 ? '' : 's'}.` };
				}
				for (const item of rawImages) {
					const image = decodeReferenceImage(item);
					if (!image) {
						return { success: false, category: 'validation', code: 'local_image_reference_invalid', message: 'Inline image references must be PNG, JPEG, or WebP data URLs or { b64_json, mime_type } objects smaller than 20 MB. Use referenced_image_paths for local files.' };
					}
					const destination = path.join(workdir, `reference-image-${referenceImages.length + 1}${image.extension}`);
					fs.writeFileSync(destination, image.bytes, { flag: 'wx' });
					referenceImages.push(destination);
				}
				for (const source of referencePaths) {
					let resolved;
					let bytes;
					try {
						resolved = path.resolve(String(source).trim());
						const extension = path.extname(resolved).toLowerCase();
						const stat = fs.statSync(resolved);
						if (!IMAGE_REFERENCE_EXTENSIONS.has(extension) || !stat.isFile() || stat.size > MAX_IMAGE_REFERENCE_BYTES) {
							return { success: false, category: 'validation', code: 'local_image_reference_invalid', message: 'Image reference paths must point to PNG, JPEG, or WebP files no larger than 20 MB.' };
						}
						bytes = fs.readFileSync(resolved);
					} catch (error) {
						return { success: false, category: 'validation', code: 'local_image_reference_invalid', message: 'An image reference path could not be read.' };
					}
					if (!bytes.length || bytes.length > MAX_IMAGE_REFERENCE_BYTES) {
						return { success: false, category: 'validation', code: 'local_image_reference_invalid', message: 'Image reference paths must point to PNG, JPEG, or WebP files no larger than 20 MB.' };
					}
					const destination = path.join(workdir, `reference-image-${referenceImages.length + 1}${path.extname(resolved).toLowerCase()}`);
					fs.writeFileSync(destination, bytes, { flag: 'wx' });
					referenceImages.push(destination);
				}
				jobConfig.reference_images = referenceImages;
				fs.writeFileSync(jobPath, JSON.stringify(jobConfig));
				const venvPython = state.python;
				const timeoutMs = imageJobTimeoutMs(payload, modelProfile, outputSize);

				const result = await new Promise((resolve) => {
					const stdoutCollector = createBoundedCollector({ maxChars: 1024 * 1024 });
					const stderrCollector = createBoundedCollector({ maxChars: 1024 * 1024 });
					let settled = false;
					let timeout = null;
					let stopReason = '';
					let removeAbort = () => {};

					const child = spawnJob(venvPython, [runner, '--job-json', jobPath], {
						shell: false,
						windowsHide: true,
						stdio: ['ignore', 'pipe', 'pipe'],
						env: { ...env, PYTHONUNBUFFERED: '1' },
					});

					const settle = (val) => {
						if (settled) return;
						settled = true;
						if (timeout) clearTimeout(timeout);
						removeAbort();
						resolve(val);
					};

					const requestStop = (reason) => {
						if (settled || stopReason) return;
						stopReason = reason;
						killProcessTree(child);
					};

					timeout = setTimeout(() => requestStop('timeout'), timeoutMs);
					const onAbort = () => requestStop('cancelled');
					if (session.signal) {
						if (session.signal.aborted) onAbort();
						else {
							session.signal.addEventListener('abort', onAbort, { once: true });
							removeAbort = () => session.signal.removeEventListener('abort', onAbort);
						}
					}

					child.stdout.on('data', (chunk) => {
						stdoutCollector.append(String(chunk));
						if (typeof session.appendSessionOutput === 'function') session.appendSessionOutput('stdout', String(chunk));
					});
					child.stderr.on('data', (chunk) => {
						stderrCollector.append(String(chunk));
						if (typeof session.appendSessionOutput === 'function') session.appendSessionOutput('stderr', String(chunk));
					});
					child.on('error', (error) => settle({ error, stdout: stdoutCollector.value(), stderr: stderrCollector.value() }));
					child.on('close', (status) => {
						const stdout = stdoutCollector.value();
						const stderr = stderrCollector.value();
						if (stopReason === 'cancelled') settle({ cancelled: true, stdout, stderr });
						else if (stopReason === 'timeout') settle({ timeout: true, stdout, stderr });
						else settle({ status, stdout, stderr });
					});
				});

				if (result.cancelled) {
					return { success: false, category: 'cancelled', code: 'local_image_cancelled', message: 'Local image generation job was cancelled.' };
				}
				if (result.timeout) {
					return { success: false, category: 'timeout', code: 'local_image_timeout', message: `Local image generation timed out after ${Math.round(timeoutMs / 1000)} seconds.` };
				}
				if (result.error || result.status !== 0) {
					let parsedErr = null;
					try {
						parsedErr = JSON.parse(String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
					} catch (e) {}
					return {
						success: false,
						category: 'runtime',
						code: (parsedErr && parsedErr.code) || 'local_image_failed',
						message: (parsedErr && parsedErr.message) || 'Image generation script failed.',
						details: { stdout: result.stdout, stderr: result.stderr },
					};
				}

				if (!fs.existsSync(outputPath)) {
					return { success: false, category: 'runtime', code: 'local_image_output_missing', message: 'The image generation script completed but the output image file is missing.' };
				}

				const imageBytes = fs.readFileSync(outputPath);
				const b64 = imageBytes.toString('base64');
				let parsed = {};
				try {
					parsed = JSON.parse(String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
				} catch (e) {}

				return {
					success: true,
					response: {
						data: [
							{
								b64_json: b64,
								mime_type: 'image/png',
							},
						],
						provider_details: {
							provider: 'local-image',
							model: modelId,
							width: parsed.width,
							height: parsed.height,
							format: 'image/png',
							mode: parsed.mode || 'RGB',
							precision,
							steps,
						},
					},
				};
			} finally {
				try {
					fs.rmSync(workdir, { recursive: true, force: true });
				} catch (cleanupErr) {}
			}
		},
	};
}

module.exports = {
	DEFAULT_VENV_PATH,
	MODELS,
	QWEN_IMAGE_ASPECT_CHOICES,
	QWEN_IMAGE_RESOLUTION_CHOICES,
	QWEN_IMAGE_SIZE_TABLE,
	QWEN_IMAGE_2512_SIZE_TABLE,
	QWEN_IMAGE_2512_RESOLUTION_CHOICES,
	QWEN_IMAGE_TEST_OPTIONS,
	QWEN_IMAGE_CAPABILITIES,
	QWEN_IMAGE_2512_TEST_OPTIONS,
	QWEN_IMAGE_2512_CAPABILITIES,
	SANA_RESOLUTION_CHOICES,
	SANA_TEST_OPTIONS,
	SANA_CAPABILITIES,
	createLocalImageDriver,
	imageJobTimeoutMs,
	parseWxH,
	probeRunnerStatus,
	publicSettings,
	resolveOutputSize,
	runnerPath,
	saveSettings,
	settings,
	setup,
	sizeFromAspect,
	validateRunnerProbe,
};
