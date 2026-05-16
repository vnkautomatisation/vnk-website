// Service Worker — notifications Web Push uniquement.
// Enregistré par /admin pour recevoir les push du portail.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "VNK", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "VNK Automatisation";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon/favicon-192x192.png",
    badge: data.badge || "/favicon/favicon-48x48.png",
    tag: data.tag,
    data: { url: data.url || "/admin" },
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(new URL(url, self.location.origin).pathname) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
