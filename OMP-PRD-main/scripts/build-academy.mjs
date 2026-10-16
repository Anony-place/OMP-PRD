/* Static Academy publishing: same public content for humans and crawlers.
 * Default: fail closed on live catalogue/schema errors. --snapshot is explicit
 * local preview using reviewed seed data; never a silent production fallback.
 */
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  curriculum,
  resolvePage,
  breadcrumbs,
} from "../assets/js/academy-model.mjs";
import { publicView, workspaceView, esc } from "../assets/js/academy-views.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = (
  process.env.SITE_ORIGIN || "https://oopsmypassword.web.app"
).replace(/\/+$/, "");
if (new URL(site).origin !== site || !site.startsWith("https://"))
  throw new Error("SITE_ORIGIN must be an HTTPS origin");
const url =
  process.env.SUPABASE_URL || "https://aeehfulikupskyrvcpzb.supabase.co";
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR";
async function rows(table, select, filter) {
  const all = [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(
      `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&${filter}&order=sort_order.asc,id.asc&limit=500&offset=${offset}`,
      { headers: { apikey: key }, signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok)
      throw new Error(
        `Academy build: ${table} returned ${response.status}. Apply the hierarchy migration and check public read policies.`,
      );
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Invalid ${table} response`);
    all.push(...page);
    if (page.length < 500) return all;
    if (all.length > 20000)
      throw new Error("Academy catalogue exceeds build safety limit");
  }
}
async function load() {
  if (process.argv.includes("--snapshot"))
    return JSON.parse(
      await readFile(join(ROOT, "assets/data/academy-reading.json"), "utf8"),
    );
  const [categories, paths, modules, topics, labs] = await Promise.all([
    rows(
      "learning_categories",
      "id,slug,name,description,sort_order,is_active",
      "is_active=eq.true",
    ),
    rows(
      "learning_paths",
      "id,category_id,slug,name,description,audience,difficulty,prerequisites,outcomes,next_steps,is_start_here,sort_order,status",
      "status=eq.published",
    ),
    rows(
      "learning_modules",
      "id,path_id,category_id,slug,name,description,outcome,sort_order,status",
      "status=eq.published",
    ),
    rows(
      "learning_topics",
      "id,category_id,module_id,path_id,slug,name,description,difficulty,estimated_minutes,sort_order,status,content",
      "status=eq.published",
    ),
    rows(
      "learning_labs",
      "id,topic_id,title,provider,url,description,sort_order,is_active",
      "is_active=eq.true",
    ),
  ]);
  return { categories, paths, modules, topics, labs, quizzes: [] };
}
const json = (value) =>
  JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
function structuredData(data, page) {
  const url = site + page.url;
  const schema = {
    "@context": "https://schema.org",
    "@type":
      page.type === "lesson"
        ? "LearningResource"
        : page.type === "path"
          ? "Course"
          : "CollectionPage",
    "@id": url + "#page",
    url,
    name: page.title,
    description: page.description,
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: "OopsMyPassword", url: site },
  };
  if (page.type === "path")
    Object.assign(schema, {
      provider: {
        "@type": "Organization",
        name: "OMP Academy",
        url: site + "/learning",
      },
      educationalLevel: page.path.difficulty,
    });
  if (page.topic)
    Object.assign(schema, {
      learningResourceType: "Lesson",
      educationalLevel: page.topic.difficulty,
      isPartOf: {
        "@type": "Course",
        name: page.path.name,
        url: site + page.path.url,
      },
    });
  const trail = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs(page).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: site + c.url,
    })),
  };
  return [schema, trail];
}
let template = await readFile(join(ROOT, "tools/academy-shell.html"), "utf8");
// The Academy ships its own minimal header and a single-row footer. The wider
// marketing chrome would duplicate navigation and squeeze the reading column,
// so the shared site footer is deliberately not injected into Academy pages.
const TITLE_MAX = 65;
function formatTitle(rawTitle) {
  const title =
    rawTitle.replace(/\s*\|\s*(?:OopsMyPassword|OMP Academy)$/i, "").trim() ||
    rawTitle;
  const brandedTitle = title + " | OMP Academy";
  if (brandedTitle.length <= TITLE_MAX) return brandedTitle;
  if (title.length <= TITLE_MAX) return title;
  const separatorMatch = title.match(/^([^:?]+[:?])\s+(.+)$/);
  if (separatorMatch) {
    const firstPart = separatorMatch[1].replace(/[:]+$/, '');
    const brandedFirst = `${firstPart} | OMP Academy`;
    if (brandedFirst.length <= TITLE_MAX) return brandedFirst;
    if (firstPart.length <= TITLE_MAX) return firstPart;
  }
  const cut = title.slice(0, TITLE_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '');
  const brandedTrimmed = `${trimmed} | OMP Academy`;
  return brandedTrimmed.length <= TITLE_MAX ? brandedTrimmed : trimmed;
}

const META_DESCRIPTION_MAX = 160;
function metaDescription(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= META_DESCRIPTION_MAX) return text;
  const cut = text.slice(0, META_DESCRIPTION_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '') + '\u2026';
}

function documentHTML(data, page) {
  const documentTitle = formatTitle(page.title);
  const description = metaDescription(page.description);
  let html = template;
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(documentTitle)}</title>`)
    .replace(
      /<link\s+rel="canonical"[^>]*>/,
      `<link rel="canonical" href="${esc(site + page.url)}">`,
    )
    .replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      structuredData(data, page)
        .map((s) => `<script type="application/ld+json">${json(s)}</script>`)
        .join("\n"),
    );
  for (const [attr, name, value] of [
    ["name", "description", description],
    ["property", "og:title", documentTitle],
    ["property", "og:description", description],
    ["property", "og:url", site + page.url],
    ["name", "twitter:title", documentTitle],
    ["name", "twitter:description", description],
  ]) {
    html = html.replace(
      new RegExp(`<meta\\s+${attr}="${name}"[^>]*>`),
      `<meta ${attr}="${name}" content="${esc(value)}">`,
    );
  }
  html = html.replace(
    "%%ACADEMY_CONTENT%%",
    workspaceView(data, page, publicView(data, page)),
  );
  return (
    "<!-- Generated by scripts/build-academy.mjs. Edit templates/content, not this file. -->\n" +
    html
  );
}
const raw = await load();
const data = curriculum(raw);
// Publish only reachable content; no draft ancestors, private data or assessment keys.
const published = {
  schema_version: 3,
  categories: data.categories.map(
    ({ paths, topics, url, roadmapUrl, ...c }) => c,
  ),
  paths: data.paths.map(({ modules, topics, url, ...p }) => p),
  modules: data.modules.map(({ topics, ...m }) => m),
  topics: data.topics.map(({ url, legacyUrl, ...t }) => t),
  labs: data.labs,
  quizzes: [],
};
const docs = new Map(
  data.routes.map((url) => [
    url === "/learning" ? "learning.html" : url.slice(1) + ".html",
    documentHTML(data, resolvePage(data, url)),
  ]),
);
let cert = template
  .replace(
    /<link\s+rel="canonical"[^>]*>/,
    '<meta name="robots" content="noindex, follow">',
  )
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "")
  .replace(
    /<title>[\s\S]*?<\/title>/,
    "<title>Verify an Academy certificate | OopsMyPassword</title>",
  )
  .replace(
    "%%ACADEMY_CONTENT%%",
    '<div class="academy-loading" role="status"><h1>Verify an Academy certificate</h1><p>Use a certificate verification link. JavaScript is required to verify an achievement.</p></div>',
  );
