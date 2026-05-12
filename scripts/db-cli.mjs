#!/usr/bin/env node
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
export const defaultDbPath = path.resolve(rootDir, "data", "tutor.db");

function utcNowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return utcNowIso().slice(0, 10);
}

export function openDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learning_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL,
      meaning TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS srs_cards (
      item_id INTEGER PRIMARY KEY,
      ease REAL NOT NULL DEFAULT 2.5,
      interval_days INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES learning_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_checkins (
      checkin_date TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT NOT NULL DEFAULT '',
      training_completed_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  ensureColumn(db, "daily_checkins", "training_completed_count", "INTEGER NOT NULL DEFAULT 0");
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((row) => row.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function setUserConfig(db, key, value) {
  const now = utcNowIso();
  db.prepare(`
    INSERT INTO user_config(key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, now);
}

export function getUserConfig(db, key) {
  const row = db
    .prepare("SELECT key, value, updated_at FROM user_config WHERE key = ?")
    .get(key);
  return row ?? null;
}

export function createLearningItem(db, term, meaning, notes) {
  const now = utcNowIso();
  const tx = db.transaction(() => {
    const result = db
      .prepare(`
        INSERT INTO learning_items(term, meaning, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(term, meaning, notes, now, now);
    const itemId = Number(result.lastInsertRowid);
    db.prepare("INSERT INTO srs_cards(item_id, updated_at) VALUES (?, ?)").run(itemId, now);
    return itemId;
  });
  return tx();
}

export function setSrsDueDate(db, itemId, dueDate) {
  const result = db
    .prepare("UPDATE srs_cards SET due_date = ?, updated_at = ? WHERE item_id = ?")
    .run(dueDate, utcNowIso(), itemId);
  return result.changes > 0;
}

export function listLearningItems(db) {
  return db
    .prepare(`
      SELECT id, term, meaning, notes, created_at, updated_at
      FROM learning_items
      ORDER BY id ASC
    `)
    .all();
}

export function searchLearningItems(db, query, limit = 20) {
  const normalized = `%${query}%`;
  return db
    .prepare(
      `
      SELECT id, term, meaning, notes, created_at, updated_at
      FROM learning_items
      WHERE term LIKE ? OR meaning LIKE ? OR notes LIKE ?
      ORDER BY id ASC
      LIMIT ?
    `
    )
    .all(normalized, normalized, normalized, limit);
}

export function updateLearningItem(db, id, term, meaning, notes) {
  const current = db
    .prepare("SELECT term, meaning, notes FROM learning_items WHERE id = ?")
    .get(id);
  if (!current) {
    return false;
  }
  db.prepare(`
    UPDATE learning_items
    SET term = ?, meaning = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    term ?? current.term,
    meaning ?? current.meaning,
    notes ?? current.notes,
    utcNowIso(),
    id
  );
  return true;
}

export function deleteLearningItem(db, id) {
  const result = db.prepare("DELETE FROM learning_items WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getDailyStatus(db, date) {
  const row = getDailyCheckin(db, date);
  return {
    checkin_date: date,
    status: row?.status ?? "pending",
    note: row?.note ?? "",
    created_at: row?.created_at ?? "",
    due_reviews: countDueReviews(db, date),
    items_added: countItemsAdded(db, date),
    training_completed: row?.training_completed_count ?? 0,
    completed: isDailyComplete(db, date, row),
  };
}

export function markTrainingCompleted(db, date = todayIsoDate(), count = 1) {
  const increment = Math.max(1, Number.isInteger(count) ? count : 1);
  const now = utcNowIso();
  db.prepare(`
    INSERT INTO daily_checkins(checkin_date, status, note, training_completed_count, created_at)
    VALUES (?, 'completed', '', ?, ?)
    ON CONFLICT(checkin_date) DO UPDATE SET
      status = 'completed',
      training_completed_count = daily_checkins.training_completed_count + excluded.training_completed_count
  `).run(date, increment, now);
  return getDailyStatus(db, date);
}

export function getCheckinCalendar(db, month, today = todayIsoDate()) {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const [year, monthIndex] = normalizedMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const days = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${normalizedMonth}-${String(day).padStart(2, "0")}`;
    days.push(getDailyStatus(db, date));
  }
  return {
    month: normalizedMonth,
    today,
    streak: calculateStreak(db, today),
    days,
  };
}

function getDailyCheckin(db, date) {
  const row = db
    .prepare(
      "SELECT checkin_date, status, note, training_completed_count, created_at FROM daily_checkins WHERE checkin_date = ?"
    )
    .get(date);
  return row ?? null;
}

function countItemsAdded(db, date) {
  return db
    .prepare("SELECT COUNT(*) AS count FROM learning_items WHERE substr(created_at, 1, 10) = ?")
    .get(date).count;
}

function countDueReviews(db, date) {
  return db
    .prepare("SELECT COUNT(*) AS count FROM srs_cards WHERE due_date IS NOT NULL AND due_date <= ?")
    .get(date).count;
}

function isDailyComplete(db, date, row = getDailyCheckin(db, date)) {
  return row?.status === "completed" || countItemsAdded(db, date) > 0 || (row?.training_completed_count ?? 0) > 0;
}

function calculateStreak(db, today) {
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00.000Z`);
  while (Number.isFinite(cursor.getTime())) {
    const date = cursor.toISOString().slice(0, 10);
    if (!isDailyComplete(db, date)) {
      break;
    }
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function parseArgs(argv) {
  let dbPath = defaultDbPath;
  const args = [...argv];
  if (args[0] === "--db-path") {
    dbPath = path.resolve(args[1]);
    args.splice(0, 2);
  }
  return { dbPath, args };
}

export function runCli(argv) {
  const { dbPath, args } = parseArgs(argv);
  const [command, ...rest] = args;
  const db = openDb(dbPath);
  try {
    if (command === "migrate") {
      migrate(db);
      console.log(`migrated: ${dbPath}`);
      return 0;
    }

    migrate(db);

    if (command === "user-config") {
      if (rest[0] === "set" && rest.length >= 3) {
        setUserConfig(db, rest[1], rest[2]);
        console.log(JSON.stringify({ ok: true, key: rest[1] }));
        return 0;
      }
      if (rest[0] === "get" && rest.length >= 2) {
        const item = getUserConfig(db, rest[1]);
        if (!item) {
          console.log(JSON.stringify({ ok: false, error: "not_found" }));
          return 1;
        }
        console.log(JSON.stringify(item));
        return 0;
      }
      console.error("Usage: user-config set <key> <value> | user-config get <key>");
      return 1;
    }

    if (command === "learning-item") {
      const sub = rest[0];
      if (sub === "list") {
        console.log(JSON.stringify(listLearningItems(db)));
        return 0;
      }
      if (sub === "add") {
        const term = readOption(rest, "--term");
        const meaning = readOption(rest, "--meaning");
        const notes = readOption(rest, "--notes") ?? "";
        if (!term || !meaning) {
          console.error("Usage: learning-item add --term <term> --meaning <meaning> [--notes <notes>]");
          return 1;
        }
        const id = createLearningItem(db, term, meaning, notes);
        console.log(JSON.stringify({ ok: true, id }));
        return 0;
      }
      if (sub === "update") {
        const id = Number(rest[1]);
        if (!Number.isInteger(id)) {
          console.error("Usage: learning-item update <id> [--term <term>] [--meaning <meaning>] [--notes <notes>]");
          return 1;
        }
        const ok = updateLearningItem(
          db,
          id,
          readOption(rest, "--term"),
          readOption(rest, "--meaning"),
          readOption(rest, "--notes")
        );
        if (!ok) {
          console.log(JSON.stringify({ ok: false, error: "not_found" }));
          return 1;
        }
        console.log(JSON.stringify({ ok: true, id }));
        return 0;
      }
      if (sub === "delete") {
        const id = Number(rest[1]);
        if (!Number.isInteger(id)) {
          console.error("Usage: learning-item delete <id>");
          return 1;
        }
        const ok = deleteLearningItem(db, id);
        if (!ok) {
          console.log(JSON.stringify({ ok: false, error: "not_found" }));
          return 1;
        }
        console.log(JSON.stringify({ ok: true, id }));
        return 0;
      }
      console.error("Usage: learning-item <add|list|update|delete> ...");
      return 1;
    }

    console.error("Usage: migrate | user-config ... | learning-item ...");
    return 1;
  } finally {
    db.close();
  }
}

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    return null;
  }
  return args[index + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.exitCode = runCli(process.argv.slice(2));
}
