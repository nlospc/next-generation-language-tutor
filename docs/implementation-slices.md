# Implementation Slices

This file records the intended incremental delivery path. Each slice should be completed and verified before moving to the next one.

## Slice 0: Project Intent

Goal: solidify the project design intent for future agents.

Deliver:

- `docs/design-intent.md`
- `docs/implementation-slices.md`

Verify:

- another agent can understand the project without chat history;
- the user confirms the design intent has not drifted.

## Slice 1: Project Skeleton

Goal: create the new TypeScript / Node project skeleton without business complexity.

Deliver:

- `package.json`
- `tsconfig.json`
- base directories for core, database, LLM, MCP, Web UI, gateways, content, and docs;
- placeholder CLI commands for install, migrate, MCP server, and Web server;
- installation guide for AI agents.

Verify:

- fresh install can run CLI help;
- an agent can follow the install guide to start the local skeleton;
- no Telegram integration and no real LLM integration.

## Slice 2: Local Database And Core Model

Goal: establish the local private memory store.

Deliver:

- SQLite schema and migrations;
- user configuration table;
- `learning_items`;
- basic SRS tables;
- daily check-in table;
- CRUD service.

Verify:

- CLI or tests can create user configuration;
- learning items can be created, read, updated, and deleted;
- migration idempotency and CRUD behavior are covered by tests;
- no Web UI and no MCP behavior in this slice.

## Slice 3: Provider Abstraction And Mock LLM

Goal: define what the model must do without binding the system to one provider.

Deliver:

- `LLMProvider` interface;
- mock provider;
- OpenAI-compatible provider;
- prompt contract and JSON schema validation;
- learning item enrichment service.

Verify:

- mock provider can enrich a word, phrase, or sentence;
- output includes meaning, usage, example, and scenario;
- immediate user-facing summary stays under 200 words;
- no gateway integration.

## Slice 4: MCP Server V1

Goal: let agents directly operate the system.

Deliver MCP tools:

- `initialize_user`
- `add_learning_item`
- `list_learning_items`
- `search_learning_items`
- `update_learning_item`
- `delete_learning_item`
- `get_daily_status`

Verify:

- Claude, Codex, or a local MCP client can call the tools;
- an agent can initialize a user, add an item, query it, and delete it;
- this is the first real agent usage feedback point.

## Slice 5: Web UI Shell And Content System

Goal: create the local private console and documentation entry point.

Deliver:

- Web server;
- lightweight Web UI guided by Open Design;
- home page;
- usage instructions page;
- learning methods page;
- content loaded from `content/usage/`, `content/methods/`, and `content/agent-playbooks/`;
- Markdown or HTML rendering.

Verify:

- user can visit the local Web UI;
- pages are stable, lightweight, and usable;
- user can read project usage and learning method content;
- agents can read the same content as method context.

## Slice 6: Web UI Learning Items CRUD

Goal: let the user manage the private vocabulary and learning library without Telegram.

Deliver:

- learning item list;
- search and filters;
- create, edit, and delete flows;
- import and export.

Verify:

- user can complete real CRUD through the Web UI;
- MCP query results match Web UI changes;
- no complex permission system, because the default deployment is local and private.

## Slice 7: Native-Language Personalized Content

Goal: make the Web UI feel like the user's own learning space.

Deliver:

- native-language setting read path;
- LLM rewrite of project instructions and learning methods into the user's native language;
- private local storage for user-specific content;
- Web UI preference for the private version when available.

Verify:

- changing native language can regenerate instructions;
- private content persists across restart;
- agents can read the personalized learning method content.

## Slice 8: Daily Check-In Calendar

Goal: make learning progress visible through daily feedback.

Deliver:

- daily status service;
- check-in calendar API;
- Web UI monthly calendar;
- streak calculation;
- today's task status, including due reviews, items added, training completed, and completion state.

Verify:

- Web UI shows learning streak;
- adding items or completing review updates today's status;
- MCP `get_daily_status` reads the same data.

## Slice 9: Gateway Abstraction And Telegram Adapter

Goal: bring back the current Telegram MVP capability as a replaceable gateway.

Deliver:

- `GatewayAdapter` interface;
- Telegram adapter;
- `/start`, `/add`, `/list`, `/study`, and `/status`;
- daily reminder hook.

Verify:

- Telegram calls core services only and contains no business logic;
- `/add` matches MCP `add_learning_item` behavior;
- Telegram daily reminder shows streak and today's smallest action.

## Slice 10: Training And Memory Reuse

Goal: make the user's memory library drive actual learning.

Deliver:

- related item retrieval;
- review prompt generation;
- quiz generation;
- story and dialogue generation;
- ordinary learning conversations that prefer the user's memory library.

Verify:

- saved items reappear during review, stories, quizzes, and conversations;
- user can feel that their own vocabulary library drives learning;
- this is the second real usage feedback point.

## Slice 11: Legacy Python Handling

Goal: clean up the old MVP boundary after the new system covers the core path.

Deliver one of:

- move old Python code into `legacy/python-telegram-mvp`;
- delete the old Python implementation and keep behavior notes only;
- update README to point to the new architecture.

Verify:

- the new system covers the old MVP's core user path;
- old code no longer misleads future agents.
