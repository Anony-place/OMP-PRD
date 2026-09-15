/* OMP all-pages jsdom smoke test.
   Loads every shipped page, lets all scripts run, and fails on any
   uncaught error, console.error, failed sub-resource or missing
   critical chrome. Not part of test_runtime.js (which simulates
   user behaviour); this one is a broad "does every page boot" sweep.

   Usage: NODE_PATH=/tmp/node_modules node tools/smoke_all_pages.js
*/
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { webcrypto } = require('crypto');

const ROOT = path.dirname(__dirname);
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };

const http = require('http');
const createRouter = require('./hosting_router.js');
const router = createRouter(ROOT, path.join(ROOT, 'firebase.json'));
/* Serve the site the way Firebase Hosting does: pretty URLs, 301s for
   legacy .html forms, per-guide /articles/<slug> rewrites, and the
   custom 404 page for unknown paths (including unknown product slugs). */
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
  const r = router.resolve(p, 0);
  if (r.type === 'redirect') { res.writeHead(r.status, { Location: r.location }); res.end('moved'); return; }
  const file = path.join(ROOT, r.file || r.fallback || '/404.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(r.type === 'notfound' ? 404 : 200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
const ready = new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port)));

function listPages() {
  const out = ['', 'checker', 'generator', 'tools', 'breach-check', 'password-health',
               'entropy', 'passphrase', 'random-string', 'security-checklist',
               'articles', 'products', 'about', 'contact', 'faq', 'glossary',
               'privacy', 'security', 'sitemap', '404'];
  for (const f of fs.readdirSync(path.join(ROOT, 'guides'))) {
    if (f.endsWith('.html')) out.push('articles/' + f.replace(/\.html$/, ''));
  }
  out.push('admin/index.html');
  return out.sort();
}

/* esm.sh is unreachable from CI/jsdom and the admin module legitimately
   imports from it — that is not a page bug, so it is allow-listed. */
const ALLOWED_ERROR = /esm\.sh|supabase|ERR_VM_DYNAMIC_IMPORT|Article feed error|importModuleDynamically/i;

