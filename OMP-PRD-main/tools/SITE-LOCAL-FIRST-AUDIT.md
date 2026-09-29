# Local-first Academy and site-wide audit — 29 September 2026

> Later expanded verification: see [SITE-A-TO-Z-AUDIT-2026-09-29.md](SITE-A-TO-Z-AUDIT-2026-09-29.md).
> This document retains the earlier checkpoint; the A-to-Z report records additional fixes and open gates.

## Product contract corrected

The intended platform is **not a learner-account LMS**. The previous Academy
login, email magic links, server progress and account gates contradicted the
owner's requirements and the site's no-account promise. They have been removed
from the active learner interface.

- Optional display name, lesson/course progress, practice status, best self-check
  score and reading position stay on the same browser/device.
- No Supabase auth client, learner session lookup or progress/quiz mutation
  request is made during normal Academy use. The browser test asserts this.
- No name or progress is attached to an email. Newsletter requests contain only
  subscription-specific email, consent and anti-spam fields.
- Clearing site data removes local records; sharing a browser shares records.
  Device settings includes backup/restore and a confirmed Academy-only reset.
  Unknown/retired lessons are skipped during restore; backups cover the current
  published catalogue. Theme/checklist preferences are not reset.
- Denied storage and quota failures use tab-only fallback with an explicit notice.
  Corrupt JSON does not crash the reader. Backup imports validate before writing.
- Course/lesson UUID ownership prevents a same-named lesson inheriting another
  course's progress. Subjects, curricula and course bookmarks remain separate.
- Checks are self-assessment, not secure exams. New local completions do not issue
  server-verified certificates. Existing certificate verification routes and old
  database records are retained; nothing is destructively reset or auto-imported.
- Admin authentication is intentionally retained for protected publishing. It is
  not a login requirement for visitors or subscribers.

## Confirmed gaps fixed

| Finding                                                                  | Change                                                                                                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learner login contradicted the product                                   | Local-only reader/profile/progress; no email gates                                                                                                       |
| “Verified” grading/certificates would be misleading locally              | Public self-checks, explanations, immediate retries, explicit personal-record labels                                                                     |
| Local-data loss/blocked storage not explained                            | Device-only notice, safe fallback, backup/restore and scoped reset                                                                                       |
| Academy footer differed or was absent across generators                  | Dedicated Academy column and one generated footer used by Python pages, Academy pages, static article/product pages and the optional legacy SSR function |
| Newsletter collection/delivery did not exist                             | Separate consent + confirmation + suppression + new-article queue/worker; disabled until configured                                                      |
| New article mail could link to a not-yet-built page                      | Worker defers until the canonical article URL returns real HTTP 200 HTML                                                                                 |
| Unsubscribe followed by resubscribe could revive queued mail             | Transactional cancellation; old delivery identities remain deduplicated                                                                                  |
| Public privacy copy claimed only theme was saved and no services existed | Explicit local Academy records, contact messages, publishing services and newsletter processors                                                          |
| Static article/product HTML relied on regex “sanitization”               | Pinned parser-based `sanitize-html` allowlist, shared with the optional SSR function; encoded URL/event/namespace payload regressions                    |
| Header/search pushed content sideways at 320px and 1280px                | Responsive navigation/actions, mobile-menu search, shrinkable hero and wrapping narrow-screen CTAs                                                       |
| Home-page reveal CSS hid content without JavaScript or while its observer loaded | Essential content is visible by default; browser regression checks the no-JS headline |
| Legacy SSR could invent publication dates or canonicalize a 404          | Only valid stored dates emitted; no canonical on a missing article                                                                                       |
| Site-name signals could be made more consistent                          | Brand-first home title, WebSite primary/alternate names including the lowercase subdomain, linked Organization identity and logo                         |

Password-tool runtime checks remain in place. Password values are not passed to
newsletter, learning storage, or network APIs. All published pages still have
canonical routes, actual links and crawlable initial HTML. No fake courses were
published to make the site look larger.

## Newsletter rollout is not complete

The implementation uses Resend for delivery and Cloudflare Turnstile for abuse
protection. The repository has no configured verified sender or scheduler.
`newsletter-config.json` is therefore **disabled**, not a fake working form.

[NEWSLETTER-SETUP.md](NEWSLETTER-SETUP.md) documents migration, Edge secrets,
provider/DNS verification, confirmation/unsubscribe, private dispatch scheduling,
retry reconciliation and enabling the frontend last. SQL/handler tests use local
PostgreSQL and fake provider responses; they do not prove inbox delivery.

Publishing an article in the database does **not** automatically rebuild Hosting.
The existing publish/build workflow (or an operator-configured webhook) must
make its HTML URL available. The queue waits rather than mailing broken links.

## Google showing “Google” instead of the site name

The checked-in homepage already identified the site as OopsMyPassword; there was
no homepage `WebSite.name = Google` setting to simply replace. The returned web
search result title was OopsMyPassword, but that is **not** proof of what a user's
particular Google result's site-name label/icon currently displays. Raw live
HTML/header fetches from the sandbox failed with TLS/connection errors; a separate
page-fetch tool could retrieve the live homepage's visible content. A screenshot,
exact search query and result URL are still needed to reproduce the reported label.

The code now gives consistent primary and fallback names and an organization/logo
identity. This is a best-practice improvement, **not a promise of an instant SERP
change or a confirmed diagnosis of Google's existing choice**.

