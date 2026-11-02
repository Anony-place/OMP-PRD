#!/usr/bin/env node
/* ============================================================
   article_revisions: runs the migration against a real Postgres.

   A trigger is the one kind of SQL that cannot be checked by reading it. The
   migration is loaded into pglite (the same engine tools/qa-deps already
   carries) and the behaviour is asserted: what gets captured, what does not,
   whether restoring loses the thing it replaced, and whether history stays
   bounded.

   The Supabase-shaped environment comes from tools/lib/pg.mjs, shared with the
   other database tests so a fixture cannot drift from its siblings.

   Run: node tools/test_article_revisions.mjs
   Requires: npm ci --prefix tools/qa-deps --ignore-scripts
   ============================================================ */

import fs from 'node:fs';
import { createTestDb, reporter, migrationPath, ADMIN_ID, EDITOR_ID } from './lib/pg.mjs';

const { section, assert, finish } = reporter();
const migration = fs.readFileSync(migrationPath('20261101150000_article_revisions.sql'), 'utf8');

const db = await createTestDb();
try {
  await db.exec(migration);
  assert(true, 'the migration applies to a real Postgres');
} catch (error) {
  assert(false, `the migration applies to a real Postgres (${error.message})`);
  process.exit(1);
}

const admin = ADMIN_ID;
const editor = EDITOR_ID;
const asUser = db.asUser;
const one = db.one;
const all = db.all;

const [article] = await all(
  `insert into public.articles (title, slug, status, content) values ($1,$2,'published','version one') returning id`,
  ['First draft', 'first-draft']
);

await asUser(admin);


section('A save keeps what was there before it');
await db.run(`update public.articles set content = 'version two' where id = $1`, [article.id]);
let revisions = await all(`select * from public.article_revisions where article_id = $1`, [article.id]);
assert(revisions.length === 1, 'one edit, one revision');
assert(revisions[0].content === 'version one', 'the revision holds the replaced text, not the new text');
assert(revisions[0].reason === 'update', 'and says why it exists');
assert(revisions[0].created_by === admin, 'and who made the change');

section('Noise is not history');
await db.run(`update public.articles set updated_at = now() where id = $1`, [article.id]);
revisions = await all(`select * from public.article_revisions where article_id = $1`, [article.id]);
assert(revisions.length === 1, 'touching updated_at alone records nothing');

await db.run(`update public.articles set status = 'archived' where id = $1`, [article.id]);
revisions = await all(`select * from public.article_revisions where article_id = $1`, [article.id]);
assert(revisions.length === 1, 'a status flip on its own records nothing');

await db.run(`update public.articles set title = 'Better title' where id = $1`, [article.id]);
revisions = await all(`select * from public.article_revisions where article_id = $1`, [article.id]);
assert(revisions.length === 2, 'a title edit does record a version');

section('Restore is not a loss');
const target = revisions.find((row) => row.content === 'version one');
const restored = await db.run(`select public.restore_article_revision($1) as id`, [target.id]);
assert(restored.rows[0].id === article.id, 'restoring returns the article it belongs to');

let current = await one(`select content, title from public.articles where id = $1`, [article.id]);
assert(current.content === 'version one', 'the old body is back');
assert(current.title === 'First draft', 'and the snapshot\'s own title comes back with it - a version is a whole row, not a patch');

revisions = await all(`select * from public.article_revisions where article_id = $1 order by seq desc`, [article.id]);
assert(revisions[0].content === 'version two', 'the version that was replaced just now is itself kept');

section('A deleted article is not gone');
await db.run(`delete from public.articles where id = $1`, [article.id]);
const afterDelete = await all(`select * from public.article_revisions where article_id = $1 and reason = 'delete'`, [article.id]);
assert(afterDelete.length === 1, 'deleting writes a final snapshot');
assert(afterDelete[0].content === 'version one', 'and it holds the body that was live');

const revived = await db.run(`select public.restore_article_revision($1) as id`, [afterDelete[0].id]);
const revivedId = revived.rows[0].id;
assert(Boolean(revivedId), 'a deleted article can be brought back');

const comeback = await one(`select title, slug, status, content from public.articles where id = $1`, [revivedId]);
assert(comeback.content === 'version one', 'with its body');
assert(comeback.status === 'draft', 'as a draft, not published behind your back');
assert(comeback.slug.startsWith('first-draft-restored-'), `with a slug that cannot collide (${comeback.slug})`);

section('History stays bounded');
await db.run(`update public.articles set content = 'v1' where id = $1`, [revivedId]);
for (let index = 2; index <= 55; index += 1) {
  await db.run(`update public.articles set content = $1 where id = $2`, [`v${index}`, revivedId]);
}
const kept = await one(`select count(*)::int as n from public.article_revisions where article_id = $1`, [revivedId]);
assert(kept.n === 40, `55 edits keep the newest 40 versions (kept ${kept.n})`);
const newest = await one(
  `select content from public.article_revisions where article_id = $1 order by seq desc limit 1`, [revivedId]);
assert(newest.content === 'v54', 'and the newest one is the one edited a moment ago');

section('Newest is well defined, not a coin flip');
const order = await all(`select seq from public.article_revisions where article_id = $1 order by seq asc`, [revivedId]);
assert(order.length === 40, 'the same rows are ordered deterministically');
assert(order.every((row, index) => index === 0 || Number(row.seq) > Number(order[index - 1].seq)),
  'seq increases with every snapshot, so two saves in one microsecond are still ranked');

section('Only an admin restores');
await asUser(editor);
let refused = false;
try {
  await db.run(`select public.restore_article_revision((select id from public.article_revisions limit 1))`);
} catch (error) {
  refused = /not an admin/.test(error.message);
}
assert(refused, 'a non-admin gets an error, not a restore');

section('History is not public');
await asUser(editor);
const policies = await all(`select policyname from pg_policies where tablename = 'article_revisions'`);
assert(policies.length === 1, 'exactly one policy exists on the table');
assert(/admin/i.test(policies[0]?.policyname || ''), 'and it is the admin-only read policy');
assert(await one(`select relrowsecurity as on from pg_class where relname = 'article_revisions'`).then((row) => row.on === true),
  'row level security is enabled');

const writePolicies = await all(
  `select policyname from pg_policies where tablename = 'article_revisions' and cmd in ('INSERT','UPDATE','DELETE','ALL')`);
assert(writePolicies.length === 0, 'nobody can write history by hand - only the trigger can');

await db.close();
finish();
