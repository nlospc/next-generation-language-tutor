# Phase 3: Provider 抽象与 Mock LLM

## 目标

规定模型要做什么，而不是绑定模型是谁。

## 交付

- `LLMProvider` interface
- mock provider
- OpenAI-compatible provider
- prompt contract + JSON schema validation
- learning item enrichment service

## 验证

- mock provider 下可 enrichment 一个单词、词组、句子。
- 输出包含 meaning、usage、example、scenario。
- 用户即时摘要少于 200 字。
- 不接入 gateway。
