# Batch-33 — Demand articles #3 (WhatsMyName + Data Sanitisation)

**Date:** 2026-11-22 · branch `arena/a952e473-omp-prd` (base 4db695a) · demand queue items 1+2 from batch-32 report

## Why (evidence)
- 11-22 query mining: **"whatsmyname" 11 imp @ 76.4 + "whatsmyname app" 4 @ 87 = 15 imp** (position play; sherlock/maigret already rank @ 5.2 = topical adjacency). **"on-site data sanitisation" 6 @ 52.5 + "of-site data sanitisation" 5 @ 52 = 11 imp** (typo variant included).

## Shipped (Deep Dives cat 1b41feb7, published)

| Slug | id | Chars | Target |
|---|---|---|---|
| `whatsmyname-username-search-guide` | 17e7d596-3955-42c4-b9a6-22e23aba478f | 8,956 | whatsmyname family 15 imp |
| `on-site-vs-off-site-data-sanitisation` | 9d8bf309-e787-470c-9c35-0390ae227111 | 11,547 | sanitisation family 11 imp (incl. "of-site" typo) |

Dup-check: 0. Reverse interlink: sherlock-vs-maigret-username-osint-comparison → whatsmyname article.

## Facts verified pre-ship (live)
- **WhatsMyName = WebBreacher/WhatsMyName** (NOT WebSecAssassin — memory was wrong; caught by GitHub API search): created by Micah "WebBreacher" Hoffman Oct 2015; **ARCHIVED 2026-11-09** ("The project has closed"); final dataset `wmn-data.json` = **691 sites**, last updated 2026-11-09; license **CC BY-SA 4.0**; 3,055 stars / 499 forks; README fetched via api.github.com/readme (fetch_page on github pages failed; raw README empty; API readme endpoint worked). Maintainer quote used: "Treat results as leads to verify, not as facts." Closure reasons: moved interests, unsustainable maintenance, "the problem it was built to solve has been solved".
- **NIST SP 800-88 Rev.1 = WITHDRAWN 2025-09-26, superseded by Rev.2** (published Sep 2025, authors Chandramouli + Hibbard). Rev.2 PDF fetched (nvlpubs): Clear §3.1.1 (logical, user-addressable, factory reset; DoD 5220.22-M multi-pass called out — "very little confidentiality protection" on SSD overprovisioning; DoD removed overwrite specs from NISPOM 2006), Purge §3.1.2 ("when possible... instead of clear"; IEEE 2883; block erase/CE; degaussing magnetic), Destroy §3.1.3 (physical, unusable), Cryptographic Erase §3.2 (only viable purge for cloud/virtual storage), §2.4 on-site vs off-site factor + "loss of control... may constitute a data breach" footnote, Appendix C Certificate of Sanitization, verification vs validation roles.
- Internal links DB/sitemap-verified: /osint/whatsmyname, /osint/sherlock, /osint/maigret, /compare/sherlock-vs-maigret, sherlock-vs-maigret-username-osint-comparison, data-classification-guide, k-anonymity-password-check, secure-remote-access, app-blocked-to-protect-your-device-windows-fixes.

## Demand queue remaining
trufflehog 6 (synergy: /compare/trufflehog-vs-gitleaks un-crawled), google dorks cheat sheet 4, siem rule tuning 5, "pentest rapport voorbeeld" 4 (Dutch report template), data classification expo/forum 6+4 (odd), security ports 5, "tp otp" 8 (odd).
