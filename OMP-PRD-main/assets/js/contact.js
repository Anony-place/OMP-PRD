/* ============================================================
   OopsMyPassword — contact form.
   No backend is configured yet. We do not fake a submission:
   the form explains the state and offers a mailto fallback.
   ============================================================ */
(function () {
  'use strict';
  var form = document.querySelector('[data-contact-form]');
  if (!form) return;
  var note = document.querySelector('[data-contact-note]');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.querySelector('#contact-name');
    var email = form.querySelector('#contact-email');
    var msg = form.querySelector('#contact-message');
    if (!name.value.trim() || !email.value.trim() || !msg.value.trim()) {
      window.ompToast('Please fill in all fields first');
      return;
    }
    if (note) {
      note.classList.add('show');
      note.setAttribute('tabindex', '-1');
      note.focus({ preventScroll: false });
      var link = note.querySelector('a');
      if (link) {
        var subject = encodeURIComponent('OMP contact — ' + name.value.trim().slice(0, 60));
        var body = encodeURIComponent(msg.value.trim() + '\n\n— ' + name.value.trim() + ' (' + email.value.trim() + ')');
        link.href = 'mailto:anonyhelps.su@gmail.com?subject=' + subject + '&body=' + body;
      }
    }
  });
})();
