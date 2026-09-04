/* Behavioral harness for the public products app (jsdom, supabase mocked
   via a data:-URL dynamic import). Covers: catalog render, type filter,
   search, featured, detail views, pricing, CTA fallbacks, JSON-LD, meta
   rewrites, states (skeleton/error/empty/filter-miss/not-found), XSS
   hostile rows, URL scheme gates, and deliverable privacy. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..'); /* run: NODE_PATH=<jsdom> node tools/<this> */

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LIBS = ['url.js', 'sanitize.js', 'markdown.js'].map(f => fs.readFileSync(`${ROOT}/assets/js/${f}`, 'utf8'));
const APP = fs.readFileSync(`${ROOT}/assets/js/products.js`, 'utf8');

const ROWS = [
  { id: '1', slug: 'passphrase-book', name: 'The Passphrase Book', summary: 'Printable companion to the generator.', description: '## What inside\n\n200 pages, <b>hardcover</b>.', product_type: 'book', price: 29.99, currency: 'USD', cta_label: '', featured: true, featured_image: 'https://cdn.example.com/cover.jpg', external_url: 'https://buy.example.com/book', status: 'published', has_file: false },
  { id: '2', slug: 'phishing-course', name: 'Spot Phishing Fast', summary: 'A 40-minute video course.', description: 'Six lessons.', product_type: 'course', price: 0, currency: 'USD', cta_label: '', featured: false, featured_image: '', external_url: '', status: 'published', has_file: false },
  { id: '3', slug: 'audit-checklist', name: 'Family Audit Checklist', summary: 'TXT checklist for households.', description: 'Plain text file.', product_type: 'template', price: 9, currency: 'EUR', cta_label: 'Download Pack', featured: false, featured_image: '', external_url: 'https://buy.example.com/pack', status: 'published', file_path: 'product-files/audit/pack.zip' },
  { id: '4', slug: 'evil-row', name: '<img src=x onerror=window.__pwned=1>Bad', summary: '<script>window.__pwned=2</script>summary', description: '<script>window.__pwned=3</script><img src=x onerror=window.__pwned=4>**md**', product_type: 'javascript:alert(1)', price: 19, currency: 'usd', cta_label: '<b>Click</b>', featured: false, featured_image: 'javascript:alert(1)', external_url: 'javascript:alert(1)', status: 'published', has_file: false, file_path: 'product-files/evil/x.pdf' },
  { id: '5', slug: '../escape/attempt', name: 'Traversal', summary: 'bad slug row', description: 'x', product_type: 'other', price: 5, currency: 'USD', featured: false, featured_image: '', external_url: '', status: 'published' },
  { id: '6', slug: 'legacy-toolkit', name: 'Legacy Toolkit', summary: 'Delivered as a file, sold off-site later.', description: 'Comes as a download.', product_type: 'tool', price: 12, currency: 'USD', cta_label: '', featured: false, featured_image: '', external_url: '', status: 'published', file_path: 'product-files/legacy/tool.zip' }
];

function mockClientModuleSource({ rows, error, delayMs }) {
  const q = JSON.stringify({ rows, error, delayMs: delayMs || 0 });
  return `export function createClient(url, key, opts){
    const cfg = ${q};
    return {
      from(table){
        if (table !== 'products') throw new Error('unexpected table ' + table);
        const b = {
          select(){ b._f = 1; return b; },
          eq(c, v){ b._eq = b._eq || {}; b._eq[c] = v; return b; },
          order(){ return b; },
          limit(){ return b; },
          then(res, rej){
            /* thenable contract: CALL res/rej (a returned promise is ignored) */
            setTimeout(() => {
              if (cfg.error) { if (rej) rej(cfg.error); else res({ data: null, error: cfg.error }); }
              else res({ data: (cfg.rows || []).slice(), error: null });
            }, cfg.delayMs || 0);
          }
        };
        return b;
      }
    };
  }`;
}

