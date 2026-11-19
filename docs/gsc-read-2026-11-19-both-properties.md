# GSC read 2026-11-19 — BOTH properties (the "11-24 read", exports delivered early)

Sources: two user-shared Sheets (exported 2026-11-19, "last 28 days", web search):
- `1BJlW5BZMS8HGrB7RmDihvskFudpHjz8WI4UFjiS7gp8` = **vercel.app property** (window 10-31→11-17)
- `1QKIWOoIe7hwCLZNELpmB1Y6BCbkL6eEWr-u1d1KOGDU` = **web.app property** (window 10-21→11-17) ← FIRST-EVER web.app export!
XLSX-export trick used again (CSV = first sheet only). Baselines: gsc-read-2026-11-17.md + gsc-deep-read-2026-11-19.md.

## 🎯 The 11-12 flatline: VERDICT = REAL, not data lag
vercel.app daily impressions: 383 (11-10) → 321 (11-11) → 5 (11-12) → 7 → 6 → 5 → 3 (11-16) → **0 (11-17)**.
The tail filled in — and got worse. Hypothesis 1 (GSC lag) is DEAD.

## 🎯 Where the traffic lives: the web.app property (hypothesis 2 CONFIRMED)
web.app ran **steady 24–97 impressions/day for the whole 28-day window** at strong positions
(daily avg pos 2.6–8.1) while vercel surged-and-crashed at deep positions (avg pos 15–49).
Same content, two URL families: web.app URLs (indexed since March 2026) hold the rankings;
vercel URLs got a fresh-index testing surge 11-02→11-11, then demoted/suppressed.
`https://oopsmypassword.web.app/about` **301s → vercel** (live-verified) and deployed canonicals
= vercel (vercel-build.sh rewrites the origin), so Google is mid-consolidation — the
surge-then-crash is the classic fresh-URL test + canonical-consolidation pattern.

## ⚠️ Dork-noise dominates the web.app numbers (exclude from analysis)
"openai_api_key site:web.app" family = ~780 imp @ pos 2.5–18 (wildcard `* * * *` variants too) +
"hacker news site:web.app" 32 + "generator tool site:web.app" 15 → all landing on
/articles/langflow-cve-2026-0768-exploited-to-steal-openai-aws-keys (**1,096 imp @ 3.58, 0 clicks**).
These are scanner dorks hunting leaked OpenAI API keys on *.web.app (Firebase-hosted) sites.
Zero click potential. (Side note: our langflow article owns pos 3.6 for that dork class.)

## Real numbers (ex-dork) across BOTH properties, 28 days
~33 clicks / ~1,650 real impressions. vercel: 25 clk (john-the-ripper article 14, compare pages 2,
tool pages 5, misc 4). web.app: 8 clk — **home 6 clk / 39 imp / 15.4% CTR @ 7.44**, /about 1, ai-work 1.

## web.app real signals (the useful table)
| Page/query | imp | pos | Note |
|---|---|---|---|
| / (home) | 39 | 7.4 | 15.4% CTR — real brand demand |
| /articles/cyber-security-salary-in-usa-... | 130 | 8.6 | biggest REAL query pool (vercel also 18 @ 53) |
| /security-checklist | 34 | 16.4 | |
| /learning | 31 | 5.6 | learning hub ranks well here |
| /articles/ai-agents-can-hack-other-ai-agents | 22 | 3.6 | |
| /learning/roadmap | 15 | 8.5 | |
| **"omp academy"** | 11 | 5.7 | early branded search! ("oops security", "omp study", "omp security" too) |
| Mobile | 127 | 7.7 | 3.9% CTR (desktop inflated by dork noise) |
| India | 55 | 8.9 | 6 clicks, 10.9% CTR — best engagement |

## Batch effects status
- Batch-27 CTR titles (shipped 11-19): **too early** — data ends 11-17. Measure in the next export (~11-26).
- Batch-26 depth pages (spiderfoot/theharvester, live 11-19): same — next export.
- Batch-10+24 effects (john CTR, sbom): john steady at 3.9% CTR / 95 imp — the "(see faq)" family still 0-click at pos 4–6.8.

## Actions
1. **User side (GSC):** Request Indexing on the top vercel.app URLs (home, john article, top 5 pages)
   to speed the canonical consolidation. Keep BOTH properties in GSC; report combined from now on.
2. **Me — batch-28 candidates (evidence-ranked):**
   a. CVSS 3-page interlink cluster (glossary + cvss-score-explained + /cvss-calculator) — "cvss" 15 imp @ 91
   b. secure-remote-access depth refresh + learning-page interlink — 19+24 imp @ ~70
   c. "canary token" glossary (only true content gap, 4 imp @ 92)
   d. salary-article depth (biggest real pool: 130+18 imp, pos 8.6/53)
3. **Next export (~11-26):** measure batch-27/26, watch vercel re-indexation after Request-Indexing,
   keep filtering the "site:web.app" dork family from all totals.
