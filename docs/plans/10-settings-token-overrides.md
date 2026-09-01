# Plan 10 — Settings token overrides

**Wave:** 4 (optional)  
**Depends on:** Wave 1 complete  
**Next:** none (backlog after this file)

## Goal

Let the status-page Settings tab override Plan 01 defaults per job type (`chat`, `media.analyze`) without editing code. Keep the UI small.

## Why

Operators may want 32k chat hints on a high-quota machine, or a lower cap. Plan 01 explicitly left Settings out.

## Files

- [`src/token-policy.js`](../../src/token-policy.js) — accept an optional overrides map
- [`src/relay-settings.js`](../../src/relay-settings.js) — persist `token_defaults: { chat, 'media.analyze' }`
- [`src/status-page.js`](../../src/status-page.js) — two numeric fields under Providers
- [`test/relay-settings.test.js`](../../test/relay-settings.test.js)
- [`test/token-policy.test.js`](../../test/token-policy.test.js)

## Steps

1. Persist only positive integers in a sane range (for example 512–128000). Empty field = use code defaults from Plan 01.
2. `resolveMaxTokens(jobType, requested, settings)` uses the Settings default **instead of** the hardcoded default. Tiny client `256` still floors up to that Settings default.
3. Explicit client `max_tokens >= 512` still wins (Gateway remains in control for a single job).
4. Do not add per-provider token fields in the first UI (Codex vs xAI). Job type only.
5. Settings save already rebuilds backends; no extra refresh protocol.

## Done when

- Saving `chat: 16384` makes omitted Codex/xAI/API-key jobs resolve to 16384
- Invalid values are rejected or ignored, not stored as `NaN`
- `npm test` passes
- Status page still loads if `token_defaults` is absent (old state files)

## Do not

- Do not add sliders, per-model tables, or Grok `config.toml` editors.
- Do not expose the 12 MiB body limit as a user setting.
- Do not change pairing or job-token security.
