#!/usr/bin/env node
/* ============================================================
   Cheat sheets: readable headings, and controls that do something.

   Two defects shipped on /cheatsheets/incident-response-first-hour-cheatsheet,
   the cheat sheet that receives the most search impressions of any page in its
   directory (42 impressions at position 8.19 in the 90-day export of
   2026-11-09). Neither broke the build, and no existing gate read this output:

     1. every command title rendered as "1. 1. Snapshot Active Network
        Connections", because the titles carried their own number and the
        template prefixed another one.

     2. the variable replacer printed Target IP, Target Domain and Wordlist
        Path on every sheet regardless of what that sheet's commands use. A
        first-hour triage checklist offered a "Wordlist Path" box that changed
        nothing, on the page most likely to be printed and followed under
        pressure.

   Both are properties of the generated HTML, so this reads the built site and
   runs after the build.

   Run: node tools/test_cheatsheets.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'cheatsheets');

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; return; }
  failures.push(message);
  console.log(`  x ${message}`);
}
const section = (name) => console.log(`\n${name}`);

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
assert(files.length > 0, 'the cheatsheets directory contains built pages');

/* The template prints `<h3 ...>${index}. ${title}</h3>`. A title that already
   starts with a digit-and-dot therefore renders twice. */
section('No command heading is numbered twice');

const doubleNumbered = [];
const titlesBySheet = new Map();

for (const file of files) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const headings = [...html.matchAll(/<h3 class="h-3" style="font-size:1\.03rem[^"]*">([\s\S]*?)<\/h3>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim());
  titlesBySheet.set(file, headings);

  for (const heading of headings) {
    if (/^\d+\.\s*\d+\./.test(heading)) doubleNumbered.push(`${file}: "${heading.slice(0, 60)}"`);
  }
}

assert(doubleNumbered.length === 0,
  doubleNumbered.length
    ? `${doubleNumbered.length} heading(s) numbered twice, e.g. ${doubleNumbered[0]}`
    : `no heading on any of ${files.length} cheat sheets is numbered twice`);

/* Numbers must also run 1..n in order, so a dropped or duplicated step is
   visible rather than silently collapsing two commands into one position. */
const misnumbered = [];
for (const [file, headings] of titlesBySheet) {
  if (!headings.length) { misnumbered.push(`${file}: no command headings found`); continue; }
  headings.forEach((heading, i) => {
    const m = /^(\d+)\.\s/.exec(heading);
    if (!m) { misnumbered.push(`${file}: heading ${i + 1} has no number`); return; }
    if (Number(m[1]) !== i + 1) misnumbered.push(`${file}: position ${i + 1} numbered ${m[1]}`);
  });
}
assert(misnumbered.length === 0,
  misnumbered.length
    ? misnumbered.slice(0, 3).join('; ')
    : `command numbers run 1..n on every sheet`);

/* ------------------------------------------------------------------- replacer
   Every input must have at least one `{KEY}` in the sheet's commands. The
   commands are recoverable from the data-cs-template attributes the build
   writes, so this needs no knowledge of the source data. */
section('The variable replacer only offers variables the page uses');

const strayInputs = [];
const missingInputs = [];

for (const file of files) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const templates = [...html.matchAll(/data-cs-template="([^"]*)"/g)]
    .map((m) => m[1]
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  const commandText = templates.join('\n');
  const inputs = [...html.matchAll(/data-cs-var="([A-Z]+)"/g)].map((m) => m[1]);

  for (const key of inputs) {
    if (!commandText.includes(`{${key}}`)) strayInputs.push(`${file}: offers ${key} but no command uses {${key}}`);
  }
  for (const key of new Set([...commandText.matchAll(/\{([A-Z]+)\}/g)].map((m) => m[1]))) {
    if (!inputs.includes(key)) missingInputs.push(`${file}: commands use {${key}} but there is no input for it`);
  }
}

assert(strayInputs.length === 0,
  strayInputs.length ? `${strayInputs.length} stray input(s), e.g. ${strayInputs[0]}` : 'no sheet offers a variable its commands never use');
assert(missingInputs.length === 0,
  missingInputs.length ? `${missingInputs.length} missing input(s), e.g. ${missingInputs[0]}` : 'every placeholder a command uses has an input');

/* The template attribute may keep its placeholders - the browser substitutes
   them when a field changes. The visible text may not: that is what a visitor
   copies, and {LHOST} shipped literally on six Metasploit commands until this
   gate existed. */
section('No command a visitor can copy still contains a placeholder');

const unsubstituted = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const m of html.matchAll(/<code data-cs-template="[^"]*"[^>]*>([\s\S]*?)<\/code>/g)) {
    const visible = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const found = visible.match(/\{[A-Z]+\}/);
    if (found) unsubstituted.push(`${file}: "${found[0]}" in ${visible.trim().slice(0, 50)}`);
  }
}
assert(unsubstituted.length === 0,
  unsubstituted.length
    ? `${unsubstituted.length} block(s) ship a raw placeholder, e.g. ${unsubstituted[0]}`
    : 'every rendered command is copy-ready');

/* A sheet with no placeholders should not be titled "Interactive Target
   Variable Replacer" over an empty grid. */
section('A sheet with nothing to replace does not claim to');

const emptyClaim = files.filter((file) => {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const hasInputs = /data-cs-var="[A-Z]+"/.test(html);
  return !hasInputs && html.includes('Interactive Target Variable Replacer');
});
assert(emptyClaim.length === 0,
  emptyClaim.length ? `claims a replacer with no variables: ${emptyClaim.join(', ')}` : 'no sheet claims a replacer it does not have');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
