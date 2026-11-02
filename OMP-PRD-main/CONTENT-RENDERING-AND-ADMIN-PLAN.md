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
| D - full panel | **in progress** | New sections now live in `assets/js/admin/sections.js` behind a context object, so `admin.js` stops growing. Shipped: **Access** (who can open the panel: promote/demote by email through `set_admin_access()`, which refuses self-removal, refuses to leave zero admins, and writes to the audit log), **Newsletter** (confirmed vs waiting-to-confirm, growth, stuck deliveries with the addresses, unsubscribe/re-subscribe through `newsletter_set_status()` - the tables stay revoked from every browser role), **Media** (buckets, search, sort, "used in N places" per file, refuse to delete a referenced file, orphan list for the free storage tier, Markdown/HTML/URL snippets - `tools/test_media.mjs`), **Setup** (a checklist of the nine pieces the pipeline needs, each with the exact command, plus a `{"action":"ping"}` on the function that reports configuration without starting a deploy), **Deploys** (publish_jobs history), **Activity** (audit_log: who changed which row and which fields, never the values), **Categories** (create/rename/reorder/delete with an explicit move-or-uncategorise decision, enforced by `delete_article_category()`), **Autosave** (a draft per article in localStorage, offered only when newer than the saved row - `tools/test_autosave.mjs`), **Revisions** (trigger-captured history + restore, including deleted articles), **Redirects** (CRUD + loop/chain warnings + deploy now), **Search** (database-wide, not just the loaded page), **Export** (JSON backup + Markdown). `tools/test_article_revisions.mjs` runs the revisions migration against a real Postgres (pglite). `tools/test_admin_sections.mjs` guards the wiring. Remaining: settings, users, newsletter, academy editor - and the mechanical split of the remaining `admin.js`. |

### Rule for phase D from here

A new admin feature goes in `assets/js/admin/sections.js` (or a sibling module)
and receives `{ supabase, esc, notice, flash, loadTab, requestPublish, publishChip, panel }`.
It never imports `admin.js`; that is what keeps the graph acyclic. Add the tab to
`SECTION_TABS`, a route to `SECTIONS`, and the tab bar picks it up without an HTML edit.
