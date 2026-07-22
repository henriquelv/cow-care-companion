const CACHE_NAME = "caderninho-casco-v10";
const CORE_ASSETS = ["/", "/manifest.webmanifest", "/icon.svg"];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch("/", { cache: "reload" });
  await cache.put("/", response.clone());

  const html = await response.text();
  const assetPaths = Array.from(
    html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g),
    (match) => match[1],
  );
  await Promise.allSettled(
    [...CORE_ASSETS.slice(1), ...new Set(assetPaths)].map((url) => cache.add(url)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("/", response.clone());
          }
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      });
    }),
  );
});
