#!/usr/bin/env node
/* ============================================================
   Pre-deploy SEO verification.

   Run by CI immediately before `firebase deploy --only hosting`, and
   runnable locally:

     SITE_ORIGIN=https://oopsmypassword.web.app node scripts/verify-seo.mjs

   Every rule corresponds to a real way this site has failed, or could
   fail, to be crawled and indexed. The build FAILS on any of them.

   Groups:
     DOMAIN    one canonical origin everywhere, https only
     ROBOTS    exists, advertises the shipped sitemap, blocks nothing public
     SITEMAP   well-formed, canonical, unique, complete, routable, no noindex
     PAGES     canonical/title/description/H1/robots/og + valid JSON-LD
     LINKS     broken internal links, orphan pages, off-origin links

   Exit 1 with every problem listed, so a bad deploy stops before it
   reaches production instead of after a search engine notices.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/* The same Firebase Hosting resolver the local test harness uses, so the
   sitemap is checked against how Hosting will actually route each URL. */
const createRouter = require('../tools/hosting_router.js');

const ROOT = fs.existsSync(path.join(process.cwd(), 'firebase.json')) ? process.cwd() : path.join(process.cwd(), 'OMP-PRD-main');
const SITE = (process.env.SITE_ORIGIN || 'https://oopsmypassword.web.app').replace(/\/+$/, '');
/* The retired apex domain. It has no DNS record, so any canonical or sitemap
   URL pointing at it keeps that page out of the index. */
const LEGACY = (process.env.LEGACY_ORIGIN || 'https://oopsmypassword.com').replace(/\/+$/, '');
const HOST = SITE.replace(/^https?:\/\//, '');

/* Deployed content. tools/, functions/ and supabase/ are excluded by
   firebase.json ignore, so nothing in them can be crawled. */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'tools', 'functions', 'supabase', '.firebase', '.github']);
/* Generated from the database at build time: they are deployed, but they are
   linked from JavaScript, not from static HTML, so they are exempt from the
   orphan check (not from any other check). */
const GENERATED_DIRS = new Set(['articles', 'products', 'osint', 'pentest', 'pentest/category']);

const failures = [];
const warnings = [];
const fail = (msg) => failures.push(msg);
const warn = (msg) => warnings.push(msg);

/* ------------------------------------------------------------- html parsing */
/* Deliberately a small purpose-built parser: the repo has no node_modules at
   verify time, and jsdom is an optional dev dependency. */
function parseHtml(html) {
  const out = {
    title: null, description: null, canonical: null, robots: null,
    ogUrl: null, ogTitle: null, ogType: null, ogImage: null, twitterCard: null,
    headings: [], links: [], imgs: [], jsonld: [], h1: 0, main: false,
  };
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
  const attrRe = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

  let m;
  while ((m = tagRe.exec(html))) {
    const [, closing, rawName, rawAttrs] = m;
    const name = rawName.toLowerCase();
    if (closing) continue;
    const attrs = {};
    let a;
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(rawAttrs))) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';

    if (name === 'title' && out.title === null) {
      const end = html.indexOf('</title>', tagRe.lastIndex);
      out.title = decode(html.slice(tagRe.lastIndex, end === -1 ? tagRe.lastIndex : end)).replace(/\s+/g, ' ').trim();
    } else if (name === 'meta') {
      const prop = (attrs.property || '').toLowerCase();
      const mname = (attrs.name || '').toLowerCase();
      if (mname === 'description' && out.description === null) out.description = decode(attrs.content || '').trim();
      if (mname === 'robots') out.robots = decode(attrs.content || '').toLowerCase();
      if (prop === 'og:url') out.ogUrl = attrs.content || '';
      if (prop === 'og:title') out.ogTitle = attrs.content || '';
      if (prop === 'og:type') out.ogType = attrs.content || '';
      if (prop === 'og:image') out.ogImage = attrs.content || '';
      if (mname === 'twitter:card') out.twitterCard = attrs.content || '';
    } else if (name === 'link' && (attrs.rel || '').toLowerCase() === 'canonical') {
      out.canonical = attrs.href || '';
    } else if (/^h[1-6]$/.test(name)) {
      const end = html.indexOf('</' + name + '>', tagRe.lastIndex);
      const text = decode(html.slice(tagRe.lastIndex, end === -1 ? tagRe.lastIndex : end)).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      out.headings.push({ level: Number(name[1]), text });
      if (name === 'h1') out.h1++;
    } else if (name === 'a' && attrs.href) {
      out.links.push(attrs.href);
    } else if (name === 'img') {
      out.imgs.push({ src: attrs.src || '', alt: attrs.alt });
    } else if (name === 'main') {
      out.main = true;
    } else if (name === 'script' && (attrs.type || '').toLowerCase() === 'application/ld+json') {
      const end = html.indexOf('</script>', tagRe.lastIndex);
      out.jsonld.push(html.slice(tagRe.lastIndex, end === -1 ? tagRe.lastIndex : end));
    }
  }
  return out;
}

