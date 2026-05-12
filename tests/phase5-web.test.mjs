import test from "node:test";
import assert from "node:assert/strict";
import { startWebServer } from "../scripts/web-server.mjs";

function listenAndGetUrl(server) {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unexpected server address.");
  }
  return `http://127.0.0.1:${address.port}`;
}

test("web server serves home page", async () => {
  const server = startWebServer(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = listenAndGetUrl(server);
  try {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.equal(html.includes("Agent Language Tutor"), true);
    assert.equal(html.includes("Usage"), true);
    assert.equal(html.includes("Methods"), true);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("web API returns usage content", async () => {
  const server = startWebServer(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = listenAndGetUrl(server);
  try {
    const res = await fetch(`${base}/api/content?section=usage`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.items.length > 0, true);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
