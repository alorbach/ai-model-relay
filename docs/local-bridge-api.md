# AI Model Relay API

This API was introduced as Codex Local Bridge. Existing `/v1` routes and `codex-local:*` model IDs remain supported. Provider-neutral aliases are exposed under `/v1/relay/*`.

Default base URL:

```text
http://127.0.0.1:8765
```

The port can be changed with `ALORBACH_CODEX_BRIDGE_PORT`.

JSON API routes set `Cache-Control: no-store`. `/status` returns HTML, the status-stream routes return server-sent events, and the local recent-artifact route returns an image. The bridge accepts only localhost socket clients. Browser callers must use an `http` or `https` origin; `file://` origins are rejected.

## Headers

Paired routes require:

```http
Origin: http://127.0.0.1:8787
Content-Type: application/json
X-Alorbach-Bridge-Token: <pairing-token>
X-Alorbach-Request-Id: <request-id>
```

`X-Alorbach-Request-Id` is currently forwarded as a request identity header for clients and CORS, while `request_id` in the JSON body is the required bridge-side field for execution routes.

## Body Limit

The maximum JSON request body is 12 MiB. This is intended to support normal chat payloads and image prompts, not binary uploads. It is independent of chat `max_tokens`.

## Chat and media `max_tokens`

Chat-like jobs resolve an output-token **target** in `src/token-policy.js`. This is not a model context window. Codex still has no `--max-tokens` flag: the resolved value is a prompt hint. xAI and API-key chat send it as both `max_tokens` and `max_completion_tokens`. Grok CLI, Cursor Agent, and Antigravity CLI ignore the numeric field and do not rewrite the user's CLI config files.

| Job type | Code default | Used by |
|----------|--------------|---------|
| `chat` | **8192** | Codex chat hint; xAI / API-key HTTP bodies |
| `media.analyze` | **4096** | Codex-backed media analysis |

Resolution rules:

1. Omitted, non-numeric, `<= 0`, or **below 512** (including leftover samples of `256`) → use the job-type default.
2. Integer **>= 512** → use that value unchanged (the client may ask for more or somewhat less than the default).
3. Status-page **Chat token default** / **Media analysis token default** (`settings.token_defaults`) replace the code default when set. Allowed range is **512–128000**. Blank means the code default.
4. An explicit client `max_tokens >= 512` still wins over Settings.

`token_defaults` apply to every chat and media-analysis driver, including legacy `/v1/chat` and `/v1/media/analyze`. Provider routing `settings.defaults` still apply only to `/v1/relay/jobs/*`.

Images and videos do not use this policy. The Relay does not copy `stream` into HTTP chat bodies; chat completions are fully buffered.

## `GET /status`

Shows a local HTML status page for the same runtime data exposed by `GET /v1/status`. It renders immediately from cached diagnostics, then uses the local event stream for provider updates, active jobs, queued jobs, recent activity, and heartbeat state. The Settings tab loads its Local ASR, local music-analysis, relay-routing, CLI path, and chat/media token-default settings only when first opened. It also provides a real image, video, transcription, or music-analysis test action for each ready, compatible provider model. Audio tests visibly warn when the selected xAI model uploads the file to the cloud; local music-analysis tests stay on the machine. The Live tab shows the selected provider/API, workflow/skill, bounded redacted stdin, bounded stdout/stderr/session output, and recent image thumbnails that open in an in-page overlay. The tray app opens this page when the tray icon is double-clicked.

## `GET /v1/status`

Returns the cached bridge and provider-readiness snapshot. `GET /v1/relay/status` is an alias with the same response shape. This route does not run a CLI process: startup and explicit refreshes probe providers in the background. This route does not require pairing.

Example response:

```json
{
  "success": true,
  "message": "Local Codex CLI is installed and logged in.",
  "details": {
    "codex_binary": "<path-to-codex-executable>",
    "codex_home": "<user-home>\\.codex",
    "auth_path": "<user-home>\\.codex\\auth.json",
    "generated_images_dir": "<user-home>\\.codex\\generated_images",
    "version": "codex ...",
    "login_status": "Logged in ..."
  },
  "bridge": {
    "version": "1.0.7",
    "product_name": "AI Model Relay",
    "short_name": "Model Relay",
    "legacy_name": "Codex Local Bridge",
    "paired_origins": [
      "http://127.0.0.1:8787"
    ]
  },
  "jobs": {
    "running_count": 1,
    "queued_count": 0,
    "max_concurrent": 2,
    "active": [
      {
        "request_id": "request-123",
        "short_request_id": "request-123",
        "type": "chat",
        "model": "codex-local:auto",
        "status": "running",
        "elapsed_ms": 1200
      }
    ]
  },
  "checking": false,
  "last_checked": "2026-07-13T08:30:00.000Z",
  "refresh": {
    "active": false,
    "id": 1,
    "started_at": "2026-07-13T08:29:59.000Z",
    "completed_at": "2026-07-13T08:30:00.000Z",
    "error": null
  }
}
```

During an initial or explicit probe, `checking: true` means the cached result is still being refreshed. `success: false` can mean the tray bridge is reachable while its default Codex status is not ready; inspect `details`, `checking`, and the provider cards for the safe diagnostic reason.

`jobs` reports in-memory local bridge activity. `active` contains currently running jobs, while queued and recent entries may also be present. Each job can include selected `provider`, `provider_label`, `workflow`, and `skills`, plus bounded redacted `session_input`, bounded `session_output`, and image `artifacts` metadata for the local status page. These diagnostics exclude common bearer/API-key/authorization values; they are not a replacement for the private debug files.

