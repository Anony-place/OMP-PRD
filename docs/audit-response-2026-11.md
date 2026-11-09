# Audit response & next-phase plan — November 2026

The attached third-party audit (14 pages) was read in full and then **every
claim was checked against the repository and the live deployment**. Some of it
is exactly right, some of it describes a site state from before the November
rebuilds, and one of its three headline recommendations cannot be executed under
this project's constraints.

This document records the verdict on each claim, the one defect that actually
caps growth, and the execution plan that follows from it.

> ### Correction — 2026-11-09, after the first Search Console export
>
> Claim 1 below, and therefore the priority of the whole P0 section, is **wrong
> about the deployed site.** The 201 canonical tags in the *repository* do say
> `web.app`, but `vercel-build.sh` (the Vercel build command) rewrites every
> text file `web.app → vercel.app` before the deployment is published. The live
> origin was checked directly on 2026-11-09:
>
> - `https://oopsmypassword.vercel.app/robots.txt` advertises four `vercel.app`
>   sitemaps and names the `vercel.app` Search Console property.
> - `https://oopsmypassword.vercel.app/sitemap.txt` lists 100 % `vercel.app`
>   URLs.
>
> So **production is not split.** Google fetches the `vercel.app` sitemap
> successfully (297 discovered) and the `web.app` property fails because
> `web.app` is a 301 host — which is correct behaviour, not a bug. The host
> split is a *repository hygiene* problem (one build script is the only thing
> standing between a clean deploy and a regression), not a growth blocker.
>
> P0 is therefore downgraded from "the defect that caps growth" to routine
> cleanup. The measured cap is **demand**, not plumbing — see
> `docs/gsc-read-2026-11-09.md`.

---

## 1. Claim-by-claim verdict

Legend: **REAL** = reproducible today · **STALE** = already fixed before this
audit was written · **WRONG** = not reproducible · **CONSTRAINT** = correct, but
not executable here.

