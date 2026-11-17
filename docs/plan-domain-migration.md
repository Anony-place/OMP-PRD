# Plan: oopsmypassword.com migration (research 2026-11-17, PENDING USER APPROVAL)

## Research — current state (verified 2026-11-17)
- Vercel account aka-su (team_Jk6OQ2oHACoXy9jcaZktLNgj): `list_domains` = EMPTY — zero custom domains on the account.
- Vercel project `oopsmypassword` (prj_rqQBI6GWGKYqjh7DJNgNzqMdyHxT): only `oopsmypassword.vercel.app` attached.
- `https://oopsmypassword.com` fetch FAILS (no reachable site) — domain is unregistered / parked / not pointed. Ownership unknown → user must confirm.
- Site currently lives on TWO platform subdomains (vercel.app primary + web.app) with a known sitemap-origin mismatch.

## Why .com grows faster (evidence)
1. SERP CTR: branded .com URL > platform subdomain (trust signal in result URL).
2. Backlink willingness: people/customers link to real domains; platform subdomains look temporary.
3. Brand-exact match: "oopsmypassword" query == domain.
4. Consolidates 3 origins into 1 — permanently fixes the web.app/vercel.app sitemap-origin split.
5. Competitor benchmark: browserleaks.com, whatismyip.com etc. all run branded .com.

## Migration plan (only after approval + domain availability confirmed)
| # | Step | Who | Notes |
|---|------|-----|-------|
| 1 | Confirm ownership / register oopsmypassword.com | User | Registrar of user's choice (~$10-12/yr) |
| 2 | Vercel: add oopsmypassword.com + www.oopsmypassword.com to project | Me (connector) | add_project_domain ×2 (www → redirect apex or serve both) |
| 3 | DNS at registrar | User | A 76.76.21.21 (apex) · CNAME cname.vercel-dns.com (www) · TXT verification if asked |
| 4 | Canonical origin switch in code | Me | sitemap-core.mjs ×2, build-phase3-seo.mjs, build-static-seo.mjs, og/url/canonical templates → https://oopsmypassword.com |
| 5 | 301s old → new | Me | vercel.json host-scoped redirect (vercel.app → .com); firebase.json redirects (web.app → .com) |
| 6 | GSC | User+Me | New property `oopsmypassword.com` (domain property, DNS verify), submit sitemaps, Change of Address vercel.app → .com |
| 7 | Re-crawl push | Me | IndexNow + Request-Indexing top URLs |

## Honest trade-off
- Cost: 2-6 week re-processing wobble possible (Google moves signals via 301s; one CoA already proven with us).
- Timing argument: NOW is cheapest — traffic is small (25 clicks/28d). The longer we wait, the bigger the equity that has to move.
- Recommendation: DO IT, and do it before the site gets bigger.

## Not touched until approval
No code/DNS/redirect changes made. Awaiting user: (a) domain owned? (b) registrar access? (c) go-ahead?

## DECISION (2026-11-17): NO migration — ZERO budget
User: "paise nhi hai zero" + migration = NO. Domain plan shelved (not deleted — future reference
if budget ever appears; first investment candidate). Current focus: platform-subdomain growth via
content batches + free backlinks + CTR work. No code/DNS touched. Ever suggest paid stuff again? No.
