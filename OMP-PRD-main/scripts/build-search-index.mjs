#!/usr/bin/env node
/**
 * Build the site-search index for content that is NOT hand-listed in
 * assets/js/search.js.
 *
 * Why this exists: STATIC_INDEX inside search.js is maintained by hand, so every
 * new comparison page or cheat sheet stayed invisible to the search box until
 * someone remembered to add it. When this script was written, nine published
 * pages (5 comparisons + 4 cheat sheets) plus 18 glossary pages and 1 article
 * simply could not be found by a visitor typing their exact title.
 *
 * Generating the index from the built HTML means a page becomes searchable the
 * moment it exists. tools/test_search_index.mjs fails the build if any content
 * page is missing from the merged index, so the drift cannot come back.
 *
 * Output is deterministic (sorted, no timestamps) so builds don't churn the file.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SEARCH_JS = join(ROOT, 'assets/js/search.js');
const OUT = join(ROOT, 'assets/data/search-index.json');

/** Content folders that feed the generated index, with the label search shows. */
const FAMILIES = [
  { dir: 'compare', type: 'Comparison' },
  { dir: 'cheatsheets', type: 'Cheat Sheet' },
  { dir: 'glossary', type: 'Glossary' },
  { dir: 'articles', type: 'Guide' },
];

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', middot: '·', times: '×',
};

function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => (ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? m));
}

function text(s) {
  return decode(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function firstMatch(html, re) {
  const m = html.match(re);
  return m ? m[1] : '';
}

/** Page <title>, minus the site suffix, so search ranks on the real subject. */
function pageTitle(html) {
  const raw = text(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  return raw.replace(/\s*[|—–]\s*(OopsMyPassword|OMP)\s*$/i, '').trim() || raw;
}

function pageDescription(html) {
  const raw = firstMatch(html, /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i)
    || firstMatch(html, /<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
  const clean = text(raw);
  if (clean.length <= 160) return clean;
  const cut = clean.slice(0, 160);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/** Every URL already hand-listed in search.js — never duplicate those. */
function alreadyIndexed() {
  if (!existsSync(SEARCH_JS)) return new Set();
  const src = readFileSync(SEARCH_JS, 'utf8');
  const urls = new Set();
  for (const m of src.matchAll(/url:\s*'([^']+)'/g)) urls.add(m[1].replace(/\.html$/i, '').replace(/\/+$/, ''));
  return urls;
}

const items = [];
const seen = alreadyIndexed();
let skipped = 0;

for (const { dir, type } of FAMILIES) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) continue;

  const files = readdirSync(abs)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .sort();

  for (const file of files) {
    const slug = file.replace(/\.html$/, '');
    const url = `/${dir}/${slug}`;
    if (seen.has(url)) { skipped += 1; continue; } /* already hand-listed */

    const html = readFileSync(join(abs, file), 'utf8');
    const title = pageTitle(html);
    if (!title) continue;

    seen.add(url);
    items.push({
      type,
      title,
      desc: pageDescription(html),
      url,
      /* Slug words make the exact-term search ("curl", "nikto") land even when
         the title phrases it differently. */
      kw: `${slug.replace(/-/g, ' ')} ${type.toLowerCase()} ${dir}`,
    });
  }
}

items.sort((a, b) => a.url.localeCompare(b.url));

writeFileSync(OUT, JSON.stringify({ schema_version: 1, items }, null, 2) + '\n');

const byType = {};
for (const it of items) byType[it.type] = (byType[it.type] || 0) + 1;
console.log(
  `search index: ${items.length} generated entries ` +
  `(${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(', ')}; ` +
  `${skipped} already hand-listed) -> assets/data/search-index.json`
);
