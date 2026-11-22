# Batch-34 — CTR pass on page-1 rankings (fastest traffic lever)

**Date:** 2026-11-22 · branch `arena/4e3e3248-omp-prd` (base ccc8d63) · response to user's traffic/revenue concern

## Why (evidence)
11-22 query export: the site's clicks come overwhelmingly from **error queries at page-1 positions** (john family ~120 imp at 4-7, 3 clicks = 3.2% CTR at avg 5.2 = BELOW expected). Queries with page-1 positions + zero clicks = titles/meta can win them without new rankings:
- "john the ripper no password hashes loaded" family 95+ imp @ 4.4-6.8
- "wireshark not capturing anything" 4 @ 5.5 (article ranked but title said "packets", not "anything")
- "maigret sherlock" 8 @ 7.6 + "sherlock maigret" 3 @ 6.7 (article had NULL meta_title/desc!)
- "unsafe app blocked android" 3 @ 8.3 (android article desc lacked "unsafe app blocked")

## Shipped (DB-only batch; CI rebuild = live)
| Slug | Change |
|---|---|
| john-the-ripper-no-password-hashes-loaded | meta_title → "No Password Hashes Loaded (see FAQ): 8 John the Ripper Fixes" (error-first, exact error string) + desc with "fixed in 2026" |
| wireshark-not-capturing-packets | meta_title → "Wireshark Not Capturing Anything? 8 Causes, Fixed in Order" (exact query variant) + desc "not capturing anything" |
| sherlock-vs-maigret-username-osint-comparison | NULL meta_title/desc FILLED: "Sherlock vs Maigret (2026): Which Username OSINT Tool Wins?" + desc |
| android-app-blocked-to-protect-your-device-what-to-do | meta_desc → leads with "unsafe app blocked" (Play Protect query variant) |
| john-the-ripper-no-password-hashes-loaded | + interlink append → /articles/hashcat-token-length-exception (un-crawled 47 list; hashcracking error adjacency) |

Dup-check: 0 duplicate COALESCE(meta_title,title). All titles ≤65 chars, desc ≤170.

## Traffic/revenue plan (user asked: traffic low, no earnings)
Honest framing delivered in Hinglish report:
- Site's Google relationship = 3 weeks old; demoted domain + deindexing = the slow phase is EXPECTED, not broken. SEO compounds at 3-6 month scale.
- Current: ~25 clicks/28d. Earnings need ~1k+ clicks/mo first. **Traffic IS the prerequisite** — no monetization move matters yet.
- Fastest levers (evidence-ranked): (1) user publishes 3 parked error drafts (admin panel) — proven click family; (2) this CTR pass; (3) more error/fix articles (the ONLY family with proven clicks); (4) zero-cost distribution (Reddit/Quora/dev.to answers → definitive guides); (5) Request Indexing on money pages + tools.
- Earning paths once traffic lands: products (master-in-ai-prompt), academy brand ("omp academy" branded queries emerging), tools as magnets (CVSS calculator), email list (feature-gated). AdSense only at 10k+ sessions.
