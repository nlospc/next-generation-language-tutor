import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startWebServer } from "../scripts/web-server.mjs";
import { callTool } from "../scripts/mcp-server.mjs";

function makeTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-webcrud-"));
  return { dir, dbPath: path.join(dir, "phase6.db") };
}

test("web CRUD/search/import/export and MCP consistency", async () => {
  const { dir, dbPath } = makeTempDbPath();
  const prev = process.env.NGLT_DB_PATH;
  process.env.NGLT_DB_PATH = dbPath;
  const server = startWebServer(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const add = await fetch(`${base}/api/learning-items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ term: "apple", meaning: "a fruit", notes: "web" }),
    }).then((r) => r.json());
    assert.equal(add.ok, true);
    const id = add.id;

    const search = await fetch(`${base}/api/learning-items?query=fruit`).then((r) => r.json());
    assert.equal(search.items.length, 1);

    const updated = await fetch(`${base}/api/learning-items/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meaning: "a common fruit" }),
    }).then((r) => r.json());
    assert.equal(updated.ok, true);

    const exported = await fetch(`${base}/api/learning-items/export`).then((r) => r.json());
    assert.equal(Array.isArray(exported.items), true);
    assert.equal(exported.items.length >= 1, true);

    const imported = await fetch(`${base}/api/learning-items/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ term: "banana", meaning: "yellow fruit", notes: "imported" }] }),
    }).then((r) => r.json());
    assert.equal(imported.ok, true);
    assert.equal(imported.imported, 1);

    const mcpList = callTool("list_learning_items", {}, dbPath);
    assert.equal(mcpList.ok, true);
    assert.equal(mcpList.items.length >= 2, true);

    const deleted = await fetch(`${base}/api/learning-items/${id}`, { method: "DELETE" }).then((r) => r.json());
    assert.equal(deleted.ok, true);
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

