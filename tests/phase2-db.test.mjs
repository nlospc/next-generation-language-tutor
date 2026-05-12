import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  createLearningItem,
  deleteLearningItem,
  getUserConfig,
  listLearningItems,
  migrate,
  setUserConfig,
  updateLearningItem,
} from "../scripts/db-cli.mjs";

function withTempDb(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-db-"));
  const dbPath = path.join(dir, "test.db");
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  try {
    run(db);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("migration is idempotent", () => {
  withTempDb((db) => {
    migrate(db);
    migrate(db);

    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all();
    const names = new Set(rows.map((row) => row.name));
    assert.equal(names.has("user_config"), true);
    assert.equal(names.has("learning_items"), true);
    assert.equal(names.has("srs_cards"), true);
    assert.equal(names.has("daily_checkins"), true);
  });
});

test("user config create and read", () => {
  withTempDb((db) => {
    migrate(db);
    setUserConfig(db, "native_language", "en");
    const item = getUserConfig(db, "native_language");
    assert.notEqual(item, null);
    assert.equal(item.value, "en");
  });
});

test("learning item CRUD", () => {
  withTempDb((db) => {
    migrate(db);
    const itemId = createLearningItem(db, "apple", "a fruit", "fruit");

    const rows1 = listLearningItems(db);
    assert.equal(rows1.length, 1);
    assert.equal(rows1[0].id, itemId);

    const okUpdate = updateLearningItem(db, itemId, "apple", "a common fruit", "fruit updated");
    assert.equal(okUpdate, true);
    const rows2 = listLearningItems(db);
    assert.equal(rows2[0].meaning, "a common fruit");

    const okDelete = deleteLearningItem(db, itemId);
    assert.equal(okDelete, true);
    assert.deepEqual(listLearningItems(db), []);
  });
});
