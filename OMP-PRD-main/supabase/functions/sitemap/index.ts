/* OopsMyPassword — canonical dynamic sitemap.
 *
 * Public XML endpoint used by the Firebase Hosting sitemap bridge.
 * The sitemap itself must not send a noindex directive; it is a crawl
 * discovery resource, not an indexable HTML document.
 */

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

const ALLOWED_ORIGINS = (Deno.env.get('SITEMAP_ALLOWED_ORIGINS') ??
  'https://oopsmypassword.web.app,https://password-e9a30.web.app,http://localhost:5000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const CACHE_SECONDS = 300;
const ROW_LIMIT = 2000;
const ARTICLE_FIELDS = 'slug,status,published_at,updated_at,created_at';
const PRODUCT_FIELDS = 'slug,name,status,published_at,updated_at,created_at';

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Vary': 'Origin' };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function xmlHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return Object.assign(
    {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=86400`,
      'X-Content-Type-Options': 'nosniff'
    },
    extra
  );
}

function json(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign(corsHeaders(origin), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=86400`,
      'X-Content-Type-Options': 'nosniff'
    })
  });
}

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

async function loadContent(): Promise<{
  articles: Record<string, unknown>[];
  products: Record<string, unknown>[];
  degraded: boolean;
}> {
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
      headers: Object.assign(xmlHeaders(corsHeaders(origin)), {
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
      headers: xmlHeaders(
        Object.assign(corsHeaders(origin), {
          'Cache-Control': degraded
            ? 'public, max-age=60, stale-while-revalidate=600'
            : `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=86400`,
          'X-Sitemap-State': degraded ? 'degraded' : 'complete'
        })
      )
    });
  } catch (error) {
    console.error('sitemap: unhandled error', error);

    const xml = buildSitemapXml({
      site: SITE,
      staticLastmod: STATIC_LASTMOD_VALUE
    });

    return new Response(req.method === 'HEAD' ? null : xml, {
      status: 200,
      headers: xmlHeaders(
        Object.assign(corsHeaders(origin), {
          'Cache-Control': 'public, max-age=60',
          'X-Sitemap-State': 'fallback'
        })
      )
    });
  }
});