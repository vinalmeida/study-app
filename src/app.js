import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const colors = ["#4865ff", "#ed6a5a", "#16a085", "#9b5de5", "#e3a008"];
const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const state = {
  month: new Date(),
  selectedDate: isoDate(new Date()),
  subjects: [],
  entries: [],
  view: location.pathname === "/historico" ? "history" : "calendar",
};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let currentUser = null;
let toastTimer;

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

function showSession(session) {
  currentUser = session?.user || null;
  $("#auth-screen").hidden = Boolean(currentUser);
  $("#app-shell").hidden = !currentUser;
  if (currentUser) loadState();
  else {
    state.subjects = [];
    state.entries = [];
    render();
  }
}

async function initializeAuth() {
  if (!supabase) {
    $("#auth-message").textContent =
      "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para iniciar.";
    $("#auth-form button").disabled = true;
    $("#google-sign-in").disabled = true;
    return;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) $("#auth-message").textContent = "Não foi possível verificar sua sessão.";
  showSession(data.session);
  supabase.auth.onAuthStateChange((_event, session) => showSession(session));
}

function render() {
  renderSubjects();
  renderCalendar();
  renderSelectedDay();
  renderSummary();
  renderHistory();
  renderView();
}

function renderSubjects() {
  const rows = state.subjects
    .map(
      (subject) =>
        `<div class="subject-row"><span class="subject-dot" style="background:${subject.color}"></span><span>${escapeHtml(subject.name)}</span></div>`,
    )
    .join("");
  $("#subject-list").innerHTML =
    rows || `<div class="subject-row"><span>Adicione sua primeira disciplina</span></div>`;
  $("#entry-subject").innerHTML = state.subjects
    .map((subject) => `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`)
    .join("");
  $("#manage-subject-list").innerHTML =
    state.subjects
      .map(
        (subject) =>
          `<div class="manage-row"><span class="subject-dot" style="background:${subject.color}"></span><strong>${escapeHtml(subject.name)}</strong><button class="danger-button" type="button" data-delete-subject="${subject.id}">Remover</button></div>`,
      )
      .join("") ||
    `<div class="empty-state"><strong>Nenhuma disciplina ainda</strong><p>Crie uma acima para começar.</p></div>`;
}

