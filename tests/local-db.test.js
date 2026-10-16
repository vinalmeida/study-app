import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createSchema, runQuery, mapSqliteError } from "../server/db.js";

function freshDb() {
  const db = new DatabaseSync(":memory:");
  createSchema(db);
  return db;
}

test("insere, lista sem arquivadas e arquiva disciplinas", () => {
  const db = freshDb();
  const [created] = runQuery(db, { table: "subjects", op: "insert", values: { name: "IAA", color: "#9b5de5", user_id: "ignorado" }, columns: ["id", "name", "color"], returning: true });
  assert.equal(created.name, "IAA");
  runQuery(db, { table: "subjects", op: "insert", values: { name: "MVGA", color: "#4865ff" } });
  runQuery(db, { table: "subjects", op: "update", values: { archived: true }, filters: [{ col: "id", val: created.id }] });
  const active = runQuery(db, { table: "subjects", op: "select", columns: ["name", "archived"], filters: [{ col: "archived", val: false }], orders: [{ col: "name" }] });
  assert.deepEqual(active.map((row) => ({ ...row })), [{ name: "MVGA", archived: false }]);
});

test("nome repetido devolve o código 23505 que o app já trata", () => {
  const db = freshDb();
  runQuery(db, { table: "subjects", op: "insert", values: { name: "Cálculo 1" } });
  assert.throws(
    () => runQuery(db, { table: "subjects", op: "insert", values: { name: " cálculo 1 " } }),
    (error) => mapSqliteError(error).code === "23505",
  );
});

test("recusa tabelas e colunas fora da lista permitida", () => {
  const db = freshDb();
  assert.throws(() => runQuery(db, { table: "sqlite_master", op: "select" }), /tabela inválida/);
  assert.throws(() => runQuery(db, { table: "subjects", op: "select", columns: ["name; DROP TABLE subjects"] }), /não permitido \(coluna\)/);
});

test("remove registros de estudo pelo id", () => {
  const db = freshDb();
  const [subject] = runQuery(db, { table: "subjects", op: "insert", values: { name: "MD" }, returning: true });
  const [log] = runQuery(db, { table: "study_logs", op: "insert", values: { subject_id: subject.id, studied_on: "2026-10-16", minutes: 45, kind: "exercicios", notes: "" }, returning: true });
  runQuery(db, { table: "study_logs", op: "delete", filters: [{ col: "id", val: log.id }] });
  assert.equal(runQuery(db, { table: "study_logs", op: "select" }).length, 0);
});
