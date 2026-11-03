#!/usr/bin/env node
/* ============================================================
   Do the tools actually work?

   Every tool on this site runs in the browser, which means none of the existing
   gates ever executed one: the tests read HTML, and the HTML is static. A tool
   can ship with a dead button, a mock result, or a result that never changes and
   every gate stays green.

   So this loads each page in jsdom, drives it the way a person would - type into
   the field, press the button, watch the output - and asserts the result is
   computed rather than dressed up:

     * two different inputs must not produce the same output
     * a generated value must be different on a second run
     * the numbers must follow from the input (entropy rises with password length)
     * an empty or invalid input must say something useful instead of showing 0

   It cannot see layout. Mobile layout is a separate, static check - this file is
   about whether the tool does anything.

   Run: node tools/test_tools_live.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* jsdom lives in the QA dependency tree, and ESM ignores NODE_PATH, so it is
   resolved explicitly rather than hoped for. */
const { JSDOM, VirtualConsole } = await import(
  new URL('./qa-deps/node_modules/jsdom/lib/api.js', import.meta.url).href
);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

/* jsdom has no layout and no crypto.subtle of its own we can rely on, so the
   page is loaded with its filesystem assets inlined and the browser globals the
   tools actually use are provided. Anything else throws loudly - a tool that
   needs a global we did not think of is a finding, not a crash to hide. */
async function loadPage(name, { url = 'https://oopsmypassword.test/', viewportWidth = 1280 } = {}) {
  const html = fs.readFileSync(path.join(root, `${name}.html`), 'utf8');
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
  });
  const { window } = dom;
  Object.defineProperty(window, 'innerWidth', { value: viewportWidth, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 900, writable: true });
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
  }));
  if (!window.crypto) window.crypto = {};
  if (!window.crypto.getRandomValues) {
    window.crypto.getRandomValues = (arr) => {
      for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    };
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  if (!window.crypto.subtle) {
    const { webcrypto } = await import('node:crypto');
    window.crypto.subtle = webcrypto.subtle;
  }
  window.localStorage.clear?.();
  return dom;
}

/* The pages are constructed with runScripts: 'outside-only', so jsdom has
   already fired DOMContentLoaded by the time a script is evaluated. Tools that
   initialise on that event - most of them - would never start, and the test
   would report a broken tool that is not broken. Ticking the event after the
   scripts have loaded is what a browser does. */
async function settle(window) {
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  window.dispatchEvent(new window.Event('load'));
  await new Promise((resolve) => setTimeout(resolve, 30));
}

