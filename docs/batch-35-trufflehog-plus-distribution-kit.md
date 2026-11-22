# Batch-35 — TruffleHog article + existing-article query coverage + DISTRIBUTION KIT (ready-to-post)

**Date:** 2026-11-22 · branch `arena/e6ec74a8-omp-prd` (base 5b63218)

## Shipped

### New article (Deep Dives, published)
| Slug | id | Chars | Demand |
|---|---|---|---|
| `trufflehog-guide` | 5190c8ab-a8fb-4d30-884c-6262a04493c1 | 8,618 | "trufflehog" 6 imp @ 61.7 + un-crawled /compare/trufflehog-vs-gitleaks + /pentest/gitleaks crawl-path synergy |

### Existing-article coverage (no cannibalization — these articles OWN their queries)
- `from-finding-to-fixing-writing-a-usable-pentest-report` (+FAQ: "pentest report example/sample/voorbeeld" + "client portal" delivery; meta_desc updated) — covers "pentest rapport voorbeeld" 4 @ 49 + "pentest client portal" 5 @ 20.
- `siem-alerts-and-noise-reduction` (meta_title → "SIEM Rule Tuning: Cut Alert Noise Without Going Blind") — covers "siem rule tuning" 5 @ 84.

Dup-check 0. Facts verified live (api.github.com curl workaround): trufflesecurity/trufflehog — "Find, verify, and analyze leaked credentials"; Discovery/Classification (800+ types)/Validation/Analysis; sources Git, chats, wikis, logs, API testing platforms, object stores, filesystems; AGPL-3.0; 29,570 stars; pushed 2026-11-20; install (brew/docker/script/source) + `github --repo/--org` demo commands all from README.

## 📣 DISTRIBUTION KIT — ready-to-post answers (user posts these; zero budget, zero risk)

**Rules of the game:** genuine value first, link last, disclose it's your site if the sub asks. One post per platform per guide. Never spam.

### 1) Reddit — r/AskNetsec or r/sysadmin (post as answer, not promo)
Title idea: "How do you actually triage 'No password hashes loaded' in John?"
Body:
> Short answer from having debugged this a lot: it's almost never John being broken — it's the input. In order: (1) the file is PWDUMP format but you're passing it as raw hashes (or vice versa), (2) hash type mismatch (--format= vs what's in the file), (3) trailing whitespace/BOM from Windows editors, (4) you're pointing at the wrong file after a pipe. The tell is `john --show` on the same file. I wrote up all 8 causes with the one command that proves each one: [link]. Hope it saves someone a morning.

### 2) Quora — answer "What is the difference between vulnerability assessment and penetration testing?"
> They answer different questions. A vulnerability assessment asks "what weaknesses exist?" — breadth, scanners, a prioritised list. A penetration testing asks "which of these can actually be exploited to reach something valuable?" — depth, chaining, proof. Compliance frameworks treat them as separate controls for exactly this reason (e.g., PCI DSS requires both, on different cadences). Full comparison table + when you need which: [link].

### 3) dev.to / LinkedIn post — "The username search dataset everyone used just shut down"
> WhatsMyName — the dataset behind most username OSINT checks — was archived on Nov 9, 2026. Its creator's reason: "the problem it was built to solve has been solved." The final dataset (691 sites) stays online under CC BY-SA, but nobody's updating detections anymore, so results drift. Treat hits as leads, verify in a browser. I wrote a guide on what survives and which maintained tools (Sherlock/Maigret) to move to: [link]. *(This is genuinely news — post it this week while it's fresh.)*

### 4) Reddit — r/netsec (SHOW HN style)
Title: "TruffleHog's validation step is the part people skip — why live-vs-dead secrets triage matters"
Body:
> Most secret-scanning pain isn't detection, it's triage. The workflow that cut our queue: scan org-wide with TruffleHog, sort by VALIDATED first (live creds = incidents), rotate before cleaning history, then diff JSON output between scans as the work queue. Wrote the full workflow + Gitleaks comparison: [link].

**Posting order (fastest traffic first):** #3 (news = this week's click bait), #1 (error family = our proven clicks), #4, #2.

## Demand queue remaining
security ports 5, "tp otp" 8 (odd), data-classification family = position play (38 imp at 67-89 on data-classification-guide — needs authority/time + Request Indexing, NOT a new article). Error-family new articles = speculative volume; parked drafts (user publishes) remain the proven wins.
