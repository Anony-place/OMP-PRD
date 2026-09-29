# Optional Firebase handlers

Hosting currently deploys static artifacts, not these handlers. No Hosting rewrite
was added by the audit. If deployed separately, the existing first-generation
`sitemap` and `article` exports are retained with explicit `firebase-functions/v1`.

Firebase Admin 14.5.0 / Functions 7.4.0 and sanitize-html 2.17.7 are pinned in the
lockfile. The scoped `gaxios -> uuid 11.1.1` override fixes GHSA-w5hq-g745-h8pq:
the remaining Gaxios 6 dependency calls only the compatible `v4()` API. The real
multipart boundary path is covered by `tools/test_functions.cjs`. Review/remove
this override when upstream no longer depends on uuid <11.1.1. The unused
firebase-functions-test dev dependency was removed; handler behavior is now tested
through real local HTTP with the pinned Firebase SDK and mocked external services.

From the site root:

```sh
npm ci --prefix functions --ignore-scripts
npm audit --prefix functions --omit=dev
node tools/test_functions.cjs
```

The 2026-09-29 re-audit found 13 production dependency advisories before the update
(1 critical, 5 high, 7 moderate); the updated lockfile audit reports zero. This
is a dependency database result, not a claim of zero possible vulnerabilities or
proof that a previously deployed Cloud Function has been updated.