function decode(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

/* ------------------------------------------------------------------- walk */
function* walk(dir, base = dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name), base);
      continue;
    }
    yield path.join(dir, entry.name);
  }
}

const htmlFiles = [...walk(ROOT)].filter((f) => f.endsWith('.html'));
const rel = (f) => path.relative(ROOT, f);
const parsed = new Map(htmlFiles.map((f) => [f, parseHtml(fs.readFileSync(f, 'utf8'))]));

/* Public URL a file is served at (cleanUrls + firebase.json rewrites). */
function publicUrl(file) {
  const r = rel(file).split(path.sep).join('/');
  if (r === '404.html') return null;
  if (r === 'index.html') return '/';
  if (r === 'Anony.su/index.html') return '/Anony.su/';
  if (r.startsWith('guides/') && r !== 'guides.html') return '/articles/' + path.basename(r, '.html');
  return '/' + r.replace(/\.html$/, '');
}

/* =========================================================== DOMAIN checks */
function checkDomain() {
  const offenders = [];
  for (const [file, p] of parsed) {
    const html = fs.readFileSync(file, 'utf8');
    if (LEGACY && html.includes(LEGACY)) offenders.push(`${rel(file)}: contains ${LEGACY}`);
    if (p.canonical && !p.canonical.startsWith(SITE)) offenders.push(`${rel(file)}: canonical ${p.canonical}`);
    if (p.ogUrl && !p.ogUrl.startsWith(SITE)) offenders.push(`${rel(file)}: og:url ${p.ogUrl}`);
    /* Absolute http:// links would be mixed content on an https site. */
    for (const href of p.links) {
      if (/^http:\/\//i.test(href)) offenders.push(`${rel(file)}: insecure http link ${href}`);
    }
    if (p.ogImage && /^http:\/\//i.test(p.ogImage)) offenders.push(`${rel(file)}: insecure og:image`);
  }
  offenders.forEach(fail);
  if (!offenders.length) console.log(`  DOMAIN  one origin (${SITE}) across ${parsed.size} pages, https only`);
}

/* =========================================================== ROBOTS checks */
function checkRobots() {
  const file = path.join(ROOT, 'robots.txt');
  if (!fs.existsSync(file)) return fail('robots.txt: missing');
  const robots = fs.readFileSync(file, 'utf8');

  const declared = (robots.match(/^Sitemap:[ \t]*(\S+)[ \t]*$/gm) || [])
    .map((l) => l.replace(/^Sitemap:[ \t]*/, '').trim());
  if (!declared.length) fail('robots.txt: declares no Sitemap line');
  /* Three endpoints, all shipped by the same build and all pointing at the
     same URL set: the canonical /sitemap.xml, an index that also lists the
     feed, and /rss.xml — which Google accepts as a valid sitemap. Declaring
     only the first one is what leaves a site with no fallback when that one
     fetch keeps failing. Anything else is a stale or wrong endpoint. */
  const allowedSitemaps = new Set([
    `${SITE}/sitemap.xml`,
    `${SITE}/sitemap-index.xml`,
    `${SITE}/sitemap.txt`,
    `${SITE}/rss.xml`,
  ]);
  declared.forEach((u) => {
    if (!allowedSitemaps.has(u)) fail(`robots.txt: advertises ${u}, which is not one of the deployed sitemap endpoints`);
  });
  for (const required of ['sitemap.xml', 'sitemap.txt', 'rss.xml']) {
    if (!declared.includes(`${SITE}/${required}`)) fail(`robots.txt: does not advertise ${SITE}/${required}`);
  }

  /* Anything Disallow'ed must be something we genuinely do not want crawled. */
  const disallowed = (robots.match(/^Disallow:[ \t]*(\S+)[ \t]*$/gm) || [])
    .map((l) => l.replace(/^Disallow:[ \t]*/, '').trim());
  const allowedPrivate = ['/Anony.su', '/functions'];
  for (const d of disallowed) {
    if (!d) continue;
    if (!allowedPrivate.some((p) => d === p || d === p + '/')) {
      fail(`robots.txt: Disallow ${d} is not a known private path — it may hide public content`);
    }
  }
  /* robots.txt must never be used as a substitute for noindex on content we
     want de-indexed, and must never block the sitemap itself. */
  if (disallowed.some((d) => d && '/sitemap'.startsWith(d.replace(/\/$/, '') || '/'))) {
    fail('robots.txt: blocks the sitemap');
  }
  if (/^User-agent:[ \t]*\*[ \t]*$/m.test(robots) && /^Disallow:[ \t]*\/[ \t]*$/m.test(robots)) {
    fail('robots.txt: Disallow: / blocks the entire site');
  }
  console.log(`  ROBOTS  sitemap -> ${declared.join(', ') || '(none)'}; Disallow: ${disallowed.join(' ') || '(none)'}`);
}

/* ========================================================== SITEMAP checks */
function checkSitemap(file, routes, noindexRoutes) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    fail(`${file}: missing from the deploy payload`);
    return;
  }
  const xml = fs.readFileSync(path.join(ROOT, file), 'utf8');

  if (!/^\s*<\?xml version="1\.0" encoding="UTF-8"\?>/.test(xml)) fail(`${file}: missing XML declaration`);
  if ((xml.match(/<urlset[\s>]/g) || []).length !== 1) fail(`${file}: not exactly one <urlset>`);
  if ((xml.match(/<\/urlset>/g) || []).length !== 1) fail(`${file}: <urlset> not closed exactly once`);
  if (!/xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml)) fail(`${file}: wrong sitemap namespace`);
  const stray = xml.replace(/<\?xml[^>]*\?>/, '').match(/<(?!\/?(?:urlset|url|loc|lastmod|changefreq|priority)\b)[a-z]/i);
  if (stray) fail(`${file}: unexpected element ${stray[0]}`);

  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((mm) => mm[1]);
  if (!entries.length) fail(`${file}: no <url> entries`);

  /* <lastmod> must be a real date or absent. An empty element is malformed,
     and a stamp on a generated page is an invented date. */
  if (/<lastmod>\s*<\/lastmod>/.test(xml)) fail(`${file}: empty <lastmod> element — omit it instead`);
  for (const entry of entries) {
    const lm = (entry.match(/<lastmod>([\s\S]*?)<\/lastmod>/) || [])[1];
    const loc = (entry.match(/<loc>([\s\S]*?)<\/loc>/) || [])[1] || '';
    if (lm === undefined) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lm)) fail(`${file}: ${loc} has a malformed <lastmod> "${lm}"`);
    const isDbBacked = /^\/articles\/[^/]+$/.test(loc.slice(SITE.length)) ||
                       /^\/products\/[^/]+$/.test(loc.slice(SITE.length)) ||
                       /^\/osint\/[^/]+$/.test(loc.slice(SITE.length)) ||
                       /^\/pentest\/(?:category\/)?[^/]+$/.test(loc.slice(SITE.length));
    const isStaticGuide = loc.slice(SITE.length).startsWith('/guides/');
    if (!isDbBacked && !isStaticGuide) {
      fail(`${file}: ${loc} asserts <lastmod> ${lm}, but generated pages have no real modification date`);
    }
  }

  const locs = entries.map((e) => (e.match(/<loc>([\s\S]*?)<\/loc>/) || [])[1]);
  locs.forEach((loc, i) => {
    const where = `${file} entry ${i + 1}`;
    if (!loc) return fail(`${where}: missing <loc>`);
    if (LEGACY && loc.includes(LEGACY)) return fail(`${where}: dead origin ${loc}`);
    if (!/^https:\/\//.test(loc)) return fail(`${where}: not https — ${loc}`);
    if (!loc.startsWith(SITE + '/')) return fail(`${where}: off-origin ${loc}`);
    if (loc !== SITE + '/' && loc.endsWith('/')) return fail(`${where}: trailing slash ${loc}`);
    if (loc.endsWith('.html')) return fail(`${where}: implementation URL ${loc}`);
    if (/[?&]/.test(loc)) return fail(`${where}: query string in ${loc}`);
    if (/\s/.test(loc)) return fail(`${where}: whitespace in ${JSON.stringify(loc)}`);
    if (/[<>&'"]/.test(loc)) return fail(`${where}: unescaped character in ${loc}`);
  });

  const dupes = locs.filter((l, i) => locs.indexOf(l) !== i);
  if (dupes.length) fail(`${file}: duplicate <loc> ${[...new Set(dupes)].join(', ')}`);

  const badLastmod = entries
    .map((e) => (e.match(/<lastmod>([\s\S]*?)<\/lastmod>/) || [])[1])
    .filter((v) => v !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(v));
  if (badLastmod.length) fail(`${file}: invalid <lastmod> ${badLastmod.join(', ')}`);

  const missing = routes.filter((r) => !locs.includes(SITE + r));
  if (missing.length) fail(`${file}: missing pages ${missing.join(', ')}`);

  /* A noindex page must never be submitted. */
  for (const r of locs) {
    const route = r.slice(SITE.length) || '/';
    if (noindexRoutes.has(route)) fail(`${file}: submits noindex page ${route}`);
  }

  /* Every submitted URL must serve a real page — no 404s, no redirects. */
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

  console.log(`  SITEMAP ${file}: ${locs.length} URLs, canonical origin, ${broken.length ? broken.length + ' unroutable' : 'all routable'}`);
}

/* ========================================================== TEXT checks */
/* Google supports a plain-text sitemap: one URL per line, UTF-8, nothing else
   in the file. It is a real fallback endpoint - on shared hostnames the XML
   endpoints are the ones that get stuck on "Couldn't fetch" while the text
   endpoint on the same host is read successfully - so it faces the same bar as
   sitemap.xml: canonical origin, https, routable 200 pages, no duplicates, and
   it must list exactly the same URL set (generated from the same entries). */
function checkTextSitemap(routes, noindexRoutes) {
  const file = path.join(ROOT, 'sitemap.txt');
  if (!fs.existsSync(file)) return fail('sitemap.txt: missing from the deploy payload');

  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.length) return fail('sitemap.txt: empty');
  if (raw.includes('\r')) fail('sitemap.txt: contains CR characters — the file must be plain UTF-8 with LF line endings');
  if (raw.charCodeAt(0) === 0xfeff) fail('sitemap.txt: starts with a byte-order mark');
  if (!raw.endsWith('\n')) fail('sitemap.txt: missing the final newline');
  if (/^\s*</.test(raw)) fail('sitemap.txt: starts with markup — this endpoint must be plain text, not XML');

  const lines = raw.split('\n');
  lines.pop(); /* trailing newline */
  if (!lines.length) fail('sitemap.txt: no URLs');

  const router = createRouter(ROOT, path.join(ROOT, 'firebase.json'));
  const seen = new Set();
  const locs = [];
  lines.forEach((line, i) => {
    const where = `sitemap.txt line ${i + 1}`;
    if (/^\s|\s$/.test(line)) return fail(`${where}: leading or trailing whitespace`);
    if (/\s/.test(line)) return fail(`${where}: whitespace inside the URL`);
    if (/^#/.test(line)) return fail(`${where}: comments are not allowed in a text sitemap`);
    if (!/^https:\/\//.test(line)) return fail(`${where}: not https — ${line}`);
    if (LEGACY && line.includes(LEGACY)) return fail(`${where}: dead origin ${line}`);
    if (!line.startsWith(SITE + '/')) return fail(`${where}: off-origin ${line}`);
    if (line !== SITE + '/' && line.endsWith('/')) return fail(`${where}: trailing slash ${line}`);
    if (line.endsWith('.html')) return fail(`${where}: implementation URL ${line}`);
    if (/[?&]/.test(line)) return fail(`${where}: query string in ${line}`);
    if (seen.has(line)) return fail(`${where}: duplicate URL ${line}`);
    seen.add(line);

    const route = line.slice(SITE.length) || '/';
    if (noindexRoutes.has(route)) return fail(`${where}: lists noindex page ${route}`);
    const r = router.resolve(route, 0);
    if (r.type !== 'file') {
      return fail(`${where}: ${route} resolves to ${r.type}${r.location ? ' (' + r.location + ')' : ''}, not a page`);
    }
    locs.push(route);
  });

  /* Same generator, same entries: a text sitemap that drifts from the XML one
     is how a page quietly stops being submitted. */
  const expected = new Set(routes.map((r) => SITE + r));
  const missing = [...expected].filter((u) => !seen.has(u));
  const extra = [...seen].filter((u) => !expected.has(u));
  if (missing.length) fail(`sitemap.txt: missing pages ${missing.map((u) => u.slice(SITE.length) || '/').join(', ')}`);
  if (extra.length) fail(`sitemap.txt: lists pages that are not indexable routes ${extra.join(', ')}`);

  console.log(`  TEXT    sitemap.txt: ${locs.length} URLs, one per line, canonical origin, ${locs.length ? 'all routable' : 'nothing usable'}`);
}

/* ============================================================== RSS checks */
/* Google accepts a well-formed RSS 2.0 feed as a sitemap, so /rss.xml is now
   a submitted discovery endpoint and not only a reader feed. That makes it a
   crawl surface with the same rules as sitemap.xml: canonical origin, https,
   200-status URLs only, no redirect, no noindex, no duplicates, no dead
   origin. It is intentionally NOT required to be exhaustive (feeds are a
   recent-content channel), but every URL it does carry must be a real page. */
function checkRssSitemap(noindexRoutes) {
  const file = path.join(ROOT, 'rss.xml');
  if (!fs.existsSync(file)) return fail('rss.xml: missing from the deploy payload');
  const xml = fs.readFileSync(file, 'utf8');

  if (!/^\s*<\?xml version="1\.0" encoding="UTF-8"\?>/.test(xml)) fail('rss.xml: missing XML declaration');
  if ((xml.match(/<rss[\s>]/g) || []).length !== 1) fail('rss.xml: not exactly one <rss> root');
  if ((xml.match(/<\/rss>/g) || []).length !== 1) fail('rss.xml: <rss> not closed exactly once');
  if (!/<rss[^>]+version="2\.0"/.test(xml)) fail('rss.xml: root is not RSS 2.0');
  if ((xml.match(/<channel>/g) || []).length !== 1) fail('rss.xml: not exactly one <channel>');
  for (const required of ['<title>', '<link>', '<description>', '<lastBuildDate>']) {
    if (!xml.includes(required)) fail(`rss.xml: channel is missing ${required}`);
  }
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
    (xml.match(/<lastBuildDate>([\s\S]*?)<\/lastBuildDate>/) || [])[1] || ''
  )) fail('rss.xml: <lastBuildDate> is not RFC 822');

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  if (!items.length) fail('rss.xml: no <item> entries — an empty feed is not a sitemap');

  const router = createRouter(ROOT, path.join(ROOT, 'firebase.json'));
  const seen = new Set();
  const locs = [];
  items.forEach((item, i) => {
    const where = `rss.xml item ${i + 1}`;
    const raw = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1];
    if (!raw) return fail(`${where}: missing <link>`);
    let url;
    try { url = new URL(raw); } catch { return fail(`${where}: <link> is not a URL — ${raw}`); }
    if (url.protocol !== 'https:') return fail(`${where}: not https — ${raw}`);
    if (url.hash || url.search) return fail(`${where}: query/hash in <link> — ${raw}`);
    if (url.origin !== SITE) return fail(`${where}: off-origin ${raw}`);

    const route = url.pathname.replace(/\/+$/, '') || '/';
    if (route.endsWith('.html')) return fail(`${where}: implementation URL ${route}`);
    if (route !== '/' && url.pathname !== route) return fail(`${where}: trailing slash ${route}`);
    if (LEGACY && raw.includes(LEGACY)) return fail(`${where}: dead origin ${raw}`);
    if (noindexRoutes.has(route)) return fail(`${where}: feeds noindex page ${route}`);
    if (seen.has(route)) return fail(`${where}: duplicate entry ${route}`);
    seen.add(route);

    const r = router.resolve(route, 0);
    if (r.type !== 'file') {
      return fail(`${where}: ${route} resolves to ${r.type}${r.location ? ' (' + r.location + ')' : ''}, not a page`);
    }
    locs.push(route);
  });

  console.log(`  RSS     rss.xml: ${locs.length} indexable URLs, canonical origin, ${locs.length ? 'all routable' : 'nothing usable'}`);
}

