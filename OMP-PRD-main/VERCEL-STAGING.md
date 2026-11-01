# Vercel migration — production host

**Status: live.** The old host has answered 301 to the new one on every path
since the Phase B merge, and nothing is served from `web.app` any more.

The site moved from `https://oopsmypassword.web.app` to
`https://oopsmypassword.vercel.app`.

**Why:** Google could not fetch the sitemap from the `*.web.app` host for months.
The same sitemap, on the Vercel host, was fetched on the first try
(`Success`, `Last read` filled, **297 pages discovered**). The block was the
host, not the file.

| | |
| --- | --- |
| Old host | `oopsmypassword.web.app` (Firebase, project `password-e9a30`) |
| New host | `oopsmypassword.vercel.app` (Vercel project `oopsmypassword`, team `aka-su`) |
| Root directory | `OMP-PRD-main` |
| Framework preset | Vite, with every setting overridden — nothing is bundled |
| Install / Build / Output | `echo skip-install` / `bash vercel-build.sh` / `.` |
| Source of truth for routing | `firebase.json` — `vercel.json` is generated from it |

## How the move works

1. `firebase.json` carries two rules at the **top**:

   ```json
   { "regex": "/(.*)\\.html", "destination": "https://oopsmypassword.vercel.app/:1", "type": 301 }
   { "regex": "/(.*)",        "destination": "https://oopsmypassword.vercel.app/:1", "type": 301 }
   ```

   The first strips `.html` so `/about.html` lands on `/about` - the URL the new
   host actually serves and the one the sitemap submits. Without it every
   `.html` request would take a second hop (301 then Vercel's 308). The second
   catches everything else. Redirects run before static files, rewrites and
   cleanUrls on Firebase Hosting, so the old host stops serving pages at all -
   including `robots.txt` and `sitemap.xml`, which is normal for a site move.
2. `vercel-build.sh` (run by Vercel at build time) rewrites the
   origin inside every HTML, XML, TXT, JS and JSON file, so the new host's
   canonicals, `og:url`, JSON-LD `@id`, sitemap and RSS all point at itself.
   No canonical ever points at a URL that redirects.
3. `scripts/build-vercel-config.mjs` **skips** that redirect when generating
   `vercel.json` — converting it would make Vercel redirect to itself forever.
4. The old staging `noindex` is **gone**. It was correct while Vercel was a
   mirror; with the 301 landing here it would tell Google to drop every page it
   had just been redirected to.

## Rollback (one commit)

The move is those two rules in `firebase.json`. Delete them, push, and Firebase
serves the site again (regenerating `vercel.json` is a no-op either way: the
generator skips them, so the mirror never changes). Nothing else in the repository changed: the
committed HTML still carries the `web.app` origin (Vercel rewrites it at build
time), so restoring the old host is a revert, not a rebuild. The Vercel
deployment can stay up or be deleted.

## Order of operations (why two merges)

| Step | What | Why this order |
| --- | --- | --- |
| A | Vercel becomes indexable + canonical to itself + build script | The destination must be ready before anything points at it |
| B | Firebase 301 to Vercel | Flipping first would send traffic to a host that still said `noindex` (it did, for four minutes, when the first Phase A build failed - and the live check caught it) |

Search Console **Change of Address** belongs after B, from the `web.app`
property to the `vercel.app` property.

## Proof it is working

From the deploy run and the mirror run that followed the switch:

```
old host 301s to oopsmypassword.vercel.app; sitemap valid through the hop; 0 failure(s)
old host: 43 redirected, 0 still served, 0 failures
Search Console verification tags present: 2/2, home page 50661 bytes
canonicals point at the Vercel origin
```

The first line is the deploy job sampling real paths: each one answers 301 to the
same path on the new host, following it returns 200, and `sitemap.xml` is still a
valid `<urlset>` after the hop. The second is the mirror workflow sampling 43 of
the 297 sitemap URLs: every one redirected, none still served. The third is the
reason the migration is worth anything - both Search Console tokens are on the
live home page. The fourth is the build-time origin rewrite doing its job.

`verify-live-release` also passed against the mirror: 317 artifacts
byte-identical, after normalising the one string the build rewrites.

## Search Console, in this order

1. **Both properties verified** - `https://oopsmypassword.web.app/` (already was,
   via the `ilff-…` meta tag) and `https://oopsmypassword.vercel.app/` (via the
   `MsDOM6…` meta tag on the home page). Do not start until the second one says
   Verified; Change of Address refuses otherwise.
2. **Sitemap on the new property** - already submitted, `Success`, 297 pages.
   If it has not been fetched again since the switch, resubmit it so Google reads
   the current file.
3. **Change of Address** - on the *old* property: Settings -> Change of address,
   choose the `vercel.app` property. It requires the 301s that are now live.
4. Do not delete the Firebase project. Google keeps following the redirects for
   months, and Change of Address itself can take weeks to settle.

Why this order and not the other one: Change of Address points Google at a
destination. If that destination were still answering `noindex` (Phase A), or if
its sitemap were unreadable, the move would be recorded as "old site gone, new
site not indexed" - the one outcome worse than not moving.

## What to watch for the next 4-8 weeks

| Signal | Where | What is healthy |
| --- | --- | --- |
| Old URLs | Search Console -> old property -> Pages | "Page with redirect" grows towards the whole site. This is the move working |
| New URLs | new property -> Pages | "Indexed" grows from ~0 towards 297. Slow is normal |
| Impressions | new property -> Performance | Traffic starts appearing under the `vercel.app` hostname |
| Sitemap | new property -> Sitemaps | `Success`, `Last read` advancing |

Worry if: the new property shows "Excluded by noindex" (means Phase A regressed),
"Couldn't fetch" comes back on the sitemap for more than a few days, or the old
property still shows pages as "Indexed" after a month.

## What is checked automatically

`tools/test_vercel_config.mjs` (CI gate on every Firebase deploy):

- `vercel.json` is in sync with `firebase.json`: 124 legacy redirects / 15
  rewrites / 38 header rules, plus **2 migration rules that stay Firebase-only**
- offline: **all 455 known URLs 301 to the same path on the new host**, and then
  resolve exactly as they did on the old one
- **no `noindex` on any of the site's own pages** (the deliberate `/Anony.su`
  one is still carried over)
