# Next Generation Language Tutor

Agent-first private language tutor for local, self-hosted language learning.

This repository is the new Node-based implementation. The old Telegram Mandarin Python MVP is legacy reference material only; new product behavior belongs in the local Node services, MCP tool surface, Web UI, provider adapters, and gateway adapters.

## Current Architecture

- Node LTS runtime with a local CLI in `bin/agent-language-tutor.mjs`
- SQLite local memory store through `scripts/db-cli.mjs`
- MCP server for agent-facing tools through `scripts/mcp-server.mjs`
- Local private Web UI through `scripts/web-server.mjs`
- Provider boundary through `scripts/llm-service.mjs`
- Gateway boundary through `scripts/gateway-service.mjs`
- Memory-driven training generation through `scripts/training-service.mjs`

The repository documents in `docs/` are the source of truth. Start with:

- `docs/main_design_intend.md`
- `docs/development-progress.html`
- the active file under `docs/phases/`

## Local Use

```sh
npm install
npm run help
npm run migrate
npm test
```

Run the local Web UI:

```sh
npm run serve:web
```

Run the local MCP server:

```sh
npm run serve:mcp
```

Simulate the Telegram gateway locally:

```sh
npm run gateway -- telegram /start
npm run gateway -- telegram /study apple
```

Generate memory-driven practice:

```sh
npm run training -- --mode quiz --query apple
```

## Legacy Python Boundary

There is no active Python implementation in this repository. If old MVP material is reintroduced, place it under `legacy/python-telegram-mvp/` as reference-only material and keep new work in the Node architecture above.
