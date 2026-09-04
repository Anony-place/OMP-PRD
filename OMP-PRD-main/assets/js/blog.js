/* OopsMyPassword — Supabase-backed public article feed.
   Articles may be authored in Markdown OR HTML; both are rendered
   through window.OMPMarkdown.renderSafe(), which escapes first and
   then applies the whitelist sanitizer (assets/js/sanitize.js). */
(function () {
  'use strict';
  var root = document.querySelector('[data-blog]');
  if (!root) return;

  var SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
  var BASE_TITLE = 'Articles — OopsMyPassword';
  var PAGE_LIMIT = 200;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fmtDate(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'}); }
    catch (e) { return value; }
  }

  /* Markdown/HTML aware text extraction. Uses an inert DOMParser
     document, so no scripts run and no images load even when the
     content is untrusted. */
  function plainText(source) {
    if (window.OMPMarkdown && window.OMPMarkdown.plainText) return window.OMPMarkdown.plainText(source);
    try {
      var parsed = new DOMParser().parseFromString(String(source || ''), 'text/html');
      return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
      return String(source || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  function minutes(source) {
    var words = plainText(source).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  /* Short fallback excerpt for articles published without a summary. */
  function excerpt(a) {
    if (a.summary && String(a.summary).trim()) return String(a.summary).trim();
    var text = plainText(a.content);
    /* Drop a leading restatement of the title from the excerpt. */
    var title = String(a.title || '').trim().toLowerCase();
    if (title && text.toLowerCase().indexOf(title) === 0) text = text.slice(title.length).trim();
    if (text.length > 190) text = text.slice(0, 190).replace(/\s+\S*$/, '') + '…';
    return text;
  }

  /* Fail closed: without the renderer/sanitizer, show nothing rather
     than injecting untrusted HTML. */
  function renderContent(source) {
    if (window.OMPMarkdown && window.OMPMarkdown.renderSafe) return window.OMPMarkdown.renderSafe(source || '');
    return window.OMPSanitize ? window.OMPSanitize(source || '') : '';
  }

  /* Only http(s), site-relative and # URLs are allowed. Delegates to the
     canonical validator; attrSafe blocks attribute break-out, noUpLevel
     keeps the href on-site (no ../), and mailto is not allowed here. */
  function safeUrl(value) {
    var v = String(value == null ? '' : value).trim();
    if (!v || /["'<>\\]/.test(v)) return '';
    if (window.OMPUrl && window.OMPUrl.safeUrl) {
      var u = window.OMPUrl.safeUrl(v, { attrSafe: true, noUpLevel: true, allowMailto: false });
      return u === null ? '' : u;
    }
    return /^(https?:\/\/|\/|#)/i.test(v) ? v : '';
  }

  /* Attribute-context escaping (esc() alone does not escape quotes). */
  function attr(s) {
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* A row is renderable when it has both a title and a slug to route
     to. Content-based keyword blacklists used to live here; they are
     gone — hiding posts is the admin panel's job (draft/archive), not
     a string match in the public renderer. */
  function isRenderable(a) {
    return !!a && !!a.slug && String(a.title || '').trim() !== '';
  }

  function categoryName(a) {
    var c = a.article_categories;
    if (Array.isArray(c)) c = c[0];
    return c && c.name ? c.name : 'Article';
  }

  function listView(articles) {
    document.title = BASE_TITLE;
    var valid = articles.filter(isRenderable);
    if (!valid.length) {
      root.innerHTML = '<div class="admin-empty"><h2 class="h-3">No published articles yet</h2><p class="muted" style="margin-top:8px">New posts will appear here automatically after they are published from the admin panel.</p></div>';
      return;
    }
    root.innerHTML = '<div class="admin-list">' + valid.map(function (a) {
      var note = excerpt(a);
      return '<article class="admin-row" style="align-items:flex-start">' +
        '<div class="grow"><div class="ttl"><a href="/blog.html#/' + attr(encodeURIComponent(a.slug)) + '">' + esc(a.title) + '</a></div>' +
        '<div class="meta">' + esc(categoryName(a)) + ' · ' + esc(fmtDate(a.published_at || a.created_at)) + ' · ' + minutes(a.content) + ' min read' + (safeUrl(a.document_url) ? ' · 📄' : '') + '</div>' +
        (note ? '<p class="muted" style="margin-top:8px">' + esc(note) + '</p>' : '') +
        '</div></article>';
    }).join('') + '</div>';
  }

  function articleView(a) {
    var image = safeUrl(a.featured_image);
    document.title = String(a.title || 'Article') + ' — OopsMyPassword';
    root.innerHTML = '<article class="card card-pad" style="max-width:900px;margin:0 auto">' +
      '<a class="btn btn-ghost btn-sm" href="/blog.html">← All articles</a>' +
      (image ? '<img src="' + attr(image) + '" alt="" loading="lazy" style="width:100%;border-radius:var(--radius);margin-top:20px">' : '') +
      '<div style="margin-top:22px"><span class="badge badge-demo">' + esc(categoryName(a)) + '</span>' +
      '<h1 class="h-1 mt-16">' + esc(a.title) + '</h1>' +
      '<div class="meta" style="margin-top:10px">' + esc(fmtDate(a.published_at || a.created_at)) + ' · ' + minutes(a.content) + ' min read</div>' +
      (a.summary && String(a.summary).trim() ? '<p class="lead" style="margin-top:18px">' + esc(a.summary) + '</p>' : '') +
      '<div class="prose" style="margin-top:28px">' + renderContent(a.content) + '</div>' +
      (safeUrl(a.document_url) ? '<p style="margin-top:24px"><a class="btn btn-secondary" href="' + attr(safeUrl(a.document_url)) + '" target="_blank" rel="noopener noreferrer">📄 Download document</a></p>' : '') +
      '</div></article>';
    /* The article title above is the page's only <h1>; demote any "#" heading
       the author put in the body so the outline stays valid. */
    if (window.OMPMarkdown && window.OMPMarkdown.demoteHeadings) {
      window.OMPMarkdown.demoteHeadings(root.querySelector('.prose'), 1);
    }
  }

  /* Only "#/slug" hashes address an article. Plain in-page anchors
     ("#main", "#checker") must not trigger a feed reload. */
  function articleHash() {
    var h = location.hash || '';
    if (h.slice(0, 2) !== '#/') return '';
    try { return decodeURIComponent(h.slice(2)); } catch (e) { return h.slice(2); }
  }

  var clientPromise = null;
  function getClient() {
    if (!clientPromise) {
      clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
        .then(function (mod) { return mod.createClient(SUPABASE_URL, SUPABASE_KEY); })
        .catch(function (e) { clientPromise = null; throw e; });
    }
    return clientPromise;
  }

  var FIELDS = 'id,slug,title,summary,content,featured_image,document_url,status,published_at,created_at';

  async function fetchArticles() {
    var client = await getClient();
    /* Preferred query embeds the category. If the embed is blocked
       (RLS/view change) fall back to plain fields instead of losing
       the whole feed over a decorative join. */
    var result = await client.from('articles')
      .select(FIELDS + ',article_categories(name,slug)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(PAGE_LIMIT);
    if (result.error) {
      var plain = await client.from('articles')
        .select(FIELDS)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(PAGE_LIMIT);
      if (plain.error) throw plain.error;
      return plain.data || [];
    }
    return result.data || [];
  }

  var lastArticles = [];

  async function load() {
    try {
      lastArticles = await fetchArticles();
      render();
    } catch (error) {
      console.error('Article feed error:', error);
      if (lastArticles.length) { render(); return; } /* keep showing what we have */
      root.innerHTML = '<div class="notice-band"><p>Articles are temporarily unavailable. Please try again shortly.</p></div>';
    }
  }

  function render() {
    var slug = articleHash();
    var selected = slug ? lastArticles.find(function (a) { return a.slug === slug; }) : null;
    if (slug && !selected) {
      /* Deep link to an unpublished/removed article: don't show a blank page. */
      root.innerHTML = '<div class="admin-empty"><h2 class="h-3">Article not found</h2><p class="muted" style="margin-top:8px">It may have been unpublished or moved. <a href="/blog.html" style="color:var(--purple)">Back to all articles</a>.</p></div>';
      document.title = 'Article not found — OopsMyPassword';
      return;
    }
    if (selected) articleView(selected); else listView(lastArticles);
  }

  /* Re-render in place on hash change; only refetch when we have
     nothing cached yet. */
  var lastHash = location.hash;
  window.addEventListener('hashchange', function () {
    if (location.hash === lastHash) return;
    lastHash = location.hash;
    if (lastArticles.length) render(); else load();
  });

  load();
})();
