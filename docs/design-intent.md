# Design Intent

## Purpose

This project is an agent-first private language tutor. It turns an installed local agent into a language-learning assistant that can help a user collect, review, reuse, and practice learning items in any target language.

The system is not a Telegram-only bot and is not a Mandarin-only tutor. The current Telegram Mandarin MVP is a behavior reference for useful flows, but it does not define the final product boundary or technology choices.

## Core Direction

- Agent-first: agents are primary operators of the system, not an afterthought. An agent should be able to initialize a user, add and update learning items, inspect daily status, and guide study through MCP tools.
- MCP first: the first integration surface for agents is an MCP server with explicit tools over local services.
- Provider neutral: LLM usage must go through provider interfaces. The core system should not depend on one model vendor.
- Gateway neutral: Telegram is one gateway adapter. Business logic belongs in core services, not in gateway handlers.
- Any language: the system must support arbitrary target languages and should not hard-code Mandarin-specific assumptions into core models.
- Local private console: the Web UI is a local private console for the user, used to inspect and manage content, settings, methods, and learning progress.
- Shared learning methods: learning methods should be useful to both the user and the agent. The same local content should guide the Web UI and agent behavior.
- Daily check-in calendar: the system should make daily progress visible through status, streaks, and small daily actions.
- Legacy Python boundary: the Python MVP is legacy reference material only. It can inform behavior, but new implementation should use the new TypeScript / Node architecture.

## Product Boundary

The system should help a user:

- create a local language-learning profile;
- save words, phrases, sentences, examples, scenarios, and review metadata;
- enrich learning items through an LLM provider contract;
- let an agent operate the learning system through MCP tools;
- manage learning content through a local Web UI;
- use the user's native language to explain methods and study content when configured;
- track daily progress and check-in state;
- reuse the user's own memory library during reviews, quizzes, stories, dialogues, and normal learning conversations.

The system should avoid:

- binding the product to Telegram as the main interface;
- binding the product to one LLM vendor;
- making Mandarin the only supported target language;
- placing business logic inside gateway adapters;
- treating the Web UI as a public SaaS application;
- rewriting all legacy behavior at once before the new system has verifiable slices.

## Architecture Intent

The intended architecture is:

- TypeScript / Node LTS for the new implementation;
- local database as the durable private memory store;
- core services as the source of business behavior;
- LLM provider adapters behind explicit interfaces;
- gateway adapters behind explicit interfaces;
- MCP server as the primary agent-facing API;
- local Web UI as the user-facing private console;
- content files for usage instructions, learning methods, and agent playbooks.

Each implementation step should produce one small, runnable, verifiable capability. A later agent should be able to understand the project from repository documents without reading prior chat history.

## Verification Intent

Phase 0 is complete only when these documents let another agent understand the project direction without hidden context, and the user confirms that the design intent has not drifted.
