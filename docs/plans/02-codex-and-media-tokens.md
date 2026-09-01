# Plan 02 — Codex chat and media.analyze tokens

**Wave:** 1  
**Depends on:** [01-token-policy.md](01-token-policy.md)  
**Next:** [03-api-chat-passthrough.md](03-api-chat-passthrough.md)

## Goal

Codex chat and Codex-backed media analysis use `resolveMaxTokens` instead of hardcoded 1024 / 1200. Raise the media transcript slice so long captions are not cut at 12 000 characters.

## Why

The Relay’s only real Codex “limit” is a prompt hint plus a transcript `.slice`. Gateway jobs that omit `max_tokens` or send `256` currently get a short answer hint.

## Files

- [`src/codex.js`](../../src/codex.js) — `buildChatPrompt` / `chat`
- [`src/media-analysis.js`](../../src/media-analysis.js) — `buildAnalysisMessages`, `analyze`
- [`test/codex-prompt.test.js`](../../test/codex-prompt.test.js)
- Add or extend a media-analysis test if one already asserts the 12 000 slice; otherwise add a focused test next to existing media tests
- [`docs/local-bridge-api.md`](../local-bridge-api.md) — chat example `max_tokens`
- [`docs/gateway-integration.md`](../gateway-integration.md) — same
- [`examples/http-app/public/index.html`](../../examples/http-app/public/index.html) — demo payload

## Steps

1. In `buildChatPrompt`, use `resolveMaxTokens('chat', maxTokens)` for the hint line. Keep the hint as text only; Codex still has no `--max-tokens` flag.
2. In `chat()`, log the **resolved** value in the debug JSON, not the raw payload when it was tiny/omitted.
3. In `analyze()`, pass `max_tokens: resolveMaxTokens('media.analyze', payload.max_tokens)` into `codexAdapter.chat`.
4. Raise transcript slice from `12000` to **32000** characters in `buildAnalysisMessages`. Keep it a slice (do not load unbounded transcripts).
5. Update `codex-prompt.test.js` so a call **without** `maxTokens` (or with `256`) asserts the hint contains `8192`, and an explicit `4096` still appears as `4096`. The existing image-attachment test can keep passing `123` — `123` is below 512, so it will resolve to **8192**. Either pass `4096` in that test or assert the default hint.
6. Replace documented/example `max_tokens: 256` with `8192`.

## Done when

- Codex prompt hint default is 8192, not 1024
- `max_tokens: 256` does not appear as the hint
- Media analysis default to Codex is 4096
- Transcript slice is 32000
- Docs and the HTTP example no longer advertise 256
- `npm test` passes

## Do not

- Do not change Grok/Cursor/Antigravity argv handling (Plan 04).
- Do not change xAI / API-key bodies (Plan 03).
- Do not add `--output-schema` (Plan 06).
- Do not change `MAX_BODY_BYTES`.
