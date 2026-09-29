# Production release: outstanding external gates

> Later expanded verification: see [SITE-A-TO-Z-AUDIT-2026-09-29.md](SITE-A-TO-Z-AUDIT-2026-09-29.md).
> This document retains the earlier checkpoint; the A-to-Z report records additional fixes and open gates.

Status on 2026-09-29: **not yet certified in production**. Changes remain on
`arena/01a0eb8c-omp-prd`; no deployment, live migration, newsletter send or Search
Console modification has been performed in this session. Local fixture results
are not evidence that production integrations work.

## Account-owner actions

1. **Restore the deployment runner.** The latest main run,
   [36524256974](https://github.com/Anony-place/OMP-PRD/actions/runs/36524256974),
   failed before its SEO job ran any steps. GitHub's annotation says recent
   payments failed or the spending limit needs increasing. Hosting was skipped.
   The account owner must resolve Billing & plans, or supply an approved,
   authenticated alternative runner. Source changes cannot fix this account gate.
2. **Verify protected deployment configuration.** The Arena GitHub connection can
   read runs but receives HTTP 403 when listing repository secrets. This does
   **not** mean secrets are absent. Confirm `FIREBASE_TOKEN` in the trusted GitHub
   settings, or establish an approved replacement identity. Never put tokens in
   chat or source. The workflow now targets project `password-e9a30` explicitly,
   Hosting site `oopsmypassword`, and pins Firebase CLI 15.32.0.
3. **Complete newsletter provider setup.** Follow `NEWSLETTER-SETUP.md`: verified
   Resend domain/sender and DNS, Turnstile hostname/key configuration, Supabase
   server secrets, reviewed newsletter migration, Edge deployment, private worker
   schedule and actual inbox/confirmation/unsubscribe testing. Public configuration
   remains disabled until these are verified. A disabled form is not an operational
   newsletter.

## Release sequence (do not skip gates to get a green label)

- Review pending schema changes against the production migration history, back up
  production and retain existing IDs, admin authentication and historical
  certificate records. **Do not replay
  `20260927143000_reset_to_web_application_security.sql`.** Do not blindly apply
  every migration to an existing database.
- Run the updated CI gates on the actual branch change. Once reviewed, use the
  normal approved main-branch release path. A previous main run or a local
  snapshot build does not validate this change against the live catalogue.
- The live-mode build must fetch the real published catalogue/articles/products.
  In this sandbox direct Supabase reads failed TLS negotiation. Availability is
  unverified, not a confirmed production outage. The build must fail on API/schema
  errors, never replace a good deployment with an empty fallback catalogue.
- Deploy Hosting with `/email-preferences` before sending new confirmation links.
  The standard Supabase domain does not serve HTML GET pages; human actions now
  use the Firebase page and explicit JSON POST. Keep subscription collection
  disabled while provider configuration is incomplete.
- After Hosting, run `node scripts/verify-live-release.mjs` from the exact built
  site directory. CI now does this automatically. It compares live bytes with
  all sitemap pages and critical assets, checks MIME/nosniff and a genuine 404,
  and retries brief propagation delays. The current local snapshot yields 65
  checks; real published articles/products increase that count.
- Verify actual email receipt with an operator-controlled inbox, scanner-safe
  confirmation, one-click and human unsubscribe, a real scheduler run and no
  duplicate update. Use staging content; do not publish fake courses/articles to
  the public site as test fixtures. Review provider suppression/bounce controls.
- Inspect the exact homepage in Search Console after deployment. Verify the
  canonical/rendered brand metadata and request a recrawl. Google's eventual site
  name is automated; a particular label or indexing deadline cannot be promised.

## Additional fixes verified during the release audit

- Firebase-hosted consent UI, fragment tokens removed from the address bar, no
  automatic GET mutations, no learner-data access; RFC 8058 POST retained.
- Active fifth newsletter lease is not failed by an overlapping dispatcher.
  Two-job batches and bounded HTTP/database requests fit the free-tier request
  time budget. Monitor throughput; this is not an unbounded bulk-mail service.
- Public article/product build uses `apikey`, not a publishable key as a Bearer
  JWT; paginates through server-capped responses; rejects invalid API data before
  deleting generated files. Private tests verify preservation of the last build.
- Explicit Firebase project, pinned CLI, missing-token error and exact-artifact
  post-deploy gate instead of treating a fetchable sitemap as full release proof.

Latest executed local checks: 35 browser checks / 10 axe scans; broad fixture audit
0 findings; 18 actual newsletter SQL/handler groups; 13 local Academy groups;
5 site contracts; 8 isolated build groups; 8 release-verifier groups; 587 runtime
checks; 25 sitemap tests; 49 HTML pages / 44 sitemap URLs; all four Edge handlers
type-check; root publishing dependency audit 0 known vulnerabilities. Browser/API
fixtures do not establish real provider or production service readiness.
