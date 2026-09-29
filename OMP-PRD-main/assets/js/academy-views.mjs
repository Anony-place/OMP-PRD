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
  return `<aside class="academy-sidebar"><a class="academy-wordmark" href="${ROOT}"><span class="academy-symbol">${icon("book")}</span><span>OMP Academy<small>LEARN WITH DIRECTION</small></span></a>
  <span class="academy-nav-label">YOUR LEARNING HOME</span><nav class="academy-navigation" aria-label="Academy"><a href="${ROOT}" ${page.type === "overview" ? 'aria-current="page"' : ""}>${icon("grid")}Academy home</a><a href="${ROOT}/roadmap" ${page.type === "roadmap" ? 'aria-current="page"' : ""}>${icon("path")}Choose your direction</a></nav>
${
  c
    ? `<div class="sidebar-category-links"><span class="academy-nav-label">IN THIS SUBJECT</span><nav class="academy-navigation" aria-label="Current subject"><a href="${c.url}" ${page.type === "category" ? 'aria-current="page"' : ""}>${esc(c.name)}</a><a href="${c.roadmapUrl}" ${page.type === "category-roadmap" ? 'aria-current="page"' : ""}>${icon("path")}Subject roadmap</a>${c.paths
        .slice(0, 6)
        .map(
          (p) =>
            `<a href="${p.url}" ${page.path?.id === p.id ? 'aria-current="page"' : ""}>${icon("book")}${esc(p.name)}</a>`,
        )
        .join("")}</nav></div>`
    : ""
}
  <div class="sidebar-category-links"><span class="academy-nav-label">${c ? "SWITCH SUBJECT" : "EXPLORE SUBJECTS"}</span><nav class="academy-navigation" aria-label="Academy categories">${data.categories.map((category) => `<a href="${category.url}" ${c?.id === category.id ? 'aria-current="true"' : ""}>${icon("grid")}<span>${esc(category.name)}</span></a>`).join("")}</nav></div>
  <div class="sidebar-note">${icon("book")}<strong>Choose. Learn. Practice.</strong><p>Each subject has its own courses. Each course keeps its modules, lessons and learning goals together.</p><a href="${ROOT}/roadmap#how-it-works">How the Academy works →</a></div></aside>`;
}
export function workspaceView(
  data,
  page,
  content,
  { account, notice = "", sidebar } = {},
) {
  return `<div class="academy-shell">${sidebar || sidebarView(data, page)}<div class="academy-workspace"><div class="academy-topbar"><span>Academy <span class="topbar-slash">/</span><strong>${{ overview: "Home", roadmap: "Choose a subject", category: "Category", "category-roadmap": "Subject roadmap", path: "Course", lesson: "Lesson" }[page.type] || "Explore"}</strong></span>${account || '<span class="academy-account-btn">' + icon("user") + "<span>No login · Local progress</span></span>"}</div><div class="academy-content">${notice}${content}</div></div></div>`;
}
export function structureView() {
  return `<div class="academy-hierarchy" aria-label="How the curriculum is organized">${[
    ["Academy", "Your learning home"],
    ["Category", "A subject you choose"],
    ["Course", "A focused learning goal"],
    ["Module", "Related concepts"],
    ["Lesson", "Learn & practice"],
  ]
    .map(
      ([title, desc], i) =>
        `${i ? '<i aria-hidden="true">›</i>' : ""}<span><b>${title}</b><small>${desc}</small></span>`,
    )
    .join("")}</div>`;
}
function courseCard(p) {
  return `<article class="path-card" data-course-card data-difficulty="${esc(p.difficulty)}"><div class="path-card-top"><span class="academy-badge">${esc(p.difficulty)}</span>${p.is_start_here ? '<span class="start-here-tag">Start here in this subject</span>' : ""}</div><h3><a href="${p.url}">${esc(p.name)}</a></h3><p>${esc(p.description)}</p><div class="path-facts"><span>${plural(p.modules.length, "module")}</span><span>${plural(p.topics.length, "lesson")}</span><span>${minutes(p.topics)} min reading</span></div><a class="btn btn-secondary" href="${p.url}">Explore course ${icon("arrow")}</a></article>`;
}
function browse(data, roadmap = false) {
  return `<section class="academy-categories" id="categories"><div class="section-heading"><div><span class="academy-kicker">SUBJECTS, NOT A MIXED FEED</span><h2>${roadmap ? "Choose the subject you want to learn" : "Explore by category"}</h2><p>Open a subject to see only its courses, learning goals and recommended starting point.</p></div><span class="small muted">${plural(data.categories.length, "category")} available</span></div><div class="category-grid">${data.categories
    .map((c) => {
      const start = recommended(data, c.id);
      return `<article class="category-discovery"><span class="course-symbol">${icon("book")}</span><div><span class="academy-kicker">SUBJECT</span><h3><a href="${c.url}">${esc(c.name)}</a></h3><p>${esc(c.description)}</p><div class="path-facts"><span>${plural(c.paths.length, "course")}</span><span>${plural(c.topics.length, "lesson")}</span></div>${roadmap ? `<p class="subject-start"><strong>Suggested first course:</strong> ${esc(start.name)}</p>` : ""}<div class="subject-actions"><a class="text-button" href="${c.url}">Explore category ${icon("arrow")}</a><a class="text-button" href="${c.roadmapUrl}">View subject roadmap →</a></div></div></article>`;
    })
    .join(
      "",
    )}</div><p class="catalogue-footnote">Only published subjects and courses appear here. New subjects get their own space; they are never added to another subject’s curriculum.</p></section>`;
}
function howItWorks() {
  return `<section class="academy-how" id="how-it-works"><span class="academy-kicker">A CLEAR WAY TO LEARN</span><h2>Choose a course. Take it one lesson at a time.</h2><div class="academy-steps">${[
    [
      "book",
      "01",
      "Learn the concept",
      "Read focused lessons with subject-appropriate explanations, examples and code snippets where relevant. No login needed.",
    ],
    [
      "lab",
      "02",
      "Put it into practice",
      "Work through the lesson’s practice resource. Follow the provider’s instructions; practice completion is self-reported.",
    ],
    [
      "award",
      "03",
      "Check your understanding",
      "Try a self-check where available. Your progress and optional name are saved in this browser, without a login or email.",
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
  const course = resume && data.paths.find((p) => p.id === resume.path_id);
  const category =
    course && data.categories.find((c) => c.id === course.category_id);
  return `<header class="academy-page-heading"><div><span class="academy-kicker">OMP ACADEMY · LEARN WITH DIRECTION</span><h1>Your subject.<br>Your course. A clear next step.</h1><p>Choose what you want to learn, then follow a course built around a specific goal. Subjects stay separate, so your lessons always belong to a clear curriculum.</p></div></header>
  <div class="academy-orientation-grid"><section class="academy-feature orientation-feature"><div class="feature-copy"><span class="feature-eyebrow"><span class="status-dot"></span>START WITH YOUR GOAL</span><h2>Find your own starting point.</h2><p>There isn’t one course everyone needs to take first. Pick a subject, check the course prerequisites, and follow its modules in order.</p><div class="feature-meta"><span>${icon("grid")}${plural(data.categories.length, "category")}</span><span>${icon("book")}${plural(data.paths.length, "course")} published</span></div><div class="academy-actions"><a class="btn btn-primary" href="${ROOT}/roadmap">Find my starting point ${icon("arrow")}</a><a class="text-button" href="#categories">Browse subjects</a></div><span class="feature-footnote">Self-paced · Free · No login required</span></div><div class="feature-art" aria-hidden="true"><div class="art-orbit"></div><div class="art-tile art-tile-back">&lt;/&gt;</div><div class="art-tile art-tile-front">${icon("book")}</div></div></section><aside class="academy-welcome"><span class="academy-kicker">NO GUESSWORK</span><h2>Know what you’re joining.</h2><p>Each course explains who it is for, what you need beforehand, and what you will learn.</p><ul><li>A separate home for each subject.</li><li>Modules ordered within each course.</li><li>A focused lesson reader, not an endless feed.</li></ul><a class="text-button" href="${ROOT}/roadmap#before-you-start">How do I choose? →</a></aside></div>
${resume ? `<div class="academy-resume">${icon("book")}<div><strong>Continue your reading</strong><p>${esc(category.name)} · ${esc(course.name)}<br>${esc(resume.name)} · Saved on this device</p></div><a class="btn btn-secondary" href="${resume.url}">Resume ${icon("arrow")}</a></div>` : ""}
${browse(data)}<section class="academy-structure"><div class="section-heading"><div><h2>A clear place for everything.</h2><p>Subjects are separate. Courses contain modules. Modules contain lessons.</p></div></div>${structureView()}</section>${howItWorks()}`;
}
export function categoryView(data, page) {
  const c = page.category,
    start = recommended(data, c.id);
  return `${breadcrumbView(page)}<header class="academy-page-heading"><div><span class="academy-kicker">SUBJECT · ${plural(c.paths.length, "course")}</span><h1>${esc(c.name)}</h1><p>${esc(c.description)}</p></div></header><div class="category-explainer"><strong>New to ${esc(c.name)}?</strong><p>Start with ${esc(start.name)}, or compare the prerequisites and outcomes of another course in this subject.</p><a class="text-button" href="${c.roadmapUrl}">View this subject’s roadmap →</a></div><section><div class="section-heading"><h2>Courses in this subject</h2><span class="small muted">${plural(c.paths.length, "course")}</span></div><div class="curriculum-toolbar" data-course-controls hidden><label class="academy-search">${icon("search")}<span class="sr-only">Find a course in this subject</span><input id="course-search" type="search" placeholder="Find a course in this subject…"></label><label class="academy-filter"><span class="sr-only">Course level</span><select id="course-level"><option value="all">All levels</option>${[...new Set(c.paths.map((p) => p.difficulty))].map((level) => `<option value="${esc(level)}">${esc(level)}</option>`).join("")}</select></label></div><p id="course-count" class="small muted" role="status" data-course-controls hidden>${plural(c.paths.length, "course")}</p><div class="path-grid">${c.paths.map(courseCard).join("")}</div><div class="filter-empty" id="course-empty" hidden><h3>No courses match</h3><p>Try another search or level in this subject.</p><button class="btn btn-secondary" id="course-reset">Clear filters</button></div></section><section class="academy-next-note"><h2>Looking for a different subject?</h2><p>This page only lists ${esc(c.name)} courses. Other subjects have their own catalogue and roadmap.</p><a class="text-button" href="${ROOT}#categories">Explore all subjects →</a></section>`;
}
export function topicRow(t, index, progress) {
  const label = progress?.passed
    ? "Completed"
    : progress?.lesson_started
      ? "In progress"
      : "Read lesson";
  return `<a class="academy-topic ${progress?.passed ? "is-complete" : ""}" href="${t.url}"><span class="topic-number">${progress?.passed ? icon("check") : String(index + 1).padStart(2, "0")}</span><div class="topic-body"><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><div class="topic-meta"><span>${esc(t.difficulty)}</span><span>${Number(t.estimated_minutes)} min reading + practice</span></div></div><span class="topic-action">${label} ${icon("arrow")}</span></a>`;
}
export function modulesView(path, pmap = new Map(), filter = () => true) {
  let index = 0;
  return path.modules
    .map((m, i) => {
      const topics = m.topics
        .map((t) => ({ t, index: index++ }))
        .filter(({ t }) => filter(t));
      if (!topics.length) return "";
      return `<section class="curriculum-module" id="module-${m.slug}"><div class="module-heading"><span class="module-number">${String(i + 1).padStart(2, "0")}</span><div><span class="academy-kicker">MODULE ${i + 1} · ${plural(m.topics.length, "lesson")}</span><h2>${esc(m.name)}</h2><p>${esc(m.description)}</p></div></div><div class="academy-course">${topics.map(({ t, index }) => topicRow(t, index, pmap.get(t.id))).join("")}</div><p class="module-outcome">${icon("check")}<span><strong>By the end:</strong> ${esc(m.outcome)}</span></p></section>`;
    })
    .join("");
}
export function pathView(data, page, context = {}) {
  const p = page.path,
    pmap = context.pmap || new Map(),
    done = p.topics.filter((t) => pmap.get(t.id)?.passed).length;
  const next =
    p.topics.find(
      (t) => t.id === context.lastTopic && !pmap.get(t.id)?.passed,
    ) ||
    p.topics.find((t) => !pmap.get(t.id)?.passed) ||
    p.topics[0];
  return `${breadcrumbView(page)}<header class="academy-page-heading"><div><span class="academy-kicker">COURSE · ${esc(p.difficulty)}</span><h1>${esc(p.name)}</h1><p>${esc(p.description)}</p></div></header><div class="path-summary"><span>${icon("book")}${plural(p.modules.length, "module")} · ${plural(p.topics.length, "lesson")}</span><span>${icon("clock")}${minutes(p.topics)} min reading + practice</span><span>${icon("award")}${context.progressUnavailable ? "Local progress unavailable" : context.localProgress || context.user ? `${done} of ${p.topics.length} lessons completed on this device` : "Progress stays in your browser"}</span></div><div class="path-introduction"><section><h2>Who this course is for</h2><p>${esc(p.audience)}</p><h2>Before you start</h2>${list(p.prerequisites)}</section><section><h2>What you’ll be able to do</h2>${list(p.outcomes)}</section></div><div class="path-start"><a class="btn btn-primary" href="${next.url}">${done === p.topics.length ? "Review this course" : context.lastTopic === next.id ? "Continue learning" : "Start the first lesson"} ${icon("arrow")}</a><p>Follow this course’s modules in order, or use the outcomes to choose a lesson you need. Your progress here belongs to this course.</p></div><section aria-label="Course curriculum" id="curriculum"><div class="section-heading"><div><span class="academy-kicker">WITHIN THIS COURSE</span><h2>Your course curriculum</h2><p>Build understanding one module at a time. Each module explains its goal before you begin.</p></div><span class="small muted" id="lesson-count" role="status">${plural(p.topics.length, "lesson")}</span></div><div class="curriculum-toolbar" data-enhanced-control hidden><label class="academy-search">${icon("search")}<span class="sr-only">Search lessons in this course</span><input type="search" id="lesson-search" placeholder="Find a lesson in this course…" autocomplete="off"></label><label class="academy-filter"><span class="sr-only">Filter by progress</span><select id="lesson-filter"><option value="all">All lessons</option><option value="active">In progress</option><option value="new">Not started</option><option value="complete">Completed</option></select></label></div><div id="category-lessons">${modulesView(p, pmap)}</div></section><section class="academy-next-note"><span class="academy-kicker">WHEN YOU FINISH</span><h2>Reflect before moving on.</h2><p>${esc(p.next_steps)}</p><a class="text-button" href="${page.category.roadmapUrl}#next-steps">Explore the next step in this subject →</a></section>`;
}
export function roadmapView(data) {
  return `${breadcrumbView({ type: "roadmap", url: `${ROOT}/roadmap` })}<header class="academy-page-heading"><div><span class="academy-kicker">START WITH A SUBJECT</span><h1>Choose your learning direction.</h1><p>Different subjects need different starting points. Choose your subject below—its roadmap will help you pick a course without mixing unrelated lessons.</p></div></header><div class="roadmap-start" id="before-you-start"><section><span class="academy-kicker">01 · CHOOSE YOUR GOAL</span><h2>What do you want to learn?</h2><p>Choose a subject that matches your goal. You do not need to complete a course in another subject before starting.</p></section><section><span class="academy-kicker">02 · CHECK THE COURSE</span><h2>Use prerequisites and outcomes.</h2><p>The recommended starting course is specific to that subject. If you already know the basics, compare other courses and choose the right level.</p></section></div>${browse(data, true)}${howItWorks()}<section class="academy-next-note" id="after-foundations"><h2>Keep your next step relevant.</h2><p>At the end of a course, review its outcomes and use that subject’s roadmap to decide what comes next. There is no compulsory journey through every category.</p></section><details class="academy-faq"><summary>How is the Academy organized?</summary><p>A category is a subject. A course has a focused goal. Modules organize concepts within a course; lessons are the individual units you read and practice.</p></details>`;
}
export function categoryRoadmapView(data, page) {
  const c = page.category,
    start = recommended(data, c.id);
  return `${breadcrumbView(page)}<header class="academy-page-heading"><div><span class="academy-kicker">${esc(c.name)} · SUBJECT ROADMAP</span><h1>Your starting point in ${esc(c.name)}.</h1><p>Explore only this subject’s courses. The module order belongs to each course—not a compulsory order across every course in the Academy.</p></div></header><section class="category-explainer"><span class="academy-kicker">SUGGESTED FIRST COURSE</span><h2>${esc(start.name)}</h2><p>${esc(start.audience)}</p><h3>Before you start</h3>${list(start.prerequisites)}<a class="btn btn-primary" href="${start.url}">Explore the starting course ${icon("arrow")}</a></section><section class="roadmap-order"><h2>Courses and their module order</h2>${c.paths.map((p) => `<div class="roadmap-path"><div class="section-heading"><h3><a href="${p.url}">${esc(p.name)}</a></h3><span class="small muted">${plural(p.topics.length, "lesson")}</span></div><p>${esc(p.description)}</p><ol class="roadmap-timeline">${p.modules.map((m, i) => `<li><span class="roadmap-stop" aria-hidden="true">${i + 1}</span><div><h4>${esc(m.name)}</h4><p>${esc(m.outcome)}</p><ul>${m.topics.map((t) => `<li><a href="${t.url}">${esc(t.name)} →</a></li>`).join("")}</ul></div></li>`).join("")}</ol><a class="text-button" href="${p.url}">See course prerequisites & outcomes →</a></div>`).join("")}</section><section class="academy-next-note" id="next-steps"><h2>Choose your next course deliberately.</h2><p>Finish or review your current course’s outcomes, then compare another course’s prerequisites. Only published courses are shown; this roadmap makes no promise of a complete professional qualification.</p><a class="text-button" href="${c.url}">Compare courses in ${esc(c.name)} →</a></section>`;
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
    sections = sectionsFor(t);
  const resources = (t.content.references || [])
    .map(safeHttpUrl)
    .filter(Boolean);
  return `${breadcrumbView(page)}<header class="lesson-heading"><span class="academy-kicker">${esc(p.name)} · ${esc(module.name)}</span><h1>${esc(t.name)}</h1><p>${esc(t.description)}</p><div class="topic-meta"><span>${esc(t.difficulty)}</span><span>${Number(t.estimated_minutes)} min reading + practice</span></div></header><div class="topic-context"><strong>Where this fits</strong><p>Lesson ${p.topics.indexOf(t) + 1} of ${p.topics.length} in ${esc(p.name)}. Module goal: ${esc(module.outcome)}</p><a class="text-button" href="${p.url}#module-${module.slug}">View this course’s curriculum →</a></div><nav class="static-section-links" aria-label="On this lesson">${sections.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join("")}<a href="#labs">Practice</a></nav><article class="lesson-reader static-lesson">${sections.map((s) => `<section id="${s.id}" class="lesson-section"><h2>${esc(s.title)}</h2><div class="prose learning-prose">${blocksView(s.blocks)}</div></section>`).join("")}<section id="labs" class="lesson-section"><h2>Practice resources</h2><p>${esc(t.content.practice_guidance || "Use a suitable learning environment and follow the resource’s instructions. Test other people’s systems only with permission.")}</p>${data.labs
    .filter((l) => l.topic_id === t.id && safeHttpUrl(l.url))
    .map(
      (l) =>
        `<div class="academy-lab"><h3>${esc(l.title)}</h3><p>${esc(l.description)}</p><a class="btn btn-secondary" href="${esc(safeHttpUrl(l.url))}" target="_blank" rel="noopener noreferrer">Open ${esc(l.provider)} resource ↗</a></div>`,
    )
    .join(
      "",
    )}</section>${resources.length ? `<section class="lesson-section"><h2>Sources & further reading</h2><ul class="static-resources">${resources.map((url) => `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(url).hostname + new URL(url).pathname)} ↗</a></li>`).join("")}</ul></section>` : ""}</article><div class="academy-next-note"><h2>${next ? "Next in this course" : "You’ve reached the last lesson in this course"}</h2><p>${next ? esc(next.name) : "Review the outcomes and practice any concepts that still feel unfamiliar."}</p><a class="btn btn-secondary" href="${next?.url || p.url}">${next ? "Continue to the next lesson" : "Review course outcomes"} ${icon("arrow")}</a></div>`;
}
export function publicView(data, page, context = {}) {
  if (page.type === "overview") return hubView(data, context);
  if (page.type === "roadmap") return roadmapView(data);
  if (page.type === "category-roadmap") return categoryRoadmapView(data, page);
  if (page.type === "category") return categoryView(data, page);
  if (page.type === "path") return pathView(data, page, context);
  if (page.type === "lesson") return staticLessonView(data, page);
  return '<div class="academy-empty"><h1>Lesson not found</h1><p>This lesson is not in the published curriculum.</p><a href="/learning">Explore the Academy</a></div>';
}