| # | Audit claim | Verdict | Evidence from this repo / live site |
| --- | --- | --- | --- |
| 1 | Split index across `vercel.app` and `web.app` | **REAL — the biggest defect** | `firebase.json` 301s every `web.app` URL to `vercel.app`, but 201 of 201 HTML pages still emit `canonical → web.app`, and all 199 sitemap URLs, `rss.xml`, `llms.txt` and `robots.txt` point at `web.app` too. The canonical points at a host that redirects away. |
| 2 | `web.app` sitemaps "Couldn't fetch" | **REAL** | Screenshot: `/sitemap.xml`, `/sitemap-index.xml`, `/rss.xml` all "Couldn't fetch", 0 discovered. The `vercel.app` property fetched the same file fine: **297 discovered**. |
| 3 | Buy a custom domain, 301 everything | **CONSTRAINT** | Zero budget. Not executable. The free equivalent is to make `vercel.app` the canonical host — see §2. |
| 4 | Four different header/footer template states | **STALE** | 202 of 203 pages share one byte-identical footer (`404.html` is the deliberate exception). |
| 5 | Homepage says "Eight tools" and omits the 3 practitioner tools from the grid | **REAL** | `index.html` grid links exactly 8: `/checker`, `/generator`, `/breach-check`, `/password-health`, `/passphrase`, `/entropy`, `/random-string`, `/security-checklist`. `/dork-builder`, `/hash-inspector`, `/url-scanner` are linked once elsewhere on the page but never in the grid. |
| 6 | Footer omits comparisons, cheat sheets, RSS, LLMs.txt, and 6 tools | **STALE** | Footer links `/compare` ×2, `/cheatsheets` ×2, `/glossary` ×2, `/passphrase`, `/entropy`, `/random-string`, `/dork-builder`, `/hash-inspector`, `/url-scanner`. `llms.txt`, `llms-full.txt`, `rss.xml` all ship. |
| 7 | Broken CLI builders: `exiftool example.com`, `john-the-ripper example.com`, `spiderfoot example.com` | **STALE** | Both hubs now return `null` for any tool without a hand-written spec — "No spec, no section". Only 5 OSINT specs and a matching pentest set render a builder, all with real syntax. |
| 8 | `/pentest/spiderfoot` and `/pentest/theharvester` duplicate the OSINT pages | **STALE** | `scripts/lib/cross-canonical.mjs` canonicalises both to the OSINT page and drops them from the sitemap. |
| 9 | `/security-checklist` prints `passwordReuse` / `SMSSMS` | **WRONG** | No concatenated labels in the shipped markup. |
| 10 | Incident-response cheat sheet double-numbers headings (`1. 1.`) and shows a Wordlist Path field | **REAL** | Both present in `cheatsheets/incident-response-first-hour-cheatsheet.html`. |
| 11 | `/articles/check-if-password-was-leaked` says Breach Check uses a "tiny built-in demo corpus" | **REAL** | Article says demo corpus + "a real deployment would point the same architecture at a licensed range API". `/breach-check` actually queries `api.pwnedpasswords.com/range/` live, free, with offline fallback. The article undersells a working differentiator. |
| 12 | Off-topic products leak into the OSINT list on the HTML sitemap | **REAL** | `sitemap.html` → column "OSINT Tools & Products" → 15 OSINT tools, then `MASTER IN AI PROMPT` and `WHY WE SUDDENLY FORGET WHY WE ENTERED THE ROOM` in all caps. |
| 13 | Footer says "collects no email addresses" while Contact collects an email | **REAL** | Same string on every page; `/contact` has an email field that writes to the Supabase inbox. |
| 14 | `/<article>` vs `/compare/<same pair>` cannibalisation (Sherlock vs Maigret) | **REAL** | 230-word article and 311-word compare page both target the same query. |
| 15 | `/checker` duplicates the homepage widget | **REAL, low priority** | Both self-canonical, overlapping H1s. Fixing it properly means turning `/checker` into a bulk/policy tester — a product change, not a tag change. |
| 16 | Add `SoftwareApplication` / `FAQPage` / `TechArticle` JSON-LD | **STALE** | Already shipped: tool pages carry `SoftwareApplication` + `FAQPage` + `BreadcrumbList`; articles carry `Article` + `FAQPage`. |
| 17 | 38+ articles, 106-lesson Academy, 11 tools, "~1,000 visits/month" | **STALE counts** | 29 article pages, 15 guides, 37 pentest, 16 osint, 18 compare, 14 cheat sheets, 30 glossary = 199 sitemap URLs. The Academy (`/learning/*`) 301s to articles; it is not coming back. |
| 18 | Comparison pages are ~400 words, expand to ~1,200 | **REAL** | Median compare page is 356 words; 11 of 18 are under 400. |
| 19 | Glossary / definition pages are thin | **REAL** | 30 entries, median 140 words. |
| 20 | Six SEO wedges (dork builder, JWT/hash, CLI generators, error strings, compliance presets, checklists) | **PARTLY REAL** | The demand is real; the assets exist. But none of them can rank while claim #1 is unfixed, and two of the six (`nmap command generator`, `google dork builder`) already have a dozen low-DR competitors. See §3. |

**Net:** 12 of 20 claims reproduce, 7 were already fixed, 1 could not be
reproduced. The audit's *diagnosis* is right — page volume is not the bottleneck.
Its *prescription* (buy a domain, then build six new tool families) is not
executable under zero budget, and would be premature even with money.

---

## 2. The one defect that actually caps growth

Three files disagree about which host is the site:

```
firebase.json      : every web.app URL  ──301──▶  vercel.app
canonical tags     : every page         ──says──▶  web.app      (201 pages)
sitemap/robots/rss : 199 URLs           ──list──▶  web.app
Search Console     : web.app sitemap    ──"Couldn't fetch"──▶ 0 pages discovered
                     vercel.app sitemap ──Success──▶ 297 pages discovered
```

Read it as Google does: it fetches a sitemap on `vercel.app` and is handed 199
`web.app` URLs, every one of which 301s back to `vercel.app` and is therefore
recorded as "Page with redirect" rather than indexed. At the destination the
canonical points back at the redirecting host, so it is discarded. Nothing in
the crawl path ever confirms a single crawlable URL.

That is consistent with the 24-hour Search Console tab: 13 pages with
impressions, 0 clicks, and the top page is an old `/learning/...` URL that now
redirects. It is not a content problem. It is a plumbing problem, and it is free
to fix.

### The fix (no domain required)

