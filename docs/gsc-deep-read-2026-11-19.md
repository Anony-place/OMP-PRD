# GSC deep-read 2026-11-19 — full 11-17 export mining (all 7 sheets)

Source: Drive sheet `1L2x-gHdF7y7jemF2Gbok6jtfO6yRLW0SH1Ap9OHg-G8` (XLSX export trick —
CSV export only returns the first sheet; XLSX carries all 7: Chart, Queries 325 rows,
Pages 178 rows, Countries 114 rows, Devices, Search appearance, Filters).
Window 2026-10-31 → 2026-11-15 · vercel.app property · web search · last 28 days.
This extends gsc-read-2026-11-17.md (summary read) with the full tables.

**NOTE: the 11-24 export is NOT in Drive/Dropbox yet** (checked 2026-11-19). This deep-read
mines the freshest available data. The 11-24 delta-read waits on the user's upload.

## Totals
25 clicks · 2,218 impressions (Desktop 23/2004 · Mobile 2/203 · Tablet 0/11).
Trajectory: 36 (11-02) → peak 383 imp @ pos 24.6 (11-10) → 321 @ 15.9 (11-11) →
**flatline 11-12→11-15 (5-7 imp/day)**. The 11-17 read's hypotheses remain open
(tail-end GSC lag most likely); the 11-24 export decides.

## Dork-noise warning (explains one big anomaly)
~60+ impressions at position 1.0 are Google-dork one-offs:
"ransomware malware family site:cve.mitre.org or site:nvd.nist.gov or ... after:2026-11-05"
(44 imp) + same dork on other dates (15 imp + more below cutoff). These land on the
malware-family pages and inflate their impression counts at pos 1. NOT traffic potential.
Real takeaway: our google-dorks cheatsheet ranks #1 for complex dorks (branding, not clicks).

## Winners (page | clk | imp | pos)
- /articles/john-the-ripper-no-password-hashes-loaded: 14 clk, 359 imp, 3.9% CTR @ 5.84 — THE winner.
  Query family A "john the ripper no password hashes loaded" 94 imp @ 5.15 (3.2% CTR).
  Query family B "(see faq)" variants ~33 imp @ 4.4-6.8 (0 clicks) — exact terminal-error phrasing.
- /compare/shodan-vs-censys: 1 clk, 45 imp @ 6.87 · /articles/sherlock-vs-maigret-...: 1 clk, 50 imp @ 13.84
- /articles/sqlmap-does-not-appear-to-be-dynamic: 1 clk, 31 imp @ 5.29 (error-family again)
- /pentest/john-the-ripper 1 clk @ 7.4 (20% CTR) · /osint/sherlock 1 clk @ 42 · /pentest/nuclei 1 clk @ 20.8

## CTR audit — high impressions, ZERO clicks (title/meta problems)
| Page | imp | pos | Diagnosis |
|---|---|---|---|
| /articles/wireshark-not-capturing-packets | 144 | 8.39 | meta_title leads with "Not capturing packets (see FAQ)" — REVERSED vs the query "wireshark not capturing packets" |
| /articles/malware-families-explained | 135 | 3.42 | ~60 dork-noise imp at pos 1 inflate this; real signal still 0-click + **UK spelling "Behaviour" in title** |
| /articles (hub) | 103 | 8.58 | navigational hub; low priority |
| /articles/android-app-blocked-... | 99 | 15.2 | page-2; queries "app blocked to protect your device" 10 imp @ 7.6 + "how to disable..." 4 @ 7.25 → title is decent, position is the issue |
| /learning/.../malware-families | 76 | 3.39 | twin page; dork noise + shared title problem |

## Striking distance — queries (pos 4-15, imp ≥ 4) = quick wins
| Query | imp | pos | Serving page family |
|---|---|---|---|
| john ... (see faq) variants ×6 | ~33 | 4.4-6.8 | john article (FAQ mirror works) |
| "app blocked to protect your device" + variants | 18 | 7.2-8.5 | android article |
| "maigret sherlock" | 8 | 7.62 | sherlock-vs-maigret compare |
| "wireshark not capturing anything" | 4 | 5.5 | wireshark article |
| "cybersecurity salary" | 5 | 35.2 | salary article (needs depth, not title) |
| "tp otp" | 8 | 47.4 | totp glossary |
| "pentest client portal" | 5 | 20 | no real page — odd query |

