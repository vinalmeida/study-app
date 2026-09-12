import test from "node:test";
import assert from "node:assert/strict";
import { formatStudyTimeInput, normalizeStudyTime } from "../src/study-time.js";

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

test("insere os dois-pontos após o segundo dígito e formata 0030", () => {
  assert.deepEqual(formatStudyTimeInput("0"), { value: "0", caretPosition: 1 });
  assert.deepEqual(formatStudyTimeInput("00"), { value: "00:", caretPosition: 3 });
  assert.deepEqual(formatStudyTimeInput("00:3"), { value: "00:3", caretPosition: 4 });
  assert.deepEqual(formatStudyTimeInput("0030"), { value: "00:30", caretPosition: 5 });
  assert.equal(normalizeStudyTime(formatStudyTimeInput("0030").value), "00:30");
});

test("permite colar horário formatado e apagar junto aos dois-pontos", () => {
  assert.equal(formatStudyTimeInput("23:59").value, "23:59");
  assert.deepEqual(formatStudyTimeInput("0030", 2, "deleteContentBackward"), { value: "00:30", caretPosition: 2 });
  assert.deepEqual(formatStudyTimeInput("030", 1, "deleteContentBackward"), { value: "03:0", caretPosition: 1 });
  assert.deepEqual(formatStudyTimeInput(""), { value: "", caretPosition: 0 });
});
