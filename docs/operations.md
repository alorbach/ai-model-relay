# Operations

## User Installation

1. Install Codex CLI for the Windows user who will run the tray app.
2. Run `codex login` in that same Windows account.
3. Install or unzip the latest Codex Local Bridge release.
4. Start `Codex Local Bridge`.
5. Open the tray menu and confirm `Codex: Ready`.
6. In WordPress, enable Local Codex and keep the bridge URL at `http://127.0.0.1:8765` unless a custom port is required.
7. Pair the WordPress origin with the six digit tray code when prompted.

## Development Commands

Install dependencies:

```powershell
npm ci
```

Run tests:

```powershell
npm test
```

Run the server without Electron:

```powershell
npm run serve
```

Run the tray app:

```powershell
npm start
```

Limit local Codex parallelism for a development run:

```powershell
$env:ALORBACH_CODEX_MAX_CONCURRENT_JOBS = '2'
npm start
```

Run the standalone HTTP example:

```powershell
npm run example:http
```

Check local Codex readiness:

```powershell
npm run smoke
```

Check Local ASR runtime readiness from the status page by opening `/status` and pressing `Refresh runtime` in the Local ASR Settings panel. The normal status page load uses cached or lightweight ASR metadata so it does not run Python, ffmpeg, GPU, or CUDA checks until this explicit refresh or a transcription job.

Generate icons:

```powershell
npm run icons
```

Build Windows artifacts:

```powershell
npm run dist:win
```

## Build Outputs

Windows builds are written to `dist/`.

Release artifact names include the semantic version and build number:

```text
Codex-Local-Bridge-1.0.1-build.42-win-x64.exe
Codex-Local-Bridge-1.0.1-build.42-win-x64.zip
```

Local builds increment `.build/build-number`. GitHub Actions builds use `GITHUB_RUN_NUMBER`.

## Release

Push a version tag:

```powershell
git tag v1.0.1
git push origin v1.0.1
```

The release workflow:

1. checks out the repo;
2. derives the package version from the tag;
3. installs Node dependencies;
4. generates icons;
5. syntax-checks JavaScript files;
6. runs tests;
7. builds the Windows installer and portable ZIP;
8. generates a release description with download names, validation context, and an embedded changelog from GitHub's generated change entries;
9. removes older installer and ZIP assets from an existing release for the same tag;
10. publishes a GitHub Release with that description and only the current build's installer and portable ZIP assets.

## Diagnostics

Use the tray menu:

![Codex Local Bridge tray menu](images/tray-menu.png)

- double-clicking the tray icon opens `/status`;
- `Open status page` opens `/status`;
- `Open status JSON` opens `/v1/status`;
- `Copy diagnostics` copies a JSON diagnostic payload without bearer token values;
- `Open bridge data folder` opens `%USERPROFILE%\.alorbach-codex-bridge`;
- `Refresh Codex status` rechecks `codex --version` and `codex login status`.

The tray icon animates while jobs are running and changes color for queued, failed, and stopped states. Mouse-over text and the tray menu show running and queued job counts plus request IDs, job types, models, and elapsed time. Prompt and message content are not shown.

Failed bridge requests include a `debug_help` object in the JSON response. It points to `/status`, `/v1/status`, the request id when available, and safe checks such as Codex login status, pairing state, and tray diagnostics. The `/status` page uses a local job event stream to append bounded live Codex session output for running jobs, then keeps recent failed jobs with stderr/stdout/last response text when available.

Full-fidelity temporary model debug logs are written under `%TEMP%\alorbach-codex-local-bridge-debug`. The bridge deletes that directory on startup. Each invocation gets its own folder with `prompt.txt`, `output.txt`, `stdout.txt`, `stderr.txt`, and `metadata.json`. These files are intentionally not redacted, so treat them as private local diagnostics.

Example status page with local filesystem paths redacted:

![Codex Local Bridge status page with local paths redacted](images/status-page.png)

Useful direct checks:

```powershell
codex --version
codex login status
npm run smoke
```

If the app resolves the wrong Codex command on Windows, set:

```powershell
$env:ALORBACH_CODEX_BINARY = '<path-to-codex.exe>'
npm start
```