Full prompt/output debug files are written separately under `%TEMP%\alorbach-codex-local-bridge-debug` and are deleted on bridge startup. Successful provider metadata and some failure details may include `debug_log_dir` pointing to the invocation folder.

`asr` contains a Local ASR summary. The default status response is intentionally lightweight and does not run Python, ffmpeg, GPU, or CUDA probes; runtime fields may report `runtime_checked: false` until `/v1/asr/settings?refresh=1` is called or a transcription job runs.

`music_analysis` is the separate local acoustic-feature runtime. It is also lightweight by default: call `/v1/music-analysis/settings?refresh=1` or run its explicit setup action to check Python, ffmpeg/ffprobe, and the dedicated `librosa` environment.

## `GET /v1/status/events`

Streams local status-page updates as server-sent events. This route does not require pairing because the bridge still accepts only localhost socket clients. It emits:

- `status`: JSON payload compatible with `GET /v1/status`, including cached refresh progress.
- `capabilities`: JSON payload compatible with `GET /v1/capabilities`, including provider discovery changes.
- `jobs`: the `jobs` object from `GET /v1/status`.
- `heartbeat`: `{ "time": "<iso-date>" }` keepalive events.

Existing consumers that listen only for `jobs` events remain compatible.

## `GET /v1/status/stream`

Streams authenticated status updates for paired browser/API clients. This route requires:

```http
Origin: <paired-browser-origin>
X-Alorbach-Bridge-Token: <pairing-token>
```

The response uses `text/event-stream`, includes CORS headers for the paired origin, and emits `status`, `capabilities`, `jobs`, and `heartbeat` events. The `status` event intentionally omits `bridge.paired_origins` so a paired site cannot enumerate other paired sites. Job payloads remain bounded diagnostics only and do not include prompts, messages, or bearer tokens.

Browser clients should use `fetch()` streaming because native `EventSource` cannot send the required `X-Alorbach-Bridge-Token` header. Browsers set `Origin` automatically:

```js
const response = await fetch('http://127.0.0.1:8765/v1/status/stream', {
	headers: {
		'X-Alorbach-Bridge-Token': bridgeToken,
	},
});

for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
	console.log(chunk);
}
```

## `GET /v1/capabilities`

Returns cached capability metadata for the relay, local Codex executable, Grok CLI, Cursor Agent, Local ASR providers, optional API drivers, media analysis support, frontend interfaces, and backend drivers. `GET /v1/relay/capabilities` is an alias. This route does not require pairing and does not start synchronous CLI probing. Local ASR capability data is lightweight by default so the status page can load quickly.

Example response:

```json
{
  "success": true,
  "product": {
    "name": "AI Model Relay",
    "short_name": "Model Relay",
    "legacy_name": "Codex Local Bridge"
  },
  "bridge": {
    "version": "1.0.7"
  },
  "codex": {
    "binary": "<path-to-codex-executable>",
    "version": "codex-cli 0.137.0"
  },
  "features": {
    "chat": true,
    "images": true,
    "audio_transcription": true,
    "media_analysis": true,
    "structured_exec_json": true,
    "output_schema": true,
    "image_attachments": true,
    "image_reference_attachments": true,
    "app_server": true
  },
  "backends": [
    {
      "id": "codex-cli",
      "label": "Codex CLI",
      "kind": "local-cli",
      "ready": true
    },
    {
      "id": "grok-cli",
      "label": "Grok CLI",
      "kind": "local-cli",
      "ready": true,
      "features": { "chat": true, "images": true, "videos": "experimental" }
    },
    {
      "id": "cursor-cli",
      "label": "Cursor Agent",
      "kind": "local-cli",
      "ready": false
    },
    {
      "id": "xai-api",
      "label": "Grok / xAI API",
      "kind": "api",
      "configured": false,
      "ready": false
    }
  ],
  "frontend_interfaces": {
    "legacy_v1": true,
    "relay_v1": true
  },
  "asr": {
    "enabled": true,
    "ready": null,
    "runtime_checked": false,
    "models": ["local-asr", "local-asr:whisper-large-v3"]
  },
  "video": {
    "enabled": false,
    "configured": false,
    "provider": "openai-videos-api",
    "models": ["sora-2", "sora-2-pro"]
  },
  "media_analysis": {
    "enabled": true,
    "provider": "local-codex-vision",
    "ffmpeg_available": true
  }
}
```

Each backend record can include `installed`, `ready`, `checking`, executable `path`, `version`, supported job types/features, and a safe diagnostic reason. API credentials and raw CLI output are never returned. Grok image and experimental-video selections are runnable only when the installed Grok Imagine tooling is available.

## `GET /v1/relay/settings`

Returns persisted relay-only operation defaults plus the cached compatible model and backend metadata. It does not require pairing because the bridge is localhost-only.

```json
{
  "success": true,
  "settings": {
    "defaults": {
      "chat": "model-relay:codex:auto",
      "images": "model-relay:codex:image",
      "videos": "model-relay:xai:imagine-video",
      "transcribe": "model-relay:local-asr:auto",
      "media.analyze": "model-relay:codex:auto",
      "music.analyze": "model-relay:music-analysis:core"
    },
    "cli_paths": {
      "codex-cli": "",
      "grok-cli": "",
      "antigravity-cli": "",
      "cursor-cli": "",
      "cli-process": ""
    },
    "token_defaults": {
      "chat": "",
      "media.analyze": ""
    }
  },
  "models": [],
  "backends": []
}
```

