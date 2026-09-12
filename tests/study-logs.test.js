import test from "node:test";
import assert from "node:assert/strict";
import { fetchStudyLogs, saveStudyLog } from "../src/study-logs.js";

const missingColumn = { code: "42703", message: "column study_logs.start_time does not exist" };

test("recupera registros antigos quando a coluna de horário ainda não existe", async () => {
  const selected = [];
  const responses = [{ error: missingColumn }, { data: [{ id: "registro-antigo", minutes: 50 }], error: null }];
  const client = {
    from(table) {
      assert.equal(table, "study_logs");
      return {
        select(columns) {
          selected.push(columns);
          return {
            order() { return this; },
            then(resolve) { return Promise.resolve(responses.shift()).then(resolve); },
          };
        },
      };
    },
  };

  const result = await fetchStudyLogs(client);
  assert.deepEqual(result, { rows: [{ id: "registro-antigo", minutes: 50 }], supportsStartTime: false });
  assert.match(selected[0], /start_time/);
  assert.doesNotMatch(selected[1], /start_time/);
});

test("salva sem horário quando o banco ainda usa o esquema antigo", async () => {
  const inserted = [];
  const responses = [{ error: missingColumn }, { data: [{ id: "novo-registro", minutes: 50 }], error: null }];
  const client = {
    from(table) {
      assert.equal(table, "study_logs");
      return {
        insert(values) {
          inserted.push(values);
          return { select() { return Promise.resolve(responses.shift()); } };
        },
      };
    },
  };

  const result = await saveStudyLog(client, { user_id: "usuario", minutes: 50, start_time: "03:00" }, null, true);
  assert.equal(result.supportsStartTime, false);
  assert.equal(result.rows[0].id, "novo-registro");
  assert.equal(inserted[0].start_time, "03:00");
  assert.equal(inserted[1].start_time, undefined);
  assert.equal(inserted[1].minutes, 50);
});
