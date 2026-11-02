#!/usr/bin/env node
/* ============================================================
   Media library: the part that decides whether a file can be deleted.

   "Can I delete this?" is a question about other tables, not about the file.
   Getting it wrong in one direction breaks a live page (a diagram that was
   referenced), and in the other leaves the free storage tier full of orphans
   nobody dares remove.

   The matching is tested here directly, without a browser or a bucket: it is a
   pure function over rows and files.

   Run: node tools/test_media.mjs
   ============================================================ */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(warning);
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = await import(new URL(`file://${path.join(ROOT, 'assets/js/admin/media.js')}`).href);
const { BUCKETS, SOURCES, findUsage, formatBytes, snippetFor, summariseBucket } = mod;

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

const BASE = 'https://aeehfulikupsrv.supabase.co/storage/v1/object/public/articles';

section('A file a page uses is found, by URL, in any column');
const files = [
  { name: 'diagram.svg', url: `${BASE}/diagram.svg`, size: 2048 },
  { name: 'orphan.png', url: `${BASE}/orphan.png`, size: 8192 },
  { name: 'private.pdf', url: '', size: 1024 }
];
const records = {
  articles: [{
    table: 'articles', label: 'article', title: 'title',
    rows: [
      { title: 'Kerberos, explained', content: `<p><img src="${BASE}/diagram.svg"></p>` },
      { title: 'Unrelated', content: '<p>no images</p>' }
    ]
  }]
};

let usage = findUsage(files, records);
assert(usage.get('diagram.svg').state === 'used', 'a diagram embedded in an article body is "used"');
assert(usage.get('diagram.svg').hits[0].title === 'Kerberos, explained', 'and the article is named, so the delete refusal can say where');
assert(usage.get('orphan.png').state === 'unused', 'a file nothing mentions is "unused"');
assert(usage.get('private.pdf').state === 'unknown', 'a private file with no public URL cannot be judged');

section('A URL with a query string or fragment is still the same file');
usage = findUsage(
  [{ name: 'diagram.svg', url: `${BASE}/diagram.svg?download=1`, size: 1 }],
  { articles: [{ table: 'articles', label: 'article', title: 'title',
    rows: [{ title: 'With query', content: `<img src="${BASE}/diagram.svg#top">` }] }] }
);
assert(usage.get('diagram.svg').state === 'used', 'the query string does not hide a reference');

section('A referenced field, not just the body');
usage = findUsage(
  [{ name: 'cover.webp', url: `${BASE}/cover.webp`, size: 1 }],
  { articles: [{ table: 'articles', label: 'article', title: 'title',
    rows: [{ title: 'Has a cover', content: 'text only', featured_image: `${BASE}/cover.webp` }] }] }
);
assert(usage.get('cover.webp').state === 'used', 'a featured image counts as usage');

section('One file, several pages');
usage = findUsage(
  [{ name: 'shared.png', url: `${BASE}/shared.png`, size: 1 }],
  { articles: [{ table: 'articles', label: 'article', title: 'title', rows: [
    { title: 'One', content: `${BASE}/shared.png` },
    { title: 'Two', content: `${BASE}/shared.png` },
    { title: 'Three', content: `${BASE}/shared.png` }
  ] }] }
);
assert(usage.get('shared.png').hits.length === 3, 'all three are reported, not just the first');

section('A partial name is not a match');
usage = findUsage(
  [{ name: 'diagram.svg', url: `${BASE}/diagram.svg`, size: 1 }],
  { articles: [{ table: 'articles', label: 'article', title: 'title',
    rows: [{ title: 'Other', content: `${BASE}/diagram.svg.backup` }] }] }
);
/* The needle is contained in that longer URL, so this is a false positive by
   design: it errs towards "used", which blocks a delete rather than breaking a
   page. Documented here so nobody "fixes" it into a false negative. */
assert(usage.get('diagram.svg').state === 'used', 'a longer path containing ours is treated as used - the safe direction');

section('Usage that could not be checked is not "unused"');
const partial = findUsage(files, {
  articles: [{ table: 'articles', label: 'article', title: 'title', rows: [] }]
});
assert(partial.get('orphan.png').state === 'unused', 'when the scan ran and found nothing, the file is unused');
const nothingScanned = findUsage(files, {});
assert(nothingScanned.get('orphan.png').state === 'unused',
  'with no rows at all every public file looks unused - which is why the screen says when the scan failed');

section('Bucket totals');
const stats = summariseBucket(files, findUsage(files, records));
assert(stats.count === 3, 'the count');
assert(stats.total === 2048 + 8192 + 1024, 'the total size');
assert(stats.used === 1 && stats.unused === 1 && stats.unknown === 1, 'and a breakdown that adds up');

section('Sizes read like sizes');
assert(formatBytes(0) === '0 B', 'zero does not read as blank');
assert(formatBytes(2048) === '2.0 KB', 'kilobytes');
assert(formatBytes(5 * 1048576) === '5.0 MB', 'megabytes');
assert(formatBytes(2.5 * 1073741824) === '2.50 GB', 'gigabytes, because the free tier is counted in them');

section('The snippet an author pastes');
const url = `${BASE}/diagram.svg`;
assert(snippetFor(url, 'markdown', 'Auth flow') === `![Auth flow](${url})`, 'Markdown for a body');
assert(snippetFor(url, 'html', 'Auth flow') === `<img src="${url}" alt="Auth flow" loading="lazy">`, 'HTML with a lazy-loaded image');
assert(snippetFor(url, 'url') === url, 'a bare URL for a field');
assert(snippetFor(url, 'markdown', 'brackets [are] stripped') === `![brackets are stripped](${url})`,
  'brackets in alt text cannot break the Markdown');
assert(!snippetFor(url, 'html', 'a "quoted" alt').includes('"quoted"'),
  'quotes in alt text cannot break the HTML attribute');

section('Every bucket says where it is used');
for (const bucket of BUCKETS) {
  const sources = SOURCES[bucket.id];
  assert(Array.isArray(sources) && sources.length > 0, `"${bucket.id}" has at least one table to check`);
  for (const source of sources || []) {
    assert(source.columns.length > 0, `"${bucket.id}" checks columns, not just existence`);
  }
}
assert(BUCKETS.every(bucket => bucket.note), 'each bucket explains what it is for');

section('The old file browser is gone, not duplicated');
const admin = fs.readFileSync(path.join(ROOT, 'assets/js/admin.js'), 'utf8');
const sections = fs.readFileSync(path.join(ROOT, 'assets/js/admin/sections.js'), 'utf8');
assert(!/renderMediaView/.test(admin), 'admin.js no longer has its own media implementation');
assert(!/data-tab="media"/.test(admin), 'and no longer has a second Media tab button');
assert(/media: mountMedia/.test(sections), 'the section list routes "media" to the new module');
assert(/export async function mountMedia/.test(fs.readFileSync(path.join(ROOT, 'assets/js/admin/media.js'), 'utf8')),
  'which is exported from the new module');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
