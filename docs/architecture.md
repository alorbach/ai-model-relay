# Architecture

AI Model Relay, formerly Codex Local Bridge, is a Windows tray companion for Alorbach AI Subscription Gateway. It lets a browser page on a paired WordPress origin execute AI jobs through local or API-backed backend drivers while the WordPress Gateway keeps ownership of plans, quotas, job signatures, audit records, and optional service fees.

## Components

### Electron tray app

Entry point: `src/main.js`

The tray app owns the user-facing desktop lifecycle:

- starts and stops the local HTTP bridge as a child process;
- shows the active bridge URL, pairing code, Codex login status, and paired WordPress origins;
- lets the user copy diagnostics without exposing stored bearer tokens;
- lets the user unpair an origin;
- optionally registers launch-on-login with Electron.

The app is intentionally tray-only. Closing normal windows is prevented because there are no windows to manage; quitting the tray app stops the local bridge process.

### Local HTTP bridge

Entry point: `src/server.js`

The bridge listens on `127.0.0.1` and defaults to port `8765`. It exposes a small JSON API under `/v1`. It accepts requests only from localhost sockets and relies on browser CORS plus per-origin pairing tokens to limit which browser origins can use the bridge.

The bridge does not call WordPress directly. It receives a WordPress-created job envelope from the browser, routes it to a backend driver, and returns the normalized result to the browser. The browser then completes or fails the WordPress job with the original one-time token and request hash.

Execution requests are scheduled through an in-memory queue. The default limit is two parallel jobs. Operators set concurrency and timeouts on **Settings → Runtime**; environment variables such as `ALORBACH_CODEX_MAX_CONCURRENT_JOBS` apply only when the matching Settings field is blank. Image generation jobs are limited to one running image job at a time when they use Codex image detection, because the installed Codex CLI contract exposes no supported per-job output-directory or last-image flag and detection therefore still watches the shared `CODEX_HOME/generated_images` directory; chat jobs may still run beside an image job up to the configured parallel limit.

### Backend registry

Entry point: `src/backend-registry.js`

Backend drivers expose a common contract: `id`, `label`, `kind`, `capabilities()`, `models()`, `checkStatus()`, and execution methods for supported job types. The built-in drivers include Codex CLI, Grok CLI, Cursor Agent, Local ASR, OpenAI Videos, Grok/xAI API, and the optional generic CLI-process and API-key chat drivers.

Codex CLI supports chat, images, and media analysis. Grok CLI supports isolated Gateway chat after its normal readiness check; image/video models are exposed only when the local `%USERPROFILE%\.grok\skills\imagine\SKILL.md` or `%USERPROFILE%\.grok\bundled\skills\imagine\SKILL.md` metadata declares the corresponding Imagine tools. Grok media runs in a per-request temporary workspace with separate `input` and `output` directories, allowlists the single Imagine tool for that request, and returns only output artifacts. Video remains experimental until a successful local request confirms it. Cursor Agent Gateway chat uses `--mode=ask` in a temp workspace (read-only; not a write/shell coding agent). The xAI API driver covers chat (`grok-4.6` by default), Imagine image/video with native size and duration parameters, and Speech-to-Text. OpenAI Videos remains a separately configured Sora 2 path until the Videos API shutdown on 24 Sep 2026. A driver is never selected as a silent fallback when the requested/default driver is unavailable or lacks a capability.

Chat-like output length is resolved in `src/token-policy.js` (chat default 8192, media.analyze 4096). Values below 512, including omitted or leftover `256` samples, use that default or a Settings `token_defaults` override. xAI and API-key chat always send `max_tokens` and `max_completion_tokens`; they do not forward `stream`. Codex uses the value as a prompt hint only.

The registry preserves existing routes and model IDs while adding provider-neutral `model-relay:*` IDs and `/v1/relay/*` frontend aliases. Driver-specific credentials are reported only as configured/not configured and are not emitted in status, capabilities, jobs, SSE, or debug-help payloads.

### Cached provider diagnostics

