const APP_VERSION = "1.2";

const CATEGORY_LABELS = {
  breakfast: "Breakfast",
  snack: "Snack",
  dinner: "Dinner",
  treat: "Treat",
};

const SORT_OPTIONS = [
  { value: "default", label: "Sort: Featured" },
  { value: "name-asc", label: "Sort: Name (A–Z)" },
  { value: "calories-asc", label: "Sort: Calories (Low–High)" },
  { value: "calories-desc", label: "Sort: Calories (High–Low)" },
  { value: "protein-desc", label: "Sort: Protein (High–Low)" },
  { value: "time-asc", label: "Sort: Quickest First" },
];

const FAV_KEY = "goobert-favourites";

const app = document.getElementById("app");
let RECIPES = [];

// ---- UI state ----
let activeCategory = "all";
let searchQuery = "";
let sortBy = "default";
let onlyHighProtein = false;
let onlyQuick = false;
let onlyFavourites = false;

function loadFavourites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveFavourites(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
}
let FAVOURITES = loadFavourites();

function toggleFavourite(id) {
  if (FAVOURITES.has(id)) FAVOURITES.delete(id);
  else FAVOURITES.add(id);
  saveFavourites(FAVOURITES);
}

async function loadRecipes() {
  const res = await fetch("data/recipes.json");
  RECIPES = await res.json();
}

function parseMinutes(str) {
  const m = /(\d+)/.exec(str || "");
  return m ? parseInt(m[1], 10) : 9999;
}

function macroCell(icon, value, unit, label) {
  return `
    <div class="macro-cell">
      <span class="icon">${icon}</span>
      <span class="val">${value}${unit}</span>
      <span class="lbl">${label}</span>
    </div>`;
}

function heartButton(id, size = "sm") {
  const active = FAVOURITES.has(id);
  const px = size === "lg" ? 20 : 15;
  return `
    <button class="heart-btn ${active ? "active" : ""} ${size}" data-fav="${id}" aria-label="Toggle favourite">
      <svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="${active ? "currentColor" : "none"}">
        <path d="M12 21s-7.5-4.6-10-9.2C0.3 8.1 2 4.5 5.6 4c2.1-.3 4 .8 6.4 3.4C14.4 4.8 16.3 3.7 18.4 4c3.6.5 5.3 4.1 3.6 7.8C19.5 16.4 12 21 12 21z" stroke="#3A2F2B" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>
    </button>`;
}

function recipeCardHTML(r) {
  return `
    <div class="recipe-card" data-category="${r.category}">
      <button class="card-tap" onclick="location.hash='#/recipe/${r.id}'">
        <div class="photo" style="background-image:url('assets/${r.image}')">
          <span class="cat-tag">${CATEGORY_LABELS[r.category] || r.category}</span>
        </div>
        <div class="info">
          <p class="title">${r.title}</p>
          <p class="cal">${r.calories} kcal · ${r.prep_time}</p>
        </div>
      </button>
      <div class="card-heart">${heartButton(r.id)}</div>
    </div>`;
}

function applyFilters() {
  let list = RECIPES.slice();

  if (activeCategory !== "all") list = list.filter(r => r.category === activeCategory);
  if (onlyHighProtein) list = list.filter(r => r.protein >= 20);
  if (onlyQuick) list = list.filter(r => parseMinutes(r.prep_time) <= 15);
  if (onlyFavourites) list = list.filter(r => FAVOURITES.has(r.id));

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.ingredients.some(ing => ing.toLowerCase().includes(q)) ||
      r.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  switch (sortBy) {
    case "name-asc": list.sort((a, b) => a.title.localeCompare(b.title)); break;
    case "calories-asc": list.sort((a, b) => a.calories - b.calories); break;
    case "calories-desc": list.sort((a, b) => b.calories - a.calories); break;
    case "protein-desc": list.sort((a, b) => b.protein - a.protein); break;
    case "time-asc": list.sort((a, b) => parseMinutes(a.prep_time) - parseMinutes(b.prep_time)); break;
  }

  return list;
}

