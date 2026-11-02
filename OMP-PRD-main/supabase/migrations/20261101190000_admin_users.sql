-- ============================================================================
--  Who can open the panel.
--
--  Until now, making somebody an admin meant opening the SQL editor and writing
--  an UPDATE by hand. Two things follow from that, and both are the kind of
--  mistake you make once:
--
--    1. A single UPDATE with the wrong WHERE makes every member an admin.
--    2. The same statement aimed the other way removes the last one, and then
--       nobody can publish until somebody with database access notices.
--
--  So it becomes two functions: one to see who has access, one to change it,
--  with the two refusals that matter built in - you cannot demote yourself, and
--  you cannot remove the last admin. Both write to audit_log, because "who gave
--  this person access" is the question asked after an incident, not before.
--
--  profiles itself stays service-role-write-only. These functions are the only
--  door, and they are narrower than the table.
-- ============================================================================

create or replace function public.list_admins()
returns table (id uuid, email text, is_admin boolean, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  /* Only the people with access, not every account: profiles holds one row per
     signed-up learner, and a panel list of thousands is neither useful nor
     something to send over the wire. */
  return query
    select p.id, p.email, p.is_admin, p.created_at
      from public.profiles p
     where p.is_admin = true
     order by p.created_at;
end;
$$;

comment on function public.list_admins() is
  'Who currently has admin access. Admin only.';

create or replace function public.admin_counts()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'admins', (select count(*) from public.profiles where is_admin = true),
    'accounts', (select count(*) from public.profiles)
  );
end;
$$;

create or replace function public.set_admin_access(
  target_email text,
  make_admin boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.profiles;
  admins_left integer;
  actor_email text;
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  if target_email is null or btrim(target_email) = '' then
    raise exception 'an email is required' using errcode = '22023';
  end if;

  select * into target from public.profiles
   where lower(email) = lower(btrim(target_email))
   limit 1;

  if target.id is null then
    /* Not "created": an admin account has to correspond to a real login, and
       creating one here would mean inventing a password. */
    raise exception 'no account with that email - they need to sign in once first'
      using errcode = 'P0002';
  end if;

  if target.is_admin = make_admin then
    return case when make_admin then 'already an admin' else 'already not an admin' end;
  end if;

  /* Lockout protection, both halves. Demoting yourself is legal in principle
     and terrible in practice: it is one click, and the panel closes behind
     you. */
  if not make_admin and target.id = auth.uid() then
    raise exception 'you cannot remove your own access - ask another admin'
      using errcode = '42501';
  end if;

  if not make_admin then
    select count(*) into admins_left from public.profiles where is_admin = true;
    if admins_left <= 1 then
      raise exception 'this is the last admin - the panel would have nobody who can open it'
        using errcode = '42501';
    end if;
  end if;

  update public.profiles set is_admin = make_admin where id = target.id;

  select p.email into actor_email from public.profiles p where p.id = auth.uid();

  /* Written here rather than by a trigger on profiles: the generic audit
     trigger would log every learner's profile edit, and this is the one change
     on that table anybody ever audits. */
  insert into public.audit_log (actor, actor_email, table_name, row_id, action, changed, detail)
  values (
    auth.uid(),
    actor_email,
    'profiles',
    target.id,
    'update',
    array['is_admin'],
    jsonb_build_object('target', target.email, 'is_admin', make_admin)
  );

  return case when make_admin then 'granted' else 'removed' end;
end;
$$;

comment on function public.set_admin_access(text, boolean) is
  'Grant or remove admin access by email. Refuses to remove yourself or the last admin, and records the change.';

revoke all on function public.list_admins() from public, anon;
revoke all on function public.admin_counts() from public, anon;
revoke all on function public.set_admin_access(text, boolean) from public, anon;
grant execute on function public.list_admins() to authenticated;
grant execute on function public.admin_counts() to authenticated;
grant execute on function public.set_admin_access(text, boolean) to authenticated;
