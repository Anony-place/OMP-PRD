/* OopsMyPassword — Supabase-backed public article feed */
(function () {
  'use strict';
  var root = document.querySelector('[data-blog]');
  if (!root) return;

  var SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';

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

  /* Word count via DOMParser: the raw HTML is parsed in an inert
     document, so no scripts run and no images load, even when the
     content is untrusted (innerHTML on a detached div would fire
     <img onerror> handlers during parsing). */
  function minutes(html) {
    var text = '';
    try {
      var parsed = new DOMParser().parseFromString(html || '', 'text/html');
      text = parsed.body.textContent || '';
    } catch (e) {
      text = String(html || '').replace(/<[^>]*>/g, ' ');
    }
    var words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  /* Fail closed: if the sanitizer is unavailable, render nothing
     rather than injecting untrusted HTML. */
  function sanitize(html) {
    return window.OMPSanitize ? window.OMPSanitize(html || '') : '';
  }

  /* Only http(s), site-relative and # URLs are allowed. */
  function safeUrl(value) {
    var v = String(value == null ? '' : value).trim();
    if (!v || /["'<>\\]/.test(v)) return '';
    return /^(https?:\/\/|\/|#)/i.test(v) ? v : '';
  }

  /* Attribute-context escaping (esc() alone does not escape quotes). */
  function attr(s) {
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function listView(articles) {
    var validArticles = articles.filter(function (a) {
      if (!a) return false;
      var text = (String(a.title || '') + ' ' + String(a.summary || '') + ' ' + String(a.content || '')).toLowerCase();
      return text.indexOf('deploying process') === -1 && text.indexOf('omp deploying') === -1;
    });
    if (!validArticles.length) {
      root.innerHTML = '<div class="admin-empty"><h2 class="h-3">No published articles yet</h2><p class="muted" style="margin-top:8px">New posts will appear here automatically after they are published from the admin panel.</p></div>';
      return;
    }
    root.innerHTML = '<div class="admin-list">' + validArticles.map(function (a) {
      var cat = a.article_categories && a.article_categories.name ? a.article_categories.name : 'Article';
      return '<article class="admin-row" style="align-items:flex-start">' +
        '<div class="grow"><div class="ttl"><a href="/blog.html#/' + encodeURIComponent(a.slug) + '">' + esc(a.title) + '</a></div>' +
        '<div class="meta">' + esc(cat) + ' · ' + esc(fmtDate(a.published_at || a.created_at)) + ' · ' + minutes(a.content) + ' min read' + (a.document_url ? ' · 📄' : '') + '</div>' +
        (a.summary ? '<p class="muted" style="margin-top:8px">' + esc(a.summary) + '</p>' : '') +
        '</div></article>';
    }).join('') + '</div>';
  }

  function articleView(a) {
    var cat = a.article_categories && a.article_categories.name ? a.article_categories.name : 'Article';
    root.innerHTML = '<article class="card card-pad" style="max-width:900px;margin:0 auto">' +
      '<a class="btn btn-ghost btn-sm" href="/blog.html">← All articles</a>' +
      '<div style="margin-top:22px"><span class="badge badge-demo">' + esc(cat) + '</span>' +
      '<h1 class="h-1 mt-16">' + esc(a.title) + '</h1>' +
      '<div class="meta" style="margin-top:10px">' + esc(fmtDate(a.published_at || a.created_at)) + ' · ' + minutes(a.content) + ' min read</div>' +
      (a.summary ? '<p class="lead" style="margin-top:18px">' + esc(a.summary) + '</p>' : '') +
      '<div class="prose" style="margin-top:28px">' + sanitize(a.content) + '</div>' +
      (safeUrl(a.document_url) ? '<p style="margin-top:24px"><a class="btn btn-secondary" href="' + attr(safeUrl(a.document_url)) + '" download rel="noopener">📄 Download document</a></p>' : '') +
      '</div></article>';
  }

  async function load() {
    try {
      var mod = await import('https://esm.sh/@supabase/supabase-js@2');
      var client = mod.createClient(SUPABASE_URL, SUPABASE_KEY);
      var result = await client.from('articles').select('id,slug,title,summary,content,featured_image,document_url,status,published_at,created_at,article_categories(name,slug)').eq('status','published').order('published_at',{ascending:false});
      if (result.error) throw result.error;
      var articles = result.data || [];
      var hash = decodeURIComponent(location.hash.replace(/^#\//,''));
      var selected = hash ? articles.find(function (a) { return a.slug === hash; }) : null;
      if (selected) articleView(selected); else listView(articles);
    } catch (error) {
      console.error('Article feed error:', error);
      root.innerHTML = '<div class="notice-band"><p>Articles are temporarily unavailable. Please try again shortly.</p></div>';
    }
  }

  window.addEventListener('hashchange', load);
  load();
})();