Empty `token_defaults` values mean the code defaults (8192 / 4096). A stored integer is the Settings override.

## `POST /v1/relay/settings`

Saves the provided relay-only defaults in the existing local state file. Send a `settings` object with any of `defaults`, `cli_paths`, and `token_defaults`. Omitted routing operations retain their built-in defaults. The Settings page keeps an unavailable saved selection visible so it can be corrected; saving it does not make an unavailable provider runnable. Blank `token_defaults.chat` or `token_defaults['media.analyze']` clears that override.

```json
{
  "settings": {
    "defaults": {
      "chat": "model-relay:grok-cli:auto",
      "images": "model-relay:grok-cli:image"
    },
    "token_defaults": {
      "chat": 16384
    }
  }
}
```

Provider routing `defaults` apply only to `/v1/relay/jobs/*`, never to legacy `/v1/chat`, `/v1/images`, `/v1/transcribe`, `/v1/videos`, `/v1/media/analyze`, or `/v1/music/analyze`. `token_defaults` apply to chat and media-analysis jobs on both legacy and relay routes.

## `POST /v1/relay/refresh`

Starts one deduplicated provider-detection refresh and returns immediately with `202`. Repeated requests while a refresh is active share the same cycle. Use `/v1/status/events` or `/v1/status/stream` to receive incremental cached status and capability updates.

```json
{
  "success": true,
  "checking": true,
  "refresh": { "active": true, "id": 2 }
}
```

## `POST /v1/relay/test`

Local status-page helper for deliberately testing one ready image, video, transcription, or music-analysis provider. It only accepts localhost socket clients, requires an explicit model, uses the same strict relay resolution as `/v1/relay/jobs/*`, and never falls back to another provider. It is not a WordPress integration route and does not use a signed job envelope.

```json
{
  "job_type": "videos",
  "model": "model-relay:grok-cli:video",
  "prompt": "Create a short motion from this image.",
  "input_reference_data_url": "data:image/png;base64,..."
}
```

`input_reference_data_url` is optional for image and video tests and is materialized only in the provider request workspace. When Grok video has no supplied image, the relay first generates a temporary source image in the request workspace, then runs image-to-video. For transcription and music-analysis tests send bounded `audio_base64` and `audio_format` instead. `model-relay:xai:stt` sends that selected audio to xAI; `model-relay:music-analysis:core` processes it locally. The response uses the normal job response shape, and the resulting job and any image preview are visible in the Live tab.

## `GET /v1/asr/settings`

Returns Local ASR settings and cached or lightweight runtime metadata. This route does not require pairing because the bridge only accepts localhost clients.

Default requests avoid expensive runtime probes:

```text
GET /v1/asr/settings
```

Use `refresh=1` when the user explicitly wants to check Python, the virtual environment, ffmpeg/ffprobe, GPU memory, and CUDA runtime packages:

```text
GET /v1/asr/settings?refresh=1
```

Response:

```json
{
  "success": true,
  "settings": {
    "allow_package_install": true,
    "allow_model_downloads": false,
    "allow_qwen_cpu_offload": true,
    "default_model": "qwen3-asr-0.6b",
    "python_path": "",
    "venv_path": "<user-home>\\.alorbach-codex-bridge\\asr-venv",
    "qwen_python_path": "",
    "qwen_venv_path": "<user-home>\\.alorbach-codex-bridge\\qwen-asr-venv",
    "qwen_chunk_seconds": 30,
    "qwen_max_word_duration_seconds": 12,
    "cpu_threads": 4,
    "models": [
      {
        "id": "whisper-large-v3",
        "label": "Local Whisper Large v3",
        "provider": "faster-whisper",
        "repo_id": "ctranslate2-4you/whisper-large-v3-ct2-float32",
        "gpu_repo_id": "ctranslate2-4you/whisper-large-v3-ct2-float16",
        "min_vram_mb": 8192,
        "enabled": true,
        "preferred_device": "auto"
      },
      {
        "id": "qwen3-asr-1.7b",
        "label": "Local Qwen3 ASR 1.7B",
        "provider": "qwen-asr",
        "repo_id": "Qwen/Qwen3-ASR-1.7B",
        "aligner_repo_id": "Qwen/Qwen3-ForcedAligner-0.6B",
        "min_vram_mb": 10000,
        "enabled": true,
        "preferred_device": "cuda"
      },
      {
        "id": "qwen3-asr-0.6b",
        "label": "Local Qwen3 ASR 0.6B",
        "provider": "qwen-asr",
        "repo_id": "Qwen/Qwen3-ASR-0.6B",
        "aligner_repo_id": "Qwen/Qwen3-ForcedAligner-0.6B",
        "min_vram_mb": 6000,
        "enabled": true,
        "preferred_device": "cuda"
      }
    ]
  },
  "capabilities": {
    "enabled": true,
    "ready": null,
    "runtime_checked": false,
    "models": ["local-asr", "local-asr:whisper-large-v3", "local-asr:qwen3-asr-1.7b", "local-asr:qwen3-asr-0.6b"]
  }
}
```

When runtime probing is refreshed, `capabilities.runtime.qwen_torch_cuda` reports whether the Qwen venv has a CUDA-enabled PyTorch build. If `qwen-asr` installed CPU-only torch, the bridge can repair it when package installation is enabled.