cert = cert
  .replace(/<meta\s+(?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/g, "")
  .replace(
    /<meta\s+name="description"[^>]*>/,
    '<meta name="description" content="Verify an OopsMyPassword Academy lesson completion certificate using its unique verification link.">',
  );
docs.set("certificate.html", cert.replace(/^[ \t]+$/gm, ""));
const existingConfig = JSON.parse(
  await readFile(join(ROOT, "firebase.json"), "utf8"),
);
for (const redirect of existingConfig.hosting.redirects)
  if (data.routes.includes(redirect.source))
    throw new Error(
      `Published route conflicts with existing redirect: ${redirect.source}`,
    );
// All validation/rendering happens before publishing any files.
for (const [name, html] of docs) {
  await mkdir(dirname(join(ROOT, name)), { recursive: true });
  await writeFile(join(ROOT, name), html);
}
async function cleanStale(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(
    () => [],
  )) {
    const name = join(dir, entry.name);
    if (entry.isDirectory()) await cleanStale(name);
    else if (
      entry.name.endsWith(".html") &&
      !docs.has(name.slice(ROOT.length + 1))
    )
      await unlink(name);
  }
}
await cleanStale(join(ROOT, "learning"));
await writeFile(
  join(ROOT, "assets/data/academy-catalogue.json"),
  JSON.stringify(published, null, 2) + "\n",
);
const routeModule =
  "// Generated by scripts/build-academy.mjs; published routes only.\nexport const ACADEMY_ROUTES = " +
  JSON.stringify(data.routes, null, 2) +
  ";\n";
for (const folder of ["functions", "supabase/functions/sitemap"])
  await writeFile(join(ROOT, folder, "academy-routes.mjs"), routeModule);
const config = JSON.parse(await readFile(join(ROOT, "firebase.json"), "utf8"));
config.hosting.rewrites = config.hosting.rewrites.filter(
  (r) => !["/learning", "/learning/**", "/certificate"].includes(r.source),
);
// Keep prior redirects for renamed/retired topics; update only known legacy URLs.
const redirects = new Map(
  config.hosting.redirects.map((r) => [r.source || r.regex, r]),
);
for (const t of data.topics.filter((t) => t.legacyUrl))
  redirects.set(t.legacyUrl, {
    source: t.legacyUrl,
    destination: t.url,
    type: 301,
  });
config.hosting.redirects = [...redirects.values()];
await writeFile(
  join(ROOT, "firebase.json"),
  JSON.stringify(config, null, 2) + "\n",
);
console.log(
  `Academy: published ${data.categories.length} categories, ${data.paths.length} paths, ${data.modules.length} modules, ${data.topics.length} topics (${docs.size} HTML pages). Source: ${process.argv.includes("--snapshot") ? "reviewed local snapshot" : "live published catalogue"}.`,
);
