# Phase 9: Gateway 抽象与 Telegram Adapter

## 目标

把当前 Telegram MVP 能力作为一个可替换 gateway 回来。

## 交付

- `GatewayAdapter` interface
- Telegram adapter
- `/start`
- `/add`
- `/list`
- `/study`
- `/status`
- daily reminder hook

## 验证

- Telegram 只调用核心 services，不包含业务逻辑。
- `/add` 与 MCP `add_learning_item` 行为一致。
- Telegram daily reminder 显示 streak 和今日最小行动。
