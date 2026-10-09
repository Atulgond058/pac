const $ = (id) => document.getElementById(id);
let isTeacher = false;
let currentFilter = "Pending";

// ---- helper: call the Python API ----
async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function notify(text, type = "good") {
  const m = $("msg");
  m.textContent = text;
  m.className = "msg " + type;
  clearTimeout(notify.t);
  notify.t = setTimeout(() => m.classList.add("hidden"), 4000);
}

// ---- simple view switching ----
function show(view) {
  ["submit", "status", "login", "dashboard"].forEach((v) =>
    $("view-" + v).classList.toggle("hidden", v !== view));
  $("msg").classList.add("hidden");
  if (view === "dashboard") loadProjects();
}

function updateNav() {
  $("logoutBtn").classList.toggle("hidden", !isTeacher);
  $("teacherLink").textContent = isTeacher ? "Dashboard" : "Teacher login";
}

document.querySelectorAll("[data-view]").forEach((b) =>
  b.addEventListener("click", () => {
    const v = b.dataset.view;
    show(v === "teacher" ? (isTeacher ? "dashboard" : "login") : v);
  }));

// ---- student: submit ----
$("submitForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/projects", "POST", {
      student_name: $("student_name").value,
      roll_no: $("roll_no").value,
      project_title: $("project_title").value,
      tech_stack: $("tech_stack").value,
    });
    e.target.reset();
    notify("Project submitted. Status: Pending.");
  } catch (err) { notify(err.message, "error"); }
});

// ---- student: check status ----
$("statusForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const box = $("statusResult");
  try {
    const p = await api("/api/status/" + encodeURIComponent($("check_roll").value));
    box.replaceChildren();
    const title = document.createElement("b");
    title.textContent = p.project_title;
    const info = document.createElement("p");
    info.textContent = `${p.student_name} (${p.roll_no}) · ${p.tech_stack || "-"}`;
    box.append(title, info, tag(p.status));
    box.classList.remove("hidden");
  } catch (err) {
    box.classList.add("hidden");
    notify(err.message, "error");
  }
});

function tag(status) {
  const s = document.createElement("span");
  s.className = "tag " + status;
  s.textContent = status;
  return s;
}

// ---- teacher: login / logout ----
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/login", "POST", { username: $("username").value, password: $("password").value });
    isTeacher = true;
    e.target.reset();
    updateNav();
    show("dashboard");
  } catch (err) { notify(err.message, "error"); }
});

$("logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", "POST");
  isTeacher = false;
  updateNav();
  show("submit");
});

// ---- teacher: dashboard ----
async function loadProjects() {
  try {
    const { projects, stats } = await api("/api/projects?status=" + currentFilter);
    $("stats").textContent =
      `Pending ${stats.Pending || 0} · Approved ${stats.Approved || 0} · Rejected ${stats.Rejected || 0}`;
    renderTabs();
    renderRows(projects);
  } catch (err) {
    isTeacher = false; updateNav(); show("login"); notify(err.message, "error");
  }
}

function renderTabs() {
  const t = $("tabs");
  t.replaceChildren();
  ["Pending", "Approved", "Rejected", "All"].forEach((s) => {
    const b = document.createElement("button");
    b.textContent = s;
    if (s === currentFilter) b.className = "on";
    b.onclick = () => { currentFilter = s; loadProjects(); };
    t.append(b);
  });
}

function actionBtn(label, cls, handler) {
  const b = document.createElement("button");
  b.textContent = label;
  b.className = cls;
  b.onclick = handler;
  return b;
}

function renderRows(projects) {
  const body = $("rows");
  body.replaceChildren();
  $("empty").classList.toggle("hidden", projects.length > 0);
  projects.forEach((p) => {
    const tr = document.createElement("tr");
    [p.student_name, p.roll_no, p.project_title, p.tech_stack || "-"].forEach((v) => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.append(td);
    });
    const st = document.createElement("td");
    st.append(tag(p.status));
    const act = document.createElement("td");
    act.className = "actions";
    if (p.status !== "Approved") act.append(actionBtn("Approve", "ok", () => setStatus(p.id, "Approved")));
    if (p.status !== "Rejected") act.append(actionBtn("Reject", "bad", () => setStatus(p.id, "Rejected")));
    if (p.status === "Rejected") act.append(actionBtn("Delete", "ghost", () => remove(p.id)));
    tr.append(st, act);
    body.append(tr);
  });
}

async function setStatus(id, status) {
  try { await api("/api/projects/" + id, "PATCH", { status }); loadProjects(); }
  catch (err) { notify(err.message, "error"); }
}

async function remove(id) {
  if (!confirm("Delete this rejected project permanently?")) return;
  try { await api("/api/projects/" + id, "DELETE"); loadProjects(); }
  catch (err) { notify(err.message, "error"); }
}

// ---- on page load: restore teacher session ----
api("/api/me").then((d) => { isTeacher = d.teacher; updateNav(); }).catch(() => {});
