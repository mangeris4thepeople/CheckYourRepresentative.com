// =============================================================================
// Service worker for Check Your Representative.
//
// Conservative on purpose:
//   - /api/ requests are NEVER cached, and never served from cache. Bills,
//     votes, money data, and anything authenticated always come from the
//     network, so nothing civic is ever stale and no signed-in response
//     ever lands in a shared cache.
//   - Navigations are network first with the cached shell as fallback, and
//     the branded offline page when both fail.
//   - Hashed static assets under /assets/ and the icons are cache first,
//     which is safe because their filenames change when their content does.
// Bump VERSION to invalidate everything on deploy of a new worker.
// =============================================================================
const VERSION = "cyr-v2";
const SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Data routes: network only, no caching, ever.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: fresh page first, the branded offline page when the
  // network fails. Never a cached app shell: the shell without its data
  // would render a blank or stale page, and stale is the one thing this
  // site promised never to be.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Hashed assets and icons: cache first, fill the cache from the network.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});
