// LoreCraft Studio offline helper (service worker).
// - The page itself: network first, so updates show right away; the saved copy is used when offline.
// - Fonts, icons and scripts from CDNs: served from the cache and refreshed in the background.
// - Firebase sign-in and database traffic is never touched here (Firebase keeps its own offline copy).
const CACHE = 'lorecraft-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const SKIP_HOSTS = ['firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com',
  'firebaseappcheck.googleapis.com', 'content-firebaseappcheck.googleapis.com', 'www.google.com', 'www.gstatic.com/recaptcha'];
const ASSET_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (SKIP_HOSTS.some((h) => (url.host + url.pathname).startsWith(h)) && !url.pathname.startsWith('/firebasejs/')) return;

  // The app page: try the network, fall back to the saved copy
  if (req.mode === 'navigate' || (url.origin === self.location.origin && url.pathname.endsWith('/index.html'))) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Static files: cached copy first, refreshed in the background
  if (url.origin === self.location.origin || ASSET_HOSTS.includes(url.host)) {
    event.respondWith(
      caches.open(CACHE).then((cache) => cache.match(req).then((cached) => {
        const fresh = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      }))
    );
  }
});
