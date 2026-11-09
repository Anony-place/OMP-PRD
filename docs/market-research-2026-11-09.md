# Market research — 2026-11-09 (third pass)

Context: batch 2 is shipped and live (PR #109 redirect repairs, #110 cheat
sheets + `/breach-check` retarget + three error-string pages, #111 the Vercel
sync-deploy fix). This pass answers one question: **what comes next, and what
does the evidence say the site can actually win.**

Method is unchanged from 2026-11-06 — autocomplete (`suggestqueries`, firefox
endpoint) for phrasing, SERP inspection for winnability, GSC reads for observed
demand, site inventory for internal-link fit. 12 new probes this pass, 4 SERP
clusters read. Zero-budget caveat stands: no volume tool, every number is
observed or labelled.

## What the site is, in one table

| Fact | Number | Source |
| --- | --- | --- |
| Sitemap URLs | 202 | last deploy build |
| Published articles | 47 (32 static + 15 rewrite-backed legacy) | tree + `articles.html` |
| 90-day impressions (web.app) | 3 477 (27 % scanner dorks, 40 % salary cluster) | GSC read 2026-11-09 |
| 7-day impressions (vercel.app) | 846 / 5 clicks / position 32.5 | same |
| The only converting page | homepage — 22 of 25 clicks, 8.24 % CTR | same |
| The best positions | `is my password secure` 1.10, `test my password` 1.50, `/checker` 3.14 | same |

The shape that works is settled: **exact error strings and tool pages win;
consumer-advice prose loses.** This pass tests where that shape goes next.

## Fresh demand evidence

### Error-string clusters (the engine)

**`nmap not`** — `not recognized` · `not recognized windows` · `not found` ·
`not recognized powershell` · `not showing mac address` · `not working in cmd` ·
`not finding all hosts`. The largest error cluster probed this pass. The lead
variant is an installation/PATH failure, distinct from our
`nmap-requires-root-privileges` page.

**`burp suite not`** — `not loading website` · `not opening browser` ·
`not working on localhost` · `not intercepting` · `not intercepting localhost` ·
`not intercepting localhost in chrome` · `not working` · `not opening`. The
`not intercepting` sub-cluster alone has three variants and no owner; our
`burp-suite-browser-not-launching` page (shipped yesterday) is its natural
sibling.

**`keepassxc not`** — `not opening windows 11` · `not opening` · `not launching` ·
`not opening windows 10` · `not working windows 11` · `not working` ·
`not supported on this mac` · `not connected` · `not detecting yubikey`. Eight
real variants — the consumer-side twin of the bitwarden cluster.

**`hashcat no hashes`** — `…loaded token length exception` (we own that page) ·
`no hash mode matches` · `salt-value exception no hashes loaded` · `says no
hashes loaded`. Sister errors to the page that already performs.

**`gobuster connection`** — single exact return: `gobuster connection refused`.
Confirmed again (it scored in the 11-06 probes too).

**`hydra not`** — dead end: the SERP is polluted by Hyderabad (city) job
notifications; only `hydra not working` is real. **Drop.**

### Tool-intent clusters (demand for what we already built)

**`check if my password`** — `is leaked` · `is compromised` · `is strong` ·
`have been leaked` · `have been compromised` · `check password status` ·
`check exposed passwords` · `how to test my password`. This is `/breach-check`
and `/checker` demand in consumer language. Our k-anonymity page targets the
technical phrasing (`k anonymity password check`, position 62); these variants
are the volume behind it.

**`is this link safe`** — `checker` · `to open` · `to download` · `to click` ·
`google` · `norton` · `tester` · `reddit`. **`phishing link checker`** —
`free` · `online` · `tool` · `google` · `nordvpn` · `instagram` · `roblox` ·
`reddit` · `github`. Both clusters are `/url-scanner` demand. The tool exists;
the page language does not match the query language.

**`how long does it take to crack…`** (11-06 pass) still points at a calculator;
`/entropy` is that calculator.

### The India finding

`cyber security salary in india` returns a full economy: `per month` ·
`for freshers` · `per month for freshers` · `government` · `in hindi` ·
`for 5 years experience` · `in indian rupees` · `for 2 years experience`.
Combined with the GSC country split — **India 8.24 % CTR vs US 0.09 %, and
`Translated results` 75 impressions at 0 clicks** — the only converting
audience on the entire site is India, and the query they type has no page.

## SERP verdicts

| Cluster | Who ranks now | Weakness | Verdict |
| --- | --- | --- | --- |
| `burp suite not intercepting localhost` | ciplav.com (AI-shaped 2024 page), one SO thread (2024), a 2017 Reddit thread | No PortSwigger page, no maintained article, answers in forum fragments | **WIN** — confidence high |
| `keepassxc not opening` | acciyo.com (AI listicle), r/KeePass threads 2022–23, forum thread | Listicle is a flat numbered reinstall drill; real cause (config file, Defender controlled folder access, corrupted db) buried or wrong | **WIN** — confidence high |
| `nmap not recognized` | rottenwifi / itechguides / geeksdigit — three 2026 generic "nmap on Windows" guides | The error is a section inside a tour, not a page; exact-string titles absent | **WIN at 3–6** — confidence medium (guides are fresh and decent) |
| `cyber security salary in india` | cybersecurityacademy.in, salaryinfo.in, netsalary.in — three dedicated 2026 India pages | Fresh, structured, ₹-denominated; not giants, but three entrenched incumbents | **MAYBE** — winnable only on fresher/experience long-tails, not the head |

## Ranked queue for the next batch

