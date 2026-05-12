#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import {
  createLearningItem,
  defaultDbPath,
  deleteLearningItem,
  getCheckinCalendar,
  getDailyStatus,
  getUserConfig,
  listLearningItems,
  markTrainingCompleted,
  migrate,
  openDb,
  searchLearningItems,
  setUserConfig,
  updateLearningItem,
} from "./db-cli.mjs";
import { MockLlmProvider } from "./llm-service.mjs";
import { generateTrainingSession } from "./training-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const contentDir = path.resolve(rootDir, "content");
const userContentDir = path.resolve(contentDir, "user");

const sectionMap = {
  usage: "usage",
  methods: "methods",
  "agent-playbooks": "agent-playbooks",
};

export function readContentSection(section) {
  return readContentSectionForLanguage(section, null);
}

function readContentSectionForLanguage(section, nativeLanguage) {
  const folder = sectionMap[section];
  if (!folder) {
    return [];
  }
  if (nativeLanguage) {
    const localized = readLocalizedSection(section, nativeLanguage);
    if (localized.length > 0) {
      return localized;
    }
  }
  const dir = path.resolve(contentDir, folder);
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md") || name.endsWith(".html"))
    .sort();
  return files.map((name) => {
    const full = path.resolve(dir, name);
    const body = fs.readFileSync(full, "utf8");
    return { id: `${section}/${name}`, title: name, body };
  });
}

function readLocalizedSection(section, nativeLanguage) {
  const folder = sectionMap[section];
  const dir = path.resolve(userContentDir, nativeLanguage, folder);
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md") || name.endsWith(".html"))
    .sort();
  return files.map((name) => {
    const full = path.resolve(dir, name);
    const body = fs.readFileSync(full, "utf8");
    return { id: `user/${nativeLanguage}/${section}/${name}`, title: name, body };
  });
}