/* ============================================================ PAGES checks */
function checkPages(routes) {
  const titles = new Map();
  const descs = new Map();

  for (const [file, p] of parsed) {
    const r = rel(file);
    const noindex = !!p.robots && p.robots.includes('noindex');

    if (p.title === null || !p.title) fail(`${r}: missing <title>`);
    else {
      if (p.title.length > 65) warn(`${r}: title is ${p.title.length} chars (may be truncated in results)`);
      if (!titles.has(p.title)) titles.set(p.title, []);
      titles.get(p.title).push(r);
    }

    if (!p.description) fail(`${r}: missing meta description`);
    else {
      if (p.description.length < 40) warn(`${r}: meta description is only ${p.description.length} chars`);
      if (p.description.length > 170) warn(`${r}: meta description is ${p.description.length} chars (may be truncated)`);
      if (!descs.has(p.description)) descs.set(p.description, []);
      descs.get(p.description).push(r);
    }

    if (!p.main) fail(`${r}: no <main> landmark`);

    /* Indexable pages must self-canonicalise; noindex pages must not. */
    if (noindex) {
      if (p.canonical) fail(`${r}: noindex page carries a canonical (${p.canonical})`);
    } else {
      const expected = SITE + publicUrl(file);
      if (!p.canonical) fail(`${r}: no canonical and no noindex`);
      else if (p.canonical !== expected && p.canonical !== `${expected}/`) {
        fail(`${r}: canonical ${p.canonical} does not match its public URL ${expected}`);
      }
    }

    /* Headings: exactly one H1, and no skipped levels. */
    if (!noindex) {
      if (p.h1 !== 1) fail(`${r}: has ${p.h1} <h1> elements (expected exactly 1)`);
      let prev = 0;
      for (const h of p.headings) {
        if (prev && h.level > prev + 1) {
          fail(`${r}: heading jumps h${prev} -> h${h.level} ("${h.text.slice(0, 30)}")`);
          break;
        }
        prev = h.level;
      }
    }

    /* Images must be describable. */
    const noAlt = p.imgs.filter((i) => i.alt === undefined);
    if (noAlt.length) fail(`${r}: ${noAlt.length} <img> without alt (${noAlt.map((i) => i.src).slice(0, 3).join(', ')})`);

    /* Structured data must parse and be self-consistent. */
    for (const block of p.jsonld) {
      let data;
      try {
        data = JSON.parse(block);
      } catch (e) {
        fail(`${r}: invalid JSON-LD (${e.message.slice(0, 60)})`);
        continue;
      }
      for (const item of Array.isArray(data) ? data : [data]) checkSchema(r, item);
    }

    /* Social cards only where they belong. */
    if (noindex && (p.ogUrl || p.twitterCard)) warn(`${r}: noindex page still carries social cards`);
  }

  for (const [t, files] of titles) {
    if (files.length > 1) fail(`duplicate <title> "${t.slice(0, 50)}" on ${files.join(', ')}`);
  }
  for (const [d, files] of descs) {
    if (files.length > 1) fail(`duplicate meta description on ${files.join(', ')}`);
  }

  console.log(`  PAGES   ${parsed.size} pages: titles/descriptions unique, 1 H1 each, headings ordered`);
}

