#!/usr/bin/env node
/* ============================================================
   Every tool, on a phone.

   The other gates check that the tools work. This one checks that they can be
   used with a thumb, because that is how most people will meet them and none of
   the existing checks would notice a broken phone layout - the markup is
   identical, only the rendering differs.

   Three failures matter most, and all three are measurable without a browser:

     1. a form field under 16px, which makes iOS Safari zoom the page the moment
        it is tapped - the layout then sits zoomed and half off-screen
     2. a control under 44px, which is below the size a finger can reliably hit
     3. a horizontal scrollbar, which means content wider than the phone

   Layout itself needs a real engine, so this reads the stylesheet the same way
   it is written - selectors, media queries, sizes - and applies the cascade for
   a 390px viewport. That is enough to catch the three failures above, and it
   runs in CI in under a second.

   Run: node tools/test_mobile_ux.mjs
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

/* Academy pages load styles.css and then learning.css, and the later sheet
   wins on any selector it repeats with equal-or-higher specificity. Reading
   only styles.css therefore missed fields that a learner actually types into:
   the lesson search sat at 12.8px on a phone and made iOS zoom the page. */
const STYLE_SHEETS = ['assets/css/styles.css', 'assets/css/learning.css'];
const css = STYLE_SHEETS
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');

const TOOLS = [
  'checker', 'generator', 'passphrase', 'entropy', 'random-string',
  'password-health', 'breach-check', 'dork-builder', 'hash-inspector',
  'url-scanner', 'security-checklist'
];

/* --- a small CSS reader ------------------------------------------------
   Enough of the cascade for the questions above: walk the sheet, keep the
   selectors, the media query each rule sits in, and the declarations. No
   shorthand expansion, no inheritance - just the numbers this file asserts on. */
function parseRules(source) {
  const rules = [];
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack = [];
  let buffer = '';
  for (const char of withoutComments) {
    if (char === '{') {
      const prelude = buffer.trim();
      buffer = '';
      if (prelude.startsWith('@media')) {
        stack.push({ type: 'media', condition: prelude.replace('@media', '').trim() });
      } else if (prelude.startsWith('@')) {
        stack.push({ type: 'at', condition: prelude });
      } else {
        stack.push({ type: 'rule', selector: prelude });
      }
      continue;
    }
    if (char === '}') {
      const top = stack.pop();
      if (top && top.type === 'rule' && buffer.trim()) {
        const media = stack.filter((s) => s.type === 'media').map((s) => s.condition);
        rules.push({ selector: top.selector, media, declarations: buffer.trim() });
      }
      buffer = '';
      continue;
    }
    buffer += char;
  }
  return rules;
}

const rules = parseRules(css);

const valueOf = (declarations, property) => {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(declarations);
  return match ? match[1].trim() : '';
};

/* Does a media query apply at the width we are modelling? Only max-width and
   min-width are used in this sheet for layout, plus prefers-reduced-motion which
   never changes a size. */
function mediaApplies(condition, width) {
  if (!condition) return true;
  if (/prefers-reduced-motion/.test(condition)) return false;
  const max = /max-width:\s*(\d+)px/.exec(condition);
  const min = /min-width:\s*(\d+)px/.exec(condition);
  if (max && width > Number(max[1])) return false;
  if (min && width < Number(min[1])) return false;
  return true;
}

/* Last matching declaration wins, which is what happens in a browser when the
   specificity is equal. Where it is not equal this over-reports rather than
   under-reports, which is the direction a gate should err in. */
function effective(selectorTest, property, width) {
  let value = '';
  for (const rule of rules) {
    if (!mediaApplies(rule.media.join(' and '), width)) continue;
    if (!selectorTest(rule.selector)) continue;
    const declared = valueOf(rule.declarations, property);
    if (declared) value = declared;
  }
  return value;
}

const toPx = (value, base = 16) => {
  if (!value) return NaN;
  const px = /^([\d.]+)px$/.exec(value);
  if (px) return Number(px[1]);
  const rem = /^([\d.]+)rem$/.exec(value);
  if (rem) return Number(rem[1]) * base;
  const em = /^([\d.]+)em$/.exec(value);
  if (em) return Number(em[1]) * base;
  return NaN;
};

const MOBILE = 390;

section('Every tool page declares a mobile viewport');

for (const tool of TOOLS) {
  const html = fs.readFileSync(path.join(root, `${tool}.html`), 'utf8');
  assert(/name="viewport"[^>]*width=device-width/.test(html), `${tool}.html sets width=device-width`);
}

section('No text field is small enough to make iOS zoom the page');

/* Safari on iOS zooms the viewport when a focused field computes below 16px, and
   does not zoom back out on blur. Every field a person types into has to clear
   that line on a phone. */
const FIELD_SELECTORS = [
  ['.pw-input', (s) => /\.pw-input(?![-\w])/.test(s)],
  ['.input', (s) => /(?:^|[,\s])\.input(?![-\w])/.test(s)],
  ['.form-field input', (s) => /\.form-field\s+input/.test(s)],
  ['.cli-field input', (s) => /\.cli-field\s+input/.test(s)],
  ['.academy-search input', (s) => /\.academy-search\s+input/.test(s)],
  ['.academy-filter select', (s) => /\.academy-filter\s+select/.test(s)],
  ['.academy-dialog .input', (s) => /\.academy-dialog\s+\.input(?![-\w])/.test(s)]
];

