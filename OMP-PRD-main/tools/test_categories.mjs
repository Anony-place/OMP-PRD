#!/usr/bin/env node
/* ============================================================
   Categories, against a real Postgres.

   Two things this migration is for, and both are the kind that only show up
   when it is too late:

     * deleting a category used to un-file every article in it, silently
     * two categories could share a name, and the second was unreachable

   Run: node tools/test_categories.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { createTestDb, reporter, migrationPath } from './lib/pg.mjs';

const { section, assert, finish } = reporter();
const migration = fs.readFileSync(migrationPath('20261101160000_categories.sql'), 'utf8');

const db = await createTestDb({ migration });
await db.asAdmin();

const create = async (name, slug = null, order = 0) => db.one(
  `insert into public.article_categories (name, slug, sort_order) values ($1, coalesce($2, $1), $3) returning *`,
  [name, slug, order]
);
const articleIn = async (title, categoryId) => db.one(
  `insert into public.articles (title, slug, category_id, status) values ($1, $2, $3, 'published') returning *`,
  [title, title.toLowerCase().replace(/\s+/g, '-'), categoryId]
);
const countIn = async (categoryId) => (await db.one(
  `select count(*)::int as n from public.articles where category_id = $1`, [categoryId])).n;

section('A name is one category');
const guides = await create('Guides', 'guides');
assert(guides.slug === 'guides', 'a slug is used as given when it is already clean');

let duplicate = null;
try {
  await create('guides');
} catch (error) {
  duplicate = error.message;
}
assert(Boolean(duplicate), 'the same name in different case is refused');
assert(/article_categories_name_unique|duplicate key/i.test(duplicate || ''), 'and the database is what refuses it, not the panel');

let paddedDuplicate = null;
try {
  await create('  Guides  ');
} catch (error) {
  paddedDuplicate = error.message;
}
assert(Boolean(paddedDuplicate), 'padding does not sneak a second one in');

section('Slugs are clean enough to be a URL');
const mess = await create('How-To: Passwords & Phishing', '');
assert(mess.slug === 'how-to-passwords-phishing', `punctuation and spaces become hyphens (${mess.slug})`);

const inferred = await create('OSINT', '');
assert(inferred.slug === 'osint', 'a slug is derived from the name when none is given');

let emptyName = null;
try {
  await create('   ');
} catch (error) {
  emptyName = error.message;
}
assert(Boolean(emptyName), 'a category with no name is refused');

let noSlug = null;
try {
  await create('!!!');
} catch (error) {
  noSlug = error.message;
}
assert(Boolean(noSlug) && /needs a slug/.test(noSlug), 'a name that cannot make a slug is refused with a reason');

await db.run(`update public.article_categories set name = 'GUIDES' where id = $1`, [guides.id]);
const renamed = await db.one(`select name, slug from public.article_categories where id = $1`, [guides.id]);
assert(renamed.slug === 'guides', 'renaming does not silently change the slug the filter uses');

section('Deleting a category is a decision about its articles');
const news = await create('News', 'news');
const first = await articleIn('First story', news.id);
const second = await articleIn('Second story', news.id);
assert(await countIn(news.id) === 2, 'two articles are filed under it');

const spy = await create('Spy', 'spy');
await articleIn('Tradecraft', spy.id);

const moved = await db.one(`select public.delete_article_category($1, $2) as moved`, [news.id, spy.id]);
assert(moved.moved === 2, 'the function reports how many articles it moved');

const afterMove = await db.all(`select id, category_id from public.articles where id in ($1,$2)`, [first.id, second.id]);
assert(afterMove.every((row) => row.category_id === spy.id), 'and those articles are in the destination');
assert(await db.one(`select count(*)::int as n from public.article_categories where id = $1`, [news.id]).then((r) => r.n) === 0,
  'the category is gone');

section('Uncategorising is explicit, not a side effect');
const tbd = await create('To be decided', 'tbd');
const orphan = await articleIn('Homeless piece', tbd.id);
const movedToNull = await db.one(`select public.delete_article_category($1) as moved`, [tbd.id]);
assert(movedToNull.moved === 1, 'the article count is reported');
const survivor = await db.one(`select category_id from public.articles where id = $1`, [orphan.id]);
assert(survivor.category_id === null, 'and the article survives with no category, because that was the choice');

section('Refusals');
let selfMove = null;
try {
  await db.run(`select public.delete_article_category($1, $1)`, [spy.id]);
} catch (error) {
  selfMove = error.message;
}
assert(Boolean(selfMove), 'a category cannot be merged into itself');
assert(await db.one(`select count(*)::int as n from public.article_categories where id = $1`, [spy.id]).then((r) => r.n) === 1,
  'and the refusal changed nothing');

let missing = null;
try {
  await db.run(`select public.delete_article_category(gen_random_uuid())`);
} catch (error) {
  missing = error.message;
}
assert(Boolean(missing) && /no such category/.test(missing), 'deleting a category that does not exist says so');

let badTarget = null;
try {
  await db.run(`select public.delete_article_category($1, gen_random_uuid())`, [spy.id]);
} catch (error) {
  badTarget = error.message;
}
assert(Boolean(badTarget) && /destination/.test(badTarget), 'moving into a category that does not exist is refused before any row changes');
assert(await countIn(spy.id) >= 1, 'and the articles are untouched by the failed attempt');

section('Only an admin');
await db.asUser(process.env.EDITOR_ID || '22222222-2222-2222-2222-222222222222');
let refused = null;
try {
  await db.run(`select public.delete_article_category($1)`, [spy.id]);
} catch (error) {
  refused = error.message;
}
assert(Boolean(refused) && /not an admin/.test(refused), 'a signed-in non-admin gets an error, not a delete');
assert(await db.one(`select count(*)::int as n from public.article_categories where id = $1`, [spy.id]).then((r) => r.n) === 1,
  'and the category is still there');

await db.asAnon();
let anon = null;
try {
  await db.run(`select public.delete_article_category($1)`, [spy.id]);
} catch (error) {
  anon = error.message;
}
assert(Boolean(anon), 'an anonymous caller cannot run it either');

section('The function is not world-executable');
const grants = await db.all(`
  select grantee, privilege_type from information_schema.routine_privileges
   where routine_name = 'delete_article_category'`);
assert(!grants.some((row) => row.grantee === 'anon'), 'anon has no execute privilege');
assert(grants.some((row) => row.grantee === 'authenticated' && row.privilege_type === 'EXECUTE'),
  'authenticated may call it, and is_admin decides inside');

await db.close();
finish();
