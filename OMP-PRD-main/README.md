# OopsMyPassword (OMP)

**Privacy-first password security tools that run entirely in the browser.** No accounts, no servers receiving your passwords, no tracking of what you type — open the site and use every tool immediately.

## Tools

| Tool | Status | Notes |
|---|---|---|
| Password Checker | ✅ Live | Real-time heuristic scoring, pattern detection (common passwords, dictionary words incl. leet, repeats, sequences, keyboard walks, dates), entropy + crack-time estimates, wordlist-aware passphrase recognition |
| Password Generator | ✅ Live | `crypto.getRandomValues()` with rejection sampling + secure Fisher–Yates shuffle. Never `Math.random()` |
| Passphrase Generator | ✅ Live | Diceware-style, bundled EFF short wordlist (1,296 words), honest entropy math |
| Password Health | ✅ Live | 10-point local audit with letter grade |
| Entropy Calculator | ✅ Live | `H = L·log₂(N)` explorer + attacker-model crack-time table |
| Random String Generator | ✅ Live | Hex/Base64URL/alphanumeric batches |
| Breach Check | ✅ Live (demo) | Educational k-anonymity demo — clearly labeled, **not** a live breach database |
| Security Checklist | ✅ Live | 16 habits; progress stored in `localStorage` on-device only |

Plus: 15 guides, FAQ, glossary, privacy/terms/security pages, HTML+XML sitemaps, and a global search (Ctrl+K) covering tools, guides, pages and live articles.

## No-backend articles (dynamic feed + admin panel)

Publishing content without running a backend:

- **`/blog.html`** — the Articles feed, rendered client-side from the **articles table** in Supabase (public read-only access via a publishable key). Publishing happens from the admin panel.
- **`/admin/`** — the **Article Manager**, protected by **Supabase Auth** (email + password) *and* an `is_admin` check against the `profiles` table. Sign in, write/edit articles with a Markdown toolbar and a live preview, and publish straight to the live feed. Drafts stay hidden until you publish them.
- Article bodies may be written in **Markdown or HTML**. Both go through the same pipeline on the public feed *and* in the admin preview: `assets/js/markdown.js` (escapes first, then applies Markdown) → `assets/js/sanitize.js` (whitelist renderer — scripts/iframes/handlers/`javascript:` URLs stripped). What you preview is byte-for-byte what readers get.
- Unpublishing is done with the **Status** field (draft / published / archived). The public renderer contains no keyword-based hiding rules — if a post is published, it is listed.
- SEO rule of thumb: news/updates → dynamic feed; content that must rank → static guides via `tools/build.py`.

## Firebase Hosting

`firebase.json` is included and ready: public dir at repo root, `tools/**` and markdown files excluded from deploys, CSP + security headers, and `no-cache` (revalidate) for **both** HTML and `/assets/**`.

> `/assets/**` is deliberately `no-cache` rather than long-lived/immutable. Asset filenames are not content-hashed, and a 1-year `immutable` header previously left visitors running a stale `admin.js` that could not boot — see the fallback message in `assets/js/admin-boot-watchdog.js`. Revalidation costs one cheap conditional request and removes that whole failure class.

> Note: the Python build tooling (`tools/`) and test scripts are **excluded from hosting deploys** — only the static site itself is published.

```bash
firebase init hosting   # select this repo (config already provided)
firebase deploy --only hosting
```

## Privacy architecture

- **All analysis is client-side JavaScript.** Passwords never leave the tab: no network, no storage, no logs, nothing in URLs, nothing in analytics.
- Privacy-first by design: all password tools run 100% client-side; nothing you type is ever sent anywhere.
- Dynamic UI writes use `textContent` or escaped/whitelisted markup only; no `eval()`, and article HTML is always re-sanitized before it reaches the DOM.
- No third-party scripts, fonts, or trackers.
- Auth exists only in the private admin panel (`/admin/`, Supabase Auth). The public site has no login, no signup, and no analytics.

## Structure

```
/                      → generated static pages (index.html, checker.html, guides/…, blog.html, admin/)
/assets/js/markdown.js → safe Markdown→HTML renderer (window.OMPMarkdown), shared by the feed and the admin preview
/assets/js/sanitize.js → whitelist HTML sanitizer for CMS-provided article HTML
/assets/js/search.js   → global Ctrl+K search (baked-in index + live articles/tools)
/firebase.json         → hosting config with security headers (deploy-ready)
/assets/css/styles.css → design system
/assets/js/security.js → shared analysis engine (window.OMPSecurity / module.exports)
/assets/js/*.js        → page behaviors
/assets/icons|images   → favicon, app icons, OG image
/robots.txt /sitemap.xml /manifest.webmanifest
/tools/build.py        → page generator (single source of truth for layout/content)
/tools/omp_build/      → page bodies, guides content
/tools/qa.py           → static QA: links, anchors, tag balance, SEO basics
/tools/test_runtime.js → jsdom integration tests (requires: npm i jsdom)
/tools/browser-audit.js→ full browser audit: overflow, contrast, a11y, SEO (requires: npm i playwright)
```

Run a local preview:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Rebuild pages after editing content in `tools/omp_build/`:

```bash
python3 tools/build.py
python3 tools/qa.py
NODE_PATH=/path/to/node_modules node tools/test_runtime.js
```

## Honesty policy

Strength scores are **heuristic estimates, not guarantees** (see Terms). Anything not
connected to a real backend says so — the breach page is a labeled demo, the contact
form does not fake submission, and there are no invented usage statistics or reviews.
