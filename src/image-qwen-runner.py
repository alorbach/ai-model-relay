#!/usr/bin/env python3
"""CUDA-only runner for supported local image models.

This runner executes local text-to-image and image-editing jobs using
Diffusers with CPU offloading and VAE tiling to operate safely
within consumer GPU VRAM limits (e.g. NVIDIA RTX 3060 12GB).
"""
import argparse
import base64
import io
import json
import os
import sys
from pathlib import Path


def fail(code, message, details=None):
    payload = {
        "success": False,
        "code": code,
        "message": message,
        "details": details or {},
    }
    print(json.dumps(payload), file=sys.stdout)
    sys.exit(1)


def run_probe():
    try:
        import torch
    except ImportError as err:
        print(json.dumps({"success": False, "code": "torch_missing", "message": str(err)}))
        sys.exit(0)

    cuda_available = bool(torch.cuda.is_available())
    probe = {
        "success": True,
        "cuda_available": cuda_available,
        "torch_version": getattr(torch, "__version__", ""),
        "cuda_version": getattr(getattr(torch, "version", None), "cuda", None),
        "device_count": int(torch.cuda.device_count()) if cuda_available else 0,
        "device_name": torch.cuda.get_device_name(0) if cuda_available else "",
        "vram_total_mb": round(torch.cuda.get_device_properties(0).total_memory / (1024 * 1024)) if cuda_available else 0,
        "diffusers_ready": False,
        "transformers_ready": False,
        "qwen_pipeline_ready": False,
        "qwen_image_pipeline_ready": False,
        "qwen_image_img2img_pipeline_ready": False,
        "flux2_pipeline_ready": False,
        "sana_pipeline_ready": False,
        "bitsandbytes_ready": False,
    }

    try:
        import diffusers
        probe["diffusers_ready"] = True
        probe["diffusers_version"] = getattr(diffusers, "__version__", "")
    except Exception as exc:
        probe["diffusers_error"] = str(exc)

    try:
        import transformers
        probe["transformers_ready"] = True
        probe["transformers_version"] = getattr(transformers, "__version__", "")
    except Exception as exc:
        probe["transformers_error"] = str(exc)

    try:
        from diffusers import QwenImage21Pipeline
        probe["qwen_pipeline_ready"] = QwenImage21Pipeline is not None
    except Exception as exc:
        probe["qwen_pipeline_error"] = str(exc)

    try:
        from diffusers import QwenImagePipeline
        probe["qwen_image_pipeline_ready"] = QwenImagePipeline is not None
    except Exception as exc:
        probe["qwen_image_pipeline_error"] = str(exc)

    try:
        from diffusers import QwenImageImg2ImgPipeline
        probe["qwen_image_img2img_pipeline_ready"] = QwenImageImg2ImgPipeline is not None
    except Exception as exc:
        probe["qwen_image_img2img_pipeline_error"] = str(exc)

    try:
        from diffusers import Flux2Pipeline
        probe["flux2_pipeline_ready"] = Flux2Pipeline is not None
    except Exception as exc:
        probe["flux2_pipeline_error"] = str(exc)

    try:
        from diffusers import SanaPipeline
        probe["sana_pipeline_ready"] = SanaPipeline is not None
    except Exception as exc:
        probe["sana_pipeline_error"] = str(exc)

    try:
        from importlib.metadata import version
        probe["bitsandbytes_version"] = version("bitsandbytes")
        probe["bitsandbytes_ready"] = True
    except Exception as exc:
        probe["bitsandbytes_error"] = str(exc)

    print(json.dumps(probe))
    sys.exit(0)


def decode_image(value):
    from PIL import Image

    if isinstance(value, Image.Image):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    if text.startswith("data:") and ";base64," in text:
        _, b64_part = text.split(";base64,", 1)
        raw_bytes = base64.b64decode(b64_part)
        return Image.open(io.BytesIO(raw_bytes))
    if os.path.exists(text):
        return Image.open(text)
    try:
        raw_bytes = base64.b64decode(text)
        return Image.open(io.BytesIO(raw_bytes))
    except Exception:
        return None


