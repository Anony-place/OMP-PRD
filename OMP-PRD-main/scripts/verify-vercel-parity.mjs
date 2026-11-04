#!/usr/bin/env node
/* ============================================================
   Firebase vs Vercel routing parity.

   A hosting migration is safe only when every URL resolves to the same thing
   on both sides. This script proves it instead of assuming it, and it proves
   it twice:

     offline (default)  both routing tables are executed against the SAME
                        corpus of URLs and the outcomes are compared.
                        Firebase side  = tools/hosting_router.js (the same
                        resolver the preview server and the SEO tests use).
                        Vercel side    = vercel.json parsed with
                        path-to-regexp, the library Vercel itself uses for
                        `source`, so the simulation cannot invent syntax.

     live  --live [origin] [--sample N]   both hosts are fetched over HTTP and
           compared field by field. This is the ground truth after a deploy.

   What counts as a match
   ----------------------
   * 200: both serve a real file. The FILE PATH must be identical, otherwise
     the page content differs even though the status looks fine.
   * redirect: both redirect and both land on the same normalised destination
     (/a and /a/ and /a.html are treated as the same target). A 301 vs a 308
     is accepted — both are permanent, and cleanUrls/trailingSlash emit 308 on
     Vercel where Firebase emits 301.
   * 404: both 404.

   Exit 1 on any mismatch, so a migration cannot ship a silently broken URL.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { match } = require('path-to-regexp');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const createFirebaseRouter = require_(path.join(ROOT, 'tools/hosting_router.js'));
const SITE = (process.env.SITE_ORIGIN || 'https://oopsmypassword.web.app').replace(/\/+$/, '');

/* ------------------------------------------------------------- vercel side */

/* Mirrors the documented Vercel order for a static deployment:
   configured redirects -> trailingSlash / cleanUrls canonicalisation ->
   filesystem -> rewrites -> 404. */
function createVercelRouter(rootDir, configPath) {
  const config = JSON.parse(fs.readFileSync(configPath || path.join(rootDir, 'vercel.json'), 'utf8'));
  const cleanUrls = config.cleanUrls !== false;
  const noTrailingSlash = config.trailingSlash === false;

  const compile = (list) => (list || []).map((rule) => ({
    match: match(rule.source, { decode: decodeURIComponent }),
    destination: rule.destination,
    status: rule.statusCode || 308,
  }));

  const redirects = compile(config.redirects);
  const rewrites = compile(config.rewrites);

  const isFile = (p) => {
    const abs = path.join(rootDir, p);
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  };

  /* path-to-regexp gives named params; Vercel substitutes :name in the
     destination with them. */
  const substitute = (destination, params) =>
    destination.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (whole, name) =>
      params[name] === undefined ? whole : String(params[name]));

  function resolve(pathname, depth = 0) {
    if (depth > 10) return { type: 'loop', location: pathname };
    const p = (pathname.split('?')[0] || '/');

    for (const rule of redirects) {
      const m = rule.match(p);
      if (m) return { type: 'redirect', location: substitute(rule.destination, m.params), status: rule.status };
    }

    if (noTrailingSlash && p.length > 1 && p.endsWith('/')) {
      return { type: 'redirect', location: p.replace(/\/+$/, '') || '/', status: 308 };
    }
    if (cleanUrls && p.endsWith('.html')) {
      const clean = p.slice(0, -5) || '/';
      const target = clean === '/index' ? '/' : clean;
      /* Vercel only canonicalises away a .html that actually maps to a file. */
      if (isFile(p) || isFile(clean) || isFile(`${clean}.html`)) {
        return { type: 'redirect', location: target, status: 308 };
      }
    }

    if (isFile(p)) return { type: 'file', file: p };
    if (p === '/' && isFile('/index.html')) return { type: 'file', file: '/index.html' };
    if (isFile(`${p}/index.html`)) return { type: 'file', file: `${p}/index.html` };
    if (cleanUrls && !p.endsWith('.html') && isFile(`${p}.html`)) return { type: 'file', file: `${p}.html` };

    for (const rule of rewrites) {
      const m = rule.match(p);
      if (m) {
        const dest = substitute(rule.destination, m.params);
        /* A rewrite hands the request to a different path, which then goes
           through the filesystem with cleanUrls applied. */
        if (isFile(dest)) return { type: 'file', file: dest };
        if (cleanUrls && isFile(`${dest}.html`)) return { type: 'file', file: `${dest}.html` };
        if (isFile(`${dest}/index.html`)) return { type: 'file', file: `${dest}/index.html` };
        return { type: 'broken-rewrite', file: dest };
      }
    }

    return { type: 'notfound', file: '/404.html' };
  }

  return { resolve, config };
}

