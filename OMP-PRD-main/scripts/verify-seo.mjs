#!/usr/bin/env node
/* ============================================================
   Pre-deploy SEO verification.

   Run by CI immediately before `firebase deploy --only hosting`, and
   runnable locally:

     node scripts/verify-seo.mjs

   Every rule here corresponds to a real way this site has previously
   failed to be crawled or indexed:

     1. no page may canonicalise to a domain that does not resolve
     2. every indexable page must have exactly one on-origin canonical
     3. the 404 must be noindex and canonical-free (soft 404)
     4. sitemap.xml / google-sitemap.xml must be well-formed, on-origin,
        de-duplicated, trailing-slash-free and contain every real page
     5. the two sitemap endpoints must be byte-identical
     6. robots.txt must advertise the endpoint that is actually deployed

   Exits 1 with a list of every problem found, so a bad deploy fails
   before it reaches production instead of after Google notices.
   ============================================================ */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/* The same Firebase Hosting resolver the local test harness uses, so the
   sitemap is checked against how Hosting will actually route each URL. */
const createRouter = require('../tools/hosting_router.js');

const ROOT = process.cwd();
const SITE = (process.env.SITE_ORIGIN || 'https://oopsmypassword.web.app').replace(/\/+$/, '');
/* The retired apex domain. It has no DNS record, so any canonical or sitemap
   URL pointing at it keeps that page out of the index. */
const LEGACY = (process.env.LEGACY_ORIGIN || 'https://oopsmypassword.com').replace(/\/+$/, '');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'tools', 'functions', 'supabase', 'articles', '.firebase']);

const failures = [];
const fail = (msg) => failures.push(msg);

/* ---------------------------------------------------------- sitemap checks */
function checkSitemap(file) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    fail(`${file}: missing from the deploy payload`);
    return;
  }
  const xml = fs.readFileSync(path.join(ROOT, file), 'utf8');

  /* Well-formedness: XML declaration, exactly one balanced <urlset>, and no
     element other than the sitemap vocabulary. */
  if (!/^\s*<\?xml version="1\.0" encoding="UTF-8"\?>/.test(xml)) fail(`${file}: missing XML declaration`);
  if ((xml.match(/<urlset[\s>]/g) || []).length !== 1) fail(`${file}: not exactly one <urlset>`);
  if ((xml.match(/<\/urlset>/g) || []).length !== 1) fail(`${file}: <urlset> is not closed exactly once`);
  if (!/xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml)) fail(`${file}: wrong sitemap namespace`);
  const stray = xml.replace(/<\?xml[^>]*\?>/, '').match(/<(?!\/?(?:urlset|url|loc|lastmod|changefreq|priority)\b)[a-z]/i);
  if (stray) fail(`${file}: unexpected element ${stray[0]}`);

  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  if (!entries.length) fail(`${file}: no <url> entries`);

  const locs = entries.map((e) => (e.match(/<loc>([\s\S]*?)<\/loc>/) || [])[1]);
  locs.forEach((loc, i) => {
    const where = `${file} entry ${i + 1}`;
    if (!loc) return fail(`${where}: missing <loc>`);
    if (LEGACY && loc.includes(LEGACY)) return fail(`${where}: dead origin ${loc}`);
    if (!loc.startsWith(SITE + '/')) return fail(`${where}: off-origin ${loc}`);
    if (loc !== SITE + '/' && loc.endsWith('/')) return fail(`${where}: trailing slash ${loc}`);
    if (loc.endsWith('.html')) return fail(`${where}: implementation URL ${loc}`);
    if (/\s/.test(loc)) return fail(`${where}: whitespace in ${JSON.stringify(loc)}`);
  });

  const dupes = locs.filter((l, i) => locs.indexOf(l) !== i);
  if (dupes.length) fail(`${file}: duplicate <loc> ${[...new Set(dupes)].join(', ')}`);

  const badLastmod = entries
    .map((e) => (e.match(/<lastmod>([\s\S]*?)<\/lastmod>/) || [])[1])
    .filter((v) => v !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(v));
  if (badLastmod.length) fail(`${file}: invalid <lastmod> ${badLastmod.join(', ')}`);

  /* Every real page must be discoverable from the sitemap. */
  const required = ['/', '/checker', '/generator', '/tools', '/articles', '/products',
    '/breach-check', '/password-health', '/entropy', '/passphrase', '/random-string',
    '/security-checklist', '/about', '/faq', '/glossary', '/security', '/sitemap',
    '/privacy', '/terms', '/contact'];
  const missing = required.filter((r) => !locs.includes(SITE + r));
  if (missing.length) fail(`${file}: missing pages ${missing.join(', ')}`);

  /* Every submitted URL must actually serve a page. A sitemap full of 404s or
     redirects is worse than no sitemap — Google drops the URLs and loses
     trust in the file. */
  const router = createRouter(ROOT, path.join(ROOT, 'firebase.json'));
  const broken = [];
  for (const loc of locs) {
    if (!loc) continue;
    const route = loc.slice(SITE.length) || '/';
    const r = router.resolve(route, 0);
    if (r.type !== 'file') {
      broken.push(route);
      fail(`${file}: ${route} resolves to ${r.type}${r.location ? ' (' + r.location + ')' : ''}, not a page`);
    }
  }

  /* Only summarise once the checks have actually run, so this line can never
     claim "all routable" for a file that just failed. */
  console.log(`  ${file}: ${locs.length} URLs, all on ${SITE}, ${broken.length ? broken.length + ' unroutable' : 'all routable'}`);
}

