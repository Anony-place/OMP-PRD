# Vercel staging mirror — setup and test

A **second, throwaway deployment of the same site** used to answer one question:

> Firebase ke `*.web.app` host se Google sitemap fetch nahi kar raha — kya wahi
> site Vercel ke host se fetch ho jaati hai?

It is **not** a migration. `oopsmypassword.web.app`, `main`, and the existing
Search Console property are untouched, and nothing on the mirror is indexable.

| | |
| --- | --- |
| Firebase project | `password-e9a30` → `https://oopsmypassword.web.app` — production, unchanged |
| Vercel project | `oopsmypassword` (`prj_rqQBI6GWGKYqjh7DJNgNzqMdyHxT`, team `aka-su`) → `https://oopsmypassword.vercel.app` |
| Root directory | `OMP-PRD-main` |
| Framework | Vite preset, but every build setting is overridden — nothing is bundled |
| Install / Build / Output | `echo skip-install` / origin-rewrite (below) / `.` |
| Source of truth | `firebase.json`; `vercel.json` is generated from it |

---

## Why this is safe (the four layers)

| Layer | What it does | Where |
| --- | --- | --- |
| 1. Host-scoped `noindex` | Every HTML response on `oopsmypassword.vercel.app` carries `X-Robots-Tag: noindex, nofollow`. Bound to that **host only**, so a future custom domain on the same project would not inherit it. Sitemap, robots, RSS and manifest are exempt so they stay fetchable. | `vercel.json` headers |
| 2. Canonicals stay on `web.app` | Every HTML page still declares `https://oopsmypassword.web.app/...` as canonical. Even if Google crawls the mirror, the canonical points at the real site. | committed HTML (never rewritten) |
| 3. Firebase is not touched | No `firebase.json` change, no deploy, no origin switch, no GSC change on the `web.app` property, no `ads.txt`/AdSense change. | — |
| 4. No incoming links | Nothing links to the mirror. It is reachable only if you type the URL. | — |

The only thing the build command rewrites is the **origin inside the mirror's own
sitemap, RSS and robots files**, so that GSC sees a self-consistent sitemap
instead of "URLs not allowed for this property". HTML is never touched.

```
rm -rf tools scripts functions supabase .github .claude node_modules .vercelignore
rm -f *.md
sed -i 's|oopsmypassword\.web\.app|oopsmypassword.vercel.app|g' \
  sitemap.xml sitemap.txt sitemap-index.xml google-sitemap.xml rss.xml robots.txt
```

---

## Step 1 — project (already done)

Created through the Vercel API and deployed from `main` @ `7eb3e79`. Nothing to
configure by hand. Two things worth knowing:

- **Pushes to `main` do not auto-redeploy the mirror** — the GitHub link was
  created with `createDeployments: disabled`. After a big change, redeploy from
  the Vercel dashboard (**Deployments → ⋯ → Redeploy**) or ask for a new
  deployment. If the mirror falls behind production, the `live parity` job in
  `verify-vercel-mirror.yml` turns red, which is exactly when to redeploy.
- **Deployment Protection** is inherited as `all_except_custom_domains`, yet the
  mirror answered Googlebot with `200`, not a login wall (verified by the
  workflow below). If that ever changes, the `No login wall` step fails before
  the experiment can go wrong. In the dashboard: **Settings → Deployment
  Protection** must show Vercel Authentication **off**, and **Firewall → Attack
  Challenge Mode** must stay off during the test.

To recreate the project from scratch: <https://vercel.com/new> → import
`Anony-place/OMP-PRD` → name `oopsmypassword` → root `OMP-PRD-main` → framework
**Other** → build command as above → output `.`.

---

## Step 2 — verify locally

```bash
cd OMP-PRD-main
npm ci
npm run vercel:test              # 39 assertions: drift, 301s, rewrites, noindex, parity, .vercelignore
npm run vercel:parity            # firebase.json vs vercel.json, ~455 URLs, offline (~0.2s)
npm run vercel:parity:live       # live web.app vs live vercel.app, needs working HTTPS egress
```

`vercel:test` is also a CI gate (seo-check job), so a `firebase.json` change that
forgets the mirror fails the Firebase deploy instead of silently rotting here.

The mirror has its own live check, `.github/workflows/verify-vercel-mirror.yml`,
which runs on every push to `main` and can be run in full from the Actions tab:

- every sitemap endpoint returns 200, and the mirror's `sitemap.txt` has the same
  URL count as production with **zero** `web.app` lines in it
