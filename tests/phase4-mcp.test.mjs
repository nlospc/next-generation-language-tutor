import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { callTool, handleRpcMessage, listTools } from "../scripts/mcp-server.mjs";

function withTempDb(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-mcp-"));
  const dbPath = path.join(dir, "mcp.db");
  try {
    run(dbPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("tools list contains required phase4 tools", () => {
  const names = new Set(listTools().map((tool) => tool.name));
  assert.equal(names.has("initialize_user"), true);
  assert.equal(names.has("add_learning_item"), true);
  assert.equal(names.has("list_learning_items"), true);
  assert.equal(names.has("search_learning_items"), true);
  assert.equal(names.has("update_learning_item"), true);
  assert.equal(names.has("delete_learning_item"), true);
  assert.equal(names.has("get_daily_status"), true);
  assert.equal(names.has("generate_training_session"), true);
});

test("phase4 flow: initialize -> add -> list -> delete", () => {
  withTempDb((dbPath) => {
    const init = callTool("initialize_user", { native_language: "zh-CN", target_language: "en" }, dbPath);
    assert.equal(init.ok, true);

    const added = callTool("add_learning_item", { term: "apple", meaning: "a fruit", notes: "demo" }, dbPath);
    assert.equal(added.ok, true);
    const id = added.id;

    const list = callTool("list_learning_items", {}, dbPath);
    assert.equal(list.ok, true);
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].id, id);

    const deleted = callTool("delete_learning_item", { id }, dbPath);
    assert.equal(deleted.ok, true);

    const listAfter = callTool("list_learning_items", {}, dbPath);
    assert.equal(listAfter.items.length, 0);
  });
});

test("search and update tools work", () => {
  withTempDb((dbPath) => {
    const added = callTool("add_learning_item", { term: "take it easy", meaning: "relax", notes: "phrase" }, dbPath);
    const id = added.id;
    const search = callTool("search_learning_items", { query: "easy" }, dbPath);
    assert.equal(search.ok, true);
    assert.equal(search.items.length, 1);
    assert.equal(search.items[0].id, id);

    const updated = callTool("update_learning_item", { id, meaning: "stay relaxed" }, dbPath);
    assert.equal(updated.ok, true);

    const list = callTool("list_learning_items", {}, dbPath);
    assert.equal(list.items[0].meaning, "stay relaxed");
  });
});

test("get_daily_status returns default pending status", () => {
  withTempDb((dbPath) => {
    const daily = callTool("get_daily_status", { date: "2026-05-10" }, dbPath);
    assert.equal(daily.ok, true);
    assert.equal(daily.daily_status.checkin_date, "2026-05-10");
    assert.equal(daily.daily_status.status, "pending");
  });
});

test("JSON-RPC handlers respond for initialize/tools/list/tools/call", () => {
  withTempDb((dbPath) => {
    const initialize = handleRpcMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, dbPath);
    assert.equal(initialize.result.serverInfo.name, "agent-language-tutor-mcp");

    const list = handleRpcMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, dbPath);
    assert.equal(Array.isArray(list.result.tools), true);

    const call = handleRpcMessage(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "add_learning_item", arguments: { term: "book", meaning: "a thing to read" } },
      },
      dbPath
    );
    assert.equal(typeof call.result.content[0].text, "string");
  });
});
