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
    // Try localStorage first, fall back to sessionStorage for private/incognito mode
    try { 
      localStorage.setItem('omp-theme', t); 
    } catch (e) { 
      try { sessionStorage.setItem('omp-theme', t); } catch (e2) { /* private mode */ } 
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#F6F8FC' : '#050811');
  }
  
  // Load theme from localStorage or sessionStorage on page load
  (function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem('omp-theme'); } catch (e) {}
    if (!stored) {
      try { stored = sessionStorage.getItem('omp-theme'); } catch (e) {}
    }
    if (stored) {
      applyTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      applyTheme('light');
    }
  })();
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
    var iconMenu = navToggle.querySelector('.icon-menu');
    var iconClose = navToggle.querySelector('.icon-close');

    /* One place sets every piece of menu state. Before this, the button-driven
       path and the link-driven path disagreed, so tapping a link shut the menu
       but left the toggle announcing "Close menu" on a closed menu. */
    function setNavOpen(open, returnFocus) {
      mobileMenu.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (iconMenu) iconMenu.style.display = open ? 'none' : '';
      if (iconClose) iconClose.style.display = open ? '' : 'none';
      if (open) {
        /* The menu covers the page, so a screen reader must land inside it
           instead of being left on the button with the page hidden behind. */
        var first = mobileMenu.querySelector('a, button');
        if (first) first.focus();
      } else if (returnFocus) {
        navToggle.focus();
      }
    }

    function navIsOpen() { return mobileMenu.classList.contains('open'); }
    function navFocusables() {
      var all = Array.prototype.slice.call(mobileMenu.querySelectorAll('a[href], button:not([disabled])'));
      /* Prefer what is actually rendered, but never hand back an empty cycle if
         layout information is unavailable — an empty list would let Tab escape. */
      var visible = all.filter(function (el) { return el.getClientRects().length || el.offsetParent !== null; });
      /* The toggle sits on top of the open menu and is the only visible way to
         close it, so it belongs inside the cycle. Leaving it out stranded a
         keyboard user in a loop of menu links. */
      return [navToggle].concat(visible.length ? visible : all);
    }

    navToggle.addEventListener('click', function () {
      var opening = !navIsOpen();
      setNavOpen(opening, !opening); /* closing by button keeps focus on the button */
    });

    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNavOpen(false, false);
    });

    /* Escape is how a keyboard user expects to leave an open overlay. Without
       this the only way out was to tab all the way back to the toggle. */
    document.addEventListener('keydown', function (e) {
      if (!navIsOpen()) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        setNavOpen(false, true);
        return;
      }
      /* Keep Tab inside the overlay: everything behind it is covered. */
      if (e.key === 'Tab') {
        var items = navFocusables();
        if (!items.length) return;
        var firstEl = items[0];
        var lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault(); lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault(); firstEl.focus();
        }
      }
    });

    /* A resize past the breakpoint hides the menu via CSS. If it was open the
       page would stay scroll-locked with no visible menu, so close it properly. */
    window.addEventListener('resize', function () {
      if (!navIsOpen()) return;
      var toggleVisible = navToggle.getClientRects().length > 0;
      if (!toggleVisible) setNavOpen(false, false);
    });
  }

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

  /* ---------- Static /osint/<slug> and /pentest/<slug> Interactive CLI Builder ---------- */
  (function enhanceStaticToolDetail() {
    var m = (window.location.pathname || '').match(/^\/(osint|pentest)\/([a-z0-9-]+)\/?$/);
    if (!m || document.querySelector('[data-cli-builder]')) return;
    var hub = m[1];
    var slug = m[2];
    var prose = document.querySelector('article.prose');
    if (!prose) return;
    var specs = {
      'sherlock': { label: 'Target username', placeholder: 'johndoe', presets: [{ label: 'Single username', cmd: 'sherlock {target}' }, { label: 'Print found only + timeout', cmd: 'sherlock --timeout 10 --print-found {target}' }, { label: 'CSV export', cmd: 'sherlock --csv -o {target}_results.txt {target}' }], flags: [{ flag: '--tor', label: 'Route via Tor (--tor)' }, { flag: '--nsfw', label: 'Include NSFW (--nsfw)' }] },
      'maigret': { label: 'Target username', placeholder: 'johndoe', presets: [{ label: 'Top 500 sites + HTML report', cmd: 'maigret {target} --top-sites 500 -H' }, { label: 'PDF dossier', cmd: 'maigret {target} -P' }], flags: [{ flag: '--no-color', label: 'Plain output (--no-color)' }] },
      'holehe': { label: 'Target email', placeholder: 'target@example.com', presets: [{ label: 'Registered accounts only', cmd: 'holehe --only-used {target}' }, { label: 'Full check + CSV', cmd: 'holehe -C {target}' }], flags: [{ flag: '--no-clear', label: 'Do not clear terminal (--no-clear)' }] },
      'theharvester': { label: 'Target domain', placeholder: 'example.com', presets: [{ label: 'Passive recon', cmd: 'theHarvester -d {target} -b crtsh,certspotter,duckduckgo -l 200' }, { label: 'Save JSON/HTML report', cmd: 'theHarvester -d {target} -b all -f {target}_harvest' }], flags: [{ flag: '-n', label: 'DNS lookup (-n)' }] },
      'subfinder': { label: 'Target domain', placeholder: 'example.com', presets: [{ label: 'Silent subdomain list', cmd: 'subfinder -d {target} -silent' }, { label: 'All passive sources to file', cmd: 'subfinder -d {target} -all -o {target}_subs.txt' }], flags: [{ flag: '-rL resolvers.txt', label: 'Custom resolvers' }] },
      'nmap': { label: 'Target host or subnet (authorized lab)', placeholder: '192.168.1.10', presets: [{ label: 'Service & version detection', cmd: 'nmap -sV -sC {target}' }, { label: 'Full TCP port sweep', cmd: 'nmap -p- -T4 {target}' }, { label: 'SYN stealth + OS fingerprint', cmd: 'sudo nmap -sS -O {target}' }], flags: [{ flag: '-Pn', label: 'Skip host discovery (-Pn)' }, { flag: '-v', label: 'Verbose (-v)' }, { flag: '-oN scan.txt', label: 'Save normal output (-oN)' }] },
      'ffuf': { label: 'Target base URL', placeholder: 'https://lab.example.com', presets: [{ label: 'Directory discovery', cmd: 'ffuf -u {target}/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt -mc 200,204,301,302,307,401,403' }, { label: 'VHost fuzzing', cmd: 'ffuf -u {target} -H "Host: FUZZ.example.com" -w subdomains.txt -fs 4242' }], flags: [{ flag: '-t 40', label: '40 threads (-t 40)' }, { flag: '-recursion', label: 'Recursive (-recursion)' }] },
      'nuclei': { label: 'Target URL', placeholder: 'https://lab.example.com', presets: [{ label: 'CVE & misconfiguration scan', cmd: 'nuclei -u {target} -tags cve,misconfig' }, { label: 'Critical & high severity only', cmd: 'nuclei -u {target} -severity critical,high' }], flags: [{ flag: '-rl 50', label: 'Rate limit 50/s (-rl 50)' }, { flag: '-stats', label: 'Show progress (-stats)' }] },
      'sqlmap': { label: 'Target URL with parameter', placeholder: 'http://lab.local/item.php?id=1', presets: [{ label: 'Safe boolean/time test', cmd: 'sqlmap -u "{target}" --batch --level=1 --risk=1' }, { label: 'List databases', cmd: 'sqlmap -u "{target}" --batch --dbs' }], flags: [{ flag: '--random-agent', label: 'Random User-Agent' }, { flag: '--tor', label: 'Use Tor proxy' }] },
      'hashcat': { label: 'Hash file path', placeholder: 'hashes.txt', presets: [{ label: 'WPA2/WPA3 (mode 22000)', cmd: 'hashcat -m 22000 {target} rockyou.txt' }, { label: 'NTLM (mode 1000)', cmd: 'hashcat -m 1000 {target} rockyou.txt -r best64.rule' }, { label: 'bcrypt (mode 3200)', cmd: 'hashcat -m 3200 {target} rockyou.txt' }], flags: [{ flag: '-O', label: 'Optimized kernels (-O)' }, { flag: '--status', label: 'Periodic status (--status)' }] }
    };
    var spec = specs[slug] || {
      label: hub === 'pentest' ? 'Authorized Lab Target' : 'Investigation Target',
      placeholder: 'example.com',
      presets: [
        { label: 'Standard invocation', cmd: slug + ' {target}' },
        { label: 'Help & options reference', cmd: slug + ' --help' },
        { label: 'Export report', cmd: slug + ' {target} -o ' + slug + '-report.txt' }
      ],
      flags: [{ flag: '--verbose', label: 'Verbose output (--verbose)' }]
    };
    var wrap = document.createElement('section');
    wrap.id = 'sec-cli-builder';
    var presetsHtml = spec.presets.map(function (p, i) {
      return '<button type="button" class="cli-preset-btn' + (i === 0 ? ' is-active' : '') + '" data-cli-preset="' + i + '">' + p.label + '</button>';
    }).join('');
    var flagsHtml = (spec.flags || []).map(function (f) {
      return '<label class="cli-flag-pill"><input type="checkbox" data-cli-flag="' + f.flag + '"> <span>' + f.label + '</span></label>';
    }).join('');
    wrap.innerHTML =
      '<h2>Interactive CLI Command Builder</h2>' +
      '<div class="cli-builder-card" data-cli-builder>' +
        '<div class="cli-builder-head"><div><span class="eyebrow">Interactive CLI Command Builder</span>' +
        '<h3 class="h-4" style="margin:2px 0 0">Customize & copy command</h3></div><span class="badge badge-demo">Client-side only</span></div>' +
        '<div class="cli-builder-controls">' +
          '<div class="cli-field"><label for="cli-target-input">' + spec.label + '</label>' +
          '<input id="cli-target-input" type="text" value="' + spec.placeholder + '" placeholder="' + spec.placeholder + '" autocomplete="off" spellcheck="false"></div>' +
          '<div class="cli-field"><span class="cli-label">Preset mode</span><div class="cli-presets">' + presetsHtml + '</div></div>' +
          (flagsHtml ? '<div class="cli-field"><span class="cli-label">Optional flags</span><div class="cli-flags">' + flagsHtml + '</div></div>' : '') +
        '</div>' +
        '<div class="cli-output-bar"><pre class="cli-output"><code data-cli-code></code></pre>' +
        '<button type="button" class="btn btn-primary btn-sm" data-cli-copy>Copy command</button></div>' +
      '</div>';
    var hr = prose.querySelector('hr.hr-fade');
    if (hr) prose.insertBefore(wrap, hr);
    else prose.appendChild(wrap);

    var input = wrap.querySelector('#cli-target-input');
    var codeEl = wrap.querySelector('[data-cli-code]');
    var copyBtn = wrap.querySelector('[data-cli-copy]');
    var activePreset = 0;
    function updateCmd() {
      var preset = spec.presets[activePreset] || spec.presets[0];
      var target = (String(input ? input.value : '').trim() || spec.placeholder).replace(/[;&|`$><\n\r]/g, '');
      var cmd = preset.cmd.replace(/\{target\}/g, target);
      var extra = [];
      wrap.querySelectorAll('[data-cli-flag]:checked').forEach(function (cb) { extra.push(cb.getAttribute('data-cli-flag')); });
      if (extra.length) cmd += ' ' + extra.join(' ');
      if (codeEl) codeEl.textContent = cmd;
    }
    if (input) input.addEventListener('input', updateCmd);
    wrap.querySelectorAll('[data-cli-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activePreset = Number(btn.getAttribute('data-cli-preset')) || 0;
        wrap.querySelectorAll('[data-cli-preset]').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        updateCmd();
      });
    });
    wrap.querySelectorAll('[data-cli-flag]').forEach(function (cb) { cb.addEventListener('change', updateCmd); });
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var txt = codeEl ? codeEl.textContent : '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(function () {
            copyBtn.textContent = 'Copied ✓';
            setTimeout(function () { copyBtn.textContent = 'Copy command'; }, 1500);
          });
        }
      });
    }
    updateCmd();
  })();

  /* ---------- Interactive Hub Search & Category Filter (/compare, /cheatsheets, /glossary) ---------- */
  (function initFilterableHubs() {
    var hub = document.querySelector('[data-filterable-hub]');
    if (!hub) return;
    var searchInput = hub.querySelector('[data-hub-filter-input]');
    var catBtns = hub.querySelectorAll('[data-hub-filter-cat]');
    var cards = hub.querySelectorAll('[data-hub-card]');
    var activeCat = 'All';

    function applyFilter() {
      var q = searchInput ? String(searchInput.value || '').toLowerCase().trim() : '';
      cards.forEach(function (card) {
        var cCat = card.getAttribute('data-hub-cat') || '';
        var cText = card.getAttribute('data-hub-search') || '';
        var matchCat = activeCat === 'All' || cCat === activeCat;
        var matchQ = !q || cText.indexOf(q) !== -1;
        card.hidden = !(matchCat && matchQ);
      });
    }

    if (searchInput) searchInput.addEventListener('input', applyFilter);
    catBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCat = btn.getAttribute('data-hub-filter-cat') || 'All';
        catBtns.forEach(function (b) {
          var on = b === btn;
          b.className = 'btn btn-sm ' + (on ? 'btn-primary' : 'btn-ghost');
        });
        applyFilter();
      });
    });
  })();

  /* ---------- Interactive Cheat Sheet Variable Replacer & Exporter (/cheatsheets/<slug>) ---------- */
  (function initCheatSheetPage() {
    var csRoot = document.querySelector('[data-cheatsheet-page]');
    if (!csRoot) return;
    var varInputs = csRoot.querySelectorAll('[data-cs-var]');
    var codeBlocks = csRoot.querySelectorAll('[data-cs-template]');
    var copyBtns = csRoot.querySelectorAll('[data-cs-copy]');
    var dlBtn = csRoot.querySelector('[data-cs-download-md]');
    var printBtn = csRoot.querySelector('[data-cs-print]');

    function getVars() {
      var map = { TARGET: '192.0.2.10', DOMAIN: 'example.com', WORDLIST: '/usr/share/wordlists/common.txt' };
      varInputs.forEach(function (inp) {
        var k = inp.getAttribute('data-cs-var');
        var v = String(inp.value || '').trim().replace(/[;&|`$><\n\r]/g, '');
        if (k && v) map[k] = v;
      });
      return map;
    }

    function updateAllCommands() {
      var vars = getVars();
      codeBlocks.forEach(function (code) {
        var tpl = code.getAttribute('data-cs-template') || '';
        code.textContent = tpl
          .replace(/\{TARGET\}/g, vars.TARGET)
          .replace(/\{DOMAIN\}/g, vars.DOMAIN)
          .replace(/\{WORDLIST\}/g, vars.WORDLIST);
      });
    }

    varInputs.forEach(function (inp) {
      inp.addEventListener('input', updateAllCommands);
    });

    copyBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = btn.getAttribute('data-cs-copy');
        var code = csRoot.querySelector('[data-cs-idx="' + idx + '"]');
        if (!code || !navigator.clipboard || !navigator.clipboard.writeText) return;
        navigator.clipboard.writeText(code.textContent).then(function () {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy Command'; }, 1400);
        });
      });
    });

    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        var title = csRoot.getAttribute('data-cs-title') || 'OMP Cheat Sheet';
        var lines = ['# ' + title, '', '> Generated from https://oopsmypassword.web.app/cheatsheets', ''];
        codeBlocks.forEach(function (code, i) {
          lines.push('## Command ' + (i + 1));
          lines.push('```bash');
          lines.push(code.textContent);
          lines.push('```');
          lines.push('');
        });
        var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }
  })();

  /* ---------- Service Worker Registration ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (reg) {
        console.log('[OMP] Service Worker registered:', reg.scope);
      }).catch(function (err) {
        console.log('[OMP] Service Worker registration failed:', err);
      });
    });
  }
})();