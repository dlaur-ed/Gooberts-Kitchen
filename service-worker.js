const CACHE_NAME = "goobert-kitchen-app-v24";
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
  "./assets/b03_protein_porridge_with_banana_and_chocolate_chunks.jpg",
  "./assets/b04_protein_porridge_with_banana_strawberries_and_chocolate_chunks.jpg",
  "./assets/b05_protein_porridge_with_blueberries_and_chocolate_chunks.jpg",
  "./assets/b06_protein_porridge_with_strawberry_and_chocolate_chunks.jpg",
  "./assets/b07_brownie_baked_oats.jpg",
  "./assets/b08_blueberry_muffin_overnight_oats.jpg",
  "./assets/b09_banana_bread_baked_oats.jpg",
  "./assets/b10_strawberry_banana_overnight_oats.jpg",
  "./assets/b11_baked_beans_with_toast_and_eggs.jpg",
  "./assets/b12_crisp_bread_with_cucumber_and_eggs.jpg",
  "./assets/b13_baked_beans_and_toast.jpg",
  "./assets/b14_grilled_cheese_light.jpg",
  "./assets/b15_cheesy_beans_on_toast.jpg",
  "./assets/b16_beans_potato_brunch_bowl.jpg",
  "./assets/b17_banana_split_yogurt_bowl.jpg",
  "./assets/b18_baked_beans_with_pretzel_stick.jpg",
  "./assets/choc_protein_mug_cake.png",
  "./assets/cottage_cheese_berries.png",
  "./assets/d03_chicken_wraps.jpg",
  "./assets/d04_chicken_fajita_quesadilla.jpg",
  "./assets/d05_chicken_pizza_wrap.jpg",
  "./assets/d06_chicken_parmesan_pasta.jpg",
  "./assets/d07_loaded_chicken_fries_bowl.jpg",
  "./assets/d08_loaded_sweet_potato_chicken_bowl.jpg",
  "./assets/d09_chicken_caesar_salad.jpg",
  "./assets/d10_chicken_cheddar_melt.jpg",
  "./assets/d11_chicken_mac_and_cheese.jpg",
  "./assets/d12_chicken_alfredo_pasta.jpg",
  "./assets/d13_chicken_veggie_tomato_pasta.jpg",
  "./assets/d14_chicken_tomato_tortellini.jpg",
  "./assets/d15_chicken_vegetable_gratin.jpg",
  "./assets/d16_chicken_parmesan.jpg",
  "./assets/d17_chicken_potato_gratin.jpg",
  "./assets/d18_chicken_broccoli_gratin.jpg",
  "./assets/d19_cheeseburger_chicken_wrap.jpg",
  "./assets/d20_chicken_philly_cheesesteak_wrap.jpg",
  "./assets/d21_philly_cheesesteak_chicken_sandwich.jpg",
  "./assets/d22_chicken_club_guacamole_wrap.jpg",
  "./assets/d23_chicken_guacamole_fries_bowl.jpg",
  "./assets/d24_chicken_quesadilla_with_guacamole_and_tomatoes.jpg",
  "./assets/d25_lentil_soup_with_chicken_and_pretzel_roll.jpg",
  "./assets/d26_creamy_pesto_chicken_pasta.jpg",
  "./assets/d27_creamy_mushroom_chicken_pasta.jpg",
  "./assets/d28_chicken_pesto_melt.jpg",
  "./assets/greek_yogurt_bowl.png",
  "./assets/hummus_veggie_sticks.png",
  "./assets/lemon_chicken_rice.png",
  "./assets/overnight_oats_pb.png",
  "./assets/s03_protein_iced_coffee.jpg",
  "./assets/s04_protein_iced_mocha.jpg",
  "./assets/s05_protein_iced_chocolate_milk.jpg",
  "./assets/s06_protein_nachos_western_style.jpg",
  "./assets/t03_kinder_cards.jpg",
  "./assets/t04_kinder_penguin.jpg",
  "./assets/t05_kinder_bueno.jpg",
  "./assets/t06_kinder_schokobons.jpg",
  "./assets/t07_kitkat.jpg",
  "./assets/t08_hanuta.jpg",
  "./assets/t09_kinder_riegel.jpg",
  "./assets/t10_duplo.jpg",
  "./assets/t11_cookie_dough_mandms.jpg",
  "./assets/t12_peanut_mandms.jpg",
  "./assets/t13_roasted_almonds.jpg",
  "./assets/t14_kinder_happy_hippos.jpg",
  "./assets/t15_popcorn.jpg",
  "./assets/t16_ahead_low_sugar_gummies.jpg",
  "./assets/t17_paprika_chips.jpg",
  "./assets/t18_mixed_nuts.jpg",
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
