/* ============================================================
   OopsMyPassword — entropy calculator.
   Two local modes: derive from a password, or from parameters.
   ============================================================ */
(function () {
  'use strict';
  var S = window.OMPSecurity;
  if (!S) return;
  var WL = window.OMP_WORDLIST || null;

  function log2(n) { return Math.log(n) / Math.LN2; }

  /* Attacker models (guesses per second) */
  var ATTACKERS = [
    { name: 'Online attack (rate-limited)', rate: 0.1, note: 'Server throttles attempts' },
    { name: 'Offline vs. slow hash (bcrypt/Argon2)', rate: 1e5, note: 'Modern password hashing' },
    { name: 'Offline vs. fast hash (GPU rig)', rate: 1e11, note: 'MD5/SHA-1 style leaks' }
  ];

  var poolInputs = document.querySelectorAll('[data-ec-pool]');
  var customPool = document.querySelector('[data-ec-custom-pool]');
  var lenSlider = document.querySelector('[data-ec-length]');
  var lenOut = document.querySelector('[data-ec-length-out]');
  var entropyOut = document.querySelector('[data-ec-entropy]');
  var comboOut = document.querySelector('[data-ec-combos]');
  var tableBody = document.querySelector('[data-ec-table]');
  var pwInput = document.querySelector('[data-ec-password]');
  var pwEntropy = document.querySelector('[data-ec-pw-entropy]');
  var pwDetail = document.querySelector('[data-ec-pw-detail]');
  if (!entropyOut) return;

  function fmtBig(n) {
    if (n < 1e6) return Math.round(n).toLocaleString('en-US');
    var exp = Math.floor(Math.log10(n));
    var mant = n / Math.pow(10, exp);
    return '~' + mant.toFixed(1) + ' × 10^' + exp;
  }

  function currentPool() {
    var pool = 0;
    poolInputs.forEach(function (ch) {
      if (!ch.checked) return;
      var v = ch.value;
      if (v === 'lower') pool += 26;
      else if (v === 'upper') pool += 26;
      else if (v === 'digits') pool += 10;
      else if (v === 'symbols') pool += 33;
      else if (v === 'space') pool += 1;
    });
    if (customPool && customPool.value) {
      pool = Math.max(1, Number(customPool.value) || 0);
    }
    return Math.max(pool, 1);
  }

  function render() {
    var pool = currentPool();
    var len = lenSlider ? Number(lenSlider.value) : 16;
    var entropy = len * log2(pool);
    var combos = Math.pow(2, entropy);
    if (lenOut) lenOut.textContent = String(len);
    entropyOut.textContent = '~' + Math.round(entropy) + ' bits';
    if (comboOut) comboOut.textContent = fmtBig(combos);
    if (tableBody) {
      tableBody.innerHTML = '';
      ATTACKERS.forEach(function (a) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        var td2 = document.createElement('td');
        var td3 = document.createElement('td');
        td1.textContent = a.name;
        td2.className = 'mono';
        td2.textContent = a.rate.toLocaleString('en-US') + '/s';
        td3.textContent = S.formatDuration(Math.pow(2, Math.max(entropy - 1, 0)) / a.rate);
        var small = document.createElement('div');
        small.className = 'tiny muted';
        small.textContent = a.note;
        td1.appendChild(small);
        tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
        tableBody.appendChild(tr);
      });
    }
  }

  poolInputs.forEach(function (ch) { ch.addEventListener('change', render); });
  if (customPool) customPool.addEventListener('input', render);
  if (lenSlider) lenSlider.addEventListener('input', render);

  if (pwInput) {
    pwInput.addEventListener('input', function () {
      var r = S.analyzePassword(pwInput.value, { wordlist: WL });
      if (!pwInput.value) {
        pwEntropy.textContent = '—';
        if (pwDetail) pwDetail.textContent = '';
        return;
      }
      pwEntropy.textContent = r.entropy.toLocaleString('en-US') + ' bits (adjusted)';
      if (pwDetail) {
        pwDetail.textContent = 'Naive pool estimate: ' + r.entropyNaive + ' bits · patterns ' +
          (r.score < 100 ? 'reduce the effective estimate — score ' + r.score + '/100' : 'none detected');
      }
    });
  }

  render();
})();
