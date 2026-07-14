# Operations

## User Installation

1. Install the CLI or local runtime for the operations you intend to use, under the same Windows account that will run the tray app.
2. Sign in to each CLI that requires it, for example `codex login` or the Grok CLI's own login flow.
3. Install or unzip the latest AI Model Relay release. Existing installer artifacts may still use the Codex Local Bridge name during the compatibility transition.
4. Start `AI Model Relay` and open its `/status` page.
5. Open **Settings**, press **Refresh detection**, and wait for the provider cards to finish their background checks.
6. Choose ready providers in **Model routing** for the relay operations you need, then save routing.
7. In WordPress, enable the applicable local bridge integration and keep the bridge URL at `http://127.0.0.1:8765` unless a custom port is required.
8. Pair the WordPress origin with the six digit tray code when prompted.

## Providers and Model Routing

The Settings page shows every supported local/API driver with an installed, ready, checking, not-authenticated, or unavailable state; executable path, version, supported operations, and concise safe diagnostics are shown separately so long paths do not distort the card layout.

- **Codex CLI**: chat, image generation, and media analysis.
- **Grok CLI**: chat/coding plus Grok Imagine image generation and experimental image-reference video generation only when `%USERPROFILE%\.grok\skills\imagine\SKILL.md` declares the matching local tools.
- **Cursor Agent**: chat/coding through `cursor-agent --print --output-format json`.
- **Local ASR**: local transcription; its detailed runtime/model editor remains below routing.
- **OpenAI Videos**, **Grok/xAI API**, and **API Key Chat**: separately configured API drivers.

The five selectors route only `/v1/relay/jobs/*`: chat, images, videos, transcription, and media analysis. Explicit `payload.model`, `payload.provider`, or `payload.backend` always overrides the saved default. Legacy `/v1/chat`, `/v1/images`, `/v1/transcribe`, `/v1/videos`, and `/v1/media/analyze` remain unchanged.

The relay never silently falls back. If an explicit or saved model/provider is unknown, unavailable, unauthenticated, disabled, or incompatible with the job type, the request fails with a configuration error naming that choice. An unavailable saved selection remains visible but disabled in Settings so it can be corrected.

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

Check the legacy Codex smoke path:

```powershell
npm run smoke
```

The normal status page load is immediate: provider discovery uses cached diagnostics while Codex, Grok, and Cursor are checked in the background. Open **Settings** and press **Refresh detection** to start a new background provider check. Check Local ASR runtime separately by pressing **Refresh runtime** in the Local ASR Settings panel; that explicit action may run Python, ffmpeg, GPU, or CUDA checks.

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
AI-Model-Relay-<version>-build.<number>-win-x64.exe
AI-Model-Relay-<version>-build.<number>-win-x64.zip
```

Local builds increment `.build/build-number`. GitHub Actions builds use `GITHUB_RUN_NUMBER`.

## Release

Push a version tag:

```powershell
git tag v<version>
git push origin v<version>
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

![AI Model Relay tray menu](images/tray-menu.png)

- double-clicking the tray icon opens `/status`;
- `Open status page` opens `/status`;
- `Open status JSON` opens `/v1/status`;
- `Copy diagnostics` copies a JSON diagnostic payload without bearer token values;
- `Open bridge data folder` opens `%USERPROFILE%\.alorbach-codex-bridge`;
- `Refresh Codex status` rechecks legacy Codex status. For all providers, use **Settings → Refresh detection**, which starts an asynchronous cached refresh.

The tray icon animates while jobs are running and changes color for queued, failed, and stopped states. Mouse-over text and the tray menu show running and queued job counts plus request IDs, job types, models, and elapsed time. The local Live tab adds the selected provider/API, workflow/skill, bounded redacted stdin, and bounded stdout/stderr/session output. It retains recent generated image thumbnails; click one to inspect it in an overlay without opening a new tab.

