# Vercel staging mirror — setup and test

A **second, throwaway deployment of the same site** used to answer one question:

> Firebase ke `*.web.app` host se Google sitemap fetch nahi kar raha — kya wahi
> site Vercel ke host se fetch ho jaati hai?

It is **not** a migration. `oopsmypassword.web.app`, `main`, and the existing
Search Console property are untouched, and nothing on the mirror is indexable.

- Firebase project: `password-e9a30`, origin `https://oopsmypassword.web.app` — unchanged, still production.
- Vercel project: `oopsmypassword` → `https://oopsmypassword.vercel.app` — read-only mirror, `noindex`.
- Source of truth for routing stays `firebase.json`. `vercel.json` is generated from it.

---

## Why this is safe (the four layers)

| Layer | What it does | Where |
| --- | --- | --- |
| 1. Host-scoped `noindex` | Every HTML response on `oopsmypassword.vercel.app` carries `X-Robots-Tag: noindex, nofollow`. Bound to that **host only**, so a future custom domain on the same project would not inherit it. Sitemap, robots, RSS and manifest are exempt so they can be fetched. | `vercel.json` headers |
| 2. Canonicals stay on `web.app` | Every HTML page still declares `https://oopsmypassword.web.app/...` as canonical. Even if Google crawls the mirror, the canonical points at the real site. | committed HTML |
| 3. Firebase is not touched | No `firebase.json` change, no deploy, no origin switch, no GSC change on the `web.app` property, no `ads.txt`/AdSense change. | — |
| 4. No incoming links | Nothing links to the mirror. It is reachable only if you type the URL. | — |

Result: the mirror can answer "is Google able to fetch from this host?" without
competing with the real site in the index.

---

## Step 1 — create the project (browser, ~2 minutes)

1. <https://vercel.com/new> → **Import Git Repository** → `Anony-place/OMP-PRD`.
2. **Project Name**: `oopsmypassword` (this is what claims `oopsmypassword.vercel.app`).
3. **Root Directory**: `OMP-PRD-main` ← important, the site lives there.
4. **Framework Preset**: `Other`.
5. **Build and Output Settings** — open the section:
   - **Build Command**: the line below (it only rewrites the origin inside the
     sitemap/robots files so the mirror's own files point at the mirror).
     ```
     sed -i 's|oopsmypassword\.web\.app|oopsmypassword.vercel.app|g' sitemap.xml sitemap.txt sitemap-index.xml google-sitemap.xml rss.xml robots.txt
     ```
   - **Output Directory**: `.`
   - **Install Command**: leave empty (there is nothing to install).
6. **Environment Variables**: none.
7. **Deploy**.

> Prefer an empty Build Command? Then skip the `sed` and submit
> `https://oopsmypassword.vercel.app/sitemap.txt` as-is. The sitemap will list
> `web.app` URLs, which Search Console reports as "URLs not allowed for this
> property" — the fetch still happens, and **Last read** is still the signal, but
> you get an extra error to interpret. The `sed` version gives a clean result.

### After the first deploy — two settings that must be checked

Deployment protection and the firewall are the two things that most often make
Googlebot see a login wall or a 403 instead of the site:

- **Settings → Deployment Protection** → *Vercel Authentication* must be **Off**
  (this project is public; if it is on, Googlebot gets HTML that is not the page).
- **Settings → Firewall** → leave **Attack Challenge Mode** off while testing.

If either is on, the test proves nothing.

---

## Step 2 — verify the mirror locally before trusting it

```bash
cd OMP-PRD-main
npm ci                                     # installs path-to-regexp 6.2.1
npm run vercel:test                        # 39 assertions: drift, 301s, rewrites, noindex, parity
npm run vercel:parity                      # firebase.json vs vercel.json, ~455 URLs, offline

npm run vercel:parity:live                 # the real thing: live web.app vs live vercel.app
npm run vercel:parity:live -- https://oopsmypassword.vercel.app --limit 40   # quick pass
```

`vercel:test` is also a CI gate (seo-check job), so a `firebase.json` change that
forgets the mirror now fails the Firebase deploy instead of silently rotting here.

---

## Step 3 — the actual experiment (Search Console)

1. <https://search.google.com/search-console> → **Add property** → **URL prefix** →
   `https://oopsmypassword.vercel.app/`
2. Verify ownership with the **HTML file** method: download the file Search
   Console gives you, drop it in `OMP-PRD-main/`, commit and push. Vercel
   redeploys automatically, then click **Verify**. `.vercelignore` does not
   exclude `google*.html`, so the file ships with the site.
3. **Indexing → Sitemaps** → submit:
   - `https://oopsmypassword.vercel.app/sitemap.txt` (the format that worked for
     other people stuck on this exact bug), then
   - `https://oopsmypassword.vercel.app/sitemap.xml`
4. Wait 24–72 hours. Do **not** resubmit every few hours — Google stops retrying
   a sitemap that keeps failing, and re-submitting resets the clock.

### How to read the result

| Sitemap status | What it means | Next step |
| --- | --- | --- |
| **Success**, "Last read" filled, page count > 0 | Google fetched from a Vercel host. The `*.web.app` block is real and host-specific. | The bug is the host, not the file. Stay on Firebase for now, and only consider a real migration when a ₹0 path or a domain is available. |
| **Couldn't fetch** (same as on `web.app`) | Not host-specific at all. Changing host fixes nothing — do not migrate. | Buy nothing, move nothing. Re-check the mirror's `robots.txt`, firewall and Deployment Protection, then fall back to IndexNow + internal linking. |
| **Has errors** (e.g. "URLs not allowed") | Google *did* fetch the file; only the contents were rejected. | Fetch works — that alone answers the question. Result counts as **Success** for the host test. |
| **Pending / no data** | Too early. | Wait. Anything under 48h is noise. |

A useful corroborating signal: **URL Inspection** on
`https://oopsmypassword.vercel.app/checker`. If Google reports
"Excluded by 'noindex'" it means Googlebot crawled the mirror successfully —
fetching works. "Couldn't fetch"/"Blocked" is the opposite answer.

---

## Step 4 — when the test is over

Delete the Vercel project (**Settings → Delete Project**). Nothing on Firebase,
in the repo, or in the `web.app` Search Console property depends on it. The
`vercel.json`, the build script and the tests can stay — they cost nothing when
unused, and they are what makes a future migration a one-hour job instead of a
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
| `scripts/verify-vercel-parity.mjs` | Executes both routing tables over ~455 URLs and diffs them, offline or live. |
| `tools/test_vercel_config.mjs` | The CI gate: drift, 301s, dangling destinations, self-canonicals, noindex scope, parity. |
| `.vercelignore` | Keeps build tooling, backend source and notes out of the upload. |
