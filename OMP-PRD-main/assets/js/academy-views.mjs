import { ROOT, minutes, breadcrumbs, recommended } from "./academy-model.mjs";
import { sectionsFor } from "./academy-content.mjs";
import { esc, icon, safeHttpUrl } from "./academy-ui.mjs";
export { esc, icon };
const list = (values) =>
  `<ul>${values.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>`;
const plural = (n, label) =>
  `${n} ${label}${n === 1 ? "" : label === "category" ? "ies" : "s"}`.replace(
    "categoryies",
    "categories",
  );
export function breadcrumbView(page) {
  return `<nav class="academy-breadcrumb" aria-label="Breadcrumb">${breadcrumbs(
    page,
  )
    .map(
      (c, i, all) =>
        `${i ? '<span aria-hidden="true">/</span>' : ""}${i === all.length - 1 ? `<span aria-current="page">${esc(c.name)}</span>` : `<a href="${c.url}">${esc(c.name)}</a>`}`,
    )
    .join("")}</nav>`;
}
export function sidebarView(data, page) {
  const c = page.category;
  // The other-subject list must not repeat the learning path you are already
  // in, and it disappears entirely when there is nothing else to show.
  const otherPaths = data.categories.filter(
    (category) => category.id !== c?.id,
  );
  return `<aside class="academy-sidebar"><a class="academy-wordmark" href="${ROOT}"><span class="academy-symbol">${icon("book")}</span><span>Academy<small>STEP BY STEP</small></span></a>
  <nav class="academy-navigation" aria-label="Academy"><a href="${ROOT}" ${page.type === "overview" ? 'aria-current="page"' : ""}>${icon("grid")}All courses</a>${data.paths.filter((p) => p.modules.some((m) => m.topics.length)).length > 1 ? `<a href="${ROOT}/roadmap" ${page.type === "roadmap" ? 'aria-current="page"' : ""}>${icon("path")}Learning paths</a>` : ""}</nav>
${
  c
    ? `<div class="sidebar-category-links sidebar-group--current"><span class="academy-nav-label" id="acad-nav-current">THIS LEARNING PATH</span><nav class="academy-navigation" aria-labelledby="acad-nav-current"><a href="${c.url}" ${page.type === "category" ? 'aria-current="page"' : ""}>${esc(c.name)}</a>${c.roadmapUrl ? `<a href="${c.roadmapUrl}" ${page.type === "category-roadmap" ? 'aria-current="page"' : ""}>${icon("path")}Course order</a>` : ""}${c.paths
        .slice(0, 6)
        .map(
          (p) =>
            `<a href="${p.url}" ${page.path?.id === p.id ? 'aria-current="page"' : ""}>${icon("book")}${esc(p.name)}</a>`,
        )
        .join("")}</nav></div>`
    : ""
}
${
  otherPaths.length
    ? `<div class="sidebar-category-links sidebar-group--paths"><span class="academy-nav-label" id="acad-nav-paths">${c ? "OTHER LEARNING PATHS" : "LEARNING PATHS"}</span><nav class="academy-navigation" aria-labelledby="acad-nav-paths">${otherPaths.map((category) => `<a href="${category.url}">${icon("grid")}<span>${esc(category.name)}</span></a>`).join("")}</nav></div>`
    : ""
}
  <div class="sidebar-note">${icon("book")}<strong>Learn. Check. Continue.</strong><p>Each course keeps its modules, lessons and learning goals together, so you always know where you are.</p><a href="${ROOT}/roadmap#how-it-works">How learning works →</a></div></aside>`;
}
// Pages where a left rail helps: you are already inside a course.
const RAIL_PAGES = new Set(["path", "lesson"]);
const PAGE_LABEL = {
  overview: "Home",
  roadmap: "Learning paths",
  category: "Learning path",
  "category-roadmap": "Learning path",
  path: "Course",
  lesson: "Lesson",
};

