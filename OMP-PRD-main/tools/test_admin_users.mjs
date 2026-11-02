#!/usr/bin/env node
/* ============================================================
   Admin access, against a real Postgres.

   Granting access used to be a hand-written UPDATE. The two ways that goes wrong
   are both expensive and both one keystroke apart:

     * a missing WHERE gives everyone access
     * a WHERE that matches the last admin removes the only person who can
       publish

   The checks here are about those two, plus the audit row that answers "who gave
   them access" afterwards.

   Run: node tools/test_admin_users.mjs
   ============================================================ */

import fs from 'node:fs';
import { createTestDb, reporter, migrationPath, ADMIN_ID, EDITOR_ID } from './lib/pg.mjs';

const { section, assert, finish } = reporter();

const db = await createTestDb({ admins: true });
for (const file of ['20261101170000_audit_log.sql', '20261101190000_admin_users.sql']) {
  try {
    await db.exec(fs.readFileSync(migrationPath(file), 'utf8'));
    assert(true, `${file} applies`);
  } catch (error) {
    assert(false, `${file} applies (${error.message})`);
    console.log(`\n0 passed, 1 failed\n`);
    process.exit(1);
  }
}

section('Who has access');
await db.asAdmin();
let admins = await db.all(`select * from public.list_admins()`);
assert(admins.length === 1, 'only the real admin is listed, not every account');
assert(admins[0].email === 'admin@example.test', 'with the address, so a person is identifiable');

const counts = await db.one(`select public.admin_counts() as data`);
assert(counts.data.admins === 1 && counts.data.accounts === 2, 'and the counts separate "has access" from "signed up"');

section('Granting access');
const granted = await db.one(`select public.set_admin_access('editor@example.test', true) as result`);
assert(granted.result === 'granted', 'an existing account can be made an admin');
admins = await db.all(`select * from public.list_admins()`);
assert(admins.length === 2, 'and appears in the list');
assert(await db.one(`select is_admin from public.profiles where id = $1`, [EDITOR_ID]).then((row) => row.is_admin) === true,
  'the profile row is what changed - the panel reads that everywhere');

const again = await db.one(`select public.set_admin_access('editor@example.test', true) as result`);
assert(again.result === 'already an admin', 'granting twice is a no-op, not an error');
assert((await db.all(`select * from public.list_admins()`)).length === 2, 'and does not duplicate anything');

const caseVariation = await db.one(`select public.set_admin_access('EDITOR@example.test', true) as result`);
assert(caseVariation.result === 'already an admin', 'the email is matched case-insensitively, as logins are');

section('Unknown people cannot be invented');
let unknown = null;
try {
  await db.run(`select public.set_admin_access('nobody@example.test', true)`);
} catch (error) {
  unknown = error.message;
}
assert(Boolean(unknown) && /sign in once first/.test(unknown), 'an email with no account is refused with the reason');
assert((await db.all(`select * from public.list_admins()`)).length === 2, 'and nothing was created');

section('The two refusals that keep the panel usable');
let self = null;
try {
  await db.run(`select public.set_admin_access('admin@example.test', false)`);
} catch (error) {
  self = error.message;
}
assert(Boolean(self) && /cannot remove your own access/.test(self), 'an admin cannot remove their own access');
assert(await db.one(`select is_admin from public.profiles where id = $1`, [ADMIN_ID]).then((row) => row.is_admin) === true,
  'and the refusal left the row alone');

/* Now there are two admins, so removing one is allowed. */
const removed = await db.one(`select public.set_admin_access('editor@example.test', false) as result`);
assert(removed.result === 'removed', 'a second admin can be removed');
assert((await db.all(`select * from public.list_admins()`)).length === 1, 'leaving one');

section('A second admin is a way back in, not a way out');
/* The caller always counts as an admin, so while two admins exist the
   "last admin" arithmetic can never reach 1. That check is defence in depth
   against a future change to is_admin(), and it is asserted as source below
   rather than pretended to be reachable through the API. What IS reachable is
   the important half: you cannot remove yourself, so a mistake always leaves
   somebody who can undo it. */
/* The "leaving one" step above removed the editor again, so grant first. */
await db.run(`select public.set_admin_access('editor@example.test', true)`);
const withTwo = await db.all(`select * from public.list_admins()`);
assert(withTwo.length === 2, 'two admins can exist at once');

const functionBody = await db.one(`
  select pg_get_functiondef(p.oid) as body
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_admin_access'`);
assert(/last admin/.test(functionBody.body), 'the last-admin guard is in the function');
assert(/admins_left <= 1/.test(functionBody.body), 'and it is a count check, not a comment');
assert(/cannot remove your own access/.test(functionBody.body), 'as is the self-removal guard');

section('Every change is recorded');
await db.asAdmin();
/* Editor was removed above; granting again is the change under test. */
await db.run(`select public.set_admin_access('editor@example.test', true)`);
const log = await db.all(`select * from public.audit_log where table_name = 'profiles' order by id desc`);
assert(log.length > 0, 'access changes land in the audit log');
const entry = log[0];
assert(entry.action === 'update', 'as an update');
assert(Array.isArray(entry.changed) && entry.changed.includes('is_admin'), 'naming the field that changed');
assert(entry.detail?.target === 'editor@example.test', 'the target address');
assert(entry.detail?.is_admin === true, 'and which direction the access moved');
assert(entry.actor !== null, 'with the actor, so "who did this" has an answer');

section('The door is admin-only');
await db.asUser(EDITOR_ID);
await db.run(`update public.profiles set is_admin = false where id = $1`, [EDITOR_ID]);
let editorRefused = null;
try {
  await db.run(`select public.list_admins()`);
} catch (error) {
  editorRefused = error.message;
}
assert(Boolean(editorRefused) && /not an admin/.test(editorRefused), 'a non-admin cannot list who has access');

let editorGrant = null;
try {
  await db.run(`select public.set_admin_access('editor@example.test', true)`);
} catch (error) {
  editorGrant = error.message;
}
assert(Boolean(editorGrant) && /not an admin/.test(editorGrant), 'and cannot grant access to themselves - the classic escalation');

await db.asAnon();
let anonList = null;
try {
  await db.run(`select public.list_admins()`);
} catch (error) {
  anonList = error.message;
}
assert(Boolean(anonList), 'an anonymous caller gets nothing');

const grants = await db.all(`
  select r.rolname as grantee, p.proname
    from information_schema.routine_privileges rp
    join pg_proc p on p.proname = rp.routine_name
    join pg_roles r on r.rolname = rp.grantee
   where p.proname in ('list_admins','admin_counts','set_admin_access')`);
assert(!grants.some((row) => row.grantee === 'anon'), 'anon holds no execute privilege');

section('Empty input is refused before it can match everybody');
await db.asAdmin();
for (const value of ['', '   ', null]) {
  let refused = null;
  try {
    await db.run(`select public.set_admin_access($1, true)`, [value]);
  } catch (error) {
    refused = error.message;
  }
  assert(Boolean(refused), `"${value === null ? 'null' : value}" is refused rather than matching a row`);
}

await db.close();
finish();
