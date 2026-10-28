# Configuration

Most settings are made on the local status page: **Providers** (executable paths, API keys, models, and the **Routing** card), **Runtime** (timeouts, parallel jobs), and the pages of the local engines. A saved, non-empty value on the status page wins. Leave a field blank to fall back to the environment variable listed here, and then to the code default.

The listen port and the state directory are read only when the process starts and cannot be changed on the status page.

## Relay process

| Variable | Purpose | Default |
| --- | --- | --- |
| `ALORBACH_CODEX_BRIDGE_PORT` | Listen port on `127.0.0.1`. | `8765` |
| `AI_MODEL_RELAY_STATE_DIR`, `ALORBACH_MODEL_RELAY_STATE_DIR` | State directory (pairings, settings, keys). | `%USERPROFILE%\.ai-model-relay` if it exists, otherwise `%USERPROFILE%\.alorbach-codex-bridge` |
| `ALORBACH_CODEX_MAX_CONCURRENT_JOBS` | Parallel jobs. | `2` |
| `AI_MODEL_RELAY_PROVIDER_FETCH_TIMEOUT_MS` | HTTP provider fetches such as model discovery. | `60000` |
| `AI_MODEL_RELAY_MEDIA_FETCH_TIMEOUT_MS` | Download of HTTPS media URLs for analysis. | `60000` |
| `AI_MODEL_RELAY_CLI_PROBE_TIMEOUT_MS` | Readiness probe of each CLI. | `10000` |

## Subscription CLIs

| Variable | Purpose | Default |
| --- | --- | --- |
| `ALORBACH_CODEX_BINARY` | Path to `codex.exe`. Set it if Windows resolves `codex` to a `.cmd` shim that cannot be started. | Known install locations, then `PATH` |
| `CODEX_HOME` | Codex profile directory. | `%USERPROFILE%\.codex` |
| `ALORBACH_CODEX_CHAT_TIMEOUT_MS` | Codex chat timeout. | `600000` |
| `ALORBACH_CODEX_IMAGE_TIMEOUT_MS` | Codex image timeout. | `1800000` |
| `AI_MODEL_RELAY_GROK_BINARY` | Path to the Grok CLI. | `grok` on `PATH` |
| `AI_MODEL_RELAY_GROK_IMAGINE_SKILL` | Explicit path to the Grok Imagine `SKILL.md`. | `%USERPROFILE%\.grok\skills\imagine\` or `...\bundled\skills\imagine\` |
| `AI_MODEL_RELAY_GROK_MEDIA_TIMEOUT_MS` | Grok CLI image and video timeout. | `450000` |
| `AI_MODEL_RELAY_CURSOR_BINARY` | Path to `cursor-agent`. | `cursor-agent` on `PATH` |
| `AI_MODEL_RELAY_ANTIGRAVITY_BINARY` | Path to the signed-in `agy`. The Relay never installs or signs in to Antigravity. | `agy` on `PATH` |
| `AI_MODEL_RELAY_ANTIGRAVITY_STATE_DIR` | Antigravity artifact state root. | `%USERPROFILE%\.gemini\antigravity-cli` |
| `AI_MODEL_RELAY_ANTIGRAVITY_CHAT_TIMEOUT_MS`, `..._IMAGE_TIMEOUT_MS`, `..._MEDIA_TIMEOUT_MS` | Antigravity timeouts. | `600000`, `1800000`, `600000` |
| `AI_MODEL_RELAY_CLI_COMMAND` | Enables the generic **CLI Process** chat driver with this command. | not set |
| `AI_MODEL_RELAY_CLI_ARGS` | Arguments for the CLI Process driver. The prompt is sent on stdin. | none |
| `AI_MODEL_RELAY_CLI_TIMEOUT_MS` | CLI Process timeout. | `600000` |

## API-key providers

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY`, `AI_MODEL_RELAY_ANTHROPIC_API_KEY` | Enables the Claude API chat driver (`model-relay:anthropic:*`). | not set |
| `ANTHROPIC_ADMIN_KEY`, `AI_MODEL_RELAY_ANTHROPIC_ADMIN_KEY` | Optional Admin API key, used only for month-to-date spend on the Claude API usage panel. | not set |
| `ANTHROPIC_BASE_URL` | Anthropic base URL. | `https://api.anthropic.com` |
| `AI_MODEL_RELAY_ANTHROPIC_MODELS` | Comma-separated Claude model IDs. | `claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5` |
| `AI_MODEL_RELAY_ANTHROPIC_CHAT_TIMEOUT_MS` | Claude chat timeout. | `600000` |
| `AI_MODEL_RELAY_ANTHROPIC_FALLBACKS` | `0` stops sending refusal fallbacks (only sent to api.anthropic.com directly, for Opus 5.5, Opus 5, Sonnet 5.5, Fable 5.1). | on |
| `XAI_API_KEY`, `AI_MODEL_RELAY_XAI_API_KEY` | Enables Grok / xAI API chat, Imagine image and video, and Speech-to-Text. With a key and no saved video default, video routing defaults to Imagine video. | not set |
| `XAI_BASE_URL`, `AI_MODEL_RELAY_XAI_BASE_URL` | xAI-compatible base URL. | `https://api.x.ai/v1` |
| `AI_MODEL_RELAY_XAI_MODEL` | Default Grok chat model. | `grok-4.6` |
| `AI_MODEL_RELAY_XAI_MODELS` | Comma-separated Grok chat models exposed as `model-relay:xai:*`. | `grok-4.6,grok-4.5,grok-4.3,latest` |
| `AI_MODEL_RELAY_CHAT_API_KEY`, `AI_MODEL_RELAY_CHAT_BASE_URL`, `AI_MODEL_RELAY_CHAT_MODEL` | **API Key Chat**: any OpenAI-compatible `/chat/completions` endpoint. | not set |
| `AI_MODEL_RELAY_CHAT_PROVIDER_ID` | Provider label reported for API Key Chat. | `api-key-chat` |
| `ALORBACH_CODEX_ENABLE_VIDEO` | `1` enables the OpenAI Videos driver. OpenAI scheduled Sora 2 and the Videos API for removal on 24 Sep 2026; prefer xAI Imagine video. | off |
| `ALORBACH_OPENAI_API_KEY`, `OPENAI_API_KEY` | Key for OpenAI Videos. Codex image jobs never use it. | not set |
| `ALORBACH_VIDEO_POLL_TIMEOUT_MS`, `ALORBACH_VIDEO_POLL_INTERVAL_MS` | OpenAI Videos polling. | `600000`, `3000` |

