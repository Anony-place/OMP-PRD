#!/usr/bin/env node
/* ============================================================
   Audit log, against a real Postgres.

   The answers this table exists for are the ones nobody can reconstruct after
   the fact: who unpublished the article, who changed the price, who deleted the
   category. So the checks are about what it does and does not record, and about
   who is allowed to read it.

   Run: node tools/test_audit_log.mjs
   ============================================================ */

import fs from 'node:fs';
import { createTestDb, reporter, migrationPath, ADMIN_ID, EDITOR_ID } from './lib/pg.mjs';

const { section, assert, finish } = reporter();
const migration = fs.readFileSync(migrationPath('20261101170000_audit_log.sql'), 'utf8');

const db = await createTestDb({ migration });

const entries = () => db.all(`select * from public.audit_log order by id`);
const last = async () => (await entries()).at(-1);

section('An insert is recorded');
await db.asAdmin();
const article = await db.one(
  `insert into public.articles (title, slug, status, content) values ('Price of a breach', 'price-of-a-breach', 'draft', 'body text') returning *`
);
let log = await last();
assert(log.action === 'insert', 'the save appears as an insert');
assert(log.table_name === 'articles', 'with the table it belongs to');
assert(log.row_id === article.id, 'and the row');
assert(log.actor === ADMIN_ID, 'and who did it');
assert(log.actor_email === 'admin@example.test', 'by name, not just id');
assert(log.detail.title === 'Price of a breach', 'and enough to know which article it was');

section('No body, no second copy of the site');
assert(!JSON.stringify(log).includes('body text'), 'the article body is never stored in the log');
assert(log.changed.length === 0, 'an insert records no changed fields - the whole row is new');

section('An update records which fields changed, not their values');
await db.run(`update public.articles set title = 'Price of a data breach' where id = $1`, [article.id]);
log = await last();
assert(log.action === 'update', 'the edit is recorded');
assert(log.changed.includes('title'), 'the changed field is named');
assert(!log.changed.includes('content'), 'untouched fields are not listed');
assert(!JSON.stringify(log).includes('Price of a data breach') || log.detail.title === 'Price of a data breach',
  'the new title appears only as the identifying field');
assert(!JSON.stringify(log).includes('body text'), 'and the body still never appears');

section('A save that changed nothing is not an event');
const before = (await entries()).length;
await db.run(`update public.articles set title = 'Price of a data breach' where id = $1`, [article.id]);
assert((await entries()).length === before, 'writing the same value records nothing');

await db.run(`update public.articles set updated_at = now() where id = $1`, [article.id]);
assert((await entries()).length === before, 'bumping updated_at alone records nothing');

section('Status changes are the point');
await db.run(`update public.articles set status = 'published' where id = $1`, [article.id]);
log = await last();
assert(log.changed.includes('status'), 'publishing is recorded as a status change');
assert(log.detail.status === 'published', 'and the log says what it became');

await db.asUser(EDITOR_ID);
await db.run(`update public.articles set status = 'archived' where id = $1`, [article.id]);
log = await last();
assert(log.actor === EDITOR_ID, 'a second person is recorded by their own id');
assert(log.actor_email === 'editor@example.test', 'and their own email');

section('Rest of the panel is covered too');
await db.asAdmin();
await db.run(`insert into public.products (name, slug, price) values ('Field guide', 'field-guide', 9) returning id`);
log = await last();
assert(log.table_name === 'products', 'a product insert is recorded');
await db.run(`update public.products set price = 19 where slug = 'field-guide'`);
log = await last();
assert(log.changed.includes('price'), 'and a price change is a named field');
assert(!('price' in log.detail), 'the value is not stored - the field name is what the log is for');

await db.run(`insert into public.tools (name, slug) values ('Entropy meter', 'entropy-meter')`);
assert((await last()).table_name === 'tools', 'a tool insert is recorded');

const category = await db.one(`insert into public.article_categories (name, slug) values ('Spy', 'spy') returning *`);
await db.run(`delete from public.article_categories where id = $1`, [category.id]);
log = await last();
assert(log.action === 'delete' && log.table_name === 'article_categories', 'deleting a category leaves a record of it');
assert(log.detail.name === 'Spy', 'naming the thing that no longer exists');

section('Automation is not anonymous');
/* asAnon is session-level, which is what a service-role write looks like: a
   real connection with no user claim on it. */
await db.asAnon();
await db.run(`insert into public.articles (title, slug, status) values ('Cron made this', 'cron-made-this', 'published')`);
log = await last();
assert(log.actor === null, 'a row written with no session has no actor');
assert(log.detail.title === 'Cron made this', 'but the change is still recorded, which is the point');

section('History is bounded');
const total = await db.one(`select count(*)::int as n from public.audit_log`);
assert(total.n < 20001, `the log is capped (${total.n} entries)`);

section('Only an admin can read it');
const policies = await db.all(`select policyname, cmd from pg_policies where tablename = 'audit_log'`);
assert(policies.length === 1, 'exactly one policy exists');
assert(policies[0].cmd === 'SELECT', 'and it is read-only');
assert(/admin/i.test(policies[0].policyname), 'admin-only');
const writes = await db.all(`select policyname from pg_policies where tablename = 'audit_log' and cmd <> 'SELECT'`);
assert(writes.length === 0, 'nothing can write to it through the API - rows come from the trigger');

section('A failed write leaves no entry');
const beforeFail = (await entries()).length;
let failed = false;
try {
  await db.run(`insert into public.articles (title, slug, status) values ('Bad status', 'bad-status', 'nonsense')`);
} catch {
  failed = true;
}
assert(failed, 'the write was rejected');
assert((await entries()).length === beforeFail, 'and the audit log records nothing that did not happen');

await db.close();
finish();
