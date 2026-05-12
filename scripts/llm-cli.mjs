#!/usr/bin/env node
import { LearningItemEnrichmentService, MockLlmProvider } from "./llm-service.mjs";

export async function runLlmCli(argv) {
  const [command, ...rest] = argv;
  if (command !== "enrich") {
    console.error("Usage: enrich --type <word|phrase|sentence> --text <content> [--native-language <code>]");
    return 1;
  }
  const itemType = readOption(rest, "--type") ?? "word";
  const text = readOption(rest, "--text");
  const nativeLanguage = readOption(rest, "--native-language") ?? "zh-CN";
  if (!text) {
    console.error("Missing --text option.");
    return 1;
  }
  if (!["word", "phrase", "sentence"].includes(itemType)) {
    console.error("Invalid --type value. Use word, phrase, or sentence.");
    return 1;
  }
  const service = new LearningItemEnrichmentService(new MockLlmProvider());
  const data = await service.enrich({ itemType, text, nativeLanguage });
  console.log(JSON.stringify(data));
  return 0;
}

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    return null;
  }
  return args[index + 1];
}

if (process.argv[1] && process.argv[1].endsWith("llm-cli.mjs")) {
  runLlmCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