Ordered by demand × SERP weakness × internal-link fit ÷ effort. One PR, three
pages — the engine shape unchanged: exact string in the title, causes in
frequency order, one command or setting per cause, a scannable table, a
confirm-the-fix section, 4–5 FAQs.

| # | Page | Target query | Why it wins | Links from |
| --- | --- | --- | --- | --- |
| 1 | `burp-suite-not-intercepting` | `burp suite not intercepting` (+ `localhost`, `in chrome`) | Weakest SERP of the pass; three variants | the burp page (yesterday), `/pentest/burp-suite`, proxy material in the http-security-headers sheet |
| 2 | `nmap-not-recognized` | `nmap not recognized` (+ `windows`, `powershell`) | Largest cluster; no dedicated page anywhere | `/articles/nmap-requires-root-privileges`, `/cheatsheets/nmap-command-cheatsheet`, `/pentest/nmap` |
| 3 | `keepassxc-not-opening` | `keepassxc not opening` (+ `windows 11`, `not detecting yubikey`) | Eight variants; AI listicle at #1 is beatable | `/compare/keepassxc-vs-bitwarden`, `/articles/bitwarden-autofill-not-working`, `/articles/bitwarden-not-syncing` |

Backlog, next batch after that (in order): `hashcat no hash mode matches` +
`salt-value exception` (either two short pages or one "no hashes loaded, three
different messages" page — decide by whether the SERP separates them),
`gobuster connection refused`, `ffuf vs gobuster` (compare page — stable
autocomplete, and `/compare/` is a format we already run).

### The tool-intent micro-batch (cheap, rides along or follows)

Not new content — language matching on pages that already rank:

1. `/url-scanner`: title/meta/FAQ answer `phishing link checker` and
   `is this link safe` directly. Do not touch the tool's function copy.
2. `/entropy`: surface the phrase `password crack time calculator` in the
   meta/FAQ — the query demand is for the calculator we already are.
3. `/breach-check`: an FAQ row each for `check if my password is leaked` and
   `check if my password is compromised`, phrased in consumer language. The
   k-anonymity H1 stays (it is the differentiator and the current query).

None of these may disturb what already ranks: `/checker` holds
`is my password secure` at 1.10 — its title is not to be touched.

### The India salary page (P1, with a scope caveat)

`/articles/cyber-security-salary-in-india-2026` — ₹ LPA/month tables, fresher
bands, city and role splits, government pay levels, linked from the existing
salary page. Evidence: the only converting country, a full autocomplete
economy, and three incumbents that are niche sites, not DR-80 giants. Caveat:
it is career content on a password-security site; the existing salary page
already set that precedent and it is the largest demand asset we have. If the
operator wants the site to stay strictly on tools and breaches, skip it — but
then accept that the salary cluster stays a 1-click asset.

Hindi (`…in hindi`) is a separate, larger decision — new language surface, new
maintenance. Not recommended this quarter.

## The backlink arm (the stop-rule pivot, warmed up)

Stop rule stands: the three batch-2 pages (`bitwarden-autofill-not-working`,
`burp-suite-browser-not-launching`, `metasploit-database-not-connected`) must
reach 10 impressions in 14 days — **decision point 2026-11-23**. Zero-budget
plays to have ready either way:

1. **Be the canonical answer where the questions already are.** The SERPs above
   are literally unanswered Stack Overflow and Reddit threads from 2017–2024.
   Where our page fully answers a thread's question, a short factual answer
   with the link is legitimate participation, not spam. Two or three per week,
   never in bulk.
2. **Tool-list submissions.** Kali tooling lists, awesome-pentest lists and the
   cheat-sheet directories accept free submissions; the cheat sheets are the
   submittable assets (stable, useful, no sales pitch).
3. **The error pages are link assets by construction** — the site that publishes
   the canonical fix for an error string collects links whenever the error
   trends (a Kali release, a Burp update). Do not manufacture this; be early
   on the next breakage instead (see the response kit below).

## Response kit for the next big password-relevant breach

The langflow page drew 1 140 impressions on a CVE headline (scanner-poisoned,
but the mechanism is real). When the next breach hits: one page, real facts
only, linking `/breach-check` and `/articles/after-a-data-breach`. Same shape
as the error pages: what happened, what to do in order, what not to do. Ship
within 48 hours of the public disclosure. No mock data, no speculation.

## What stays dropped

| Dropped | Why it stays dropped |
| --- | --- |
| Head terms (password manager, vpn, antivirus, salary head) | DR-80+ commercial sites, unchanged |
| `HIBP alternative` page | Listicles with 50+ referring domains, unchanged |
| Glossary fattening, `/learning/*` | Both measured and flat, unchanged |
| Buying a domain / any spend | Zero budget, unchanged |
| **`hydra not…` pages** | **New drop — Hyderabad job-SEO pollution makes the cluster unusable** |
| Hindi-language content | New drop for this quarter — language surface, not demand, is the blocker |
| News/coverage pages as a strategy | Scanner bait; use the response kit instead |

## Measurement

| Signal | Today | Target | Read on |
| --- | --- | --- | --- |
| Batch-2 pages, impressions | 0 (shipped 2026-11-09) | ≥10 each | **2026-11-23 (stop rule)** |
| Batch-3 pages, indexed | — | 14 days | GSC coverage |
| `vercel.app` average position | 32.5 | <15 | weekly |
| Clicks per week, both properties | 9 | ≥30 | weekly |
| `/url-scanner`, `/entropy` impressions | ~0 | visible | 3–6 weeks after micro-batch |

If the stop rule fires on 2026-11-23, the queue above does not disappear — it
halves. Batch 3 becomes one page plus a backlink sprint instead of three pages.
