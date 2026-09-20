import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStudyContributionCalendar,
  studyIntensityLevel,
  studyMinutesByDate,
} from "../src/study-contributions.js";

test("converte o tempo diário nas seis faixas de intensidade", () => {
  assert.equal(studyIntensityLevel(0), 0);
  assert.equal(studyIntensityLevel(1), 1);
  assert.equal(studyIntensityLevel(60), 1);
  assert.equal(studyIntensityLevel(61), 2);
  assert.equal(studyIntensityLevel(105), 2);
  assert.equal(studyIntensityLevel(120), 2);
  assert.equal(studyIntensityLevel(121), 3);
  assert.equal(studyIntensityLevel(300), 5);
  assert.equal(studyIntensityLevel(301), 6);
  assert.equal(studyIntensityLevel(720), 6);
});

test("soma todos os registros feitos na mesma data", () => {
  const totals = studyMinutesByDate([
    { studyDate: "2026-09-20", durationMinutes: 60 },
    { studyDate: "2026-09-20", durationMinutes: 45 },
    { studyDate: "2026-09-19", durationMinutes: 30 },
    { studyDate: "data-invalida", durationMinutes: 90 },
  ]);

  assert.equal(totals.get("2026-09-20"), 105);
  assert.equal(totals.get("2026-09-19"), 30);
  assert.equal(totals.has("data-invalida"), false);
});

test("monta o último ano em semanas completas e ignora registros fora do período", () => {
  const calendar = buildStudyContributionCalendar(
    [
      { studyDate: "2025-09-20", durationMinutes: 60 },
      { studyDate: "2025-09-21", durationMinutes: 60 },
      { studyDate: "2026-09-20", durationMinutes: 301 },
    ],
    new Date(2026, 8, 20, 12),
  );
  const days = calendar.weeks.flat();

  assert.equal(calendar.rangeStart, "2025-09-21");
  assert.equal(calendar.rangeEnd, "2026-09-20");
  assert.equal(days[0].date, "2025-09-21");
  assert.equal(days.at(-1).date, "2026-09-26");
  assert.equal(calendar.weeks.length, 53);
  assert.equal(calendar.studyDays, 2);
  assert.equal(days.find((day) => day.date === "2026-09-20").level, 6);
  assert.equal(days.at(-1).isInRange, false);
});
