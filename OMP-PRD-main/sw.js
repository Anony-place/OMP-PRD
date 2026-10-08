/**
 * OopsMyPassword Service Worker
 * Provides offline-first caching for static assets (shell, not data).
 * Passwords and user data are NEVER cached.
 */
const CACHE_NAME = 'omp-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/checker',
  '/checker.html',
  '/generator',
  '/generator.html',
  '/tools',
  '/tools.html',
  '/articles',
  '/articles.html',
  '/products',
  '/products.html',
  '/learning',
  '/learning.html',
  '/breach-check',
  '/breach-check.html',
  '/password-health',
  '/password-health.html',
  '/entropy',
  '/entropy.html',
  '/passphrase',
  '/passphrase.html',
  '/random-string',
  '/random-string.html',
  '/security-checklist',
  '/security-checklist.html',
  '/faq',
  '/faq.html',
  '/privacy',
  '/privacy.html',
  '/terms',
  '/terms.html',
  '/about',
  '/about.html',
  '/contact',
  '/contact.html',
  '/security',
  '/security.html',
  '/sitemap',
  '/sitemap.html',
  '/glossary',
  '/glossary.html',
  '/404.html',
  '/assets/css/styles.css',
  '/assets/css/learning.css',
  '/assets/js/theme-init.js',
  '/assets/js/main.js',
  '/assets/js/security.js',
  '/assets/js/wordlist.js',
  '/assets/js/checker.js',
  '/assets/js/generator.js',
  '/assets/js/breach.js',
  '/assets/js/health.js',
  '/assets/js/entropy.js',
  '/assets/js/passphrase.js',
  '/assets/js/url.js',
  '/assets/js/checklist.js',
  '/assets/js/search.js',
  '/assets/js/contact.js',
  '/assets/js/articles.js',
  '/assets/js/markdown.js',
  '/assets/js/sanitize.js',
  '/assets/js/filevalidate.js',
  '/assets/js/products.js',
  '/assets/icons/favicon.svg',
  '/assets/icons/favicon-32.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-512.png',
  '/manifest.webmanifest'
];

// Pages that should NEVER be cached (contain sensitive user data or are dynamic)
const NEVER_CACHE = [
  '/checker',  // password input
  '/generator', // password generation
  '/breach-check', // breach check input
  '/password-health', // password audit
  '/entropy', // entropy calculator
  '/passphrase', // passphrase generation
  '/random-string', // random string generation
  '/security-checklist' // checklist with user data
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network-first for HTML, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Never cache password-related pages or API calls
  if (NEVER_CACHE.some(path => url.pathname.startsWith(path))) {
    event.respondWith(networkOnly(event.request));
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    event.respondWith(networkOnly(event.request));
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(networkOnly(event.request));
    return;
  }
  
  // For HTML pages: network-first with cache fallback
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // Content data (catalogue, self-checks, reading) must always come from the
  // network: it ships with every deploy, and a cached copy would both mask
  // outages and keep serving a stale catalogue after publishing.
  if (url.pathname.startsWith('/assets/data/')) {
    return;
  }

  // For static assets: serve from cache instantly, refresh in the background.
  // Pure cache-first pinned assets forever, so a deploy never reached users
  // until the CACHE_NAME changed — mixing new HTML with stale JS/data.
  if (url.pathname.startsWith('/assets/') || 
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/manifest.webmanifest') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  
  // Default: network-first
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/404.html');
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    // Update the cache in the background; never block the page on it.
    refresh.catch(() => {});
    return cached;
  }
  const response = await refresh;
  if (response) return response;
  throw new Error('Asset unavailable offline: ' + request.url);
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // For navigation requests, return offline page
    if (request.mode === 'navigate') {
      return caches.match('/404.html');
    }
    throw error;
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});