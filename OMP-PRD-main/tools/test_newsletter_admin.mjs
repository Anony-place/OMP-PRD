#!/usr/bin/env node
/* ============================================================
   Newsletter admin functions, against a real Postgres.

   These two functions are the only door into tables that are revoked from
   every browser role: a list of email addresses must not be readable through
   the API by anyone holding the publishable key. So the checks that matter are
   about the door, not the room:

     * a non-admin gets an error, not a list
     * anon cannot call it at all
     * an admin cannot put somebody on the list without consent
     * unsubscribing cancels queued mail, because "removed" that still gets
       three emails is a complaint waiting to happen

   Run: node tools/test_newsletter_admin.mjs
   ============================================================ */

import fs from 'node:fs';
import { createTestDb, reporter, migrationPath, ADMIN_ID, EDITOR_ID } from './lib/pg.mjs';

const { section, assert, finish } = reporter();

/* The 2026-09 newsletter migration is what creates the tables; the admin one
   builds on it. Both are applied, in order, so the fixture is the real shape. */
const db = await createTestDb({ admins: true });

for (const file of [
  '20260929210000_article_newsletter.sql',
  '20261101180000_newsletter_admin.sql'
]) {
  try {
    await db.exec(fs.readFileSync(migrationPath(file), 'utf8'));
    assert(true, `${file} applies`);
  } catch (error) {
    assert(false, `${file} applies (${error.message})`);
    console.log(`\n0 passed, 1 failed\n`);
    process.exit(1);
  }
}

await db.asAdmin();

const add = async (email, status = 'active') => db.one(
  `insert into public.newsletter_subscribers (email, status, confirmed_at)
   values ($1, $2, case when $2 = 'active' then now() else null end)
   returning id, email, status`,
  [email.toLowerCase(), status]
);
const article = async (title, slug) => db.one(
  `insert into public.articles (title, slug, status, published_at)
   values ($1, $2, 'published', now()) returning id`,
  [title, slug]
);

section('The overview counts the audience, not the signups');
await add('a@example.test');
await add('b@example.test');
await add('c@example.test', 'pending');
const leaving = await add('d@example.test');
await db.run(`update public.newsletter_subscribers set status = 'unsubscribed' where id = $1`, [leaving.id]);

let overview = await db.one(`select public.newsletter_overview() as data`);
let data = overview.data;
assert(data.subscribers.total === 4, 'four rows');
assert(data.subscribers.active === 2, 'two are confirmed subscribers');
assert(data.subscribers.pending === 1, 'one typed an address and never confirmed');
assert(data.subscribers.unsubscribed === 1, 'one left');
assert(data.subscribers.joined_7d === 2, 'and the last week counts only the confirmed ones');

section('Publishing queues mail for the active, and only for them');
const published = await article('New guide', 'new-guide');
const queued = await db.all(`select * from public.newsletter_deliveries where article_id = $1`, [published.id]);
assert(queued.length === 2, 'two deliveries, one per active subscriber');
assert(!queued.some((row) => row.email), 'the delivery row does not carry the address - it joins to it');

overview = await db.one(`select public.newsletter_overview() as data`);
assert(overview.data.deliveries.pending === 2, 'the overview sees them as pending');

section('Unsubscribing cancels what is already queued');
const leaving2 = await add('e@example.test');
const second = await article('Another guide', 'another-guide');
assert((await db.all(`select 1 from public.newsletter_deliveries where article_id = $1`, [second.id])).length === 3,
  'three active subscribers were queued');

const changed = await db.one(`select public.newsletter_set_status($1, 'unsubscribed') as status`, [leaving2.id]);
assert(changed.status === 'unsubscribed', 'the admin can unsubscribe on request');
const cancelled = await db.all(
  `select state from public.newsletter_deliveries where subscriber_id = $1`, [leaving2.id]);
