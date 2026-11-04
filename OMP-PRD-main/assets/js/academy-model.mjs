import { readingMinutes } from "./academy-content.mjs";
import { normalizeContent } from "./academy-content.mjs";
/* Shared by the static publisher and browser. No DOM, auth or network access. */
export const ROOT = "/learning";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ordered = (rows) =>
  [...rows].sort(
    (a, b) =>
      (a.sort_order || 0) - (b.sort_order || 0) || a.slug.localeCompare(b.slug),
  );
/* Time is counted from the words on the page, not from a stored estimate:
   the stored numbers said 14 minutes for lessons carrying about 370 words. */
export const minutes = (topics) =>
  topics.reduce((sum, t) => sum + readingMinutes(t), 0);
export function curriculum(raw) {
  const source = structuredClone(raw);
  for (const key of ["categories", "paths", "modules", "topics", "labs"])
    if (!Array.isArray(source[key]))
      throw new Error(`Academy catalogue missing ${key}`);
  const validate = (rows, label, parent) => {
    const ids = new Set(),
      names = new Set();
    for (const row of rows) {
      if (!row.id || ids.has(row.id))
        throw new Error(`Duplicate/missing ${label} ID`);
      if (
        !slugPattern.test(row.slug) ||
        row.slug === "index" ||
        !row.name?.trim()
      )
        throw new Error(`Invalid ${label} slug or title`);
      const key = `${parent ? row[parent] : ""}/${row.slug}`;
      if (names.has(key)) throw new Error(`Duplicate ${label} slug: ${key}`);
      ids.add(row.id);
      names.add(key);
    }
  };
  validate(source.categories, "category");
  validate(source.paths, "path", "category_id");
  validate(source.modules, "module", "path_id");
  validate(
    source.topics.map((t) => ({
      ...t,
      course_id:
        source.modules.find((m) => m.id === t.module_id)?.path_id ||
        t.path_id ||
        t.category_id,
    })),
    "lesson",
    "course_id",
  );
  if (source.paths.some((p) => p.slug === "roadmap"))
    throw new Error("Reserved course slug: roadmap");
  if (source.categories.some((c) => c.slug === "roadmap"))
    throw new Error("Reserved category slug: roadmap");
  const categories = ordered(
    source.categories.filter((c) => c.is_active !== false),
  );
  const paths = ordered(
    source.paths.filter(
      (p) =>
        p.status === "published" &&
        categories.some((c) => c.id === p.category_id),
    ),
  );
  const modules = ordered(
    source.modules.filter(
      (m) => m.status === "published" && paths.some((p) => p.id === m.path_id),
    ),
  );
  for (const c of categories)
    if (
      paths.filter((p) => p.category_id === c.id && p.is_start_here).length > 1
    )
      throw new Error("Only one recommended starting course per category");
  for (const p of paths) {
    for (const field of ["prerequisites", "outcomes"])
      if (
        !Array.isArray(p[field]) ||
        p[field].some((v) => typeof v !== "string" || !v.trim())
      )
        throw new Error(`Invalid path ${field}`);
    if (
      ![p.description, p.audience, p.next_steps].every(
        (v) => typeof v === "string" && v.trim(),
      ) ||
      !p.outcomes.length
    )
      throw new Error(
        "Published paths need description, audience and outcomes",
      );
  }
  for (const m of modules) {
    if (typeof m.outcome !== "string" || !m.outcome.trim())
      throw new Error(`Published module needs an outcome: ${m.slug}`);
    if (paths.find((p) => p.id === m.path_id).category_id !== m.category_id)
      throw new Error("Module crosses category boundary");
  }
  const topics = [];
  for (const t of ordered(
    source.topics.filter((t) => !t.status || t.status === "published"),
  )) {
    const m = source.modules.find((m) => m.id === t.module_id);
    if (!m)
      throw new Error(`Topic needs a module before publishing: ${t.slug}`);
    if (t.path_id && t.path_id !== m.path_id)
      throw new Error("Lesson crosses course boundary");
    if (m.category_id !== t.category_id)
      throw new Error("Topic crosses category boundary");
    if (!modules.some((x) => x.id === m.id)) continue; // unpublished ancestors never leak into navigation/HTML
    const p = paths.find((p) => p.id === m.path_id),
      c = categories.find((c) => c.id === p.category_id);
    if (
      !Number.isFinite(Number(t.estimated_minutes)) ||
      Number(t.estimated_minutes) < 0
    )
      throw new Error("Invalid reading duration");
    if (typeof t.description !== "string" || !t.description.trim())
      throw new Error(`Published lesson ${t.slug} needs a description`);
    const content = normalizeContent(t.content, t.slug);
    topics.push({
      ...t,
      content,
      path_id: p.id,
      url: `${ROOT}/${c.slug}/${p.slug}/${t.slug}`,
      legacyUrl: `${ROOT}/${c.slug}/${t.slug}`,
    });
  }
  for (const m of modules)
    m.topics = topics.filter((t) => t.module_id === m.id);
  for (const p of paths) {
    const c = categories.find((c) => c.id === p.category_id);
    p.url = `${ROOT}/${c.slug}/${p.slug}`;
    p.modules = modules.filter((m) => m.path_id === p.id && m.topics.length);
    p.topics = p.modules.flatMap((m) => m.topics);
  }
  const publishedPaths = paths.filter((p) => p.topics.length);
  for (const c of categories) {
    c.url = `${ROOT}/${c.slug}`;
    c.roadmapUrl = `${c.url}/roadmap`;
    c.paths = publishedPaths.filter((p) => p.category_id === c.id);
    c.topics = c.paths.flatMap((p) => p.topics);
  }
  const publishedCategories = categories.filter((c) => c.paths.length);
  const routes = [
    ROOT,
    `${ROOT}/roadmap`,
    ...publishedCategories.flatMap((c) => [c.url, c.roadmapUrl]),
    ...publishedPaths.map((p) => p.url),
    ...topics.map((t) => t.url),
  ];
  if (new Set(routes).size !== routes.length)
    throw new Error("Academy route collision");
  // A flat legacy URL is never guessed across courses with the same lesson slug.
  // Canonical category/course/lesson URLs are always unambiguous.
  const aliasCounts = new Map();
  for (const t of topics)
    aliasCounts.set(t.legacyUrl, (aliasCounts.get(t.legacyUrl) || 0) + 1);
  for (const t of topics)
    if (routes.includes(t.legacyUrl) || aliasCounts.get(t.legacyUrl) > 1)
      t.legacyUrl = null;
  return {
    ...source,
    categories: publishedCategories,
    paths: publishedPaths,
    modules: modules.filter((m) => m.topics.length),
    topics: publishedPaths.flatMap((p) => p.topics),
    labs: source.labs.filter(
      (l) => l.is_active !== false && topics.some((t) => t.id === l.topic_id),
    ),
    quizzes: source.quizzes || [],
    routes,
  };
}
export function resolvePage(data, pathname) {
  const url = pathname.replace(/\/$/, "");
  if (url === ROOT)
    return {
      type: "overview",
      url,
      title: "Learn Cybersecurity Step by Step",
      description:
        "Learn cybersecurity step by step. Structured courses with clear outcomes, ordered modules, bite-sized lessons and knowledge checks at OMP Academy.",
    };
  if (url === `${ROOT}/roadmap`)
    return {
      type: "roadmap",
      url,
      title: "Learning paths",
      description:
        "Choose a learning path and find its recommended starting course, prerequisites and module order, without mixing unrelated courses or lessons.",
    };
  const roadmapCategory = data.categories.find((c) => c.roadmapUrl === url);
  if (roadmapCategory)
    return {
      type: "category-roadmap",
      url,
      title: `${roadmapCategory.name} course order`,
      description: `Choose your starting course in ${roadmapCategory.name}. Compare prerequisites, outcomes and modules within this learning path.`,
      category: roadmapCategory,
    };
  const category = data.categories.find((c) => c.url === url);
  if (category)
    return {
      type: "category",
      url,
      title: `${category.name} learning path`,
      description: category.description,
      category,
    };
  const path = data.paths.find((p) => p.url === url);
  if (path)
    return {
      type: "path",
      url,
      title: path.name,
      description: path.description,
      path,
      category: data.categories.find((c) => c.id === path.category_id),
    };
  const topic = data.topics.find((t) => t.url === url);
  if (topic) {
    const course = data.paths.find((p) => p.id === topic.path_id);
    const repeatedName = data.topics.some(
      (t) => t.id !== topic.id && t.name === topic.name,
    );
    const repeatedDescription = data.topics.some(
      (t) => t.id !== topic.id && t.description === topic.description,
    );
    return {
      type: "lesson",
      url,
      title:
        topic.content?.seo_title ||
        (repeatedName
          ? `${topic.name} — ${course.name} · ${course.topics.indexOf(topic) + 1}`
          : topic.name),
      description:
        topic.content?.seo_description ||
        (repeatedDescription
          ? `${topic.description} Lesson ${course.topics.indexOf(topic) + 1} in ${course.name}.`
          : topic.description),
      topic,
      path: data.paths.find((p) => p.id === topic.path_id),
      category: data.categories.find((c) => c.id === topic.category_id),
    };
  }
  const alias = data.topics.find((t) => t.legacyUrl === url);
  return alias
    ? { type: "redirect", url: alias.url }
    : {
        type: "notfound",
        url,
        title: "Lesson not found",
        description: "Explore published Academy categories and courses.",
      };
}
export function breadcrumbs(page) {
  const crumbs = [{ name: "Academy", url: ROOT }];
  if (page.type === "overview") return crumbs;
  if (page.type === "roadmap")
    return [...crumbs, { name: "Learning paths", url: page.url }];
  if (page.category)
    crumbs.push({ name: page.category.name, url: page.category.url });
  if (page.type === "category-roadmap")
    crumbs.push({ name: "Course order", url: page.url });
  if (page.path) crumbs.push({ name: page.path.name, url: page.path.url });
  if (page.topic) crumbs.push({ name: page.topic.name, url: page.topic.url });
  return crumbs;
}
export function recommended(data, categoryId) {
  const courses = data.paths.filter((p) => p.category_id === categoryId);
  return courses.find((p) => p.is_start_here) || courses[0];
}