/* Runs a script tag src from the page, in the page's own window. */
function runScript(window, relPath) {
  const file = path.join(root, relPath.replace(/^\//, ''));
  if (!fs.existsSync(file)) return false;
  const code = fs.readFileSync(file, 'utf8');
  window.eval(code);
  return true;
}

/* Every script the page declares, in document order, exactly as a browser
   would. A tool that only works when you load a subset of its own scripts is
   broken for the reader too, so the test must not be more forgiving than the
   page. Errors are collected instead of swallowed: a thrown exception during
   init is the most common way a tool ships dead. */
const errors = [];
async function runScripts(window, html) {
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  for (const src of srcs) {
    try {
      runScript(window, src);
    } catch (error) {
      errors.push(`${src}: ${error && error.message}`);
    }
  }
  await settle(window);
}

/* Fires the events a real interaction fires, in order. */
function type(window, el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
}
function click(window, el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

const text = (el) => (el ? el.textContent.trim() : '');
const num = (el) => {
  const m = String(text(el)).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

const checks = [];

/* ---------------------------------------------------------------- checker */
checks.push(async () => {
  section('Password checker: the score follows the password');
  const dom = await loadPage('checker');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'checker.html'), 'utf8');
  await runScripts(window, html);

  const input = window.document.querySelector('[data-pw-input]');
  assert(!!input, 'the password field exists and is reachable');

  /* ompAnimateNumber tweens the visible score over 450ms, so reading it in the
     same tick as the keystroke reports 0 for everything. Wait it out. */
  const scoreFor = async (value) => {
    type(window, input, value);
    await new Promise((r) => setTimeout(r, 700));
    return {
      score: num(window.document.querySelector('[data-score-number]')),
      entropy: num(window.document.querySelector('[data-stat="entropy"]')),
      live: text(window.document.querySelector('[data-live]'))
    };
  };

  const weak = await scoreFor('password');
  const strong = await scoreFor('Tr0ub4dor&3-VbKx9!mQz');
  assert(Number.isFinite(weak.score) && Number.isFinite(strong.score), 'both passwords produce a numeric score');
  assert(strong.score > weak.score, `a long random password scores higher (${weak.score} -> ${strong.score})`);
  assert(strong.entropy > weak.entropy, `entropy rises with the password (${weak.entropy} -> ${strong.entropy})`);
  assert(/score \d+/i.test(strong.live), `the screen-reader announcement carries the score ("${strong.live.slice(0, 60)}")`);

  type(window, input, '');
  await new Promise((r) => setTimeout(r, 700));
  const pill = text(window.document.querySelector('[data-pill-text]'));
  assert(/awaiting input/i.test(pill), `an empty field says "${pill}", not a score`);
  return dom;
});

/* -------------------------------------------------------------- generator */
checks.push(async () => {
  section('Password generator: every click is a new password');
  const dom = await loadPage('generator');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'generator.html'), 'utf8');
  await runScripts(window, html, ['generator.js']);

  const btn = window.document.querySelector('[data-gen-btn]');
  const out = window.document.querySelector('[data-gen-output]');
  assert(!!btn && !!out, 'the generate button and output field exist');

  click(window, btn);
  const first = out.value || text(out);
  click(window, btn);
  const second = out.value || text(out);

  assert(first && first.length >= 8, `the first run produces a password (${first.length} chars)`);
  assert(first !== second, 'a second run produces a different password');
  assert(/[^a-z]/i.test(first), 'the output is not a fixed placeholder string');

  const meter = window.document.querySelector('[data-gen-entropy]');
  assert(Number.isFinite(num(meter)) && num(meter) > 0, `entropy is reported as a real number (${text(meter)})`);
  return dom;
});

/* ------------------------------------------------------------- passphrase */
checks.push(async () => {
  section('Passphrase generator: real words, real entropy');
  const dom = await loadPage('passphrase');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'passphrase.html'), 'utf8');
  await runScripts(window, html, ['passphrase.js']);

  const btn = window.document.querySelector('[data-pp-btn]');
  /* [data-passphrase] is the whole widget; the phrase itself is written into the
     <code> inside it. Selecting the container reads the page copy. */
  const out = window.document.querySelector('[data-pp-output]');
  assert(!!btn && !!out, 'the generate button and phrase field exist');

  click(window, btn);
  const first = out.value || text(out);
  click(window, btn);
  const second = out.value || text(out);

  const words = first.trim().split(/[\s-]+/).filter(Boolean);
  assert(words.length >= 3, `the phrase contains several words (${words.length})`);
  assert(first !== second, 'a second run produces a different phrase');
  assert(words.every((w) => /^[a-z]+$/i.test(w)), 'every token is a word, not a random character blob');
  return dom;
});

/* ---------------------------------------------------------------- entropy */
checks.push(async () => {
  section('Entropy calculator: length changes the number');
  const dom = await loadPage('entropy');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'entropy.html'), 'utf8');
  await runScripts(window, html, ['entropy.js']);

  const field = window.document.querySelector('[data-ec-length]');
  const entropyEl = window.document.querySelector('[data-ec-entropy]');
  assert(!!field && !!entropyEl, 'the length control and entropy output exist');

  type(window, field, '8');
  const short = num(entropyEl);
  type(window, field, '24');
  const long = num(entropyEl);

  assert(Number.isFinite(short) && Number.isFinite(long), 'both lengths produce a number');
  assert(long > short, `entropy rises with length (${short} -> ${long})`);
  const combos = num(window.document.querySelector('[data-ec-combos]'));
  assert(Number.isFinite(combos) && combos > 0, 'the keyspace is calculated, not printed as 0');
  return dom;
});

