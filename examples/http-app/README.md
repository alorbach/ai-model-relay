# Local HTTP Example

This is a small standalone developer app for exercising the raw AI Model Relay API from a real browser origin. It uses the legacy Codex routes for compatibility; relay-specific routes are documented in [the API reference](../../docs/local-bridge-api.md).

It is not a replacement for the WordPress Gateway driver. The production Gateway flow must create one-time jobs server-side and complete or fail them server-side as documented in [../../docs/gateway-integration.md](../../docs/gateway-integration.md).

## Run

From the repository root:

```powershell
npm run serve
```

In a second terminal:

```powershell
npm run example:http
```

Open:

```text
http://127.0.0.1:8787
```

Use the tray app or server output to get the pairing code, pair this example origin, then run status, model, chat, or image requests.

## What It Demonstrates

- using a real `http://127.0.0.1:<port>` browser origin instead of `file://`;
- checking `/v1/status`;
- pairing with `/v1/pair`;
- storing the bridge token in origin-scoped `localStorage`;
- sending the token on paired bridge routes;
- calling `/v1/models`, `/v1/chat`, `/v1/images`, and `/v1/unpair`.

The example creates local development request IDs and hashes in the browser. That is acceptable for a protocol smoke test only. Production Gateway integrations must use server-created `job_token`, `request_hash`, and `request_id` values.
