#!/usr/bin/env node
import { runCli as runDbCli } from "../scripts/db-cli.mjs";
import { runLlmCli } from "../scripts/llm-cli.mjs";
import { runMcpServer } from "../scripts/mcp-server.mjs";
import { startWebServer } from "../scripts/web-server.mjs";
import { runGatewayCli } from "../scripts/gateway-service.mjs";
import { defaultDbPath } from "../scripts/db-cli.mjs";
import { generateTrainingSessionForDbPath } from "../scripts/training-service.mjs";

const commands = {
  install: {
    summary: "Prepare local runtime directories and configuration placeholders.",
    action: () => {
      printPlaceholder("install", "Phase 1 only defines the command boundary. Local setup behavior starts in later slices.");
    },
  },
  migrate: {
    summary: "Run local database migrations.",
    action: () => runNodeDbCommand(["migrate"]),
  },
  db: {
    summary: "Run database CRUD commands.",
    action: () => runNodeDbCommand(process.argv.slice(3)),
  },
  llm: {
    summary: "Run LLM enrichment commands.",
    action: async () => {
      process.exitCode = await runLlmCli(process.argv.slice(3));
    },
  },
  "serve:mcp": {
    summary: "Start the local MCP server.",
    action: () => {
      runMcpServer();
    },
  },
  "serve:web": {
    summary: "Start the local private Web UI.",
    action: () => {
      const portArg = Number(process.argv[3] ?? "4173");
      const port = Number.isInteger(portArg) && portArg > 0 ? portArg : 4173;
      startWebServer(port, "127.0.0.1");
    },
  },
  gateway: {
    summary: "Run local gateway adapter commands.",
    action: async () => {
      process.exitCode = await runGatewayCli(process.argv.slice(3));
    },
  },
  training: {
    summary: "Generate memory-driven review, quiz, story, dialogue, or conversation practice.",
    action: () => {
      const args = process.argv.slice(3);
      const session = generateTrainingSessionForDbPath(defaultDbPath, {
        mode: readOption(args, "--mode") ?? args[0] ?? "review",
        query: readOption(args, "--query") ?? "",
        limit: Number(readOption(args, "--limit") ?? 5),
      });
      console.log(JSON.stringify(session, null, 2));
    },
  },
};

const command = process.argv[2];

if (!command || command === "--help" || command === "-h" || command === "help") {
  printHelp();
} else if (Object.hasOwn(commands, command)) {
  await commands[command].action();
} else {
  console.error(`Unknown command: ${command}`);
  console.error("Run `agent-language-tutor --help` for available commands.");
  process.exitCode = 1;
}

function printHelp() {
  console.log(`Agent Language Tutor

Usage:
  agent-language-tutor <command> [args]

Commands:
${formatCommands()}

Current status:
  Node SQLite database migration and CRUD are available.
  LLM enrichment, MCP server tools, local Web UI, daily status, and gateway simulation are available.
  Memory-driven training sessions are available.
  Legacy Python MVP material is reference-only and is not part of the active runtime.`);
}

function formatCommands() {
  return Object.entries(commands)
    .map(([name, definition]) => `  ${name.padEnd(10)} ${definition.summary}`)
    .join("\n");
}

function printPlaceholder(commandName, detail) {
  console.log(`agent-language-tutor ${commandName}`);
  console.log(detail);
}

function runNodeDbCommand(args) {
  process.exitCode = runDbCli(args);
}

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    return null;
  }
  return args[index + 1];
}