`POST /v1/asr/settings` saves the same settings object. Saving invalidates the in-memory runtime probe cache; the status page can then call `GET /v1/asr/settings?refresh=1` to recheck the environment.

## `GET /v1/music-analysis/settings`

Returns settings and cached readiness for the separate local music-analysis runtime. It does not require pairing because the bridge only accepts localhost clients. A normal request performs no Python or ffmpeg work; append `?refresh=1` for an explicit runtime probe.

```json
{
  "success": true,
  "settings": {
    "python_path": "",
    "venv_path": "<user-home>\\.alorbach-codex-bridge\\music-analysis-venv",
    "sample_rate": 22050,
    "max_sections": 12
  },
  "capabilities": {
    "enabled": true,
    "ready": null,
    "runtime_checked": false,
    "models": ["model-relay:music-analysis:core"]
  }
}
```

`POST /v1/music-analysis/settings` saves the same settings object. `POST /v1/music-analysis/setup` is the explicit opt-in setup action: it creates the dedicated virtual environment and installs `numpy`, `scipy`, `soundfile`, `librosa`, and `pyloudnorm`. It never runs automatically. The runtime also requires `ffmpeg` and `ffprobe` on PATH.

## `GET/POST /v1/relay/pairing-code`

Local status-page settings for the desktop app pairing code. Requests are restricted to the local Relay status page. The GET response reports only whether a fixed code is active and whether OS-backed storage is available; it never returns the code. POST accepts `{"pairing_code":"123456"}` to enable a fixed six-digit code or `{"enabled":false}` to return to rotating codes. Saving requires the Electron desktop app and OS-backed secure storage. Fixed codes survive successful pairings and restarts.

## `POST /v1/pair`

Pairs a browser origin with the bridge.

Request:

```json
{
  "origin": "http://127.0.0.1:8787",
  "pairing_code": "123456"
}
```

Response:

```json
{
  "success": true,
  "origin": "http://127.0.0.1:8787",
  "token": "..."
}
```

Store the token in browser storage scoped to the origin. Treat it as a bearer secret. Pairing success rotates the code by default; when the local user enabled a fixed code in Settings → Pairing, the code remains active. Pairing failures share a persistent IP-wide rate limit.

## `POST /v1/unpair`

Removes the pairing for the request origin.

Request headers must include `Origin` and `X-Alorbach-Bridge-Token`.

Response:

```json
{
  "success": true
}
```

## `GET /v1/models`

Returns local and relay model IDs after pairing. `GET /v1/relay/models` is an alias.

Response:

```json
{
  "success": true,
  "models": {
    "text": [
      "codex-local:auto"
    ],
    "image": [
      "codex-local:image"
    ],
    "audio": [
      "local-asr",
      "local-asr:whisper-large-v3",
      "local-asr:whisper-medium",
      "local-asr:whisper-small",
      "local-asr:qwen3-asr-1.7b",
      "local-asr:qwen3-asr-0.6b"
    ],
    "relay": [
      "model-relay:codex:auto",
      "model-relay:codex:image",
      "model-relay:grok-cli:auto",
      "model-relay:grok-cli:image",
      "model-relay:grok-cli:video",
      "model-relay:cursor-cli:auto",
      "model-relay:local-asr:qwen3-asr-0.6b",
      "model-relay:xai:grok-4.6",
      "model-relay:xai:imagine-image",
      "model-relay:xai:imagine-video"
    ]
  },
  "backends": [
    {
      "id": "grok-cli",
      "label": "Grok CLI",
      "kind": "local-cli",
      "ready": true,
      "job_types": ["chat", "images"]
    },
    {
      "id": "model-relay:grok-cli:image",
      "type": "image",
      "backend": "grok-cli",
      "ready": true,
      "job_types": ["images"]
    },
    {
      "id": "model-relay:xai:grok-4.6",
      "type": "text",
      "backend": "xai-api"
    }
  ]
}
```

Grok and Cursor entries carry readiness metadata; choose them only after local detection reports them ready. When the installed CLI lists models (`grok models`, `cursor-agent models` / `--list-models`), those IDs appear as `model-relay:grok-cli:<id>` and `model-relay:cursor-cli:<id>` in addition to `auto`. Parse failures keep `auto` only. Grok Imagine image/video entries are omitted until the installed Imagine skill metadata declares their tools. The video entry is experimental and records whether a local video request has completed successfully. If `CODEX_HOME/models_cache.json` exists, additional text model IDs from that cache are returned as `codex-local:<id>`.

Provider-neutral IDs use the `model-relay:<backend>:<model>` form. Existing frontend code can keep sending `codex-local:*`; newer clients may send `model-relay:*` or specify `payload.provider` / `payload.backend`.

### Versioned image capability contract

Relay image clients must use the model-scoped `image_capabilities` returned on each image entry in `backends`. The same `backends` array also includes driver readiness records whose `id` is the backend name (`grok-cli`, `codex-cli`, `antigravity-cli`, `xai-api`). Clients that verify a ready image model must find both the model entry and the matching driver (`entry.backend`) with `job_types` including `images`. The response also includes `image_capability_contract_version` and `image_capability_minimum_relay_version`; clients that rely on provider-specific controls must require contract version `1` and a Relay version of at least `1.0.10`. The contract is the authoritative allowlist for `supported_sizes`, `supported_qualities`, `supported_aspect_ratios`, `supported_output_formats`, `candidate_count_max`, reference limits, and `provider_options`.

