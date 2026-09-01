# Plan 09 — Codex image output detection

**Wave:** 4 (optional)  
**Depends on:** [06-codex-sandbox-and-schema.md](06-codex-sandbox-and-schema.md)  
**Next:** [10-settings-token-overrides.md](10-settings-token-overrides.md)

## Goal

Stop relying only on a before/after diff of the shared `CODEX_HOME/generated_images` directory so image jobs are less racy. Keep returning exactly one image as today.

## Why

Architecture docs: image jobs are limited to one at a time because detection watches a shared folder. Parallel chat is allowed; a second image job can steal or miss files.

## Files

- [`src/codex.js`](../../src/codex.js) — `images`, `detectNewImage`, `runCodexExec`
- [`docs/architecture.md`](../architecture.md) — update the one-image-at-a-time rationale if the lock can relax
- Job manager concurrency in [`src/job-manager.js`](../../src/job-manager.js) only if detection is truly per-job

## Steps

1. Read current `codex exec --help` on a real install (or captured help in capabilities) for output-directory / last-image flags. Prefer an official flag over env hacks.
2. If the CLI can write the generated image into the **job temp dir**, collect from there and stop diffing `generated_images`.
3. Else, keep the shared-dir diff but:
   - record the expected start time and file set
   - prefer the file named in `--json` events if present
   - keep the existing global one-at-a-time image lock
4. Only remove the image concurrency lock if tests prove two overlapping jobs cannot pick the same file.
5. Tests with fake filesystem/events; do not require a live Codex login in CI.

## Done when

- Either images are read from the job temp dir, or the shared-dir path is documented as still requiring the lock
- Failure when no image appears still uses `codex_no_image_output`
- `npm test` passes

## Do not

- Do not run two real Codex image jobs in CI.
- Do not return multiple images unless Gateway already accepts `data[]` (it does for some providers — keep Codex at one image unless you verify Gateway).