## Local ASR

Local ASR transcription/alignment is optional and private to the user's machine. The bridge supports faster-whisper models through Python 3.10 and Qwen3 ASR/ForcedAligner through a separate Python environment. Both providers use cached Hugging Face model snapshots or explicitly enabled model downloads.

Default behavior:

- Whisper Python is auto-detected, preferring `%LOCALAPPDATA%\Programs\Python\Python310\python.exe`.
- Qwen Python is auto-detected, preferring `%LOCALAPPDATA%\Programs\Python\Python312\python.exe`.
- The Whisper ASR virtual environment is `%USERPROFILE%\.alorbach-codex-bridge\asr-venv` unless `ALORBACH_ASR_VENV` is set.
- The Qwen ASR virtual environment is `%USERPROFILE%\.alorbach-codex-bridge\qwen-asr-venv` unless `ALORBACH_QWEN_ASR_VENV` is set.
- Package installation is allowed by default for the private ASR venvs.
- Model downloads are disabled by default; use cached model snapshots or set a local model path unless downloads are explicitly enabled in `/status`.
- Requests that omit `payload.model` use the `Default model` from Local ASR Settings when set; otherwise `codex-local:audio` auto-selects the best ready transcription model. A caller-supplied `payload.model` always overrides the default.
- Qwen setup verifies that PyTorch was installed with CUDA support. If `qwen-asr` installs a CPU-only torch wheel, the bridge repairs the Qwen venv by installing `torch` from the PyTorch CUDA wheel index when package installation is enabled.
- Whisper CUDA is selected only when the enabled model prefers it, enough free VRAM is detected, and CUDA runtime packages are usable. A CUDA load failure falls back to CPU/int8 when possible.
- Qwen3 ASR requires CUDA, but can optionally use mixed GPU/CPU loading through Transformers `device_map="auto"` when a selected Qwen model does not fit fully in VRAM. The bridge still prefers a fully GPU-ready transcription model during automatic selection; use the 0.6B model for normal low-VRAM work and explicit/default 1.7B selection when CPU offload is acceptable.
- Qwen timestamp output still requires `Qwen/Qwen3-ForcedAligner-0.6B` to be cached or explicitly downloadable, but the ForcedAligner is not exposed as a normal transcription model because it requires reference text.
- Qwen timestamped transcription is pre-chunked locally before ASR and alignment. The default chunk size is 30 seconds to avoid long ASR omissions inside Qwen's larger timestamp chunks. The bridge also reports and caps implausibly stretched single-word timestamps.

Useful environment overrides:

```powershell
$env:ALORBACH_ASR_PYTHON = 'C:\Users\AL\AppData\Local\Programs\Python\Python310\python.exe'
$env:ALORBACH_ASR_VENV = 'C:\Users\AL\.alorbach-codex-bridge\asr-venv'
$env:ALORBACH_QWEN_ASR_PYTHON = 'C:\Users\AL\AppData\Local\Programs\Python\Python312\python.exe'
$env:ALORBACH_QWEN_ASR_VENV = 'C:\Users\AL\.alorbach-codex-bridge\qwen-asr-venv'
$env:ALORBACH_QWEN_TORCH_INDEX_URL = 'https://download.pytorch.org/whl/cu128'
$env:ALORBACH_QWEN_ALLOW_CPU_OFFLOAD = '1'
$env:ALORBACH_QWEN_CHUNK_SECONDS = '30'
$env:ALORBACH_QWEN_MAX_WORD_DURATION_SECONDS = '12'
$env:ALORBACH_ASR_DEFAULT_MODEL = 'qwen3-asr-0.6b'
$env:ALORBACH_ASR_CPU_THREADS = '4'
$env:ALORBACH_ASR_TRANSCRIBE_TIMEOUT_MS = '1800000'
$env:ALORBACH_ASR_PROBE_TTL_MS = '30000'
$env:ALORBACH_ASR_CUDA_PATHS = '<extra-cuda-bin-paths>'
npm start
```

If Local ASR setup is slow, check the job output in `/status`. The large downloads are usually Python wheels such as `ctranslate2`, `onnxruntime`, `av`, Qwen/vLLM dependencies, CUDA runtime packages, or the selected ASR model when model downloads are enabled.

