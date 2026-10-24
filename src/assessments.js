// Avaliações e entregas marcadas no calendário (provas, recuperação, EPs, relatórios…).
// Módulo sem DOM: catálogo de tipos, normalização e acesso ao Supabase.

export const assessmentKinds = [
  { value: "p1", label: "P1", short: "P1", group: "exam" },
  { value: "p2", label: "P2", short: "P2", group: "exam" },
  { value: "p3", label: "P3", short: "P3", group: "exam" },
  { value: "prova", label: "Outra prova", short: "Prova", group: "exam" },
  { value: "recuperacao", label: "Recuperação", short: "REC", group: "exam" },
  { value: "ep", label: "EP", short: "EP", group: "delivery" },
  { value: "relatorio", label: "Relatório", short: "Relat.", group: "delivery" },
  { value: "trabalho", label: "Trabalho / documento", short: "Trab.", group: "delivery" },
  { value: "entrega", label: "Outra entrega", short: "Entrega", group: "delivery" },
];

const kindByValue = new Map(assessmentKinds.map((kind) => [kind.value, kind]));
const columns = "id,subject_id,due_on,kind,title,notes,created_at";

export function assessmentKind(value) {
  return kindByValue.get(value) || kindByValue.get("entrega");
}

export function isExam(assessment) {
  return assessmentKind(assessment.kind).group === "exam";
}

export function normalizeAssessment(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    dueDate: row.due_on,
    kind: kindByValue.has(row.kind) ? row.kind : "entrega",
    title: String(row.title || "").trim(),
    notes: row.notes || "",
    createdAt: row.created_at || "",
  };
}

// Rótulo curto do selo no quadrado do dia: o título digitado vence quando é curto
// (ex.: "EP2"), senão usa a abreviação do tipo.
export function assessmentBadgeLabel(assessment) {
  const kind = assessmentKind(assessment.kind);
  const title = assessment.title;
  if (kind.group === "delivery" && title && title.length <= 7) return title;
  return kind.short;
}

// Nome completo: "P1", "EP — Listas ligadas", "Recuperação".
export function assessmentDisplayName(assessment) {
  const kind = assessmentKind(assessment.kind);
  const label = kind.value === "prova" ? "Prova" : kind.value === "entrega" ? "Entrega" : kind.label;
  return assessment.title ? `${label} — ${assessment.title}` : label;
}

// Provas antes de entregas; dentro do grupo, a ordem do catálogo e depois a criação.
export function compareAssessments(first, second) {
  const order = (assessment) => assessmentKinds.findIndex((kind) => kind.value === assessment.kind);
  return (
    first.dueDate.localeCompare(second.dueDate) ||
    Number(isExam(second)) - Number(isExam(first)) ||
    order(first) - order(second) ||
    first.createdAt.localeCompare(second.createdAt)
  );
}

// Dias entre hoje e a data (ambas "AAAA-MM-DD"), sem depender do fuso.
export function daysUntil(dueDate, today) {
  const toUtc = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(dueDate) - toUtc(today)) / 86400000);
}

export function formatDaysUntil(days) {
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === -1) return "ontem";
  return days > 0 ? `em ${days} dias` : `há ${-days} dias`;
}

// A tabela é criada por migration aplicada à mão no Supabase. Enquanto ela não existir,
// o resto do app precisa continuar funcionando.
export function isMissingAssessmentsTable(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  return (
    ["42P01", "PGRST205"].includes(error?.code) ||
    (/assessments/i.test(message) && /does not exist|could not find/i.test(message))
  );
}

export async function fetchAssessments(client) {
  const result = await client
    .from("assessments")
    .select(columns)
    .order("due_on", { ascending: true });
  if (isMissingAssessmentsTable(result.error)) return { rows: [], available: false };
  if (result.error) throw result.error;
  return { rows: result.data, available: true };
}

export async function saveAssessment(client, values, assessmentId) {
  const table = client.from("assessments");
  const request = assessmentId
    ? table.update(values).eq("id", assessmentId)
    : table.insert(values);
  const result = await request.select(columns);
  if (result.error) throw result.error;
  return result.data[0];
}

export async function deleteAssessment(client, assessmentId) {
  const result = await client.from("assessments").delete().eq("id", assessmentId);
  if (result.error) throw result.error;
}
