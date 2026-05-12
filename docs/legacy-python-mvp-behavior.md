# Legacy Python MVP Behavior Boundary

Phase 11 records the old Python Telegram MVP as behavior reference only. No active Python source is present in this repository.

## Covered User Paths

The new Node system now covers the old MVP's core user path locally:

- initialize a language-learning user through MCP or Telegram gateway simulation;
- add saved learning items through MCP, Web, CLI, or Telegram gateway simulation;
- list and search saved learning items;
- inspect daily status, due reviews, streaks, and training completion;
- request study through Telegram `/study`;
- generate review, quiz, story, dialogue, and conversation prompts from the user's saved memory.

## Boundary Rule

Do not add new business logic to a Python Telegram bot. Telegram remains a gateway adapter, and business behavior belongs in Node services under `scripts/`.

If old MVP files are needed for comparison, place them under `legacy/python-telegram-mvp/` and mark them reference-only. Do not wire them into runtime scripts, tests, or installation instructions.
