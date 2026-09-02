/* ============================================================
   OopsMyPassword — Password Health audit.
   A local checklist run against a password entered on this page.
   Nothing is stored, logged or transmitted.
   ============================================================ */
(function () {
  'use strict';
  var S = window.OMPSecurity;
  if (!S) return;
  var WL = window.OMP_WORDLIST || null;

  var shell = document.querySelector('[data-health]');
  if (!shell) return;

  var input = shell.querySelector('[data-health-input]');
  var toggle = shell.querySelector('[data-health-toggle]');
  var listEl = shell.querySelector('[data-health-checks]');
  var ring = shell.querySelector('[data-health-ring]');
  var ringLabel = shell.querySelector('[data-health-grade]');
  var ringScore = shell.querySelector('[data-health-score]');
  var summaryEl = shell.querySelector('[data-health-summary]');
  var EYE = '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';
  var ICONS = {
    pass: '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 4.5-5.5"/></svg>',
    warn: '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    fail: '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
    info: '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };

  // Ring geometry
  var CIRC = 2 * Math.PI * 54; // r=54

  function gradeFor(score) {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  function render() {
    var pw = input.value;
    var r = S.analyzePassword(pw, { wordlist: WL });
    var has = pw.length > 0;

    listEl.innerHTML = '';
    if (!has) {
      ringScore.textContent = '—';
      ringLabel.textContent = '';
      summaryEl.textContent = 'Enter a password above to run the local audit.';
      ring.querySelector('.ring-val').style.strokeDashoffset = String(CIRC);
      return;
    }

    var checks = [
      { ok: r.length >= 8, text: 'At least 8 characters (absolute minimum)', fix: 'Use 8+ characters (12+ recommended)' },
      { ok: r.length >= 12, text: 'At least 12 characters', fix: 'Grow to 12+ characters' },
      { ok: r.length >= 16, text: 'At least 16 characters (best practice)', fix: 'Aim for 16+ characters for important accounts' },
      { ok: r.categories.count >= 3, text: 'Three or more character types', fix: 'Mix uppercase, lowercase, numbers, symbols' },
      { ok: r.categories.count === 4, text: 'All four character types', fix: 'Add the missing character type' },
      { ok: !r.flags.isCommon && !r.flags.hasCommon, text: 'Not a common / breached password', fix: 'This password appears in public breach dictionaries — replace it everywhere', severe: true },
      { ok: !r.flags.repeats.length, text: 'No repeated characters', fix: 'Remove repeated runs like "aaa" or "1111"' },
      { ok: !r.flags.sequences.length, text: 'No sequential patterns', fix: 'Remove sequences like "abc" or "321"' },
      { ok: !r.flags.keyboard.length, text: 'No keyboard walks', fix: 'Remove patterns like "qwerty" or "1qaz"' },
      { ok: r.entropy >= 60, text: 'Estimated entropy ≥ 60 bits', fix: 'Increase length or variety for 60+ bits of entropy' }
    ];

    checks.forEach(function (c) {
      var li = document.createElement('li');
      li.className = c.ok ? 'li-pass' : (c.severe ? 'li-fail' : 'li-warn');
      var ic = document.createElement('span');
      ic.innerHTML = c.ok ? ICONS.pass : (c.severe ? ICONS.fail : ICONS.warn);
      var tx = document.createElement('span');
      tx.className = 'li-text';
      tx.textContent = c.ok ? c.text : c.fix;
      li.appendChild(ic.firstChild);
      li.appendChild(tx);
      listEl.appendChild(li);
    });
    var reuse = document.createElement('li');
    reuse.className = 'li-info';
    var ic = document.createElement('span');
    ic.innerHTML = ICONS.info;
    var tx = document.createElement('span');
    tx.className = 'li-text';
    tx.textContent = 'Reuse check: OMP cannot see your other accounts — make sure this password is unique to one site.';
    reuse.appendChild(ic.firstChild);
    reuse.appendChild(tx);
    listEl.appendChild(reuse);

    // Ring + grade
    var grade = gradeFor(r.score);
    ringScore.textContent = grade;
    ringLabel.textContent = r.label;
    ring.querySelector('.ring-val').style.strokeDashoffset = String(CIRC * (1 - r.score / 100));
    var colors = ['#FB7185', '#FB923C', '#FACC15', '#A3E635', '#22C55E'];
    ring.querySelector('.ring-val').style.stroke = colors[r.tier];

    var passed = checks.filter(function (c) { return c.ok; }).length;
    summaryEl.textContent = passed + ' of ' + checks.length + ' checks passed · score ' + r.score + '/100 · ' +
      'estimated crack time ' + r.crackTime + ' (offline, fast hash).';
  }

  input.addEventListener('input', render);
  if (toggle) {
    toggle.innerHTML = EYE;
    toggle.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = show ? EYE_OFF : EYE;
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus();
    });
  }
  render();
})();
