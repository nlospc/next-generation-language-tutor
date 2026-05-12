#!/usr/bin/env node
import path from "node:path";
import {
  defaultDbPath,
  listLearningItems,
  markTrainingCompleted,
  migrate,
  openDb,
  searchLearningItems,
} from "./db-cli.mjs";

const validModes = new Set(["review", "quiz", "story", "dialogue", "conversation"]);

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function retrieveRelevantLearningItems(db, query = "", limit = 5) {
  const normalizedLimit = normalizeLimit(limit);
  const normalizedQuery = String(query ?? "").trim();
  const items = normalizedQuery
    ? searchLearningItems(db, normalizedQuery, normalizedLimit)
    : listLearningItems(db).slice(0, normalizedLimit);
  return items.map(formatItemForTraining);
}

export function generateTrainingSessionFromItems(items, options = {}) {
  const mode = validModes.has(options.mode) ? options.mode : "review";
  const query = String(options.query ?? "").trim();
  const date = options.date ?? todayIsoDate();
  const selected = items.slice(0, normalizeLimit(options.limit ?? 5));
  if (selected.length === 0) {
    return {
      ok: true,
      mode,
      date,
      query,
      items: [],
      prompt: "Add one learning item first so your memory can drive practice.",
      tasks: [],
    };
  }
  return {
    ok: true,
    mode,
    date,
    query,
    items: selected,
    prompt: buildPrompt(mode, selected, query),
    tasks: buildTasks(mode, selected),
  };
}

export function generateTrainingSession(db, options = {}) {
  const items = retrieveRelevantLearningItems(db, options.query ?? "", options.limit ?? 5);
  return generateTrainingSessionFromItems(items, options);
}

export function generateTrainingSessionForDbPath(dbPath = defaultDbPath, options = {}) {
  const db = openDb(path.resolve(dbPath));
  try {
    migrate(db);
    const session = generateTrainingSession(db, options);
    if (session.items.length > 0 && options.recordCompletion !== false) {
      markTrainingCompleted(db, session.date, 1);
    }
    return session;
  } finally {
    db.close();
  }
}

function normalizeLimit(value) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return 5;
  }
  return Math.min(limit, 10);
}

function formatItemForTraining(item) {
  return {
    id: item.id,
    term: item.term,
    meaning: item.meaning,
    notes: item.notes ?? "",
  };
}

function buildPrompt(mode, items, query) {
  const memoryList = items.map((item) => `${item.term} = ${item.meaning}`).join("; ");
  const queryText = query ? ` Related focus: ${query}.` : "";
  if (mode === "quiz") {
    return `Create a short quiz using the user's saved memory: ${memoryList}.${queryText}`;
  }
  if (mode === "story") {
    return `Write a short story that naturally reuses these saved items: ${memoryList}.${queryText}`;
  }
  if (mode === "dialogue") {
    return `Write a brief dialogue that practices these saved items: ${memoryList}.${queryText}`;
  }
  if (mode === "conversation") {
    return `When chatting with the user, prioritize their saved memory items: ${memoryList}.${queryText}`;
  }
  return `Review these saved memory items with quick recall and one original sentence each: ${memoryList}.${queryText}`;
}

function buildTasks(mode, items) {
  if (mode === "quiz") {
    return items.map((item) => ({
      type: "quiz",
      question: `What does "${item.term}" mean?`,
      expected_answer: item.meaning,
      memory_item_id: item.id,
    }));
  }
  if (mode === "story") {
    return [
      {
        type: "story",
        instruction: `Tell a 3-sentence story that includes: ${items.map((item) => item.term).join(", ")}.`,
        memory_item_ids: items.map((item) => item.id),
      },
    ];
  }
  if (mode === "dialogue" || mode === "conversation") {
    return [
      {
        type: mode,
        instruction: `Use these saved words before introducing new vocabulary: ${items
          .map((item) => item.term)
          .join(", ")}.`,
        memory_item_ids: items.map((item) => item.id),
      },
    ];
  }
  return items.map((item) => ({
    type: "review",
    instruction: `Recall "${item.term}", say its meaning, then make one sentence with it.`,
    expected_meaning: item.meaning,
    memory_item_id: item.id,
  }));
}
