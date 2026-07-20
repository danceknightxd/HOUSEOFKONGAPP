/* ============================================================
   THE THRONE — SERVICE WORKER
   Caches the app shell so it works offline and installs like
   a native app. Feed requests (JSONP scripts, rss2json fetches)
   are deliberately left untouched — they should always hit the
   network for fresh news, not the cache.
   ============================================================ */

const CACHE_NAME = "the-throne-shell-v33";
const SHELL_FILES = [
  "./index.html",
  "./liquid-bg.js",
  "./config.js",
  "./feeds.js",
  "./supabase-config.js",
  "./supabase-client.js",
  "./vault-crypto.js",
  "./auth.js",
  "./sync.js",
  "./tasksplus.js",
  "./spotify-config.js",
  "./spotify.js",
  "./market-config.js",
  "./markets.js",
  "./webrtc-config.js",
  "./webrtc.js",
  "./kings-config.js",
  "./kings.js",
  "./push-config.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./icon-192-apple.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only manage same-origin app-shell requests. Everything else
  // (news feeds, JSONP callbacks, rss2json) goes straight to network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ---------- PUSH NOTIFICATIONS ----------
// Real OS-level notifications — fires even if The Throne isn't open,
// as long as the browser/OS has it running in the background.
self.addEventListener("push", (event) => {
  let data = { title: "The Throne", body: "You have a new notification.", url: "./" };
  try { data = event.data.json(); } catch (e) { /* fall back to default */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: { url: data.url || "./" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
