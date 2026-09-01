# Plan 03 — xAI and API-key chat passthrough

**Wave:** 1  
**Depends on:** [01-token-policy.md](01-token-policy.md), [02-codex-and-media-tokens.md](02-codex-and-media-tokens.md)  
**Next:** [04-cli-prompt-files.md](04-cli-prompt-files.md)

## Goal

HTTP chat drivers send the resolved token limit (and existing sampling fields). Stop copying `stream` into a fully buffered `fetch` that never consumes SSE.

## Why

xAI only forwards `max_tokens` when the client set it, so omitted jobs get the provider default. API-key chat drops `max_tokens` entirely. `stream: true` is misleading because the Relay still `await response.text()`.

## Files

- [`src/backend-registry.js`](../../src/backend-registry.js) — `createXaiApiDriver.chat`, `createApiKeyChatDriver.chat`
- [`test/backend-registry.test.js`](../../test/backend-registry.test.js) — xAI chat body assertions; add API-key chat coverage if missing

## Steps

1. Shared small helper in `backend-registry.js` (or use `token-policy.js` plus a local `assignChatSampling(body, payload, jobType)`):
   - Always set `max_tokens` to `resolveMaxTokens('chat', payload.max_tokens)`.
   - Also set `max_completion_tokens` to the same number (newer OpenAI-compatible servers ignore one or the other).
   - Copy `temperature` and `top_p` only when the payload defines them (same as today’s xAI loop).
   - **Do not** copy `stream`.
2. Apply that helper to **both** xAI chat and API-key chat.
3. Extend the existing xAI mock in `test/backend-registry.test.js` to assert `max_tokens` and `max_completion_tokens` are 8192 when omitted, and match a large explicit value when provided.
4. Add an API-key chat test: configured key + base URL, capture `JSON.parse(options.body)`, same assertions, plus `temperature` passthrough.

## Done when

- xAI chat JSON always includes numeric `max_tokens` / `max_completion_tokens`
- API-key chat no longer sends `{ model, messages }` only
- Neither driver sends `stream`
- `npm test` passes

## Do not

- Do not implement chat SSE streaming.
- Do not change xAI images/videos/STT.
- Do not write Grok `config.toml`.
- Do not add `stream` handling on `/v1/chat`.