MODEL_PIPELINES = {
    "model-relay:local-image:qwen-image-2.1": {
        "repo_id": "Qwen/Qwen-Image-2.1",
        "text_pipeline": "QwenImage21Pipeline",
        "img2img_pipeline": "QwenImage21Pipeline",
        "default_precision": "bf16",
        "precisions": ("bf16", "fp8"),
        "max_reference_images": 10,
    },
    "model-relay:local-image:qwen-image-2512-4bit": {
        "repo_id": "ovedrive/Qwen-Image-2512-4bit",
        "text_pipeline": "QwenImagePipeline",
        "img2img_pipeline": "QwenImageImg2ImgPipeline",
        "default_precision": "nf4-bf16",
        "precisions": ("nf4-bf16",),
        "max_reference_images": 1,
    },
    "model-relay:local-image:flux-2-dev-nf4": {
        "repo_id": "diffusers/FLUX.2-dev-bnb-4bit",
        "text_pipeline": "Flux2Pipeline",
        "img2img_pipeline": "Flux2Pipeline",
        "default_precision": "nf4-bf16",
        "precisions": ("nf4-bf16",),
        "max_reference_images": 10,
        "guidance_argument": "guidance_scale",
    },
    "model-relay:local-image:sana-1600m-4k": {
        "repo_id": "Efficient-Large-Model/Sana_1600M_4Kpx_BF16_diffusers",
        "text_pipeline": "SanaPipeline",
        "default_precision": "bf16",
        "precisions": ("bf16",),
        "max_reference_images": 0,
        "variant": "bf16",
        "default_steps": 20,
        "default_guidance_scale": 5.0,
        "guidance_argument": "guidance_scale",
        "vae_tiling_for_4k": {
            "tile_sample_min_height": 1024,
            "tile_sample_min_width": 1024,
            "tile_sample_stride_height": 896,
            "tile_sample_stride_width": 896,
        },
        "reference_images_unsupported_message": "NVIDIA Sana supports text-to-image only. Choose a Qwen or FLUX.2 model to edit a reference image.",
    },
}


ASPECT_RATIOS_2K = {
    "1:1": (2048, 2048),
    "4:3": (2400, 1792),
    "3:4": (1792, 2400),
    "3:2": (2528, 1696),
    "2:3": (1696, 2528),
    "16:9": (2752, 1536),
    "9:16": (1536, 2752),
}

ASPECT_RATIOS_1K = {
    "1:1": (1024, 1024),
    "4:3": (1152, 864),
    "3:4": (864, 1152),
    "3:2": (1216, 832),
    "2:3": (832, 1216),
    "16:9": (1344, 768),
    "9:16": (768, 1344),
}


def resolve_dimensions(width, height, aspect_ratio, resolution_tier="1k"):
    if width and height and int(width) > 0 and int(height) > 0:
        return int(width), int(height)
    ar = str(aspect_ratio or "1:1").strip()
    table = ASPECT_RATIOS_2K if str(resolution_tier).lower() in ("2k", "high", "native") else ASPECT_RATIOS_1K
    return table.get(ar, (1024, 1024))