async function boot(pathname, cfg) {
  const html = `<!doctype html><html><head>
<link rel="canonical" href="https://oopsmypassword.com/products">
<meta property="og:url" content=""><meta property="og:type" content="">
<meta property="og:title" content=""><meta property="og:description" content="">
<meta name="twitter:title" content=""><meta name="twitter:description" content="">
</head><body><main><div data-products></div></main></body></html>`;
  const dom = new JSDOM(html, { url: 'https://oopsmypassword.com' + pathname, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = w.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  for (const src of LIBS) w.eval(src);
  const dataUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(mockClientModuleSource(cfg));
  /* jsdom can't run dynamic import(); hand the app a closure that uses
     Node's native loader (data: URLs are importable from CJS). */
  w.__dynamicImport = url => import(url);
  w.eval(APP.replace("import('https://esm.sh/@supabase/supabase-js@2')",
    'window.__dynamicImport(' + JSON.stringify(dataUrl) + ')'));
  await sleep(cfg.delayMs ? cfg.delayMs + 60 : 80);
  return { dom, w };
}

(async () => {
  /* ---------- catalog view ---------- */
  {
    const { w } = await boot('/products', { rows: ROWS, error: null });
    const root = w.document.querySelector('[data-products]');
    const titles = () => [...new Set([...root.querySelectorAll('.product-title')].map(t => t.textContent))];
    ok(titles().length === 5, `grid shows 5 safe rows (got ${titles().length}: ${titles().join(' | ')})`);
    ok(root.querySelectorAll('a.product-card[href="/products/passphrase-book"]').length >= 1, 'safe slug → linked card at /products/<slug>');
    ok(!root.textContent.includes('Traversal'), 'unsafe-slug row is dropped entirely (never linked, never rendered)');
    ok(!root.innerHTML.includes('../escape'), 'no traversal path leaks into DOM');
    const chips = [...root.querySelectorAll('[data-ptype]')];
    ok(chips.length === 7 && chips[0].textContent.trim().startsWith('All'), '7 chips (All + 6 types)');
    ok(root.innerHTML.includes('Books <span class="cat-count">1</span>'), 'type chips carry counts');
    ok(root.innerHTML.includes('Featured') && root.querySelectorAll('.product-grid').length >= 2, 'featured section renders');
    ok(root.querySelector('#product-search') !== null, 'search input present');
    // pricing
    const priceEls = [...root.querySelectorAll('.price')];
    ok(priceEls.some(p => p.textContent.includes('29.99')), '29.99 USD formats with currency');
    ok(priceEls.some(p => p.textContent.trim() === 'Free'), 'price 0 renders as Free');
    // XSS
    ok(!w.__pwned, 'no hostile handler fired on catalog render');
    ok(!root.innerHTML.includes('<script>window.__pwned'), 'summary script does not inject');
    ok(root.innerHTML.includes('&lt;img src=x onerror='), 'hostile name is escaped');
    // URL gates
    ok(!root.innerHTML.includes('src="javascript:'), 'javascript: cover rejected');
    ok(!root.innerHTML.includes('href="javascript:'), 'javascript: link rejected');
    // deliverable privacy
    ok(!root.innerHTML.includes('product-files/'), 'private storage path never rendered');
    // meta
    ok(w.document.querySelector('link[rel="canonical"]').href === 'https://oopsmypassword.com/products', 'list view canonical = /products');
    ok(!w.document.querySelector('meta[name="robots"]'), 'populated catalog is indexable');

    /* ---------- type filter ---------- */
    w.document.querySelector('[data-ptype="book"]').click();
    const bookTitles = [...new Set([...w.document.querySelectorAll('.product-title')].map(t => t.textContent))];
    ok(bookTitles.length === 1 && bookTitles[0] === 'The Passphrase Book', 'book chip filters to 1 product');
    ok(w.document.querySelector('[data-ptype="book"]').classList.contains('is-active'), 'active chip marked');
    w.document.querySelector('[data-ptype="course"]').click();
    ok([...w.document.querySelectorAll('.product-title')].map(t => t.textContent)[0] === 'Spot Phishing Fast', 'course chip switches filter');

    /* ---------- search ---------- */
    w.document.querySelector('#product-search').value = 'phish';
    w.document.querySelector('#product-search').dispatchEvent(new w.Event('input', { bubbles: true }));
    ok([...new Set([...w.document.querySelectorAll('.product-title')].map(t => t.textContent))].join() === 'Spot Phishing Fast', 'search narrows grid');
    w.document.querySelector('#product-search').value = 'zzzz-no-match';
    w.document.querySelector('#product-search').dispatchEvent(new w.Event('input', { bubbles: true }));
    ok(w.document.querySelector('[data-products]').innerHTML.includes('No products match'), 'filter-miss state distinct from empty/error');

    /* ---------- detail views ---------- */
    await sleep(20);
    const det = await boot('/products/passphrase-book', { rows: ROWS, error: null });
    const droot = det.w.document.querySelector('[data-products]');
    const cta = droot.querySelector('a.btn-primary');
    ok(cta && cta.getAttribute('href') === 'https://buy.example.com/book', 'external purchase URL used on CTA');
    ok(cta && cta.getAttribute('rel') === 'noopener noreferrer' && cta.getAttribute('target') === '_blank', 'CTA is target=_blank + noopener');
    ok(cta && cta.textContent.trim().startsWith('Buy Now'), 'book default CTA label is Buy Now');
    ok(droot.querySelector('.price').textContent.includes('29.99'), 'detail shows price');
    ok(droot.querySelector('.prose h2') !== null, 'markdown description rendered as HTML');
    const ld = det.w.document.getElementById('omp-product-ld');
    const data = JSON.parse(ld.textContent);
    ok(data['@type'] === 'Product' && data.name === 'The Passphrase Book', 'JSON-LD Product emitted');
    ok(data.offers && data.offers.price === '29.99' && data.offers.priceCurrency === 'USD' && data.offers.availability.includes('InStock'), 'JSON-LD Offer complete');
    ok(det.w.document.querySelector('link[rel="canonical"]').href === 'https://oopsmypassword.com/products/passphrase-book', 'detail canonical rewritten');
    ok(det.w.document.querySelector('meta[property="og:type"]').content === 'product', 'og:type = product');
    ok(det.w.document.title.includes('The Passphrase Book'), 'document title includes product name');
    ok(!det.w.document.querySelector('meta[name="robots"]'), 'valid product is indexable');
    ok(!droot.innerHTML.includes('product-files/'), 'detail never references private path');

    const free = await boot('/products/phishing-course', { rows: ROWS, error: null });
    const froot = free.w.document.querySelector('[data-products]');
    ok(froot.querySelector('.price') && froot.querySelector('.price').textContent.trim() === 'Free', 'free course shows Free');
    ok(!froot.querySelector('a.btn-primary'), 'no purchase URL → no CTA link');
    const fdata = JSON.parse(free.w.document.getElementById('omp-product-ld').textContent);
    ok(fdata.offers && fdata.offers.price === '0', 'JSON-LD Offer price 0 for free product');

    const file = await boot('/products/audit-checklist', { rows: ROWS, error: null });
    const fileroot = file.w.document.querySelector('[data-products]');
    const btn = fileroot.querySelector('a.btn-primary');
    ok(btn && btn.getAttribute('href') === 'https://buy.example.com/pack' && btn.textContent.includes('Download Pack'), 'custom CTA label honored (link wins when both set)');
    ok(!fileroot.innerHTML.includes('Secure download delivered'), 'secure-download note reserved for file-only products');
    ok(!fileroot.innerHTML.includes('product-files/'), 'file path stays private on detail page');

    const fileOnly = await boot('/products/legacy-toolkit', { rows: ROWS, error: null });
    const foRoot = fileOnly.w.document.querySelector('[data-products]');
    ok(foRoot.innerHTML.includes('Secure download delivered after purchase'), 'file-only product explains signed-download flow');
    ok(!foRoot.querySelector('a.btn-primary'), 'file-only product exposes no public link');
    ok(!foRoot.innerHTML.includes('product-files/'), 'private path never rendered');

    const evil = await boot('/products/evil-row', { rows: ROWS, error: null });
    const eroot = evil.w.document.querySelector('[data-products]');
    ok(!evil.w.__pwned, 'no hostile handler fired on detail render');
    ok(!eroot.innerHTML.includes('href="javascript:'), 'javascript: CTA rejected on detail');
    ok(!eroot.innerHTML.includes('src="javascript:'), 'javascript: cover rejected on detail');
    ok(eroot.innerHTML.includes('&lt;b&gt;Click&lt;/b&gt;') || !eroot.innerHTML.includes('<b>Click</b>'), 'CTA label escaped');
    const eld = evil.w.document.getElementById('omp-product-ld');
    const edata = JSON.parse(eld.textContent);
    ok(!edata.offers || edata.offers.url.indexOf('javascript') === -1, 'JSON-LD offer URL is not javascript:');
    ok(edata['@type'] === 'Product', 'JSON-LD still valid for hostile row');

    /* ---------- not found ---------- */
    const nf = await boot('/products/does-not-exist', { rows: ROWS, error: null });
    const nroot = nf.w.document.querySelector('[data-products]');
    ok(nroot.innerHTML.includes('Product not found'), 'unknown slug → not-found view');
    ok((nf.w.document.querySelector('meta[name="robots"]') || {}).content === 'noindex', 'not-found is noindex');
    ok(nf.w.document.querySelector('link[rel="canonical"]').href.includes('/products/does-not-exist'), 'not-found canonical = requested URL');

    const inv = await boot('/products/..%2Fescape', { rows: ROWS, error: null });
    ok(inv.w.document.querySelector('[data-products]').innerHTML.includes('Product not found'), 'invalid slug charset → not-found (no traversal)');

    /* ---------- error + retry ---------- */
    const err = await boot('/products', { rows: [], error: { message: 'boom' }, delayMs: 10 });
    ok(err.w.document.querySelector('[data-products]').innerHTML.includes('temporarily unavailable'), 'fetch failure → error banner');
    ok(err.w.document.querySelector('[data-products]').innerHTML.includes('Retry'), 'Retry offered');
    ok(!err.w.document.querySelector('meta[name="robots"]') || err.w.document.querySelector('meta[name="robots"]').content !== 'noindex', 'transient error stays indexable');

    const detErr = await boot('/products/passphrase-book', { rows: [], error: { message: 'boom' }, delayMs: 10 });
    ok(detErr.w.document.querySelector('[data-products]').innerHTML.includes("Can’t load this product"), 'detail fetch failure → distinct error view');
    ok(!detErr.w.document.querySelector('meta[name="robots"]'), 'detail transient error not noindexed');
    ok(detErr.w.document.querySelector('link[rel="canonical"]').href.endsWith('/products/passphrase-book'), 'detail transient error keeps self-canonical');

    /* ---------- empty catalog ---------- */
    const empty = await boot('/products', { rows: [], error: null });
    const emroot = empty.w.document.querySelector('[data-products]');
    ok(emroot.innerHTML.includes('No products yet'), 'genuine empty state shown');
    ok((empty.w.document.querySelector('meta[name="robots"]') || {}).content === 'noindex', 'empty catalog noindexed');
    ok(!emroot.innerHTML.includes('temporarily unavailable'), 'empty ≠ error');
  }

  console.log(`\n${pass}/${pass + fail} products behavioral checks passed${fail ? `, ${fail} FAILURES` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS CRASH:', e); process.exit(2); });
