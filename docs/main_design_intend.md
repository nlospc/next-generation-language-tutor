# Agent-First Language Tutor 主设计导航

本文件只作为主设计导航。具体设计内容按 phase 拆分在 `docs/phases/`。

后续 agent 继续开发时，应先阅读：

1. `docs/development-progress.html`
2. 本文件的 phase 索引
3. 当前 phase 对应的设计文件

不要只看本文件就开始编码。具体目标、交付和验证标准以对应 phase 文件为准。

## 主 Design Intent

把当前 Telegram Mandarin MVP 转为一个面向 agent install、自部署、任意语言学习的私有化语言学习系统。

核心原则：

- 当前 Python 项目只作为行为原型，不约束最终技术栈。
- 新系统以 `TypeScript / Node LTS + MCP Server + Web UI + Provider/Gateway adapters` 为主架构。
- 每一步只交付一个可运行、可验证的能力。
- 每一步完成后都要让用户或 agent 真实使用，再根据反馈进入下一步。
- 不一次性重写所有功能，避免上下文失控和架构空转。

## Agent 接续流程

1. 打开 `docs/development-progress.html`，确认当前状态、已完成工作、已改文件、已知问题和下一步。
2. 回到本文件，找到 `Current phase` 或进度页指向的 phase。
3. 阅读对应 phase 文件中的目标、交付和验证。
4. 只实施当前 phase 的最小可验证下一步。
5. 完成后更新 `docs/development-progress.html`。
6. 跑相关检查，并把检查结果写回 `docs/development-progress.html`。
7. 向用户汇报时使用 `AGENTS.md` 要求的格式。

## Current phase

Phase 0 到 Phase 11 的本地基线已经完成。当前应进入真实试用、反馈整理或下一轮设计。

最后完成的 phase 设计文件：

- [Phase 11: Legacy Python 处理](phases/phase-11-legacy-python-handling.md)

## Phase 索引

- [Phase 0: 项目意图固化](phases/phase-00-project-intent.md)
- [Phase 1: 新项目骨架](phases/phase-01-project-skeleton.md)
- [Phase 2: 本地数据库与核心模型](phases/phase-02-local-database-core-model.md)
- [Phase 3: Provider 抽象与 Mock LLM](phases/phase-03-provider-mock-llm.md)
- [Phase 4: MCP Server 第一版](phases/phase-04-mcp-server-v1.md)
- [Phase 5: Web UI 壳与内容系统](phases/phase-05-web-ui-content-system.md)
- [Phase 6: Web UI 生词库 CRUD](phases/phase-06-web-ui-learning-items-crud.md)
- [Phase 7: 用户母语私有化内容](phases/phase-07-native-language-personalized-content.md)
- [Phase 8: Daily Check-in Calendar](phases/phase-08-daily-check-in-calendar.md)
- [Phase 9: Gateway 抽象与 Telegram Adapter](phases/phase-09-gateway-telegram-adapter.md)
- [Phase 10: 训练与记忆复用](phases/phase-10-training-memory-reuse.md)
- [Phase 11: Legacy Python 处理](phases/phase-11-legacy-python-handling.md)

## 工作节奏

每个 phase 独立完成：

1. 开始前写本 phase 的小 design intent。
2. 实施一个功能或事件。
3. 跑对应测试。
4. 给出本地使用方式。
5. 用户或 agent 真实试用。
6. 根据反馈修正。
7. 再进入下一 phase。

默认不跨 phase 做“顺手重构”，除非当前 phase 无法验证。
