-- OopsMyPassword — admin hardening and support inbox (2026-09-19)
-- Mirrors the live Supabase changes applied during the admin audit.

begin;

-- Keep the privileged role check outside the API-exposed public schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
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

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- Public wrapper is SECURITY INVOKER, so it is safe for policy evaluation and
-- does not expose a SECURITY DEFINER RPC endpoint.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select private.is_admin();
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Seal trigger search paths.
alter function public.set_products_updated_at() set search_path = public;
alter function public.sync_product_name_title() set search_path = public;
alter function public.sync_product_type_columns() set search_path = public;

-- Support inbox metadata.
alter table public.contact_messages
  add column if not exists read_at timestamptz,
  add column if not exists sender_user_id uuid references auth.users(id) on delete set null;

update public.contact_messages
set read_at = coalesce(read_at, created_at)
where status <> 'new' and read_at is null;

-- Only link a sender when the email matches exactly one app profile.
update public.contact_messages cm
set sender_user_id = p.id
from public.profiles p
where cm.sender_user_id is null
  and lower(trim(cm.email)) = lower(trim(p.email));

create index if not exists contact_messages_sender_user_id_idx
  on public.contact_messages(sender_user_id);

create index if not exists contact_messages_status_created_idx
  on public.contact_messages(status, created_at desc);

-- Admin support staff can resolve linked profile identity; non-admin users
-- retain self-only profile visibility.
drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all" on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

-- Avoid repeated per-row auth evaluation for inbox triage.
drop policy if exists "contact_messages_admin" on public.contact_messages;
drop policy if exists "contact_messages_admin_select" on public.contact_messages;
drop policy if exists "contact_messages_admin_update" on public.contact_messages;
drop policy if exists "contact_messages_admin_delete" on public.contact_messages;

create policy "contact_messages_admin_select" on public.contact_messages
  for select to authenticated
  using ((select public.is_admin()));

create policy "contact_messages_admin_update" on public.contact_messages
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()) and status in ('new','read','archived'));

create policy "contact_messages_admin_delete" on public.contact_messages
  for delete to authenticated
  using ((select public.is_admin()));

-- Cover the current foreign-key query paths.
create index if not exists articles_author_id_idx on public.articles(author_id);
create index if not exists articles_created_by_idx on public.articles(created_by);
create index if not exists media_article_id_idx on public.media(article_id);
create index if not exists media_uploaded_by_idx on public.media(uploaded_by);

commit;
