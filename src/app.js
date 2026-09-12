import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const subjectColors = [
  { value: "#4865ff", label: "Azul índigo" },
  { value: "#9b5de5", label: "Violeta" },
  { value: "#c755a5", label: "Rosa amora" },
  { value: "#ed6a5a", label: "Coral" },
  { value: "#d99b22", label: "Âmbar" },
  { value: "#57a64e", label: "Verde folha" },
  { value: "#16a085", label: "Verde jade" },
  { value: "#2d8fb8", label: "Azul ciano" },
];
const colors = subjectColors.map((color) => color.value);
const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const routeViews = {
  "/": "calendar",
  "/historico": "history",
  "/estatisticas": "statistics",
};
const state = {
  month: new Date(),
  selectedDate: isoDate(new Date()),
  subjects: [],
  entries: [],
  view: routeViews[location.pathname] || "calendar",
};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let currentUser = null;
let toastTimer;
let authView = new URLSearchParams(location.search).get("recovery") === "1" ? "reset" : "login";
let editingEntryId = null;
let editingSubjectId = null;

function assertResult(result) {
  if (result.error) throw result.error;
  return result.data;
}

function normalizeEntry(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    studyDate: row.studied_on,
    durationMinutes: Number(row.minutes),
    studyType: row.kind === "teoria" ? "theory" : "exercises",
    notes: row.notes || "",
    createdAt: row.created_at || "",
  };
}

async function loadState() {
  if (!currentUser) return;
  try {
    const [subjectsResult, entriesResult] = await Promise.all([
      supabase.from("subjects").select("id,name,color").eq("archived", false).order("name"),
      supabase
        .from("study_logs")
        .select("id,subject_id,studied_on,minutes,kind,notes,created_at")
        .order("studied_on", { ascending: false })
        .order("id", { ascending: false }),
    ]);
    state.subjects = assertResult(subjectsResult).map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
    }));
    state.entries = assertResult(entriesResult).map(normalizeEntry);
    render();
  } catch (error) {
    console.error(error);
    showToast("Não foi possível carregar seus dados.");
    render();
  }
}

function setAuthMessage(message) {
  $("#auth-message").textContent = message;
}

function clearAuthForms() {
  $$(".auth-form").forEach((form) => form.reset());
  $$(".auth-form input").forEach((input) => {
    input.value = "";
  });
  setAuthMessage("");
}

function setAuthView(view) {
  authView = ["login", "signup", "forgot", "reset"].includes(view) ? view : "login";
  $$('[data-auth-view]').forEach((panel) => {
    panel.hidden = panel.dataset.authView !== authView;
  });
  setAuthMessage("");
}

function showSession(session) {
  currentUser = session?.user || null;
  const isPasswordRecovery = authView === "reset";
  $("#auth-screen").hidden = Boolean(currentUser) && !isPasswordRecovery;
  $("#app-shell").hidden = !currentUser || isPasswordRecovery;
  if (currentUser && !isPasswordRecovery) loadState();
  else {
    state.subjects = [];
    state.entries = [];
    render();
  }
}

async function initializeAuth() {
  setAuthView(authView);
  if (!supabase) {
    setAuthMessage("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para iniciar.");
    $$(".auth-form button, #google-sign-in").forEach((button) => {
      button.disabled = true;
    });
    return;
  }
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      setAuthView("reset");
    }
    if (event === "SIGNED_OUT") {
      clearAuthForms();
      setAuthView("login");
    }
    showSession(session);
  });
  const { data, error } = await supabase.auth.getSession();
  if (error) setAuthMessage("Não foi possível verificar sua sessão.");
  showSession(data.session);
}

function render() {
  renderSubjects();
  renderCalendar();
  renderSelectedDay();
  renderSummary();
  renderHistory();
  renderStatistics();
  renderView();
}

