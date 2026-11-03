#!/usr/bin/env node
/* ============================================================
   Can a visitor find a page they can see?

   The site search box is the only way to reach 300+ pages without walking the
   navigation. Its index used to be maintained by hand, which meant it silently
   fell behind the site: when this test was written, 9 published pages
   (5 comparisons, 4 cheat sheets), 18 glossary entries and 1 article were
   unfindable by their own titles.

   Fixing the index once is not enough - the same drift would return on the next
   batch of pages. So this gate compares the pages on disk with the pages the
   search box actually knows about, and fails when a page exists but cannot be
   found.

   Run: node tools/test_search_index.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

/* Content families that are reachable from search. Academy lessons and the
   OSINT/Pentest catalogues arrive at runtime from JSON/Supabase, so they are
   not listed here. */
const FAMILIES = [
  { dir: 'compare', label: 'comparisons' },
  { dir: 'cheatsheets', label: 'cheat sheets' },
  { dir: 'glossary', label: 'glossary entries' },
  { dir: 'articles', label: 'articles' },
];

function pagesOnDisk(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => `/${dir}/${f.replace(/\.html$/, '')}`);
}

/* --- what the search box knows --------------------------------------- */

const searchJs = fs.readFileSync(path.join(root, 'assets/js/search.js'), 'utf8');
const handListed = [...searchJs.matchAll(/url:\s*'([^']+)'/g)]
  .map((m) => m[1].replace(/\.html$/i, '').replace(/\/+$/, ''));

const indexPath = path.join(root, 'assets/data/search-index.json');
assert(fs.existsSync(indexPath), 'assets/data/search-index.json exists');
const indexDoc = fs.existsSync(indexPath)
  ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  : { items: [] };
const generated = (indexDoc.items || []).map((it) => it.url);

section('The generated index is well formed');

assert(indexDoc.schema_version === 1, 'schema_version is 1');
assert(Array.isArray(indexDoc.items) && indexDoc.items.length > 0,
  `index carries entries (${(indexDoc.items || []).length})`);

const BAD = [];
for (const it of indexDoc.items || []) {
  const ok = it && typeof it.type === 'string' && it.type
    && typeof it.title === 'string' && it.title.trim().length > 3
    && typeof it.desc === 'string' && it.desc.trim().length > 10
    && typeof it.url === 'string' && it.url.startsWith('/');
  if (!ok) BAD.push(it && it.url ? it.url : JSON.stringify(it).slice(0, 60));
}
assert(BAD.length === 0, `every entry has a type, title, description and path${BAD.length ? ` — bad: ${BAD.slice(0, 3).join(', ')}` : ''}`);

const generatedUrls = generated.map((u) => u.toLowerCase());
assert(new Set(generatedUrls).size === generatedUrls.length,
  'no entry appears twice in the generated index');

section('Nothing is listed twice across the two index sources');

const overlap = generated.filter((u) => handListed.includes(u));
assert(overlap.length === 0,
  `the generated index only adds what search.js does not already list${overlap.length ? ` — duplicated: ${overlap.slice(0, 3).join(', ')}` : ''}`);

section('Every generated entry points at a real page');

const DANGLE = generated.filter((u) => !fs.existsSync(path.join(root, `${u.replace(/^\//, '')}.html`)));
assert(DANGLE.length === 0, `no dead links in the index${DANGLE.length ? ` — missing: ${DANGLE.slice(0, 3).join(', ')}` : ''}`);

/* --- the actual gate -------------------------------------------------- */

section('A visitor can find every page the site publishes');

const known = new Set([...handListed, ...generated]);
for (const { dir, label } of FAMILIES) {
  const pages = pagesOnDisk(dir);
  const missing = pages.filter((u) => !known.has(u));
  assert(missing.length === 0,
    missing.length
      ? `${pages.length - missing.length}/${pages.length} ${label} are searchable — MISSING: ${missing.slice(0, 6).join(', ')}`
      : `all ${pages.length} ${label} are searchable`);
}

section('Typing a page title lands on that page');

/* The reason the search box exists. A title that scores zero is a page nobody
   can reach by name, even though the entry technically exists. */
