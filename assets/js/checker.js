/* ============================================================
   OopsMyPassword — live password checker UI.
   The password value never leaves this page:
   no network calls, no storage, no analytics.
   ============================================================ */
(function () {
  'use strict';

  var S = window.OMPSecurity;
  if (!S) return;
  var WL = window.OMP_WORDLIST || null;

  var TIER_COLORS = ['#FB7185', '#FB923C', '#FACC15', '#A3E635', '#22C55E'];
  var ICONS = {
    pass: '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 4.5-5.5"/></svg>',
    warn: '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    fail: '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
    info: '<svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };
  var EYE = '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';
  var X_ICON = '<svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  function li(type, text) {
    var el = document.createElement('li');
    el.className = 'li-' + type;
    var icon = document.createElement('span');
    icon.innerHTML = ICONS[type] || ICONS.info;
    var body = document.createElement('span');
    body.className = 'li-text';
    body.textContent = text; // textContent — never innerHTML with user-influenced content
    el.appendChild(icon.firstChild);
    el.appendChild(body);
    return el;
  }

  function initChecker(shell) {
    var input = shell.querySelector('[data-pw-input]');
    var toggleBtn = shell.querySelector('[data-pw-toggle]');
    var clearBtn = shell.querySelector('[data-pw-clear]');
    var counter = shell.querySelector('[data-pw-counter]');
    var scoreEl = shell.querySelector('[data-score-number]');
    var pillEl = shell.querySelector('[data-score-pill]');
    var meterEl = shell.querySelector('[data-meter]');
    var findingsEl = shell.querySelector('[data-findings]');
    var recosEl = shell.querySelector('[data-recos]');
    var catsEl = shell.querySelector('[data-cats]');
    var liveEl = shell.querySelector('[data-live]');
    var statLength = shell.querySelector('[data-stat="length"]');
    var statEntropy = shell.querySelector('[data-stat="entropy"]');
    var statCrack = shell.querySelector('[data-stat="crack"]');
    var statCommon = shell.querySelector('[data-stat="common"]');
    if (!input || !meterEl) return;

    // Build 20 meter segments once.
    var segs = [];
    for (var i = 0; i < 20; i++) {
      var s = document.createElement('span');
      s.className = 'seg';
      meterEl.appendChild(s);
      segs.push(s);
    }
    meterEl.setAttribute('role', 'progressbar');
    meterEl.setAttribute('aria-valuemin', '0');
    meterEl.setAttribute('aria-valuemax', '100');
    meterEl.setAttribute('aria-label', 'Password strength score');

    var lastAnnounced = -1;

    function render() {
      var pw = input.value;
      var r = S.analyzePassword(pw, { wordlist: WL });

      if (counter) counter.textContent = pw ? String(r.length) + ' char' + (r.length === 1 ? '' : 's') : '0 chars';
      if (clearBtn) clearBtn.style.visibility = pw ? 'visible' : 'hidden';

      var has = pw.length > 0;
      var tier = has ? r.tier : -1;

      // Score + pill
      if (scoreEl) window.ompAnimateNumber(scoreEl, has ? r.score : 0, '');
      if (pillEl) {
        pillEl.className = 'strength-pill ' + (has ? 'st-' + tier : 'st-none');
        pillEl.querySelector('[data-pill-text]').textContent = has ? r.label : 'Awaiting input';
      }

      // Meter
      var lit = has ? Math.round((r.score / 100) * 20) : 0;
      meterEl.style.setProperty('--meter-color', has ? TIER_COLORS[tier] : 'transparent');
      meterEl.setAttribute('aria-valuenow', String(has ? r.score : 0));
      segs.forEach(function (seg, idx) { seg.classList.toggle('on', idx < lit); });

      // Stats
      if (statLength) statLength.textContent = has ? String(r.length) : '—';
      if (statEntropy) statEntropy.textContent = has ? r.entropy.toLocaleString('en-US') + ' bits' : '—';
      if (statCrack) statCrack.textContent = has ? r.crackTime : '—';
      if (statCommon) {
        if (!has) { statCommon.textContent = '—'; }
        else if (r.flags.isCommon || r.flags.hasCommon) {
          statCommon.textContent = 'Yes';
          statCommon.style.color = '#FB7185';
        } else {
          statCommon.textContent = 'No';
          statCommon.style.color = '';
        }
      }

      // Category chips
      if (catsEl) {
        catsEl.innerHTML = '';
        if (has) {
          [['Lowercase', r.categories.lower], ['Uppercase', r.categories.upper],
           ['Numbers', r.categories.digit], ['Symbols', r.categories.symbol]].forEach(function (pair) {
            var chip = document.createElement('span');
            chip.className = 'chip' + (pair[1] ? ' chip-accent' : '');
            chip.textContent = (pair[1] ? '✓ ' : '○ ') + pair[0];
            catsEl.appendChild(chip);
          });
        }
      }

      // Findings + recommendations (textContent only)
      if (findingsEl) {
        findingsEl.innerHTML = '';
        if (has) r.findings.slice(0, 6).forEach(function (f) { findingsEl.appendChild(li(f.type, f.text)); });
      }
      if (recosEl) {
        recosEl.innerHTML = '';
        if (has) r.recommendations.forEach(function (f) { recosEl.appendChild(li(f.type, f.text)); });
      }

      // Screen-reader announcement (only when tier changes)
      if (liveEl && has && tier !== lastAnnounced) {
        liveEl.textContent = 'Password strength: ' + r.label + '. Score ' + r.score + ' out of 100.';
      }
      if (!has) lastAnnounced = -1; else lastAnnounced = tier;
    }

    input.addEventListener('input', render);

    if (toggleBtn) {
      toggleBtn.innerHTML = EYE;
      toggleBtn.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggleBtn.innerHTML = show ? EYE_OFF : EYE;
        toggleBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
        toggleBtn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        input.focus();
      });
    }
    if (clearBtn) {
      clearBtn.innerHTML = X_ICON;
      clearBtn.style.visibility = 'hidden';
      clearBtn.addEventListener('click', function () {
        input.value = '';
        render();
        input.focus();
      });
    }
    render();
  }

  document.querySelectorAll('[data-checker]').forEach(initChecker);
})();
