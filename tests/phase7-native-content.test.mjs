import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startWebServer } from "../scripts/web-server.mjs";

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nglt-phase7-"));
  return { dir, dbPath: path.join(dir, "phase7.db") };
}

test("native language setting regenerates and persists user content", async () => {
  const { dir, dbPath } = tempDb();
  const prev = process.env.NGLT_DB_PATH;
  process.env.NGLT_DB_PATH = dbPath;
  try {
    const server1 = startWebServer(0, "127.0.0.1");
    await new Promise((resolve) => server1.once("listening", resolve));
    const a1 = server1.address();
    const base1 = `http://127.0.0.1:${a1.port}`;

    const setRes = await fetch(`${base1}/api/user/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ native_language: "ja-JP" }),
    }).then((r) => r.json());
    assert.equal(setRes.ok, true);

    const regen = await fetch(`${base1}/api/user-content/regenerate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ native_language: "ja-JP", sections: ["methods"] }),
    }).then((r) => r.json());
    assert.equal(regen.ok, true);
    assert.equal(regen.generated_count > 0, true);

    const methods = await fetch(`${base1}/api/content?section=methods`).then((r) => r.json());
    assert.equal(methods.native_language, "ja-JP");
    assert.equal(methods.items.length > 0, true);
    assert.equal(methods.items[0].body.includes("[mock rewrite:ja-JP]"), true);
    await new Promise((resolve, reject) => server1.close((err) => (err ? reject(err) : resolve())));

    const server2 = startWebServer(0, "127.0.0.1");
    await new Promise((resolve) => server2.once("listening", resolve));
    const a2 = server2.address();
    const base2 = `http://127.0.0.1:${a2.port}`;
    const methodsAfterRestart = await fetch(`${base2}/api/content?section=methods`).then((r) => r.json());
    assert.equal(methodsAfterRestart.native_language, "ja-JP");
    assert.equal(methodsAfterRestart.items.length > 0, true);
    assert.equal(methodsAfterRestart.items[0].body.includes("[mock rewrite:ja-JP]"), true);
    await new Promise((resolve, reject) => server2.close((err) => (err ? reject(err) : resolve())));
  } finally {
    if (prev == null) {
      delete process.env.NGLT_DB_PATH;
    } else {
      process.env.NGLT_DB_PATH = prev;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    const userLangDir = path.resolve("content", "user", "ja-JP");
    if (fs.existsSync(userLangDir)) {
      fs.rmSync(userLangDir, { recursive: true, force: true });
    }
  }
});

