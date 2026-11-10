# Market research — 2026-11-10 (fourth pass)

Fresh probes after batch-4. Method: 12 autocomplete probes (suggestqueries), 6 SERP checks,
tree/sitemap dedupe first (49 published articles listed in sitemap.xml). Two live breaches
changed the priority order — see "Response-kit trigger".

## Tree check first (duplicates avoided)

Already published — do NOT re-queue: `john-the-ripper-no-password-hashes-loaded`,
`wireshark-not-capturing-packets`, `sqlmap-does-not-appear-to-be-dynamic`,
`bitwarden-not-syncing`, `check-if-password-was-leaked`, `hashcat-token-length-exception`,
`metasploit-database-not-connected`, US salary guide, `nmap-not-recognized` +
`nmap-requires-root-privileges`, `keepassxc-not-opening`, batch-2 trio.

## Response-kit trigger (ACTIVE — 2026-11-03 / 11-06 disclosures)

| Breach | Disclosed | Exposed | Source |
| --- | --- | --- | --- |
| **Chainalysis** | 2026-11-06/07 | ALL users: names, usernames, **password hashes**, live auth tokens; some **plaintext passwords**; forced resets; KYT services suspended | thehackernews 11-09, tokenpost 11-07 |
| **Chainstack** | 2026-11-03 | Customer account data + **password hashes**; node credentials; explicit **password-reuse warning** to customers | thehackernews 11-09 |

Both attributed to an **AI-agent attack campaign** (cross-link `ai-agents-can-hack-other-ai-agents`).
This is the pre-approved response-kit play from the 2026-11-09 pass: one page, real facts
only, what happened → what to do in order → what not to do, linking `/breach-check` and
`/articles/after-a-data-breach`. Window: news queries live now (SERP = news only, no
advisory/what-to-do page ranking). Autocomplete lags (only `chainalysis breach` so far).

## Probe results + SERP verdicts

| Cluster | Autocomplete evidence | SERP | Verdict |
| --- | --- | --- | --- |
| **hashcat "no hashes loaded" family** | `no hash mode matches`, `salt-value exception no hashes loaded`, `says no hashes loaded`, `salt value exception hashcat` | hashcat.net forum threads 2017–2020 only | **WIN/high — combined page** (cross-link existing token-length + John pages) |
| **burp CA certificate install** | 10 variants: `download`, `android`, `ios`, `ca`, `android download`, `download link` | GitHub gists (2015) + repos + Corellium docs — no maintained article | **WIN/high** (config guide; lower filter risk than interception) |
| **keepassxc database errors** | `database file read error`, `database corrupt`, `database not connected` | Reddit 2021/2025 + GitHub discussions only | **WIN/high** (sister to keepassxc-not-opening) |
| **gobuster connection refused** | `gobuster connection refused`, `error on running gobuster connection refused` | labex tutorial + GitHub issue + unrelated SO | **WIN/medium** |
| **meterpreter session died** | `session is not valid and will be closed`, `closed reason died`, `died`, `closed` | CSDN (Chinese) 2021/22 + SE 2016 — no English article | **WIN but flagged**: post-exploitation content = connector-filter risk; write locally first, INSERT may block (burp-not-intercepting protocol) |
| nmap no route to host | single string, no expansion | — | P2 (fold into future nmap-errors page) |
| msfconsole cluster | `commands`, `install`, `termux`, `database not connected` (covered) | — | P2 info pages |
| password manager black friday | `deals`, `keeper black friday` | affiliate-dominated head term | **DROP** (head-term rule; no deals data = thin) |
| hydra login failed | empty | — | DROP (confirmed dead, consistent with Hyderabad pollution) |
| best password manager 2027 | empty | — | revisit mid-December |

## Ranked queue

| # | Page | Shape | Urgency |
| --- | --- | --- | --- |
| 0 | **Chainalysis & Chainstack breach — what to do** | Response-kit page (facts + ordered playbook + reuse warnings) | **NOW — news window open; shipping in this pass** |
| 1 | hashcat-no-hashes-loaded (combined: no hash mode matches + salt-value exception + says no hashes loaded) | error-string playbook, links token-length + John pages | next batch |
| 2 | burp-suite-ca-certificate (download & install: Android, iOS, browsers) | install guide, exact-string title | next batch |
| 3 | keepassxc-database-corrupt (file read error + corrupt + won't open) | ordered causes, sister to not-opening | next batch |
| 4 | gobuster-connection-refused | error-string playbook | next batch |
| 5 | meterpreter-session-died | error playbook, **filter-risk protocol** | after #1–4 |
| 6 | nmap-no-route-to-host / msfconsole info | fold / P2 | later |

Standing items unchanged: India salary page (user's scope call), stop-rule read 2026-11-23,
backlink/Request-Indexing kit running (`crawl-demand-kit-2026-11-10.md`).

## Measurement additions

| Signal | Read on |
| --- | --- |
| Breach page: impressions on `chainalysis breach` / `chainstack breach` queries | 3–7 days (news decay) |
| New error pages: per-page impressions ≥10 | 14 days post-index |
| 47-URL crawl progress (drilldown diff) | 11-17 / 11-24 exports |

---

# Batch 5b result (2026-11-10)

| # | Page | State |
| --- | --- | --- |
| 1 | `hashcat-no-hashes-loaded` (5 causes; covers "no hash mode matches" + "salt-value exception" + "says no hashes loaded") | ✅ INSERTed + published |
| 2 | `burp-suite-certificate-download` (download + install: Android, iOS, Firefox, desktop) | ✅ INSERTed + published |
| 3 | `keepassxc-database-corrupt` (6 causes; file read error / corrupt / not connected) | ✅ INSERTed + published |
| 4 | `gobuster-connection-refused` (6 causes; refused-vs-timeout tell) | ⛔ **connector security filter blocked the INSERT** — content NOT resent, NOT altered. Draft preserved: `.drafts/articles/gobuster-connection-refused.html`. User's call: dashboard paste or editorial rework. |

Sibling cross-links added (crawl-demand weave): `john-the-ripper-no-password-hashes-loaded` →
hashcat page, `keepassxc-not-opening` → database-corrupt page, `hashcat-token-length-exception`
→ parent "No hashes loaded" page.

**Connector lesson:** `$c$` dollar-quoting works for INSERT content but an UPDATE using a
`$c$` literal silently matches 0 rows. For UPDATEs use plain single-quoted strings (escape
double quotes as `&quot;`), and always `RETURNING` to confirm the write landed.
