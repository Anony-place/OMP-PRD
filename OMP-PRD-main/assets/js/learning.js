import {
  createLocalStore,
  normalizeSelfCheck,
  gradeSelfCheck,
} from "./academy-local.mjs";
import { sectionsFor } from "./academy-content.mjs";
import { shuffledOptions } from "./academy-quiz.mjs";
import { curriculum, resolvePage } from "./academy-model.mjs";
import {
  publicView,
  workspaceView,
  modulesView,
  breadcrumbView,
  blocksView,
} from "./academy-views.mjs";
import { esc, icon, safeHttpUrl } from "./academy-ui.mjs";
/* No learner authentication. Names, progress and self-check results stay on this device. */
import { ACADEMY_CONFIG } from "./academy-config.mjs";
const SUPABASE_URL = ACADEMY_CONFIG.supabaseUrl;
const SUPABASE_PUBLISHABLE_KEY = ACADEMY_CONFIG.supabasePublishableKey;
const app = document.querySelector("#learning-app");
let browserStorage;
try {
  browserStorage = window.localStorage;
} catch {}
const local = createLocalStore(browserStorage);
let allTopics = [];

const labels = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  LAB_PENDING: "Ready to practice",
  QUIZ_AVAILABLE: "Quiz ready",
  PASSED: "Completed",
};
function state(p) {
  if (p?.passed) return "PASSED";
  if (p?.lab_completed) return "QUIZ_AVAILABLE";
  if (p?.lesson_completed) return "LAB_PENDING";
  return p?.lesson_started ? "IN_PROGRESS" : "NOT_STARTED";
}
function position(topic, section) {
  // A reading bookmark is not a completion record. Never store answers or personal data here.
  const key = `omp-academy-position:guest:${topic.id}`;
  try {
    if (section !== undefined) {
      localStorage.setItem(key, section);
      localStorage.setItem(`omp-academy-last:guest`, topic.id);
      localStorage.setItem(
        `omp-academy-course-last:guest:${topic.path_id}`,
        topic.id,
      );
    }
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
function lastTopic(courseId) {
  try {
    return (
      (courseId &&
        localStorage.getItem(`omp-academy-course-last:guest:${courseId}`)) ||
      localStorage.getItem(`omp-academy-last:guest`)
    );
  } catch {
    return null;
  }
}
function notice(message, action = "") {
  return `<div class="academy-notice" role="status">${icon("shield")}<span>${message}</span>${action}</div>`;
}
function empty(title, text, retry = false) {
  return `<div class="academy-empty">${icon("book")}<h1>${esc(title)}</h1><p>${esc(text)}</p><div class="academy-actions">${retry ? '<button class="btn btn-primary" data-retry>Try again</button>' : ""}<a class="btn btn-secondary" href="/learning">Back to Academy</a></div></div>`;
}
function updateSeo(title, description) {
  // Public metadata/canonicals are generated in HTML. Never replace a canonical
  // with another route after rendering. Certificates are explicitly noindex.
  if (location.pathname === "/certificate")
    document.title = `${title} | OMP Academy`;
}
async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
async function catalogue() {
  const response = await request("/assets/data/academy-catalogue.json");
  if (!response.ok) throw new Error("Published catalogue unavailable");
  return curriculum(await response.json());
}
async function progressFor(topics) {
  return new Map(topics.map((t) => [t.id, local.progress(t)]));
}
async function saveProgress(body) {
  const topic = allTopics.find((t) => t.id === body.topic_id);
  if (!topic) throw new Error("This lesson is not in the published catalogue.");
  let change;
  if (body.action === "start_lesson") change = { lesson_started: true };
  else if (body.action === "complete_lab")
    change = {
      lesson_started: true,
      lesson_completed: true,
      lab_completed: true,
    };
  else throw new Error("Unsupported local action");
  const progress = local.update(topic, change);
  storageNotice();
  return { progress };
}
function localDialog() {
  return `<dialog id="academy-account" class="academy-dialog" aria-labelledby="account-title">
    <button type="button" class="icon-btn dialog-close" data-close-account aria-label="Close device settings">${icon("close")}</button>
    <span class="academy-symbol">${icon("user")}</span><h2 id="account-title">Your learning, on this device</h2>
    <p>No login or email needed. Your optional name, bookmarks and progress stay in this browser. They do not sync between devices. Clearing site data removes them.</p>
    <form id="academy-profile-form"><label for="academy-profile-name">Your name (optional)</label><input class="input" id="academy-profile-name" maxlength="100" autocomplete="off" value="${esc(local.name())}"><button class="btn btn-primary" type="submit">Save on this device</button></form>
    <div class="academy-actions"><button class="btn btn-secondary" id="export-progress">Download backup</button><button class="btn btn-secondary" id="import-progress">Restore backup</button></div>
    <input type="file" id="progress-file" accept="application/json,.json" hidden>
    <details><summary>Reset Academy data</summary><p>This removes only your Academy name, progress and bookmarks on this device—not your theme or checklist.</p><label><input type="checkbox" id="confirm-reset">I understand this cannot be undone without a backup.</label><button class="btn btn-secondary" id="reset-progress">Clear Academy data</button></details>
    <p id="academy-auth-note" role="status" class="small"></p>
  </dialog>`;
}
function storageNotice() {
  const target = document.querySelector("#device-storage-note");
  if (!target) return;
  // "Progress stays on this device" is a property of the product, not news: it
  // is stated in Device settings, on the course pages and in the home page
  // facts. Repeating it above every lesson is noise, so the banner only speaks
  // up when storage is actually unavailable or its contents were unreadable.
  if (local.persistent && !local.damaged) {
    target.hidden = true;
    target.textContent = "";
    return;
  }
  target.hidden = false;
  target.textContent = !local.persistent
    ? "Browser storage is unavailable. Changes are kept for this tab only and may be lost on reload. Download a backup before leaving."
    : "Some saved data could not be read. Restore a backup in Device settings if you have one.";
}
function shell(data, selected, content, customSidebar = "") {
  const page = resolvePage(data, location.pathname);
  app.innerHTML =
    workspaceView(data, page, content, {
      sidebar: customSidebar,
      account: `<button class="academy-account-btn" data-account>${icon("user")}<span>Device settings</span></button>`,
      notice:
        '<p class="academy-device-note" id="device-storage-note" role="status"></p>',
    }) + localDialog();
  app.setAttribute("aria-busy", "false");
  bindCommon();
  storageNotice();
}
function bindCommon() {
  document
    .querySelectorAll("[data-retry]")
    .forEach((b) => (b.onclick = () => location.reload()));
  const dialog = document.querySelector("#academy-account");
  document
    .querySelectorAll("[data-account]")
    .forEach((b) => (b.onclick = () => dialog?.showModal()));
  document
    .querySelector("[data-close-account]")
    ?.addEventListener("click", () => dialog.close());
  const note = () => document.querySelector("#academy-auth-note");
  document
    .querySelector("#academy-profile-form")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      local.saveName(document.querySelector("#academy-profile-name").value);
      note().textContent = local.persistent
        ? "Name saved on this device. Nothing was sent to a server."
        : "Name saved for this tab only. Browser storage is unavailable.";
      storageNotice();
    });
  document.querySelector("#export-progress")?.addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(local.export(allTopics), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "omp-academy-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    note().textContent =
      "Backup downloaded. Keep it private: it contains your optional name and learning progress.";
  });
  document
    .querySelector("#import-progress")
    ?.addEventListener("click", () =>
      document.querySelector("#progress-file").click(),
    );
  document
    .querySelector("#progress-file")
    ?.addEventListener("change", async (e) => {
      try {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 2000000)
          throw new Error("Backup is too large (maximum 2 MB).");
        const n = local.import(JSON.parse(await f.text()), allTopics);
        note().textContent = `${n} matching lesson records restored${local.persistent ? " on this device" : " for this tab only"}. Reload to see updated progress.`;
        document.querySelector("#academy-profile-name").value = local.name();
        storageNotice();
      } catch (err) {
        note().textContent = err.message || "Could not read the backup.";
      }
      e.target.value = "";
    });
  document.querySelector("#reset-progress")?.addEventListener("click", () => {
    if (!document.querySelector("#confirm-reset").checked) {
      note().textContent = "Confirm the reset first.";
      return;
    }
    try {
      local.reset();
      location.reload();
    } catch (err) {
      note().textContent = err.message;
    }
  });
}
function renderPublic(data, page, pmap) {
  shell(
    data,
    page.type,
    publicView(data, page, {
      pmap,
      localProgress: true,

      lastTopic: lastTopic(page.path?.id),
    }),
  );
  if (page.type !== "path") return;
  document
    .querySelectorAll("[data-enhanced-control]")
    .forEach((el) => (el.hidden = false));
  const search = document.querySelector("#lesson-search"),
    filter = document.querySelector("#lesson-filter");
  filter.disabled = false;
  filter.title = "Filter by progress on this device";
  function update() {
    const q = search.value.trim().toLocaleLowerCase();
    const matches = (t) => {
      const st = state(pmap.get(t.id));
      return (
        `${t.name} ${t.description}`.toLocaleLowerCase().includes(q) &&
        (filter.value === "all" ||
          (filter.value === "complete" && st === "PASSED") ||
          (filter.value === "new" && st === "NOT_STARTED") ||
          (filter.value === "active" &&
            !["NOT_STARTED", "PASSED"].includes(st)))
      );
    };
    const count = page.path.topics.filter(matches).length;
    document.querySelector("#lesson-count").textContent =
      `${count} of ${page.path.topics.length} lessons`;
    document.querySelector("#category-lessons").innerHTML = count
      ? modulesView(page.path, pmap, matches)
      : '<div class="filter-empty"><h3>No lessons found</h3><p>Try another search or reset the filters.</p><button class="btn btn-secondary" id="reset-filters">Clear filters</button></div>';
    document.querySelector("#reset-filters")?.addEventListener("click", () => {
      search.value = "";
      filter.value = "all";
      update();
      search.focus();
    });
  }
  search.addEventListener("input", update);
  filter.addEventListener("change", update);
  update();
}
function quizView(quiz, p) {
  if (quiz?.unavailable)
    return notice(
      "The self-check could not load. Existing progress is unchanged.",
      '<button class="text-button" data-retry>Reload lesson</button>',
    );
  if (p.passed && !p.review)
    return `<div class="lesson-gate success-gate">${icon("check")}<h3>Lesson completed on this device</h3><p>${quiz ? `Best self-check score: ${Number(p.highest_score) || 0} / 20.` : "You marked this lesson as reviewed."} This is a personal learning record, not a server-verified certificate.</p>${quiz ? '<button class="btn btn-secondary" data-retake>Review the self-check</button>' : ""}</div>`;
  if (!quiz)
    return `<div class="lesson-gate"><h3>Reflect on what you learned</h3><p>No self-check is published for this lesson. After reviewing the material, you can mark it complete on this device. No quiz score or certificate is claimed.</p><button class="btn btn-primary" id="mark-reviewed">I’ve reviewed this lesson</button></div>`;
  if (
    !quiz ||
    !Array.isArray(quiz.questions) ||
    quiz.questions.length !== 4 ||
    quiz.passing_score !== 15 ||
    quiz.max_score !== 20 ||
    quiz.questions.some(
      (q) => !Array.isArray(q.options) || q.options.length !== 4,
    )
  )
    return notice("This quiz is being prepared. Please check back later.");
  return `<div class="quiz-intro"><span class="academy-badge">4 questions</span><span class="academy-badge">15 / 20 to pass</span><p>A practice self-check, graded in your browser. Answers are public learning material—not a secure exam. Retry whenever you like.</p></div><form id="academy-quiz" novalidate><div class="quiz-counter" role="status"></div>${quiz.questions
    .map(
      (q, i) =>
        `<fieldset class="quiz-question" data-question="${i}" ${i ? "hidden" : ""}><legend><span>QUESTION ${i + 1} OF 4</span>${esc(q.question)}</legend><div class="quiz-options">${shuffledOptions(
          q.options,
        )
          .map(
            ({ label: o, index }, j) =>
              `<label class="quiz-option"><input type="radio" name="q${i}" value="${index}"><span class="option-letter" aria-hidden="true">${"ABCD"[j]}</span><span>${esc(o)}</span></label>`,
          )
          .join("")}</div></fieldset>`,
    )
    .join(
      "",
    )}<p class="quiz-error" role="alert"></p><div class="quiz-navigation"><button class="btn btn-secondary" type="button" id="question-back" disabled>Previous</button><button class="btn btn-primary" type="button" id="question-next">Next question ${icon("arrow")}</button><button class="btn btn-primary" type="submit" hidden>Submit answers ${icon("check")}</button></div></form><div id="quiz-result" role="status" tabindex="-1"></div>`;
}
/* What the learner does next, derived only from the published curriculum. */
function nextStepFor(data, path, module, topic, passed) {
  const index = path.topics.findIndex((t) => t.id === topic.id);
  const next = path.topics[index + 1];
  const lastInModule = !next || next.module_id !== topic.module_id;
  if (!next)
    return {
      kind: "course",
      label: "COURSE COMPLETE ✓",
      title: `You've completed ${path.name}.`,
      body: `You worked through ${pluralize(path.modules.length, "module")} and ${pluralize(path.topics.length, "lesson")} in this course. Review any lesson you cannot explain in your own words, then pick your next step from the published courses.`,
      cta: "Review this course",
      href: path.url,
    };
  if (!passed)
    return {
      kind: "upcoming",
      label: "NEXT",
      title: next.name,
      body: next.description,
      cta: lastInModule ? "Start the next module" : "Next lesson",
      href: next.url,
    };
  if (lastInModule)
    return {
      kind: "module",
      label: "MODULE COMPLETE ✓",
      title: `You've completed ${module.name}.`,
      body: `Next: ${next.name}. You have finished ${module.name} and are moving into ${path.modules.find((m) => m.id === next.module_id)?.name || "the next module"}.`,
      cta: "Continue",
      href: next.url,
    };
  return {
    kind: "lesson",
    label: "LESSON COMPLETE ✓",
    title: next.name,
    body: next.description,
    cta: "Next lesson",
    href: next.url,
  };
}
const pluralize = (n, label) =>
  `${n} ${label}${n === 1 ? "" : label === "module" ? "s" : "s"}`;
