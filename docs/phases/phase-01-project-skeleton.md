# Phase 1: 新项目骨架

## 目标

建立新的 TypeScript/Node 项目骨架，不实现业务复杂度。

## 交付

- `package.json`
- `tsconfig.json`
- 基础目录：
  - `src/core`
  - `src/db`
  - `src/llm`
  - `src/mcp`
  - `src/web`
  - `src/gateways`
  - `content/`
  - `docs/`
- CLI 占位命令：
  - `install`
  - `migrate`
  - `serve:mcp`
  - `serve:web`
- `Installation Guide for AI Agents.md`

## 验证

- fresh install 后能运行 CLI help。
- agent 能按安装文档完成本地启动骨架。
- 不接入 Telegram，不接入真实 LLM。
