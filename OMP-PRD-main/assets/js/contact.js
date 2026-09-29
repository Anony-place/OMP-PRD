/* ============================================================
   OopsMyPassword — contact form → Supabase (contact_messages).
   Submissions land in the admin panel's Messages tab. Failed requests
   retain the message for retry; no unverified support mailbox is advertised.
   ============================================================ */
(function () {
  'use strict';
  var SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
  var API_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
  var ENDPOINT = SUPABASE_URL + '/rest/v1/contact_messages';

  var form = document.querySelector('[data-contact-form]');
  if (!form) return;
  var note = document.querySelector('[data-contact-note]');
  var btn = form.querySelector('button[type="submit"]');
  var hp = form.querySelector('[data-contact-hp]');
  var btnHTML = btn ? btn.innerHTML : '';
  /* Cooldown: a single human can't submit more than once every 12s. The
     database row-level policy and any server-side rate limit remain the
     real spam gate; this only stops accidental double-clicks/refreshes. */
  var LAST_SUBMIT_KEY = 'omp-contact-last';
  var COOLDOWN_MS = 12000;
  function cooldownRemaining() {
    var last = 0;
    try { last = parseInt(sessionStorage.getItem(LAST_SUBMIT_KEY) || '0', 10) || 0; } catch (e) { /* private mode */ }
    return Math.max(0, COOLDOWN_MS - (Date.now() - last));
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showNote(html) {
    if (!note) return;
    note.innerHTML = html;
    note.classList.add('show');
    note.setAttribute('tabindex', '-1');
    note.focus({ preventScroll: false });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (btn && btn.disabled) return;
    var nameEl = form.querySelector('#contact-name');
    var emailEl = form.querySelector('#contact-email');
    var msgEl = form.querySelector('#contact-message');
    var name = nameEl.value.trim();
    var email = emailEl.value.trim();
    var msg = msgEl.value.trim();

    if (!name || !email || !msg) {
      window.ompToast('Please fill in all fields first');
      return;
    }
    if (name.length > 100) {
      window.ompToast('Your name is too long (max 100 characters)');
      nameEl.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.ompToast('That email address does not look right');
      emailEl.focus();
      return;
    }
    if (email.length > 200) {
      window.ompToast('That email address is too long');
      emailEl.focus();
      return;
    }
    if (msg.length > 5000) {
      window.ompToast('Your message is too long (max 5,000 characters)');
      msgEl.focus();
      return;
    }
    var wait = cooldownRemaining();
    if (wait > 0) {
      window.ompToast('Please wait a few seconds before sending again');
      return;
    }

    /* Honeypot: real visitors never fill this hidden field. Fake success silently. */
    if (hp && hp.value) {
      form.reset();
      showNote('<strong>Message sent.</strong> Your message was received. Follow-up, if needed, uses <span class="mono">' + esc(email) + '</span>.');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    fetch(ENDPOINT, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ name: name, email: email, message: msg })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      form.reset();
      try { sessionStorage.setItem(LAST_SUBMIT_KEY, String(Date.now())); } catch (e) { /* ignore */ }
      showNote('<strong>Message sent.</strong> Your message was received. Follow-up, if needed, uses <span class="mono">' + esc(email) + '</span>. Response times are not guaranteed.');
      window.ompToast('Message sent — thank you!');
    }).catch(function () {
      showNote('<strong>Could not send right now.</strong> Your message is still here. Copy it somewhere safe and retry later. If the request timed out, it may already have reached the inbox.');
    }).finally(function () {
      clearTimeout(timer);
      if (btn) { btn.disabled = false; btn.innerHTML = btnHTML; }
    });
  });
})();