function nextStepView(data, path, module, topic, passed) {
  const step = nextStepFor(data, path, module, topic, passed);
  return `<div class="lesson-next" id="lesson-next" data-kind="${step.kind}"><div class="lesson-next-label">${esc(step.label)}</div><h2>${esc(step.title)}</h2><p>${step.body}</p><a class="btn btn-primary" href="${step.href}">${esc(step.cta)} ${icon("arrow")}</a></div>`;
}
async function renderTopic(data, cat, topic, saved = {}) {
  updateSeo(topic.name, topic.content?.seo_description || topic.description);
  let p = { ...saved };
  const path = data.paths.find((path) => path.id === topic.path_id);
  const module = path.modules.find((module) => module.id === topic.module_id);
  const teaching = sectionsFor(topic),
    // "why" replaces the "overview" section, so concept count is unchanged.
    learnCount = teaching.length;
  // One consistent learning loop per lesson: why it matters, learn the concept,
  // see real examples, apply it, check understanding, then an explicit next step.
  const sections = [
    [
      "why",
      "Why this matters",
      [{ type: "paragraph", text: topic.content.overview || topic.description }],
    ],
    ...teaching
      .filter((s) => s.id !== "overview")
      .map((s) => [s.id, s.title, s.blocks]),
    ["labs", "Practice", null],
    ["quiz", "Check your understanding", null],
  ];
  const sectionKickers = {
    why: "WHY THIS MATTERS",
    "real-world": "SEE AN EXAMPLE",
    "what-to-look-for": "APPLY THIS",
    "look-for": "APPLY THIS",
    defensive: "KEY TAKEAWAYS",
    labs: "PRACTICE / APPLY",
    quiz: "CHECK YOUR UNDERSTANDING",
  };
  const nextTopic =
    path.topics[path.topics.findIndex((t) => t.id === topic.id) + 1];
  const labs = data.labs.filter(
    (l) => l.topic_id === topic.id && safeHttpUrl(l.url),
  );
  const quiz = data.selfCheckUnavailable
    ? { unavailable: true }
    : data.quizzes.find((q) => q.topic_id === topic.id);
  const outline = `<aside class="academy-sidebar lesson-sidebar"><a class="lesson-back" href="${path.url}">← Back to course</a><div class="lesson-sidebar-title"><span class="academy-kicker">${esc(path.name)}</span><strong>${esc(topic.name)}</strong><span>${esc(topic.difficulty)} · ${Number(topic.estimated_minutes) || 0} min</span></div><button class="lesson-outline-toggle" aria-expanded="false" aria-controls="lesson-outline">Lesson contents <span aria-hidden="true">⌄</span></button><nav id="lesson-outline" class="lesson-outline" aria-label="Lesson sections"><span class="academy-nav-label">LEARN</span>${sections.map(([id, title], i) => `${i === learnCount ? '<span class="academy-nav-label outline-practice-label">PRACTICE &amp; CHECK</span>' : ""}<a href="#${id}" data-outline="${id}"><span class="outline-index">${i === learnCount ? icon("lab") : i === learnCount + 1 ? icon("award") : String(i + 1).padStart(2, "0")}</span>${esc(title)}<span class="outline-current" aria-hidden="true"></span></a>`).join("")}</nav><div class="sidebar-note"><strong>Focus on understanding.</strong><p>You can move between sections at any time. Your reading position is saved on this device.</p></div></aside>`;
  shell(
    data,
    "lesson",
    `${breadcrumbView(resolvePage(data, topic.url))}<header class="lesson-heading"><div class="lesson-heading-meta"><span class="academy-badge">${esc(topic.difficulty)}</span><span>${icon("clock")}${Number(topic.estimated_minutes) || 0} min</span><span class="lesson-state" id="lesson-state">${labels[state(p)]}</span></div><h1>${esc(topic.name)}</h1><p>${esc(topic.description)}</p></header><div class="topic-context"><strong>${esc(module.name)} · Lesson ${path.topics.findIndex((t) => t.id === topic.id) + 1} of ${path.topics.length}</strong><p>${esc(module.outcome)}</p><a class="text-button" href="${path.url}#module-${module.slug}">See this lesson in the course →</a></div><div class="lesson-stage-bar" aria-label="Learning stages"><span data-stage="learn">01 <strong>Learn</strong></span><span data-stage="example">02 <strong>See examples</strong></span><span data-stage="apply">03 <strong>Apply</strong></span><span data-stage="labs">04 <strong>Practice</strong></span><span data-stage="quiz">05 <strong>Check</strong></span></div><div id="lesson-feedback" role="status"></div><div class="lesson-reader">${sections.map(([id, title, key], i) => `<section id="section-${id}" class="lesson-section" aria-labelledby="heading-${id}" hidden><div class="reader-eyebrow">${sectionKickers[id] || (i < learnCount ? `LEARN THE CONCEPT · STEP ${i + 1} OF ${learnCount}` : "CHECK YOUR UNDERSTANDING")}</div><h2 id="heading-${id}" tabindex="-1">${esc(title)}</h2>${key ? `<div class="prose learning-prose">${blocksView(key)}</div>${i === learnCount - 1 ? references(topic.content?.references) : ""}` : id === "labs" ? `<p class="reader-intro">Move from understanding to doing. Explore the resource below, then confirm you’ve completed the practice.</p><div class="lab-safety">${icon("shield")}${esc(topic.content.practice_guidance || "Use a suitable learning environment. Follow the resource’s instructions and test other people’s systems only with permission.")}</div>${labs.length ? labs.map((l) => `<div class="academy-lab"><span class="academy-kicker">${esc(l.provider)} · EXTERNAL RESOURCE</span><h3>${esc(l.title)}</h3><p>${esc(l.description)}</p><a class="btn btn-secondary" href="${esc(safeHttpUrl(l.url))}" target="_blank" rel="noopener noreferrer">Open practice resource ↗<span class="sr-only"> (opens in a new tab)</span></a></div>`).join("") + `<div class="lab-confirmation"><label><input type="checkbox" id="lab-confirm" ${p.lab_completed ? "checked disabled" : ""}>I’ve worked through the practice and reviewed the key concepts.</label><button class="btn btn-primary" id="complete-lab" ${p.lab_completed ? "disabled" : ""}>${p.lab_completed ? "Practice completed ✓" : "Save practice & continue"}${icon("arrow")}</button><p class="small muted">Practice and self-check results stay on this device. Completion is self-reported.</p><p id="lab-feedback" role="status"></p></div>` : notice("No practice resources are published for this lesson yet. Please check back later.")}` : `<div id="quiz-container">${quizView(quiz, p)}</div>`}</section>`).join("")}<footer class="reader-navigation"><button class="btn btn-secondary" id="section-back">← Previous</button><span id="section-counter"></span><button class="btn btn-primary" id="section-next">Next section ${icon("arrow")}</button></footer></div><p class="reader-footnote">${icon("shield")}Learn responsibly. Practice with permission. Build with confidence.</p><div id="lesson-next-slot">${nextStepView(data, path, module, topic, Boolean(p.passed))}</div>`,
    outline,
  );
  let current = 0;
  // Section id -> learning stage. Labs and the knowledge check are always their
  // own stage; concept sections map onto the published lesson loop. Unknown ids
  // (custom `sections` content) stay on the concept stage rather than breaking.
  const stageById = {
    why: "learn",
    "how-it-works": "learn",
    history: "learn",
    "real-world": "example",
    "look-for": "apply",
    defensive: "apply",
  };
  const stageFor = (id) =>
    id === "labs" ? "labs" : id === "quiz" ? "quiz" : stageById[id] || "learn";
  function showSection(id, focus = false) {
    let index = sections.findIndex((s) => s[0] === id);
    if (index < 0 && !topic.content.sections && /^s-0[1-8]$/.test(id))
      index = Number(id.slice(-1)) - 1; // Existing shared lesson anchors.
    current = index < 0 ? 0 : index;
    const activeId = sections[current][0];
    document.querySelectorAll(".lesson-section").forEach((el, i) => {
      el.hidden = i !== current;
    });
    document.querySelectorAll("[data-outline]").forEach((el) => {
      if (el.dataset.outline === activeId)
        el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
    const activeStage = stageFor(activeId);
    document
      .querySelectorAll("[data-stage]")
      .forEach((el) =>
        el.classList.toggle("active", el.dataset.stage === activeStage),
      );
    document.querySelector("#section-back").disabled = current === 0;
    document.querySelector("#section-next").hidden =
      current === sections.length - 1;
    document.querySelector("#section-next").innerHTML =
      (current === learnCount - 1
        ? "Continue to practice"
        : current === learnCount
          ? "Check your understanding"
          : "Next section") + icon("arrow");
    document.querySelector("#section-counter").textContent =
      `${current + 1} / ${sections.length}`;
    document.querySelector("#lesson-outline").classList.remove("is-open");
    document
      .querySelector(".lesson-outline-toggle")
      .setAttribute("aria-expanded", "false");
    position(topic, activeId);
    if (focus) document.querySelector(`#heading-${activeId}`).focus();
  }
  function go(id) {
    if (location.hash === "#" + id) showSection(id, true);
    else location.hash = id;
  }
  window.onhashchange = () => showSection(location.hash.slice(1), true);
  document
    .querySelector("#section-next")
    .addEventListener("click", () =>
      go(sections[Math.min(current + 1, sections.length - 1)][0]),
    );
  document
    .querySelector("#section-back")
    .addEventListener("click", () => go(sections[Math.max(current - 1, 0)][0]));
  document
    .querySelector(".lesson-outline-toggle")
    .addEventListener("click", (e) => {
      const open = e.currentTarget.getAttribute("aria-expanded") !== "true";
      e.currentTarget.setAttribute("aria-expanded", String(open));
      document
        .querySelector("#lesson-outline")
        .classList.toggle("is-open", open);
    });
  function refreshNextStep() {
    const slot = document.querySelector("#lesson-next-slot");
    if (slot)
      slot.innerHTML = nextStepView(
        data,
        path,
        module,
        topic,
        Boolean(p.passed),
      );
  }
  function bindQuiz() {
    document
      .querySelectorAll("[data-section-link]")
      .forEach((b) => (b.onclick = () => go(b.dataset.sectionLink)));
    document
      .querySelectorAll("#quiz-container [data-account]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            document.querySelector("#academy-account").showModal()),
      );
    document
      .querySelectorAll("#quiz-container [data-retry]")
      .forEach((b) => (b.onclick = () => location.reload()));
    const form = document.querySelector("#academy-quiz");
    if (form)
      bindQuizForm(form, topic, p, quiz, (result) => {
        p = { ...p, ...result.progress };
        if (result.status === "PASSED") p.passed = true;
        document.querySelector("#lesson-state").textContent = labels[state(p)];
        refreshNextStep();
      });
    document.querySelector("[data-retake]")?.addEventListener("click", () => {
      document.querySelector("#quiz-container").innerHTML = quizView(quiz, {
        ...p,
        review: true,
      });
      bindQuiz();
    });
    document.querySelector("#mark-reviewed")?.addEventListener("click", () => {
      p = local.update(topic, {
        lesson_started: true,
        lesson_completed: true,
        passed: true,
        completed_at: new Date().toISOString(),
      });
      document.querySelector("#lesson-state").textContent = labels[state(p)];
      document.querySelector("#quiz-container").innerHTML = quizView(quiz, p);
      refreshNextStep();
      storageNotice();
    });
  }
  showSection(
    location.hash.slice(1) ||
      position(topic) ||
      (p.lab_completed ? "quiz" : p.lesson_completed ? "labs" : "why"),
  );
  bindQuiz();
  refreshNextStep();
  document
    .querySelector("#complete-lab")
    ?.addEventListener("click", async (e) => {
      const btn = e.currentTarget,
        feedback = document.querySelector("#lab-feedback");
      if (!document.querySelector("#lab-confirm").checked) {
        feedback.textContent =
          "Please confirm you’ve worked through the practice first.";
        document.querySelector("#lab-confirm").focus();
        return;
      }
      if (btn.disabled) return;
      btn.disabled = true;
      feedback.textContent = "Saving your practice…";
      try {
        const result = await saveProgress({
          action: "complete_lab",
          topic_id: topic.id,
        });
        if (!result.progress?.lab_completed)
          throw new Error("Practice was not saved. Please try again.");
        p = { ...p, ...result.progress };
        document.querySelector("#lesson-state").textContent = labels[state(p)];
        btn.textContent = "Practice completed ✓";
        feedback.textContent = "Saved on this device.";
        document.querySelector("#lab-confirm").disabled = true;
        document.querySelector("#quiz-container").innerHTML = quizView(quiz, p);
        bindQuiz();
        go("quiz");
      } catch (err) {
        feedback.textContent = err.message;
        btn.disabled = false;
      }
    });
  if (!p.lesson_started) {
    try {
      const result = await saveProgress({
        action: "start_lesson",
        topic_id: topic.id,
      });
      // Do not overwrite a newer lab/quiz result if this request finishes late.
      p.lesson_started = Boolean(result.progress?.lesson_started);
      document.querySelector("#lesson-state").textContent = labels[state(p)];
    } catch {
      document.querySelector("#lesson-feedback").innerHTML = notice(
        "We could not update your local lesson record. You can keep reading.",
      );
    }
  }
}
function references(urls) {
  const safe = (Array.isArray(urls) ? urls : [])
    .map(safeHttpUrl)
    .filter(Boolean);
  return safe.length
    ? `<details class="lesson-references"><summary>Sources & further reading <span>${safe.length} resources</span></summary><ul>${safe.map((url) => `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(url).hostname + new URL(url).pathname)} ↗<span class="sr-only"> (opens in a new tab)</span></a></li>`).join("")}</ul></details>`
    : "";
}
function bindQuizForm(form, topic, p, quiz, onResult) {
  let question = 0,
    submitting = false;
  const back = form.querySelector("#question-back"),
    next = form.querySelector("#question-next"),
    submit = form.querySelector('[type="submit"]'),
    error = form.querySelector(".quiz-error");
  const selected = (i) => form.querySelector(`input[name="q${i}"]:checked`);
  function show(focus = true) {
    form.querySelectorAll("[data-question]").forEach((el, i) => {
      el.hidden = i !== question;
    });
    back.disabled = question === 0;
    next.hidden = question === 3;
    submit.hidden = question !== 3;
    form.querySelector(".quiz-counter").textContent =
      `${question + 1} of 4 questions`;
    error.textContent = "";
    if (focus)
      form.querySelector(`[data-question="${question}"] input`).focus();
  }
  next.addEventListener("click", () => {
    if (!selected(question)) {
      error.textContent = "Choose an answer to continue.";
      return;
    }
    question++;
    show();
  });
  back.addEventListener("click", () => {
    question--;
    show();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting) return;
    for (let i = 0; i < 4; i++)
      if (!selected(i)) {
        question = i;
        show();
        error.textContent =
          "Choose an answer for every question before submitting.";
        return;
      }
    submitting = true;
    submit.disabled = true;
    back.disabled = true;
    submit.textContent = "Checking answers…";
    error.textContent = "";
    form.querySelectorAll("input").forEach((el) => {
      el.disabled = true;
    });
    try {
      const answers = [0, 1, 2, 3].map((i) => Number(selected(i).value));
      const score = gradeSelfCheck(quiz, answers);
      const old = local.progress(topic);
      const progress = local.update(topic, {
        lesson_started: true,
        lesson_completed: true,
        passed: old.passed || score >= 15,
        highest_score: Math.max(old.highest_score || 0, score),
        attempts: (old.attempts || 0) + 1,
        completed_at:
          old.completed_at || (score >= 15 ? new Date().toISOString() : null),
      });
      onResult({ status: progress.passed ? "PASSED" : "REVIEW", progress });
      storageNotice();
      form.hidden = true;
      const target = document.querySelector("#quiz-result");
      target.innerHTML = `<div class="lesson-gate ${score >= 15 ? "success-gate" : ""}"><h3>${score >= 15 ? "Self-check complete" : "Keep practicing"}</h3><p>Score: <strong>${score} / 20</strong>. ${local.persistent ? "Saved on this device." : "Kept for this tab only."} ${score < 15 ? "Aim for 15 / 20; you can retry immediately." : "This is a personal practice result, not a verified certificate."}</p><ol>${quiz.questions.map((q, i) => `<li><strong>${answers[i] === q.answer ? "Correct" : "Review"}: ${esc(q.question)}</strong><p>${esc(q.explanation)}</p></li>`).join("")}</ol><button class="btn btn-secondary" data-retake-result>Try the self-check again</button><a class="text-button" href="${esc(location.pathname.split("/").slice(0, -1).join("/"))}">Return to this course →</a></div>`;
      target.querySelector("[data-retake-result]").onclick = () => {
        document.querySelector("#quiz-container").innerHTML = quizView(quiz, {
          ...progress,
          review: true,
        });
        bindQuizForm(
          document.querySelector("#academy-quiz"),
          topic,
          progress,
          quiz,
          onResult,
        );
      };
      target.focus();
    } catch (err) {
      error.textContent =
        err.message || "Could not submit answers. Please try again.";
      submitting = false;
      submit.disabled = false;
      back.disabled = question === 0;
      submit.textContent = "Try submitting again";
      form.querySelectorAll("input").forEach((el) => {
        el.disabled = false;
      });
    }
  });
  show(false);
}
async function renderCertificate(id) {
  app.setAttribute("aria-busy", "false");
  if (!id) {
    app.innerHTML = empty(
      "Certificate ID required",
      "Open a certificate using its verification link.",
    );
    return;
  }
  app.innerHTML =
    '<div class="academy-loading" role="status"><span class="loading-orbit" aria-hidden="true"></span><h1>Verifying certificate</h1><p>Checking this achievement with the Academy.</p></div>';
  try {
    const response = await request(
      `${SUPABASE_URL}/functions/v1/learning-certificate-verify?certificate_id=${encodeURIComponent(id)}`,
      { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } },
    );
    const result = await response.json();
    if (response.status === 400 || response.status === 404) {
      app.innerHTML = empty(
        "Certificate not found",
        "This certificate could not be verified. Check the ID in your link and try again.",
      );
      return;
    }
    if (!response.ok || !result.valid || !result.certificate)
      throw new Error("Verification service unavailable");
    const c = result.certificate;
    updateSeo(
      `Certificate · ${c.topic_name}`,
      "A verified OopsMyPassword Academy learning achievement.",
    );
    app.innerHTML = `<section class="certificate-shell"><span class="academy-kicker">OOPSMYPASSWORD · ACADEMY</span><div class="certificate-seal">${icon("award")}</div><h1>Lesson completion certificate</h1><p>This certifies that</p><h2 class="certificate-name">${esc(c.recipient_name)}</h2><p>has successfully completed</p><h3>${esc(c.topic_name)}</h3>${c.course_name ? `<p class="certificate-course">A lesson in <strong>${esc(c.course_name)}</strong></p>` : ""}<p>${esc(c.category_name)} · Score ${Number(c.score)} / 20</p><div class="certificate-meta"><span>Issued ${esc(new Date(c.issued_at).toLocaleDateString())}</span><span>Certificate ID: ${esc(c.certificate_id)}</span></div><div class="academy-actions"><button class="btn btn-primary" id="share-cert">Share achievement</button><a class="btn btn-secondary" href="/learning">Back to Academy</a></div><p id="cert-share-note" role="status"></p></section>`;
    document
      .querySelector("#share-cert")
      .addEventListener("click", async () => {
        try {
          if (navigator.share)
            await navigator.share({
              title: "OMP Academy Certificate",
              text: `${c.recipient_name} completed ${c.topic_name}`,
              url: location.href,
            });
          else {
            await navigator.clipboard.writeText(location.href);
            document.querySelector("#cert-share-note").textContent =
              "Certificate link copied.";
          }
        } catch (err) {
          if (err.name !== "AbortError")
            document.querySelector("#cert-share-note").textContent =
              "Couldn’t share automatically. Copy the page URL to share your certificate.";
        }
      });
  } catch {
    app.innerHTML = empty(
      "Verification is temporarily unavailable",
      "We couldn’t reach the verification service. Please try again shortly.",
      true,
    );
    bindCommon();
  }
}
async function init() {
  if (location.pathname === "/certificate")
    return renderCertificate(new URLSearchParams(location.search).get("id"));
  let data;
  try {
    data = await catalogue();
    const page = resolvePage(data, location.pathname);
    if (page.type === "redirect") {
      location.replace(page.url + location.hash);
      return;
    }
    if (page.type === "notfound") return;
    allTopics = data.topics;
    // Discovery pages (home, learning path) render per-course progress, so they
    // need the whole published catalogue. Lesson/course pages stay scoped to
    // their own lessons.
    const pmap = await progressFor(
      page.topic
        ? [page.topic]
        : ["overview", "roadmap", "category", "category-roadmap"].includes(
              page.type,
            )
          ? data.topics
          : page.path?.topics || [],
    );
    if (page.topic) {
      let check = page.topic.content.self_check;
      if (!check) {
        try {
          const response = await request(
            "/assets/data/academy-self-checks.json",
          );
          if (!response.ok) throw new Error("Self-check unavailable");
          check = (await response.json())[page.topic.id];
        } catch {
          data.selfCheckUnavailable = true;
        }
      }
      if (check) {
        try {
          data.quizzes = [
            { ...normalizeSelfCheck(check), topic_id: page.topic.id },
          ];
        } catch {
          data.selfCheckUnavailable = true;
        }
      }
    }
    if (page.type === "lesson")
      await renderTopic(
        data,
        page.category,
        page.topic,
        pmap.get(page.topic.id),
      );
    else renderPublic(data, page, pmap);
    if (location.hash === "#account")
      document.querySelector("#academy-account")?.showModal();
  } catch (error) {
    // Keep the server-rendered public content if enhancement cannot initialize.
    // Log the cause: a swallowed error here is indistinguishable from a
    // rendering bug when it happens in production.
    console.error("Academy reader failed to initialise", error);
    app.insertAdjacentHTML(
      "afterbegin",
      notice(
        "The interactive reader couldn’t load. You can still read the full published lesson below.",
        '<button class="text-button" data-retry>Try again</button>',
      ),
    );
    app.setAttribute("aria-busy", "false");
    document
      .querySelectorAll("[data-retry]")
      .forEach((button) => (button.onclick = () => location.reload()));
  }
}
init();
