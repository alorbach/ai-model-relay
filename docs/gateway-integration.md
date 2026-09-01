# Gateway Integration

This document is for developers integrating a browser-mediated local Codex flow with Alorbach AI Subscription Gateway. It documents the Gateway's existing legacy Codex contract; relay routing is additive and must be explicitly enabled by the Gateway integration.

Reference implementation in the [Alorbach AI Subscription Gateway](https://github.com/alorbach/alorbach-ai-subscription-gateway/) repository:

```text
https://github.com/alorbach/alorbach-ai-subscription-gateway/blob/main/wordpress-plugin/includes/class-local-codex-bridge.php
https://github.com/alorbach/alorbach-ai-subscription-gateway/blob/main/wordpress-plugin/assets/js/demo-pages.js
```

## Responsibility Split

The local tray bridge owns:

- localhost HTTP API;
- origin pairing and local bearer token storage;
- cached provider discovery and readiness checks;
- local Codex chat/image execution;
- optional Grok CLI (isolated Gateway chat; Imagine media exposed only after local skill detection) and Cursor Agent `--mode=ask` chat;
- optional Antigravity CLI chat, images, and media analysis;
- optional xAI API chat, Imagine image/video (`model-relay:xai:imagine-image`, `model-relay:xai:imagine-video`), and Speech-to-Text when `XAI_API_KEY` is configured;
- resolved chat/media `max_tokens` defaults and Settings overrides;
- normalized chat and image response shapes.

The WordPress Gateway owns:

- whether Local Codex is enabled for a site;
- the public model IDs exposed to users;
- user authentication;
- plan access checks;
- rate limits and monthly quotas;
- optional local-service fees;
- duplicate request protection;
- one-time job tokens;
- ledger and audit records;
- final result normalization.

The browser owns the handoff because WordPress cannot reliably call `127.0.0.1` on the user's machine from the server. The user's browser can reach both WordPress and the local tray bridge.

## WordPress REST Contract

The Gateway driver currently registers these routes under `/wp-json/alorbach/v1`:

```text
GET  /local-codex/config
POST /local-codex/jobs
POST /local-codex/jobs/{job_id}/complete
POST /local-codex/jobs/{job_id}/fail
```

### Config

`GET /local-codex/config` returns:

```json
{
  "enabled": true,
  "origin": "http://localhost:8888",
  "bridge_url": "http://127.0.0.1:8765",
  "text_prefix": "codex-local:",
  "image_model": "codex-local:image",
  "job_ttl_seconds": 900
}
```

The `origin` value must be the exact origin paired with the bridge. The browser stores the bridge token under a key scoped to this origin.

### Create Job

`POST /local-codex/jobs`

Chat request:

```json
{
  "type": "chat",
  "payload": {
    "model": "codex-local:auto",
    "messages": [
      {
        "role": "user",
        "content": "Hello"
      }
    ],
    "max_tokens": 8192
  }
}
```

`max_tokens` is optional on the signed payload. The bridge treats omitted values and integers below 512 (including leftover `256` examples) as the chat default **8192**, unless the tray Settings **Chat token default** is set. Integers `>= 512` are honored. Do not rely on `256` as a product cap. Codex uses the resolved number only as a prompt hint; xAI and API-key chat send it as `max_tokens` and `max_completion_tokens`.

Image request:

```json
{
  "type": "image",
  "payload": {
    "model": "codex-local:image",
    "prompt": "A square application icon",
    "size": "1024x1024",
    "quality": "high"
  }
}
```

Response:

```json
{
  "job_id": "...",
  "job_token": "...",
  "request_hash": "...",
  "request_id": "...",
  "type": "chat",
  "payload": {},
  "expires_in": 900,
  "fee_uc": 0
}
```

The returned `payload` is the payload the browser must send to the local bridge. Do not reconstruct or mutate it in browser code after WordPress signs the job.

### Complete Job

`POST /local-codex/jobs/{job_id}/complete`

```json
{
  "job_token": "...",
  "request_hash": "...",
  "result": {
    "success": true,
    "response": {}
  }
}
```

Gateway validates job ownership, job token, duplicate request hash, and response shape. It then records usage and returns the final API response.

### Fail Job

`POST /local-codex/jobs/{job_id}/fail`

```json
{
  "job_token": "...",
  "request_hash": "...",
  "message": "Local Codex bridge failed."
}
```

Call this when the bridge call fails after a Gateway job has been created. It clears the duplicate request lock so the user can retry.

## Browser Driver Pattern

The production browser driver follows this shape:

```js
async function executeLocalCodex(type, payload) {
  const config = await wpGet('/local-codex/config');
  const bridge = await ensurePairing(config.bridge_url, config.origin);
  const job = await wpPost('/local-codex/jobs', { type, payload });

  try {
    const endpoint = type === 'chat' ? '/v1/chat' : '/v1/images';
    const bridgeResult = await bridgePost(bridge.url + endpoint, bridge.token, {
      job_token: job.job_token,
      request_hash: job.request_hash,
      request_id: job.request_id,
      payload: job.payload
    });

    return await wpPost('/local-codex/jobs/' + encodeURIComponent(job.job_id) + '/complete', {
      job_token: job.job_token,
      request_hash: job.request_hash,
      result: bridgeResult
    });
  } catch (error) {
    await wpPost('/local-codex/jobs/' + encodeURIComponent(job.job_id) + '/fail', {
      job_token: job.job_token,
      request_hash: job.request_hash,
      message: error.message || 'Local Codex bridge failed.'
    }).catch(function () {});
    throw error;
  }
}
```

This mirrors the current Gateway demo implementation in `assets/js/demo-pages.js`.

## Optional Relay Routes

New integrations may send the same signed envelope to `/v1/relay/jobs/chat`, `/images`, `/videos`, `/transcribe`, or `/media/analyze`. They may set `payload.provider`, `payload.backend`, or a `model-relay:<backend>:<model>` model ID. If none is supplied, the local relay default for that operation is used. A selected unavailable or incompatible provider fails clearly; the bridge does not substitute another provider. Chat image data URLs are supported on Codex (`--image`) and on Grok/Cursor/Antigravity via temp files in the job workspace, not as argv base64.

Keep provider choice in the server-created, signed Gateway payload. Do not let browser code alter the model/provider after job creation. The legacy `codex-local:*` endpoints and contract shown above remain unchanged. Media analysis may add `response.provider_details.media_analysis.structured` when Codex supports `--output-schema`; always keep using `choices[0].message.content` as the human-readable answer.

## Model IDs

The Gateway exposes:

```text
codex-local:auto
codex-local:image
```

The bridge can report more local text model IDs through `/v1/models` if Codex has a `models_cache.json`, but production WordPress UI should only expose models the site deliberately supports.

## Security Notes

- Pairing tokens are browser-origin bearer tokens. Store them in `localStorage` or a similarly origin-scoped store only for the paired site.
- Do not send the bridge token to WordPress.
- Do not execute Local Codex jobs directly from WordPress server code. The bridge is intentionally localhost-only on the user's machine.
- Do not trust browser-created job envelopes for production accounting. Always create one-time jobs server-side and validate completion server-side.
- Treat failed bridge calls as recoverable. Post to `/fail` when a Gateway job exists.
