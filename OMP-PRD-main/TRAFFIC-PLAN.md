# Traffic plan

The site is not short of engineering. It is short of people who know it exists.

Everything a search engine needs is already in place and has been for a while:

| Signal | State |
|---|---|
| Sitemaps | `sitemap.xml`, `sitemap-index.xml`, `sitemap.txt`, `rss.xml`, `google-sitemap.xml` alias |
| robots.txt | lists all four, explains the fallbacks |
| Canonical on every page | build-time rewrite to the host that actually serves |
| Structured data | Article, BreadcrumbList, ItemList, Product |
| IndexNow | key file at the root, submission step in the deploy workflow |
| `llms.txt` | written for AI answer engines, regenerated on every publish |
| Redirects | old host 301s to the serving host, verified after every deploy |
| Internal linking | articles now close on three related articles each |
| Search Console | verification meta tag present |

None of that creates demand. It only removes the excuses a crawler would have
had. What follows is the part that does create demand.

## The shape of the problem

A site gets traffic from four places, and three of them are not code:

1. **Search** — compounds, but slowly and only with volume
2. **Links** — compounds, and lifts everything else
3. **Social** — immediate, ~24 hours of life, no compounding
4. **Answer engines** — growing, cite-worthy pages get quoted and clicked

A new site with no backlinks, on a shared `*.vercel.app` subdomain, should
expect roughly nothing from search for three to six months. That is not a bug in
the site; it is how the index treats a new host with no inbound links. Anyone
who promises faster is selling something.

## What the site already has that can win

Audited by category, not by hope:

| Content | Count | Competition | Verdict |
|---|---|---|---|
| **Comparisons** (`burp-vs-zap`, `nmap-vs-masscan`, `ffuf-vs-gobuster`, `shodan-vs-censys`, …) | 12 | **Low** | **The wedge. Expand first.** |
| **Cheat sheets** (`nmap`, `google dorks`, `linux privesc`, `shodan filters`, …) | 10 | Medium | High volume, worth doubling |
| **Tools** (`entropy`, `dork-builder`, `hash-inspector`, `url-scanner`, …) | 10 | Low–medium | Product-led; people link to tools |
| **Academy lessons** | 118 | Low (long tail) | Depth signal, slow drip |
| **Glossary** | 30 | High | AI answers eat "what is X"; low value |
| **Articles** | 16 | Mixed | Mostly news — see below |

### Comparisons are the best page type on this site

`ffuf vs gobuster`, `amass vs subfinder`, `sqlmap vs manual sqli`,
`sherlock vs maigret`, `wireshark vs tcpdump` are searched by people with a
specific decision to make and a tab already open. The competition is blog posts,
not brands. Twelve of these exist at ~600 words each; 600 is thin. The plan is
fewer, better pages: 1,200+ words, a decision table near the top, and a verdict
that answers the query in the first screen.

### News articles do not compound

`langflow-cve-2026-0768`, `php2shell`, `cloudflare-verification-scam` are worth
writing **within hours of the news** and worth almost nothing afterwards. They
will not rank retroactively. Keep them for topical freshness and for the people
who arrive from a social post, but do not count them as traffic.

Evergreen `how to` posts are what accumulate. Of the 16 articles now, roughly
four are evergreen.

## The honest bottleneck: the domain

This was already researched and written down in this repository before I got
here: `.vercel.app` pages are known to fail to fetch in Search Console, and the
conclusion at the time was that a custom domain is the real fix.

A shared subdomain has no authority of its own, shares a reputation with
everything else on the host, and is a hostname Google has seen immense spam on.
No amount of on-page work compensates for it.

A `.com` is roughly ₹900 a year. Against every other option available — paid
ads, tools, freelancers — it is the highest-return ₹900 this project can spend.
It is listed here once, as a fact, not as a task.

## What to do, in order

### Week 1 — make the graph correct