- `/`, `/checker` and an article carry `X-Robots-Tag: noindex`; `sitemap.xml`,
  `sitemap.txt`, `robots.txt` and `rss.xml` do **not**
- the mirror's canonical is still `https://oopsmypassword.web.app/...`
- no login wall: a Googlebot user agent gets 200, not 401
- `/guides/create-strong-password` → 301 → `/articles/create-strong-password`,
  an unknown path → 404
- live parity against production on **every known URL** (~455), comparing
  where each URL lands and the `<title>` of the page it lands on

One recurring warning is expected: production regenerates HTML with
`tools/build.py` at deploy time while the mirror serves the committed copy, so a
page whose template changed since the last commit can differ in title (e.g.
`/pentest`). It is reported as a warning because it means "the mirror is one
commit behind", not "routing broke".

---

## Step 3 — the actual experiment (Search Console)

1. <https://search.google.com/search-console> → **Add property** → **URL prefix** →
   `https://oopsmypassword.vercel.app/`
2. Verify ownership with the **HTML file** method: download the file Search
   Console gives you, drop it in `OMP-PRD-main/`, commit and push. The mirror
   must then be redeployed (see Step 1); `.vercelignore` does not exclude
   `google*.html`, so the file ships with the site.
3. **Indexing → Sitemaps** → submit:
   - `https://oopsmypassword.vercel.app/sitemap.txt` (the format that worked for
     other people stuck on this exact bug), then
   - `https://oopsmypassword.vercel.app/sitemap.xml`
4. Wait 24–72 hours. Do **not** resubmit every few hours — Google stops retrying
   a sitemap that keeps failing, and re-submitting resets the clock.

### How to read the result

| Sitemap status | What it means | Next step |
| --- | --- | --- |
| **Success**, "Last read" filled, page count > 0 | Google fetched from a Vercel host. The `*.web.app` block is real and host-specific. | The bug is the host, not the file. Stay on Firebase until a ₹0 path or a domain exists. |
| **Couldn't fetch** (same as on `web.app`) | Not host-specific at all. Changing host fixes nothing — do not migrate. | Buy nothing, move nothing. Re-check the mirror's `robots.txt`, firewall and Deployment Protection, then fall back to IndexNow + internal linking. |
| **Has errors** (e.g. "URLs not allowed") | Google *did* fetch the file; only the contents were rejected. | Fetch works — that alone answers the question. Treat as **Success** for the host test. |
| **Pending / no data** | Too early. | Wait. Anything under 48h is noise. |

Corroborating signal: **URL Inspection** on
`https://oopsmypassword.vercel.app/checker`. "Excluded by 'noindex'" means
Googlebot crawled the mirror successfully — fetching works.

---

## Step 4 — when the test is over

Delete the Vercel project (the workflow will start failing, which is expected).
Nothing on Firebase, in the repo, or in the `web.app` Search Console property
depends on it. `vercel.json`, the build script and the tests can stay: they cost
nothing when unused and make a future migration a one-hour job instead of a
risky one.

---

## What this mirror is NOT

- **Not production.** Vercel's Hobby plan forbids commercial use; the site runs
  AdSense. Ads must never be enabled here.
- **Not an SEO win by itself.** `*.vercel.app` is a shared free subdomain — the
  same class of host as `*.web.app`. If the problem is "free shared subdomain",
  moving from one to the other changes nothing.
- **Not a reason to buy anything.** The only thing that reliably fixes a
  host-level block is a domain you own.

---

## Files

| File | Role |
| --- | --- |
| `firebase.json` | Source of truth: 124 redirects, 15 rewrites, header blocks. |
| `scripts/build-vercel-config.mjs` | Generates `vercel.json` from it. `--check` fails on drift. |
| `vercel.json` | Generated. **Never hand-edit** — edit `firebase.json` and re-run the script. |
| `scripts/verify-vercel-parity.mjs` | Executes both routing tables over ~455 URLs and diffs them, offline or live (`--sample N` for a stratified subset). |
| `tools/test_vercel_config.mjs` | The CI gate: drift, 301s, dangling destinations, self-canonicals, noindex scope, parity. |
| `.github/workflows/verify-vercel-mirror.yml` | Live checks against the deployed mirror: headers, canonicals, routing, no login wall, parity. |
| `.vercelignore` | Keeps build tooling, backend source and notes out of CLI uploads. |