function renderLibrary() {
  const filtered = applyFilters();

  const categoryChips = ["all", "breakfast", "snack", "dinner", "treat"].map(cat => {
    const label = cat === "all" ? "All" : CATEGORY_LABELS[cat];
    return `<button class="filter-chip ${cat === activeCategory ? "active" : ""}" data-cat="${cat}">${label}</button>`;
  }).join("");

  const toggleChips = `
    <button class="filter-chip ${onlyFavourites ? "active" : ""}" id="chip-fav">♥ Favourites</button>
    <button class="filter-chip ${onlyHighProtein ? "active" : ""}" id="chip-protein">High Protein</button>
    <button class="filter-chip ${onlyQuick ? "active" : ""}" id="chip-quick">Quick (≤15 min)</button>
  `;

  const sortSelectOptions = SORT_OPTIONS.map(o =>
    `<option value="${o.value}" ${o.value === sortBy ? "selected" : ""}>${o.label}</option>`
  ).join("");

  const cards = filtered.length
    ? filtered.map(recipeCardHTML).join("")
    : `<p class="empty-state" style="grid-column:1/-1">No recipes match. Try clearing a filter.</p>`;

  app.innerHTML = `
    <header class="topbar">
      <div class="wordmark">Goobert's Kitchen<small>What are we eating?</small></div>
      <span class="version-badge">v${APP_VERSION}</span>
    </header>
    <div class="search-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#6B5F58" stroke-width="2"/><path d="M21 21l-4.3-4.3" stroke="#6B5F58" stroke-width="2" stroke-linecap="round"/></svg>
      <input type="text" id="search-input" placeholder="Search recipes or ingredients…" value="${searchQuery.replace(/"/g, "&quot;")}" />
    </div>
    <div class="filter-row">${categoryChips}</div>
    <div class="filter-row secondary">${toggleChips}</div>
    <div class="sort-row">
      <select id="sort-select">${sortSelectOptions}</select>
    </div>
    <div class="grid">${cards}</div>
    <footer class="tag-line">🐢 ${RECIPES.length} recipes and counting</footer>
  `;

  app.querySelectorAll(".filter-chip[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => { activeCategory = btn.dataset.cat; renderLibrary(); });
  });
  document.getElementById("chip-fav").addEventListener("click", () => { onlyFavourites = !onlyFavourites; renderLibrary(); });
  document.getElementById("chip-protein").addEventListener("click", () => { onlyHighProtein = !onlyHighProtein; renderLibrary(); });
  document.getElementById("chip-quick").addEventListener("click", () => { onlyQuick = !onlyQuick; renderLibrary(); });
  document.getElementById("sort-select").addEventListener("change", (e) => { sortBy = e.target.value; renderLibrary(); });

  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderLibrary();
    const el = document.getElementById("search-input");
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });

  app.querySelectorAll(".heart-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavourite(btn.dataset.fav);
      renderLibrary();
    });
  });
}

function renderDetail(id) {
  const r = RECIPES.find(x => x.id === id);
  if (!r) {
    app.innerHTML = `<p class="empty-state">Recipe not found. <a href="#/">Go back</a></p>`;
    return;
  }

  const tags = r.tags.map(t => `<span class="tag-chip">${t}</span>`).join("");
  const ingredients = r.ingredients.map((ing, i) =>
    `<li data-i="${i}"><span class="check"></span>${ing}</li>`
  ).join("");
  const method = r.method.map(step => `<li>${step}</li>`).join("");
  const notes = r.notes.map(n => `<li>${n}</li>`).join("");

  const features = [];
  if (r.freezer_friendly) features.push("Freezer friendly");
  if (r.meal_prep_friendly) features.push("Meal prep friendly");
  const featureRow = features.length
    ? `<div class="feature-row">${features.map(f => `<span class="feature-chip">${f}</span>`).join("")}</div>`
    : "";

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="#3A2F2B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="wordmark">${CATEGORY_LABELS[r.category] || r.category}</div>
    </header>
    <div class="detail">
      <div class="detail-hero" style="background-image:url('assets/${r.image}')">
        <span class="cat-tag" style="background:var(--${r.category})">${CATEGORY_LABELS[r.category] || r.category}</span>
        <div class="hero-heart">${heartButton(r.id, "lg")}</div>
      </div>
      <h1>${r.title}</h1>
      <div class="macro-row">
        ${macroCell("🔥", r.calories, "", "kcal")}
        ${macroCell("💪", r.protein, "g", "Protein")}
        ${macroCell("🌾", r.carbs, "g", "Carbs")}
        ${macroCell("🥑", r.fat, "g", "Fat")}
        ${macroCell("🌿", r.fiber, "g", "Fiber")}
      </div>
      <div class="meta-row">
        <span>👥 Serves ${r.servings}</span>
        <span>◷ ${r.prep_time}</span>
      </div>
      <div class="tag-row">${tags}</div>

      <div class="section">
        <h2>🧺 Ingredients</h2>
        <ul class="ingredient-list" id="ingredient-list">${ingredients}</ul>
      </div>

      <div class="section">
        <h2>👨‍🍳 Method</h2>
        <ol class="method-list">${method}</ol>
      </div>

      <div class="section">
        <h2>💡 Notes</h2>
        <div class="notes-box">
          <ul>${notes}</ul>
          ${featureRow}
          <img class="mascot" src="assets/baby_goobert.png" alt="">
        </div>
      </div>
    </div>
  `;

  app.querySelectorAll("#ingredient-list li").forEach(li => {
    li.addEventListener("click", () => li.classList.toggle("done"));
  });

  app.querySelector(".hero-heart .heart-btn").addEventListener("click", () => {
    toggleFavourite(r.id);
    renderDetail(id);
  });

  window.scrollTo(0, 0);
}

function router() {
  const hash = location.hash || "#/";
  const match = hash.match(/^#\/recipe\/(.+)$/);
  if (match) {
    renderDetail(match[1]);
  } else {
    renderLibrary();
  }
}

window.addEventListener("hashchange", router);

loadRecipes().then(router);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}
