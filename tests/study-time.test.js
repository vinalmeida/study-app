import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStudyTime } from "../src/study-time.js";

test("usa apenas horas e minutos em formato de 24 horas", () => {
  assert.equal(normalizeStudyTime("03:00"), "03:00");
  assert.equal(normalizeStudyTime("15:30"), "15:30");
});

test("exibe registros antigos com segundos apenas até o minuto", () => {
  assert.equal(normalizeStudyTime("23:45:12"), "23:45");
});

test("rejeita horários inválidos", () => {
  assert.equal(normalizeStudyTime("25:00"), null);
  assert.equal(normalizeStudyTime("03:00 PM"), null);
  assert.equal(normalizeStudyTime("03:60"), null);
});