function checkSchema(file, item) {
  const t = item['@type'];
  if (!t) return fail(`${file}: JSON-LD object without @type`);
  if (item['@context'] !== 'https://schema.org') return fail(`${file}: ${t} has wrong @context`);

  /* No fabricated rich-result data. Nothing in the Supabase schema holds
     ratings, reviews or stock, so if one of these appears it was invented
     rather than read. */
  const UNSUPPORTED = ['aggregateRating', 'review', 'ratingValue', 'bestRating', 'worstRating'];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const key of UNSUPPORTED) {
      if (key in node) fail(`${file}: ${t} carries "${key}", which no data source in this project provides`);
    }
    if ('availability' in node) {
      fail(`${file}: ${t} carries "availability", but the products table has no stock field`);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  };
  walk(item);

  const types = Array.isArray(t) ? t : [t];
  for (const type of types) {
    if (type === 'BreadcrumbList') {
      const els = item.itemListElement || [];
      if (!els.length) fail(`${file}: BreadcrumbList with no items`);
      if (els.map((e) => e.position).join(',') !== els.map((_, i) => i + 1).join(',')) {
        fail(`${file}: BreadcrumbList positions are not 1..n`);
      }
      els.forEach((e, i) => {
        if (i < els.length - 1 && !e.item) fail(`${file}: BreadcrumbList item ${e.position} has no item URL`);
        if (e.item && !String(e.item).startsWith(SITE)) fail(`${file}: BreadcrumbList item ${e.item} is off-origin`);
      });
    }
    if (type === 'Article') {
      for (const req of ['headline', 'datePublished', 'author', 'publisher', 'mainEntityOfPage']) {
        if (!item[req]) fail(`${file}: Article missing ${req}`);
      }
    }
    if (type === 'FAQPage') {
      const qs = item.mainEntity || [];
      if (!qs.length) fail(`${file}: FAQPage with no questions`);
      qs.forEach((q) => {
        if (q['@type'] !== 'Question' || !(q.acceptedAnswer && q.acceptedAnswer.text)) {
          fail(`${file}: FAQPage question without an acceptedAnswer`);
        }
      });
    }
    if (type === 'Product') {
      if (!item.name) fail(`${file}: Product missing name`);
      if (item.url && !String(item.url).startsWith(SITE)) fail(`${file}: Product url off-origin`);
      /* Never accept an Offer without a real price — that is fabricated data. */
      if (item.offers) {
        const o = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        if (o.price === undefined || o.price === null || o.price === '') {
          fail(`${file}: Product Offer without a price`);
        }
        if (o.priceCurrency && !/^[A-Z]{3}$/.test(String(o.priceCurrency))) {
          fail(`${file}: Product Offer has invalid priceCurrency ${o.priceCurrency}`);
        }
      }
    }
    if (['WebSite', 'WebApplication', 'SoftwareApplication', 'Organization'].includes(type)) {
      if (!item.url) fail(`${file}: ${type} missing url`);
      else if (!String(item.url).startsWith(SITE)) fail(`${file}: ${type} url off-origin (${item.url})`);
    }
  }
}

