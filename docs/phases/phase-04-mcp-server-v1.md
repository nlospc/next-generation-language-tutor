# Phase 4: MCP Server 第一版

## 目标

让 agent 可以直接操作系统。

## 交付 MCP tools

- `initialize_user`
- `add_learning_item`
- `list_learning_items`
- `search_learning_items`
- `update_learning_item`
- `delete_learning_item`
- `get_daily_status`

## 验证

- Claude/Codex/本地 MCP client 可调用工具。
- agent 可完成：初始化用户 -> 添加条目 -> 查询条目 -> 删除条目。
- 这是第一轮真实 agent 使用反馈点。
