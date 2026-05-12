import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createGatewayServices, TelegramAdapter } from "../scripts/gateway-service.mjs";
import { callTool } from "../scripts/mcp-server.mjs";

function makeTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-gateway-"));
  return { dir, dbPath: path.join(dir, "gateway.db") };
}

test("telegram adapter routes commands through injected services", async () => {
  const calls = [];
  const adapter = new TelegramAdapter({
    initializeUser(settings) {
      calls.push(["initializeUser", settings]);
      return { ok: true, native_language: "zh-CN", target_language: "en", timezone: "UTC" };
    },
    addLearningItem(input) {
      calls.push(["addLearningItem", input]);
      return { ok: true, id: 7 };
    },
    listLearningItems() {
      calls.push(["listLearningItems"]);
      return { ok: true, items: [{ id: 7, term: "apple", meaning: "a fruit" }] };
    },
    generateTrainingSession(input) {
      calls.push(["generateTrainingSession", input]);
      return {
        ok: true,
        mode: "review",
        items: [{ id: 7, term: "apple", meaning: "a fruit" }],
        prompt: "Review apple.",
        tasks: [{ instruction: "Make one sentence with apple." }],
      };
    },
    getDailyStatus(date) {
      calls.push(["getDailyStatus", date]);
      return {
        ok: true,
        streak: 2,
        daily_status: { completed: false, due_reviews: 1, items_added: 0, training_completed: 0 },
      };
    },
  });

  assert.equal((await adapter.handleMessage({ text: "/start" })).text.includes("Language tutor is ready"), true);
  assert.equal((await adapter.handleMessage({ text: "/add apple | a fruit | demo" })).text, "Added #7: apple");
  assert.equal((await adapter.handleMessage({ text: "/list" })).text.includes("#7 apple"), true);
  assert.equal((await adapter.handleMessage({ text: "/study" })).text.includes("Memory used: apple"), true);
  assert.equal((await adapter.handleMessage({ text: "/status" })).text.includes("Streak: 2"), true);
  assert.equal((await adapter.dailyReminder("2026-05-12")).text.includes("streak 2"), true);

  assert.deepEqual(calls.map((call) => call[0]), [
    "initializeUser",
    "addLearningItem",
    "listLearningItems",
    "generateTrainingSession",
    "getDailyStatus",
    "getDailyStatus",
  ]);
});

test("telegram /add matches MCP add_learning_item on the same database", async () => {
  const { dir, dbPath } = makeTempDbPath();
  try {
    const services = createGatewayServices(dbPath);
    const adapter = new TelegramAdapter(services);
    const response = await adapter.handleMessage({ text: "/add banana | yellow fruit | gateway" });
    assert.equal(response.text, "Added #1: banana");

    const list = callTool("list_learning_items", {}, dbPath);
    assert.equal(list.ok, true);
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].term, "banana");
    assert.equal(list.items[0].meaning, "yellow fruit");
    assert.equal(list.items[0].notes, "gateway");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("telegram daily reminder includes streak and smallest next action", async () => {
  const { dir, dbPath } = makeTempDbPath();
  try {
    const services = createGatewayServices(dbPath);
    const adapter = new TelegramAdapter(services);
    await adapter.handleMessage({ text: "/add review | practice again" });

    const reminder = await adapter.dailyReminder(new Date().toISOString().slice(0, 10));
    assert.equal(reminder.text.includes("streak"), true);
    assert.equal(reminder.text.includes("Add one useful word") || reminder.text.includes("Review one due item"), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
