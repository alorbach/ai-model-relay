# Implementation plans

Work **one plan at a time**, in order inside a wave. Do not start the next plan until the current plan’s **Done when** checklist is green and `npm test` passes.

In a new chat, paste:

```text
Implement only docs/plans/NN-....md
Do not start the next plan.
Follow the file’s Done when / Do not sections.
```

The Relay stays a signed Gateway job bridge. These plans do **not** add a Relay-owned coding-agent tool host (grep, shell, MCP, browser).

## Waves

```text
Wave 1  Limits we actually control
        01 → 02 → 03

Wave 2  Large prompts + isolated CLI chat
        04 → 05

Wave 3  Stronger existing tools
        06 → 07 → 08

Wave 4  Optional product polish
        09 → 10

Wave 5  New backends / backlog
        11
```

Later waves assume earlier waves are merged. Plans inside a wave are sequential unless a plan says otherwise.

## Index

### Wave 1 — Token limits

| Plan | Title | Goal |
|------|-------|------|
| [01](01-token-policy.md) | Shared token policy | One helper for job-type defaults and leftover `256` samples |
| [02](02-codex-and-media-tokens.md) | Codex + media.analyze | Use the helper; raise Codex hint and transcript slice |
| [03](03-api-chat-passthrough.md) | xAI + API-key chat | Forward sampling fields; stop unused `stream` |

### Wave 2 — CLI prompt size and isolation

| Plan | Title | Goal |
|------|-------|------|
| [04](04-cli-prompt-files.md) | Prompt files | Grok/Cursor/Antigravity chat off the Windows argv limit |
| [05](05-chat-isolation-and-imagine.md) | Isolation + Imagine allowlist | Gateway chat cannot shell; Imagine uses `--tools` |

### Wave 3 — Existing tool quality

| Plan | Title | Goal |
|------|-------|------|
| [06](06-codex-sandbox-and-schema.md) | Codex sandbox + schema | Explicit read-only chat; structured media.analyze |
| [07](07-antigravity-image-path.md) | Antigravity IMAGE_PATH | Import the printed path instead of walking the state root |
| [08](08-cli-models-and-vision.md) | Model lists + vision | Real CLI model IDs; chat image parts for Grok |

### Wave 4 — Optional

| Plan | Title | Goal |
|------|-------|------|
| [09](09-codex-image-output.md) | Codex image output | Less fragile generated-image detection |
| [10](10-settings-token-overrides.md) | Settings overrides | Optional per-job `max_tokens` on the status page |

### Wave 5 — Backlog

| Plan | Title | Goal |
|------|-------|------|
| [11](11-cursor-agent-images.md) | Cursor Agent images | Gateway image jobs via Cursor `GenerateImage` |

## Constraints that apply to every plan

- Do not rewrite `%USERPROFILE%\.grok\config.toml` or Codex `config.toml`.
- Do not raise the 12 MiB JSON body cap in `src/security.js` unless a later plan explicitly says so.
- Do not add chat-completion SSE, session resume, MCP, `--yolo`, or `--force`.
- Do not silently fall back to another provider.
- Keep changes inside the listed files unless a test forces a small extra edit.
- Prefer one focused commit per plan after you ask for a commit.

## Progress

Mark a plan done in this table when its **Done when** section is complete:

- [x] 01 Token policy
- [x] 02 Codex + media tokens
- [x] 03 API chat passthrough
- [x] 04 CLI prompt files
- [x] 05 Chat isolation + Imagine
- [x] 06 Codex sandbox + schema
- [x] 07 Antigravity IMAGE_PATH
- [x] 08 CLI models + vision
- [x] 09 Codex image output
- [x] 10 Settings token overrides
- [ ] 11 Cursor Agent images
