# Batch-32 — Demand articles #2 (Windows SmartScreen + Impacket) + un-crawled-page interlink pass

**Date:** 2026-11-22 · branch `arena/bd1eba07-omp-prd` · reacts to `docs/gsc-read-2026-11-22-deindexing-decoded.md` (PR #150)

## Why (evidence)

- Query mining (11-22 Performance export, 324 rows): **"app blocked to protect your device" family = 24 imp across 5 variants, ALL at page-1 positions (7.6-9.7), zero clicks** — the proven error-article CTR play (john article = 14 clk of ~25). **"impacket" = 9 imp @ 73** + AD cluster (kerberoasting 7, AD lateral movement 9, lateral movement 7 imp) = topical-authority play with batches 29-31 articles.
- Coverage drilldown (`google_drive/…Coverage-Drilldown-2026-11-10.zip`, "Discovered – currently not indexed", 47 URLs): un-crawled pages = catalog pages (9 compare, 7 cheatsheets, 6 osint, 18 pentest, 3 articles, 2 products). Fix = internal links from article graph (crawl paths + equity).

## Shipped

### New articles (Deep Dives cat 1b41feb7, status published)

| Slug | id | Chars | Target |
|---|---|---|---|
| `app-blocked-to-protect-your-device-windows-fixes` | f131ca31-6fc5-4fa8-b5bd-4ff826bc2f9f | 10,837 | "app blocked to protect your device" 24-imp family (Windows SmartScreen/MOTW; Android → existing article) |
| `impacket-guide` | f3adc53f-9a87-462a-b80c-71e54b9a93fa | 13,634 | "impacket" 9 imp + AD cluster |

Dup-check: 0 duplicate COALESCE(meta_title,title).

### Interlink pass (un-crawled 47 → crawl paths), anchor-free `content ||` appends

| Article | Added links |
|---|---|
| john-the-ripper-no-password-hashes-loaded | /compare/hashcat-vs-john-the-ripper · /cheatsheets/john-the-ripper-cheatsheet |
| active-directory-lateral-movement | /articles/impacket-guide · /pentest/category/active-directory-internal-network · /cheatsheets/active-directory-enumeration-cheatsheet |
| wireshark-not-capturing-packets | /pentest/wireshark · /pentest/tcpdump |
| web-application-security-basics | /cheatsheets/http-security-headers-cheatsheet |
| android-app-blocked-to-protect-your-device-what-to-do | /articles/app-blocked-to-protect-your-device-windows-fixes (reverse) |

## Facts verified pre-ship (live fetches)

- github.com/fortra/impacket (README + examples dir listing): "collection of Python classes for working with network protocols", originally SecureAuth → Fortra's Core Security; v0.13.1 stable (2026-05-19), v0.14.0-dev active (commit 2026-11-18); Python 3.9-3.13; pipx recommended; 16.3k stars, 294 contributors; ALL script names confirmed in examples/ (psexec, smbexec, wmiexec, dcomexec, atexec, secretsdump, regsecrets, GetLAPSPassword, Get-GPPPassword, dpapi/dpapidump, mimikatz, GetUserSPNs, GetNPUsers, getTGT, getST, ticketer, ticketConverter, describeTicket, findDelegation, keylistattack, badsuccessor, GetADUsers/Computers, lookupsid, samrdump, netview, rpcdump, rpcmap, wmiquery, mssqlclient, CheckLDAPStatus, ntlmrelayx (Oct-2026: SMB/LDAP signing bypass + AD CS CES relay), rbcd, owneredit, dacledit, addcomputer, changepasswd, smbclient, smbserver (signing support), services, reg); disclaimer "research and educational purposes".
- learn.microsoft.com SmartScreen: reputation lists + well-known files + digital-signature reputation; PUA blocking in Edge; GP/Intune management; Win11 enhanced phishing protection.
- learn.microsoft.com Unblock-File: removes Zone.Identifier alternate data stream (value 3 = downloaded from internet); "review the file and its source and verify that it is safe to open".
- MITRE T1003.006 DCSync (fetched 11-22): DC API replication abuse, KRBTGT/historical pulls, TA0006; T1550.002 Pass the Hash (fetched 11-22): hash auth without cleartext, TA0008. T1558.003 Kerberoasting + T1550.003 Pass the Ticket names = prior cross-checked/verified batches.
- Internal links = DB-verified exact slugs (wireshark-not-capturing-packets etc. confirmed via SELECT).

## Known caveats

- Local build stale for new articles (supabase unreachable in sandbox) — CI build (live DB) = real. Live verify after merge.
- GSC measurement of batches 26-32 needs the next export (data cutoff 11-19 in the 11-22 window).
