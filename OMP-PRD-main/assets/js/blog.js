/* OopsMyPassword — Supabase-backed public article feed.
   Articles is the single content hub: live posts from Supabase PLUS the
   baked-in static guides (/guides/*.html), classified under the "Guides"
   category and filterable alongside News / Security / Deep Dives / How-To.

   Articles may be authored in Markdown OR HTML; both are rendered
   through window.OMPMarkdown.renderSafe(), which escapes first and
   then applies the whitelist sanitizer (assets/js/sanitize.js).

   UX contract (see blog.html):
     - a skeleton is shown while loading (never an indefinite spinner)
     - a fetch that hangs is aborted after FETCH_TIMEOUT_MS and treated
       as a failure (timeout ≠ empty)
     - a failure shows an error banner with a Retry button — the static
       guides stay listed below it so the page is never dead
     - a successful fetch with zero published articles is a genuine
       empty state (different copy, no Retry, no error styling) */
(function () {
  'use strict';
  var root = document.querySelector('[data-blog]');
  if (!root) return;

  var SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
  var BASE_TITLE = 'Articles — OopsMyPassword';
  var PAGE_LIMIT = 200;
  var FETCH_TIMEOUT_MS = 10000;

  /* The canonical category set. The five slugs are seeded in
     supabase/00_schema_migrations.sql; categories coming from the
     database are merged into this list (canonical order wins, unknown
     ones are appended). "guides" is reserved for the static guides. */
  var CANONICAL_CATEGORIES = [
    { name: 'News', slug: 'news' },
    { name: 'Security', slug: 'security' },
    { name: 'Deep Dives', slug: 'deep-dives' },
    { name: 'How-To', slug: 'how-to' },
    { name: 'Guides', slug: 'guides' }
  ];

  /* Static guides — full standalone pages under /guides/. They are real
     articles in this hub (category "Guides"); they simply render from
     static HTML instead of the database, so they work offline and rank
     on their own URLs. Kept in sync with the /guides/ directory. */
  var STATIC_GUIDES = [
    { slug: 'create-strong-password', title: 'How to Create a Strong Password', minutes: 7, summary: 'What actually makes a password strong in 2026 — length, uniqueness and randomness — with concrete examples you can copy.' },
    { slug: 'password-best-practices', title: 'Password Security Best Practices', minutes: 8, summary: 'The ten habits that prevent almost all account takeovers — from unique passwords and managers to 2FA and breach response.' },
    { slug: 'common-password-mistakes', title: 'Common Password Mistakes (and How to Fix Them)', minutes: 6, summary: 'The seven patterns cracking software exploits first — reuse, personal details, keyboard walks, and ‘clever’ substitutions that aren’t.' },
    { slug: 'how-long-should-a-password-be', title: 'How Long Should a Password Be in 2026? (By Account Type)', minutes: 6, summary: 'The quick answer: 16+ characters for anything important, 12 as an absolute floor — with a per-account table and the math that explains why length beats complexity.' },
    { slug: 'password-vs-passphrase', title: 'Password vs Passphrase: Which Should You Actually Use?', minutes: 6, summary: 'For anything you must memorize, a passphrase wins; for everything else, a random password in a manager does. The comparison table and entropy math that settle it.' },
    { slug: 'password-manager-benefits', title: 'Password Manager Benefits — and How to Choose One', minutes: 7, summary: 'Why a password manager is the single biggest upgrade to your security, how it protects you beyond storage, and what to look for when choosing.' },
    { slug: 'are-password-managers-safe', title: 'Is It Safe to Use a Password Manager? (Honest Risk Breakdown)', minutes: 7, summary: 'Yes — safer than any realistic alternative. How zero-knowledge vaults protect you even when providers are breached, what the real risks are, and how to set one up safely.' },
    { slug: 'two-factor-authentication', title: 'Two-Factor Authentication (2FA): What to Use and Why', minutes: 7, summary: 'SMS codes, authenticator apps, push approvals and hardware keys — how each factor type stacks up, and how to set 2FA up without locking yourself out.' },
    { slug: 'passkeys-explained', title: 'Passkeys Explained: Passwords Without the Password', minutes: 8, summary: 'What passkeys actually are, how the public-key cryptography behind them defeats phishing, and how to start using them today.' },
    { slug: 'password-vs-passkey', title: 'Password vs Passkey: An Honest Comparison', minutes: 6, summary: 'Side-by-side on security, usability, recovery and support — where passkeys win, where passwords still linger, and how to navigate the transition.' },
    { slug: 'after-a-data-breach', title: 'What to Do After a Data Breach', minutes: 7, summary: 'A calm, ordered playbook for the hours and days after a service you use loses your data — including password resets, sessions and scam watch.' },
    { slug: 'check-if-password-was-leaked', title: 'How to Check If Your Password Has Been Leaked (Safely)', minutes: 6, summary: 'How k-anonymity lets you check a password against billions of breached records without ever revealing it — plus what to do in the first hour if yours shows up.' },
    { slug: 'phishing-attacks', title: 'How Phishing Attacks Steal Passwords', minutes: 7, summary: 'The anatomy of modern phishing — lookalike domains, urgency scripts, OAuth consent tricks and MFA-relay proxies — and the defenses that actually work.' },
    { slug: 'password-entropy', title: 'How Password Entropy Works', minutes: 8, summary: 'The math behind ‘bits of entropy’ — H = L·log₂(N) — with worked examples, attacker models, and why meter scores and entropy are not the same thing.' },
    { slug: 'password-cracking-time-table', title: 'Password Cracking Time: How Long to Crack 8, 12 or 16 Characters?', minutes: 7, summary: 'See exactly how long a GPU rig needs to crack passwords by length and character type — plus the two changes that move you from minutes to millennia.' }
  ];
  var STATIC_GUIDE_DATE = '2026-08-23';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  /* Attribute-context escaping (esc() alone does not escape quotes). */
  function attr(s) {
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    if (!v || /["'<>\u0000-\u0020]/.test(v)) return '';
    if (window.OMPUrl && window.OMPUrl.safeUrl) {
      var u = window.OMPUrl.safeUrl(v, { attrSafe: true, noUpLevel: true, allowMailto: false });
      return u === null ? '' : u;
    }
    return /^(https?:\/\/|\/|#)/i.test(v) ? v : '';
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

  function categorySlug(a) {
    var c = a.article_categories;
    if (Array.isArray(c)) c = c[0];
    return c && c.slug ? String(c.slug) : '';
  }

  /* ---------------- feed assembly ---------------- */

  function staticGuideItems() {
    return STATIC_GUIDES.map(function (g) {
      return {
        kind: 'static',
        slug: g.slug,
        title: g.title,
        summary: g.summary,
        content: '',
        url: '/guides/' + g.slug + '.html',
        categoryName: 'Guides',
        categorySlug: 'guides',
        published_at: STATIC_GUIDE_DATE,
        minutes: g.minutes,
        featured_image: '',
        document_url: ''
      };
    });
  }

  function normalizeDbItem(a) {
    return {
      kind: 'db',
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      content: a.content,
      url: '/blog.html#/' + encodeURIComponent(a.slug),
      categoryName: categoryName(a),
      categorySlug: categorySlug(a),
      published_at: a.published_at || a.created_at,
      minutes: minutes(a.content),
      featured_image: a.featured_image,
      document_url: a.document_url
    };
  }

  function byDateDesc(x, y) {
    var dx = Date.parse(x.published_at || '') || 0;
    var dy = Date.parse(y.published_at || '') || 0;
    return dy - dx || String(x.title).localeCompare(String(y.title));
  }

  function mergeCategories(dbCategories) {
    var bySlug = {};
    CANONICAL_CATEGORIES.forEach(function (c) { bySlug[c.slug] = { name: c.name, slug: c.slug, order: CANONICAL_CATEGORIES.indexOf(c) }; });
    (dbCategories || []).forEach(function (c, i) {
      if (!c || !c.slug) return;
      if (bySlug[c.slug]) {
        if (c.name) bySlug[c.slug].name = c.name; /* DB is the source of truth for labels */
      } else {
        bySlug[c.slug] = { name: c.name || c.slug, slug: c.slug, order: CANONICAL_CATEGORIES.length + i };
      }
    });
    return Object.keys(bySlug).map(function (k) { return bySlug[k]; }).sort(function (a, b) { return a.order - b.order; });
  }

  /* ---------------- routing (hash) ---------------- */

  /* Only "#/…" hashes are routes: "#/slug" opens an article and
     "#/c/<category>" filters the list. Plain in-page anchors
     ("#main", "#checker") must not trigger a feed reload. */
  function route() {
    var h = location.hash || '';
    if (h.slice(0, 2) !== '#/') return { cat: '', slug: '' };
    var rest = h.slice(2);
    if (rest.slice(0, 2) === 'c/') {
      var cat = rest.slice(2).split(/[\/?&]/)[0];
      try { return { cat: decodeURIComponent(cat), slug: '' }; } catch (e) { return { cat: cat, slug: '' }; }
    }
    try { return { cat: '', slug: decodeURIComponent(rest) }; } catch (e) { return { cat: '', slug: rest }; }
  }

  /* ---------------- loading states ---------------- */

  var SKELETON_ROWS = 4;
  function renderSkeleton() {
    var rows = '';
    for (var i = 0; i < SKELETON_ROWS; i++) {
      rows += '<div class="feed-row is-loading" aria-hidden="true">' +
        '<div class="feed-row-main">' +
        '<div class="skel skel-title' + (i % 2 ? ' skel-w70' : '') + '"></div>' +
        '<div class="skel skel-meta"></div>' +
        '<div class="skel skel-line"></div>' +
        '<div class="skel skel-line skel-w70"></div>' +
        '</div></div>';
    }
    root.innerHTML = '<div class="sr-only" role="status" aria-live="polite">Loading articles…</div>' + rows;
    document.title = BASE_TITLE;
  }

  function errorBanner(kind, retryId) {
    var heading = 'Articles are temporarily unavailable';
    var detail = kind === 'timeout'
      ? 'The article feed didn’t respond within ' + Math.round(FETCH_TIMEOUT_MS / 1000) + ' seconds.'
      : 'The article feed could not be reached right now.';
    return '<div class="notice-band notice-error" role="alert">' +
      '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>' +
      '<div><strong>' + heading + '</strong><p>' + detail + ' This looks like a connection problem on our side — not an empty shelf. <a href="/blog.html" style="color:var(--purple)" data-retry="' + retryId + '">Retry</a></p></div>' +
      '</div>';
  }

  /* ---------------- views ---------------- */

  function chipBar(categories, activeCat, counts) {
    var chips = ['<a class="cat-chip' + (activeCat ? '' : ' is-active') + '" href="#" data-cat="">All</a>'];
    categories.forEach(function (c) {
      var active = activeCat === c.slug;
      var count = counts[c.slug] || 0;
      chips.push('<a class="cat-chip' + (active ? ' is-active' : '') + '" href="/blog.html#/c/' + attr(encodeURIComponent(c.slug)) + '" data-cat="' + attr(c.slug) + '"' + (active ? ' aria-current="true"' : '') + '>' + esc(c.name) + (count ? ' <span class="cat-count">' + count + '</span>' : '') + '</a>');
    });
    return '<nav class="cat-bar" aria-label="Filter articles by category">' + chips.join('') + '</nav>';
  }

  function rowHtml(a) {
    var note = excerpt(a);
    var doc = safeUrl(a.document_url) ? ' · 📄' : '';
    var href = a.kind === 'static' ? safeUrl(a.url) : '/blog.html#/' + attr(encodeURIComponent(a.slug));
    return '<article class="feed-row">' +
      '<div class="feed-row-main">' +
      '<div class="feed-meta"><span class="badge badge-demo">' + esc(a.categoryName) + '</span><span>' + esc(fmtDate(a.published_at)) + '</span><span>·</span><span>' + esc(a.minutes) + ' min read' + doc + '</span></div>' +
      '<h2 class="feed-title"><a href="' + attr(href) + '">' + esc(a.title) + '</a></h2>' +
      (note ? '<p class="feed-excerpt">' + esc(note) + '</p>' : '') +
      '</div></article>';
  }

  function listView(articles, categories, activeCat, opts) {
    var o = opts || {};
    document.title = activeCat
      ? (activeCatName(categories, activeCat) + ' — Articles — OopsMyPassword')
      : BASE_TITLE;

    var counts = {};
    articles.forEach(function (a) { if (a.categorySlug) counts[a.categorySlug] = (counts[a.categorySlug] || 0) + 1; });

    var visible = activeCat ? articles.filter(function (a) { return a.categorySlug === activeCat; }) : articles;
    var html = chipBar(categories, activeCat, counts);

    if (o.error) html += errorBanner(o.error, 'retry-1');

    if (!visible.length) {
      if (o.error) {
        /* The live feed FAILED — we cannot claim this category is empty.
           Keep the distinction: fetch failure ≠ zero published articles. */
        html += '<div class="feed-empty">' +
          '<svg class="icon-28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>' +
          '<h2 class="h-3">Can’t load this category right now</h2>' +
          '<p class="muted">The live article feed is unavailable, so we can’t tell whether ' + (activeCat ? esc(activeCatName(categories, activeCat)) + ' has' : 'there are') + ' published posts. Use Retry above.</p>' +
          '</div>';
      } else {
        /* Genuine empty state: the feed answered, there is simply nothing
           published here (yet). Deliberately NOT an error — no Retry. */
        html += '<div class="feed-empty">' +
          '<svg class="icon-28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>' +
          '<h2 class="h-3">Nothing here yet</h2>' +
          '<p class="muted">' + (activeCat
            ? 'No ' + esc(activeCatName(categories, activeCat)) + ' articles have been published yet. New pieces appear here automatically once they go live.'
            : 'No published articles yet. New posts appear here automatically after they are published from the admin panel.') + '</p>' +
          (activeCat ? '<p class="muted" style="margin-top:6px">Meanwhile, the <a href="/blog.html#/c/guides" style="color:var(--purple)">Guides</a> category has plenty to read.</p>' : '') +
          '</div>';
      }
    } else {
      html += '<div class="feed-list">' + visible.map(rowHtml).join('') + '</div>';
    }
    root.innerHTML = html;
    wireRetry();
  }

  function activeCatName(categories, slug) {
    for (var i = 0; i < categories.length; i++) if (categories[i].slug === slug) return categories[i].name;
    return slug;
  }

  function articleView(a) {
    var image = safeUrl(a.featured_image);
    document.title = String(a.title || 'Article') + ' — OopsMyPassword';
    root.innerHTML = '<article class="card card-pad" style="max-width:900px;margin:0 auto">' +
      '<nav class="small muted" aria-label="Breadcrumb" style="margin-bottom:14px"><a href="/blog.html" style="color:var(--purple)">Articles</a>' +
      (a.categorySlug ? ' <span class="divider-dot">/</span> <a href="/blog.html#/c/' + attr(encodeURIComponent(a.categorySlug)) + '" style="color:var(--purple)">' + esc(a.categoryName) + '</a>' : '') +
      '</nav>' +
      (image ? '<img src="' + attr(image) + '" alt="" loading="lazy" style="width:100%;border-radius:var(--radius);margin-top:20px">' : '') +
      '<div style="margin-top:22px"><span class="badge badge-demo">' + esc(a.categoryName) + '</span>' +
      '<h1 class="h-1 mt-16">' + esc(a.title) + '</h1>' +
      '<div class="meta" style="margin-top:10px">' + esc(fmtDate(a.published_at)) + ' · ' + esc(a.minutes) + ' min read</div>' +
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

  function notFoundView() {
    /* Deep link to an unpublished/removed article: don't show a blank page. */
    root.innerHTML = '<div class="feed-empty">' +
      '<h2 class="h-3">Article not found</h2>' +
      '<p class="muted" style="margin-top:8px">It may have been unpublished or moved. <a href="/blog.html" style="color:var(--purple)">Back to all articles</a>.</p>' +
      '</div>';
    document.title = 'Article not found — OopsMyPassword';
  }

  /* Retry button (error state only). The whole feed re-enters the
     skeleton state and refetches — no page reload needed. */
  function wireRetry() {
    var btn = root.querySelector('[data-retry]');
    if (!btn || btn.getAttribute('data-retry') === 'off') return;
    btn.setAttribute('data-retry', 'off');
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      retry();
    });
  }

  /* ---------------- data ---------------- */

  var clientPromise = null;
  function getClient() {
    if (!clientPromise) {
      clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
        .then(function (mod) { return mod.createClient(SUPABASE_URL, SUPABASE_KEY, { global: { fetch: timedFetch } }); })
        .catch(function (e) { clientPromise = null; throw e; });
    }
    return clientPromise;
  }

  /* Per-request hard deadline: a request that has not settled within
     FETCH_TIMEOUT_MS is aborted, so a hung API can never leave the
     feed in "Loading articles…" forever. */
  function timedFetch(input, init) {
    if (typeof AbortController === 'undefined' || typeof fetch !== 'function') {
      return fetch(input, init);
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) { /* ignore */ } }, FETCH_TIMEOUT_MS);
    var p = fetch(input, Object.assign({}, init || {}, { signal: ctrl.signal }));
    var clear = function () { clearTimeout(timer); };
    p.then(clear, clear);
    return p;
  }

  /* Second safety net around the WHOLE load (dynamic import + query):
     rejects with { isTimeout: true } even if abort events never fire. */
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject({ isTimeout: true });
      }, ms);
      promise.then(function (v) {
        if (settled) return;
        settled = true; clearTimeout(timer); resolve(v);
      }, function (e) {
        if (settled) return;
        settled = true; clearTimeout(timer); reject(e);
      });
    });
  }

  function isTimeoutError(e) {
    return !!(e && (e.isTimeout || e.name === 'AbortError' || (e.message && /aborted|timeout/i.test(String(e.message)))));
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

  /* Categories power the filter chips. Failure here is non-fatal: the
     canonical five still render (Guides always has content). */
  async function fetchCategories(client) {
    var result = await client.from('article_categories')
      .select('name,slug,sort_order')
      .order('sort_order', { ascending: true })
      .limit(50);
    if (result.error) throw result.error;
    return result.data || [];
  }

  /* ---------------- controller ---------------- */

  var lastArticles = [];    /* db rows + static guides, newest first */
  var lastCategories = mergeCategories([]);
  var loadState = 'idle';   /* idle | loading | ready | error */
  var lastErrorKind = '';

  function render() {
    var r = route();
    if (r.slug) {
      var selected = lastArticles.find(function (a) { return a.kind === 'db' && a.slug === r.slug; });
      if (selected) articleView(selected); else notFoundView();
      return;
    }
    var cat = lastCategories.some(function (c) { return c.slug === r.cat; }) ? r.cat : (r.cat ? '' : '');
    listView(lastArticles, lastCategories, cat, { error: loadState === 'error' ? lastErrorKind : '' });
  }

  function errorFallback() {
    /* Fetch failure ≠ empty feed: keep the static guides visible under
       the error banner so the hub still delivers value offline. */
    lastArticles = staticGuideItems();
    lastCategories = mergeCategories([]);
    loadState = 'error';
    render();
  }

  async function load() {
    if (loadState === 'loading') return;
    loadState = 'loading';
    renderSkeleton();
    try {
      var articles = await withTimeout(fetchArticles(), FETCH_TIMEOUT_MS);
      var dbItems = (articles || []).filter(isRenderable).map(normalizeDbItem);
      lastArticles = staticGuideItems().concat(dbItems).sort(byDateDesc);
      /* Reuse the same client for the (non-critical) category lookup. */
      try {
        var client = await getClient();
        var cats = await withTimeout(fetchCategories(client), FETCH_TIMEOUT_MS);
        lastCategories = mergeCategories(cats);
      } catch (catErr) {
        console.warn('Category lookup failed (non-fatal):', catErr);
        lastCategories = mergeCategories([]);
      }
      loadState = 'ready';
      render();
    } catch (error) {
      console.error('Article feed error:', error);
      lastErrorKind = isTimeoutError(error) ? 'timeout' : 'network';
      errorFallback();
    }
  }

  function retry() {
    /* Drop any cached client so Retry starts a clean connection. */
    clientPromise = null;
    load();
  }

  /* Re-render in place on hash change; only refetch when we have
     nothing cached yet. */
  var lastHash = location.hash;
  window.addEventListener('hashchange', function () {
    if (location.hash === lastHash) return;
    lastHash = location.hash;
    if (loadState === 'ready' || loadState === 'error') render();
    else if (loadState !== 'loading') load();
  });

  load();
})();
