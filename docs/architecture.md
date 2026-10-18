# Architecture

AI Model Relay, formerly Codex Local Bridge, is a Windows tray app that puts one local REST API in front of many AI providers. A browser page on a paired origin (in production the Alorbach AI Subscription Gateway) sends jobs in one envelope format; the Relay routes each job to a backend driver (subscription CLI, API-key provider, or local engine) and returns a normalized result. The Gateway keeps ownership of plans, quotas, job signatures, audit records, and optional service fees.

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

Execution requests are scheduled through an in-memory queue. The default limit is two parallel jobs. Operators set concurrency and timeouts on the status page **Runtime** page; environment variables such as `ALORBACH_CODEX_MAX_CONCURRENT_JOBS` apply only when the matching status page field is blank. Codex image jobs follow `codex_image_tool`. Omitted, blank, or invalid means `image_gen`. An explicit stored `generations` stays `generations` until changed. The default `image_gen` path detects new files under `CODEX_HOME/generated_images` (per-thread subdirectories are possible). Those jobs stay serialized to one running image job because detection uses that shared directory. Optional `generations` returns image bytes from the Codex login endpoint and does not scan `generated_images`. Chat jobs may still run beside an image job up to the configured parallel limit.

### Backend registry

Entry point: `src/backend-registry.js`

Backend drivers expose a common contract: `id`, `label`, `kind`, `capabilities()`, `models()`, `checkStatus()`, and execution methods for supported job types. The built-in drivers are:

- subscription CLIs: Codex CLI (`codex-cli`), Grok CLI (`grok-cli`), Cursor Agent (`cursor-cli`), Antigravity CLI (`antigravity-cli`), and the generic CLI Process (`cli-process`);
- API-key providers: Claude API (`anthropic-api`), Grok / xAI API (`xai-api`), API Key Chat for any OpenAI-compatible endpoint (`api-key-chat`), and OpenAI Videos (`openai-videos`);
- local engines: Local ASR (`local-asr`), Local Image (`local-image`), Local CUDA Upscale (`local-upscale`), and Local Music Analysis (`music-analysis`).

Codex CLI supports chat, images, and media analysis. Grok CLI supports isolated Gateway chat after its normal readiness check; image/video models are exposed only when the local `%USERPROFILE%\.grok\skills\imagine\SKILL.md` or `%USERPROFILE%\.grok\bundled\skills\imagine\SKILL.md` metadata declares the corresponding Imagine tools. Grok media runs in a per-request temporary workspace with separate `input` and `output` directories, allowlists the single Imagine tool for that request, and returns only output artifacts. Video remains experimental until a successful local request confirms it. Cursor Agent Gateway chat uses `--mode=ask` in a temp workspace (read-only; not a write/shell coding agent). The xAI API driver covers chat (`grok-4.6` by default), Imagine image (`grok-imagine-image-2.0`: native `resolution` `1k`/`2k`, `image/jpeg` only) and Imagine video with native duration parameters, and Speech-to-Text. OpenAI Videos remains a separately configured Sora 2 path until the Videos API shutdown on 24 Sep 2026. A driver is never selected as a silent fallback when the requested/default driver is unavailable or lacks a capability.

