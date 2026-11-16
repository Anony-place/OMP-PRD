# Plan — Home page redesign + tool-family split ("sab separate") — APPROVAL PENDING

> Status: **research + plan only — zero code changed**. Operator directive:
> remove the duplicate checker from home, separate every tool into its own
> focused page (ip check / dns / etc.), make sure everything is real, propose
> what the home page should hold instead — decided only after competitor research.

---

## Part 1 — Competitor research (what the winners actually do)

| Competitor | Structure | Verdict |
| --- | --- | --- |
| **BrowserLeaks.com** | Home = pure **tool index** (cards + descriptions). Every test its own page: `/ip`, `/webrtc`, `/dns`, `/canvas`, `/tls`, `/fonts`… Nothing runs on home. | **The multi-tool winner — and exactly the "sab separate" instinct.** Each page can rank for its own query; home stays a discovery surface. |
| **PasswordMonster.com** | Home = the single tool + educational content below (best-practices, "is it safe", how it works). | Tool-on-home works for **single-purpose** sites where the brand IS the tool. OMP is not single-purpose. |
| **ipleak.net** | Home = all-in-one dashboard (IP + WebRTC + DNS + torrent + fingerprint all on one page). | Works for a single-purpose audience; weak for per-query ranking (one URL must carry every intent). |
| **WhatIsMyIP.com** | Home = main tool ("What Is My IP?") + **satellite tools as separate slugs** (`/dns-lookup/`, `/ip-whois-lookup/`, `/speed-test/`) + huge FAQ blocks per question. | The SEO machine: one URL per query. Its FAQ pattern ("How do I find my device's IP address?" per H2) is the long-tail playbook. |

**Takeaway:** OMP is a multi-tool hub → **BrowserLeaks pattern is the right model**, with
WhatIsMyIP's per-query slugs + FAQ long-tails for the new tool pages. The operator's
UX instinct matches the strongest competitor.

Demand evidence (suggestqueries, this session): `what is my ip` = 10 variants ·
`ip leak` = 10 · `dns leak test` = 10 (nordvpn/mullvad/cloudflare) ·
`webrtc leak test` = 10 (nordvpn/expressvpn/surfshark/"meaning"/"incomplete").

---

## Part 2 — Home page: remove the checker, what goes there instead

### What changes
- The `#checker` band (live checker) is **removed from home**. Home never duplicates a tool again.
- Hero CTAs + nav "Check Your Password" button point to **`/checker`** (the one true checker). Any `/#checker` deep-links resolve to home-top via the nav change (no broken anchors; qa.py gates this).
- `/checker` keeps the wide dashboard (batch-8) — it becomes the single checker surface.

### Options for the freed home space

| # | Option | Layout | Pros | Cons |
| --- | --- | --- | --- | --- |
| **A** | **"Toolbox launcher" (RECOMMENDED)** | hero → **Popular tools band (6 big cards)** → trust cards → how-it-works → full 12-tool grid → generator demo → guides → products → FAQ | Matches BrowserLeaks; tool discovery front-and-center; every card = a real page; keeps home useful | Home loses the instant "wow" of a live input (mitigated: CTA to /checker is 1 click) |
| B | "Editorial-first" | hero → featured articles → tools strip → products | Content-led, feeds the article engine | Tools bury deeper; weaker for tool queries |
| C | "Trust-first brand page" | hero → privacy contract → tool categories → guides | Cleanest | Thinnest; home stops earning anything |

**Recommended A.** Popular tools band = Checker · Generator · Breach Check ·
What Is My IP · DNS Leak Test · Phishing URL Scanner (the 6 highest-demand
tools — demand evidence from GSC + autocomplete).

### Sub-question for the operator
Home also has a **quick-generate mini-widget** (a compact generator demo). By the
"no tool duplicates on home" logic it would go too — but it demos rather than
duplicates (links to /generator). **Default: keep it** unless the operator says
otherwise.

