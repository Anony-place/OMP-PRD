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

Plus: 10 guides, FAQ, glossary, privacy/terms/security pages, HTML+XML sitemaps.

## No-backend articles (dynamic feed + admin panel)

Publishing content without running a backend:

- **`/blog.html`** — the Articles feed, rendered client-side from `content/articles.json` (a plain static file). Updating articles = replacing one JSON file; no rebuild or server logic needed.
- **`/admin/`** — the browser-local **Article Manager**. Write/edit articles with a live preview toolbar editor; the working copy lives in your browser's localStorage. Mark a published article "Preview on this device" to see it in the real feed before shipping. When ready: **Export articles.json** → place it at `content/articles.json` (GitHub web upload, git push, or `firebase deploy`) → instantly public. Drafts stay out of exports.
- Article HTML is sanitized with a whitelist renderer (scripts/iframes/handlers stripped) before display.
- SEO rule of thumb: news/updates → dynamic feed; content that must rank → static guides via `tools/build.py`.
- The panel needs no login because it can change nothing outside the owner's browser.

## Firebase Hosting

`firebase.json` is included and ready: public dir at repo root, `tools/**` ignored, CSP + security headers, immutable caching for `/assets`, `no-cache` for HTML and `/content`.

```bash
firebase init hosting   # select this repo (config already provided)
firebase deploy --only hosting
```

## Privacy architecture

- **All analysis is client-side JavaScript.** Passwords never leave the tab: no network, no storage, no logs, nothing in URLs, nothing in analytics.
- Dynamic UI writes with `textContent` only; no `eval()`, no unsafe `innerHTML`.
- No third-party scripts, fonts, or trackers.
- No auth anywhere by design — no Firebase, no Supabase Auth, no login/signup.

## Structure

```
/                      → generated static pages (index.html, checker.html, guides/…, blog.html, admin/)
/content/articles.json → dynamic feed source (edit via /admin/ → Export)
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
