import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { fetchStudyLogs, saveStudyLog } from "../src/study-logs.js";
import { normalizeStudyTime } from "../src/study-time.js";

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

test("não descarta o horário nem repete a gravação quando falta a coluna", async () => {
  const inserted = [];
  const client = {
    from(table) {
      assert.equal(table, "study_logs");
      return {
        insert(values) {
          inserted.push(values);
          return { select() { return Promise.resolve({ error: missingColumn }); } };
        },
      };
    },
  };

  await assert.rejects(
    saveStudyLog(client, { user_id: "usuario", minutes: 50, start_time: "03:00" }, null),
    { code: "START_TIME_UNAVAILABLE" },
  );
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].start_time, "03:00");
});

test("00:30 permanece após salvar, recarregar e editar um registro de 1h", async () => {
  let stored = { id: "registro-existente", studied_on: "2026-09-12", minutes: 60, start_time: null, notes: "Anotações antigas" };
  const writes = [];
  const client = createClient("https://study-tests.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (url, options) => {
        if (options.method === "PATCH") {
          assert.equal(new URL(url).searchParams.get("id"), "eq.registro-existente");
          const values = JSON.parse(options.body);
          writes.push(values);
          stored = { ...stored, ...values, start_time: `${values.start_time}:00` };
        }
        return new Response(JSON.stringify([stored]), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  });

  const saved = await saveStudyLog(client, { minutes: 60, start_time: "00:30", notes: stored.notes }, stored.id);
  assert.equal(normalizeStudyTime(saved.rows[0].start_time), "00:30");
  const reloaded = await fetchStudyLogs(client);
  const editingTime = normalizeStudyTime(reloaded.rows[0].start_time);
  assert.equal(editingTime, "00:30");
  await saveStudyLog(client, { minutes: 60, start_time: editingTime, notes: "Anotações revisadas" }, stored.id);
  const edited = (await fetchStudyLogs(client)).rows[0];
  assert.equal(normalizeStudyTime(edited.start_time), "00:30");
  assert.equal(edited.minutes, 60);
  assert.equal(edited.notes, "Anotações revisadas");
  assert.equal(writes.length, 2);
});
