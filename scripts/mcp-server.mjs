#!/usr/bin/env node
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  createLearningItem,
  defaultDbPath,
  deleteLearningItem,
  getDailyStatus,
  listLearningItems,
  migrate,
  openDb,
  searchLearningItems,
  setUserConfig,
  updateLearningItem,
} from "./db-cli.mjs";
import { generateTrainingSession } from "./training-service.mjs";

export function listTools() {
  return [
    {
      name: "initialize_user",
      description: "Initialize user settings.",
      inputSchema: {
        type: "object",
        properties: {
          native_language: { type: "string", description: "User native language, e.g. zh-CN." },
          target_language: { type: "string", description: "Learning target language, e.g. en." },
          timezone: { type: "string", description: "IANA timezone, e.g. UTC or Asia/Shanghai." },
        },
        additionalProperties: false,
      },
    },
    {
      name: "add_learning_item",
      description: "Add a learning item.",
      inputSchema: {
        type: "object",
        properties: {
          term: { type: "string", description: "Word or phrase to learn." },
          meaning: { type: "string", description: "Meaning/definition (can be in the user's native language)." },
          notes: { type: "string", description: "Optional notes, examples, collocations, or tags." },
        },
        required: ["term", "meaning"],
        additionalProperties: false,
      },
    },
    {
      name: "list_learning_items",
      description: "List all learning items.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "search_learning_items",
      description: "Search learning items by keyword.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword in term/meaning/notes." },
          limit: { type: "integer", description: "Max items returned. Default 20." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "update_learning_item",
      description: "Update one learning item.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Learning item id." },
          term: { type: "string", description: "Updated term." },
          meaning: { type: "string", description: "Updated meaning." },
          notes: { type: "string", description: "Updated notes." },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: "delete_learning_item",
      description: "Delete one learning item.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Learning item id." },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: "get_daily_status",
      description: "Get daily check-in status.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date (YYYY-MM-DD). Defaults to today." },
        },
        additionalProperties: false,
      },
    },
    {
      name: "generate_training_session",
      description: "Generate review, quiz, story, dialogue, or conversation practice from saved learning items.",
      inputSchema: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["review", "quiz", "story", "dialogue", "conversation"],
            description: "Training mode.",
          },
          query: { type: "string", description: "Optional retrieval query." },
          limit: { type: "integer", description: "Max candidate items, default 5." },
          date: { type: "string", description: "ISO date (YYYY-MM-DD). Defaults to today." },
        },
        additionalProperties: false,
      },
    },
  ];
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function callTool(name, args = {}, dbPath = defaultDbPath) {
  const db = openDb(path.resolve(dbPath));
  try {
    migrate(db);
    if (name === "initialize_user") {
      const nativeLanguage = args.native_language ?? "zh-CN";
      const targetLanguage = args.target_language ?? "en";
      const timezone = args.timezone ?? "UTC";
      setUserConfig(db, "native_language", nativeLanguage);
      setUserConfig(db, "target_language", targetLanguage);
      setUserConfig(db, "timezone", timezone);
      return { ok: true, native_language: nativeLanguage, target_language: targetLanguage, timezone };
    }
    if (name === "add_learning_item") {
      if (!args.term || !args.meaning) {
        throw new Error("term and meaning are required.");
      }
      const id = createLearningItem(db, args.term, args.meaning, args.notes ?? "");
      return { ok: true, id };
    }
    if (name === "list_learning_items") {
      return { ok: true, items: listLearningItems(db) };
    }
    if (name === "search_learning_items") {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return { ok: true, items: [] };
      }
      const limit = Number.isInteger(args.limit) ? args.limit : 20;
      return { ok: true, items: searchLearningItems(db, query, limit) };
    }
    if (name === "update_learning_item") {
      const id = Number(args.id);
      if (!Number.isInteger(id)) {
        throw new Error("id must be an integer.");
      }
      const ok = updateLearningItem(db, id, args.term ?? null, args.meaning ?? null, args.notes ?? null);
      if (!ok) {
        return { ok: false, error: "not_found" };
      }
      return { ok: true, id };
    }
    if (name === "delete_learning_item") {
      const id = Number(args.id);
      if (!Number.isInteger(id)) {
        throw new Error("id must be an integer.");
      }
      const ok = deleteLearningItem(db, id);
      if (!ok) {
        return { ok: false, error: "not_found" };
      }
      return { ok: true, id };
    }
    if (name === "get_daily_status") {
      const date = args.date ?? todayIsoDate();
      return { ok: true, daily_status: getDailyStatus(db, date) };
    }
    if (name === "generate_training_session") {
      return generateTrainingSession(db, {
        mode: args.mode ?? "review",
        query: args.query ?? "",
        limit: args.limit ?? 5,
        date: args.date ?? todayIsoDate(),
      });
    }
    throw new Error(`Unknown tool: ${name}`);
  } finally {
    db.close();
  }
}

export function handleRpcMessage(message, dbPath = defaultDbPath) {
  const id = "id" in message ? message.id : null;
  try {
    if (message.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: { name: "agent-language-tutor-mcp", version: "0.1.0" },
          capabilities: { tools: {} },
        },
      };
    }
    if (message.method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: listTools() } };
    }
    if (message.method === "tools/call") {
      const toolName = message.params?.name;
      const args = message.params?.arguments ?? {};
      const data = callTool(toolName, args, dbPath);
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }] } };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
  } catch (error) {
    return { jsonrpc: "2.0", id, error: { code: -32000, message: error.message } };
  }
}

export function runMcpServer(dbPath = defaultDbPath) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) {
      return;
    }
    try {
      const request = JSON.parse(text);
      const response = handleRpcMessage(request, dbPath);
      process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (error) {
      const response = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: `Parse error: ${error.message}` },
      };
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  });
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runMcpServer();
}