/* ============================================================ LINKS checks */
function checkLinks() {
  const routeToFile = new Map();
  for (const file of htmlFiles) {
    const u = publicUrl(file);
    if (u) routeToFile.set(u, file);
  }

  const inbound = new Map([...routeToFile.keys()].map((u) => [u, 0]));
  const broken = [];
  let external = 0;

  for (const [file, p] of parsed) {
    for (const raw of p.links) {
      const href = String(raw).trim();
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      let pathname;
      if (/^https?:\/\//i.test(href)) {
        let u;
        try { u = new URL(href); } catch { broken.push([rel(file), href]); continue; }
        if (u.host !== HOST) { external++; continue; }
        pathname = u.pathname;
      } else if (href.startsWith('/')) {
        pathname = href.split('#')[0].split('?')[0];
      } else {
        pathname = path.posix.normalize(path.posix.join(path.posix.dirname('/' + rel(file)), href.split('#')[0].split('?')[0]));
      }
      if (pathname.endsWith('.html')) pathname = '/' + pathname.slice(1, -5);
      if (pathname === '/index') pathname = '/';

      if (inbound.has(pathname)) inbound.set(pathname, inbound.get(pathname) + 1);
      else if (pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/manifest.webmanifest') continue;
      else if (!fs.existsSync(path.join(ROOT, pathname.replace(/^\//, '')))) broken.push([rel(file), href]);
    }
  }

  broken.forEach(([f, h]) => fail(`${f}: broken internal link -> ${h}`));

  /* Every indexable page—including database-backed articles, products, OSINT,
     and Pentest pages—is now linked in static HTML on its hub and /sitemap,
     so no directory needs an orphan exemption. */
  const orphans = [...inbound.entries()]
    .filter(([u, n]) => n === 0)
    .map(([u]) => u)
    .filter((u) => !u.startsWith('/Anony.su'))
    .filter((u) => {
      const f = routeToFile.get(u);
      return !parsed.get(f)?.robots?.includes('noindex') && rel(f) !== 'guides.html';
    });
  orphans.forEach((u) => fail(`orphan page: ${u} has no inbound internal link`));

  const weak = [...inbound.entries()].filter(([u, n]) => n > 0 && n <= 1).map(([u]) => u);
  weak.forEach((u) => warn(`weakly linked: ${u} has only 1 inbound internal link`));

  console.log(`  LINKS   ${inbound.size} routes checked, ${broken.length} broken, ${orphans.length} orphans, ${external} external`);
}

/* ==================================================================== main */
console.log(`Verifying SEO output for ${SITE}\n`);

/* Routes that are deliberately not indexable — they must never be submitted. */
const noindexRoutes = new Set(
  [...parsed.entries()]
    .filter(([, p]) => p.robots && p.robots.includes('noindex'))
    .map(([f]) => publicUrl(f))
    .filter(Boolean)
);

/* Dynamically require EVERY indexable HTML page on disk to be in sitemap.xml
   and google-sitemap.xml so no published article, tool, lesson, or guide can
   ever be silently omitted from Google Search Console. */
const routes = [...new Set(
  [...parsed.entries()]
    .filter(([f, p]) => !(p.robots && p.robots.includes('noindex')) && rel(f) !== 'guides.html' && !rel(f).startsWith('Anony.su'))
    .map(([f]) => publicUrl(f))
    .filter(Boolean)
)];

checkDomain();
checkRobots();
checkSitemap('sitemap.xml', routes, noindexRoutes);
checkSitemap('google-sitemap.xml', routes, noindexRoutes);
checkTextSitemap(routes, noindexRoutes);
checkRssSitemap(noindexRoutes);

const a = path.join(ROOT, 'sitemap.xml');
const b = path.join(ROOT, 'google-sitemap.xml');
if (!fs.existsSync(b)) fail('google-sitemap.xml: missing (a previously submitted endpoint would 404)');
else if (fs.readFileSync(a, 'utf8') !== fs.readFileSync(b, 'utf8')) fail('google-sitemap.xml differs from sitemap.xml');

checkPages(routes);
checkLinks();

/* IndexNow: ownership is proven by serving /<key>.txt. If the file is missing
   or its body does not match its filename, every Bing/Yandex submission is
   rejected — so verify it before deploy rather than discovering it later. */
function checkIndexNow() {
  const keys = fs.readdirSync(ROOT).filter((f) => /^[0-9a-f]{8,128}\.txt$/.test(f));
  if (!keys.length) {
    warn('no IndexNow key file (<hex>.txt) in the site root — Bing/Yandex URL submission unavailable');
    return;
  }
  if (keys.length > 1) fail(`multiple IndexNow key files (${keys.join(', ')}) — keep exactly one`);
  const file = keys[0];
  const key = file.replace(/\.txt$/, '');
  const body = fs.readFileSync(path.join(ROOT, file), 'utf8').trim();
  if (body !== key) fail(`${file}: body "${body}" does not match the filename key "${key}"`);
  const router = createRouter(ROOT, path.join(ROOT, 'firebase.json'));
  const r = router.resolve('/' + file, 0);
  if (r.type !== 'file') fail(`/${file} is not served (resolves to ${r.type}) — IndexNow would reject submissions`);
  const robots = fs.existsSync(path.join(ROOT, 'robots.txt')) ? fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8') : '';
  if (/^Disallow:.*\*\.txt/m.test(robots)) fail('robots.txt blocks the IndexNow key file');
  console.log(`  INDEXNOW key ${key} served at /${file}`);
}

/* Nothing may tell crawlers to drop the sitemap or the pages it lists. */
function checkNoindexHeaders() {
  const fns = path.join(ROOT, 'functions', 'index.js');
  if (!fs.existsSync(fns)) return;
  const src = fs.readFileSync(fns, 'utf8');
  /* A "noindex" applied to every sitemap response would un-index the whole
     site, so it must not sit in the shared XML responder. The one legitimate
     use is on 404 responses. */
  const responder = src.match(/function respond\([\s\S]*?\n}/);
  if (responder && /X-Robots-Tag[^\n]*noindex/i.test(responder[0])) {
    fail('functions/index.js: the sitemap responder sets X-Robots-Tag: noindex, which would un-index every URL the sitemap lists');
  }
  console.log('  HEADERS no noindex on sitemap or page responses');
}

function checkCrawlerFetch() {
  const cfgPath = path.join(ROOT, 'firebase.json');
  if (!fs.existsSync(cfgPath)) return fail('firebase.json: missing');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const hosting = cfg.hosting || {};

  const catchAll = (hosting.rewrites || []).find((rule) =>
    /products\s*\{/.test(String(rule.source || '')) || String(rule.source || '') === '/products/**');
  if (catchAll) {
    fail('firebase.json: /products catch-all rewrite serves the hub at HTTP 200 for unknown slugs (Search Console soft 404)');
  }

  const sitemapRewrite = (hosting.rewrites || []).find((rule) =>
    String(rule.source || '') === '/sitemap.xml' || String(rule.source || '').includes('sitemap.xml'));
  if (sitemapRewrite) {
    fail('firebase.json: /sitemap.xml is rewritten — CI deploys hosting only, so Google gets 404 / Couldn\'t fetch');
  }

  const blocks = hosting.headers || [];
  const sitemapBlock = blocks.find((b) => /sitemap\.xml/.test(String(b.source || '')));
  if (!sitemapBlock) {
    fail('firebase.json: no header block covering sitemap.xml');
  } else {
    const headers = sitemapBlock.headers || [];
    const val = (key) => {
      const h = [...headers].reverse().find((x) => String(x.key) === key);
      return h ? String(h.value) : '';
    };
    if (!val('Content-Type').includes('application/xml')) {
      fail('firebase.json: sitemap Content-Type is not application/xml');
    }
    if (val('Cross-Origin-Resource-Policy') !== 'cross-origin') {
      fail('firebase.json: sitemap CORP is not cross-origin (GSC reports Couldn\'t fetch when it is same-origin)');
    }
    if (val('Access-Control-Allow-Origin') !== '*') {
      fail('firebase.json: sitemap missing Access-Control-Allow-Origin *');
    }
    if (/no-store/.test(val('Cache-Control'))) {
      fail('firebase.json: sitemap Cache-Control no-store');
    }
  }

  const robotsBlock = blocks.find((b) => String(b.source || '') === '/robots.txt');
  if (!robotsBlock) {
    fail('firebase.json: no header block for /robots.txt');
  } else {
    const corp = (robotsBlock.headers || []).find((h) => h.key === 'Cross-Origin-Resource-Policy');
    if (!corp || corp.value !== 'cross-origin') {
      fail('firebase.json: robots.txt CORP is not cross-origin');
    }
  }

  const router = createRouter(ROOT, cfgPath);
  const unknownProduct = router.resolve('/products/this-slug-does-not-exist-for-seo', 0);
  if (unknownProduct.type !== 'notfound') {
    fail(`/products/<unknown> resolves to ${unknownProduct.type} instead of 404 (soft 404)`);
  }
  const unknownOsint = router.resolve('/osint/this-slug-does-not-exist-for-seo', 0);
  if (unknownOsint.type !== 'notfound') {
    fail(`/osint/<unknown> resolves to ${unknownOsint.type} instead of 404 (soft 404)`);
  }
  const unknownPentest = router.resolve('/pentest/this-slug-does-not-exist-for-seo', 0);
  if (unknownPentest.type !== 'notfound') {
    fail(`/pentest/<unknown> resolves to ${unknownPentest.type} instead of 404 (soft 404)`);
  }
  console.log('  CRAWL   sitemap/robots crawler-open; unknown product + osint + pentest slugs 404');
}

checkIndexNow();
checkNoindexHeaders();
checkCrawlerFetch();

/* The 404 must behave like a 404. */
const nf = path.join(ROOT, '404.html');
if (!fs.existsSync(nf)) fail('404.html: missing');
else {
  const html = fs.readFileSync(nf, 'utf8');
  if (!/<meta name="robots"[^>]*noindex/.test(html)) fail('404.html: missing noindex (Search Console reports a soft 404)');
  if (/<link rel="canonical"/.test(html)) fail('404.html: carries a canonical');
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log('  ~ ' + w));
}

if (failures.length) {
  console.error(`\nSEO verification FAILED (${failures.length} problem${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((f) => console.error('  - ' + f));
  /* Also surface each failure as a GitHub Actions annotation, so the reason is
     visible on the run summary and via the check-runs API without downloading
     the full job log. */
  if (process.env.GITHUB_ACTIONS === 'true') {
    failures.forEach((f) => console.log(`::error title=SEO regression::${f}`));
  }
  process.exit(1);
}
console.log('\nSEO verification passed.');
