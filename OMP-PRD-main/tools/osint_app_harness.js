/* Behavioral harness for the public OSINT Hub app (jsdom, supabase mocked
   via a data:-URL dynamic import). Covers: hub render, category filter,
   access + pricing filters, search, sort, featured, detail views (badges,
   install copy button, official links), JSON-LD, meta rewrites, states
   (skeleton/error/empty/filter-miss/not-found), XSS hostile rows, URL
   scheme gates, and bad-slug rejection. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..'); /* run: NODE_PATH=<jsdom> node tools/<this> */

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LIBS = ['url.js', 'sanitize.js', 'markdown.js'].map(f => fs.readFileSync(`${ROOT}/assets/js/${f}`, 'utf8'));
const APP = fs.readFileSync(`${ROOT}/assets/js/osint.js`, 'utf8');

const CATS = [
  { id: 'c1', name: 'Username OSINT', slug: 'username-osint', description: 'u', status: 'published', sort_order: 1 },
  { id: 'c2', name: 'Email OSINT', slug: 'email-osint', description: 'e', status: 'published', sort_order: 2 }
];
const ROWS = [
  { id: '1', slug: 'sherlock', name: 'Sherlock', summary: 'Username hunter.', overview: '## Big\n\nChecks 400+ sites.', install_guide: '```bash\npipx install sherlock-project\n```', category_id: 'c1', pricing: 'free', access_types: ['cli'], official_url: 'https://sherlockproject.xyz/', github_url: 'https://github.com/sherlock-project/sherlock', docs_url: '', logo_url: '', featured: true, status: 'published', sort_order: 1 },
  { id: '2', slug: 'epieos', name: 'Epieos', summary: 'Email reverse lookup.', overview: 'Web lookup.', install_guide: 'Open the site.', category_id: 'c2', pricing: 'freemium', access_types: ['web'], official_url: 'https://epieos.com/', github_url: '', docs_url: '', logo_url: 'https://cdn.example.com/epieos.png', featured: false, status: 'published', sort_order: 2 },
  { id: '3', slug: 'shodan', name: 'Shodan', summary: 'Device search engine.', overview: 'Scans the net.', install_guide: '', category_id: 'c1', pricing: 'freemium', access_types: ['web', 'api'], official_url: 'https://www.shodan.io/', github_url: '', docs_url: '', logo_url: '', featured: false, status: 'published', sort_order: 3 },
  { id: '4', slug: 'evil-row', name: '<img src=x onerror=window.__pwned=1>Bad', summary: '<script>window.__pwned=2</script>s', overview: '<script>window.__pwned=3</script><img src=x onerror=window.__pwned=4>**md**', install_guide: 'javascript:alert(1)', category_id: 'c1', pricing: 'paid', access_types: ['cli', 'web', 'hax'], official_url: 'javascript:alert(1)', github_url: 'data:text/html,hi', docs_url: '', logo_url: 'javascript:alert(1)', featured: false, status: 'published', sort_order: 4 },
  { id: '5', slug: '../escape/attempt', name: 'Traversal', summary: 'bad slug', overview: 'x', install_guide: '', category_id: 'c1', pricing: 'free', access_types: ['web'], official_url: '', github_url: '', docs_url: '', logo_url: '', featured: false, status: 'published', sort_order: 5 }
];