The Claude API (Anthropic) driver (`anthropic-api`) serves chat as `model-relay:anthropic:<id>` (also `model-relay:claude:<id>`; default list `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `auto` = first configured). It calls `POST {base}/v1/messages` over raw HTTP with `x-api-key` and `anthropic-version: 2023-06-01`, converts OpenAI-style messages (system/developer messages are hoisted to the top-level `system`; data-URL and http(s) `image_url` parts become image blocks), and never sends sampling parameters (`temperature`, `top_p`). `effort` (`low` to `max`) maps to `output_config.effort`. For refusal fallbacks, Opus 5.5, Opus 5, Sonnet 5.5, and Fable 5.1 requests send `fallbacks: "default"` with the beta header `server-side-fallback-2026-07-01`; only when calling api.anthropic.com directly (custom base URLs/gateways do not get them); set `AI_MODEL_RELAY_ANTHROPIC_FALLBACKS=0` to disable. A remaining `refusal` stop reason fails with `anthropic_refusal`. The chat timeout is the `anthropic_chat_ms` runtime setting (`AI_MODEL_RELAY_ANTHROPIC_CHAT_TIMEOUT_MS`, default 600000); Claude chat uses `anthropic_chat_ms` instead of `provider_fetch_ms` (which governs the other HTTP provider fetches such as model discovery). API keys are stored in the local state file; the settings API returns only `configured` plus a 4-character suffix and error messages are redacted.

The Claude API usage panel (full on **Overview**, compact on the Claude API provider card) is fed by `GET /v1/relay/providers/anthropic/usage` (`?refresh=1` bypasses the 60-second cache), which is served to the local status page only. An Admin API key is optional and is used only to read month-to-date spend from the Cost API (`/v1/organizations/cost_report`, daily buckets; data lags about 5 minutes and excludes Priority Tier). The card also shows the `anthropic-ratelimit-*` headers from the last Messages response. Anthropic publishes no credit-balance API, so the credit figure is an estimate: remaining credits = the saved balance minus Cost API spend from the start of the UTC day the balance was saved (daily granularity, about 5 minutes of lag, excludes Priority Tier). Use "Recount spend from today" on the Claude API provider card to re-baseline an unchanged balance.

Chat-like output length is resolved in `src/token-policy.js` (chat default 8192, media.analyze 4096). Values below 512, including omitted or leftover `256` samples, use that default or a saved `token_defaults` override (the **Routing** card on the Providers page). xAI and API-key chat always send `max_tokens` and `max_completion_tokens`; they do not forward `stream`. Codex uses the value as a prompt hint only.

The registry preserves existing routes and model IDs while adding provider-neutral `model-relay:*` IDs and `/v1/relay/*` frontend aliases. Driver-specific credentials are reported only as configured/not configured and are not emitted in status, capabilities, jobs, SSE, or debug-help payloads.

### Local status page

The local status page (`/` and `/status`) is plain files in `src/status-page/`: `index.html` (markup with `{{PRODUCT_NAME}}`, `{{LEGACY_PRODUCT_NAME}}`, `<!-- RELAY_STYLES -->`, and `<!-- RELAY_SCRIPT -->` placeholders), `styles.css`, and `app.js`. `src/status-page.js` reads them once at module load and `statusPageHtml()` inlines the CSS and script into one HTML response, so there are no extra routes, no build step, and the local-viewer, CORS, and CSP rules are unchanged. The files are read through `fs`, which works from the packaged `app.asar` the same way `require` does, so they need no `asarUnpack` entry.

The page is a single-page app with a fixed sidebar (Overview, Live, Providers, Tests, Runtime, Local ASR, Local Image, CUDA Upscale, Music Analysis, Pairing, Debug) driven by hash routes. `resolveRoute` maps a hash to `{ route, liveRequestId, providerId, testType }`: `#live/<request id>`, `#providers/<provider id>`, and `#tests/<type>/<provider id>` (types `chat`, `images`, `videos`, `analysis`, `audio`, with singular and API-name aliases) are deep links, and the pre-redesign `#settings/<section>` hashes are mapped to their own routes. A light and dark design is defined with CSS custom properties; the header toggle (System / Light / Dark) is stored in `localStorage` under `relay-status-theme` (every access is wrapped in try/catch, and a small head script applies a saved choice before first paint). No external fonts, scripts, or build step are used.

- **Providers** renders one card per backend from `GET /v1/capabilities` and `GET /v1/relay/settings` (status pill, one-line diagnostic, executable path, keys with Replace / Clear, models, an inline chat test through `POST /v1/relay/test`, links to the media tests), plus a **Routing** card. Providers and Runtime share `POST /v1/relay/settings`; each section has its own sticky **Save changes / Discard** bar that appears while its form differs from the last loaded snapshot, and the Local ASR, Local Image, CUDA Upscale, and Music Analysis pages use the same bar with their own endpoints. Inline validation (`relayFieldProblems`) blocks Save only for newly edited invalid values; an out-of-range value that is unchanged from the loaded settings becomes a non-blocking warning.
- **Tests** is a segmented control (an accessible tablist with arrow-key navigation) over the Chat, Image, Video, Video analysis, and Audio panels. The Chat panel has a summary bar (Run all, live `Running N of M` line, progress meter, colored counts). `#tests/<type>/<provider id>` selects the segment and highlights the provider's cards (`data-test-backend`), or shows a note when no ready test exists.
- **Live** keeps the job list, filters (status, type, search), and detail panel in step with the `/v1/status/events` stream. The detail panel shows error details, meta, artifact previews, and session input and output as text (never markup) with wrap and auto-scroll toggles.
- **Debug** shows health checks with a summary, recent failures as expandable rows, feature, driver, paired-site, and Codex cards, and the raw status JSON, which is only built while its disclosure is open.
- **Connection state.** `/v1/status` answers `503` while the first Codex check is still running (`success: false`, `checking: true`). A poll counts as a success when it returns a 2xx or a `503` JSON answer, and every live event or heartbeat on the event stream counts as a success too. A network error, a timeout, a non-JSON answer, or any other HTTP error is a failure: the page keeps the last good picture and shows **Status delayed** (with the time of the last update), and only after 3 failed polls in a row or 30 s of failures it shows **Relay unreachable**, or immediately if nothing was loaded yet and no stream is open. All of this is derived in one place (`connectionView` in `app.js`), which drives the header pill, the last-updated label, and the Overview **Relay** pill (**Reachable** as soon as the Relay answers, even while Codex is still being checked). The Codex pill shows **Checking…** while `checking`, `details.checking`, or an active `refresh` says so. The page opens one `EventSource`; when it drops, polling every 5 s takes over (**Polling fallback**) and the stream is retried with a backoff (2 s, 4 s, 8 s, 16 s, then 30 s) until it opens again, which stops the polling. The Relay sends a heartbeat every 15 s; a stream that stays open but delivers nothing for 35 s is treated as stalled by a watchdog, closed, and replaced by polling plus the same retry.

### Cached provider diagnostics

Provider discovery is deliberately outside HTTP and SSE request handling. On startup, the bridge seeds provider records as `checking` and starts one asynchronous, deduplicated refresh. Independent Codex, Grok, and Cursor probes run with bounded child-process timeouts; their safe outcomes are retained in the shared status cache. `POST /v1/relay/refresh` starts the same background refresh and immediately returns `202`; status and capability SSE events are broadcast as the cached records change.

This lets `/status`, `/v1/status`, `/v1/capabilities`, `/v1/relay/models`, and relay settings render immediately. The cache exposes `checking`, `last_checked`, readiness, executable path, version, supported operations, and a concise diagnostic reason. It never exposes token values, auth-file contents, or raw secret-bearing command output.

### Codex CLI adapter

Entry point: `src/codex.js`

The adapter resolves and runs the local `codex` executable. On Windows, it prefers the real `codex.exe` from known installation locations before falling back to `where.exe codex`, which avoids common failures when the `codex.cmd` npm shim is not spawn-safe from a packaged app.

Runtime configuration uses the status page settings first (Providers, Runtime, Local ASR, Local Image, Music Analysis, CUDA Upscale). A stored non-empty value wins; a blank field falls back to the environment variable, then the code default. The listen port (`ALORBACH_CODEX_BRIDGE_PORT`) and state directory stay process-start environment settings and are not editable on the status page.

- `ALORBACH_CODEX_BINARY`: explicit Codex executable path when the Codex CLI path on the Providers page is blank.
- `CODEX_HOME`: Codex profile directory. Defaults to `%USERPROFILE%\.codex`.
- `ALORBACH_CODEX_MAX_CONCURRENT_JOBS`: maximum parallel local jobs when the Runtime page concurrency field is blank. Defaults to `2`.
- `ALORBACH_CODEX_CHAT_TIMEOUT_MS`: chat timeout when the Runtime field is blank. Defaults to 600000.
- `ALORBACH_CODEX_IMAGE_TIMEOUT_MS`: image timeout when the Runtime field is blank. Defaults to 1800000.

Chat jobs run `codex exec` in an ephemeral temp directory and write the final assistant message to a temp output file. The bridge sends generated Codex instructions through stdin instead of a command-line prompt argument so large WordPress transcripts do not hit Windows process argument length limits. Relay catalog IDs such as `model-relay:codex:auto` are stripped to a native Codex model before `--model`; `auto` omits `--model`. If Codex rejects a requested model on a ChatGPT account, chat retries once with the account default. When `codex exec --help` lists `--sandbox`, chat also passes `--sandbox read-only`. Data URL image attachments in chat content are decoded into temp files and passed with `codex exec --image`, so base64 image payloads do not count as prompt text. Image jobs follow the saved `codex_image_tool`. The value is `image_gen` or `generations`. Omitted, blank, or invalid means `image_gen`. An explicit stored `generations` stays `generations` until changed. The default `image_gen` path runs `codex exec` and tells the model to pass this text verbatim as the built-in `image_gen` prompt. Size and quality stay inside that prompt as scene hints for aspect ratio and detail. The built-in tool arguments are only `prompt`, `referenced_image_paths`, and `num_last_images_to_include`. Size, quality, and file format are not tool arguments. The tool returns PNG. Relay therefore publishes size and quality as generation guidance, output format only `image/png`, one candidate, and at most 4 reference images. Measured results stay about 1.57 megapixels. Aspect ratio can follow the prompt text. Pixel size is not guaranteed. Labels for the larger presets stay "requested, not guaranteed". That path detects new files under `CODEX_HOME/generated_images` (per-thread subdirectories are possible). It snapshots the shared file set and expected launch time, prefers a validated image path named by a structured JSON event, and otherwise returns the newest image created after that boundary as base64. Jobs stay serialized to one running image job because detection uses that shared directory. Optional `generations` POSTs to the Codex login endpoint `images/generations`, or `images/edits` when reference images are present, using the existing `codex login` session in `CODEX_HOME/auth.json`. The model on that body is `gpt-image-2.5-sunburst`. It does not use `OPENAI_API_KEY` or `image_gen.py`. The body may include prompt, size, quality, and output format, but the Codex login endpoint does not apply size or quality. The published contract matches `image_gen`: guidance size and quality, PNG only (`image/png`), one candidate, and at most 4 references. `generations` returns image bytes and does not scan `generated_images`. When the installed CLI advertises `--output-schema`, media analysis also requests structured fields and exposes them additively under `response.provider_details.media_analysis.structured`; older or rejecting CLIs fall back to the existing human-readable message. Optional transcripts for media analysis are sliced to 32 000 characters.

Grok, Cursor, and Antigravity chat write the transcript to a temp `prompt.txt` (Grok may use `--prompt-json` when advertised and small enough) so the Windows process argument list does not carry the full Gateway conversation. Chat image data URLs are materialized in that workspace; filesystem paths are read only when they already resolve inside it (symlinks that escape are rejected). Grok chat also denies shell, subagents, and web search. When `grok models` reports a default ID, Grok `auto` and unknown native IDs are sent as `--model <default>` rather than omitted or passed as `auto`. A connected Grok CLI stays ready across job errors and `grok models` probe timeouts; only an explicit logout/unauthenticated probe, or a missing executable, marks it unavailable. The separate Grok/xAI HTTP chat driver is not part of the Grok CLI chat path. Antigravity image jobs prefer an `IMAGE_PATH:` line in CLI output, then fall back to the state-root filename scan. `generate_image` accepts `prompt`, `imageName`, at most 3 `imagePaths`, and `aspectRatio`. It returns one JPEG at about 1 megapixel.

### Provider-neutral frontend interfaces

Legacy `/v1/chat`, `/v1/images`, `/v1/transcribe`, `/v1/videos`, and `/v1/media/analyze` routes remain backwards compatible. New aliases under `/v1/relay/jobs/*` accept the same signed envelope and may route by `payload.provider`, `payload.backend`, or provider-qualified model IDs such as `model-relay:xai:grok-4.6`.

Relay-only defaults are persisted in the existing local state file for `chat`, `images`, `videos`, `transcribe`, and `media.analyze`, together with CLI paths, token defaults, `codex_image_tool`, runtime timeouts/concurrency, and provider API options. Secrets are stored there but GET `/v1/relay/settings` returns only `configured` plus a 4-character suffix. An explicit model, backend, or provider wins. Otherwise the saved operation default is inserted. Explicit and default selections receive the same validation: unknown, disabled, unauthenticated, or job-incompatible selections return a clear configuration error naming the choice. They never fall back to another driver. Legacy routes do not consult these routing defaults. Optional `token_defaults` for chat and media.analyze are also persisted there and apply on both legacy and relay chat/analysis routes.

### Job diagnostics and generated artifacts

The in-memory job manager publishes safe provider metadata (`provider`, display label, workflow, and detected skill names) to the status stream. It also keeps bounded, redacted textual session input and bounded stdout/stderr/session output for recent jobs so the local Live view can show what happened without opening debug files. Input redaction removes common bearer-token, API-key, and authorization values; full temporary debug files remain private local diagnostics.

For completed image jobs, the manager can retain up to four validated PNG, JPEG, or WebP artifacts in memory for the recent-job window. The local status page obtains a same-origin artifact URL and displays a thumbnail that opens in an overlay. Artifacts are removed when their job leaves the recent-job cache and are not embedded in the SSE payload.

The local status page can run provider tests through `POST /v1/relay/test` (a local status-page mutator that follows the same origin rules as the other status-page settings routes). Besides image, video, analysis, and audio tests, `job_type: "chat"` accepts a required `prompt` (up to 8000 characters), an optional `system` prompt (up to 4000 characters), an optional `image_data_url` (PNG, JPEG, or WebP data URL, up to 5 MB decoded; GIF is accepted only for API providers, CLI providers take PNG/JPEG/WebP, and the CLI Process driver takes no images), an integer `max_tokens` from 16 to 4096 (default 256), and an optional `effort`. These become a single-turn `messages` payload that runs through the normal `relayPayloadFor`, job manager, and `backends.run('chat', ...)` path, so the test shows in Live with provider metadata and never silently falls back to another provider. The Tests page (Chat segment) lists every ready chat model (CLI and API), shows the reply and usage, and **Run all chat tests** executes the cards sequentially with a live progress line and colored counts. These are real provider requests, so charges may apply.

### Security state

Entry point: `src/security.js`

Pairing state remains compatible with the legacy directory by default:

```text
%USERPROFILE%\.alorbach-codex-bridge\state.json
```

If `%USERPROFILE%\.ai-model-relay` already exists, or `AI_MODEL_RELAY_STATE_DIR` / `ALORBACH_MODEL_RELAY_STATE_DIR` is set, the relay uses that directory instead. This keeps existing installs working while allowing a staged migration to the new product name.

The state file contains per-origin bearer tokens and pairing timestamps. The tray diagnostics intentionally omit token values. In the Electron desktop app, an optional fixed pairing code is encrypted through Electron `safeStorage` before it is saved in this state file. The six-digit value is never returned by the settings API.

Pairing codes rotate after successful pairing by default. The local status page can instead save a fixed six-digit code on the Pairing page; that code survives successful pairings and app restarts. Fixed codes are weaker than rotating codes, so pairing failures are rate-limited across origins and the failure window is persisted.

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
