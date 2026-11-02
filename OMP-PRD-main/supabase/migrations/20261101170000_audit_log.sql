-- ============================================================================
--  Who changed what.
--
--  article_revisions answers "what did this article look like before" for one
--  table. It cannot answer the questions that come up when something is wrong
--  and nobody knows why:
--
--    "the price on the product page changed - who did that?"
--    "this tool disappeared from /tools last week"
--    "who deleted the Spy category?"
--
--  This table answers those, for the tables where a wrong change is expensive
--  and a full copy of the row would be wasteful.
--
--  What it deliberately does not store: field values. An audit log that copies
--  every article body is a second copy of the site with the same size and a
--  worse privacy story. It stores WHICH fields changed, plus the identifying
--  ones (title/name/slug) - enough to know what happened, not enough to be a
--  backup. Backups are a different job and have their own tool.
-- ============================================================================

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  /* NULL when nothing was signed in: a migration, a script with the service
     role, or the cron. That is information, not a gap. */
  actor       uuid references auth.users(id) on delete set null,
  actor_email text,
  table_name  text not null,
  row_id      uuid,
  action      text not null check (action in ('insert', 'update', 'delete')),
  changed     text[] not null default '{}',
  detail      jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_recent_idx on public.audit_log (at desc);
create index if not exists audit_log_row_idx on public.audit_log (table_name, row_id, at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor, at desc);

alter table public.audit_log enable row level security;

/* Read is admin-only. There is no write policy at all: rows arrive from the
   trigger, which is security definer. An audit log that the app can edit is
   not an audit log. */
drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated using (public.is_admin());

/* Read by an admin session, written only by the definer trigger. */
grant select on public.audit_log to authenticated;

comment on table public.audit_log is
  'Who changed which row, and which fields. Not a backup: values are not stored.';

-- ---------------------------------------------------------------------------
--  Capture
-- ---------------------------------------------------------------------------
create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row jsonb;
  after_row  jsonb;
  field      text;
  changed    text[] := '{}';
  who        uuid := auth.uid();
  email      text;
  identity   jsonb;
begin
  if tg_op = 'INSERT' then
    before_row := '{}'::jsonb;
    after_row  := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old);
    after_row  := to_jsonb(new);
  else
    before_row := to_jsonb(old);
    after_row  := '{}'::jsonb;
  end if;

  if tg_op = 'UPDATE' then
    for field in select jsonb_object_keys(after_row) loop
      continue when field = 'updated_at';
      if (after_row -> field) is distinct from (before_row -> field) then
        changed := changed || field;
      end if;
    end loop;
    /* A change to nothing but updated_at is not a change. The panel bumps it on
       every save, and a log full of those hides the entries that matter. */
    if cardinality(changed) = 0 then
      return new;
    end if;
  end if;

  if who is not null then
    select p.email into email from public.profiles p where p.id = who;
  end if;

  /* Only the identifying fields, and only when the table has them. `detail`
     holds no body, no price history, no description - see the note above. */
  identity := jsonb_strip_nulls(jsonb_build_object(
    'title',  coalesce(after_row ->> 'title',  before_row ->> 'title'),
    'name',   coalesce(after_row ->> 'name',   before_row ->> 'name'),
    'slug',   coalesce(after_row ->> 'slug',   before_row ->> 'slug'),
    'status', coalesce(after_row ->> 'status', before_row ->> 'status')
  ));

  insert into public.audit_log (actor, actor_email, table_name, row_id, action, changed, detail)
  values (
    who,
    email,
    tg_table_name,
    coalesce((after_row ->> 'id')::uuid, (before_row ->> 'id')::uuid),
    lower(tg_op),
    changed,
    identity
  );

  /* Bounded. This table grows with every save on the site, and nobody scrolls
     to last year: 20 000 entries is months of real editing. */
  delete from public.audit_log
   where id in (
     select id from public.audit_log order by id desc offset 20000
   );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.record_audit() is
  'Generic audit trigger: which fields changed, by whom. Skips updated_at-only updates.';

-- Attached to the tables where a wrong change is expensive. articles is here
-- because "who unpublished this" is a different question from "what did it say
-- before", which article_revisions answers.
drop trigger if exists articles_record_audit on public.articles;
create trigger articles_record_audit
  after insert or update or delete on public.articles
  for each row execute function public.record_audit();

drop trigger if exists products_record_audit on public.products;
create trigger products_record_audit
  after insert or update or delete on public.products
  for each row execute function public.record_audit();

drop trigger if exists tools_record_audit on public.tools;
create trigger tools_record_audit
  after insert or update or delete on public.tools
  for each row execute function public.record_audit();

drop trigger if exists article_categories_record_audit on public.article_categories;
create trigger article_categories_record_audit
  after insert or update or delete on public.article_categories
  for each row execute function public.record_audit();
