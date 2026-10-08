import safeArticleHTML from '../functions/safe-article-html.cjs';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { STATIC_ROUTES, isValidSlug, priorityForRoute } from '../functions/sitemap-core.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
const SITE = (process.env.SITE_ORIGIN || 'https://oopsmypassword.web.app').replace(/\/+$/, '');
const ROOT = process.cwd();
const sharedFooter = await readFile(join(ROOT, 'tools/site-footer.html'), 'utf8');
const ARTICLES_DIR = join(ROOT, 'articles');
const PRODUCTS_DIR = join(ROOT, 'products');
const PRODUCT_FIELDS = 'slug,name,summary,description,product_type,price,currency,cta_label,featured,featured_image,external_url,status,published_at,updated_at,created_at';
const PRODUCT_TYPES = { book: 'Book', course: 'Course', tool: 'Tool', template: 'Template', resource: 'Resource', other: 'Resource' };
const OSINT_FIELDS = 'slug,name,summary,overview,install_guide,key_features,faqs,use_case,category_id,pricing,access_types,official_url,github_url,docs_url,logo_url,featured,status,published_at,updated_at,created_at';
const PENTEST_FIELDS = OSINT_FIELDS;
const OSINT_PRICING = { free: 'Free', freemium: 'Freemium', paid: 'Paid' };
const OSINT_ACCESS = { web: 'Web app', cli: 'Command line', 'desktop-app': 'Desktop app', 'browser-extension': 'Browser ext.', 'mobile-app': 'Mobile app', api: 'API' };

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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
  /* Render Markdown images before links. PDF imports use this form for
     generated page visuals; without this rule `![page](url)` degrades into
     a broken `!<a ...>` link in the deployed static article. */
  x = x.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  x = x.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  return x;
}
function markdownToHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = [];
  let paragraph = [];
  let list = null;
  let inCode = false;
  const flushParagraph = () => { if (paragraph.length) out.push(`<p>${markdownInline(paragraph.join(' '))}</p>`); paragraph = []; };
  const flushList = () => { if (!list) return; out.push(`<${list.type}>${list.items.map((x) => `<li>${markdownInline(x)}</li>`).join('')}</${list.type}>`); list = null; };
  for (const line of lines) {
    if (/^```/.test(line)) { flushParagraph(); flushList(); out.push(inCode ? '</code></pre>' : '<pre><code>'); inCode = !inCode; continue; }
    if (inCode) { out.push(esc(line) + '\n'); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); out.push(`<h${heading[1].length}>${markdownInline(heading[2])}</h${heading[1].length}>`); continue; }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) { flushParagraph(); if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; } list.items.push(bullet[1]); continue; }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) { flushParagraph(); if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; } list.items.push(ordered[1]); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    paragraph.push(line.trim());
  }
  if (inCode) out.push('</code></pre>');
  flushParagraph(); flushList();
  return out.join('\n');
}
function sanitizeHtml(input) {
  const source = String(input || '');
  if (!/<[a-z][\s\S]*>/i.test(source)) return safeArticleHTML(markdownToHtml(source));
  return safeArticleHTML(source);
}
function slugifyHeading(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/gi, ' ')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'section';
}
function normalizeInjected(html) {
  const source = String(html || '').replace(/\sid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  const levels = [...source.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  const shift = levels.length ? Math.max(2 - Math.min(...levels), 0) : 0;
  const shifted = shift ? source.replace(/<(\/?)h([1-6])(\s|>)/gi, (_, slash, level, tail) => `<${slash}h${Math.min(Number(level) + shift, 6)}${tail}`) : source;
  const used = new Map();
  const toc = [];
  const withAnchors = shifted.replace(/<h([2-6])>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const base = slugifyHeading(inner);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    toc.push({ level: Number(level), id, text: inner.replace(/<[^>]*>/g, '').trim() });
    return `<h${level} id="${esc(id)}">${inner}</h${level}>`;
  });
  return { html: withAnchors, toc };
}
async function fetchRows(table, fields) {
  const rows = [], seen = new Set();
  for (;;) {
    // Servers can cap responses below the requested limit. Advance by the real
    // count and continue until empty, rather than silently dropping later posts.
    const params = new URLSearchParams({ select: fields, status: 'eq.published', order: 'slug.asc', limit: '500', offset: String(rows.length) });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      // A publishable key is not a JWT; public reads need only the apikey header.
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`${table} query failed: HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`${table} query returned invalid data; existing pages were not replaced`);
    if (!page.length) return rows;
    for (const row of page) {
      if (!row || typeof row.slug !== 'string' || seen.has(row.slug))
        throw new Error(`${table} returned invalid or repeated rows; publishing stopped`);
      seen.add(row.slug);
      rows.push(row);
    }
    // Fail, never truncate, if an upstream endpoint ignores pagination or the
    // catalogue exceeds what this single-sitemap static publisher can handle.
    if (rows.length > 50000) throw new Error(`${table} exceeds the static publication limit`);
  }
}

