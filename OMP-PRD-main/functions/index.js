/* ============================================================
   OMP Firebase Cloud Functions.

   `sitemap` is a thin hosting bridge, NOT the sitemap's source of truth.
   `article` serves published Supabase articles as real HTML at
   /articles/<slug> so crawlers receive title, canonical, content and
   structured data in the initial response instead of relying on the SPA.
   ============================================================ */

const functions = require('firebase-functions');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
const SITE = (process.env.SITE_ORIGIN || 'https://oopsmypassword.com').replace(/\/+$/, '');
const STATIC_LASTMOD = process.env.STATIC_LASTMOD || '2026-08-23';
const EDGE_URL = process.env.SITEMAP_EDGE_URL || 'https://aeehfulikupskyrvcpzb.supabase.co/functions/v1/sitemap';
const EDGE_TIMEOUT_MS = 8000;
const ROW_LIMIT = 2000;
const ARTICLE_FIELDS = 'slug,status,published_at,updated_at,created_at';
const PRODUCT_FIELDS = 'slug,name,status,published_at,updated_at,created_at';

let corePromise = null;
function getCore() {
  if (!corePromise) corePromise = import('./sitemap-core.mjs');
  return corePromise;
}

function respond(res, xml, { cacheControl, state }) {
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', cacheControl);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Robots-Tag', 'noindex');
  res.set('X-Sitemap-State', state);
  return res.status(200).send(xml);
}

async function fromEdgeFunction() {
  if (!EDGE_URL) return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => { try { controller.abort(); } catch (e) {} }, EDGE_TIMEOUT_MS) : null;
  try {
    const res = await fetch(EDGE_URL, controller ? { signal: controller.signal, headers: { accept: 'application/xml' } } : undefined);
    if (!res || !res.ok) return null;
    const text = await res.text();
    if (!text || text.indexOf('<urlset') === -1) return null;
    return text;
  } catch (error) {
    console.error('sitemap: edge function unreachable:', error && error.message);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function rowsFromRest(table, fields) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(fields)}&status=eq.published&limit=${ROW_LIMIT}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`${table} query failed: HTTP ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

exports.sitemap = functions.runWith({ timeoutSeconds: 30, memory: '256MB' }).https.onRequest(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.set('Allow', 'GET, HEAD'); return res.status(405).send(''); }
  const xml = await fromEdgeFunction();
  if (xml) return respond(res, xml, { cacheControl: 'public, max-age=300, stale-while-revalidate=86400', state: 'edge' });
  try {
    const core = await getCore();
    const [articles, products] = await Promise.all([rowsFromRest('articles', ARTICLE_FIELDS), rowsFromRest('products', PRODUCT_FIELDS)]);
    return respond(res, core.buildSitemapXml({ articles, products, site: SITE, staticLastmod: STATIC_LASTMOD }), { cacheControl: 'public, max-age=300, stale-while-revalidate=3600', state: 'rest-fallback' });
  } catch (error) {
    console.error('sitemap: REST fallback failed:', error && error.message);
  }
  try {
    const core = await getCore();
    return respond(res, core.buildSitemapXml({ site: SITE, staticLastmod: STATIC_LASTMOD }), { cacheControl: 'public, max-age=60', state: 'static-fallback' });
  } catch (error) {
    return res.status(503).send('');
  }
});

/* ---------------- server-rendered article SEO ---------------- */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escJson(value) {
  return JSON.stringify(value == null ? '' : value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/* The article editor stores trusted admin-authored HTML or Markdown. Strip
   executable/resource-bearing constructs before sending it as crawler HTML. */
function sanitizeArticleHtml(input) {
  let html = String(input || '');
  if (!/<[a-z][\s\S]*>/i.test(html)) return markdownToHtml(html);
  html = html.replace(/<\/?(?:script|iframe|object|embed|form|style|link|meta|base)[^>]*>/gi, '');
  html = html.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/javascript\s*:/gi, '');
  return html;
}

function markdownInline(s) {
  let x = escHtml(s);
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
  let para = [];
  let list = null;
  let code = false;
  function flushPara() { if (para.length) { out.push(`<p>${markdownInline(para.join(' '))}</p>`); para = []; } }
  function flushList() { if (!list) return; out.push(`<${list.type}>${list.items.map(x => `<li>${markdownInline(x)}</li>`).join('')}</${list.type}>`); list = null; }
  for (const line of lines) {
    if (/^```/.test(line)) { flushPara(); flushList(); if (!code) { out.push('<pre><code>'); code = true; } else { out.push('</code></pre>'); code = false; } continue; }
    if (code) { out.push(escHtml(line) + '\n'); continue; }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { flushPara(); flushList(); const n = h[1].length; out.push(`<h${n}>${markdownInline(h[2])}</h${n}>`); continue; }
    const li = line.match(/^\s*[-*]\s+(.+)$/);
    if (li) { flushPara(); if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; } list.items.push(li[1]); continue; }
    const oi = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (oi) { flushPara(); if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; } list.items.push(oi[1]); continue; }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    para.push(line.trim());
  }
  if (code) out.push('</code></pre>');
  flushPara(); flushList();
  return out.join('\n');
}

