# GSC Read 2026-11-22 — THE FLATLINE MYSTERY SOLVED: mass deindexing on 2026-11-10

**Date:** 2026-11-22 (branch `arena/bd1eba07-omp-prd`, base cc41068 = batch-31b)
**Exports (user-provided, vercel property `oopsmypassword.vercel.app`):**

| Sheet | Sheet ID | Contents |
|---|---|---|
| Performance on Search 2026-11-22 | `1KsFoB5_g4J-7tCsOpONBnxYErcTKYANJTTCynaR_nGU` | Chart/Queries/Pages/Countries/Devices; window **2026-10-31 → 2026-11-19** (filters: Web, Last 28 days) |
| Coverage 2026-11-22 | `1Q4h7pRnCVxG3vDTq_cDlu91rBMEM-VmH22Y12RV3VUQ` | Chart + Critical issues; window **2026-10-31 → 2026-11-16**; "All known pages" |

Baseline for delta: `docs/gsc-read-2026-11-19-both-properties.md` (same window core; this export extends +2 days and adds **Coverage**).

---

## 1. THE VERDICT: the 11-12 impression flatline = Google mass-deindexed the site on 11-10

**Coverage chart (indexed / not-indexed):**

| Date (2026) | Not indexed | Indexed | Note |
|---|---|---|---|
| 11-06 | 54 | **265** | healthy |
| 11-07 → 11-09 | 58 | **266** | healthy (peak window) |
| **11-10** | **193** | **142** | **−124 pages deindexed IN ONE DAY** |
| 11-11 → 11-13 | 193 | 142 | flat at the bottom |
| **11-14 → 11-16** | **202** | **134** | second dip (−8 more) |

**Performance chart lines up perfectly (with GSC's 2-day data lag):**
383 imp (11-10, the surge peak) → 321 (11-11) → **5 (11-12)** → 7/6/5/3/0/1/0 (11-13→11-19).

**Timeline (decoded):**
1. 11-02→11-10: Google tested the domain (impressions 36→383/day, avg position 35→15→25).
2. **11-10: the test concluded with a quality judgment — 124 pages dropped from the index.**
3. 11-12: the impression crash became visible (processing lag).
4. 11-14: a further 8 pages dropped (142→134).

This confirms the both-properties read's "phase B: demotion/suppression" — it is not a data glitch; **the pages literally left the index.**

## 2. WHERE the 193-202 not-indexed pages sit (Critical issues)

| Reason | Source | Validation | Pages | Meaning |
|---|---|---|---|---|
| **Crawled – currently not indexed** | Google systems | Started | **134** | Google crawled them and CHOSE not to index (quality/supplemental judgment) |
| **Discovered – currently not indexed** | Google systems | Started | **56** | Known (sitemap/links) but not crawled yet (no crawl interest) |
| Page with redirect | Website | Not Started | **10** | URLs we submitted (old sitemap states) that now 3xx |
| Duplicate, Google chose different canonical | Google systems | Not Started | 2 | Google canonicalised elsewhere (likely web.app twins) |

**Local cross-check (this repo):** the current sitemap (236 URLs) ∩ all 27 vercel.json redirect rules = **0** — the sitemap is clean NOW. The 10 redirect pages are stale GSC snapshots (e.g. `articles/is-2fa-safe-legacy` was still in the 11-19 sitemap and got its redirect only in batch-31b). Expected to self-clear; re-check in the next coverage export.

## 3. Performance data = same window as the 11-19 read (+2 quiet days)

- Totals: **25 clicks / 2,222 imp** (desktop 23/2,007; mobile 2/204) — same 25 clicks as the 11-19 export.
- Queries (325 rows) unchanged: john-the-ripper family 3 clk/95 imp @ 5.2 (the only click winner), error-family tops CTRs; demand pools unchanged (secure-remote 19, sbom 16, gdpr-class 16, cvss 15, whatsmyname 11, k-anon 10, impacket 9, trufflehog 6, "penetration test vulnerability assessment" 7 @ 58 → batch-29 article).
- Pages unchanged: john article 14 clk/362 imp @ 5.9; `/` 1 clk/11 imp @ 13.7 (branded "omp academy" 2 clk/4 imp @ 7.0 — BrandMentions works!).
- **Countries: Brazil = 4 clicks (the single biggest click country!)** @ 22.9 + 160 imp; US 878 imp/2 clk; India 2 clk/95 imp @ 19.8. Portuguese-language demand keeps validating (see 11-16 read's pt-BR idea).
- The 2 extra days (11-18: 1 imp; 11-19: 0) = flatline tail. **Nothing in this window measures batches 26-31** (shipped 11-18→11-20; data cutoff 11-19). The real measurement window = the NEXT export (≈11-26+).

## 4. What this means (the theory of the case, now with receipts)

1. Google ran a **fresh-URL discovery test** on the newly-stable vercel domain (11-02→11-10): it sampled broadly, positions improved, then it **judged the sampled content and kept 142 of 324 pages** (later 134). "Crawled – currently not indexed" = the classic supplemental-quality verdict.
2. The web.app property kept its steady 24-97 imp/day through this — the demotion hit the **vercel** property (Google's new-URL test target).
3. The medicine (already in motion, batches 26-31) = exactly what the judgment demands: **deeper, fresher, better-linked pages** + meta/CTR fixes + consolidation signals. Nothing in this export contradicts the current program — it REFRAMES it: we are not "waiting for a data lag", we are **working back from a quality verdict**.

## 5. Evidence-ranked next actions

| # | Action | Why (evidence) | Who |
|---|---|---|---|
| 1 | **Request Indexing on the money pages** (home, /pentest, /compare, john, wireshark, malware, salary, secure-remote + the 6 new articles) | The 134 deindexed pages need re-crawl receipts; batches 26-31 content is the fresh evidence for the re-review | **user** (GSC UI, ~2 min/url) |
| 2 | **Export the "Crawled – currently not indexed" URL list** from GSC (Coverage report → export) | We deepen the exact deindexed pages; 134 = too many to guess | **user** (one export) |
| 3 | Keep shipping depth per the batch program (next = continuing demand pools + deepen deindexed pages when the URL list lands) | The quality verdict responds to quality, not tricks | agent |
| 4 | Next export (≈11-26+) = measure batches 26-31 (CTR/meta fixes + 6 articles) | Data cutoff 11-19; nothing to measure yet | user (send sheets) |
| 5 | Watch the 10 "Page with redirect" clear (sitemap is clean; if they persist in the next export, send the URL list) | Stale snapshots expected to self-heal | both |
| 6 | pt-BR content option keeps scoring (Brazil = #1 click country on vercel) | 4 clicks/160 imp, 2.5% CTR | agent (when batch slots allow) |

## 6. Reproduce
1. Excel serials: 46326 = 2026-10-31 … 46336 = 2026-11-10 (the flip), 46345 = 2026-11-19.
2. Coverage: 265/266 indexed through 11-09 → 142 on 11-10 → 134 from 11-14.
3. Performance: peak 383 imp on 11-10 → 5 on 11-12.
4. Sitemap ∩ redirect-sources = 0 (checked against all 27 vercel.json rules, 2026-11-22).