function renderCalendar() {
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  $("#month-title").textContent = `${monthNames[month]} ${year}`;
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const today = isoDate(new Date());
  let html = "";
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = isoDate(date);
    const entries = state.entries.filter((entry) => entry.studyDate === iso);
    const chips = entries
      .slice(0, 2)
      .map((entry) => {
        const subject = subjectById(entry.subjectId);
        return `<div class="event-chip" style="--chip:${subject?.color || colors[0]}" data-duration="${formatDuration(entry.durationMinutes)}"><span>${escapeHtml(subject?.name || "Disciplina")} · ${formatDuration(entry.durationMinutes)}</span></div>`;
      })
      .join("");
    html += `<button type="button" role="gridcell" class="calendar-day ${date.getMonth() !== month ? "outside" : ""} ${iso === today ? "today" : ""} ${iso === state.selectedDate ? "selected" : ""}" data-date="${iso}" aria-label="${date.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}${entries.length ? `, ${entries.length} registros` : ""}"><span class="day-number">${date.getDate()}</span><div class="event-chips">${chips}${entries.length > 2 ? `<span class="more-chip">+${entries.length - 2} registros</span>` : ""}</div></button>`;
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
        return `<article class="entry-card" style="--entry:${subject?.color || colors[0]}"><div class="entry-top"><strong>${escapeHtml(subject?.name || "Disciplina removida")}</strong><button class="delete-entry" type="button" data-delete-entry="${entry.id}" aria-label="Remover registro">×</button></div><div class="entry-meta">${formatDuration(entry.durationMinutes)} · ${entry.studyType === "theory" ? "Teoria" : "Exercícios"}</div>${entry.notes ? `<p class="entry-notes">${escapeHtml(entry.notes)}</p>` : ""}</article>`;
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

function renderView() {
  const isHistory = state.view === "history";
  $("#calendar-view").hidden = isHistory;
  $("#history-view").hidden = !isHistory;
  $("#page-title").textContent = isHistory ? "Seu histórico" : "Seu mês de estudos";
  $$('[data-view-link]').forEach((link) => {
    const active = link.dataset.viewLink === state.view;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function setView(view, { updateUrl = true } = {}) {
  state.view = view === "history" ? "history" : "calendar";
  if (updateUrl) {
    history.pushState({ view: state.view }, "", state.view === "history" ? "/historico" : "/");
  }
  renderView();
  if (state.view === "history") renderHistory();
}

function openEntry(date = state.selectedDate) {
  if (!state.subjects.length) {
    openSubjects();
    showToast("Crie uma disciplina antes do primeiro registro.");
    return;
  }
  $("#entry-form").reset();
  $("#entry-date").value = formatBrazilianDate(date);
  $("#entry-date-picker").value = date;
  $("#entry-error").textContent = "";
  $("#entry-dialog").showModal();
}

function openSubjects() {
  $("#subject-error").textContent = "";
  $("#subjects-dialog").showModal();
}

$("#google-sign-in").addEventListener("click", async () => {
  if (!supabase) return;
  const button = $("#google-sign-in");
  button.disabled = true;
  $("#auth-message").textContent = "Abrindo o acesso com Google…";
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin },
  });
  if (error) {
    console.error(error);
    button.disabled = false;
    $("#auth-message").textContent = "Não foi possível iniciar o acesso com Google.";
  }
});

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const button = event.currentTarget.querySelector("button");
  const email = String(new FormData(event.currentTarget).get("email")).trim();
  button.disabled = true;
  $("#auth-message").textContent = "Enviando seu link…";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin },
  });
  button.disabled = false;
  $("#auth-message").textContent = error
    ? "Não foi possível enviar o link. Confira o e-mail e tente novamente."
    : "Link enviado. Confira sua caixa de entrada.";
});

$("#sign-out").addEventListener("click", async () => {
  if (supabase) await supabase.auth.signOut();
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
  setView(location.pathname === "/historico" ? "history" : "calendar", { updateUrl: false }),
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
  button.addEventListener("click", () => $("#subjects-dialog").close()),
);

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
  try {
    const rows = assertResult(
      await supabase
        .from("study_logs")
        .insert({
          user_id: currentUser.id,
          subject_id: form.get("subjectId"),
          studied_on: studyDate,
          minutes: durationMinutes,
          kind: form.get("type") === "theory" ? "teoria" : "exercicios",
          notes: form.get("notes"),
        })
        .select("id,subject_id,studied_on,minutes,kind,notes,created_at"),
    );
    const entry = normalizeEntry(rows[0]);
    state.entries.push(entry);
    state.selectedDate = entry.studyDate;
    state.month = new Date(`${entry.studyDate}T12:00:00`);
    $("#entry-dialog").close();
    render();
    showToast("Registro salvo.");
  } catch (error) {
    console.error(error);
    $("#entry-error").textContent = "Não foi possível salvar o registro.";
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

$("#subject-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  $("#subject-error").textContent = "";
  try {
    const rows = assertResult(
      await supabase
        .from("subjects")
        .insert({
          user_id: currentUser.id,
          name: form.get("subjectName"),
          color: form.get("color"),
        })
        .select("id,name,color"),
    );
    const subject = rows[0];
    state.subjects.push(subject);
    state.subjects.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    formElement.reset();
    renderSubjects();
    showToast("Disciplina adicionada.");
  } catch (error) {
    console.error(error);
    $("#subject-error").textContent =
      error.code === "23505"
        ? "Você já possui uma disciplina com esse nome."
        : "Não foi possível adicionar a disciplina.";
  }
});

$("#manage-subject-list").addEventListener("click", async (event) => {
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
    render();
    showToast("Disciplina removida.");
  } catch (error) {
    console.error(error);
    showToast("Não foi possível remover a disciplina.");
  }
});

$("#day-entries").addEventListener("click", async (event) => {
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

render();
initializeAuth();
