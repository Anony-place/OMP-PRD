#!/usr/bin/env node
/* ============================================================
   The static article pages, built from fixtures, with no network.

   scripts/build-static-seo.mjs is the part of the site that search engines
   actually read, and until now nothing ran it. The bug that prompted this file
   was invisible for exactly that reason: the template has supported per-article
   SEO overrides since they were written, and the query never asked for the
   columns, so every override resolved to undefined and every page quietly used
   the defaults. Nothing failed. The pages were just not the pages the panel said
   they were.

   So: a fake Supabase on localhost, the real generator in a temp directory, and
   assertions on the HTML it writes.

   Run: node tools/test_static_build.mjs
   ============================================================ */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

const CAT_A = '11111111-1111-1111-1111-111111111111';
const CAT_B = '22222222-2222-2222-2222-222222222222';

const articles = [
  {
    slug: 'alpha-article', title: 'Alpha Article', summary: 'Alpha summary.',
    content: '<h2>One</h2><p>Alpha body.</p>', status: 'published',
    published_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z', featured_image: null,
    meta_title: 'Alpha Meta Title For Search',
    meta_description: 'Alpha meta description that search engines should show.',
    og_image: 'https://cdn.example.test/alpha.png',
    canonical_url: 'https://canonical.example.test/alpha',
    robots_noindex: false, category_id: CAT_A
  },
  {
    slug: 'beta-article', title: 'Beta Article', summary: 'Beta summary.',
    content: '<h2>Two</h2><p>Beta body.</p>', status: 'published',
    published_at: '2026-02-01T00:00:00Z', created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-02T00:00:00Z', featured_image: null,
    meta_title: null, meta_description: null, og_image: null,
    canonical_url: null, robots_noindex: false, category_id: CAT_A
  },
  {
    slug: 'gamma-article', title: 'Gamma Article', summary: 'Gamma summary.',
    content: '<h2>Three</h2><p>Gamma body.</p>', status: 'published',
    published_at: '2026-03-01T00:00:00Z', created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-02T00:00:00Z', featured_image: null,
    meta_title: null, meta_description: null, og_image: null,
    canonical_url: null, robots_noindex: false, category_id: CAT_B
  },
  {
    slug: 'delta-article', title: 'Delta Article', summary: 'Delta summary.',
    content: '<h2>Four</h2><p>Delta body.</p>', status: 'published',
    published_at: '2026-04-01T00:00:00Z', created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-02T00:00:00Z', featured_image: null,
    meta_title: null, meta_description: null, og_image: null,
    canonical_url: null, robots_noindex: false, category_id: null
  },
  {
    slug: 'hidden-article', title: 'Hidden Article', summary: 'Hidden summary.',
    content: '<h2>Five</h2><p>Hidden body.</p>', status: 'published',
    published_at: '2026-05-01T00:00:00Z', created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-02T00:00:00Z', featured_image: null,
    meta_title: null, meta_description: null, og_image: null,
    canonical_url: null, robots_noindex: true, category_id: CAT_B
  }
];

const categories = [
  { id: CAT_A, name: 'Deep Dives', slug: 'deep-dives' },
  { id: CAT_B, name: 'Fundamentals', slug: 'fundamentals' }
];

const tables = {
  articles,
  article_categories: categories,
  products: [],
  osint_tools: [],
  osint_categories: [],
  pentest_tools: [],
  pentest_categories: []
};

const selects = {};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const table = url.pathname.replace('/rest/v1/', '');
  if (!(table in tables)) { res.writeHead(404); res.end('[]'); return; }
  selects[table] = url.searchParams.get('select') || '';
  /* Pagination is real: the generator advances by the number of rows it got,
     and an endpoint that ignores offset would be caught as repeated rows. */
  const offset = Number(url.searchParams.get('offset') || 0);
  const limit = Number(url.searchParams.get('limit') || 1000);
  const rows = tables[table]
    .filter((row) => {
      const want = url.searchParams.get('status');
      if (!want) return true;
      return row.status === want.replace('eq.', '');
    })
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)))
    .slice(offset, offset + limit);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(rows));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-build-'));
for (const copy of ['tools/site-footer.html', 'pentest.html', 'osint.html']) {
  const target = path.join(workdir, copy);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, copy), target);
}

