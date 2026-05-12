#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLearningItem,
  defaultDbPath,
  getCheckinCalendar,
  getDailyStatus,
  listLearningItems,
  migrate,
  openDb,
  setUserConfig,
} from "./db-cli.mjs";
import { generateTrainingSession } from "./training-service.mjs";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function createGatewayServices(dbPath = defaultDbPath) {
  return {
    initializeUser(settings = {}) {
      return withDb(dbPath, (db) => {
        const nativeLanguage = settings.native_language ?? "zh-CN";
        const targetLanguage = settings.target_language ?? "en";
        const timezone = settings.timezone ?? "UTC";
        setUserConfig(db, "native_language", nativeLanguage);
        setUserConfig(db, "target_language", targetLanguage);
        setUserConfig(db, "timezone", timezone);
        return { ok: true, native_language: nativeLanguage, target_language: targetLanguage, timezone };
      });
    },
    addLearningItem(input) {
      return withDb(dbPath, (db) => {
        const id = createLearningItem(db, input.term, input.meaning, input.notes ?? "");
        return { ok: true, id };
      });
    },
    listLearningItems() {
      return withDb(dbPath, (db) => ({ ok: true, items: listLearningItems(db) }));
    },
    getDailyStatus(date = todayIsoDate()) {
      return withDb(dbPath, (db) => {
        const dailyStatus = getDailyStatus(db, date);
        const calendar = getCheckinCalendar(db, date.slice(0, 7), date);
        return { ok: true, daily_status: dailyStatus, streak: calendar.streak };
      });
    },
    generateTrainingSession(input = {}) {
      return withDb(dbPath, (db) => generateTrainingSession(db, input));
    },
  };
}

export class TelegramAdapter {
  constructor(services) {
    this.services = services;
    this.name = "telegram";
  }

  async handleMessage(message) {
    const text = String(message?.text ?? "").trim();
    if (!text) {
      return this.reply("Send /start, /add, /list, /study, or /status.");
    }
    const [command] = text.split(/\s+/, 1);
    if (command === "/start") {
      const result = await this.services.initializeUser({});
      return this.reply(
        `Language tutor is ready. Native language: ${result.native_language}. Target language: ${result.target_language}.`
      );
    }
    if (command === "/add") {
      const parsed = parseAddCommand(text);
      if (!parsed) {
        return this.reply("Usage: /add term | meaning | optional notes");
      }
      const result = await this.services.addLearningItem(parsed);
      return this.reply(`Added #${result.id}: ${parsed.term}`);
    }
    if (command === "/list") {
      const result = await this.services.listLearningItems();
      if (result.items.length === 0) {
        return this.reply("No learning items yet. Add one with /add term | meaning.");
      }
      return this.reply(result.items.slice(0, 10).map((item) => `#${item.id} ${item.term}: ${item.meaning}`).join("\n"));
    }
    if (command === "/study") {
      const result = await this.services.generateTrainingSession({ mode: "review", query: text.replace(/^\/study\s*/, "") });
      if (result.items.length === 0) {
        return this.reply("Add one learning item first, then use /study.");
      }
      return this.reply(formatTrainingSession(result));
    }
    if (command === "/status") {
      return this.reply(formatDailyStatus(await this.services.getDailyStatus(todayIsoDate())));
    }
    return this.reply("Unknown command. Use /start, /add, /list, /study, or /status.");
  }

  async dailyReminder(date = todayIsoDate()) {
    const result = await this.services.getDailyStatus(date);
    const status = result.daily_status;
    const action = status.due_reviews > 0 ? "Review one due item." : "Add one useful word or complete one short practice.";
    return this.reply(`Daily reminder: streak ${result.streak} day(s). ${action}`);
  }

  reply(text) {
    return { gateway: this.name, text };
  }
}

export function createTelegramAdapter(dbPath = defaultDbPath) {
  return new TelegramAdapter(createGatewayServices(dbPath));
}

export async function runGatewayCli(argv) {
  const [gateway, ...rest] = argv;
  if (gateway !== "telegram") {
    console.error("Usage: gateway telegram <message text> | gateway telegram reminder [date]");
    return 1;
  }
  const adapter = createTelegramAdapter();
  if (rest[0] === "reminder") {
    const response = await adapter.dailyReminder(rest[1] ?? todayIsoDate());
    console.log(response.text);
    return 0;
  }
  const response = await adapter.handleMessage({ text: rest.join(" ") });
  console.log(response.text);
  return 0;
}

function withDb(dbPath, run) {
  const db = openDb(path.resolve(dbPath));
  try {
    migrate(db);
    return run(db);
  } finally {
    db.close();
  }
}

function parseAddCommand(text) {
  const body = text.replace(/^\/add\s*/, "").trim();
  const parts = body.split("|").map((part) => part.trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }
  return { term: parts[0], meaning: parts[1], notes: parts[2] ?? "" };
}

function formatDailyStatus(result) {
  const status = result.daily_status;
  const completed = status.completed ? "complete" : "pending";
  return [
    `Status: ${completed}`,
    `Streak: ${result.streak} day(s)`,
    `Due reviews: ${status.due_reviews}`,
    `Items added today: ${status.items_added}`,
    `Training completed: ${status.training_completed}`,
  ].join("\n");
}

function formatTrainingSession(session) {
  return [
    `Study mode: ${session.mode}`,
    `Memory used: ${session.items.map((item) => item.term).join(", ")}`,
    session.prompt,
    ...session.tasks.slice(0, 3).map((task, index) => `${index + 1}. ${task.instruction ?? task.question}`),
  ].join("\n");
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.exitCode = await runGatewayCli(process.argv.slice(2));
}
