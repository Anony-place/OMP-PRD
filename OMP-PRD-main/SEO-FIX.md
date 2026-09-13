# Sitemap & indexing fixes

## What was actually broken

1. **The deploy workflow that GitHub ran was the wrong one.** Two copies of
   `firebase-static-hosting.yml` existed: one at the repository root
   (`.github/workflows/`) and a fuller one at `OMP-PRD-main/.github/workflows/`.
   GitHub Actions only reads `.github/workflows/` at the *repository root*, so
   the nested copy — the one containing `tools/build.py`, the site-origin
   normalization and the sitemap regeneration — **never ran**. The root copy
   ran only `scripts/build-static-seo.mjs`, which is why the live sitemap was
   truncated and the canonicals were never rewritten.

2. **Every canonical pointed at a domain that does not resolve.**
   `tools/omp_build/layout.py` had `SITE = "https://oopsmypassword.com"` hard
   coded, and `scripts/fix-site-origin.mjs` skips `tools/`. All 38 HTML pages
   therefore shipped `<link rel="canonical" href="https://oopsmypassword.com/…">`
   while the site lives on `https://oopsmypassword.web.app`. `oopsmypassword.com`
   has no DNS record, so Google was told to index a host that does not exist —
   the direct cause of pages staying out of the index.

3. **The deployed sitemap omitted the site's main pages.**
   `scripts/build-static-seo.mjs` had its own 10-route list instead of the 20
   static routes + 15 guides in `sitemap-core.mjs`, so `/checker`, `/generator`,
   `/tools`, `/breach-check`, `/password-health`, `/entropy`, `/passphrase`,
   `/random-string`, `/security-checklist`, `/sitemap` and all 15 guides were
   never submitted to Google.

4. **`/google-sitemap.xml` was stale and orphaned.** Nothing in the pipeline
   regenerated it, and `robots.txt` did not point at it, so it kept serving an
   older URL set than `/sitemap.xml`.

5. **The verification guard matched itself.** The nested workflow grepped for
   the literal string `https://oopsmypassword.com` — which appears in the grep
   command itself — so the step would have failed on every run.

6. **`tools/test_sitemap.js` asserted a wiring that does not exist.** It
   required `firebase.json` to ignore `sitemap.xml` and rewrite `/sitemap.xml`
   to a Cloud Function. Neither is true: CI deploys `--only hosting` and
   `https://us-central1-password-e9a30.cloudfunctions.net/sitemap` returns 404,
   so that rewrite would have made the sitemap 404 too.

7. **The 404 was indexable with a canonical to `/404`** — a soft 404 in Search
   Console. `admin/index.html` and `guides.html` were `noindex` yet still
   carried canonicals, which `tools/qa.py` already treated as an error.

## What changed

| Area | Change |
|---|---|
| `tools/omp_build/layout.py` | `SITE` now reads `SITE_ORIGIN`, defaulting to the live `https://oopsmypassword.web.app`. `head()`/`page()` accept `robots=`; a `noindex` page emits no canonical and no social cards. |
| `tools/build.py` | 404 is generated `noindex, follow` with no canonical; the `/guides.html` stub drops its canonical. |
| `scripts/build-static-seo.mjs` | Builds the sitemap from `STATIC_ROUTES` in `functions/sitemap-core.mjs` (no second route list), validates slugs, and writes `sitemap.xml` + a byte-identical `google-sitemap.xml`. |
| `functions/sitemap-core.mjs`, `supabase/functions/sitemap/sitemap-core.mjs` | `DEFAULT_SITE` is the live origin (kept byte-identical via `npm run sync:sitemap`). |
| `functions/index.js` | Live origin default; stylesheet path fixed to `/assets/css/styles.css`. |
| `.github/workflows/firebase-static-hosting.yml` | Single root workflow running build → normalize → alias → verify → deploy. Dead origin lives only in `LEGACY_ORIGIN`. |
| `scripts/verify-seo.mjs` *(new)* | Pre-deploy gate: canonicals on-origin, 404 noindex, sitemap well-formed/complete/unique, robots.txt points at the shipped endpoint, aliases identical. |
| `tools/test_sitemap.js` | Asserts the static-file wiring, the live origin, robots.txt, the alias, the workflow pipeline, and per-page canonicals. Runs with or without jsdom. |
| `tools/qa.py` | No longer demands a canonical on `noindex` pages; now errors if one is present. |
| `assets/css/styles.css` | `.product-cover` moved to `contain` / `3:4` — previously an inline `<style>` in `products.html` that `build.py` silently discarded. |

## Verifying

```bash
cd OMP-PRD-main
export SITE_ORIGIN=https://oopsmypassword.web.app
python3 tools/build.py          # regenerate pages, robots.txt, sitemap snapshot
node scripts/verify-seo.mjs     # SEO gate
node tools/test_sitemap.js      # generator + deployment wiring
python3 tools/qa.py             # links, anchors, tags, SEO basics
```

## After deploying

- In Search Console, make sure the **property is `oopsmypassword.web.app`** (the
  `.com` property can never verify — it has no DNS).
- Submit `https://oopsmypassword.web.app/sitemap.xml` and remove any
  `/google-sitemap.xml` submission.
- If you own `oopsmypassword.com`, add it to Firebase Hosting as a custom
  domain and set `SITE_ORIGIN` to it — one origin only, then 301 the other.
