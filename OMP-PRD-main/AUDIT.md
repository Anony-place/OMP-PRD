# OopsMyPassword — Full Site Audit

**Date:** 2026-09-04 · **Scope:** every shipped page, the admin panel, site search, the
articles feed, deploy config and repo hygiene.

**Method:** static analysis of all 37 HTML pages, 18 JS modules and both stylesheets;
live queries against the production Supabase REST endpoint (publishable key) to inspect
what the site actually renders today; jsdom runtime simulation; WCAG 2.1 AA contrast
computed per design token; `tools/qa.py` link/anchor/tag/SEO sweep.

**Result:** 21 defects found and fixed — 4 of them visible on the live site right now.

---

## Verification

| Check | Command | Result |
|---|---|---|
| Behavioural + regression tests | `NODE_PATH=… node tools/test_runtime.js` | **232/232 passed** |
| Every page boots without errors | `NODE_PATH=… node tools/smoke_all_pages.js` | **37/37 clean** |
| Links, anchors, tag balance, SEO | `python3 tools/qa.py` | **no errors, no warnings** |
| Generated pages match `tools/` | `python3 tools/build.py` then diff | **no drift** |
| Contrast (all text tokens, both themes) | asserted inside `test_runtime.js` | **all ≥ 4.5:1** |

---

## P0 — broken on the live site

### 1. The published article renders as a wall of literal Markdown

The single published article (`langflow-cve-2026-0768-…`) was fetched from the live
Supabase endpoint and inspected directly. Its `content` is **Markdown**:

```
## Critical Langflow Vulnerability Is Being Exploited…
| Detail | Information |
| --- | --- |
* Langflow authentication secrets
```text
OPENAI_API_KEY=…
```

`blog.js` handed that string to an **HTML-only** sanitizer. Markdown has no tags, so the
whole body collapsed into one text node and readers saw literal `##`, `**`, `|` and
```` ``` ```` characters — an unreadable ~2,500-word block on `/blog.html`.

**Why it happened:** the admin form labelled the field **"Content (HTML)"** and had no
preview, so nothing showed the author what would be published.

**Fix**
- New `assets/js/markdown.js` (`window.OMPMarkdown`): a safe Markdown→HTML renderer
  supporting ATX headings, paragraphs, hard breaks, fenced code, inline code,
  bold/italic/strikethrough, blockquotes, rules, nested ordered/unordered lists, GFM
  tables, and `[text](url)` / `![alt](url)` with scheme checks.
- **Escapes first, marks up second** — raw HTML in a Markdown body can never execute.
  The result still passes through `sanitize.js` (defence in depth), and `renderSafe()`
  fails closed to escaped plain text if the sanitizer is missing.
- Bodies that genuinely are HTML are detected (`looksLikeHtml` checks block-level tags
  only, ignoring fenced code) and passed through untouched, so existing HTML posts keep
  working.
- `.prose` gained styles for everything the renderer can emit — tables, `blockquote`,
  `hr`, `img`, `h1/h4-h6`, `del`, `kbd`. Wide tables scroll instead of forcing
  horizontal page overflow.

Verified against a fixture mirroring the live article: 6 `h2`, 4 `h3`, 28 paragraphs,
5 lists, a 9-row table, 1 code block, 4 rules, 21 `strong` — **zero literal Markdown
leaked**.

### 2. A hard-coded keyword blacklist silently hid articles

```js
return text.indexOf('deploying process') === -1 && text.indexOf('omp deploying') === -1;
```

The public feed refused to list any article whose title, summary **or body** contained
`omp deploying` / `deploying process`. This was the leftover of deleting an unwanted
"OMP Deploying" post by patching the renderer instead of the database.

Two problems: the post is **already gone** from Supabase (the live query returns exactly
one article, and it is not that one), so the filter was dead code; and it was a live
booby-trap — a legitimate future post about a deployment process would have vanished from
the feed with no error and no way to diagnose it from the admin panel.

**Fix:** removed. Replaced with a structural check (`isRenderable`: must have a slug and
a title). Unpublishing is what the **Status** field (draft/published/archived) is for, and
the README now says so explicitly.

---

## P1 — layout and accessibility, all pages

### 3. Horizontal overflow on all 19 inner pages

`audit-report.json` (since deleted) listed 19 pages with `scrollWidth > clientWidth`, and
four separate `find-overflow*.js` scripts had been written chasing it. The cause is one
line:

```css
.page-hero::before { position: absolute; inset: -30% -20% auto; height: 480px; }
.page-hero { padding: 72px 0 40px; position: relative; }   /* no overflow clip */
```

The decorative glow bleeds **20% of the viewport past both edges**. `.hero` (homepage) and
`.cta-band` both set `overflow: hidden`; `.page-hero` did not. That is exactly why
`/index.html` was the one page *not* in the overflow list, and why the 19 affected pages
are precisely the 19 that use `.page-hero`.

**Fix:** `.page-hero { overflow: hidden; }`. The glow is a radial gradient that fades to
transparent well inside the box, so nothing is visibly clipped. A regression test asserts
the clip is present and that all 19 `.page-hero` pages are covered.

### 4. Every accent colour failed WCAG AA in light theme

The neon palette is tuned for a near-black background and was **never overridden** for
`[data-theme="light"]`. Measured against white:

| Token | Was | Now |
|---|---|---|
| `--cyan` | **1.61:1** | 4.77:1 |
| `--yellow` | **1.36:1** | 4.69:1 |
| `--orange` | **2.02:1** | 4.61:1 |
| `--green` | **2.03:1** | 4.52:1 |
| `--red` | **2.40:1** | 4.57:1 |
| `--purple` | **3.77:1** | 5.08:1 |
| `--blue` | **3.98:1** | 5.60:1 |

That is 57 rules using these tokens as text or icon colour — the score badges, list
markers, callout icons, links, the Delete buttons in the admin panel.

**Fix:** same-hue 600/700-grade light-theme values, all ≥ 4.5:1 on every light surface.
`--brand-grad` is overridden too because `.grad-text` uses `background-clip: text` — it is
*real text* (the 1.05rem/700 wordmark), not decoration. The decorative gradients
(`--meter-grad`, `--brand-grad-soft`) keep their literal stops, so the brand look is
unchanged.

### 5. `--muted-2` failed AA in both themes

Used for `.meta`, captions, `kbd`, table headers, placeholders — the site's most common
small-text colour. Dark: 3.73–4.21:1. Light: 3.12–3.5:1.

**Fix:** `#64748B → #7C8BA1` (dark, worst 4.86:1) and `#7C8AA0 → #606E84` (light, worst
4.61:1). Same slate hue, one notch lighter/darker.

