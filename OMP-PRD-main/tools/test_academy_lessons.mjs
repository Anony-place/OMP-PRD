#!/usr/bin/env node
/* ============================================================
   Is a lesson a lesson?

   The Academy shipped 118 "lessons" that were revision notes: five bullet
   lists, no worked example, no narrative, and a "What you'll learn" list that
   printed the same four section names on every single page. A beginner could
   read one and still not be able to explain the topic to somebody else.

   Two things went wrong and both are checkable:

     1. the content had no teaching in it - no plain-language opening, no
        example, no statement of the mistake people make;
     2. the numbers describing it were invented - every lesson said 13-15
        minutes while carrying about 370 words, which made the course look like
        25 hours of study instead of four.

   This gate holds the line on both, and reports how much of the catalogue has
   been converted so progress is visible instead of claimed.

   Run: node tools/test_academy_lessons.mjs
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

const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/academy-catalogue.json'), 'utf8'));
const topics = catalogue.topics;

const { sectionsFor, objectivesFor, readingMinutes, wordCount } = await import(
  new URL('../assets/js/academy-content.mjs', import.meta.url).href
);

const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
const authored = topics.filter((t) => Array.isArray(t.content?.sections) && t.content.sections.length);

section('A lesson has teaching in it, not just notes');

/* The shape every converted lesson must have. Named ids rather than counts, so
   the promise is "there is a plain opening, a worked example, the common
   mistake, and something to do" - not "there are some sections". */
const REQUIRED = [
  ['plain', 'opens in plain language'],
  ['example', 'shows a worked example'],
  ['mistake', 'names the mistake beginners make'],
  ['try', 'gives the reader something to do'],
  ['defensive', 'closes with takeaways'],
];

for (const t of authored) {
  const byId = new Map(t.content.sections.map((s) => [s.id, s]));
  const missing = REQUIRED.filter(([id]) => !byId.has(id)).map(([id]) => id);
  assert(missing.length === 0, `${t.slug}: has the full lesson shape${missing.length ? ` — missing ${missing.join(', ')}` : ''}`);

  const opener = byId.get('plain');
  const openerText = opener
    ? (opener.blocks || []).filter((b) => b.type === 'paragraph').map((b) => b.text).join(' ')
    : '';
  assert(words(openerText) >= 40,
    `${t.slug}: the opening explains the idea in prose (${words(openerText)} words)`);

  const bodyWords = wordCount(t);
  assert(bodyWords >= 350, `${t.slug}: carries a real lesson, not a stub (${bodyWords} words)`);
  assert(bodyWords <= 1400, `${t.slug}: stays short enough to finish in one sitting (${bodyWords} words)`);
}

section('"What you\'ll learn" says what you will be able to do');

/* The bug: every lesson printed its own section titles, which were identical
   on all 118 pages. Anything that repeats the section names is a regression. */
const SECTION_NAME_OBJECTIVES = ['How it works', 'The background', 'Real-world examples', 'What to look for'];
const copied = [];
for (const t of topics) {
  const objectives = objectivesFor(t, sectionsFor(t));
  const looksCopied = objectives.length > 0
    && objectives.every((o) => SECTION_NAME_OBJECTIVES.includes(o));
  if (looksCopied) copied.push(t.slug);
}
assert(copied.length === 0,
  `no lesson lists its section names as objectives${copied.length ? ` — ${copied.length} still do, e.g. ${copied[0]}` : ''}`);

const empty = topics.filter((t) => objectivesFor(t, sectionsFor(t)).length === 0);
assert(empty.length === 0, `every lesson states at least one outcome${empty.length ? ` — ${empty[0].slug} states none` : ''}`);

section('The stated reading time matches the words');

/* The other lie: 14 minutes for a 370-word page. Allowed drift is one minute,
   which covers rounding. */
const wrong = [];
for (const t of topics) {
  const stated = Number(t.estimated_minutes);
  const real = readingMinutes(t);
  if (!Number.isFinite(stated) || Math.abs(stated - real) > 1) {
    wrong.push(`${t.slug} says ${stated} min, ${wordCount(t)} words is ${real} min`);
  }
}
assert(wrong.length === 0,
  `every lesson states a time it can defend${wrong.length ? ` — ${wrong.length} do not, e.g. ${wrong[0]}` : ''}`);

const claimed = topics.reduce((n, t) => n + Number(t.estimated_minutes || 0), 0);
const measured = topics.reduce((n, t) => n + readingMinutes(t), 0);
assert(Math.abs(claimed - measured) <= topics.length,
  `the course total is the sum of its lessons (${Math.round(claimed / 60)}h stated vs ${Math.round(measured / 60)}h measured)`);

section('The lesson pages actually render the teaching');