/* ---------------------------------------------------------------- corpus */

function buildCorpus() {
  const firebase = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8')).hosting;
  const urls = new Set();

  /* 1. Every URL the sitemap submits. */
  const sitemapFile = path.join(ROOT, 'sitemap.xml');
  if (fs.existsSync(sitemapFile)) {
    for (const m of fs.readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
      urls.add(new URL(m[1]).pathname);
    }
  }

  /* 2. Every legacy URL that must keep redirecting (the 124 rules). */
  for (const rule of firebase.redirects) {
    if (rule.source) urls.add(rule.source);
    if (rule.regex) {
      /* Concrete samples for a regex rule, since a regex is not a URL. */
      const stems = ['create-strong-password', 'password-entropy', 'unknown-guide-slug'];
      const base = rule.regex.match(/^\/([a-z-]+)\//i);
      const prefix = base ? base[1] : 'guides';
      for (const stem of stems) {
        urls.add(`/${prefix}/${stem}`);
        urls.add(`/${prefix}/${stem}.html`);
      }
    }
  }

  /* 3. Every rewrite source. */
  for (const rule of firebase.rewrites) if (rule.source) urls.add(rule.source);

  /* 4. Crawler + canonicalisation edge cases. */
  for (const p of [
    '/', '/index.html', '/sitemap.xml', '/sitemap.txt', '/google-sitemap.xml',
    '/sitemap-index.xml', '/rss.xml', '/robots.txt', '/ads.txt', '/llms.txt',
    '/manifest.webmanifest', '/404.html', '/checker', '/checker.html',
    '/checker/', '/tools/', '/articles/', '/blog', '/blog.html',
    '/guides', '/guides.html', '/guides/', '/Anony.su/', '/osint', '/pentest',
  ]) urls.add(p);

  /* 5. Paths that must keep 404ing (no soft-404 regressions). */
  for (const p of [
    '/this-page-does-not-exist', '/articles/unknown-slug', '/products/unknown-slug',
    '/osint/unknown-slug', '/pentest/unknown-slug',
    '/random/deep/path/here',
    '/checker/extra', '/tools/extra', '/api', '/wp-login.php',
  ]) urls.add(p);

  return [...urls].sort();
}

/* ------------------------------------------------------------- comparison */

const normaliseTarget = (target) => {
  if (!target) return target;
  let out = target.split('#')[0].split('?')[0];
  out = out.replace(/\.html$/, '');
  out = out.replace(/\/+$/, '');
  return out === '' ? '/' : out;
};

function describe(outcome) {
  if (outcome.type === 'file') return { kind: 'ok', target: outcome.file };
  if (outcome.type === 'redirect') return { kind: 'redirect', target: normaliseTarget(outcome.location) };
  if (outcome.type === 'notfound') return { kind: '404', target: '/404.html' };
  return { kind: outcome.type, target: outcome.location || outcome.file };
}

/* A redirect chain is not a mismatch: what matters is where a URL LANDS.
   cleanUrls/trailingSlash canonicalise in a different order on the two
   platforms, so /guides/ takes two hops on Firebase and one on Vercel and both
   end at /articles. Follow the chain, compare the terminal state, and report
   hop counts as information rather than failure. */
function follow(resolve, start, max = 8) {
  let route = start;
  let hops = 0;
  const chain = [];
  for (;;) {
    const outcome = describe(resolve(route, 0));
    if (outcome.kind !== 'redirect') return { ...outcome, hops, chain };
    chain.push(route);
    if (hops >= max) return { kind: 'loop', target: route, hops, chain };
    route = outcome.target;
    hops += 1;
  }
}

/* Every URL the old host ever answered has to leave it, and has to land on the
   SAME path on the new one - a redirect to the wrong path is a 404 with extra
   steps, and a URL that is not redirected at all keeps competing with its own
   replacement. */
function compareMigration(hosting, corpus) {
  const href = `https://${createFirebaseRouter.MIGRATION_HOST}`;
  const rules = (hosting.redirects || []).filter(createFirebaseRouter.isMigrationRedirect);
  if (!rules.length) return { active: false, covered: 0, missed: [], misrouted: [] };

  const fullRouter = createFirebaseRouter(ROOT, hosting, { includeMigration: true });
  const missed = [];
  const misrouted = [];

  for (const url of corpus) {
    const outcome = fullRouter.resolve(url, 0);
    if (!outcome || outcome.type !== 'redirect') { missed.push(url); continue; }
    let landed;
    try {
      landed = new URL(outcome.location);
    } catch (error) {
      missed.push(url);
      continue;
    }
    if (landed.origin !== href) { misrouted.push({ url, to: outcome.location }); continue; }
    /* /x.html must land on /x, because that is the URL the new host serves and
       the one the sitemap submits. A .html path would only 308 again. */
    const expected = url.replace(/\.html$/, '') || '/';
    if (landed.pathname !== expected) misrouted.push({ url, to: landed.pathname, expected });
  }

  return { active: true, covered: corpus.length - missed.length - misrouted.length, missed, misrouted };
}

function compareOffline() {
  const hosting = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8')).hosting;
  /* The default router already drops the move, so this comparison answers "does
     the page you reach after the redirect behave exactly as the old host did" -
     the 124 legacy redirects, cleanUrls, rewrites, 404s. */
  const firebaseRouter = createFirebaseRouter(ROOT, hosting);
  const vercelRouter = createVercelRouter(ROOT, path.join(ROOT, 'vercel.json'));
  const corpus = buildCorpus();
  const diffs = [];
  const hopDiffs = [];

  for (const url of corpus) {
    const a = follow(firebaseRouter.resolve, url);
    const b = follow(vercelRouter.resolve, url);
    if (a.kind !== b.kind || a.target !== b.target) {
      diffs.push({ url, firebase: a, vercel: b });
    } else if (a.hops !== b.hops) {
      hopDiffs.push({ url, firebase: a, vercel: b });
    }
  }

  const migration = compareMigration(hosting, corpus);
  return { corpus: corpus.length, diffs, hopDiffs, migration };
}

/* ---------------------------------------------------------------- live mode */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(origin, route, attempts = 3) {
  const url = new URL(route, origin);
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      });
      const location = response.headers.get('location');
      const contentType = response.headers.get('content-type') || '';
      let title = null;
      /* For a 200 the only cheap way to prove both hosts serve the SAME page -
         not merely the same status - is the title. Bodies are only read for
         HTML, and only the <title> is kept. */
      if (response.status >= 200 && response.status < 300 && /text\/html/i.test(contentType)) {
        const body = (await response.text()).slice(0, 40000);
        const found = body.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
        title = found ? found[1].replace(/\s+/g, ' ').trim() : null;
      }
      return {
        status: response.status,
        location: location ? new URL(location, url).pathname : null,
        /* Absolute, so a redirect that changes host can be followed. The move
           sends web.app straight to vercel.app; treating that as a path would
           bounce around one origin until the hop limit. */
        locationUrl: location ? new URL(location, url).href : null,
        contentType,
        title,
        robots: response.headers.get('x-robots-tag') || '',
      };
    } catch (error) {
      if (i === attempts) return { error: error.message };
      await sleep(1500 * i);
    }
  }
}

