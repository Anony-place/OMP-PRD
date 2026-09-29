# Academy release notes — 2026-09-29

> **Current contract:** learners no longer sign in. Name/progress/self-checks are
> device-only; email is exclusively optional article subscription. See
> [the local-first audit](SITE-LOCAL-FIRST-AUDIT.md) and
> [newsletter setup](NEWSLETTER-SETUP.md). Account-backed grading/deployment
> instructions below describe the historical implementation; they are not
> prerequisites for local learner progress. Content-hierarchy migrations still
> apply to live catalogue publishing. Preserve old records; never rerun a reset.


> **Audit fixes completed locally:** A1–A7 and the additional fixes are covered by
> [the second re-audit](ACADEMY-FIX-VERIFICATION.md). This is not a statement that
> production migrations/functions have been deployed. Follow the rollout below.

See [architecture and research](ACADEMY-ARCHITECTURE.md) for the curriculum model,
source references, publishing instructions and implementation boundaries.

## What changed

- Clear Academy purpose, audience and “Start here” entry point.
- Academy → category (subject) → course → module → lesson structure.
- A roadmap with prerequisite guidance, outcomes, recommended order, honest
  reading-time estimates (practice is extra), and what to do after the foundation.
- Separate category/path pages; only published, populated curriculum is shown.
- Two modules organizing the existing four topics, not invented new courses.
- Contextual breadcrumbs, path/module context and next-topic navigation in the
  focused reader. Reading position is local, not a claim of course completion.
- Search, account-based progress filters, accessible account dialog, one-section
  lessons, one-question quizzes, lab confirmation and recoverable errors retained.
- Static public HTML and metadata, consistent canonicals, real 404s, redirects,
  accurate structured data, and a generated published sitemap route manifest.
- Academy links in shared site navigation and global search.
- Additive hierarchy tables/constraints, draft publication controls, and a
  learner-only policy for retrieving an existing certificate link.

See [multi-subject course structure](ACADEMY-MULTI-SUBJECT.md) for the latest
category-scoped roadmaps, flexible lesson content and course identity rules.

## Required before deployment

1. Apply **all five new forward migrations**, in order, using the normal Supabase
   migration process:
   - `20260929090000_correct_foundation_quiz_keys.sql`
   - `20260929120000_academy_curriculum_hierarchy.sql`
   - `20260929150000_academy_atomic_mutations.sql`
   - `20260929160000_academy_quiz_option_balance.sql`
   - `20260929200000_academy_multi_subject_courses.sql`

   **Do not rerun the old reset migration:** it deletes existing learner data.
   The key correction checks expected option text before changing a key.
   Existing failed attempts cannot be safely regraded because the old service
   did not store their submitted answers; review these separately.

2. Deploy the **revised** `learning-progress`, `learning-quiz-submit` and
   `learning-certificate-verify` functions with their shared modules/config. Browser gating does not
   replace server authorization, cooldowns, atomicity or abuse controls. Review
   repeated/concurrent submissions as part of the backend release test.
3. Configure Supabase email redirect allowlists for the production `/learning`
   and `/learning/**` routes. Allow an explicit trusted preview origin only when
   testing there; do not broadly wildcard production redirects.
4. Exercise an actual email link, session persistence/sign-out, lab save,
   pass/fail/cooldown and certificate verification in staging.
5. Build and deploy through the updated Hosting workflow. The Academy build runs
   after `tools/build.py` and before `scripts/build-static-seo.mjs`, so the final
   sitemap and route manifests reflect the published hierarchy. **Do not restore
   the `/learning/**` rewrite**: it would turn unknown lessons back into soft 404s.

Production publishing reads the new Supabase tables and **fails closed** if the
schema/catalogue cannot be read. This prevents deployment of silently stale or
incomplete curriculum. No production database, email or deployment was invoked
from this workspace. Live Supabase remains unreachable here, so actual external
service integration is not certified by the local tests.

## Local preview / offline build

```sh
python3 tools/build_academy_snapshot.py
node scripts/build-academy.mjs --snapshot
node functions/sync-sitemap-core.js
node tools/preview_server.js 8080
```

`--snapshot` explicitly uses the reviewed foundation seed for local development.
Production deployment jobs do **not** use this flag; the isolated QA job does. Checked-in Academy HTML was generated this way.
Live publishing is `node scripts/build-academy.mjs` with the configured Supabase
public key; it never needs to embed a service-role credential in public files.

Reading no longer depends on a live catalogue request: the browser uses the
same published static catalogue as the initial HTML. If account services fail,
reading stays available with a visible notice and mutations/quizzes paused.
If browser enhancement itself fails, the original full HTML lesson stays intact.

## Verification

```sh
node tools/test_academy_seo.mjs
node tools/test_academy_build.mjs
python3 tools/test_academy_content.py
node tools/test_sitemap.js
python3 tools/qa.py
node scripts/verify-seo.mjs
node --check assets/js/learning.js

# Pinned QA-only dependencies, excluded from production Hosting:
npm ci --prefix tools/qa-deps
export NODE_PATH="$PWD/tools/qa-deps/node_modules"
tools/qa-deps/node_modules/.bin/playwright install chromium
node tools/academy_browser_test.js    # preview server must be running
node tools/test_academy_migrations.js # ephemeral LOCAL PostgreSQL; no live writes
node tools/test_academy_course_database.js
node tools/test_academy_multisubject.mjs
node tools/test_academy_backend.js
node tools/test_academy_concurrency.js
node tools/audit_academy_publishing.mjs
```

`OMP_AUDIT_URL` selects another preview; `NODE_PATH` may point to externally
installed packages. `CHROMIUM_EXECUTABLE_PATH` can select a local browser. The
optional `OMP_USE_SERVERLESS_CHROMIUM=1` test switch supports an externally
installed `@sparticuz/chromium` in constrained environments.

### Current results and reproducible commands

See [fix verification](ACADEMY-FIX-VERIFICATION.md) for the complete current suite,
counts, pinned dependency setup, findings closure and live-service limitations.
The general runtime suite now passes all 582 checks, rather than 571/582.

## Coordinated backend rollout

- Deploy the new transaction migration before enabling the updated handlers.
  Schedule a maintenance/cutover window for assessment writes; do not mix old
  handlers with the option/key balancing migration while users submit quizzes.
- Deploy `learning-progress`, `learning-quiz-submit` and
  `learning-certificate-verify`, including `_shared/academy-env.ts` and
  `_shared/academy-mutation.ts`. Hosting CI deploys only Hosting, **not** these
  functions or SQL migrations.
- Use `supabase/config.toml` for these functions: gateway JWT verification is
  disabled because publishable keys are not JWTs. Both mutation handlers still
  require a Bearer session and call `auth.getUser` before the service-only RPC.
  Public certificate lookup intentionally needs no learner session.
- Deploy the matching client, then test signup/email callback, sign-in/out,
  display-name choice, lab save, pass/fail/cooldown, certificate share/verify,
  concurrent submissions, stale-quiz refresh and temporary-service errors.
- Missing historic certificates recover automatically when a completed topic is
  opened. The transaction migration also restores a lost pass when an existing
  certificate proves completion. No learner records/certificates are deleted.
- For future quiz edits, use one database transaction and lock the quiz row
  before editing its question/answer rows. Revision triggers invalidate old forms.
  Current supported format is four questions × four options, five points each,
  passing score 15 and maximum 20. Do not change only the answer key's meaning
  without reviewing its corresponding options.

Production deployment and live verification are still operator rollout steps;
this session made no production writes or deployments.
