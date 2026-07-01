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

Check Local Whisper runtime readiness from the status page by opening `/status` and pressing `Refresh runtime` in the Local Whisper Settings panel. The normal status page load uses cached or lightweight ASR metadata so it does not run Python, ffmpeg, GPU, or CUDA checks until this explicit refresh or a transcription job.

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

## Local Whisper ASR

Local Whisper transcription is optional and private to the user's machine. It uses Python 3.10, a bridge-owned virtual environment, faster-whisper, ffmpeg/ffprobe, and cached Hugging Face model snapshots or explicitly enabled model downloads.

Default behavior:

- Python is auto-detected, preferring `%LOCALAPPDATA%\Programs\Python\Python310\python.exe`.
- The ASR virtual environment is `%USERPROFILE%\.alorbach-codex-bridge\asr-venv` unless `ALORBACH_ASR_VENV` is set.
- Package installation is allowed by default for the private ASR venv.
- Model downloads are disabled by default; use cached model snapshots or set a local model path unless downloads are explicitly enabled in `/status`.
- CUDA is selected only when the enabled model prefers it, enough free VRAM is detected, and CUDA runtime packages are usable. A CUDA load failure falls back to CPU/int8 when possible.

Useful environment overrides:

```powershell
$env:ALORBACH_ASR_PYTHON = 'C:\Users\AL\AppData\Local\Programs\Python\Python310\python.exe'
$env:ALORBACH_ASR_VENV = 'C:\Users\AL\.alorbach-codex-bridge\asr-venv'
$env:ALORBACH_ASR_CPU_THREADS = '4'
$env:ALORBACH_ASR_TRANSCRIBE_TIMEOUT_MS = '1800000'
$env:ALORBACH_ASR_PROBE_TTL_MS = '30000'
$env:ALORBACH_ASR_CUDA_PATHS = '<extra-cuda-bin-paths>'
npm start
```

If Local Whisper setup is slow, check the job output in `/status`. The large downloads are usually Python wheels such as `ctranslate2`, `onnxruntime`, `av`, and CUDA runtime packages, or the selected Whisper model when model downloads are enabled.

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

### Local Whisper shows not checked

This is expected on initial `/status` load. Press `Refresh runtime` in Local Whisper Settings to run the full runtime probe. The default page load avoids those checks so bridge and job diagnostics render immediately.

### Local Whisper says Python or faster-whisper is missing

Install Python 3.10 for the same Windows account or set `ALORBACH_ASR_PYTHON`. If automatic package installation is disabled, create the ASR venv yourself and install `faster-whisper` before running transcription jobs.

### Local Whisper model is missing

Either enable model downloads in the Local Whisper Settings panel or configure `local_path` for an existing faster-whisper/CTranslate2 model snapshot. The default model list includes Large v3, Medium, and Small.

### CUDA runtime is missing or unusable

Use `Refresh runtime` to see the exact CUDA reason. The bridge can install `nvidia-cublas-cu12` and `nvidia-cudnn-cu12` into the ASR venv when package installation is enabled. If CUDA still fails during transcription, the job retries on CPU/int8 when a CPU model is available.
