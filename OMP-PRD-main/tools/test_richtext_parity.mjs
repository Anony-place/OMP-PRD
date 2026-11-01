#!/usr/bin/env node
/* ============================================================
   Preview and page must agree.

   The bug this exists for: assets/js/sanitize.js (preview + /articles feed) and
   functions/safe-article-html.cjs (the static page the build writes) each carry
   their own allowlist. They drifted. <kbd>, <mark>, <dl>, <q> and friends
   rendered in the editor and arrived on the page unwrapped - so an author saw a
   correct preview and shipped a different article.

   Two lists that must match, checked by a test, is the only version of this that
   stays true. A comment saying "keep these in sync" does not.

   Run: node tools/test_richtext_parity.mjs
   Requires: npm ci --prefix functions (sanitize-html).
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failed += 1;
  console.log(`  ✗ ${message}`);
}
function section(name) { console.log(`\n${name}`); }

/* --------------------------------------------------------------- the lists */

const clientSource = fs.readFileSync(path.join(ROOT, 'assets/js/sanitize.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(ROOT, 'functions/safe-article-html.cjs'), 'utf8');

function clientTags() {
  const block = clientSource.match(/var ALLOWED_TAGS = \{([\s\S]*?)\};/);
  if (!block) throw new Error('could not find ALLOWED_TAGS in assets/js/sanitize.js');
  const tags = new Set();
  for (const match of block[1].matchAll(/([a-z][a-z0-9]*)\s*:/g)) tags.add(match[1]);
  return tags;
}

function serverTags() {
  const block = serverSource.match(/allowedTags:\s*\[([\s\S]*?)\],/);
  if (!block) throw new Error('could not find allowedTags in functions/safe-article-html.cjs');
  const tags = new Set();
  for (const match of block[1].matchAll(/'([a-z0-9]+)'/g)) tags.add(match[1]);
  return tags;
}

/* The SVG family is handled by a dedicated namespace builder on the client
   (createElementNS) rather than by the generic element copier, so it is compared
   against the client's own SVG_SHAPES map instead of ALLOWED_TAGS. */
const SVG_FAMILY = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'marker', 'title', 'desc']);

section('One allowlist, two renderers');
const client = clientTags();
const server = serverTags();
const serverHtml = new Set([...server].filter((t) => !SVG_FAMILY.has(t)));
const onlyServer = [...serverHtml].filter((t) => !client.has(t));
const onlyClient = [...client].filter((t) => !serverHtml.has(t));

assert(onlyServer.length === 0, `nothing is allowed on the page and stripped in the preview (${onlyServer.join(', ') || 'none'})`);
assert(onlyClient.length === 0, `nothing is allowed in the preview and stripped on the page (${onlyClient.join(', ') || 'none'})`);

section('The tags authors actually use still survive');
const AUTHOR_TAGS = ['kbd', 'mark', 'abbr', 'cite', 'q', 'dl', 'dt', 'dd', 'ins', 'del', 'samp', 'small',
  'figure', 'figcaption', 'table', 'details', 'summary', 'pre', 'code'];
const missing = AUTHOR_TAGS.filter((t) => !client.has(t) || !serverHtml.has(t));
assert(missing.length === 0, `kbd, mark, dl, figure, code and friends are on both sides (${missing.join(', ') || 'all present'})`);

section('SVG is a drawing, not a document');
const clientSvg = clientSource.match(/var SVG_SHAPES = \{([\s\S]*?)\};/);
assert(Boolean(clientSvg), 'the client has an SVG shape map');
assert(/createElementNS\(\s*SVG_NS/.test(clientSource), 'the client builds SVG nodes in the SVG namespace (createElement would render nothing)');
assert(/SVG_ATTR\s*=\s*\//.test(clientSource), 'the client filters SVG attributes through an allowlist');
for (const shape of ['path', 'rect', 'circle', 'polyline', 'text']) {
  assert(server.has(shape), `the server keeps <${shape}> inside a diagram`);
}
for (const forbidden of ['script', 'foreignobject', 'use', 'style', 'animate', 'image']) {
  assert(!server.has(forbidden) && !SVG_FAMILY.has(forbidden), `<${forbidden}> is not an allowed SVG element`);
}

section('Behaviour: the renderer does what the allowlist says');
let sanitize;
try {
  sanitize = require_(path.join(ROOT, 'functions/safe-article-html.cjs'));
} catch (error) {
  console.log(`\n  ! functions/node_modules missing - run: npm ci --prefix functions`);
  console.log(`  ! ${error.message}`);
  process.exitCode = 1;
}
if (sanitize) {
  const cases = [
    ['keeps <kbd>', '<p>Press <kbd>Ctrl</kbd>+<kbd>K</kbd></p>', (out) => out.includes('<kbd>Ctrl</kbd>')],
    ['keeps <mark> and <q>', '<p><mark>hot</mark> <q>quoted</q></p>', (out) => out.includes('<mark>') && out.includes('<q>')],
    ['keeps <dl>', '<dl><dt>A</dt><dd>B</dd></dl>', (out) => out.includes('<dt>') && out.includes('<dd>')],
    ['keeps an inline drawing', '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>',
      (out) => out.includes('<svg') && out.includes('viewBox="0 0 10 10"') && out.includes('<rect')],
    ['drops <script> inside svg', '<svg><script>alert(1)</script><path d="M0 0"/></svg>',
      (out) => !out.includes('script') && out.includes('<path')],
    ['drops foreignObject with its content', '<svg><foreignObject><img src=x>text</foreignObject><circle r="4"/></svg>',
      (out) => !out.includes('foreignObject') && !out.includes('text') && out.includes('<circle')],
    ['drops <use> with an external reference', '<svg><use href="https://evil.test/x.svg#a"/><rect width="4" height="4"/></svg>',
      (out) => !out.includes('<use') && out.includes('<rect')],
    ['still converts video embeds to a link', '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>',
      (out) => !out.includes('<iframe') && out.includes('youtube.com/watch?v=abcdefghijk')],
    ['still refuses javascript: URLs', '<a href="javascript:alert(1)">x</a>', (out) => !out.includes('javascript:')],
  ];
  for (const [name, input, check] of cases) {
    let out = '';
    try { out = sanitize(input); } catch (error) { out = `THREW: ${error.message}`; }
    assert(check(out), `${name}  →  ${out.slice(0, 90)}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
