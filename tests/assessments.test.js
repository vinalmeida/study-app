import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentBadgeLabel,
  assessmentDisplayName,
  compareAssessments,
  daysUntil,
  fetchAssessments,
  formatDaysUntil,
  isExam,
  normalizeAssessment,
} from "../src/assessments.js";

const row = (values) =>
  normalizeAssessment({ id: "a", subject_id: "s", due_on: "2026-11-10", kind: "p1", created_at: "", ...values });

test("normaliza a linha do banco e trata tipo desconhecido como entrega", () => {
  const assessment = row({ title: "  EP2 ", notes: null, kind: "xyz" });
  assert.equal(assessment.kind, "entrega");
  assert.equal(assessment.title, "EP2");
  assert.equal(assessment.notes, "");
  assert.equal(assessment.dueDate, "2026-11-10");
});

test("selo usa a abreviação da prova e o título curto da entrega", () => {
  assert.equal(assessmentBadgeLabel(row({ kind: "p2" })), "P2");
  assert.equal(assessmentBadgeLabel(row({ kind: "recuperacao" })), "REC");
  assert.equal(assessmentBadgeLabel(row({ kind: "ep", title: "EP2" })), "EP2");
  assert.equal(assessmentBadgeLabel(row({ kind: "relatorio", title: "Relatório de laboratório" })), "Relat.");
  assert.equal(assessmentBadgeLabel(row({ kind: "p1", title: "Cap. 1" })), "P1");
});

test("nome completo combina tipo e título", () => {
  assert.equal(assessmentDisplayName(row({ kind: "p1" })), "P1");
  assert.equal(assessmentDisplayName(row({ kind: "ep", title: "Listas ligadas" })), "EP — Listas ligadas");
  assert.equal(assessmentDisplayName(row({ kind: "prova" })), "Prova");
});

test("ordena por data, com provas antes de entregas", () => {
  const items = [
    row({ id: "1", kind: "ep" }),
    row({ id: "2", kind: "p2" }),
    row({ id: "3", kind: "p1", due_on: "2026-11-11" }),
    row({ id: "4", kind: "p1" }),
  ];
  assert.deepEqual(items.sort(compareAssessments).map((item) => item.id), ["4", "2", "1", "3"]);
  assert.equal(isExam(row({ kind: "recuperacao" })), true);
  assert.equal(isExam(row({ kind: "trabalho" })), false);
});

test("conta os dias até a data sem depender do fuso", () => {
  assert.equal(daysUntil("2026-11-02", "2026-10-30"), 3);
  assert.equal(daysUntil("2026-10-29", "2026-10-30"), -1);
  assert.equal(formatDaysUntil(0), "hoje");
  assert.equal(formatDaysUntil(1), "amanhã");
  assert.equal(formatDaysUntil(5), "em 5 dias");
  assert.equal(formatDaysUntil(-3), "há 3 dias");
});

test("continua funcionando enquanto a tabela ainda não existe no Supabase", async () => {
  const client = {
    from() {
      return {
        select() {
          return {
            order() {
              return Promise.resolve({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.assessments'" } });
            },
          };
        },
      };
    },
  };
  assert.deepEqual(await fetchAssessments(client), { rows: [], available: false });
});

test("propaga outros erros de leitura", async () => {
  const client = {
    from() {
      return { select() { return { order() { return Promise.resolve({ data: null, error: { code: "500", message: "falhou" } }); } }; } };
    },
  };
  await assert.rejects(fetchAssessments(client), { message: "falhou" });
});
