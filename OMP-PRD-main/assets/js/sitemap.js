/* ============================================================
   OopsMyPassword — /sitemap progressive enhancement.

   The static half of this page (tools, guides, site pages) is baked in
   by tools/build.py. The live half — articles and products published
   from the admin panel — cannot be baked in, so it is fetched at
   runtime from the same Supabase Edge Function that generates
   /sitemap.xml (supabase/functions/sitemap, ?format=json).

   Design rules:
     - Pure progressive enhancement. If the fetch fails, times out or is
       blocked, the section stays hidden and the static index is
       unchanged — no error banner on a page whose job is plain
       navigation.
     - Everything is inserted with createElement/textContent. Titles come
       from the database and are treated as untrusted text.
     - Only entries whose resolved URL is on this site are rendered
       (OMPUrl.sameOriginOnly), so a bad row cannot turn the sitemap page
       into an open redirect.
   ============================================================ */
(function () {
  'use strict';

  var section = document.querySelector('[data-sitemap-live]');
  var grid = document.querySelector('[data-sitemap-live-grid]');
  if (!section || !grid) return;

  /* Same Edge Function that serves /sitemap.xml; the Firebase Hosting
     proxy is XML-only, so the page talks to the function directly. */
  var ENDPOINT = 'https://aeehfulikupskyrvcpzb.supabase.co/functions/v1/sitemap?format=json';
  var TIMEOUT_MS = 8000;

  function safeHref(raw) {
    var v = String(raw == null ? '' : raw).trim();
    if (!v) return '';
    if (window.OMPUrl && window.OMPUrl.safeUrl) {
      var u = window.OMPUrl.safeUrl(v, { sameOriginOnly: true, attrSafe: true });
      return u === null ? '' : u;
    }
    return /^\/[^/]/.test(v) ? v : '';
  }

  function groupCard(title, items) {
    var col = document.createElement('div');
    col.className = 'footer-col card card-pad';

    var h = document.createElement('h4');
    h.textContent = title;
    col.appendChild(h);

    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'muted small';
      empty.textContent = 'Nothing published yet.';
      col.appendChild(empty);
      return col;
    }

    var ul = document.createElement('ul');
    items.forEach(function (item) {
      var href = safeHref(item.url);
      if (!href) return;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.setAttribute('href', href);
      a.textContent = item.title || href;
      li.appendChild(a);
      ul.appendChild(li);
    });
    if (ul.children.length) col.appendChild(ul);
    return col;
  }

  function show(data) {
    var articles = [];
    var products = [];
    var osint = [];
    var pentest = [];
    try {
      if (data && Array.isArray(data.articles)) articles = data.articles;
      if (data && Array.isArray(data.products)) products = data.products;
      if (data && Array.isArray(data.osint)) osint = data.osint;
      if (data && Array.isArray(data.pentest)) pentest = data.pentest;
    } catch (e) { /* malformed payload — nothing to add */ }

    if (!articles.length && !products.length && !osint.length && !pentest.length) return;

    grid.appendChild(groupCard('Articles', articles));
    grid.appendChild(groupCard('Products', products));
    grid.appendChild(groupCard('OSINT tools', osint));
    grid.appendChild(groupCard('Pentest tools', pentest));
    section.hidden = false;
  }

  var done = false;
  function finish() {
    if (done) return;
    done = true;
  }

  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function () {
    if (controller) { try { controller.abort(); } catch (e) { /* ignore */ } }
  }, TIMEOUT_MS);

  fetch(ENDPOINT, controller ? { signal: controller.signal } : undefined)
    .then(function (res) {
      if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
      return res.json();
    })
    .then(function (data) {
      clearTimeout(timer);
      if (done) return;
      finish();
      show(data);
    })
    .catch(function () {
      clearTimeout(timer);
      /* Silent by design — the baked-in index above is already complete
         for crawlers and for humans. */
      finish();
    });
})();
