# Phase 2: 本地数据库与核心模型

## 目标

先把“私有记忆库”打牢。

## 交付

- SQLite schema/migrations
- 用户配置表
- `learning_items`
- SRS 基础表
- daily check-in 表
- CRUD service

## 验证

- CLI 或测试可创建用户配置。
- 可新增、查询、编辑、删除 learning item。
- 测试覆盖 migration 幂等和 CRUD。
- 不实现 Web UI，不实现 MCP。
