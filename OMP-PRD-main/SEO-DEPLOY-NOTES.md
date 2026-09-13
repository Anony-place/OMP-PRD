# SEO deployment verification

## What CI deploys

`firebase deploy --only hosting` — **Hosting only, no Functions.** Everything
that must work in production therefore has to be a static file or a Hosting
rewrite. This is why `/sitemap.xml` is a baked file and not a function rewrite:
a rewrite to `functions.sitemap` would 404, because that function is never
deployed (`https://us-central1-password-e9a30.cloudfunctions.net/sitemap`
returns 404).

## The pipeline

```
python3 tools/build.py            # every HTML page, robots.txt, manifest, sitemap snapshot
node scripts/build-static-seo.mjs # + live Supabase articles/products, article HTML
node scripts/fix-site-origin.mjs  # safety net for stale origins
cp sitemap.xml google-sitemap.xml # byte-identical alias
node scripts/verify-seo.mjs       # gate — fails the deploy on any SEO regression
firebase deploy --only hosting
```

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

1. Search Console property is `oopsmypassword.web.app` — the `.com` property
   cannot be verified (no DNS record).
2. `node scripts/verify-seo.mjs` passes locally.
3. `curl -sI https://oopsmypassword.web.app/sitemap.xml` returns 200 with an
   XML content type, and the `<loc>` values match the canonicals.