Also fixed: white-on-`.btn-primary` was 4.23:1/4.47:1 (button labels are `.95rem`/600,
which WCAG counts as *normal* text) → gradient deepened to `#7C3AED → #4F46E5` (5.70/6.29);
`.skip-link` white-on-purple was 3.70:1 → fixed `#6D28D9` (7.10:1); dark `--purple`
(4.47:1) and `--blue` (3.77:1) nudged to `#956AF7` / `#7678F3`.

**A test now computes every ratio from `styles.css` and fails the build if any text token
drops below 4.5:1 in either theme.** This is the whole 36-item "low contrast" backlog
from the old audit report, closed permanently rather than patched per page.

### 6. The mobile-menu search button rendered a ~150px-tall icon

The injected mobile button carried a giant inline `style.cssText` and its `TRIGGER_SVG`
has a `viewBox` but **no `width`/`height`**. Inside `.omp-search-trigger` a CSS rule sizes
it; inside `.mobile-search-btn` there was no such rule, so the SVG fell back to the
replaced-element default (~300×150) and blew the menu row open.

**Fix:** all inline styles moved into the injected stylesheet as real `.mobile-search-btn`
rules, including `svg { width: 18px; height: 18px; flex: none }`. Tests assert the button
carries no `style` attribute and that the sizing rule exists.

---

## P2 — search

| # | Defect | Fix |
|---|---|---|
| 7 | Tool `route` values from Supabase were written straight into `href`. A registry row with `javascript:…` became executable from the search palette; an off-site route became an open redirect. | `safeResultUrl()` gates every rendered href: site-relative, `#` anchors, or same-origin only (rewritten to a path). Applied both when building live rows and again at render time. Tool form in the admin now rejects routes not starting with `/`. |
| 8 | A failed Supabase fetch was indistinguishable from an empty table (`safeJson` returned `[]` on `!r.ok`), then **cached for 10 minutes** — silently removing all articles from search for the session. | Non-OK responses now set a `failed` flag; only successful, non-empty results are cached. Cache key bumped `v1 → v2` so already-poisoned sessions recover. |
| 9 | `livePromise` was memoised forever, so one transient failure meant articles never appeared until a full reload. | The memo is cleared when a fetch yields nothing, so reopening the palette retries. |
| 10 | Live rows could duplicate the baked-in index (a registry entry for `/generator.html` listed the Password Generator twice). | De-duplicated by normalised URL when building live rows *and* across the merged result pool. |
| 11 | Article URLs were built as `'/blog.html#/' + slug` with no encoding, while `blog.js` encoded them — asymmetric, and a slug with a reserved character would mis-route. | `encodeURIComponent` on build, matching the feed. |
| 12 | The dialog declared `aria-modal="true"` but had **no focus trap** and never hid the page behind it — Tab walked into the content under the overlay. | Tab/Shift+Tab cycle inside the dialog; siblings get `aria-hidden` while open and it is removed on close; the scroll lock now restores the previous value instead of blindly clearing it. |
| 13 | Missing combobox wiring: no `role="combobox"`, no `aria-controls`, no `aria-expanded`, options had no `id`, and `aria-activedescendant` was never updated after a re-render. | All added; `render()` now republishes the active option so the visual highlight and the screen-reader announcement stay in sync. |

