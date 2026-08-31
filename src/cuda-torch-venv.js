'use strict';

const path = require('path');
const { spawn, spawnSync } = require('child_process');

const TORCH_PROBE = 'import json,torch; info={"available":bool(torch.cuda.is_available()),"version":getattr(torch,"__version__",""),"cuda_version":getattr(getattr(torch,"version",None),"cuda",None),"device_count":int(torch.cuda.device_count()) if hasattr(torch,"cuda") else 0}; print(json.dumps(info)); raise SystemExit(0 if info["available"] else 1)';
const CUDA_TORCH_CONSTRAINT_FILENAME = 'cuda-torch-constraint.txt';
const DEFAULT_TORCH_INDEX = process.env.AI_MODEL_RELAY_UPSCALE_TORCH_INDEX_URL || process.env.ALORBACH_QWEN_TORCH_INDEX_URL || 'https://download.pytorch.org/whl/cu128';

function parseTorchProbe(result) {
	let probe = {};
	try { probe = JSON.parse(String(result && result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}'); } catch (error) { probe = {}; }
	const version = String(probe.version || '').toLowerCase();
	const cpuWheel = version.includes('+cpu') || (!probe.cuda_version && version && !probe.available);
	const ok = !cpuWheel && !!(result && !result.error && result.status === 0 && probe.available);
	return { probe, version, cpuWheel, ok };
}

function torchConstraintText(freezeStdout, probeVersion) {
	const pinned = String(freezeStdout || '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => /^(torch|torchvision|torchaudio)==/i.test(line));
	if (pinned.length) return `${pinned.join('\n')}\n`;
	const version = String(probeVersion || '').trim();
	return version ? `torch==${version}\n` : '';
}

function constraintPath(venvPath) {
	return path.join(venvPath, CUDA_TORCH_CONSTRAINT_FILENAME);
}

async function evaluateCudaTorch(run, venvPython, emit, options = {}) {
	const indexUrl = options.indexUrl || DEFAULT_TORCH_INDEX;
	const cuda = await run(venvPython, ['-c', TORCH_PROBE], { timeout: Number(options.probeTimeout || 60000), onOutput: emit });
	const parsed = parseTorchProbe(cuda);
	const extras = {
		python: venvPython,
		python_version: options.pythonVersion || '',
		index_url: indexUrl,
		torch: parsed.probe,
	};
	if (parsed.cpuWheel) {
		return {
			success: false,
			code: options.cpuTorchCode || 'cuda_torch_cpu_wheel',
			message: options.cpuTorchMessage || `pip installed a CPU PyTorch wheel (${parsed.probe.version || parsed.version}) instead of a CUDA build from ${indexUrl}.`,
			result: cuda,
			extras,
		};
	}
	if (!parsed.ok) {
		return {
			success: false,
			code: options.cudaUnavailableCode || 'cuda_torch_unavailable',
			message: options.cudaUnavailableMessage || `CUDA PyTorch ${parsed.probe.version || ''} is installed but torch.cuda is not usable (CUDA ${parsed.probe.cuda_version || 'missing'}).`,
			result: cuda,
			extras,
		};
	}
	return { success: true, torch: parsed.probe };
}

function probeTorchStatus(python) {
	if (!python) return { ok: false, state: 'python_missing', version: '', probe: {} };
	try {
		const fs = require('fs');
		if (!fs.existsSync(python)) return { ok: false, state: 'python_missing', version: '', probe: {} };
		const result = spawnSync(python, ['-c', TORCH_PROBE], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 15000 });
		const parsed = parseTorchProbe(result);
		if (parsed.cpuWheel) return { ok: false, state: 'cpu_torch', version: parsed.version, probe: parsed.probe };
		if (!parsed.ok) return { ok: false, state: 'cuda_unavailable', version: parsed.version, probe: parsed.probe };
		return { ok: true, state: 'cuda', version: parsed.version, probe: parsed.probe };
	} catch (error) {
		return { ok: false, state: 'torch_probe_failed', version: '', probe: {} };
	}
}

function killProcessTree(child) {
	if (!child || !child.pid) return;
	try {
		if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
		else child.kill('SIGKILL');
	} catch (error) {}
}

module.exports = {
	TORCH_PROBE,
	CUDA_TORCH_CONSTRAINT_FILENAME,
	DEFAULT_TORCH_INDEX,
	constraintPath,
	evaluateCudaTorch,
	killProcessTree,
	parseTorchProbe,
	probeTorchStatus,
	torchConstraintText,
};
