"use strict";

const UI_CACHE = "tan-vuong-ui-v1";
const DATA_CACHE = "tan-vuong-data-v1";

const CORE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(UI_CACHE)
      .then(cache => cache.addAll(CORE))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== UI_CACHE && key !== DATA_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (
    request.method !== "GET"
    ||
    !request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  const url = new URL(request.url);

  // Số câu và dữ liệu câu hỏi: ưu tiên bản mới, fallback cache.
  if (
    url.pathname.endsWith("/question-manifest.json")
    ||
    url.pathname.includes("/questions/")
  ) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(DATA_CACHE)
            .then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Giao diện/ảnh: hiện cache trước để mở nhanh, đồng thời làm mới ở nền.
  event.respondWith(
    caches.match(request).then(cached => {
      const network =
        fetch(request)
          .then(response => {
            const copy = response.clone();
            caches.open(UI_CACHE)
              .then(cache => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);

      return cached || network;
    })
  );
});