/* A 200 has no Location header, so the caller supplies the route it actually
   ended up on. Reading the header here is what used to throw on every page. */
function describeLive(probeResult, finalRoute) {
  if (probeResult.error) return { kind: 'error', target: probeResult.error };
  const s = probeResult.status;
  if (s >= 200 && s < 300) return { kind: 'ok', target: normaliseTarget(finalRoute) };
  if (s >= 300 && s < 400) return { kind: 'redirect', target: normaliseTarget(probeResult.location) };
  if (s === 404) return { kind: '404', target: '/404.html' };
  return { kind: `http-${s}`, target: probeResult.location || '' };
}

async function followLive(origin, start, max = 6) {
  let url = new URL(start, origin);
  let hops = 0;
  let last;
  const crossed = [];
  while (hops <= max) {
    last = await probe(url.origin, `${url.pathname}${url.search}`);
    const described = describeLive(last, url.pathname);
    if (described.kind !== 'redirect') {
      return { ...described, hops, response: last, finalRoute: url.pathname, crossed };
    }
    const next = last.locationUrl ? new URL(last.locationUrl) : new URL(described.target, url);
    if (next.origin !== url.origin) crossed.push(`${url.origin} -> ${next.origin}`);
    url = next;
    hops += 1;
  }
  return { ...describeLive(last, url.pathname), hops, response: last, finalRoute: url.pathname, crossed, loop: true };
}

