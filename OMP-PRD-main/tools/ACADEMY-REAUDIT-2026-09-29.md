# Initial Academy re-audit — 29 September 2026 (historical)

> **Superseded:** all A1–A7 findings below have since been fixed and regression-tested
> in this branch. See [fix verification](ACADEMY-FIX-VERIFICATION.md) for current
> status. This document preserves the original evidence, not the current verdict.

## Verdict: do not approve the complete Academy for production yet

The **current public reading experience, roadmap and technical SEO checks pass**.
The **assessment/progress backend has confirmed correctness defects**. There are
also two gaps in the new frontend/publishing implementation. These must not be
hidden behind the passing browser and migration test counts.

This was an audit of the current working-tree changes and existing Academy Edge
handlers, not a claim about what is already deployed. No production credentials,
user records, emails, migrations, certificates or deployments were modified.
Application behavior has **not** been changed to fix these findings in this audit.

## Confirmed findings

### A2 · High — a delayed progress save can erase a passed result

**Location:** `supabase/functions/learning-progress/index.ts:38–57`.

The handler reads the current record, copies assessment fields such as `passed`,
`highest_score`, `quiz_attempts` and retry timestamps into a patch, then upserts
that whole patch. A quiz can finish between the read and the write. A later
progress write then restores the old values.

**Reproduced:** let `start_lesson` read a pre-pass record; allow a successful quiz
and certificate insert to finish; release the delayed progress write. The final
progress is `passed=false`, `highest_score=0`, but the certificate still exists.

**Required fix:** progress-only actions must not write assessment-owned fields.
Serialize state transitions per learner/topic in the database, including quiz
submission. Use monotonic transitions/conditional updates; do not trust a stale
client or application-level snapshot of the full record.

### A3 · High — concurrent quiz requests bypass the one-attempt cooldown

**Location:** `supabase/functions/learning-quiz-submit/index.ts:64–85, 104–124`.

The cooldown read/check and score/progress write are separate database requests.
Two submissions can both read an unlocked record before either writes its retry
lock. Disabling a browser submit button does not prevent other tabs or requests.

**Reproduced:** two simultaneous unsuccessful submissions both receive HTTP 200
and are graded. Two writes occur, but `quiz_attempts` ends at 1 because both
increment the same old value. A later sequential submission correctly gets 423;
the problem is concurrency, not the basic cooldown comparison.

**Required fix:** move validation, cooldown enforcement, attempt increment and
result persistence into a single transactional operation with per-user/topic
locking. Add parallel-request tests against the actual database operation.

### A4 · High — certificate failure can leave a permanently incomplete success

**Location:** `supabase/functions/learning-quiz-submit/index.ts:72–75, 120–174`.

The handler commits `passed=true` before attempting certificate creation. If
certificate insertion fails, it returns 500 but leaves the pass saved. A retry
hits the already-passed branch and returns the missing certificate as `null`;
it never repairs the failed issuance.

**Reproduced:** inject one certificate insert error. First response: HTTP 500,
progress already passed. Remove the injected error and retry: HTTP 200,
`status=PASSED`, `certificate=null`, still no certificate.

**Required fix:** persist the pass and its certificate in the same transaction,
with a uniqueness constraint/idempotent issuance path. Also handle already-passed
records whose certificate is missing, including any historic partial failures.

### A1 · High, configuration-dependent — supported legacy key fallback is broken

**Location:** `supabase/functions/learning-progress/index.ts:7–8, 17–21`.
Related edge case: `learning-quiz-submit/index.ts:18–36`.

If grouped key environment variables are absent, `envKey()` successfully parses
`{}` and returns an empty string instead of consulting the legacy fallback. A
deployment with valid `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` can
therefore fail to initialize the client. In the quiz handler, a grouped JSON
object without a `default` entry also skips the intended fallback.

**Reproduced:** only the two valid legacy keys are provided to the real progress
handler through a local environment fixture. It returns HTTP 500 before writing.
This does **not** establish which key layout the live deployment uses.

**Required fix:** one tested environment resolver shared by the handlers. Use a
non-empty grouped default when available, otherwise the legacy value; validate
missing configuration before making calls. Test missing, empty, malformed and
valid grouped values plus legacy-only configurations.

### A5 · Medium — mutation handlers bypass parent publication state

**Location:** `learning-progress/index.ts:32–36` and
`learning-quiz-submit/index.ts:53–60` under `supabase/functions/`.

The new RLS policies hide topics whose path/module/category is unpublished.
However, the existing mutation handlers query with a service-role client and
check only `topic.status`. They do not check active category/published path and
module. Public read policies cannot enforce this for a service-role query.

**Reproduced:** with a known topic ID, valid learner fixture and draft parent
path, the real quiz handler grades and issues a certificate without querying
`learning_paths` or `learning_modules`. The separate local PostgreSQL suite
confirms that public reads of the same draft-parent hierarchy are hidden.

**Required fix:** enforce the complete publication chain in the mutation
transaction, and return unavailable/not-found for topics under unpublished
parents. This is a publication-boundary issue, not evidence that one learner can
read another learner's private records or bypass authentication.

### A6 · Medium — verification outages are mislabeled as missing certificates

**Location:** `assets/js/learning.js:625–631`.

All non-OK JSON responses take the “Certificate not found” branch. That includes
a genuine server failure, not just an invalid ID or a missing certificate.

**Reproduced in Chromium:** intercept the verification response with HTTP 500
and `{ "error": "Verification failed." }`. The page heading is
**“Certificate not found”**, not a temporary-unavailability/retry message.

**Required fix:** distinguish invalid/not-found responses from transient 429/5xx
responses and transport failures. Add browser cases for 400, 404, 429, 500,
timeout and success, with retry behavior where appropriate.

