-- ============================================================================
--  Settings that change how the panel behaves.
--
--  Not site content, and deliberately not the site's address. The canonical
--  origin, the sitemap and the mailto on /contact are baked into the build by
--  scripts/build-static-seo.mjs; putting them behind a browser-editable row
--  would mean one wrong keystroke rewrites every canonical tag on the site and
--  takes the rankings with it. Those stay in files, reviewed like code.
--
--  What belongs here is the small set of decisions that only affect the next
--  thing the panel does:
--
--    default_status       what a new article starts as
--    default_category_id  which category a new article is filed under
--    autodeploy_on_save   whether saving a published article starts a build
--
--  One row, forever. `check (id = 1)` plus a revoke on insert and delete means
--  "which settings apply" can never depend on row order or on a second row
--  somebody added in the SQL editor.
--
--  Why `panel_settings` and not `site_settings`: the live database already has
--  a `site_settings` key/value table from the vnext experiment - uuid id,
--  setting_key, setting_value jsonb, zero rows, and a `site_public` policy that
--  lets anon read every row. Reusing that name would have meant either writing
--  panel switches into a publicly readable table or deleting a policy nobody
--  documented. A separate table with its own admin-only policies is the honest
--  option, and the name says which of the two this is.
-- ============================================================================

create table if not exists public.panel_settings (
  id                 smallint primary key default 1 check (id = 1),
  default_status     text not null default 'draft' check (default_status in ('draft', 'published')),
  /* A category that is deleted leaves the default empty rather than pointing at
     a row that is gone. */
  default_category_id uuid references public.article_categories(id) on delete set null,
  autodeploy_on_save boolean not null default true,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null
);

/* The row exists from the moment the table does, so the panel never has to
   distinguish "no settings" from "default settings". */
insert into public.panel_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists panel_settings_touch_updated_at on public.panel_settings;
create trigger panel_settings_touch_updated_at
  before update on public.panel_settings
  for each row execute function public.touch_updated_at();

alter table public.panel_settings enable row level security;

/* Read and write are both admin-only. Nothing on the public site reads this, so
   there is no reason for anon to see which defaults the panel uses. */
drop policy if exists "panel_settings_select_admin" on public.panel_settings;
create policy "panel_settings_select_admin" on public.panel_settings
  for select to authenticated using (public.is_admin());

drop policy if exists "panel_settings_update_admin" on public.panel_settings;
create policy "panel_settings_update_admin" on public.panel_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, delete on public.panel_settings from anon, authenticated;
revoke update on public.panel_settings from anon;
grant select, update on public.panel_settings to authenticated;

comment on table public.panel_settings is
  'Panel behaviour: defaults for a new article and whether saving starts a deploy. One row. Not site content.';
