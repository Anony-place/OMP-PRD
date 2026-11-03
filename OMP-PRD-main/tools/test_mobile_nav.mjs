#!/usr/bin/env node
/* ============================================================
   The mobile menu, driven the way a person drives it.

   On a phone this menu covers the entire page, so getting it wrong is not a
   cosmetic problem: without Escape, a keyboard user has to tab back through the
   whole menu to the toggle to get out; without moving focus, a screen reader
   announces the button and nothing else; and closing it by tapping a link used
   to leave the button labelled "Close menu" on a menu that was already shut.

   All three are invisible to a markup scan, so this loads a real page in jsdom,
   runs the real main.js, and drives the real events.

   Run: node tools/test_mobile_nav.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* jsdom lives in the QA dependency tree, and ESM ignores NODE_PATH, so it is
   resolved explicitly rather than hoped for. */
const { JSDOM, VirtualConsole } = await import(
  new URL('./qa-deps/node_modules/jsdom/lib/api.js', import.meta.url).href
);

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

/* Two header shapes ship on this site: the marketing header on most pages and
   the compact Academy bar on lesson pages. The menu must behave the same on
   both, so the whole suite runs against each. */
const PAGES = [
  { file: 'index.html', label: 'marketing page' },
  { file: 'learning/cyber-security/cyber-security-track/access-reviews-joiner-mover-leaver.html', label: 'Academy lesson' },
];

const mainJs = fs.readFileSync(path.join(root, 'assets/js/main.js'), 'utf8');
let currentPage = 'index.html';

function load(page) {
  if (page) currentPage = page;
  else page = currentPage;
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  /* Clicking a menu link is not a real navigation here, and jsdom says so on
     stderr. Swallow that one message so a failing assert stays the only noise. */
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (!/Not implemented: navigation/i.test(String(e && e.message))) console.error(e);
  });
  const dom = new JSDOM(html, {
    url: 'https://oopsmypassword.vercel.app/' + page.replace(/index\.html$/, ''),
    runScripts: 'outside-only',
    virtualConsole,
  });
  const { window } = dom;
  /* jsdom ships neither of these; main.js asks for them before doing anything. */
  window.matchMedia = window.matchMedia || function () {
    return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
  };
  window.eval(mainJs);

  const toggle = window.document.querySelector('[data-nav-toggle]');
  const menu = window.document.getElementById('mobile-menu');
  return { dom, window, document: window.document, toggle, menu };
}

function click(window, el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}
function press(window, key, opts = {}) {
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}

const isOpen = (menu) => menu.classList.contains('open');

/* ---------------------------------------------------------------- */

for (const page of PAGES) {
section(`A ${page.label}: the menu opens when the button is pressed`);
currentPage = page.file;

{
  const { window, document, toggle, menu } = load(currentPage);
  assert(!isOpen(menu), 'starts closed');
  assert(toggle.getAttribute('aria-label') === 'Open menu', 'the closed button says "Open menu"');
  assert(toggle.getAttribute('aria-expanded') === 'false', 'aria-expanded starts as false');

  click(window, toggle);

  assert(isOpen(menu), 'pressing the button opens the menu');
  assert(toggle.getAttribute('aria-expanded') === 'true', 'aria-expanded becomes true');
  assert(toggle.getAttribute('aria-label') === 'Close menu', 'the button now says "Close menu"');
  assert(document.body.classList.contains('nav-open'), 'the page behind is scroll-locked');
}

section('Keyboard focus moves into the menu, not nowhere');

{
  const { window, document, toggle, menu } = load(currentPage);
  click(window, toggle);
  const active = document.activeElement;
  assert(menu.contains(active), 'focus lands on the first item inside the menu');
  assert(active !== document.body, 'focus is not left on the page body');
  click(window, toggle);
  assert(document.activeElement === toggle, 'closing with the button returns focus to it');
}

section('Escape closes the menu and gives focus back');

{
  const { window, document, toggle, menu } = load(currentPage);
  click(window, toggle);
  assert(isOpen(menu), 'menu is open before Escape');

  press(window, 'Escape');

  assert(!isOpen(menu), 'Escape closes it');
  assert(toggle.getAttribute('aria-expanded') === 'false', 'aria-expanded goes back to false');
  assert(toggle.getAttribute('aria-label') === 'Open menu', 'the button says "Open menu" again');
  assert(!document.body.classList.contains('nav-open'), 'the page scroll lock is released');
  assert(document.activeElement === toggle, 'focus returns to the button, so the tab position is not lost');
}

section('Escape on a closed menu changes nothing');

{
  const { window, document, toggle, menu } = load(currentPage);
  press(window, 'Escape');
  assert(!isOpen(menu), 'the menu stays closed');
  assert(toggle.getAttribute('aria-expanded') === 'false', 'aria-expanded stays false');
}

section('Tapping a link closes it and resets the label');

{
  const { window, document, toggle, menu } = load(currentPage);
  click(window, toggle);
  const link = menu.querySelector('a[href]');
  assert(!!link, 'the menu has links to tap');

  click(window, link);

  assert(!isOpen(menu), 'tapping a link closes the menu');
  assert(toggle.getAttribute('aria-expanded') === 'false', 'aria-expanded is reset');
  /* The defect this test exists for: the menu shut but the button still said
     "Close menu", so the next screen-reader pass described the wrong control. */
  assert(toggle.getAttribute('aria-label') === 'Open menu',
    'the button no longer claims the menu is open');
  assert(!document.body.classList.contains('nav-open'), 'the page is scrollable again');
}

section('The button never describes a state the menu is not in');

{
  const { window, toggle, menu } = load();
  const states = [];
  const record = () => states.push([toggle.getAttribute('aria-label'), isOpen(menu)]);

  record();
  click(window, toggle); record();
  press(window, 'Escape'); record();
  click(window, toggle); record();
  click(window, menu.querySelector('a[href]')); record();
  click(window, toggle); click(window, toggle); record(); /* double-press */

  const wrong = states.filter(([label, open]) => label !== (open ? 'Close menu' : 'Open menu'));
  assert(wrong.length === 0, `label matches the real state in all ${states.length} states${wrong.length ? ` — saw ${JSON.stringify(wrong[0])}` : ''}`);
}

section('The scroll lock never outlives the menu');

{
  const { window, document, toggle, menu } = load(currentPage);
  const locked = () => document.body.classList.contains('nav-open');

  click(window, toggle);
  const whileOpen = locked();
  press(window, 'Escape');
  const afterEscape = locked();

  click(window, toggle);
  click(window, menu.querySelector('a[href]'));
  const afterLink = locked();

  assert(whileOpen && !afterEscape && !afterLink, 'opening locks the page and every close path unlocks it');
  assert(isOpen(menu) === false, 'no path leaves the menu marked open');
}

} /* header shapes */

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
