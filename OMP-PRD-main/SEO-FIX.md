# SEO & indexing hardening — audit and changes

Canonical domain, everywhere, with no exceptions:

```
SITE_ORIGIN=https://oopsmypassword.web.app
```

There is one source of truth. `tools/omp_build/layout.py` reads `SITE_ORIGIN`
(defaulting to the live origin); `scripts/build-static-seo.mjs`,
`scripts/verify-seo.mjs` and the CI workflow consume the same variable;
`functions/sitemap-core.mjs` `DEFAULT_SITE` matches it. Nothing hard-codes a
second domain. The retired apex domain survives only as `LEGACY_ORIGIN` — the
value the verifier looks for and rejects.

---

## A. What the audit found

### Fixed in the previous pass (context)

1. GitHub was running the wrong workflow. Two copies of
   `firebase-static-hosting.yml` existed; GitHub only reads `.github/workflows`
   at the **repository root**, so the fuller nested copy never executed.
2. All 38 pages canonicalised to `https://oopsmypassword.com`, a host with no
   DNS record (`getent hosts oopsmypassword.com` returns nothing).
3. The deployed sitemap listed 15 URLs, omitting every tool page and all 15
   guides.
4. `/google-sitemap.xml` was stale and unadvertised.
5. The CI guard grepped for a literal it contained itself, so it would have
   failed every run.
6. `tools/test_sitemap.js` asserted a `firebase.json` rewrite to a Cloud
   Function that CI never deploys (the function URL returns 404).
7. The 404 was indexable with a canonical — a soft 404.