function normalizeUrl(u) {
  return String(u || '').replace(/\.html(?=$|[?#])/i, '').replace(/\/+$/, '').toLowerCase() || '/';
}
function scoreItem(item, q) {
  const t = (item.title || '').toLowerCase();
  const d = (item.desc || '').toLowerCase();
  const k = (item.kw || '').toLowerCase();
  let s = 0;
  if (t === q) s += 100;
  else if (t.indexOf(q) === 0) s += 60;
  else if (t.indexOf(q) !== -1) s += 40;
  if (k.indexOf(q) !== -1) s += 25;
  if (d.indexOf(q) !== -1) s += 10;
  if (s > 0 && t.split(' ').some((w) => w.indexOf(q) === 0)) s += 15;
  return s;
}

/* Spot-checks a first-time visitor would actually type. These are the terms
   that were dead before the generated index existed. */
const REAL_QUERIES = ['curl', 'hydra', 'nikto', 'linpeas', 'trufflehog', 'glossary', 'canary'];
for (const q of REAL_QUERIES) {
  const hits = (indexDoc.items || []).filter((it) => scoreItem(it, q) > 0);
  assert(hits.length > 0, `searching "${q}" returns at least one result`);
}

const probes = (indexDoc.items || []).slice(0, 25);
const unreachable = probes.filter((it) => scoreItem(it, it.title.toLowerCase().slice(0, 24)) === 0);
assert(unreachable.length === 0,
  `typing a page's own title finds it${unreachable.length ? ` — ${unreachable[0].url}` : ''}`);

section('The browser really merges it (end to end)');

/* The checks above prove the data is right. This proves the wiring is right:
   a real page, the real search.js, a real keystroke. Without it the JSON could
   be perfect and still never reach the results list. */
{
  let JSDOM = null;
  try {
    ({ JSDOM } = await import(
      new URL('./qa-deps/node_modules/jsdom/lib/api.js', import.meta.url).href
    ));
  } catch (e) { /* handled by the assert below */ }

  assert(!!JSDOM,
    'jsdom is installed (npm ci --prefix tools/qa-deps)');

  if (JSDOM) {
    const { VirtualConsole } = await import(
      new URL('./qa-deps/node_modules/jsdom/lib/api.js', import.meta.url).href
    );
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
      url: 'https://oopsmypassword.vercel.app/',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
      virtualConsole: new VirtualConsole(),
    });
    const w = dom.window;
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    /* Serve the generated index and refuse everything else, so a pass cannot
       come from the Supabase path or the network. */
    w.fetch = (u) => String(u).includes('search-index.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(indexDoc) })
      : Promise.resolve({ ok: false, json: () => Promise.resolve([]) });
    w.eval(fs.readFileSync(path.join(root, 'assets/js/search.js'), 'utf8'));

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(250);

    const doc = w.document;
    const trigger = doc.getElementById('omp-search-trigger');
    assert(!!trigger, 'the search button is on the page');
    trigger.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(80);

    const input = doc.querySelector('#omp-search-overlay input');
    assert(!!input, 'the search dialog opens with a field ready');

    const search = async (q) => {
      input.value = q;
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
      await wait(250); /* the input is debounced by 80ms */
      return [...doc.querySelectorAll('#omp-search-overlay a')].map((a) => a.getAttribute('href'));
    };

    /* Exactly the pages a visitor could not find before this change. */
    const CASES = [
      ['curl', '/cheatsheets/curl-command-cheatsheet'],
      ['hydra', '/cheatsheets/hydra-brute-force-cheatsheet'],
      ['nikto', '/compare/nikto-vs-nuclei'],
      ['linpeas', '/compare/linpeas-vs-winpeas'],
      ['trufflehog', '/compare/trufflehog-vs-gitleaks'],
      ['canary', '/glossary/canary-token'],
    ];
    for (const [q, expected] of CASES) {
      const hrefs = await search(q);
      assert(hrefs.includes(expected), `typing "${q}" lists ${expected}`);
    }

    /* A query that matches nothing from the generated index must not pretend. */
    const none = await search('zzzznotathing');
    assert(none.length === 0, 'a nonsense query returns no results instead of filler');
  }
}

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
