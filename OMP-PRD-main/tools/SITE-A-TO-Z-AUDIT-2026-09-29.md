# OopsMyPassword — fresh A-to-Z re-audit

**Date:** 29 September 2026
**Branch:** `arena/01a0eb8c-omp-prd`
**Scope:** public tools, articles/products, Academy, private admin, data boundaries,
newsletter, accessibility, responsive layout, security configuration/dependencies,
publishing, routing, SEO and release operations.

## Verdict

**The expanded local audit passes after the fixes below. Full production readiness
is still not established.** The latest GitHub deployment attempt did not start
because of billing/spending restrictions, newsletter providers are not configured,
and production database/email integrations have not been verified. Contact spam
protection is also an open server-side gap.

No production deployment, migration, account change, subscriber send or Search
Console modification was performed. Existing work on the session branch was
preserved. The preview was restarted on port 8080 with the audited fixes.

## Findings fixed in this re-audit

| Finding | Impact and fix | Verification |
|---|---|---|
| Outdated optional Firebase dependencies | Production dependency audit reported **13 advisories: 1 critical, 5 high, 7 moderate**. Updated/pinned Firebase Admin 14.5.0 and Functions 7.4.0, kept explicit v1 exports, removed an unused test SDK and applied a scoped patched `gaxios → uuid 11.1.1` override. | Fresh locked install, **0 reported advisories**, 7 actual SDK/HTTP handler groups including Gaxios multipart compatibility. These handlers are not wired into the current Hosting-only deploy; live exploitability was not established. |
| Fresh database setup failed | `is_admin()` referenced `profiles` before creation; product grants/triggers ran before the products table existed. Reordered dependencies. A duplicated Storage policy also broke reruns. | The actual base SQL now installs **twice** in disposable PostgreSQL, without errors. |
| Base contact grant contradicted its documentation | Base setup allowed table-wide anonymous INSERT although it claimed only three writable fields. Restricted it to `name`, `email`, `message`. | SQL tests reject forged metadata and preserve admin triage. Historical reconciliation 02 already contains this restriction; this is **not proof of a live privilege leak**. |
| Preview exclusion bypass | A raw `/assets/../tools/qa.py` request could bypass the preview router's deployment exclusions. Rejected dot segments/backslashes and tightened the filesystem boundary. | Reproduced before the fix; actual HTTP request returns **404** after restart. This was a **local preview issue**, not a demonstrated Firebase Hosting traversal. |
| Mobile overflow outside the homepage | Generator, passphrase, entropy, checklist, sitemap and several guides overflowed at 320/390px. Grid intrinsic sizes, inline sitemap column rules and an unwrapped entropy table were responsible. | Fixed shrinking/wrapping and scoped table scrolling—not global overflow clipping. **288 route/viewport checks pass**. |
| Missing switch labels | Five generator options and two passphrase options lacked accessible names. | Added meaningful names in the generator templates; dark/light accessibility scans pass. |
| Keyboard-inaccessible scrollable tables | Wide tables could be scrolled visually but were not reliably keyboard-focusable. | Static and sanitized tables now receive keyboard focus; a real ArrowRight test scrolled the entropy table 40px without page overflow. |
| Links distinguished only by color | Products copy contained inline links without a non-color cue. | Text links are underlined; both themes pass the relevant accessibility rule. |
| Admin PDF CSP mismatch | Default public CSP blocked blob workers used by PDF.js; local page-image previews also need a scoped blob image allowance. | Added **admin-only** worker/image allowances, not `unsafe-eval`. Actual pinned PDF.js extracts text and renders a page image under the configured CSP. Public/default CSP still blocks the worker control probe. |
| Dark admin selects unreadable | Native category/status selects showed near-white text on a near-white background (**1.09:1** measured contrast). | Selects now use the same themed field styling; the real editor passes both themes. |
| Contact could hang and advertised an unresolved mailbox | There was no request timeout. The fallback used `hello@oopsmypassword.com`; this domain's MX lookup returned ENOTFOUND while a control lookup succeeded. | Added a 15-second abort and duplicate-submit guard; failures retain the message for retry. Removed the unverified fallback and routed disclosure instructions to the contact form. No replacement address was invented. |
| Outdated privacy/security statements | Security copy claimed no database, authentication surface or remote scripts. README incorrectly described the breach demo as making a live prefix request. | Corrected the published source/templates and README. The breach tool remains an explicitly local educational demo, not a live breach lookup. |
| Incomplete test coverage | Older product/admin harnesses had stale SDK interception/mocks and a truncated PNG fixture. Browser sweeps did not enforce production headers or resize every route. | Repaired fixtures without weakening upload validation; **63 public-product** and **42 admin-product** checks pass. Added full-site CSP/accessibility/layout, real PDF and site-database suites to CI. |

### What was not counted as a product defect

The first expanded scan also sampled intermediate colors during theme transitions.
The final scanner waits for the real transition to settle rather than suppressing
contrast rules. Directly visiting the uploaded `/404` page legitimately returns
200; **unknown URLs** must return 404, and separate routing/release tests enforce
that distinction. Neither test correction is counted as a site fix above.

## Fresh executed verification

These are local executions from this audit, not copied production or previous-run
results. Test counts refer to their respective suites; heterogeneous groups are
not added together into a misleading single score.