function renderSubjects() {
  const sortedSubjects = [...state.subjects].sort(compareSubjectsByName);
  const rows = sortedSubjects
    .map(
      (subject) =>
        `<div class="subject-row"><span class="subject-dot" style="background:${subject.color}"></span><span>${escapeHtml(subject.name)}</span></div>`,
    )
    .join("");
  $("#subject-list").innerHTML =
    rows || `<div class="subject-row"><span>Adicione sua primeira disciplina</span></div>`;
  $("#entry-subject-options").innerHTML = sortedSubjects
    .map(
      (subject) =>
        `<button class="entry-subject-option" type="button" role="option" data-entry-subject="${escapeHtml(subject.id)}" aria-selected="false"><span class="subject-dot" style="background:${safeSubjectColor(subject.color)}" aria-hidden="true"></span><span>${escapeHtml(subject.name)}</span></button>`,
    )
    .join("");
  setEntrySubject($("#entry-subject").value || sortedSubjects[0]?.id);
  $("#manage-subject-list").innerHTML =
    sortedSubjects
      .map(
        (subject) =>
          `<div class="manage-row"><span class="subject-dot" style="background:${subject.color}"></span><strong>${escapeHtml(subject.name)}</strong><div class="manage-actions"><button class="edit-subject-button" type="button" data-edit-subject="${subject.id}">Editar</button><button class="danger-button" type="button" data-delete-subject="${subject.id}">Remover</button></div></div>`,
      )
      .join("") ||
    `<div class="empty-state"><strong>Nenhuma disciplina ainda</strong><p>Crie uma acima para começar.</p></div>`;
}

function renderCalendar() {
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  $("#month-title").textContent = `${monthNames[month]} ${year}`;
  const first = new Date(year, month, 1);
  const weekStartOffset = first.getDay();
  const start = new Date(year, month, 1 - weekStartOffset);
  const today = isoDate(new Date());
  let html = "";
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = isoDate(date);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isOutsideMonth = date.getMonth() !== month;
    const isMonthBoundary =
      isOutsideMonth &&
      (date.getDate() === 1 ||
        date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
    const dayLabel = isMonthBoundary
      ? date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
      : date.getDate();
    const entries = state.entries.filter((entry) => entry.studyDate === iso);
    const chips = entries
      .slice(0, 2)
      .map((entry) => {
        const subject = subjectById(entry.subjectId);
        return `<div class="event-chip" style="--chip:${subject?.color || colors[0]}" data-duration="${formatDuration(entry.durationMinutes)}"><span>${escapeHtml(subject?.name || "Disciplina")} · ${formatDuration(entry.durationMinutes)}</span></div>`;
      })
      .join("");
    html += `<button type="button" role="gridcell" class="calendar-day ${isWeekend ? "weekend" : ""} ${isOutsideMonth ? "outside" : ""} ${iso === today ? "today" : ""} ${iso === state.selectedDate ? "selected" : ""}" data-date="${iso}" aria-label="${date.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}${entries.length ? `, ${entries.length} registros` : ""}"><span class="day-number ${isMonthBoundary ? "month-boundary" : ""}">${dayLabel}</span><div class="event-chips">${chips}${entries.length > 2 ? `<span class="more-chip">+${entries.length - 2} registros</span>` : ""}</div></button>`;
  }
  $("#calendar-grid").innerHTML = html;
}

function renderSelectedDay() {
  const date = new Date(`${state.selectedDate}T12:00:00`);
  const today = isoDate(new Date());
  $("#selected-day-title").textContent =
    state.selectedDate === today
      ? "Hoje"
      : date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const entries = state.entries.filter((entry) => entry.studyDate === state.selectedDate);
  $("#day-entries").innerHTML =
    entries
      .map((entry) => {
        const subject = subjectById(entry.subjectId);
        return `<article class="entry-card" style="--entry:${subject?.color || colors[0]}"><div class="entry-top"><strong>${escapeHtml(subject?.name || "Disciplina removida")}</strong><div class="entry-actions"><button class="edit-entry" type="button" data-edit-entry="${entry.id}" aria-label="Editar registro" title="Editar registro"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m14.5 6.5 3 3"/></svg></button><button class="delete-entry" type="button" data-delete-entry="${entry.id}" aria-label="Remover registro" title="Remover registro">×</button></div></div><div class="entry-meta">${formatDuration(entry.durationMinutes)} · ${entry.studyType === "theory" ? "Teoria" : "Exercícios"}</div>${entry.notes ? `<p class="entry-notes">${escapeHtml(entry.notes)}</p>` : ""}</article>`;
      })
      .join("") ||
    `<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/></svg></div><strong>Nenhum estudo registrado</strong><p>Adicione o que você estudou neste dia.</p></div>`;
}