Provider discovery is deliberately outside HTTP and SSE request handling. On startup, the bridge seeds provider records as `checking` and starts one asynchronous, deduplicated refresh. Independent Codex, Grok, and Cursor probes run with bounded child-process timeouts; their safe outcomes are retained in the shared status cache. `POST /v1/relay/refresh` starts the same background refresh and immediately returns `202`; status and capability SSE events are broadcast as the cached records change.

This lets `/status`, `/v1/status`, `/v1/capabilities`, `/v1/relay/models`, and relay settings render immediately. The cache exposes `checking`, `last_checked`, readiness, executable path, version, supported operations, and a concise diagnostic reason. It never exposes token values, auth-file contents, or raw secret-bearing command output.

### Codex CLI adapter

Entry point: `src/codex.js`

The adapter resolves and runs the local `codex` executable. On Windows, it prefers the real `codex.exe` from known installation locations before falling back to `where.exe codex`, which avoids common failures when the `codex.cmd` npm shim is not spawn-safe from a packaged app.

Runtime configuration uses **Settings** first (Providers, Runtime, Local ASR, Music Analysis, CUDA Upscale). A stored non-empty value wins; a blank field falls back to the environment variable, then the code default. The listen port (`ALORBACH_CODEX_BRIDGE_PORT`) and state directory stay process-start environment settings and are not editable in Settings.

- `ALORBACH_CODEX_BINARY`: explicit Codex executable path when Settings CLI path is blank.
- `CODEX_HOME`: Codex profile directory. Defaults to `%USERPROFILE%\.codex`.
- `ALORBACH_CODEX_MAX_CONCURRENT_JOBS`: maximum parallel local jobs when Settings Runtime concurrency is blank. Defaults to `2`.
- `ALORBACH_CODEX_CHAT_TIMEOUT_MS`: chat timeout when the Runtime field is blank. Defaults to 600000.
- `ALORBACH_CODEX_IMAGE_TIMEOUT_MS`: image timeout when the Runtime field is blank. Defaults to 1800000.

Chat jobs run `codex exec` in an ephemeral temp directory and write the final assistant message to a temp output file. The bridge sends generated Codex instructions through stdin instead of a command-line prompt argument so large WordPress transcripts do not hit Windows process argument length limits. Relay catalog IDs such as `model-relay:codex:auto` are stripped to a native Codex model before `--model`; `auto` omits `--model`. If Codex rejects a requested model on a ChatGPT account, chat retries once with the account default. When `codex exec --help` lists `--sandbox`, chat also passes `--sandbox read-only`. Data URL image attachments in chat content are decoded into temp files and passed with `codex exec --image`, so base64 image payloads do not count as prompt text. Image jobs run `codex exec`, snapshot the shared `CODEX_HOME/generated_images` file set and expected launch time, prefer a validated image path named by a structured JSON event, and otherwise return the newest image created after that boundary as base64. The shared directory remains globally serialized by the job manager because no safe per-job output flag is advertised by the captured Codex help contract. When the installed CLI advertises `--output-schema`, media analysis also requests structured fields and exposes them additively under `response.provider_details.media_analysis.structured`; older or rejecting CLIs fall back to the existing human-readable message. Optional transcripts for media analysis are sliced to 32 000 characters.

Grok, Cursor, and Antigravity chat write the transcript to a temp `prompt.txt` (Grok may use `--prompt-json` when advertised and small enough) so the Windows process argument list does not carry the full Gateway conversation. Chat image data URLs are materialized in that workspace; filesystem paths are read only when they already resolve inside it (symlinks that escape are rejected). Grok chat also denies shell, subagents, and web search. When `grok models` reports a default ID, Grok `auto` and unknown native IDs are sent as `--model <default>` rather than omitted or passed as `auto`. A connected Grok CLI stays ready across job errors and `grok models` probe timeouts; only an explicit logout/unauthenticated probe, or a missing executable, marks it unavailable. The separate Grok/xAI HTTP API driver is unchanged. Antigravity image jobs prefer an `IMAGE_PATH:` line in CLI output, then fall back to the state-root filename scan.

### Provider-neutral frontend interfaces

