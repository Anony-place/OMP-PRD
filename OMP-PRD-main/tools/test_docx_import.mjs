#!/usr/bin/env node
/* ============================================================
   .docx import: the converter, and why its output is not trusted.

   A Word document can carry a hyperlink whose target is javascript:alert(1).
   The converter reproduces it faithfully, because that is its job - it is a
   format translator, not a security boundary. This test exists to prove two
   things at once:

     * the vendored converter works in a browser-shaped realm, offline
     * its output still has to go through the article sanitizer, and a hostile
       link does not survive that

   Run: node tools/test_docx_import.mjs
   Requires: npm ci --prefix tools/qa-deps --ignore-scripts
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/* Node warns that a .js file with ESM syntax has no "type": "module". The site
   ships no bundler and the file stays a .js for the browser, so the warning is
   expected here and only noise. */
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  /* The code, not the name: Node sets name='Warning' and code='MODULE_TYPELESS_PACKAGE_JSON'. */
  if (warning.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(warning);
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(ROOT, 'tools/qa-deps/'));
const { JSDOM } = require_('jsdom');
const sanitize = require_(path.join(ROOT, 'functions/safe-article-html.cjs'));

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

const CONVERTER = path.join(ROOT, 'assets/vendor/mammoth.browser.min.js');
const LICENSE = path.join(ROOT, 'assets/vendor/mammoth.LICENSE.txt');
const FIXTURE = path.join(ROOT, 'tools/fixtures/import-sample.docx');

section('The converter ships with the site');
assert(fs.existsSync(CONVERTER), 'the converter is in assets/vendor, so no CDN is needed for it');
const size = fs.existsSync(CONVERTER) ? fs.statSync(CONVERTER).size : 0;
assert(size > 400000 && size < 1200000, `it is a sane size (${(size / 1024).toFixed(0)} KB, loaded only when a .docx is picked)`);
assert(fs.existsSync(LICENSE), 'its BSD licence ships next to it, because redistributing it requires that');
const source = fs.readFileSync(CONVERTER, 'utf8');
assert(/mammoth/i.test(source), 'and it is the library the module thinks it is');
assert(!/https?:\/\/(cdn|unpkg|jsdelivr)/i.test(source.slice(0, 2000)), 'it is not a loader that fetches from a CDN at runtime');

const license = fs.readFileSync(LICENSE, 'utf8');
assert(/Redistribution and use in source and binary forms/i.test(license), 'the licence text is the real one, not a placeholder');

section('It runs in a browser-shaped realm');
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'https://oopsmypassword.web.app/Anony.su/',
  runScripts: 'outside-only'
});
dom.window.eval(source);
assert(typeof dom.window.mammoth?.convertToHtml === 'function', 'the script registers window.mammoth, which is what the panel loads');
assert(typeof dom.window.mammoth?.extractRawText === 'function', 'and the rest of its API is there, not a stub');

async function convert(buffer) {
  /* Same realm as the library: its zip reader uses instanceof against the
     window's ArrayBuffer, and a Node buffer from another realm is rejected. */
  const bytes = new dom.window.Uint8Array(buffer);
  return dom.window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
}

section('A real .docx becomes HTML');
const fixture = fs.readFileSync(FIXTURE);
const converted = await convert(fixture);
const html = converted.value;
assert(/<h1>Imported heading<\/h1>/.test(html), 'a Word heading becomes a heading element');
assert(/<strong>bold words<\/strong>/.test(html), 'bold becomes strong');
assert(/href="https:\/\/example\.com\/safe"/.test(html), 'a link keeps its target');
assert(/&lt;script&gt;/.test(html), 'text that looks like markup stays text');

section('The converter is not a security boundary');
/* This is the point of the whole file: what a hijacked document can carry
   through the converter untouched. */
assert(/href="javascript:alert\(1\)"/.test(html), 'a javascript: link comes through the converter as a live href');

const safe = sanitize(html);
assert(!/javascript:/i.test(safe), 'and the article sanitizer removes it before anything is stored');
assert(!/<script/i.test(safe), 'no script element survives');
assert(/Imported heading/.test(safe), 'while the real content is kept');
assert(/href="https:\/\/example\.com\/safe"/.test(safe), 'including the safe link');
assert(/&lt;script&gt;/.test(safe), 'and the text that only looked like markup');

section('The panel module');
const modulePath = path.join(ROOT, 'assets/js/admin/docx.js');
assert(fs.existsSync(modulePath), 'assets/js/admin/docx.js exists');
const moduleSource = fs.readFileSync(modulePath, 'utf8');
assert(!/innerHTML/.test(moduleSource), 'the module never writes HTML into the DOM itself - it returns text');
assert(/assets\/vendor\/mammoth\.browser\.min\.js/.test(moduleSource), 'it points at the vendored file');
assert(/window\.mammoth\.convertToHtml|mammoth\.convertToHtml/.test(moduleSource), 'and uses the converter the test just exercised');

const { stripImages, tidy } = await import(new URL(`file://${modulePath}`).href);
const withImages = '<p>Before</p><img src="data:image/png;base64,AAAA"><p>After</p><img src="data:image/png;base64,BBBB">';
const stripped = stripImages(withImages);
assert(stripped.removed === 2, 'inlined images are counted');
assert(!/img/.test(stripped.html), 'and removed, so a 200 KB document does not become a multi-megabyte field');
assert(/Before/.test(stripped.html) && /After/.test(stripped.html), 'the text around them survives');

assert(tidy('<p>A</p><p>   </p><p>B</p>') === '<p>A</p><p>B</p>', 'empty paragraphs are dropped');
assert(tidy('  <p>A</p>  ') === '<p>A</p>', 'and the result is trimmed');

section('Failure is handled, not hidden');
const load = await import(new URL(`file://${modulePath}`).href);
assert(typeof load.loadConverter === 'function', 'the converter is loaded lazily, on first use');
assert(/could not load the \.docx converter/.test(moduleSource), 'a failed load reports itself instead of returning empty text');
assert(/save it as \.docx|saved from an older Word/.test(fs.readFileSync(path.join(ROOT, 'assets/js/admin.js'), 'utf8')),
  'the editor tells the reader that the old binary .doc format is not supported');

section('The browser will be allowed to load it');
const firebase = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
const cspValues = [];
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== 'object') return;
  if (node.key === 'Content-Security-Policy') cspValues.push(node.value);
  Object.values(node).forEach(walk);
};
walk(firebase);
assert(cspValues.length > 0, 'the hosting config carries a CSP');
const scriptSrc = cspValues.map((value) => (value.match(/script-src[^;]*/) || [''])[0]);
assert(scriptSrc.every((directive) => /'self'/.test(directive)), "every CSP allows scripts from 'self', which is where the converter lives");

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
