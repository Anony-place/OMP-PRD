-- OopsMyPassword — production reconciliation (2026-09-18)
-- Non-destructive live-schema alignment for the deployed admin/content system.

alter table public.articles
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.articles
set created_by = author_id
where created_by is null and author_id is not null;

alter table public.media
  add column if not exists article_id uuid references public.articles(id) on delete cascade;

-- Backfill only exact, verifiable document ownership.
update public.media m
set article_id = a.id
from public.articles a
where m.article_id is null
  and a.document_url is not null
  and a.document_url = m.public_url;

-- Restrict public contact inserts to the intended fields.
revoke insert on public.contact_messages from anon;
grant insert (name, email, message) on public.contact_messages to anon;

drop policy if exists "contact_insert_public" on public.contact_messages;
drop policy if exists "contact_messages_anon_insert" on public.contact_messages;
create policy "contact_insert_public" on public.contact_messages
  for insert to anon
  with check (
    char_length(name) between 1 and 100
    and char_length(email) between 3 and 200
    and char_length(message) between 1 and 5000
  );

revoke select on public.profiles from anon;
revoke all on public.media from anon;
