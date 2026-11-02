-- ============================================================================
--  Every save keeps what was there before it.
--
--  The panel writes the article body straight into the row. One paste, one
--  save, and yesterday's article is gone - there is no undo in Postgres and no
--  copy anywhere else until the next deploy rebuilds the page. This migration
--  makes the previous version a row of its own, so "put it back" is a button.
--
--  Written as a trigger, not as panel code, for one reason: capture that depends
--  on every caller remembering to capture is capture that stops working the
--  first time something new writes to the table - the CLI, a script, the SQL
--  editor. The trigger cannot be forgotten.
-- ============================================================================

create table if not exists public.article_revisions (
  id           uuid primary key default gen_random_uuid(),
  /* Monotonic tiebreaker. created_at defaults to now(), which is the
     transaction timestamp: two saves inside the same microsecond share it, and
     "the newest version" then depends on the order the planner happened to
     return. A sequence makes newest well-defined. */
  seq          bigint generated always as identity,
  /* Deliberately NOT a foreign key. With "on delete cascade" the final snapshot
     - the one written by the delete trigger - is cascaded away in the same
     transaction, so deleting an article destroys the only copy of it. History
     has to outlive the row it describes; the restore path re-creates the
     article with this id. */
  article_id   uuid not null,
  /* Snapshot of the row as it was, not a diff: a diff is smaller and useless
     when the schema moves, and this table is small enough to be blunt. */
  title        text,
  slug         text,
  status       text,
  category_id  uuid,
  content      text,
  /* These are the column names public.articles actually has
     (00_schema_migrations.sql: summary/featured_image, plus meta_* from
     20261101130000). An earlier draft of this migration used
     excerpt/seo_title/seo_description/cover_image_url, names that exist only in
     the test fixture - which is how a trigger that breaks every save passed its
     tests and would have thrown 42703 in production on the first edit. */
  summary      text,
  meta_title   text,
  meta_description text,
  featured_image text,
  published_at timestamptz,
  scheduled_for timestamptz,
  /* 'update' - the row was replaced; 'delete' - the row is gone and this is
     the last copy of it. */
  reason       text not null default 'update' check (reason in ('update', 'delete')),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

/* Guard for anyone who applied an earlier copy of this migration. */
alter table public.article_revisions add column if not exists seq bigint generated always as identity;

create index if not exists article_revisions_article_idx
  on public.article_revisions (article_id, seq desc);

comment on table public.article_revisions is
  'Previous version of an article, written by trigger on update and delete. Restored from the panel.';

alter table public.article_revisions enable row level security;

drop policy if exists "article_revisions_select_admin" on public.article_revisions;
create policy "article_revisions_select_admin" on public.article_revisions
  for select to authenticated using (public.is_admin());

/* No insert/update/delete policy: rows arrive from the trigger (security
   definer) and leave by cascade. Nobody writes history by hand. The SELECT grant
   is separate from the policy - a policy chosen rows, a grant allows the table. */
grant select on public.article_revisions to authenticated;

-- ---------------------------------------------------------------------------
--  Capture
-- ---------------------------------------------------------------------------
create or replace function public.record_article_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_per_article constant integer := 40;
begin
  /* Only a change worth undoing is worth a row. Bumping updated_at, a
     published_at set by the cron, or a status flip with no other edit is not:
     history full of noise is history nobody reads. */
  if tg_op = 'UPDATE' and (
       new.content     is not distinct from old.content
   and new.title       is not distinct from old.title
   and new.slug        is not distinct from old.slug
   and new.summary     is not distinct from old.summary
   and new.meta_title  is not distinct from old.meta_title
   and new.meta_description is not distinct from old.meta_description
   and new.featured_image is not distinct from old.featured_image
   and new.category_id is not distinct from old.category_id
  ) then
    return new;
  end if;

  insert into public.article_revisions (
    article_id, title, slug, status, category_id, content, summary,
    meta_title, meta_description, featured_image, published_at, scheduled_for,
    reason, created_by
  ) values (
    old.id, old.title, old.slug, old.status, old.category_id, old.content, old.summary,
    old.meta_title, old.meta_description, old.featured_image, old.published_at, old.scheduled_for,
    case when tg_op = 'DELETE' then 'delete' else 'update' end,
    auth.uid()
  );

  /* Bounded on purpose: a long-lived article edited daily would otherwise keep
     every version for ever, and the table is read by a person scrolling. */
  delete from public.article_revisions
   where article_id = old.id
     and id not in (
       select id from public.article_revisions
        where article_id = old.id
        order by seq desc
        limit keep_per_article
     );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists articles_record_revision on public.articles;
create trigger articles_record_revision
  before update or delete on public.articles
  for each row execute function public.record_article_revision();

-- ---------------------------------------------------------------------------
--  Restore
--
--  Restoring is an UPDATE of the article with the snapshot's values, so the
--  current version becomes a revision in the same breath. Nothing is lost by
--  undoing.
-- ---------------------------------------------------------------------------
create or replace function public.restore_article_revision(revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot public.article_revisions;
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  select * into snapshot from public.article_revisions where id = revision_id;
  if snapshot.id is null then
    raise exception 'no such revision' using errcode = 'P0002';
  end if;

  update public.articles set
    title = snapshot.title,
    content = coalesce(snapshot.content, ''),
    summary = snapshot.summary,
    meta_title = snapshot.meta_title,
    meta_description = snapshot.meta_description,
    featured_image = snapshot.featured_image,
    category_id = snapshot.category_id,
    updated_at = now()
  where id = snapshot.article_id
  returning id into target;

  /* A deleted article has no row to update. The snapshot still has to be
     restorable, or "delete" means "gone" and this table was pointless. The slug
     may have been reused since, so it is made unique rather than trusted. */
  if target is null then
    insert into public.articles (
      id, title, slug, status, category_id, content, summary,
      meta_title, meta_description, featured_image, updated_at
    ) values (
      snapshot.article_id,
      coalesce(snapshot.title, 'Restored article'),
      snapshot.slug || '-restored-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      'draft',
      snapshot.category_id,
      coalesce(snapshot.content, ''),
      snapshot.summary,
      snapshot.meta_title,
      snapshot.meta_description,
      snapshot.featured_image,
      now()
    )
    returning id into target;
  end if;

  return target;
end;
$$;

comment on function public.restore_article_revision(uuid) is
  'Puts a snapshot back. Restores a deleted article as a draft with a unique slug. Admin only.';

revoke all on function public.restore_article_revision(uuid) from public, anon;
grant execute on function public.restore_article_revision(uuid) to authenticated;
