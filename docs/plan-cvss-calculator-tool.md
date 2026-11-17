# Plan: CVSS Calculator tool (/cvss-calculator) — FEATURE PROPOSAL, PENDING APPROVAL

Status: research + plan only. NO CODE until explicit approval (approval-gate rule 2026-11-16).

## Evidence
- "cvss" query: 15 imp @ pos 91 (11-17 export). Calculator-intent dominates the CVSS SERP
  (cve.tools/cvss ranks with an interactive calculator; FIRST/NVD link to calculators).
- Our /articles/cvss-score-explained (batch-12) captures the explainer intent; the calculator
  intent ("cvss calculator", "cvss score calculator online", "cvss v3.1 calculator") is a
  separate, larger query family we currently cannot serve at all.
- Tool pages on this site already rank fine (hash-inspector, dork-builder in impressions).

## What it is (tool anatomy = locked pattern: hero -> tool surface -> disclosure band -> per-query FAQ -> related tools row)
/cvss-calculator — standalone tool page (hand-maintained like hash-inspector/url-scanner):
1. **Vector input** — paste a CVSS:3.1 vector string OR click metrics (AV/AC/PR/UI/S/C/I/A).
2. **Live base score** — exact v3.1 published formula (Exploitability = 8.22 x AV x AC x PR x UI;
   Impact per Scope; Roundup rules). Pure client-side JS, zero APIs, zero cost.
3. **Temporal + Environmental** — E/RL/RC + CR/IR/AR/modified metrics (formula handles them).
4. **Severity band output** + plain-English metric breakdown + shareable vector.
5. **Honest scope note** (reality rule): v4.0 uses macrovector lookup, NOT a formula — v4.0 gets
   vector DECODING + severity bands only, with a clear "use the FIRST reference implementation
   for v4.0 scores" note. We do NOT fake a v4.0 score.
6. **FAQ block** (from the article's proven queries) + related-tools row (hash-inspector,
   nuclei guide, cvss-score-explained article).

## Scope / effort
- 1 new page (HTML+JS, ~1 tool surface), sitemap-core entries x2 (single-quoted!), TOOLS entry in
  layout.py + ICONS check (grep first — no "spark"), fixtures in test_mobile_ux (TOOLS 14->15,
  words map), test_tools_live entry, rss/llms auto. ~1 batch-sized PR (feature batch).
- Tests: qa + mobile_ux + navigation + tools_live + comparisons wired.
- Zero budget: pure JS, no services. "Sab real ho": formula straight from the v3.1 spec;
  worked example in the docs must match our article's 9.8 calculation.

## Not doing (honest)
- v4.0 score computation (needs the 270-macrovector dataset — only ship if we can vendor the
  official FIRST reference implementation properly; revisit later).
- CVE database lookups (would need an API/dataset — out of zero-budget scope).

## Awaiting approval
Approve -> ship as batch-14 (one PR). Reject/adjust -> revise plan.