---

## P2 — articles feed (`blog.js`)

| # | Defect | Fix |
|---|---|---|
| 14 | `location.hash` was treated as an article slug unconditionally, so *any* in-page anchor (`#main`, `#checker`) triggered a full Supabase refetch and a re-render of the feed. | Only `#/…` hashes address an article; plain anchors are ignored. `hashchange` re-renders from the cached list instead of refetching. |
| 15 | The whole feed depended on the `article_categories(name,slug)` embed. If that join is ever blocked by RLS, **every** article disappears behind "temporarily unavailable". | Falls back to a query without the embed, so a decorative join can no longer take the feed down. |
| 16 | `featured_image` was selected on every request and never rendered. | Rendered (scheme-checked) in the article view; dead payload otherwise. |
| 17 | The live article has an empty `summary`, so its card on `/blog.html` showed a title and nothing else. | `excerpt()` generates a fallback from the body's plain text (title restatement dropped, 190-char trim on a word boundary). |
| 18 | A deep link to an unpublished or deleted slug rendered a blank feed. | Explicit "Article not found" state with a way back. |
| 19 | The article query was unbounded. | `limit(200)`. |
| 20 | `document.title` stayed "Articles — OopsMyPassword" on every article. | Set per article; restored on the list view. |
| 21 | A Markdown `#` heading in the body produced a **second `<h1>`** next to the article title. | `OMPMarkdown.demoteHeadings()` shifts body `h1 → h2` in place, preserving the author's relative hierarchy. Applied identically in the feed and the admin preview. |
| 22 | `sanitize.js` left an empty `<img>` behind when it rejected the `src`. | Dropped entirely. |

Also: `index.html` loaded `blog.js` but the homepage has no `[data-blog]` mount point, so
it fetched, found nothing and returned — dead weight on the highest-traffic page. Removed
from `tools/build.py` (the single source of truth; editing the HTML directly would have
been reverted on the next build).

---

## P2 — admin panel

| # | Defect | Fix |
|---|---|---|
| 23 | **The live-preview editor was gone.** `admin.css` still shipped `.toolbar`, `.body-editor`, `.preview-frame`, `.preview-head`, `.editor-grid`, `.editor-fields` and `.unsaved-dot` — 9 orphaned rule groups — and the README still advertised "a live preview editor", but `articleForm()` rendered a bare textarea. This is *why* defect #1 reached production unnoticed. | Restored: a two-column editor with a Markdown formatting toolbar (H2/H3, bold, italic, link, lists, quote, code block, table, rule — plus Ctrl+B / Ctrl+I) and a live preview that runs the **exact** public pipeline (`OMPMarkdown.renderSafe`), so the preview is byte-for-byte what `/blog.html` serves. All 9 CSS groups are live again; the 2 that nothing referenced (`.admin-shell`, `.help-ol`) were removed. |
| 24 | The field said **"Content (HTML)"** while authors wrote Markdown. | Relabelled, with a hint listing the supported Markdown syntax and noting that existing HTML bodies are detected and preserved. |
| 25 | Every `<label>` was a bare sibling of its input — no `for`/`id`, so screen readers announced nothing. | All labels associated; the one wrapping label (remove-attachment) is legitimately left as-is. |
| 26 | Tab buttons never reflected the active tab — "Articles" stayed highlighted as primary after switching to Tools. | Active tab tracked and exposed via class + `aria-pressed`. |
| 27 | Delete/update failures were swallowed: the row stayed, no error shown. | Every destructive action checks `result.error` and surfaces the real Supabase message in a non-blocking flash band instead of a bare `alert()`. |
| 28 | Concurrent `loadTab()` calls raced — the slower query could paint over the newer tab. | Monotonic token; stale renders are no-ops (also re-checks the panel is still attached). |
| 29 | No way to find an article once the list grew. | Filter box over title/slug/status, with a distinct "no matches" empty state. |
| 30 | No unsaved-changes protection; a stray reload lost a half-written article. | Dirty tracking with an `.unsaved-dot` indicator, a confirm on Cancel, and a `beforeunload` guard. (The dot needed `.unsaved-dot[hidden] { display: none }` — `display: inline-block` beats the UA `hidden` rule.) |
| 31 | Replacing an attachment orphaned the old storage object and a failed `media` row insert was ignored. | `media` insert errors are logged without blocking the publish (bookkeeping must not fail a save); upload errors now abort with a message instead of saving a broken reference. |
| 32 | Slug was `required` with no fallback, so an empty slug blocked the save with a browser tooltip. | Auto-derived from the title until the author edits it, validated server-side-style before submit. |

