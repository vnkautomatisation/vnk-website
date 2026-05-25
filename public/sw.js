// Service Worker PWA NEUTRALISE temporairement pour debugger un spam de fetch.
// Quand le browser le re-recupere, il se desinscrit lui-meme, vide ses caches
// et force-recharge les clients pour qu'ils ne soient plus controles.
//
// Pour reactiver la PWA offline : restaurer l'ancien fichier depuis git
// (git show HEAD:public/sw.js > public/sw.js).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      // Vide tous les caches (HTML + assets)
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        console.warn("[sw] cache cleanup failed", e);
      }

      // Auto-desinscription
      try {
        await self.registration.unregister();
        console.log("[sw] auto-unregistered");
      } catch (e) {
        console.warn("[sw] unregister failed", e);
      }

      // Force-reload de tous les clients pour briser le controle SW
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const c of clients) {
          c.navigate(c.url).catch(() => null);
        }
      } catch (e) {
        console.warn("[sw] client reload failed", e);
      }
    })()
  );
});

// PAS de handler 'fetch'. Le SW ne fait que se desinscrire.
