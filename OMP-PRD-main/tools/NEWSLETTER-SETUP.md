# Article newsletter — separate from learning, not a login

## Current state

The frontend, consent flow, SQL queue and Edge handler are implemented and tested
locally with fake mail/captcha services. **No production email was sent.**
`assets/data/newsletter-config.json` intentionally has `enabled: false`. Visitors
cannot submit an email until the operator enables the configured service.

- Academy names/progress never enter this flow.
- A subscriber explicitly opts in, then confirms their address. Confirmation is
  a newsletter consent action—not an auth session, magic-login link or user account.
- Only future database article publications queue messages for active subscribers.
  Applying the migration does not send old articles to anyone.
- Editing a published article does not send another email. The same article and
  subscriber pair is unique, including after republishing.
- Unsubscribing cancels queued deliveries. Resubscribing does not revive them.
- Email links open the Firebase-hosted `/email-preferences` page. Tokens are in
  URL fragments (not server request URLs) and are cleared from the address bar.
  A deliberate button click sends the JSON confirmation/unsubscribe request;
  scanners cannot activate a subscription with GET. Legacy API GET links redirect
  read-only to this page. One-click unsubscribe remains an RFC 8058 form POST to
  the API URL in the email headers.
- Do not serve the confirmation HTML on the standard Supabase domain: its gateway
  rewrites HTML GET responses to plain text. See the official
  [Edge Function limits](https://supabase.com/docs/guides/functions/limits).
- Subscribers, consent timestamps and delivery records are server-side newsletter
  data with RLS and no anon/authenticated table access. They are not learner profiles.

## Enable delivery (operator steps; do not paste secrets into chat or Git)

1. Use a verified Resend sender/domain. Configure SPF/DKIM and an appropriate
   DMARC policy; verify sender/deliverability with an address you control.
2. Apply `supabase/migrations/20260929210000_article_newsletter.sql` after the
   existing article schema. This migration is independent of learner accounts.
3. Set the following **server-only** Supabase Edge secrets in the platform:
   - `RESEND_API_KEY`
   - `NEWSLETTER_FROM` — a verified sender, e.g. `OopsMyPassword <updates@your-domain>`
   - `NEWSLETTER_TOKEN_SECRET` — a stable cryptographically random value of at least
     32 characters. It signs unsubscribe links; do not casually rotate it and
     invalidate old links. Plan key migration if rotation is necessary.
   - `NEWSLETTER_WORKER_SECRET` — a separate random value of at least 32 characters.
   - `TURNSTILE_SECRET_KEY`
   - `NEWSLETTER_SITE_ORIGIN` — `https://oopsmypassword.web.app`
   - Supabase-provided `SUPABASE_URL` and `SUPABASE_SECRET_KEYS` (default key), or
     the legacy `SUPABASE_SERVICE_ROLE_KEY`. No service key goes to a browser.
   - Optional `NEWSLETTER_ALLOWED_ORIGINS`: explicit comma-separated staging
     origins. Never `*`; restrict the Turnstile widget's hostname list too.
4. Build/deploy Hosting with `/email-preferences` and its JavaScript first, then
   deploy `newsletter` with the included `verify_jwt=false` configuration. The
   public actions validate consent/challenge/tokens themselves. `dispatch` requires
   the separate worker secret; a public publishable key cannot authorize it.
5. Schedule POST requests to `/functions/v1/newsletter` with JSON
   `{"action":"dispatch"}` and `Authorization: Bearer <worker secret>`. Use the
   private secret from your scheduler/Vault, never a public workflow variable.
   The optional Supabase Cron template below reads secrets from Vault.
6. Publish a test article to a staging project, **build/deploy its public HTML**,
   confirm a test subscription, and check the entire flow. The worker deliberately
   defers mail if the canonical article URL is not yet a real HTTP 200 HTML page.
   A database publish alone does not trigger this repository's Hosting build;
   trigger the existing build/deploy workflow or configure a publication webhook.
7. Verify confirmation expiry, suppression/unsubscribe, duplicate dispatch,
   unavailable-provider retries, and receipt in a real inbox. API acceptance is
   not proof that a message reached an inbox.
8. Put the public Turnstile site key in `assets/data/newsletter-config.json`, set
   `enabled: true`, and deploy Hosting. Do this **last**. The articles hub's CSP
   permits the challenge script/frame; other public pages do not need it.

The supplied implementation uses Resend + Turnstile. These are integrations, not
claims that an account, verified domain, billing plan or production keys already
exist. A different provider needs its corresponding server-side adapter/testing.

### Optional Supabase Cron setup

Configure extensions and these two Vault secrets through your trusted operator
workflow: `omp_newsletter_url` (full function URL) and `omp_newsletter_worker`
(the same value as `NEWSLETTER_WORKER_SECRET`). Do not put real values into this
file. The SQL below only references Vault names:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'omp-article-email-dispatch',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets
              where name='omp_newsletter_url'),
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' ||
          (select decrypted_secret from vault.decrypted_secrets
           where name='omp_newsletter_worker')
      ),
      body := '{"action":"dispatch"}'::jsonb,
      timeout_milliseconds := 120000
    ) where exists (
      select 1 from public.newsletter_deliveries
      where state in ('pending','sending') and available_at<=now()
    );
  $job$
);
```

Check existing jobs before scheduling; do not create duplicate cron jobs. Monitor
both Cron/pg_net responses and Edge logs. Worker responses report accepted sends,
retry-pending failures, and deferred unpublished URLs. No email addresses or tokens
are logged by the handler. The queue claims at most two rows with `SKIP LOCKED`
and a five-minute lease; provider idempotency keys protect ambiguous retries.
Database requests time out after 10 seconds. Two sequential jobs bound worst-case
HTTP work to about 100 seconds, below the 150-second free-tier request timeout.
An overlapping dispatcher cannot fail a fifth attempt while its lease is active.
At the sample one-minute schedule, plan for at most 120 recipients/hour before
provider quotas, failures and backlogs; use a profiled queue service for larger lists.

Retries stop after five attempts or before the provider's 24-hour idempotency
window expires (23-hour bound). Reconcile a failed/ambiguous delivery against the
provider before retrying manually; do not blindly requeue old rows or clear the
unique delivery identity. Profile throughput/provider limits before a large list.
An already in-flight message can race an unsubscribe; future queued sends stop.

## Tests

```sh
npm ci --ignore-scripts
npm ci --prefix tools/qa-deps
NODE_PATH=$PWD/tools/qa-deps/node_modules node tools/test_newsletter.js
# Browser tests use fake captcha/provider responses, never real subscriber addresses:
NODE_PATH=$PWD/tools/qa-deps/node_modules node tools/academy_browser_test.js
```

Tests execute the actual handler and SQL in disposable PostgreSQL (PGlite), with
provider/challenge calls mocked. They do not establish real delivery, DNS setup,
provider rate limits, or production scheduler operation.