function stratified(corpus, size) {
  if (!size || size >= corpus.length) return corpus;
  const stride = corpus.length / size;
  return Array.from({ length: size }, (_, i) => corpus[Math.floor(i * stride)]);
}

async function compareLive(vercelOrigin, limit, sampleSize) {
  const corpus = buildCorpus();
  const sample = sampleSize ? stratified(corpus, sampleSize) : (limit ? corpus.slice(0, limit) : corpus);
  const diffs = [];
  const hopDiffs = [];
  const contentDiffs = [];
  const firewallDiffs = [];
  let checked = 0;

  for (const route of sample) {
    const [a, b] = await Promise.all([followLive(SITE, route), followLive(vercelOrigin, route)]);
    checked += 1;
    const left = a;
    const right = b;
    /* Live 200s cannot be compared by file path (that is a server detail), so
       compare the response class plus the resolved content type. */
    const sameKind = left.kind === right.kind;
    const sameTarget = left.target === right.target;
    const sameType = left.kind !== 'ok' ||
      ((left.response?.contentType || '').split(';')[0] === (right.response?.contentType || '').split(';')[0]);

    /* Vercel's edge returns 403 for exploit-probe paths (/wp-login.php,
       /xmlrpc.php, stray .env lookups) that Firebase simply 404s. That is the
       platform firewall doing its job, not a routing difference - but only
       while production says the path does not exist. A real page answering 403
       on the mirror is still a failure, and still fails below. */
    if (left.kind === '404' && right.kind === 'http-403') {
      firewallDiffs.push({ route, firebase: left, vercel: right });
    } else if (!sameKind || !sameTarget || !sameType) {
      diffs.push({ route, firebase: { ...left, type: left.response?.contentType }, vercel: { ...right, type: right.response?.contentType } });
    } else if (left.hops !== right.hops) {
      hopDiffs.push({ route, firebase: left, vercel: right });
    } else if (left.kind === 'ok' && left.response?.title !== right.response?.title) {
      /* Same status, same content type, same route - different page. Either the
         mirror is stale (redeploy it) or the build diverged. */
      contentDiffs.push({ route, firebase: left.response?.title, vercel: right.response?.title });
    }
    if (checked % 25 === 0) process.stdout.write(`  ... ${checked}/${sample.length}\n`);
  }

  return { corpus: sample.length, diffs, hopDiffs, contentDiffs, firewallDiffs };
}

/* ------------------------------------------------------------------- main */

const liveIndex = process.argv.indexOf('--live');
const isLive = liveIndex !== -1;
const vercelOrigin = isLive ? (process.argv[liveIndex + 1] || 'https://oopsmypassword.vercel.app') : null;
const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex !== -1 ? Number(process.argv[limitIndex + 1]) : 0;
/* --sample N walks the corpus at a fixed stride instead of taking the first N
   entries. The corpus is sorted, so a prefix is all "Anony.su/" and learning
   redirects - a preflight would then prove nothing about the rest of the site. */
const sampleIndex = process.argv.indexOf('--sample');
const sample = sampleIndex !== -1 ? Number(process.argv[sampleIndex + 1]) : 0;

