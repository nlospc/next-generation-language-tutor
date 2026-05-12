export type LearningItemType = "word" | "phrase" | "sentence";

export interface EnrichmentInput {
  itemType: LearningItemType;
  text: string;
  nativeLanguage?: string;
}

export interface EnrichmentOutput {
  meaning: string;
  usage: string;
  example: string;
  scenario: string;
  instant_summary: string;
}

export interface LLMProvider {
  enrich(input: EnrichmentInput): Promise<EnrichmentOutput>;
}

export const llmModuleStatus =
  "Phase 7 extends scripts/llm-service.mjs with native-language rewrite support for personalized user content.";
