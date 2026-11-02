/* ============================================================
   A Supabase-shaped Postgres for tests, in pglite.

   Several migrations can only be checked by running them: a trigger, a
   security-definer function, a policy. Reading the SQL proves that it parses,
   which is the least interesting thing about it.

   This builds the smallest faithful environment those migrations need:
   auth.users, auth.uid() reading a claim, profiles.is_admin, and the two
   content tables. Faithful where it matters - is_admin really is a SQL
   function over a real table, so a migration that calls it fails here the way
   it would fail in production.

   Supabase pieces that only exist to satisfy grants are created too, because a
   bare Postgres rejects "grant to authenticated" and that is the first thing a
   migration does.
   ============================================================ */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require_ = createRequire(path.join(ROOT, 'tools/qa-deps/'));

export const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
export const EDITOR_ID = '22222222-2222-2222-2222-222222222222';

const BASE = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $$;

  create schema if not exists auth;
  create table auth.users (
    id uuid primary key,
    email text
  );

  /* current_setting('test.uid') is how a test says who is asking. */
  create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;

  /* Columns match supabase/00_schema_migrations.sql for the fields the panel
     reads. created_at matters: the admin list is ordered by it, and a fixture
     without it turns a working migration into a failing test. */
  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    display_name text,
    is_admin boolean not null default false,
    created_at timestamptz not null default now()
  );
  alter table public.profiles enable row level security;

  create or replace function public.is_admin() returns boolean
    language sql stable security definer set search_path = public as $$
      select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
    $$;

  create table public.article_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    sort_order int not null default 0,
    created_at timestamptz not null default now()
  );
  alter table public.article_categories enable row level security;

  create table public.articles (
    id uuid primary key default gen_random_uuid(),
    title text,
    slug text unique,
    /* Named, because the revisions migration replaces it by name to add
       'scheduled'. An unnamed constraint here would make that migration pass in
       this fixture and fail against the real database. */
    status text not null default 'draft'
      constraint articles_status_check check (status in ('draft','published','archived')),
    category_id uuid references public.article_categories(id) on delete set null,
    content text,
    /* The column list below is public.articles as it exists in production:
       supabase/00_schema_migrations.sql plus the add-column statements in
       supabase/migrations. It used to carry excerpt/seo_title/seo_description/
       cover_image_url as well - names the real table has never had - so code
       written against this fixture passed here and threw 42703 live.
       tools/test_article_schema_parity.mjs now fails if they drift apart. */
    summary text,
    featured_image text,
    document_url text,
    published_at timestamptz,
    created_at timestamptz not null default now(),
    scheduled_for timestamptz,
    meta_title text,
    meta_description text,
    og_image text,
    canonical_url text,
    robots_noindex boolean not null default false,
    created_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
  );
  alter table public.articles enable row level security;

  create table public.products (
    id uuid primary key default gen_random_uuid(),
    name text,
    slug text unique,
    status text not null default 'draft',
    price numeric,
    updated_at timestamptz not null default now()
  );
  alter table public.products enable row level security;

  create table public.tools (
    id uuid primary key default gen_random_uuid(),
    name text,
    slug text unique,
    is_active boolean not null default true,
    updated_at timestamptz not null default now()
  );
  alter table public.tools enable row level security;
`;

/**
 * @param {{ admins?: boolean, migration?: string|string[] }} options
 * @returns {Promise<{db, asUser, asAdmin, asAnon, one, all, exec, run, close}>}
 */
export async function createTestDb({ admins = true, migration = [] } = {}) {
  const { PGlite } = require_('@electric-sql/pglite');
  const db = await PGlite.create();
  await db.exec(BASE);

  const users = admins ? [ADMIN_ID, EDITOR_ID] : [];
  if (users.length) {
    await db.exec(`
      insert into auth.users (id, email) values
        ('${ADMIN_ID}', 'admin@example.test'),
        ('${EDITOR_ID}', 'editor@example.test');
      insert into public.profiles (id, email, is_admin) values
        ('${ADMIN_ID}', 'admin@example.test', true),
        ('${EDITOR_ID}', 'editor@example.test', false);
    `);
  }

  const files = Array.isArray(migration) ? migration : [migration];
  for (const file of files) {
    if (!file) continue;
    await db.exec(file);
  }

  return {
    db,
    /* The claim Supabase would set from the JWT. */
    asUser: (id) => db.query(`select set_config('test.uid', $1, false)`, [id ?? '']).then(() => undefined),
    asAdmin: () => db.query(`select set_config('test.uid', $1, false)`, [ADMIN_ID]).then(() => undefined),
    asAnon: () => db.query(`select set_config('test.uid', '', false)`).then(() => undefined),
    one: async (sql, params) => (await db.query(sql, params)).rows[0],
    all: async (sql, params) => (await db.query(sql, params)).rows,
    run: (sql, params) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    close: () => db.close()
  };
}

export function readMigration(relativePath) {
  const fs = createRequire(import.meta.url)('node:fs');
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

export const migrationPath = (name) => path.join(ROOT, 'supabase/migrations', name);

/* Shared reporting so every database test prints the same way. NODE readouts
   that differ per file are how a suite becomes unreadable. */
export function reporter() {
  let passed = 0;
  const failures = [];
  return {
    section: (name) => console.log(`\n${name}`),
    assert(condition, message) {
      if (condition) { passed += 1; console.log(`  ✓ ${message}`); return true; }
      failures.push(message);
      console.log(`  ✗ ${message}`);
      return false;
    },
    finish() {
      console.log(`\n${passed} passed, ${failures.length} failed\n`);
      if (failures.length) process.exitCode = 1;
      return failures.length === 0;
    }
  };
}

export const fileUrl = (relativePath) => pathToFileURL(path.join(ROOT, relativePath)).href;
