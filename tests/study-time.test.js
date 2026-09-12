import test from "node:test";
import assert from "node:assert/strict";
import { calculateEndTime, normalizeStudyTime } from "../src/study-time.js";

test("calcula o fim a partir do início e da duração", () => {
  assert.deepEqual(calculateEndTime("03:00:00", 50), { time: "03:50:00", nextDay: false });
  assert.deepEqual(calculateEndTime("03:00:00", 150), { time: "05:30:00", nextDay: false });
});

test("preserva segundos e indica quando o fim cai no dia seguinte", () => {
  assert.deepEqual(calculateEndTime("23:45:12", 30), { time: "00:15:12", nextDay: true });
});

test("rejeita horários e durações inválidos", () => {
  assert.equal(normalizeStudyTime("25:00"), null);
  assert.equal(calculateEndTime("03:00", 0), null);
  assert.equal(calculateEndTime("03:00", 1441), null);
});
