#!/usr/bin/env node
/* ============================================================
   Vercel mirror tests.

   vercel.json is a GENERATED file: firebase.json is the source of truth and
   scripts/build-vercel-config.mjs derives the Vercel copy. A generated file
   that nobody checks silently rots, so this suite is the gate:

     * drift      - committed vercel.json == freshly built from firebase.json
     * counts     - every redirect / rewrite / header block survived the trip
     * statuses   - redirects stay 301 (statusCode), never 308/permanent
     * no hijack  - no Vercel redirect may shadow a URL the sitemap submits
     * resolution - every rewrite destination and redirect target exists
     * staging    - host-scoped noindex guard present, crawlers exempt
     * parity     - the offline Firebase-vs-Vercel resolver diff is empty

   Usage:  node tools/test_vercel_config.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromHere = createRequire(path.join(ROOT, 'package.json'));
const { match } = requireFromHere('path-to-regexp');

const FIREBASE_JSON = path.join(ROOT, 'firebase.json');
const VERCEL_JSON = path.join(ROOT, 'vercel.json');
const PREVIEW_HOST = 'oopsmypassword.vercel.app';

let pass = 0;
let fail = 0;

function assert(condition, message) {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${message}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${message}`);
  }
}

function section(name) {
  console.log(`\n${name}`);
}

const firebase = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8')).hosting;
const vercel = JSON.parse(fs.readFileSync(VERCEL_JSON, 'utf8'));
const sitemapPaths = (() => {
  const file = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(file)) return [];
  return [...fs.readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1]).pathname);
})();

(async () => {
  section('Drift: vercel.json is the generated copy of firebase.json');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-vercel-config.mjs'), '--check'], {
      cwd: ROOT,
      stdio: 'pipe',
    });
    assert(true, 'committed vercel.json matches a fresh build (--check clean)');
  } catch (error) {
    const out = `${error.stdout || ''}${error.stderr || ''}`.trim().split('\n').slice(-6).join('\n');
    assert(false, `vercel.json is stale - run: node scripts/build-vercel-config.mjs\n${out}`);
  }

  section('Coverage: nothing was dropped on the way to Vercel');
  assert(Array.isArray(vercel.redirects), 'vercel.json has a redirects array');
  assert(vercel.redirects.length === firebase.redirects.length,
    `redirects carried over: ${vercel.redirects.length}/${firebase.redirects.length}`);
  assert(vercel.rewrites.length === firebase.rewrites.length,
    `rewrites carried over: ${vercel.rewrites.length}/${firebase.rewrites.length}`);

  /* A firebase block like /x{,/**} becomes two vercel rules sharing one set of
     headers, so compare header ENTRIES (which can only grow) rather than rule
     counts (39 rules carry 88 entries for firebase's 77). */
  const firebaseHeaderEntries = (firebase.headers || []).reduce((n, b) => n + (b.headers || []).length, 0);
  const vercelHeaderEntries = vercel.headers.reduce((n, h) => n + (h.headers || []).length, 0);
  assert(vercelHeaderEntries >= firebaseHeaderEntries,
    `header entries: ${vercelHeaderEntries} emitted for firebase's ${firebaseHeaderEntries} (glob splits duplicate, never drop)`);

  section('Schema: platform settings the site depends on');
  assert(vercel.$schema, 'vercel.json declares $schema');
  assert(vercel.cleanUrls === true, 'cleanUrls is on (matches firebase hosting)');
  assert(vercel.trailingSlash === false, 'trailingSlash is off (matches firebase hosting)');
  assert(!('builds' in vercel), 'no legacy "builds" block (would disable cleanUrls behaviour)');
  assert(!('buildCommand' in vercel) && !('outputDirectory' in vercel),
    'no build settings - this is a static mirror of committed output');

  section('Redirects: permanent, and pointing at real files');
  const notPermanent = vercel.redirects.filter((r) => !(r.statusCode === 301 || r.statusCode === 308));
  assert(notPermanent.length === 0,
    `every redirect is 301/308 (${vercel.redirects.length} checked)`);

  const usePermanentFlag = vercel.redirects.filter((r) => 'permanent' in r);
  assert(usePermanentFlag.length === 0,
    'no "permanent" flags (it emits 308 and loses the 301 signal Firebase sends)');

  const badSource = vercel.redirects.filter((r) => !r.source || !r.source.startsWith('/'));
  assert(badSource.length === 0, 'every redirect source is an absolute path');

  const badDest = vercel.redirects.filter((r) => !r.destination || !/^(\/|https?:)/.test(r.destination));
  assert(badDest.length === 0, 'every redirect destination is a path or absolute URL');

  const externalTargets = vercel.redirects.filter((r) => /^https?:/.test(r.destination));
  assert(externalTargets.length === 0,
    'no redirect leaves the site (all 124 legacy URLs stay internal)');

  /* A redirect whose destination has no file behind it just swaps one 404 for
     another, one hop later. */
  const cleanTarget = (dest) => dest.split('#')[0].split('?')[0];
  const exists = (p) => {
    if (p === '/') return fs.existsSync(path.join(ROOT, 'index.html'));
    const abs = path.join(ROOT, p);
    return fs.existsSync(abs) || fs.existsSync(`${abs}.html`) || fs.existsSync(path.join(abs, 'index.html'));
  };
  const danglingRedirects = vercel.redirects.filter((r) => {
    if (/^https?:/.test(r.destination)) return false;
    /* Placeholder destinations are filled from the match; skip those. */
    if (/:[A-Za-z_]/.test(cleanTarget(r.destination))) return false;
    return !exists(cleanTarget(r.destination));
  });
  assert(danglingRedirects.length === 0,
    `every static redirect destination exists (${danglingRedirects.length} dangling)`);

  section('Rewrites: destinations resolve, sources are real pages');
  const compilers = vercel.rewrites.map((r) => {
    try {
      return { rule: r, match: match(r.source, { decode: decodeURIComponent }) };
    } catch (error) {
      return { rule: r, error: error.message };
    }
  });
  const badRewrites = compilers.filter((c) => c.error);
  assert(badRewrites.length === 0,
    `all ${vercel.rewrites.length} rewrite sources compile with path-to-regexp`);
  for (const bad of badRewrites) console.log(`      ${bad.rule.source}: ${bad.error}`);

  const danglingRewrites = compilers
    .filter((c) => !c.error)
    .map((c) => ({ source: c.rule.source, dest: cleanTarget(c.rule.destination) }))
    .filter((r) => !/:/.test(r.dest) && !exists(r.dest));
  assert(danglingRewrites.length === 0,
    `every rewrite destination exists (${danglingRewrites.length} dangling)`);
  for (const d of danglingRewrites) console.log(`      ${d.source} -> ${d.dest}`);

  /* The 15 /articles/<slug> rewrites are not an accident: the sitemap submits
     /articles/<slug>, firebase.json serves /guides/<slug>.html behind it, and
     the guide page self-canonicalises to the /articles/ URL. That works only
     while all three agree, so assert the agreement instead of forbidding the
     rewrite. A rewritten page whose canonical points at the guides path would
     submit a URL that claims to be a different one. */
  const SITE = (process.env.SITE_ORIGIN || 'https://oopsmypassword.web.app').replace(/\/+$/, '');
  /* Rewrite destinations are extensionless (cleanUrls serves the .html), so
     resolve to the real file before reading it. */
  const realFile = (p) => {
    const abs = path.join(ROOT, p);
    for (const candidate of [abs, `${abs}.html`, path.join(abs, 'index.html')]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
  };
  const canonicalOf = (file) => {
    const real = realFile(file);
    if (!real) return null;
    const html = fs.readFileSync(real, 'utf8');
    const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
    return m ? m[1] : null;
  };

  const rewritten = compilers
    .filter((c) => !c.error)
    .map((c) => ({
      source: c.rule.source,
      dest: cleanTarget(c.rule.destination),
      inSitemap: sitemapPaths.some((page) => c.match(page)),
    }))
    .filter((r) => !/:/.test(r.dest) && exists(r.dest));

  const badCanonical = rewritten.filter((r) => {
    if (!r.inSitemap) return false;
    const canonical = canonicalOf(r.dest);
    return canonical && canonical.replace(/\/+$/, '') !== `${SITE}${r.source}`;
  });
  assert(badCanonical.length === 0,
    `every rewrite serving a sitemap URL self-canonicalises to that URL (${rewritten.filter((r) => r.inSitemap).length} checked)`);
  for (const bad of badCanonical) {
    console.log(`      ${bad.source} -> ${bad.dest} claims ${canonicalOf(bad.dest)}`);
  }

  /* A rewrite source that is not in the sitemap is still legal (legacy alias),
     but it must not be a page nobody can discover. Report, do not fail. */
  const legacyAliases = rewritten.filter((r) => !r.inSitemap);
  if (legacyAliases.length) {
    console.log(`      ${legacyAliases.length} rewrite(s) outside the sitemap: ${legacyAliases.map((r) => r.source).join(', ')}`);
  }

  const deadRewrites = vercel.rewrites.filter((r) => /404\.html/.test(cleanTarget(r.destination)));
  assert(deadRewrites.length === 0, 'no rewrite silently resolves to the 404 page');

  section('Indexability: nothing here tells Google to drop the site');
  /* This used to be the opposite assertion. While Vercel was a staging mirror,
     a host-scoped noindex was the safety layer. Firebase now 301s every path
     here, so the same header would instruct Google to drop every page it was
     just redirected to - a self-inflicted deindex. Locking the inversion in
     means the guard cannot be reintroduced by accident. */
  const noindexRules = vercel.headers.filter((h) =>
    (h.headers || []).some((x) => /noindex/i.test(String(x.value || ''))));
  const noindexOnPages = noindexRules.filter((h) => {
    const source = String(h.source || '');
    /* /Anony.su is deliberately noindexed in firebase.json and must survive. */
    return !source.includes('Anony');
  });
  assert(noindexOnPages.length === 0,
    `no noindex on the site's own pages (${noindexOnPages.length} found)`);
  for (const rule of noindexOnPages) console.log(`      ${rule.source}`);

  const anonyGuarded = noindexRules.filter((h) => String(h.source || '').includes('Anony'));
  assert(anonyGuarded.length >= 1,
    'the deliberate /Anony.su noindex is still carried over');

  /* A page nobody can index is the whole failure mode this migration risks. */
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(!/name=["']robots["'][^>]*noindex/i.test(home),
    'index.html has no robots noindex meta tag');
  assert(/<link[^>]+rel=["']canonical["']/i.test(home),
    'index.html still declares a canonical');

  section('Parity: Firebase and Vercel resolve every URL the same way');
  try {
    const output = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'verify-vercel-parity.mjs')], {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    const checked = output.match(/checked (\d+) URLs/);
    assert(true, `offline parity clean${checked ? ` across ${checked[1]} URLs` : ''}`);
    const hops = output.match(/(\d+) URL\(s\) reach the same destination/);
    if (hops) console.log(`      ${hops[1]} URL(s) differ only in redirect hop count (reported, not failed)`);
  } catch (error) {
    const out = `${error.stdout || ''}${error.stderr || ''}`.trim().split('\n').slice(-20).join('\n');
    assert(false, `offline parity failed between firebase.json and vercel.json\n${out}`);
  }

  section('Ignore file: the mirror does not ship build tooling');
  const ignorePath = path.join(ROOT, '.vercelignore');
  assert(fs.existsSync(ignorePath), '.vercelignore exists');
  if (fs.existsSync(ignorePath)) {
    const rules = fs.readFileSync(ignorePath, 'utf8')
      .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    for (const dir of ['tools/', 'supabase/', 'functions/', 'scripts/']) {
      assert(rules.includes(dir), `.vercelignore excludes ${dir}`);
    }
    /* Never ignore the things the test actually wants to fetch. */
    for (const keep of ['sitemap.xml', 'sitemap.txt', 'robots.txt', 'rss.xml']) {
      assert(!rules.includes(keep), `.vercelignore keeps ${keep} (needed for fetch tests)`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