const build = await new Promise((resolve) => {
  const child = spawn(process.execPath, [path.join(root, 'scripts/build-static-seo.mjs')], {
    cwd: workdir,
    env: {
      ...process.env,
      SUPABASE_URL: `http://127.0.0.1:${port}`,
      SUPABASE_PUBLISHABLE_KEY: 'test-key',
      SITE_ORIGIN: 'https://example.test'
    }
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.on('close', (code) => resolve({ code, output }));
});
server.close();

if (build.code !== 0) {
  console.log(build.output.split('\n').slice(-25).join('\n'));
  fs.rmSync(workdir, { recursive: true, force: true });
  console.log('\nbuild failed; nothing else can be checked\n');
  process.exit(1);
}

const page = (slug) => fs.readFileSync(path.join(workdir, 'articles', `${slug}.html`), 'utf8');
const sitemap = fs.readFileSync(path.join(workdir, 'sitemap.xml'), 'utf8');

section('The generator ran');

assert(build.code === 0, `build exited 0${build.code === 0 ? '' : ` — ${build.output.split('\n').slice(-4).join(' ')}`}`);
assert(fs.existsSync(path.join(workdir, 'articles', 'alpha-article.html')), 'alpha-article.html was written');
assert(/Built 5 article pages/.test(build.output), 'all five fixture articles were built');

section('The query asks for every column the template reads');

/* The regression this file exists for. A field the template reads but the
   select omits is undefined, and undefined silently means "use the default". */
const asked = selects.articles || '';
for (const field of ['title', 'summary', 'content', 'published_at', 'updated_at', 'created_at',
  'featured_image', 'meta_title', 'meta_description', 'og_image', 'canonical_url',
  'robots_noindex', 'category_id']) {
  assert(asked.includes(field), `articles select includes ${field}`);
}

section('Per-article SEO overrides reach the page');

const alpha = page('alpha-article');
assert(alpha.includes('<title>Alpha Meta Title For Search'), 'meta_title becomes the <title>');
assert(alpha.includes('name="description" content="Alpha meta description that search engines should show."'),
  'meta_description becomes the description');
assert(alpha.includes('<link rel="canonical" href="https://canonical.example.test/alpha">'),
  'canonical_url overrides the generated canonical');
assert(alpha.includes('content="https://cdn.example.test/alpha.png"'),
  'og_image becomes the social card');
assert(alpha.includes('<script type="application/ld+json">'), 'structured data is present');

const beta = page('beta-article');
assert(!beta.includes('Alpha Meta Title'), 'one article\'s overrides do not leak into another');
assert(/<title>Beta Article[^<]*<\/title>/.test(beta), 'an article with no override keeps the generated title');

section('A noindexed article says so, everywhere');

const hidden = page('hidden-article');
assert(hidden.includes('<meta name="robots" content="noindex,follow">'), 'the page carries noindex');
assert(!sitemap.includes('hidden-article'), 'the sitemap does not advertise it');
assert(sitemap.includes('alpha-article'), 'ordinary articles stay in the sitemap');

section('Every article is a way into another one');

assert(alpha.includes('Related articles'), 'the related section is rendered');
const alphaRelated = alpha.slice(alpha.indexOf('Related articles'));
assert(alphaRelated.includes('/articles/beta-article'), 'the same-category article is related');
assert(alphaRelated.includes('/articles/delta-article'), 'newer unrelated articles fill the rest');
assert(!alphaRelated.includes('/articles/alpha-article'), 'an article does not relate to itself');
assert(!alphaRelated.includes('/articles/hidden-article'), 'a noindexed page is not linked to');
assert((alphaRelated.match(/<article class="feed-row"/g) || []).length === 3, 'three cards, never more');

const alphaRelatedSlugs = [...alphaRelated.matchAll(/href="\/articles\/([a-z0-9-]+)"/g)].map((m) => m[1]);
assert(alphaRelatedSlugs[0] === 'beta-article', 'same category comes first, ahead of a newer one');

const delta = page('delta-article');
assert(delta.includes('Related articles'), 'an uncategorised article still gets related links');
assert(!/href="\/articles\/delta-article"/.test(delta.slice(delta.indexOf('Related articles'))),
  'it does not relate to itself either');

assert(alpha.includes('Deep Dives'), 'the related card names the category it came from');

section('Nothing that was there before was dropped');

assert(alpha.includes('href="/articles"'), 'the Articles hub link is still reachable');
assert(alpha.includes('class="article-layout"') || alpha.includes('container-narrow'), 'the article layout is intact');
assert(alpha.includes('BreadcrumbList'), 'breadcrumb structured data survived');
assert(fs.existsSync(path.join(workdir, 'llms.txt')), 'llms.txt is still regenerated');

fs.rmSync(workdir, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