### A7 · Medium — future publication can expose placeholder-only lessons

**Location:** `assets/js/academy-model.mjs` content validation and route assembly;
`assets/js/academy-views.mjs:135–138` placeholder fallback.

The model checks the types of present content fields, not that a published
lesson contains the required substantive sections. An empty content object
passes validation and becomes an indexable route. This matters as more authors
and topics are added; current four lessons are not empty.

**Reproduced:** replace one topic's content with `{}` in memory. The public model
accepts it and the renderer creates six “This section is being prepared” blocks.

**Required fix:** enforce a publishing contract for non-empty required content,
module outcomes and relevant resources. Keep incomplete items as drafts rather
than generating indexable placeholders. Avoid arbitrary word-count guarantees;
validate the curriculum's actual required teaching fields.

## Additional product-quality follow-ups

- **Predictable quiz answer positions:** the current corrected foundation seed
  puts all 16 correct answers at original option index 3, and the UI preserves
  their order. This corrects the earlier grading mismatch but makes every answer
  “D”. Randomize displayed options while preserving the original answer-index
  mapping, or deliberately rebalance questions and keys together. Test the map.
- **Certificate identity:** email-only signup does not collect a display name.
  The issuer falls back to “OMP Learner” if metadata lacks a name. Decide whether
  a learner-controlled display name is required before public certificate sharing.
- **Management UI:** the hierarchy/database/publisher exist, but there is no new
  visual Academy CMS. Content management remains through trusted Supabase
  administration/migrations and a publish build. This is a scope limitation, not
  a feature that should be described as already delivered.

## Fresh verification results

| Check                             | Result              | What it establishes                                                                                                                                          |
| --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Academy browser suite             | 30 checks passed    | Tested discovery flow, mobile widths, reader, account/quiz fixture states, eight automated axe scans, no-JavaScript reading, stable canonicals and redirects |
| Model/publication suite           | 17 passed           | Current output/routes/metadata/schema, draft filtering and second-category model support                                                                     |
| Seed/content guardrails           | 4 passed            | Reviewed seed and hierarchy migration consistency, exclusion of learner/assessment data                                                                      |
| Isolated build pipeline           | 3 passed            | Build using a local REST fixture, failure stops publication, retired generated pages removed                                                                 |
| Local PostgreSQL migration checks | 5 passed            | Schema/RLS/foreign keys and preservation of existing progress/certificates during migration                                                                  |
| Sitemap tests                     | 25 passed           | Both cores/manifests and static sitemap deployment wiring                                                                                                    |
| Static HTML/link audit            | 47 files; no errors | Current local links, anchors, structure and metadata basics                                                                                                  |
| Site-wide SEO verification        | Passed; 12 warnings | Current local canonicals, metadata, structured data, sitemap and discovery; warnings concern long titles on other pages                                      |
| Legacy runtime suite              | 571/582 passed      | 11 pre-existing failures remain, largely asserting older routing/dynamic-sitemap contracts; they require separate triage                                     |
| New targeted defect reproductions | A1–A7 confirmed     | Evidence of gaps beyond the above green suites, **not additional passing security checks**                                                                   |

### Why the earlier green tests did not catch these

The browser suite stubs the Edge APIs; it tests the frontend's reaction to
responses, not the real handler's concurrency or transaction behavior. The
PostgreSQL suite tests migrations and RLS, not the Edge read-modify-write sequence.
These are useful tests with limited scopes. Neither is a substitute for testing
the real mutation logic with concurrent requests and partial failures.

A6 and A7 are omissions in the newer frontend/publishing implementation, not just
inherited backend issues. They are explicitly included rather than attributing
all problems to external services or the old repository.

## What is still unverified

- Actual production migrations, key configuration, function deployments and RLS.
- Real email delivery, callback allowlists, multi-device sessions and sign-out.
- Real end-to-end lab saving, transactional assessment/certificate behavior.
- Deployed headers, actual Core Web Vitals, Search Console indexing and rankings.
- Safari/Firefox/real-device behavior and a manual assistive-technology audit.

The Supabase endpoint could not be reached from this workspace again during this
re-audit (TLS connection failed). That is an **environment/testing limitation**,
not proof that the public service is unavailable everywhere. No write calls were
made to the live service.

## Recommended release gate

1. Fix A2/A3/A4 as one database-transaction design, not three client workarounds.
2. Fix A1 and enforce the full hierarchy in A5.
3. Fix A6 and A7; address predictable answer positions before relying on scores.
4. Convert the defect reproductions into regression tests asserting the corrected
   behavior; add real-database parallel/partial-failure coverage.
5. Apply the required migrations and deploy the changed Edge handlers in staging.
6. Complete a real learner journey, then rebuild/re-run SEO and accessibility
   checks against the exact artifact intended for production.

**Conclusion:** the Academy's organization and reading experience are suitable
for continued review. Do not launch scored completion/certificates as a fully
reliable production experience until the confirmed defects and live release
checks above are resolved.

## Original reproduction entry points (now updated to fixed-behavior regressions)

```sh
# Node 22.13+; no npm dependencies, network or database credentials required.
node tools/audit_academy_backend.js
node tools/audit_academy_publishing.mjs
```

The backend audit executes the actual Edge handler source after stripping
TypeScript/imports, with controlled in-memory Supabase responses. It proves the
application control-flow defects, not live-deployment behavior. Its original assertions demonstrated bugs; they have now been replaced by
fixed-behavior regression tests, as recorded in the fix verification report.
A6 was additionally checked in Chromium with an intercepted HTTP 500 response;
it does not require a real or privately held certificate.