API keys saved on the status page are stored in the local state file. The settings API returns only `configured` and the last characters; **Clear** removes a saved key so the environment variable applies again.

## Local ASR

| Variable | Purpose | Default |
| --- | --- | --- |
| `ALORBACH_ASR_PYTHON`, `ALORBACH_ASR_VENV` | Python and virtual environment for faster-whisper. | Python 3.10 auto-detect; `<state dir>\asr-venv` |
| `ALORBACH_QWEN_ASR_PYTHON`, `ALORBACH_QWEN_ASR_VENV` | Python and virtual environment for Qwen3 ASR / ForcedAligner. | Python 3.12 auto-detect; `<state dir>\qwen-asr-venv` |
| `ALORBACH_QWEN_TORCH_INDEX_URL` | CUDA PyTorch wheel index used by Qwen setup (no CPU fallback). | `https://download.pytorch.org/whl/cu128` |
| `ALORBACH_QWEN_ALLOW_CPU_OFFLOAD` | `0` disables mixed GPU/CPU loading. | on |
| `ALORBACH_QWEN_CHUNK_SECONDS` | Local pre-chunk size for timestamped Qwen transcription. | `30` |
| `ALORBACH_QWEN_MAX_WORD_DURATION_SECONDS` | Cap for stretched Qwen word timestamps. | `12` |
| `ALORBACH_ASR_DEFAULT_MODEL` | Default model slug when a request has no `payload.model`, for example `qwen3-asr-0.6b`. | auto-select |
| `ALORBACH_ASR_CPU_THREADS` | CPU threads for faster-whisper. | `4` |
| `ALORBACH_ASR_TRANSCRIBE_TIMEOUT_MS` | Transcription timeout. | `1800000` |
| `ALORBACH_ASR_PROBE_TTL_MS` | Lifetime of the cached runtime probe. | `30000` |
| `ALORBACH_ASR_CUDA_PATHS` | Extra CUDA DLL search paths. | none |

## Local Image

