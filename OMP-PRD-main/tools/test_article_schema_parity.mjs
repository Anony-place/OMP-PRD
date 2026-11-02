#!/usr/bin/env node
/* ============================================================================
   The fixture is not the database.

   A test fixture that has a column production does not have is not a test, it
   is a second schema. This suite was written after exactly that happened: the
   pglite fixture carried excerpt / seo_title / seo_description / cover_image_url
   (names public.articles has never had), the admin panel and a save trigger
   were written against them, every suite passed, and the first real edit in
   production would have thrown

       42703: record "old" has no field "excerpt"

   So this file compares three things that are allowed to disagree only by
   accident, and makes an accident a red build:

     1. the real shape of public.articles, read out of the SQL that creates it
        (supabase/00_schema_migrations.sql) and every later add-column
        (supabase/*.sql, supabase/migrations/*.sql);
     2. the fixture in tools/lib/pg.mjs, which claims to be that shape;
     3. every column the code actually writes: the panel's insert payload, the
        content-publish function, and the revisions snapshot + restore.

   Nothing here talks to Supabase. It reads the repository, so it runs in CI
   before a deploy and fails on the commit that introduces the drift.
   ============================================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let passed = 0;
const failures = [];
const ok = (condition, label) => {
  if (condition) passed += 1;
  else failures.push(label);
};

/* ------------------------------------------------------------ 1. the truth */

/* Strip SQL comments so a comment that mentions a column is not read as a
   column. (A test that reads a comment as code lies - this bit the publish
   workflow suite too.) */
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '');
}

