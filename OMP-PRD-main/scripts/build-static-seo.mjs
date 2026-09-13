import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
/* Single source of truth for the sitemap route list. Importing the shared
   core means the deployed sitemap can never drift from the route set the
   rest of the site (tools/build.py, the Edge Function) advertises. */
import { STATIC_ROUTES, isValidSlug, priorityForRoute } from '../functions/sitemap-core.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
const SITE = (process.env.SITE_ORIGIN || 'https://oopsmypassword.web.app').replace(/\/+$/, '');
const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, 'articles');
const PRODUCTS_DIR = join(ROOT, 'products');
const STATIC_LASTMOD = '2026-09-11';
const PRODUCT_FIELDS = 'slug,name,summary,description,product_type,price,currency,cta_label,featured,featured_image,external_url,status,published_at,updated_at,created_at';
const PRODUCT_TYPES = { book: 'Book', course: 'Course', tool: 'Tool', template: 'Template', resource: 'Resource', other: 'Resource' };

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escJson(value) {
  return JSON.stringify(value ?? '').replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

function markdownInline(input) {
  let x = esc(input);
  x = x.replace(/`([^`]+)`/g, '<code>$1</code>');
  x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  x = x.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  x = x.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  x = x.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  return x;
}

function markdownToHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = [];
  let paragraph = [];
  let list = null;
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${markdownInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map((item) => `<li>${markdownInline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      flushParagraph();
      flushList();
      if (!inCode) {
        out.push('<pre><code>');
        inCode = true;
      } else {
        out.push('</code></pre>');
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      out.push(esc(line) + '\n');
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${markdownInline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    paragraph.push(line.trim());
  }
  if (inCode) out.push('</code></pre>');
  flushParagraph();
  flushList();
  return out.join('\n');
}

function sanitizeHtml(input) {
  const source = String(input || '');
  if (!/<[a-z][\s\S]*>/i.test(source)) return markdownToHtml(source);
  return source
    .replace(/<\/?(?:script|iframe|object|embed|form|style|link|meta|base)[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

/* Admin-authored article bodies are injected straight into the generated page,
   so anything they carry becomes part of our markup. Two attributes/elements
   can break the page rather than just look odd:

   - `id`: a repeated id produces duplicate anchors and collides with the
     in-page links every other page relies on.
   - headings: the page template already owns the single h1, so any heading in
     the body has to sit underneath it.

   Strip ids, then shift every body heading so the shallowest one used becomes
   an h2. A flat shift by one is not enough: these articles open with "##", so
   a +1 shift lands them on h3 and leaves the page jumping h1 -> h3. Anchoring
   on the content's own minimum keeps the article's relative outline intact and
   always starts it directly under the page title. */
function normalizeInjected(html) {
  const source = String(html || '').replace(/\sid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  const levels = [...source.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  const shift = levels.length ? Math.max(2 - Math.min(...levels), 0) : 0;
  if (!shift) return source;
  return source.replace(/<(\/?)h([1-6])(\s|>)/gi, (m, slash, level, tail) => {
    const shifted = Math.min(Number(level) + shift, 6);
    return `<${slash}h${shifted}${tail}`;
  });
}

async function fetchRows(table, fields) {
  const params = new URLSearchParams({ select: fields, status: 'eq.published', limit: '2000' });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`${table} query failed: HTTP ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function articleHtml(article) {
  const title = String(article.title || 'Article').trim();
  const slug = String(article.slug || '').trim();
  const summary = String(article.summary || '').trim() || String(article.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const canonical = `${SITE}/articles/${encodeURIComponent(slug)}`;
  const published = article.published_at || article.created_at || new Date().toISOString();
  const modified = article.updated_at || published;
  const content = normalizeInjected(sanitizeHtml(article.content || ''));
  const image = article.featured_image ? String(article.featured_image) : '';
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: summary,
    mainEntityOfPage: canonical,
    datePublished: published,
    dateModified: modified,
    author: { '@type': 'Organization', name: 'OopsMyPassword' },
    publisher: { '@type': 'Organization', name: 'OopsMyPassword', url: SITE },
  };
  if (image) articleSchema.image = [image];
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: `${SITE}/articles` },
      { '@type': 'ListItem', position: 3, name: title, item: canonical },
    ],
  };
  const ogImage = image ? `<meta property="og:image" content="${esc(image)}">` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | OopsMyPassword</title>
<meta name="description" content="${esc(summary)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(summary)}">
<meta property="og:url" content="${esc(canonical)}">
${ogImage}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(summary)}">
<script type="application/ld+json">${escJson(articleSchema)}</script>
<script type="application/ld+json">${escJson(breadcrumbSchema)}</script>
<link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
<main class="container">
<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/articles">Articles</a> / <span>${esc(title)}</span></nav>
<article>
<header><h1>${esc(title)}</h1><p>${esc(summary)}</p><p><time datetime="${esc(published)}">${esc(new Date(published).toISOString().slice(0, 10))}</time></p></header>
<div class="article-content">${content}</div>
</article>
</main>
</body>
</html>
`;
}

/* Server-rendered product detail page.

   Without this, every /products/<slug> request fell through the
   "/products{,/**}" rewrite to products.html, whose hard-coded canonical is
   /products — so the first HTML response for a product page canonicalised to
   the hub, and the correct canonical only appeared after products.js ran.
   Real files now win over the rewrite (Hosting only rewrites when no file
   matches), giving crawlers a self-canonical page with Product JSON-LD in the
   initial response. products.js still hydrates the same URL. */
function productHtml(product) {
  const slug = String(product.slug || '').trim();
  const name = String(product.name || 'Product').trim();
  const summary = String(product.summary || '').trim()
    || String(product.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const canonical = `${SITE}/products/${encodeURIComponent(slug)}`;
  const content = normalizeInjected(sanitizeHtml(product.description || ''));
  const image = /^https?:\/\//i.test(String(product.featured_image || '')) ? String(product.featured_image) : '';
  const typeLabel = PRODUCT_TYPES[String(product.product_type || 'other')] || 'Resource';
  const published = product.published_at || product.created_at || new Date().toISOString();
  const modified = product.updated_at || published;

  /* Offers only when there is a real, numeric price — inventing one would be
     fabricated structured data. */
  const price = Number(product.price);
  const hasPrice = product.price != null && product.price !== '' && Number.isFinite(price);
  const currency = /^[A-Z]{3}$/.test(String(product.currency || '')) ? String(product.currency) : 'USD';
  const buyUrl = /^https?:\/\//i.test(String(product.external_url || '')) ? String(product.external_url) : '';

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: summary,
    url: canonical,
  };
  if (image) productSchema.image = [image];
  if (hasPrice) {
    productSchema.offers = {
      '@type': 'Offer',
      price: String(price),
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
      url: buyUrl || canonical,
    };
  }
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${SITE}/products` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  const ogImage = image ? `<meta property="og:image" content="${esc(image)}">` : '';
  const cta = String(product.cta_label || '').trim() || (buyUrl ? 'Buy now' : 'Learn more');
  const ctaHtml = buyUrl
    ? `<p><a class="btn btn-primary" href="${esc(buyUrl)}" rel="noopener noreferrer">${esc(cta)} →</a></p>`
    : '<p class="muted">Secure download delivered after purchase.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} — OopsMyPassword</title>
<meta name="description" content="${esc(summary)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="OopsMyPassword">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(summary)}">
<meta property="og:url" content="${esc(canonical)}">
${ogImage}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(name)}">
<meta name="twitter:description" content="${esc(summary)}">
<script type="application/ld+json">${escJson(productSchema)}</script>
<script type="application/ld+json">${escJson(breadcrumb)}</script>
<link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
<main class="container">
<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/products">Products</a> / <span>${esc(name)}</span></nav>
<article>
<header>
<p class="product-meta"><span class="ptype">${esc(typeLabel)}</span></p>
<h1>${esc(name)}</h1>
<p class="lead">${esc(summary)}</p>
<p><time datetime="${esc(published)}">${esc(new Date(published).toISOString().slice(0, 10))}</time></p>
</header>
${ctaHtml}
<div class="product-content prose">${content}</div>
</article>
</main>
</body>
</html>
`;
}

function sitemapXml({ articles, products }) {
  const urls = new Map();
  /* The site root must keep its trailing slash: index.html canonicalises to
     "<origin>/", so a <loc> of "<origin>" would not match its own canonical.
     Every other route is trailing-slash free (trailingSlash: false). */
  const urlFor = (route) => (route === '/' ? `${SITE}/` : `${SITE}${route.replace(/\/+$/, '')}`);
  const add = (loc, lastmod, route) => {
    if (urls.has(loc)) return;
    urls.set(loc, { lastmod, priority: priorityForRoute(route || '/') });
  };

  /* Every real public page, not just a hand-picked subset. Omitting the tool
     pages here meant Google never learned /checker, /generator, /tools and
     /breach-check existed — the site's primary pages. */
  for (const route of STATIC_ROUTES) {
    add(urlFor(route), STATIC_LASTMOD, route);
  }

  for (const article of articles) {
    if (!isValidSlug(article.slug)) continue;
    const modified = article.updated_at || article.published_at || article.created_at;
    add(urlFor(`/articles/${encodeURIComponent(article.slug)}`), dateOnly(modified), `/articles/${article.slug}`);
  }
  for (const product of products) {
    if (!isValidSlug(product.slug)) continue;
    const modified = product.updated_at || product.published_at || product.created_at;
    add(urlFor(`/products/${encodeURIComponent(product.slug)}`), dateOnly(modified), `/products/${product.slug}`);
  }

  const body = [...urls.entries()]
    .map(([loc, { lastmod, priority }]) =>
      `<url><loc>${esc(loc)}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`;
}

function dateOnly(value) {
  if (!value) return STATIC_LASTMOD;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : STATIC_LASTMOD;
}

async function main() {
  const [articles, products] = await Promise.all([
    fetchRows('articles', 'slug,title,summary,content,status,published_at,updated_at,created_at,featured_image'),
    fetchRows('products', PRODUCT_FIELDS),
  ]);

  await rm(ARTICLES_DIR, { recursive: true, force: true });
  await mkdir(ARTICLES_DIR, { recursive: true });
  let articlePages = 0;
  for (const article of articles) {
    if (!isValidSlug(article.slug)) continue;
    await writeFile(join(ARTICLES_DIR, `${article.slug}.html`), articleHtml(article), 'utf8');
    articlePages++;
  }

  await rm(PRODUCTS_DIR, { recursive: true, force: true });
  await mkdir(PRODUCTS_DIR, { recursive: true });
  let productPages = 0;
  for (const product of products) {
    if (!isValidSlug(product.slug)) continue;
    await writeFile(join(PRODUCTS_DIR, `${product.slug}.html`), productHtml(product), 'utf8');
    productPages++;
  }

  const xml = sitemapXml({ articles, products });
  await writeFile(join(ROOT, 'sitemap.xml'), xml, 'utf8');
  /* Keep the legacy alias byte-identical so the two endpoints can never
     disagree — robots.txt advertises /sitemap.xml only. */
  await writeFile(join(ROOT, 'google-sitemap.xml'), xml, 'utf8');
  const urlCount = (xml.match(/<loc>/g) || []).length;
  console.log(`Built ${articlePages} article pages and ${productPages} product pages; sitemap has ${urlCount} URLs at ${SITE}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
