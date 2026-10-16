// Banco local do Caderno de Estudos: um único arquivo SQLite em data/caderno.db.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const dbPath = process.env.DB_PATH || resolve(rootDir, "data", "caderno.db");
// Usuário único local. Mantém o mesmo id do antigo Supabase para os dados importados.
export const LOCAL_USER_ID = "3dc3cd1c-0bf9-4f61-8af4-4f990132ad49";

export function openDb(path = dbPath) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  createSchema(db);
  return db;
}

// Cria as tabelas se ainda não existirem. Equivale ao schema que existia no Supabase.
export function createSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
      color TEXT NOT NULL DEFAULT '#6366f1',
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS subjects_user_name_idx ON subjects (user_id, lower(trim(name)));
    CREATE TABLE IF NOT EXISTS study_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      studied_on TEXT NOT NULL,
      minutes INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
      kind TEXT NOT NULL CHECK (kind IN ('teoria','exercicios')),
      notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 1200),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      start_time TEXT
    );
    CREATE INDEX IF NOT EXISTS study_logs_date_idx ON study_logs (studied_on DESC, created_at DESC);
  `);
}

const tables = {
  subjects: {
    columns: ["id", "name", "color", "archived", "created_at"],
    writable: ["name", "color", "archived"],
    bools: ["archived"],
  },
  study_logs: {
    columns: ["id", "subject_id", "studied_on", "minutes", "kind", "notes", "created_at", "start_time"],
    writable: ["subject_id", "studied_on", "minutes", "kind", "notes", "start_time"],
    bools: [],
  },
};

function fail(message, code) {
  return Object.assign(new Error(message), { code });
}

function pick(list, wanted, what) {
  for (const name of wanted) if (!list.includes(name)) throw fail(`Valor não permitido (${what}): ${name}`, "400");
  return wanted;
}

function toRow(def, row) {
  const out = { ...row };
  for (const col of def.bools) if (col in out) out[col] = Boolean(out[col]);
  return out;
}

function toDb(def, values) {
  const out = {};
  for (const col of pick(def.writable, Object.keys(values).filter((k) => k !== "user_id"), "campo")) {
    const value = values[col];
    out[col] = def.bools.includes(col) ? (value ? 1 : 0) : value ?? null;
  }
  return out;
}

// Executa uma consulta no formato enviado por src/local-client.js.
export function runQuery(db, query) {
  const def = tables[query.table];
  if (!def) throw fail("tabela inválida", "400");
  const filters = (query.filters || []).map((f) => ({ col: pick([...def.columns], [f.col], "filtro")[0], val: f.val }));
  const where = filters.length ? ` WHERE ${filters.map((f) => `${f.col} = ?`).join(" AND ")}` : "";
  const whereArgs = filters.map((f) => (typeof f.val === "boolean" ? Number(f.val) : f.val));
  const columns = query.columns ? pick(def.columns, query.columns, "coluna") : null;
  const cols = (columns || def.columns).join(",");
  let ids = null;

  if (query.op === "select") {
    const orders = (query.orders || []).map((o) => `${pick(def.columns, [o.col], "ordem")[0]} ${o.asc === false ? "DESC" : "ASC"}`);
    const sql = `SELECT ${cols} FROM ${query.table}${where}${orders.length ? ` ORDER BY ${orders.join(",")}` : ""}`;
    return db.prepare(sql).all(...whereArgs).map((r) => toRow(def, r));
  }
  if (query.op === "insert") {
    const values = toDb(def, query.values || {});
    const keys = ["user_id", ...Object.keys(values)];
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO ${query.table} (id,${keys.join(",")}) VALUES (?${",?".repeat(keys.length)})`)
      .run(id, LOCAL_USER_ID, ...Object.values(values));
    ids = [id];
  } else if (query.op === "update") {
    const values = toDb(def, query.values || {});
    const keys = Object.keys(values);
    if (!keys.length) throw fail("nada para atualizar", "400");
    ids = db.prepare(`SELECT id FROM ${query.table}${where}`).all(...whereArgs).map((r) => r.id);
    db.prepare(`UPDATE ${query.table} SET ${keys.map((k) => `${k} = ?`).join(",")}${where}`)
      .run(...Object.values(values), ...whereArgs);
  } else if (query.op === "delete") {
    db.prepare(`DELETE FROM ${query.table}${where}`).run(...whereArgs);
    return null;
  } else {
    throw fail("operação inválida", "400");
  }
  if (!query.returning || !ids.length) return query.returning ? [] : null;
  return db.prepare(`SELECT ${cols} FROM ${query.table} WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids).map((r) => toRow(def, r));
}

export function mapSqliteError(error) {
  const message = String(error?.message || error);
  if (/UNIQUE constraint failed/i.test(message)) return { code: "23505", message };
  if (/CHECK constraint failed/i.test(message)) return { code: "23514", message };
  if (/FOREIGN KEY/i.test(message)) return { code: "23503", message };
  return { code: error?.code || "500", message };
}