const ICON_ARROW = '<svg class="icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
const ICON_BOOK = '<svg class="icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2Z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7Z"/></svg>';

function siteHeader(active = '') {
  const nav = [['Home','/'],['Checker','/checker'],['Generator','/generator'],['Tools','/tools'],['Articles','/articles'],['Products','/products'],['OSINT Hub','/osint'],['Pentest Hub','/pentest'],['Academy','/learning'],['Breach Check','/breach-check']];
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-nav"><div class="container nav-inner"><a class="brand" href="/" aria-label="OopsMyPassword — home"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><defs><linearGradient id="omp-lg-h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#6366F1"/></linearGradient></defs><path d="M15 1.8 26.4 6v8.2c0 6.6-4.4 11.1-11.4 12.9C8 25.3 3.6 20.8 3.6 14.2V6Z" fill="url(#omp-lg-h)"/><circle cx="10.4" cy="14.2" r="1.9" fill="#fff"/><circle cx="15" cy="14.2" r="1.9" fill="#fff"/><circle cx="19.6" cy="14.2" r="1.9" fill="#fff"/></svg><span>Oops<span class="grad-text">MyPassword</span></span></a><nav class="nav-links" aria-label="Primary">${nav.map(([name,url]) => `<a href="${url}"${active === url ? ' aria-current="page"' : ''}>${esc(name)}</a>`).join('')}</nav><div class="nav-actions"><button class="icon-btn" type="button" data-theme-toggle aria-label="Toggle color theme" title="Toggle theme"><span class="theme-icon-moon"><svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg></span><span class="theme-icon-sun"><svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9 6.3 6.3"/><path d="M17.7 17.7 19.1 19.1"/><path d="M2 12h2"/><path d="M20 12h2"/></svg></span></button><a class="btn btn-primary btn-sm btn-get-started" href="/#checker">Get Started</a><button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu"><span class="icon-menu"><svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg></span><span class="icon-close"><svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></span></button></div></div></header>`;
}
function siteMobileMenu(active = '') {
  const items = [['Home','/'],['Checker','/checker'],['Generator','/generator'],['Tools','/tools'],['Articles','/articles'],['Products','/products'],['OSINT Hub','/osint'],['Pentest Hub','/pentest'],['Academy','/learning'],['Breach Check','/breach-check'],['About','/about'],['Password Health','/password-health'],['Security Checklist','/security-checklist'],['FAQ','/faq'],['Privacy Policy','/privacy'],['Contact','/contact']];
  return `<nav class="mobile-menu" id="mobile-menu" aria-label="Mobile">${items.map(([name,url]) => `<a href="${url}"${active === url ? ' aria-current="page"' : ''}>${esc(name)}${ICON_ARROW}</a>`).join('')}<a class="btn btn-primary btn-lg" href="/#checker">Check Your Password</a></nav>`;
}
function siteFooter() { return sharedFooter; }

