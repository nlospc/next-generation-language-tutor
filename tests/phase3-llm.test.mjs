import test from "node:test";
import assert from "node:assert/strict";
import {
  LearningItemEnrichmentService,
  MockLlmProvider,
  OpenAiCompatibleProvider,
  buildPromptContract,
  validateAgainstSchema,
} from "../scripts/llm-service.mjs";

test("mock provider enriches a word", async () => {
  const service = new LearningItemEnrichmentService(new MockLlmProvider());
  const out = await service.enrich({ itemType: "word", text: "apple", nativeLanguage: "zh-CN" });
  assert.equal(typeof out.meaning, "string");
  assert.equal(typeof out.usage, "string");
  assert.equal(typeof out.example, "string");
  assert.equal(typeof out.scenario, "string");
  assert.equal(out.instant_summary.length <= 200, true);
});

test("mock provider enriches a phrase", async () => {
  const service = new LearningItemEnrichmentService(new MockLlmProvider());
  const out = await service.enrich({
    itemType: "phrase",
    text: "take it easy",
    nativeLanguage: "zh-CN",
  });
  assert.equal(out.instant_summary.length <= 200, true);
});

test("mock provider enriches a sentence", async () => {
  const service = new LearningItemEnrichmentService(new MockLlmProvider());
  const out = await service.enrich({
    itemType: "sentence",
    text: "I will review this sentence tonight.",
    nativeLanguage: "zh-CN",
  });
  assert.equal(out.instant_summary.length <= 200, true);
});

test("prompt contract includes schema", () => {
  const contract = buildPromptContract({
    itemType: "word",
    text: "apple",
    nativeLanguage: "zh-CN",
  });
  assert.equal(contract.task, "learning_item_enrichment");
  assert.equal(contract.output_schema.required.includes("meaning"), true);
});

test("schema validator rejects too-long summary", () => {
  const value = {
    meaning: "m",
    usage: "u",
    example: "e",
    scenario: "s",
    instant_summary: "x".repeat(201),
  };
  const result = validateAgainstSchema(buildPromptContract({ itemType: "word", text: "x" }).output_schema, value);
  assert.equal(result.ok, false);
});

test("openai-compatible provider requires api key", async () => {
  const provider = new OpenAiCompatibleProvider({ apiKey: "" });
  await assert.rejects(
    () => provider.enrich(buildPromptContract({ itemType: "word", text: "apple" })),
    /OPENAI_API_KEY/
  );
});