Legacy `/v1/chat`, `/v1/images`, `/v1/transcribe`, `/v1/videos`, and `/v1/media/analyze` routes remain backwards compatible. New aliases under `/v1/relay/jobs/*` accept the same signed envelope and may route by `payload.provider`, `payload.backend`, or provider-qualified model IDs such as `model-relay:xai:grok-4.6`.

Relay-only defaults are persisted in the existing local state file for `chat`, `images`, `videos`, `transcribe`, and `media.analyze`, together with CLI paths, token defaults, runtime timeouts/concurrency, and provider API options. Secrets are stored there but GET `/v1/relay/settings` returns only `configured` plus a 4-character suffix. An explicit model, backend, or provider wins. Otherwise the saved operation default is inserted. Explicit and default selections receive the same validation: unknown, disabled, unauthenticated, or job-incompatible selections return a clear configuration error naming the choice. They never fall back to another driver. Legacy routes do not consult these routing defaults. Optional `token_defaults` for chat and media.analyze are also persisted there and apply on both legacy and relay chat/analysis routes.

### Job diagnostics and generated artifacts

The in-memory job manager publishes safe provider metadata (`provider`, display label, workflow, and detected skill names) to the status stream. It also keeps bounded, redacted textual session input and bounded stdout/stderr/session output for recent jobs so the local Live tab can show what happened without opening debug files. Input redaction removes common bearer-token, API-key, and authorization values; full temporary debug files remain private local diagnostics.

For completed image jobs, the manager can retain up to four validated PNG, JPEG, or WebP artifacts in memory for the recent-job window. The local status page obtains a same-origin artifact URL and displays a thumbnail that opens in an overlay. Artifacts are removed when their job leaves the recent-job cache and are not embedded in the SSE payload.

### Security state

Entry point: `src/security.js`

Pairing state remains compatible with the legacy directory by default:

```text
%USERPROFILE%\.alorbach-codex-bridge\state.json
```

If `%USERPROFILE%\.ai-model-relay` already exists, or `AI_MODEL_RELAY_STATE_DIR` / `ALORBACH_MODEL_RELAY_STATE_DIR` is set, the relay uses that directory instead. This keeps existing installs working while allowing a staged migration to the new product name.

The state file contains per-origin bearer tokens and pairing timestamps. The tray diagnostics intentionally omit token values.

Pairing codes are six digit, short-lived process values. After a successful pairing, the bridge generates a new pairing code.

### WordPress Gateway driver

Reference implementation:

```text
https://github.com/alorbach/alorbach-ai-subscription-gateway/blob/main/wordpress-plugin/includes/class-local-codex-bridge.php
https://github.com/alorbach/alorbach-ai-subscription-gateway/blob/main/wordpress-plugin/assets/js/demo-pages.js
```

The Gateway plugin is the production source of truth for job creation and completion. It validates model access, rate limits, quotas, duplicate request hashes, job ownership, job tokens, and result shape. The browser-side demo driver performs the handoff between WordPress and this local bridge.

## Production Flow

1. A logged-in WordPress user selects a Gateway-approved legacy `codex-local:*` model or a relay model/default.
2. Browser requests Gateway config from `/wp-json/alorbach/v1/local-codex/config`.
3. Browser checks the tray bridge with `GET http://127.0.0.1:8765/v1/status`.
4. If no token is stored for the WordPress origin, browser asks the user for the tray pairing code and calls `/v1/pair`.
5. Browser asks WordPress to create a one-time local Codex job at `/wp-json/alorbach/v1/local-codex/jobs`.
6. WordPress returns `job_id`, `job_token`, `request_hash`, `request_id`, and the normalized payload.
7. Browser sends the job envelope to the matching legacy route or `/v1/relay/jobs/<operation>` with the pairing token.
8. Bridge executes the selected backend driver and returns a normalized result.
9. Browser posts the result to `/wp-json/alorbach/v1/local-codex/jobs/{job_id}/complete`.
10. WordPress validates the one-time token and hash, records ledger/audit data, and returns the final response to the UI.

If the bridge call fails after a WordPress job was created, the browser posts to `/fail` so the duplicate hash can be cleared and the user can retry.