export function workspaceView(
  data,
  page,
  content,
  { account, notice = "", sidebar } = {},
) {
  // The rail only earns its width where it carries course context. On the
  // discovery pages it repeated links that are already on screen, so those
  // pages render full width instead.
  const rail = sidebar || (RAIL_PAGES.has(page.type) ? sidebarView(data, page) : "");
  return `<div class="academy-shell" data-rail="${rail ? "context" : "none"}">${rail}<div class="academy-workspace"><div class="academy-topbar"><span>Academy <span class="topbar-slash">/</span><strong>${PAGE_LABEL[page.type] || "Explore"}</strong></span>${account || '<span class="academy-account-btn">' + icon("user") + "<span>No login · Local progress</span></span>"}</div><div class="academy-content">${notice}${content}</div></div></div>`;
}
export function structureView() {
  return `<div class="academy-hierarchy" aria-label="How the curriculum is organized">${[
    ["Academy", "Your learning home"],
    ["Learning Path", "A focused area of study"],
    ["Course", "A specific goal"],
    ["Module", "Related concepts"],
    ["Lesson", "Learn & practice"],
  ]
    .map(
      ([title, desc], i) =>
        `${i ? '<i aria-hidden="true">›</i>' : ""}<span><b>${title}</b><small>${desc}</small></span>`,
    )
    .join("")}</div>`;
}
function courseCard(p, pmap = new Map(), context = {}) {
  const done = p.topics.filter((t) => pmap.get(t.id)?.passed).length;
  const total = p.topics.length;
  const started = done > 0 || p.topics.some((t) => pmap.get(t.id)?.lesson_started);
  const complete = total > 0 && done === total;
  const modules = p.modules.filter((m) => m.topics.length);
  const category = (context.categories || []).find((c) => c.id === p.category_id);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<article class="course-card" data-course-card data-difficulty="${esc(p.difficulty)}">
  <div class="course-card-main">
    <p class="course-card-path">${esc(category?.name || "Course")}</p>
    <h3>${esc(p.name)}</h3>
    <p class="course-card-desc">${esc(p.description)}</p>
    <p class="course-card-facts">
      <span>${esc(p.difficulty)}</span>
      <span>${plural(modules.length, "module")}</span>
      <span>${plural(total, "lesson")}</span>
      <span>${minutes(p.topics)} min</span>
    </p>
  </div>
  <div class="course-card-side">
    ${
      done > 0
        ? `<p class="course-card-progress"><span class="course-card-bar"><i style="width:${pct}%"></i></span><span>${done}/${total} lessons · ${pct}%</span></p>`
        : ""
    }
    <a class="btn ${complete ? "btn-secondary" : "btn-primary"}" href="${p.url}">${
      complete ? "Review course" : started ? "Continue course" : "View course"
    } ${icon("arrow")}</a>
  </div>
</article>`;
}

function browse(data, roadmap = false) {
  return `<section class="academy-categories" id="categories"><div class="section-heading"><div><span class="academy-kicker">LEARNING PATHS</span><h2>${roadmap ? "Choose your learning path" : "Available learning paths"}</h2><p>Each learning path contains focused courses with clear outcomes and ordered modules.</p></div><span class="small muted">${plural(data.categories.length, "path")}</span></div><div class="category-grid">${data.categories
    .map((c) => {
      const start = recommended(data, c.id);
      return `<article class="category-discovery"><span class="course-symbol">${icon("book")}</span><div><span class="academy-kicker">LEARNING PATH</span><h3><a href="${c.url}">${esc(c.name)}</a></h3><p>${esc(c.description)}</p><div class="path-facts"><span>${plural(c.paths.length, "course")}</span><span>${plural(c.topics.length, "lesson")}</span></div>${roadmap ? `<p class="subject-start"><strong>Start with:</strong> ${esc(start.name)}</p>` : ""}<div class="subject-actions"><a class="text-button" href="${c.url}">View courses ${icon("arrow")}</a>${roadmap ? `<a class="text-button" href="${c.roadmapUrl}">See roadmap →</a>` : ""}</div></div></article>`;
    })
    .join(
      "",
    )}</div></section>`;
}
function howItWorks() {
  return `<section class="academy-how" id="how-it-works"><span class="academy-kicker">HOW LEARNING WORKS</span><h2>Learn step by step, one lesson at a time.</h2><div class="academy-steps">${[
    [
      "book",
      "01",
      "Learn the concept",
      "Read focused lessons with clear explanations, examples and code where relevant. No login needed.",
    ],
    [
      "lab",
      "02",
      "Put it into practice",
      "Work through the lesson's practice resource. Follow the provider's instructions; practice completion is self-reported.",
    ],
    [
      "award",
      "03",
      "Check your understanding",
      "Take a self-check to confirm what you learned. Your progress is saved in this browser, without a login or email.",
    ],
  ]
    .map(
      ([i, n, t, d]) =>
        `<div><span class="step-symbol">${icon(i)}</span><span class="step-number">${n}</span><h3>${t}</h3><p>${d}</p></div>`,
    )
    .join(
      "",
    )}</div><p class="catalogue-footnote">Progress is a personal learning record—not a verified certificate or accreditation. Clearing browser data removes it; download a backup in Device settings. Code examples are read-only; external practice providers may require their own account.</p></section>`;
}
export function hubView(data, context = {}) {
  if (!data.categories.length)
    return '<div class="academy-empty"><h1>Your next chapter is coming</h1><p>No courses are published yet. Check back soon.</p></div>';
  const resume = data.topics.find((t) => t.id === context.lastTopic);
  const resumeCourse = resume && data.paths.find((p) => p.id === resume.path_id);
  const resumeCategory =
    resumeCourse && data.categories.find((c) => c.id === resumeCourse.category_id);
  const pmap = context.pmap || new Map();
  const totalLessons = data.topics.length;

  // One resume target, and one starting course. A learner who has read
  // something continues; everyone else starts at the recommended course.
  const firstUnread = (p) => {
    const last = p.topics.find((t) => t.id === context.lastTopic);
    return (
      (last && !pmap.get(last.id)?.passed && last) ||
      p.topics.find((t) => !pmap.get(t.id)?.passed) ||
      p.topics[0]
    );
  };
  const startPath = data.paths.find((p) => p.is_start_here) || data.paths[0];
  const startLesson = startPath && firstUnread(startPath);
  const resumeLesson = resume && !pmap.get(resume.id)?.passed ? resume : null;

  return `<header class="academy-hero">
  <div class="hero-copy">
    <span class="academy-kicker">OopsMyPassword Academy</span>
    <h1>Learn how security actually works.</h1>
    <p>Structured courses that explain how systems are built, where they break, and how defenders find out. Start at the beginning or pick up where you stopped.</p>
    ${
      resumeLesson
        ? `<div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="${resumeLesson.url}">Continue ${esc(resumeLesson.name)} ${icon("arrow")}</a>
            <a class="btn btn-ghost" href="${startLesson.url}">Start from the beginning</a>
          </div>`
        : `<div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="${startLesson.url}">${icon("play")} Start learning</a>
          </div>`
    }
    <p class="hero-meta">${plural(data.paths.length, "course")} · ${plural(totalLessons, "lesson")} · No signup, progress stays on this device</p>
  </div>
  ${
    resumeLesson
      ? `<aside class="hero-resume" aria-label="Continue where you left off">
          <span class="resume-label">Pick up where you stopped</span>
          <p class="resume-path">${esc(resumeCategory?.name || "")}</p>
          <h2>${esc(resumeLesson.name)}</h2>
          <p class="resume-why">${esc(resumeLesson.description)}</p>
          <a class="btn btn-secondary" href="${resumeLesson.url}">Resume this lesson ${icon("arrow")}</a>
        </aside>`
      : startPath
        ? /* Without saved progress there is nothing to resume, and repeating the
             recommended course here just duplicated the first card in the
             course list directly below. Explain the shape of a lesson instead:
             it is the one thing the list below does not already say. */
          `<aside class="hero-resume hero-resume--orientation" aria-label="What a lesson looks like">
            <span class="resume-label">Inside every lesson</span>
            <ol class="hero-loop">
              <li><span>${icon("book")}</span><div><strong>Read the concept</strong><small>A focused explanation, its history and real examples.</small></div></li>
              <li><span>${icon("lab")}</span><div><strong>Practice it</strong><small>External exercises you run yourself, and the defensive view.</small></div></li>
              <li><span>${icon("award")}</span><div><strong>Check yourself</strong><small>A self-check on the lessons that publish one. No score is claimed where there isn't one.</small></div></li>
            </ol>
          </aside>`
        : ""
  }
</header>
<section class="course-index" aria-labelledby="course-index-heading">
  <div class="section-heading">
    <div>
      <span class="academy-kicker">All courses</span>
      <h2 id="course-index-heading">Choose a course</h2>
    </div>
  </div>
  <div class="course-index-grid">
    ${data.paths.map((p) => courseCard(p, pmap, context)).join("")}
  </div>
  ${
    data.paths.some((p) => p.modules.filter((m) => m.topics.length).length > 1)
      ? `<p class="index-note">Each course is split into modules, and each module into short lessons you can finish in one sitting.</p>`
      : ""
  }
</section>
<section class="academy-roadmap-callout" aria-labelledby="roadmap-callout-heading">
  <div class="callout-card">
    <div class="callout-copy">
      <span class="academy-kicker">STRUCTURED LEARNING PATHS</span>
      <h2 id="roadmap-callout-heading">Looking for a comprehensive, milestone-based roadmap?</h2>
      <p>Follow a progressive path through our structured curriculum. View milestones, core competencies, prerequisite chains, and ordered modules.</p>
    </div>
    <div class="callout-action">
      <a class="btn btn-primary btn-lg" href="${ROOT}/roadmap">${icon("path")} View learning roadmaps ${icon("arrow")}</a>
    </div>
  </div>
</section>
${howItWorks()}`;
}

function categorySkills(c) {
  if (c.slug === "web-application-security") {
    return [
      {
        tag: "Architecture",
        title: "Attack Surface & Boundaries",
        desc: "Chart system assets, user inputs, and server-side defensive trust boundaries.",
      },
      {
        tag: "Protocols",
        title: "HTTP Inspection & Flow",
        desc: "Evaluate methods, headers, cookies, status codes, and message parsing differences.",
      },
      {
        tag: "Identity",
        title: "Authentication & Sessions",
        desc: "Safeguard logins, manage session lifecycles, and prevent account enumeration.",
      },
      {
        tag: "Defense",
        title: "Access Control & Authorization",
        desc: "Enforce explicit server-side checks to eliminate IDOR and privilege escalation.",
      },
    ];
  }
  const skills = [];
  for (const p of c.paths || []) {
    for (const m of p.modules || []) {
      if (m.name && m.outcome) {
        skills.push({
          tag: esc(p.name),
          title: esc(m.name),
          desc: esc(m.outcome),
        });
      }
    }
  }
  if (skills.length) return skills.slice(0, 4);
  return [
    {
      tag: "Foundations",
      title: `${esc(c.name)} Core Concepts`,
      desc: `Fundamental principles, architecture, and methodologies in ${esc(c.name)}.`,
    },
    {
      tag: "Application",
      title: "Practical Implementation",
      desc: `Hands-on practice and defensive verification in ${esc(c.name)}.`,
    },
  ];
}

export function categoryView(data, page, context = {}) {
  const c = page.category;
  const pmap = context.pmap || new Map();
  const start = recommended(data, c.id);
  const courses = c.paths.filter((p) => p.modules.some((m) => m.topics.length));
  // A learning path that holds exactly one course should not make the learner
  // click again. In that case the course is presented here directly.
  const single = courses.length === 1 ? courses[0] : null;
  const startLesson =
    single &&
    (single.topics.find((t) => !pmap.get(t.id)?.passed) || single.topics[0]);
  const skills = categorySkills(c);

  return `${breadcrumbView(page)}
<header class="path-hero">
  <p class="path-eyebrow">Learning path</p>
  <h1>${esc(c.name)}</h1>
  <p class="path-lede">${esc(c.description)}</p>
  <p class="path-facts"><span>${plural(courses.length, "course")}</span><span>${plural(c.topics.length, "lesson")}</span><span>${minutes(c.topics)} min of reading</span><span>100% Free · No Login</span></p>
</header>
${
  single
    ? `<section class="path-single" aria-labelledby="path-single-heading">
  <div class="section-heading">
    <div>
      <span class="academy-kicker">The course in this path</span>
      <h2 id="path-single-heading">${esc(single.name)}</h2>
    </div>
  </div>
  <div class="path-single-body">
    <div>
      <h3>What you'll learn</h3>
      ${list(single.outcomes)}
    </div>
    <div>
      <h3>Before you start</h3>
      ${list(single.prerequisites)}
    </div>
  </div>
  ${
    startLesson
      ? `<div class="path-single-cta">
          <a class="btn btn-primary btn-lg" href="${startLesson.url}" title="${esc(startLesson.name)}">${icon("play")} Start the first lesson</a>
          <a class="btn btn-secondary" href="${single.url}">See the full course structure</a>
          <a class="btn btn-ghost" href="${c.roadmapUrl}">View learning roadmap</a>
        </div>`
      : ""
  }
</section>`
    : `<section class="path-courses" aria-labelledby="path-courses-heading">
  <div class="section-heading">
    <div>
      <span class="academy-kicker">Courses in this path</span>
      <h2 id="path-courses-heading">Pick a starting point</h2>
    </div>
  </div>
  <div class="course-index-grid">${courses.map((p) => courseCard(p, pmap, context)).join("")}</div>
</section>`
}
<section class="roadmap-skills-section" aria-labelledby="path-skills-heading">
  <div class="section-heading">
    <div>
      <span class="academy-kicker">CORE COMPETENCIES</span>
      <h2 id="path-skills-heading">What you will master in ${esc(c.name)}</h2>
      <p>Key practical skills and architectural understanding built through this learning path.</p>
    </div>
  </div>
  <div class="roadmap-skills-grid">
    ${skills
      .map(
        (s) =>
          `<div class="roadmap-skill-card"><span class="skill-tag">${s.tag}</span><h3>${s.title}</h3><p>${s.desc}</p></div>`,
      )
      .join("")}
  </div>
</section>
${
  /* With a single course there is no choice to help with and no order to
     show, so both blocks would only restate the course inlined above. */
  !single && start
    ? `<section class="path-next">
  <h2>Not sure where to begin?</h2>
  <p>The recommended course is <strong>${esc(start.name)}</strong>: ${esc(start.audience)}</p>
  <a class="text-button" href="${start.url}">Open the recommended course ${icon("arrow")}</a>
</section>`
    : ""
}
${
  single
    ? ""
    : `<section class="path-next">
  <h2>Course order in this path</h2>
  <p>${courses
    .map(
      (p) =>
        `${esc(p.name)}: ${p.modules
          .filter((m) => m.topics.length)
          .map((m) => esc(m.name))
          .join(" \u2192 ")}`,
    )
    .join("<br>")}</p>
  <a class="text-button" href="${c.roadmapUrl}">See the full path breakdown ${icon("arrow")}</a>
</section>`
}
<section class="path-roadmap-banner">
  <div class="banner-content">
    <span class="academy-kicker">STRUCTURED MILESTONES</span>
    <h2>Explore the detailed milestone roadmap for ${esc(c.name)}</h2>
    <p>View the full sequence of modules, prerequisites, outcome goals, and lesson durations in an interactive visual timeline.</p>
    <a class="btn btn-primary" href="${c.roadmapUrl}">${icon("path")} Open ${esc(c.name)} roadmap ${icon("arrow")}</a>
  </div>
</section>
<section class="path-browse">
  <p>Looking for a different topic?</p>
  <a class="text-button" href="${ROOT}">Browse every learning path ${icon("arrow")}</a>
  ${single ? `<a class="text-button" href="${c.roadmapUrl}">See the module order in this path ${icon("arrow")}</a>` : ""}
</section>`;
}

export function topicRow(t, index, progress) {
  const label = progress?.passed
    ? "Completed"
    : progress?.lesson_started
      ? "In progress"
      : "Start lesson";
  return `<a class="academy-topic ${progress?.passed ? "is-complete" : ""}" href="${t.url}"><span class="topic-number">${progress?.passed ? icon("check") : String(index + 1).padStart(2, "0")}</span><div class="topic-body"><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><div class="topic-meta"><span>${esc(t.difficulty)}</span><span>${Number(t.estimated_minutes)} min</span></div></div><span class="topic-action">${label} ${icon("arrow")}</span></a>`;
}
export function modulesView(path, pmap = new Map(), filter = () => true) {
  let index = 0;
  return path.modules
    .map((m, i) => {
      const topics = m.topics
        .map((t) => ({ t, index: index++ }))
        .filter(({ t }) => filter(t));
      if (!topics.length) return "";
      const doneCount = m.topics.filter((t) => pmap.get(t.id)?.passed).length;
      const allDone = doneCount === m.topics.length;
      const started = doneCount > 0;
      return `<section class="curriculum-module" id="module-${m.slug}"><div class="module-heading"><span class="module-number">${String(i + 1).padStart(2, "0")}</span><div><span class="academy-kicker">MODULE ${i + 1} · ${plural(m.topics.length, "lesson")}</span><h2>${esc(m.name)}</h2><p>${esc(m.description)}</p></div><span class="module-status ${allDone ? "is-complete" : started ? "is-in-progress" : "is-not-started"}">${allDone ? "✓ Complete" : started ? "◐ In progress" : "○ Not started"}</span></div><div class="module-outcome"><span class="outcome-label">By the end of this module, you will be able to:</span><p>${esc(m.outcome)}</p></div><div class="academy-course">${topics.map(({ t, index }) => topicRow(t, index, pmap.get(t.id))).join("")}</div></section>`;
    })
    .join("");
}
export function pathView(data, page, context = {}) {
  const p = page.path,
    pmap = context.pmap || new Map(),
    done = p.topics.filter((t) => pmap.get(t.id)?.passed).length;
  const total = p.topics.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const next =
    p.topics.find((t) => t.id === context.lastTopic && !pmap.get(t.id)?.passed) ||
    p.topics.find((t) => !pmap.get(t.id)?.passed) ||
    p.topics[0];
  const started = done > 0 || p.topics.some((t) => pmap.get(t.id)?.lesson_started);
  const ctaLabel = done === total ? "Review course" : started ? "Continue learning" : "Start course";
  return `${breadcrumbView(page)}<header class="course-hero"><div class="course-hero-inner"><span class="academy-kicker">COURSE</span><h1>${esc(p.name)}</h1><p class="course-lede">${esc(p.description)}</p><div class="course-stats"><div class="stat"><span class="stat-value">${esc(p.difficulty)}</span><span class="stat-label">Level</span></div><div class="stat"><span class="stat-value">${p.modules.length}</span><span class="stat-label">Module${p.modules.length !== 1 ? "s" : ""}</span></div><div class="stat"><span class="stat-value">${total}</span><span class="stat-label">Lesson${total !== 1 ? "s" : ""}</span></div><div class="stat"><span class="stat-value">~${Math.max(1, Math.round(minutes(p.topics) / 60))}h</span><span class="stat-label">Est. time</span></div><div class="stat stat-progress"><span class="stat-value">${pct}%</span><span class="stat-label">Progress</span></div></div><div class="course-progress-bar"><div class="course-progress-track"><span style="width:${pct}%"></span></div><span class="course-progress-label">${done} of ${total} lessons completed</span></div><a class="btn btn-primary btn-lg" href="${next.url}">${ctaLabel} ${icon("arrow")}</a></div></header>
<section class="course-outcomes"><div class="section-heading"><div><span class="academy-kicker">WHAT YOU'LL LEARN</span><h2>By the end of this course, you will understand:</h2></div></div>${list(p.outcomes)}</section>
<section class="course-audience"><details><summary>Who this course is for &amp; prerequisites</summary><p>${esc(p.audience)}</p><h3>Before you start</h3>${list(p.prerequisites)}</details></section>
<section aria-label="Course curriculum" id="curriculum" class="course-structure"><div class="section-heading"><div><span class="academy-kicker">YOUR LEARNING PATH</span><h2>Course structure</h2><p>Work through each module in order. Each module builds on the one before it.</p></div><span class="small muted" id="lesson-count" role="status">${plural(total, "lesson")}</span></div><div class="curriculum-toolbar" data-enhanced-control hidden><label class="academy-search">${icon("search")}<span class="sr-only">Search lessons</span><input type="search" id="lesson-search" placeholder="Find a lesson…" autocomplete="off"></label><label class="academy-filter"><span class="sr-only">Filter by progress</span><select id="lesson-filter"><option value="all">All lessons</option><option value="active">In progress</option><option value="new">Not started</option><option value="complete">Completed</option></select></label></div><div id="category-lessons">${modulesView(p, pmap)}</div></section>
<section class="academy-next-note"><span class="academy-kicker">WHEN YOU FINISH</span><h2>What comes next</h2><p>${esc(p.next_steps)}</p>${page.category ? `<a class="text-button" href="${page.category.url}">Explore other courses →</a>` : ""}</section>`;
}
export function roadmapView(data, page, context = {}) {
  const pmap = context.pmap || new Map();
  const courses = data.paths.filter((p) => p.modules.some((m) => m.topics.length));
  const totalMinutes = data.topics.reduce((n, t) => n + Number(t.estimated_minutes || 0), 0);
  return `${breadcrumbView(page)}
<header class="path-hero roadmap-hero">
  <p class="path-eyebrow">Curriculum Roadmap</p>
  <h1>Learning paths</h1>
  <p class="path-lede">Every published course, in the order it is meant to be taken. Pick a path, read what you will learn, and start the first lesson.</p>
  <div class="roadmap-facts-bar">
    <span class="fact-item"><strong>${plural(data.categories.length, "domain")}</strong></span>
    <span class="fact-item"><strong>${plural(courses.length, "course")}</strong></span>
    <span class="fact-item"><strong>${plural(data.topics.length, "lesson")}</strong></span>
    <span class="fact-item"><strong>~${Math.round(totalMinutes / 60)}h total study</strong></span>
    <span class="fact-item fact-privacy"><strong>100% Client-Side Privacy</strong></span>
  </div>
</header>
<nav class="roadmap-tracks-nav" aria-label="Roadmap domains">
  <span class="tracks-nav-label">Jump to domain roadmap:</span>
  <div class="tracks-nav-pills">
    ${data.categories
      .map(
        (c) =>
          `<a class="track-nav-pill" href="#track-${c.slug}"><span class="track-pill-name">${esc(c.name)}</span><span class="track-pill-count">${plural(c.paths.length, "course")}</span></a>`,
      )
      .join("")}
  </div>
</nav>
<section class="roadmap-framework" aria-labelledby="framework-heading">
  <div class="section-heading">
    <div>
      <span class="academy-kicker">LEARNING ARCHITECTURE</span>
      <h2 id="framework-heading">The 4-stage learning methodology</h2>
      <p>Every track in the Academy follows a structured progression engineered for real-world mastery.</p>
    </div>
  </div>
  <div class="roadmap-framework-grid">
    <div class="framework-card">
      <span class="framework-step">01</span>
      <h3>Mental Models &amp; Architecture</h3>
      <p>Build the fundamental model first: understand system components, trust boundaries, and communication flows before inspecting flaws.</p>
    </div>
    <div class="framework-card">
      <span class="framework-step">02</span>
      <h3>Protocol Fluency</h3>
      <p>Inspect raw request-response messages, HTTP headers, cookies, and tokens rather than relying on GUI assumptions.</p>
    </div>
    <div class="framework-card">
      <span class="framework-step">03</span>
      <h3>Defensive Engineering</h3>
      <p>Learn how server-side controls enforce authentication, authorization, and safe data handling at trusted boundaries.</p>
    </div>
    <div class="framework-card">
      <span class="framework-step">04</span>
      <h3>Practical Verification</h3>
      <p>Apply your skills in external practice labs and test your comprehension through local, private self-checks.</p>
    </div>
  </div>
</section>
<section class="path-single roadmap-decision-guide" aria-labelledby="how-to-choose">
  <div class="section-heading"><div><span class="academy-kicker">How to choose</span><h2 id="how-to-choose">Two questions decide it for you</h2></div></div>
  <div class="path-single-body">
    <div>
      <h3>1. Have you done this before?</h3>
      <p>Every course here starts at the beginning and assumes no prior security knowledge. You do not need to finish one course before starting another.</p>
    </div>
    <div>
      <h3>2. What do you want to be able to do?</h3>
      <p>Read the outcome list on each course. If those outcomes describe work you want to do, that is the course to take.</p>
    </div>
  </div>
</section>
<section class="roadmap-domain-groups" aria-label="Courses by domain">
  ${data.categories
    .map(
      (c) => `<div class="roadmap-domain-block" id="track-${c.slug}">
    <div class="domain-block-header">
      <div>
        <span class="academy-kicker">DOMAIN TRACK</span>
        <h2>${esc(c.name)}</h2>
        <p>${esc(c.description)}</p>
      </div>
      <div class="domain-block-actions">
        <a class="btn btn-secondary" href="${c.roadmapUrl}">${icon("path")} View track roadmap ${icon("arrow")}</a>
      </div>
    </div>
    <div class="course-index-grid">
      ${c.paths.map((p) => courseCard(p, pmap, { ...context, categories: data.categories })).join("")}
    </div>
  </div>`,
    )
    .join("")}
</section>
<section class="path-courses" aria-labelledby="all-courses-h">
  <div class="section-heading"><div><span class="academy-kicker">Every course</span><h2 id="all-courses-h">Start here</h2></div></div>
  <div class="course-index-grid">${courses.map((p) => courseCard(p, pmap, { ...context, categories: data.categories })).join("")}</div>
</section>
<section class="path-next" id="how-it-works">
  <h2>How a course is organised</h2>
  <p>Each course is split into modules. Each module has one clear goal, and each lesson is short enough to finish in one sitting. You can leave and come back: your progress is stored on this device only, with no account.</p>
  <div class="academy-actions">
    <a class="btn btn-secondary" href="#how-to-choose">Back to how to choose ${icon("arrow")}</a>
    <a class="btn btn-ghost" href="${ROOT}">Explore Academy home</a>
  </div>
</section>`;
}

export function categoryRoadmapView(data, page) {
  const c = page.category,
    start = recommended(data, c.id);
  const skills = categorySkills(c);
  const totalMinutes = c.topics.reduce((n, t) => n + Number(t.estimated_minutes || 0), 0);

  return `${breadcrumbView(page)}
<header class="academy-page-heading roadmap-hero">
  <div>
    <span class="academy-kicker">LEARNING PATH ROADMAP · ${esc(c.name)}</span>
    <h1>Your roadmap in ${esc(c.name)}.</h1>
    <p>Explore the courses in this learning path and the order of modules within each one.</p>
    <div class="roadmap-facts-bar">
      <span class="fact-item"><strong>${plural(c.paths.length, "course")}</strong></span>
      <span class="fact-item"><strong>${plural(c.topics.length, "lesson")}</strong></span>
      <span class="fact-item"><strong>~${totalMinutes} min reading</strong></span>
      <span class="fact-item fact-privacy"><strong>Client-Side Progress</strong></span>
    </div>
  </div>
</header>
<section class="category-explainer roadmap-start">
  <div>
    <span class="academy-kicker">RECOMMENDED STARTING COURSE</span>
    <h2>${esc(start.name)}</h2>
    <p>${esc(start.audience)}</p>
    <div class="roadmap-start-actions">
      <a class="btn btn-primary btn-lg" href="${start.url}">${icon("play")} Start this course ${icon("arrow")}</a>
      <a class="btn btn-secondary" href="${c.url}">View path overview</a>
    </div>
  </div>
  <div>
    <h3>Before you start</h3>
    ${list(start.prerequisites)}
  </div>
</section>
<section class="roadmap-skills-section" aria-labelledby="skills-heading">
  <div class="section-heading">
    <div>
      <span class="academy-kicker">CORE COMPETENCIES</span>
      <h2 id="skills-heading">What you will master in this path</h2>
      <p>Targeted capabilities and verifiable mental models you will build across each module.</p>
    </div>
  </div>
  <div class="roadmap-skills-grid">
    ${skills
      .map(
        (s) =>
          `<div class="roadmap-skill-card"><span class="skill-tag">${s.tag}</span><h3>${s.title}</h3><p>${s.desc}</p></div>`,
      )
      .join("")}
  </div>
</section>
<section class="roadmap-order" aria-labelledby="timeline-heading">
  <div class="section-heading">
    <div>
      <span class="academy-kicker">CURRICULUM TIMELINE</span>
      <h2 id="timeline-heading">Courses and their module order</h2>
      <p>Follow modules in order. Each milestone cements foundational concepts before advancing.</p>
    </div>
  </div>
  ${c.paths
    .map(
      (p) => `<div class="roadmap-path">
    <div class="section-heading">
      <div>
        <span class="academy-kicker">COURSE MILESTONES</span>
        <h3><a href="${p.url}">${esc(p.name)}</a></h3>
      </div>
      <span class="small muted">${plural(p.topics.length, "lesson")} · ${minutes(p.topics)} min</span>
    </div>
    <p class="roadmap-path-desc">${esc(p.description)}</p>
    <ol class="roadmap-timeline">
      ${p.modules
        .map(
          (m, i) => `<li>
        <span class="roadmap-stop" aria-hidden="true">${i + 1}</span>
        <div class="roadmap-milestone-content">
          <div class="roadmap-milestone-header">
            <h4>${esc(m.name)}</h4>
            <span class="milestone-badge">Module ${i + 1}</span>
          </div>
          <div class="roadmap-milestone-goal">
            <span class="goal-label">Milestone outcome:</span>
            <p>${esc(m.outcome)}</p>
          </div>
          <p class="roadmap-milestone-desc">${esc(m.description)}</p>
          <div class="roadmap-lessons-pill-grid">
            ${m.topics
              .map(
                (t, idx) =>
                  `<a class="roadmap-lesson-pill" href="${t.url}"><span class="pill-number">${idx + 1}</span><span class="pill-title">${esc(t.name)}</span><span class="pill-time">${Number(t.estimated_minutes)}m</span><span class="pill-arrow" aria-hidden="true">→</span></a>`,
              )
              .join("")}
          </div>
        </div>
      </li>`,
        )
        .join("")}
    </ol>
    <div class="roadmap-path-footer">
      <a class="btn btn-secondary" href="${p.url}">See full course structure ${icon("arrow")}</a>
    </div>
  </div>`,
    )
    .join("")}
</section>
<section class="academy-next-note" id="next-steps">
  <h2>Choose your next course.</h2>
  <p>Finish or review your current course's outcomes, then compare another course's prerequisites.</p>
  <div class="academy-actions">
    <a class="btn btn-primary" href="${c.url}">Compare courses in ${esc(c.name)} ${icon("arrow")}</a>
    <a class="btn btn-ghost" href="${ROOT}/roadmap">Browse all domain roadmaps</a>
  </div>
</section>`;
}
export function blocksView(blocks) {
  return blocks
    .map((b) =>
      b.type === "list"
        ? list(b.items)
        : b.type === "code"
          ? `<div class="lesson-code">${b.language ? `<span class="code-language">${esc(b.language)} · example</span>` : ""}<pre tabindex="0" aria-label="Code example"><code>${esc(b.text)}</code></pre></div>`
          : `<p>${esc(b.text)}</p>`,
    )
    .join("");
}
export function staticLessonView(data, page) {
  const t = page.topic,
    p = page.path,
    module = p.modules.find((m) => m.id === t.module_id),
    next = p.topics[p.topics.indexOf(t) + 1],
    all = sectionsFor(t);
  // "Overview" is promoted to "Why this matters" and "Defensive thinking" to
  // "Key takeaways", so neither is repeated inside the concept body.
  const sections = all.filter(
    (s) => !["overview", "why", "defensive"].includes(s.id),
  );
  const takeaways = all.find((s) => s.id === "defensive");
  const resources = (t.content.references || []).map(safeHttpUrl).filter(Boolean);
  return `${breadcrumbView(page)}<header class="lesson-heading"><div class="lesson-meta"><span class="academy-kicker">LESSON ${p.topics.indexOf(t) + 1} OF ${p.topics.length}</span><span class="lesson-meta-divider">·</span><span>${esc(module.name)}</span></div><h1>${esc(t.name)}</h1><p class="lesson-lede">${esc(t.description)}</p><div class="topic-meta"><span>${esc(t.difficulty)}</span><span>${Number(t.estimated_minutes)} min</span></div></header><div class="lesson-why"><strong>Why this matters</strong><p>${esc(t.content.overview || t.description)}</p></div><section class="lesson-section lesson-concept"><h2>What you'll learn</h2><ul class="lesson-objectives">${sections.map((s) => `<li>${esc(s.title)}</li>`).join("")}</ul>${sections.map((s) => `<div class="concept-block"><h3>${esc(s.title)}</h3>${blocksView(s.blocks)}</div>`).join("")}</section><section class="lesson-section lesson-practice"><h2>Practice / apply</h2><p>${esc(t.content.practice_guidance || "Use a suitable learning environment and follow the resource's instructions. Test other people's systems only with permission.")}</p>${data.labs.filter((l) => l.topic_id === t.id && safeHttpUrl(l.url)).map((l) => `<div class="academy-lab"><h3>${esc(l.title)}</h3><p>${esc(l.description)}</p><a class="btn btn-secondary" href="${esc(safeHttpUrl(l.url))}" target="_blank" rel="noopener noreferrer">Open ${esc(l.provider)} resource ↗</a></div>`).join("")}</section>${takeaways ? `<section class="lesson-section lesson-takeaways"><h2>Key takeaways</h2><div class="prose learning-prose">${blocksView(takeaways.blocks)}</div></section>` : ""}${resources.length ? `<section class="lesson-section lesson-resources"><h2>Sources &amp; further reading</h2><ul class="static-resources">${resources.map((url) => `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(url).hostname + new URL(url).pathname)} ↗</a></li>`).join("")}</ul></section>` : ""}<div class="lesson-next"><div class="lesson-next-label">${next ? "NEXT" : "COURSE COMPLETE ✓"}</div><h2>${next ? esc(next.name) : `You've completed ${esc(p.name)}`}</h2><p>${next ? esc(next.description) : `This was the last lesson in this course. ${esc(p.next_steps)}`}</p><a class="btn btn-primary" href="${next?.url || p.url}">${next ? "Next lesson" : "Review this course"} ${icon("arrow")}</a></div>`;
}
export function publicView(data, page, context = {}) {
  if (page.type === "overview") return hubView(data, { ...context, categories: data.categories });
  if (page.type === "roadmap")
    return roadmapView(data, page, { ...context, categories: data.categories });
  if (page.type === "category-roadmap") return categoryRoadmapView(data, page);
  if (page.type === "category") return categoryView(data, page, { ...context, categories: data.categories });
  if (page.type === "path") return pathView(data, page, context);
  if (page.type === "lesson") return staticLessonView(data, page);
  return '<div class="academy-empty"><h1>Lesson not found</h1><p>This lesson is not in the published curriculum.</p><a href="/learning">Explore the Academy</a></div>';
}