Provider-native resolution controls are sent inside `provider_options` using the advertised key: Codex uses `size` with pixel presets, Grok and xAI use `resolution` with `1k`/`2k`, and Antigravity uses `image_size` with `1K`/`2K`/`4K`. Native aspect-ratio and quality controls are also listed in `provider_options`. A generic pixel `size` must not be sent to a model whose contract advertises a native resolution key. Image catalog entries publish `job_types: ["images"]` only; clients should treat mixed chat/image `job_types` as an incomplete image contract. The `/v1/relay/jobs/images` and `/v1/relay/test` routes validate and normalize these fields before invoking a provider; unsupported quality, aspect, format, candidate, or reference selections fail with a validation error instead of reaching the provider.

## `/v1/relay/jobs/*`

Provider-neutral job aliases use the same signed envelope and response shapes as the legacy execution routes:

- `POST /v1/relay/jobs/chat`
- `POST /v1/relay/jobs/images`
- `POST /v1/relay/jobs/transcribe`
- `POST /v1/relay/jobs/videos`
- `POST /v1/relay/jobs/media/analyze`
- `POST /v1/relay/jobs/music/analyze`

Routing is selected from an explicit `payload.provider`, `payload.backend`, or model ID. An explicit selection wins. When none is supplied, the bridge inserts the persisted relay default for the operation: `chat`, `images`, `videos`, `transcribe`, `media.analyze`, or `music.analyze`. For example, `model-relay:xai:grok-4.6` routes to the Grok/xAI API chat driver, `model-relay:xai:imagine-image` and `model-relay:xai:imagine-video` route to xAI Imagine, `model-relay:xai:stt` routes to xAI Speech-to-Text, and `model-relay:local-asr:qwen3-asr-0.6b` routes to the local ASR driver. When `XAI_API_KEY` is set and no video default has been saved, the unsaved video default is `model-relay:xai:imagine-video`. xAI and API-key chat always include resolved `max_tokens` and `max_completion_tokens` and may pass `temperature` / `top_p` when the payload sets them; they do not send `stream`.

If the selected/default provider is unknown, disabled, unauthenticated, or does not support the requested operation, the route returns a configuration error naming the selected model and safe reason. It never falls back to another provider. `grok` and `grok-cli` select the local Grok CLI; `xai` and `xai-api` select the separately configured xAI API. This rule is limited to `/v1/relay/jobs/*`; legacy routes retain their existing behavior.

`model-relay:grok-cli:auto` is Grok CLI Gateway chat. The transcript is written to a temp `prompt.txt` (or `--prompt-json` when the CLI advertises it and the payload fits). The process command line does not carry the full transcript. Chat runs in that workspace with `--cwd`, `--permission-mode dontAsk`, `--no-subagents`, `--disable-web-search`, and `--disallowed-tools run_terminal_cmd`. When `grok models` reports a default ID (for example `grok-4.6`), `auto` and unknown native IDs are sent as `--model <default>`; a listed explicit ID is forwarded as-is. Data-URL image parts in chat messages are materialized in the workspace; they are never placed on argv as base64. Filesystem image paths are accepted only when they already resolve inside that same request workspace. When `grok models` lists IDs, those appear as `model-relay:grok-cli:<id>` in addition to `auto`.

`model-relay:grok-cli:image` runs the detected Imagine image workflow. `model-relay:grok-cli:video` runs the experimental Imagine image-to-video/reference-to-video workflow. Image references may be data URLs, `{ b64_json, mime_type }` objects, `referenced_image_paths`, or `frames`; the bridge validates and materializes them only in the per-request workspace. With one supplied image, Grok runs image-to-video; with multiple, it runs reference-to-video. Without one, the relay first generates a temporary source image and then runs image-to-video. Each Imagine invocation allowlists only the tool being called (`--tools image_gen`, `image_edit`, `image_to_video`, or `reference_to_video`) and still denies shell, subagents, and web search, with `--max-turns 2`. The bridge collects only final artifacts from that workspace's output directory (imported from the Grok session folder) and fails explicitly if Imagine tooling, generated artifacts, moderation, or the bounded process run fails. Grok CLI video tests expose aspect ratio, `480p`/`720p`/`1080p`, clip length, and soundtrack guidance.

`model-relay:cursor-cli:auto` is Cursor Agent Gateway chat in `--mode=ask` with `--print --output-format json --trust --workspace <temp>`. The transcript lives in `prompt.txt`; argv only tells the agent to read that file. Ask mode is read-only: Gateway chat is not a write/shell coding agent. When `cursor-agent models` or `--list-models` lists IDs, those appear as `model-relay:cursor-cli:<id>` in addition to `auto`. Cursor does not implement transcription.

`model-relay:xai:imagine-image` and `model-relay:xai:imagine-video` call the xAI Imagine HTTP API with native parameters (`aspect_ratio`, image `resolution` `1k`/`2k`, image `quality` `low`/`medium`, video `resolution` `480p`/`720p`/`1080p`, `seconds` 1–15, `generate_audio`). Image aspect ratios include `21:9` and `5:2`. Text-only image jobs POST to `/images/generations`; jobs with up to 3 references POST to `/images/edits` using a single `{ url, type: "image_url" }` object or an `images` array. Video image-to-video uses `{ image: { url } }`; reference-to-video accepts 2–7 `{ url }` objects on `reference_images` and caps `1080p` at `720p`. Responses return `response.data[].b64_json` for images and `response.b64_video` for videos. These models require `XAI_API_KEY` or `AI_MODEL_RELAY_XAI_API_KEY` and upload the prompt plus any reference images to xAI.

