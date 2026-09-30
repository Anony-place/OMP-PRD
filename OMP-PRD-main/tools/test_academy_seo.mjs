/* Zero-dependency checks of the exact published artifacts and scalable model. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  curriculum,
  resolvePage,
  breadcrumbs,
} from "../assets/js/academy-model.mjs";
import { publicView } from "../assets/js/academy-views.mjs";
import { esc } from "../assets/js/academy-ui.mjs";
import { ACADEMY_ROUTES } from "../functions/academy-routes.mjs";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(
  await readFile(join(root, "assets/data/academy-catalogue.json"), "utf8"),
);
const data = curriculum(raw),
  require = createRequire(import.meta.url);
const router = require("./hosting_router.js")(root);
const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
const site = process.env.SITE_ORIGIN || "https://oopsmypassword.web.app";
let checks = 0;
function check(name, callback) {
  callback();
  checks++;
  console.log("✓ " + name);
}
check("Route manifest is derived from the published hierarchy", () =>
  assert.deepEqual(ACADEMY_ROUTES, data.routes),
);
const titles = new Set(),
  descriptions = new Set();
for (const route of data.routes) {
  const result = router.resolve(route, 0);
  assert.equal(result.type, "file");
  const html = await readFile(join(root, result.file), "utf8"),
    page = resolvePage(data, route);
  check(
    `${route}: initial HTML, canonical, breadcrumb schema and sitemap`,
    () => {
      const canonical = [
        ...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/g),
      ];
      assert.equal(canonical.length, 1);
      assert.equal(canonical[0][1], site + route);
      assert.equal((html.match(/<h1\b/g) || []).length, 1);
      assert.ok(!html.includes("Opening your Academy"));
      assert.ok(!html.includes("noindex"));
      const title = html.match(/<title>(.*?)<\/title>/)[1],
        description = html.match(
          /<meta name="description" content="([^"]+)"/,
        )[1];
      assert.ok(!titles.has(title));
      titles.add(title);
      assert.ok(!descriptions.has(description));
      descriptions.add(description);
      assert.ok(sitemap.includes(`<loc>${site + route}</loc>`));
      const schemas = [
        ...html.matchAll(
          /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
        ),
      ].map((m) => JSON.parse(m[1]));
      const trail = schemas.find((s) => s["@type"] === "BreadcrumbList");
      assert.deepEqual(
        trail.itemListElement.map((c) => c.item),
        breadcrumbs(page).map((c) => site + c.url),
      );
      assert.ok(
        schemas.some(
          (s) =>
            s["@type"] ===
            (page.type === "lesson"
              ? "LearningResource"
              : page.type === "path"
                ? "Course"
                : "CollectionPage"),
        ),
      );
      if (page.topic) {
        for (const field of [
          "overview",
          "how_it_works",
          "history",
          "real_world",
          "what_to_look_for",
          "defensive",
        ]) {
          const blocks = Array.isArray(page.topic.content[field])
            ? page.topic.content[field]
            : [page.topic.content[field]];
          for (const text of blocks)
            assert.ok(
              html.includes(esc(text)),
              `${field} must be in initial HTML`,
            );
        }
        assert.ok(!html.includes("answer_index"));
        assert.ok(!html.includes("academy-quiz"));
      }
    },
  );
}
check(
  "Unknown categories, paths, topics and extra segments return real 404 routes",
  () => {
    for (const url of [
      "/learning/missing",
      "/learning/web-application-security/missing",
      "/learning/web-application-security/foundations/missing",
      "/learning/web-application-security/foundations/missing/extra",
    ])
      assert.equal(router.resolve(url, 0).type, "notfound");
  },
);
check(
  "Legacy topic URLs redirect permanently to the canonical path and leave the sitemap",
  () => {
    for (const t of data.topics) {
      const result = router.resolve(t.legacyUrl, 0);
      assert.equal(result.status, 301);
      assert.equal(result.location, t.url);
      assert.ok(!sitemap.includes(`<loc>${site + t.legacyUrl}</loc>`));
    }
  },
);
const certificate = await readFile(join(root, "certificate.html"), "utf8");
check(
  "Certificate verification is noindex, without a conflicting canonical or sitemap entry",
  () => {
    assert.match(certificate, /name="robots" content="noindex, follow"/);
    assert.ok(!certificate.includes('rel="canonical"'));
    assert.ok(!sitemap.includes("/certificate"));
  },
);
check(
  "An additional category and path work without changes to navigation or route code",
  () => {
    const extra = structuredClone(raw);
    extra.categories.push({
      ...extra.categories[0],
      id: "category-two",
      slug: "defensive-security",
      name: "Defensive Security",
      sort_order: 1,
    });
    extra.paths.push({
      ...extra.paths[0],
      id: "path-two",
      category_id: "category-two",
      slug: "basics",
      name: "Defensive Basics",
    });
    extra.modules.push({
      ...extra.modules[0],
      id: "module-two",
      category_id: "category-two",
      path_id: "path-two",
    });
    extra.topics.push({
      ...extra.topics[0],
      id: "topic-two",
      category_id: "category-two",
      module_id: "module-two",
      path_id: "path-two",
      slug: "trust-models",
    });
    const expanded = curriculum(extra),
      url = "/learning/defensive-security/basics/trust-models";
    // The added category must appear alongside every category already in the
    // catalogue, so the expectation is derived rather than a fixed count.
    assert.equal(expanded.categories.length, raw.categories.length + 1);
    assert.ok(
      expanded.categories.some((c) => c.slug === "defensive-security"),
    );
    assert.equal(resolvePage(expanded, url).type, "lesson");
    assert.ok(
      publicView(expanded, resolvePage(expanded, "/learning")).includes(
        "Defensive Security",
      ),
    );
  },
);
check("Unpublished ancestors never expose their lessons or routes", () => {
  // Hiding a single path must remove exactly that path's own modules and
  // lessons, and must leave every other published path intact.
  const target = raw.paths[0];
  const targetTopics = raw.topics.filter((t) => t.path_id === target.id).length;
  const targetModules = raw.modules.filter((m) => m.path_id === target.id).length;
  assert.ok(targetTopics > 0 && targetModules > 0, "catalogue has no lessons to hide");
  const partial = structuredClone(raw);
  partial.paths[0].status = "draft";
  const partialFiltered = curriculum(partial);
  assert.equal(partialFiltered.paths.length, raw.paths.length - 1);
  assert.equal(
    partialFiltered.topics.length,
    raw.topics.length - targetTopics,
  );
  for (const topic of partialFiltered.topics) {
    assert.notEqual(topic.path_id, target.id);
  }
  // With every path unpublished nothing at all may be exposed.
  const hidden = structuredClone(raw);
  for (const path of hidden.paths) path.status = "draft";
  const filtered = curriculum(hidden);
  assert.equal(filtered.topics.length, 0);
  assert.equal(filtered.paths.length, 0);
  assert.equal(filtered.categories.length, 0);
});
check(
  "Publication fails on missing module assignments, unsafe slugs and cross-category links",
  () => {
    for (const mutate of [
      (r) => {
        r.topics[0].module_id = null;
      },
      (r) => {
        r.paths[0].slug = "../bad";
      },
      (r) => {
        r.modules[0].category_id = "another-category";
      },
    ]) {
      const invalid = structuredClone(raw);
      mutate(invalid);
      assert.throws(() => curriculum(invalid));
    }
  },
);
check(
  "Generated browser catalogue contains no private or assessment records",
  () => {
    assert.deepEqual(raw.quizzes, []);
    const text = JSON.stringify(raw);
    for (const key of [
      "answer_index",
      "user_id",
      "recipient_name",
      "certificate_id",
      "highest_score",
    ])
      assert.ok(!text.includes(`"${key}"`));
  },
);
const workflow = await readFile(
  join(root, "../.github/workflows/deploy.yml"),
  "utf8",
).catch(async () => {
  const { readdir } = await import("node:fs/promises");
  const dir = join(root, "../.github/workflows");
  const name = (await readdir(dir)).find((n) => n.endsWith(".yml"));
  return readFile(join(dir, name), "utf8");
});
check(
  "Both CI builds publish the live Academy before generating the final sitemap",
  () => {
    for (const name of ["seo-check", "deploy"]) {
      const job = workflow
        .split(/\n  (?=\S)/)
        .find((block) => block.startsWith(name + ":\n"));
      assert.ok(job, `${name} job exists`);
      assert.match(job, /node scripts\/build-academy\.mjs\s*\n/);
      assert.ok(
        !job.includes("build-academy.mjs --snapshot"),
        `${name} must read live published data`,
      );
      assert.ok(
        job.indexOf("node scripts/build-academy.mjs") <
          job.indexOf("node scripts/build-static-seo.mjs"),
      );
    }
  },
);
check("Deployment also requires the isolated Academy regression job", () => {
  assert.match(workflow, /needs: \[seo-check, academy-regression\]/);
  const job = workflow
    .split(/\n  (?=\S)/)
    .find((block) => block.startsWith("academy-regression:\n"));
  for (const suite of [
    "test_academy_backend.js",
    "test_academy_concurrency.js",
    "academy_browser_test.js",
    "test_runtime.js",
  ])
    assert.ok(job.includes(suite));
  assert.ok(
    job.includes("build-academy.mjs --snapshot"),
    "Only isolated QA uses the reviewed fixture",
  );
});
console.log(`\n${checks} Academy model/publication checks passed.`);