/* The model above is only faithful if the sheets really load in this order. */
const academyPage = fs.readFileSync(path.join(root, 'learning/cyber-security/cyber-security-track.html'), 'utf8');
const sheetOrder = [...academyPage.matchAll(/href="\/assets\/css\/([a-z]+\.css)"/g)].map((m) => m[1]);
assert(
  sheetOrder.indexOf('styles.css') !== -1 && sheetOrder.indexOf('styles.css') < sheetOrder.indexOf('learning.css'),
  `Academy pages load styles.css before learning.css (saw ${sheetOrder.join(', ')})`
);

for (const [label, test] of FIELD_SELECTORS) {
  const size = toPx(effective(test, 'font-size', MOBILE));
  assert(Number.isFinite(size) ? size >= 16 : true,
    `${label} is ${Number.isFinite(size) ? `${size}px` : 'unset'} at ${MOBILE}px wide (needs >= 16px)`);
}

section('Controls are big enough to hit');

const buttonHeight = (() => {
  const padding = valueOf(
    rules.filter((r) => /(?:^|,\s*)\.btn(?![-\w])/.test(r.selector) && mediaApplies(r.media.join(' and '), MOBILE))
      .map((r) => r.declarations).join(';'), 'padding');
  return toPx((padding || '').split(/\s+/)[0]);
})();
const buttonFont = toPx(effective((s) => /(?:^|,\s*)\.btn(?![-\w])/.test(s), 'font-size', MOBILE)) || 16;

const rangeHeight = toPx(effective((s) => /(?:^|[,\s])input\[type="range"\](?![^,]*thumb)/.test(s), 'height', MOBILE));
const thumbSize = toPx(effective((s) => /input\[type="range"\].*webkit-slider-thumb/.test(s), 'width', MOBILE));
const btnMin = toPx(effective((s) => /(?:^|,\s*)\.btn(?![\w-])/.test(s), 'min-height', MOBILE));
const btnHeight = Math.max(
  Number.isFinite(buttonHeight) ? buttonHeight * 2 + buttonFont : 0,
  Number.isFinite(btnMin) ? btnMin : 0
);

for (const [label, size] of [
  ['.icon-btn', toPx(effective((s) => /\.icon-btn/.test(s), 'width', MOBILE))],
  ['input[type="range"] track', rangeHeight],
  ['.btn', btnHeight]
]) {
  assert(!Number.isFinite(size) || size >= 44, `${label} is ${Number.isFinite(size) ? `${Math.round(size)}px` : 'unset'} (needs >= 44px on a touch screen)`);
}

/* The thumb itself can stay small - a 44px knob looks wrong - but it has to be
   big enough to aim at inside a track that is already 44px tall. */
assert(!Number.isFinite(thumbSize) || thumbSize >= 24,
  `range thumb is ${Number.isFinite(thumbSize) ? `${Math.round(thumbSize)}px` : 'unset'} (needs >= 24px inside a 44px track)`);

section('Nothing forces the page wider than the phone');

/* A literal min-width above the viewport is a horizontal scrollbar unless it sits
   inside an overflow container. The table-scroll wrapper is the one exception. */
const wideRules = rules.filter((r) => {
  if (!mediaApplies(r.media.join(' and '), MOBILE)) return false;
  const min = toPx(valueOf(r.declarations, 'min-width'));
  return Number.isFinite(min) && min > MOBILE && !/table-scroll|crack-table/.test(r.selector);
});
assert(wideRules.length === 0,
  wideRules.length ? `roles wider than the phone: ${wideRules.map((r) => r.selector).join(', ')}` : 'no rule forces a width above the viewport');

section('Every tool gives feedback where the result appears');

for (const tool of TOOLS) {
  const html = fs.readFileSync(path.join(root, `${tool}.html`), 'utf8');
  const hasLive = /aria-live=/.test(html) || /role="status"/.test(html) || /role="alert"/.test(html);
  assert(hasLive, `${tool} announces its result (aria-live or role=status)`);
}

section('Every input has a label');

for (const tool of TOOLS) {
  const html = fs.readFileSync(path.join(root, `${tool}.html`), 'utf8');
  const inputs = [...html.matchAll(/<(input|select|textarea)\b[^>]*>/g)].map((m) => m[0]);
  const unlabelled = inputs.filter((tag) => {
    if (/type="(hidden|checkbox|radio|range)"/.test(tag)) return false;
    if (/aria-label=/.test(tag) || /aria-labelledby=/.test(tag)) return false;
    const id = /id="([^"]+)"/.exec(tag);
    if (id && html.includes(`for="${id[1]}"`)) return false;
    return true;
  });
  assert(unlabelled.length === 0,
    unlabelled.length ? `${tool}: ${unlabelled.length} unlabelled field(s): ${unlabelled[0].slice(0, 70)}` : `${tool}: every field is labelled`);
}

section('The copy buttons say they copied');

for (const tool of ['generator', 'passphrase', 'hash-inspector']) {
  const js = fs.readFileSync(path.join(root, 'assets/js', tool === 'generator' ? 'generator.js' : `${tool}.js`), 'utf8');
  const feedback = /ompToast|Copied|copied|textContent\s*=/.test(js);
  assert(feedback, `${tool}: pressing copy gives visible confirmation`);
}

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
