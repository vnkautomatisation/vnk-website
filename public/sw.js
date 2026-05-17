// Service worker minimaliste — offline-aware shell + cache des assets statiques.
// Stratégie :
//   - HTML : network-first avec fallback cache (offline page si tout échoue)
//   - JS/CSS/images : stale-while-revalidate
//   - API : pas de cache (toujours réseau)
// ⚠️ Le service worker pour push notifications existe déjà (/push-sw.js).
//    Ce SW-ci est dédié à la PWA installable. Les deux peuvent coexister
//    si scopes distincts (push-sw enregistré explicitement, sw.js auto).

const VERSION = "v1";
const STATIC_CACHE = `vnk-static-${VERSION}`;
const HTML_CACHE = `vnk-html-${VERSION}`;

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/favicon/favicon-192x192.png",
  "/favicon/favicon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pas de cache pour API ni pour les routes auth
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // HTML pages : network-first
  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(HTML_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/")))
    );
    return;
  }

  // Assets statiques : stale-while-revalidate
  if (/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|gif|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetched = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => null);
        return cached || fetched || new Response(null, { status: 504 });
      })
    );
  }
});
