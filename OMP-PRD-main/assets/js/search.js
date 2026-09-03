/* ============================================================
   OopsMyPassword — Global Search
   One search for everything: live articles (Supabase) + the
   tools registry, plus a baked-in index of site tools, guides
   and pages. Shortcut: Ctrl+K / Cmd+K or "/". 100% client-side
   lookups for static content; article/tool rows come from the
   public Supabase REST endpoint (read-only publishable key).
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
  var CACHE_KEY = 'omp-search-live-v1';
  var CACHE_TTL = 10 * 60 * 1000; /* 10 minutes */
  var MAX_RESULTS = 12;

  /* ---------- Baked-in index: tools, guides, pages ---------- */
  var STATIC_INDEX = [
    /* Interactive tools */
    { type: 'Tool', title: 'Password Strength Checker', desc: 'Test how strong any password is — runs 100% in your browser.', url: '/checker.html', kw: 'strength test crack time checker zxcvbn weak' },
    { type: 'Tool', title: 'Password Generator', desc: 'Generate secure random passwords with a CSPRNG — 20-character default.', url: '/generator.html', kw: 'random secure create new password generator symbols numbers' },
    { type: 'Tool', title: 'Passphrase Generator', desc: 'Diceware-style passphrases from a 1296-word list.', url: '/passphrase.html', kw: 'diceware words memorable passphrase long easy to remember' },
    { type: 'Tool', title: 'Random String Generator', desc: 'Hex, Base64URL and alphanumeric strings for keys, tokens and IDs.', url: '/random-string.html', kw: 'hex base64 token api key uuid string random' },
    { type: 'Tool', title: 'Password Entropy Calculator', desc: 'Calculate entropy in bits, character pools and estimated crack times.', url: '/entropy.html', kw: 'bits pools crack time calculation entropy math' },
    { type: 'Tool', title: 'Password Health Check', desc: 'A 10-point local audit of your password habits — nothing leaves your device.', url: '/password-health.html', kw: 'audit habits reuse hygiene health checkup score' },
    { type: 'Tool', title: 'Breach Check (k-Anonymity Demo)', desc: 'See how breach lookups work with k-anonymity — SHA-1 hashed locally.', url: '/breach-check.html', kw: 'breach pwned leaked have i been k-anonymity sha1 hash demo' },
    { type: 'Tool', title: 'Security Checklist', desc: '16 habits for safer accounts, from 2FA to password manager setup.', url: '/security-checklist.html', kw: 'habits checklist 2fa safer accounts tips list' },

    /* Site pages */
    { type: 'Page', title: 'OopsMyPassword — Home', desc: 'Test, generate and learn password security — no account needed.', url: '/', kw: 'home start main free landing' },
    { type: 'Page', title: 'All Tools', desc: 'Every free, client-side tool on one page.', url: '/tools.html', kw: 'tools overview all list utilities' },
    { type: 'Page', title: 'Password Security Guides', desc: 'All security guides in one place.', url: '/guides.html', kw: 'guides learn list tutorials help' },
    { type: 'Page', title: 'Articles / Blog', desc: 'Latest articles and deep dives.', url: '/blog.html', kw: 'blog articles posts news updates' },
    { type: 'Page', title: 'About OopsMyPassword', desc: 'Privacy-first password tools — the mission.', url: '/about.html', kw: 'about team mission privacy first who' },
    { type: 'Page', title: 'Contact', desc: 'Questions, feedback or bug reports.', url: '/contact.html', kw: 'contact email support feedback report' },
    { type: 'Page', title: 'FAQ', desc: 'Frequently asked questions, answered.', url: '/faq.html', kw: 'faq questions answers help common' },
    { type: 'Page', title: 'Security Glossary', desc: 'Plain-English definitions of security terms.', url: '/glossary.html', kw: 'glossary terms definitions dictionary meaning' },
    { type: 'Page', title: 'Security & Responsible Disclosure', desc: 'How we protect the site and how to report a vulnerability.', url: '/security.html', kw: 'security disclosure report vulnerability cve responsible' },
    { type: 'Page', title: 'Privacy Policy', desc: 'What we collect (almost nothing) and why.', url: '/privacy.html', kw: 'privacy policy data collection cookies' },
    { type: 'Page', title: 'Terms of Use', desc: 'The legal bits of using OopsMyPassword.', url: '/terms.html', kw: 'terms of use legal conditions' },
    { type: 'Page', title: 'Sitemap', desc: 'Every page on the site, listed.', url: '/sitemap.html', kw: 'sitemap all pages list index' },

    /* Guides (/guides/) */
    { type: 'Guide', title: 'What to Do After a Data Breach', desc: 'Step-by-step response plan when a service you use gets breached.', url: '/guides/after-a-data-breach.html', kw: 'breach response steps stolen exposed what now' },
    { type: 'Guide', title: 'Is It Safe to Use a Password Manager?', desc: 'An honest risk breakdown of password manager safety.', url: '/guides/are-password-managers-safe.html', kw: 'risk honest safe vault manager worth it trust' },
    { type: 'Guide', title: 'How to Check If Your Password Has Been Leaked', desc: 'Check exposure safely without giving your password away.', url: '/guides/check-if-password-was-leaked.html', kw: 'leaked pwned check safely breach exposed' },
    { type: 'Guide', title: 'Common Password Mistakes (and How to Fix Them)', desc: 'The reuse, predictability and length errors people make most.', url: '/guides/common-password-mistakes.html', kw: 'reuse errors fix weak patterns mistakes' },
    { type: 'Guide', title: 'How to Create a Strong Password', desc: 'A practical recipe for passwords that resist cracking.', url: '/guides/create-strong-password.html', kw: 'create strong new secure recipe tips make' },
    { type: 'Guide', title: 'How Long Should a Password Be in 2026?', desc: 'Recommended lengths by account type — email, banking, social.', url: '/guides/how-long-should-a-password-be.html', kw: 'length characters account type email banking minimum' },
    { type: 'Guide', title: 'Passkeys Explained: Passwords Without the Password', desc: 'How passkeys work and why they beat passwords.', url: '/guides/passkeys-explained.html', kw: 'passkey fingerprint face unlock webauthn future no password' },
    { type: 'Guide', title: 'Password Security Best Practices', desc: 'The habits that actually move the security needle.', url: '/guides/password-best-practices.html', kw: 'best practices security hygiene habits guide' },
    { type: 'Guide', title: 'Password Cracking Time: How Long to Crack 8, 12 or 16 Characters?', desc: 'Cracking-time table by length and character set.', url: '/guides/password-cracking-time-table.html', kw: 'crack time 8 12 16 characters brute force table gpu' },
    { type: 'Guide', title: 'How Password Entropy Works', desc: 'Entropy explained: bits, pools and real-world randomness.', url: '/guides/password-entropy.html', kw: 'entropy bits randomness math pools explained' },
    { type: 'Guide', title: 'Password Manager Benefits — and How to Choose One', desc: 'What managers give you and how to pick a good one.', url: '/guides/password-manager-benefits.html', kw: 'choose vault benefits compare pick manager' },
    { type: 'Guide', title: 'Password vs Passkey: An Honest Comparison', desc: 'Where passkeys win, where passwords still linger.', url: '/guides/password-vs-passkey.html', kw: 'passkey comparison versus future authentication' },
    { type: 'Guide', title: 'Password vs Passphrase: Which Should You Actually Use?', desc: 'Length versus complexity — the practical answer.', url: '/guides/password-vs-passphrase.html', kw: 'passphrase which use comparison versus words' },
    { type: 'Guide', title: 'How Phishing Attacks Steal Passwords', desc: 'The anatomy of phishing and how to spot it.', url: '/guides/phishing-attacks.html', kw: 'phishing scam social engineering steal fake login' },
    { type: 'Guide', title: 'Two-Factor Authentication (2FA): What to Use and Why', desc: 'TOTP apps, hardware keys and SMS — ranked.', url: '/guides/two-factor-authentication.html', kw: '2fa otp authenticator totp sms hardware key mfa' }
  ];

  /* ---------- Live index: Supabase articles + tools registry ---------- */
  var livePromise = null;
  function fetchLive() {
    if (livePromise) return livePromise;
    livePromise = new Promise(function (resolve) {
      var items = [];
      try {
        var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
        if (cached && cached.items && Date.now() - cached.t < CACHE_TTL) { resolve(cached.items); return; }
      } catch (e) { /* storage unavailable — fall through to network */ }
      var headers = { apikey: SUPABASE_KEY };
      var qA = SUPABASE_URL + '/rest/v1/articles?select=slug,title,summary&status=eq.published&order=published_at.desc.nullslast&limit=200';
      var qT = SUPABASE_URL + '/rest/v1/tools?select=slug,name,description,route&is_active=eq.true&limit=200';
      function safeJson(r) { return r.ok ? r.json() : Promise.resolve([]); }
      Promise.all([
        fetch(qA, { headers: headers }).then(safeJson).catch(function () { return []; }),
        fetch(qT, { headers: headers }).then(safeJson).catch(function () { return []; })
      ]).then(function (res) {
        (res[0] || []).forEach(function (a) {
          if (a && a.slug) items.push({ type: 'Article', title: a.title || a.slug, desc: a.summary || '', url: '/blog.html#/' + a.slug, kw: '' });
        });
        (res[1] || []).forEach(function (t) {
          if (t && (t.slug || t.route)) items.push({ type: 'Tool', title: t.name || t.slug, desc: t.description || '', url: t.route || '/tools.html', kw: '' });
        });
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), items: items })); } catch (e) { /* ignore */ }
        resolve(items);
      }).catch(function () { resolve(items); });
    });
    return livePromise;
  }

  /* ---------- Ranking ---------- */
  function scoreItem(item, q) {
    var t = (item.title || '').toLowerCase();
    var d = (item.desc || '').toLowerCase();
    var k = (item.kw || '').toLowerCase();
    var s = 0;
    if (t === q) s += 100;
    else if (t.indexOf(q) === 0) s += 60;
    else if (t.indexOf(q) !== -1) s += 40;
    if (k.indexOf(q) !== -1) s += 25;
    if (d.indexOf(q) !== -1) s += 10;
    if (s > 0 && t.split(' ').some(function (w) { return w.indexOf(q) === 0; })) s += 15; /* word-prefix bonus */
    return s;
  }

  function searchAll(q, live) {
    var pool = STATIC_INDEX.concat(live || []);
    var scored = [];
    for (var i = 0; i < pool.length; i++) {
      var s = scoreItem(pool[i], q);
      if (s > 0) scored.push([s, pool[i]]);
    }
    scored.sort(function (a, b) { return b[0] - a[0]; });
    return scored.slice(0, MAX_RESULTS).map(function (p) { return p[1]; });
  }

  /* ---------- Styles (CSP: style-src allows 'unsafe-inline') ---------- */
  var CSS = ''
    + '.omp-search-trigger{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--border);background:var(--card);color:var(--muted);border-radius:999px;padding:7px 14px;font:inherit;font-size:13.5px;line-height:1;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease)}'
    + '.omp-search-trigger:hover{color:var(--text);border-color:var(--border-strong)}'
    + '.omp-search-trigger svg{width:14px;height:14px;flex:none}'
    + '.omp-search-trigger kbd{font:600 10.5px/1 var(--font-mono);color:var(--muted-2);border:1px solid var(--border);border-radius:5px;padding:3px 5px;background:var(--bg-soft)}'
    + '@media (max-width:860px){.omp-search-trigger kbd{display:none}.omp-search-trigger .omp-st-label{display:none}.omp-search-trigger{padding:8px 10px}}'
    + '.omp-search-overlay{position:fixed;inset:0;z-index:10000;display:flex;justify-content:center;align-items:flex-start;padding:12vh 16px 16px;background:rgba(2,6,23,.72);backdrop-filter:blur(4px)}'
    + '.omp-search-overlay[hidden]{display:none}'
    + '.omp-search-dialog{width:min(640px,100%);background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);overflow:hidden;transform:translateY(6px);opacity:0;transition:transform .18s var(--ease),opacity .18s var(--ease)}'
    + '.omp-search-overlay.omp-open .omp-search-dialog{transform:none;opacity:1}'
    + '.omp-search-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)}'
    + '.omp-search-head svg{width:18px;height:18px;color:var(--muted);flex:none}'
    + '#omp-search-input{flex:1;background:transparent;border:0;outline:0;color:var(--text);font:inherit;font-size:16px;min-width:0}'
    + '#omp-search-input::placeholder{color:var(--muted-2)}'
    + '.omp-search-esc{font:600 10.5px/1 var(--font-mono);color:var(--muted-2);border:1px solid var(--border);border-radius:5px;padding:4px 6px;background:var(--bg-soft);flex:none}'
    + '.omp-search-results{list-style:none;margin:0;padding:6px;max-height:min(55vh,420px);overflow-y:auto}'
    + '.omp-search-results li{margin:0}'
    + '.omp-sr-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);cursor:pointer;color:var(--text);text-decoration:none}'
    + '.omp-sr-row[data-active="1"]{background:var(--brand-grad-soft);box-shadow:inset 0 0 0 1px var(--border-strong)}'
    + '.omp-sr-badge{flex:none;font:700 10px/1 var(--font-sans);letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:999px}'
    + '.omp-sr-badge.b-article{color:#67E8F9;background:rgba(34,211,238,.12)}'
    + '.omp-sr-badge.b-tool{color:#A5B4FC;background:rgba(99,102,241,.14)}'
    + '.omp-sr-badge.b-guide{color:#C4B5FD;background:rgba(139,92,246,.14)}'
    + '.omp-sr-badge.b-page{color:var(--muted);background:rgba(148,163,184,.12)}'
    + '.omp-sr-main{min-width:0}'
    + '.omp-sr-title{font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.omp-sr-title mark{background:rgba(34,211,238,.22);color:inherit;border-radius:3px;padding:0 1px}'
    + '.omp-sr-desc{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.omp-sr-empty{padding:26px 16px;text-align:center;color:var(--muted);font-size:14px}'
    + '.omp-sr-foot{display:flex;gap:14px;align-items:center;padding:9px 16px;border-top:1px solid var(--border);color:var(--muted-2);font-size:11.5px;flex-wrap:wrap}'
    + '.omp-sr-foot kbd{font:600 10px/1 var(--font-mono);border:1px solid var(--border);border-radius:4px;padding:2px 4px;background:var(--bg-soft)}'
    + '@media (prefers-reduced-motion:reduce){.omp-search-dialog{transition:none}}';
  function injectStyles() {
    if (!document.getElementById('omp-search-css')) {
      var st = document.createElement('style');
      st.id = 'omp-search-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  }

  /* ---------- Runtime state ---------- */
  var overlay = null, input = null, listEl = null;
  var liveItems = [];
  var currentResults = [];
  var activeIdx = -1;
  var debounceTimer = null;
  var lastFocus = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Escape first, then wrap query matches in <mark> */
  function hi(text, q) {
    var t = escapeHtml(text);
    if (!q) return t;
    var re = new RegExp('(' + escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return t.replace(re, '<mark>$1</mark>');
  }

  function badgeClass(type) { return 'b-' + String(type || 'Page').toLowerCase(); }

  function rowHtml(item, idx, q) {
    var on = idx === activeIdx;
    return '<li role="option" aria-selected="' + on + '" data-idx="' + idx + '">' +
      '<a class="omp-sr-row" data-active="' + (on ? '1' : '0') + '" href="' + escapeHtml(item.url) + '">' +
      '<span class="omp-sr-badge ' + badgeClass(item.type) + '">' + escapeHtml(item.type) + '</span>' +
      '<span class="omp-sr-main"><span class="omp-sr-title">' + hi(item.title, q) + '</span>' +
      (item.desc ? '<span class="omp-sr-desc">' + hi(item.desc, q) + '</span>' : '') +
      '</span></a></li>';
  }

  function render() {
    if (!input || !listEl) return;
    var q = input.value.trim().toLowerCase();
    var results;
    if (q) {
      results = searchAll(q, liveItems);
    } else {
      /* No query yet: offer quick links so the dialog is useful immediately */
      results = STATIC_INDEX.filter(function (it) { return it.type === 'Page'; }).slice(0, 6);
    }
    currentResults = results;
    activeIdx = results.length ? 0 : -1;
    if (!results.length) {
      listEl.innerHTML = '<li class="omp-sr-empty">No matches for "' + escapeHtml(q) +
        '". Try "passphrase", "2fa" or "breach".</li>';
      return;
    }
    listEl.innerHTML = results.map(function (it, i) { return rowHtml(it, i, q); }).join('');
  }

  function setActive(idx) {
    var n = currentResults.length;
    if (!n) { activeIdx = -1; return; }
    activeIdx = ((idx % n) + n) % n;
    var rows = listEl.querySelectorAll('a.omp-sr-row');
    for (var i = 0; i < rows.length; i++) {
      var on = i === activeIdx;
      rows[i].setAttribute('data-active', on ? '1' : '0');
      if (rows[i].parentNode) rows[i].parentNode.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && rows[i].scrollIntoView) { try { rows[i].scrollIntoView({ block: 'nearest' }); } catch (e) { /* old browsers */ } }
    }
  }

  var TRIGGER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>';

  function openSearch() {
    if (!overlay) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(function () { if (overlay) overlay.classList.add('omp-open'); });
    document.body.style.overflow = 'hidden';
    input.value = '';
    render();
    input.focus();
    fetchLive().then(function (items) {
      liveItems = items || [];
      if (overlay && !overlay.hidden) render(); /* re-render with fresh articles/tools */
    });
  }

  function closeSearch() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('omp-open');
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }

  function onGlobalKey(e) {
    var k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 'k' || k === 'K')) {
      e.preventDefault();
      if (overlay && !overlay.hidden) closeSearch(); else openSearch();
      return;
    }
    if (k === 'Escape' && overlay && !overlay.hidden) { e.preventDefault(); closeSearch(); return; }
    if (k === '/' && (!overlay || overlay.hidden)) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      openSearch();
    }
  }

  function injectTrigger() {
    if (document.getElementById('omp-search-trigger')) return true;
    var nav = document.querySelector('header .nav-inner') || document.querySelector('.nav-inner');
    if (!nav) return false; /* page without site chrome (e.g. admin) — stay dormant */
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'omp-search-trigger';
    btn.className = 'omp-search-trigger';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-label', 'Search articles, tools and guides (Ctrl+K)');
    btn.innerHTML = TRIGGER_SVG + '<span class="omp-st-label">Search</span><kbd>Ctrl K</kbd>';
    btn.addEventListener('click', openSearch);
    /* Home is the first slot inside .nav-actions: that puts search left of
       the theme toggle and the "Get Started" CTA on desktop, and left of the
       hamburger on mobile, while inheriting the container's gap. Appending to
       .nav-inner instead would drop the button past the CTA — .btn-get-started
       is a child of .nav-actions, not of .nav-inner. */
    var actions = nav.querySelector('.nav-actions');
    if (actions) actions.insertBefore(btn, actions.firstChild);
    else {
      var anchor = nav.querySelector('.btn-get-started');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor);
      else nav.appendChild(btn);
    }

    var mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && !document.getElementById('omp-search-mobile-trigger')) {
      var mBtn = document.createElement('button');
      mBtn.type = 'button';
      mBtn.id = 'omp-search-mobile-trigger';
      mBtn.className = 'mobile-search-btn';
      mBtn.style.cssText = 'display:flex;align-items:center;justify-content:space-between;width:100%;padding:14px 18px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text);font:inherit;font-size:15px;font-weight:500;text-align:left;cursor:pointer;margin-bottom:12px;';
      mBtn.innerHTML = '<span style="display:flex;align-items:center;gap:10px">' + TRIGGER_SVG + 'Search site…</span><kbd style="font:600 10.5px var(--font-mono);color:var(--muted-2);border:1px solid var(--border);border-radius:4px;padding:2px 5px;background:var(--bg-soft)">Ctrl K</kbd>';
      mBtn.addEventListener('click', function() {
        mobileMenu.classList.remove('open');
        document.body.classList.remove('nav-open');
        var navToggle = document.querySelector('[data-nav-toggle]');
        if (navToggle) {
          navToggle.setAttribute('aria-expanded', 'false');
          var mIcon = navToggle.querySelector('.icon-menu');
          var cIcon = navToggle.querySelector('.icon-close');
          if (mIcon) mIcon.style.display = '';
          if (cIcon) cIcon.style.display = 'none';
        }
        openSearch();
      });
      mobileMenu.insertBefore(mBtn, mobileMenu.firstChild);
    }

    return true;
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'omp-search-overlay';
    overlay.className = 'omp-search-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Site search');
    overlay.innerHTML =
      '<div class="omp-search-dialog">' +
        '<div class="omp-search-head">' + TRIGGER_SVG +
          '<input id="omp-search-input" type="text" placeholder="Search articles, tools & guides…" autocomplete="off" spellcheck="false" aria-label="Search">' +
          '<span class="omp-search-esc">esc</span>' +
        '</div>' +
        '<ul class="omp-search-results" role="listbox" aria-label="Search results"></ul>' +
        '<div class="omp-sr-foot">' +
          '<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>' +
          '<span><kbd>↵</kbd> open</span>' +
          '<span><kbd>esc</kbd> close</span>' +
        '</div>' +
      '</div>';
    input = overlay.querySelector('#omp-search-input');
    listEl = overlay.querySelector('.omp-search-results');
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeSearch(); });
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(render, 80);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); }
      else if (e.key === 'Enter') {
        var item = currentResults[activeIdx];
        if (item) { closeSearch(); window.location.assign(item.url); }
      }
    });
    listEl.addEventListener('mouseover', function (e) {
      var li = e.target.closest ? e.target.closest('li[data-idx]') : null;
      if (li) setActive(parseInt(li.getAttribute('data-idx'), 10) || 0);
    });
    listEl.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a.omp-sr-row')) closeSearch(); /* let navigation proceed */
    });
    document.body.appendChild(overlay);
  }

  function initSearch() {
    injectStyles();
    if (!injectTrigger()) return;
    buildOverlay();
    document.addEventListener('keydown', onGlobalKey);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSearch);
  else initSearch();
})();