## Striking distance — pages (imp ≥ 7, pos 7-20)
/articles hub 103 @ 8.6 · incident-response cheat sheet 60 @ 8.2 · shodan-filters cheat sheet 34 @ 8.6 ·
/learning/.../from-finding-to-fixing-report 27 @ 8.3 · /articles/nmap-requires-root-privileges 12 @ 8.25 ·
/compare/bitwarden-vs-proton-pass 7 @ 8.0 · /osint/spiderfoot 7 @ 4.7 (pre-depth! depth shipped 11-19) ·
/osint/exiftool 8 @ 7.75 · android article 99 @ 15.2 · cybersecurity-vs-infosec 36 @ 16.1 ·
pentest-report article 33 @ 16.3 · common-password-mistakes 10 @ 17.

## Deep-position demand pools (NOT gaps — published articles exist; position is the problem)
- **"secure remote access" 19 imp @ 69.6** + /learning/.../secure-remote-access 24 imp @ 71.8 →
  /articles/secure-remote-access is PUBLISHED (8.4k chars) but ranks deep — depth refresh +
  interlink with the learning-track page, not a new article.
- **GDPR data-classification cluster**: "gdpr data classification" 16 @ 83 + "data classification gdpr" 10 @ 89 +
  "classify sensitive data" 9 @ 67 → /articles/data-classification-guide 64 @ 70 (published, 7.7k) +
  learning twin 32 @ 66. Internal links + FAQ expansion candidate.
- **SBOM cluster**: "sbom definition" 16 @ 62 + "sbom meaning" 5 @ 85 + "sbom cybersecurity" 4 @ 67 →
  glossary/sbom 46 @ 64 + published /articles/what-is-an-sbom — interlink + FAQ.
- **"cvss" 15 @ 91** → glossary/cve-and-cvss 20 @ 89 + published /articles/cvss-score-explained (8k) +
  /cvss-calculator tool — 3 pages fighting separately; interlink them to concentrate signals.
- **"k anonymity password check" 10 @ 71** → published /articles/k-anonymity-password-check (6.6k) + breach-check tool.
- **AD/lateral-movement**: "active directory lateral movement" 6 @ 98 + glossary/lateral-movement 22 @ 93 +
  "kerberoasting" 4 @ 82 → glossary depth.
- **"canary token" 4 @ 92** — no page = real topic gap (glossary candidate).
- **"zero day vulnerability" 5 @ 72** → article 14 @ 71 (depth).

## Geo & devices
US 878 imp (39%) @ pos 29 — biggest pool, worst position. UK 139 @ 53, India 95 @ 19.8 (best big-market position).
Brazil 4 clicks (most of any country). 114 countries — long-tail global demand is real.
Mobile 203 imp @ 21.4 (position better than desktop's 27.8) — mobile UX investment is paying off slowly.

## Batch-27 (shipped 2026-11-19 from this evidence): CTR pass #2 + US-spelling sweep
1. wireshark meta_title → query-leading "Wireshark Not Capturing Packets? 8 Causes, Fixed in Order"
2. john meta_title → tool-leading "John the Ripper: No password hashes loaded (see FAQ) — 8 fixes"
   (query family A 94 imp leads with the tool name; exact error phrase kept for family B)
3. malware meta_title → "Malware Families Explained: Ransomware, RATs, Worms & Trojans" + Behavior spelling
4. articles-table UK→US stem sweep (behaviour→behavior etc.) — batch-24's sweep covered tools only.

## What the 11-24 export must answer (user upload required)
1. **vercel.app property** Performance export, last 28 days (covers 11-12→11-24) — did the
   11-12+ flatline fill in (GSC lag) or not (real drop)?
2. **web.app property** export too (still never received) — hypothesis 2 of the dip.
3. Measure batch-27 CTR changes (wireshark/john titles), batch-26 depth pages (spiderfoot/theharvester),
   and batch-10/24 effects (sbom article, 3 IP pages first data).
