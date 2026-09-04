/* ============================================================
   Wire matrix — end-to-end checks of the local Firebase Hosting
   model (tools/hosting_router.js) against the URL architecture:
   cleanUrls 301s, trailingSlash:false, legacy /blog + /guides
   redirects, /articles/** + /products{,/**} SPA rewrites, custom
   404, and a no-redirect-loop guarantee for every public entry.

   Run: node tools/wire_matrix.js   (expects repo root as cwd)
   ============================================================ */
'use strict';
const createRouter = require('./hosting_router.js');

const ROOT = require('path').resolve(__dirname, '..');
const { resolve, follow } = createRouter(ROOT);

let pass = 0, fail = 0;
const ok = (cond, name) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗ FAIL:', name); }
};

const isFile = (p, file, name) => {
  const r = resolve(p);
  ok(r.type === 'file' && r.file === file, `${p} serves ${file} (got ${r.type} ${r.file || r.location || ''})`);
};
const isRedirect = (p, loc, name) => {
  const r = resolve(p);
  ok(r.type === 'redirect' && r.location === loc && r.status === 301, `${name}: ${p} → 301 ${loc} (got ${r.type} ${r.location || ''} ${r.status || ''})`);
};

console.log('wire matrix — hosting model vs URL architecture');

/* --- core pages --- */
isFile('/', '/index.html', 'home');
isFile('/checker', '/checker.html', 'checker');
isFile('/generator', '/generator.html', 'generator');
isFile('/tools', '/tools.html', 'tools hub');
isFile('/articles', '/articles.html', 'articles hub');
isFile('/products', '/products.html', 'products hub');
isFile('/breach-check', '/breach-check.html', 'breach check');
isFile('/about', '/about.html', 'about');
/* Search is a site-wide modal injected by assets/js/search.js — not a page. */
isFile('/sitemap.xml', '/sitemap.xml', 'sitemap');

/* --- products deep links (SPA rewrite) --- */
isFile('/products/passphrase-book', '/products.html', 'product deep link');
isFile('/products/passphrase-book/chapters', '/products.html', 'nested product path also rewrites (harmless)');

/* --- cleanUrls + trailingSlash --- */
isRedirect('/products.html', '/products', 'cleanUrls strips .html');
isRedirect('/articles.html', '/articles', 'cleanUrls strips .html (articles)');
isRedirect('/products/', '/products', 'trailing slash collapses');
isRedirect('/articles/', '/articles', 'trailing slash collapses (articles)');

/* --- legacy redirects --- */
isRedirect('/blog', '/articles', 'legacy /blog');
isRedirect('/blog.html', '/articles', 'legacy /blog.html');
isRedirect('/guides', '/articles', 'legacy /guides');
isRedirect('/guides/passkeys-explained.html', '/articles/passkeys-explained', 'legacy guide .html');
isRedirect('/guides/passkeys-explained', '/articles/passkeys-explained', 'legacy guide path');

/* --- static guide pages via /articles/<slug> rewrites --- */
isFile('/articles/passkeys-explained', '/guides/passkeys-explained.html', 'static guide at pretty URL');
isFile('/articles/create-strong-password', '/guides/create-strong-password.html', 'static guide at pretty URL (2)');
isFile('/articles/some-future-db-slug', '/articles.html', 'dynamic slug falls through to the SPA');

/* --- 404 --- */
{
  const r = resolve('/totally-unknown-page');
  ok(r.type === 'notfound' && r.file === '/404.html', 'unknown path → custom 404');
}

/* --- no redirect loops on any public entry --- */
const entries = ['/', '/checker', '/generator', '/tools', '/articles', '/articles/passkeys-explained',
  '/products', '/products/some-slug', '/breach-check', '/about', '/blog', '/guides',
  '/guides/passkeys-explained.html', '/products.html', '/admin/'];
for (const e of entries) {
  const { end, hops } = follow(e);
  ok(end.type !== 'loop', `no redirect loop for ${e}${hops.length ? ' (hops: ' + hops.map(h => h.to).join(' → ') + ')' : ''}`);
}

console.log(`\n${pass}/${pass + fail} wire-matrix checks passed${fail ? `, ${fail} FAILURES` : ''}`);
process.exit(fail ? 1 : 0);
