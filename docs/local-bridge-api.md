# AI Model Relay API

This API was introduced as Codex Local Bridge. Existing `/v1` routes and `codex-local:*` model IDs remain supported. Provider-neutral aliases are exposed under `/v1/relay/*`.

Default base URL:

```text
http://127.0.0.1:8765
```

The port can be changed with `ALORBACH_CODEX_BRIDGE_PORT`.

All routes return JSON and set `Cache-Control: no-store`. The bridge accepts only localhost socket clients. Browser callers must use an `http` or `https` origin; `file://` origins are rejected.

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

Shows a local HTML status page for the same runtime data exposed by `GET /v1/status`. The page uses the local event stream to show bridge readiness, capabilities, active jobs, queued jobs, recent activity, heartbeat state, and bounded live Codex session output without repeatedly reloading the full status payload. The tray app opens this page when the tray icon is double-clicked.

## `GET /v1/status`

Checks bridge and default local Codex readiness. `GET /v1/relay/status` is an alias with the same response shape. This route does not require pairing.

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
    "version": "1.0.1",
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
  }
}
```

`success: false` means the tray bridge is reachable but Codex is missing, not executable, or not logged in for the current Windows user.

`jobs` reports in-memory local bridge activity. It never includes prompt text or message content. `active` contains currently running jobs, while queued and recent entries may also be present for tray/status diagnostics.

Full prompt/output debug files are written separately under `%TEMP%\alorbach-codex-local-bridge-debug` and are deleted on bridge startup. Successful provider metadata and some failure details may include `debug_log_dir` pointing to the invocation folder.

`asr` contains a Local ASR summary. The default status response is intentionally lightweight and does not run Python, ffmpeg, GPU, or CUDA probes; runtime fields may report `runtime_checked: false` until `/v1/asr/settings?refresh=1` is called or a transcription job runs.

## `GET /v1/status/events`

Streams local status-page updates as server-sent events. This route does not require pairing because the bridge still accepts only localhost socket clients. It emits:

- `status`: JSON payload compatible with `GET /v1/status`.
- `capabilities`: JSON payload compatible with `GET /v1/capabilities`.
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

Returns capability metadata for the relay, local Codex executable, Local ASR providers, optional video provider, media analysis support, frontend interfaces, and backend drivers. `GET /v1/relay/capabilities` is an alias. This route does not require pairing. Local ASR capability data is lightweight by default so the status page can load quickly.

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
    "version": "1.0.4"
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

If `CODEX_HOME/models_cache.json` exists, additional text model IDs from that cache are returned as `codex-local:<id>`.

Provider-neutral IDs use the `model-relay:<backend>:<model>` form. Existing frontend code can keep sending `codex-local:*`; newer clients may send `model-relay:*` or specify `payload.provider` / `payload.backend`.

## `/v1/relay/jobs/*`

Provider-neutral job aliases use the same signed envelope and response shapes as the legacy execution routes:

- `POST /v1/relay/jobs/chat`
- `POST /v1/relay/jobs/images`
- `POST /v1/relay/jobs/transcribe`
- `POST /v1/relay/jobs/videos`
- `POST /v1/relay/jobs/media/analyze`

Routing is selected from `payload.provider`, `payload.backend`, or the model ID. For example, `model-relay:xai:grok-4.3` routes to the Grok/xAI API driver, while `model-relay:local-asr:qwen3-asr-0.6b` routes to the local ASR driver. If no provider is specified, relay chat and image jobs preserve the Codex default.

Audio model IDs are configured by Local ASR settings. When a transcription request omits `payload.model` or uses `local-asr`, the bridge first uses `settings.default_model` if it is set. Otherwise `local-asr` auto-selects the best enabled ready local transcription model. Qwen3 ASR 1.7B is preferred when `Qwen/Qwen3-ASR-1.7B` and `Qwen/Qwen3-ForcedAligner-0.6B` are cached or explicitly downloadable and CUDA has enough free VRAM; `Qwen/Qwen3-ASR-0.6B` is the lower-VRAM Qwen ASR fallback. When `allow_qwen_cpu_offload` is enabled, explicit/default Qwen selections can use mixed GPU/CPU loading and report `device: "cuda+cpu"` with `device_map: "auto"`. The Qwen runner pre-chunks timestamped ASR locally using `qwen_chunk_seconds` and caps implausibly stretched single-word spans using `qwen_max_word_duration_seconds`, reporting any caps in provider metadata. The ForcedAligner is used only for Qwen timestamps and is not exposed as a normal audio model. If faster-whisper CUDA fails at execution time, the bridge retries on CPU/int8 when a CPU model path is available.

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

The bridge writes the submitted audio to a temporary local file, runs `src/asr-runner.py` for faster-whisper or `src/asr-qwen-runner.py` for Qwen providers, and requires explicit per-word `start` and `end` seconds. Missing timestamps are returned as an output-detection failure. The JSON body is still bounded by the bridge request size limit.

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

Analyzes bounded media frames through local Codex vision prompts. The safest input is a small array of image data URLs in `payload.frames`. The bridge can also download an HTTPS `media_url` and extract frames with `ffmpeg` when available. Local file paths, non-HTTPS URLs, localhost, and private-network URLs are rejected.

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
    "transcript": "Optional supplied audio transcript."
  }
}
```

For `media_url` analysis, `ffmpeg` must be available on PATH. This route analyzes provided visual frames and optional transcript text; use `POST /v1/transcribe` first when audio content needs local transcription.

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
      "Open the status page and check Codex readiness plus recent failed jobs.",
      "Use the tray menu Copy diagnostics action for a safe diagnostic payload without bearer tokens."
    ]
  }
}
```

`debug_help` is intended for failed local bridge requests. It includes the request id when available, local status links, and safe troubleshooting steps. Running jobs and recent failed jobs in `GET /v1/status` can include bounded `session_output` when Codex stderr/stdout/last response text is available.

Common status codes:

- `400`: invalid JSON, oversized body, missing required fields, invalid origin, invalid payload.
- `403`: non-localhost socket, bad pairing code, missing or invalid pairing token.
- `404`: unknown route.
- `405`: unsupported method.
- `500`: Codex execution failed or unexpected bridge failure.
- `503`: status route reached the bridge, but Codex is not ready.