`model-relay:antigravity-cli:auto` runs non-interactive Antigravity CLI chat. The full transcript is written to a temp file; `-p` only instructs `agy` to read `@prompt.txt`, so chat is not capped at 24 000 characters. Chat image data URLs are materialized in that workspace. `model-relay:antigravity-cli:image` instructs the documented `generate_image` tool exactly once, with a request-unique image name, and asks `agy` to print `IMAGE_PATH: <absolute path>`. The bridge imports that path when it is a non-empty PNG/JPEG/WebP no larger than 20 MB inside the Antigravity state root or the request workspace. If the marker is missing, it falls back to scanning the state root for a matching newly-created file. Status-page image tests send `aspect_ratio` and Gemini-style `image_size` (`1K`/`2K`/`4K`) as generation guidance in the `generate_image` instruction. `model-relay:antigravity-cli:media` analyzes a locally materialized video attachment or bounded visual frames and returns a normal chat-style answer. Configure `AI_MODEL_RELAY_ANTIGRAVITY_BINARY`, use the local Settings panel's **Antigravity CLI executable** field, or install authenticated `agy` on PATH; saving a changed executable path automatically re-probes every CLI provider, and **Refresh detection** always forces a probe. Neither modifies Windows PATH nor restarts the bridge. The bridge never installs it, authenticates it, changes its settings, or falls back to another provider. Antigravity analysis is not local-only: supplied media is handled by the authenticated Antigravity CLI under its Google account and policy.

Codex CLI (`model-relay:codex:image`) and Grok CLI (`model-relay:grok-cli:image`) status-page size controls are generation guidance only. Codex embeds requested pixel sizes in the `image_gen` prompt text; Grok passes `aspect_ratio` as the native `image_gen` / `image_edit` tool argument and keeps 1K/2K asks inside the tool prompt. A Grok `image_edit` with one reference keeps that source canvas and ignores `aspect_ratio`; when the requested ratio differs from the reference, Relay duplicates the reference into a second path so Imagine treats it as a multi-image edit and honors `aspect_ratio`. Completed image jobs in `/v1/status` and on the Live tab may include measured artifact `width` and `height` next to `size_bytes`. Only xAI Imagine HTTP sends image `resolution` directly to the provider API.

Antigravity CLI 1.1.4 documents non-interactive `-p`/`--print`, but not `-o` or `--output-format`. The Relay therefore accepts print mode and normalizes plain-text output locally. If a later CLI advertises `-o` or `--output-format`, the Relay requests JSON output automatically.

Audio model IDs are configured by Local ASR settings. When a transcription request omits `payload.model` or uses `local-asr`, the bridge first uses `settings.default_model` if it is set. Otherwise `local-asr` auto-selects the best enabled ready local transcription model. Qwen3 ASR 1.7B is preferred when `Qwen/Qwen3-ASR-1.7B` and `Qwen/Qwen3-ForcedAligner-0.6B` are cached or explicitly downloadable and CUDA has enough free VRAM; `Qwen/Qwen3-ASR-0.6B` is the lower-VRAM Qwen ASR fallback. When `allow_qwen_cpu_offload` is enabled, explicit/default Qwen selections can use mixed GPU/CPU loading and report `device: "cuda+cpu"` with `device_map: "auto"`. The Qwen runner pre-chunks timestamped ASR locally using `qwen_chunk_seconds` and caps implausibly stretched single-word spans using `qwen_max_word_duration_seconds`, reporting any caps in provider metadata. The ForcedAligner is used only for Qwen timestamps and is not exposed as a normal audio model. If faster-whisper CUDA fails at execution time, the bridge retries on CPU/int8 when a CPU model path is available.

`model-relay:xai:stt` is opt-in and never selected by the Local ASR fallback. It sends `audio_base64`/`audio_format` as a multipart file to xAI. Optional `payload.xai_options` supports `language` (or `locale`), `format`, `diarize`, `filler_words`, `multichannel`, `channels`, and a bounded `keyterms` array; response data is normalized to `{ text, words, duration_seconds, language }`. The bridge never includes the xAI API key in an error, status, job, or diagnostic payload. Choose local ASR when the audio must remain on the machine.

## `POST /v1/chat`

Runs a local Codex chat completion.

Request:

```json
{
  "job_token": "<wordpress-job-token>",
  "request_hash": "<wordpress-request-hash>",
  "request_id": "<wordpress-request-id>",
  "payload": {
    "model": "codex-local:auto",
    "messages": [
      {
        "role": "user",
        "content": "Write a short status line."
      }
    ],
    "max_tokens": 8192
  }
}
```

`max_tokens` is optional. Omit it, or send a leftover sample below 512, to use the chat default (8192 unless Settings overrides it). Codex puts the resolved value in the prompt as a response-length hint and, when `codex exec --help` lists `--sandbox`, runs chat with `--sandbox read-only` plus `--ephemeral`. Image jobs do not force `read-only`. Data-URL image parts are passed with `--image`.

Response:

```json
{
  "success": true,
  "response": {
    "id": "local-codex-...",
    "object": "chat.completion",
    "model": "codex-local:auto",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "..."
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "total_tokens": 0,
      "local_unmetered": true
    }
  }
}
```

The bridge requires `job_token`, `request_hash`, and `request_id` to be present. In production, these fields come from WordPress and are validated when the browser posts the result back to Gateway.

## `POST /v1/images`

Runs a local Codex image request.

Request:

