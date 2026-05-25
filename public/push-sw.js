// Service Worker NEUTRALISE temporairement pour debugger un spam de fetch.
// Quand le browser le re-recupere, il se desinscrit lui-meme et libere les
// clients. Plus aucun fetch handler, plus aucune interception.
//
// Pour reactiver les Web Push : restaurer l'ancien handler 'push' + supprimer
// le bloc d'auto-unregister ci-dessous.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Libere immediatement les clients controles
      await self.clients.claim();

      // Vide tous les caches
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

      // Force-reload de tous les clients pour qu'ils ne soient plus
      // controles par un SW. Sans ca, ils gardent l'ancien SW en memoire
      // tant qu'ils ne sont pas fermes.
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

// Pas de handler 'fetch' ni 'push'. Le SW est inerte jusqu'a son activation,
// puis se supprime tout seul.
