/* ============================================================
   OopsMyPassword — dynamic sitemap (Supabase Edge Function).

   Deploy:   supabase functions deploy sitemap --project-ref <ref>
   Served:   https://<ref>.supabase.co/functions/v1/sitemap

   Firebase Hosting rewrites /sitemap.xml to a thin Cloud Function that
   proxies this endpoint (see ../../../functions/index.js), because
   Hosting can only rewrite to a static file or to its own Functions —
   it cannot proxy an external URL directly. This Edge Function is the
   single source of truth for the sitemap content.

   Endpoints
     GET  /sitemap             → sitemap XML  (application/xml)
     GET  /sitemap?format=json → { static, articles, products } (CORS)
     HEAD /sitemap             → headers only
     OPTIONS                   → CORS preflight

   Security
     - Only the publishable (anon) key is used. Row Level Security is
       what keeps drafts invisible: the anon SELECT policy on articles /
       products exposes published rows only, so no filter in this file is
       the thing standing between a draft and the public internet.
     - Every value that reaches the XML goes through escapeXml() and a
       slug charset check — a hostile row cannot inject markup.
     - CORS is an explicit origin allowlist, not "*".
   ============================================================ */

import {
  DEFAULT_SITE,
  STATIC_LASTMOD,
  buildSitemapJson,
  buildSitemapXml
} from './sitemap-core.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  '';

const SITE = (Deno.env.get('SITE_ORIGIN') ?? DEFAULT_SITE).replace(/\/+$/, '');
const STATIC_LASTMOD_VALUE = Deno.env.get('STATIC_LASTMOD') ?? STATIC_LASTMOD;

/* Origins allowed to read the JSON view from the browser (the human
   /sitemap page). The XML view is fetched server-side by the Firebase
   proxy, which needs no CORS at all. */
const ALLOWED_ORIGINS = (Deno.env.get('SITEMAP_ALLOWED_ORIGINS') ??
  'https://oopsmypassword.web.app,https://password-e9a30.web.app,http://localhost:5000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const CACHE_SECONDS = 300;
const ROW_LIMIT = 2000;

/* Supabase row shapes we actually need — never SELECT *. */
const ARTICLE_FIELDS = 'slug,status,published_at,updated_at,created_at';
const PRODUCT_FIELDS = 'slug,name,status,published_at,updated_at,created_at';

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Vary': 'Origin'
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return Object.assign(
    {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=86400`,
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex'
    },
    extra
  );
}

function json(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign(
      corsHeaders(origin),
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=86400`,
        'X-Content-Type-Options': 'nosniff'
      }
    )
  });
}

/**
 * PostgREST query. A failure here is reported as `null` so the caller can
 * degrade to a static-only sitemap: a sitemap that is missing yesterday's
 * article is far better than a 500 (and far better than an empty file).
 */
async function fetchRows(table: string, fields: string): Promise<Record<string, unknown>[] | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('sitemap: SUPABASE_URL / SUPABASE_ANON_KEY not configured');
    return null;
  }
  const url =
    `${SUPABASE_URL}/rest/v1/${table}` +
    `?select=${encodeURIComponent(fields)}` +
    `&status=eq.published` +
    `&limit=${ROW_LIMIT}`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json'
      }
    });
    if (!res.ok) {
      console.error(`sitemap: ${table} query failed`, res.status, await res.text());
      return null;
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows : null;
  } catch (error) {
    console.error(`sitemap: ${table} request threw`, error);
    return null;
  }
}

async function loadContent(): Promise<{ articles: Record<string, unknown>[]; products: Record<string, unknown>[]; degraded: boolean }> {
  const [articles, products] = await Promise.all([
    fetchRows('articles', ARTICLE_FIELDS),
    fetchRows('products', PRODUCT_FIELDS)
  ]);
  return {
    articles: articles ?? [],
    products: products ?? [],
    degraded: articles === null || products === null
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: Object.assign(baseHeaders(corsHeaders(origin)), {
        'Allow': 'GET, HEAD, OPTIONS'
      })
    });
  }

  const wantsJson = new URL(req.url).searchParams.get('format') === 'json';

  try {
    const { articles, products, degraded } = await loadContent();
    const options = {
      articles,
      products,
      site: SITE,
      staticLastmod: STATIC_LASTMOD_VALUE,
      generatedAt: new Date().toISOString()
    };

    if (wantsJson) {
      return json(buildSitemapJson(options), 200, origin);
    }

    const xml = buildSitemapXml(options);
    return new Response(req.method === 'HEAD' ? null : xml, {
      status: 200,
      headers: baseHeaders(
        Object.assign(corsHeaders(origin), {
          /* A partial sitemap must not be cached for long: the next
             request may succeed and should win quickly. */
          'Cache-Control': degraded
            ? 'public, max-age=60, stale-while-revalidate=600'
            : `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=86400`,
          'X-Sitemap-State': degraded ? 'degraded' : 'complete'
        })
      )
    });
  } catch (error) {
    /* Last-resort fallback: still emit a valid sitemap of static routes
       rather than an error page. Crawlers tolerate a stale sitemap; they
       do not tolerate a 500. */
    console.error('sitemap: unhandled error', error);
    const xml = buildSitemapXml({ site: SITE, staticLastmod: STATIC_LASTMOD_VALUE });
    return new Response(req.method === 'HEAD' ? null : xml, {
      status: 200,
      headers: baseHeaders(
        Object.assign(corsHeaders(origin), {
          'Cache-Control': 'public, max-age=60',
          'X-Sitemap-State': 'fallback'
        })
      )
    });
  }
});