function createTableColumns(sql, table) {
  const clean = stripSqlComments(sql);
  const re = new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\s*\\);`,
    'i'
  );
  const body = clean.match(re)?.[1];
  if (!body) return null;
  const columns = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith(')')) continue;
    /* constraints are not columns */
    if (/^(primary|unique|foreign|check|constraint|exclude)\b/i.test(line)) continue;
    const name = line.match(/^([a-z_][a-z0-9_]*)\s+/i)?.[1];
    if (name) columns.push(name);
  }
  return columns;
}

function addedColumns(sql, table) {
  const clean = stripSqlComments(sql);
  const found = [];
  const re = new RegExp(
    `alter\\s+table\\s+public\\.${table}\\s+add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?([a-z_][a-z0-9_]*)`,
    'gi'
  );
  let m;
  while ((m = re.exec(clean))) found.push(m[1]);
  return found;
}

const baseSchema = read('supabase/00_schema_migrations.sql');
const migrationFiles = fs
  .readdirSync(path.join(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();
const repoSql = [
  baseSchema,
  ...fs
    .readdirSync(path.join(root, 'supabase'))
    .filter((f) => /^\d{2}_.*\.sql$/.test(f) && !f.startsWith('00_'))
    .sort()
    .map((f) => read(`supabase/${f}`)),
  ...migrationFiles.map((f) => read(`supabase/migrations/${f}`))
];

const baseColumns = createTableColumns(baseSchema, 'articles');
ok(Array.isArray(baseColumns) && baseColumns.length > 5,
  'supabase/00_schema_migrations.sql defines public.articles (could not parse the create table block)');

const real = new Set(baseColumns || []);
for (const sql of repoSql) for (const column of addedColumns(sql, 'articles')) real.add(column);

/* Columns that exist in the deployed database and in no repository file. They
   are history, not fiction: author_id predates the first committed migration.
   Anything added here is a promise, so keep it short and justified. */
const LIVE_ONLY = new Set(['author_id']);
const realWithLive = new Set([...real, ...LIVE_ONLY]);

/* ------------------------------------------------------- 2. the fixture */

const fixtureSource = read('tools/lib/pg.mjs');
const fixtureColumns = createTableColumns(fixtureSource.replace(/\/\*[\s\S]*?\*\//g, ''), 'articles');
ok(Array.isArray(fixtureColumns) && fixtureColumns.length > 5,
  'tools/lib/pg.mjs defines public.articles (could not parse the create table block)');

const fiction = (fixtureColumns || []).filter((c) => !realWithLive.has(c));
ok(fiction.length === 0,
  `fixture has columns production does not have: ${fiction.join(', ')} - code written against these passes in tests and throws 42703 live`);

const missingFromFixture = [...real].filter((c) => !(fixtureColumns || []).includes(c));
ok(missingFromFixture.length === 0,
  `fixture is missing columns production has: ${missingFromFixture.join(', ')} - a migration that writes them would pass in tests and throw 42703 live`);

/* --------------------------------------------- 3. every column code writes */

/* 3a. the panel's article payload (assets/js/admin.js) */
const adminJs = read('assets/js/admin.js');
const articlePayload = adminJs.match(
  /const payload = \{(title,slug,summary[\s\S]*?)\};\s*\n\s*const (?:result|saved)/
)?.[1] || '';
const payloadKeys = articlePayload
  .split(',')
  .map((part) => part.split(':')[0].trim())
  .filter((key) => /^[a-z_][a-z0-9_]*$/i.test(key));
ok(payloadKeys.length >= 10,
  `assets/js/admin.js: could not parse the article payload (found ${payloadKeys.length} keys)`);
const payloadFiction = payloadKeys.filter((k) => !realWithLive.has(k));
ok(payloadFiction.length === 0,
  `assets/js/admin.js writes columns production does not have: ${payloadFiction.join(', ')}`);

/* 3b. the content-publish edge function: literal keys plus alias targets */
const fn = read('supabase/functions/content-publish/index.ts');
const recordBlock = fn.match(/const record: Record<string, unknown> = \{([\s\S]*?)\};/)?.[1] || '';
const recordKeys = [...recordBlock.matchAll(/^\s*([a-z_][a-z0-9_]*)\s*:/gi)].map((m) => m[1]);
const assignedKeys = [...fn.matchAll(/record\.([a-z_][a-z0-9_]*)\s*=/g)].map((m) => m[1]);
const aliasBlock = fn.match(/const aliases: Record<string, string> = \{([\s\S]*?)\};/)?.[1] || '';
const aliasTargets = [...aliasBlock.matchAll(/^\s*[a-z_][a-z0-9_]*\s*:\s*"([a-z_][a-z0-9_]*)"/gim)].map((m) => m[1]);
const wired = [...new Set([...recordKeys, ...assignedKeys, ...aliasTargets])];
ok(wired.length >= 8,
  `supabase/functions/content-publish/index.ts: could not parse the columns it writes (found ${wired.length})`);
const fnFiction = wired.filter((k) => !realWithLive.has(k));
ok(fnFiction.length === 0,
  `content-publish writes columns production does not have: ${fnFiction.join(', ')}`);

/* 3c. the revisions table, its capture trigger and its restore path */
const revisionsSql = read('supabase/migrations/20261101150000_article_revisions.sql');
const snapshotColumns = createTableColumns(revisionsSql, 'article_revisions') || [];
const snapshotFiction = snapshotColumns.filter(
  (c) => !realWithLive.has(c) && !['id', 'seq', 'article_id', 'reason', 'created_at', 'created_by'].includes(c)
);
ok(snapshotFiction.length === 0,
  `article_revisions snapshots columns production does not have: ${snapshotFiction.join(', ')}`);

/* Every old.<column> / new.<column> the trigger reads has to exist on the row
   it receives, or the trigger raises at runtime rather than at create time. */
const triggerBody = revisionsSql.match(/create or replace function public\.record_article_revision[\s\S]*?\$\$;/)?.[0] || '';
const triggerReads = [...new Set([...triggerBody.matchAll(/\b(?:old|new)\.([a-z_][a-z0-9_]*)/g)].map((m) => m[1]))];
ok(triggerReads.length >= 6, 'record_article_revision reads the row (could not parse the trigger)');
const triggerFiction = triggerReads.filter((c) => !realWithLive.has(c));
ok(triggerFiction.length === 0,
  `record_article_revision reads columns production does not have: ${triggerFiction.join(', ')} - every save and delete of an article would raise 42703`);

/* Restore writes into public.articles, so its target list is a column list. */
const restoreBody = revisionsSql.match(/create or replace function public\.restore_article_revision[\s\S]*?\$\$;/)?.[0] || '';
const restoreInsert = restoreBody.match(/insert into public\.articles\s*\(([\s\S]*?)\)\s*values/i)?.[1] || '';
const restoreUpdate = restoreBody.match(/update public\.articles set([\s\S]*?)where id = snapshot\.article_id/i)?.[1] || '';
const restoreCols = [
  ...restoreInsert.split(',').map((s) => s.trim()),
  ...restoreUpdate.split('\n').map((line) => line.split('=')[0].trim()).filter((s) => /^[a-z_][a-z0-9_]*$/i.test(s))
].filter((c) => /^[a-z_][a-z0-9_]*$/i.test(c));
ok(restoreCols.length >= 5, 'restore_article_revision writes the article (could not parse its column list)');
const restoreFiction = restoreCols.filter((c) => !realWithLive.has(c));
ok(restoreFiction.length === 0,
  `restore_article_revision writes columns production does not have: ${restoreFiction.join(', ')}`);

/* ------------------------------------------------------ 4. no regressions */

/* The old names may survive only as input aliases, which is what they are: a
   spelling some document used. They must never be a column of the fixture, a
   target of the payload, or a field of the snapshot. */
const RETIRED = ['excerpt', 'seo_title', 'seo_description', 'cover_image_url'];
ok(!(fixtureColumns || []).some((c) => RETIRED.includes(c)),
  'the fixture has re-grown a retired column');
ok(!payloadKeys.some((k) => RETIRED.includes(k)),
  'the admin payload has re-grown a retired column');
ok(!snapshotColumns.some((c) => RETIRED.includes(c)),
  'article_revisions has re-grown a retired column');

/* If a name is retired, the alias map is the only place allowed to mention it
   as a source, so an old script keeps working without a schema that pretends. */
const aliasSources = [...aliasBlock.matchAll(/^\s*([a-z_][a-z0-9_]*)\s*:/gim)].map((m) => m[1]);
ok(RETIRED.every((name) => aliasSources.includes(name)),
  `content-publish should still accept the retired spellings as aliases (missing: ${RETIRED.filter((n) => !aliasSources.includes(n)).join(', ') || 'none'})`);

/* ---------------------------------------------------------------- report */

const total = passed + failures.length;
for (const failure of failures) console.log(`  FAIL  ${failure}`);
if (failures.length) {
  console.log(`\n  ${failures.length} of ${total} checks failed.\n`);
  process.exit(1);
}
console.log(`\n  ${passed} of ${total} checks passed.`);
console.log(`  public.articles has ${realWithLive.size} columns; the fixture says ${fixtureColumns.length}.`);
console.log('  The fixture and the database describe the same table.\n');