```json
{
  "job_token": "<wordpress-job-token>",
  "request_hash": "<wordpress-request-hash>",
  "request_id": "<wordpress-request-id>",
  "payload": {
    "model": "codex-local:image",
    "prompt": "A product-style image of a small desktop bridge icon",
    "size": "1024x1024",
    "quality": "high",
    "reference_images": [
      {
        "b64_json": "<base64>",
        "mime_type": "image/jpeg",
        "label": "product"
      }
    ]
  }
}
```

Reference images may also be supplied as `referenced_image_paths` (local filesystem paths readable by the bridge process) or `frames` (data URLs). When present, the bridge writes them to a temp directory and passes each file to `codex exec --image` before the text prompt, matching the multimodal chat path.

Response:

```json
{
  "success": true,
  "response": {
    "data": [
      {
        "b64_json": "..."
      }
    ],
    "usage": {
      "total_tokens": 0,
      "local_unmetered": true
    },
    "provider_details": {
      "image_path": "<user-home>\\.codex\\generated_images\\...",
      "generated_images_dir": "<user-home>\\.codex\\generated_images",
      "reference_attachment_count": 1,
      "refs_forwarded_to_codex": true
    }
  }
}
```

The bridge returns exactly one detected generated image. Detection snapshots `CODEX_HOME/generated_images`, prefers a validated path named by a structured JSON event, and otherwise takes the newest file created after that boundary. If Codex completes without a new image, the bridge returns `success: false`. Image jobs that use this shared directory remain serialized to one running image job at a time.

When the installed Codex CLI supports `codex exec --json`, image and chat jobs use the structured event stream for cleaner progress and error details. If an older CLI rejects `--json`, the bridge reruns the job without structured events and preserves the legacy result shape.

## `GET /v1/status/jobs/{jobId}/artifacts/{index}`

Returns a retained PNG, JPEG, or WebP image artifact from a recent completed job. This local status-page helper does not require pairing and is only available while the matching job remains in the in-memory recent-job cache. It returns `404` after eviction or for an invalid artifact index.

The job's `artifacts` metadata in `/v1/status` and status events provides the same-origin URL, MIME type, and byte size. Artifact bytes are intentionally not embedded in JSON or SSE responses.

## `GET /v1/relay/jobs/{requestId}/artifact`

Returns the paired binary PNG result for a completed local CUDA upscale. This route requires pairing and is the URL returned in `artifact_url` after `POST /v1/relay/jobs/upscale`. Status-page `<img>` / `<video>` previews continue to use the unpaired `/v1/status/jobs/{jobId}/artifacts/{index}` helper.

## Local Upscale capability contract

`GET /v1/relay/models` includes `upscale_capabilities` version `1` on each `model-relay:local-upscale:*` model. The same per-model records are also exposed under the `local-upscale` backend in `GET /v1/relay/capabilities`. The public contract includes the model's `native_scale`, required `output_policy`, accepted input and PNG output formats, CUDA/tile/precision characteristics, explicit-install state, model class, experimental flag, license and usage restrictions, and readiness state. It intentionally excludes checkout paths, model paths, SHA-256 values, and other local installation data.

The native contract is strict: a ×2 model accepts only `scale: 2` and `retain_native_x2`; a ×4 model accepts only `scale: 4` and `retain_native_x4`. The output width and height must be exactly the approved crop dimensions multiplied by the native scale. The runner records `downsampler: "none"`, and Relay rejects output that reports another value. Native ×4 PNG artifacts have a separate 256 MiB ceiling.

`POST /v1/upscale/setup` accepts `{ "model": "model-relay:local-upscale:..." }`; this is an explicit operator action. APISR additionally requires `{ "accept_restricted": true }` because it is experimental, GPL-3.0-only, and academic-only. DRCT ×2 has a pinned runtime/check-out profile but requires an operator-provided, independently verified ×2 checkpoint because an official ×2 release is not available.

## `POST /v1/transcribe`

Runs a local ASR transcription or reference-text alignment request through the private local ASR runtimes. This route requires pairing and the signed WordPress job envelope.

Request:

```json
{
  "job_token": "<wordpress-job-token>",
  "request_hash": "<wordpress-request-hash>",
  "request_id": "<wordpress-request-id>",
  "payload": {
    "model": "local-asr:whisper-large-v3",
    "audio_base64": "<base64-audio>",
    "audio_format": "mp3",
    "duration_seconds": 123,
    "language": "en"
  }
}
```

Response:

```json
{
  "success": true,
  "response": {
    "text": "Forbidden heaven",
    "words": [
      { "word": "Forbidden", "start": 1.25, "end": 1.75 }
    ],
    "model": "local-asr:whisper-large-v3",
    "local_codex": true,
    "provider_details": {
      "asr_provider": "faster-whisper",
      "device": "cuda",
      "compute_type": "float16"
    }
  }
}
```

The bridge writes the submitted audio to a temporary local file, runs `src/asr-runner.py` for faster-whisper or `src/asr-qwen-runner.py` for Qwen providers, and requires explicit per-word `start` and `end` seconds. Missing timestamps are returned as an output-detection failure. The JSON body is still bounded by the bridge request size limit. This legacy route remains local ASR only; use `/v1/relay/jobs/transcribe` with `model-relay:xai:stt` for the deliberate cloud option.

## `POST /v1/music/analyze`

Runs bounded local acoustic feature extraction. It requires pairing and the signed envelope; `/v1/relay/jobs/music/analyze` uses the same payload and can select the persisted `music.analyze` default.

