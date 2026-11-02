#!/usr/bin/env node
/* ============================================================
   article_revisions: runs the migration against a real Postgres.

   A trigger is the one kind of SQL that cannot be checked by reading it. The
   migration is loaded into pglite (the same engine tools/qa-deps already
   carries) and the behaviour is asserted: what gets captured, what does not,
   whether restoring loses the thing it replaced, and whether history stays
   bounded.

   Run: node tools/test_article_revisions.mjs
   Requires: npm ci --prefix tools/qa-deps --ignore-scripts
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(ROOT, 'tools/qa-deps/'));
const { PGlite } = require_('@electric-sql/pglite');

const MIGRATION = path.join(ROOT, 'supabase/migrations/20261101150000_article_revisions.sql');

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

const db = await PGlite.create();

/* Supabase pieces the migration depends on, in the smallest form that is
   faithful: an auth.users row, auth.uid() reading the request's claim, and
   profiles.is_admin deciding who may restore. */
/* Supabase's roles. grant/revoke need them to exist, and their absence is the
   first thing a migration hits on a bare Postgres. */
await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  end $$;
`);

await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

  create table public.profiles (
    id uuid primary key references auth.users(id),
    is_admin boolean not null default false
  );
  create or replace function public.is_admin() returns boolean
    language sql stable security definer set search_path = public as $$
      select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
    $$;

  create table public.article_categories (id uuid primary key default gen_random_uuid(), name text, slug text);
  create table public.articles (
    id uuid primary key default gen_random_uuid(),
    title text, slug text unique, status text not null default 'draft',
    category_id uuid references public.article_categories(id),
    content text, excerpt text, seo_title text, seo_description text,
    cover_image_url text, published_at timestamptz, scheduled_for timestamptz,
    updated_at timestamptz not null default now()
  );
`);

const migration = fs.readFileSync(MIGRATION, 'utf8');
try {
  await db.exec(migration);
  assert(true, 'the migration applies to a real Postgres');
} catch (error) {
  assert(false, `the migration applies to a real Postgres (${error.message})`);
  console.log(`\n${passed} passed, ${failures.length + 1} failed\n`);
  process.exit(1);
}

const admin = '11111111-1111-1111-1111-111111111111';
const editor = '22222222-2222-2222-2222-222222222222';
await db.exec(`
  insert into auth.users (id) values ('${admin}'), ('${editor}');
  insert into public.profiles (id, is_admin) values ('${admin}', true), ('${editor}', false);
`);

const asUser = async (id) => db.query(`select set_config('test.uid', '${id}', false)`);
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;

const [article] = await all(
  `insert into public.articles (title, slug, status, content) values ($1,$2,'published','version one') returning id`,
  ['First draft', 'first-draft']
);

await asUser(admin);

section('A save keeps what was there before it');
await db.query(`update public.articles set content = 'version two' where id = $1`, [article.id]);
let revisions = await all(`select * from public.article_revisions where article_id = $1`, [article.id]);
assert(revisions.length === 1, 'one edit, one revision');
assert(revisions[0].content === 'version one', 'the revision holds the replaced text, not the new text');
assert(revisions[0].reason === 'update', 'and says why it exists');
assert(revisions[0].created_by === admin, 'and who made the change');

section('Noise is not history');
await db.query(`update public.articles set updated_at = now() where id = $1`, [article.id]);
revisions = await all(`select * from public.article_revisions where article_id = $1`, [article.id]);
assert(revisions.length === 1, 'touching updated_at alone records nothing');

await db.query(`update public.articles set status = 'archived' where id = $1`, [article.id]);
revisions = await all(`select * from public.article_revisions where article_id = $1`, [article.id]);
assert(revisions.length === 1, 'a status flip on its own records nothing');

await db.query(`update public.articles set title = 'Better title' where id = $1`, [article.id]);
revisions = await all(`select * from public.article_revisions where article_id = $1`, [article.id]);
assert(revisions.length === 2, 'a title edit does record a version');

section('Restore is not a loss');
const target = revisions.find((row) => row.content === 'version one');
const restored = await db.query(`select public.restore_article_revision($1) as id`, [target.id]);
assert(restored.rows[0].id === article.id, 'restoring returns the article it belongs to');

let current = await one(`select content, title from public.articles where id = $1`, [article.id]);
assert(current.content === 'version one', 'the old body is back');
assert(current.title === 'First draft', 'and the snapshot\'s own title comes back with it - a version is a whole row, not a patch');

revisions = await all(`select * from public.article_revisions where article_id = $1 order by created_at desc`, [article.id]);
assert(revisions[0].content === 'version two', 'the version that was replaced just now is itself kept');

section('A deleted article is not gone');
await db.query(`delete from public.articles where id = $1`, [article.id]);
const afterDelete = await all(`select * from public.article_revisions where article_id = $1 and reason = 'delete'`, [article.id]);
assert(afterDelete.length === 1, 'deleting writes a final snapshot');
assert(afterDelete[0].content === 'version one', 'and it holds the body that was live');

const revived = await db.query(`select public.restore_article_revision($1) as id`, [afterDelete[0].id]);
const revivedId = revived.rows[0].id;
assert(Boolean(revivedId), 'a deleted article can be brought back');

const comeback = await one(`select title, slug, status, content from public.articles where id = $1`, [revivedId]);
assert(comeback.content === 'version one', 'with its body');
assert(comeback.status === 'draft', 'as a draft, not published behind your back');
assert(comeback.slug.startsWith('first-draft-restored-'), `with a slug that cannot collide (${comeback.slug})`);

section('History stays bounded');
await db.query(`update public.articles set content = 'v1' where id = $1`, [revivedId]);
for (let index = 2; index <= 55; index += 1) {
  await db.query(`update public.articles set content = $1 where id = $2`, [`v${index}`, revivedId]);
}
const kept = await one(`select count(*)::int as n from public.article_revisions where article_id = $1`, [revivedId]);
assert(kept.n === 40, `55 edits keep the newest 40 versions (kept ${kept.n})`);
const newest = await one(
  `select content from public.article_revisions where article_id = $1 order by created_at desc limit 1`, [revivedId]);
assert(newest.content === 'v54', 'and the newest one is the one edited a moment ago');

section('Only an admin restores');
await asUser(editor);
let refused = false;
try {
  await db.query(`select public.restore_article_revision((select id from public.article_revisions limit 1))`);
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
console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
