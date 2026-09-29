# Academy fixes and second re-audit — 29 September 2026

> **Current contract:** learners no longer sign in. Name/progress/self-checks are
> device-only; email is exclusively optional article subscription. See
> [the local-first audit](SITE-LOCAL-FIRST-AUDIT.md) and
> [newsletter setup](NEWSLETTER-SETUP.md). Account-backed grading/deployment
> instructions below describe the historical implementation; they are not
> prerequisites for local learner progress. Content-hierarchy migrations still
> apply to live catalogue publishing. Preserve old records; never rerun a reset.


> This report records the preceding bug-fix re-audit. The subsequent
> [multi-subject implementation](ACADEMY-MULTI-SUBJECT.md) adds course-scoped
> lessons, subject roadmaps and further regression coverage. Its migration is
> now also required; use the current release notes.

## Status

**All seven confirmed findings from the initial re-audit have been fixed in this
branch. The executed local regression suites have no failing checks.** This
supersedes the open-findings status in `ACADEMY-REAUDIT-2026-09-29.md`.

This is code and local-test verification, not a claim that production has already
been upgraded or that undiscovered bugs are impossible. No live migrations,
emails, learner writes, deployments or production certificates were performed.

## Finding-by-finding closure

| Finding                                    | Fix                                                                                                                                                                                                          | Evidence                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 — broken environment fallback           | Shared validated grouped/legacy key resolver, used by all three handlers. SDK pinned to 2.115.0.                                                                                                             | Actual-handler tests for absent, malformed, empty, non-string and valid grouped keys; legacy-only success; missing configuration fails closed.                              |
| A2 — progress overwrites a pass            | Progress and quiz actions use the same database row lock. Progress-only actions never copy grading fields from an old snapshot. Migration reconciles a lost pass where an issued certificate already exists. | Real overlapping PostgreSQL transactions preserve the pass/score/certificate; migration regression checks historic repair and preservation of unaffected learners.          |
| A3 — cooldown race                         | Cooldown validation, attempt increment and grading occur inside one transactional service-only RPC.                                                                                                          | Two connections are deliberately blocked on the same row and released together: exactly one request grades, the other receives 423; attempt count is one.                   |
| A4 — pass without certificate              | Certificate issuance and passing progress commit or roll back together. Idempotent recovery repairs historic missing certificates; the completed-lesson UI invokes that recovery automatically.              | A failing certificate trigger rolls back the pass; retry succeeds. Concurrent recoveries create exactly one certificate. Browser verifies recovery without retaking a quiz. |
| A5 — unpublished-parent bypass             | Mutation RPC explicitly checks and locks topic, module, path and category publication, independently of RLS.                                                                                                 | Both handlers reject every unavailable ancestor. Real concurrent parent unpublication is respected after waiting on its lock.                                               |
| A6 — outages shown as invalid certificates | Invalid/not-found responses are separate from transient service/network/timeout failures; transient states offer retry.                                                                                      | Browser covers 400, 404, 429, 500, network failure, a real request timeout and successful retry.                                                                            |
| A7 — empty published lessons               | Publisher requires non-empty teaching sections, description, module outcome and HTTPS references; incomplete drafts remain excluded.                                                                         | Model guardrails reject empty/whitespace/empty-array content. Full live-mode build against a local fixture fails without replacing the last good HTML.                      |

## Other issues resolved during the fix/re-audit

- **Predictable answer positions:** paired SQL option/key rotation preserves each
  correct answer's meaning and balances the seed. UI also shuffles display order
  while preserving original indexes for server grading. Existing scores and
  certificates are not reset.
- **Stale quizzes during edits:** submissions carry the quiz revision. Questions
  and answer-key edits update that revision. A stale submission gets 409 and a
  “Refresh lesson” action, without consuming an attempt. Real concurrent-edit
  coverage confirms this after a lock wait.
- **Certificate display names:** optional public display name at signup and an
  account setting for future certificates. Existing certificates retain their
  issued name. Leaving it blank deliberately uses “OMP Learner”; no email address
  is substituted into a public certificate.
- **Direct mutation protection:** only `service_role` can execute the grading
  RPC. Browser roles cannot insert/update/delete/truncate learner records,
  certificates, curriculum or answer keys. Reading still follows RLS.
