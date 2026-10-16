// Servidor local: serve o app (dist/) e a API de dados em http://127.0.0.1:5174.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { openDb, runQuery, mapSqliteError, rootDir, dbPath, LOCAL_USER_ID } from "./db.js";
import { createBackupScheduler, runBackup } from "./backup.js";

const port = Number(process.env.PORT || 5174);
const distDir = resolve(rootDir, "dist");
const db = openDb();
const scheduleBackup = createBackupScheduler(db);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8",
};
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...securityHeaders, ...headers });
  res.end(body);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("corpo grande demais");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function serveStatic(url, res) {
  const clean = decodeURIComponent(url.pathname);
  let file = normalize(join(distDir, clean));
  if (!file.startsWith(distDir)) return send(res, 403, "Proibido");
  try {
    const data = await readFile(extname(file) ? file : join(distDir, "index.html"));
    const ext = extname(file) || ".html";
    send(res, 200, data, { "Content-Type": types[ext] || "application/octet-stream" });
  } catch {
    if (extname(file)) return send(res, 404, "Não encontrado");
    send(res, 200, await readFile(join(distDir, "index.html")), { "Content-Type": types[".html"] });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  // Só aceita requisições vindas do próprio computador.
  if (req.headers.host && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host)) return send(res, 403, "Proibido");
  if (url.pathname === "/api/query" && req.method === "POST") {
    try {
      const query = await readBody(req);
      const data = runQuery(db, query);
      if (query.op !== "select") scheduleBackup();
      return send(res, 200, JSON.stringify({ data, error: null }), { "Content-Type": "application/json" });
    } catch (error) {
      console.error(error.message);
      return send(res, 200, JSON.stringify({ data: null, error: mapSqliteError(error) }), { "Content-Type": "application/json" });
    }
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Método não permitido");
  return serveStatic(url, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Caderno de Estudos em http://127.0.0.1:${port}`);
  console.log(`Banco: ${dbPath} (usuário local ${LOCAL_USER_ID.slice(0, 8)}…)`);
  const done = runBackup(db);
  console.log(`Backup inicial em: ${done.join(" | ") || "nenhum"}`);
});
process.on("SIGINT", () => { runBackup(db); process.exit(0); });