async function fetchPublishedArticle(slug) {
  const url = `${SUPABASE_URL}/rest/v1/articles?select=slug,title,summary,content,status,published_at,updated_at,created_at,featured_image&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`;
  const response = await fetch(url, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`article query failed: HTTP ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function articleDocument(article) {
  const title = String(article.title || 'Article').trim();
  const summary = String(article.summary || '').trim() || String(article.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const slug = String(article.slug || '').trim();
  const canonical = `${SITE}/articles/${encodeURIComponent(slug)}`;
  const content = sanitizeArticleHtml(article.content || '');
  const published = article.published_at || article.created_at || new Date().toISOString();
  const modified = article.updated_at || published;
  const image = article.featured_image ? String(article.featured_image) : '';
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title,
    description: summary, mainEntityOfPage: canonical, datePublished: published,
    dateModified: modified, author: { '@type': 'Organization', name: 'OopsMyPassword' },
    publisher: { '@type': 'Organization', name: 'OopsMyPassword', url: SITE }
  };
  if (image) articleSchema.image = [image];
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Articles', item: SITE + '/articles' },
    { '@type': 'ListItem', position: 3, name: title, item: canonical }
  ]};
  const ogImage = image ? `<meta property="og:image" content="${escHtml(image)}">` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)} | OopsMyPassword</title><meta name="description" content="${escHtml(summary)}"><link rel="canonical" href="${escHtml(canonical)}"><meta property="og:type" content="article"><meta property="og:title" content="${escHtml(title)}"><meta property="og:description" content="${escHtml(summary)}"><meta property="og:url" content="${escHtml(canonical)}">${ogImage}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escHtml(title)}"><meta name="twitter:description" content="${escHtml(summary)}"><script type="application/ld+json">${escJson(articleSchema)}</script><script type="application/ld+json">${escJson(breadcrumb)}</script><link rel="stylesheet" href="/assets/css/style.css"></head><body><main><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/articles">Articles</a> / <span>${escHtml(title)}</span></nav><article><h1>${escHtml(title)}</h1><p>${escHtml(summary)}</p><p><time datetime="${escHtml(published)}">${escHtml(new Date(published).toISOString().slice(0,10))}</time></p><div class="article-content">${content}</div></article></main></body></html>`;
}

function article404(slug) {
  const safe = escHtml(slug);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Article not found | OopsMyPassword</title><link rel="canonical" href="${escHtml(SITE + '/articles/' + safe)}"></head><body><main><h1>Article not found</h1><p>The requested article does not exist.</p><a href="/articles">Browse articles</a></main></body></html>`;
}

exports.article = functions.runWith({ timeoutSeconds: 30, memory: '256MB' }).https.onRequest(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.set('Allow', 'GET, HEAD'); return res.status(405).send(''); }
  const raw = String(req.path || req.url || '').split('?')[0].replace(/^\/+/, '');
  const slug = raw.replace(/^articles\//, '').replace(/\/$/, '').toLowerCase();
  if (!SLUG_RE.test(slug) || slug.length > 200) return res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(article404(slug));
  try {
    const article = await fetchPublishedArticle(slug);
    if (!article) return res.status(404).set('Content-Type', 'text/html; charset=utf-8').set('X-Robots-Tag', 'noindex').send(article404(slug));
    const html = articleDocument(article);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(req.method === 'HEAD' ? '' : html);
  } catch (error) {
    console.error('article render failed:', error && error.message);
    return res.status(503).set('Retry-After', '60').send('Service temporarily unavailable');
  }
});