- **Deployment packaging:** scripts and Markdown are explicitly excluded from
  public Hosting. The missing admin authorization-documentation pointer is restored.
- **Eleven old runtime failures:** fixed the real packaging/documentation gaps;
  updated obsolete expectations to the established static sitemap, canonical
  `.web.app` origin, intentional noindex redirect stub and real unknown-route
  404s. Tests were not disabled, and wildcard soft-404 rewrites were not restored.
- **Twelve SEO title warnings:** shortened the titles in their generator sources;
  current verification reports zero warnings. Full article headings are retained.
- **Python-only sitemap rebuild:** it now includes the imported Academy route
  manifest instead of temporarily dropping those eight URLs. A build regression
  covers this; both checked-in sitemap files contain 43 canonical URLs.
- **Continuous checks:** pinned QA dependencies and a dedicated CI regression job
  now cover backend, migrations, real PostgreSQL concurrency, publisher, browser
  and general runtime. Hosting deployment depends on this job and the SEO gate.

## Verification inventory

Final local re-audit completed successfully on this working tree:

| Suite                                                  |                Verified passing count |
| ------------------------------------------------------ | ------------------------------------: |
| General jsdom runtime                                  |                                   582 |
| Academy browser (including eight automated axe scans)  |                                    40 |
| Real Edge handler + local PostgreSQL regression groups |                                    10 |
| Real multi-connection PostgreSQL concurrency scenarios |                                     5 |
| Migration/RLS/data-preservation checks                 |                                     7 |
| Publishing validation / option-index mapping           |                                    15 |
| Academy model / generated SEO                          |                                    18 |
| Isolated full-build scenarios                          |                                     5 |
| Seed/content tests                                     |                                     4 |
| Sitemap generation/wiring                              |                                    25 |
| Static HTML/link audit                                 |                 47 files; zero errors |
| Site-wide SEO                                          | Zero errors/warnings; 43 sitemap URLs |
| Deno type-check                                        |   All three Academy Edge entry points |
| Git whitespace check                                   |                                 Clean |

Backend tests execute real handler source and the actual migration SQL. The
multi-connection suite uses a disposable PostgreSQL server, not an in-memory
mock of locking. Browser account/API fixtures still do **not** prove email delivery
or live Supabase deployment. The jsdom suite's offline article-feed checks may
log its unsupported external-module import diagnostic; no checks are failing.

## Repeat locally

```sh
npm ci --prefix tools/qa-deps
export NODE_PATH="$PWD/tools/qa-deps/node_modules"
tools/qa-deps/node_modules/.bin/playwright install chromium

node tools/test_academy_backend.js
node tools/test_academy_concurrency.js
node tools/test_academy_migrations.js
node tools/audit_academy_publishing.mjs
node tools/test_academy_build.mjs
python3 tools/test_academy_content.py
node tools/test_runtime.js
node tools/test_academy_seo.mjs
node tools/test_sitemap.js
python3 tools/qa.py
node scripts/verify-seo.mjs
deno check --no-lock supabase/functions/learning-progress/index.ts \
  supabase/functions/learning-quiz-submit/index.ts \
  supabase/functions/learning-certificate-verify/index.ts

# In another terminal, run the preview before the browser suite:
node tools/preview_server.js 8080
# Then:
node tools/academy_browser_test.js
```

`audit_academy_backend.js` remains as a compatibility entry point but now runs
fixed-behavior regression assertions, not assertions that bugs should occur.
Dependencies/databases/browsers are QA-only and are not part of the public site.

## Remaining rollout work — not performed here

See `ACADEMY-RELEASE.md` for the ordered migration and function rollout. Apply the
four forward migrations, deploy all three revised functions with their shared
modules/config, then publish the frontend as one coordinated release. Do not
leave the new client against old handlers or rerun the old destructive seed.

The production Supabase connection was unavailable from this workspace during
the initial audit. Actual deployment state, email delivery/callback allowlists,
real-session journeys, production headers and search indexing still require live
staging verification. Local green tests cannot certify those services.

A visual Academy CMS remains outside this implementation: trusted administrators
manage content through Supabase and the documented publish pipeline. No claim is
made that a new visual editor, proctored assessment or identity-verified academic
qualification has been delivered.
