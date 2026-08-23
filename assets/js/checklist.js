/* ============================================================
   OopsMyPassword — interactive security checklist.
   Checkbox state is stored in localStorage (never passwords).
   ============================================================ */
(function () {
  'use strict';
  var root = document.querySelector('[data-checklist]');
  if (!root) return;

  var KEY = 'omp-security-checklist';
  var boxes = Array.prototype.slice.call(root.querySelectorAll('input[type="checkbox"][data-item]'));
  var bar = root.querySelector('[data-checklist-bar]');
  var label = root.querySelector('[data-checklist-count]');
  var resetBtn = root.querySelector('[data-checklist-reset]');

  function load() {
    var state = {};
    try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state = {}; }
    boxes.forEach(function (b) { b.checked = !!state[b.dataset.item]; });
  }
  function save() {
    var state = {};
    boxes.forEach(function (b) { if (b.checked) state[b.dataset.item] = true; });
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  function render() {
    var done = boxes.filter(function (b) { return b.checked; }).length;
    var pct = boxes.length ? Math.round((done / boxes.length) * 100) : 0;
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = done + ' of ' + boxes.length + ' complete (' + pct + '%)';
  }
  boxes.forEach(function (b) {
    b.addEventListener('change', function () { save(); render(); });
  });
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      boxes.forEach(function (b) { b.checked = false; });
      save(); render();
      window.ompToast('Checklist reset');
    });
  }
  load();
  render();
})();
