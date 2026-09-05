const functions = require('firebase-functions');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const SITE = 'https://oopsmypassword.com';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUERY_LIMIT = 2000;

function escapeXml(unsafe) {
  if (!unsafe || typeof unsafe !== 'string') return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function todayUtc() {
  return new Date().toISOString().split('T')[0];
}

function formatLastmod(dateString) {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
}

const STATIC_ROUTES = [
  '/',
  '/checker',
  '/generator',
  '/tools',
  '/articles',
  '/products',
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

function priorityFor(route) {
  if (route === '/') return '1.0';
  if (route === '/articles' || route === '/products') return '0.9';
  if (route.startsWith('/articles/') || route.startsWith('/products/')) return '0.7';
  if (route === '/sitemap') return '0.5';
  return '0.8';
}

function lastmodFor(row) {
  return formatLastmod(row && (row.published_at || row.updated_at || row.created_at)) || todayUtc();
}

function generateSitemap(articles, products) {
  const urls = [];
  const stamp = todayUtc();

  STATIC_ROUTES.forEach(route => {
    urls.push({
      loc: `${SITE}${route}`,
      lastmod: stamp,
      changefreq: route === '/' ? 'weekly' : 'monthly',
      priority: priorityFor(route)
    });
  });

  (articles || []).forEach(article => {
    if (article.status && article.status !== 'published') return;
    if (!article.slug || !SLUG_RE.test(String(article.slug))) return;
    const slug = escapeXml(String(article.slug));
    urls.push({
      loc: `${SITE}/articles/${slug}`,
      lastmod: lastmodFor(article),
      changefreq: 'monthly',
      priority: '0.7'
    });
  });

  (products || []).forEach(product => {
    if (product.status && product.status !== 'published') return;
    if (!product.slug || !SLUG_RE.test(String(product.slug))) return;
    const slug = escapeXml(String(product.slug));
    urls.push({
      loc: `${SITE}/products/${slug}`,
      lastmod: lastmodFor(product),
      changefreq: 'monthly',
      priority: '0.7'
    });
  });

  const uniqueUrls = [];
  const seen = new Set();
  urls.forEach(urlObj => {
    if (!seen.has(urlObj.loc)) {
      seen.add(urlObj.loc);
      uniqueUrls.push(urlObj);
    }
  });

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  uniqueUrls.forEach(urlObj => {
    xml += '  <url>\n';
    xml += `    <loc>${urlObj.loc}</loc>\n`;
    xml += `    <lastmod>${urlObj.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${urlObj.changefreq}</changefreq>\n`;
    xml += `    <priority>${urlObj.priority}</priority>\n`;
    xml += '  </url>\n';
  });
  xml += '</urlset>';
  return xml;
}

function generateFallbackSitemap() {
  return generateSitemap([], []);
}

exports.sitemap = functions.https.onRequest(async (req, res) => {
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300');
  res.set('X-Content-Type-Options', 'nosniff');

  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('');
  }

  try {
    const [articlesResult, productsResult] = await Promise.all([
      supabase
        .from('articles')
        .select('slug, status, published_at, updated_at, created_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(QUERY_LIMIT),
      supabase
        .from('products')
        .select('slug, status, published_at, updated_at, created_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(QUERY_LIMIT)
    ]);

    if (articlesResult.error) console.error('Supabase articles error:', articlesResult.error.message);
    if (productsResult.error) console.error('Supabase products error:', productsResult.error.message);

    const articles = articlesResult.error ? [] : (articlesResult.data || []);
    const products = productsResult.error ? [] : (productsResult.data || []);
    return res.status(200).send(generateSitemap(articles, products));
  } catch (error) {
    console.error('Sitemap generation error:', error.message);
    return res.status(200).send(generateFallbackSitemap());
  }
});