- Confirm Search Console is verified for the host that is actually serving
  (`oopsmypassword.vercel.app`), not only the one that 301s. A property on the
  redirecting host will report "Page with redirect" for all 298 URLs and no
  queries at all, which looks exactly like "no traffic" and hides real progress.
- Submit `sitemap.xml` and `sitemap.txt` there.
- Add Bing Webmaster Tools. Free, and it is the index behind Copilot and
  ChatGPT search.
- Use URL Inspection on the ten pages worth ranking and request indexing.

### Weeks 2–4 — publish where competition is lowest

Write 8 comparison pages and 4 cheat sheets. Not articles.

**Written so far** (all 1,400–2,000 words, each with a short answer at the top,
six or more FAQ entries with FAQPage schema, and two or three long-form
sections the old ones did not have):

- `trufflehog-vs-gitleaks` — secret scanning. Verification vs pattern matching
  is a real, defensible technical difference, and the query is asked by people
  about to choose a scanner for a repo they own.
- `gobuster-vs-feroxbuster` — content discovery. Pairs with the existing
  `ffuf-vs-gobuster`; the three pages now link to each other.
- `nikto-vs-nuclei` — web server scanning. High-volume, currently answered by
  thin blog posts.

Companions still to write, in rough order of how winnable they are:

- `gobuster vs feroxbuster`
- `nikto vs nuclei`
- `katana vs hakrawler`
- `responder vs mitm6`
- `linpeas vs winpeas`
- `trufflehog vs gitleaks`
- `netexec vs crackmapexec`
- `nmap vs rustscan`

Cheat sheets, same reasoning — huge volume, blog-level competition:

- `curl cheatsheet`
- `sqlmap cheatsheet`
- `hydra cheatsheet`
- `john the ripper cheatsheet`
- `metasploit cheatsheet`
- `wireshark filter cheatsheet`

### Ongoing — earn the links

Links are what lift every page at once, and they are free if you ask properly:

- **awesome-lists on GitHub** — `awesome-osint`, `awesome-privacy`,
  `awesome-security`, `awesome-pentest`. A pull request adding one genuinely
  good resource is normal and welcome. This is the single cheapest real link.
- **AlternativeTo**, **PrivacyTools-style directories**, **free tool
  directories** — listings that send referral traffic and a link.
- **Show HN** — `Show HN: Privacy-first security tools that never send your
  password anywhere`. Post the tool, not the blog.
- **Product Hunt** — one launch, prepared in advance, all 10 tools in one place.

### Ongoing — social, with rules

Reddit will send real traffic and will ban you for spamming. The rule that
works: answer questions in `r/cybersecurity`, `r/netsec`, `r/privacy`,
`r/India`, `r/developersIndia` for a while with no link, and only link when the
link is the answer.

The certificate page is the one built-in loop: people finish a track, share the
certificate, and the image carries the URL. Make sure that image is worth
sharing.

## What to measure

Search Console is enough. It gives queries, impressions, click-through and
position without a client-side script, so the "zero telemetry" claim on the site
stays true.

Watch three numbers, monthly:

1. **Impressions** — is the site being surfaced at all? This moves before clicks.
2. **Average position** — for the comparison pages specifically. Positions 8–20
   are the ones worth rewriting; position 60 means the page is not the problem.
3. **Pages with impressions but no clicks** — those are title and description
   problems, the cheapest fix available.

## Realistic expectations

Assuming consistent publishing and a handful of real links:

| Month | Organic sessions/month | What is happening |
|---|---|---|
| 1 | 0–50 | Nothing indexed yet. Normal. |
| 3 | 100–500 | Long-tail comparisons start appearing on page 2–3 |
| 6 | 1,000–3,000 | First page-1 rankings on low-competition terms |
| 12 | 5,000–15,000 | Compounding, if the publishing did not stop |

If publishing stops in month two, the month-twelve number is zero. Search
rewards the sites that kept going, not the sites that were clever once.
