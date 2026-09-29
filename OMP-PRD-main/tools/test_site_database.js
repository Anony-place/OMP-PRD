/* Actual base site SQL against disposable PostgreSQL, not source-text assertions.
 * Supabase-owned auth/storage primitives are modeled; no remote DSN accepted. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const ADMIN = '10000000-0000-4000-8000-000000000001';
const USER = '10000000-0000-4000-8000-000000000002';
let checks = 0;
const ok = text => { checks++; console.log('✓ ' + text); };
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to anon,authenticated;
      grant all on storage.objects to anon,authenticated;
      alter default privileges in schema public grant all on tables to anon,authenticated;`);
    const schema = fs.readFileSync('supabase/00_schema_migrations.sql', 'utf8');
    await db.exec(schema);
    await db.exec(schema);
    ok('Fresh base schema installs and can be rerun without missing relations or duplicate policies');
    await db.exec(`insert into auth.users values('${ADMIN}'),('${USER}');
      insert into profiles(id,email,is_admin) values('${ADMIN}','admin@example.test',true),('${USER}','user@example.test',false);
      insert into articles(title,slug,status) values('Draft','draft','draft'),('Public','public','published');
      insert into products(name,slug,status) values('Draft','draft','draft'),('Public','public','published');
      insert into tools(name,slug,is_active) values('Inactive','inactive',false),('Active','active',true);
      insert into storage.objects(bucket_id,name) values('products','cover.png'),('product-files','paid.pdf');`);
    async function as(role, id = '') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec('set role ' + role);
    }
    await as('anon');
    for (const table of ['articles','products','tools']) assert.equal((await db.query('select * from ' + table)).rows.length, 1);
    for (const table of ['profiles','media','contact_messages']) await assert.rejects(db.query('select * from ' + table));
    await assert.rejects(db.query("insert into articles(title,slug) values('Attacker','attacker')"));
    ok('Anonymous readers see published/active content only, never private records or admin writes');
    await db.query("insert into contact_messages(name,email,message) values('Test','test@example.test','Hello')");
    for (const field of ["status", "created_at", "ip_hash", "read_at"]) {
      await assert.rejects(db.query(`insert into contact_messages(name,email,message,${field}) values('Test','x@y.test','Cannot forge',null)`));
    }
    ok('Contact insertion accepts only name/email/message, not server-managed metadata');
    await as('authenticated', USER);
    assert.deepEqual((await db.query('select id from profiles')).rows.map(r => r.id), [USER]);
    await assert.rejects(db.query('update profiles set is_admin=true'));
    await assert.rejects(db.query("insert into articles(title,slug) values('No permission','forbidden')"));
    assert.equal((await db.query('select * from contact_messages')).rows.length, 0);
    for (const table of ['articles','products','tools']) assert.equal((await db.query('select * from ' + table)).rows.length, 1);
    ok('Authenticated non-admins cannot promote themselves, write CMS content or read inboxes');
    for (const role of ['anon','authenticated']) {
      await as(role, role === 'authenticated' ? USER : '');
      assert.deepEqual((await db.query('select name from storage.objects')).rows.map(r => r.name), ['cover.png']);
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('products','evil.html')"));
    }
    ok('Covers remain public while paid files and all upload paths stay admin-only');
    await as('authenticated', ADMIN);
    assert.equal((await db.query('select * from articles')).rows.length, 2);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 2);
    await db.query("insert into articles(title,slug,status) values('Admin edit','admin-edit','published')");
    await db.query("update contact_messages set status='read'");
    await db.query("insert into storage.objects(bucket_id,name) values('products','admin-cover.png')");
    ok('Authorized admin retains CMS, private file and inbox access');
    console.log(`\n${checks} site database groups passed. Disposable local PostgreSQL only.`);
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
