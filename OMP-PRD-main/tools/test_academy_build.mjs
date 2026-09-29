import { multiSubjectFixture } from "./academy_multi_subject_fixture.mjs";
/* Exercise the production build path with a LOCAL HTTP fixture in a temporary
 * copy. Never calls production Supabase or writes to the real working tree. */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = await mkdtemp(join(tmpdir(), "omp-academy-build-"));
const cwd = join(scratch, "site");
let failing = false, badPublicResponse = false;
const fixture = JSON.parse(
  await readFile(join(root, "assets/data/academy-reading.json"), "utf8"),
);
const tables = {
  learning_categories: fixture.categories,
  learning_paths: fixture.paths,
  learning_modules: fixture.modules,
  learning_topics: fixture.topics,
  learning_labs: fixture.labs,
  articles: [],
  products: [],
};
const seen = new Set();
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://fixture.test"),
    table = url.pathname.split("/").pop();
  seen.add(table);
  // Publishable keys are not JWTs. Reject the legacy Authorization misuse in
  // the actual static publisher (the Academy public loader already uses apikey).
  if (['articles', 'products'].includes(table) &&
      (req.headers.authorization || req.headers.apikey !== 'local-fixture-only')) {
    res.writeHead(401); res.end('Invalid public request authentication'); return;
  }
  res.setHeader("Content-Type", "application/json");
  if (failing && table === "learning_paths") {
    res.writeHead(503);
    res.end(JSON.stringify({ error: "fixture-unavailable" }));
    return;
  }
  if (badPublicResponse && table === 'articles') {
    res.end(JSON.stringify({ unexpected: 'not a row array' })); return;
  }
  if (!tables[table]) {
    res.writeHead(404);
    res.end("[]");
    return;
  }
  const fields = url.searchParams.get("select")?.split(","),
    rows = tables[table].slice(
      Number(url.searchParams.get("offset") || 0),
      Number(url.searchParams.get("offset") || 0) +
        Math.min(Number(url.searchParams.get("limit") || 500), ["articles", "products"].includes(table) ? 1 : 500),
    );
  res.end(
    JSON.stringify(
      rows.map((row) =>
        fields
          ? Object.fromEntries(
              fields.filter((k) => k in row).map((k) => [k, row[k]]),
            )
          : row,
      ),
    ),
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const env = {
  ...process.env,
  NODE_PATH: [join(root, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(":"),
  SUPABASE_URL: `http://127.0.0.1:${server.address().port}`,
  SUPABASE_PUBLISHABLE_KEY: "local-fixture-only",
  SITE_ORIGIN: "https://oopsmypassword.web.app",
};
function run(command, args, expected = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env });
    let output = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 45000);
    child.stdout.on("data", (s) => (output += s));
    child.stderr.on("data", (s) => (output += s));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      code === expected
        ? resolve(output)
        : reject(
            new Error(
              `${command} ${args.join(" ")} returned ${code}\n${output}`,
            ),
          );
    });
  });
}
try {
  await cp(root, cwd, {
    recursive: true,
    filter: (file) =>
      !relative(root, file)
        .split("/")
        .some((part) => ["node_modules", ".git", "__pycache__"].includes(part)),
  });
  await run("python3", ["tools/build.py"]);
  assert.match(
    await readFile(join(cwd, "sitemap.xml"), "utf8"),
    /<loc>https:\/\/oopsmypassword\.web\.app\/learning\/roadmap<\/loc>/,
  );
  console.log("✓ Python rebuild preserves imported Academy sitemap routes");
  await run("node", ["scripts/build-academy.mjs"]); // deliberately NOT --snapshot
  await run("node", ["functions/sync-sitemap-core.js"]);
  await run("node", ["scripts/build-static-seo.mjs"]);
  await run("python3", ["tools/qa.py"]);
  await run("node", ["scripts/verify-seo.mjs"]);
  for (const name of [
    "learning_categories",
    "learning_paths",
    "learning_modules",
    "learning_topics",
    "learning_labs",
  ])
    assert.ok(seen.has(name));
  console.log(
    "✓ Full generator → live-mode Academy publisher → sitemap pipeline passes HTML/link/SEO checks against a local REST fixture",
  );
  tables.articles = [1, 2, 3].map((i) => ({
    slug: 'private-publisher-fixture-' + i, title: 'Private publisher fixture ' + i,
    summary: 'Private pagination fixture ' + i + ', never written to the real site.',
    content: '<h2>Fixture content</h2><p>This article exists only in a temporary test directory.</p>',
    status: 'published', published_at: '2026-09-28T00:00:00Z',
  }));
  await run("node", ["scripts/build-static-seo.mjs"]);
  for (const row of tables.articles) assert.match(await readFile(join(cwd, 'articles', row.slug + '.html'), 'utf8'), /Fixture content/);
  console.log("✓ Article publisher paginates through server-capped responses without misusing publishable keys as JWTs");
  const lastArticle = join(cwd, 'articles', tables.articles[2].slug + '.html');
  const retainedArticle = await readFile(lastArticle, 'utf8');
  const retainedSitemap = await readFile(join(cwd, 'sitemap.xml'), 'utf8');
  badPublicResponse = true;
  await run("node", ["scripts/build-static-seo.mjs"], 1);
  assert.equal(await readFile(lastArticle, 'utf8'), retainedArticle);
  assert.equal(await readFile(join(cwd, 'sitemap.xml'), 'utf8'), retainedSitemap);
  badPublicResponse = false;
  console.log("✓ Invalid article API data fails closed without deleting the last good pages or sitemap");
  const published = await readFile(join(cwd, "learning.html"), "utf8");
  failing = true;
  await run("node", ["scripts/build-academy.mjs"], 1);
  assert.equal(await readFile(join(cwd, "learning.html"), "utf8"), published);
  console.log(
    "✓ A catalogue/schema service failure stops publishing without replacing the previous HTML",
  );
  failing = false;
  const content = tables.learning_topics[0].content;
  tables.learning_topics[0].content = {};
  await run("node", ["scripts/build-academy.mjs"], 1);
  assert.equal(await readFile(join(cwd, "learning.html"), "utf8"), published);
  tables.learning_topics[0].content = content;
  console.log(
    "✓ Incomplete lesson content stops publication without replacing the previous artifact",
  );
  const stale = join(cwd, "learning", "retired-topic.html");
  await writeFile(stale, "stale");
  await run("node", ["scripts/build-academy.mjs"]);
  await assert.rejects(readFile(stale));
  console.log("✓ Successful publishing removes retired generated pages");
  const multi = multiSubjectFixture(fixture);
  for (const [key, table] of [
    ["categories", "learning_categories"],
    ["paths", "learning_paths"],
    ["modules", "learning_modules"],
    ["topics", "learning_topics"],
    ["labs", "learning_labs"],
  ])
    tables[table] = multi[key];
  await run("node", ["scripts/build-academy.mjs"]);
  await run("node", ["functions/sync-sitemap-core.js"]);
  await run("node", ["scripts/build-static-seo.mjs"]);
  await run("python3", ["tools/qa.py"]);
  await run("node", ["scripts/verify-seo.mjs"]);
  const python = await readFile(
    join(cwd, "learning/programming/python-fundamentals/introduction.html"),
    "utf8",
  );
  const javascript = await readFile(
    join(cwd, "learning/programming/javascript-fundamentals/introduction.html"),
    "utf8",
  );
  assert.notEqual(
    python.match(/<title>(.*?)<\/title>/)[1],
    javascript.match(/<title>(.*?)<\/title>/)[1],
  );
  assert.ok(python.includes("print(message)"));
  assert.ok(!python.includes("Web Security Foundations"));
  const config = JSON.parse(await readFile(join(cwd, "firebase.json"), "utf8"));
  assert.ok(
    !config.hosting.redirects.some(
      (r) => r.source === "/learning/programming/introduction",
    ),
  );
  console.log(
    "✓ Three-subject/four-course publication produces distinct lesson SEO, safe code and no ambiguous aliases",
  );
  console.log(
    "\n8 isolated build-pipeline checks passed. Real working-tree artifacts and production services were not changed.",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
