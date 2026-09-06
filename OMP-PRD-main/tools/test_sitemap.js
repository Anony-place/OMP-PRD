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
const { JSDOM } = require('jsdom');

const DOMParser = new JSDOM().window.DOMParser;

const ROOT = path.resolve(__dirname, '..');
const EDGE_CORE = path.join(ROOT, 'supabase', 'functions', 'sitemap', 'sitemap-core.mjs');
const FIREBASE_CORE = path.join(ROOT, 'functions', 'sitemap-core.mjs');
const EDGE_INDEX = path.join(ROOT, 'supabase', 'functions', 'sitemap', 'index.ts');
const SITEMAP_XML = path.join(ROOT, 'sitemap.xml');
const FIREBASE_JSON = path.join(ROOT, 'firebase.json');

let pass = 0;
let fail = 0;

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

  const OPTS = { articles: ARTICLES, products: PRODUCTS, site: 'https://oopsmypassword.com' };

  group('sitemap-core.mjs (shared generator)');

  check('published articles are listed', () => {
    const xml = core.buildSitemapXml(OPTS);
    assert(xml.includes('/articles/published-one'), 'missing published article');
    assert(xml.includes('/products/live-product'), 'missing published product');
  });

  check('drafts and archived rows are never listed', () => {
    const xml = core.buildSitemapXml(OPTS);
    assert(!xml.includes('draft-one'), 'draft leaked into sitemap');
    assert(!xml.includes('archived-one'), 'archived leaked into sitemap');
    assert(!xml.includes('hidden-product'), 'draft product leaked into sitemap');
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
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    assert(doc.getElementsByTagName('parsererror').length === 0, 'XML is not well-formed');
    assert(doc.getElementsByTagName('script').length === 0, 'script element parsed out of the sitemap');
  });

  check('output is well-formed sitemap XML', () => {
    const xml = core.buildSitemapXml(OPTS);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    assert(doc.getElementsByTagName('parsererror').length === 0, 'parse error');
    assert(doc.documentElement.nodeName === 'urlset', 'root is not <urlset>');
    assert(
      doc.documentElement.namespaceURI === 'http://www.sitemaps.org/schemas/sitemap/0.9',
      'wrong sitemap namespace'
    );
    const locs = Array.from(doc.getElementsByTagName('loc')).map((n) => n.textContent);
    assert(locs.length > 0, 'no <loc> entries');
    locs.forEach((l) => assert(/^https:\/\/oopsmypassword\.com\//.test(l), 'off-site loc: ' + l));
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
      const pathname = l.replace('https://oopsmypassword.com', '');
      assert(pathname === '/' || !pathname.endsWith('/'), 'trailing slash: ' + l);
      assert(!/\.html$/.test(pathname), 'implementation URL leaked: ' + l);
    });
  });

  check('lastmod is a valid ISO date and falls back to the static stamp', () => {
    const xml = core.buildSitemapXml(OPTS);
    const mods = (xml.match(/<lastmod>([^<]*)<\/lastmod>/g) || []).map((s) => s.slice(9, -10));
    assert(mods.length > 0, 'no lastmod entries');
    mods.forEach((m) => assert(/^\d{4}-\d{2}-\d{2}$/.test(m), 'bad lastmod: ' + m));
    assert(core.formatLastmod('not a date', '2026-01-01') === '2026-01-01', 'invalid date did not fall back');
    assert(core.formatLastmod('2026-09-04T10:00:00Z') === '2026-09-04', 'UTC date not formatted');
  });

  check('static route set is complete', () => {
    const xml = core.buildSitemapXml({ site: 'https://oopsmypassword.com' });
    ['/', '/checker', '/generator', '/tools', '/articles', '/products', '/breach-check', '/about',
      '/privacy', '/terms', '/contact', '/faq', '/glossary', '/security', '/sitemap',
      '/password-health', '/entropy', '/passphrase', '/random-string', '/security-checklist'
    ].forEach((r) => assert(xml.includes(`<loc>https://oopsmypassword.com${r}</loc>`), 'missing ' + r));
    const guides = (xml.match(/<loc>[^<]*\/articles\/[a-z0-9-]+<\/loc>/g) || []);
    assert(guides.length === 15, 'expected 15 static guides, got ' + guides.length);
  });

  check('supabase failure still yields a valid sitemap (degrade, never 500)', () => {
    const xml = core.buildSitemapXml({ site: 'https://oopsmypassword.com' });
    assert(xml.indexOf('<urlset') !== -1, 'no urlset in fallback');
    assert(xml.indexOf('/articles/published-one') === -1, 'fallback leaked article data');
  });

  check('JSON view mirrors the XML and carries titles', () => {
    const data = core.buildSitemapJson(OPTS);
    assert(data.articles.length === 1 && data.articles[0].slug === undefined, 'unexpected article set');
    assert(data.articles[0].url.endsWith('/articles/published-one'), 'bad article url');
    assert(data.products.length === 1 && data.products[0].title === 'Live', 'bad product entry');
    assert(typeof data.count === 'number' && data.count > 0, 'missing count');
  });

  group('deployment wiring');

  check('Firebase copy of the core is byte-identical to the Edge Function copy', () => {
    assert(fs.existsSync(FIREBASE_CORE), 'functions/sitemap-core.mjs missing — run `npm run sync:sitemap`');
    const a = fs.readFileSync(EDGE_CORE, 'utf8');
    const b = fs.readFileSync(FIREBASE_CORE, 'utf8');
    assert(a === b, 'copies diverged — run `npm run sync:sitemap` in functions/');
  });

  check('Edge Function reads config from env, never from a hard-coded secret', () => {
    const src = fs.readFileSync(EDGE_INDEX, 'utf8');
    assert(!/service_role|SUPABASE_SERVICE/i.test(src), 'edge function references the service-role key');
    assert(src.includes("Deno.env.get('SUPABASE_ANON_KEY')"), 'anon key not read from env');
    assert(src.includes('./sitemap-core.mjs'), 'edge function does not use the shared core');
  });

  check('firebase.json rewrites /sitemap.xml to the function and ignores the static file', () => {
    const cfg = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8'));
    const hosting = cfg.hosting;
    assert(hosting.ignore.includes('sitemap.xml'), 'static sitemap.xml is not ignored (it would shadow the rewrite)');
    const rewrite = hosting.rewrites.find((r) => r.source === '/sitemap.xml');
    assert(rewrite && rewrite.function === 'sitemap', '/sitemap.xml is not rewritten to the sitemap function');
  });

  check('committed sitemap.xml snapshot matches the generated static set', () => {
    const snapshot = fs.readFileSync(SITEMAP_XML, 'utf8');
    const generated = core.buildSitemapXml({ site: 'https://oopsmypassword.com' });
    const norm = (s) => (s.match(/<loc>[^<]*<\/loc>/g) || []).join('\n');
    assert(norm(snapshot) === norm(generated), 'sitemap.xml snapshot drifted from the core route list');
  });

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
