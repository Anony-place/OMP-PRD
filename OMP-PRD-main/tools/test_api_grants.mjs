#!/usr/bin/env node
/* ============================================================
   A policy is not a permission.

   `create policy ... for select to authenticated` chooses which ROWS a role may
   read. It does not allow the role to read the table. The GRANT does that, and
   on a normal Supabase project nobody notices, because a table created by
   `postgres` inherits `grant all to anon, authenticated, service_role` from the
   project's default privileges.

   Tables created through the Management API do not inherit them. The November
   migrations were applied that way, and the result was silent:

     redirects          the panel's Redirects tab could not read or write a row,
                        and scripts/sync-redirects.mjs reads it with the
                        publishable key - so a rename made in the panel never
                        became a 301
     article_revisions  Revisions showed "no versions" for articles that had them
     audit_log          Activity was empty
     publish_jobs       the edge function could not insert the job row, so every
                        publish failed with "could not record the job"

   The Setup screen found it - it reported three tables as missing that had
   existed for days. This suite is the reason it cannot happen again quietly.

   Scope: migrations from 2026-11-01 onward, which is when the pipeline tables
   started being applied this way. Older migrations (academy, osint, pentest) are
   already live on inherited privileges and are not rewritten here.

   Run: node tools/test_api_grants.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

const stripComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');

/* Migration names start with the date: 20261101120000_name.sql. Comparing the
   first eight characters keeps the rule ("November 2026 onward") readable and
   survives any digit-count confusion in a regex. */
const files = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql') && f.slice(0, 8) >= '20261101')
  .sort();

const all = files.map((f) => ({ file: f, raw: read(`supabase/migrations/${f}`) }));
const clean = (entry) => stripComments(entry.raw);

/* ---------------------------------------------------- tables and grants */

const created = new Map(); // table -> file
for (const entry of all) {
  for (const m of clean(entry).matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi)) {
    if (!created.has(m[1])) created.set(m[1], entry.file);
  }
}

/* grant <privileges> on public.<table>[, public.<other>] to <roles>
   One statement can name several tables - the newsletter migration does exactly
   that - so a single-table pattern silently under-reports. */
const granted = new Map(); // table -> [{ privileges, roles, file }]
for (const entry of all) {
  const re = /grant\s+([a-z, ]+?)\s+on\s+(?:table\s+)?((?:public\.[a-z_][a-z0-9_]*)(?:\s*,\s*public\.[a-z_][a-z0-9_]*)*)\s+to\s+([a-z_, ]+)/gi;
  let m;
  while ((m = re.exec(clean(entry)))) {
    const privileges = m[1].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const roles = m[3].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const tables = m[2].split(',').map((s) => s.trim().replace(/^public\./, '')).filter(Boolean);
    for (const table of tables) {
      if (!granted.has(table)) granted.set(table, []);
      granted.get(table).push({ privileges, roles, file: entry.file });
    }
  }
}

section('Every table the new pipeline creates has an explicit grant');

assert(created.size >= 5, `found ${created.size} tables created by the November migrations onward`);
for (const [table, file] of [...created].sort()) {
  const rows = granted.get(table) || [];
  assert(rows.length > 0,
    `public.${table} (${file}) grants something - a policy alone would leave it unreadable`);
}

section('The panel can read the tables its screens mount');

for (const table of ['article_revisions', 'audit_log', 'redirects', 'publish_jobs', 'panel_settings']) {
  const rows = granted.get(table) || [];
  assert(rows.some((r) => r.roles.includes('authenticated') && r.privileges.includes('select')),
    `an admin session can SELECT public.${table} - otherwise the tab renders "nothing here" forever`);
}

section('The build can read what it must read with the publishable key');

const syncScript = read('scripts/sync-redirects.mjs');
assert(/SUPABASE_PUBLISHABLE_KEY/.test(syncScript),
  'scripts/sync-redirects.mjs reads the redirects table with the publishable key (anon role)');
assert((granted.get('redirects') || []).some((r) => r.roles.includes('anon') && r.privileges.includes('select')),
  'so anon must have SELECT on public.redirects - without it a panel rename never becomes a 301');

section('The writer that is not a browser can write');

const fn = read('supabase/functions/content-publish/index.ts');
assert(/\.from\("publish_jobs"\)\s*\n?\s*\.insert\(/.test(fn), 'content-publish inserts a publish_jobs row');
assert(/publish_jobs[\s\S]{0,200}\.update\(/.test(fn), 'and updates it');
const jobsGrants = granted.get('publish_jobs') || [];
for (const privilege of ['insert', 'update', 'select']) {
  assert(jobsGrants.some((r) => r.roles.includes('service_role') && (r.privileges.includes(privilege) || r.privileges.includes('all'))),
    `service_role has ${privilege.toUpperCase()} on public.publish_jobs - the function writes with the service role`);
}

section('Nothing is granted to a role that should not have it');

for (const table of ['article_revisions', 'audit_log']) {
  const rows = granted.get(table) || [];
  assert(!rows.some((r) => r.roles.includes('anon')),
    `anon has no grant on public.${table} - it is history, not public content`);
  assert(!rows.some((r) => ['insert', 'update', 'delete'].some((p) => r.privileges.includes(p))),
    `no browser role can write public.${table} - rows arrive from the definer trigger`);
}
const newsletter = granted.get('newsletter_subscribers') || [];
assert(newsletter.some((r) => r.roles.includes('service_role')),
  'the subscriber list is granted to service_role only');
assert(!newsletter.some((r) => r.roles.includes('anon') || r.roles.includes('authenticated')),
  'and to no browser role at all');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
