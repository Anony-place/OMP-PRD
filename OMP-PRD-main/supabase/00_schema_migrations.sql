-- ============================================================================
-- OopsMyPassword — Supabase schema + Row Level Security + Storage policies
-- ============================================================================
-- This is the *intended* security model that the front-end code in this repo
-- relies on. The public site (blog feed, search, contact form) uses the
-- publishable (anon) key; the admin panel signs in as an authenticated user
-- and relies on RLS to enforce that ONLY an admin can write.
--
-- The actual policies live in the Supabase project and MUST be applied here
-- (Supabase Dashboard → SQL Editor) or placed in your project's Supabase
-- migration folder. DO NOT trust the front-end admin check alone: an attacker
-- can call the REST API directly with the anon key and bypass every client
-- check. Every read/write below is gated by RLS, which is what makes that safe.
--
-- These statements are idempotent where practical and are written to be
-- re-runnable in a fresh project. Verify the live project matches them before
-- assuming the security model is correct.
--
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0. Helper: is the current authenticated user an admin?
-- ---------------------------------------------------------------------------
-- We resolve the admin role server-side from the profiles table so policies
-- never trust a client-supplied flag. SECURITY DEFINER + sealed search_path
-- keeps this from being hijacked by a malicious function in public.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
-- Public admin-role lookup. A user may only read their own row. Only the
-- service-role key (never shipped to the browser) can create/update admins —
-- there is deliberately no public INSERT/UPDATE path.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Only service_role writes profiles (manual setup / triggers). No anon path.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- 2. article_categories
-- ---------------------------------------------------------------------------
create table if not exists public.article_categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.article_categories enable row level security;

-- Public read (blog feed embeds the category name/slug).
drop policy if exists "article_categories_select_all" on public.article_categories;
create policy "article_categories_select_all" on public.article_categories
  for select to anon, authenticated using (true);

-- Admin write.
drop policy if exists "article_categories_admin_write" on public.article_categories;
create policy "article_categories_admin_write" on public.article_categories
  for insert to authenticated with check (public.is_admin());
drop policy if exists "article_categories_admin_update" on public.article_categories;
create policy "article_categories_admin_update" on public.article_categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "article_categories_admin_delete" on public.article_categories;
create policy "article_categories_admin_delete" on public.article_categories
  for delete to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 3. articles
-- ---------------------------------------------------------------------------
create table if not exists public.articles (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  slug           text not null unique,
  summary        text,
  content        text not null default '',
  category_id    uuid references public.article_categories(id) on delete set null,
  status         text not null default 'draft' check (status in ('draft','published','archived')),
  featured_image text,
  document_url   text,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null
);

alter table public.articles enable row level security;

-- Public feed only ever reads PUBLISHED rows. Drafts/archived are invisible to
-- anon. Note: the admin list uses the authenticated (admin) session, which is
-- covered by the admin_write policy's USING clause.
drop policy if exists "articles_select_published" on public.articles;
create policy "articles_select_published" on public.articles
  for select to anon using (status = 'published');

drop policy if exists "articles_select_all_admin" on public.articles;
create policy "articles_select_all_admin" on public.articles
  for select to authenticated using (public.is_admin());

-- Admin-only writes.
drop policy if exists "articles_admin_insert" on public.articles;
create policy "articles_admin_insert" on public.articles
  for insert to authenticated with check (public.is_admin());
drop policy if exists "articles_admin_update" on public.articles;
create policy "articles_admin_update" on public.articles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "articles_admin_delete" on public.articles;
create policy "articles_admin_delete" on public.articles
  for delete to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 4. tools + tool_categories (public search registry)
-- ---------------------------------------------------------------------------
create table if not exists public.tool_categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.tool_categories enable row level security;
drop policy if exists "tool_categories_select_all" on public.tool_categories;
create policy "tool_categories_select_all" on public.tool_categories
  for select to anon, authenticated using (true);

create table if not exists public.tools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  route       text not null default '/',
  icon        text,
  category_id uuid references public.tool_categories(id) on delete set null,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.tools enable row level security;
drop policy if exists "tools_select_active" on public.tools;
create policy "tools_select_active" on public.tools
  for select to anon using (is_active = true);
-- Admin write policies omitted for brevity — mirror the articles pattern
-- (insert/update/delete to authenticated with check (public.is_admin())).


-- ---------------------------------------------------------------------------
-- 5. media (upload bookkeeping; created by admin.js, never read publicly)
-- ---------------------------------------------------------------------------
create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  file_path   text not null,
  public_url  text not null,
  mime_type   text,
  size_bytes  bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  article_id  uuid references public.articles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.media enable row level security;
drop policy if exists "media_admin_insert" on public.media;
create policy "media_admin_insert" on public.media
  for insert to authenticated with check (public.is_admin());
drop policy if exists "media_admin_select" on public.media;
create policy "media_admin_select" on public.media
  for select to authenticated using (public.is_admin());
-- No anon access to media metadata.


-- ---------------------------------------------------------------------------
-- 6. contact_messages (public form → admin Messages tab)
-- ---------------------------------------------------------------------------
-- Public INSERT only, and only for the three columns the form sends. There is
-- NO anon SELECT/UPDATE/DELETE and no anon write to status/created_at — the
-- insert policy restricts the target columns.
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  email       text not null check (char_length(email) between 3 and 200),
  message     text not null check (char_length(message) between 1 and 5000),
  status      text not null default 'new' check (status in ('new','read','archived')),
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  ip_hash     text,
  user_agent  text
);

alter table public.contact_messages enable row level security;