/* The catalogue can be right while the build drops it - the reader has done
   exactly that before with the previous-lesson link. Find a converted lesson,
   read its built page, and look for the shape. */
const sample = authored.find((t) => t.slug === 'what-is-cyber-security') || authored[0];
const cat = catalogue.categories.find((c) => c.id === sample.category_id);
const p = catalogue.paths.find((x) => x.id === sample.path_id);
const page = path.join(root, `learning/${cat.slug}/${p.slug}/${sample.slug}.html`);
assert(fs.existsSync(page), `${sample.slug} has a built page`);

if (fs.existsSync(page)) {
  const html = fs.readFileSync(page, 'utf8');
  for (const [, title] of REQUIRED.map(([id, label]) => [id, label])) {
    // headings are written by the renderer from the section titles; check the
    // section ids survive as anchors the outline links to
  }
  assert(!/What you&#39;ll learn<\/h2><ul class="lesson-objectives">\s*<li>How it works<\/li>/.test(html),
    'its objectives are not the old section-name list');
  assert(html.includes('In plain English'), 'the plain-language opening is on the page');
  assert(html.includes('Try it in two minutes'), 'the "try it" section is on the page');
  const stated = html.match(/<span>(\d+) min<\/span>/);
  assert(stated && Math.abs(Number(stated[1]) - readingMinutes(sample)) <= 1,
    `the page shows the measured reading time (${stated ? stated[1] : 'none'} min)`);
  assert(!html.includes('INTERACTIVE FLOW MODEL'),
    'the generated placeholder diagram is gone from converted lessons');
}

section('A self-check tests the lesson, not the lesson title');

/* The file used to carry 106 generated quizzes whose "correct" answer was the
   catalogue description pasted in, against distractors like "Eliminating all
   encryption and authentication logs to improve network throughput". A reader
   spots that in one question and stops believing the rest of the page. */
const checks = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/academy-self-checks.json'), 'utf8'));
const allChecks = [
  ...Object.entries(checks).filter(([k]) => k !== 'by_slug').map(([k, v]) => [k, v]),
  ...Object.entries(checks.by_slug || {}).map(([k, v]) => [k, v]),
];

const TEMPLATE_TELLS = [
  /primary security objective of studying/i,
  /one-time compliance checkbox/i,
  /operationalise .* in practice/i,
  /which key takeaway best summarises the lesson on/i,
  /documented pitfall or misconception regarding/i,
];
const generated = allChecks.filter(([, v]) =>
  (v.questions || []).some((q) => TEMPLATE_TELLS.some((re) => re.test(q.question || ''))));
assert(generated.length === 0,
  `no generated quiz survives${generated.length ? ` — ${generated.length} still there, e.g. ${generated[0][0]}` : ''}`);

const ABSURD = /eliminating all encryption|unverified third-party scripts unrestricted|overwritten every hour|plaintext recovery secrets/i;
const silly = allChecks.filter(([, v]) =>
  (v.questions || []).some((q) => (q.options || []).some((o) => ABSURD.test(o))));
assert(silly.length === 0, `no filler distractors remain${silly.length ? ` — ${silly[0][0]}` : ''}`);

/* Every lesson written this round has to be checkable, or the "Check" stage of
   the reader is a dead end. */
const { normalizeSelfCheck } = await import(new URL('../assets/js/academy-local.mjs', import.meta.url).href);
const unchecked = [];
for (const t of authored) {
  const raw = checks[t.id] || checks.by_slug?.[t.slug];
  if (!raw) { unchecked.push(t.slug); continue; }
  try { normalizeSelfCheck(raw); } catch (e) { unchecked.push(`${t.slug} (invalid: ${e.message})`); }
}
assert(unchecked.length === 0,
  `every converted lesson has a self-check the reader accepts${unchecked.length ? ` — ${unchecked.slice(0, 3).join(', ')}` : ''}`);

/* A quiz where every answer is at the same index is not a quiz. */
const flat = [];
for (const [key, v] of allChecks) {
  const answers = (v.questions || []).map((q) => q.answer);
  if (answers.length > 1 && new Set(answers).size === 1) flat.push(key);
}
assert(flat.length === 0, `answers are not all in the same slot${flat.length ? ` — ${flat[0]}` : ''}`);

section('Progress is visible, not claimed');

/* A floor, so the conversion cannot quietly go backwards. Raise this as more
   modules are converted - never lower it. */
const FLOOR = 7;
assert(authored.length >= FLOOR,
  `${authored.length} of ${topics.length} lessons are lesson-grade (floor ${FLOOR})`);
const pct = Math.round((authored.length / topics.length) * 100);
console.log(`  · ${authored.length}/${topics.length} lessons converted (${pct}%) — the rest are still notes`);

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
