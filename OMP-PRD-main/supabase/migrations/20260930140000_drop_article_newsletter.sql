/* Remove the article newsletter opt-in.

   The feature collected an email address, hashed it, mailed a double-opt-in
   link and stored both a pending and a confirmed row. It shipped with no
   subscribers and no deliveries, and the site no longer renders a form, loads
   the client script or ships the Edge Function, so every object created by
   20260929210000_article_newsletter.sql is now dead weight.

   Dropped in dependency order. The functions go first because the tables
   have policies and triggers that reference them.

   The tables were verified empty before this ran, so nothing is lost. This is
   a clean removal, not a migration of existing data. */

/* Publishing an article used to queue a newsletter row through this trigger.
   It has to go first, or the function it calls cannot be dropped. */
drop trigger if exists article_newsletter_publish on public.articles;

drop function if exists public.newsletter_claim();
drop function if exists public.newsletter_confirm(text);
drop function if exists public.newsletter_queue_article();
drop function if exists public.newsletter_request(text, text);
drop function if exists public.newsletter_unsubscribe(uuid);

drop table if exists public.newsletter_deliveries;
drop table if exists public.newsletter_subscribers;
