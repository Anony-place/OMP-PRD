-- ============================================================================
--  Grants for the tables the November migrations created.
--
--  A policy is not a permission. `create policy ... for select to authenticated`
--  says WHICH ROWS a role may see; it does not say the role may read the table
--  at all. On a normal Supabase project the missing half is invisible, because
--  new tables inherit `grant all to anon, authenticated, service_role` from the
--  default privileges of the `postgres` role. Tables created through the
--  Management API do not inherit them.
--
--  The result was precise and quiet:
--
--    redirects          the panel's Redirects tab could not list or write a
--                       single row, and scripts/sync-redirects.mjs reads this
--                       table with the publishable key, so a rename made in the
--                       panel never became a 301. Every ranking the redirect
--                       was supposed to protect was still a 404.
--    article_revisions  the Revisions tab showed "no versions" for an article
--                       that had them.
--    audit_log          Activity was empty.
--    publish_jobs       the content-publish function could not INSERT the job
--                       row, so every publish failed with "could not record the
--                       job" - while the table sat there looking correct.
--
--  Only what each table needs, named one by one. The Setup screen is what found
--  this: it reported three tables as missing that had existed for days.
-- ============================================================================

-- The build reads redirects with the publishable key, so anon must be able to
-- SELECT it. `redirects_select_all` is the policy that says every row is public.
grant select on public.redirects to anon;
grant select, insert, update, delete on public.redirects to authenticated;

/* History and the audit log are read by an admin session and written only by
   SECURITY DEFINER triggers, which run as the table owner - so no INSERT or
   UPDATE grant for any browser role. */
grant select on public.article_revisions to authenticated;
grant select on public.audit_log to authenticated;

/* The queue is written by the edge function (service role) and by the workflow
   (service role again). The panel only reads it, which it could already do. */
grant select, insert, update on public.publish_jobs to service_role;

comment on table public.redirects is
  'Old path -> new path. Read by scripts/sync-redirects.mjs with the publishable key; written by admins.';
