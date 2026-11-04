/* OopsMyPassword — Offline-Capable Service Worker (sw.js).
   Caches core static assets, local JSON snapshots, and visited pages
   so all password tools, Academy lessons, and OSINT/Pentest hubs work offline. */
const CACHE_NAME = 'omp-static-v3';
const PRECACHE_URLS = [
  '/',
  '/tools',
  '/checker',
  '/generator',
  '/passphrase',
  '/entropy',
  '/breach-check',
  '/password-health',
  '/random-string',
  '/security-checklist',
  '/dork-builder',
  '/hash-inspector',
  '/url-scanner',
  '/compare',
  '/cheatsheets',
  '/glossary',
  '/learning',
  '/osint',
  '/pentest',
  '/articles',
  '/assets/css/styles.css',
  '/assets/css/learning.css',
  '/assets/js/theme-init.js',
  '/assets/js/main.js',
  '/assets/js/search.js',
  '/assets/js/security.js',
  '/assets/js/wordlist.js',
  '/assets/js/dork-builder.js',
  '/assets/js/hash-inspector.js',
  '/assets/js/url-scanner.js',
  '/assets/data/hubs-snapshot.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  /* Skip cross-origin requests (e.g. Supabase REST, esm.sh, HIBP) so the browser handles them natively. */
  if (url.origin !== self.location.origin) return;

  /* Skip non-GET requests and admin/sitemap endpoints. */
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/Anony.su')) return;
  if (url.pathname.endsWith('.xml') || url.pathname === '/robots.txt') return;

  // Network-first with cache fallback for HTML and JSON; Stale-while-revalidate for static assets
  if (req.mode === 'navigate' || url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});