const functions = require('firebase-functions');
const { createClient } = require('@supabase/supabase-js');

// Configuration - use environment variables for security
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';

// Create Supabase client with publishable key (safe for server-side)
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// XML escaping utility
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

// Format date as ISO 8601 for sitemap
function formatLastmod(dateString) {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    // Format as YYYY-MM-DD for sitemap compatibility
    return date.toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
}

// Static routes that should always be in sitemap
const STATIC_ROUTES = [
  '/',
  '/checker/',
  '/generator/',
  '/tools/',
  '/articles/',
  '/products/',
  '/breach-check/',
  '/about/',
  '/privacy/',
  '/terms/',
  '/contact/',
  '/faq/',
  '/glossary/',
  '/security/',
  '/password-health/',
  '/entropy/',
  '/passphrase/',
  '/random-string/',
  '/security-checklist/'
];

// Generate sitemap XML
function generateSitemap(articles, products) {
  const urls = [];

  // Add static routes
  STATIC_ROUTES.forEach(route => {
    const cleanRoute = route.replace(/\/$/, ''); // Remove trailing slash for consistency
    urls.push({
      loc: `https://oopsmypassword.com${cleanRoute}`,
      lastmod: '2026-09-05',
      changefreq: 'weekly',
      priority: cleanRoute === '/' ? '1.0' : (cleanRoute.includes('/articles') || cleanRoute.includes('/products') ? '0.9' : '0.8')
    });
  });

  // Add published articles
  if (articles && articles.length > 0) {
    articles.forEach(article => {
      if (article.status === 'published' && article.slug) {
        const slug = escapeXml(article.slug);
        const url = `https://oopsmypassword.com/articles/${slug}`;
        
        // Use the most appropriate timestamp: published_at → updated_at → created_at
        let lastmod = formatLastmod(article.published_at);
        if (!lastmod) lastmod = formatLastmod(article.updated_at);
        if (!lastmod) lastmod = formatLastmod(article.created_at);
        if (!lastmod) lastmod = '2026-09-05';
        
        urls.push({
          loc: url,
          lastmod: lastmod,
          changefreq: 'monthly',
          priority: '0.7'
        });
      }
    });
  }

  // Add published products
  if (products && products.length > 0) {
    products.forEach(product => {
      if (product.status === 'published' && product.slug) {
        const slug = escapeXml(product.slug);
        const url = `https://oopsmypassword.com/products/${slug}`;
        
        // Use the most appropriate timestamp
        let lastmod = formatLastmod(product.published_at);
        if (!lastmod) lastmod = formatLastmod(product.updated_at);
        if (!lastmod) lastmod = formatLastmod(product.created_at);
        if (!lastmod) lastmod = '2026-09-05';
        
        urls.push({
          loc: url,
          lastmod: lastmod,
          changefreq: 'monthly',
          priority: '0.7'
        });
      }
    });
  }

  // Deduplicate URLs by loc
  const uniqueUrls = [];
  const seen = new Set();
  urls.forEach(urlObj => {
    if (!seen.has(urlObj.loc)) {
      seen.add(urlObj.loc);
      uniqueUrls.push(urlObj);
    }
  });

  // Generate XML
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

// Fallback sitemap with only static routes (in case Supabase fails)
function generateFallbackSitemap() {
  const urls = STATIC_ROUTES.map(route => {
    const cleanRoute = route.replace(/\/$/, '');
    return {
      loc: `https://oopsmypassword.com${cleanRoute}`,
      lastmod: '2026-09-05',
      changefreq: 'weekly',
      priority: cleanRoute === '/' ? '1.0' : (cleanRoute.includes('/articles') || cleanRoute.includes('/products') ? '0.9' : '0.8')
    };
  });

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  urls.forEach(urlObj => {
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

// Main sitemap function
exports.sitemap = functions.https.onRequest(async (req, res) => {
  // Set proper headers
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache for dynamic content
  res.set('X-Content-Type-Options', 'nosniff');
  
  try {
    // Fetch published articles and products concurrently
    const [articlesResult, productsResult] = await Promise.all([
      supabase
        .from('articles')
        .select('slug, status, published_at, updated_at, created_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false }),
      supabase
        .from('products')
        .select('slug, status, published_at, updated_at, created_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
    ]);

    const articles = articlesResult.data || [];
    const products = productsResult.data || [];
    
    // Log any errors for debugging (but don't expose to client)
    if (articlesResult.error) {
      console.error('Supabase articles error:', articlesResult.error.message);
    }
    if (productsResult.error) {
      console.error('Supabase products error:', productsResult.error.message);
    }
    
    // Generate and send sitemap
    const sitemapXml = generateSitemap(articles, products);
    return res.status(200).send(sitemapXml);
    
  } catch (error) {
    // Log error for debugging
    console.error('Sitemap generation error:', error.message);
    
    // Return fallback sitemap with static routes only
    const fallbackXml = generateFallbackSitemap();
    return res.status(200).send(fallbackXml);
  }
});