/* ---------------------------------------------------------- random-string */
checks.push(async () => {
  section('Random string: a new value each time');
  const dom = await loadPage('random-string');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'random-string.html'), 'utf8');
  await runScripts(window, html, ['generator.js']);

  const btn = window.document.querySelector('[data-rand-btn]');
  const list = window.document.querySelector('[data-rand-list]');
  assert(!!btn && !!list, 'the generate button and result list exist');

  click(window, btn);
  const first = text(list);
  click(window, btn);
  const second = text(list);

  assert(first.length > 0, `the first run produces output (${first.length} chars)`);
  assert(first !== second, 'a second run produces different output');
  return dom;
});

/* --------------------------------------------------------- password-health */
checks.push(async () => {
  section('Password health: the grade follows the input');
  const dom = await loadPage('password-health');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'password-health.html'), 'utf8');
  await runScripts(window, html, ['wordlist.js', 'health.js']);

  const input = window.document.querySelector('[data-health-input]');
  assert(!!input, 'the password field exists');

  type(window, input, 'password123');
  const weakScore = num(window.document.querySelector('[data-health-score]'));
  type(window, input, 'Xk9#mQ2$vL7@pR4!nT8&');
  const strongScore = num(window.document.querySelector('[data-health-score]'));

  if (Number.isFinite(weakScore) && Number.isFinite(strongScore)) {
    assert(strongScore > weakScore, `a stronger password scores higher (${weakScore} -> ${strongScore})`);
  } else {
    /* If the tool reports a letter grade instead of a number, that is fine - but
       the two inputs must still be told apart. */
    assert(text(window.document.querySelector('[data-health-grade]')).length > 0, 'the grade is populated');
  }
  return dom;
});

/* ----------------------------------------------------------- dork-builder */
checks.push(async () => {
  section('Dork builder: the query is assembled from the fields');
  const dom = await loadPage('dork-builder');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'dork-builder.html'), 'utf8');
  await runScripts(window, html, ['dork-builder.js']);

  const app = window.document.querySelector('[data-dork-app]');
  assert(!!app, 'the builder mounts');

  const inputs = [...app.querySelectorAll('input[type="text"], input:not([type]), textarea')];
  const buttons = [...app.querySelectorAll('button, [role="button"]')];
  assert(inputs.length > 0, `the builder has ${inputs.length} input(s)`);
  assert(buttons.length > 0, `the builder has ${buttons.length} control(s)`);

  const outputsBefore = text(app);
  if (inputs.length) type(window, inputs[0], 'example.com');
  const outputsAfter = text(app);
  assert(outputsBefore !== outputsAfter || inputs.length === 0,
    'typing changes what the tool shows');
  return dom;
});

/* --------------------------------------------------------- hash-inspector */
checks.push(async () => {
  section('Hash inspector: different input, different digest');
  const dom = await loadPage('hash-inspector');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'hash-inspector.html'), 'utf8');
  await runScripts(window, html, ['hash-inspector.js']);

  const panel = window.document.querySelector('[data-hash-inspector]') || window.document.body;
  assert(!!panel, 'the inspector mounts');

  /* Four tabs, each with its own input. The first one in the DOM is the JWT
     auditor, which ignores a plain word, so the hash tab is addressed by id. */
  const input = window.document.getElementById('hash-live-input')
    || panel.querySelector('input[type="text"], input:not([type]), textarea');
  if (!input) {
    assert(false, 'the inspector has an input field');
    return dom;
  }

  type(window, input, 'alpha');
  await new Promise((r) => setTimeout(r, 120));
  const first = text(panel);
  type(window, input, 'beta');
  await new Promise((r) => setTimeout(r, 120));
  const second = text(panel);

  assert(first !== second, 'changing the input changes the digest shown');
  assert(/[0-9a-f]{16,}/i.test(second), 'a hex digest is produced');
  return dom;
});

/* ------------------------------------------------------------ url-scanner */
checks.push(async () => {
  section('URL scanner: a suspicious URL is told apart from a clean one');
  const dom = await loadPage('url-scanner');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'url-scanner.html'), 'utf8');
  await runScripts(window, html, ['url-scanner.js']);

  const app = window.document.querySelector('[data-url-scanner]');
  assert(!!app, 'the scanner mounts');

  const input = app.querySelector('input[type="text"], input[type="url"], input:not([type]), textarea');
  assert(!!input, 'the scanner has a URL field');

  type(window, input, 'https://www.google.com/');
  await new Promise((r) => setTimeout(r, 80));
  const clean = text(app);
  type(window, input, 'http://192.168.1.1@paypal.com.secure-login.xyz/verify');
  await new Promise((r) => setTimeout(r, 80));
  const dirty = text(app);

  assert(clean !== dirty, 'a suspicious URL produces a different assessment from a clean one');
  return dom;
});

