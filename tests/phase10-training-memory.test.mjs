import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createGatewayServices, TelegramAdapter } from "../scripts/gateway-service.mjs";
import { callTool } from "../scripts/mcp-server.mjs";
import { createLearningItem, getDailyStatus, migrate, openDb } from "../scripts/db-cli.mjs";
import { generateTrainingSession, retrieveRelevantLearningItems } from "../scripts/training-service.mjs";
import { startWebServer } from "../scripts/web-server.mjs";

function withTempDb(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-training-"));
  const dbPath = path.join(dir, "training.db");
  const db = openDb(dbPath);
  try {
    migrate(db);
    return run({ db, dbPath, dir });
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("training service retrieves relevant memory and generates review, quiz, story, and conversation prompts", () => {
  withTempDb(({ db }) => {
    createLearningItem(db, "apple", "a fruit", "food");
    createLearningItem(db, "take it easy", "relax", "phrase");

    const relevant = retrieveRelevantLearningItems(db, "easy", 5);
    assert.equal(relevant.length, 1);
    assert.equal(relevant[0].term, "take it easy");

    for (const mode of ["review", "quiz", "story", "dialogue", "conversation"]) {
      const session = generateTrainingSession(db, { mode, query: "easy" });
      assert.equal(session.ok, true);
      assert.equal(session.mode, mode);
      assert.equal(session.prompt.includes("take it easy"), true);
      assert.equal(session.tasks.length > 0, true);
    }
  });
});

test("MCP generate_training_session uses saved learning items", () => {
  withTempDb(({ dbPath }) => {
    callTool("add_learning_item", { term: "book", meaning: "a thing to read" }, dbPath);
    const session = callTool("generate_training_session", { mode: "quiz", query: "book" }, dbPath);
    assert.equal(session.ok, true);
    assert.equal(session.mode, "quiz");
    assert.equal(session.items[0].term, "book");
    assert.equal(session.tasks[0].question.includes("book"), true);
  });
});

test("Telegram /study returns memory-driven training instead of a static first item prompt", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-training-gateway-"));
  const dbPath = path.join(dir, "gateway.db");
  try {
    const adapter = new TelegramAdapter(createGatewayServices(dbPath));
    await adapter.handleMessage({ text: "/add apple | a fruit" });
    await adapter.handleMessage({ text: "/add book | a thing to read" });

    const response = await adapter.handleMessage({ text: "/study book" });
    assert.equal(response.text.includes("Memory used: book"), true);
    assert.equal(response.text.includes("apple"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Web training API returns memory session and marks training complete", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-training-web-"));
  const dbPath = path.join(dir, "training-web.db");
  const prev = process.env.NGLT_DB_PATH;
  process.env.NGLT_DB_PATH = dbPath;
  const server = startWebServer(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const db = openDb(dbPath);
    try {
      migrate(db);
      createLearningItem(db, "calendar", "a date view", "web");
    } finally {
      db.close();
    }

    const page = await fetch(`${base}/training`);
    assert.equal(page.status, 200);
    assert.equal((await page.text()).includes("Memory Training"), true);

    const session = await fetch(`${base}/api/training-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "story", query: "calendar", date: "2026-05-12" }),
    }).then((r) => r.json());
    assert.equal(session.ok, true);
    assert.equal(session.items[0].term, "calendar");
    assert.equal(session.prompt.includes("calendar"), true);

    const verifyDb = openDb(dbPath);
    try {
      migrate(verifyDb);
      assert.equal(getDailyStatus(verifyDb, "2026-05-12").training_completed, 1);
    } finally {
      verifyDb.close();
    }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    if (prev == null) {
      delete process.env.NGLT_DB_PATH;
    } else {
      process.env.NGLT_DB_PATH = prev;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
