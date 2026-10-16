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
   
   SECURITY NOTE: SHA-1 is used here ONLY for prefix compatibility
   with the HIBP Pwned Passwords k-anonymity API model.
   This is NOT for collision resistance. The demo corpus contains
   only ~330 famous compromised passwords — "Not found" proves nothing.
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

  function checkLiveHibp(prefix, suffix) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 3500) : null;
    return fetch('https://api.pwnedpasswords.com/range/' + prefix, {
      headers: { 'Add-Padding': 'true' },
      cache: 'no-cache',
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HIBP status ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var lines = text.split('\r\n');
        for (var i = 0; i < lines.length; i++) {
          var parts = lines[i].split(':');
          if (parts[0] && parts[0].trim() === suffix) {
            return { found: true, count: parseInt(parts[1], 10) || 1, live: true };
          }
        }
        return { found: false, count: 0, live: true };
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function setStatus(type, count, isLive) {
    statusEl.className = 'breach-result show';
    statusEl.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'callout ' + (type === 'found' ? 'callout-warn' : 'callout-tip');
    div.innerHTML = (type === 'found'
      ? '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
      : '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>');
    var p = document.createElement('p');
    var strong = document.createElement('strong');
    if (isLive) {
      strong.textContent = type === 'found'
        ? 'Breach detected! Found ' + (count ? count.toLocaleString() : 'multiple') + ' times in public breaches. '
        : 'Good news! Not found in Have I Been Pwned\'s 900M+ breach database. ';
    } else {
      strong.textContent = type === 'found'
        ? 'Found in the demo corpus. '
        : 'Not found in the demo corpus. ';
    }
    p.appendChild(strong);
    p.appendChild(document.createTextNode(type === 'found'
      ? 'This password appears in known breach databases. If you use it anywhere, replace it immediately.'
      : (isLive
        ? 'No matching hash was found in over 900 million compromised passwords. Always maintain unique credentials and MFA.'
        : 'The offline demo list is tiny on purpose (~330 passwords).')));
    div.appendChild(p);

    var note = document.createElement('p');
    note.className = 'tiny muted mt-8';
    note.textContent = isLive
      ? 'Zero-knowledge verified: Only the 5-character SHA-1 prefix was queried using k-anonymity. Your password never left your browser.'
      : 'Note: SHA-1 prefix used for k-anonymity model compatibility.';
    div.appendChild(note);

    statusEl.appendChild(div);
  }

  btn.addEventListener('click', function () {
    var pw = input.value;
    if (!pw) {
      window.ompToast('Enter a password to run the breach check');
      input.focus();
      return;
    }
    if (!window.crypto || !crypto.subtle) {
      window.ompToast('WebCrypto is unavailable in this browser');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Checking breach database…';

    sha1Hex(pw).then(function (hash) {
      var prefix = hash.slice(0, 5);
      var suffix = hash.slice(5);

      if (hashEl) {
        hashEl.hidden = false;
        hashEl.innerHTML = '';
        var label = document.createElement('div');
        label.className = 'tiny muted';
        label.textContent = 'SHA-1 (computed locally, never transmitted). In k-anonymity, only the highlighted 5-character prefix is queried:';
        var code = document.createElement('div');
        var spanP = document.createElement('span');
        spanP.className = 'prefix';
        spanP.textContent = prefix;
        code.appendChild(spanP);
        code.appendChild(document.createTextNode(suffix));
        hashEl.appendChild(label);
        hashEl.appendChild(code);
      }

      // Try live HIBP k-anonymity range API first; fallback to local demo if offline
      return checkLiveHibp(prefix, suffix).catch(function () {
        return demoPrefixes().then(function (prefixes) {
          return { found: prefixes.has(prefix), count: 0, live: false };
        });
      });
    }).then(function (res) {
      setStatus(res.found ? 'found' : 'clear', res.count, res.live);
      resultEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Check for breaches';
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Check for breaches';
      window.ompToast('Check failed in this browser');
    });
  });
})();