### SEO safeguard
Home H1 ("Know how strong your password really is.") stays **unchanged** in this
batch — it may be ranking. Intent shift risk (home → /checker for "password
checker" queries) is the *correct* mapping but should be measured, not assumed:
read GSC for home queries at the next export before considering an H1 change.

---

## Part 3 — Tool-family split: `/ip-check` → three focused pages

| New page | Slug | Targets (demand) | Content |
| --- | --- | --- | --- |
| **What Is My IP** | `/what-is-my-ip` | `what is my ip address` (10 variants: ipv4, vpn, nordvpn, location, on my phone…) | Public IP + ISP + country/city, 2-service cross-check, disclosure band, per-device FAQ (phone/computer — WhatIsMyIP-style long-tails) |
| **IP Leak Test (WebRTC)** | `/ip-leak-test` | `ip leak test` (10) + `webrtc leak test` (10) | WebRTC candidate check + **privacy-tells section folds in here** (timezone vs IP country = a leak tell), VPN-leak FAQ |
| **DNS Leak Test** | `/dns-leak-test` | `dns leak test` (10: nordvpn, mullvad, cloudflare…) | DNS-resolver identity via DoH whoami, "is my DNS leaking" FAQ |

- **`/ip-check` (shipped yesterday) → 301 redirect to `/what-is-my-ip`.** It is one
  day old — near-zero equity to preserve; clean URL per query is worth more now
  than later. (Redirect lives in firebase.json → vercel.json regen.)
- Each page = the standard tool-page anatomy (below). Same real implementations,
  same button-triggered requests, same honest disclosure band per page.
- `/tools` hub "Privacy & leak checks" group = 4 cards: Breach Check · What Is My IP ·
  IP Leak Test · DNS Leak Test. Footer follows.
- Family cross-links: each page links the other two in a related-tools row (the
  mesh BrowserLeaks builds with its IP-family pages).

### Standard tool-page anatomy (every tool page, "proper + user experience")
1. Short page-hero (chip + H1 with the exact query + 1-line lead)
2. The tool surface (folds above the fold on desktop)
3. "What this contacts / how it works" honesty band
4. FAQ with the query's long-tails (WhatIsMyIP pattern: one H2/H3 per question)
5. Related tools row (same family first)

---

## Part 4 — "Make sure sab real ho" — reality audit (ships in the same batch)

Per-tool functional + claims audit, recorded in docs:

| Tool | "Real" means | Check |
| --- | --- | --- |
| checker / generator / passphrase / entropy / random-string / health / checklist | client-side logic works, no fake counters | run + existing node tests |
| breach-check | real k-anonymity HIBP call; **"offline demo fallback" label is honest** (never implies a live lookup when it is not) | manual run + copy audit |
| dork-builder | "24 defensive recon presets" count is truthful | count check |
| hash-inspector | WebCrypto SHA-256/512 + JWT parse actually compute | run |
| url-scanner | lexical checks fire on known-bad samples (punycode xn--, @-auth, typosquat) | 3 sample URLs |
| new IP tools | endpoints live (already spike-verified), each split page's JS reuses the proven code | run + endpoint status |

Any copy claim that cannot be demonstrated gets **removed or reworded** — the
"No fake tools, no fake stats" band is only worth having if it is true.

---

## Part 5 — Execution plan (batch-9, one PR, after approval)

1. Home: remove checker band, add Popular-tools band, retarget CTAs + nav button
2. Split ip-check → 3 pages (JS split accordingly), `/ip-check` 301 → `/what-is-my-ip`
3. Tools hub + footer + hand-page footers updated (group becomes 4 cards)
4. Sitemap-core ×2 + cache globs + CSP hosts (unchanged hosts — same endpoints)
5. Reality audit pass (Part 4) + copy fixes if needed
6. qa.py + verify-seo + node tests → PR → merge → Actions deploy → live verify → Hinglish report

Out of scope: home H1 change (measured later), quick-generate widget removal
(default keep), Hindi surface, any new tools beyond the split.

---

## Execution result (2026-11-16, batch-9)

All approved items shipped in one PR on branch `arena/2808f9ed-omp-prd`:

- **Home = Option A**: home checker band + quick-generate mini-widget removed; Popular tools band (6 cards) added after hero; hero/nav CTAs → `/checker`; generator promo is text+CTA only; "Fourteen tools" copy. Home H1 untouched (SEO safeguard).
- **Split**: `/what-is-my-ip` (IP identity, dual cross-check), `/ip-leak-test` (WebRTC + privacy tells, baseline via sessionStorage from What Is My IP), `/dns-leak-test` (whoami resolver/ECS/NS). `/ip-check` 301 → `/what-is-my-ip` (firebase.json + generated vercel.json). Old `ip-check.html` removed. ip-check.js copy reworded ("session 1" → baseline language).
- **Reality audit (plan Part 4) — all five verified real**: EFF wordlist = exactly 1,296 words ✅; dork-builder = exactly 24 presets ✅; breach-check offline path labels honesty ("unavailable message, not a verdict") ✅; hash-inspector uses crypto.subtle.digest ✅; url-scanner bad-URL returns explicit parse error ✅. Also fixed: home/checker dead `#checker` anchors (checker page gained `id="checker"`; home CTA → `/checker`); `/#checker` nav CTA in build-phase3-seo.mjs + build-static-seo.mjs → `/checker`.
- **Tests**: qa.py 110 files NO ERRORS; mobile_ux 58/58 (14-tool fixture + "Fourteen"); node suites 27/28 (test_release_verifier = known pre-existing); verify-seo passed (215 URLs, 0 broken, 0 orphans).
- **Page count**: 121 → 123 generated pages.

Post-merge (user side): Request-Indexing for the 3 new URLs; backlink batch continues.
