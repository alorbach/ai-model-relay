# Plan 12 — Chat provider tests on the status page

**Wave:** 5 (backlog)<br>
**Depends on:** none (builds on the existing Settings → Tests media test flow)<br>
**Next:** none

## Goal

Let the local operator run a real chat request against **every ready chat-capable provider model** from Settings → Tests, the same way image, video, analysis, and audio tests work today. This covers CLI drivers (Codex, Grok, Cursor Agent, Antigravity, generic CLI process) and API drivers (Claude API, Grok/xAI API, API-key chat) alike. A freshly entered API key or a newly installed CLI can be verified without a WordPress Gateway job.

## Why

Today `POST /v1/relay/test` rejects `chat` (`src/server.js`, allowed list `images, videos, transcribe, media.analyze, music.analyze`) and the Tests section has no Chat tab. A provider is shown as "Ready" when a key is saved or a CLI is detected, but nothing proves that the key is valid, the model ID exists, or the CLI is logged in until a real Gateway job fails.

## Scope

### Server (`src/server.js`)

1. Accept `job_type: 'chat'` in `/v1/relay/test`. Update the validation message to list chat.
2. Build the chat payload from the request body:
   - `messages`: `[{ role: 'system', content: <system> }]` when a non-empty `system` string is supplied (max 4 000 chars), then `[{ role: 'user', content: <prompt> }]`. When `image_data_url` is supplied (data:image/png|jpeg|webp|gif, ≤ 5 MB decoded), the user content becomes `[{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url } }]`.
   - `prompt` is required for chat (non-empty after trim, max 8 000 chars) → 400 validation error otherwise.
   - Optional `max_tokens` (integer 16–4096; default 256 for tests so a test stays cheap) — passed through the payload; token policy may still raise the floor, which is acceptable.
   - Optional `effort` (`low|medium|high|xhigh|max`) passed through for drivers that support it.
3. Run it through the existing path (`relayPayloadFor` → `jobManager.run` → `context.backends.run('chat', …)`), so it appears in the Live tab with provider metadata, uses the same no-silent-fallback resolution, and respects `test_request_id`.
4. Response: the existing `{ ...result, request_id }` shape. Chat results carry `response.choices[0].message.content`, `response.usage`, `response.model`, `response.provider_details`.
5. No new route, no change to Gateway-signed chat routes, no change to pairing/CORS rules (the route stays a local status-page mutator).

### Status page (`src/status-page.js`)

1. Add a **Chat** tab as the first tab in Settings → Tests (`provider-test-tab-chat` / `provider-test-panel-chat` / `#providerChatTests`) and make it the default selected tab. Update the section intro text to mention chat.
2. Cards: one card per ready chat model, using `readyMediaModels(models, backends, 'chat', 'text')`. Group/sort by backend label so CLI and API providers are easy to scan. Each card shows:
   - heading: backend label + model id (`<code>`);
   - "Test prompt" input (default `Reply with exactly: OK`), collapsible "System prompt (optional)" textarea, optional "Image (optional, vision check)" file input, "Max tokens" number input (default 256);
   - cost hint for API backends (`kind === 'api'`): "This request is sent to <label>; usage charges may apply.";
   - "Run chat test" button, the existing status/progress/activity elements.
3. Result rendering for chat (new branch in the result renderer, not the artifact branch): the reply text in a scrollable `<pre>` (escaped, capped at 4 000 chars with a "truncated" note), plus a meta line: resolved model, elapsed time, token usage (`prompt / completion / total` when present), finish reason, and provider-specific extras when present (e.g. Claude `stop_reason`, cache tokens). Empty replies are shown as a warning, not as success-looking blank space. Failures show `error_message`/`message`, `code`, and HTTP status.
4. Add a **"Run all chat tests"** button above the chat cards that runs the visible cards **sequentially** (not in parallel — avoids CLI concurrency limits and surprise bills), using each card's current prompt, and shows a compact summary (`n passed / n failed`). It can be cancelled (Cancel stops immediately; a test that is already running keeps running and can be followed in Live; the remaining tests are not started).
5. Re-render the chat cards whenever routing settings/capabilities re-render (same as media tests), so a newly saved key makes the provider's card appear without reload.
6. All dynamic text through `escapeHtml`. `src/status-page.js` is one JS template literal: no backticks, no `${`, double every regex backslash.

### Docs

- `docs/architecture.md` / `docs/operations.md`: mention that Settings → Tests now includes Chat tests for all ready chat providers, that tests are real requests (charges may apply), and that "Run all" is sequential.
- Mark Plan 12 in `docs/plans/README.md` (Wave 5 index + progress list).

## Tests

- `test/relay-routes.test.js` (or the existing route-test pattern): `/v1/relay/test` with `job_type: 'chat'` and an injected fake backend: success path returns the reply and `request_id`; missing prompt → 400; non-local origin → 403 (existing mutator rule); `system`, `image_data_url`, `max_tokens`, `effort` reach the driver payload in the expected shape; oversized prompt/system/image → 400; invalid image data URL → 400; unknown/unready model → existing configuration error (no fallback).
- `test/status-page.test.js`: rendered page contains the Chat tab/panel ids and "Run all chat tests"; the chat result renderer escapes HTML in replies and shows usage; the emitted inline script parses (`new Function`).
- Existing tests stay green.

## Do not

- Do not add streaming, multi-turn conversation state, or a chat playground beyond a single prompt (+ optional system prompt and image).
- Do not run "Run all" in parallel.
- Do not change Gateway chat routes, pairing, CORS, or token-policy defaults.
- Do not silently fall back to another provider when the selected model is unavailable.
- Do not log or display API keys.

## Done when

- [x] Settings → Tests shows a Chat tab listing every ready chat model across CLI and API providers.
- [x] A chat test shows the reply, model, elapsed time, and token usage, or a clear error.
- [x] "Run all chat tests" runs sequentially and summarizes pass/fail.
- [x] Tests above pass; `npm test` passes except the pre-existing `local-image` failure.
- [x] Docs and plan index updated.
