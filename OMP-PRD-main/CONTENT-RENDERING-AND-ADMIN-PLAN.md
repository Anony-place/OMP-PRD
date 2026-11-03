# Content rendering + full admin panel — plan

**Status: plan only.** Two things are being proposed here and they are related:
the admin panel cannot be trusted until what it shows is what the site serves,
and the site cannot be trusted until the panel can actually say what it wants.

---

## 1. The real bug behind "HTML se article deta hu to issue hota hai"

There are **two different sanitizers** in this repository.

| File | Runs where | Allows |
| --- | --- | --- |
| `assets/js/sanitize.js` | admin preview **and** the `/articles` feed | `abbr cite dd dl dt del ins dfn kbd mark q s samp small strike ul ol table video` … |
| `functions/safe-article-html.cjs` | the static page the build writes | `section article tfoot` … and **not** `dl dt dd kbd mark abbr cite q ins del samp dfn small` |

So a body containing `<kbd>Ctrl</kbd>`, `<mark>`, `<dl>`, or `<q>` renders in the
preview, looks correct in the editor, and then arrives on the page **unwrapped** —
the tags are stripped and their children flattened into the paragraph.

Both sides drop `<svg>` and `<style>` with their content. That is why a diagram
pasted as HTML disappears completely instead of looking wrong. A pasted
`<style>` block — the usual way people style a diagram — takes the whole styling
with it.

This is not a rendering bug. It is **two specifications pretending to be one**.

### What "merge with the layout" actually requires

The site's CSS knows a small vocabulary: `.callout`, `.callout-info`,
`.callout-warn`, `.prose table`, `.prose pre`, `.figure`/`figcaption`, `.grid-2`,
`.toc`. Anything the author writes outside that vocabulary cannot merge — it can
only be dropped or leak.

So the contract should be explicit:

- **structure** the site styles → kept and styled
- **unknown classes** → class dropped, element kept
- **unknown tags** → unwrapped (children kept), never silently deleted
- **diagrams** → supported properly, not tolerated

---

## 2. Phase A — one pipeline, one specification (the fix)

### A1. One spec, two consumers

`content/richtext-spec.json` (or a `.mjs` module) listing allowed tags,
attributes, and the class vocabulary. `sanitize.js` and
`safe-article-html.cjs` both read it; a test fails if the two disagree.

**The test is the point.** Not the JSON file — a CI check that renders the same
20 fixtures through both paths and compares output byte for byte. "Preview equals
page" becomes a property of the build, not a promise in a comment.

### A2. Expand the shared allowlist to what articles actually use

Keep: `p h1-h6 ul ol li strong em b i u s sup sub br hr pre code blockquote a img
table thead tbody tfoot tr th td caption figure figcaption details summary div
span video audio source track`

Add (both sides): `dl dt dd mark kbd abbr cite q ins del samp small section
article colgroup col`

Attributes: keep the security rules exactly as they are (no `on*`, no `style`,
scheme-checked URLs, `rel` forced on links). Add `alt`, `width`, `height`,
`loading` on `img` (already partly there), `colspan/rowspan/scope` on cells
(already), `open` on `details`, `start` on `ol`.

### A3. Diagrams

Three kinds, three answers:

