# GSC Coverage read — vercel.app property, export 2026-11-10

Source: user-supplied GSC Page Indexing export (`https___oopsmypassword.vercel.app_-Coverage-2026-11-10.zip`,
uploaded to Google Drive 2026-11-10T05:17Z). Raw CSVs preserved in workspace `.gsc-coverage/` (not committed).
Data window ends 2026-11-06 — it predates batch-2 (shipped 11-08) and batch-3 (shipped 11-09).

## Chart (all known pages)

| Date | Not indexed | Indexed | Impressions |
| --- | --- | --- | --- |
| 2026-10-31 | — | — | 0 |
| 2026-11-01 | — | — | 0 |
| 2026-11-02 | — | — | 36 |
| 2026-11-03 | — | — | 122 |
| 2026-11-04 | — | — | 160 |
| 2026-11-05 | — | — | 109 |
| 2026-11-06 | 54 | 265 | 179 |

Coverage counts only appear on days GSC updates the tally (11-06 in this export).
Impressions: 0 → 179/day in six days; 606 total in the window. The vercel.app property is
actively re-serving in search — the migration is working.

## Not-indexed breakdown (54 of 319 known)

| Reason | Pages | Read | Action |
| --- | --- | --- | --- |
| Discovered – currently not indexed | 47 | Google knows the URLs but has not prioritized crawling them. Crawl-demand gap, not a quality verdict. | Backlinks + internal links. This is the strongest data argument yet for the backlink arm. |
| Page with redirect | 3 | Legacy URLs Google carries (old paths / .html variants). NOT in our sitemap — verify-seo proves all 202 sitemap URLs routable. Migration scars. | Expected; they fade. Optionally 301 the exact old URLs once identified. |
| Duplicate, Google chose different canonical than user | 3 | We declare vercel.app canonicals; Google picked something else (likely the web.app twins). The sitemap-canonical lag we predicted, now visible in the data. | Change of Address **already run** (user confirmed 2026-11-10) — residual lag only; these fade as the move completes. |
| Crawled – currently not indexed | 1 | Crawled, judged not worth indexing (thin or duplicative). | Identify via URL inspection; low priority. |

Non-critical issues: none.

## Numbers that matter

- **265 / 319 indexed (83 %)** on the new property — healthy for a migration two weeks old.
- Google knows **319 URLs** vs **202 in our sitemap** — the extra ~117 are legacy URLs and
  variants carried over from the web.app era. Explains the redirect/duplicate rows.
- Impressions run-rate ~179/day by 11-06 vs web.app's ~39/day 90-day average: the new
  property is already out-impressing the old one. Vercel avg position 32.5 (7-day read 11-09)
  should improve as the canonical consolidates.

## What this changes in the plan

1. **Backlink arm gets promoted, not just kept warm.** 47 discovered-not-crawled pages need
   crawl demand; no on-page tweak produces that. The 2026-11-23 stop rule decides batch size,
   but the free-directory sprint (Asia/AU) is justified either way — it feeds crawl demand.
2. **Change of Address: done** (user confirmed 2026-11-10 — do not restate as pending). The 3
   "different canonical" pages are residual lag from the move, not a missing action; watch them
   fade in the 11-17 / 11-24 exports.
3. **Next coverage export (~2026-11-17 and ~11-24)** must be read against this baseline:
   batch-2/3 pages should appear in Discovered, then Indexed. If the 47 shrinks → good.
   If it grows with our new pages → crawl demand is the binding constraint, confirmed.

## Open items (user-side)

- Example URLs behind the two 3-page rows (click the rows in GSC, copy 3 URLs each) — optional;
  lets us fix instead of waiting for the scars to fade.
- ~~GSC Change of Address~~ — **done** (user confirmed 2026-11-10).
- `VERCEL_DEPLOY_HOOK` secret (Actions) — sync-commit force-deploy ke liye.

---

# Drilldown addendum (export 2026-11-10, second ZIP)

User exported the URL-level drilldown for **"Discovered – currently not indexed" (47)**.
Raw: workspace `.gsc-coverage/Table.csv`. Every row: `Last crawled = 1970-01-01` — **never
fetched even once**. Pure crawl-demand starvation; zero quality signal involved.

## The 47, by section

| Section | Count | URLs |
| --- | --- | --- |
| `/pentest/*` | 16 | tools: autopsy, gitleaks, hydra, jadx, nmap, prowler, semgrep, tcpdump, wireshark (9) + all 9 `/pentest/category/*` hubs |
| `/compare/*` | 9 | ffuf-vs-gobuster, gobuster-vs-feroxbuster, hashcat-vs-john, linpeas-vs-winpeas, nikto-vs-nuclei, nmap-vs-masscan, nmap-vs-rustscan, sherlock-vs-maigret, trufflehog-vs-gitleaks |
| `/cheatsheets/*` | 7 | index + curl, ffuf, http-security-headers, hydra, metasploit, nmap |
| `/osint/*` | 6 | censys, dnstwist, epieos, ghunt, have-i-been-pwned, maltego |
| `/articles/*` | 3 | exiftool-remove-all-metadata, hashcat-token-length-exception, nist-password-guidelines-2026 |
| `/products/*` | 2 | master-in-ai-prompt, why-we-suddenly-forget-why-we-entered-the-room |
| misc | 2 | /glossary/credential-stuffing, /hash-inspector |

Pattern: **the entire tool-directory long tail** (38/47 = pentest + compare + cheatsheets +
osint) is starved; the money surface (password tools, mainstream articles) is crawled and
impressing. The 9 `/pentest/category/*` hubs are the highest-leverage targets — indexing hubs
trickles crawl to their children.

## Migration machinery — verified correct, no action needed

- Committed tree canonicalizes to web.app (Firebase build); `vercel-build.sh` rewrites the
  origin to vercel.app at Vercel build time (canonical, og:url, JSON-LD, sitemaps, robots).
  Each host self-canonicalizes — the design is right.
- CoA done (user confirmed). The 3 "chose different canonical" rows are the consolidation tail.
- `hashcat-token-length-exception` article already exists in the tree — **check the tree
  before queueing P1 "hashcat sister errors" pages** (the backlog note stands).

## Action queue (crawl-demand sprint = batch-4 shape)

1. Internal-link weave from crawled pages → the 47 (category hubs first, then cheatsheets
   cross-linked from their tool pages and articles).
2. User-side: GSC URL Inspection → Request Indexing for top ~10 (free, ~10/day quota):
   /pentest/nmap, /pentest/category/*, /cheatsheets/nmap-command-cheatsheet,
   /compare/hashcat-vs-john-the-ripper, /osint/ghunt.
3. Backlink sprint (free-directory, Asia/AU) stays the durable fix — external demand is what
   turns "discovered" into "crawled".
4. Read the 11-17 / 11-24 exports against this list: each URL that moves off 1970-01-01 is a win.