def run_job(job):
    import torch
    from PIL import Image

    if not torch.cuda.is_available():
        fail("cuda_unavailable", "CUDA is not available. Local image generation requires an NVIDIA GPU with CUDA.")

    prompt = str(job.get("prompt") or "").strip()
    if not prompt:
        fail("prompt_required", "An image prompt is required.")

    output_path = job.get("output_path")
    if not output_path:
        fail("output_path_required", "An output_path is required.")

    model_id = str(job.get("model_id") or "model-relay:local-image:qwen-image-2.1").strip()
    model_profile = MODEL_PIPELINES.get(model_id)
    if model_profile is None:
        fail("model_unknown", f"Unsupported local image model id: {model_id}")
    model_path = str(job.get("model_path") or model_profile["repo_id"]).strip()
    if model_path != model_profile["repo_id"]:
        fail("model_repo_mismatch", f"The model path does not match the selected model id '{model_id}'.")
    precision = str(job.get("precision") or model_profile["default_precision"]).strip().lower()
    if precision not in model_profile["precisions"]:
        fail("precision_unsupported", f"Precision '{precision}' is not supported by {model_id}.")
    cpu_offload = bool(job.get("cpu_offload", True))
    vae_tiling = bool(job.get("vae_tiling", True))
    steps = int(job.get("num_inference_steps") or job.get("steps") or model_profile.get("default_steps") or 40)
    # Qwen-Image-2.1 uses true_cfg_scale (default 1.0 = no CFG). guidance_scale is accepted as a legacy alias.
    guidance_scale = float(
        job.get("true_cfg_scale")
        if job.get("true_cfg_scale") is not None
        else (job.get("guidance_scale") if job.get("guidance_scale") is not None else model_profile.get("default_guidance_scale", 1.0))
    )
    negative_prompt = str(job.get("negative_prompt") or "").strip()
    if negative_prompt and model_id == "model-relay:local-image:flux-2-dev-nf4":
        fail("negative_prompt_unsupported", "This FLUX.2 Diffusers pipeline does not accept a negative_prompt; remove it and guide the image with the positive prompt.")
    seed = job.get("seed")

    width, height = resolve_dimensions(
        job.get("width"),
        job.get("height"),
        job.get("aspect_ratio"),
        job.get("resolution_tier", "1k")
    )

    reference_images = []
    raw_refs = job.get("reference_images") or job.get("images") or []
    if isinstance(raw_refs, (str, bytes)):
        raw_refs = [raw_refs]
    if len(raw_refs) > model_profile["max_reference_images"]:
        fail("reference_image_limit", model_profile.get("reference_images_unsupported_message") or f"This model accepts at most {model_profile['max_reference_images']} reference image(s).")
    for raw in raw_refs[:model_profile["max_reference_images"]]:
        img = decode_image(raw)
        if img is not None:
            reference_images.append(img)

    try:
        import diffusers
        pipeline_name = model_profile["img2img_pipeline"] if reference_images else model_profile["text_pipeline"]
        pipeline_class = getattr(diffusers, pipeline_name)
    except (ImportError, AttributeError) as err:
        fail("diffusers_pipeline_missing", f"Diffusers pipeline could not be imported: {err}")

    torch_dtype = torch.bfloat16
    load_kwargs = {
        "local_files_only": bool(job.get("local_files_only", False)),
    }
    if model_profile.get("variant"):
        load_kwargs["variant"] = model_profile["variant"]
    # Prefer dtype= (diffusers >=1.0); fall back to torch_dtype for older installs.
    try:
        pipe = pipeline_class.from_pretrained(model_path, dtype=torch_dtype, **load_kwargs)
    except TypeError:
        try:
            pipe = pipeline_class.from_pretrained(model_path, torch_dtype=torch_dtype, **load_kwargs)
        except Exception as exc:
            fail("pipeline_load_failed", f"Failed to load {pipeline_name} from '{model_path}': {exc}")
    except Exception as exc:
        fail("pipeline_load_failed", f"Failed to load {pipeline_name} from '{model_path}': {exc}")

    # Naive weight casting to float8_e4m3fn breaks matmul (BF16 activations vs FP8 weights).
    # Until a proper FP8 quant path is wired, legacy FP8 requests run BF16 + CPU offload.
    if precision == "fp8":
        sys.stderr.write(
            "FP8 requested, but raw float8 casting is unsupported for Qwen-Image; "
            "using BF16 with CPU offload instead.\n"
        )
        precision = "bf16"

    sana_tiling = model_profile.get("vae_tiling_for_4k") if max(width, height) >= 4096 else None
    if sana_tiling:
        if not vae_tiling:
            sys.stderr.write("VAE tiling is required for Sana 4K and will be enabled for this job.\n")
        try:
            pipe.vae.enable_tiling(**sana_tiling)
        except Exception as tiling_err:
            fail(
                "vae_tiling_failed",
                "Sana 4K requires VAE tiling, but the configured tiling could not be enabled: "
                f"{tiling_err}",
            )

    if cpu_offload:
        try:
            pipe.enable_model_cpu_offload()
        except Exception as offload_err:
            fail(
                "cpu_offload_failed",
                "Could not enable CPU offload for the local image pipeline. "
                f"The full model was not moved onto the GPU: {offload_err}",
            )
    else:
        pipe.to("cuda")

    if vae_tiling and not sana_tiling:
        try:
            if hasattr(pipe, "enable_vae_tiling"):
                pipe.enable_vae_tiling()
            elif hasattr(pipe, "vae") and pipe.vae is not None and hasattr(pipe.vae, "enable_tiling"):
                pipe.vae.enable_tiling()
            else:
                sys.stderr.write(f"VAE tiling unavailable on this {pipeline_name} build.\n")
        except Exception as tiling_err:
            sys.stderr.write(f"VAE tiling warning: {tiling_err}\n")

    generator = None
    if seed is not None and int(seed) >= 0:
        generator = torch.Generator(device="cpu" if cpu_offload else "cuda").manual_seed(int(seed))

    pipe_args = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "num_inference_steps": steps,
        model_profile.get("guidance_argument", "true_cfg_scale"): guidance_scale,
    }
    if generator is not None:
        pipe_args["generator"] = generator

    if negative_prompt:
        pipe_args["negative_prompt"] = negative_prompt
    elif model_profile.get("guidance_argument") != "guidance_scale" and guidance_scale > 1:
        # true_cfg_scale > 1 requires a negative prompt to engage CFG
        pipe_args["negative_prompt"] = " "

    if reference_images:
        pipe_args["image"] = reference_images if len(reference_images) > 1 else reference_images[0]

    try:
        output = pipe(**pipe_args)
        generated_image = output.images[0]
    except Exception as exc:
        fail("generation_failed", f"Image generation failed during diffusion sampling: {exc}")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    generated_image.save(output_path, format="PNG")

    print(json.dumps({
        "success": True,
        "output_path": output_path,
        "width": generated_image.width,
        "height": generated_image.height,
        "format": "image/png",
        "mode": generated_image.mode,
        "precision": precision,
        "steps": steps,
        "true_cfg_scale": guidance_scale,
        "guidance_scale": guidance_scale,
        "seed": seed,
    }))


def main():
    parser = argparse.ArgumentParser(description="Local image generation runner")
    parser.add_argument("--probe", action="store_true", help="Probe CUDA and python dependencies and exit")
    parser.add_argument("--job-json", type=str, help="Path to job JSON file (or '-' for stdin)")
    args = parser.parse_args()

    if args.probe:
        run_probe()

    if not args.job_json:
        fail("missing_job_json", "Specify --job-json <path> or --probe")

    if args.job_json == "-":
        try:
            job = json.load(sys.stdin)
        except Exception as err:
            fail("invalid_json", f"Failed to parse job JSON from stdin: {err}")
    else:
        job_path = Path(args.job_json)
        if not job_path.is_file():
            fail("job_file_not_found", f"Job JSON file not found: {args.job_json}")
        try:
            with open(job_path, "r", encoding="utf-8") as handle:
                job = json.load(handle)
        except Exception as err:
            fail("invalid_json", f"Failed to read job JSON from {args.job_json}: {err}")

    run_job(job)


if __name__ == "__main__":
    main()
