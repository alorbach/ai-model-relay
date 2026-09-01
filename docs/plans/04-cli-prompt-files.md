# Plan 04 — CLI prompt files (Windows argv)

**Wave:** 2  
**Depends on:** Wave 1 complete  
**Next:** [05-chat-isolation-and-imagine.md](05-chat-isolation-and-imagine.md)

## Goal

Stop putting the full Gateway transcript on the process command line for Grok, Cursor, and Antigravity chat. Use a temp file. Remove Antigravity’s `slice(0, 24000)` input cap.

## Why

Codex already sends the prompt on stdin. Grok chat uses `--single <prompt>`, Cursor uses a trailing prompt arg, Antigravity uses `-p <prompt>` then truncates to 24 000 characters. Large WordPress transcripts fail or get cut on Windows.

## Files

- [`src/local-cli.js`](../../src/local-cli.js) — optional shared `writePromptFile(dir, text)` if it stays tiny; otherwise keep it local to `backend-registry.js`
- [`src/backend-registry.js`](../../src/backend-registry.js) — `createNamedCliDriver.chat` (Cursor + Grok base), `createGrokCliDriver` chat path, `createAntigravityCliDriver.chat`
- [`test/backend-registry.test.js`](../../test/backend-registry.test.js)
- [`test/local-cli.test.js`](../../test/local-cli.test.js) if the helper lives there

Grok Imagine still uses `--single` with a **short** instruction; changing Imagine to `--prompt-file` is allowed in this plan if tests stay green, but is not required until Plan 05.

## Steps

1. Each chat job already creates (or should create) a temp workspace. Write `prompt.txt` (UTF-8) there.
2. **Grok chat:** `grok --prompt-file <path> --output-format json` (plus existing `--model` when not auto). Do not also pass `--single` with the full text. Probe `--help` only if you must feature-detect; current Grok docs include `--prompt-file`.
3. **Cursor chat:** keep `--print --output-format json`. Pass a **short** argv prompt such as `Respond to the user request in prompt.txt.` and `--workspace <tempDir>`. Do not paste the transcript into argv. Plan 05 will add `--mode=ask --trust`.
4. **Antigravity chat:** write the full prompt to a file; pass `-p` with a short instruction that tells `agy` to read that file (same `@path` idea as media analysis). Delete `.slice(0, 24000)` on the **user transcript**. Image/media prompts may still bound the *user request* string if needed; do not reintroduce a 24k cap on chat transcripts.
5. Tests: fake spawn captures args; assert the transcript is **not** in `args.join(' ')`, assert the prompt file exists and contains the transcript, assert Antigravity has no 24000 slice on a 30k prompt.

## Done when

- A 30 000 character chat transcript never appears as a CLI argv value for Grok, Cursor, or Antigravity
- Antigravity chat no longer truncates at 24 000 characters
- Temp files are still removed in `finally`
- `npm test` passes

## Do not

- Do not add `--mode=ask`, `--disallowed-tools`, or Imagine `--tools` (Plan 05).
- Do not put secrets in filenames; use a fixed `prompt.txt` inside the mkdtemp dir.
- Do not switch Codex off stdin (already correct).
- Do not raise `MAX_BODY_BYTES`.