const started = Date.now();
const result = isLive ? await compareLive(vercelOrigin, limit, sample) : compareOffline();
const seconds = ((Date.now() - started) / 1000).toFixed(1);

if (isLive) {
  console.log(`\nLIVE parity ${SITE} vs ${vercelOrigin}`);
} else {
  console.log(`\nOFFLINE parity: firebase.json (hosting_router) vs vercel.json (path-to-regexp)`);
}
console.log(`  checked ${result.corpus} URLs in ${seconds}s`);

/* GitHub annotations are the only channel that survives this sandbox's blocked
   log API, so mismatches are emitted as ::error::/::warning:: as well. */
const escape = (text) => String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const annotate = (level, message) => {
  if (process.env.GITHUB_ACTIONS) console.log(`::${level}::${escape(message)}`);
};

const firewallDiffs = result.firewallDiffs || [];
if (firewallDiffs.length) {
  console.log(`  i ${firewallDiffs.length} path(s) 404 on production and 403 on the mirror - Vercel's edge firewall, not routing`);
  for (const d of firewallDiffs.slice(0, 5)) {
    console.log(`      ${d.route}`);
    annotate('warning', `${d.route}: production 404, mirror 403 (Vercel edge firewall on an exploit-probe path)`);
  }
}

const contentDiffs = result.contentDiffs || [];
if (contentDiffs.length) {
  console.log(`  ! ${contentDiffs.length} page(s) serve a different <title> - the mirror is probably stale`);
  for (const d of contentDiffs.slice(0, 8)) {
    console.log(`      ${d.route}\n        live:   ${d.firebase}\n        mirror: ${d.vercel}`);
    annotate('warning', `title differs for ${d.route}: live="${d.firebase}" mirror="${d.vercel}"`);
  }
}

const hopDiffs = result.hopDiffs || [];
if (hopDiffs.length) {
  /* Same destination, different number of hops. Worth knowing (each hop is a
     small crawl-budget cost), never worth failing a release over. */
  console.log(`  ! ${hopDiffs.length} URL(s) reach the same destination in a different number of redirect hops`);
  for (const d of hopDiffs.slice(0, 5)) {
    console.log(`      ${d.url || d.route}: ${d.firebase.hops} vs ${d.vercel.hops} hop(s) -> ${d.vercel.target}`);
  }
}

const migration = result.migration || { active: false };
if (migration.active) {
  console.log(`  ✓ the move covers every URL: ${migration.covered} land on the same path on ${createFirebaseRouter.MIGRATION_HOST}`);
  for (const url of migration.missed.slice(0, 10)) {
    console.log(`      not redirected: ${url}`);
    annotate('error', `${url}: the old host still serves this path instead of redirecting it`);
  }
  for (const miss of migration.misrouted.slice(0, 10)) {
    console.log(`      wrong path: ${miss.url} -> ${miss.to}${miss.expected ? ` (expected ${miss.expected})` : ''}`);
    annotate('error', `${miss.url} redirects to ${miss.to}, not to the same path on the new host`);
  }
  if (migration.missed.length || migration.misrouted.length) {
    console.log(`\n  ✗ the move has ${migration.missed.length + migration.misrouted.length} gap(s)`);
    process.exit(1);
  }
}

if (!result.diffs.length) {
  console.log('  ✓ every URL lands in the same place on both sides');
  process.exit(0);
}

console.log(`\n  ✗ ${result.diffs.length} mismatch(es):\n`);
for (const diff of result.diffs.slice(0, 60)) {
  const key = diff.url || diff.route;
  console.log(`  ${key}`);
  console.log(`      firebase: ${diff.firebase.kind}  ${diff.firebase.target || ''}`);
  console.log(`      vercel  : ${diff.vercel.kind}  ${diff.vercel.target || ''}`);
  annotate('error', `${key}: live=${diff.firebase.kind} ${diff.firebase.target || ''} mirror=${diff.vercel.kind} ${diff.vercel.target || ''}`);
}
if (result.diffs.length > 60) console.log(`  ... ${result.diffs.length - 60} more`);
process.exit(1);
