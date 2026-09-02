#!/usr/bin/env python3
"""CUDA-only adapter for explicitly installed official local upscalers.

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


def load_verified_state(torch, model_path):
    try:
        checkpoint = torch.load(str(model_path), map_location="cpu", weights_only=True)
    except TypeError:
        checkpoint = torch.load(str(model_path), map_location="cpu")
    if isinstance(checkpoint, dict):
        checkpoint = checkpoint.get("params_ema") or checkpoint.get("params") or checkpoint.get("state_dict") or checkpoint
    if not isinstance(checkpoint, dict):
        fail("weight_invalid", "The verified model checkpoint does not contain a state dictionary.")
    return {str(key).replace("module.", "", 1): value for key, value in checkpoint.items()}


def run_tiled_tensor_model(torch, image, model, root, crop_source, output_path, scale, tile, precision):
    """Direct, checksum-gated adapters for HAT-S, DRCT and APISR.

    They use only the Relay-passed pinned checkout and weight. Tiling is done
    before inference and outputs are stitched at native scale; no resize path
    exists in this adapter.
    """
    from PIL import Image
    sys.path.insert(0, str(root))
    if model.get("engine") == "hat-s":
        from hat.archs.hat_arch import HAT
        network = HAT(upscale=scale, in_chans=3, img_size=64, window_size=16, compress_ratio=24, squeeze_factor=24, conv_scale=0.01, overlap_ratio=0.5, img_range=1., depths=[6, 6, 6, 6, 6, 6], embed_dim=144, num_heads=[6, 6, 6, 6, 6, 6], mlp_ratio=2, upsampler="pixelshuffle", resi_connection="1conv")
    elif model.get("engine") == "drct":
        from drct.archs.drct_arch import DRCT
        network = DRCT(upscale=scale, in_chans=3, img_size=64, window_size=16, compress_ratio=3, squeeze_factor=30, conv_scale=0.01, overlap_ratio=0.5, img_range=1., depths=[6, 6, 6, 6, 6, 6], embed_dim=180, num_heads=[6, 6, 6, 6, 6, 6], mlp_ratio=2, upsampler="pixelshuffle", resi_connection="1conv")
    elif model.get("engine") == "apisr":
        from test_code.test_utils import load_rrdb
        network = load_rrdb(str(model["model_path"]), scale).eval()
    else:
        fail("model_invalid", "The configured local upscale engine is unsupported.")
    if model.get("engine") != "apisr":
        network.load_state_dict(load_verified_state(torch, model["model_path"]), strict=True)
    device = torch.device("cuda:" + str(int(model.get("cuda_device", 0))))
    network = network.to(device).eval()
    array = __import__("numpy").asarray(image.convert("RGB")).copy()
    tensor = torch.from_numpy(array).permute(2, 0, 1).unsqueeze(0).float().div(255.).to(device)
    height, width = tensor.shape[-2:]
    tile = max(16, int(tile))
    output = torch.zeros((1, 3, height * scale, width * scale), device=device)
    weights = torch.zeros_like(output)
    autocast = torch.autocast(device_type="cuda", dtype=torch.float16, enabled=str(precision) == "fp16")
    with torch.inference_mode(), autocast:
        for top in range(0, height, tile):
            for left in range(0, width, tile):
                bottom = min(top + tile, height); right = min(left + tile, width)
                patch = tensor[:, :, top:bottom, left:right]
                generated = network(patch).clamp_(0, 1)
                if generated.shape[-2:] != ((bottom - top) * scale, (right - left) * scale):
                    fail("engine_output_invalid", "The CUDA model adapter did not produce its declared native scale.")
                output[:, :, top * scale:bottom * scale, left * scale:right * scale] += generated
                weights[:, :, top * scale:bottom * scale, left * scale:right * scale] += 1
    output = (output / weights).clamp_(0, 1).squeeze(0).permute(1, 2, 0).mul(255).byte().cpu().numpy()
    Image.fromarray(output, "RGB").save(output_path, "PNG", optimize=True)


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
    crop_pixels = job.get("crop_pixels", {})
    target = job.get("target_print", {})
    output_print = job.get("output_print", {})
    if not source.is_file() or not model.get("manifest_valid") or not Path(model.get("model_path", "")).is_file():
        fail("model_not_ready", "Pinned local model or source file is unavailable.")
    expected = str(model.get("expected_checksum", "")).lower()
    if not expected or sha256_file(model["model_path"]) != expected:
        fail("model_checksum_mismatch", "Pinned model checksum did not match; local upscale was not started.")
    expected_commit = str(model.get("expected_commit", "")).strip().lower()
    if len(expected_commit) != 40:
        fail("checkout_unpinned", "The official model checkout is not pinned to a git commit.")
    marker = Path(model.get("root", "")) / ".ai-model-relay-commit"
    actual_commit = marker.read_text(encoding="utf-8").strip().lower() if marker.is_file() else ""
    if actual_commit != expected_commit:
        fail("checkout_mismatch", "The official model checkout is not the pinned git commit.")
    minimum_width = int(target.get("width", 0)); minimum_height = int(target.get("height", 0))
    width = int(output_print.get("width", 0)); height = int(output_print.get("height", 0))
    native_scale = int(model.get("native_scale", 0))
    native_policy = "retain_native_x" + str(native_scale)
    if native_scale not in (2, 4) or minimum_width < 1 or minimum_height < 1 or width < minimum_width or height < minimum_height or int(job.get("scale", 0)) != native_scale or str(job.get("output_policy", "")) != native_policy:
        fail("target_invalid", "Local upscale requires a profile target and its approved native scale output contract.")
    started = datetime.now(timezone.utc).isoformat()
    with tempfile.TemporaryDirectory(prefix="ai-model-relay-crop-") as temp:
        crop_source = Path(temp) / "crop.png"
        result_root = Path(temp) / "result"
        with Image.open(source) as image:
            left = int(crop_pixels.get("left", -1)); top = int(crop_pixels.get("top", -1))
            right = int(crop_pixels.get("right", -1)); bottom = int(crop_pixels.get("bottom", -1))
            if left < 0 or top < 0 or right <= left or bottom <= top or right > image.width or bottom > image.height:
                fail("crop_invalid", "The approved crop is outside the source image.")
            if int(crop_pixels.get("width", 0)) != right - left or int(crop_pixels.get("height", 0)) != bottom - top or width != (right - left) * native_scale or height != (bottom - top) * native_scale:
                fail("output_contract_invalid", "The approved native output does not match the approved crop.")
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
            command = [sys.executable, "-c", swinir_launcher, str(script), "--task", "classical_sr", "--scale", str(native_scale), "--training_patch_size", "64", "--model_path", str(model["model_path"]), "--folder_lq", str(crop_source.parent), "--tile", str(int(job.get("tile", 512))), "--tile_overlap", "32"]
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
            command = [sys.executable, "-c", realesrgan_launcher, str(script), "-n", "RealESRGAN_x2plus", "--model_path", str(model["model_path"]), "-i", str(crop_source), "-o", str(result_root), "--outscale", str(native_scale), "--tile", str(int(job.get("tile", 512))), "--gpu-id", str(int(job.get("cuda_device", 0))), "--ext", "png"]
            if str(job.get("precision", "fp16")) != "fp16":
                command.append("--fp32")
        elif model.get("engine") in ("hat-s", "drct", "apisr"):
            run_tiled_tensor_model(torch, Image.open(crop_source), model, root, crop_source, output, native_scale, int(job.get("tile", 256)), str(job.get("precision", "fp16")))
            generated = output
            engine_started_at = datetime.now(timezone.utc).timestamp()
        else:
            fail("model_invalid", "The configured local upscale engine is unsupported.")
        if not script.is_file():
            fail("runner_checkout_missing", "Install the configured official model checkout before local upscaling.")
        engine_started_at = datetime.now(timezone.utc).timestamp()
        timeout_seconds = max(1, int(job.get("timeout_seconds", 1800)))
        completed = None
        if model.get("engine") not in ("hat-s", "drct", "apisr"):
            try:
                completed = subprocess.run(command, cwd=str(root), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout_seconds, check=False)
            except subprocess.TimeoutExpired:
                fail("engine_timeout", "The CUDA model runner timed out; source bytes were preserved.")
        if completed is not None and completed.returncode != 0:
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
        generated = generated if model.get("engine") in ("hat-s", "drct", "apisr") else (find_png(result_root, engine_started_at) or find_png(root / "results", engine_started_at))
        if generated is None:
            fail("engine_output_missing", "The CUDA model runner did not write a PNG result.")
        with Image.open(generated) as image:
            if image.width != width or image.height != height:
                fail("engine_output_invalid", "The CUDA model runner did not retain the required native dimensions.")
            image.convert("RGB").save(output, "PNG", optimize=True)
        if output.stat().st_size > int(job.get("output_max_bytes", 64 * 1024 * 1024)):
            fail("engine_output_too_large", "The CUDA model output exceeded the native profile byte limit.")
    finished = datetime.now(timezone.utc).isoformat()
    device = torch.cuda.get_device_name(int(job.get("cuda_device", 0)))
    print(json.dumps({"success": True, "output": {"width": width, "height": height}, "provenance": {"model_id": model["id"], "model_version": "operator-installed-official", "weight_checksum": expected, "native_scale": native_scale, "model_class": model.get("model_class", "unknown"), "cuda_device": device, "precision": str(job.get("precision", "fp16")), "tile": int(job.get("tile", 512)), "downsampler": "none", "processing_started_at": started, "processing_finished_at": finished}}))


if __name__ == "__main__":
    main()