function mockClientModuleSource({ cats, rows, error, delayMs }) {
  const q = JSON.stringify({ cats, rows, error, delayMs: delayMs || 0 });
  return `export function createClient(url, key, opts){
    const cfg = ${q};
    return {
      from(table){
        if (table !== 'osint_categories' && table !== 'osint_tools') throw new Error('unexpected table ' + table);
        const data = table === 'osint_categories' ? (cfg.cats || []) : (cfg.rows || []);
        const b = {
          select(){ return b; },
          eq(){ return b; },
          order(){ return b; },
          limit(){ return b; },
          then(res, rej){
            setTimeout(() => {
              if (cfg.error) { if (rej) rej(cfg.error); else res({ data: null, error: cfg.error }); }
              else res({ data: data.slice(), error: null });
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
<link rel="canonical" href="https://oopsmypassword.web.app/osint">
<meta property="og:url" content=""><meta property="og:type" content="">
<meta property="og:title" content=""><meta property="og:description" content="">
<meta name="twitter:title" content=""><meta name="twitter:description" content="">
</head><body><main><div data-osint></div></main></body></html>`;
  const dom = new JSDOM(html, { url: 'https://oopsmypassword.web.app' + pathname, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = w.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  for (const src of LIBS) w.eval(src);
  const dataUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(mockClientModuleSource(cfg));
  w.__dynamicImport = url => import(url);
  w.eval(APP.replace(/import\('https:\/\/esm\.sh\/@supabase\/supabase-js@[^']+'\)/,
    'window.__dynamicImport(' + JSON.stringify(dataUrl) + ')'));
  await sleep(cfg.delayMs ? cfg.delayMs + 60 : 100);
  return { dom, w };
}
const titles = root => [...new Set([...root.querySelectorAll('.feed-title')].map(t => t.textContent))];

(async () => {
  /* ---------- hub view ---------- */
  {
    const { w } = await boot('/osint', { cats: CATS, rows: ROWS, error: null });
    const root = w.document.querySelector('[data-osint]');
    ok(titles(root).length === 4, `hub shows 4 safe rows (got ${titles(root).length}: ${titles(root).join(' | ')})`);
    ok(!titles(root).join(' ').includes('Traversal'), 'bad-slug row is dropped');
    ok(root.querySelectorAll('.feed-title a[href="/osint/sherlock"]').length >= 1, 'safe slug → linked row at /osint/<slug>');
    ok(root.querySelector('[data-cat="username-osint"]'), 'category chip exists with slug');
    ok(root.querySelector('.osint-sidebar'), 'sidebar filter panel renders');
    ok(root.querySelectorAll('[data-f="access"]').length === 6, 'six access checkboxes render');
    ok(root.querySelectorAll('[data-f="pricing"]').length === 3, 'three pricing checkboxes render');
    ok(root.textContent.includes('4 of 4 tools shown'), 'result count line renders');
    ok(root.querySelectorAll('.osint-cat').length === 2, 'category cards render on the default view');
  }
  /* ---------- category filter ---------- */
  {
    const { w } = await boot('/osint', { cats: CATS, rows: ROWS, error: null });
    const root = w.document.querySelector('[data-osint]');
    root.querySelector('[data-cat="email-osint"]').click();
    await sleep(30);
    const t = titles(root);
    ok(t.length === 1 && t[0] === 'Epieos', `category filter narrows to Epieos (got ${t.join('|')})`);
    ok(root.querySelector('[data-clear-filters]'), 'clear-all appears when a filter is active');
    root.querySelector('[data-clear-filters]').click();
    await sleep(30);
    ok(titles(root).length === 4, 'clear-all restores all rows');
  }
  /* ---------- access + pricing filters ---------- */
  {
    const { w } = await boot('/osint', { cats: CATS, rows: ROWS, error: null });
    const root = w.document.querySelector('[data-osint]');
    const cli = root.querySelector('[data-f="access"][value="cli"]');
    cli.checked = true; cli.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(30);
    ok(titles(root).length === 2, `cli filter shows 2 rows (got ${titles(root).join('|')})`);
    const paid = root.querySelector('[data-f="pricing"][value="paid"]');
    paid.checked = true; paid.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(30);
    const t = titles(root);
    ok(t.length === 1 && t[0].includes('Bad'), `cli+paid narrows to the hostile row only (got ${t.join('|')})`);
  }
  /* ---------- search + sort ---------- */
  {
    const { w } = await boot('/osint', { cats: CATS, rows: ROWS, error: null });
    const root = w.document.querySelector('[data-osint]');
    const input = root.querySelector('#osint-search');
    input.value = 'shodan'; input.dispatchEvent(new w.Event('input', { bubbles: true }));
    await sleep(30);
    const t = titles(root);
    ok(t.length === 1 && t[0] === 'Shodan', `search narrows to Shodan (got ${t.join('|')})`);
    input.value = 'zzz-no-match'; input.dispatchEvent(new w.Event('input', { bubbles: true }));
    await sleep(30);
    ok(root.textContent.includes('No tools match'), 'filter miss shows a genuine empty state, not an error');
  }
  /* ---------- detail view ---------- */
  {
    const { w } = await boot('/osint/sherlock', { cats: CATS, rows: ROWS, error: null });
    const root = w.document.querySelector('[data-osint]');
    ok(root.querySelector('h1') && root.querySelector('h1').textContent === 'Sherlock', 'detail renders the tool H1');
    ok(root.innerHTML.includes('pipx install sherlock-project'), 'install guide content renders');
    ok(root.querySelector('[data-copy-install]'), 'install block has a Copy button');
    ok(root.querySelector('a[href="https://sherlockproject.xyz/"]'), 'official site button links out');
    ok(root.querySelector('a[href="https://github.com/sherlock-project/sherlock"]'), 'github button links out');
    ok(w.document.title.includes('Sherlock'), 'detail rewrites document.title');
    ok(root.querySelector('a[href="/osint"]'), 'detail has a back-to-hub button');
    ok(w.document.querySelector('#omp-osint-ld'), 'detail emits JSON-LD');
    ok(w.document.querySelector('#omp-osint-ld').textContent.includes('SoftwareApplication'), 'JSON-LD is a SoftwareApplication');
    ok(root.querySelector('.toc'), 'detail renders a table of contents like the guides');
  }
  /* ---------- hostile detail row ---------- */
  {
    const { w } = await boot('/osint/evil-row', { cats: CATS, rows: ROWS, error: null });
    const root = w.document.querySelector('[data-osint]');
    ok(w.__pwned === undefined, 'no inline handler executed from hostile row');
    const hrefs = [...root.querySelectorAll('[href]')].map(a => a.getAttribute('href') || '');
    const srcs = [...root.querySelectorAll('[src]')].map(i => i.getAttribute('src') || '');
    ok(!hrefs.concat(srcs).some(u => /^\s*javascript:/i.test(u)), 'javascript: URLs never reach href/src attributes');
    ok(!root.querySelector('a[href^="javascript:"]'), 'no javascript: link rendered');
    ok(root.textContent.includes('Paid'), 'known pricing renders as a chip on the hostile row');
  }
  /* ---------- not found + error states ---------- */
  {
    const { w } = await boot('/osint/no-such-tool', { cats: CATS, rows: ROWS, error: null });
    const root = w.document.querySelector('[data-osint]');
    ok(root.textContent.includes('Tool not found'), 'unknown slug shows not-found');
    ok(w.document.querySelector('meta[name="robots"]'), 'not-found sets noindex');
  }
  {
    const { w } = await boot('/osint', { cats: CATS, rows: ROWS, error: { message: 'boom' } });
    const root = w.document.querySelector('[data-osint]');
    ok(root.textContent.includes('temporarily unavailable'), 'fetch failure shows error banner');
    ok(root.querySelector('[data-retry]'), 'error state offers Retry');
  }
  {
    const { w } = await boot('/osint', { cats: [], rows: [], error: null });
    const root = w.document.querySelector('[data-osint]');
    ok(root.textContent.includes('No OSINT tools yet'), 'empty catalog shows genuine empty state');
  }
  console.log(`\n${pass}/${pass + fail} osint behavioral checks passed${fail ? `, ${fail} FAILURES` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('harness threw:', e); process.exit(1); });
