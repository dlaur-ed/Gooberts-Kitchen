const CATEGORY_LABELS = {
  breakfast: "Breakfast",
  snack: "Snack",
  dinner: "Dinner",
  treat: "Treat",
};

const app = document.getElementById("app");
let RECIPES = [];
let activeCategory = "all";

async function loadRecipes() {
  const res = await fetch("data/recipes.json");
  RECIPES = await res.json();
}

function macroCell(icon, value, unit, label) {
  return `
    <div class="macro-cell">
      <span class="icon">${icon}</span>
      <span class="val">${value}${unit}</span>
      <span class="lbl">${label}</span>
    </div>`;
}

function recipeCardHTML(r) {
  return `
    <button class="recipe-card" data-category="${r.category}" onclick="location.hash='#/recipe/${r.id}'">
      <div class="photo" style="background-image:url('assets/${r.image}')">
        <span class="cat-tag">${CATEGORY_LABELS[r.category] || r.category}</span>
      </div>
      <div class="info">
        <p class="title">${r.title}</p>
        <p class="cal">${r.calories} kcal · ${r.prep_time}</p>
      </div>
    </button>`;
}

function renderLibrary() {
  const filtered = activeCategory === "all"
    ? RECIPES
    : RECIPES.filter(r => r.category === activeCategory);

  const chips = ["all", "breakfast", "snack", "dinner", "treat"].map(cat => {
    const label = cat === "all" ? "All" : CATEGORY_LABELS[cat];
    return `<button class="filter-chip ${cat === activeCategory ? "active" : ""}" data-cat="${cat}">${label}</button>`;
  }).join("");

  const cards = filtered.length
    ? filtered.map(recipeCardHTML).join("")
    : `<p class="empty-state" style="grid-column:1/-1">No recipes in this category yet.</p>`;

  app.innerHTML = `
    <header class="topbar">
      <div class="wordmark">Goobert's Kitchen<small>What are we eating?</small></div>
    </header>
    <div class="filter-row">${chips}</div>
    <div class="grid">${cards}</div>
    <footer class="tag-line">🐢 ${RECIPES.length} recipes and counting</footer>
  `;

  app.querySelectorAll(".filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
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
      <button class="back-btn" onclick="history.back()">←</button>
      <div class="wordmark">${CATEGORY_LABELS[r.category] || r.category}</div>
    </header>
    <div class="detail">
      <div class="detail-hero" style="background-image:url('assets/${r.image}')">
        <span class="cat-tag" style="background:var(--${r.category})">${CATEGORY_LABELS[r.category] || r.category}</span>
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
