// Importa subjects e study_logs de um backup do Supabase (pg_dump, .gz ou .sql).
// Uso: node server/import-backup.js data/supabase-backup.gz
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { openDb, LOCAL_USER_ID, dbPath } from "./db.js";

function unescapeCopy(value) {
  if (value === "\\N") return null;
  return value.replace(/\\(.)/g, (_, c) => ({ n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v" }[c] ?? c));
}

function readCopy(sql, table) {
  const start = sql.indexOf(`COPY public.${table} (`);
  if (start < 0) throw new Error(`Tabela ${table} não encontrada no backup.`);
  const headerEnd = sql.indexOf("\n", start);
  const columns = sql.slice(start, headerEnd).match(/\(([^)]*)\)/)[1].split(",").map((c) => c.trim());
  const body = sql.slice(headerEnd + 1, sql.indexOf("\n\\.\n", headerEnd));
  return body.split("\n").filter(Boolean).map((line) => {
    const cells = line.split("\t").map(unescapeCopy);
    return Object.fromEntries(columns.map((c, i) => [c, cells[i]]));
  });
}

const file = process.argv[2];
if (!file) throw new Error("Informe o arquivo de backup.");
const raw = readFileSync(file);
const sql = (file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8");
const subjects = readCopy(sql, "subjects");
const logs = readCopy(sql, "study_logs");

const db = openDb();
if (db.prepare("SELECT count(*) AS n FROM study_logs").get().n > 0 && !process.argv.includes("--force")) {
  throw new Error(`O banco ${dbPath} já tem registros. Use --force para importar mesmo assim (ignora ids repetidos).`);
}
db.exec("BEGIN");
const insertSubject = db.prepare("INSERT OR IGNORE INTO subjects (id,user_id,name,color,archived,created_at) VALUES (?,?,?,?,?,?)");
for (const s of subjects) insertSubject.run(s.id, LOCAL_USER_ID, s.name, s.color, s.archived === "t" ? 1 : 0, s.created_at);
const insertLog = db.prepare("INSERT OR IGNORE INTO study_logs (id,user_id,subject_id,studied_on,minutes,kind,notes,created_at,start_time) VALUES (?,?,?,?,?,?,?,?,?)");
for (const l of logs) insertLog.run(l.id, LOCAL_USER_ID, l.subject_id, l.studied_on, Number(l.minutes), l.kind, l.notes ?? "", l.created_at, l.start_time);
db.exec("COMMIT");
console.log(`Importados: ${subjects.length} disciplinas e ${logs.length} registros em ${dbPath}.`);