function renderSummary() {
  const prefix = `${state.month.getFullYear()}-${String(state.month.getMonth() + 1).padStart(2, "0")}`;
  const entries = state.entries.filter((entry) => entry.studyDate.startsWith(prefix));
  const minutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  $("#month-total").textContent = formatDuration(minutes);
  $("#study-days").textContent = new Set(entries.map((entry) => entry.studyDate)).size;
  $("#entry-count").textContent = entries.length;
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const weekMinutes = state.entries
    .filter((entry) => {
      const entryDate = new Date(`${entry.studyDate}T12:00:00`);
      return entryDate >= monday && entryDate <= sunday;
    })
    .reduce((sum, entry) => sum + entry.durationMinutes, 0);
  $("#week-total").textContent = `${formatDuration(weekMinutes)} nesta semana`;
  $("#week-progress").style.width = `${Math.min(100, (weekMinutes / (12 * 60)) * 100)}%`;
  $("#today-label").textContent = new Date()
    .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();
}

function renderHistory() {
  const sorted = [...state.entries].sort(
    (a, b) => b.studyDate.localeCompare(a.studyDate) || b.createdAt.localeCompare(a.createdAt),
  );
  const groups = sorted.reduce((result, entry) => {
    (result[entry.studyDate] ??= []).push(entry);
    return result;
  }, {});
  $("#history-total").textContent = formatDuration(
    sorted.reduce((sum, entry) => sum + entry.durationMinutes, 0),
  );
  $("#history-list").innerHTML =
    Object.keys(groups)
      .map((date) => {
        const entries = groups[date];
        const dayTotal = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
        const subjects = [
          ...new Map(entries.map((entry) => [entry.subjectId, subjectById(entry.subjectId)])).values(),
        ];
        const entryRows = [...entries]
          .reverse()
          .map((entry) => {
            const subject = subjectById(entry.subjectId);
            return `<li><span class="history-marker" style="--entry:${subject?.color || colors[0]}"></span><div class="history-entry-content"><div class="history-entry-heading"><strong>${escapeHtml(subject?.name || "Disciplina removida")}</strong><span>${formatDuration(entry.durationMinutes)} · ${entry.studyType === "theory" ? "Teoria" : "Exercícios"}</span></div>${entry.notes ? `<p>${escapeHtml(entry.notes)}</p>` : `<p class="muted-note">Sem anotações neste registro.</p>`}</div></li>`;
          })
          .join("");
        return `<article class="history-day"><header class="history-day-header"><div><span class="history-date">${formatHistoryDate(date)}</span><div class="history-subjects">${subjects.map((subject) => `<span class="history-subject"><i style="background:${subject?.color || colors[0]}"></i>${escapeHtml(subject?.name || "Disciplina removida")}</span>`).join("")}</div></div><div class="history-day-total"><span>Total do dia</span><strong>${formatDuration(dayTotal)}</strong></div></header><ol class="history-entries">${entryRows}</ol></article>`;
      })
      .join("") ||
    `<div class="history-empty empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg></div><strong>Seu histórico começará aqui</strong><p>Quando você adicionar um registro, ele aparecerá organizado pela data de estudo.</p></div>`;
}

function renderStatistics() {
  const totals = new Map(state.subjects.map((subject) => [subject.id, 0]));
  let removedMinutes = 0;
  state.entries.forEach((entry) => {
    if (totals.has(entry.subjectId)) {
      totals.set(entry.subjectId, totals.get(entry.subjectId) + entry.durationMinutes);
    } else {
      removedMinutes += entry.durationMinutes;
    }
  });

  const rows = state.subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    color: safeSubjectColor(subject.color),
    minutes: totals.get(subject.id) || 0,
  }));
  if (removedMinutes) {
    rows.push({
      id: "removed-subjects",
      name: "Disciplinas removidas",
      color: "#9ba3b4",
      minutes: removedMinutes,
    });
  }
  rows.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, "pt-BR"));

  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const maxMinutes = Math.max(...rows.map((row) => row.minutes), 0);
  const chartRows = rows.filter((row) => row.minutes > 0);
  $("#statistics-total").textContent = formatDuration(totalMinutes);
  $("#statistics-chart").innerHTML = buildPieChart(chartRows, totalMinutes);
  $("#statistics-subjects").innerHTML = rows.length
    ? rows
        .map(
          (row) =>
            `<div class="statistics-subject-row"><div class="statistics-subject-heading"><span class="subject-dot" style="background:${row.color}"></span><strong>${escapeHtml(row.name)}</strong><span>${formatDuration(row.minutes)}</span></div><div class="statistics-progress" aria-hidden="true"><span style="--subject-progress:${maxMinutes ? (row.minutes / maxMinutes) * 100 : 0}%;--subject-color:${row.color}"></span></div></div>`,
        )
        .join("")
    : `<div class="statistics-empty empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 1-9 9h9V3Z"/><path d="M16 4.1A9 9 0 0 1 19.9 8H16V4.1Z"/></svg></div><strong>Nenhuma disciplina ainda</strong><p>Crie uma disciplina para começar a acompanhar suas estatísticas.</p></div>`;
}

