import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
const SITE = (process.env.SITE_ORIGIN || 'https://oopsmypassword.web.app').replace(/\/+$/, '');
const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, 'articles');

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
  const content = sanitizeHtml(article.content || '');
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

function sitemapXml({ articles, products }) {
  const staticUrls = ['', 'articles', 'products', 'about', 'privacy', 'terms', 'contact', 'faq', 'security', 'glossary'];
  const urls = new Map();
  for (const path of staticUrls) urls.set(`${SITE}/${path}`.replace(/\/$/, '') || `${SITE}/`, '2026-09-11');
  for (const article of articles) {
    const modified = article.updated_at || article.published_at || article.created_at;
    urls.set(`${SITE}/articles/${encodeURIComponent(article.slug)}`, modified ? new Date(modified).toISOString().slice(0, 10) : '2026-09-11');
  }
  for (const product of products) {
    const modified = product.updated_at || product.published_at || product.created_at;
    urls.set(`${SITE}/products/${encodeURIComponent(product.slug)}`, modified ? new Date(modified).toISOString().slice(0, 10) : '2026-09-11');
  }
  const body = [...urls.entries()].map(([loc, lastmod]) => `<url><loc>${esc(loc)}</loc><lastmod>${lastmod}</lastmod></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`;
}

async function main() {
  const [articles, products] = await Promise.all([
    fetchRows('articles', 'slug,title,summary,content,status,published_at,updated_at,created_at,featured_image'),
    fetchRows('products', 'slug,name,status,published_at,updated_at,created_at'),
  ]);

  await rm(ARTICLES_DIR, { recursive: true, force: true });
  await mkdir(ARTICLES_DIR, { recursive: true });
  for (const article of articles) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(article.slug || ''))) continue;
    await writeFile(join(ARTICLES_DIR, `${article.slug}.html`), articleHtml(article), 'utf8');
  }
  await writeFile(join(ROOT, 'sitemap.xml'), sitemapXml({ articles, products }), 'utf8');
  console.log(`Built ${articles.length} published article pages and sitemap with ${products.length} published products.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
