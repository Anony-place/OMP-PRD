/* ============================================================
   OopsMyPassword — password & random string generator.
   Uses crypto.getRandomValues() only (rejection sampling,
   no modulo bias). Everything runs locally.
   ============================================================ */
(function () {
  'use strict';
  var S = window.OMPSecurity;
  if (!S) return;

  var REGEN = '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>';
  var COPY = '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  function strengthOf(pw) {
    var r = S.analyzePassword(pw);
    return r;
  }

  function paintMeter(meter, r) {
    if (!meter) return;
    var colors = ['#FB7185', '#FB923C', '#FACC15', '#A3E635', '#22C55E'];
    var segs = meter.querySelectorAll('.seg');
    var lit = Math.round((r.score / 100) * segs.length);
    meter.style.setProperty('--meter-color', colors[r.tier]);
    segs.forEach(function (s, i) { s.classList.toggle('on', i < lit); });
  }

  function buildMeter(el) {
    for (var i = 0; i < 20; i++) {
      var s = document.createElement('span');
      s.className = 'seg';
      el.appendChild(s);
    }
  }

  /* ---------- Password generator ---------- */
  document.querySelectorAll('[data-generator]').forEach(function (shell) {
    var out = shell.querySelector('[data-gen-output]');
    var lenSlider = shell.querySelector('[data-gen-length]');
    var lenOut = shell.querySelector('[data-gen-length-out]');
    var meter = shell.querySelector('[data-gen-meter]');
    var entropyEl = shell.querySelector('[data-gen-entropy]');
    var opts = {
      lower: shell.querySelector('[data-opt="lower"]'),
      upper: shell.querySelector('[data-opt="upper"]'),
      digits: shell.querySelector('[data-opt="digits"]'),
      symbols: shell.querySelector('[data-opt="symbols"]'),
      ambiguous: shell.querySelector('[data-opt="ambiguous"]')
    };
    if (meter) buildMeter(meter);

    function currentOpts() {
      var o = {
        length: lenSlider ? Number(lenSlider.value) : 20,
        lower: !opts.lower || opts.lower.checked,
        upper: !opts.upper || opts.upper.checked,
        digits: !opts.digits || opts.digits.checked,
        symbols: !opts.symbols || opts.symbols.checked,
        excludeAmbiguous: !!(opts.ambiguous && opts.ambiguous.checked)
      };
      if (!o.lower && !o.upper && !o.digits && !o.symbols) o.lower = true; // never generate nothing
      return o;
    }

    function generate(announce) {
      try {
        var pw = S.generatePassword(currentOpts());
        out.textContent = pw;
        if (lenOut) lenOut.textContent = String(currentOpts().length);
        var r = strengthOf(pw);
        if (meter) paintMeter(meter, r);
        if (entropyEl) entropyEl.textContent = r.entropyNaive.toLocaleString('en-US') + ' bits (' + r.label.toLowerCase() + ')';
        if (announce) window.ompToast('New password generated locally');
      } catch (err) {
        out.textContent = '';
        window.ompToast(err.message || 'Could not generate');
      }
    }

    shell.querySelectorAll('[data-gen-btn]').forEach(function (b) {
      b.addEventListener('click', function () { generate(true); });
    });
    shell.querySelectorAll('[data-copy-btn]').forEach(function (b) {
      b.innerHTML = COPY + '<span class="sr-only">Copy</span>';
      b.addEventListener('click', function () {
        if (out.textContent) window.ompCopy(out.textContent, 'Password copied — paste it immediately, then clear your clipboard if possible');
      });
    });
    if (lenSlider) lenSlider.addEventListener('input', function () {
      if (lenOut) lenOut.textContent = lenSlider.value;
      generate(false);
    });
    Object.keys(opts).forEach(function (k) {
      if (opts[k]) opts[k].addEventListener('change', function () { generate(false); });
    });

    generate(false); // initial password on page load
  });

  /* ---------- Random string generator ---------- */
  document.querySelectorAll('[data-randomizer]').forEach(function (shell) {
    var listEl = shell.querySelector('[data-rand-list]');
    var lenSlider = shell.querySelector('[data-rand-length]');
    var lenOut = shell.querySelector('[data-rand-length-out]');
    var countSel = shell.querySelector('[data-rand-count]');
    var charsetSel = shell.querySelector('[data-rand-charset]');
    var REGEN_BTN = shell.querySelector('[data-rand-btn]');

    var CHARSETS = {
      alnum: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      numeric: '0123456789',
      hex: '0123456789abcdef',
      base64url: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_',
      symbols: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+'
    };

    function genOne(charset, len) {
      var s = '';
      for (var i = 0; i < len; i++) s += charset.charAt(S.secureRandomInt(charset.length));
      return s;
    }

    function generate() {
      var charset = CHARSETS[charsetSel ? charsetSel.value : 'alnum'] || CHARSETS.alnum;
      var len = lenSlider ? Number(lenSlider.value) : 32;
      var count = countSel ? Number(countSel.value) : 5;
      listEl.innerHTML = '';
      for (var i = 0; i < count; i++) {
        (function () {
          var val = genOne(charset, len);
          var row = document.createElement('div');
          row.className = 'gen-output';
          var code = document.createElement('code');
          code.textContent = val;
          var btn = document.createElement('button');
          btn.className = 'icon-btn';
          btn.type = 'button';
          btn.setAttribute('aria-label', 'Copy this string');
          btn.innerHTML = COPY;
          btn.addEventListener('click', function () { window.ompCopy(val, 'String copied'); });
          row.appendChild(code);
          row.appendChild(btn);
          listEl.appendChild(row);
        })();
      }
    }

    if (lenSlider) lenSlider.addEventListener('input', function () {
      if (lenOut) lenOut.textContent = lenSlider.value;
      generate();
    });
    [countSel, charsetSel].forEach(function (c) { if (c) c.addEventListener('change', generate); });
    if (REGEN_BTN) REGEN_BTN.addEventListener('click', function () { generate(); window.ompToast('New strings generated locally'); });
    generate();
  });
})();