function buildPieChart(rows, totalMinutes) {
  if (!totalMinutes) {
    return `<div class="statistics-chart-empty"><div class="statistics-empty-pie" aria-hidden="true"></div><strong>Seu gráfico começará aqui</strong><p>Registre algum tempo de estudo para visualizar a distribuição.</p></div>`;
  }

  let startAngle = -90;
  const slices = rows
    .map((row) => {
      const ratio = row.minutes / totalMinutes;
      const endAngle = startAngle + ratio * 360;
      const title = `${escapeHtml(row.name)}: ${formatDuration(row.minutes)} (${formatPercentage(ratio)})`;
      let shape;
      if (rows.length === 1) {
        shape = `<circle cx="120" cy="120" r="108" fill="${row.color}"><title>${title}</title></circle>`;
      } else {
        const start = polarPoint(120, 120, 108, startAngle);
        const end = polarPoint(120, 120, 108, endAngle);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        shape = `<path d="M 120 120 L ${start.x} ${start.y} A 108 108 0 ${largeArc} 1 ${end.x} ${end.y} Z" fill="${row.color}"><title>${title}</title></path>`;
      }
      if (ratio >= 0.075) {
        const labelPoint =
          rows.length === 1
            ? { x: 120, y: 120 }
            : polarPoint(120, 120, 63, startAngle + ratio * 180);
        shape += `<text class="statistics-pie-label" x="${labelPoint.x}" y="${labelPoint.y}">${formatPercentage(ratio)}</text>`;
      }
      startAngle = endAngle;
      return shape;
    })
    .join("");

  const description = rows
    .map((row) => `${row.name}: ${formatDuration(row.minutes)}`)
    .join(", ");
  return `<svg class="statistics-pie" viewBox="0 0 240 240" role="img" aria-label="Distribuição do tempo estudado. ${escapeHtml(description)}">${slices}</svg>`;
}

function polarPoint(centerX, centerY, radius, angle) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: (centerX + radius * Math.cos(radians)).toFixed(3),
    y: (centerY + radius * Math.sin(radians)).toFixed(3),
  };
}

