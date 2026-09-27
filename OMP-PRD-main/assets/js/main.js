/* ============================================================
   OopsMyPassword — shared UI behaviors.
   No passwords are ever read or touched in this file.
   ============================================================ */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme ---------- */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('omp-theme', t); } catch (e) { /* private mode */ }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#F6F8FC' : '#050811');
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
  });

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.querySelector('[data-nav-toggle]');
  var mobileMenu = document.getElementById('mobile-menu');
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      document.body.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      navToggle.querySelector('.icon-menu').style.display = open ? 'none' : '';
      navToggle.querySelector('.icon-close').style.display = open ? '' : 'none';
    });
    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        mobileMenu.classList.remove('open');
        document.body.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.querySelector('.icon-menu').style.display = '';
        navToggle.querySelector('.icon-close').style.display = 'none';
      }
    });
  }

  /* ---------- Learning navigation ---------- */
  function ensureLearningLink(nav) {
    if (!nav || nav.querySelector('a[href="/learning"]')) return;
    var link = document.createElement('a');
    link.href = '/learning';
    link.textContent = 'Learning';
    var products = nav.querySelector('a[href="/products"]');
    if (products && products.parentNode) products.parentNode.insertBefore(link, products.nextSibling);
    else nav.appendChild(link);
  }
  ensureLearningLink(document.querySelector('.nav-links'));
  ensureLearningLink(document.querySelector('.mobile-menu'));

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && !reducedMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Toast ---------- */
  var toastEl = null;
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.innerHTML = '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span></span>';
      document.body.appendChild(toastEl);
    }
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }
  window.ompToast = toast;

  /* ---------- Clipboard ---------- */
  window.ompCopy = function (text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast(okMsg || 'Copied to clipboard'); }
      catch (e) { toast('Copy failed — select and copy manually'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast(okMsg || 'Copied to clipboard'); },
        fallback
      );
    } else fallback();
  };

  /* ---------- Range slider fill ---------- */
  function paintSlider(sl) {
    var min = Number(sl.min || 0), max = Number(sl.max || 100), val = Number(sl.value);
    var pct = ((val - min) / (max - min)) * 100;
    sl.style.setProperty('--fill', pct + '%');
  }
  document.querySelectorAll('input[type="range"]').forEach(function (sl) {
    paintSlider(sl);
    sl.addEventListener('input', function () { paintSlider(sl); });
  });

  /* ---------- TOC scrollspy (guide pages) ---------- */
  var toc = document.querySelector('.toc');
  if (toc) {
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var targets = links
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);
    if (targets.length && 'IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            links.forEach(function (a) {
              a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id);
            });
          }
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      targets.forEach(function (t) { spy.observe(t); });
    }
  }

  /* ---------- Animated counters ---------- */
  window.ompAnimateNumber = function (el, to, suffix) {
    if (reducedMotion) { el.textContent = String(to) + (suffix || ''); return; }
    var from = parseInt(el.dataset.cur || '0', 10) || 0;
    el.dataset.cur = String(to);
    if (from === to) { el.textContent = String(to) + (suffix || ''); return; }
    var start = performance.now();
    var dur = 450;
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (to - from) * eased)) + (suffix || '');
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* ---------- Global search (loaded on every page with site chrome) ---------- */
  if (document.querySelector('.site-nav')) {
    var searchScript = document.createElement('script');
    searchScript.src = '/assets/js/search.js';
    searchScript.defer = true;
    document.head.appendChild(searchScript);
  }
})();