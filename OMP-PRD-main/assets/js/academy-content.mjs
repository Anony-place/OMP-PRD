import { normalizeSelfCheck } from "./academy-local.mjs";
/* Subject-neutral, data-only lesson format. No HTML, scripts or code execution.
 * Existing six-section security lessons retain their IDs and bookmarks. */
export const legacySections = [
  ["overview", "Overview", "overview"],
  ["how-it-works", "How it works", "how_it_works"],
  ["history", "The background", "history"],
  ["real-world", "Real-world examples", "real_world"],
  ["look-for", "What to look for", "what_to_look_for"],
  ["defensive", "Defensive thinking", "defensive"],
];
const text = (value) => typeof value === "string" && Boolean(value.trim());
const list = (value) =>
  Array.isArray(value) && value.length > 0 && value.every(text);
const reserved = new Set(["labs", "quiz", "account", "main", "learning-app"]);
function block(value, label) {
  if (!value || typeof value !== "object")
    throw new Error(`Invalid lesson block: ${label}`);
  if (value.type === "list" && list(value.items))
    return { type: "list", items: [...value.items] };
  if (["paragraph", "code"].includes(value.type) && text(value.text)) {
    if (
      value.type === "code" &&
      value.language !== undefined &&
      !/^[a-z0-9+#.-]{1,30}$/i.test(value.language)
    )
      throw new Error(`Invalid code language: ${label}`);
    return {
      type: value.type,
      text: value.text,
      ...(value.type === "code" && value.language
        ? { language: value.language }
        : {}),
    };
  }
  throw new Error(`Empty or unsupported lesson block: ${label}`);
}
export function normalizeContent(raw, label) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(`Invalid public lesson content: ${label}`);
  const content = {};
  if (raw.self_check !== undefined)
    content.self_check = normalizeSelfCheck(raw.self_check);
  for (const key of ["seo_title", "seo_description", "practice_guidance"]) {
    if (raw[key] !== undefined) {
      if (!text(raw[key]))
        throw new Error(`Invalid public lesson content: ${key}`);
      content[key] = raw[key];
    }
  }
  if (raw.keywords !== undefined) {
    if (!(text(raw.keywords) || list(raw.keywords)))
      throw new Error("Invalid public lesson keywords");
    content.keywords = raw.keywords;
  }
  if (raw.sections !== undefined) {
    if (
      !Array.isArray(raw.sections) ||
      !raw.sections.length ||
      raw.sections.length > 30
    )
      throw new Error(`Published lesson ${label} needs 1–30 sections`);
    const ids = new Set();
    content.sections = raw.sections.map((section) => {
      if (
        !section ||
        typeof section.id !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section.id) ||
        reserved.has(section.id) ||
        /^s-0[1-8]$/.test(section.id) ||
        ids.has(section.id) ||
        !text(section.title)
      )
        throw new Error(`Invalid or duplicate lesson section: ${label}`);
      ids.add(section.id);
      if (
        !Array.isArray(section.blocks) ||
        !section.blocks.length ||
        section.blocks.length > 100
      )
        throw new Error(
          `Published lesson ${label} needs non-empty section blocks`,
        );
      return {
        id: section.id,
        title: section.title,
        blocks: section.blocks.map((b) => block(b, label)),
      };
    });
  } else {
    for (const [, , key] of legacySections) {
      if (!(text(raw[key]) || list(raw[key])))
        throw new Error(`Published lesson ${label} needs non-empty ${key}`);
      content[key] = raw[key];
    }
  }
  if (
    !list(raw.references) ||
    raw.references.some((value) => {
      try {
        const u = new URL(value);
        return u.protocol !== "https:" || Boolean(u.username || u.password);
      } catch {
        return true;
      }
    })
  )
    throw new Error(`Published lesson ${label} needs HTTPS references`);
  content.references = [...raw.references];
  return content;
}
export function sectionsFor(topic) {
  if (topic.content.sections) return topic.content.sections;
  return legacySections.map(([id, title, key]) => ({
    id,
    title,
    blocks: [
      Array.isArray(topic.content[key])
        ? { type: "list", items: topic.content[key] }
        : { type: "paragraph", text: topic.content[key] },
    ],
  }));
}
