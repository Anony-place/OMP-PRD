/* ============================================================
   OopsMyPassword — dynamic sitemap core.

   Runtime-agnostic ES module (no Deno.* and no Node.* APIs, no imports)
   so the exact same code can be:

     * imported by the Supabase Edge Function
       (supabase/functions/sitemap/index.ts) — the canonical, always
       up-to-date /sitemap.xml, and
     * imported by `tools/test_sitemap.js` under Node, so the XML
       escaping, slug filter, dedupe and draft-exclusion rules are
       covered by tests instead of being verified by eye in production.

   Deliberately plain `.mjs`: Supabase bundles it with esbuild and Node
   loads it as ESM without needing a package.json.
   ============================================================ */

/* Canonical production origin. Must be a live, resolving origin: every <loc>
   in the sitemap is built from it, and a sitemap URL that points at a dead
   domain is dropped by crawlers as off-site. Callers override via SITE_ORIGIN. */
export const DEFAULT_SITE = 'https://oopsmypassword.web.app';

/* No lastmod for the static routes. There is no per-page modification date
   to report: these pages are regenerated from tools/omp_build on every build.
   A hardcoded stamp is an invented date, "today" on every deploy makes the
   whole sitemap look like it changed daily (which teaches crawlers to ignore
   the signal), and git commit dates are no better because an infrastructure
   change touches every generator at once. <lastmod> is optional, so it is
   omitted rather than guessed. Articles and products carry real database
   timestamps and still report one. */
export const STATIC_LASTMOD = '';

/* Pretty public URLs, no trailing slash (matches trailingSlash:false in
   firebase.json). The fifteen baked-in guides are rewritten by Firebase
   onto /articles/<slug>, so they belong in here too. */
export const STATIC_ROUTES = [
  '/',
  '/checker',
  '/generator',
  '/tools',
  '/articles',
  '/products',
  '/learning',
  '/breach-check',
  '/about',
  '/privacy',
  '/terms',
  '/contact',
  '/faq',
  '/glossary',
  '/security',
  '/sitemap',
  '/password-health',
  '/entropy',
  '/passphrase',
  '/random-string',
  '/security-checklist',
  '/articles/create-strong-password',
  '/articles/password-best-practices',
  '/articles/common-password-mistakes',
  '/articles/how-long-should-a-password-be',
  '/articles/password-vs-passphrase',
  '/articles/password-manager-benefits',
  '/articles/are-password-managers-safe',
  '/articles/two-factor-authentication',
  '/articles/passkeys-explained',
  '/articles/password-vs-passkey',
  '/articles/after-a-data-breach',
  '/articles/check-if-password-was-leaked',
  '/articles/phishing-attacks',
  '/articles/password-entropy',
  '/articles/password-cracking-time-table'
];

/* Only the slugs the admin panel's slugify() can produce. Anything else
   can never address real content, so it is dropped before it is ever
   used to build a URL — the sitemap is built from database rows and a
   bad row must not be able to inject a path (or an XML payload). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* Hard caps so one bad table can never produce an unbounded response. */
export const MAX_SLUG_LENGTH = 200;
export const MAX_URLS = 50000;

/** Escape for XML text and attribute content. */
export function escapeXml(value) {
  return String(value == null ? '' : value).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';