| Author writes | Today | Proposed |
| --- | --- | --- |
| `<svg>…</svg>` inline | deleted entirely | **sanitised and kept** — allowlist `svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient stop marker title desc`; strip `script`, `foreignObject`, `on*`, external `xlink:href`, `href` with a non-`#` value |
| ` ```mermaid ` block | renders as a code block | rendered to SVG **in the browser, lazily**, only on pages that contain one (≈200 KB, zero cost elsewhere) |
| screenshot / `<img>` | works, unstyled | wrapped in `<figure>`, caption from `alt`, `loading="lazy"`, `width/height` mandatory to stop layout shift |

Inline SVG is the priority: it needs no new dependency, it is what "HTML diagram"
means, and it is the thing being silently deleted today.

### A4. Code blocks and tables

- tables get `<div class="table-wrap">` so a wide table scrolls instead of
  breaking the page (this is the "layout merge" complaint in concrete form)
- fenced code gets a language label and a copy button; syntax highlighting is
  deliberately **not** in phase A (a highlighter is ~40 KB and the articles are
  mostly prose) — noted as A5 if wanted later

### A5. Previews that cannot lie

- the panel preview already runs the same `markdown.js` + `sanitize.js`, but it
  does **not** run the server's post-processing (`normalizeInjected`: heading
  ids, TOC, figure wrapping). Preview should call the same module the build
  calls, bundled for the browser.
- "what got dropped" is already tracked (`OMPSanitize.stats()`); show it **above
  the preview** as a warning strip: *"3 elements removed: 1 svg, 2 style"*. Today
  that information exists and is thrown away.

---

## 3. Phase B — every format that arrives from outside

| Input | Today | Proposed |
| --- | --- | --- |
| `.md` uploaded as attachment | stored as a file, body untouched | parsed and **inserted as rendered Markdown**, attachment optional |
| `.html` uploaded | stored as a file | sanitised through the same spec, imported as body |
| `.txt` | text only | same, with paragraph detection |
| `.docx` | not supported | converted in the browser with `mammoth` (≈90 KB, no server), then sanitised |
| `.pdf` | text extracted, pages rasterised | unchanged — it works |
| pasted HTML | sanitised | unchanged, but now matching the page exactly |

Rules that keep this honest:

- import never overwrites silently — it fills the editor, the author saves
- size limits stay where they are (25 MB), MIME sniffing stays
- every importer writes through one function, so a file type cannot bypass
  sanitisation by arriving through a different door

### B2. "code se article bhejna" — a real path, not a mock

A document has to be able to leave the panel and still publish. Two surfaces,
one code path:

1. **CLI**: `node scripts/new-article.mjs draft.md` — reads YAML front matter
   (`title`, `slug`, `summary`, `status`, `meta_title`, `meta_description`,
   `category`, `scheduled_for`), writes the row through the service role, then
   dispatches the same `content-publish` event the panel uses.
2. **API**: the `content-publish` function gains a second action,
   `{"action":"create","article":{…}}`, admin-JWT-only, same validation.

Both end in the same place: a row, a build, a commit, a live page. No path skips
the gates, and none of them is a stub.

---

## 4. Phase C — the two powers that were already agreed

### C1. Slug rename → automatic 301

- new `redirects` table (`from_path`, `to_path`, `status_code`, `created_at`,
  `note`), admin-writable
- `scripts/sync-redirects.mjs` merges those rows into `firebase.json` before
  `build-vercel-config.mjs` runs, so one source produces both hosting configs
- panel: renaming the slug of a **published** article offers "keep the old URL
  working?" — default yes; the row is written for you
- cascade: renaming `/a` to `/b` twice rewrites the older row instead of creating
  `/a → /b2`, so chains never form

### C2. Bulk actions

Select rows → publish, schedule, archive, re-categorise, delete. Each bulk action
is one database call and **one** deploy at the end, not one per row.

---

## 5. Phase D — "full admin panel, every little thing"

What exists today: Articles, Tools, Products, OSINT, Pentest, Media, Messages.

What is missing, in the order I would build it:

| # | Section | Why it is worth having |
| --- | --- | --- |
| 1 | **Deploy history** (`publish_jobs`) | already being written; no UI. "what changed last Tuesday" is a real question |
| 2 | **Redirects manager** | follows C1 — see which redirects exist, which are dead |
| 3 | **Categories CRUD** for articles (OSINT/Pentest already have it) | articles currently pick from a list nobody can edit |
| 4 | **Revisions + restore** | `article_revisions` on update, a History drawer, one-click restore |
| 5 | **Autosave** | the "unsaved changes" dot exists; the saving does not |
| 6 | **Media library upgrades** | alt text, replace, unused-file sweep, "use as featured image" |
| 7 | **Settings** | homepage ordering, nav links, social handles, feature flags |
| 8 | **Users / admins** | who is `is_admin`, add/remove without SQL |
| 9 | **Newsletter** | subscribers list, export, delivery status |
| 10 | **Academy / lessons** | the largest content surface with no editor at all |
| 11 | **Audit log** | who published, unpublished, deleted, when |
| 12 | **Search across content** | title/slug/body, all entities, one box |
| 13 | **Export / backup** | JSON dump of every table the panel can write |

"Every little thing" is 13 screens. The panel is a single 2 300-line file today;
phase D should **split it** (`assets/js/admin/*.js`, one module per section)
before adding six more, or the next bug will be impossible to find.

---

## 6. Order, effort, risk

| Phase | What | PRs | Estimate | Risk |
| --- | --- | --- | --- | --- |
| A | one spec, allowlists merged, inline SVG, figures, table-wrap, honest preview | 3 | 8–10 h | **medium** — touches every article's render path, mitigated by the fixture test |
| B | md/html/txt/docx import, CLI + API create | 3 | 6–8 h | low |
| C | redirects table + slug 301, bulk actions | 2 | 4–6 h | low |
| D | 13 admin sections + panel split | 6–8 | 25–35 h | low per PR, high in total |

Suggested start: **A**, because it is the complaint and it is also the thing
that makes D safe. C is small enough to ride along.

### Tests that must exist before A ships

- 20 fixtures (HTML, Markdown, mixed, broken, hostile) rendered through the
  preview path and the build path, outputs compared
- an SVG fixture with `script`, `foreignObject` and an external `href` — the
  output must keep the drawing and drop all three
- a regression fixture per article already published: every current page must
  still render byte-identically

### Rollback

Phase A changes the build, so the previous article HTML is in git: a revert
restores the old renderer and the old pages together. No database change is
involved in A at all.

---

## 7. Decisions I need

1. **Inline SVG** — allow it (sanitised)? This is the only way a hand-made
   diagram survives. *Recommend yes.*
2. **Mermaid** — worth 200 KB loaded only on pages that use it, or keep diagrams
   to SVG/img? *Recommend later, after A.*
3. **DOCX import** — needed, or is Markdown/HTML/PDF enough? *Recommend yes, it is
   the format Word users hand over.*
4. **Phase D depth** — all 13 sections, or the first 6 and re-assess?
5. **Panel split** — refactor `admin.js` into modules first (slower start, safer
   after), or keep patching the single file (faster start, worse later)?


---

## Delivery log

| Phase | State | What shipped |
|---|---|---|
| A - one pipeline, inline SVG | **done** (#45) | Both sanitizers share one allowlist and a CI parity test fails when they drift. `svg` kept as a drawing (geometry + presentation attrs only), `foreignObject`/`use`/`script`/`animate`/`href` dropped, `viewBox` case preserved, client builds in the SVG namespace. `.prose` CSS for svg/table/figure/mark/kbd/dl. |
| C - redirects + bulk | **done** (#46) | `redirects` table, `sync-redirects.mjs` -> `content/redirects.json` -> `vercel.json` (merged ahead of legacy rules, duplicate source throws). Slug rename writes the row; a failed write warns instead of blocking the save. Bulk publish/draft/delete = one update + one deploy. |
| B - import | **done** | `.md` / `.html` / `.txt` import into the editor (same sanitiser path as typing). `scripts/new-article.mjs` publishes from a file (front matter, dry run, loud refusals) through `content-publish` `{"action":"create"}`, which checks `is_admin` server-side and inserts with the service role. `.docx` imports through a vendored mammoth (assets/vendor, 621 KB, loaded on first use, no CDN and therefore no CSP change); its output is treated as pasted text and sanitised like everything else - `tools/test_docx_import.mjs` proves a `javascript:` href carried inside a Word document is removed. |
| D - full panel | **in progress** | New sections now live in `assets/js/admin/sections.js` behind a context object, so `admin.js` stops growing. Shipped: **Access** (who can open the panel: promote/demote by email through `set_admin_access()`, which refuses self-removal, refuses to leave zero admins, and writes to the audit log), **Newsletter** (confirmed vs waiting-to-confirm, growth, stuck deliveries with the addresses, unsubscribe/re-subscribe through `newsletter_set_status()` - the tables stay revoked from every browser role), **Media** (buckets, search, sort, "used in N places" per file, refuse to delete a referenced file, orphan list for the free storage tier, Markdown/HTML/URL snippets - `tools/test_media.mjs`), **Setup** (a checklist of the nine pieces the pipeline needs, each with the exact command, plus a `{"action":"ping"}` on the function that reports configuration without starting a deploy), **Deploys** (publish_jobs history), **Activity** (audit_log: who changed which row and which fields, never the values), **Categories** (create/rename/reorder/delete with an explicit move-or-uncategorise decision, enforced by `delete_article_category()`), **Autosave** (a draft per article in localStorage, offered only when newer than the saved row - `tools/test_autosave.mjs`), **Revisions** (trigger-captured history + restore, including deleted articles), **Redirects** (CRUD + loop/chain warnings + deploy now), **Search** (database-wide, not just the loaded page), **Export** (JSON backup + Markdown). `tools/test_article_revisions.mjs` runs the revisions migration against a real Postgres (pglite). `tools/test_admin_sections.mjs` guards the wiring. Remaining: academy editor, and the mechanical split of the remaining `admin.js`. |

### The publish pipeline is checked too

`tools/test_publish_workflow.mjs` asserts the invariants of
`.github/workflows/publish-content.yml`: a dry run cannot push, deploy or claim
live; the gates run before the commit; the commit stages named paths and never
`git add -A`; the cron stays off without `AUTOPUBLISH_ENABLED`; and every exit
writes a terminal `publish_jobs` state. Writing it found a real bug: a failed
gate was recorded as "skipped - no page changed", because the `always()` step
runs before the failure handler and its PATCH had nothing else to go on.

### Every section renders, and that is now checked

`tools/test_admin_sections_render.mjs` mounts all eleven sections in a real DOM
against a fake Supabase client - once with rows, once against an empty database.
The empty case is the one that matters: a fresh install has no deploys, no
redirects and no subscribers, and that is exactly when somebody is on the screen
looking for the reason nothing works.

### Rule for phase D from here

A new admin feature goes in `assets/js/admin/sections.js` (or a sibling module)
and receives `{ supabase, esc, notice, flash, loadTab, requestPublish, publishChip, panel }`.
It never imports `admin.js`; that is what keeps the graph acyclic. Add the tab to
`SECTION_TABS`, a route to `SECTIONS`, and the tab bar picks it up without an HTML edit.

### The fixture had a table production has never had

The panel's article form, the `content-publish` function, `scripts/new-article.mjs`
and the revisions migration were all written against column names that exist only
in `tools/lib/pg.mjs`: `excerpt`, `seo_title`, `seo_description`, `cover_image_url`.
`public.articles` has `summary`, `featured_image` and - after
`20261101130000_article_seo_overrides` - `meta_title`, `meta_description`. Every
suite passed, because every suite ran against the fixture. Three consequences,
all found by asking the live database instead of the fixture:

1. `record_article_revision()` read `old.excerpt`. The trigger is `BEFORE UPDATE`,
   so the first edit of any article in production would have raised
   `42703: record "old" has no field "excerpt"` and rolled the save back. The
   migration had never been applied, which is the only reason nobody noticed.
2. `restore_article_revision()` wrote the same four names, so "put it back" would
   have failed the same way, and it also inserted a NULL into `content`, which is
   `not null`.
3. `scripts/new-article.mjs` documented the fixture's front matter, so the CLI
   created articles with no summary and no SEO overrides - silently, since a
   field the function does not know about is dropped, not rejected.

Fixed in the migration, the function (which now maps the retired spellings onto
the real columns instead of sending them to Postgres) and the CLI (which accepts
both, documents the real ones). `tools/lib/pg.mjs` no longer carries the fictional
columns, and `tools/test_article_schema_parity.mjs` is the guard: it reads the
column list out of `supabase/00_schema_migrations.sql` plus every `add column` in
`supabase/`, compares it with the fixture, and checks every column the panel
payload, the function and the revisions trigger touch. A column that only the
fixture knows about is a red build, not a production incident.

### The newsletter tables had been dropped on purpose

`20260930140000_drop_article_newsletter.sql` removed `newsletter_subscribers` and
`newsletter_deliveries` with the newsletter feature itself. The panel's Newsletter
tab shipped later and read them, so `20261101180000_newsletter_admin.sql` referred
to two tables that no longer existed - another migration that worked against the
fixture and not against the database. The migration now creates them
idempotently before defining the two functions. Nothing is resurrected that holds
data (both were empty when dropped), and the tab shows an honest zero until a
signup form ships.

### What is live now

Applied to `aeehfulikupskyrvcpzb` on 2026-11-02, in this order, each recorded in
`supabase_migrations.schema_migrations`:

| Migration | Effect verified live |
|---|---|
| `20261101120000_publish_jobs_and_scheduling` | `publish_jobs` (10 columns, admin-only read, no browser writes); `articles_status_check` widened to `draft/scheduled/published/archived`; `scheduled_for` + partial index |
| `20261101130000_article_seo_overrides` | `meta_title`, `meta_description`, `og_image`, `canonical_url`, `robots_noindex` |
| `20261101140000_redirects` | `redirects` with path-shape constraints, public read, admin write |
| `20261101150000_article_revisions` | snapshot table + capture trigger + restore; a real article edit wrote one revision and was rolled back |
| `20261101160000_categories` | case-insensitive unique name index, `delete_article_category()`, `clean_category()` |
| `20261101170000_audit_log` | `audit_log` + generic trigger on articles/products/tools/categories |
| `20261101180000_newsletter_admin` | tables re-created, `newsletter_overview()`, `newsletter_set_status()` |
| `20261101190000_admin_users` | `list_admins()`, `admin_counts()`, `set_admin_access()` |

A rolled-back end-to-end write proves the chain: insert → `audit_log` row; content
edit → `article_revisions` row; status flip to `scheduled` → accepted by the
constraint and audited without a revision; delete → final snapshot with
`reason = 'delete'`, history outliving the row.

`content-publish` is deployed (`verify_jwt: true`, admin checked inside) and its
`GITHUB_REPO` secret is set. Still owed by the owner, because neither can be done
from the repository: a fine-grained PAT (Contents: read & write) set as the
function secret `GITHUB_PUBLISH_TOKEN`, and the repository secret
`SUPABASE_SERVICE_ROLE_KEY` plus the repository variable
`AUTOPUBLISH_ENABLED = true`. Without the first, a publish request records a
`failed` job and answers 503 instead of claiming success; without the second, the
workflow runs but can never report a job as live.

### Settings, and the line it draws

The Settings tab is deliberately small: it edits what changes the panel's *next*
action, not what the site says.

| Editable | Where it is read |
|---|---|
| `default_status` | the new-article form (`articleForm`), so a draft starts as a draft |
| `default_category_id` | the same form's category select |
| `autodeploy_on_save` | the save path: with it off, a published article saves without starting a build |

Plus one button that is not a setting - **Publish the whole site now** - because a
switch that turns automatic deploys off with no manual deploy anywhere would be a
trap.

Everything else on that screen is read-only on purpose. The canonical origin, the
sitemap path and the mailto on `/contact` are written into every page by
`scripts/build-static-seo.mjs`. An editable field for any of them is one keystroke
away from rewriting every canonical tag on the site at once, which is the single
change most likely to cost the rankings the rest of this work was for. The screen
shows the values, names the file, and says why it will not take input.

Two implementation notes worth keeping:

- `assets/js/admin/panel-settings.js` is the only place that knows the shape. It
  caches one read per page load and falls back to `{ draft, null, true }` on any
  failure - including a client that throws. The fallback deploys, because a save
  that silently does not deploy is indistinguishable from a successful publish.
  `normalise()` is pure, so `tools/test_settings.mjs` proves that `"Publshed"`,
  `"Guides"` and `"false"` all land on the safe side without a database.
- The table is `panel_settings`, not `site_settings`. The live database already
  has a `site_settings` key/value table from the vnext experiment - zero rows, an
  anon-readable `site_public` policy, and no code anywhere that uses it. Writing
  panel switches into it would have meant either a publicly readable setting or
  deleting a policy nobody documented.

`tools/test_settings.mjs` (48 checks) covers the fallbacks, the caching, the
one-row contract, and asserts that the save path actually consults the switch -
a setting that saves but is never read is a checkbox that lies. The section also
mounts in `tools/test_admin_sections_render.mjs` against both a full and an empty
database.

### "Queued" is not a status, it is a hope

A job that has not moved in half an hour is stuck, and the likeliest reason is
the one the panel could not see: the workflow ran, finished, and could not report
back because the repository has no `SUPABASE_SERVICE_ROLE_KEY`. Every status write
in `publish-content.yml` degrades to `exit 0` when that secret is missing, so the
run looks green and the queue row stays at `queued` for ever.

The Deploys tab now says so, after 30 minutes, with the secret named and a link to
the runs. Before 30 minutes it says nothing, because a fresh queue row is a
normal few minutes and a warning on every publish is noise - asserted in
`test_admin_sections_render` in both directions.

### A policy is not a permission

The Setup tab reported three tables as missing: Redirects, Article history,
Activity. All three had existed for days. The fix it offered - "apply
`20261101140000_redirects.sql`" - was the wrong instruction for a table that was
already there, which is the exact failure `setup.js` was written to avoid.

The cause is the half of Supabase's permission model that a policy does not
cover. `create policy ... for select to authenticated` says which *rows* a role
may read. The `grant` says the role may read the table at all. On a normal
project the second half is invisible, because tables created by the `postgres`
role inherit `grant all to anon, authenticated, service_role` from the project's
default privileges. Tables created through the Management API do not inherit
them, and every table in the November migrations was created that way.

What that cost, measured on the live project:

| Table | What was broken |
|---|---|
| `redirects` | the panel could not list or write a row, and `scripts/sync-redirects.mjs` reads it with the publishable key - so a rename made in the panel never became a 301, and the ranking it was meant to protect stayed a 404 |
| `article_revisions` | Revisions showed "no versions" for articles that had them |
| `audit_log` | Activity was empty |
| `publish_jobs` | the `content-publish` function could not INSERT the job row, so every publish would have failed with "could not record the job" |

`20261102130000_api_grants.sql` grants exactly what each table needs, and the
four original migrations now carry their own grants so a fresh project is
correct without it. `tools/test_api_grants.mjs` (26 checks) reads every migration
from 2026-11-01 onward, requires a grant for each table it creates, and asserts
the specific privileges the code depends on - `anon` SELECT on `redirects`
because the build uses the publishable key, `service_role` INSERT/UPDATE on
`publish_jobs` because the function writes with the service role, and no browser
write grant on history. Removing the grants makes it fail twelve times.

The Setup screen also learned the difference now: a probe that is refused with
`42501` is reported as **denied** ("the table exists - this session may not read
it; that is a missing grant, not a missing migration") instead of **missing**.
Both still count as "not ready"; only one of them sends the reader to the wrong
file.

### "Edge Function returned a non-2xx status code"

That is what the panel said when the first real publish failed. It is the
sentence `supabase-js` writes for any non-2xx answer, and it replaces the one
the function had prepared: the body said `GitHub rejected the dispatch (HTTP
403)` - a token without Contents: write - and it was thrown away before the
reader saw it.

The job row had it all along, which is worth remembering: the pipeline was
telling the truth, and the panel was swallowing it.

`assets/js/admin/publish-error.js` reads the body back out of the failed
`Response` and returns the function's own sentence, falling back to the SDK's
only when the SDK's is a new fact ("Failed to send a request to the Edge
Function" means no network, which is worth saying). `requestPublish` uses it for
every caller - the save path, the bulk actions, Redirects and the Settings
deletegate button - so the message is the same everywhere.

`tools/test_publish_errors.mjs` (18 checks) drives it with stand-ins for the
error object: a JSON body with an error, an empty body, a body that is not JSON,
a missing response, a thrown Error, and a null. The SDK's sentence must never
reach the reader when there is a body that says more.

### The panel's SEO fields went nowhere

`articles` has had `meta_title`, `meta_description`, `og_image`, `canonical_url`
and `robots_noindex` since the editor was written, and `articleHtml()` has read
all five since the template was written. The build query asked for none of them.

So a filled-in meta title changed nothing, a noindexed article still went into
the sitemap, and a custom canonical was ignored - all with no error, because
`undefined` is a valid value for every one of those fallbacks. The panel looked
like it worked.

One select list was the whole fix. What made it survive this long is that
nothing ever ran the generator: the CI gate built the site and checked the
output it produced, and the output was consistently wrong.

`tools/test_static_build.mjs` (40 checks) now runs the real generator against a
fake Supabase in a temp directory and asserts on the files it writes: every
override reaches the page, a noindexed page carries the meta tag and stays out
of the sitemap, and an article without overrides still gets the generated
defaults. Strip the five columns from the select and six checks fail.

### Related articles

Every article used to end at one link to the Articles hub - sixteen pages
pointing at one index and at nothing else. Each page now closes with three
related articles, picked by `scripts/lib/related.mjs`:

1. same category first, so a deep dive leads to its neighbours
2. then the most recent, so a new article is never stranded

Ties break on slug, because two articles published in the same second would
otherwise swap places between builds and the publisher would commit a diff no
reader can see. Noindexed and unpublished rows are never candidates - a related
card that 404s or that we ask search engines to ignore is worse than no card.

The card markup reuses the hub's `feed-row` list, so this needed no CSS.

### The tools were never run

Every gate in this repository read HTML. The tools are JavaScript, so nothing
ever executed one, and a dead button, a mock result or a wrong answer all kept
the badge green.

`tools/test_tools_live.mjs` (49 checks) loads each tool in jsdom, types into it,
presses the button and asserts the result follows from the input: two different
passwords must not score the same, a generated value must change on a second
run, entropy must rise with length, a 65,535-port scanner comparison must not
say the same thing about Nmap and RustScan. All ten tools work.

`tools/test_mobile_ux.mjs` (45 checks) reads the stylesheet and applies the
cascade for a 390px viewport. It found three things a desktop never shows:

- `.input` was 15.2px, `.form-field input` 15.7px and `.cli-field input`
  14.1px. iOS Safari zooms the page when a field below 16px is focused, and does
  not zoom back out - the site then sits magnified and half off-screen.
- the icon buttons were 38px, the slider thumb 22px and secondary buttons 32px,
  all below the 44px a finger hits reliably.
- eight tools announced nothing when their result changed, so a screen-reader
  user pressed "check" and heard silence.

All three are fixed in one touch block at the end of `styles.css`, keyed to
`(max-width: 640px), (pointer: coarse)` so an iPad gets it too. The slider keeps
its thin visual track by painting the gradient in a 6px band inside a 44px hit
area.

### The breach check could say "safe" without checking

The worst finding of the audit, because it is the one a person acts on.

`breach.js` called the Pwned Passwords range API and, when that failed - offline,
blocked extension, corporate proxy, rate limit, a 3.5 second timeout - silently
fell back to a bundled list of ~330 famous passwords and rendered a **green tick
with "Not found in the demo corpus"**. Nobody reads that as "the check failed".
They read it as "you are safe", and they do not check again.

The fallback now distinguishes the two cases it was conflating:

- **a hit in the bundled list** is still a hit, and still warns - that password
  is genuinely a well-known breached one
- **a miss** proves nothing, so there is no verdict: a neutral "Could not reach
  the breach database" with the reason, a retry, and the sentence that a "not
  found" answer only means something when the database actually responded

The page copy promised the old behaviour in two places and is corrected with it,
because a page that describes a fallback the code no longer performs is a lie
that survives review.

The file header had said "the demo corpus contains only ~330 famous compromised
passwords - 'Not found' proves nothing" since it was written. The comment knew.
The interface did not.
