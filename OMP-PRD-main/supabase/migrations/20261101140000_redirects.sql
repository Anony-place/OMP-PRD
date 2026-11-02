-- ============================================================================
--  Managed redirects.
--
--  Renaming a slug used to be a silent 404 for every link and every ranking that
--  URL had earned. The panel will now write old -> new here, and the generator
--  turns these rows into real 301s.
--
--  Why a table and not "edit firebase.json by hand": the panel cannot edit a
--  file, and a redirect nobody records is a redirect nobody can audit later.
--
--  Read is public: these are request paths, not data. The site's own generator
--  reads them with the publishable key, so a redirect can be added without any
--  secret in the browser.
-- ============================================================================

create table if not exists public.redirects (
  from_path   text primary key,
  to_path     text not null,
  status_code integer not null default 301 check (status_code in (301, 308)),
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

-- Both sides are request paths: leading slash, no scheme, no host. The check
-- lives in the database because a bad row here would ship a broken redirect to
-- every visitor and the build is not allowed to be the only guard.
alter table public.redirects add constraint redirects_from_path_shape
  check (from_path like '/%' and from_path not like '%://%');
alter table public.redirects add constraint redirects_to_path_shape
  check (to_path like '/%' and to_path not like '%://%' or to_path like 'https://%');

alter table public.redirects enable row level security;

drop policy if exists "redirects_select_all" on public.redirects;
create policy "redirects_select_all" on public.redirects
  for select to anon, authenticated using (true);

drop policy if exists "redirects_write_admin" on public.redirects;
create policy "redirects_write_admin" on public.redirects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

/* scripts/sync-redirects.mjs reads this with the publishable key on every
   build, so anon needs SELECT or a redirect added in the panel never becomes a
   301. The panel writes with an admin session. */
grant select on public.redirects to anon;
grant select, insert, update, delete on public.redirects to authenticated;

comment on table public.redirects is
  'Old path -> new path. Generated into vercel.json by scripts/build-vercel-config.mjs; never edit that file by hand.';
