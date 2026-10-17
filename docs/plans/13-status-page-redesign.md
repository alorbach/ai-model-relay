# Plan 13 — Status page redesign

**Wave:** 5 (backlog)<br>
**Depends on:** [12-chat-provider-tests.md](12-chat-provider-tests.md)<br>
**Next:** none

## Goal

Make the local status page (`/` and `/status`) clearly easier to use: a modern light/dark design, a sidebar layout, a calmer Overview, one card per provider in Settings, and more readable Tests, Live, and Debug views. At the same time, move the page out of the single JavaScript template literal in `src/status-page.js`, which has repeatedly broken browser regexes (`\s`, `escapeRegExp`).

## Design decisions (from the operator)

| Topic | Decision |
|------|----------|
| Theme | Light **and** dark. Follows `prefers-color-scheme` by default, with a header toggle (System / Light / Dark) remembered in `localStorage` (wrapped in try/catch). |
| Language | English (unchanged). |
| Accent | Neutral greys + one clear blue accent; green / amber / red only for status. Fluent-like, calm. |
| Density | Balanced: important values large and visible; long paths, venvs, raw JSON, and diagnostics collapsed behind "Details" disclosures. |
| Navigation | Fixed left sidebar: Overview, Live, Providers, Tests, Runtime, Local ASR, Local Image, CUDA Upscale, Music Analysis, Pairing, Debug — with status badges (Live count, unsaved-changes dot, Debug failures). Collapses to an icon rail / top menu on narrow windows. Hash routes keep working (existing `#settings/providers`-style links must still resolve, mapped to the new routes). |
| Providers | One expandable card per provider (Codex CLI, Claude API, Grok/xAI API, Grok CLI, Cursor Agent, Antigravity, OpenAI Videos, API-key chat, CLI Process, Local ASR, Local Image, Local Upscale, Music Analysis …): status pill + diagnostic, key/path fields, model list, provider options, and an inline "Test" button (chat for chat providers via the existing `/v1/relay/test` chat flow; link to the media test otherwise). Routing defaults and token defaults get their own "Routing" card. |
| Technique | Split into real files, still served by the Relay without a build step or dependencies. |

## Phase A — split the page into files (no visual change)

- New directory `src/status-page/` with `index.html`, `styles.css`, `app.js` (and more JS files only if it clearly helps; no bundler).
- `src/status-page.js` keeps its public API (`statusPageHtml()` and whatever else it exports) and assembles the response by reading those files once at module load (`fs.readFileSync` relative to `__dirname`) and inlining CSS and JS into the HTML (placeholders such as `<!-- STYLES -->`, `<!-- SCRIPT -->`, `{{PRODUCT_NAME}}`, `{{LEGACY_PRODUCT_NAME}}` replaced with escaped values). Inlining keeps a single HTML response, so no new routes, CSP/CORS/local-viewer rules stay identical.
- The JS in `app.js` is now plain JavaScript: un-double every escape that was only doubled for the template literal (`\\d` → `\d`, `'\\\\$&'` → `'\\$&'`, etc.). The emitted page must be byte-for-byte equivalent in behavior; verify by diffing the emitted HTML before and after (ignoring whitespace differences only where unavoidable).
- Packaging: `package.json` `build.files` already includes `src/**/*`. Verify the files are readable from the packaged app (asar) in the way the server process is started (`src/main.js`); if asar reads are a problem, add the directory to `asarUnpack`.
- Update tests that extract functions from the emitted script so they keep working (they can now read `app.js` directly, but the emitted page must also still parse).

## Phase B — design system and shell

- CSS custom properties for colors, spacing, radius, shadows, typography on `:root`, with dark values under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]` for the explicit toggle. `body` has an explicit background. System font stack (Segoe UI Variable / Segoe UI first). No external fonts or scripts.
- Components: sidebar nav, page header with title + actions, card, status pill (ok / warn / error / unknown / checking), badge, button (primary / secondary / subtle / danger), form field with label + hint + inline error, disclosure ("Details"), table, empty state, toast/inline message, progress/activity bar. Visible focus rings; keyboard navigation for sidebar and disclosures; `aria-*` kept or improved.
- Layout works from ~360 px to wide screens; no horizontal page scroll; long paths wrap or truncate with full value in a tooltip and a copy button.

## Phase C — Overview

- Remove duplicated panels (Bridge / Codex / Jobs appear once).
- Top row: Relay status (version, port, uptime if available, paired sites count), Jobs (running / queued with link to Live), Providers summary (n ready / n need attention, linking to Providers).
- Provider status grid: one compact tile per provider with status pill and one-line diagnostic; click opens that provider card.
- Claude API usage panel stays prominent (credits estimate, month spend vs limit, rate limits).
- Local ASR runtime and Codex binary details move behind "Details" disclosures (or onto their provider cards).

## Phase D — Providers

- Implement the per-provider cards described above, reusing the existing settings payload and save endpoint (`/v1/relay/settings`) and existing per-feature settings endpoints (ASR, image, upscale, music analysis) without changing their contracts.
- Clear save model: a sticky "Unsaved changes — Save / Discard" bar when the form is dirty; per-field validation messages (e.g. USD amounts) shown inline; secrets show "Saved key ends with …" plus "Replace" / "Clear" actions.
- "Refresh detection" stays available (header action).

## Phase E — Tests, Live, Debug

- Tests: the Chat / Image / Video / Video analysis / Audio test types as sub-tabs or segmented control; result areas larger and readable; "Run all chat tests" prominent with a summary bar.
- Live: job list with clear status pills, provider, model, elapsed; selected job detail with readable session output (monospace, wrap toggle, copy), artifacts preview.
- Debug: failures list, health checks, raw status JSON (collapsed by default, with filter and copy).

## Constraints

- No new runtime dependencies, no build tool, no external network assets (fonts, CDNs).
- Do not change server routes, payload contracts, security rules (local-viewer checks, CORS, pairing), or job behavior. UI-only plus the file split.
- Preserve all existing functionality (every setting, every action, every test flow, pairing code display, SSE/polling, artifact previews, media preview overlay).
- All dynamic values escaped (`escapeHtml`); no `innerHTML` with unescaped data.
- Keep existing element ids that tests or other code rely on, or update those tests in the same change.

## Tests

- Existing tests stay green (`npm test` except the pre-existing `local-image` failure), adapted where the DOM structure intentionally changed.
- Add tests for: theme toggle persistence logic, sidebar route mapping (old hashes → new routes), provider card rendering from capabilities/settings (incl. escaping), unsaved-changes bar logic.

## Done when

- [x] Phase A merged-quality: page split into files, behavior unchanged, tests green.
- [x] Phases B–E implemented per the decisions above.
- [x] Verified in the browser at desktop and narrow width, light and dark.
- [x] Haiku review loop finds no P0–P2 (eight rounds).
- [x] Docs (`docs/architecture.md`, `docs/operations.md`, README screenshots note) and plan index updated.
