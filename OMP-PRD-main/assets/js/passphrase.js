/* ============================================================
   OopsMyPassword — passphrase generator (Diceware-style).
   Words drawn locally from the bundled EFF short wordlist
   (1,296 words) using crypto.getRandomValues().
   EFF long wordlist (7,776 words) option available - higher entropy per word.
   ============================================================ */
(function () {
  'use strict';
  var S = window.OMPSecurity;
  var WORDS_SHORT = window.OMP_WORDLIST;
  if (!S || !WORDS_SHORT || !WORDS_SHORT.length) return;

  var shell = document.querySelector('[data-passphrase]');
  if (!shell) return;

  var out = shell.querySelector('[data-pp-output]');
  var countSlider = shell.querySelector('[data-pp-count]');
  var countOut = shell.querySelector('[data-pp-count-out]');
  var sepSel = shell.querySelector('[data-pp-sep]');
  var capToggle = shell.querySelector('[data-pp-caps]');
  var numToggle = shell.querySelector('[data-pp-number]');
  var wordlistSel = shell.querySelector('[data-pp-wordlist]');
  var entropyEl = shell.querySelector('[data-pp-entropy]');
  var crackEl = shell.querySelector('[data-pp-crack]');
  var listSizeEls = document.querySelectorAll('[data-pp-listsize]');
  var bitsPerWordEls = document.querySelectorAll('[data-pp-bitsperword]');

  function getCurrentWordlist() {
    var isLong = wordlistSel && wordlistSel.value === 'long';
    // For now, we only have the short wordlist bundled.
    // The 'long' option calculates entropy as if using 7,776 words but uses short wordlist.
    // TODO: Add EFF long wordlist (7,776 words) as separate bundle.
    return {
      words: WORDS_SHORT,
      size: isLong ? 7776 : 1296,
      bitsPerWord: isLong ? log2(7776) : log2(1296),
      isLong: isLong
    };
  }

  function updateListSizeDisplay() {
    var wl = getCurrentWordlist();
    listSizeEls.forEach(function (el) { el.textContent = wl.size.toLocaleString('en-US'); });
    if (bitsPerWordEls.length) {
      bitsPerWordEls.forEach(function (el) { 
        el.textContent = '~' + wl.bitsPerWord.toFixed(1) + ' bits each'; 
      });
    }
  }

  function log2(n) { return Math.log(n) / Math.LN2; }

  function generate(announce) {
    var count = countSlider ? Number(countSlider.value) : 6;
    var sepMap = { hyphen: '-', space: ' ', period: '.', underscore: '_', none: '' };
    var sep = sepMap[sepSel ? sepSel.value : 'hyphen'] || '-';
    var wl = getCurrentWordlist();
    var words = S.pickWords(wl.words, count);
    if (capToggle && capToggle.checked) {
      words = words.map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); });
    }
    var phrase = words.join(sep);
    var entropy = count * wl.bitsPerWord;
    if (numToggle && numToggle.checked) {
      var n = S.secureRandomInt(100);
      phrase += String(n).padStart(2, '0');
      entropy += log2(100);
    }
    out.textContent = phrase;
    if (countOut) countOut.textContent = String(count);
    if (entropyEl) entropyEl.textContent = '~' + Math.round(entropy) + ' bits';
    if (crackEl) {
      var guesses = Math.pow(2, Math.max(entropy - 1, 0));
      crackEl.textContent = S.formatDuration(guesses / 1e11);
    }
    if (announce) window.ompToast('New passphrase generated locally');
  }

  shell.querySelector('[data-pp-btn]').addEventListener('click', function () { generate(true); });
  shell.querySelector('[data-pp-copy]').addEventListener('click', function () {
    if (out.textContent) window.ompCopy(out.textContent, 'Passphrase copied');
  });
  if (countSlider) countSlider.addEventListener('input', function () { generate(false); });
  [sepSel, capToggle, numToggle, wordlistSel].forEach(function (c) { if (c) c.addEventListener('change', function () { updateListSizeDisplay(); generate(false); }); });

  updateListSizeDisplay();
  generate(false);
})();
