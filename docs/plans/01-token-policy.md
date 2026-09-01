# Plan 01 — Shared token policy

**Wave:** 1  
**Depends on:** none  
**Next:** [02-codex-and-media-tokens.md](02-codex-and-media-tokens.md)

## Goal

Add one pure helper that every chat-like job will use for output-token targets. No driver behavior changes in this plan except exporting the helper.

## Why

Codex defaults to a **1024** hint, media analysis to **1200**, docs show **256**, and API-key chat ignores `max_tokens`. Those numbers must be resolved in one place before wiring drivers.

## Defaults (product policy)

| Job type | Default `max_tokens` | Notes |
|----------|----------------------|--------|
| `chat` | **8192** | Codex hint + API body field |
| `media.analyze` | **4096** | Longer than today’s 1200 |
| other | ignore | Images/videos are not text-token jobs |

**Requested value rules:**

1. Missing, non-numeric, `<= 0` → use the job-type default.
2. Numeric **below 512** (covers leftover `256` samples) → use the job-type default.
3. Numeric **>= 512** → use `Math.floor(requested)` unchanged (client may ask for more or somewhat less than the default).

Do **not** read Settings or env in this plan. Keep the helper side-effect free.

## Files

- Add [`src/token-policy.js`](../../src/token-policy.js)
- Add [`test/token-policy.test.js`](../../test/token-policy.test.js)
- Wire the new test into `npm test` the same way other `test/*.js` files are included (see `package.json`)

## Steps

1. Export `JOB_MAX_TOKENS`, `TINY_MAX_TOKENS_CEILING` (`512`), and `resolveMaxTokens(jobType, requested)`.
2. Unknown job type with no requested value → `8192` (same as chat), so callers cannot accidentally get `undefined`.
3. Add unit tests for: omit, `256`, `0`, `"abc"`, `4096`, `media.analyze` default, `chat` default.
4. Do **not** change `src/codex.js`, `src/media-analysis.js`, or `src/backend-registry.js` yet.

## Done when

- `resolveMaxTokens('chat') === 8192`
- `resolveMaxTokens('chat', 256) === 8192`
- `resolveMaxTokens('chat', 4096) === 4096`
- `resolveMaxTokens('media.analyze') === 4096`
- `npm test` passes
- No driver or docs edits

## Do not

- Do not add a Settings UI.
- Do not clamp large client values downward.
- Do not treat Codex/Grok context windows as something this helper can raise.
