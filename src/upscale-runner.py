#!/usr/bin/env python3
"""CUDA-only adapter for explicitly installed official SwinIR/Real-ESRGAN.

This file neither downloads models nor falls back to CPU. The desktop Relay
validates the model checksum before this runner starts. The supplied model
checkout is an operator-installed, pinned dependency.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def fail(code, message):
    print(json.dumps({"success": False, "code": code, "message": message}))
    raise SystemExit(2)


def sha256_file(source):
    digest = hashlib.sha256()
    with open(source, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_png(root, modified_after):
    candidates = [candidate for candidate in Path(root).rglob("*.png") if candidate.is_file() and candidate.stat().st_mtime >= modified_after - 1]
    if not candidates:
        return None
    return max(candidates, key=lambda candidate: candidate.stat().st_mtime)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-json", required=True)
    args = parser.parse_args()
    try:
        job = json.loads(Path(args.job_json).read_text(encoding="utf-8"))
    except Exception:
        fail("job_invalid", "The local upscale job manifest is invalid.")
    try:
        import torch
        from PIL import Image
    except Exception:
        fail("runtime_missing", "Install the configured Python runtime with torch and Pillow before local upscaling.")
    cuda = getattr(torch, "cuda", None)
    if cuda is None or not callable(getattr(cuda, "is_available", None)):
        sys.stderr.write(
            "Incomplete torch import for local upscale: "
            f"python={sys.executable}; torch={getattr(torch, '__file__', '<unknown>')}; "
            f"version={getattr(torch, '__version__', '<unknown>')}\n"
        )
        fail("cuda_runtime_invalid", "The configured PyTorch runtime has no CUDA interface; local upscale refuses CPU fallback.")
    if not cuda.is_available():
        fail("cuda_unavailable", "CUDA is unavailable; local upscale refuses CPU fallback.")
    source = Path(job.get("source_path", ""))
    output = Path(job.get("output_path", ""))
    model = job.get("model", {})
    crop = job.get("crop", {})
    target = job.get("target_print", {})
    if not source.is_file() or not model.get("manifest_valid") or not Path(model.get("model_path", "")).is_file():
        fail("model_not_ready", "Pinned local model or source file is unavailable.")
    expected = str(model.get("expected_checksum", "")).lower()
    if not expected or sha256_file(model["model_path"]) != expected:
        fail("model_checksum_mismatch", "Pinned model checksum did not match; local upscale was not started.")
    width = int(target.get("width", 0)); height = int(target.get("height", 0))
    if width < 1 or height < 1 or int(job.get("scale", 0)) != 2:
        fail("target_invalid", "Local upscale requires a profile target and exactly x2 scale.")
    started = datetime.now(timezone.utc).isoformat()
    with tempfile.TemporaryDirectory(prefix="ai-model-relay-crop-") as temp:
        crop_source = Path(temp) / "crop.png"
        result_root = Path(temp) / "result"
        with Image.open(source) as image:
            left = round(float(crop.get("x", -1)) * image.width)
            top = round(float(crop.get("y", -1)) * image.height)
            right = round((float(crop.get("x", -1)) + float(crop.get("width", 0))) * image.width)
            bottom = round((float(crop.get("y", -1)) + float(crop.get("height", 0))) * image.height)
            if left < 0 or top < 0 or right <= left or bottom <= top or right > image.width or bottom > image.height:
                fail("crop_invalid", "The approved crop is outside the source image.")
            image.crop((left, top, right, bottom)).convert("RGB").save(crop_source, "PNG")
        root = Path(model.get("root", ""))
        if model.get("engine") == "swinir":
            script = root / "main_test_swinir.py"
            # Recent PyTorch releases default torch.load to ``weights_only``.
            # SwinIR's official legacy checkpoint is not compatible with that
            # restricted unpickler. The runner has already verified the exact
            # model SHA-256 above, so invoke the unmodified official script
            # through a narrowly-scoped compatibility launcher for that one
            # trusted weight file instead of editing the checkout or allowing
            # arbitrary unverified pickles.
            swinir_launcher = (
                "import runpy, sys, torch\n"
                "_trusted_load = torch.load\n"
                "def load_verified_weight(*args, **kwargs):\n"
                "    kwargs['weights_only'] = False\n"
                "    return _trusted_load(*args, **kwargs)\n"
                "torch.load = load_verified_weight\n"
                "sys.argv = sys.argv[1:]\n"
                "runpy.run_path(sys.argv[0], run_name='__main__')\n"
            )
            command = [sys.executable, "-c", swinir_launcher, str(script), "--task", "classical_sr", "--scale", "2", "--training_patch_size", "64", "--model_path", str(model["model_path"]), "--folder_lq", str(crop_source.parent), "--tile", str(int(job.get("tile", 512))), "--tile_overlap", "32"]
        elif model.get("engine") == "realesrgan":
            script = root / "inference_realesrgan.py"
            # The official CLI otherwise resolves a default weight and may
            # download it when it is missing.  Always provide the checksum-
            # verified, operator-installed file that was included in this job.
            # BasicSR still imports torchvision.transforms.functional_tensor,
            # removed by current CUDA Torchvision releases.  Provide that
            # compatibility module only to the checked-out, checksum-verified
            # official CLI; this neither changes the checkout nor enables CPU.
            realesrgan_launcher = (
                "import runpy, sys, torchvision.transforms.functional as functional\n"
                "sys.modules['torchvision.transforms.functional_tensor'] = functional\n"
                "sys.argv = sys.argv[1:]\n"
                "runpy.run_path(sys.argv[0], run_name='__main__')\n"
            )
            command = [sys.executable, "-c", realesrgan_launcher, str(script), "-n", "RealESRGAN_x2plus", "--model_path", str(model["model_path"]), "-i", str(crop_source), "-o", str(result_root), "--outscale", "2", "--tile", str(int(job.get("tile", 512))), "--gpu-id", str(int(job.get("cuda_device", 0))), "--ext", "png"]
            if str(job.get("precision", "fp16")) != "fp16":
                command.append("--fp32")
        else:
            fail("model_invalid", "The configured local upscale engine is unsupported.")
        if not script.is_file():
            fail("runner_checkout_missing", "Install the configured official model checkout before local upscaling.")
        engine_started_at = datetime.now(timezone.utc).timestamp()
        timeout_seconds = max(1, int(job.get("timeout_seconds", 1800)))
        try:
            completed = subprocess.run(command, cwd=str(root), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout_seconds, check=False)
        except subprocess.TimeoutExpired:
            fail("engine_timeout", "The CUDA model runner timed out; source bytes were preserved.")
        if completed.returncode != 0:
            # Preserve the Relay's opaque, safe failure response while making
            # the bounded official-runner diagnostics available in the local
            # status UI.  Without this, an engine exit only reports
            # `engine_failed` and makes an installed CUDA model impossible to
            # diagnose.  The parent Relay already bounds captured stderr.
            if completed.stdout:
                sys.stderr.write(completed.stdout[-8000:])
            if completed.stderr:
                sys.stderr.write(completed.stderr[-8000:])
            fail("engine_failed", "The CUDA model runner failed; source bytes were preserved.")
        generated = find_png(result_root, engine_started_at) or find_png(root / "results", engine_started_at)
        if generated is None:
            fail("engine_output_missing", "The CUDA model runner did not write a PNG result.")
        with Image.open(generated) as image:
            image.convert("RGB").resize((width, height), Image.Resampling.LANCZOS).save(output, "PNG", optimize=True)
    finished = datetime.now(timezone.utc).isoformat()
    device = torch.cuda.get_device_name(int(job.get("cuda_device", 0)))
    print(json.dumps({"success": True, "output": {"width": width, "height": height}, "provenance": {"model_id": model["id"], "model_version": "operator-installed-official", "weight_checksum": expected, "cuda_device": device, "precision": str(job.get("precision", "fp16")), "tile": int(job.get("tile", 512)), "downsampler": "lanczos", "processing_started_at": started, "processing_finished_at": finished}}))


if __name__ == "__main__":
    main()