(async () => {
  const PORT = await ready;
  const pages = listPages();
  let problems = 0;

  for (const rel of pages) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => { if (!ALLOWED_ERROR.test(e.message || '')) errors.push('jsdomError: ' + (e.message || e).toString().split('\n')[0]); });
    vc.on('error', (...a) => { const m = a.join(' '); if (!ALLOWED_ERROR.test(m)) errors.push('console.error: ' + m.split('\n')[0]); });

    const dom = await JSDOM.fromURL(`http://127.0.0.1:${PORT}/${rel}`, {
      runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w) {
        w.fetch = (u, o) => fetch(String(u).startsWith('http') ? u : `http://127.0.0.1:${PORT}${u}`, o).catch(() => new Response('[]', { status: 500 }));
        w.scrollTo = () => {};
        w.matchMedia = w.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
        w.IntersectionObserver = w.IntersectionObserver || class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }], this); } unobserve() {} disconnect() {} };
        if (!w.crypto || !w.crypto.getRandomValues) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
      }
    });
    await new Promise(r => setTimeout(r, 400));

    const d = dom.window.document;
    const checks = [];

    /* --- structural sanity shared by every public page --- */
    const isAdmin = rel.startsWith('admin/');
    if (!isAdmin) {
      if (!d.querySelector('header.site-nav')) checks.push('missing header.site-nav');
      if (!d.querySelector('footer.site-footer')) checks.push('missing footer.site-footer');
      if (!d.querySelector('main')) checks.push('missing <main>');
      if (!d.querySelector('.skip-link')) checks.push('missing skip link');
      if (!d.querySelector('link[rel="canonical"]')) checks.push('missing canonical');
      if (!d.querySelector('meta[name="description"]')) checks.push('missing meta description');
      if (!d.querySelector('html[lang]')) checks.push('missing html lang');
      if (!d.getElementById('mobile-menu')) checks.push('missing mobile menu');
      if (!d.querySelector('[data-nav-toggle]')) checks.push('missing nav toggle');
      /* the global search must be injected on every page with site chrome */
      if (!d.getElementById('omp-search-trigger')) checks.push('search trigger not injected');
      if (!d.getElementById('omp-search-overlay')) checks.push('search overlay not built');
      if (!d.getElementById('omp-search-mobile-trigger')) checks.push('mobile search button not injected');
      /* footer year must be filled in by main.js */
      const yr = d.querySelector('[data-year]');
      if (yr && !/^\d{4}$/.test(yr.textContent.trim())) checks.push('footer year not populated');
      /* products.html is deliberately noindex until the first product ships
         (empty catalog); every other public page must be indexable. */
      if (d.querySelector('meta[name="robots"][content*="noindex"]') && rel !== 'products') checks.push('public page is noindex');
    } else {
      if (!d.getElementById('admin-root')) checks.push('missing #admin-root');
      if (!d.querySelector('meta[name="robots"][content*="noindex"]')) checks.push('admin page is not noindex');
      if (d.getElementById('omp-search-trigger')) checks.push('search leaked into the admin panel');
      if (typeof dom.window.OMPMarkdown !== 'object') checks.push('OMPMarkdown unavailable for the admin preview');
      if (typeof dom.window.OMPSanitize !== 'function') checks.push('OMPSanitize unavailable for the admin preview');
    }

    /* --- no page may ship unresolved template placeholders or TODOs --- */
    const bodyText = d.body ? d.body.textContent : '';
    for (const bad of ['{{', '}}', 'undefined</', 'NaN min read', '[object Object]']) {
      if (bodyText.includes(bad)) checks.push('rendered text contains "' + bad + '"');
    }

    /* --- every internal link must resolve on disk --- */
    const badLinks = new Set();
    d.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || /^(https?:|mailto:|tel:|#|javascript:void)/i.test(href)) return;
      const clean = href.split('#')[0].split('?')[0];
      if (!clean) return;
      if (!clean.startsWith('/')) { badLinks.add('non-root-relative: ' + href); return; }
      /* Follow the same resolution Firebase uses (redirects + rewrites);
         the chain must end at a real file, never a loop. */
      const end = router.follow(clean).end;
      if (end.type === 'loop') badLinks.add('redirect loop: ' + href);
      else if (end.type === 'notfound') badLinks.add('404: ' + href);
    });
    if (badLinks.size) checks.push('broken internal links -> ' + Array.from(badLinks).slice(0, 4).join(', '));

    /* --- every local asset reference must exist --- */
    const badAssets = new Set();
    d.querySelectorAll('link[href], script[src], img[src]').forEach(el => {
      const u = el.getAttribute('href') || el.getAttribute('src') || '';
      if (!u.startsWith('/') || u.startsWith('//')) return;
      if (!fs.existsSync(path.join(ROOT, u.split('?')[0]))) badAssets.add(u);
    });
    if (badAssets.size) checks.push('missing assets -> ' + Array.from(badAssets).join(', '));

    /* --- horizontal-overflow guard: no element may be positioned outside
           its clipping ancestor with an unclipped negative inset --- */
    const cssText = fs.readFileSync(path.join(ROOT, 'assets/css/styles.css'), 'utf8');
    if (/\.page-hero\s*\{[^}]*\}/.test(cssText) && !/\.page-hero\s*\{[^}]*overflow:\s*hidden/.test(cssText)) {
      checks.push('.page-hero does not clip its ::before bleed (horizontal overflow)');
    }

    const status = (errors.length || checks.length) ? 'FAIL' : 'ok  ';
    if (errors.length || checks.length) problems++;
    console.log(`${status} /${rel}` + (errors.length ? `\n        runtime: ${errors.slice(0, 3).join(' | ')}` : '') + (checks.length ? `\n        markup : ${checks.slice(0, 5).join(' | ')}` : ''));
    dom.window.close();
  }

  server.close();
  console.log(`\n${pages.length - problems}/${pages.length} pages clean, ${problems} with problems`);
  process.exit(problems ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
