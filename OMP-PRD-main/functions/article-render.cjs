/* ============================================================
   OMP article renderer (Firebase Cloud Function).

   Renders published Supabase articles as full site pages at /articles/<slug>
   so publishing from /admin/ needs no rebuild and no static deploy: the row in
   Postgres is the whole source of truth, and the page goes live as soon as
   the CDN cache turns over.

   The header, mobile menu, document head, table of contents and prose layout
   below are copied verbatim from scripts/build-static-seo.mjs so a
   function-rendered article is visually identical to a statically built one.
   They are duplicated rather than imported because Firebase only uploads the
   functions/ directory, so the build script is not reachable from here.
   tools/test_site_contracts.js fails the build if the two ever diverge.
   ============================================================ */
'use strict';

const safeArticleHTML = require('./safe-article-html.cjs');

const SITE = (process.env.SITE_ORIGIN || 'https://oopsmypassword.web.app').replace(/\/+$/, '');

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function escJson(value) {
  return JSON.stringify(value ?? '').replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

const ICON_ARROW = '<svg class="icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
const ICON_BOOK = '<svg class="icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2Z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7Z"/></svg>';

function siteHeader(active = '') {
  const nav = [['Home','/'],['Checker','/checker'],['Tools','/tools'],['Academy','/learning'],['OSINT Hub','/osint'],['Pentest Hub','/pentest'],['Articles','/articles'],['Products','/products']];
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-nav"><div class="container nav-inner"><a class="brand" href="/" aria-label="OopsMyPassword — home"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><defs><linearGradient id="omp-lg-h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#6366F1"/></linearGradient></defs><path d="M15 1.8 26.4 6v8.2c0 6.6-4.4 11.1-11.4 12.9C8 25.3 3.6 20.8 3.6 14.2V6Z" fill="url(#omp-lg-h)"/><circle cx="10.4" cy="14.2" r="1.9" fill="#fff"/><circle cx="15" cy="14.2" r="1.9" fill="#fff"/><circle cx="19.6" cy="14.2" r="1.9" fill="#fff"/></svg><span>Oops<span class="grad-text">MyPassword</span></span></a><nav class="nav-links" aria-label="Primary">${nav.map(([name,url]) => `<a href="${url}"${active === url ? ' aria-current="page"' : ''}>${esc(name)}</a>`).join('')}</nav><div class="nav-actions"><button class="icon-btn" type="button" data-theme-toggle aria-label="Toggle color theme" title="Toggle theme"><span class="theme-icon-moon"><svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg></span><span class="theme-icon-sun"><svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9 6.3 6.3"/><path d="M17.7 17.7 19.1 19.1"/><path d="M2 12h2"/><path d="M20 12h2"/></svg></span></button><a class="btn btn-primary btn-sm btn-get-started" href="/#checker">Get Started</a><button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu"><span class="icon-menu"><svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg></span><span class="icon-close"><svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></span></button></div></div></header>`;
}
function siteMobileMenu(active = '') {
  const items = [['Home','/'],['Checker','/checker'],['Tools','/tools'],['Academy','/learning'],['OSINT Hub','/osint'],['Pentest Hub','/pentest'],['Articles','/articles'],['Products','/products'],['Generator','/generator'],['Breach Check','/breach-check'],['About','/about'],['Password Health','/password-health'],['Security Checklist','/security-checklist'],['FAQ','/faq'],['Privacy Policy','/privacy'],['Contact','/contact']];
  return `<nav class="mobile-menu" id="mobile-menu" aria-label="Mobile">${items.map(([name,url]) => `<a href="${url}"${active === url ? ' aria-current="page"' : ''}>${esc(name)}${ICON_ARROW}</a>`).join('')}<a class="btn btn-primary btn-lg" href="/#checker">Check Your Password</a></nav>`;
}

function siteFooter() {
  return require('node:fs').readFileSync(require('node:path').join(__dirname, 'site-footer.fragment'), 'utf8');
}

function commonHead({ title, description, canonical, ogType, ogImage, jsonld = [], published, modified }) {
  const cards = ogImage ? `<meta property="og:image" content="${esc(ogImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:image" content="${esc(ogImage)}">` : '';
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#050811"><meta name="color-scheme" content="dark light"><meta property="og:type" content="${esc(ogType || 'website')}"><meta property="og:site_name" content="OopsMyPassword"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">${cards}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml"><link rel="icon" href="/assets/icons/favicon-32.png" type="image/png" sizes="32x32"><link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><link rel="canonical" href="${esc(canonical)}"><link rel="stylesheet" href="/assets/css/styles.css"><script src="/assets/js/theme-init.js"></script>${jsonld.map((x) => `<script type="application/ld+json">${escJson(x)}</script>`).join('')}${published ? `<meta property="article:published_time" content="${esc(published)}">` : ''}${modified ? `<meta property="article:modified_time" content="${esc(modified)}">` : ''}</head>`;
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

function normalizeInjected(html, title) {
  const source = String(html || '').replace(/\sid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  let levels = [...source.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  let shifted = source;
  if (!levels.length) {
    const normTitle = String(title || '').trim().toLowerCase();
    const pMatches = [...source.matchAll(/<p>(\s*(?:<strong>|<b>)?\s*([^<>\n]{3,90}?)\s*(?:<\/strong>|<\/b>)?\s*)<\/p>/gi)];
    const candidates = pMatches.filter((m) => {
      const text = m[2].trim();
      const words = text.split(/\s+/).filter(Boolean).length;
      if (words < 1 || words > 14) return false;
      if (normTitle && text.toLowerCase() === normTitle) return false;
      if (/[.!,:;]$/.test(text) && !/\?$/.test(text)) return false;
      if (/^(?:note|important|warning|caution|example|tip|disclaimer)\s*:/i.test(text)) return false;
      if (/^(?:table of contents|on this page)$/i.test(text)) return false;
      if (/^https?:\/\//i.test(text)) return false;
      return true;
    });
    if (candidates.length >= 2) {
      for (const c of candidates) {
        shifted = shifted.replace(c[0], `<h2>${c[2].trim()}</h2>`);
      }
      levels = [2];
    }
  }
  const shift = levels.length ? Math.max(2 - Math.min(...levels), 0) : 0;
  const reShifted = shift ? shifted.replace(/<(\/?)h([1-6])(\s|>)/gi, (_, slash, level, tail) => `<${slash}h${Math.min(Number(level) + shift, 6)}${tail}`) : shifted;
  const used = new Map();
  const toc = [];
  const withAnchors = reShifted.replace(/<h([2-6])>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const base = slugifyHeading(inner);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    toc.push({ level: Number(level), id, text: inner.replace(/<[^>]*>/g, '').trim() });
    return `<h${level} id="${esc(id)}">${inner}</h${level}>`;
  });
  return { html: withAnchors, toc };
}

const TITLE_MAX = 65;
function documentTitle(title, brand) {
  const text = String(title || '').trim();
  const branded = `${text} | ${brand}`;
  if (branded.length <= TITLE_MAX) return branded;
  if (text.length <= TITLE_MAX) return text;
  const separatorMatch = text.match(/^([^:?]+[:?])\s+(.+)$/);
  if (separatorMatch) {
    const firstPart = separatorMatch[1].replace(/[:]+$/, '');
    const brandedFirst = `${firstPart} | ${brand}`;
    if (brandedFirst.length <= TITLE_MAX) return brandedFirst;
    if (firstPart.length <= TITLE_MAX) return firstPart;
  }
  const cut = text.slice(0, TITLE_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '');
  const brandedTrimmed = `${trimmed} | ${brand}`;
  return brandedTrimmed.length <= TITLE_MAX ? brandedTrimmed : trimmed;
}

const META_DESCRIPTION_MAX = 160;
function metaDescription(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= META_DESCRIPTION_MAX) return text;
  const cut = text.slice(0, META_DESCRIPTION_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '') + '\u2026';
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

function extractPlainText(html) {
  return String(html || '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function promotePlainTextHeadings(source, title) {
  const lines = String(source || '').replace(/\r/g, '').split('\n');
  const nonEmpty = lines.map((line, index) => ({ line: line.trim(), index })).filter((x) => x.line);
  if (nonEmpty.length < 4) return source;
  const normTitle = String(title || '').trim().toLowerCase();
  const headingLines = new Set();
  for (let n = 1; n < nonEmpty.length - 1; n++) {
    const item = nonEmpty[n];
    const line = item.line;
    const precededByEmpty = item.index === 0 || !lines[item.index - 1].trim();
    const followedByEmpty = item.index === lines.length - 1 || !lines[item.index + 1].trim();
    const separated = precededByEmpty && (followedByEmpty || (lines[item.index + 1].trim().length > line.length));
    const words = line.split(/\s+/).filter(Boolean).length;
    const looksLikeHeading = line.length >= 3 && line.length <= 90
      && words >= 1 && words <= 14
      && (!/[.!,:;]$/.test(line) || /\?$/.test(line))
      && !/^https?:\/\//i.test(line)
      && !/^(?:note|important|warning|caution|example|tip|disclaimer)\s*:/i.test(line)
      && !/^(?:table of contents|on this page)$/i.test(line)
      && (!normTitle || line.toLowerCase() !== normTitle);
    if (separated && looksLikeHeading) headingLines.add(item.index);
  }
  if (!headingLines.size) return source;
  return lines.map((line, index) => headingLines.has(index) ? '## ' + line.trim().replace(/^#{1,6}\s*/, '') : line).join('\n');
}

function sanitizeArticleHtml(input, title) {
  const source = String(input || '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(html|head|body|article|header|footer)\b[^>]*>/gi, '');
  if (!/<[a-z][\s\S]*>/i.test(source)) return safeArticleHTML(markdownToHtml(promotePlainTextHeadings(source, title)));
  return safeArticleHTML(source);
}

/* The TOC and the heading ids it links to must come from one pass over the
   content, or the links point at ids that were never emitted. */
function articleBody(html, toc) {
  const tocHtml = toc.length
    ? '<aside class="toc" aria-label="Table of contents"><div class="subhead-sm">On this page</div><ul>'
      + toc.map((item) => '<li><a href="#' + esc(item.id) + '">' + esc(item.text) + '</a></li>').join('')
      + '</ul></aside>'
    : '';
  const inner = html
    + '<hr class="hr-fade" style="margin-top:48px"><div class="callout callout-info"><p><strong>Keep reading:</strong> Explore more security research and practical guidance in the <a href="/articles">Articles hub</a>.</p></div>';
  return toc.length
    ? '<div class="container container-article"><div class="article-layout">' + tocHtml + '<article class="prose" itemscope itemtype="https://schema.org/Article">' + inner + '</article></div></div>'
    : '<div class="container container-article"><article class="prose" itemscope itemtype="https://schema.org/Article">' + inner + '</article></div>';
}

/**
 * article          published row from the articles table
 * Sanitized internally: Markdown is converted when the source is Markdown,
 * and every path passes through the same allowlist.
 */
function renderArticlePage(article) {
  const title = String(article.title || 'Article').trim();
  const slug = String(article.slug || '').trim();
  const summary = metaDescription(
    String(article.summary || '').trim()
    || extractPlainText(article.content)
  );
  const canonical = SITE + '/articles/' + encodeURIComponent(slug);
  const published = article.published_at || article.created_at || '';
  const modified = article.updated_at || published;
  const normalized = normalizeInjected(sanitizeArticleHtml(article.content || '', title), title);
  const image = /^https?:\/\//i.test(String(article.featured_image || ''))
    ? String(article.featured_image)
    : SITE + '/assets/images/og-image.jpg';

  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title,
    description: summary, mainEntityOfPage: canonical,
    author: { '@type': 'Organization', name: 'OopsMyPassword', url: SITE + '/' },
    publisher: { '@type': 'Organization', name: 'OopsMyPassword', url: SITE },
    inLanguage: 'en', image: [image]
  };
  if (published && Number.isFinite(Date.parse(published))) articleSchema.datePublished = published;
  if (modified && Number.isFinite(Date.parse(modified))) articleSchema.dateModified = modified;
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: SITE + '/articles' },
      { '@type': 'ListItem', position: 3, name: title, item: canonical }
    ]
  };
  const d = new Date(published);
  const dateLabel = Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);

  const head = commonHead({
    title: documentTitle(title, 'OopsMyPassword'),
    description: summary,
    canonical: canonical,
    ogType: 'article',
    ogImage: image,
    jsonld: [articleSchema, breadcrumbSchema],
    published: published,
    modified: modified
  });
  const body = articleBody(normalized.html, normalized.toc);
  return head
    + '<body>' + siteHeader('/articles') + siteMobileMenu('/articles')
    + '<main id="main"><section class="article-hero"><div class="container container-article">'
    + '<nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="/articles" style="color:var(--purple)">Articles</a></nav>'
    + '<h1 class="h-1 mt-16">' + esc(title) + '</h1>'
    + '<p class="lead mt-8">' + esc(summary) + '</p>'
    + '<div class="article-meta"><span class="chip">' + ICON_BOOK + ' Article</span>'
    + (dateLabel ? '<span class="chip">Updated ' + esc(dateLabel) + '</span>' : '')
    + '</div></div></section><section class="section-tight">' + body + '</section></main>'
    + siteFooter()
    + '<script src="/assets/js/url.js" defer></script><script src="/assets/js/main.js" defer></script>'
    + '</body></html>';
}

module.exports = { renderArticlePage, sanitizeArticleHtml, articleBody, documentTitle, metaDescription, normalizeInjected, slugifyHeading };