assert(cancelled.every((row) => row.state === 'cancelled'), 'and every queued delivery for them is cancelled');
assert((await db.one(`select status from public.newsletter_subscribers where id = $1`, [leaving2.id])).status === 'unsubscribed',
  'the row is kept, because it is the record that they asked');

section('Consent cannot be granted by an admin');
let refusedPending = null;
try {
  await db.run(`select public.newsletter_set_status($1, 'pending')`, [leaving.id]);
} catch (error) {
  refusedPending = error.message;
}
assert(Boolean(refusedPending) && /active or unsubscribed/.test(refusedPending),
  'an admin cannot set "pending" - confirming needs the inbox');

const readded = await db.one(`select public.newsletter_set_status($1, 'active') as status`, [leaving.id]);
assert(readded.status === 'active', 'but re-activating a known address is allowed, for when the same person asks back');
const row = await db.one(`select confirmed_at from public.newsletter_subscribers where id = $1`, [leaving.id]);
assert(Boolean(row.confirmed_at), 'and that sets a confirmation time, so growth stats stay honest');

section('A missing subscriber is an error, not a silent no-op');
let missing = null;
try {
  await db.run(`select public.newsletter_set_status(gen_random_uuid(), 'unsubscribed')`);
} catch (error) {
  missing = error.message;
}
assert(Boolean(missing) && /no such subscriber/.test(missing), 'the panel is told, so it cannot report success');

section('The door is admin-only');
await db.asUser(EDITOR_ID);
let editorRefused = null;
try {
  await db.run(`select public.newsletter_overview()`);
} catch (error) {
  editorRefused = error.message;
}
assert(Boolean(editorRefused) && /not an admin/.test(editorRefused), 'a signed-in non-admin cannot read the list');

let editorWriteRefused = null;
try {
  await db.run(`select public.newsletter_set_status($1, 'unsubscribed')`, [leaving.id]);
} catch (error) {
  editorWriteRefused = error.message;
}
assert(Boolean(editorWriteRefused) && /not an admin/.test(editorWriteRefused), 'nor change anybody');

await db.asAnon();
let anonRead = null;
try {
  await db.run(`select public.newsletter_overview()`);
} catch (error) {
  anonRead = error.message;
}
assert(Boolean(anonRead), 'an anonymous caller cannot read the list either');

const grants = await db.all(`
  select p.proname, r.rolname as grantee
    from information_schema.routine_privileges rp
    join pg_proc p on p.proname = rp.routine_name
    join pg_roles r on r.rolname = rp.grantee
   where p.proname in ('newsletter_overview', 'newsletter_set_status')`);
assert(!grants.some((row) => row.grantee === 'anon'),
  'anon holds no execute privilege on either function');
assert(grants.filter((row) => row.grantee === 'authenticated').length === 2,
  'authenticated holds both, and is_admin decides inside');

section('The tables stay shut');
for (const table of ['newsletter_subscribers', 'newsletter_deliveries']) {
  const policies = await db.all(`select policyname from pg_policies where tablename = $1`, [table]);
  assert(policies.length === 0, `${table} still has no policy - the functions are the only way in`);
}
const tableGrants = await db.all(`
  select table_name, grantee from information_schema.role_table_grants
   where table_name in ('newsletter_subscribers','newsletter_deliveries')
     and grantee in ('anon','authenticated')`);
assert(tableGrants.length === 0, 'and no browser role has a table grant');

section('Confirming is still not an admin job');
const pending = await add('f@example.test', 'pending');
await db.run(`update public.newsletter_subscribers set confirmation_hash = 'hash-123', confirmation_expires_at = now() + interval '1 hour' where id = $1`, [pending.id]);
const confirmed = await db.one(`select public.newsletter_confirm('hash-123') as ok`);
assert(confirmed.ok === true, 'the public confirm path still works, unchanged');
const after = await db.one(`select status, confirmation_hash from public.newsletter_subscribers where id = $1`, [pending.id]);
assert(after.status === 'active' && after.confirmation_hash === null, 'and the hash is cleared once used');

await db.close();
finish();
