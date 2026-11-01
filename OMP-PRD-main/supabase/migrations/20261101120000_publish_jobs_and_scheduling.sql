-- ============================================================================
--  Publishing from the panel reaches the site by itself.
--
--  The panel already writes an article row. The article's own page
--  (/articles/<slug>) is static HTML produced by scripts/build-static-seo.mjs,
--  so the row on its own is only a feed entry. This migration adds the two
--  pieces that make the rest automatic:
--
--    * articles.scheduled_for  - publish later, without being at the keyboard
--    * publish_jobs            - one row per deploy request, so the panel can
--                                say "live" only when the page is really live
--
--  Status gains 'scheduled'. It is deliberately NOT visible to anon: the public
--  read policy is `status = 'published'`, so a scheduled row stays private until
--  the cron promotes it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Scheduling
-- ---------------------------------------------------------------------------
alter table public.articles drop constraint if exists articles_status_check;
alter table public.articles add constraint articles_status_check
  check (status in ('draft', 'scheduled', 'published', 'archived'));

alter table public.articles add column if not exists scheduled_for timestamptz;

comment on column public.articles.scheduled_for is
  'When status = scheduled, the moment the cron should flip it to published. Ignored otherwise.';

-- The cron asks for "due rows" every 15 minutes; without this it scans the
-- table each time.
create index if not exists articles_scheduled_due_idx
  on public.articles (scheduled_for)
  where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- 2. publish_jobs
--
-- One row per request to rebuild + commit + deploy. The panel reads the newest
-- row for its status chip; the workflow updates it. Created by the edge
-- function with the service role, never by the browser.
-- ---------------------------------------------------------------------------
create table if not exists public.publish_jobs (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users(id) on delete set null,
  reason       text not null default 'manual',
  targets      text[] not null default '{}',
  status       text not null default 'queued'
               check (status in ('queued', 'running', 'deploying', 'live', 'failed', 'skipped')),
  detail       text,
  run_url      text,
  commit_sha   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists publish_jobs_recent_idx
  on public.publish_jobs (created_at desc);

alter table public.publish_jobs enable row level security;

-- Admins can watch the queue. Nobody writes from the browser: rows come from the
-- edge function (service role, bypasses RLS) and updates come from the workflow
-- (service role again). A client insert policy here would let any admin forge a
-- "live" status.
drop policy if exists "publish_jobs_select_admin" on public.publish_jobs;
create policy "publish_jobs_select_admin" on public.publish_jobs
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.publish_jobs from anon, authenticated;
grant select on public.publish_jobs to authenticated;
