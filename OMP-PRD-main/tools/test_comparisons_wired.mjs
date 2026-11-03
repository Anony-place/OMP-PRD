#!/usr/bin/env node
/* ============================================================
   A comparison page that nothing links to is a page nobody finds.

   Adding a comparison takes three separate edits in two files: the entry in
   COMPARISONS, a route in sitemap-core.mjs, and (after the build) an HTML file
   on disk. Miss the route and the page exists, renders, and is absent from
   every sitemap - which is the failure mode that produces no error, no broken
   link, and no traffic.

   This gate reads the built site, so it runs after the build in CI.

   Run: node tools/test_comparisons_wired.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
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

const source = fs.readFileSync(path.join(root, 'scripts/build-phase3-seo.mjs'), 'utf8');
const start = source.indexOf('export const COMPARISONS');
const end = source.indexOf('\n];', start);
assert(start > -1 && end > start, 'COMPARISONS is a literal array this gate can read');
const body = source.slice(start, end);
const slugs = [...body.matchAll(/^\s{4}slug: '([a-z0-9-]+)'/gm)].map((m) => m[1]);

const core = await import(`file://${path.join(root, 'functions/sitemap-core.mjs')}`);
const routes = new Set(core.STATIC_ROUTES);
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');

section('Every comparison is defined once');

assert(slugs.length >= 15, `COMPARISONS lists ${slugs.length} comparisons`);
assert(new Set(slugs).size === slugs.length, 'no duplicate slugs');

section('Every comparison has a page, a route and a sitemap entry');

for (const slug of slugs) {
  const file = path.join(root, 'compare', `${slug}.html`);
  assert(fs.existsSync(file), `compare/${slug}.html exists`);
  assert(routes.has(`/compare/${slug}`), `/compare/${slug} is in STATIC_ROUTES`);
  assert(sitemap.includes(`/compare/${slug}<`), `/compare/${slug} is in sitemap.xml`);
}

section('The hub links to every comparison');

const hub = fs.readFileSync(path.join(root, 'compare.html'), 'utf8');
for (const slug of slugs) {
  assert(hub.includes(`/compare/${slug}"`), `/compare lists ${slug}`);
}

section('Pages are worth indexing');

for (const slug of slugs) {
  const html = fs.readFileSync(path.join(root, 'compare', `${slug}.html`), 'utf8');
  const words = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  assert(words >= 400, `compare/${slug}.html has ${words} words`);
  assert(/<title>[^<]{10,}<\/title>/.test(html), `compare/${slug} has a real title`);
  assert(html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"'), `compare/${slug} carries FAQ structured data`);
}

section('Every cheat sheet is reachable too');

/* Same three-edit problem: CHEATSHEETS entry, STATIC_ROUTES route, built file. */
const sheetSource = fs.readFileSync(path.join(root, 'scripts/build-phase3-seo.mjs'), 'utf8');
const sheetStart = sheetSource.indexOf('export const CHEATSHEETS');
const sheetEnd = sheetSource.indexOf('\n];', sheetStart);
const sheetSlugs = [...sheetSource.slice(sheetStart, sheetEnd).matchAll(/^\s{4}slug: '([a-z0-9-]+)'/gm)].map((m) => m[1]);
const sheetHub = fs.readFileSync(path.join(root, 'cheatsheets.html'), 'utf8');

assert(sheetSlugs.length >= 10, `CHEATSHEETS lists ${sheetSlugs.length} cheat sheets`);
for (const slug of sheetSlugs) {
  assert(fs.existsSync(path.join(root, 'cheatsheets', `${slug}.html`)), `cheatsheets/${slug}.html exists`);
  assert(routes.has(`/cheatsheets/${slug}`), `/cheatsheets/${slug} is in STATIC_ROUTES`);
  assert(sitemap.includes(`/cheatsheets/${slug}<`), `/cheatsheets/${slug} is in sitemap.xml`);
  assert(sheetHub.includes(`/cheatsheets/${slug}"`), `the cheat sheet hub lists ${slug}`);
}

section('No comparison links to a page that does not exist');

for (const slug of slugs) {
  const html = fs.readFileSync(path.join(root, 'compare', `${slug}.html`), 'utf8');
  const links = [...html.matchAll(/href="(\/[a-z0-9\/-]*)"/g)].map((m) => m[1]);
  const internal = [...new Set(links)].filter((href) => !href.startsWith('//'));
  for (const href of internal) {
    const route = href.replace(/\/$/, '') || '/';
    const exists =
      routes.has(route) ||
      fs.existsSync(path.join(root, `${route}.html`)) ||
      fs.existsSync(path.join(root, route, 'index.html')) ||
      route === '/';
    if (!exists) failures.push(`compare/${slug} links to ${href}, which is not a page`);
  }
}
assert(!failures.some((f) => f.includes('which is not a page')), 'every internal link resolves');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
