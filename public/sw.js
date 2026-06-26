/*
 * Curious Labs service worker — offline + low-data support.
 *
 * Strategy:
 *  - Immutable build assets & images  → cache-first  (no network on repeat
 *    visits = works on low/zero data once a lab has been opened).
 *  - Page navigations                 → network-first, falling back to the
 *    cached page, then to an offline screen.
 *  - Everything else (e.g. auth/data API calls) is left to the network.
 *
 * Bump VERSION to roll out a new cache and purge the old one.
 */

const VERSION = "v1";
const STATIC_CACHE = `cl-static-${VERSION}`;
const PAGE_CACHE = `cl-pages-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/curious-labs-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // allSettled so one missing asset can't abort the whole install
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Leave cross-origin requests (auth API, third-party) to the network.
  if (url.origin !== self.location.origin) return;

  // Immutable build assets & media → cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|woff2?|png|jpe?g|svg|webp|gif|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Page navigations → network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match(OFFLINE_URL));
        }),
    );
  }
});