After deployment, use Search Console URL Inspection on the exact HTTPS homepage,
check Google's selected canonical and rendered HTML, request a recrawl, and allow
Google to reprocess it. Do not point canonicals to an unconfigured/dead domain.
A custom domain is optional—not a requirement for a subdomain site name.

Official source: [Google Search Central: site names](https://developers.google.com/search/docs/appearance/site-names).
Google states that site-name selection is automated, uses home-page signals
(particularly `WebSite`), supports domains/subdomains, and considers alternate names.

## Audit limits

No production database migration, deployment, email send or Search Console change
was performed. Live email delivery, scheduler throughput, live public-data APIs and
Google's eventual displayed site name still require deployment-side verification.
The older broad browser audit initially included false positives (hidden search
inputs treated as broken tools; gradient text compared against transparent parents;
404 pages expected to have a canonical). Those checks were corrected, not site
behaviour weakened. Network failures to esm.sh/Supabase are recorded separately
from deterministic local fixture checks; do not mislabel sandbox failures as a
confirmed production outage.

Historical account-UI browser scenarios are retained as text in
`tools/archive/academy_browser_auth.js.txt`, not executed against the new product.
Legacy database/handler regression suites still protect preservation and historical
certificate behaviour. The new no-login tests replace the former account UX gate.

## Executed verification

| Local suite                                            | Result                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| No-login Academy + newsletter browser                  | 35 checks, 10 axe scans; 320/390/768/1440px                                                                  |
| Broad site browser audit                               | 39 routes, tool interaction and responsive checks; 0 findings with explicitly mocked external read services |
| Local-storage / public self-check model                | 13 groups                                                                                                   |
| Newsletter actual SQL + actual Edge handler            | 18 groups; provider/captcha mocked                                                                          |
| Site identity / footer / publication sanitizer         | 5 groups                                                                                                    |
| General runtime                                        | 587/587                                                                                                     |
| Page-boot smoke                                        | 39/39                                                                                                       |
| Routing matrix                                         | 39/39                                                                                                       |
| Sitemap wiring                                         | 25/25                                                                                                       |
| Multi-subject model/view isolation                     | 8                                                                                                           |
| Model/publication SEO                                  | 19                                                                                                          |
| Isolated full publication pipeline                     | 8                                                                                                           |
| Publication/answer mapping compatibility               | 15                                                                                                          |
| Reviewed content snapshot                              | 4                                                                                                           |
| Historical backend / migration / multi-course database | 10 / 8 / 7                                                                                                  |
| Real PostgreSQL overlapping legacy transactions        | 5                                                                                                           |
| HTML/links/SEO                                         | 49 pages / 44 sitemap URLs; no errors or warnings                                                           |
| Deno                                                   | All four Edge handlers type-check                                                                           |
| New root build-dependency audit                        | 0 known vulnerabilities reported by npm audit                                                               |
| Whitespace                                             | git diff --check clean                                                                                      |

The unmocked broad browser run observed eight external-service/console findings
associated with sandbox connection failures to esm.sh/Supabase. The deterministic
rerun does not erase that limitation: production reachability was not certified.
The dependency audit above is for the new root publishing dependencies, not a
claim that every historical backend dependency has been security-audited.

CI now installs the pinned publishing dependency, checks the newsletter handler,
and runs local-storage, newsletter, sanitizer/identity, Academy browser and broad
site-browser regression suites. A package.json made Deno default to manual Node
resolution; the check explicitly uses `--node-modules-dir=none` so Edge npm imports
resolve from Deno's cache. GitHub-hosted CI itself was not executed here.


## Production-readiness continuation (2026-09-29)

The release audit found and fixed a real hosted-environment incompatibility:
Supabase's standard gateway changes HTML GET responses to plain text. Human email
confirmation/unsubscribe now lives at the Firebase-hosted `/email-preferences`,
with a noindex page, fragment token removal and explicit POST consent. Legacy API
GET links redirect read-only; RFC 8058 one-click POST is retained. Browser checks
cover both actions, bad links, API failure/retry, 320px layout and untouched local
Academy data. A hash-only navigation bug discovered by the browser test was also
fixed; changing links in the same tab now resets the action safely.

The newsletter queue now preserves active fifth-attempt leases and bounds each
batch to two jobs with database timeouts, avoiding sequential work beyond the
Supabase free-tier request deadline. SQL tests cover both fixes. The article
publisher no longer treats a publishable key as a JWT, handles server pagination
caps and rejects malformed API responses before replacing existing pages.

The workflow pins its CLI and explicitly selects the Firebase project. A new
post-deployment verifier compares exact live artifact bytes, MIME/security headers
and a real 404 against the tested build (65 resources for the current snapshot).
Eight fixture groups exercise this verifier; **it has not passed against a newly
deployed production release**, because no such deployment has occurred.

GitHub run 36524256974 failed before executing steps due to account
billing/spending limits; deployment was skipped. Secret listing is forbidden to
the current integration (403), not evidence that secrets are absent. Provider
setup and actual newsletter inbox delivery remain unverified and collection is
still disabled. See `PRODUCTION-RELEASE-CHECKLIST.md` for the exact remaining
account-owner and release gates. These are not replaceable by more local green
checks or a promise about Google's chosen site name.
