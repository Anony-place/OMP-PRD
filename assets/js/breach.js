/* ============================================================
   OopsMyPassword — educational breach-check demo.
   NOT connected to a live breach database.

   Demonstrates the k-anonymity model locally:
   1. The password is SHA-1 hashed in your browser (never sent anywhere).
   2. Only the first 5 hex characters of the hash are "queried".
   3. They are compared against a tiny built-in demo list of hashes
      of well-known compromised passwords.

   In a production deployment the prefix would be sent to a
   k-anonymity range API which returns matching hash suffixes for
   local comparison — the password itself never leaves the device.
   ============================================================ */
(function () {
  'use strict';
  var S = window.OMPSecurity;
  if (!S) return;

  var shell = document.querySelector('[data-breach]');
  if (!shell) return;

  var input = shell.querySelector('[data-breach-input]');
  var btn = shell.querySelector('[data-breach-btn]');
  var resultEl = shell.querySelector('[data-breach-result]');
  var statusEl = shell.querySelector('[data-breach-status]');
  var hashEl = shell.querySelector('[data-breach-hash]');

  var prefixSetPromise = null;

  function sha1Hex(text) {
    return crypto.subtle.digest('SHA-1', new TextEncoder().encode(text)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('').toUpperCase();
    });
  }

  // Build the tiny demo "breach corpus" entirely in-browser.
  function demoPrefixes() {
    if (!prefixSetPromise) {
      prefixSetPromise = Promise.all(S.COMMON_PASSWORDS.map(sha1Hex)).then(function (hashes) {
        var set = new Set();
        hashes.forEach(function (h) { set.add(h.slice(0, 5)); });
        return set;
      });
    }
    return prefixSetPromise;
  }

  function setStatus(type, html) {
    statusEl.className = 'breach-result show';
    statusEl.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'callout ' + (type === 'found' ? 'callout-warn' : 'callout-tip');
    div.innerHTML = (type === 'found'
      ? '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
      : '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>');
    var p = document.createElement('p');
    p.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = type === 'found'
      ? 'Found in the demo corpus. '
      : 'Not found in the demo corpus. ';
    p.appendChild(strong);
    p.appendChild(document.createTextNode(type === 'found'
      ? 'This password (or one sharing its hash prefix) appears in the small built-in list of well-known compromised passwords. Treat it as burned: change it everywhere you have ever used it.'
      : 'The demo list is tiny on purpose. "Not found" here is NOT evidence a password is safe — only a live breach database lookup can say more.'));
    div.appendChild(p);
    statusEl.appendChild(div);
  }

  btn.addEventListener('click', function () {
    var pw = input.value;
    if (!pw) {
      window.ompToast('Enter a password to run the demo lookup');
      input.focus();
      return;
    }
    if (!window.crypto || !crypto.subtle) {
      window.ompToast('WebCrypto is unavailable in this browser');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Hashing locally…';
    Promise.all([sha1Hex(pw), demoPrefixes()]).then(function (res) {
      var hash = res[0];
      var prefixes = res[1];
      var prefix = hash.slice(0, 5);
      if (hashEl) {
        hashEl.innerHTML = '';
        var label = document.createElement('div');
        label.className = 'tiny muted';
        label.textContent = 'SHA-1 (computed locally, never transmitted). In k-anonymity, only the highlighted 5-character prefix would leave your device:';
        var code = document.createElement('div');
        var spanP = document.createElement('span');
        spanP.className = 'prefix';
        spanP.textContent = prefix;
        code.appendChild(spanP);
        code.appendChild(document.createTextNode(hash.slice(5)));
        hashEl.appendChild(label);
        hashEl.appendChild(code);
      }
      setStatus(prefixes.has(prefix) ? 'found' : 'clear');
      resultEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Run demo lookup';
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Run demo lookup';
      window.ompToast('Hashing failed in this browser');
    });
  });
})();