/* ------------------------------------------------------------ page checks */
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
      continue;
    }
    yield path.join(dir, entry.name);
  }
}

function checkPages() {
  let pages = 0;
  for (const file of walk(ROOT)) {
    if (!file.endsWith('.html')) continue;
    pages++;
    const rel = path.relative(ROOT, file);
    const html = fs.readFileSync(file, 'utf8');

    if (html.includes(LEGACY)) fail(`${rel}: still references the dead origin ${LEGACY}`);

    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    const noindex = /<meta name="robots"[^>]*noindex/.test(html);

    if (canonical) {
      if (canonical !== SITE + '/' && !canonical.startsWith(SITE + '/')) {
        fail(`${rel}: canonical ${canonical} is not on ${SITE}`);
      }
    } else if (!noindex) {
      fail(`${rel}: no canonical and no noindex`);
    }

    const ogUrl = (html.match(/<meta property="og:url" content="([^"]+)"/) || [])[1];
    if (ogUrl && !ogUrl.startsWith(SITE)) fail(`${rel}: og:url ${ogUrl} is not on ${SITE}`);

    const titles = html.match(/<title>[\s\S]*?<\/title>/g) || [];
    if (titles.length !== 1) fail(`${rel}: has ${titles.length} <title> elements (must be exactly 1)`);

    const descriptions = html.match(/<meta name="description"/g) || [];
    if (descriptions.length > 1) fail(`${rel}: has ${descriptions.length} meta descriptions`);
  }
  console.log(`  checked ${pages} HTML pages`);
}

function check404() {
  const file = path.join(ROOT, '404.html');
  if (!fs.existsSync(file)) return fail('404.html: missing');
  const html = fs.readFileSync(file, 'utf8');
  if (!/<meta name="robots"[^>]*noindex/.test(html)) fail('404.html: missing noindex (Search Console reports a soft 404)');
  if (/<link rel="canonical"/.test(html)) fail('404.html: carries a canonical (drop it on error pages)');
}

function checkRobots() {
  const file = path.join(ROOT, 'robots.txt');
  if (!fs.existsSync(file)) return fail('robots.txt: missing');
  const robots = fs.readFileSync(file, 'utf8');
  const declared = (robots.match(/^Sitemap:[ \t]*(\S+)[ \t]*$/gm) || [])
    .map((l) => l.replace(/^Sitemap:[ \t]*/, '').trim());
  if (!declared.length) fail('robots.txt: declares no Sitemap line');
  declared.forEach((u) => {
    if (u !== SITE + '/sitemap.xml') {
      fail(`robots.txt: advertises ${u} but the deployed endpoint is ${SITE}/sitemap.xml`);
    }
  });
  if (/^Disallow:[ \t]*\/sitemap/im.test(robots)) fail('robots.txt: blocks /sitemap');
  console.log(`  robots.txt advertises: ${declared.join(', ') || '(none)'}`);
}

function checkSitemapAlias() {
  const a = path.join(ROOT, 'sitemap.xml');
  const b = path.join(ROOT, 'google-sitemap.xml');
  if (!fs.existsSync(b)) return fail('google-sitemap.xml: missing (previously submitted endpoint would 404)');
  if (fs.readFileSync(a, 'utf8') !== fs.readFileSync(b, 'utf8')) {
    fail('google-sitemap.xml differs from sitemap.xml — the two endpoints must not disagree');
  }
}

/* ------------------------------------------------------------------- main */
console.log(`Verifying SEO output for ${SITE}\n`);
checkPages();
check404();
checkRobots();
checkSitemap('sitemap.xml');
checkSitemap('google-sitemap.xml');
checkSitemapAlias();

if (failures.length) {
  console.error(`\nSEO verification FAILED (${failures.length} problem${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log('\nSEO verification passed.');
