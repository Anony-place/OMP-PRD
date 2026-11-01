# Admin panel: publish → live, automatically

**Status: plan, not implemented.** Everything below is a proposal. It is written
down first because the trigger path touches a repository token, a bot commit and
a live deploy — three things that are easy to get subtly wrong and hard to
un-ship.

---

## 0. What the panel does today

| Step | Where it happens | Result |
| --- | --- | --- |
| Write article | `/Anony.su/` (Supabase Auth + `is_admin`) | row in `public.articles` |
| Publish | `status = 'published'` | appears in the `/articles` feed **immediately**, on both hosts |
| Own page `/articles/<slug>` | `scripts/build-static-seo.mjs` at build time | **does not exist until someone builds and commits** |
| Sitemap entry | same script | same |
| Deploy | `scripts/deploy.sh` → `firebase deploy` | **now a 301 host**; content deployed there is unreachable |

So publishing is half-done by design: the feed is dynamic, the page is static.

The missing half is the important half for search. A post that exists only in the
feed is a `<div>` on a listing page: no canonical, no `<title>`, no JSON-LD, no
sitemap entry, nothing to rank. `articles/*.html` is what Google eats.

**Confirmed in the repo, not assumed:**

- `/articles` renders live posts from Supabase — `README.md`, "one content hub".
- `scripts/build-static-seo.mjs:200-208` builds title/description/OG/JSON-LD from
  `title`, `summary`, `content`, `featured_image`, `published_at`, `updated_at`.
- `.vercelignore` strips `scripts/`, `tools/`, `functions/` from the Vercel
  upload, so the Vercel build cannot reach Supabase even if it wanted to.
- No `repository_dispatch`, no `GITHUB_TOKEN`, no `pg_cron` anywhere yet.

---

## 1. Target architecture

```
  /Anony.su/  (panel)
      │  Save + status=published
      ├──────────────────────────────► Supabase: articles row   (already works)
      │
      └─ supabase.functions.invoke('content-publish')
                │  verifies JWT + is_admin
                │  coalesces bursts into one job
                ├──► publish_jobs row: status=queued
                └──► GitHub POST /dispatches  (fine-grained PAT, Supabase-side only)
                          │
                .github/workflows/publish-content.yml
                          │  repository_dispatch: content-publish
                          ├─ checkout → npm ci
                          ├─ build-static-seo → build-phase3-seo
                          ├─ gates: verify-seo, test_sitemap, test_vercel_config, qa
                          ├─ git add (content paths only) → commit → push main
                          ├─ publish_jobs → status=deploying
                          └─ poll https://oopsmypassword.vercel.app/articles/<slug>
                                     until 200 (max 8 min) → status=live
                                              │
                                    Vercel auto-deploy on push  (~60s)
                                              │
                                    panel chip: Queued → Building → Live ✅
```

One dispatch, one commit, one deploy. No human step.

---

## 2. Phase 0 — the pipeline (must have)

### 2.1 Database: `publish_jobs`

New migration `supabase/migrations/<ts>_publish_jobs.sql`.

```sql
create table if not exists public.publish_jobs (
  id            uuid primary key default gen_random_uuid(),
  requested_by  uuid references auth.users(id),
  reason        text not null,                     -- 'article:my-slug', 'bulk:3'
  targets       text[] not null default '{}',      -- paths expected to go live
  status        text not null default 'queued'
                check (status in ('queued','running','deploying','live','failed','skipped')),
  detail        text,
  run_url       text,                              -- link to the Actions run
  commit_sha    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

- RLS: `select` for admins via `public.is_admin()`; **no** client `insert` — rows
  are created by the Edge Function with the service role.
- Index on `(created_at desc)` for the panel's status strip.

### 2.2 Edge Function: `content-publish`

`supabase/functions/content-publish/index.ts` — same shape as the existing
`learning-*` functions.

1. `Authorization: Bearer <user JWT>` → `getUser()`; reject 401.
2. `is_admin` check against `profiles`; reject 403. The panel already gates on
   this, but the server must not trust the client for it.
3. Coalesce: if a job in `queued|running` exists from the last 90 s, return it
   instead of dispatching again. Ten saves in a row must not become ten builds.
4. Insert `publish_jobs` row.
5. `POST https://api.github.com/repos/Anony-place/OMP-PRD/dispatches`
   `{ "event_type": "content-publish", "client_payload": { "job": "<id>", "reason": … } }`
   with the PAT from Supabase secrets.
6. Return `{ job_id }`.

Failure of step 5 marks the job `failed` and returns the reason — the panel must
say "deploy trigger failed" rather than showing a green tick that lies.

### 2.3 Workflow: `.github/workflows/publish-content.yml`

```yaml
on:
  repository_dispatch:
    types: [content-publish]
  workflow_dispatch:
    inputs:
      dry_run: { type: boolean, default: false }

permissions:
  contents: write

concurrency:
  group: publish-content      # queue, never cancel: each run commits
  cancel-in-progress: false
```

Steps, in this order:

