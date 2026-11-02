#!/usr/bin/env node
/* ============================================================
   Admin sections: the parts that can be checked without a browser.

   The panel itself needs a logged-in Supabase session, so the things worth
   asserting are the ones a wrong edit breaks silently:

     * every section the tab bar shows actually exists, and every section that
       exists is reachable - a tab that mounts nothing is a blank screen
     * sections are handed the panel's helpers instead of importing admin.js
       back, which is what keeps the two files acyclic
     * the tab label and the section key cannot drift apart
     * no section interpolates unescaped text into innerHTML

   Run: node tools/test_admin_sections.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sectionsPath = path.join(ROOT, 'assets/js/admin/sections.js');
const adminPath = path.join(ROOT, 'assets/js/admin.js');

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

const source = fs.readFileSync(sectionsPath, 'utf8');
const admin = fs.readFileSync(adminPath, 'utf8');

section('Every tab has a mount, every mount has a tab');
const declared = [...source.matchAll(/\{\s*key:\s*'([a-z-]+)',\s*label:\s*'([^']+)'\s*\}/g)]
  .map((match) => ({ key: match[1], label: match[2] }));
assert(declared.length > 0, `tabs declared (${declared.map((t) => t.key).join(', ')})`);

/* The last entry in an object literal has no trailing comma. */
const routed = [...source.matchAll(/^\s{2}([a-z]+):\s*mount([A-Za-z]+),?$/gm)].map((match) => match[1]);
const declaredKeys = declared.map((tab) => tab.key);
assert(routed.length === declaredKeys.length,
  `the router has one entry per tab (${declaredKeys.length} tabs, ${routed.length} routes)`);
for (const key of declaredKeys) {
  assert(routed.includes(key), `"${key}" is routed, not just declared`);
}
for (const key of routed) {
  assert(declaredKeys.includes(key), `"${key}" is declared in the tab bar, not orphaned`);
}

section('Tabs cannot be duplicated or blank');
assert(new Set(declaredKeys).size === declaredKeys.length, 'no duplicate section keys');
for (const tab of declared) {
  assert(tab.label.trim().length > 0 && tab.label.length <= 16, `"${tab.key}" has a short label ("${tab.label}")`);
}

section('admin.js wires them, and does not own them');
assert(/import\s*\{[^}]*isSection[^}]*\}\s*from\s*'\.\/admin\/sections\.js'/.test(admin),
  'admin.js imports the section router');
assert(/if \(isSection\(tab\)\)/.test(admin), 'loadTab() hands unknown-but-registered tabs to it');
assert(/SECTION_TABS\.map/.test(admin), 'the tab bar is built from the same list, so a new section needs no HTML edit');
assert(!/from '\.\.?\/admin\.js'/.test(source), 'sections.js never imports admin.js back (that would be a cycle)');
assert(/ctx/.test(source), 'sections receive their helpers as a context object instead');

section('Nothing painted from the database goes in raw');
/* Every template literal that interpolates a value into innerHTML must wrap it
   in esc(). Not a proof - a grep that catches the mistake people actually make
   when they add the next section by copying an old one. */
const interpolations = [...source.matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1].trim());
const suspicious = interpolations.filter((expression) =>
  /* Nested template literals and ternaries contain quotes; those are checked
     by reading them, and matching them here only produces noise. What this
     looks for is the plain `${row.title}` that someone forgot to escape. */
  !/['"`]/.test(expression) &&
  /^(data|rows|job|rule|hit|article|product)\./.test(expression) &&
  !expression.startsWith('esc(') &&
  !/^\$\{when\(/.test(expression) &&
  !/\.length$/.test(expression) &&
  !/\.map\(/.test(expression) &&
  !/\.join\(/.test(expression) &&
  !/\.filter\(/.test(expression));
assert(suspicious.length === 0,
  suspicious.length ? `unescaped database value(s) in template: ${suspicious.join(' | ')}` : 'every database value is escaped or structurally rendered');
assert(/const esc = \(value/.test(admin), 'the escaper sections are given is the panel\'s own');

section('Failure is visible, not silent');
assert(/does not exist yet/.test(source), 'a missing table explains which migration to run');
assert(/error\.message/.test(source), 'query errors surface their message');
assert(!/catch\s*\{\s*\}/.test(source), 'no swallowed exceptions');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
