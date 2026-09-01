# Plan 08 — CLI model lists and Grok chat vision

**Wave:** 3  
**Depends on:** [05-chat-isolation-and-imagine.md](05-chat-isolation-and-imagine.md)  
**Next:** [09-codex-image-output.md](09-codex-image-output.md)

## Goal

Expose real Grok/Cursor model IDs instead of only `auto`, and pass chat image parts into Grok the way Codex already uses `--image`.

## Why

Grok already runs `grok models` as an auth probe; the Relay throws the output away. Cursor documents `--list-models` / `models`. `messagesToText` in `src/local-cli.js` drops `input_image` parts, so Grok/Cursor/Antigravity chat cannot see images Codex chat already handles.

## Files

- [`src/local-cli.js`](../../src/local-cli.js) — `messagesToText` / new `materializeChatImages` if needed
- [`src/backend-registry.js`](../../src/backend-registry.js) — detect/refresh model lists; Grok `--prompt-json` if documented
- Tests for model parsing and for a chat payload with one data-URL image

## Steps

1. Parse `grok models` / `cursor-agent models` (or `--list-models`) into a bounded list of ids (cap ~50). Keep `auto` first. On parse failure, keep today’s `['auto']`.
2. Map them to `model-relay:grok-cli:<id>` and `model-relay:cursor-cli:<id>` with `job_types: ['chat']`.
3. For Grok chat with image parts: write images into the temp workspace; use `--prompt-json` if help lists it, otherwise mention `@path` files in the prompt file (Plan 04). Do not put base64 on argv.
4. Cursor/Antigravity: same `@path` in the prompt file is enough if they lack `--prompt-json`. Do not invent flags.

## Done when

- Ready Grok/Cursor `models()` can return more than `auto` when the CLI lists them
- A chat message with a PNG data URL results in a file on disk and a reference in the prompt file, not the base64 in argv
- `npm test` passes

## Do not

- Do not add video chat attachments.
- Do not download arbitrary `http://` image URLs (SSRF). Data URLs and already-materialized paths only.
- Do not change Local ASR or upscale.