| Area | Result |
|---|---|
| Whole-site browser with emulated production security headers | **48 routes, 96 WCAG-tagged axe scans, 288 layout checks, 0 findings** |
| Themes / widths | Dark + light; 320, 390, 768, 1280, 1440, 1920px per route |
| Academy/newsletter browser | **35 checks, 10 axe scans**; no-login learning, local data, errors, consent actions, legacy certificate fixture |
| Real admin PDF browser | **5 groups**, two-theme editor accessibility, 320/390/768/1440px; real PDF.js, fixture authorization |
| Broad browser interactions | **0 findings**, explicitly mocked external reads |
| General runtime | **587/587** |
| Public products / admin products | **63/63 / 42/42** |
| Page boot / routing matrix / sitemap | **39/39 / 39/39 / 25/25** |
| Site publishing/privacy contracts | **7 groups**, including preview traversal and scoped admin CSP |
| Site database | **6 groups**, actual SQL with modeled Supabase auth/storage primitives |
| Optional Firebase SDK/handlers | **7 groups**, real local HTTP, external services mocked |
| Local Academy store | **13 groups** |
| Newsletter SQL/handler | **18 groups**, fake captcha/mail providers; no email sent |
| Multi-subject model | **8 groups** |
| Academy model/publication SEO | **19 groups** |
| Publication/content/answer mapping | **15 groups**, plus **4 Python content tests** |
| Isolated complete publication pipeline | **8 groups**, including capped pagination and fail-closed preservation |
| Historical backend / migration / course DB | **10 / 8 / 7 groups** |
| Real PostgreSQL concurrent transactions | **5 groups**, disposable local cluster |
| Exact-live-release verifier tests | **8 fixture groups**; current snapshot covers 65 artifacts, not a live-release pass |
| HTML/link/SEO analysis | **49 HTML files, 44 sitemap URLs**, no broken links/orphans reported |
| Dependency audits | **0 reported vulnerabilities** in root publisher, optional Functions and QA dependency sets |
| Language/configuration checks | All **4 Edge handlers** type-check; **36 application/publisher JS files** syntax-check; workflow YAML parses; `git diff --check` clean |
| Visual checks | Inspected new 320px entropy tool and guide screenshots; content and navigation fit |

Raw local logs and fixture result summaries are in `/home/user/omp-reaudit/`.
Reproducible tests are under `tools/`; the generated browser JSON is deliberately
ignored by Git. CI now includes the added suites and pinned Functions dependency
checks. Its execution remains blocked externally, so this is not a green CI claim.

## Product contract preserved

- No learner login or email-based progress sync. Optional name, progress and
  self-check results remain local to the browser/device.
- Academy → category/subject → course → module → lesson remains separate and
  extensible. Private multi-subject fixtures do not become public courses.
- The real public catalogue is still **1 subject, 1 course, 4 lessons**.
- Shared Academy footer links remain present across public pages.
- Newsletter email is separate consent data, never a learner identity.
- Admin authentication, database role boundaries, original learner record IDs and
  historical certificate verification paths are preserved.
- No historical reset migration was run against production. Existing hardened
  projects must use reviewed forward changes, not blindly replay base setup SQL.

## Open release gates and limitations

### 1. Deployment runner — account-owner action required

Latest main run:
https://github.com/Anony-place/OMP-PRD/actions/runs/36524256974

GitHub's annotation says the job did not start because recent payments failed or
the spending limit needs increasing. Hosting was skipped. This audit reconfirmed
that run's result; it did not inspect or change billing settings. No newer
successful release of this work has been established.

### 2. Newsletter — not operational yet

The owner confirmed provider setup has **not** been done. Resend sender/domain/DNS,
Turnstile, Supabase server secrets, reviewed migration/Edge deployment, private
scheduler and real inbox/confirmation/unsubscribe checks are still required.
`newsletter-config.json` stays disabled. Green fixture tests do not substitute for
real delivery or suppression/bounce verification. See `NEWSLETTER-SETUP.md`.

### 3. Contact spam protection — open server-side gap

Contact writes are field-restricted and private, but the repository does not
implement a server-verified challenge or robust server-side abuse limit for the
public REST insert. Browser cooldown and honeypot checks are bypassable. Add and
test a trusted server gate before treating this as a hardened public submission
service. A verified support mailbox is also still needed if an email fallback is
wanted; the unresolved address is no longer advertised by the current contact UI.

### 4. Actual production integrations — unverified

Direct sandbox HTTPS requests to Hosting and Supabase failed TLS negotiation
(curl 35 / no HTTP response). A separate page-retrieval service successfully read
the public homepage with its older title/copy, so these failures must **not** be
reported as proof of a production outage. They also do not prove that the updated
build, live RLS, admin credentials, CMS writes or certificate API work in production.
No deployment/provider credential variables were present in this environment.

After the approved release, run `scripts/verify-live-release.mjs` against the
exact artifact being shipped and separately verify the live service flows.

### 5. Search appearance and performance — no guarantees

Local canonical/sitemap/structured-data checks pass. The reported Google site-name
label “Google” remains unconfirmed; this audit does not invent a cause or promise
an indexing outcome. After deployment, inspect the exact homepage in Search
Console and request recrawling. Field Core Web Vitals, real slow-device performance,
large-list newsletter load and real provider deliverability were not certified by
localhost/fixture tests.

## Bottom line

The re-audit found and repaired material issues that the narrower earlier checks
missed. The expanded local regression suite is green. **Do not label the entire
live service production-ready until the open gates above are completed and verified.**