export function renderMarkdownLite(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inList = false;
  for (const raw of lines) {
    const line = escapeHtml(raw);
    if (!line.trim()) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (line.startsWith("# ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h2>${line.slice(2)}</h2>`);
      continue;
    }
    if (line.startsWith("## ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<h3>${line.slice(3)}</h3>`);
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineCode(line.slice(2))}</li>`);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineCode(line.replace(/^\d+\.\s/, ""))}</li>`);
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    out.push(`<p>${inlineCode(line)}</p>`);
  }
  if (inList) {
    out.push("</ul>");
  }
  return out.join("\n");
}

function inlineCode(text) {
  return text.replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sectionHtml(title, section, nativeLanguage) {
  const docs = readContentSectionForLanguage(section, nativeLanguage);
  if (docs.length === 0) {
    return `<section><h1>${title}</h1><p>No content yet.</p></section>`;
  }
  return `<section><h1>${title}</h1>${docs
    .map((doc) => `<article>${renderMarkdownLite(doc.body)}</article>`)
    .join("")}</section>`;
}

function renderPage(nativeLanguage = "zh-CN") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Language Tutor</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: "Segoe UI", "Noto Sans", sans-serif; background:#f3f4f6; color:#111827; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 24px; }
    header { background: linear-gradient(120deg,#0f766e,#2563eb); color: white; padding: 24px; border-radius: 8px; }
    h1 { margin: 0 0 8px 0; font-size: 28px; }
    .lead { margin: 0; opacity: 0.95; }
    nav { display:flex; gap:8px; margin-top: 16px; flex-wrap: wrap; }
    nav a { text-decoration:none; color:#0f172a; background:#e2e8f0; padding:6px 10px; border-radius:6px; font-size:14px; }
    main { margin-top: 16px; display:grid; gap: 14px; }
    section { background: white; border:1px solid #d1d5db; border-radius: 8px; padding: 16px; }
    section h1 { color:#0f172a; font-size:20px; margin-bottom:10px; }
    article { border-top:1px solid #e5e7eb; padding-top:10px; margin-top:10px; }
    article:first-of-type { border-top:none; padding-top:0; margin-top:0; }
    p, li { line-height:1.55; font-size: 14px; }
    code { background:#e5e7eb; padding:1px 4px; border-radius:4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Agent Language Tutor</h1>
      <p class="lead">Local private console for usage guidance and study methods (${escapeHtml(nativeLanguage)}).</p>
      <nav>
        <a href="#home">Home</a>
        <a href="/items">Learning Items</a>
        <a href="/training">Training</a>
        <a href="/calendar">Calendar</a>
        <a href="/settings">Personalization</a>
        <a href="#usage">Usage</a>
        <a href="#methods">Methods</a>
        <a href="#playbooks">Agent Playbooks</a>
      </nav>
    </header>
    <main>
      <section id="home">
        <h1>Home</h1>
        <p>This UI reads local content from <code>content/usage</code>, <code>content/methods</code>, and <code>content/agent-playbooks</code>.</p>
      </section>
      <div id="usage">${sectionHtml("Usage", "usage", nativeLanguage)}</div>
      <div id="methods">${sectionHtml("Methods", "methods", nativeLanguage)}</div>
      <div id="playbooks">${sectionHtml("Agent Playbooks", "agent-playbooks", nativeLanguage)}</div>
    </main>
  </div>
</body>
</html>`;
}

function renderCalendarPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily Check-in Calendar</title>
  <style>
    body { margin:0; font-family:"Segoe UI","Noto Sans",sans-serif; background:#f3f4f6; color:#111827; }
    .wrap { max-width:980px; margin:0 auto; padding:24px; }
    header { display:flex; justify-content:space-between; align-items:center; gap:10px; }
    a { color:#1d4ed8; text-decoration:none; }
    section { background:#fff; border:1px solid #d1d5db; border-radius:8px; padding:16px; margin-top:12px; }
    .stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .stat { border:1px solid #e5e7eb; border-radius:8px; padding:10px; background:#f8fafc; }
    .stat b { display:block; font-size:22px; margin-top:4px; }
    .toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    input, button { font:inherit; }
    input { border:1px solid #cbd5e1; border-radius:6px; padding:7px; }
    button { border:1px solid #cbd5e1; background:#e2e8f0; border-radius:6px; padding:7px 10px; cursor:pointer; }
    .calendar { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; margin-top:12px; }
    .day { min-height:86px; border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#fff; box-sizing:border-box; }
    .day.complete { border-color:#0f766e; background:#ecfdf5; }
    .date { font-weight:600; }
    .meta { margin-top:8px; font-size:12px; color:#475569; line-height:1.45; }
    @media (max-width: 720px) { .stats { grid-template-columns:1fr 1fr; } .calendar { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header><h1>Daily Check-in Calendar</h1><a href="/">Back to Home</a></header>
    <section class="toolbar">
      <label>Month <input id="month" type="month"></label>
      <button id="loadBtn">Load</button>
      <button id="completeBtn">Mark Training Complete</button>
      <span id="msg"></span>
    </section>
    <section>
      <div class="stats">
        <div class="stat">Streak<b id="streak">0</b></div>
        <div class="stat">Due Reviews<b id="due">0</b></div>
        <div class="stat">Items Added<b id="added">0</b></div>
        <div class="stat">Training Done<b id="training">0</b></div>
      </div>
    </section>
    <section><div id="calendar" class="calendar"></div></section>
  </div>
<script>
const today = new Date().toISOString().slice(0, 10);
document.getElementById("month").value = today.slice(0, 7);

async function load() {
  const month = document.getElementById("month").value || today.slice(0, 7);
  const [calendar, status] = await Promise.all([
    fetch("/api/check-in-calendar?month=" + encodeURIComponent(month)).then(r => r.json()),
    fetch("/api/daily-status?date=" + encodeURIComponent(today)).then(r => r.json())
  ]);
  document.getElementById("streak").textContent = calendar.streak;
  document.getElementById("due").textContent = status.daily_status.due_reviews;
  document.getElementById("added").textContent = status.daily_status.items_added;
  document.getElementById("training").textContent = status.daily_status.training_completed;
  render(calendar.days || []);
}

function render(days) {
  const el = document.getElementById("calendar");
  el.innerHTML = "";
  for (const day of days) {
    const cell = document.createElement("div");
    cell.className = "day" + (day.completed ? " complete" : "");
    cell.innerHTML = "<div class='date'>" + day.checkin_date.slice(8) + "</div><div class='meta'>" +
      "Status: " + (day.completed ? "completed" : "pending") + "<br>" +
      "Due: " + day.due_reviews + "<br>" +
      "Added: " + day.items_added + "<br>" +
      "Training: " + day.training_completed + "</div>";
    el.appendChild(cell);
  }
}

document.getElementById("loadBtn").onclick = load;
document.getElementById("completeBtn").onclick = async () => {
  const res = await fetch("/api/daily-status/training-completed", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ date: today }) });
  const body = await res.json();
  document.getElementById("msg").textContent = body.ok ? "Training recorded." : "Update failed.";
  await load();
};
load();
</script>
</body>
</html>`;
}

function renderTrainingPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Memory Training</title>
  <style>
    body { margin:0; font-family:"Segoe UI","Noto Sans",sans-serif; background:#f3f4f6; color:#111827; }
    .wrap { max-width:980px; margin:0 auto; padding:24px; }
    header { display:flex; justify-content:space-between; align-items:center; gap:10px; }
    a { color:#1d4ed8; text-decoration:none; }
    section { background:#fff; border:1px solid #d1d5db; border-radius:8px; padding:16px; margin-top:12px; }
    .row { display:flex; gap:8px; flex-wrap:wrap; align-items:end; }
    label { display:grid; gap:6px; font-size:14px; }
    input, select, button { font:inherit; }
    input, select { border:1px solid #cbd5e1; border-radius:6px; padding:7px; min-width:180px; }
    button { border:1px solid #cbd5e1; background:#e2e8f0; border-radius:6px; padding:7px 10px; cursor:pointer; }
    pre { white-space:pre-wrap; background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px; padding:12px; }
    li { margin:8px 0; line-height:1.45; }
  </style>
</head>
<body>
  <div class="wrap">
    <header><h1>Memory Training</h1><a href="/">Back to Home</a></header>
    <section class="row">
      <label>Mode
        <select id="mode">
          <option value="review">Review</option>
          <option value="quiz">Quiz</option>
          <option value="story">Story</option>
          <option value="dialogue">Dialogue</option>
          <option value="conversation">Conversation</option>
        </select>
      </label>
      <label>Related search <input id="query" placeholder="optional memory focus"></label>
      <button id="generate">Generate</button>
    </section>
    <section>
      <h2>Prompt</h2>
      <pre id="prompt">Generate a training session to reuse your saved items.</pre>
    </section>
    <section>
      <h2>Memory Items</h2>
      <ul id="items"></ul>
    </section>
    <section>
      <h2>Tasks</h2>
      <ol id="tasks"></ol>
    </section>
  </div>
<script>
async function generate() {
  const mode = document.getElementById("mode").value;
  const query = document.getElementById("query").value.trim();
  const res = await fetch("/api/training-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, query })
  });
  const session = await res.json();
  document.getElementById("prompt").textContent = session.prompt || "";
  document.getElementById("items").innerHTML = (session.items || []).map((item) => "<li><b>" + escapeHtml(item.term) + "</b>: " + escapeHtml(item.meaning) + "</li>").join("");
  document.getElementById("tasks").innerHTML = (session.tasks || []).map((task) => "<li>" + escapeHtml(task.instruction || task.question || "") + "</li>").join("");
}
function escapeHtml(value) {
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
document.getElementById("generate").onclick = generate;
generate();
</script>
</body>
</html>`;
}

function renderSettingsPage() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Personalization</title>
<style>body{margin:0;font-family:"Segoe UI","Noto Sans",sans-serif;background:#f3f4f6;color:#111827}.wrap{max-width:760px;margin:0 auto;padding:24px}section{background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:16px}input,button{font:inherit}input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #cbd5e1;border-radius:6px}button{margin-top:8px;border:1px solid #cbd5e1;background:#e2e8f0;border-radius:6px;padding:6px 10px;cursor:pointer}</style>
</head><body><div class="wrap"><h1>Personalization</h1><p><a href="/">Back to Home</a></p><section><label>Native Language<input id="lang" placeholder="zh-CN"></label><button id="save">Save and Regenerate Content</button><pre id="out"></pre></section></div>
<script>
async function load(){const res=await fetch('/api/user/settings');const j=await res.json();document.getElementById('lang').value=j.native_language||'zh-CN';}
document.getElementById('save').onclick=async()=>{const native_language=document.getElementById('lang').value.trim()||'zh-CN';await fetch('/api/user/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({native_language})});const reg=await fetch('/api/user-content/regenerate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({native_language,sections:['usage','methods']})}).then(r=>r.json());document.getElementById('out').textContent=JSON.stringify(reg,null,2);};
load();
</script></body></html>`;
}

function renderItemsPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Learning Items</title>
  <style>
    body { margin:0; font-family:"Segoe UI","Noto Sans",sans-serif; background:#f3f4f6; color:#111827; }
    .wrap { max-width:980px; margin:0 auto; padding:24px; }
    header { display:flex; justify-content:space-between; align-items:center; gap:10px; }
    a { color:#1d4ed8; text-decoration:none; }
    section { background:white; border:1px solid #d1d5db; border-radius:8px; padding:16px; margin-top:12px; }
    input, textarea, button { font:inherit; }
    input, textarea { width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-top:6px; }
    textarea { min-height:80px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    button { border:1px solid #cbd5e1; background:#e2e8f0; border-radius:6px; padding:6px 10px; cursor:pointer; }
    table { width:100%; border-collapse:collapse; margin-top:10px; font-size:14px; }
    th, td { border-bottom:1px solid #e5e7eb; text-align:left; padding:8px; vertical-align:top; }
    .mono { font-family:Consolas,monospace; font-size:12px; white-space:pre-wrap; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Learning Items</h1>
      <a href="/">Back to Home</a>
    </header>

    <section>
      <h2>Add Item</h2>
      <div class="grid">
        <div><label>Term<input id="term"></label></div>
        <div><label>Meaning<input id="meaning"></label></div>
      </div>
      <div><label>Notes<textarea id="notes"></textarea></label></div>
      <div class="row"><button id="addBtn">Add</button><span id="msg"></span></div>
    </section>

    <section>
      <h2>Search / Filter</h2>
      <div class="row">
        <input id="query" placeholder="Search term, meaning, notes">
        <button id="searchBtn">Search</button>
        <button id="reloadBtn">List All</button>
      </div>
    </section>

    <section>
      <h2>Import / Export</h2>
      <div class="row">
        <button id="exportBtn">Export JSON</button>
        <input id="importFile" type="file" accept="application/json">
        <button id="importBtn">Import JSON</button>
      </div>
      <div id="importMsg" class="mono"></div>
    </section>

    <section>
      <h2>Items</h2>
      <table>
        <thead><tr><th>ID</th><th>Term</th><th>Meaning</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </section>
  </div>

<script>
const rows = document.getElementById("rows");
const msg = document.getElementById("msg");
const importMsg = document.getElementById("importMsg");

async function load(query = "") {
  const url = query ? "/api/learning-items?query=" + encodeURIComponent(query) : "/api/learning-items";
  const res = await fetch(url);
  const body = await res.json();
  renderRows(body.items || []);
}

function renderRows(items) {
  rows.innerHTML = "";
  for (const item of items) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>"+item.id+"</td><td><input data-k='term' value='"+escapeAttr(item.term)+"'></td><td><input data-k='meaning' value='"+escapeAttr(item.meaning)+"'></td><td><input data-k='notes' value='"+escapeAttr(item.notes || "")+"'></td><td></td>";
    const actions = tr.querySelector("td:last-child");
    const save = document.createElement("button");
    save.textContent = "Save";
    save.onclick = async () => {
      const term = tr.querySelector("input[data-k='term']").value;
      const meaning = tr.querySelector("input[data-k='meaning']").value;
      const notes = tr.querySelector("input[data-k='notes']").value;
      const res = await fetch("/api/learning-items/" + item.id, { method:"PUT", headers:{ "content-type":"application/json" }, body: JSON.stringify({ term, meaning, notes }) });
      if (res.ok) { msg.textContent = "Updated item " + item.id; await load(document.getElementById("query").value.trim()); }
    };
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.onclick = async () => {
      const res = await fetch("/api/learning-items/" + item.id, { method:"DELETE" });
      if (res.ok) { msg.textContent = "Deleted item " + item.id; await load(document.getElementById("query").value.trim()); }
    };
    actions.appendChild(save);
    actions.appendChild(del);
    rows.appendChild(tr);
  }
}

function escapeAttr(v) {
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

document.getElementById("addBtn").onclick = async () => {
  const term = document.getElementById("term").value.trim();
  const meaning = document.getElementById("meaning").value.trim();
  const notes = document.getElementById("notes").value;
  const res = await fetch("/api/learning-items", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ term, meaning, notes }) });
  const body = await res.json();
  if (res.ok) {
    msg.textContent = "Added item " + body.id;
    document.getElementById("term").value = "";
    document.getElementById("meaning").value = "";
    document.getElementById("notes").value = "";
    await load();
  } else {
    msg.textContent = body.error || "Add failed";
  }
};
document.getElementById("searchBtn").onclick = async () => load(document.getElementById("query").value.trim());
document.getElementById("reloadBtn").onclick = async () => { document.getElementById("query").value = ""; await load(); };
document.getElementById("exportBtn").onclick = async () => {
  const res = await fetch("/api/learning-items/export");
  const body = await res.json();
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "learning-items.json"; a.click();
  URL.revokeObjectURL(url);
};
document.getElementById("importBtn").onclick = async () => {
  const file = document.getElementById("importFile").files[0];
  if (!file) { importMsg.textContent = "Select a JSON file first."; return; }
  const text = await file.text();
  const res = await fetch("/api/learning-items/import", { method:"POST", headers:{ "content-type":"application/json" }, body: text });
  const body = await res.json();
  importMsg.textContent = JSON.stringify(body);
  await load();
};
load();
</script>
</body>
</html>`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("request_too_large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function resolveDbPath() {
  return process.env.NGLT_DB_PATH ? path.resolve(process.env.NGLT_DB_PATH) : defaultDbPath;
}

function withDb(run, dbPath = resolveDbPath()) {
  const db = openDb(dbPath);
  try {
    migrate(db);
    return run(db);
  } finally {
    db.close();
  }
}

function getNativeLanguage(db) {
  return getUserConfig(db, "native_language")?.value ?? "zh-CN";
}

async function regenerateUserContent(nativeLanguage, sections = ["usage", "methods"]) {
  const provider = new MockLlmProvider();
  const output = [];
  for (const section of sections) {
    const items = readContentSectionForLanguage(section, null);
    const folder = sectionMap[section];
    if (!folder) {
      continue;
    }
    const targetDir = path.resolve(userContentDir, nativeLanguage, folder);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const item of items) {
      const rewritten = await provider.rewriteToNativeLanguage({
        native_language: nativeLanguage,
        title: item.title,
        source_text: item.body,
      });
      const filename = item.title.endsWith(".md") ? item.title : `${item.title}.md`;
      const full = path.resolve(targetDir, filename);
      fs.writeFileSync(full, rewritten, "utf8");
      output.push({ section, file: full });
    }
  }
  return output;
}

export function startWebServer(port = 0, host = "127.0.0.1") {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${host}`);
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname === "/api/content") {
      const section = url.searchParams.get("section") ?? "";
      const nativeLanguage = withDb((db) => getNativeLanguage(db));
      const items = readContentSectionForLanguage(section, nativeLanguage);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ section, native_language: nativeLanguage, items }));
      return;
    }
    if (url.pathname === "/api/user/settings" && req.method === "GET") {
      const nativeLanguage = withDb((db) => getNativeLanguage(db));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ native_language: nativeLanguage }));
      return;
    }
    if (url.pathname === "/api/user/settings" && req.method === "POST") {
      readJsonBody(req)
        .then((body) => {
          const nativeLanguage = String(body.native_language ?? "zh-CN").trim() || "zh-CN";
          withDb((db) => setUserConfig(db, "native_language", nativeLanguage));
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true, native_language: nativeLanguage }));
        })
        .catch((error) => {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        });
      return;
    }
    if (url.pathname === "/api/user-content/regenerate" && req.method === "POST") {
      readJsonBody(req)
        .then(async (body) => {
          const nativeLanguage = String(body.native_language ?? "zh-CN").trim() || "zh-CN";
          const sections = Array.isArray(body.sections) ? body.sections : ["usage", "methods"];
          withDb((db) => setUserConfig(db, "native_language", nativeLanguage));
          const generated = await regenerateUserContent(nativeLanguage, sections);
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true, native_language: nativeLanguage, generated_count: generated.length }));
        })
        .catch((error) => {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        });
      return;
    }
    if (url.pathname === "/api/daily-status" && req.method === "GET") {
      const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
      const dailyStatus = withDb((db) => getDailyStatus(db, date));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, daily_status: dailyStatus }));
      return;
    }
    if (url.pathname === "/api/check-in-calendar" && req.method === "GET") {
      const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
      const today = url.searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
      const calendar = withDb((db) => getCheckinCalendar(db, month, today));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, ...calendar }));
      return;
    }
    if (url.pathname === "/api/daily-status/training-completed" && req.method === "POST") {
      readJsonBody(req)
        .then((body) => {
          const date = String(body.date ?? new Date().toISOString().slice(0, 10));
          const count = Number(body.count ?? 1);
          const dailyStatus = withDb((db) => markTrainingCompleted(db, date, Number.isInteger(count) ? count : 1));
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true, daily_status: dailyStatus }));
        })
        .catch((error) => {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        });
      return;
    }
    if (url.pathname === "/api/training-session" && req.method === "POST") {
      readJsonBody(req)
        .then((body) => {
          const session = withDb((db) =>
            generateTrainingSession(db, {
              mode: body.mode ?? "review",
              query: body.query ?? "",
              limit: body.limit ?? 5,
              date: String(body.date ?? new Date().toISOString().slice(0, 10)),
            })
          );
          if (session.items.length > 0) {
            withDb((db) => markTrainingCompleted(db, session.date, 1));
          }
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(session));
        })
        .catch((error) => {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        });
      return;
    }
    if (url.pathname === "/api/learning-items" && req.method === "GET") {
      const query = (url.searchParams.get("query") ?? "").trim();
      const items = withDb((db) => (query ? searchLearningItems(db, query, 200) : listLearningItems(db)));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ items }));
      return;
    }
    if (url.pathname === "/api/learning-items" && req.method === "POST") {
      readJsonBody(req)
        .then((body) => {
          const term = String(body.term ?? "").trim();
          const meaning = String(body.meaning ?? "").trim();
          const notes = String(body.notes ?? "");
          if (!term || !meaning) {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ ok: false, error: "term_and_meaning_required" }));
            return;
          }
          const id = withDb((db) => createLearningItem(db, term, meaning, notes));
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true, id }));
        })
        .catch((error) => {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        });
      return;
    }
    if (url.pathname === "/api/learning-items/export" && req.method === "GET") {
      const items = withDb((db) => listLearningItems(db));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ exported_at: new Date().toISOString(), items }));
      return;
    }
    if (url.pathname === "/api/learning-items/import" && req.method === "POST") {
      readJsonBody(req)
        .then((body) => {
          const inputItems = Array.isArray(body.items) ? body.items : [];
          let imported = 0;
          withDb((db) => {
            for (const it of inputItems) {
              const term = String(it.term ?? "").trim();
              const meaning = String(it.meaning ?? "").trim();
              const notes = String(it.notes ?? "");
              if (!term || !meaning) {
                continue;
              }
              createLearningItem(db, term, meaning, notes);
              imported += 1;
            }
          });
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true, imported }));
        })
        .catch((error) => {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        });
      return;
    }
    if (url.pathname.startsWith("/api/learning-items/")) {
      const idText = url.pathname.slice("/api/learning-items/".length);
      const id = Number(idText);
      if (!Number.isInteger(id)) {
        res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "invalid_id" }));
        return;
      }
      if (req.method === "PUT") {
        readJsonBody(req)
          .then((body) => {
            const ok = withDb((db) =>
              updateLearningItem(
                db,
                id,
                body.term != null ? String(body.term) : null,
                body.meaning != null ? String(body.meaning) : null,
                body.notes != null ? String(body.notes) : null
              )
            );
            if (!ok) {
              res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ ok: false, error: "not_found" }));
              return;
            }
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ ok: true, id }));
          })
          .catch((error) => {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ ok: false, error: error.message }));
          });
        return;
      }
      if (req.method === "DELETE") {
        const ok = withDb((db) => deleteLearningItem(db, id));
        if (!ok) {
          res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: "not_found" }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, id }));
        return;
      }
    }
    if (url.pathname === "/items") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderItemsPage());
      return;
    }
    if (url.pathname === "/calendar") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderCalendarPage());
      return;
    }
    if (url.pathname === "/training") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderTrainingPage());
      return;
    }
    if (url.pathname === "/settings") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderSettingsPage());
      return;
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const nativeLanguage = withDb((db) => getNativeLanguage(db));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderPage(nativeLanguage));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`web server listening on http://${host}:${actualPort}`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const portArg = Number(process.argv[2] ?? "4173");
  const port = Number.isInteger(portArg) && portArg > 0 ? portArg : 4173;
  startWebServer(port, "127.0.0.1");
}
