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

The maximum JSON request body is 12 MiB. This is intended to support normal chat payloads and image prompts, not binary uploads.

## `GET /status`

Shows a local HTML status page for the same runtime data exposed by `GET /v1/status`. It renders immediately from cached diagnostics, then uses the local event stream for provider updates, active jobs, queued jobs, recent activity, and heartbeat state. The Settings tab loads its Local ASR, local music-analysis, and relay-routing settings only when first opened. It also provides a real image, video, transcription, or music-analysis test action for each ready, compatible provider model. Audio tests visibly warn when the selected xAI model uploads the file to the cloud; local music-analysis tests stay on the machine. The Live tab shows the selected provider/API, workflow/skill, bounded redacted stdin, bounded stdout/stderr/session output, and recent image thumbnails that open in an in-page overlay. The tray app opens this page when the tray icon is double-clicked.

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
      "videos": "model-relay:openai-videos:sora-2",
      "transcribe": "model-relay:local-asr:auto",
      "media.analyze": "model-relay:codex:auto",
      "music.analyze": "model-relay:music-analysis:core"
    }
  },
  "models": [],
  "backends": []
}
```

## `POST /v1/relay/settings`

Saves the provided relay-only defaults in the existing local state file. Send either a `settings.defaults` object or the defaults object directly. Omitted or blank operations retain their built-in defaults. The Settings page keeps an unavailable saved selection visible so it can be corrected; saving it does not make an unavailable provider runnable.

```json
{
  "settings": {
    "defaults": {
      "chat": "model-relay:grok-cli:auto",
      "images": "model-relay:grok-cli:image"
    }
  }
}
```

These settings apply only to `/v1/relay/jobs/*`, never to legacy `/v1/chat`, `/v1/images`, `/v1/transcribe`, `/v1/videos`, `/v1/media/analyze`, or `/v1/music/analyze`.

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

Store the token in browser storage scoped to the origin. Treat it as a bearer secret. If pairing succeeds, the bridge rotates the tray pairing code.

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
      "model-relay:xai:grok-4.3"
    ]
  },
  "backends": [
    {
      "id": "model-relay:xai:grok-4.3",
      "type": "text",
      "backend": "xai-api"
    }
  ]
}
```

Grok and Cursor entries carry readiness metadata; choose them only after local detection reports them ready. Grok Imagine image/video entries are omitted until the installed Imagine skill metadata declares their tools. The video entry is experimental and records whether a local video request has completed successfully. If `CODEX_HOME/models_cache.json` exists, additional text model IDs from that cache are returned as `codex-local:<id>`.

Provider-neutral IDs use the `model-relay:<backend>:<model>` form. Existing frontend code can keep sending `codex-local:*`; newer clients may send `model-relay:*` or specify `payload.provider` / `payload.backend`.

## `/v1/relay/jobs/*`

Provider-neutral job aliases use the same signed envelope and response shapes as the legacy execution routes:

- `POST /v1/relay/jobs/chat`
- `POST /v1/relay/jobs/images`
- `POST /v1/relay/jobs/transcribe`
- `POST /v1/relay/jobs/videos`
- `POST /v1/relay/jobs/media/analyze`
- `POST /v1/relay/jobs/music/analyze`

Routing is selected from an explicit `payload.provider`, `payload.backend`, or model ID. An explicit selection wins. When none is supplied, the bridge inserts the persisted relay default for the operation: `chat`, `images`, `videos`, `transcribe`, `media.analyze`, or `music.analyze`. For example, `model-relay:xai:grok-4.3` routes to the Grok/xAI API driver, `model-relay:xai:stt` routes to xAI Speech-to-Text, and `model-relay:local-asr:qwen3-asr-0.6b` routes to the local ASR driver.

If the selected/default provider is unknown, disabled, unauthenticated, or does not support the requested operation, the route returns a configuration error naming the selected model and safe reason. It never falls back to another provider. `grok` and `grok-cli` select the local Grok CLI; `xai` and `xai-api` select the separately configured xAI API. This rule is limited to `/v1/relay/jobs/*`; legacy routes retain their existing behavior.

`model-relay:grok-cli:auto` is Grok CLI chat/coding. `model-relay:grok-cli:image` runs the detected Imagine image workflow. `model-relay:grok-cli:video` runs the experimental Imagine image-to-video/reference-to-video workflow. Image references may be data URLs, `{ b64_json, mime_type }` objects, `referenced_image_paths`, or `frames`; the bridge validates and materializes them only in the per-request workspace. With one supplied image, Grok runs image-to-video; with multiple, it runs reference-to-video. Without one, the relay first generates a temporary source image and then runs image-to-video. The bridge collects only final artifacts from that workspace's output directory and fails explicitly if Imagine tooling, generated artifacts, moderation, or the bounded process run fails.

`model-relay:antigravity-cli:auto` runs non-interactive Antigravity CLI chat. `model-relay:antigravity-cli:image` instructs the documented `generate_image` tool exactly once, with a request-unique image name; the bridge imports only a matching, newly-created PNG/JPEG/WebP artifact from the configured Antigravity CLI state root. `model-relay:antigravity-cli:media` analyzes a locally materialized video attachment or bounded visual frames and returns a normal chat-style answer. Configure `AI_MODEL_RELAY_ANTIGRAVITY_BINARY`, use the local Settings panel's **Antigravity CLI executable** field, or install authenticated `agy` on PATH; saving a changed executable path automatically re-probes every CLI provider, and **Refresh detection** always forces a probe. Neither modifies Windows PATH nor restarts the bridge. The bridge never installs it, authenticates it, changes its settings, or falls back to another provider. Antigravity analysis is not local-only: supplied media is handled by the authenticated Antigravity CLI under its Google account and policy.

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
    "max_tokens": 256
  }
}
```

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

The bridge returns exactly one detected generated image. If Codex completes without creating a new image under `CODEX_HOME/generated_images`, the bridge returns `success: false`.

When the installed Codex CLI supports `codex exec --json`, image and chat jobs use the structured event stream for cleaner progress and error details. If an older CLI rejects `--json`, the bridge reruns the job without structured events and preserves the legacy result shape.

## `GET /v1/status/jobs/{jobId}/artifacts/{index}`

Returns a retained PNG, JPEG, or WebP image artifact from a recent completed job. This local status-page helper does not require pairing and is only available while the matching job remains in the in-memory recent-job cache. It returns `404` after eviction or for an invalid artifact index.

The job's `artifacts` metadata in `/v1/status` and status events provides the same-origin URL, MIME type, and byte size. Artifact bytes are intentionally not embedded in JSON or SSE responses.

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

Runs an optional OpenAI Videos API job. This route is disabled unless `ALORBACH_CODEX_ENABLE_VIDEO=1` and `ALORBACH_OPENAI_API_KEY` or `OPENAI_API_KEY` are configured. It is API-backed and not part of the user's local Codex allowance.

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
    "transcript": "Optional supplied audio transcript."
  }
}
```

For Codex `media_url` or `media_data_url` analysis, `ffmpeg` must be available on PATH. This route analyzes provided visual frames and optional transcript text; use `POST /v1/transcribe` first when audio content needs local transcription. Antigravity video analysis does not add an audio-transcription or audio-analysis operation.

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