| Variable | Purpose | Default |
| --- | --- | --- |
| `AI_MODEL_RELAY_IMAGE_PYTHON`, `AI_MODEL_RELAY_IMAGE_VENV` | Python and virtual environment for local image models. | auto-detect; `<state dir>\qwen-image-venv` |
| `AI_MODEL_RELAY_IMAGE_PRECISION` | Compute precision. | `bf16` |
| `AI_MODEL_RELAY_IMAGE_SETUP_TIMEOUT_MS`, `AI_MODEL_RELAY_IMAGE_TIMEOUT_MS` | Setup and job timeouts. | `1800000`, `900000` |

## Local CUDA Upscale

| Variable | Purpose | Default |
| --- | --- | --- |
| `AI_MODEL_RELAY_UPSCALE_PYTHON` | Base Python for `upscale-venv`. | Python 3.10 or 3.12 auto-detect |
| `AI_MODEL_RELAY_UPSCALE_TORCH_INDEX_URL` | CUDA wheel index for `torch` / `torchvision` (only this index is used). | `https://download.pytorch.org/whl/cu128` |
| `AI_MODEL_RELAY_SWINIR_ROOT`, `..._MODEL_PATH` | SwinIR checkout and ×2 weight paths. | pinned official release |
| `AI_MODEL_RELAY_REALESRGAN_ROOT`, `..._MODEL_PATH` | Real-ESRGAN ×2plus checkout and weight paths. | pinned official release |
| `AI_MODEL_RELAY_UPSCALE_REALESRGAN_X4_ROOT`, `..._MODEL_PATH` | Separate Real-ESRGAN ×4plus checkout and weight paths; ×2 overrides do not apply to ×4. | checkout: `<state dir>\upscale\realesrgan_x4`; pinned official weight |
| `AI_MODEL_RELAY_UPSCALE_<INSTALL_KEY>_ROOT`, `..._MODEL_PATH` | Checkout and weight path overrides for models such as DRCT, HAT-S, and APISR, for example `AI_MODEL_RELAY_UPSCALE_HAT_S_X4_MODEL_PATH`. | pinned where available |
| `AI_MODEL_RELAY_UPSCALE_DRCT_X2_WEIGHT_SHA256` | SHA-256 of the operator-verified DRCT ×2 weight specified by `AI_MODEL_RELAY_UPSCALE_DRCT_X2_MODEL_PATH`. | required for DRCT ×2 |
| `AI_MODEL_RELAY_UPSCALE_VENV` | BasicSR runtime for SwinIR, Real-ESRGAN, HAT-S, DRCT. | `<state dir>\upscale-venv` |
| `AI_MODEL_RELAY_APISR_VENV` | Isolated APISR runtime. APISR is GPL-3.0-only and academic-only. | `<state dir>\upscale-apisr-venv` |
| `AI_MODEL_RELAY_UPSCALE_TILE` | CUDA tile edge. | `512` |
| `AI_MODEL_RELAY_UPSCALE_PRECISION` | `fp16` or `fp32` (CUDA only). | `fp16` |
| `AI_MODEL_RELAY_UPSCALE_TIMEOUT_MS` | Upscale job timeout. | `1800000` |

For models with an official pinned weight, including SwinIR and both Real-ESRGAN variants, the manifest's SHA-256 and byte size are authoritative even when a custom weight path is configured. A `..._WEIGHT_SHA256` environment value does not replace that pin. DRCT ×2 instead requires an operator-verified weight path and SHA-256 because it has no pinned official ×2 weight.

## Local Music Analysis

| Variable | Purpose | Default |
| --- | --- | --- |
| `ALORBACH_MUSIC_ANALYSIS_PYTHON`, `ALORBACH_MUSIC_ANALYSIS_VENV` | Base Python and virtual environment. | Python 3.10+ auto-detect; `<state dir>\music-analysis-venv` |
| `ALORBACH_MUSIC_ANALYSIS_SAMPLE_RATE` | Decode sample rate. | `22050` |
| `ALORBACH_MUSIC_ANALYSIS_MAX_SECTIONS` | Maximum section boundaries (`2`–`24`). | `12` |
| `ALORBACH_MUSIC_ANALYSIS_TIMEOUT_MS` | Analysis timeout. | `1800000` |
| `ALORBACH_MUSIC_ANALYSIS_PROBE_TTL_MS` | Lifetime of the cached runtime probe. | `30000` |

## Example

```powershell
$env:ALORBACH_CODEX_BRIDGE_PORT = '8766'
$env:ANTHROPIC_API_KEY = '<your key>'
npm start
```
