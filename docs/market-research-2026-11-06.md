# Market research — 2026-11-06

Second pass. Goal unchanged: organic traffic. This pass is narrower and more
ruthless than the first one: not "what could we write", but "what can a
195-URL site with 1 click/day actually win, and what should we stop pretending
we can win".

## Method

| Source | What it gives | Sample |
| --- | --- | --- |
| Google autocomplete (`suggestqueries`, firefox endpoint) | whether real people phrase the query this way, and the exact modifiers they add | 10 probes this pass |
| SERP inspection via web search | who currently ranks, how thin the answer is | 3 clusters read in full |
| Site inventory | where a new page can link without inventing links | 25 articles, 15 guides, 37 pentest, 16 osint, 18 compare, 14 cheatsheets, 30 glossary |
| Prior GSC snapshot (2026-11-05) | which of our pages already get impressions and at what position | malware-families 22 impr @ pos 1.0, pentest-report 10 @ 8.4, siem-alerts 8 @ 72.6, data-classification 5 @ 60.8 |

Caveat stated up front: **no keyword-volume tool is available at zero budget.**
Autocomplete presence is a proxy for "people type this", not for how many. Every
number below is either observed (rank, position, impression) or explicitly
labelled an estimate.

## What the data says about this site

1. **We rank where the query names a specific thing that broke.** The one page
   at position 1.0 is a definitional article; the next best is a report-writing
   page at 8.4. The consumer-advice pages inherited from the retired Academy
   sit at 60–72. That is not a content-quality difference, it is a competition
   difference: "what is malware" has a thousand entrants, "hashcat token length
   exception" has eight.
2. **Our best-performing pages are troubleshooting pages for CLI tools.** The
   hashcat page (7.7k chars) and the nmap page (6.5k) both target an error
   message. Both were built to the same shape: exact error string in the title,
   causes ordered by real-world frequency, one command per cause, a table the
   reader can scan, and a "confirm the fix" section.
3. **That shape is reproducible, and the SERPs it targets are still weak** —
   because the ranking pages are either the tool's own FAQ (dense, undated),
   a 2013 Stack Exchange answer, or an AI-generated listicle that is
   confidently wrong. Those are beatable. "Password best practices" is not.

## Demand evidence captured this pass

Autocomplete returns, trimmed to the variants that signal intent:

**`password manager not…`**
`password manager not working` · `not saving passwords` · `not popping up` ·
`not working on iphone` · `not working in chrome` · `not autofilling` ·
`not working android`

**`bitwarden not…`**
`not auto filling` · `not loading` · `not working` · `not working on chrome` ·
`not sending verification email` · `not syncing` · `not showing up android` ·
`not loading vault` · `not sending email`

Ten separate phrasings for "the extension is broken". That is a symptom cluster,
not one keyword.

**`wireshark not…`**
`not capturing anything` · `not capturing http` · `not showing ethernet
interface` · `not capturing packets` · `not showing interfaces` · `not showing
interfaces ubuntu` · `not showing wifi interface`
(plus `wireshark not equal filter`, which is a *display filter* question and
should be answered inside the cheatsheet, not as its own page)

**`john the ripper`**
`vs hashcat` · **`no password hashes loaded`** · `formats` · **`no password
hashes loaded (see faq)`** · `faq` · `linux install` · `rules` · `macos` · `gui`

The second-strongest suggestion for the whole cluster is an error string. That
is the same signal hashcat gave us before that page worked.

**`sqlmap not…`**
`not authorized` · `not allowed in oscp` · `command not found` · `does not
appear to be dynamic` · `page not found` · `was not able to fingerprint` ·
`parameter not injectable` · `host does not exist`

**`passkey not…`**
`not working` · `iphone` · `google` · `discord` · `on new phone` · `on mac` ·
`microsoft` · `windows 11` · `in chrome` · `salesforce`

**`nmap…`**
`shows all ports open` (and `show all filtered ports`, `not showing all ports`)

**`have i been pwned alternative`**
`free` · `reddit` · `api` · German-language variants

**`how long does it take to crack…`**
`a password chart` · `a password chart 2026` · `a 16 character password` ·
`my password` · `my password test` — the demand is for a *calculator*, and we
already own `/entropy`, `/password-health` and a crack-time table.

## SERP verdicts, cluster by cluster

### WIN — `john the ripper no password hashes loaded`

| Position | Page | Weakness |
| --- | --- | --- |
| 1 | openwall.com FAQ | Authoritative but a wall of interleaved Q&A, no headings a searcher can jump to, no per-cause command |
| 2 | labex.io tutorial | Generic lab walkthrough, two causes only |
| 3 | logmeonce.com | AI-generated SEO page that tells you to "store passwords in plain text rather than a hash" — actively wrong |
| 4–5 | Stack Exchange 2012 / 2021 | Correct fragment, buried in comments, no canonical answer |

There are at least eight distinct causes and the top three results cover two of
them. This is the hashcat situation again. **Confidence: high.**

### WIN (narrower) — `wireshark not capturing anything` / `not showing interfaces`

