# Plan 07 — Antigravity IMAGE_PATH import

**Wave:** 3  
**Depends on:** [04-cli-prompt-files.md](04-cli-prompt-files.md)  
**Next:** [08-cli-models-and-vision.md](08-cli-models-and-vision.md)

## Goal

Import Antigravity images from an explicit path the CLI prints, instead of walking `~\.gemini\antigravity-cli` by filename + mtime.

## Why

`findGeneratedImages` scans up to 5000 files, depth 8, matching `relay-<timestamp>-<uuid>`. That is race-prone and slow. Wrappers in the Antigravity ecosystem already ask `agy` to end with `IMAGE_PATH: <absolute path>`.

## Files

- [`src/backend-registry.js`](../../src/backend-registry.js) — `createAntigravityCliDriver.images`, `runPrompt`
- [`test/backend-registry.test.js`](../../test/backend-registry.test.js) — Antigravity image success/failure cases

## Steps

1. Extend the generate_image instruction: after the tool runs, print a single line `IMAGE_PATH: <absolute path to the saved image>` and nothing else of that form.
2. Parse stdout/JSON text for `IMAGE_PATH:\s*(.+)`. Resolve the path. Only accept it if:
   - it is an existing file
   - extension is png/jpeg/jpg/webp
   - size is `> 0` and `<= 20 MB`
   - it lives under the Antigravity state root **or** the job temp workspace (reuse `pathIsInside`)
3. Keep `findGeneratedImages` as **fallback** if the marker is missing (old CLI / ignored instruction).
4. Probe `--help` for `--model` / `--effort`. If present, you may pass them when `payload.model` is not `auto`. If help or known hang reports say `-p --model` is unsafe, **do not** pass `--model` (comment + skip). Prefer no model flag over a hanging job.
5. Tests: mock runner returns `IMAGE_PATH: <file we created>`; assert that file is read and the walk is not required. Second test: no marker, file only discoverable via fallback walk.

## Done when

- Happy path does not depend on mtime scans when `IMAGE_PATH` is present
- Path traversal outside state root / workspace is rejected
- Fallback walk still works
- `npm test` passes

## Do not

- Do not delete the state-root walk until fallback tests exist.
- Do not pass `--sandbox` for Antigravity unless you have verified it only blocks shell and does not drop JSON output (upstream reports are mixed).
- Do not implement video for Antigravity.
