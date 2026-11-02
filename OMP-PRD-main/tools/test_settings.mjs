#!/usr/bin/env node
/* ============================================================
   Settings: defaults that cannot quietly change the site.

   Two things are worth testing here, and neither needs a browser.

   The first is normalise(). It is the only thing standing between a stored row
   and a decision about the next article: a status of "Publshed", a category id
   that is not a uuid, a string where a boolean belongs. Every one of those has
   to land on the safe value silently, because the alternative is a default that
   publishes everything.

   The second is the contract around it: one row, update-only, and the publish
   path actually consulting the switch. A setting that saves but is never read
   is a checkbox that lies.

   Run: node tools/test_settings.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLBACK, normalise, load, current, adopt, reset } from '../assets/js/admin/panel-settings.js';

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

/* ------------------------------------------------------------ normalise */

section('A missing or broken row becomes the safe defaults');

const fallback = normalise(null);
assert(fallback.default_status === 'draft', 'no row means a new article is a draft');
assert(fallback.default_category_id === null, 'no row means no default category');
assert(fallback.autodeploy_on_save === true, 'no row still deploys - silently not deploying looks like success');

assert(normalise(undefined).default_status === 'draft', 'undefined is treated like null');
assert(normalise('not a row').default_status === 'draft', 'a string is not a row');

section('A status that is not recognised is not trusted');

assert(normalise({ default_status: 'published' }).default_status === 'published', 'published survives');
assert(normalise({ default_status: 'PUBLISHED' }).default_status === 'published', 'case does not matter');
assert(normalise({ default_status: 'Publshed' }).default_status === 'draft', 'a typo falls back to draft, not to live');
assert(normalise({ default_status: 'scheduled' }).default_status === 'draft', 'scheduled is not a default a form can prefill');
assert(normalise({ default_status: '' }).default_status === 'draft', 'an empty status is draft');

section('A category id that is not a uuid is dropped, not sent to Postgres');

const uuid = '3f2a1c4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
assert(normalise({ default_category_id: uuid }).default_category_id === uuid, 'a uuid is kept');
assert(normalise({ default_category_id: 'Guides' }).default_category_id === null, 'a name is not an id');
assert(normalise({ default_category_id: '' }).default_category_id === null, 'an empty string is not an id');
assert(normalise({ default_category_id: 42 }).default_category_id === null, 'a number is not an id');

section('The deploy switch honours an explicit off, and nothing else');

assert(normalise({ autodeploy_on_save: false }).autodeploy_on_save === false, 'false is a decision and is kept');
assert(normalise({ autodeploy_on_save: true }).autodeploy_on_save === true, 'true is true');
assert(normalise({ autodeploy_on_save: 'false' }).autodeploy_on_save === true, 'the string "false" is not false - only a boolean is');
assert(normalise({ autodeploy_on_save: 0 }).autodeploy_on_save === true, '0 is not a boolean and falls back to deploying');
assert(normalise({ autodeploy_on_save: null }).autodeploy_on_save === true, 'null falls back to deploying');

/* ------------------------------------------------------------ caching */

const client = (row, error = null, counter = { reads: 0 }) => ({
  counter,
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => { counter.reads += 1; return { data: row, error }; }
      })
    })
  })
});

section('One read per page load, and a failed read still leaves a working panel');

reset();
assert(current().default_status === 'draft', 'before any read, the fallback is already in place');

const good = client({ id: 1, default_status: 'published', default_category_id: uuid, autodeploy_on_save: false });
await load(good);
assert(current().default_status === 'published', 'the first read populates the cache');
assert(current().autodeploy_on_save === false, 'and so does the switch');
await load(good);
assert(good.counter.reads === 1, 'the second call is served from the cache, not the database');

reset();
const broken = client(null, { code: '42P01', message: 'relation "public.panel_settings" does not exist' });
await load(broken);
assert(current().default_status === 'draft', 'a missing table leaves the panel on draft');
assert(current().autodeploy_on_save === true, 'a missing table does not silently stop deploying');

reset();
const offline = { from: () => { throw new Error('offline'); } };
await load(offline);
assert(current().default_status === 'draft', 'a client that throws is the same as a failed read');

reset();
await load(good, { force: true });
assert(good.counter.reads === 2, 'force re-reads, which is what the Settings tab needs after saving');

adopt({ default_status: 'published', autodeploy_on_save: false });
assert(current().default_status === 'published' && current().autodeploy_on_save === false,
  'adopt() applies what was just saved without a reload');
reset();
assert(FALLBACK.default_status === 'draft' && FALLBACK.autodeploy_on_save === true,
  'the exported fallback is frozen and unchanged by adopt()');

/* ------------------------------------------------------ the contract */

section('Saving writes one row, and never creates one');

const settingsSource = read('assets/js/admin/settings.js');
assert(/from\('panel_settings'\)\s*\n?\s*\.update\(/.test(settingsSource), 'the settings form updates the row');
assert(/\.eq\('id', 1\)/.test(settingsSource), 'it updates row 1, the only row there is');
assert(!/from\('panel_settings'\)[\s\S]{0,80}\.insert\(/.test(settingsSource), 'it never inserts a second row');
assert(!/from\('panel_settings'\)[\s\S]{0,80}\.delete\(/.test(settingsSource), 'it never deletes the row');

section('The switches are read where they matter');

const admin = read('assets/js/admin.js');
assert(/status === 'published' && panelSettings\(\)\.autodeploy_on_save/.test(admin),
  'saving a published article only deploys when the switch is on');
assert(/articleForm\(editor, categories \|\| \[\], null, panelSettings\(\)\)/.test(admin),
  'a new article form starts from the saved defaults');
assert(/status:start\.default_status/.test(admin) && /category_id:start\.default_category_id/.test(admin),
  'the defaults reach the status and category fields');
assert(/await loadPanelSettings\(supabase\)/.test(admin),
  'the cache is warmed when the articles tab opens, not on the save path');

section('The screen says what it cannot change');

assert(/Read-only on purpose/.test(settingsSource), 'site identity is labelled read-only');
assert(/would rewrite every canonical tag/.test(settingsSource),
  'and says why, instead of leaving the reader to guess');
assert(/requestPublish\('settings: whole site'/.test(settingsSource),
  'there is a whole-site deploy button for when auto-deploy is off');
assert(/esc\(cat\.name\)/.test(settingsSource), 'category names are escaped into the select');
assert(/42P01|does not exist/.test(settingsSource), 'a missing table is named, not swallowed');

section('The migration keeps the table to one admin-owned row');

const migration = read('supabase/migrations/20261102120000_panel_settings.sql');
assert(/id\s+smallint primary key default 1 check \(id = 1\)/.test(migration), 'the primary key refuses a second row');
assert(/insert into public\.panel_settings \(id\) values \(1\) on conflict \(id\) do nothing/.test(migration),
  'the row exists before the panel ever asks for it');
assert(/revoke insert, delete on public\.panel_settings from anon, authenticated/.test(migration),
  'neither browser role can create or remove a row');
assert(/grant select, update on public\.panel_settings to authenticated/.test(migration),
  'an admin session can read it and change it');
assert(/for select to authenticated using \(public\.is_admin\(\)\)/.test(migration), 'reading is admin-only');
assert(/panel_settings_touch_updated_at[\s\S]{0,120}touch_updated_at/.test(migration),
  'updated_at is maintained by the trigger, not by the panel remembering to send it');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
