import { ACADEMY_ROUTES } from './academy-routes.mjs';
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
  ...ACADEMY_ROUTES,
  '/',
  '/checker',
  '/generator',
  '/tools',
  '/articles',
  '/products',
  '/osint',
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
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/** Strip XML 1.0 characters that are illegal even once escaped. */
function stripIllegalXmlChars(value) {
  return String(value).replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,
    ''
  );
}

/** `2026-09-04T13:45:46.086+00:00` → `2026-09-04`; invalid → fallback. */
export function formatLastmod(value, fallback) {
  if (value == null || value === '') return fallback || '';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return fallback || '';
  try {
    return new Date(ms).toISOString().split('T')[0];
  } catch (e) {
    return fallback || '';
  }
}

export function isValidSlug(value) {
  const s = String(value == null ? '' : value).trim();
  return SLUG_RE.test(s) && s.length <= MAX_SLUG_LENGTH;
}

/** Only rows that are actually live on the site belong in a sitemap. */
export function isPublished(row) {
  return !!row && String(row.status || '').toLowerCase() === 'published';
}

/**
 * Build the `<url>` set: static routes first (stable order), then live
 * articles and products. Duplicates are dropped by loc — a static guide
 * and a DB row can legitimately share a slug, and a sitemap must never
 * list the same URL twice.
 */
export function buildUrls({ articles = [], products = [], osint = [], site = DEFAULT_SITE, staticLastmod = STATIC_LASTMOD } = {}) {
  const origin = String(site || DEFAULT_SITE).replace(/\/+$/, '');
  const urls = [];
  const seen = new Set();

  const push = (loc, lastmod, changefreq, priority) => {
    const clean = stripIllegalXmlChars(loc);
    if (seen.has(clean)) return;
    seen.add(clean);
    urls.push({ loc: clean, lastmod: formatLastmod(lastmod, staticLastmod), changefreq, priority });
  };

  for (const route of STATIC_ROUTES) {
    push(
      `${origin}${route}`,
      staticLastmod,
      route === '/' ? 'weekly' : 'monthly',
      priorityForRoute(route)
    );
  }

  for (const row of articles || []) {
    if (!isPublished(row) || !isValidSlug(row.slug)) continue;
    push(
      `${origin}/articles/${row.slug}`,
      row.published_at || row.updated_at || row.created_at,
      'monthly',
      '0.7'
    );
  }

  for (const row of products || []) {
    if (!isPublished(row) || !isValidSlug(row.slug)) continue;
    push(
      `${origin}/products/${row.slug}`,
      row.published_at || row.updated_at || row.created_at,
      'monthly',
      '0.7'
    );
  }

  for (const row of osint || []) {
    if (!isPublished(row) || !isValidSlug(row.slug)) continue;
    push(
      `${origin}/osint/${row.slug}`,
      row.published_at || row.updated_at || row.created_at,
      'monthly',
      '0.7'
    );
  }

  return urls.slice(0, MAX_URLS);
}

export function priorityForRoute(route) {
  if (route === '/') return '1.0';
  if (route === '/articles' || route === '/products' || route === '/osint') return '0.9';
  if (route === '/sitemap') return '0.5';
  if (route.startsWith('/articles/') || route.startsWith('/products/') || route.startsWith('/osint/')) return '0.7';
  return '0.8';
}

/** Serialize the URL set as a sitemap XML document. */
export function buildSitemapXml(options = {}) {
  const urls = buildUrls(options);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ];
  for (const u of urls) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(u.loc)}</loc>`);
    if (u.lastmod) lines.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
    lines.push(`    <changefreq>${escapeXml(u.changefreq)}</changefreq>`);
    lines.push(`    <priority>${escapeXml(u.priority)}</priority>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

/**
 * JSON view used by the HTML sitemap page (/sitemap) so the human-facing
 * index lists the same live articles/products as the XML.
 */
export function buildSitemapJson(options = {}) {
  const site = String(options.site || DEFAULT_SITE).replace(/\/+$/, '');
  const live = (rows, prefix) => {
    const seen = new Set();
    const out = [];
    for (const r of rows || []) {
      if (!isPublished(r) || !isValidSlug(r.slug)) continue;
      const title = String(r.title || r.name || '').trim();
      if (!title) continue;
      const url = `${site}${prefix}/${r.slug}`;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        title,
        url,
        updated: formatLastmod(r.published_at || r.updated_at || r.created_at, '')
      });
    }
    return out;
  };

  return {
    site,
    generatedAt: options.generatedAt || null,
    static: STATIC_ROUTES.map((route) => ({ url: `${site}${route}` })),
    articles: live(options.articles, '/articles'),
    products: live(options.products, '/products'),
    osint: live(options.osint, '/osint'),
    count: buildUrls(options).length
  };
}
