# Google Deindex/Suppression — Full Diagnosis + Recovery Plan (2026-11-27)

User shared two GSC exports (Performance + Coverage, property `oopsmypassword.vercel.app`, data through 2026-11-25): "rank band, index band, google se band". Verified from the exports + earlier drilldowns + live checks. **Verdict: host-level algorithmic quality demotion — NOT a ban, NOT technical.**

## The evidence (user's own data)

### Performance (daily)
| Window | Clicks | Impressions | Avg pos |
|---|---|---|---|
| Nov 2–9 (honeymoon) | 12 | 36→376/day ramp | 13–35 |
| **Nov 10–11 (peak)** | 12 (7 on Nov 10) | 383, 321 | 24.6, **15.9** |
| **Nov 12 (cliff)** | 0 | **5** (from 321!) | — |
| Nov 12–16 | 0 | 3–7/day | — |
| Nov 17–25 (dead) | 1 | 0–1/day | — |

### Coverage (indexed / not indexed)
| Date | Indexed | Not indexed | Event |
|---|---|---|---|
| Nov 6–9 | 265–266 | 54–58 | steady state |
| **Nov 10** | **142** | **193** | **deindex wave 1** (−124) |
| Nov 14–16 | 134 | 202 | slow bleed |
| **Nov 17** | **128** | **235** | **deindex wave 2** |
| Nov 17–23 | 128 | 235 | flatline |

- Coverage drilldown (Nov 10 export): issue = **"Discovered – currently not indexed"**, last-crawled = never (1970) for articles/cheatsheets/compare/glossary/osint/pentest alike → Google is CHOOSING not to crawl = trust/quality decision.
- `site:oopsmypassword.vercel.app` live search (Nov 27): **still returns pages** (ghunt, nmap-requires-root, wireshark-not-capturing…) → NOT a ban.
- Site itself is healthy: pages serve, batch-38 articles fetch-verified Nov 23, redirects work.

## Root cause (composite)
1. **New/demoted domain + extreme velocity**: ~243 sitemap URLs published in ~3 weeks on a domain with prior demotion history. Google's new-site honeymoon (Nov 2–11: real rankings, pos 1–15) ended in a quality re-evaluation → host demotion (Nov 12 cliff) + deindex waves (Nov 10, Nov 17).
2. **Scaled-content footprint**: 72 tool-directory pages (/pentest/* 43+13 categories, /osint/* 16) = template-shaped families = 30% of the sitemap; GSC refusal list = exactly these families first.
3. **Index bloat from the hidden learning platform** (~200 /learning/* lesson URLs leaked into the index early Nov via internal links; still visible in GSC pages). Batch-36 (Nov 22) 301'd migrated lessons; the rest linger.
4. Timeline correlation: Nov 10 wave = same morning as batch 5b/6 merges (error pages); Nov 17 wave = during the batches 10–13 sprint (17 PRs in 3 days Nov 16–18). Velocity itself was the pattern.

Ruled out: technical outage (site serves), manual-style full ban (pages still indexed), canonical/host confusion (firebase.json catch-all 301s web.app→vercel.app; sitemap + GSC property both = vercel.app; verify-seo enforces same-origin canonicals).

## Recovery plan
**Phase 1 — stop the bleed (THIS PR, done):**
1. **Publishing velocity = 0.** No new pages (batch-39 tool + content mining PAUSED) until recovery signals appear. This is the #1 signal change.
2. **Sitemap trim**: /osint/*, /pentest/*, /pentest/category/* (72 URLs) removed from sitemap submission (flag `INCLUDE_TOOL_DIR_PAGES_IN_SITEMAP=false` in build-phase3-seo.mjs). Pages stay live + linked via hubs. Sitemap 243 → ~171 core URLs.
3. **robots.txt `Disallow: /learning/`** (hidden platform; build.py template + test/verify allowlists updated).

**Phase 2 — user actions (2 min each):**
- GSC → **Security & Manual Actions → Manual Actions**: ✅ **DONE — "No issues" (user-confirmed 2026-11-27).** Verdict = 100% algorithmic demotion; no manual action to appeal. The plan below is the only path.
- Export current **Page Indexing URL lists** (Pages tab → export, both "Indexed" and "Not indexed") like the previous sheets → I target the next surgical step (which 128 survive = our quality core).

**Phase 3 — quality signals (no new pages):**
- ✅ E-E-A-T batch (2026-11-27, PR #162): article byline "By OopsMyPassword Editorial" → /about#research + per-article trust footer ("verified through the editorial process… Report a correction") + new **"How we research and write"** editorial-policy section on /about (primary sources, dated updates, no pay-to-rank, dated corrections).
- ✅ **Structured-data honesty batch (2026-11-27, PR #163):** article/guide FAQPage schema used to fabricate two invisible questions ("What is the key takeaway of …?" + a tools promo) never shown on the page — the same bug already fixed on tool pages ("markup must match the visible page"). Now: stale FAQPage stripped + rebuilt from the **visible FAQ h3/p pairs** (≥2 pairs required, else no block). Verified: john-the-ripper schema now mirrors its real FAQ; fabricated strings = 0 across articles.
- ✅ **First recovery sign (user's Valid-chart export 2026-11-27):** indexed count **plateaued at 128** for Nov 17–23 — the deindex bleed has stopped. Next watch: "Discovered-not-indexed" count falling, then impressions returning.
- Consolidation: keep the 63+ articles (incl. passkey wave) as the recovery asset; refresh winners (john-the-ripper pos 5.3 pre-crash).
- Stability: no redirect churn, no bulk rewrites, deliberate template passes only.

**Phase 4 — patience + measurement**: re-evaluation typically takes 2–8 weeks. Watch GSC weekly (impressions first, then indexed count). Recovery signs = "discovered-not-indexed" count falling + impressions returning.

**On hold until visibility recovers**: 1K-clicks/mo growth plan, products push, email list, batch-39 tool, content-mining queue.
