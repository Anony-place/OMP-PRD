/* OopsMyPassword — public products app.
   Public URL: /products (list) and /products/<slug> (product page).
   Internal implementation: this client-side app reading the Supabase
   `products` table (public read-only via publishable key, RLS-gated to
   published rows). The Firebase rewrite "/products{,/**}" →
   /products.html makes every slug path deep-linkable and
   refresh-safe; the app decides what to render, including a proper
   not-found view for invalid slugs.

   UX contract mirrors the Articles hub: skeleton while loading, hard
   10s timeout, error banner + Retry, and a genuine empty state ("no
   products yet") that is clearly distinct from a fetch failure. */
(function () {
  'use strict';
  var root = document.querySelector('[data-products]');
  if (!root) return;

  var SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
  var SITE_ORIGIN = 'https://oopsmypassword.com';
  var HUB_PATH = '/products';
  var BASE_TITLE = 'Products — OopsMyPassword';
  var PAGE_LIMIT = 100;
  var FETCH_TIMEOUT_MS = 10000;

  /* Slugs must be lowercase letters/digits/dashes (admin slugify).
     Anything else can never address a real product and is rejected
     before it is used in any URL. */
  var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  function safeSlug(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    return (SLUG_RE.test(s) && s.length <= 200) ? s : '';
  }
  function productPath(slug) {
    var s = safeSlug(slug);
    return s ? HUB_PATH + '/' + s : '';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function attr(s) { return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  function plainText(source) {
    if (window.OMPMarkdown && window.OMPMarkdown.plainText) return window.OMPMarkdown.plainText(source);
    try {
      var parsed = new DOMParser().parseFromString(String(source || ''), 'text/html');
      return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
      return String(source || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  function renderContent(source) {
    if (window.OMPMarkdown && window.OMPMarkdown.renderSafe) return window.OMPMarkdown.renderSafe(source || '');
    return window.OMPSanitize ? window.OMPSanitize(source || '') : '';
  }

  function safeUrl(value) {
    var v = String(value == null ? '' : value).trim();
    if (!v || /["'<>\u0000-\u0020]/.test(v)) return '';
    if (window.OMPUrl && window.OMPUrl.safeUrl) {
      var u = window.OMPUrl.safeUrl(v, { attrSafe: true, noUpLevel: true, allowMailto: false });
      return u === null ? '' : u;
    }
    return /^(https?:\/\/|\/|#)/i.test(v) ? v : '';
  }

  /* ---------- document meta ---------- */
  function upsertMeta(sel, value) {
    var el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      var m = sel.match(/^meta\[(property|name)="([^"]+)"\]$/);
      if (m) el.setAttribute(m[1], m[2]); /* property="og:url" / name="twitter:title" */
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }
  function setMetaTags(o) {
    o = o || {};
    var url = SITE_ORIGIN + (o.path || HUB_PATH);
    var link = document.head.querySelector('link[rel="canonical"]');
    if (link) link.setAttribute('href', url);
    upsertMeta('meta[property="og:url"]', url);
    if (o.title != null) {
      document.title = o.title;
      upsertMeta('meta[property="og:title"]', o.title);
      upsertMeta('meta[name="twitter:title"]', o.title);
    }
    if (o.description != null) {
      upsertMeta('meta[property="og:description"]', o.description);
      upsertMeta('meta[name="twitter:description"]', o.description);
    }
    var robots = document.head.querySelector('meta[name="robots"]');
    if (o.noindex) {
      if (!robots) { robots = document.createElement('meta'); robots.setAttribute('name', 'robots'); document.head.appendChild(robots); }
      robots.setAttribute('content', 'noindex');
    } else if (robots && robots.parentNode) {
      robots.parentNode.removeChild(robots);
    }
  }

  /* ---------- loading / error / empty states ---------- */
  function renderSkeleton() {
    var rows = '';
    for (var i = 0; i < 2; i++) {
      rows += '<div class="feed-row is-loading" aria-hidden="true"><div class="feed-row-main">' +
        '<div class="skel skel-title' + (i % 2 ? ' skel-w70' : '') + '"></div><div class="skel skel-meta"></div>' +
        '<div class="skel skel-line"></div><div class="skel skel-line skel-w70"></div></div></div>';
    }
    root.innerHTML = '<div class="sr-only" role="status" aria-live="polite">Loading products…</div>' + rows;
    document.title = BASE_TITLE;
  }

  function errorBanner(kind) {
    var detail = kind === 'timeout'
      ? 'The product catalog didn’t respond within ' + Math.round(FETCH_TIMEOUT_MS / 1000) + ' seconds.'
      : 'The product catalog could not be reached right now.';
    return '<div class="notice-band notice-error" role="alert">' +
      '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>' +
      '<div><strong>Products are temporarily unavailable</strong><p>' + detail + ' <a href="' + HUB_PATH + '" style="color:var(--purple)" data-retry="1">Retry</a></p></div></div>';
  }

  /* ---------- views ---------- */
  function listView(products, errorKind) {
    var html = '';
    if (errorKind) html += errorBanner(errorKind);
    if (!products.length) {
      if (errorKind) {
        html += '<div class="feed-empty"><h2 class="h-3">Can’t load products right now</h2><p class="muted">The catalog is unreachable — that’s a connection problem, not an empty catalog. Use Retry above.</p></div>';
      } else {
        /* Genuine empty state: the catalog answered, nothing is published. */
        html += '<div class="feed-empty">' +
          '<svg class="icon-28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
          '<h2 class="h-3">No products yet</h2>' +
          '<p class="muted">When OopsMyPassword ships something worth buying — a book, a course, a toolkit — it will live at <code>/products/&lt;name&gt;</code>. Nothing is for sale today.</p></div>';
      }
    } else {
      html += '<div class="feed-list">' + products.map(function (p) {
        var path = productPath(p.slug);
        var head = path ? '<h2 class="feed-title"><a href="' + attr(path) + '">' + esc(p.name) + '</a></h2>' : '<h2 class="feed-title">' + esc(p.name) + '</h2>';
        return '<article class="feed-row"><div class="feed-row-main">' +
          '<div class="feed-meta"><span class="badge badge-demo">Product</span></div>' + head +
          (p.summary ? '<p class="feed-excerpt">' + esc(p.summary) + '</p>' : '') +
          '</div></article>';
      }).join('') + '</div>';
    }
    root.innerHTML = html;
    wireRetry();
    setMetaTags({ path: HUB_PATH, title: BASE_TITLE, noindex: !products.length });
  }

  function productView(p) {
    var image = safeUrl(p.featured_image);
    var link = safeUrl(p.external_url);
    var description = (p.summary && String(p.summary).trim()) || plainText(p.description).slice(0, 300);
    root.innerHTML = '<article class="card card-pad" style="max-width:900px;margin:0 auto">' +
      '<nav class="small muted" aria-label="Breadcrumb" style="margin-bottom:14px"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="' + HUB_PATH + '" style="color:var(--purple)">Products</a></nav>' +
      (image ? '<img src="' + attr(image) + '" alt="" loading="lazy" style="width:100%;border-radius:var(--radius);margin-top:20px">' : '') +
      '<div style="margin-top:22px"><span class="badge badge-demo">Product</span>' +
      '<h1 class="h-1 mt-16">' + esc(p.name) + '</h1>' +
      (p.summary ? '<p class="lead" style="margin-top:18px">' + esc(p.summary) + '</p>' : '') +
      '<div class="prose" style="margin-top:28px">' + renderContent(p.description) + '</div>' +
      (link ? '<p style="margin-top:24px"><a class="btn btn-primary" href="' + attr(link) + '" target="_blank" rel="noopener noreferrer">Get it →</a></p>' : '') +
      '</div></article>';
    if (window.OMPMarkdown && window.OMPMarkdown.demoteHeadings) {
      window.OMPMarkdown.demoteHeadings(root.querySelector('.prose'), 1);
    }
    setMetaTags({ path: productPath(p.slug) || HUB_PATH, title: String(p.name || 'Product') + ' — OopsMyPassword', description: description, noindex: false });
  }

  function notFoundView(requested) {
    root.innerHTML = '<div class="feed-empty">' +
      '<svg class="icon-28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>' +
      '<h2 class="h-3">Product not found</h2>' +
      '<p class="muted" style="margin-top:8px">There’s no product at <code>/products/' + esc(safeSlug(requested) || String(requested).slice(0, 60)) + '</code>. <a href="' + HUB_PATH + '" style="color:var(--purple)">Back to products</a>.</p></div>';
    setMetaTags({ path: location.pathname, title: 'Product not found — OopsMyPassword', noindex: true });
  }

  function slugErrorView(kind) {
    root.innerHTML = errorBanner(kind) +
      '<div class="feed-empty"><h2 class="h-3">Can’t load this product right now</h2>' +
      '<p class="muted" style="margin-top:8px">The catalog is unreachable — that’s a connection problem, not a missing product. <a href="' + HUB_PATH + '" style="color:var(--purple)">Back to products</a>.</p></div>';
    wireRetry();
    document.title = 'Products are temporarily unavailable — OopsMyPassword';
    /* Transient error on a possibly-real URL: keep it self-canonical. */
    setMetaTags({ path: location.pathname });
  }

  function wireRetry() {
    var btn = root.querySelector('[data-retry]');
    if (!btn || btn.getAttribute('data-retry') === 'off') return;
    btn.setAttribute('data-retry', 'off');
    btn.addEventListener('click', function (ev) { ev.preventDefault(); retry(); });
  }

  /* ---------- data ---------- */
  var clientPromise = null;
  function getClient() {
    if (!clientPromise) {
      clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
        .then(function (mod) { return mod.createClient(SUPABASE_URL, SUPABASE_KEY, { global: { fetch: timedFetch } }); })
        .catch(function (e) { clientPromise = null; throw e; });
    }
    return clientPromise;
  }
  function timedFetch(input, init) {
    if (typeof AbortController === 'undefined' || typeof fetch !== 'function') return fetch(input, init);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) { /* ignore */ } }, FETCH_TIMEOUT_MS);
    var p = fetch(input, Object.assign({}, init || {}, { signal: ctrl.signal }));
    var clear = function () { clearTimeout(timer); };
    p.then(clear, clear);
    return p;
  }
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () { if (!settled) { settled = true; reject({ isTimeout: true }); } }, ms);
      promise.then(function (v) { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } },
                    function (e) { if (!settled) { settled = true; clearTimeout(timer); reject(e); } });
    });
  }
  function isTimeoutError(e) {
    return !!(e && (e.isTimeout || e.name === 'AbortError' || (e.message && /aborted|timeout/i.test(String(e.message)))));
  }

  var FIELDS = 'id,slug,name,summary,description,featured_image,external_url,status,sort_order,created_at';
  async function fetchProducts() {
    var client = await getClient();
    var result = await client.from('products')
      .select(FIELDS)
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .limit(PAGE_LIMIT);
    if (result.error) throw result.error;
    return (result.data || []).filter(function (p) { return p && p.slug && String(p.name || '').trim() && safeSlug(p.slug); });
  }

  /* ---------- controller ---------- */
  var lastProducts = [];
  var loadState = 'idle';
  var lastErrorKind = '';

  function route() {
    var m = (location.pathname || '').match(/^\/products\/([^/]+)\/?$/);
    if (!m) return { slug: '' };
    var slug = '';
    try { slug = decodeURIComponent(m[1]); } catch (e) { slug = m[1]; }
    return { slug: slug, invalid: !safeSlug(slug) };
  }

  function render() {
    var r = route();
    if (r.slug && !r.invalid) {
      var p = lastProducts.find(function (x) { return x.slug === r.slug; });
      if (p) productView(p);
      else if (loadState === 'error') slugErrorView(lastErrorKind);
      else notFoundView(r.slug);
      return;
    }
    if (r.invalid) { notFoundView(r.slug); return; }
    listView(lastProducts, loadState === 'error' ? lastErrorKind : '');
  }

  async function load() {
    if (loadState === 'loading') return;
    loadState = 'loading';
    renderSkeleton();
    try {
      lastProducts = await withTimeout(fetchProducts(), FETCH_TIMEOUT_MS);
      loadState = 'ready';
      render();
    } catch (error) {
      console.error('Product catalog error:', error);
      lastErrorKind = isTimeoutError(error) ? 'timeout' : 'network';
      loadState = 'error';
      lastProducts = [];
      render();
    }
  }
  function retry() { clientPromise = null; load(); }

  window.addEventListener('popstate', function () { if (loadState !== 'loading') render(); });

  load();
})();
