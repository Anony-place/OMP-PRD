# Crawl-demand kit — 2026-11-10 (batch-4)

Goal: turn the 47 "Discovered – never crawled" URLs (see `gsc-coverage-read-2026-11-10.md`)
into crawled + indexed pages. Two levers: **manual Request Indexing** (instant, free) and
**directory listings** (durable crawl demand + discovery). Zero budget. No paid placements,
no link farms, no bought links.

Submit **https://oopsmypassword.vercel.app** as the site URL everywhere — the Change of
Address consolidates there, and that is the canonical home.

---

## Part 1 — Request Indexing queue (user, ~2 min/day for 5 days)

GSC → URL Inspection → paste URL → **Request Indexing**. Quota is roughly 10/day per
property. Priority order (highest business value first):

**Day 1 — the money surface**
1. https://oopsmypassword.vercel.app/pentest/nmap
2. https://oopsmypassword.vercel.app/pentest/category/network-scanning
3. https://oopsmypassword.vercel.app/pentest/category/web-testing
4. https://oopsmypassword.vercel.app/pentest/category/password-auditing
5. https://oopsmypassword.vercel.app/cheatsheets
6. https://oopsmypassword.vercel.app/cheatsheets/nmap-command-cheatsheet
7. https://oopsmypassword.vercel.app/cheatsheets/hydra-brute-force-cheatsheet
8. https://oopsmypassword.vercel.app/compare/hashcat-vs-john-the-ripper
9. https://oopsmypassword.vercel.app/osint/have-i-been-pwned
10. https://oopsmypassword.vercel.app/osint/ghunt

**Day 2 — remaining hubs + sheets**
- /pentest/category/{vulnerability-scanning, exploitation-frameworks, cloud-container-security,
  active-directory-internal-network, mobile-app-security, wireless-testing} (6)
- /cheatsheets/{curl-command,ffuf-web-fuzzing,http-security-headers,metasploit-command} (4)

**Day 3 — comparisons + misc**
- /compare/{gobuster-vs-feroxbuster, nikto-vs-nuclei, nmap-vs-masscan, nmap-vs-rustscan,
  linpeas-vs-winpeas, sherlock-vs-maigret, trufflehog-vs-gitleaks} (7)
- /glossary/credential-stuffing, /hash-inspector (2)
- one more of your choice

**Day 4 — OSINT + pentest tools**
- /osint/{censys, dnstwist, epieos, maltego} (4)
- /pentest/{wireshark, tcpdump, hydra, jadx} (4)
- /pentest/{semgrep, prowler, gitleaks, autopsy} (4)

**Day 5 — tail**
- /articles/{exiftool-remove-all-metadata, hashcat-token-length-exception,
  nist-password-guidelines-2026} (3)
- /products/{master-in-ai-prompt, why-we-suddenly-forget-why-we-entered-the-room} (2)
- any URL from the 47 not yet requested

---

## Part 2 — Directory sprint (researched 2026-11-10; verify free tier at submit time)

One accurate description everywhere (copy below). Vary the anchor wording naturally —
never paste the identical sentence 20 times. Skip anything that demands payment,
reciprocal links, or a badge we do not want on the site. **A nofollow link still creates
crawl demand and referral discovery — the point of this sprint, not "DA".**

### Tier A — first 90 minutes (free, high-signal, dev/security audience)

| # | Directory | Why it fits | Free lane | Link | Time |
| --- | --- | --- | --- | --- | --- |
| 1 | **DevHunt** (devhunt.org) | Dev-tool launchpad, GitHub auth, security-tool audience | Free listing | dofollow | 10 min |
| 2 | **SaaSHub** (saashub.com) | "Alternative to HIBP/password checker" long-tail pages | Free reviewed listing | dofollow | 10 min |
| 3 | **AlternativeTo** (alternativeto.net) | Evergreen "alternatives" queries | Free | nofollow | 15 min |
| 4 | **TheSaaSDirectory** (thesaasdirectory.com) | Fast approval, DevTools category | Free form | dofollow | 10 min |
| 5 | **Indie Dev Tools** (indiedev.tools) | Hand-curated, indie devs actually browse it | Free, curated | dofollow | 10 min |
| 6 | **DevTools Directory** (devtools.directory) | CLI/tool hub — our cheatsheet angle fits | Free, curated | — | 10 min |
| 7 | **Product Hunt** (producthunt.com) | Broad launch; 11 live tools is enough substance | Free launch | nofollow links | 30 min |
| 8 | **Indie Hackers** (indiehackers.com/products) | Product page + community | Free | nofollow | 10 min |
| 9 | **Crunchbase** (crunchbase.com) | Entity presence, AI-citation surface | Free profile | nofollow | 10 min |

