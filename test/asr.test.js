'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const asr = require('../src/asr');

function createQwenSnapshot(snapshot) {
	fs.mkdirSync(snapshot, { recursive: true });
	for (const file of ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer_config.json', 'vocab.json', 'merges.txt', 'model.safetensors']) {
		fs.writeFileSync(path.join(snapshot, file), '{}');
	}
}

(async () => {
	const config = asr.normalizeSettings({
		allow_model_downloads: false,
		models: [
			{ id: 'whisper-large-v3', enabled: true, min_vram_mb: 8192, repo_id: 'org/large', gpu_repo_id: 'org/large-gpu' },
			{ id: 'whisper-small', enabled: true, min_vram_mb: 1024, repo_id: 'org/small' },
			{ id: 'disabled', enabled: false, repo_id: 'org/disabled' },
		],
	});
	assert.strictEqual(config.allow_package_install, true);
	assert.strictEqual(config.allow_model_downloads, false);
	assert.strictEqual(config.allow_qwen_cpu_offload, true);
	assert.strictEqual(config.qwen_chunk_seconds, 30);
	assert.strictEqual(config.qwen_max_word_duration_seconds, 12);
	assert.ok(config.models.find((model) => model.id === 'whisper-medium'));
	assert.strictEqual(config.models.find((model) => model.id === 'qwen3-asr-1.7b').provider, 'qwen-asr');
	assert.strictEqual(config.models.find((model) => model.id === 'qwen3-asr-0.6b').provider, 'qwen-asr');
	assert.ok(asr.modelIds(config).includes('local-asr:whisper-large-v3'));
	assert.ok(asr.modelIds(config).includes('local-asr:qwen3-asr-1.7b'));
	assert.ok(asr.modelIds(config).includes('local-asr:qwen3-asr-0.6b'));
	assert.ok(!asr.modelIds(config).includes('local-asr:qwen3-forced-aligner-0.6b'));
	assert.ok(asr.transcriptionModels(config).every((model) => model.provider !== 'qwen-aligner'));
	assert.ok(!asr.enabledModels(config).some((model) => model.id === 'disabled'));

	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asr-cache-test-'));
	const oldCache = process.env.HUGGINGFACE_HUB_CACHE;
	process.env.HUGGINGFACE_HUB_CACHE = tmp;
	try {
		const snapshot = path.join(tmp, 'models--org--large-gpu', 'snapshots', 'abc123');
		fs.mkdirSync(snapshot, { recursive: true });
		const qwenSnapshot = path.join(tmp, 'models--Qwen--Qwen3-ASR-1.7B', 'snapshots', 'qwen123');
		const qwenSmallSnapshot = path.join(tmp, 'models--Qwen--Qwen3-ASR-0.6B', 'snapshots', 'qwenSmall123');
		const qwenAlignerSnapshot = path.join(tmp, 'models--Qwen--Qwen3-ForcedAligner-0.6B', 'snapshots', 'aligner123');
		createQwenSnapshot(qwenSnapshot);
		createQwenSnapshot(qwenSmallSnapshot);
		createQwenSnapshot(qwenAlignerSnapshot);
		const selected = asr.selectModel('local-asr:whisper-large-v3', config, {
			gpu: { available: true, free_mb: 12288, total_mb: 12288 },
		});
		assert.strictEqual(selected.model_id, 'local-asr:whisper-large-v3');
		assert.strictEqual(selected.device, 'cuda');
		assert.strictEqual(selected.compute_type, 'float16');
		assert.strictEqual(selected.model_path, snapshot);

		const cpuSelected = asr.selectModel('local-asr:whisper-large-v3', config, {
			gpu: { available: true, free_mb: 2048, total_mb: 12288 },
		});
		assert.strictEqual(cpuSelected.device, 'cpu');
		assert.strictEqual(cpuSelected.compute_type, 'int8');
		assert.strictEqual(cpuSelected.model_path, '');

		const blockedCuda = asr.selectModel('local-asr:whisper-large-v3', config, {
			gpu: { available: true, free_mb: 12288, total_mb: 12288 },
			cuda_runtime: { available: false, reason: 'missing cublas64_12.dll' },
		});
		assert.strictEqual(blockedCuda.device, 'cpu');
		assert.strictEqual(blockedCuda.cuda_blocked_reason, 'missing cublas64_12.dll');

		const qwenSelected = asr.selectModel('local-asr', config, {
			gpu: { available: true, free_mb: 12288, total_mb: 12288 },
		});
		assert.strictEqual(qwenSelected.model_id, 'local-asr:qwen3-asr-1.7b');
		assert.strictEqual(qwenSelected.provider, 'qwen-asr');
		assert.strictEqual(qwenSelected.device, 'cuda');
		assert.strictEqual(qwenSelected.model_path, qwenSnapshot);
		assert.strictEqual(qwenSelected.aligner_model_path, qwenAlignerSnapshot);
		assert.strictEqual(qwenSelected.ready, true);

		const defaultWhisperConfig = asr.normalizeSettings({ ...config, default_model: 'local-asr:whisper-large-v3' });
		const defaultWhisper = asr.selectModel('local-asr', defaultWhisperConfig, {
			gpu: { available: true, free_mb: 12288, total_mb: 12288 },
		});
		assert.strictEqual(defaultWhisper.model_id, 'local-asr:whisper-large-v3');
		assert.strictEqual(defaultWhisper.model_path, snapshot);

		const qwenOffloadSelected = asr.selectModel('local-asr:qwen3-asr-1.7b', config, {
			gpu: { available: true, free_mb: 7370, total_mb: 12288 },
		});
		assert.strictEqual(qwenOffloadSelected.model_id, 'local-asr:qwen3-asr-1.7b');
		assert.strictEqual(qwenOffloadSelected.device, 'cuda+cpu');
		assert.strictEqual(qwenOffloadSelected.device_map, 'auto');
		assert.strictEqual(qwenOffloadSelected.cpu_offload, true);
		assert.strictEqual(qwenOffloadSelected.ready, true);

		const noOffloadConfig = asr.normalizeSettings({ ...config, allow_qwen_cpu_offload: false });
		const qwenNoOffloadSelected = asr.selectModel('local-asr:qwen3-asr-1.7b', noOffloadConfig, {
			gpu: { available: true, free_mb: 7370, total_mb: 12288 },
		});
		assert.strictEqual(qwenNoOffloadSelected.ready, false);
		assert.ok(qwenNoOffloadSelected.cuda_blocked_reason.includes('insufficient free VRAM'));

		const qwenSmallSelected = asr.selectModel('local-asr', config, {
			gpu: { available: true, free_mb: 6740, total_mb: 8192 },
		});
		assert.strictEqual(qwenSmallSelected.model_id, 'local-asr:qwen3-asr-0.6b');
		assert.strictEqual(qwenSmallSelected.provider, 'qwen-asr');
		assert.strictEqual(qwenSmallSelected.cpu_offload, false);
		assert.strictEqual(qwenSmallSelected.model_path, qwenSmallSnapshot);
		assert.strictEqual(qwenSmallSelected.aligner_model_path, qwenAlignerSnapshot);
		assert.strictEqual(qwenSmallSelected.ready, true);

		const qwenBlocked = asr.selectModel('local-asr:qwen3-asr-1.7b', config, {
			gpu: { available: false },
		});
		assert.strictEqual(qwenBlocked.provider, 'qwen-asr');
		assert.strictEqual(qwenBlocked.ready, false);
		assert.ok(qwenBlocked.cuda_blocked_reason.includes('GPU'));

		fs.rmSync(qwenSnapshot, { recursive: true, force: true });
		const autoSkipsAligner = asr.selectModel('local-asr', config, {
			gpu: { available: true, free_mb: 12288, total_mb: 12288 },
		});
		assert.notStrictEqual(autoSkipsAligner.provider, 'qwen-aligner');

		fs.rmSync(path.join(qwenSmallSnapshot, 'preprocessor_config.json'), { force: true });
		const incompleteQwen = asr.selectModel('local-asr:qwen3-asr-0.6b', config, {
			gpu: { available: true, free_mb: 6740, total_mb: 8192 },
		});
		assert.strictEqual(incompleteQwen.model_path, '');
		assert.strictEqual(incompleteQwen.incomplete_model_path, qwenSmallSnapshot);
		assert.ok(incompleteQwen.incomplete_model_missing_files.includes('preprocessor_config.json'));

		const downloadConfig = asr.normalizeSettings({ ...config, allow_model_downloads: true });
		const incompleteDownloadableQwen = asr.selectModel('local-asr:qwen3-asr-0.6b', downloadConfig, {
			gpu: { available: true, free_mb: 6740, total_mb: 8192 },
		});
		assert.strictEqual(incompleteDownloadableQwen.model_path, 'Qwen/Qwen3-ASR-0.6B');
		assert.strictEqual(incompleteDownloadableQwen.allow_download, true);

		const downloadable = asr.selectModel('local-asr:whisper-small', downloadConfig, {
			gpu: { available: false },
		});
		assert.strictEqual(downloadable.allow_download, true);
		assert.strictEqual(downloadable.model_path, 'org/small');
	} finally {
		if (oldCache === undefined) {
			delete process.env.HUGGINGFACE_HUB_CACHE;
		} else {
			process.env.HUGGINGFACE_HUB_CACHE = oldCache;
		}
	}

	const unknown = asr.selectModel('local-asr:not-real', config, { gpu: { available: false } });
	assert.ok(unknown.error);
	assert.strictEqual(asr.torchCudaInfo('').available, false);
	assert.strictEqual(asr.torchCudaInfo('').reason, 'venv_missing');

	asr.invalidateProbeCache();
	const lightCapabilities = asr.capabilities();
	assert.strictEqual(lightCapabilities.runtime_checked, false);
	assert.strictEqual(lightCapabilities.runtime.checked, false);
	assert.strictEqual(lightCapabilities.ready, null);

	const lightModels = asr.models();
	assert.ok(lightModels.models.includes('local-asr'));
	assert.ok(!lightModels.models.includes('local-asr:qwen3-forced-aligner-0.6b'));
	assert.ok(!Object.prototype.hasOwnProperty.call(lightModels.labels, 'local-asr:qwen3-forced-aligner-0.6b'));

	const refreshedCapabilities = asr.capabilities({ refresh: true });
	assert.strictEqual(refreshedCapabilities.runtime_checked, true);
	assert.strictEqual(refreshedCapabilities.runtime.checked, true);
	assert.ok(Object.prototype.hasOwnProperty.call(refreshedCapabilities.runtime, 'ffmpeg_available'));

	const cachedCapabilities = asr.capabilities();
	assert.strictEqual(cachedCapabilities.runtime_checked, true);
	assert.strictEqual(cachedCapabilities.runtime_cached, true);
})();
