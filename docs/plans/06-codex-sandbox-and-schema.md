# Plan 06 — Codex sandbox and media.analyze schema

**Wave:** 3  
**Depends on:** Wave 2 complete  
**Next:** [07-antigravity-image-path.md](07-antigravity-image-path.md)

## Goal

Make Codex chat explicitly read-only at the CLI flag layer, and use the already-detected `--output-schema` for media analysis so Gateway can consume stable JSON.

## Why

Capabilities already report `output_schema` from `codex exec --help`, but jobs never pass it. Chat relies on prompt text (“Do not access local files…”) plus `--ephemeral`. `codex exec` documents `--sandbox read-only` as the default; passing it makes the Relay’s intent visible and survives CLI default changes.

## Files

- [`src/codex.js`](../../src/codex.js) — `chat` args, `runCodexExec` if schema needs a file path
- [`src/media-analysis.js`](../../src/media-analysis.js) — analysis prompt + schema file + parse
- [`test/codex-runner.test.js`](../../test/codex-runner.test.js) / [`test/codex-prompt.test.js`](../../test/codex-prompt.test.js)
- Docs: one short note in [`docs/architecture.md`](../architecture.md) or [`docs/local-bridge-api.md`](../local-bridge-api.md) that media.analyze may return structured fields when the CLI supports `--output-schema`

## Steps

1. Chat `codex exec` args: add `--sandbox read-only` next to `--ephemeral`. Do **not** add it to image jobs (generated files must still appear).
2. If `exec --help` does not list `--sandbox`, skip the flag (same pattern as `--json` fallback). Prefer probing once via existing capabilities/help text rather than a new network call.
3. Add a small JSON schema file written into the media-analysis temp dir, for example: `summary` (string), `visible_text` (string), `issues` (array of strings), `confidence` (string). Keep `additionalProperties` allowed or a catch-all `notes` field so older models do not fail the job.
4. When capabilities/help include `--output-schema`, pass `--output-schema <schema.json>` on the Codex chat invocation used by `analyze()`. If the CLI rejects it, fall back to today’s free-text chat (mirror `--json` fallback).
5. If the assistant message is valid JSON matching the schema, attach it under `response.provider_details.media_analysis.structured` **and** keep a human-readable `choices[0].message.content` (stringify summary or original text). Do not break Gateway clients that only read message content.

## Done when

- Chat exec args include `--sandbox read-only` when help advertises it
- Image exec args do **not** force `read-only` if that would block `image_gen` output
- Media analysis uses `--output-schema` when supported, with a documented fallback
- Existing chat/image tests still pass
- `npm test` passes

## Do not

- Do not use `--sandbox danger-full-access` or `--full-auto`.
- Do not change Codex image detection (Plan 09).
- Do not require Gateway plugin changes; extra JSON is additive.