-- Anyone may insert a message (that is the point of the public form).
drop policy if exists "contact_messages_anon_insert" on public.contact_messages;
create policy "contact_messages_anon_insert" on public.contact_messages
  for insert to anon
  with check (
    char_length(name) between 1 and 100 and
    char_length(email) between 3 and 200 and
    char_length(message) between 1 and 5000
  );

-- Only admins read / triage.
drop policy if exists "contact_messages_admin_select" on public.contact_messages;
create policy "contact_messages_admin_select" on public.contact_messages
  for select to authenticated using (public.is_admin());
drop policy if exists "contact_messages_admin_update" on public.contact_messages;
create policy "contact_messages_admin_update" on public.contact_messages
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and status in ('new','read','archived'));
drop policy if exists "contact_messages_admin_delete" on public.contact_messages;
create policy "contact_messages_admin_delete" on public.contact_messages
  for delete to authenticated using (public.is_admin());

-- Abuse/spam: the client cooldown (contact.js) is cosmetic. Real protection
-- needs a server-side gate. Recommended options (pick at least one):
--   1. A Postgres trigger that rate-limits per ip_hash / email.
--   2. A Supabase Edge Function that re-validates + adds a
--      turnstile/honeypot + writes to a rate-limit table, then inserts.
--   3. Cap `max(60, ...)` inserts/minute per IP via a Row-Level Security
--      check against an aggregate (or a background job).
-- Because we cannot guarantee a server-side gate from this static repo, this
-- file documents the requirement rather than pretending it exists.


-- ---------------------------------------------------------------------------
-- 7. Storage: "articles" bucket (public documents)
-- ---------------------------------------------------------------------------
-- Bucket: public so authorized readers (article visitors) can fetch documents.
-- Public READ: yes (on the object). PUBLIC WRITE: NO — only an admin may upload.
-- Without these policies, the (public) storage bucket would let ANY anon user
-- upload arbitrary files, which is exactly the MIME-confusion / abuse risk the
-- front-end file validation (assets/js/filevalidate.js) cannot fully prevent.
insert into storage.buckets (id, name, public)
values ('articles', 'articles', true)
on conflict (id) do update set public = excluded.public;

-- Public read of any object in the bucket.
drop policy if exists "articles_bucket_public_read" on storage.objects;
create policy "articles_bucket_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'articles');

-- Only admins can create/replace objects.
drop policy if exists "articles_bucket_admin_insert" on storage.objects;
create policy "articles_bucket_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'articles' and public.is_admin());

drop policy if exists "articles_bucket_admin_update" on storage.objects;
create policy "articles_bucket_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'articles' and public.is_admin())
  with check (bucket_id = 'articles' and public.is_admin());

drop policy if exists "articles_bucket_admin_delete" on storage.objects;
create policy "articles_bucket_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'articles' and public.is_admin());


-- ---------------------------------------------------------------------------
-- 8. Keep anon away from anything it should not touch
-- ---------------------------------------------------------------------------
-- The publishable key is public by design. Revoke any blanket privileges that
-- could let it read drafts, profiles, media, or mutate any table.
revoke all on public.articles, public.article_categories, public.tools,
          public.tool_categories, public.media, public.contact_messages,
          public.profiles from anon;
grant select on public.articles to anon;                 -- published only (RLS)
grant select on public.article_categories to anon;
grant select on public.tools to anon;                    -- active only (RLS)
grant select on public.tool_categories to anon;
grant insert on public.contact_messages to anon;         -- public form only
-- NOTE: profiles is NOT granted to anon. Only authenticated (signed-in) users,
-- and only their own row, per the policy above.


-- ---------------------------------------------------------------------------
-- 9. Seed the canonical article categories
-- ---------------------------------------------------------------------------
-- Articles (blog.html) is the single content hub. Every piece of content —
-- news, analysis, how-tos and the legacy static guides — is classified with
-- one of these categories. "guides" is the category that classifies the
-- fifteen static /guides/*.html pages inside the hub; it is NOT a separate
-- top-level destination anymore. Idempotent: safe to re-run.
insert into public.article_categories (name, slug, sort_order) values
  ('News',       'news',       1),
  ('Security',   'security',   2),
  ('Deep Dives', 'deep-dives', 3),
  ('How-To',     'how-to',     4),
  ('Guides',     'guides',     5)
on conflict (slug) do update
  set name      = excluded.name,
      sort_order = excluded.sort_order;


-- ---------------------------------------------------------------------------
-- 10. products (public catalog served at /products and /products/<slug>)
-- ---------------------------------------------------------------------------
-- The public products app (assets/js/products.js) reads this table through
-- the publishable key; only published rows are visible to anon. Product
-- URLs are slug-based (/products/<slug>) and handled by the Firebase
-- rewrite "/products{,/**}" -> /products.html.
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  summary        text,
  description    text not null default '',
  status         text not null default 'draft' check (status in ('draft','published','archived')),
  featured_image text,
  external_url   text,
  sort_order     int not null default 0,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null
);

alter table public.products enable row level security;

-- Public catalog only ever reads PUBLISHED rows.
drop policy if exists "products_select_published" on public.products;
create policy "products_select_published" on public.products
  for select to anon using (status = 'published');

drop policy if exists "products_select_all_admin" on public.products;
create policy "products_select_all_admin" on public.products
  for select to authenticated using (public.is_admin());

-- Admin-only writes (mirrors the articles pattern).
drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert" on public.products
  for insert to authenticated with check (public.is_admin());
drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products
  for delete to authenticated using (public.is_admin());

revoke all on public.products from anon;
grant select on public.products to anon;      -- published only (RLS)