function commonHead({ title, description, canonical, ogType, ogImage, jsonld = [], published, modified }) {
  const cards = ogImage ? `<meta property="og:image" content="${esc(ogImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="${esc(ogImage)}">` : '';
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#F6F8FC"><meta name="color-scheme" content="light dark"><meta property="og:type" content="${esc(ogType || 'website')}"><meta property="og:site_name" content="OopsMyPassword"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">${cards}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml"><link rel="icon" href="/assets/icons/favicon-32.png" type="image/png" sizes="32x32"><link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><link rel="canonical" href="${esc(canonical)}"><link rel="stylesheet" href="/assets/css/styles.css"><script src="/assets/js/theme-init.js"></script>${jsonld.map((x) => `<script type="application/ld+json">${escJson(x)}</script>`).join('')}${published ? `<meta property="article:published_time" content="${esc(published)}">` : ''}${modified ? `<meta property="article:modified_time" content="${esc(modified)}">` : ''}</head>`;
}
function articleHtml(article) {
  const title = String(article.title || 'Article').trim();
  const slug = String(article.slug || '').trim();
  const summary = metaDescription(String(article.summary || '').trim() || String(article.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const canonical = `${SITE}/articles/${encodeURIComponent(slug)}`;
  const published = article.published_at || article.created_at || '';
  const modified = article.updated_at || published;
  const normalized = normalizeInjected(sanitizeHtml(article.content || ''));
  const content = normalized.html;
  const image = /^https?:\/\//i.test(String(article.featured_image || '')) ? String(article.featured_image) : `${SITE}/assets/images/og-image.jpg`;
  const articleSchema = { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: summary, mainEntityOfPage: canonical, author: { '@type': 'Organization', name: 'OopsMyPassword', url: `${SITE}/` }, publisher: { '@type': 'Organization', name: 'OopsMyPassword', url: SITE }, inLanguage: 'en', image: [image] };
  if (published) articleSchema.datePublished = published;
  if (modified) articleSchema.dateModified = modified;
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: 'Articles', item: `${SITE}/articles` }, { '@type': 'ListItem', position: 3, name: title, item: canonical }] };
  const articleDate = new Date(published);
  const dateLabel = Number.isNaN(articleDate.getTime()) ? '' : articleDate.toISOString().slice(0, 10);
  const toc = normalized.toc;
  const tocHtml = toc.length ? `<aside class="toc" aria-label="Table of contents"><div class="subhead-sm">On this page</div><ul>${toc.map((item) => `<li><a href="#${esc(item.id)}">${esc(item.text)}</a></li>`).join('')}</ul></aside>` : '';
  const body = toc.length
    ? `<div class="container"><div class="article-layout">${tocHtml}<article class="prose" itemscope itemtype="https://schema.org/Article">${content}<hr class="hr-fade" style="margin-top:48px"><div class="callout callout-info"><p><strong>Keep reading:</strong> Explore more security research and practical guidance in the <a href="/articles">Articles hub</a>.</p></div></article></div></div>`
    : `<div class="container container-narrow"><article class="prose" itemscope itemtype="https://schema.org/Article">${content}<hr class="hr-fade" style="margin-top:48px"><div class="callout callout-info"><p><strong>Keep reading:</strong> Explore more security research and practical guidance in the <a href="/articles">Articles hub</a>.</p></div></article></div>`;
  const head = commonHead({ title: documentTitle(title, 'OopsMyPassword'), description: summary, canonical, ogType: 'article', ogImage: image, jsonld: [articleSchema, breadcrumbSchema], published, modified });
  return `${head}<body>${siteHeader('/articles')}${siteMobileMenu('/articles')}<main id="main"><section class="article-hero"><div class="container container-narrow"><nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="/articles" style="color:var(--purple)">Articles</a></nav><h1 class="h-1 mt-16">${esc(title)}</h1><p class="lead mt-8">${esc(summary)}</p><div class="article-meta"><span class="chip">${ICON_BOOK} Article</span>${dateLabel ? `<span class="chip">Updated ${esc(dateLabel)}</span>` : ''}</div></div></section><section class="section-tight">${body}</section></main>${siteFooter()}<script src="/assets/js/url.js" defer></script><script src="/assets/js/main.js" defer></script></body></html>`;
}
// Append the brand suffix only when the result still fits the search-result
// budget. A long, descriptive headline is more useful than a truncated one, and
// this matches how the Academy publisher already builds its titles.
const TITLE_MAX = 65;
function documentTitle(title, brand) {
  const text = String(title || '').trim();
  const branded = `${text} | ${brand}`;
  return branded.length <= TITLE_MAX ? branded : text;
}

