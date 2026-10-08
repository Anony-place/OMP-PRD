/* Sets data-theme before paint to avoid a theme flash (CSP-friendly: external file).
   Default is LIGHT; a stored 'dark' choice (or the toggle) switches to dark. */
(function () {
  try {
    var t = null;
    try { t = localStorage.getItem('omp-theme'); } catch (e) { /* private mode */ }
    if (t !== 'dark') {
      document.documentElement.dataset.theme = 'light';
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.content = '#F6F8FC';
    }
  } catch (e) { /* private mode — light default from markup */ }
})();