1. checkout, node 24, `npm ci --ignore-scripts`
2. build chain, exactly as `deploy.sh` / the deploy job does:
   `build-static-seo.mjs` → `sync-sitemap-core.js` → `build-phase3-seo.mjs`
3. gates: `verify-seo.mjs`, `test_sitemap.js`, `test_vercel_config.mjs`,
   `qa.py` — **nothing is committed if any of them fails**
4. `git add` **only** generated content paths (`articles/`, `products/`,
   `osint/`, `pentest/`, sitemaps, `rss.xml`). `tools/build.py` regenerates ~45
   template files for unrelated reasons; letting it into bot commits would make
   `git log` unreadable and every revert risky.
5. nothing staged → mark job `skipped`, exit 0 (rebuild produced no change)
6. commit as `omp-bot <bot@users.noreply>`: `content: publish <slug> (+n)`
7. `git pull --rebase && git push` with 3 retries — a human push landing at the
   same second must not lose either side
8. mark job `deploying`, poll the live URLs every 15 s for up to 8 min
9. mark `live` / `failed` with the run URL

### 2.4 Secrets — exact inventory

| Secret | Where it lives | Scope | Who sets it |
| --- | --- | --- | --- |
| `GITHUB_PUBLISH_TOKEN` | Supabase → Edge Function secrets | fine-grained PAT, **this repo only**: `Contents: read & write` (GitHub requires write, not just read, to create a `repository_dispatch` event — verified in the docs, not assumed) + `Metadata: read`, which is implied. Nothing else | owner, once |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub → repo secrets | updates `publish_jobs` only | owner, once |
| `SUPABASE_URL` | both | already public | — |

The PAT never reaches the browser and never reaches Actions. The workflow
commits with the built-in `GITHUB_TOKEN` (`permissions: contents: write`), which
is scoped to the run and expires with it.

### 2.5 Panel UI

In `articleForm` and the row list:

- `Save article` keeps its current meaning (write the row).
- when `status = published`, the same submit also calls `content-publish`, and a
  chip appears under the form: `Deploying…` → `Live` + **Open page** →
  `/articles/<slug>`.
- failures show the run URL. A publish that never deployed must never look like
  a publish that did.
- one row in the list gets a `⚠ not built` marker when
  `status = published AND no committed page exists` — derived from a new
  `build_state` column the workflow writes (`built` / `pending` / `failed`).

### 2.6 Tests

- unit: slug → path, coalescing window, status transitions
- `workflow_dispatch` with `dry_run: true` → builds and gates, commits nothing
- failure drill: break a gate on a branch → job ends `failed`, nothing pushed
- concurrency drill: two dispatches 5 s apart → one build, two jobs pointing at
  the same run (or one job, second coalesced)
- end-to-end: publish `test-autopublish-<date>`, watch the page, the sitemap, the
  live URL, then unpublish and confirm the page disappears in the next build

---

## 3. Phase 1 — panel powers (what is actually missing)

Ranked by what moves the needle for a site whose problem is *indexing*, not
features.

| # | Power | Why it matters | Touches |
| --- | --- | --- | --- |
| 1 | **SEO overrides**: `meta_title`, `meta_description`, `og_image`, `canonical_url`, `robots_noindex` | today the `<title>` is `title + " | OopsMyPassword"` and the description is the summary, truncated. A post that can't tune its snippet can't win the click | migration + `build-static-seo.mjs` + panel "SEO" accordion with 60/160 char counters |
| 2 | **Slug rename → automatic 301** | renaming a slug today is a silent 404 for every existing link and ranking. Panel writes old→new to a `redirects` table; a build step merges it into `firebase.json`, and `build-vercel-config.mjs` already turns that into `vercel.json` | migration + `scripts/sync-redirects.mjs` + panel confirm dialog |
| 3 | **Scheduled publish** | write on Sunday, live at 9am Monday. `status='scheduled'` + `published_at`; a 15-minute cron dispatches the build when due | migration + cron workflow + panel date field |
| 4 | **Bulk actions** | publish/archive/delete 10 drafts without 10 round-trips | panel only |
| 5 | **Autosave + revisions** | the editor has "unsaved changes" but no recovery. `article_revisions` on update + a History drawer with restore | migration + panel |
| 6 | **Media → featured image** | the media library can upload but the featured image is still a URL you paste by hand | panel only |
| 7 | **Pre-publish health check** | block a publish that would ship a 70-char title, a duplicate slug, a missing image, or a broken internal link | panel + a small checker module |
| 8 | **Audit log** | who published what, when; `publish_jobs` + `article_revisions` already carry the facts | panel read view |

Not in scope, deliberately: a WYSIWYG editor, comments, multi-author roles,
image editing. The panel's job is publishing without breaking SEO.

---

## 4. Phase 2 — after the pipeline is trusted

- **Rollback button**: dispatch `content-revert` with a commit SHA; the workflow
  reverts and re-deploys. Until the pipeline has run clean for a few weeks, the
  honest rollback is `git revert` by hand.
