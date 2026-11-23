# Batch 38 — The Passkey Wave (news-jack + setup guide + freshness update)

**Date:** 2026-11-23 · **PR:** batch-38 · **Type:** Content (timed news-jack, premium DDG position plays)

## Why
Microsoft's **official** Entra SMS/voice retirement (verified on learn.microsoft.com) starts biting **February 1, 2027** → the query wave (confused recipients of Microsoft's notice + "how to set up passkeys") runs NOW through Feb. Passkeys = the last 2 non-content-vertice (**ai-agents-can-hack** + **how-to-spot-fake-passkey-setup-scams** + **fido2-vs-passkeys** all already at page 1-2!). Microsoft did our content marketing for us.

## Shipped (Supabase articles)
1. **microsoft-sms-2fa-retirement-what-to-do** (`47cd478b-2e95-49cd-ae98-4e5d764738cd`, News b797c69d)
   - Verified timeline: Sept 1 2026 (passkeys default + nudge) → **Feb 1 2027** (MS-provided SMS/voice retired, blocking passkey registration for SMS-only users, no opt-out) → Jul 1 2027 (Global Admins + external)
   - Verified nuances: work/school (Entra) accounts only; customer-managed telephony via MS Security Store (Oct 30 2026); **SSPR included + passkeys NOT an SSPR method** (the admin trap); TOTP survives (not phishing-resistant); Graph opt-out `passkeyDynamicMigration`; AI-era rationale
   - meta: "Microsoft SMS 2FA Retirement: Deadlines & What to Do"
2. **how-to-set-up-passkeys** (`e504160f-197e-4e01-9fb2-c2c12eb45ba4`, How-To f13dd7e4)
   - Recovery-first framing (USENIX 2026 audit gap: 66% enroll w/o confirmation), iPhone Passwords app / Google PM / Windows Hello + Bitwarden Nov 2026 OS provider / 1Password / Dashlane, migration order (email first), TOTP fallback, scam warnings
   - meta: "How to Set Up Passkeys: Complete Guide (2026)"
3. **is-sms-2fa-safe freshness UPDATE** — appended "Update: Microsoft is retiring SMS two-factor authentication" section + set meta_title/meta_description (was NULL)

## Cluster interlinks (all DB-verified slugs)
new ↔ new ↔ is-sms-2fa-safe ↔ fido2-vs-passkeys ↔ how-to-spot-fake-passkey-setup-scams ↔ how-totp-works. External links (verified): learn.microsoft.com concept page (full content fetched via search), 1Password press page, helpnetsecurity. External→new tab, internal→same tab.

## Facts verified pre-ship
learn.microsoft.com `concept-sms-voice-retirement` + FAQ + Q&A (retirement dates, SSPR scope, telephony store, opt-out, AI rationale); 1Password for Agents press (Oct 22 2026); Bitwarden Nov 19 2026 (helpnetsecurity); FIDO ~7B passkeys + 93% vs 78% success (attributed to FIDO Alliance 2026 reporting, no URL claim); USENIX 2026 audit via shattered.io summary (66%/208 sites/0 of 103 — attributed as academic audit).

## Links to /articles/... — anchorless (latest-content part fails build otherwise)
