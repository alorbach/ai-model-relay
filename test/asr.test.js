'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const asr = require('../src/asr');

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
	assert.ok(config.models.find((model) => model.id === 'whisper-medium'));
	assert.ok(asr.modelIds(config).includes('codex-local:audio:whisper-large-v3'));
	assert.ok(!asr.enabledModels(config).some((model) => model.id === 'disabled'));

	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asr-cache-test-'));
	const oldCache = process.env.HUGGINGFACE_HUB_CACHE;
	process.env.HUGGINGFACE_HUB_CACHE = tmp;
	try {
		const snapshot = path.join(tmp, 'models--org--large-gpu', 'snapshots', 'abc123');
		fs.mkdirSync(snapshot, { recursive: true });
		const selected = asr.selectModel('codex-local:audio:whisper-large-v3', config, {
			gpu: { available: true, free_mb: 12288, total_mb: 12288 },
		});
		assert.strictEqual(selected.model_id, 'codex-local:audio:whisper-large-v3');
		assert.strictEqual(selected.device, 'cuda');
		assert.strictEqual(selected.compute_type, 'float16');
		assert.strictEqual(selected.model_path, snapshot);

		const cpuSelected = asr.selectModel('codex-local:audio:whisper-large-v3', config, {
			gpu: { available: true, free_mb: 2048, total_mb: 12288 },
		});
		assert.strictEqual(cpuSelected.device, 'cpu');
		assert.strictEqual(cpuSelected.compute_type, 'int8');
		assert.strictEqual(cpuSelected.model_path, '');

		const blockedCuda = asr.selectModel('codex-local:audio:whisper-large-v3', config, {
			gpu: { available: true, free_mb: 12288, total_mb: 12288 },
			cuda_runtime: { available: false, reason: 'missing cublas64_12.dll' },
		});
		assert.strictEqual(blockedCuda.device, 'cpu');
		assert.strictEqual(blockedCuda.cuda_blocked_reason, 'missing cublas64_12.dll');

		const downloadConfig = asr.normalizeSettings({ ...config, allow_model_downloads: true });
		const downloadable = asr.selectModel('codex-local:audio:whisper-small', downloadConfig, {
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

	const unknown = asr.selectModel('codex-local:audio:not-real', config, { gpu: { available: false } });
	assert.ok(unknown.error);

	asr.invalidateProbeCache();
	const lightCapabilities = asr.capabilities();
	assert.strictEqual(lightCapabilities.runtime_checked, false);
	assert.strictEqual(lightCapabilities.runtime.checked, false);
	assert.strictEqual(lightCapabilities.ready, null);

	const lightModels = asr.models();
	assert.ok(lightModels.models.includes('codex-local:audio'));

	const refreshedCapabilities = asr.capabilities({ refresh: true });
	assert.strictEqual(refreshedCapabilities.runtime_checked, true);
	assert.strictEqual(refreshedCapabilities.runtime.checked, true);
	assert.ok(Object.prototype.hasOwnProperty.call(refreshedCapabilities.runtime, 'ffmpeg_available'));

	const cachedCapabilities = asr.capabilities();
	assert.strictEqual(cachedCapabilities.runtime_checked, true);
	assert.strictEqual(cachedCapabilities.runtime_cached, true);
})();