```json
{
  "job_token": "<wordpress-job-token>",
  "request_hash": "<wordpress-request-hash>",
  "request_id": "<wordpress-request-id>",
  "payload": {
    "model": "model-relay:music-analysis:core",
    "audio_base64": "<base64-audio>",
    "audio_format": "mp3"
  }
}
```

```json
{
  "success": true,
  "response": {
    "model": "model-relay:music-analysis:core",
    "duration_seconds": 183.2,
    "music_analysis": {
      "tempo": { "bpm": 120.1, "beat_grid_seconds": [0.42, 0.92] },
      "key": { "tonic": "A", "mode": "minor", "confidence": 0.61 },
      "loudness": { "integrated_lufs": -10.3, "peak_dbfs": -0.2, "dynamic_range_db": 8.4 },
      "spectral": { "centroid_hz_mean": 2410.7, "rolloff_hz_mean": 4890.1 },
      "sections": [{ "label": "section_01", "start_seconds": 0, "end_seconds": 31.7 }]
    },
    "provider_details": { "provider": "music-analysis", "local": true }
  }
}
```

Sections are deliberately neutral numbered boundaries, not verse/chorus labels. This first local pipeline does not separate stems, detect chords, extract melody/MIDI, rank similarity, or chain transcription automatically.

## `POST /v1/videos`

The legacy `/v1/videos` route still runs an optional OpenAI Videos API job. It is disabled unless `ALORBACH_CODEX_ENABLE_VIDEO=1` and `ALORBACH_OPENAI_API_KEY` or `OPENAI_API_KEY` are configured. OpenAI lists Sora 2 and the Videos API for removal on 24 Sep 2026. Prefer `/v1/relay/jobs/videos` with `model-relay:xai:imagine-video` when an xAI key is configured.

Request:

```json
{
  "job_token": "<wordpress-job-token>",
  "request_hash": "<wordpress-request-hash>",
  "request_id": "<wordpress-request-id>",
  "payload": {
    "action": "create",
    "model": "sora-2",
    "prompt": "A product teaser clip for a desktop bridge app.",
    "size": "1280x720",
    "seconds": "8",
    "poll": true,
    "download": false
  }
}
```

Supported `action` values are `create`, `retrieve`, `download`, `remix`, and `delete`. Create/remix responses may return queued or in-progress jobs unless `poll` is true. Downloads return base64 MP4 content in `response.b64_video` or `response.content.b64_video`.

## `POST /v1/media/analyze`

Analyzes bounded media frames through local Codex vision prompts. The safest input is a small array of image data URLs in `payload.frames`. The bridge can also download an HTTPS `media_url` and extract frames with `ffmpeg` when available. A bounded MP4, MOV, WebM, or AVI `media_data_url` is also accepted; Codex extracts its frames locally, while the Antigravity Relay backend attaches the locally materialized video directly to its CLI request. Local file paths, non-HTTPS URLs, localhost, and private-network URLs are rejected.

Request:

```json
{
  "job_token": "<wordpress-job-token>",
  "request_hash": "<wordpress-request-hash>",
  "request_id": "<wordpress-request-id>",
  "payload": {
    "model": "codex-local:auto",
    "prompt": "Summarize this video for accessibility alt text.",
    "frames": [
      "data:image/png;base64,..."
    ],
    "media_data_url": "data:video/mp4;base64,...",
    "transcript": "Optional supplied audio transcript.",
    "max_tokens": 4096
  }
}
```

`max_tokens` is optional and follows the media.analyze default (4096 unless Settings overrides it). Optional `transcript` text is sliced to 32 000 characters. For Codex `media_url` or `media_data_url` analysis, `ffmpeg` must be available on PATH. This route analyzes provided visual frames and optional transcript text; use `POST /v1/transcribe` first when audio content needs local transcription. Antigravity video analysis does not add an audio-transcription or audio-analysis operation.

When Codex `exec --help` lists `--output-schema`, media analysis requests structured fields (`summary`, `visible_text`, `issues`, `confidence`, `notes`). Gateway clients that only read `choices[0].message.content` still receive a human-readable string. The parsed object is additive under `response.provider_details.media_analysis.structured`. If the CLI rejects `--output-schema`, the job retries as free text.

## Error Shape

Most errors use:

```json
{
  "success": false,
  "message": "Human-readable failure.",
  "details": {},
  "debug_help": {
    "request_id": "request-123",
    "route": "/v1/chat",
    "status_code": 500,
    "status_page": "http://127.0.0.1:8765/status",
    "status_json": "http://127.0.0.1:8765/v1/status",
    "checks": [
      "Open the status page and check selected-provider readiness plus recent failed jobs.",
      "Use the tray menu Copy diagnostics action for a safe diagnostic payload without bearer tokens."
    ]
  }
}
```

`debug_help` is intended for failed local bridge requests. It includes the request id when available, local status links, and safe troubleshooting steps. Running jobs and recent failed jobs in `GET /v1/status` can include bounded `session_output` when provider stderr/stdout/last response text is available.

Common status codes:

- `400`: invalid JSON, oversized body, missing required fields, invalid origin, invalid payload.
- `403`: non-localhost socket, bad pairing code, missing or invalid pairing token.
- `404`: unknown route.
- `405`: unsupported method.
- `500`: provider execution failed or an unexpected bridge failure occurred.
- `503`: a selected relay provider/default is unavailable, or the status route reached the bridge while its default Codex status is not ready.
