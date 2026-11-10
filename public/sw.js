self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = { title: "Casa Planejada", body: "" };
  try { d = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: "/icons/app-192.png", badge: "/icons/app-192.png", data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow(e.notification.data.url))));
});
