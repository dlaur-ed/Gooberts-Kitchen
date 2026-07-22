const CACHE_NAME = "goobert-kitchen-app-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./data/recipes.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./assets/baby_goobert.png",
  "./assets/leaf_branch.png",
  "./assets/greek_yogurt_bowl.png",
  "./assets/cottage_cheese_berries.png",
  "./assets/lemon_chicken_rice.png",
  "./assets/overnight_oats_pb.png",
  "./assets/hummus_veggie_sticks.png",
  "./assets/turkey_chili.png",
  "./assets/choc_protein_mug_cake.png",
  "./assets/uranium_bowl.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => cached)
      );
    })
  );
});
