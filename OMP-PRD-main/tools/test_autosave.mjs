#!/usr/bin/env node
/* ============================================================
   Autosave, in a real DOM with a real localStorage (jsdom).

   Autosave is the kind of feature that is invisible when it works and
   devastating when it is subtly wrong - a draft from last week silently
   replacing today's article is worse than having no autosave at all. These are
   the rules that keep it a rescue instead of a downgrade.

   Run: node tools/test_autosave.mjs
   Requires: npm ci --prefix tools/qa-deps --ignore-scripts
   ============================================================ */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(ROOT, 'tools/qa-deps/'));
const { JSDOM } = require_('jsdom');

/* Node warns that a .js file with ESM syntax has no "type": "module". The site
   ships no bundler and the file has to stay a .js for the browser, so the
   warning is expected and only noise here. */
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(warning);
});

const dom = new JSDOM('<!doctype html><body><div id="host"></div></body>', { url: 'https://oopsmypassword.web.app/Anony.su/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const mod = await import(pathToFileURL(path.join(ROOT, 'assets/js/admin/autosave.js')).href);
const { draftKey, saveDraft, loadDraft, clearDraft, pruneDrafts, renderOffer, installAutosave, ago } = mod;

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

section('Keys');
assert(draftKey('article', 'abc') === 'omp-draft:article:abc', 'a draft is keyed per article');
assert(draftKey('article', null) === 'omp-draft:article:new', 'a new article has its own key, so two empty forms do not collide');

section('Save and load');
localStorage.clear();
saveDraft('k1', { title: 'Hello', content: 'body' }, 1000);
const loaded = loadDraft('k1', 2000);
assert(loaded.data.title === 'Hello' && loaded.data.content === 'body', 'the fields come back as they went in');
assert(loaded.savedAt === 1000, 'with the time they were saved');

section('A draft cannot live for ever');
const week = 7 * 24 * 60 * 60 * 1000;
assert(loadDraft('k1', 1000 + week + 1) === null, 'a draft older than a week is not offered');
assert(localStorage.getItem('k1') === null, 'and it is removed rather than left to rot');

section('Broken storage is not a crash');
localStorage.setItem('bad', '{not json');
assert(loadDraft('bad') === null, 'unparseable JSON is dropped');
localStorage.setItem('empty', JSON.stringify({ savedAt: 1 }));
assert(loadDraft('empty') === null, 'a draft with no data is dropped');

const big = { content: 'x'.repeat(600 * 1024) };
assert(saveDraft('huge', big) === false, 'a draft over the size limit is refused, not truncated');
assert(localStorage.getItem('huge') === null, 'and nothing is written');

section('Pruning is bounded to our own keys');
localStorage.clear();
saveDraft('omp-draft:article:a', { content: 'old' }, 1000);
saveDraft('omp-draft:article:b', { content: 'fresh' }, Date.now());
localStorage.setItem('supabase-auth', 'not ours');
pruneDrafts(Date.now());
assert(loadDraft('omp-draft:article:b') !== null, 'the fresh draft survives');
assert(loadDraft('omp-draft:article:a') === null, 'the stale one is gone');
assert(localStorage.getItem('supabase-auth') === 'not ours', 'and nothing outside the draft prefix is touched');

section('The offer');
const bar = renderOffer(document, { savedAt: Date.now() - 90 * 1000, onRestore() {}, onDiscard() {} });
assert(/Unsaved work from 2 minutes ago/.test(bar.textContent), 'the offer says how old the work is');
assert(bar.querySelectorAll('button').length === 2, 'with exactly two choices');

section('Install: an offer only when the draft is newer than the saved article');
const buildForm = () => {
  document.body.innerHTML = '<div id="host"><form id="f"><input id="t"><textarea id="c"></textarea></form></div>';
  return document.querySelector('#f');
};

localStorage.clear();
saveDraft('omp-draft:article:x', { title: 'Old draft' }, Date.now() - 60 * 60 * 1000);
let form = buildForm();
let autosave = installAutosave({
  form, key: 'omp-draft:article:x',
  read: () => ({ title: form.querySelector('#t').value, content: form.querySelector('#c').value }),
  apply: (data) => { form.querySelector('#t').value = data.title; form.querySelector('#c').value = data.content; },
  /* saved to the database a minute ago, after the draft was written */
  savedAt: new Date(Date.now() - 60 * 1000).toISOString()
});
assert(autosave.hadOffer === false, 'a draft older than the saved row is not offered');
assert(localStorage.getItem('omp-draft:article:x') === null, 'and it is cleared, so it cannot resurface later');
autosave.stop();

localStorage.clear();
saveDraft('omp-draft:article:y', { title: 'Newer draft', content: 'half written' }, Date.now());
form = buildForm();
autosave = installAutosave({
  form, key: 'omp-draft:article:y',
  read: () => ({ title: form.querySelector('#t').value, content: form.querySelector('#c').value }),
  apply: (data) => { form.querySelector('#t').value = data.title; form.querySelector('#c').value = data.content; },
  savedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
});
assert(autosave.hadOffer === true, 'a draft newer than the saved row is offered');
const offer = document.querySelector('.admin-draft-offer');
assert(Boolean(offer), 'the offer is in the page, above the form');
const [restoreButton] = offer.querySelectorAll('button');
restoreButton.click();
assert(form.querySelector('#t').value === 'Newer draft', 'restoring fills the fields');
assert(form.querySelector('#c').value === 'half written', 'including the body');
assert(!document.querySelector('.admin-draft-offer'), 'and the offer goes away');
autosave.stop();

section('Typing is saved without a save button');
localStorage.clear();
form = buildForm();
autosave = installAutosave({
  form, key: 'omp-draft:article:z', debounceMs: 10,
  read: () => ({ content: form.querySelector('#c').value }),
  savedAt: null
});
form.querySelector('#c').value = 'a paragraph typed but not saved';
form.querySelector('#c').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
assert(loadDraft('omp-draft:article:z') === null, 'the first keystroke alone does not write');
await tick(40);
assert(loadDraft('omp-draft:article:z')?.data.content === 'a paragraph typed but not saved', 'the debounced write lands');

section('A real save clears it');
autosave.clear();
assert(loadDraft('omp-draft:article:z') === null, 'after saving, nothing is left to restore');
form.querySelector('#c').value = 'typed after the save';
form.querySelector('#c').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
await tick(40);
assert(loadDraft('omp-draft:article:z') !== null, 'and writing again starts a new draft');
autosave.stop();

section('Human time');
assert(ago(Date.now() - 5000) === 'just now', 'seconds read as "just now"');
assert(ago(Date.now() - 90 * 1000) === '2 minutes ago', 'minutes read as minutes');
assert(ago(Date.now() - 3 * 3600 * 1000) === '3 hours ago', 'hours read as hours');

localStorage.clear();
console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