Failed bridge requests include a `debug_help` object in the JSON response. It points to `/status`, `/v1/status`, the request id when available, and safe checks such as provider readiness, pairing state, and tray diagnostics. The `/status` page uses a local job event stream to append bounded live session input/output for running jobs, then keeps recent failed jobs with safe stdout/stderr/last response text when available.

Full-fidelity temporary model debug logs are written under `%TEMP%\alorbach-codex-local-bridge-debug`. The bridge deletes that directory on startup. Each invocation gets its own folder with `prompt.txt`, `output.txt`, `stdout.txt`, `stderr.txt`, and `metadata.json`. These files are intentionally not redacted, so treat them as private local diagnostics.

Example status page with local filesystem paths redacted:

![AI Model Relay status page with local paths redacted](images/status-page.png)

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
- Requests that omit `payload.model` use the `Default model` from Local ASR Settings when set; otherwise `local-asr` auto-selects the best ready transcription model. A caller-supplied `payload.model` always overrides the default.
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

### Provider is installed but not ready

Open **Settings**, press **Refresh detection**, and read the provider card's safe diagnostic. Sign in from the same Windows account as the tray app (for example, `codex login` for Codex) and refresh again. The bridge does not use another provider as a fallback.

### Grok image or video is unavailable

Grok CLI media requires `%USERPROFILE%\.grok\skills\imagine\SKILL.md` to declare the relevant Imagine tools. Press **Refresh detection** after installing/updating Grok. Image/video jobs fail explicitly when the Imagine tools are unavailable, no output artifact is generated, the request is moderated, or the bounded Grok process times out. Video remains experimental until a local video request succeeds; if Grok confirms that a video tool is unavailable, refresh detection and update Grok before selecting it again.

### Cursor Agent is unavailable

Install Cursor Agent so `cursor-agent` is resolvable for the tray-app Windows user, authenticate it if required, then use **Refresh detection**. The bridge intentionally does not probe the generic `agent` command because it can refer to Grok's bundled executable.

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

This is expected on initial `/status` load. Press `Refresh runtime` in Local ASR Settings to run the full runtime probe. Provider detection and the normal page load remain cached so bridge and job diagnostics render immediately.

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

## Naming and Compatibility

The product was originally released as **Codex Local Bridge** and has been renamed to **AI Model Relay**.

### What the rename changed

- The tray app title, window title, and About text now read **AI Model Relay**.
- The product name and short name returned by `/v1/status` and `/v1/capabilities` are `AI Model Relay` and `Model Relay`. The field `legacy_name` in those responses still returns `Codex Local Bridge`.
- Local ASR model IDs now use the `local-asr:*` prefix (e.g. `local-asr:whisper-large-v3`, `local-asr:qwen3-asr-0.6b`). The previous `codex-local:audio:*` prefix is accepted as a compatibility alias for stale clients.
- Provider-neutral relay model IDs use the `model-relay:<backend>:<model>` form (e.g. `model-relay:local-asr:qwen3-asr-0.6b`, `model-relay:xai:grok-4.3`). These were introduced alongside the rename and have no legacy equivalent.

### What remains unchanged

- The default bridge URL and port: `http://127.0.0.1:8765`.
- The legacy `/v1` HTTP routes: `/v1/status`, `/v1/capabilities`, `/v1/chat`, `/v1/images`, `/v1/transcribe`, `/v1/videos`, `/v1/media/analyze`, `/v1/models`, `/v1/pair`, `/v1/unpair`, and `/v1/asr/settings`. The additive relay routes live under `/v1/relay/*`.
- Text and image model IDs: `codex-local:auto`, `codex-local:image`, and any `codex-local:<id>` IDs from `models_cache.json`.
- The user state directory: `%USERPROFILE%\.alorbach-codex-bridge`.
- The bridge process name, tray binary name, and installer package ID used by existing WordPress plugins.
- All signed job envelope fields (`job_token`, `request_hash`, `request_id`) and the pairing token header.

### Installer artifacts

Installer builds produced before the rename may still display the Codex Local Bridge name in Windows Add/Remove Programs and in the installer wizard. The underlying bridge URL, state directory, and API are identical.
