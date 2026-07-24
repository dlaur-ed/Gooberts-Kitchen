const CACHE_NAME = "goobert-kitchen-app-v17";
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
  "./assets/uranium_bowl.png",
  "./assets/choc_protein_mug_cake.png",
  "./assets/cottage_cheese_berries.png",
  "./assets/d03_chicken_wraps.png",
  "./assets/d04_chicken_fajita_quesadilla.png",
  "./assets/d05_chicken_pizza_wrap.png",
  "./assets/d06_chicken_parmesan_pasta.png",
  "./assets/d07_loaded_chicken_fries_bowl.png",
  "./assets/d08_loaded_sweet_potato_chicken_bowl.png",
  "./assets/d09_chicken_caesar_salad.png",
  "./assets/d10_chicken_cheddar_melt.png",
  "./assets/d11_chicken_mac_and_cheese.png",
  "./assets/d12_chicken_alfredo_pasta.png",
  "./assets/d13_chicken_veggie_tomato_pasta.png",
  "./assets/d14_chicken_tomato_tortellini.png",
  "./assets/d15_chicken_vegetable_gratin.png",
  "./assets/d16_chicken_parmesan.png",
  "./assets/d17_chicken_potato_gratin.png",
  "./assets/d18_chicken_broccoli_gratin.png",
  "./assets/d19_cheeseburger_chicken_wrap.png",
  "./assets/d20_chicken_philly_cheesesteak_wrap.png",
  "./assets/d21_philly_cheesesteak_chicken_sandwich.png",
  "./assets/d22_chicken_club_guacamole_wrap.png",
  "./assets/d23_chicken_guacamole_fries_bowl.png",
  "./assets/d24_chicken_quesadilla_with_guacamole_and_tomatoes.png",
  "./assets/d25_lentil_soup_with_chicken_and_pretzel_roll.png",
  "./assets/d26_creamy_pesto_chicken_pasta.png",
  "./assets/d27_creamy_mushroom_chicken_pasta.png",
  "./assets/d28_chicken_pesto_melt.png",
  "./assets/greek_yogurt_bowl.png",
  "./assets/hummus_veggie_sticks.png",
  "./assets/lemon_chicken_rice.png",
  "./assets/overnight_oats_pb.png",
  "./assets/turkey_chili.png"
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