Make `vercel.app` the canonical host — the one property whose sitemap Google
can already fetch — and keep the `web.app` → `vercel.app` 301s.

1. `SITE_ORIGIN` → `https://oopsmypassword.vercel.app` in `tools/omp_build/layout.py` and `scripts/build-static-seo.mjs`.
2. `scripts/fix-site-origin.mjs`: `NEW_ORIGIN` → vercel; run it over the tree.
3. `scripts/build-phase3-seo.mjs`: same origin for `rss.xml`, `llms.txt`, HTML sitemap.
4. `robots.txt`: advertise the four `vercel.app` endpoints instead of the four `web.app` ones.
5. `vercel.json` already sends `Cache-Control: no-cache` on every route, so nothing stale can outlive the deploy.
6. `sitemap-core.mjs` (both copies — they are enforced identical) for the Edge Function.

Guard: a test that greps every shipped HTML file, `sitemap.xml`, `sitemap.txt`,
`rss.xml` and `robots.txt` for `web.app` and fails if it is ever reintroduced.

**Operator step (only you can do this):** in Search Console, keep the
`vercel.app` URL-prefix property, submit `sitemap.xml` (already Success) and
`sitemap.txt` as a second endpoint, and delete the three failing `web.app`
submissions. Then watch "Page indexing" for 14 days: the number that matters is
**Indexed**, not Impressions.

---

## 3. Market read — where the traffic can actually come from

### Demand that exists (captured from Google autocomplete + SERPs)

| Cluster | Query shape | Competition | Verdict |
| --- | --- | --- | --- |
| Exact CLI error strings | `john the ripper no password hashes loaded`, `sqlmap does not appear to be dynamic`, `wireshark no interfaces found` | Stack Exchange threads, GitHub issues, thin Medium write-ups | **Best wedge.** Already 4 pages shipped. Each one can be owned by a page that answers in the first paragraph. |
| Tool-scoped "how do I" | `exiftool remove all metadata`, `hashcat mode lookup`, `john the ripper hash format` | Tool docs, a few blogs | **Good.** The tool page + cheat sheet already exist; these become long-tail section headings rather than new pages. |
| Command generators | `nmap command generator`, `google dork builder`, `reverse shell generator` | Dozens of low-DR tool farms (anythingtext, commandslab, dorkgpt) plus WADComs/GTFOBins | **Crowded, slow.** Assets exist and should be improved, but do not expect these to rank first. |
| Head terms | `password generator`, `password checker` | Bitwarden DR 88+, 1Password, NordPass, Security.org | **Do not compete.** Nothing here changes that. |
| Definition pages | `what is k-anonymity`, `kerberoasting` | HackTricks, PortSwigger, vendor glossaries | **Weak.** 140-word definitions will not beat them; they only work as internal-link scaffolding. |

### The honest arithmetic

`~1,000 visits/month` today at 0 clicks/day in the 24-hour tab means the site is
not "under-ranked for good content" — it is barely indexed. Realistic targets
once the host is fixed and the internal linking is honest:

| Horizon | What has to be true | Plausible outcome |
| --- | --- | --- |
| 2 weeks | canonical host unified, sitemaps fetching, 199 URLs confirmed | indexed pages go from a handful to 100+ |
| 6 weeks | 6–8 error-string pages, each linked from its tool page and cheat sheet | first impressions on those queries, position 10–30 |
| 12 weeks | 12–15 error-string pages + expanded compare pages | 1.5k–4k impressions/month, first steady clicks |
| 6 months | as above plus 3–5 real backlinks (open-source repo, directory listings) | 5k–15k visits/month is a stretch goal, not a promise |

The audit's "25k/month" figure assumes a custom domain, a backlink campaign and
30+ new pages in 90 days. With zero budget and one publisher, treat it as
direction, not forecast.

---

## 4. Execution plan

Work is batched into PRs, one theme per PR, each with tests. Nothing ships
without a green CI run and a live check with `?v=2`.

### P0 — Stop the bleeding (this week, one PR)

