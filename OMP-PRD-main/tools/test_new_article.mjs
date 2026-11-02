#!/usr/bin/env node
/* ============================================================
   new-article.mjs: the parts that do not need a server.

   The CLI's job before the network is to refuse bad input. A script that
   quietly publishes an article with an empty slug, or turns an unknown
   front-matter key into body text, costs a deploy and a 404 to notice. Every
   case here is a dry run, so no credentials and no network are involved.

   Run: node tools/test_new_article.mjs
   ============================================================ */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'scripts/new-article.mjs');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-article-'));

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

function run(args, env = {}) {
  /* Credentials are cleared so a machine that has them exported cannot turn a
     dry run into a live publish. */
  const base = { ...process.env };
  delete base.SUPABASE_EMAIL;
  delete base.SUPABASE_PASSWORD;
  /* spawnSync, not execFileSync: the latter hands back stdout only on success,
     and half of what this file checks is the warning on stderr. */
  const { status, stdout, stderr } = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT, encoding: 'utf8', env: { ...base, ...env }, stdio: ['ignore', 'pipe', 'pipe']
  });
  return { code: status ?? 1, stdout: stdout || '', stderr: stderr || '' };
}

const write = (name, content) => {
  const file = path.join(work, name);
  fs.writeFileSync(file, content);
  return file;
};

section('Front matter');
const full = write('full.md', `---
title: How password managers actually work
slug: how-password-managers-work
status: published
category: guides
excerpt: "One line, with a comma."
---

Body text.
`);
let result = run([full, '--dry-run']);
assert(result.code === 0, 'a complete front matter is accepted');
assert(/title\s+How password managers actually work/.test(result.stdout), 'title is read from front matter');
assert(/slug\s+how-password-managers-work/.test(result.stdout), 'slug is used as written');
assert(/status\s+published/.test(result.stdout), 'status is read from front matter');
assert(/category\s+guides/.test(result.stdout), 'category is read');
assert(!/---/.test(result.stdout), 'the front matter itself never reaches the body');

section('Where the title comes from');
result = run([write('heading.md', '# Only a heading\n\ntext\n'), '--dry-run']);
assert(/title\s+Only a heading/.test(result.stdout), 'first Markdown heading becomes the title');

result = run([write('file-name.md', 'text with no heading\n'), '--dry-run']);
assert(/title\s+file name/.test(result.stdout), 'file name becomes the title when nothing else does');

result = run([write('h1.html', '<h1>HTML heading</h1><p>text</p>'), '--dry-run']);
assert(/title\s+HTML heading/.test(result.stdout), 'an <h1> in HTML becomes the title');

section('Slug');
result = run([write('messy.md', '---\ntitle: Hello World\n---\n\nBody\n'), '--dry-run']);
assert(/slug\s+hello-world/.test(result.stdout), 'slug is derived from the title when absent');
result = run([write('punct.md', '---\ntitle: "C++ & Rust: a comparison!"\n---\n\nBody\n'), '--dry-run']);
assert(/slug\s+c-rust-a-comparison/.test(result.stdout), 'punctuation is stripped, not escaped into the URL');

section('Refused input');
result = run([full, '--status', 'live', '--dry-run']);
assert(result.code === 1, 'an unknown status exits 1');
assert(/not draft\/published\/scheduled/.test(result.stderr), 'and says which values are allowed');

result = run([write('empty.md', '---\ntitle: ""\nslug: ""\nstatus: published\n---\n\n'), '--dry-run']);
assert(result.code === 1, 'a published article with no body is refused');

result = run([write('sched.md', '---\ntitle: Later\nstatus: scheduled\n---\n\nBody\n'), '--dry-run']);
assert(result.code === 1, 'status: scheduled without scheduled_for is refused');

result = run([write('baddate.md', '---\ntitle: Later\nstatus: scheduled\nscheduled_for: soon\n---\n\nBody\n'), '--dry-run']);
assert(result.code === 1, 'an unparseable scheduled_for is refused');

result = run([path.join(work, 'nope.md'), '--dry-run']);
assert(result.code === 1, 'a missing file exits 1 instead of publishing nothing');

section('Typos are loud');
result = run([write('typo.md', '---\ntitle: T\nstatsu: published\n---\n\nBody\n'), '--dry-run']);
assert(/unknown front-matter field "statsu"/.test(result.stderr), 'a misspelled front-matter key is reported');

section('It cannot publish by accident');
result = run([full, '--dry-run'], { SUPABASE_EMAIL: 'admin@example.test', SUPABASE_PASSWORD: 'x' });
assert(result.code === 0 && /dry run - nothing was sent/.test(result.stdout), '--dry-run sends nothing even with credentials set');
result = run([full]);
assert(result.code === 1, 'without credentials it stops before the network');
assert(/SUPABASE_EMAIL and SUPABASE_PASSWORD are not set/.test(result.stderr), 'and says what is missing');

section('It knows how it is called');
result = run([]);
assert(result.code === 2, 'no arguments prints usage and exits 2');
assert(/Usage: node scripts\/new-article\.mjs/.test(result.stderr), 'usage names the file and the flags');

fs.rmSync(work, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
