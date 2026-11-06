#!/usr/bin/env node
/* ============================================================
   Sitemap tests — run the shared core under Node and assert the
   properties that matter for SEO and for safety:

     * the Firebase copy of the core is byte-identical to the Supabase
       Edge Function copy (drift = two different sitemaps)
     * only published rows are listed; drafts/archived never are
     * slugs are charset-guarded before they become URLs
     * XML is escaped, and a hostile slug cannot inject markup
     * URLs are unique and the static set is complete + trailing-slash free

   Usage:  node tools/test_sitemap.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EDGE_CORE = path.join(ROOT, 'supabase', 'functions', 'sitemap', 'sitemap-core.mjs');
const FIREBASE_CORE = path.join(ROOT, 'functions', 'sitemap-core.mjs');
const EDGE_INDEX = path.join(ROOT, 'supabase', 'functions', 'sitemap', 'index.ts');
const SITEMAP_XML = path.join(ROOT, 'sitemap.xml');
const GOOGLE_SITEMAP_XML = path.join(ROOT, 'google-sitemap.xml');
const ROBOTS_TXT = path.join(ROOT, 'robots.txt');
const FIREBASE_JSON = path.join(ROOT, 'firebase.json');
const WORKFLOW = fs.existsSync(path.join(ROOT, '.github', 'workflows', 'firebase-static-hosting.yml'))
  ? path.join(ROOT, '.github', 'workflows', 'firebase-static-hosting.yml')
  : path.join(ROOT, '..', '.github', 'workflows', 'firebase-static-hosting.yml');

/* jsdom is a dev dependency that is not always installed. The XML assertions
   only need well-formedness + element access, so fall back to a small reader
   instead of failing the whole suite when jsdom is absent. */
let parseXml;
try {
  const { JSDOM } = require('jsdom');
  const DOMParser = new JSDOM().window.DOMParser;
  parseXml = (xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return {
      errors: doc.getElementsByTagName('parsererror').length,
      rootName: doc.documentElement ? doc.documentElement.nodeName : '',
      rootNs: doc.documentElement ? doc.documentElement.namespaceURI : '',
      locs: Array.from(doc.getElementsByTagName('loc')).map((n) => n.textContent),
      scripts: doc.getElementsByTagName('script').length
    };
  };
} catch (e) {
  parseXml = (xml) => {
    const decl = /^\s*<\?xml[^>]*\?>\s*/.test(xml);
    const open = (xml.match(/<urlset[\s>]/g) || []).length;
    const close = (xml.match(/<\/urlset>/g) || []).length;
    const raw = /<(?!\/?(?:xml|urlset|url|loc|lastmod|changefreq|priority)\b)[a-z]/i.test(
      xml.replace(/<\?xml[^>]*\?>/, '')
    );
    return {
      errors: decl && open === 1 && close === 1 && !raw ? 0 : 1,
      rootName: 'urlset',
      rootNs: /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml)
        ? 'http://www.sitemaps.org/schemas/sitemap/0.9'
        : '',
      locs: (xml.match(/<loc>([\s\S]*?)<\/loc>/g) || []).map((s) => s.replace(/<\/?loc>/g, '')),
      scripts: /<script/i.test(xml) ? 1 : 0
    };
  };
}

let pass = 0;
let fail = 0;

/* The production origin is asserted from the core's own DEFAULT_SITE so the
   tests can never drift from the value the generator actually emits. */
let SITE = '';
let SITE_RE = null;

