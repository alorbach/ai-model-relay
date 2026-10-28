"""Exercise Real-ESRGAN CLI routing and output contracts without CUDA or downloads."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch


# Loading the production runner must not leave generated files in src/.
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("upscale_runner", Path(__file__).resolve().parents[1] / "src" / "upscale-runner.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class FakeImage:
    def __init__(self, width, height):
        self.width, self.height = width, height

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def crop(self, box):
        return FakeImage(box[2] - box[0], box[3] - box[1])

    def convert(self, mode):
        return self

    def save(self, dest, *args, **kwargs):
        Path(dest).write_bytes(b"test image output")


class RealEsrganRunnerTest(unittest.TestCase):
    def run_job(self, scale=4, *, missing_weight=False, produced_scale=None, output_scale=None):
        with tempfile.TemporaryDirectory(prefix="relay-esrgan-test-") as temp:
            root = Path(temp)
            source = root / "source.png"
            source.write_bytes(b"source")
            weight = root / ("RealESRGAN_x%dplus.pth" % scale)
            if not missing_weight:
                weight.write_bytes(b"verified weight")
            (root / ".ai-model-relay-commit").write_text("a" * 40)
            (root / "inference_realesrgan.py").write_text("")
            output_scale = scale if output_scale is None else output_scale
            job = {
                "source_path": str(source), "output_path": str(root / "output.png"),
                "model": {"id": "model-relay:local-upscale:realesrgan-x%dplus" % scale,
                          "engine": "realesrgan", "root": str(root), "native_scale": scale,
                          "manifest_valid": True, "model_path": str(weight),
                          "expected_checksum": hashlib.sha256(b"verified weight").hexdigest(),
                          "expected_commit": "a" * 40},
                "crop_pixels": {"left": 0, "top": 0, "right": 3, "bottom": 2, "width": 3, "height": 2},
                "target_print": {"width": 3, "height": 2},
                "output_print": {"width": 3 * output_scale, "height": 2 * output_scale},
                "scale": scale, "output_policy": "retain_native_x%d" % scale,
                "cuda_device": 1, "precision": "fp32", "tile": 256,
            }
            manifest = root / "job.json"
            manifest.write_text(json.dumps(job))
            fake_torch = types.ModuleType("torch")
            fake_torch.cuda = types.SimpleNamespace(is_available=lambda: True, get_device_name=lambda i: "test GPU %d" % i)
            fake_pil = types.ModuleType("PIL")
            produced_scale = scale if produced_scale is None else produced_scale
            fake_pil.Image = types.SimpleNamespace(open=lambda file: FakeImage(3, 2) if Path(file) == source else FakeImage(3 * produced_scale, 2 * produced_scale))
            commands = []

            def run(command, **kwargs):
                commands.append(command)
                dest = Path(command[command.index("-o") + 1])
                dest.mkdir()
                (dest / "result.png").write_bytes(b"fake engine png")
                return types.SimpleNamespace(returncode=0, stdout="", stderr="")

            stdout = io.StringIO()
            with patch.dict(sys.modules, {"torch": fake_torch, "PIL": fake_pil}), patch.object(sys, "argv", ["upscale-runner.py", "--job-json", str(manifest)]), patch.object(runner.subprocess, "run", side_effect=run), contextlib.redirect_stdout(stdout):
                try:
                    runner.main()
                except SystemExit:
                    pass
            return json.loads(stdout.getvalue().strip()), commands, job

    def test_native_x4_and_x2_select_their_own_official_model(self):
        for scale in (2, 4):
            with self.subTest(scale=scale):
                result, commands, job = self.run_job(scale)
                self.assertTrue(result["success"])
                self.assertEqual(result["output"], {"width": 3 * scale, "height": 2 * scale})
                self.assertEqual(result["provenance"]["model_id"], job["model"]["id"])
                self.assertEqual(result["provenance"]["native_scale"], scale)
                self.assertEqual(result["provenance"]["downsampler"], "none")
                command = commands[0]
                self.assertEqual(command[command.index("-n") + 1], "RealESRGAN_x%dplus" % scale)
                self.assertEqual(command[command.index("--model_path") + 1], job["model"]["model_path"])
                self.assertEqual(command[command.index("--outscale") + 1], str(scale))
                self.assertEqual(command[command.index("--gpu-id") + 1], "1")
                self.assertIn("--fp32", command)

    def test_missing_x4_weight_fails_before_engine_can_download(self):
        result, commands, _ = self.run_job(missing_weight=True)
        self.assertFalse(result["success"])
        self.assertEqual(result["code"], "model_not_ready")
        self.assertEqual(commands, [])

    def test_x4_rejects_downsampled_output(self):
        result, _, _ = self.run_job(produced_scale=2)
        self.assertEqual(result["code"], "engine_output_invalid")

    def test_x4_rejects_non_native_contract_before_engine(self):
        result, commands, _ = self.run_job(output_scale=2)
        self.assertEqual(result["code"], "output_contract_invalid")
        self.assertEqual(commands, [])


if __name__ == "__main__":
    unittest.main()
