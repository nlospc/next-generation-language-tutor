import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createLearningItem,
  getCheckinCalendar,
  getDailyStatus,
  markTrainingCompleted,
  migrate,
  openDb,
  setSrsDueDate,
} from "../scripts/db-cli.mjs";
import { callTool } from "../scripts/mcp-server.mjs";
import { startWebServer } from "../scripts/web-server.mjs";

function withTempDb(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-daily-"));
  const dbPath = path.join(dir, "daily.db");
  const db = openDb(dbPath);
  try {
    migrate(db);
    return run({ db, dbPath, dir });
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("daily status includes due reviews, items added, training, and completion", () => {
  withTempDb(({ db }) => {
    const date = new Date().toISOString().slice(0, 10);
    const itemId = createLearningItem(db, "apple", "a fruit", "daily");
    assert.equal(setSrsDueDate(db, itemId, date), true);

    const initial = getDailyStatus(db, date);
    assert.equal(initial.items_added, 1);
    assert.equal(initial.due_reviews, 1);
    assert.equal(initial.completed, true);

    const updated = markTrainingCompleted(db, date);
    assert.equal(updated.training_completed, 1);
    assert.equal(updated.status, "completed");
  });
});

test("calendar calculates streak from completed days", () => {
  withTempDb(({ db }) => {
    markTrainingCompleted(db, "2026-05-10");
    markTrainingCompleted(db, "2026-05-11");
    markTrainingCompleted(db, "2026-05-12");

    const calendar = getCheckinCalendar(db, "2026-05", "2026-05-12");
    assert.equal(calendar.streak, 3);
    assert.equal(calendar.days.length, 31);
    assert.equal(calendar.days.find((day) => day.checkin_date === "2026-05-12").completed, true);
  });
});

test("web calendar API and MCP daily status read the same data", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-daily-web-"));
  const dbPath = path.join(dir, "daily-web.db");
  const prev = process.env.NGLT_DB_PATH;
  process.env.NGLT_DB_PATH = dbPath;
  const server = startWebServer(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const date = "2026-05-12";
    const done = await fetch(`${base}/api/daily-status/training-completed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date }),
    }).then((r) => r.json());
    assert.equal(done.ok, true);
    assert.equal(done.daily_status.training_completed, 1);

    const calendarPage = await fetch(`${base}/calendar`);
    const calendarHtml = await calendarPage.text();
    assert.equal(calendarPage.status, 200);
    assert.equal(calendarHtml.includes("Daily Check-in Calendar"), true);

    const calendar = await fetch(`${base}/api/check-in-calendar?month=2026-05&today=${date}`).then((r) => r.json());
    assert.equal(calendar.ok, true);
    assert.equal(calendar.streak, 1);

    const mcpStatus = callTool("get_daily_status", { date }, dbPath);
    assert.equal(mcpStatus.ok, true);
    assert.equal(mcpStatus.daily_status.training_completed, 1);
    assert.equal(mcpStatus.daily_status.completed, true);
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