- every redirect is a 301, no destination is dangling, no rewrite shadows a
  sitemap URL, every rewritten page still self-canonicalises
- offline routing parity across ~455 URLs

`.github/workflows/verify-vercel-mirror.yml` (live, on every push to `main`):

- every sitemap endpoint returns 200; `sitemap.txt` and `sitemap.xml` agree on
  URL count and contain **zero** `web.app` lines
- `/`, `/checker`, an article and `/glossary` are **not** `noindex`
- canonicals on the new host point at the new host
- both Search Console verification tags are still served
- a Googlebot user agent gets 200, not a 401 login wall
- **redirect integrity**: for a sample of real URLs, the old host either serves
  the page (before B) or 301s to the *same path* on the new host, and that path
  returns 200 (after B). A redirect to a path nobody serves is the failure this
  is built to catch.

## Known costs of this move

- **AdSense**: approval is per site. The `vercel.app` host needs its own review,
  and until then ads do not earn. `ads.txt` is served, but that does not
  transfer approval.
- **Vercel Hobby** forbids commercial use. Running ads here without a paid plan
  risks the project being suspended. This is the one cost that cannot be fixed
  with code.
- **Free subdomain**: `*.vercel.app` is the same class of host as `*.web.app`.
  Crawling works today; whether it *ranks* is a different question, and a
  custom domain remains the only durable answer.

## Files

| File | Role |
| --- | --- |
| `firebase.json` | Source of truth: 125 redirects (the 301 to Vercel + 124 legacy), 15 rewrites, header blocks |
| `scripts/build-vercel-config.mjs` | Generates `vercel.json`, skips the self-redirect, `--check` fails on drift |
| `vercel-build.sh` | Vercel build: origin rewrite, then strip build tooling |
| `vercel.json` | Generated. Never hand-edit |
| `scripts/verify-vercel-parity.mjs` | Both routing tables over ~455 URLs, offline or live |
| `tools/test_vercel_config.mjs` | CI gate |
| `.github/workflows/verify-vercel-mirror.yml` | Live checks |