## Common Failures

### Bridge not reachable

Check that the tray app is running and that no other process owns the configured port. The bridge binds only to `127.0.0.1`.

### Codex installed but not ready

Run `codex login` from the same Windows account as the tray app. The bridge checks `CODEX_HOME\auth.json` and `codex login status`.

### Pairing fails

Confirm the browser page is served from `http` or `https`, not `file://`. Pairing is origin-based, so `http://localhost:8787` and `http://127.0.0.1:8787` are different origins.

### Requests return 403 after pairing

Clear the browser's stored token for the origin and pair again. Also check the tray menu for the paired origins list.

### Image request succeeds in Codex but bridge returns no image

The bridge detects new files under `CODEX_HOME\generated_images`. Confirm Codex writes generated images there for the current `CODEX_HOME`.

Only one image job runs at a time because image result detection uses the shared generated-images directory. Chat jobs may still run beside an image job up to `ALORBACH_CODEX_MAX_CONCURRENT_JOBS`.

### WordPress retry says duplicate request

The browser likely created a Gateway job and failed before calling `/fail`. The Gateway duplicate lock expires with the local job TTL, currently 900 seconds.

### Local ASR shows not checked

This is expected on initial `/status` load. Press `Refresh runtime` in Local ASR Settings to run the full runtime probe. The default page load avoids those checks so bridge and job diagnostics render immediately.

### Local Whisper says Python or faster-whisper is missing

Install Python 3.10 for the same Windows account or set `ALORBACH_ASR_PYTHON`. If automatic package installation is disabled, create the ASR venv yourself and install `faster-whisper` before running transcription jobs.

### Local Whisper model is missing

Either enable model downloads in the Local ASR Settings panel or configure `local_path` for an existing faster-whisper/CTranslate2 model snapshot. The default faster-whisper model list includes Large v3, Medium, and Small.

### Local Qwen ASR model or aligner is missing

Either enable model downloads in the Local ASR Settings panel or configure `local_path` for `Qwen/Qwen3-ASR-1.7B` or `Qwen/Qwen3-ASR-0.6B`, plus `aligner_local_path` for `Qwen/Qwen3-ForcedAligner-0.6B`. The bridge keeps downloads disabled by default so Qwen remains a fully local backend after the model files are cached.

### Local Qwen ASR has less free VRAM than the selected model requires

Use `qwen3-asr-0.6b` as the default model for normal low-VRAM transcription. If you explicitly need `qwen3-asr-1.7b`, enable `Allow Qwen CPU offload` in `/status`; the bridge will load Qwen with `device_map="auto"` and use CPU RAM for layers that do not fit in VRAM. This can be much slower than the full-GPU path and may still fail if system RAM is constrained.

### Local Qwen ASR says preprocessor_config.json is missing

The Hugging Face cache snapshot is incomplete. Qwen ASR snapshots must include processor/tokenizer files such as `preprocessor_config.json`, `tokenizer_config.json`, `vocab.json`, and `merges.txt`, not only the safetensors weights. Enable model downloads in Local ASR Settings so the bridge can redownload missing files, or remove the incomplete snapshot under `%USERPROFILE%\.cache\huggingface\hub\models--Qwen--...`.

### Local Qwen ASR says Torch not compiled with CUDA enabled

Refresh Local ASR runtime in `/status` and check `Qwen torch CUDA`. When package installation is enabled, the bridge installs or upgrades `torch` from `ALORBACH_QWEN_TORCH_INDEX_URL`, defaulting to the PyTorch CUDA 12.8 wheel index. If package installation is disabled, install a CUDA-enabled PyTorch wheel manually in `%USERPROFILE%\.alorbach-codex-bridge\qwen-asr-venv`.

### CUDA runtime is missing or unusable

Use `Refresh runtime` to see the exact CUDA reason. The bridge can install `nvidia-cublas-cu12` and `nvidia-cudnn-cu12` into the ASR venv when package installation is enabled. If CUDA still fails during transcription, the job retries on CPU/int8 when a CPU model is available.
