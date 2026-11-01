# SEO deployment verification

## What CI deploys

`firebase deploy --only hosting` — **Hosting only, no Functions.** Everything
that must work in production therefore has to be a static file or a Hosting
rewrite. This is why `/sitemap.xml` is a baked file and not a function rewrite:
a rewrite to `functions.sitemap` would 404, because that function is never
deployed (`https://us-central1-password-e9a30.cloudfunctions.net/sitemap`
returns 404).

## The pipeline

Two jobs in `.github/workflows/firebase-static-hosting.yml`:

**`seo-check`** — runs on every push *and* every pull request to `main`, so an
SEO regression is caught at review time rather than after it ships.

```
python3 tools/build.py            # every HTML page, robots.txt, manifest, sitemap snapshot
node scripts/build-static-seo.mjs # + live Supabase articles/products and their HTML
node scripts/fix-site-origin.mjs  # safety net for stale origins
cp sitemap.xml google-sitemap.xml # byte-identical alias
node tools/test_sitemap.js        # sitemap generator + deployment wiring
python3 tools/qa.py               # site-wide links, anchors, tags, SEO basics
node scripts/verify-seo.mjs       # the gate
```

**`deploy`** — `needs: seo-check`, and gated to
`github.ref == 'refs/heads/main' && github.event_name != 'pull_request'`, so a
pull request can never deploy. It rebuilds from scratch and re-runs the *whole*
gate on that artifact — `seo-check` verified its own checkout against its own
Supabase query, and the database may have moved in between, so the earlier
verdict is not trusted for what actually ships. Then:

```
node tools/test_sitemap.js        # re-run on the artifact being deployed
python3 tools/qa.py
node scripts/verify-seo.mjs
firebase deploy --only hosting
curl -X POST https://api.indexnow.org/indexnow   # best-effort, continue-on-error
```

Both gates also emit `::error::` GitHub annotations on failure, so the reason
shows up on the run summary without downloading the job log.

`SITE_ORIGIN` (workflow env) is the single source of the production origin and
feeds `tools/omp_build/layout.py`, `scripts/build-static-seo.mjs` and
`scripts/verify-seo.mjs`. Change it in one place to move the site.

## Sitemap

- `/sitemap.xml` is the endpoint robots.txt advertises. `/google-sitemap.xml`
  is a byte-identical alias kept so an older submission keeps resolving.
- Routes come from `STATIC_ROUTES` in `functions/sitemap-core.mjs`;
  `scripts/build-static-seo.mjs` imports that module rather than keeping a
  second list (the second list is what dropped the tool pages).
- Published articles/products are added from Supabase; drafts and invalid slugs
  are filtered before any URL is built.

## Server-rendered articles

`functions/index.js` renders `/articles/<slug>` with title, description,
canonical, content, Article JSON-LD and BreadcrumbList JSON-LD in the initial
response. **It is not on the CI deploy path.** The static article pages written
by `scripts/build-static-seo.mjs` into `articles/<slug>.html` are what Hosting
serves today, and they carry the same head/JSON-LD.

If you want the function version live, deploy both and add the rewrite:

```
firebase deploy --only functions
firebase deploy --only hosting   # with a /articles/** → article rewrite
```

Then re-request URL Inspection in Search Console.

## Before requesting indexing

1. Search Console property must be the **URL-prefix**
   `https://oopsmypassword.web.app` — **not** `oopsmypassword.com`.
   That apex has no DNS record, so Google reports **Couldn't fetch** for
   every sitemap submitted on a `.com` property.
2. Submit **exactly** `https://oopsmypassword.web.app/sitemap.xml`.
   Remove any older submissions (`/google-sitemap.xml`, the Cloud Function
   URL `…cloudfunctions.net/sitemap`, or any `http://` / `.com` variant).
   Those 404 or never resolve, which is the "Couldn't fetch" error.
3. `curl -sI -A 'Googlebot/2.1' https://oopsmypassword.web.app/sitemap.xml`
   must return 200 with `Content-Type: application/xml`. Then use URL
   Inspection on `/`, `/checker`, `/generator`, `/tools` and one guide
   and click **Request indexing**.

## Three discovery endpoints (added 2026-11-01)

Google reads a well-formed **RSS 2.0** feed as a valid sitemap, so the site now
ships three endpoints from the same build, all carrying the same URL rules
(canonical origin, https, 200-status pages only, no
redirects/noindex/duplicates):

| Endpoint | Content | Use |
|---|---|---|
| `/sitemap.xml` | 297 URLs, every indexable page | primary |
| `/google-sitemap.xml` | byte-identical alias of `sitemap.xml` | rename fallback |
| `/sitemap-index.xml` | `<sitemapindex>` listing `sitemap.xml` **and** `rss.xml` | index declaration |
| `/rss.xml` | 52 newest articles + static guides + comparisons + cheat sheets | **submitted as a sitemap** |

Why: on a shared `*.web.app` hostname, Search Console reports
**"Couldn't fetch"** for `/sitemap.xml` while the file itself returns
200 + valid XML (reported across 2021–2025, unaffected by hosting provider).
A different endpoint that Google has not already marked as failed is the free
workaround until a custom domain is bought.

`robots.txt` advertises all three. `scripts/verify-seo.mjs` now validates the
feed with the same rigour as `sitemap.xml` (`RSS` group): RSS 2.0 root, single
channel, RFC 822 `lastBuildDate`, every `<link>` on the canonical origin,
routable to a real file, no noindex page, no duplicates.

### Search Console steps (free, do these in order)

1. Property **must** be the URL-prefix `https://oopsmypassword.web.app/`.
2. Sitemaps → delete stale entries (`.com`, `http://`, `cloudfunctions.net`,
   `google-sitemap.xml`).
3. Submit, one at a time, waiting for a status between each:
   `sitemap.xml` → `sitemap-index.xml` → `rss.xml`.
4. `rss.xml` accepted = the 52 URLs in the feed are queued regardless of the
   `sitemap.xml` fetch status.
5. URL Inspection → Live test on the sitemap URL: "Page fetch: Successful"
   means the GSC error is cosmetic.

This does **not** replace a custom domain. It keeps discovery alive at ₹0.
