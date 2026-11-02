-- ============================================================================
--  Newsletter, for the panel.
--
--  newsletter_subscribers and newsletter_deliveries are deliberately revoked
--  from anon and authenticated and granted only to service_role. That is the
--  right default for a list of email addresses, and it is also why the panel
--  has never been able to show any of it: with the publishable key, an admin
--  sees nothing.
--
--  The fix is not a policy. A policy would let the browser read every row,
--  including the confirmation hashes. The fix is two functions that run as the
--  definer, check is_admin() first, and return exactly what the panel needs:
--
--    newsletter_overview()            counts, recent signups, delivery health
--    newsletter_set_status(id,state)  honour a manual unsubscribe request
--
--  Both are revoked from anon; authenticated is allowed to call them and
--  is_admin decides inside, so the check happens in the database rather than in
--  the panel's JavaScript.
-- ============================================================================

create or replace function public.newsletter_overview()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'subscribers', jsonb_build_object(
      'total',        (select count(*) from public.newsletter_subscribers),
      'active',       (select count(*) from public.newsletter_subscribers where status = 'active'),
      'pending',      (select count(*) from public.newsletter_subscribers where status = 'pending'),
      'unsubscribed', (select count(*) from public.newsletter_subscribers where status = 'unsubscribed'),
      /* The only growth number worth showing: a pending address is not an
         audience, it is somebody who typed their email once. */
      'joined_7d',    (select count(*) from public.newsletter_subscribers
                        where status = 'active' and coalesce(confirmed_at, created_at) > now() - interval '7 days'),
      'joined_30d',   (select count(*) from public.newsletter_subscribers
                        where status = 'active' and coalesce(confirmed_at, created_at) > now() - interval '30 days')
    ),
    'deliveries', jsonb_build_object(
      'pending', (select count(*) from public.newsletter_deliveries where state = 'pending'),
      'sending', (select count(*) from public.newsletter_deliveries where state = 'sending'),
      'sent',    (select count(*) from public.newsletter_deliveries where state = 'sent'),
      'failed',  (select count(*) from public.newsletter_deliveries where state = 'failed'),
      'cancelled', (select count(*) from public.newsletter_deliveries where state = 'cancelled')
    ),
    /* Addresses are shown in full: this function is admin-only, and a support
       reply needs the address nobody can guess. They are never returned to anon
       or to a non-admin, which is what the revoke on the table is protecting. */
    'recent', coalesce((
      select jsonb_agg(row_to_json(recent) order by recent.created_at desc)
      from (
        select id, email, status, created_at, confirmed_at
        from public.newsletter_subscribers
        order by created_at desc
        limit 25
      ) as recent
    ), '[]'::jsonb),
    'problems', coalesce((
      select jsonb_agg(row_to_json(bad) order by bad.attempts desc)
      from (
        select d.article_id, d.subscriber_id, d.attempts, d.first_attempt_at,
               s.email, a.title
        from public.newsletter_deliveries d
        join public.newsletter_subscribers s on s.id = d.subscriber_id
        join public.articles a on a.id = d.article_id
        where d.state = 'failed'
        order by d.attempts desc
        limit 10
      ) as bad
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

comment on function public.newsletter_overview() is
  'Subscriber and delivery counts plus recent signups and stuck deliveries. Admin only.';

/* Honouring "please remove me" is the one write an admin genuinely needs, and
   it must not be a DELETE: the row is the record that the person asked, which
   is what stops them being mailed again. Reuses the same state and the same
   delivery cancellation as the public unsubscribe. */
create or replace function public.newsletter_set_status(
  subscriber uuid,
  new_status text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_status text;
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  /* 'pending' is deliberately not settable: an address becomes active by
     confirming, which only the person with the inbox can do. An admin putting
     somebody there would be subscribing them without consent. */
  if new_status not in ('active', 'unsubscribed') then
    raise exception 'status must be active or unsubscribed, not %', new_status
      using errcode = '22023';
  end if;

  select status into current_status from public.newsletter_subscribers where id = subscriber;
  if current_status is null then
    raise exception 'no such subscriber' using errcode = 'P0002';
  end if;
  if current_status = new_status then
    return current_status;
  end if;

  update public.newsletter_subscribers
     set status = new_status,
         confirmed_at = case when new_status = 'active' then coalesce(confirmed_at, now()) else confirmed_at end,
         confirmation_hash = null,
         confirmation_expires_at = null,
         requested_at = case when new_status = 'unsubscribed' then to_timestamp(0) else requested_at end
   where id = subscriber;

  if new_status = 'unsubscribed' then
    update public.newsletter_deliveries
       set state = 'cancelled'
     where subscriber_id = subscriber and state in ('pending', 'sending');
  end if;

  return new_status;
end;
$$;

comment on function public.newsletter_set_status(uuid, text) is
  'Set a subscriber active or unsubscribed, cancelling queued mail. Admin only.';

revoke all on function public.newsletter_overview() from public, anon;
revoke all on function public.newsletter_set_status(uuid, text) from public, anon;
grant execute on function public.newsletter_overview() to authenticated;
grant execute on function public.newsletter_set_status(uuid, text) to authenticated;
