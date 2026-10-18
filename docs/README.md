# Documentation

AI Model Relay is one local REST API in front of many AI providers: subscription CLIs (Codex, Grok, Cursor Agent, Antigravity), API-key providers (Claude, xAI, any OpenAI-compatible endpoint), and local engines (ASR, image, upscale, music analysis). The project [README](../README.md) explains why and gives a quick start.

- [Architecture](architecture.md): tray app, local HTTP server, backend drivers, routing, cached diagnostics, state files, and the Gateway handoff.
- [Local Bridge API](local-bridge-api.md): every route, payload, and response, including routing defaults, the chat and media `max_tokens` policy, and live job artifacts.
- [Gateway Integration](gateway-integration.md): the production browser-mediated flow with the Alorbach AI Subscription Gateway.
- [Configuration](configuration.md): environment variables for every provider and local engine.
- [Operations](operations.md): status page, providers and routing, local engines, diagnostics, screenshots, builds, releases, and common failures.
- [Implementation plans](plans/README.md): the numbered plan backlog. Work one plan at a time.

The small standalone developer example lives in [../examples/http-app](../examples/http-app/README.md).