| # | Change | Why | Acceptance |
| --- | --- | --- | --- |
| 1 | Canonical host → `vercel.app` everywhere (pages, sitemaps, RSS, llms, robots, Edge Function) | The defect in §2 | zero `web.app` in shipped files; test guards it |
| 2 | Regenerate all 199 URLs; verify each returns 200 on the canonical host | ensure no redirect in the sitemap | `curl` sweep of all `<loc>` values = 200 |
| 3 | Keep `web.app` → `vercel.app` 301s; add `/index.html` style variants to the same rule | old backlinks still resolve | `web.app` returns 301, not 200 |

### P1 — Make the best assets discoverable (same week, second PR)

| # | Change | Why | Acceptance |
| --- | --- | --- | --- |
| 4 | Homepage grid: 8 → 11 tools, `h2` becomes "Eleven tools. Zero accounts." | the three differentiators currently have no homepage link equity | grid contains `/dork-builder`, `/hash-inspector`, `/url-scanner` |
| 5 | Cross-link every tool page ↔ its cheat sheet ↔ its error articles | the 4 shipped error pages currently get one internal link each | each error article has ≥3 inbound internal links |
| 6 | HTML sitemap: give products their own column, out of "OSINT Tools & Products" | E-E-A-T, and it stops AI-prompt books reading as an OSINT tool | products absent from the OSINT column |

### P2 — Credibility defects (one PR, small, high trust value)

| # | Change |
| --- | --- |
| 7 | `check-if-password-was-leaked`: describe the live k-anonymity range API, keep the offline fallback honest |
| 8 | Incident-response cheat sheet: kill the `1. 1.` numbering, remove the Wordlist Path input on a defensive page |
| 9 | Footer privacy line: "collects no email addresses" → what is actually true (contact form + optional article updates) |
| 10 | Sherlock-vs-Maigret: cross-canonical the 230-word article to the compare page (or vice versa) so one URL owns the query |

### P3 — The content engine (2 pages/week, batched fortnightly)

Keep the only pattern that has a proven SERP gap: **the query names a specific
broken thing**. Queue, in order of confidence:

1. `nmap: all ports open` (UDP false positives, `-sU` behaviour, host discovery off)
2. `hashcat: token length exception` — exists; expand with mode/encoding table
3. `hydra: target does not have a password` / connection errors
4. `burp suite: browser not launching` / proxy not intercepting
5. `gobuster: wordlist not found`, `ffuf: position keyword missing`
6. `passkey not working on iPhone / Windows 11`
7. `bitwarden not autofilling on Android` (splits off the sync page if it earns impressions)

Rules for each: answer in the first two sentences, one command block that
actually works, a "what not to do" section, FAQ schema, and links to the tool
page + cheat sheet. No page without both.

### P4 — Depth on what already ranks (after P0–P2 land)

- Compare pages: 356 → 900+ words with a real decision table, benchmark notes and "when not to pick either".
- Glossary: 140 → 350 words with a worked example, and link each entry from the tool pages that use the term.

### P5 — Backlinks and E-E-A-T (month 2+)

- Open-source the client-side dork engine on GitHub (the audit is right that this is the cheapest credibility route for a security tool; it also gets the repo into `awesome-*` lists).
- Named author bio + `Person` schema on articles.
- Directory submissions: Bellingcat toolkit, OSINT directories, `awesome-pentest` lists.

### Explicitly not doing

- Buying a domain (zero budget).
- Reviving the Academy or restoring `/learning/*` — it 301s to articles by design.
- Chasing head terms (`password generator`, `password checker`).
- Publishing 30 pages in 90 days to "raise page count" — that is the mistake the last year already made.
- A `.com` migration story in content. Nobody searches for a brand that small.

---

## 5. What success looks like, and when to change course

| Checkpoint | Read | If it fails |
| --- | --- | --- |
| +14 days after P0 | Search Console → Page indexing → **Indexed** count | if still <30, the canonical flip did not take; inspect a sample URL's "User-declared canonical" vs "Google-selected canonical" |
| +30 days | impressions on the 4 shipped error pages | if zero impressions, the title does not match the query; rewrite the title, not the body |
| +45 days | clicks on any error page | if impressions but no clicks, the H1/snippet is the problem |
| +60 days | indexed count vs sitemap count | gap >50% means an internal-link or thin-content problem, not a crawl problem |

Do not start P4 or P5 before P0 reports Indexed > 100. Depth on unindexed pages
is wasted work.
