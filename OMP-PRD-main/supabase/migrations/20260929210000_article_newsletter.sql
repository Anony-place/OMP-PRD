-- Newsletter only: never an auth identity or a learning-progress store.
-- Existing articles/subscribers are NOT mailed by this migration.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) between 3 and 254 and email=lower(email)),
  status text not null default 'pending' check(status in ('pending','active','unsubscribed')),
  confirmation_hash text,
  confirmation_expires_at timestamptz,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  consent_version text not null default 'article-updates-v1',
  created_at timestamptz not null default now()
);
create table public.newsletter_deliveries (
  article_id uuid not null references public.articles(id) on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  state text not null default 'pending' check(state in ('pending','sending','sent','failed','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  primary key(article_id,subscriber_id)
);
create index newsletter_delivery_pending on public.newsletter_deliveries(available_at) where state in ('pending','sending');
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_deliveries enable row level security;
revoke all on public.newsletter_subscribers,public.newsletter_deliveries from anon,authenticated;
grant all on public.newsletter_subscribers,public.newsletter_deliveries to service_role;

create function public.newsletter_request(p_email text,p_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.newsletter_subscribers;
begin
  insert into newsletter_subscribers(email,confirmation_hash,confirmation_expires_at)
    values(p_email,p_hash,now()+interval '24 hours') on conflict(email) do nothing;
  select * into s from newsletter_subscribers where email=p_email for update;
  if s.status='active' then return false; end if;
  if s.confirmation_hash=p_hash then return true; end if;
  if s.requested_at > now()-interval '10 minutes' then return false; end if;
  update newsletter_subscribers set status='pending',confirmation_hash=p_hash,
    confirmation_expires_at=now()+interval '24 hours',requested_at=now() where id=s.id;
  return true;
end $$;
create function public.newsletter_confirm(p_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update newsletter_subscribers set status='active',confirmed_at=now(),confirmation_hash=null,
    confirmation_expires_at=null where confirmation_hash=p_hash and status='pending'
      and confirmation_expires_at>now();
  return found;
end $$;
create function public.newsletter_unsubscribe(p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update newsletter_subscribers set status='unsubscribed',confirmation_hash=null,
    confirmation_expires_at=null,requested_at=to_timestamp(0)
    where id=p_id and status<>'unsubscribed';
  update newsletter_deliveries set state='cancelled'
    where subscriber_id=p_id and state in ('pending','sending');
end $$;
create function public.newsletter_queue_article()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='published' then
    if tg_op='UPDATE' then
      if old.status='published' then return new; end if;
    end if;
    insert into newsletter_deliveries(article_id,subscriber_id)
      select new.id,id from newsletter_subscribers where status='active'
      on conflict do nothing;
  end if;
  return new;
end $$;
create trigger article_newsletter_publish after insert or update of status on public.articles
for each row execute function public.newsletter_queue_article();

create function public.newsletter_claim()
returns table(article_id uuid,subscriber_id uuid,email text,title text,slug text,summary text,attempt integer)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Resend idempotency keys last 24h. Stop automatic retries before they expire;
  -- an operator must reconcile ambiguous delivery rather than risking duplicates.
  -- Never expire another worker's still-active lease, including its fifth attempt.
  update newsletter_deliveries d set state='failed'
    where d.state in ('pending','sending') and d.available_at<=now() and
      (d.attempts>=5 or d.first_attempt_at<now()-interval '23 hours');
  return query
    with picked as (
      select d.article_id,d.subscriber_id from newsletter_deliveries d
      join newsletter_subscribers s on s.id=d.subscriber_id
      join articles a on a.id=d.article_id
      where d.state in ('pending','sending') and d.available_at<=now()
        and s.status='active' and a.status='published'
        and (a.published_at is null or a.published_at<=now())
      -- Two jobs keep sequential HTTP work below the 150s free-tier request
      -- limit (10s claim + 2 * (10s recheck + 10s HEAD + 15s send + 10s save)).
      order by d.available_at for update of d skip locked limit 2
    ), updated as (
      update newsletter_deliveries d set state='sending',attempts=d.attempts+1,
        first_attempt_at=coalesce(d.first_attempt_at,now()),available_at=now()+interval '5 minutes'
        from picked p where d.article_id=p.article_id and d.subscriber_id=p.subscriber_id
        returning d.article_id,d.subscriber_id,d.attempts
    ) select u.article_id,u.subscriber_id,s.email,a.title,a.slug,a.summary,u.attempts
      from updated u join newsletter_subscribers s on s.id=u.subscriber_id
      join articles a on a.id=u.article_id;
end $$;
revoke all on function public.newsletter_request(text,text),public.newsletter_confirm(text),public.newsletter_unsubscribe(uuid),public.newsletter_claim(),public.newsletter_queue_article() from public,anon,authenticated;
grant execute on function public.newsletter_request(text,text),public.newsletter_confirm(text),public.newsletter_unsubscribe(uuid),public.newsletter_claim() to service_role;