### Tier B — same week (general dofollow directories, human-edited)

| # | Directory | Notes | Link |
| --- | --- | --- | --- |
| 10 | **Viesearch** (viesearch.com) | Human-edited, 1–2 day review; real site needed (we qualify) | dofollow |
| 11 | **Link Centre** (linkcentre.com) | 10-minute form | dofollow |
| 12 | **Side Projectors** (sideprojectors.com) | SaaS/software category | dofollow |
| 13 | **Startup Stash** (startupstash.com) | Software category | dofollow |
| 14 | **SaaSCity** (saascity.io) | Instant listing, dev-tools category | dofollow |
| 15 | **WebCurate** (webcurate.co) | Curated dev tools | — |
| 16 | **LaunchFree.io** (launchfree.io) | Human review, permanent listing | dofollow |
| 17 | **Launching Next** (launchingnext.com) | Simple permanent listing | dofollow |
| 18 | **BetaList** (betalist.com) | Free queue (paid skip exists — don't) | dofollow |
| 19 | **StackShare** (stackshare.io) | Engineer audience; list under security/password tools | dofollow |
| 20 | **YourStory** (yourstory.com) | India-facing startup directory — matches our strongest CTR market | dofollow |

### Tier C — earned, not submitted (highest ceiling, prepare but do not spam)

- **GitHub Awesome-list PRs** (DA 96): one PR each to `awesome-osint` and a security-tools
  awesome list, listing our /osint and /pentest hubs honestly as web resources. Draft the
  PR description from the copy below; a maintainer decides. One attempt each, no resubmits.
- **DEV.to / Hashnode post** (dofollow, DA ~83–91): a real 600-word post — "How our
  zero-knowledge password breach check works" with the k-anonymity walkthrough. Real
  content only; no invented stats. Post from a real account, link naturally.

---

## Part 3 — Submission copy (use verbatim or lightly varied)

**Name:** OopsMyPassword

**Short (≤160 chars):**
Free, privacy-first password tools that run entirely in your browser — strength checker,
generator, breach check and security guides. No accounts, no tracking.

**Medium (~50 words):**
OopsMyPassword is a free, privacy-first security toolbox: password strength checker,
CSPRNG generator, passphrase builder, k-anonymity breach check (Have I Been Pwned range
API), password health audit, entropy calculator, phishing URL scanner and OSINT dork
builder — plus pentest tool guides, CLI cheat sheets and tool comparisons. Everything runs
in your browser; nothing you type is ever sent to a server.

**Long (~120 words):**
OopsMyPassword is a free, open security toolbox built on one rule: the sensitive thing you
type never leaves your browser. The password strength checker does pattern detection, pool
entropy and crack-time estimation locally; the generator uses the platform CSPRNG; the
breach check is zero-knowledge — your browser hashes locally and queries only a 5-character
SHA-1 prefix against Have I Been Pwned's Pwned Passwords range API. Around the tools there
is a full learning surface: pentest tool guides (Burp Suite, Nmap, Hashcat and 30+ more),
one-page CLI cheat sheets, head-to-head tool comparisons, an OSINT directory (GHunt,
dnstwist, Maltego…), and plain-language articles on entropy, phishing and breach response.
No accounts, no ads, no invented stats — if a feature is not live, the page says so.

**Category hints:** Developer Tools / Security Tools / Password Tools / Free Tools
**Tags:** password manager alternative, password strength checker, breach check, pentest,
OSINT, security tools, privacy

---

## Part 4 — Guardrails (professional means disciplined)

- Zero budget: never pay for a listing, a "fast review", or a link.
- One truthful description family; no invented stats, no fake reviews, no awards claims.
- Do not buy Fiverr/Upwork "500 backlinks" packages — that is the penalty lane.
- Skip DA<20 junk directories and any site that requires a reciprocal link or footer badge.
- Expect review times of days to weeks; the effect compounds — check results at the
  2026-11-24 and 2026-12-08 coverage exports, not next morning.
- Track submissions in a simple sheet (URL, date, status, link type) so nothing is
  submitted twice.

## Measurement

| Signal | Where | When |
| --- | --- | --- |
| The 47 URLs: each one leaving `Last crawled = 1970-01-01` | GSC coverage drilldown | 11-17, 11-24, 12-08 exports |
| "Discovered – currently not indexed" count (47 → ?) | GSC coverage | same |
| Referral + crawl stats from directory links | GSC Links report + Performance | 2–4 weeks |
| Batch-2 stop rule (≥10 impressions/page) | GSC | 2026-11-23 |