function formatPercentage(ratio) {
  return `${(ratio * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function safeSubjectColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? value : colors[0];
}

function renderView() {
  const isHistory = state.view === "history";
  const isStatistics = state.view === "statistics";
  $("#calendar-view").hidden = isHistory || isStatistics;
  $("#history-view").hidden = !isHistory;
  $("#statistics-view").hidden = !isStatistics;
  $("#page-title").textContent = isHistory
    ? "Seu histórico"
    : isStatistics
      ? "Suas estatísticas"
      : "Seu mês de estudos";
  $$('[data-view-link]').forEach((link) => {
    const active = link.dataset.viewLink === state.view;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function setView(view, { updateUrl = true } = {}) {
  state.view = ["calendar", "history", "statistics"].includes(view) ? view : "calendar";
  if (updateUrl) {
    const path = Object.keys(routeViews).find((route) => routeViews[route] === state.view) || "/";
    history.pushState({ view: state.view }, "", path);
  }
  renderView();
  if (state.view === "history") renderHistory();
  if (state.view === "statistics") renderStatistics();
}

function openEntry(date = state.selectedDate, entry = null) {
  if (!state.subjects.length) {
    openSubjects();
    showToast("Crie uma disciplina antes do primeiro registro.");
    return;
  }
  const form = $("#entry-form");
  form.reset();
  editingEntryId = entry?.id || null;
  const studyDate = entry?.studyDate || date;
  $("#entry-date").value = formatBrazilianDate(studyDate);
  $("#entry-date-picker").value = studyDate;
  setEntrySubject(
    entry?.subjectId || [...state.subjects].sort(compareSubjectsByName)[0].id,
  );
  if (entry) {
    form.elements.hours.value = Math.floor(entry.durationMinutes / 60);
    form.elements.minutes.value = entry.durationMinutes % 60;
    form.elements.type.value = entry.studyType;
    form.elements.notes.value = entry.notes;
  }
  $("#entry-dialog-eyebrow").textContent = entry ? "EDITAR REGISTRO" : "NOVO REGISTRO";
  $("#entry-dialog-title").textContent = entry ? "Atualize seu estudo" : "O que você estudou?";
  $("#entry-submit").textContent = entry ? "Salvar alterações" : "Salvar registro";
  $("#entry-submit").disabled = false;
  $("#entry-error").textContent = "";
  $("#entry-dialog").showModal();
}

function setEntrySubject(subjectId) {
  const subject = state.subjects.find((item) => String(item.id) === String(subjectId));
  const input = $("#entry-subject");
  const trigger = $("#entry-subject-trigger");
  const swatch = $("#entry-subject-swatch");
  const value = subject ? String(subject.id) : "";
  input.value = value;
  input.setAttribute("value", value);
  trigger.disabled = !subject;
  $("#entry-subject-label").textContent = subject?.name || "Selecione uma disciplina";
  swatch.hidden = !subject;
  swatch.style.background = subject ? safeSubjectColor(subject.color) : "";
  $$('[data-entry-subject]').forEach((option) => {
    option.setAttribute(
      "aria-selected",
      String(subject && String(option.dataset.entrySubject) === String(subject.id)),
    );
  });
}

function closeEntrySubjectOptions({ focusTrigger = false } = {}) {
  $("#entry-subject-options").hidden = true;
  $("#entry-subject-trigger").setAttribute("aria-expanded", "false");
  if (focusTrigger) $("#entry-subject-trigger").focus();
}

function openEntrySubjectOptions() {
  const options = $("#entry-subject-options");
  if (!state.subjects.length) return;
  options.hidden = false;
  $("#entry-subject-trigger").setAttribute("aria-expanded", "true");
  (options.querySelector('[aria-selected="true"]') || options.firstElementChild)?.focus();
}

function renderSubjectColorOptions() {
  $("#subject-color-options").innerHTML = subjectColors
    .map(
      (color) =>
        `<button class="color-option" type="button" role="option" data-subject-color="${color.value}" aria-selected="false"><span class="color-swatch" style="--subject-color:${color.value}" aria-hidden="true"></span><span>${color.label}</span></button>`,
    )
    .join("");
  setSubjectColor(colors[0]);
}

function setSubjectColor(value) {
  const color =
    subjectColors.find((item) => item.value === value) || {
      value,
      label: value === "#e3a008" ? "Amarelo atual" : "Cor atual",
    };
  $("#subject-color").value = color.value;
  $("#subject-color-label").textContent = color.label;
  $("#subject-color-swatch").style.setProperty("--subject-color", color.value);
  $("#subject-color-trigger").setAttribute("aria-label", `Cor da disciplina: ${color.label}`);
  $$("[data-subject-color]").forEach((option) => {
    option.setAttribute("aria-selected", String(option.dataset.subjectColor === color.value));
  });
}

function closeSubjectColorOptions({ focusTrigger = false } = {}) {
  $("#subject-color-options").hidden = true;
  $("#subject-color-trigger").setAttribute("aria-expanded", "false");
  if (focusTrigger) $("#subject-color-trigger").focus();
}

function openSubjectColorOptions() {
  const options = $("#subject-color-options");
  options.hidden = false;
  $("#subject-color-trigger").setAttribute("aria-expanded", "true");
  (options.querySelector('[aria-selected="true"]') || options.firstElementChild)?.focus();
}

function resetSubjectForm() {
  editingSubjectId = null;
  $("#subject-form").reset();
  setSubjectColor(colors[0]);
  closeSubjectColorOptions();
  $("#subject-submit").textContent = "Adicionar";
  $("#subject-edit-bar").hidden = true;
  $("#subject-edit-label").textContent = "";
  $("#subject-error").textContent = "";
}

function startSubjectEdit(subject) {
  editingSubjectId = subject.id;
  closeSubjectColorOptions();
  const nameInput = $("#subject-form").elements.subjectName;
  nameInput.value = subject.name;
  setSubjectColor(subject.color);
  $("#subject-submit").textContent = "Salvar";
  $("#subject-edit-label").textContent = `Editando ${subject.name}`;
  $("#subject-edit-bar").hidden = false;
  $("#subject-error").textContent = "";
  $("#subjects-dialog .modal-card").scrollTop = 0;
  nameInput.focus();
  nameInput.select();
}

function openSubjects() {
  resetSubjectForm();
  $("#subjects-dialog").showModal();
}

$("#google-sign-in").addEventListener("click", async () => {
  if (!supabase) return;
  const button = $("#google-sign-in");
  button.disabled = true;
  setAuthMessage("Abrindo o acesso com Google…");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin },
  });
  if (error) {
    console.error(error);
    button.disabled = false;
    setAuthMessage("Não foi possível iniciar o acesso com Google.");
  }
});

$$('[data-auth-target]').forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (link.dataset.authTarget === "forgot") {
      $("#forgot-email").value = $("#login-email").value;
    }
    setAuthView(link.dataset.authTarget);
  }),
);

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const button = formElement.querySelector('button[type="submit"]');
  button.disabled = true;
  setAuthMessage("Entrando…");
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")).trim(),
    password: String(form.get("password")),
  });
  button.disabled = false;
  if (error) {
    console.error(error);
    setAuthMessage("Não foi possível entrar. Confira seu e-mail e sua senha.");
  }
});

$("#signup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const password = String(form.get("password"));
  const passwordConfirmation = String(form.get("passwordConfirmation"));
  if (password !== passwordConfirmation) {
    setAuthMessage("As senhas informadas não são iguais.");
    return;
  }
  const button = formElement.querySelector('button[type="submit"]');
  button.disabled = true;
  setAuthMessage("Criando sua conta…");
  const { data, error } = await supabase.auth.signUp({
    email: String(form.get("email")).trim(),
    password,
    options: { emailRedirectTo: location.origin },
  });
  button.disabled = false;
  if (error) {
    console.error(error);
    setAuthMessage("Não foi possível criar a conta. Confira os dados e tente novamente.");
    return;
  }
  formElement.reset();
  if (!data.session) {
    setAuthView("login");
    setAuthMessage("Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.");
  }
});

$("#forgot-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const button = formElement.querySelector('button[type="submit"]');
  button.disabled = true;
  setAuthMessage("Enviando o link de recuperação…");
  const { error } = await supabase.auth.resetPasswordForEmail(
    String(form.get("email")).trim(),
    { redirectTo: `${location.origin}/?recovery=1` },
  );
  button.disabled = false;
  if (error) {
    console.error(error);
    setAuthMessage("Não foi possível enviar o link. Tente novamente em alguns instantes.");
    return;
  }
  setAuthMessage("Se existir uma conta com esse e-mail, enviaremos um link de recuperação.");
});

$("#reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const password = String(form.get("password"));
  const passwordConfirmation = String(form.get("passwordConfirmation"));
  if (password !== passwordConfirmation) {
    setAuthMessage("As senhas informadas não são iguais.");
    return;
  }
  const button = formElement.querySelector('button[type="submit"]');
  button.disabled = true;
  setAuthMessage("Atualizando sua senha…");
  const { error } = await supabase.auth.updateUser({ password });
  button.disabled = false;
  if (error) {
    console.error(error);
    setAuthMessage("Não foi possível atualizar a senha. Solicite um novo link de recuperação.");
    return;
  }
  const url = new URL(location.href);
  url.searchParams.delete("recovery");
  history.replaceState({}, "", `${url.pathname}${url.search}`);
  authView = "login";
  const { data } = await supabase.auth.getSession();
  showSession(data.session);
  showToast("Senha atualizada com sucesso.");
});

$("#sign-out").addEventListener("click", async () => {
  clearAuthForms();
  setAuthView("login");
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error(error);
    showToast("Não foi possível sair. Tente novamente.");
  }
});
$("#calendar-grid").addEventListener("click", (event) => {
  const cell = event.target.closest("[data-date]");
  if (!cell) return;
  state.selectedDate = cell.dataset.date;
  renderCalendar();
  renderSelectedDay();
});
$$('[data-view-link]').forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setView(link.dataset.viewLink);
  }),
);
window.addEventListener("popstate", () =>
  setView(routeViews[location.pathname] || "calendar", { updateUrl: false }),
);
$("#prev-month").addEventListener("click", () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
  renderCalendar();
  renderSummary();
});
$("#next-month").addEventListener("click", () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
  renderCalendar();
  renderSummary();
});
$("#go-today").addEventListener("click", () => {
  state.month = new Date();
  state.selectedDate = isoDate(new Date());
  render();
});
$("#new-entry").addEventListener("click", () => openEntry());
$("#add-selected").addEventListener("click", () => openEntry());
$("#manage-subjects").addEventListener("click", openSubjects);
$("#mobile-subjects").addEventListener("click", openSubjects);
$$('.close-dialog').forEach((button) =>
  button.addEventListener("click", () => $("#entry-dialog").close()),
);
$$('.close-subjects').forEach((button) =>
  button.addEventListener("click", () => {
    closeSubjectColorOptions();
    $("#subjects-dialog").close();
  }),
);
$("#subjects-dialog").addEventListener("close", resetSubjectForm);

$("#entry-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const studyDate = parseBrazilianDate(form.get("date"));
  if (!studyDate) {
    $("#entry-error").textContent = "Informe uma data válida no formato dd/mm/aaaa.";
    $("#entry-date").focus();
    return;
  }
  const durationMinutes = Number(form.get("hours")) * 60 + Number(form.get("minutes"));
  if (durationMinutes < 1) {
    $("#entry-error").textContent = "Informe pelo menos 1 minuto de estudo.";
    return;
  }
  const entryId = editingEntryId;
  const submitButton = $("#entry-submit");
  const submitLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Salvando…";
  try {
    const values = {
      subject_id: form.get("subjectId"),
      studied_on: studyDate,
      minutes: durationMinutes,
      kind: form.get("type") === "theory" ? "teoria" : "exercicios",
      notes: form.get("notes"),
    };
    let request = supabase.from("study_logs");
    request = entryId
      ? request.update(values).eq("id", entryId)
      : request.insert({ user_id: currentUser.id, ...values });
    const rows = assertResult(
      await request.select("id,subject_id,studied_on,minutes,kind,notes,created_at"),
    );
    const entry = normalizeEntry(rows[0]);
    if (entryId) {
      state.entries = state.entries.map((item) => (item.id === entryId ? entry : item));
    } else {
      state.entries.push(entry);
    }
    state.selectedDate = entry.studyDate;
    state.month = new Date(`${entry.studyDate}T12:00:00`);
    $("#entry-dialog").close();
    render();
    showToast(entryId ? "Registro atualizado." : "Registro salvo.");
  } catch (error) {
    console.error(error);
    $("#entry-error").textContent = entryId
      ? "Não foi possível atualizar o registro."
      : "Não foi possível salvar o registro.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = submitLabel;
  }
});

$("#entry-date").addEventListener("input", (event) => {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
  event.target.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join("/");
});

$("#open-date-picker").addEventListener("click", () => {
  const picker = $("#entry-date-picker");
  const typedDate = parseBrazilianDate($("#entry-date").value);
  if (typedDate) picker.value = typedDate;
  if (typeof picker.showPicker === "function") picker.showPicker();
  else picker.click();
});

$("#entry-date-picker").addEventListener("change", (event) => {
  if (event.target.value) $("#entry-date").value = formatBrazilianDate(event.target.value);
});

$("#subject-color-trigger").addEventListener("click", () => {
  if ($("#subject-color-options").hidden) openSubjectColorOptions();
  else closeSubjectColorOptions();
});

$("#entry-subject-trigger").addEventListener("click", () => {
  if ($("#entry-subject-options").hidden) openEntrySubjectOptions();
  else closeEntrySubjectOptions();
});

$("#entry-subject-options").addEventListener("click", (event) => {
  const option = event.target.closest("[data-entry-subject]");
  if (!option) return;
  setEntrySubject(option.dataset.entrySubject);
  closeEntrySubjectOptions({ focusTrigger: true });
});

$(".entry-subject-select").addEventListener("keydown", (event) => {
  const options = $$('[data-entry-subject]');
  if (!options.length) return;
  if (event.key === "Tab") {
    closeEntrySubjectOptions();
    return;
  }
  if (event.key === "Escape") {
    closeEntrySubjectOptions({ focusTrigger: true });
    return;
  }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if ($("#entry-subject-options").hidden) {
    openEntrySubjectOptions();
    return;
  }
  const currentIndex = options.indexOf(document.activeElement);
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1) % options.length
          : (currentIndex - 1 + options.length) % options.length;
  options[nextIndex].focus();
});

$("#subject-color-options").addEventListener("click", (event) => {
  const option = event.target.closest("[data-subject-color]");
  if (!option) return;
  setSubjectColor(option.dataset.subjectColor);
  closeSubjectColorOptions({ focusTrigger: true });
});

$(".color-select").addEventListener("keydown", (event) => {
  const options = $$("[data-subject-color]");
  if (event.key === "Tab") {
    closeSubjectColorOptions();
    return;
  }
  if (event.key === "Escape") {
    closeSubjectColorOptions({ focusTrigger: true });
    return;
  }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if ($("#subject-color-options").hidden) {
    openSubjectColorOptions();
    return;
  }
  const currentIndex = options.indexOf(document.activeElement);
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1) % options.length
          : (currentIndex - 1 + options.length) % options.length;
  options[nextIndex].focus();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".color-select")) closeSubjectColorOptions();
  if (!event.target.closest(".entry-subject-select")) closeEntrySubjectOptions();
});

$("#entry-dialog").addEventListener("close", closeEntrySubjectOptions);

$("#subject-cancel-edit").addEventListener("click", () => {
  resetSubjectForm();
  $("#subject-form").elements.subjectName.focus();
});

$("#subject-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const subjectId = editingSubjectId;
  const submitButton = $("#subject-submit");
  const submitLabel = submitButton.textContent;
  $("#subject-error").textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "Salvando…";
  let saved = false;
  try {
    const values = {
      name: String(form.get("subjectName")).trim(),
      color: form.get("color"),
    };
    let request = supabase.from("subjects");
    request = subjectId
      ? request.update(values).eq("id", subjectId)
      : request.insert({ user_id: currentUser.id, ...values });
    const rows = assertResult(
      await request.select("id,name,color"),
    );
    const subject = rows[0];
    if (subjectId) {
      state.subjects = state.subjects.map((item) =>
        item.id === subjectId ? subject : item,
      );
    } else {
      state.subjects.push(subject);
    }
    state.subjects.sort(compareSubjectsByName);
    saved = true;
    resetSubjectForm();
    render();
    showToast(subjectId ? "Disciplina atualizada." : "Disciplina adicionada.");
  } catch (error) {
    console.error(error);
    $("#subject-error").textContent =
      error.code === "23505"
        ? "Você já possui uma disciplina com esse nome."
        : subjectId
          ? "Não foi possível atualizar a disciplina."
          : "Não foi possível adicionar a disciplina.";
  } finally {
    submitButton.disabled = false;
    if (!saved) submitButton.textContent = submitLabel;
  }
});

$("#manage-subject-list").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-subject]");
  if (editButton) {
    const subject = subjectById(editButton.dataset.editSubject);
    if (subject) startSubjectEdit(subject);
    return;
  }
  const button = event.target.closest("[data-delete-subject]");
  if (!button) return;
  const subject = subjectById(button.dataset.deleteSubject);
  if (!confirm(`Remover ${subject?.name}? Os registros antigos continuarão no calendário.`)) return;
  try {
    assertResult(
      await supabase
        .from("subjects")
        .update({ archived: true })
        .eq("id", button.dataset.deleteSubject),
    );
    state.subjects = state.subjects.filter(
      (item) => item.id !== button.dataset.deleteSubject,
    );
    if (editingSubjectId === button.dataset.deleteSubject) resetSubjectForm();
    render();
    showToast("Disciplina removida.");
  } catch (error) {
    console.error(error);
    showToast("Não foi possível remover a disciplina.");
  }
});

$("#day-entries").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-entry]");
  if (editButton) {
    const entry = state.entries.find((item) => item.id === editButton.dataset.editEntry);
    if (entry) openEntry(entry.studyDate, entry);
    return;
  }
  const button = event.target.closest("[data-delete-entry]");
  if (!button || !confirm("Remover este registro de estudo?")) return;
  try {
    assertResult(
      await supabase.from("study_logs").delete().eq("id", button.dataset.deleteEntry),
    );
    state.entries = state.entries.filter(
      (entry) => entry.id !== button.dataset.deleteEntry,
    );
    render();
    showToast("Registro removido.");
  } catch (error) {
    console.error(error);
    showToast("Não foi possível remover o registro.");
  }
});

function subjectById(id) {
  return state.subjects.find((subject) => subject.id === id);
}
function compareSubjectsByName(first, second) {
  return first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" });
}
function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatBrazilianDate(value) {
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}
function parseBrazilianDate(value) {
  const match = String(value).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}
function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}min` : ""}` : `${rest}min`;
}
function formatHistoryDate(value) {
  const date = new Date(`${value}T12:00:00`);
  const today = isoDate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const prefix =
    value === today
      ? "Hoje"
      : value === isoDate(yesterdayDate)
        ? "Ontem"
        : date.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${prefix}, ${date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
}
function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
}
function showToast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
}

renderSubjectColorOptions();
render();
initializeAuth();
