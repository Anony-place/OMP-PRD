/* Admin boot watchdog.
   Loads as a classic script BEFORE the ES module so it registers first.
   If /assets/js/admin.js never runs (stale cache, blocked import, file:// page),
   this explains why instead of leaving "Loading secure admin panel…" forever. */
(function () {
  'use strict';
  var settled = false;
  var esc = function (value) {
    return String(value).replace(/[&<>'"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
    });
  };
  function render(title, detail) {
    if (settled) return;
    settled = true;
    var root = document.querySelector('#admin-root');
    if (!root) return;
    root.innerHTML =
      '<div class="card card-pad" style="max-width:640px;margin:8vh auto 0">' +
      '<div class="notice-band"><p><strong>' + esc(title) + '</strong></p>' +
      '<p class="muted" style="margin-top:8px">' + esc(detail) + '</p></div></div>';
  }
  window.__adminBootOk = function () { settled = true; };
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target.tagName === 'SCRIPT') {
      render('A script failed to load: ' + (e.target.src || 'inline script'),
        'Likely causes: the page was opened from disk instead of the website, a browser extension (ad blocker / tracking protection) blocked it, or the network blocked esm.sh. Hard-refresh with Ctrl+Shift+R, or open the page via its https:// URL.');
    }
  }, true);
  document.addEventListener('securitypolicyviolation', function (e) {
    render('Content-Security-Policy blocked part of the admin panel.',
      'Blocked: ' + (e.violatedDirective || 'unknown') + ' — ' + (e.blockedURL || 'unknown') + '. A deploy may be out of sync; hard-refresh with Ctrl+Shift+R.');
  });
  window.setTimeout(function () {
    if (settled) return;
    if (window.location.protocol === 'file:') {
      render('The admin panel cannot start from a file:// page.',
        'Open this page via the website URL (or serve the folder locally, e.g. "npx serve") so /assets/js/admin.js can resolve.');
      return;
    }
    render('The admin panel did not finish starting.',
      'Your browser is most likely running a stale cached copy of the panel script (it was previously served with a 1-year "immutable" cache header). Hard-refresh with Ctrl+Shift+R (Cmd+Shift+R on Mac) or clear site data for this domain. If that does not help, try a private window to rule out extensions.');
  }, 7000);
})();