#!/usr/bin/env node

const ENRICHMENT_SCHEMA = {
  type: "object",
  required: ["meaning", "usage", "example", "scenario", "instant_summary"],
  properties: {
    meaning: { type: "string", minLength: 1 },
    usage: { type: "string", minLength: 1 },
    example: { type: "string", minLength: 1 },
    scenario: { type: "string", minLength: 1 },
    instant_summary: { type: "string", minLength: 1, maxLength: 200 },
  },
};

export function buildPromptContract(input) {
  return {
    task: "learning_item_enrichment",
    item_type: input.itemType,
    source_text: input.text,
    native_language: input.nativeLanguage ?? "zh-CN",
    output_schema: ENRICHMENT_SCHEMA,
  };
}

export function validateAgainstSchema(schema, value) {
  if (schema.type !== "object" || typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, reason: "value_must_be_object" };
  }
  for (const key of schema.required ?? []) {
    if (!(key in value)) {
      return { ok: false, reason: `missing_required:${key}` };
    }
  }
  for (const [key, rule] of Object.entries(schema.properties ?? {})) {
    const cell = value[key];
    if (typeof cell !== "string") {
      return { ok: false, reason: `field_not_string:${key}` };
    }
    if (typeof rule.minLength === "number" && cell.length < rule.minLength) {
      return { ok: false, reason: `field_too_short:${key}` };
    }
    if (typeof rule.maxLength === "number" && cell.length > rule.maxLength) {
      return { ok: false, reason: `field_too_long:${key}` };
    }
  }
  return { ok: true };
}

function typeLabel(itemType) {
  if (itemType === "word") {
    return "word";
  }
  if (itemType === "phrase") {
    return "phrase";
  }
  return "sentence";
}

export class MockLlmProvider {
  constructor(seed = "phase3-mock-seed") {
    this.seed = seed;
  }

  async enrich(contract) {
    const kind = typeLabel(contract.item_type);
    const text = contract.source_text.trim();
    const short = text.length > 40 ? `${text.slice(0, 40)}...` : text;
    return {
      meaning: `[mock:${kind}] ${text}`,
      usage: `Use this ${kind} in short daily practice and spaced repetition.`,
      example: `Example: I learned "${text}" in context today.`,
      scenario: `Scenario: A learner reviews the ${kind} "${short}" during evening study.`,
      instant_summary: `Learn ${kind} "${short}" with one meaning, one example, and one scenario today.`,
    };
  }

  async rewriteToNativeLanguage(contract) {
    const language = contract.native_language ?? "zh-CN";
    const title = contract.title ?? "content";
    const body = contract.source_text ?? "";
    return `# ${title} (${language})

[mock rewrite:${language}]
${body}`;
  }
}

export class OpenAiCompatibleProvider {
  constructor(options) {
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = options.model ?? "gpt-4o-mini";
  }

  async enrich(contract) {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAiCompatibleProvider.");
    }
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a language tutor assistant. Return only JSON that follows the requested schema.",
          },
          {
            role: "user",
            content: JSON.stringify(contract),
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI-compatible request failed: ${response.status}`);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Model response content is missing.");
    }
    return JSON.parse(content);
  }

  async rewriteToNativeLanguage(contract) {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAiCompatibleProvider.");
    }
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the provided learning guide into the target native language. Keep markdown structure.",
          },
          {
            role: "user",
            content: JSON.stringify(contract),
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI-compatible request failed: ${response.status}`);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Model response content is missing.");
    }
    return content;
  }
}

export class LearningItemEnrichmentService {
  constructor(provider) {
    this.provider = provider;
  }

  async enrich(input) {
    const contract = buildPromptContract(input);
    const output = await this.provider.enrich(contract);
    const validation = validateAgainstSchema(ENRICHMENT_SCHEMA, output);
    if (!validation.ok) {
      throw new Error(`Invalid enrichment output: ${validation.reason}`);
    }
    return output;
  }
}