---

## P3 — repo hygiene and deploy config

| Item | Action |
|---|---|
| `find-overflow.js`, `find-overflow2.js`, `find-overflow3.js`, `find-overflow4.js`, `test-browser.js` | Deleted — one-off debug scratch from the overflow hunt (now fixed at the source and covered by a regression test). |
| `audit-report.json` (repo root) | Deleted — stale snapshot from 2026-08-28 listing 55 "Open" issues, all of which are now fixed or superseded by this document. |
| `test-audit.js` | Moved to `tools/browser-audit.js`, report path now writes inside `tools/` (out of the deploy root), base URL configurable via `OMP_AUDIT_URL`. |
| `firebase.json` | Removed the dead `/content/**` header rule (no such directory exists) and the now-unnecessary `find-overflow*.js` / `test-*.js` / `audit-report.json` ignore entries — `tools/**` and `**/*.md` cover the layout. |
| `.gitignore` | Added `tools/audit-report.json`. |
| `README.md` | Four inaccuracies corrected: "10 guides" (there are **15**); "The panel needs no login because it can change nothing outside the owner's browser" — flatly contradicting the Supabase Auth paragraph directly above it; "long-term caching for `/assets`" (the config sends `no-cache`, deliberately, after a stale-`admin.js` incident — now documented); and the articles section, which now describes Markdown support and the Status-based unpublish flow. |
| `tools/qa.py` | No longer warns that the `noindex` admin panel lacks `og:`/`twitter:` cards — and now warns if a `noindex` page *does* carry them. |
| Dead CSS | Removed 1.4 KB shipped to every page: `.adm-badge`, `.adm-pub`, `.adm-draft`, `.adm-preview`, `.adm-override`, `.blog-grid` (+2 media queries), `.blog-tag`, `.empty-state`, `.article-back` — none referenced by any page, script or generator. |

---

## New files

| File | Purpose |
|---|---|
| `assets/js/markdown.js` | Safe Markdown→HTML renderer (`window.OMPMarkdown`), shared by the public feed and the admin preview so they can never diverge. |
| `tools/smoke_all_pages.js` | Boots all 37 pages in jsdom and fails on uncaught errors, `console.error`, broken internal links, missing assets, missing site chrome, a missing search trigger, or unresolved template placeholders. |

---

## Notes and deliberate non-changes

- **The Supabase publishable key is public by design** (that is what "publishable" means);
  it appears in `blog.js`, `search.js`, `contact.js` and `admin.js`. Security rests on RLS
  and on the `profiles.is_admin` check, both of which are enforced server-side. No change
  needed, but it is worth knowing that anyone can read published articles and the tools
  registry directly.
- **`/assets/**` stays `no-cache`, not immutable.** Asset filenames are not content-hashed,
  and a 1-year `immutable` header previously left visitors running a stale `admin.js` that
  could not boot — `admin-boot-watchdog.js` still carries the recovery message. One cheap
  conditional request per asset is a better trade than that failure class.
- **Hash routing for articles is unchanged.** `/blog.html#/slug` keeps article URLs
  out of the index; that is the documented SEO trade-off (news → dynamic feed, content that
  must rank → static guides). Fixing it properly means per-article static paths and is a
  feature, not a bug fix.
- **Article-level RLS/permissions were not touched.** They live in the Supabase project,
  not in this repo.
- **`.blog-grid` was deleted rather than used.** Its presence alongside `blog.js` on
  `index.html` suggests a homepage "Latest articles" strip was once planned. Adding one is
  a feature decision (it puts a Supabase fetch on the homepage); flagging it here instead.
