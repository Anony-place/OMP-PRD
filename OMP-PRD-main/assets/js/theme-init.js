/* Sets data-theme before paint to avoid a theme flash (CSP-friendly: external file). */
(function () {
  try {
    var t = localStorage.getItem('omp-theme');
    if (t === 'light' || (t !== 'dark' && matchMedia('(prefers-color-scheme: light)').matches)) {
      document.documentElement.dataset.theme = 'light';
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.content = '#F6F8FC';
    }
  } catch (e) { /* private mode — dark default */ }
})();
