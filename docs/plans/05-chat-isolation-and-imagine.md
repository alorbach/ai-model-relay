# Plan 05 — Chat isolation and Grok Imagine allowlist

**Wave:** 2  
**Depends on:** [04-cli-prompt-files.md](04-cli-prompt-files.md)  
**Next:** [06-codex-sandbox-and-schema.md](06-codex-sandbox-and-schema.md)

## Goal

Gateway **chat** through Grok and Cursor must not get a full coding agent. Grok Imagine must only see the Imagine tools. Named CLI drivers must stop advertising `transcribe`.

## Why

Grok media jobs already pass `--cwd`, `--disallowed-tools run_terminal_cmd`, `--permission-mode dontAsk`, `--no-subagents`, `--disable-web-search`, `--max-turns 2`. Grok **chat** and Cursor **chat** do not. Cursor `--print` documents write/shell access. `createNamedCliDriver` sets `job_types: ['chat', 'transcribe']` but only implements `chat`.

## Files

- [`src/backend-registry.js`](../../src/backend-registry.js) — `createNamedCliDriver`, `createGrokCliDriver` (chat + `runImagineTool`), `createCursorCliDriver`
- [`test/backend-registry.test.js`](../../test/backend-registry.test.js)
- [`test/grok-media.test.js`](../../test/grok-media.test.js) — Imagine args; `toolForArgs` / `--single` parsing may need to follow `--prompt-file` if Plan 04 changed Imagine

## Steps

### Cursor chat

After Plan 04’s `--workspace` + prompt file, add:

- `--mode=ask` (read-only; do not use `--force` / `--yolo`)
- `--trust` (headless; avoid a prompt that cannot be answered)

Keep `--print --output-format json`.

### Grok chat

Match media isolation as far as chat still needs to *answer*, not generate files:

- `--cwd` temp workspace
- `--permission-mode dontAsk`
- `--no-subagents`
- `--disable-web-search`
- `--disallowed-tools run_terminal_cmd` (and `Agent` if the installed CLI accepts it; feature-detect from `--help` or keep the media flag set)
- Optional `--max-turns` only if chat quality does not collapse to one empty turn; default **omit** for chat unless tests show a hang. Do not copy media’s `--max-turns 2` blindly.

Prefer `--tools` only if you can name a **chat-safe allowlist** that still lets the model reply with no file tools required. If unsure, denylist shell/web/subagents (same as media minus Imagine).

### Grok Imagine

In `runImagineTool`, add `--tools` allowlist for the single tool being invoked:

- images, no refs: `image_gen`
- images, with refs: `image_edit`
- video, one source: `image_to_video`
- video, multiple refs: `reference_to_video`

Keep the existing denylist/search/subagent flags. Allowlist is the important new constraint.

If `--prompt-file` is already used from Plan 04, keep it. Otherwise leaving Imagine on short `--single` is fine.

### Metadata bug

- `createNamedCliDriver` `job_types` and `cached.job_types` must be `definition.jobTypes || ['chat']` only.
- `capabilities().features` must not imply transcription for Cursor.

## Done when

- Cursor chat args include `--mode=ask`, `--workspace`, `--trust`
- Grok chat args include `--cwd` and shell/web/subagent restrictions
- Imagine args include `--tools` with exactly the tool for that request
- Cursor/Grok `job_types` / models do not list `transcribe`
- `npm test` and grok-media tests pass (update fake spawn if args moved off `--single`)

## Do not

- Do not enable Cursor agent/write mode for Gateway chat.
- Do not add MCP or `--approve-mcps`.
- Do not change Codex `--ephemeral` in this plan.
- Do not walk Antigravity’s image directory (Plan 07).