function check(name, fn) {
  try {
    const r = fn();
    if (r === false) throw new Error('assertion returned false');
    console.log('  ✓ ' + name);
    pass++;
  } catch (e) {
    console.log('  ✗ ' + name + '\n      ' + (e && e.message ? e.message : e));
    fail++;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function group(name) {
  console.log('\n' + name);
}

(async function main() {
  const core = await import('file://' + EDGE_CORE).then((m) => m.default || m);
  SITE = String(core.DEFAULT_SITE).replace(/\/+$/, '');
  SITE_RE = new RegExp('^' + SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/');

  const ARTICLES = [
    { slug: 'published-one', title: 'Published one', status: 'published', published_at: '2026-09-04T10:00:00Z', updated_at: '2026-09-05T10:00:00Z' },
    { slug: 'draft-one', title: 'Draft one', status: 'draft', published_at: '2026-09-04T10:00:00Z' },
    { slug: 'archived-one', title: 'Archived one', status: 'archived', published_at: '2026-09-04T10:00:00Z' },
    { slug: 'Bad Slug!', title: 'Bad slug', status: 'published', published_at: '2026-09-04T10:00:00Z' },
    { slug: 'UPPER', title: 'Upper', status: 'published', published_at: '2026-09-04T10:00:00Z' },
    { slug: '../escape', title: 'Escape', status: 'published', published_at: '2026-09-04T10:00:00Z' },
    { slug: '"><script>alert(1)</script>', title: 'XSS', status: 'published', published_at: '2026-09-04T10:00:00Z' },
    { slug: 'a'.repeat(300), title: 'Long', status: 'published', published_at: '2026-09-04T10:00:00Z' },
    { slug: 'published-one', title: 'Published one (duplicate)', status: 'published', published_at: '2026-09-04T10:00:00Z' }
  ];
  const PRODUCTS = [
    { slug: 'live-product', name: 'Live', status: 'published', published_at: '2026-09-02T10:00:00Z' },
    { slug: 'hidden-product', name: 'Hidden', status: 'draft', published_at: '2026-09-02T10:00:00Z' }
  ];
  const OSINT = [
    { slug: 'live-tool', name: 'Live Tool', status: 'published', published_at: '2026-09-02T10:00:00Z' },
    { slug: 'hidden-tool', name: 'Hidden Tool', status: 'draft', published_at: '2026-09-02T10:00:00Z' }
  ];
  const PENTEST = [
    { slug: 'live-pentest', name: 'Live Pentest', status: 'published', published_at: '2026-09-02T10:00:00Z' },
    { slug: 'hidden-pentest', name: 'Hidden Pentest', status: 'draft', published_at: '2026-09-02T10:00:00Z' }
  ];

  const OPTS = { articles: ARTICLES, products: PRODUCTS, osint: OSINT, pentest: PENTEST, site: SITE };

  group('sitemap-core.mjs (shared generator)');

  check('published articles are listed', () => {
    const xml = core.buildSitemapXml(OPTS);
    assert(xml.includes('/articles/published-one'), 'missing published article');
    assert(xml.includes('/products/live-product'), 'missing published product');
    assert(xml.includes('/osint/live-tool'), 'missing published osint tool');
    assert(xml.includes('/pentest/live-pentest'), 'missing published pentest tool');
  });

  check('drafts and archived rows are never listed', () => {
    const xml = core.buildSitemapXml(OPTS);
    assert(!xml.includes('draft-one'), 'draft leaked into sitemap');
    assert(!xml.includes('archived-one'), 'archived leaked into sitemap');
    assert(!xml.includes('hidden-product'), 'draft product leaked into sitemap');
    assert(!xml.includes('hidden-tool'), 'draft osint tool leaked into sitemap');
    assert(!xml.includes('hidden-pentest'), 'draft pentest tool leaked into sitemap');
  });

  check('invalid slugs are dropped before a URL is built', () => {
    const xml = core.buildSitemapXml(OPTS);
    assert(!xml.includes('Bad'), 'slug with a space leaked');
    assert(!xml.includes('UPPER'), 'uppercase slug leaked');
    assert(!xml.includes('../escape'), 'path traversal slug leaked');
    assert(!xml.includes('a'.repeat(300)), 'over-long slug leaked');
  });

  check('a script payload in a slug is escaped, not injected', () => {
    const xml = core.buildSitemapXml(OPTS);
    assert(!xml.includes('<script'), 'raw <script> survived escaping');
    assert(!/alert\(1\)<\/script>/.test(xml), 'raw script body survived');
    /* Nothing executable may reach the DOM when the sitemap is parsed. */
    const parsed = parseXml(xml);
    assert(parsed.errors === 0, 'XML is not well-formed');
    assert(parsed.scripts === 0, 'script element parsed out of the sitemap');
  });

  check('output is well-formed sitemap XML', () => {
    const xml = core.buildSitemapXml(OPTS);
    const parsed = parseXml(xml);
    assert(parsed.errors === 0, 'parse error');
    assert(parsed.rootName === 'urlset', 'root is not <urlset>');
    assert(
      parsed.rootNs === 'http://www.sitemaps.org/schemas/sitemap/0.9',
      'wrong sitemap namespace'
    );
    assert(parsed.locs.length > 0, 'no <loc> entries');
    parsed.locs.forEach((l) => assert(SITE_RE.test(l), 'off-site loc: ' + l));
  });

  check('URLs are unique (no duplicate <loc>)', () => {
    const xml = core.buildSitemapXml(OPTS);
    const locs = xml.match(/<loc>([^<]*)<\/loc>/g) || [];
    assert(locs.length === new Set(locs).size, 'duplicate URLs in the sitemap');
  });

  check('no trailing slashes and no .html implementation URLs', () => {
    const xml = core.buildSitemapXml(OPTS);
    const locs = (xml.match(/<loc>([^<]*)<\/loc>/g) || []).map((s) => s.slice(5, -6));
    locs.forEach((l) => {
      const pathname = l.replace(SITE, '');
      assert(pathname === '/' || !pathname.endsWith('/'), 'trailing slash: ' + l);
      assert(!/\.html$/.test(pathname), 'implementation URL leaked: ' + l);
    });
  });

  check('lastmod is asserted only where a real date exists', () => {
    const xml = core.buildSitemapXml(OPTS);
    /* An empty <lastmod> is malformed, so the element must be omitted whole. */
    assert(!/<lastmod>\s*<\/lastmod>/.test(xml), 'empty <lastmod> element emitted');
    const mods = (xml.match(/<lastmod>([^<]*)<\/lastmod>/g) || []).map((s) => s.slice(9, -10));
    mods.forEach((m) => assert(/^\d{4}-\d{2}-\d{2}$/.test(m), 'bad lastmod: ' + m));

    /* Generated pages have no honest modification date, so the static routes
       must carry none. If a stamp reappears here it is an invented date. */
    const staticXml = core.buildSitemapXml({ site: SITE });
    const staticUrls = staticXml.match(/<url>[\s\S]*?<\/url>/g) || [];
    assert(staticUrls.length > 0, 'no static URLs generated');
    const stamped = staticUrls.filter((u) => u.includes('<lastmod>'));
    assert(stamped.length === 0,
      `${stamped.length} static routes carry a lastmod with no real date behind them`);

    /* Articles and products do have real timestamps, so they must keep theirs —
       otherwise the policy above would silently strip genuine signal. */
    assert(mods.length > 0, 'database-backed rows lost their lastmod');
    assert(core.formatLastmod('not a date', '') === '', 'invalid date did not fall back to empty');
    assert(core.formatLastmod('2026-09-04T10:00:00Z') === '2026-09-04', 'UTC date not formatted');
  });

  check('static route set is complete', () => {
    const xml = core.buildSitemapXml({ site: SITE });
    ['/', '/checker', '/generator', '/tools', '/articles', '/products', '/osint', '/pentest', '/breach-check', '/about',
      '/privacy', '/terms', '/contact', '/faq', '/glossary', '/security', '/sitemap',
      '/password-health', '/entropy', '/passphrase', '/random-string', '/security-checklist'
    ].forEach((r) => assert(xml.includes(`<loc>${SITE}${r}</loc>`), 'missing ' + r));
    const guides = (xml.match(/<loc>[^<]*\/articles\/[a-z0-9-]+<\/loc>/g) || []);
    assert(guides.length === 15, 'expected 15 static guides, got ' + guides.length);
  });

  check('the production origin is the live .web.app host', () => {
    /* A canonical/sitemap origin that does not resolve is the single fastest
       way to stay out of the index, so pin it here. */
    assert(SITE === 'https://oopsmypassword.web.app', 'DEFAULT_SITE is not the live origin: ' + SITE);
  });

  check('supabase failure still yields a valid sitemap (degrade, never 500)', () => {
    const xml = core.buildSitemapXml({ site: SITE });
    assert(xml.indexOf('<urlset') !== -1, 'no urlset in fallback');
    assert(xml.indexOf('/articles/published-one') === -1, 'fallback leaked article data');
  });

  check('JSON view mirrors the XML and carries titles', () => {
    const data = core.buildSitemapJson(OPTS);
    assert(data.articles.length === 1 && data.articles[0].slug === undefined, 'unexpected article set');
    assert(data.articles[0].url.endsWith('/articles/published-one'), 'bad article url');
    assert(data.products.length === 1 && data.products[0].title === 'Live', 'bad product entry');
    assert(data.osint.length === 1 && data.osint[0].title === 'Live Tool', 'bad osint entry');
    assert(data.osint[0].url.endsWith('/osint/live-tool'), 'bad osint url');
    assert(data.pentest.length === 1 && data.pentest[0].title === 'Live Pentest', 'bad pentest entry');
    assert(data.pentest[0].url.endsWith('/pentest/live-pentest'), 'bad pentest url');
    assert(typeof data.count === 'number' && data.count > 0, 'missing count');
  });

  group('deployment wiring');

  check('Firebase copy of the core is byte-identical to the Edge Function copy', () => {
    assert(fs.existsSync(FIREBASE_CORE), 'functions/sitemap-core.mjs missing — run `npm run sync:sitemap`');
    const a = fs.readFileSync(EDGE_CORE, 'utf8');
    const b = fs.readFileSync(FIREBASE_CORE, 'utf8');
    assert(a === b, 'copies diverged — run `npm run sync:sitemap` in functions/');
  });

  check('the article renderer cannot drift from the static publisher', () => {
    /* Firebase only uploads functions/, so the Cloud Function cannot import
       scripts/build-static-seo.mjs. The header, hero, TOC and prose layout are
       copied instead, which only works if nothing changes on one side alone. */
    const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build-static-seo.mjs'), 'utf8');
    const render = fs.readFileSync(path.join(ROOT, 'functions', 'article-render.cjs'), 'utf8');
    /* sanitizeHtml is renamed to sanitizeArticleHtml in the function copy so the
       function does not shadow its own HTML parameter, so accept either name. */
    for (const name of ['siteHeader', 'siteMobileMenu', 'commonHead', 'normalizeInjected',
                        'slugifyHeading', 'markdownToHtml', 'markdownInline']) {
      const inBuild = new RegExp('function ' + name + '\\(').test(build);
      const inRender = new RegExp('function ' + name + '\\(').test(render);
      assert(inBuild && inRender,
        name + ' must exist in both the static publisher and the function renderer');
    }
    assert(/function sanitize(Html|ArticleHtml)\(/.test(build), 'static publisher lost its sanitizer wrapper');
    assert(/function sanitize(Html|ArticleHtml)\(/.test(render), 'function renderer lost its sanitizer wrapper');
    /* The structural markers a reader sees, so a partial copy is caught too. */
    for (const marker of ['article-hero', 'article-layout', 'container-article', 'class="toc"', 'class="prose"',
                          'theme-init.js', 'breadcrumbSchema', 'documentTitle', 'metaDescription']) {
      assert(build.includes(marker) && render.includes(marker),
        'article render marker missing from one copy: ' + marker);
    }
  });

  check('Edge Function reads config from env, never from a hard-coded secret', () => {
    const src = fs.readFileSync(EDGE_INDEX, 'utf8');
    assert(!/service_role|SUPABASE_SERVICE/i.test(src), 'edge function references the service-role key');
    assert(src.includes("Deno.env.get('SUPABASE_ANON_KEY')"), 'anon key not read from env');
    assert(src.includes('./sitemap-core.mjs'), 'edge function does not use the shared core');
  });

  check('/sitemap.xml is served as a static file (not rewritten to a function)', () => {
    /* CI deploys hosting only, so a /sitemap.xml -> function rewrite would
       serve nothing at all. The committed, build-generated file is the
       endpoint Google actually fetches. */
    const cfg = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8'));
    const hosting = cfg.hosting;
    assert(!hosting.ignore.includes('sitemap.xml'), 'sitemap.xml is ignored, so it would 404 in production');
    assert(!hosting.ignore.includes('robots.txt'), 'robots.txt is ignored, so it would 404 in production');
    const rewrite = (hosting.rewrites || []).find((r) => r.source === '/sitemap.xml');
    assert(!rewrite, '/sitemap.xml is rewritten to a function that hosting-only deploys never ship');
    assert(fs.existsSync(SITEMAP_XML), 'sitemap.xml is missing from the deploy payload');
  });

  check('robots.txt advertises the sitemap that is actually deployed', () => {
    const robots = fs.readFileSync(ROBOTS_TXT, 'utf8');
    /* [ \t]* not \s* — in multiline mode \s* would swallow the line break
       into the capture group. */
    const declared = (robots.match(/^Sitemap:[ \t]*(\S+)[ \t]*$/gm) || []).map((l) => l.replace(/^Sitemap:[ \t]*/, '').trim());
    assert(declared.length > 0, 'robots.txt declares no Sitemap');
    /* /rss.xml is a second, independent discovery endpoint: Google accepts a
       well-formed RSS 2.0 feed as a sitemap, and /sitemap-index.xml declares
       both. All three are shipped by the same build. */
    const allowed = new Set(['/sitemap.xml', '/sitemap-index.xml', '/sitemap.txt', '/rss.xml']);
    declared.forEach((u) => {
      assert(u.startsWith(SITE + '/'), 'robots.txt advertises an off-origin sitemap: ' + u);
      assert(allowed.has(u.slice(SITE.length)), 'robots.txt points at ' + u + ', which is not a deployed sitemap endpoint');
    });
    ['/sitemap.xml', '/sitemap.txt', '/rss.xml'].forEach((p) => {
      assert(declared.includes(SITE + p), 'robots.txt does not advertise ' + SITE + p);
    });
    assert(!/Disallow:\s*\/sitemap/i.test(robots), 'robots.txt blocks the sitemap');
    assert(!/Disallow:\s*\/rss/i.test(robots), 'robots.txt blocks the RSS sitemap');
    assert(!/Disallow:\s*\/sitemap\.txt/i.test(robots), 'robots.txt blocks the text sitemap');
  });

  check('the google-sitemap.xml alias is byte-identical to sitemap.xml', () => {
    /* Two endpoints that disagree is how a stale sitemap keeps getting read. */
    assert(fs.existsSync(GOOGLE_SITEMAP_XML), 'google-sitemap.xml is missing');
    assert(
      fs.readFileSync(GOOGLE_SITEMAP_XML, 'utf8') === fs.readFileSync(SITEMAP_XML, 'utf8'),
      'google-sitemap.xml differs from sitemap.xml'
    );
  });

  check('the deploy workflow runs the full build pipeline', () => {
    assert(fs.existsSync(WORKFLOW), 'root .github/workflows/firebase-static-hosting.yml is missing — GitHub ignores nested .github directories');
    const yml = fs.readFileSync(WORKFLOW, 'utf8');
    assert(yml.includes('tools/build.py'), 'workflow does not run tools/build.py (canonicals would never be regenerated)');
    assert(yml.includes('build-static-seo.mjs'), 'workflow does not run build-static-seo.mjs');
    assert(yml.includes('fix-site-origin.mjs'), 'workflow does not normalize the site origin');
    /* The retired origin may appear exactly once — as the LEGACY_ORIGIN value.
       Anywhere else (a grep pattern, a hard-coded check) is how the previous
       guard matched itself and failed every single run. */
    const legacy = (yml.match(/^\s*LEGACY_ORIGIN:\s*(\S+)\s*$/m) || [])[1];
    assert(legacy === 'https://oopsmypassword.com', 'LEGACY_ORIGIN is not declared correctly: ' + legacy);
    const occurrences = yml.split(legacy).length - 1;
    assert(occurrences === 1, 'dead origin appears ' + occurrences + 'x in the workflow; it may only be the LEGACY_ORIGIN value');
    assert(yml.includes('scripts/verify-seo.mjs'), 'workflow does not run the SEO verifier before deploying');
    assert(yml.includes('indexnow'), 'workflow no longer submits URLs to IndexNow');
  });

  check('the IndexNow key file is present, self-consistent and deployable', () => {
    const keys = fs.readdirSync(ROOT).filter((f) => /^[0-9a-f]{8,128}\.txt$/.test(f));
    assert(keys.length === 1, 'expected exactly one IndexNow key file, found ' + keys.length);
    const file = keys[0];
    const key = file.replace(/\.txt$/, '');
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8').trim();
    assert(body === key, 'key file body does not match its filename — Bing would reject submissions');
    const cfg = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8'));
    const ignored = (cfg.hosting.ignore || []).some((pattern) => {
      const re = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
      return re.test(file);
    });
    assert(!ignored, 'firebase.json ignore would prevent /' + file + ' from being deployed');
  });

  check('robots.txt blocks only genuinely private paths', () => {
    const robots = fs.readFileSync(ROBOTS_TXT, 'utf8');
    const disallowed = (robots.match(/^Disallow:[ \t]*(\S+)[ \t]*$/gm) || [])
      .map((l) => l.replace(/^Disallow:[ \t]*/, '').trim());
    const allowed = ['/Anony.su', '/functions'];
    disallowed.forEach((d) => {
      assert(allowed.some((p) => d === p || d === p + '/'),
        'Disallow ' + d + ' is not a known private path — it may hide public content from crawlers');
    });
    /* /tools was once blocked here; trailingSlash:false means the public page
       is /tools, so the rule hid nothing real while implying it did. */
    assert(!disallowed.some((d) => d.startsWith('/tools')), '/tools is a public page and must not be blocked');
  });

  check('committed sitemap.xml contains the full generated static route set', () => {
    const snapshot = fs.readFileSync(SITEMAP_XML, 'utf8');
    const generated = core.buildSitemapXml({ site: SITE });
    const locs = (s) => (s.match(/<loc>[^<]*<\/loc>/g) || []);
    const inSnapshot = new Set(locs(snapshot));
    const missing = locs(generated).filter((l) => !inSnapshot.has(l));
    assert(missing.length === 0, 'snapshot is missing routes: ' + missing.join(', '));
    assert(parseXml(snapshot).errors === 0, 'committed sitemap.xml is not well-formed XML');
  });

  check('every deployable HTML page canonicalises to the live origin', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.isDirectory()) {
        if (['.git', 'node_modules', 'tools', 'functions', 'supabase', 'articles'].includes(e.name)) return [];
        return walk(path.join(dir, e.name));
      }
      return e.name.endsWith('.html') ? [path.join(dir, e.name)] : [];
    });
    const offenders = [];
    for (const file of walk(ROOT)) {
      const html = fs.readFileSync(file, 'utf8');
      if (html.includes('https://oopsmypassword.com')) offenders.push(path.relative(ROOT, file) + ' (dead .com origin)');
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
      const noindex = /name="robots"[^>]*noindex/.test(html);
      if (canonical && canonical[1] !== SITE + '/' && !canonical[1].startsWith(SITE + '/')) {
        offenders.push(path.relative(ROOT, file) + ' (canonical ' + canonical[1] + ')');
      } else if (!canonical && !noindex) {
        offenders.push(path.relative(ROOT, file) + ' (no canonical, no noindex)');
      }
    }
    assert(offenders.length === 0, 'canonical problems:\n      ' + offenders.join('\n      '));
  });

  check('the 404 page is noindex and carries no canonical', () => {
    const html = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
    assert(/name="robots"[^>]*noindex/.test(html), '404.html is indexable (soft 404)');
    assert(!/<link rel="canonical"/.test(html), '404.html carries a canonical');
  });

  check('unknown /products/<slug> URLs 404 instead of serving the hub (no soft 404)', () => {
    /* A catch-all rewrite to products.html returns HTTP 200 for junk
       slugs. Google treats that as a soft 404 and distrusts the host. */
    const createRouter = require(path.join(ROOT, 'tools', 'hosting_router.js'));
    const router = createRouter(ROOT, FIREBASE_JSON);
    const r = router.resolve('/products/this-slug-does-not-exist-for-seo', 0);
    assert(r.type === 'notfound',
      'unknown product URL resolved as ' + r.type + (r.file ? ' (' + r.file + ')' : '') +
      ' — a 200 of products.html is a soft 404');
    const cfg = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8'));
    const catchAll = (cfg.hosting.rewrites || []).find((rule) =>
      /products\s*\{/.test(String(rule.source || '')) || String(rule.source || '') === '/products/**');
    assert(!catchAll, '/products catch-all rewrite would 200 every fake slug');
  });

  check('unknown /osint/<slug> URLs 404 instead of serving the hub (no soft 404)', () => {
    const createRouter = require(path.join(ROOT, 'tools', 'hosting_router.js'));
    const router = createRouter(ROOT, FIREBASE_JSON);
    const r = router.resolve('/osint/this-slug-does-not-exist-for-seo', 0);
    assert(r.type === 'notfound',
      'unknown osint URL resolved as ' + r.type + (r.file ? ' (' + r.file + ')' : '') +
      ' — a 200 of osint.html is a soft 404');
    const cfg = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8'));
    const catchAll = (cfg.hosting.rewrites || []).find((rule) =>
      /osint\s*\{/.test(String(rule.source || '')) || String(rule.source || '') === '/osint/**');
    assert(!catchAll, '/osint catch-all rewrite would 200 every fake slug');
  });

  check('unknown /pentest/<slug> URLs 404 instead of serving the hub (no soft 404)', () => {
    const createRouter = require(path.join(ROOT, 'tools', 'hosting_router.js'));
    const router = createRouter(ROOT, FIREBASE_JSON);
    const r = router.resolve('/pentest/this-slug-does-not-exist-for-seo', 0);
    assert(r.type === 'notfound',
      'unknown pentest URL resolved as ' + r.type + (r.file ? ' (' + r.file + ')' : '') +
      ' — a 200 of pentest.html is a soft 404');
    const cfg = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8'));
    const catchAll = (cfg.hosting.rewrites || []).find((rule) =>
      /pentest\s*\{/.test(String(rule.source || '')) || String(rule.source || '') === '/pentest/**');
    assert(!catchAll, '/pentest catch-all rewrite would 200 every fake slug');
  });

  check('no unmaintained SRI integrity hashes on local assets', () => {
    /* No pipeline step regenerates integrity attributes, so any present
       hash goes stale on the next asset edit — and browsers then BLOCK the
       file (this once shipped /learning with no stylesheet at all).
       Local assets must ship without integrity attributes; the pinned
       esm.sh SDK version (tested in test_runtime.js) is the version guard
       instead. */
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.isDirectory()) {
        if (['.git', 'node_modules', 'tools', 'functions', 'supabase'].includes(e.name)) return [];
        return walk(path.join(dir, e.name));
      }
      return e.name.endsWith('.html') ? [path.join(dir, e.name)] : [];
    });
    const offenders = [];
    for (const file of walk(ROOT)) {
      const html = fs.readFileSync(file, 'utf8');
      const re = /((?:src|href)="(\/assets\/[^"]+)"[^>]*?)integrity="([^"]*)"/g;
      let m;
      while ((m = re.exec(html)) !== null) offenders.push(path.relative(ROOT, file) + ' :: ' + m[2]);
    }
    assert(offenders.length === 0, 'unmaintained integrity attributes (stale ones get blocked by browsers):\n      ' + offenders.join('\n      '));
  });

  check('sitemap.xml and robots.txt override CORP so Google can fetch them', () => {
    /* The site-wide ** header sets Cross-Origin-Resource-Policy: same-origin.
       GSC's sitemap fetcher then reports "Couldn't fetch". Later, more-specific
       header blocks must win with cross-origin + XML content-type. */
    const cfg = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8'));
    const blocks = cfg.hosting.headers || [];
    const sitemapBlock = blocks.find((b) => /sitemap\.xml/.test(String(b.source || '')));
    assert(sitemapBlock, 'firebase.json has no header block covering sitemap.xml');
    const headersOf = (block) => (block && block.headers) || [];
    const has = (block, key, needle) => headersOf(block).some((h) =>
      String(h.key) === key && String(h.value).indexOf(needle) !== -1);
    assert(has(sitemapBlock, 'Content-Type', 'application/xml'),
      'sitemap Content-Type is not application/xml');
    assert(has(sitemapBlock, 'Cross-Origin-Resource-Policy', 'cross-origin'),
      'sitemap CORP is not cross-origin — Search Console reports Couldn\'t fetch');
    assert(has(sitemapBlock, 'Access-Control-Allow-Origin', '*'),
      'sitemap missing Access-Control-Allow-Origin *');
    const cc = headersOf(sitemapBlock).find((h) => h.key === 'Cache-Control');
    assert(cc && !/no-store/.test(cc.value),
      'sitemap Cache-Control no-store makes crawlers fail to keep the file');
    const robotsBlock = blocks.find((b) => String(b.source || '') === '/robots.txt');
    assert(robotsBlock, 'firebase.json has no header block for /robots.txt');
    assert(has(robotsBlock, 'Content-Type', 'text/plain'),
      'robots.txt Content-Type is not text/plain');
    assert(has(robotsBlock, 'Cross-Origin-Resource-Policy', 'cross-origin'),
      'robots.txt CORP is not cross-origin');
  });

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
