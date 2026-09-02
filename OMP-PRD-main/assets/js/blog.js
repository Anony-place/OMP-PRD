/* ============================================================
   OopsMyPassword — dynamic articles runtime.
   Loads content/articles.json (a static file — no backend),
   merges any owner "preview on this device" drafts from
   localStorage, and renders the list + hash-routed article view.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Safe rendering: whitelist sanitizer (articles are
     authored HTML; we still strip active content defensively) ---------- */
  var ALLOWED_TAGS = new Set(['P', 'A', 'STRONG', 'B', 'EM', 'I', 'CODE', 'PRE', 'KBD', 'SAMP',
    'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'HR', 'BR', 'DIV', 'SPAN',
    'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'FIGURE', 'FIGCAPTION', 'SMALL', 'MARK', 'SUB', 'SUP']);
  var ALLOWED_ATTRS = new Set(['href', 'class', 'id', 'colspan', 'rowspan']);

  function sanitize(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    (function clean(node) {
      Array.from(node.children).forEach(function (el) {
        if (!ALLOWED_TAGS.has(el.tagName)) {
          // Replace disallowed element with its (cleaned) text content.
          var text = document.createTextNode(el.textContent || '');
          el.replaceWith(text);
          return;
        }
        Array.from(el.attributes).forEach(function (attr) {
          var name = attr.name.toLowerCase();
          var val = attr.value || '';
          if (!ALLOWED_ATTRS.has(name) || name.startsWith('on')) {
            el.removeAttribute(attr.name);
            return;
          }
          if (name === 'href' && !/^(https?:|mailto:|\/|#)/i.test(val)) {
            el.removeAttribute('href');
          }
        });
        clean(el);
      });
    })(tpl.content);
    return tpl.innerHTML;
  }
  window.OMPSanitize = sanitize;

  function slugify(s) {
    return (s || '').toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function readLocalPreviews() {
    try {
      var work = JSON.parse(localStorage.getItem('omp-admin-work') || 'null');
      var flags = JSON.parse(localStorage.getItem('omp-admin-preview') || '{}');
      if (!work || !Array.isArray(work.articles)) return [];
      return work.articles.filter(function (a) { return flags[a.slug] && a.status === 'published'; })
        .map(function (a) { a._preview = true; return a; });
    } catch (e) { return []; }
  }

  function loadArticles() {
    return fetch('/content/articles.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : { articles: [] }; })
      .then(function (data) { return Array.isArray(data.articles) ? data.articles : []; })
      .catch(function () { return []; });
  }

  function card(a) {
    var href = '/blog.html#/' + encodeURIComponent(a.slug);
    return '' +
      '<a class="card card-link guide-card" href="' + href + '">' +
      '<div class="meta"><span class="blog-tag">' + esc(a.category || 'Article') + '</span>' +
      (a._preview ? ' <span class="adm-badge adm-preview">Preview — this device only</span>' : '') +
      '</div>' +
      '<h3>' + esc(a.title) + '</h3>' +
      '<p class="muted">' + esc(a.description || '') + '</p>' +
      '<div class="meta" style="margin-top:auto;padding-top:14px"><span>' + esc(a.date || '') + '</span>' +
      (a.minutes ? '<span class="divider-dot">·</span><span>' + a.minutes + ' min read</span>' : '') + '</div>' +
      '</a>';
  }

  /* ---------- Blog listing + article view ---------- */
  var app = document.querySelector('[data-blog]');
  var homeList = document.querySelector('[data-home-articles]');

  function uniqueIds(doc) {
    // auto-generate ids for h2 headings for the TOC
    var seen = {};
    doc.querySelectorAll('h2').forEach(function (h) {
      var id = slugify(h.textContent);
      while (seen[id]) id += '-x';
      seen[id] = true;
      if (!h.id) h.id = id;
    });
    return Object.keys(seen);
  }

  function renderList(items) {
    var published = items.filter(function (a) { return a.status === 'published'; });
    published.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (!published.length) {
      app.innerHTML =
        '<div class="empty-state">' +
        '<span class="card-icon" style="margin-bottom:14px">' +
        '<svg class="icon-22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>' +
        '</span>' +
        '<h3 class="h-3">No articles published yet</h3>' +
        '<p class="muted" style="max-width:440px;margin:8px auto 0">The feed is live and ready — as soon as a post is added to <span class="mono">content/articles.json</span> it appears here instantly. Meanwhile, read the ten <a href="/guides.html" style="color:var(--purple)">core guides</a>.</p>' +
        '</div>';
      return;
    }
    app.innerHTML = '<div class="blog-grid">' + published.map(card).join('') + '</div>';
  }

  function renderArticle(item, items) {
    var holder = document.createElement('div');
    holder.innerHTML = sanitize(item.body || '');
    uniqueIds(holder);
    var heads = Array.from(holder.querySelectorAll('h2'));
    var toc = heads.length >= 2
      ? '<aside class="toc" aria-label="Table of contents"><div class="subhead-sm">On this page</div><ul>' +
        heads.map(function (h) { return '<li><a href="#' + h.id + '">' + esc(h.textContent) + '</a></li>'; }).join('') +
        '</ul></aside>'
      : '';

    document.title = item.title + ' — OopsMyPassword Articles';
    var meta = document.querySelector('meta[name="description"]');
    if (meta && item.description) meta.setAttribute('content', item.description);

    app.innerHTML =
      '<div class="container-narrow" style="max-width:none">' +
      '<a class="article-back" href="/blog.html"><svg class="icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg> All articles</a>' +
      '<div class="article-layout">' + toc +
      '<article class="prose">' +
      (item._preview ? '<div class="callout callout-warn"><p><strong>Device-local preview.</strong> Only you can see this draft here. Export it from the admin panel and publish <span class="mono">articles.json</span> to make it public.</p></div>' : '') +
      '<span class="blog-tag">' + esc(item.category || 'Article') + '</span>' +
      '<h1 class="h-1" style="margin-top:10px">' + esc(item.title) + '</h1>' +
      '<div class="article-meta"><span class="chip">' + esc(item.date || '') + '</span>' +
      (item.minutes ? '<span class="chip">' + item.minutes + ' min read</span>' : '') + '</div>' +
      '<p class="lead" style="margin-top:14px">' + esc(item.description || '') + '</p>' +
      '<hr class="hr-fade" style="margin:22px 0 6px">' +
      holder.innerHTML +
      '<hr class="hr-fade" style="margin-top:44px">' +
      '<p class="tiny muted">Published via a static JSON feed — no servers, no trackers.</p>' +
      '</article></div></div>';
    window.scrollTo(0, 0);
  }

  function route(items) {
    var m = location.hash.match(/^#\/(.+)$/);
    if (!m) { renderList(items); return; }
    var slug = decodeURIComponent(m[1]);
    var item = items.filter(function (a) { return a.slug === slug; })[0];
    if (!item) {
      app.innerHTML = '<div class="empty-state"><h3 class="h-3">Article not found</h3>' +
        '<p class="muted" style="margin-top:8px">It may have been moved or unpublished.</p>' +
        '<a class="btn btn-secondary mt-16" href="/blog.html">Back to articles</a></div>';
      return;
    }
    renderArticle(item, items);
  }

  var all = null;
  loadArticles().then(function (site) {
    var previewMap = {};
    readLocalPreviews().forEach(function (p) { previewMap[p.slug] = p; });
    var merged = site.map(function (a) {
      if (previewMap[a.slug]) {
        var p = previewMap[a.slug];
        delete previewMap[a.slug];
        return p;
      }
      return a;
    });
    Object.keys(previewMap).forEach(function (k) { merged.push(previewMap[k]); });
    all = merged;
    if (app) {
      route(all);
      window.addEventListener('hashchange', function () { route(all); });
    }
    if (homeList) {
      var pub = all.filter(function (a) { return a.status === 'published'; })
        .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
        .slice(0, 3);
      if (pub.length) {
        homeList.innerHTML = pub.map(card).join('');
        var sec = document.getElementById('latest');
        if (sec) sec.hidden = false;
      }
    }
  });
})();