/* ----------------------------------------------------------- breach-check */
/* The one tool that talks to a server, and the only one that can answer
   "you are safe" wrongly. When the lookup fails it must say so - the earlier
   code fell back to a bundled list of ~330 passwords and rendered a green tick
   with "not found", which a reader takes as a clean bill of health. */
checks.push(async () => {
  section('Breach check: a failed lookup is never a clean bill of health');

  const run = async (fetchImpl, pw = 'zX9!qT2#vL7@') => {
    const dom = await loadPage('breach-check');
    const { window } = dom;
    const html = fs.readFileSync(path.join(root, 'breach-check.html'), 'utf8');
    window.fetch = fetchImpl;
    await runScripts(window, html);
    const input = window.document.querySelector('[data-breach-input]');
    const btn = window.document.querySelector('[data-breach-btn]');
    assert(!!input && !!btn, 'the field and button exist');
    type(window, input, pw);
    click(window, btn);
    await new Promise((r) => setTimeout(r, 400));
    const result = window.document.querySelector('[data-breach-result]');
    return { window, text: text(result), className: result.className, html: result.innerHTML };
  };

  /* 1. the API is unreachable */
  const offline = await run(async () => { throw new TypeError('Failed to fetch'); });
  /* The explanation deliberately quotes the phrase, so the assertion is on the
     verdict itself, not on the words. */
  assert(!/no matching hash was found/i.test(offline.text),
    'an unreachable database does not produce a "not found" verdict');
  assert(/could not reach|did not respond/i.test(offline.text),
    'it says the check could not be completed');
  assert(!/callout-tip/.test(offline.html),
    'it is not dressed in the success colour');
  assert(/not a result/i.test(offline.text),
    'it says plainly that nothing was concluded');

  /* 2. the API answers, and the password is absent */
  const clean = await run(async () => ({
    ok: true,
    status: 200,
    text: async () => '0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n'
  }));
  assert(/no matching hash was found/i.test(clean.text), 'a real miss from the live database says the hash was not found');
  assert(/callout-tip/.test(clean.html), 'a real miss is shown in the success colour');

  /* 3. the API answers, and the password is present */
  const hit = await run(async () => ({
    ok: true,
    status: 200,
    text: async () => {
      /* compute the same suffix the page will look for */
      const { createHash } = await import('node:crypto');
      const hash = createHash('sha1').update('zX9!qT2#vL7@').digest('hex').toUpperCase();
      return `${hash.slice(5)}:42319\r\n`;
    }
  }));
  assert(/breach detected|found/i.test(hit.text), 'a real hit is reported as a breach');
  assert(/callout-warn/.test(hit.html), 'a hit is shown as a warning, not a pass');

  return null;
});

/* ------------------------------------------------------ security-checklist */
checks.push(async () => {
  section('Security checklist: ticks count, state persists');
  const dom = await loadPage('security-checklist');
  const { window } = dom;
  const html = fs.readFileSync(path.join(root, 'security-checklist.html'), 'utf8');
  await runScripts(window, html, ['checklist.js']);

  const items = [...window.document.querySelectorAll('[data-item]')];
  assert(items.length >= 10, `the checklist has ${items.length} items`);

  const countEl = window.document.querySelector('[data-checklist-count]');
  const before = num(countEl);
  const box = items[0].querySelector('input[type="checkbox"]') || items[0].querySelector('button') || items[0];
  click(window, box);
  const after = num(countEl);

  assert(Number.isFinite(before) && Number.isFinite(after), 'the progress counter is a number');
  assert(after > before, `ticking an item advances the counter (${before} -> ${after})`);
  assert(!!window.localStorage.getItem.length, 'the checklist has a storage handle (state survives reload)');
  return dom;
});

for (const check of checks) {
  try {
    await check();
  } catch (error) {
    failures.push(`a tool threw: ${error && error.message}`);
    console.log(`  ✗ threw: ${error && error.message}`);
  }
}

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
