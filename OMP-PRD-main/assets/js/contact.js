/* ============================================================
   OopsMyPassword — contact form → Supabase (contact_messages).
   Submissions land in the admin panel's Messages tab. The mailto
   link stays as a fallback if the network request fails.
   ============================================================ */
(function () {
  'use strict';
  var SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
  var API_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
  var ENDPOINT = SUPABASE_URL + '/rest/v1/contact_messages';
  var MAILTO = 'hello@oopsmypassword.com';

  var form = document.querySelector('[data-contact-form]');
  if (!form) return;
  var note = document.querySelector('[data-contact-note]');
  var btn = form.querySelector('button[type="submit"]');
  var hp = form.querySelector('[data-contact-hp]');
  var btnHTML = btn ? btn.innerHTML : '';

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

  function setMailto(name, email, msg) {
    if (!note) return;
    var link = note.querySelector('a[data-mailto]');
    if (!link) return;
    var subject = encodeURIComponent('OMP contact — ' + name.slice(0, 60));
    var body = encodeURIComponent(msg + '\n\n— ' + name + ' (' + email + ')');
    link.href = 'mailto:' + MAILTO + '?subject=' + subject + '&body=' + body;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.ompToast('That email address does not look right');
      emailEl.focus();
      return;
    }

    /* Honeypot: real visitors never fill this hidden field. Fake success silently. */
    if (hp && hp.value) {
      form.reset();
      showNote('<strong>Message sent.</strong> Thanks — a human reads every submission and we\u2019ll reply to <span class="mono">' + esc(email) + '</span> soon.');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    fetch(ENDPOINT, {
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
      showNote('<strong>Message sent.</strong> Thanks — a human reads every submission and we\u2019ll reply to <span class="mono">' + esc(email) + '</span> soon. Didn\u2019t reach us? <a data-mailto href="mailto:' + MAILTO + '">Email us directly</a>.');
      window.ompToast('Message sent — thank you!');
    }).catch(function () {
      showNote('<strong>Could not send right now.</strong> Your message is still here — <a data-mailto href="mailto:' + MAILTO + '">open your email app with it pre-filled</a>, or try again in a moment.');
      setMailto(name, email, msg);
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.innerHTML = btnHTML; }
    });
  });
})();
