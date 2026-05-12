# Installation Guide for AI Agents

This repository is the Node-based implementation of the agent-first private language tutor.

The current baseline includes local database behavior, MCP tools, local Web UI pages, provider boundaries, gateway adapter simulation, daily status, and memory-driven training generation. The old Python Telegram MVP is legacy reference material only and should not receive new business logic.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Fresh Install

From the repository root:

```sh
npm install
npm run help
```

Expected result:

- npm completes successfully;
- CLI help prints the available local commands.

## CLI Commands

After running `npm install`, use:

```sh
npm run help
npm run cli -- install
npm run migrate
npm run serve:mcp
npm run serve:web
npm run gateway -- telegram /start
npm run training -- --mode quiz --query apple
```

The `serve:mcp` and `serve:web` commands start long-running local services. The `gateway` command is a token-free local Telegram adapter simulation.

## Architecture Boundary

- Keep business logic in Node services under `scripts/`.
- Keep Telegram as a replaceable gateway adapter.
- Keep MCP as the primary agent-facing integration surface.
- Keep old Python MVP material reference-only if it is reintroduced.

Continue from `docs/development-progress.html` and the active phase file under `docs/phases/`.
