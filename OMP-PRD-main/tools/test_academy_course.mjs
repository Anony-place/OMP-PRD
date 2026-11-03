#!/usr/bin/env node
/* ============================================================
   Is the Academy a course, or a pile of pages?

   A course has an order and a way back. The lessons already said "LESSON 7 OF
   106" and offered the next one, but there was no link to the previous lesson
   anywhere — so a learner who arrived on lesson 40 from search had to return to
   the syllabus and find lesson 39 by hand.

   This gate walks every course, lesson by lesson, following the links in the
   built HTML. If a lesson is unreachable from the one before it, the chain is
   broken and it fails.

   Run: node tools/test_academy_course.mjs
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
const topics = new Map(catalogue.topics.map((t) => [t.id, t]));
const modules = new Map(catalogue.modules.map((m) => [m.id, m]));
const categories = new Map(catalogue.categories.map((c) => [c.id, c]));

/** The lessons of a course, in the order the course page presents them. */
function courseLessons(p) {
  return catalogue.topics
    .filter((t) => t.path_id === p.id)
    .sort((a, b) =>
      (modules.get(a.module_id)?.sort_order ?? 0) - (modules.get(b.module_id)?.sort_order ?? 0)
      || (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

const urlOf = (p, t) => `/learning/${categories.get(p.category_id).slug}/${p.slug}/${t.slug}`;
const fileOf = (u) => path.join(root, `${u.replace(/^\//, '')}.html`);

section('Every course has an ordered chain of lessons');

const courses = catalogue.paths.map((p) => ({ path: p, lessons: courseLessons(p) }));
assert(courses.length > 0, `${courses.length} course${courses.length === 1 ? '' : 's'} to check`);
assert(courses.every((c) => c.lessons.length > 0), 'every course has at least one lesson');

for (const { path: p, lessons } of courses) {
  const label = `${p.name} (${lessons.length} lessons)`;

  const missing = lessons.filter((t) => !fs.existsSync(fileOf(urlOf(p, t))));
  assert(missing.length === 0, `${label}: every lesson page exists${missing.length ? ` — missing ${missing[0].slug}` : ''}`);

  /* First lesson: nothing before it. Everything else: exactly one way back. */
  const first = lessons[0];
  const firstHtml = fs.readFileSync(fileOf(urlOf(p, first)), 'utf8');
  assert(!/class="lesson-prev"/.test(firstHtml), `${label}: the first lesson offers no "previous"`);

  const wrong = [];
  for (let i = 1; i < lessons.length; i += 1) {
    const html = fs.readFileSync(fileOf(urlOf(p, lessons[i])), 'utf8');
    const m = html.match(/class="lesson-prev" href="([^"]+)"/);
    const want = urlOf(p, lessons[i - 1]);
    if (!m) wrong.push(`no link on ${lessons[i].slug}`);
    else if (m[1] !== want) wrong.push(`${lessons[i].slug} -> ${m[1]} (expected ${want})`);
  }
  assert(wrong.length === 0,
    `${label}: every lesson links to the one before it${wrong.length ? ` — ${wrong.slice(0, 3).join('; ')}` : ''}`);

  /* Walk the whole course from lesson 1 using only the links on the pages. */
  let current = first;
  const visited = [];
  const guard = new Set();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    visited.push(current.id);
    const html = fs.readFileSync(fileOf(urlOf(p, current)), 'utf8');
    const m = html.match(/class="lesson-next"[^>]*>(?:(?!class="lesson-next").)*?<a class="btn btn-primary" href="([^"]+)"/s);
    if (!m) break;
    current = lessons.find((t) => urlOf(p, t) === m[1]) || null;
  }
  assert(visited.length === lessons.length,
    `${label}: "Next lesson" walks the whole course and stops at the end (${visited.length}/${lessons.length})`);

  const last = lessons[lessons.length - 1];
  const lastHtml = fs.readFileSync(fileOf(urlOf(p, last)), 'utf8');
  assert(/COURSE COMPLETE/.test(lastHtml), `${label}: the last lesson says the course is complete`);
}

section('The Academy states only what it can deliver');

/* The hub used to promise "a 4-question self-check on every lesson" and "on all
   118 lessons". Twelve lessons have one. A visitor who reads the promise and
   then meets "No self-check is published for this lesson" learns not to trust
   the site. */
const checks = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/academy-self-checks.json'), 'utf8'));
const withCheck = Object.keys(checks).filter((id) => topics.has(id)).length;
const hub = fs.readFileSync(path.join(root, 'learning.html'), 'utf8');

assert(!/self-check on every lesson/i.test(hub), 'the hub does not claim a self-check on every lesson');
assert(!/self-checks? available on all\b/i.test(hub), 'the hub does not claim them for all lessons');

/* If the copy ever states a number, it has to be the real one. */
const stated = hub.match(/self-checks? on (\d+) of (\d+)/i);
if (stated) {
  assert(Number(stated[1]) === withCheck && Number(stated[2]) === topics.size,
    `a stated self-check count matches the data (${withCheck} of ${topics.size})`);
} else {
  console.log(`  · hub states no self-check count (${withCheck} of ${topics.size} lessons have one)`);
}

section('The interactive app wires the same way back');

const app = fs.readFileSync(path.join(root, 'assets/js/learning.js'), 'utf8');
assert(/prevLessonView/.test(app) && /prevLessonView\(path, topic\)/.test(app),
  'the in-browser lesson view renders the previous lesson too');
assert(/export function prevLessonView/.test(fs.readFileSync(path.join(root, 'assets/js/academy-views.mjs'), 'utf8')),
  'both views share one implementation');

section('The previous link is a thumb-sized target');

const css = fs.readFileSync(path.join(root, 'assets/css/learning.css'), 'utf8');
const block = css.slice(css.indexOf('.lesson-prev {'));
assert(/\.lesson-prev\s*\{/.test(css), 'the previous link has its own style');
assert(/@media \(max-width: 640px\), \(pointer: coarse\) \{[\s\S]*?\.lesson-prev \{[^}]*min-height:\s*44px/.test(block),
  'it is at least 44px tall on a phone');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