### Found and fixed in this pass

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 8 | **Heading outline broken on 17 of 38 pages.** The site footer used `<h4>` for column titles, which followed the page's `<h2>` content; the checker panel used `<h3>` directly under `<h1>`; `tools.html`, `glossary.html`, `contact.html` and `random-string.html` used `<h3>` cards with no `<h2>` parent. | Parser walk: `h2 -> h4` and `h1 -> h3` on 17 files | Footer titles are now `<div class="footer-col-title">`; a visually-hidden `<h2>Live strength analysis</h2>` heads the checker panel; tool cards, glossary terms and the remaining sections are `<h2>`. `.card h3` was extended to `.card h2, .card h3` so nothing reflows. **Result: 0 violations.** |
| 9 | **`Disallow: /tools/` in robots.txt.** With `trailingSlash:false` the public toolbox is `/tools`, so the rule matched nothing real — but it made a primary, 108-inbound-link page look blocked. robots.txt is not a substitute for noindex. | `robots.txt` line 3 | Removed. Only `/admin/` and `/functions/` remain, and the verifier now rejects any other `Disallow`. |
| 10 | **`/products/<slug>` had no crawlable HTML.** `firebase.json` rewrites `/products{,/**}` to `products.html`, whose canonical is `/products`. Every product detail page therefore served a canonical pointing at the hub; the correct canonical appeared only after `products.js` ran. | `firebase.json` rewrite + `assets/js/products.js:172` | `build-static-seo.mjs` now renders `products/<slug>.html` with a self-canonical, `og:type=product`, and `Product` + `BreadcrumbList` JSON-LD. Hosting only rewrites when **no file matches**, so real files win; `products.js` still hydrates the same URL. `Offer` is emitted **only** when the row has a numeric price. |
| 11 | **Stale `.com` origin in 6 more files** outside the previous sweep (which skipped `tools/`, `functions/`, `supabase/`): `functions/.env.example`, `supabase/functions/README.md`, `supabase/functions/sitemap/index.ts` (CORS allowlist), `tools/products_app_harness.js`, `tools/admin_products_harness.js`, `tools/test_runtime.js`. | `grep -rn 'https://oopsmypassword\.com'` | All rewritten to the live origin. Only intentional `LEGACY_ORIGIN` references remain. |
| 12 | **Title lengths up to 91 chars.** 15 guide titles carried the suffix `— OopsMyPassword Articles` (10 chars longer than the site's standard ` \| OopsMyPassword`), pushing them well past SERP display width. | Measured `<title>` lengths | Suffix standardised; the four longest guide titles rewritten to be tighter without losing intent. **Longest is now 72 chars** (was 91), keywords front-loaded. **URLs/slugs unchanged.** |
| 13 | **Homepage meta description was 202 chars** (Google truncates ~160). | Measured | Rewritten to 160 chars. |
| 14 | **`admin/index.html` and `guides.html` were `noindex` but still canonicalised**, which `tools/qa.py` already treated as an error. | `tools/qa.py` output | Canonicals removed; `head()` now emits neither a canonical nor social cards for `noindex` pages, and `qa.py` errors if a noindex page carries one. |
| 15 | **`.product-cover` styling was an inline `<style>` block in `products.html`** that `tools/build.py` silently discarded on regeneration (cropped cover art would have returned). | `git diff products.html` after running the generator | Moved into `assets/css/styles.css` (`object-fit: contain`, `3:4`) where the generator cannot drop it. |
| 16 | **No Bing/Yandex URL-submission path.** | — | Real generated IndexNow key at `/<key>.txt`, plus a best-effort post-deploy submission step (`continue-on-error`). No secrets involved — ownership is proven by the public key file. |
| 17 | **Generated article/product pages inherited whatever the database content carried.** The article body is injected into the page verbatim, so an author's own `#` title produced a *second* `<h1>`, and repeated `id=""` attributes produced duplicate anchors colliding with the in-page links every other page relies on. Only reachable once the verifier ran against live Supabase rows, so it surfaced in CI, not locally. | CI annotation: `has 2 <h1> elements`, then `heading jumps h1 -> h3` on 3 articles | `normalizeInjected()` strips `id` attributes and shifts body headings so the shallowest one used becomes an `<h2>` — anchored on the content's own minimum, because these articles open with `##` and a flat `+1` shift would land them on `h3`. Each generated page now has exactly one `<h1>` and an unbroken outline. |
| 18 | **`functions/index.js` set `X-Robots-Tag: noindex` on every sitemap response.** Undeployed today (the function URL 404s), so harmless now — but deploying it as written would have told crawlers to drop every URL the sitemap lists, silently un-indexing the site. | Read of the shared `respond()` helper | Removed from the sitemap responder, with a comment explaining why it must not come back. `noindex` remains on article 404s, where it belongs. `verify-seo.mjs` now fails if it reappears (negative control NC5 confirms it fires). |
| 19 | **The generated `Product` schema asserted `availability: https://schema.org/InStock`.** Introduced by this work. The products table has no stock field, so the value was invented — exactly the kind of unsupported claim the brief rules out. | Inspected the emitted JSON-LD field by field | Removed. `availability` is optional in schema.org and not required for Google's Product snippets. `verify-seo.mjs` now fails if it reappears. |
| 20 | **Fabricated rich-result data was only partly guarded.** The verifier rejected `aggregateRating` and `review` on `Product`, but nothing stopped nested `ratingValue`/`bestRating`/`worstRating`, `availability`, or those fields on any other type. | Read of `checkSchema()` | Replaced with one recursive guard covering every JSON-LD object and nesting level. The narrow Product-only copy was removed rather than left overlapping. Negative control NC6 (inject `aggregateRating` + `availability`) fails with 3 distinct findings and exit 1. |
| 21 | **The sitemap asserted a `lastmod` for every static route, from an invented constant.** `sitemap-core.mjs` carried `STATIC_LASTMOD = '2026-08-23'` (pre-existing), and this work added a *second, different* stamp — `'2026-09-11'` in `scripts/build-static-seo.mjs` — so the committed snapshot and the deployed sitemap disagreed with each other. Neither date was derived from anything: these pages are regenerated from `tools/omp_build` on every build. Git commit dates are no substitute — an infrastructure change touches every generator at once and would advertise content churn that never happened. | All 35 snapshot URLs shared one date; the two generators disagreed | `STATIC_LASTMOD` is now empty and the element is omitted entirely where there is no honest date; `<lastmod>` is optional. Articles and products keep their real `updated_at`/`published_at`/`created_at` — the deployed sitemap now dates 6 of 41 URLs, all database-backed. `test_sitemap.js` asserts static routes carry none *and* that DB-backed rows keep theirs; `verify-seo.mjs` rejects an empty element, a malformed date, or a stamp on any generated page. Negative controls NC7 (re-stamp both cores) and NC8 (stamp `/checker`) both fail the relevant check. |

### Audited and found already correct (no change)

- **Titles**: 38 unique, none duplicated.
- **Meta descriptions**: all present, all unique.
- **H1**: exactly one per page.
- **Images**: every `<img>` has an `alt`.
- **JSON-LD**: 32 `BreadcrumbList`, 15 `Article`, 7 `FAQPage`, 1 `WebSite`, 1 `WebApplication` — all parse, all `@context` correct, breadcrumb positions `1..n`, no off-origin URLs.
- **Internal links**: 0 broken, 0 unresolved. The only orphan pages are `/admin/` and `/guides.html`, both intentionally `noindex`.
- **External links from HTML**: 0 (all absolute origins are the canonical one).
- **Mixed content**: 0 `http://` links in any deployed file (the only `http://` strings are `127.0.0.1`/`0.0.0.0` in `tools/` test harnesses, which are not deployed).
- **OG image**: real file, actual dimensions 1200×630 exactly as declared; `og:*` and `twitter:card` on every indexable page.
- **Performance**: every script is `defer` except a tiny inline `theme-init.js`; no render-blocking third-party; `esm.sh` is only reached by a deferred dynamic `import()` inside admin/articles/products. The homepage contains **no `<img>`** (inline SVG), so there is no LCP image penalty.
- **Routing**: `/sitemap.xml`, `/robots.txt` and all 35 sitemap URLs resolve to real files; `/guides/*` 301s to `/articles/*`; unknown URLs return `404.html`.

---

## B. Files changed

**Generators / source of truth**
- `tools/omp_build/layout.py` — `SITE` from `SITE_ORIGIN`; `robots=` support; no canonical or social cards on noindex pages; footer titles de-headed; checker panel `<h2>`; tool cards `<h2>`.
- `tools/omp_build/pages_info.py` — contact/glossary/sitemap heading levels.
- `tools/omp_build/pages_core.py` — `random_string_body` heading level.
- `tools/omp_build/guides3.py` — four over-long guide titles.
- `tools/build.py` — 404 `noindex` without canonical; guides stub canonical removed; robots.txt private-paths-only; IndexNow key discovery; guide title suffix; homepage description.
- `scripts/build-static-seo.mjs` — sitemap from `STATIC_ROUTES`; static product pages with `Product` JSON-LD; byte-identical sitemap alias.
- `functions/sitemap-core.mjs`, `supabase/functions/sitemap/sitemap-core.mjs` — `DEFAULT_SITE` is the live origin (kept byte-identical via `npm run sync:sitemap`).
- `functions/index.js` — live origin default; stylesheet path `style.css` → `styles.css`.
- `assets/css/styles.css` — `.footer-col-title`, `.card h2, .card h3`, `.product-cover` contain.

**Verification / CI**
- `scripts/verify-seo.mjs` — full verifier (see §M).
- `tools/test_sitemap.js` — 23 assertions; runs with or without jsdom.
- `tools/qa.py` — noindex pages must not carry a canonical; indexable pages must.
- `.github/workflows/firebase-static-hosting.yml` — single root workflow: build → normalize → alias → verify → deploy → IndexNow.
- `OMP-PRD-main/.github/workflows/firebase-static-hosting.yml` — **deleted** (GitHub never read it).

**Origin cleanup**
- `functions/.env.example`, `supabase/functions/README.md`, `supabase/functions/sitemap/index.ts`, `tools/products_app_harness.js`, `tools/admin_products_harness.js`, `tools/test_runtime.js`, `scripts/fix-site-origin.mjs`, `assets/js/articles.js`, `assets/js/products.js`, `admin/index.html`.

**Generated output** — all 38 HTML pages, `sitemap.xml`, `google-sitemap.xml`, `robots.txt`, `manifest.webmanifest`.

**New** — `scripts/verify-seo.mjs`, `018a42cd0f172a9604f172cecf80751d.txt` (IndexNow key).

---

## C. robots.txt (as generated)

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /functions/

Sitemap: https://oopsmypassword.web.app/sitemap.xml
```

No legitimate crawler is blocked from public content. `/admin/` is the noindex
admin panel; `/functions/` is not deployed at all. Nothing indexable is
reachable only through a blocked path.

## D. sitemap.xml

- 35 static URLs + one per published article and published product (38 in the
  test build with 1 article and 2 products).
- Every `<loc>` is `https://oopsmypassword.web.app/…`, unique, trailing-slash
  free (except the root, which matches its own canonical), free of query
  strings, free of `.html`.
- Every URL was resolved through the project's own `tools/hosting_router.js`:
  **all resolve to a real file — no 404s, no redirects.**
- No `noindex` page is submitted.
- `lastmod` uses real dates: `published_at` → `updated_at` → `created_at` for
  database rows, and a fixed build stamp for static routes. No invented dates.
- `/google-sitemap.xml` is a byte-identical alias; robots.txt advertises
  `/sitemap.xml` only.

## E. Reproduce

```bash
cd OMP-PRD-main
export SITE_ORIGIN=https://oopsmypassword.web.app
export LEGACY_ORIGIN=https://oopsmypassword.com

python3 tools/build.py            # pages, robots.txt, manifest, sitemap snapshot
node scripts/build-static-seo.mjs # + live articles/products (needs Supabase)
node scripts/fix-site-origin.mjs  # safety net
cp sitemap.xml google-sitemap.xml # byte-identical alias

node scripts/verify-seo.mjs       # SEO gate — exits 1 on any regression
node tools/test_sitemap.js        # generator + deployment wiring
python3 tools/qa.py               # links, anchors, tags, SEO basics
```

## F. Still manual (cannot be done from the repo)

1. **Google Search Console** — verify the **`oopsmypassword.web.app`** property
   (the `.com` property can never verify; it has no DNS). Submit
   `https://oopsmypassword.web.app/sitemap.xml`. Remove any
   `/google-sitemap.xml` submission. Use URL Inspection on `/`, `/checker`,
   `/generator`, `/tools` and one guide to request indexing.
2. **Bing Webmaster Tools** — verify the site (import from GSC, or add the
   meta tag Bing gives you to `tools/omp_build/layout.py` `head()` and
   regenerate). Submit the same sitemap. IndexNow submissions then start
   automatically on each deploy.
3. **DuckDuckGo / others** — no submission endpoint; they follow Bing's index
   and the sitemap.
4. **If you ever want `oopsmypassword.com`** — add it in Firebase Hosting as a
   custom domain, set `SITE_ORIGIN` to it, and 301 the other. Never both as
   canonical.
