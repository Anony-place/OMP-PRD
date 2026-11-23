# Batch 37 (2026-11-23) — Two Learning-Gem Articles + Batch-36 Redirect Repair

## ⚠️ Correction to batch 36 (important)

Batch 36 shipped 23 learning→article redirects, but **17 of them pointed at
article slugs that do not exist** (`/articles/ogsqlinjection`,
`/articles/session-hijacking`, `/articles/lab-setup-guide`, etc.). Those slugs
were taken from an abbreviated stale memory list and never diffed against the
live database — the exact "abbreviated-slug trap" the workflow warns about. The
batch-36 doc's claim "every destination verified live in the database at ship
time" was wrong. The local `test_vercel_config` run DID flag 18 dangling
destinations; it was dismissed as a sandbox cache artifact (true for 1 of them)
and CI never runs that suite, so the soft-404s shipped.

**Fix (this batch):**
- 11 rules remapped to real, topically-relevant articles (verified in DB):
  malware-delivery→malware-families-explained · device-wiping→on-site-vs-off-site-data-sanitisation ·
  sql-injection×2 / broken-access-control / http-https / security-headers / owasp-top-10→web-application-security-basics ·
  pretexting→fake-login-popup (BITB phishing) · ransomware→malware-families-explained ·
  social-footprint→best-free-osint-tools-for-beginners
- 6 rules with no honest target dropped back to the `/learning/:path*` catch-all
  (incident-response ×2, lab topics ×2, session-management, backups) — wrong-topic
  301s consolidate signals onto irrelevant pages; the catch-all is the lesser evil.
- `tools/test_vercel_config.mjs` added to CI (it was the gate that would have
  caught this; 39 checks incl. "every static redirect destination exists").

## Batch 37 content — 2 gems from the hidden learning library

| Article | id | GSC demand | Category |
|---|---|---|---|
| `cybersecurity-vs-information-security` | 841ad5ce-7364-4990-a881-f60c2ee59ff3 | 36 imp @ 16.1 | Deep Dives |
| `bug-bounty-and-responsible-disclosure` | 01453bd3-c33c-48a3-92c4-f7d63e4fdee4 | 18 imp @ 23.8 (+1 click) | Deep Dives |

Both expanded from their `learning_topics` skeletons (2.6K chars → 8-9K) to
article standard with FAQ + interlinks. Backups in `.drafts/`. Dup check: 61/61
distinct titles. Two new redirects wire the retired lesson URLs to the new
articles.

## Facts verified pre-ship (all fetched live 2026-11-23)
- NIST glossary "cybersecurity" (CNSSI 4009-2022 definition + terminology note) — csrc.nist.gov
- ISO/IEC 27001:2022 full title ("Information security, cybersecurity and privacy protection...") — iso.org/standard/27001
- CISA BOD 20-01 (Sept 2020; VDP required for US federal civilian agencies) — cisa.gov
- disclose.io (safe-harbor framework; Bugcrowd/CipherLaw/Dropbox/Elazari/NTIA/DOJ origins; nonprofit) — disclose.io
- DOJ CFAA charging policy May 2022 ("good-faith security research should not be charged"; extortion carve-out) — justice.gov/archives
- UK Computer Misuse Act 1990 — legislation.gov.uk/ukpga/1990/18
- OWASP WSTG project — owasp.org/projects/web-security-testing-guide

## Feature status (user decision 2026-11-23)
- OMP Academy (labs/quizzes/course hub) = **HELD / rejected** (user disliked the box-type layout + modules/course structure). Not being built.
- Email-list hook = not approved yet (feature gate stands).
- Content/traffic work continues per plan.

## State after batch 37
Articles 59→61 · redirects 50→46 (11 remapped, 6 dropped, 2 added) · dup 0 ·
CI gates now include test_vercel_config (39).