const META_DESCRIPTION_MAX = 160;
function metaDescription(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= META_DESCRIPTION_MAX) return text;
  const cut = text.slice(0, META_DESCRIPTION_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '') + '\u2026';
}

function productHtml(product) {
  const slug = String(product.slug || '').trim();
  const name = String(product.name || 'Product').trim();
  // The meta description must be bounded no matter which column supplied it.
  // Previously the 160-char cut only applied to the description fallback, so a
  // long `summary` was emitted verbatim and truncated by search results.
  const rawSummary = String(product.summary || '').trim()
    || String(product.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const summary = metaDescription(rawSummary);
  const canonical = `${SITE}/products/${encodeURIComponent(slug)}`;
  const content = normalizeInjected(sanitizeHtml(product.description || '')).html;
  const image = /^https?:\/\//i.test(String(product.featured_image || '')) ? String(product.featured_image) : `${SITE}/assets/images/og-image.jpg`;
  const typeLabel = PRODUCT_TYPES[String(product.product_type || 'other')] || 'Resource';
  const price = Number(product.price);
  const hasPrice = product.price != null && product.price !== '' && Number.isFinite(price);
  const currency = /^[A-Z]{3}$/.test(String(product.currency || '')) ? String(product.currency) : 'USD';
  const buyUrl = /^https?:\/\//i.test(String(product.external_url || '')) ? String(product.external_url) : '';
  const productSchema = { '@context': 'https://schema.org', '@type': 'Product', name, description: summary, url: canonical, image: [image] };
  if (hasPrice) productSchema.offers = { '@type': 'Offer', price: String(price), priceCurrency: currency, url: buyUrl || canonical };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: 'Products', item: `${SITE}/products` }, { '@type': 'ListItem', position: 3, name, item: canonical }] };
  const cta = String(product.cta_label || '').trim() || (buyUrl ? 'Buy now' : 'Learn more');
  const ctaHtml = buyUrl ? `<p><a class="btn btn-primary" href="${esc(buyUrl)}" rel="noopener noreferrer">${esc(cta)} →</a></p>` : '';
  const head = commonHead({ title: documentTitle(name, 'OopsMyPassword'), description: summary, canonical, ogType: 'product', ogImage: image, jsonld: [productSchema, breadcrumb] });
  return `${head}<body>${siteHeader('/products')}${siteMobileMenu('/products')}<main id="main"><section class="page-hero"><div class="container container-narrow"><nav aria-label="Breadcrumb" class="crumb small muted"><a href="/products" style="color:var(--purple)">Products</a> <span class="divider-dot">/</span> <span>${esc(name)}</span></nav><h1 class="h-1 mt-16">${esc(name)}</h1><p class="lead mt-8">${esc(summary)}</p></div></section><section class="section-tight"><div class="container container-narrow"><div class="card card-pad"><span class="ptype t-${esc(product.product_type || 'other')}">${esc(typeLabel)}</span>${ctaHtml}<div class="prose" style="margin-top:24px">${content}</div></div></div></section></main>${siteFooter()}<script src="/assets/js/url.js" defer></script><script src="/assets/js/main.js" defer></script></body></html>`;
}
const HUBS = {
  osint: { base: '/osint', hubName: 'OSINT Hub', brand: 'OSINT Hub | OopsMyPassword', fallbackName: 'OSINT tool', fallbackCat: 'OSINT', keepExploring: 'browse every investigation type', footerNote: 'Use OSINT tools responsibly — only investigate accounts, people or systems you have a legitimate reason to look into.' },
  pentest: { base: '/pentest', hubName: 'Pentest Hub', brand: 'Pentest Hub | OopsMyPassword', fallbackName: 'Pentest tool', fallbackCat: 'Pentest', keepExploring: 'browse every assessment phase', footerNote: 'Authorized testing only — only ever test systems you own or have explicit written permission to assess.' }
};
function hubToolHtml(hub, tool, catName, related) {
  const cfg = HUBS[hub] || HUBS.osint;
  const slug = String(tool.slug || '').trim();
  const name = String(tool.name || cfg.fallbackName).trim();
  const rawSummary = String(tool.summary || '').trim()
    || String(tool.overview || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const summary = metaDescription(rawSummary);
  const canonical = `${SITE}${cfg.base}/${encodeURIComponent(slug)}`;
  const published = tool.published_at || tool.created_at || '';
  const modified = tool.updated_at || published;
  const overview = normalizeInjected(sanitizeHtml(tool.overview || '')).html;
  const installRaw = String(tool.install_guide || '').trim();
  const install = installRaw ? normalizeInjected(sanitizeHtml(installRaw)).html : '';
  const image = /^https?:\/\//i.test(String(tool.logo_url || '')) ? String(tool.logo_url) : `${SITE}/assets/images/og-image.jpg`;
  const pricing = OSINT_PRICING[String(tool.pricing || 'free')] || 'Free';
  const access = Array.isArray(tool.access_types) ? tool.access_types.filter((a) => OSINT_ACCESS[a]).map((a) => OSINT_ACCESS[a]) : [];
  const official = /^https?:\/\//i.test(String(tool.official_url || '')) ? String(tool.official_url) : '';
  const github = /^https?:\/\//i.test(String(tool.github_url || '')) ? String(tool.github_url) : '';
  const docs = /^https?:\/\//i.test(String(tool.docs_url || '')) ? String(tool.docs_url) : '';
  const initial = esc(String(name).trim().charAt(0).toUpperCase() || '?');
  const hasLogo = /^https?:\/\//i.test(String(tool.logo_url || ''));
  const tile = hasLogo
    ? `<img src="${esc(String(tool.logo_url))}" alt="${esc(`${name} logo`)}" loading="lazy" class="osint-tile osint-tile-lg">`
    : `<span class="osint-tile osint-tile-lg" aria-hidden="true">${initial}</span>`;
  const toolSchema = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name, description: summary, url: canonical, image: [image], applicationCategory: 'SecurityApplication', operatingSystem: access.join(', ') || 'Web', author: { '@type': 'Organization', name: 'OopsMyPassword', url: `${SITE}/` }, publisher: { '@type': 'Organization', name: 'OopsMyPassword', url: SITE }, inLanguage: 'en' };
  if (official) toolSchema.downloadUrl = official;
  if (String(tool.pricing || 'free') === 'free') toolSchema.offers = { '@type': 'Offer', price: '0', priceCurrency: 'USD' };
  const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: cfg.hubName, item: `${SITE}${cfg.base}` }];
  if (catName) crumbs.push({ '@type': 'ListItem', position: 3, name: catName, item: `${SITE}${cfg.base}#/c/${encodeURIComponent(tool.category_slug || '')}` });
  crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name, item: canonical });
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs };
  const links = [official ? `<a class="btn btn-primary" href="${esc(official)}" rel="noopener noreferrer">Open official site →</a>` : '', github ? `<a class="btn btn-secondary" href="${esc(github)}" rel="noopener noreferrer">GitHub</a>` : '', docs ? `<a class="btn btn-ghost" href="${esc(docs)}" rel="noopener noreferrer">Docs</a>` : ''].filter(Boolean).join('');
  const updated = dateOnly(tool.updated_at || tool.published_at);
  const featuresRaw = String(tool.key_features || '').trim();
  const features = featuresRaw ? normalizeInjected(sanitizeHtml(featuresRaw)).html : '';
  const faqsRaw = String(tool.faqs || '').trim();
  const faqs = faqsRaw ? normalizeInjected(sanitizeHtml(faqsRaw)).html : '';
  const useCaseRaw = String(tool.use_case || '').trim();
  const useCase = useCaseRaw ? normalizeInjected(sanitizeHtml(useCaseRaw)).html : '';
  /* Sections drive both the article body and the sticky table of contents,
     so they can never drift apart. Mirrors assets/js/osint.js detailView. */
  const sections = [{ id: 'sec-overview', label: 'Overview', html: overview }];
  if (features) sections.push({ id: 'sec-features', label: 'Key features', html: features });
  if (install) sections.push({ id: 'sec-install', label: 'Install & first run', html: install });
  if (useCase) sections.push({ id: 'sec-example', label: 'Real-world example', html: useCase });
  if (faqs) sections.push({ id: 'sec-faq', label: 'Common questions', html: faqs });
  const relatedCards = (related || []).filter((r) => r && r.slug !== slug && isValidSlug(r.slug)).slice(0, 3).map((r) => {
    const rName = String(r.name || r.slug).trim();
    const rSummary = metaDescription(String(r.summary || '').trim());
    return `<article class="feed-row osint-row"><span class="osint-tile" aria-hidden="true">${esc(rName.charAt(0).toUpperCase())}</span><div class="feed-row-main"><h3 class="feed-title"><a href="${cfg.base}/${encodeURIComponent(r.slug)}">${esc(rName)}</a></h3>${rSummary ? `<p class="feed-excerpt">${esc(rSummary)}</p>` : ''}</div></article>`;
  }).join('');
  if (relatedCards) sections.push({ id: 'sec-related', label: 'Related tools', related: true });
  const toc = `<aside class="toc" aria-label="Table of contents"><div class="subhead-sm">On this page</div><ul>${sections.map((s) => `<li><a href="#${s.id}">${esc(s.label)}</a></li>`).join('')}</ul></aside>`;
  const body = sections.map((s) => {
    if (s.related) return `<h2 id="${s.id}">Related tools</h2><div class="feed-list" style="margin-top:14px">${relatedCards}</div>`;
    return `<h2 id="${s.id}">${esc(s.label)}</h2>${s.html}`;
  }).join('');
  const metaChips = [`<span class="chip">${esc(catName || cfg.fallbackCat)}</span>`, `<span class="chip">${esc(pricing)}</span>`, ...access.map((a) => `<span class="chip">${esc(a)}</span>`), ...(tool.featured ? ['<span class="chip">★ Featured</span>'] : []), ...(updated ? [`<span class="chip">Updated ${esc(updated)}</span>`] : [])].join('');
  const head = commonHead({ title: documentTitle(name, cfg.brand), description: summary, canonical, ogType: 'article', ogImage: image, jsonld: [toolSchema, breadcrumb], published, modified });
  return `${head}<body>${siteHeader(cfg.base)}${siteMobileMenu(cfg.base)}<main id="main"><section class="article-hero"><div class="container container-wide"><p style="margin:0 0 6px"><a class="btn btn-ghost btn-sm" href="${cfg.base}">← Back to hub</a></p><nav aria-label="Breadcrumb" class="small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="/osint" style="color:var(--purple)">${cfg.hubName}</a>${catName ? ` <span class="divider-dot">/</span> <span>${esc(catName)}</span>` : ''}</nav><div class="osint-detail-head" style="margin-top:16px">${tile}<div><h1 class="h-1" style="margin:0">${esc(name)}</h1></div></div><p class="lead" style="margin-top:16px">${esc(summary)}</p><div class="article-meta">${metaChips}</div><div class="flex gap-12 wrap" style="margin-top:20px">${links}</div></div></section><section class="section-tight"><div class="container container-wide"><div class="article-layout" style="margin-top:8px">${toc}<article class="prose">${body}<hr class="hr-fade" style="margin-top:48px"><div class="callout callout-info"><p><strong>Keep exploring:</strong> browse every ${cfg.keepExploring} in the <a href="${cfg.base}">${cfg.hubName}</a>.</p></div><p class="muted small" style="margin-top:20px">${cfg.footerNote}</p></article></div></div></section></main>${siteFooter()}<script src="/assets/js/url.js" defer></script><script src="/assets/js/main.js" defer></script></body></html>`;
}
function osintHtml(tool, catName, related) {
  return hubToolHtml('osint', tool, catName, related);
}
function pentestHtml(tool, catName, related) {
  return hubToolHtml('pentest', tool, catName, related);
}
function dateOnly(value) { if (!value) return ''; const ms = Date.parse(value); return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : ''; }
function sitemapXml({ articles, products, osint = [], pentest = [] }) {
  const urls = new Map();
  const urlFor = (route) => route === '/' ? `${SITE}/` : `${SITE}${route.replace(/\/+$/, '')}`;
  const add = (loc, lastmod, route) => { if (!urls.has(loc)) urls.set(loc, { lastmod, priority: priorityForRoute(route || '/') }); };
  for (const route of STATIC_ROUTES) add(urlFor(route), '', route);
  for (const article of articles) if (isValidSlug(article.slug)) add(urlFor(`/articles/${encodeURIComponent(article.slug)}`), dateOnly(article.updated_at || article.published_at || article.created_at), `/articles/${article.slug}`);
  for (const product of products) if (isValidSlug(product.slug)) add(urlFor(`/products/${encodeURIComponent(product.slug)}`), dateOnly(product.updated_at || product.published_at || product.created_at), `/products/${product.slug}`);
  for (const tool of osint) if (isValidSlug(tool.slug)) add(urlFor(`/osint/${encodeURIComponent(tool.slug)}`), dateOnly(tool.updated_at || tool.published_at || tool.created_at), `/osint/${tool.slug}`);
  for (const tool of pentest) if (isValidSlug(tool.slug)) add(urlFor(`/pentest/${encodeURIComponent(tool.slug)}`), dateOnly(tool.updated_at || tool.published_at || tool.created_at), `/pentest/${tool.slug}`);
  const body = [...urls.entries()].map(([loc, meta]) => `<url><loc>${esc(loc)}</loc>${meta.lastmod ? `<lastmod>${meta.lastmod}</lastmod>` : ''}<priority>${meta.priority}</priority></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`;
}
async function main() {
  const [articles, products, osintTools, osintCats, pentestTools, pentestCats] = await Promise.all([
    fetchRows('articles', 'slug,title,summary,content,status,published_at,updated_at,created_at,featured_image'),
    fetchRows('products', PRODUCT_FIELDS),
    fetchRows('osint_tools', OSINT_FIELDS),
    fetchRows('osint_categories', 'id,name,slug,status'),
    fetchRows('pentest_tools', PENTEST_FIELDS),
    fetchRows('pentest_categories', 'id,name,slug,status'),
  ]);
  await rm(ARTICLES_DIR, { recursive: true, force: true });
  await mkdir(ARTICLES_DIR, { recursive: true });
  let articlePages = 0;
  for (const article of articles) if (isValidSlug(article.slug)) { await writeFile(join(ARTICLES_DIR, `${article.slug}.html`), articleHtml(article), 'utf8'); articlePages++; }
  await rm(PRODUCTS_DIR, { recursive: true, force: true });
  await mkdir(PRODUCTS_DIR, { recursive: true });
  let productPages = 0;
  for (const product of products) if (isValidSlug(product.slug)) { await writeFile(join(PRODUCTS_DIR, `${product.slug}.html`), productHtml(product), 'utf8'); productPages++; }
  const OSINT_DIR = join(ROOT, 'osint');
  await rm(OSINT_DIR, { recursive: true, force: true });
  await mkdir(OSINT_DIR, { recursive: true });
  const catById = new Map((osintCats || []).map((c) => [c.id, c]));
  let osintPages = 0;
  for (const tool of osintTools) {
    if (!isValidSlug(tool.slug)) continue;
    const cat = catById.get(tool.category_id);
    const siblings = osintTools.filter((o) => o && o.category_id && o.category_id === tool.category_id && o.slug !== tool.slug && isValidSlug(o.slug));
    await writeFile(join(OSINT_DIR, `${tool.slug}.html`), osintHtml({ ...tool, category_slug: cat ? cat.slug : '' }, cat ? cat.name : '', siblings), 'utf8');
    osintPages++;
  }
  const PENTEST_DIR = join(ROOT, 'pentest');
  await rm(PENTEST_DIR, { recursive: true, force: true });
  await mkdir(PENTEST_DIR, { recursive: true });
  const pcatById = new Map((pentestCats || []).map((c) => [c.id, c]));
  let pentestPages = 0;
  for (const tool of pentestTools) {
    if (!isValidSlug(tool.slug)) continue;
    const cat = pcatById.get(tool.category_id);
    const siblings = pentestTools.filter((o) => o && o.category_id && o.category_id === tool.category_id && o.slug !== tool.slug && isValidSlug(o.slug));
    await writeFile(join(PENTEST_DIR, `${tool.slug}.html`), pentestHtml({ ...tool, category_slug: cat ? cat.slug : '' }, cat ? cat.name : '', siblings), 'utf8');
    pentestPages++;
  }
  const xml = sitemapXml({ articles, products, osint: osintTools, pentest: pentestTools });
  await writeFile(join(ROOT, 'sitemap.xml'), xml, 'utf8');
  await writeFile(join(ROOT, 'google-sitemap.xml'), xml, 'utf8');

  /* The hub shell (osint.html) is written by tools/build.py, which cannot
     know the live catalog — so the ItemList for the hub is injected here,
     where the published tools are known. Runs at every deploy, idempotent. */
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'OSINT Hub — OopsMyPassword',
    numberOfItems: osintTools.filter((t) => isValidSlug(t.slug)).length,
    itemListElement: osintTools.filter((t) => isValidSlug(t.slug)).map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: String(t.name || t.slug).trim(),
      url: `${SITE}/osint/${encodeURIComponent(t.slug)}`
    }))
  };
  const pentestItemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Pentest Hub — OopsMyPassword',
    numberOfItems: pentestTools.filter((t) => isValidSlug(t.slug)).length,
    itemListElement: pentestTools.filter((t) => isValidSlug(t.slug)).map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: String(t.name || t.slug).trim(),
      url: `${SITE}/pentest/${encodeURIComponent(t.slug)}`
    }))
  };
  const pentestHubPath = join(ROOT, 'pentest.html');
  let phub = await readFile(pentestHubPath, 'utf8');
  phub = phub.replace(/<script type="application\/ld\+json" id="omp-pentest-itemlist">[\s\S]*?<\/script>/, '').replace('</head>', `<script type="application/ld+json" id="omp-pentest-itemlist">${escJson(pentestItemList)}</script></head>`);
  await writeFile(pentestHubPath, phub, 'utf8');
  const hubPath = join(ROOT, 'osint.html');
  let hub = await readFile(hubPath, 'utf8');
  hub = hub.replace(/<script type="application\/ld\+json" id="omp-osint-itemlist">[\s\S]*?<\/script>/, '').replace('</head>', `<script type="application/ld+json" id="omp-osint-itemlist">${escJson(itemList)}</script></head>`);
  await writeFile(hubPath, hub, 'utf8');

  /* llms.txt: the citation surface for AI answer engines (2026 ranking is
     half being quoted). Regenerated from the same live rows as the sitemap,
     so it can never advertise a tool that is not published. */
  const llms = [
    '# OopsMyPassword',
    '',
    '> Privacy-first password tools, security guides, courses and an OSINT tools directory. No account needed.',
    '',
    '## OSINT Hub',
    '',
    'Browse OSINT tools by investigation type at https://oopsmypassword.web.app/osint — username, email, domain, phone, image and all-in-one, filterable by free/paid and web/command-line, each with install steps and official links.',
    '',
    ...osintTools.filter((t) => isValidSlug(t.slug)).map((t) => `- [${String(t.name || t.slug).trim()}](${SITE}/osint/${encodeURIComponent(t.slug)}): ${metaDescription(String(t.summary || '').trim() || String(t.overview || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())}`),
    '',
    '## Guides',
    '',
    '- [Best Free OSINT Tools for Beginners](https://oopsmypassword.web.app/articles/best-free-osint-tools-for-beginners): the starting lineup this hub is built on.',
    '- [Articles hub](https://oopsmypassword.web.app/articles): security news, deep dives and how-tos.',
    '',
    '## Pentest Hub',
    '',
    'Browse pentest tools by assessment phase at https://oopsmypassword.web.app/pentest — network scanning, web testing, password auditing, wireless, vulnerability scanning and frameworks. Authorized testing only, each with install steps and official links.',
    '',
    ...pentestTools.filter((t) => isValidSlug(t.slug)).map((t) => `- [${String(t.name || t.slug).trim()}](${SITE}/pentest/${encodeURIComponent(t.slug)}): ${metaDescription(String(t.summary || '').trim())}`),
    ''
  ].join('\n');
  await writeFile(join(ROOT, 'llms.txt'), llms, 'utf8');
  console.log(`Built ${articlePages} article pages, ${productPages} product pages and ${osintPages} osint pages and ${pentestPages} pentest pages; sitemap has ${(xml.match(/<loc>/g) || []).length} URLs at ${SITE}.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
