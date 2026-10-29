/* OopsMyPassword — public products app.
   Public URL: /products (grid) and /products/<slug> (detail page).
   Internal implementation: this client-side app reading the Supabase
   `products` table (public read-only via publishable key, RLS-gated to
   published rows). Product detail URLs are real files at
   products/<slug>.html (written at deploy). Unknown slugs 404 —
   they must not rewrite to the hub or Google reports a soft 404.

   Products are COMMERCIAL/featured resources (books, courses, templates…).
   Articles are editorial/educational — the two systems do not mix.

   Security contract:
     - slugs must match the admin slugify charset before they form URLs
     - cover + purchase URLs pass the canonical scheme validator (OMPUrl)
     - full descriptions render through OMParkdown.renderSafe (escape +
       whitelist sanitize) — never raw HTML
     - private deliverables (file_path) are never selected, never linked;
       the page only notes that a secure download follows purchase

   UX contract mirrors the Articles hub: skeleton while loading, hard 10s
   timeout, error banner + Retry, and a genuine empty state ("no products
   yet") clearly distinct from a fetch failure. */
(function () {
  'use strict';
  var root = document.querySelector('[data-products]');
  if (!root) return;

  var SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
  var SITE_ORIGIN = 'https://oopsmypassword.web.app';
  var HUB_PATH = '/products';
  var BASE_TITLE = 'Products — OopsMyPassword';
  var PAGE_LIMIT = 100;
  var FETCH_TIMEOUT_MS = 10000;

  /* Canonical product types (mirrors the DB check constraint and the
     admin form). Labels are the human-facing filter chips. */
  var PRODUCT_TYPES = [
    { type: 'book',     label: 'Books' },
    { type: 'course',   label: 'Courses' },
    { type: 'tool',     label: 'Tools' },
    { type: 'template', label: 'Templates' },
    { type: 'resource', label: 'Resources' },
    { type: 'other',    label: 'Other' }
  ];
  /* Default CTA when the admin did not set one — by product type. */
  var DEFAULT_CTA = {
    book: 'Buy Now', course: 'Learn More', tool: 'Get It',
    template: 'Get It', resource: 'Learn More', other: 'Learn More'
  };

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
  function safeType(v) {
    var t = String(v == null ? '' : v).trim().toLowerCase();
    return PRODUCT_TYPES.some(function (x) { return x.type === t; }) ? t : 'other';
  }
  function typeLabel(t) {
    for (var i = 0; i < PRODUCT_TYPES.length; i++) if (PRODUCT_TYPES[i].type === t) return PRODUCT_TYPES[i].label;
    return 'Other';
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

  /* Full descriptions are authored in Markdown or HTML; both go through
     the escape-first + whitelist pipeline. Fail closed when unavailable. */
  function renderContent(source) {
    if (window.OMPMarkdown && window.OMPMarkdown.renderSafe) return window.OMPMarkdown.renderSafe(source || '');
    return window.OMPSanitize ? window.OMPSanitize(source || '') : esc(source || '');
  }

  /* Covers and purchase links must be http(s)/site-relative — the
     canonical validator (OMPUrl) is the single scheme gate. */
  function safeUrl(value, opts) {
    var v = String(value == null ? '' : value).trim();
    if (!v || /["'<>\u0000-\u0020]/.test(v)) return '';
    if (window.OMPUrl && window.OMPUrl.safeUrl) {
      var u = window.OMPUrl.safeUrl(v, opts || { attrSafe: true, noUpLevel: true, allowMailto: false });
      return u === null ? '' : u;
    }
    return /^(https?:\/\/|\/)/i.test(v) ? v : '';
  }

  /* Cover field may be a full URL *or* a path inside the public
     `products` storage bucket (covers/….jpg). Older rows stored the
     path only, so the public page showed a blank card. */
  function coverUrl(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    var https = safeUrl(raw);
    if (https) return https;
    if (/\.\.|\\|[\u0000-\u0020]/.test(raw)) return '';
    var path = raw.replace(/^\/+/, '');
    if (/^storage\/v1\/object\/public\/products\//i.test(path)) {
      return SUPABASE_URL + '/' + path;
    }
    if (/^(covers\/)?[A-Za-z0-9._/-]+\.(png|jpe?g|webp|gif)$/i.test(path)) {
      if (path.indexOf('covers/') !== 0) path = 'covers/' + path;
      return SUPABASE_URL + '/storage/v1/object/public/products/' + path;
    }
    return '';
  }

  function wireBrokenCovers(scope) {
    (scope || root).querySelectorAll('img[data-product-cover]').forEach(function (img) {
      img.addEventListener('error', function () {
        var fallback = document.createElement('span');
        fallback.className = 'product-cover-fallback';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.textContent = img.getAttribute('data-fallback') || '';
        if (img.parentNode) img.parentNode.replaceChild(fallback, img);
      });
    });
  }

  function fmtPrice(p) {
    if (p.price == null || p.price === '') return '';
    var n = Number(p.price);
    if (!isFinite(n) || n < 0) return '';
    if (n === 0) return 'Free';
    var cur = /^[A-Z]{3}$/.test(String(p.currency || '')) ? p.currency : '';
    if (!cur) return String(n);
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n);
    } catch (e) {
      return cur + ' ' + n;
    }
  }
  function ctaLabel(p) {
    var custom = String(p.cta_label || '').trim().slice(0, 40);
    if (custom) return custom;
    return DEFAULT_CTA[safeType(p.product_type)] || 'Learn More';
  }

  /* ---------- document meta (canonical / OG / twitter / JSON-LD) ---------- */
  function upsertMeta(sel, value) {
    var el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      var m = sel.match(/^meta\[(property|name)="([^"]+)"\]$/);
      if (m) el.setAttribute(m[1], m[2]);
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
    upsertMeta('meta[property="og:type"]', o.ogType || 'website');
    if (o.title != null) {
      document.title = o.title;
      upsertMeta('meta[property="og:title"]', o.title);
      upsertMeta('meta[name="twitter:title"]', o.title);
    }
    if (o.description != null) {
      upsertMeta('meta[property="og:description"]', o.description);
      upsertMeta('meta[name="twitter:description"]', o.description);
    }
    if (o.image) {
      upsertMeta('meta[property="og:image"]', o.image);
      upsertMeta('meta[name="twitter:image"]', o.image);
    }
    var robots = document.head.querySelector('meta[name="robots"]');
    if (o.noindex) {
      if (!robots) { robots = document.createElement('meta'); robots.setAttribute('name', 'robots'); document.head.appendChild(robots); }
      robots.setAttribute('content', 'noindex');
    } else if (robots && robots.parentNode) {
      robots.parentNode.removeChild(robots);
    }
  }
  /* Product structured data (schema.org/Product + Offer). Built entirely
     with DOM APIs + textContent — JSON never touches innerHTML. */
  function setProductJsonLd(p, path) {
    var old = document.getElementById('omp-product-ld');
    if (old) old.parentNode.removeChild(old);
    if (!p) return;
    var data = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: String(p.name || ''),
      description: (p.summary || plainText(p.description)).slice(0, 400),
      url: SITE_ORIGIN + path
    };
    var img = coverUrl(p.featured_image);
    if (/^https?:/i.test(img)) data.image = img;
    if (p.price != null && p.price !== '' && isFinite(Number(p.price))) {
      data.offers = {
        '@type': 'Offer',
        price: String(Number(p.price)),
        priceCurrency: /^[A-Z]{3}$/.test(String(p.currency || '')) ? p.currency : 'USD',
        availability: 'https://schema.org/InStock',
        url: url2absolute(safeUrl(p.external_url)) || (SITE_ORIGIN + path)
      };
    }
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'omp-product-ld';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }
  function url2absolute(u) {
    if (!u) return '';
    if (/^https?:/i.test(u)) return u;
    if (u.charAt(0) === '/') return SITE_ORIGIN + u;
    return '';
  }

  /* ---------- loading / error / empty states ---------- */
  function renderSkeleton() {
    var rows = '';
    for (var i = 0; i < 3; i++) {
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
      '<div><strong>Products are temporarily unavailable</strong><p>' + detail + ' <a href="' + HUB_PATH + '" style="color:var(--purple)" data-retry="1">Retry</a></p><p class="tiny muted">Still failing? An ad-blocker, VPN or network filter may be blocking our database (supabase.co) or library host (esm.sh) — try disabling them for this site.</p></div></div>';
  }

  /* ---------- views ---------- */
  var filterState = { q: '', type: '' };

  function typeChips(activeType, counts) {
    var chips = ['<button type="button" class="cat-chip' + (activeType ? '' : ' is-active') + '" data-ptype="">All</button>'];
    PRODUCT_TYPES.forEach(function (t) {
      var active = activeType === t.type;
      var n = counts[t.type] || 0;
      chips.push('<button type="button" class="cat-chip' + (active ? ' is-active' : '') + '" data-ptype="' + attr(t.type) + '"' + (active ? ' aria-pressed="true"' : '') + '>' + esc(t.label) + (n ? ' <span class="cat-count">' + n + '</span>' : '') + '</button>');
    });
    return chips.join('');
  }

  function cardHtml(p) {
    var path = productPath(p.slug);
    var cover = coverUrl(p.featured_image);
    var price = fmtPrice(p);
    var typeName = esc(typeLabel(safeType(p.product_type)).replace(/s$/, ''));
    var coverHtml = cover
      ? '<img src="' + attr(cover) + '" alt="" loading="lazy" data-product-cover data-fallback="' + typeName + '">'
      : '<span class="product-cover-fallback" aria-hidden="true">' + typeName + '</span>';
    var inner = '<div class="product-cover">' + coverHtml + '</div>' +
      '<div class="product-body">' +
      '<div class="product-meta"><span class="ptype t-' + attr(safeType(p.product_type)) + '">' + esc(typeLabel(safeType(p.product_type)).replace(/s$/, '')) + '</span>' +
      (p.featured ? '<span class="ptype t-featured">★ Featured</span>' : '') + '</div>' +
      '<h2 class="product-title">' + esc(p.name) + '</h2>' +
      (p.summary ? '<p class="product-excerpt">' + esc(p.summary) + '</p>' : '') +
      '<div class="product-foot"><span class="price">' + esc(price) + '</span><span class="read-more">View <svg class="icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span></div>' +
      '</div>';
    /* Rows whose slug cannot form a safe path render as a plain card —
       they can never be linked. */
    return path
      ? '<a class="product-card" href="' + attr(path) + '">' + inner + '</a>'
      : '<div class="product-card">' + inner + '</div>';
  }

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
          '<p class="muted">Books, courses and resources from OopsMyPassword will live here — each at <code>/products/&lt;name&gt;</code>. Free reading is in the <a href="/articles" style="color:var(--purple)">Articles hub</a>.</p></div>';
      }
      root.innerHTML = html;
      wireRetry();
      setProductJsonLd(null);
      /* A fetch failure is transient — the hub stays indexable (only a
         confirmed-empty catalog noindexes). */
      setMetaTags({ path: HUB_PATH, title: BASE_TITLE, noindex: !errorKind && !products.length });
      return;
    }

    var counts = {};
    products.forEach(function (p) { var t = safeType(p.product_type); counts[t] = (counts[t] || 0) + 1; });

    var q = filterState.q;
    var type = filterState.type;
    var visible = products.filter(function (p) {
      if (type && safeType(p.product_type) !== type) return false;
      if (q) {
        var hay = [p.name, p.slug, p.summary, typeLabel(safeType(p.product_type))].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    var featured = products.filter(function (p) { return p.featured && (!type || safeType(p.product_type) === type) && (!q || [p.name, p.summary].join(' ').toLowerCase().indexOf(q) !== -1); });

    html += '<div class="product-toolbar">' +
      '<input id="product-search" type="search" placeholder="Search products…" autocomplete="off" aria-label="Search products" value="' + attr(filterState.q) + '">' +
      '<div class="cat-bar" role="group" aria-label="Filter by product type">' + typeChips(type, counts) + '</div>' +
      '</div>';

    if (!visible.length) {
      /* Filter miss — the catalog has products, none match. Not an error. */
      html += '<div class="feed-empty"><h2 class="h-3">No products match</h2><p class="muted">Nothing matches ' + (q ? '“' + esc(q) + '”' : 'that filter') + '. Try clearing the search or picking another type.</p></div>';
    } else {
      if (featured.length >= 1 && !(type === '' && q === '' && featured.length === visible.length)) {
        html += '<h2 class="h-3" style="margin:26px 0 14px">Featured</h2><div class="product-grid">' + featured.map(cardHtml).join('') + '</div>';
      }
      var showHeading = featured.length && featured.length !== visible.length;
      html += (showHeading ? '<h2 class="h-3" style="margin:26px 0 14px">All products</h2>' : '') +
        '<div class="product-grid">' + visible.map(cardHtml).join('') + '</div>';
    }

    root.innerHTML = html;
    wireRetry();
    wireBrokenCovers(root);

    var search = root.querySelector('#product-search');
    if (search) {
      search.addEventListener('input', function () {
        filterState.q = String(search.value || '').trim().toLowerCase().slice(0, 80);
        listView(lastProducts, loadState === 'error' ? lastErrorKind : '');
        var fresh = root.querySelector('#product-search');
        if (fresh) { fresh.focus(); try { fresh.setSelectionRange(fresh.value.length, fresh.value.length); } catch (e) { /* ignore */ } }
      });
    }
    root.querySelectorAll('[data-ptype]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        filterState.type = chip.getAttribute('data-ptype') || '';
        listView(lastProducts, loadState === 'error' ? lastErrorKind : '');
      });
    });

    setProductJsonLd(null);
    setMetaTags({ path: HUB_PATH, title: BASE_TITLE, noindex: false });
  }

  function productView(p) {
    var path = productPath(p.slug) || HUB_PATH;
    var cover = coverUrl(p.featured_image);
    var link = safeUrl(p.external_url);
    var price = fmtPrice(p);
    var type = safeType(p.product_type);
    var description = (p.summary && String(p.summary).trim()) || plainText(p.description).slice(0, 300);

    /* Purchase CTA only for validated http(s)/site URLs; open off-site
       links in a safe context. Private deliverables are never linked —
       buyers receive a secure download after purchase. */
    var ctaHtml = '';
    if (link) {
      ctaHtml = '<a class="btn btn-primary btn-lg" href="' + attr(link) + '" target="_blank" rel="noopener noreferrer">' + esc(ctaLabel(p)) + ' →</a>';
    } else if (p.has_file) {
      ctaHtml = '<p class="muted"><svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Secure download delivered after purchase.</p>';
    }

    root.innerHTML = '<article class="card card-pad" style="max-width:900px;margin:0 auto">' +
      '<nav class="small muted" aria-label="Breadcrumb" style="margin-bottom:14px"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="' + HUB_PATH + '" style="color:var(--purple)">Products</a></nav>' +
      (cover ? '<img src="' + attr(cover) + '" alt="" loading="lazy" data-product-cover style="width:100%;max-height:620px;object-fit:contain;background:var(--surface);border-radius:var(--radius);margin-top:8px">' : '') +
      '<div style="margin-top:22px"><div class="product-meta"><span class="ptype t-' + attr(type) + '">' + esc(typeLabel(type).replace(/s$/, '')) + '</span>' +
      (p.featured ? '<span class="ptype t-featured">★ Featured</span>' : '') + '</div>' +
      '<h1 class="h-1 mt-16">' + esc(p.name) + '</h1>' +
      (p.summary ? '<p class="lead" style="margin-top:18px">' + esc(p.summary) + '</p>' : '') +
      '<div class="product-buy">' +
      (price ? '<span class="price price-lg">' + esc(price) + '</span>' : '') +
      ctaHtml +
      '</div>' +
      '<div class="prose" style="margin-top:28px">' + renderContent(p.description) + '</div>' +
      '</div></article>';
    if (window.OMPMarkdown && window.OMPMarkdown.demoteHeadings) {
      window.OMPMarkdown.demoteHeadings(root.querySelector('.prose'), 1);
    }
    wireBrokenCovers(root);
    setProductJsonLd(p, path);
    setMetaTags({
      path: path,
      ogType: 'product',
      title: String(p.name || 'Product') + ' — OopsMyPassword',
      description: description,
      image: cover || undefined,
      noindex: false
    });
  }

  function notFoundView(requested) {
    root.innerHTML = '<div class="feed-empty">' +
      '<svg class="icon-28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>' +
      '<h2 class="h-3">Product not found</h2>' +
      '<p class="muted" style="margin-top:8px">There’s no product at <code>/products/' + esc(safeSlug(requested) || String(requested).slice(0, 60)) + '</code>. <a href="' + HUB_PATH + '" style="color:var(--purple)">Back to products</a>.</p></div>';
    setProductJsonLd(null);
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
      clientPromise = import('https://esm.sh/@supabase/supabase-js@2.115.0')
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

  /* The deliverable's storage path is reduced to a boolean (has_file) and
     dropped immediately. Even the raw path would grant nothing — the
     product-files bucket is private with no anon read policy — but the
     page never needs it: buyers get a signed URL from the purchase
     flow, and no public link to the object is ever constructed. */
  var FIELDS = 'id,slug,name,summary,description,product_type,price,currency,cta_label,featured,featured_image,external_url,status,sort_order,published_at,created_at';
  async function fetchProducts() {
    var client = await getClient();
    var result = await client.from('products')
      .select(FIELDS + ',file_path')
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(PAGE_LIMIT);
    if (result.error) throw result.error;
    return (result.data || [])
      .filter(function (p) { return p && p.slug && String(p.name || '').trim() && safeSlug(p.slug); })
      .map(function (p) { p.has_file = !!p.file_path; delete p.file_path; return p; });
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

  async function fetchSnapshotProducts() {
    var res = await timedFetch('/assets/data/hubs-snapshot.json');
    if (!res || !res.ok) throw new Error('Snapshot unavailable');
    var snap = await res.json();
    var list = (Array.isArray(snap && snap.products) ? snap.products : [])
      .filter(function (p) { return p && p.slug && String(p.name || '').trim() && safeSlug(p.slug); });
    if (!list.length) throw new Error('Empty Products snapshot');
    return list;
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
      try {
        lastProducts = await fetchSnapshotProducts();
        loadState = 'ready';
        render();
        return;
      } catch (snapErr) { /* fall through */ }
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