| Position | Page | Weakness |
| --- | --- | --- |
| 1 | askubuntu 2013 (68 upvotes) | Correct answer to a 2013 Ubuntu, in comments, contradicts itself on root |
| 2 | roihacks listicle (2026) | Generic "reset your network stack" advice, no commands |
| 3 | askubuntu 2016 | Duplicate of #1 |
| 4 | linuxhint 2020 | Tells you to run Wireshark as root — the one thing its own docs forbid |
| 5 | linuxhaxor | Fake statistics ("in 47% of cases") |

Weak SERP, but Google has a strong bias toward Stack Exchange for this exact
phrasing, and the query is cross-platform in a way that forces three separate
answers. Winnable at 3–6, not at 1. **Confidence: medium.**

### WIN, but time-sensitive — `bitwarden not syncing` / `not autofilling`

SERP is almost entirely Reddit threads (three from Jul–Aug 2026) and the
Bitwarden community forum. No article owns it. Those 2026 threads describe a
real breakage in the extension/server compatibility window.

A page here ranks fast because there is nothing to beat, but it decays: the
specific version numbers age out. The durable half is the part that does not
change — vault sync is per-account encryption key material, so the fix is
almost always "log out fully and back in" rather than "resync", and users miss
that distinction. Write the durable half, mention current versions in one dated
line. **Confidence: medium-high, with a decay caveat.**

### MAYBE — `sqlmap does not appear to be dynamic`

Six distinct error strings, all classic, all with weak SERPs of the same shape.
But sqlmap's audience overlaps heavily with people running the tool on a CTF
box at 1 a.m., and our existing `/cheatsheets/sqlmap-pentest-cheatsheet` already
answers part of it. Best executed as an *expansion of the cheatsheet* plus one
page for the two most-typed errors, not six pages. **Confidence: medium.**

### DO NOT — head terms

`password manager`, `vpn`, `antivirus`, `comptia security+`, `cybersecurity
salary`: DR-80+ commercial sites and dedicated review farms hold every position.
We have one salary page that was written for a different intent. Adding more
here makes the site look thinner, not broader. **Skip.**

### DO NOT — "HIBP alternative"

Real demand, but the honest article is a list of competitors with our own tool
as one line item, and the query is dominated by HIBP itself plus listicles that
have 50+ referring domains. Not winnable this quarter. Revisit only if our
Breach Check tool gets its own backlinks.

## Ranked queue for this batch

Ordered by (demand signal × SERP weakness × internal-link fit ÷ effort).
One PR, four pages, per the standing batch rule.

| # | Page | Target query | Why it wins | Links from |
| --- | --- | --- | --- | --- |
| 1 | `/articles/john-the-ripper-no-password-hashes-loaded` | exact error string | 8 causes, top-3 covers 2, one is AI-wrong | `/pentest/john-the-ripper`, `/cheatsheets/john-the-ripper-cheatsheet`, `/compare/hashcat-vs-john-the-ripper`, `/articles/hashcat-token-length-exception` |
| 2 | `/articles/wireshark-not-capturing-packets` | `not capturing anything` + `not showing interfaces` | 2013 answers, root-as-advice, fake stats | `/cheatsheets/wireshark-display-filters-cheatsheet`, `/compare/wireshark-vs-tcpdump`, `/pentest/wireshark` |
| 3 | `/articles/bitwarden-not-syncing` | `not syncing`, `not auto filling`, `not loading vault` | no article owns it; Reddit-only SERP | `/compare/bitwarden-vs-1password`, `/compare/keepassxc-vs-bitwarden`, `/articles/password-manager-benefits`, `/articles/are-password-managers-safe` |
| 4 | `/articles/sqlmap-does-not-appear-to-be-dynamic` | two most-typed sqlmap errors | six-class cluster, all thin | `/cheatsheets/sqlmap-pentest-cheatsheet`, `/pentest/sqlmap`, `/compare/sqlmap-vs-manual-sqli` |

Page 1 is retried work: it was attempted in the last session and the database
connector rejected the payload. The article body is being re-sent as a base64
blob instead of inline SQL, which is how the exiftool and NIST pages got in.

## Why these four and not more

- **Cluster discipline beats spread.** Four pages that each link to two or three
  pages we already own strengthen six existing URLs; four pages in four new
  topics strengthen nothing. The internal-link column above is the actual
  deliverable as much as the article is.
- **Every one of them is evergreen.** Error strings do not expire. Version
  numbers in them do, so each page gets at most one dated line.
- **They match the only shape that has ranked for us so far.** Deviating from it
  to chase volume is how the last 20 consumer pages ended up at position 60.

## Measurement

| Week | What to read in GSC | Pass condition |
| --- | --- | --- |
| 1–2 | "Discovered — currently not indexed" vs "Indexed" | all four indexed within 14 days |
| 3–6 | impressions per page | 20–80/mo each, average position 5–15 |
| 8–12 | clicks per page | first clicks on at least two of the four |

If a page has **zero impressions after 6 weeks**, that is not a content problem,
it is an indexing or intent-matching problem — check the title against the exact
error string first, then the internal links, then rewrite. Do not "refresh" the
copy and hope.

## Open question for the operator

The GSC export that drove the last analysis is no longer in the workspace. A
fresh 7-day export (Queries + Pages) would let the next batch be chosen from
observed impressions instead of autocomplete proxies. Not blocking — the four
pages above are justified without it — but it is the single cheapest way to
sharpen the batch after this one.