- **Deploy history** page: last 20 jobs, status, run URL, diff summary.
- **Unpublish semantics**: choose between `410` (gone for good) and `301` (moved)
  instead of the current silent removal.
- **IndexNow feedback**: the workflow already submits; surface the result per job.
- **Redirect manager**: list `redirects` rows, see which are dead.

---

## 5. Security model

| Risk | Mitigation |
| --- | --- |
| Stolen browser session triggers deploys | Edge Function checks `is_admin` server-side; coalescing caps the damage at one build per 90 s |
| PAT leaks | lives only in Supabase secrets; never in the repo, the panel JS, or the workflow. Rotatable in one place |
| Bot commits push something unwanted | the workflow `git add`s an explicit path list, never `-A`; gates must pass first |
| Bot commit loop | the workflow ignores pushes it made itself; it is triggered by `repository_dispatch`, not by `push` |
| Service role key exposure | only in GitHub secrets, used for one `PATCH` on `publish_jobs` |
| A bad article ships | gates run before the commit, not after |

## 6. Failure modes

| What breaks | Panel shows | Nothing else happens |
| --- | --- | --- |
| Dispatch rejected (bad PAT) | `failed: trigger rejected` | no commit |
| Build error | `failed` + run URL | no commit |
| A gate fails (SEO, sitemap, links) | `failed: <gate>` | no commit, previous site untouched |
| Push conflict | retried 3×, then `failed` | local commit discarded with the runner |
| Vercel deploy fails | `deploying` → `failed` after 8 min | old build keeps serving |
| Workflow never starts | `queued` for >5 min, panel shows a warning | operator re-triggers |

## 7. Rollback of the whole feature

`AUTOPUBLISH_ENABLED=false` in the panel config → `content-publish` returns
`{disabled:true}`, the panel stops showing deploy status, and publishing reverts
to today's behaviour (feed only). The workflow stays in the repo, unused, and no
schema has to be dropped for the site to keep working.

## 8. Effort

| Phase | PRs | Estimate |
| --- | --- | --- |
| 0 — pipeline | 4 (`publish_jobs`, Edge Function, workflow, panel chip) | ~6–8 h |
| 1 — powers | 4 (SEO fields, redirects, scheduling, panel QoL) | ~8–10 h |
| 2 — polish | 3 | ~6 h |

Each PR is independently shippable and reversable. Phase 1 items 1 and 2 are the
ones that affect ranking; everything else affects the person typing.

## 9. Decisions needed before code

1. **Auto on publish, or a separate "Deploy" button?** Auto is proposed; a manual
   button costs one click and removes the "I was still editing" race.
2. **Scheduling** — is it worth the cron, or is publishing always immediate?
3. **Slug rename → 301** — always, or only when the article is already published?
4. **Bot commits on `main`** — fine, or would you rather see them as PRs that
   auto-merge? (The PR route doubles the wait and needs branch protection.)
5. **Phase 1 order** — SEO fields first (rankings) or bulk/scheduling first
   (convenience)?


---

## 10. Activation (owner, once — about 10 minutes)

Nothing above runs on its own until these exist. Until then the panel still
saves articles exactly as before; it just reports that the deploy could not
start.

1. **Apply the migration** — Supabase dashboard → SQL editor → paste
   `supabase/migrations/20261101120000_publish_jobs_and_scheduling.sql`, or
   `supabase db push` from a machine with the project linked.
2. **Create the token** — GitHub → Settings → Developer settings → Fine-grained
   tokens → *only this repository* → Repository permissions → **Contents: Read
   and write** (GitHub requires write to create a `repository_dispatch`).
3. **Supabase secrets** — dashboard → Edge Functions → Secrets, add
   `GITHUB_PUBLISH_TOKEN` (the token) and `GITHUB_REPO` (`Anony-place/OMP-PRD`).
4. **Deploy the function** — `supabase functions deploy content-publish`.
5. **GitHub secret** — repo → Settings → Secrets → Actions →
   `SUPABASE_SERVICE_ROLE_KEY` (the *service_role* key, not the publishable one).
   The workflow uses it for exactly two things: promoting scheduled rows and
   updating `publish_jobs`.
6. **Enable scheduling** — repo → Settings → Variables → Actions → new variable
   `AUTOPUBLISH_ENABLED = true`. Without it the 15-minute cron stays dormant.
7. **Prove it** — publish a test article from the panel, watch the chip go
   Queued → Building → Live, open the page, then delete it. Or, without the
   panel, run *Publish content* from the Actions tab with `dry_run` checked.

### If something is wrong

| Symptom | Cause |
| --- | --- |
| `deploy could not start: 401` | signed-in session expired — sign in again |
| `deploy could not start: not an admin` | `profiles.is_admin` is false for that user |
| `server is not configured for deploys` | step 3 or 4 not done |
| job stuck on `queued` | the dispatch landed but no workflow file on `main` yet |
| job stuck on `running` | the build is still going — check the run URL |
| scheduled article never publishes | `AUTOPUBLISH_ENABLED` unset, or no service key |
