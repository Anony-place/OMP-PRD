# Vercel migration — production host

The site is moving from `https://oopsmypassword.web.app` to
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

1. `firebase.json` gets one extra rule at the **top**: every path 301s to
   `https://oopsmypassword.vercel.app` + the same path. Redirects run before
   anything else on Firebase Hosting, so the old host stops serving pages.
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

The move is a single rule in `firebase.json`:

```json
{ "regex": "/(.*)", "destination": "https://oopsmypassword.vercel.app/:1", "type": 301 }
```

Delete that rule, regenerate (`node scripts/build-vercel-config.mjs`), push, and
Firebase serves the site again. Nothing else in the repository changed: the
committed HTML still carries the `web.app` origin (Vercel rewrites it at build
time), so restoring the old host is a revert, not a rebuild. The Vercel
deployment can stay up or be deleted.

## Order of operations (why two merges)

| Step | What | Why this order |
| --- | --- | --- |
| A | Vercel becomes indexable + canonical to itself + build script | The destination must be ready before anything points at it |
| B | Firebase 301 to Vercel | Flipping first would send traffic to a host that still said `noindex` |

Search Console **Change of Address** belongs after B, from the `web.app`
property to the `vercel.app` property.

## What is checked automatically

`tools/test_vercel_config.mjs` (CI gate on every Firebase deploy):

- `vercel.json` is in sync with `firebase.json`, 124 redirects / 15 rewrites /
  38 header rules
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
