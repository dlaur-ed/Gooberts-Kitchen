const APP_VERSION = "2.0";

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
const PLAN_KEY = "goobert-meal-plan";
const GOALS_KEY = "goobert-macro-goals";

const BACK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="#3A2F2B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---------- Easter eggs ----------
// Add more by giving a new keyword an array of joke "recipes" in the same
// shape as real recipes. Triggered when the search box matches the keyword.
const EASTER_EGGS = {
  uranium: [
    {
      id: "EGG-U1",
      category: "treat",
      title: "Uranium-Infused Power Bowl",
      calories: 1000000000,
      protein: 999999999,
      carbs: 0,
      fat: -9999,
      fiber: NaN,
      servings: "1 (if you survive)",
      prep_time: "4.5 billion years",
      image: "uranium_bowl.png",
      ingredients: [
        "1 rod enriched uranium-235",
        "A pinch of existential dread",
        "2 tbsp forbidden glow",
        "1 lead-lined spoon (do not skip)",
      ],
      method: [
        "Do not attempt.",
        "Seriously, put it down.",
        "This is a joke recipe. Please eat an actual snack.",
        "Baby Goobert is very concerned about you right now.",
      ],
      notes: [
        "This recipe is fictional and radioactive-themed for fun only.",
        "Half-life: longer than this app will ever be maintained.",
      ],
      tags: ["⚠️ Do Not Eat", "Nuclear-Grade", "Not FDA Approved"],
      freezer_friendly: false,
      meal_prep_friendly: false,
      isEasterEgg: true,
    },
    {
      id: "EGG-U2",
      category: "dinner",
      title: "Chernobyl-Style Casserole",
      calories: 999999999,
      protein: 500000,
      carbs: 88888,
      fat: 12000,
      fiber: 3,
      servings: "Serves a small city",
      prep_time: "Do not attempt",
      image: "uranium_bowl.png",
      ingredients: [
        "1 reactor core, lightly seasoned",
        "3 cups regret",
        "A dash of gamma rays",
      ],
      method: [
        "Evacuate the kitchen.",
        "Call literally anyone else.",
        "This is not a real recipe.",
      ],
      notes: ["You found an easter egg! 🐢☢️"],
      tags: ["⚠️ Do Not Eat", "Glows in the Dark"],
      freezer_friendly: false,
      meal_prep_friendly: false,
      isEasterEgg: true,
    },
  ],
};

function matchedEasterEgg(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return EASTER_EGGS[q] || null;
}

function allEasterEggRecipes() {
  return Object.values(EASTER_EGGS).flat();
}

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

// ---------- Meal plan (per-day list of recipe ids) ----------
function loadPlan() {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY) || "{}"); }
  catch { return {}; }
}
function savePlan(p) { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); }
let MEAL_PLAN = loadPlan();

function addToPlan(date, id) {
  if (!MEAL_PLAN[date]) MEAL_PLAN[date] = [];
  if (!MEAL_PLAN[date].includes(id)) MEAL_PLAN[date].push(id);
  savePlan(MEAL_PLAN);
}
function removeFromPlan(date, id) {
  if (MEAL_PLAN[date]) MEAL_PLAN[date] = MEAL_PLAN[date].filter(x => x !== id);
  savePlan(MEAL_PLAN);
}
function findRecipeById(id) {
  return RECIPES.find(r => r.id === id) || allEasterEggRecipes().find(r => r.id === id);
}
function tallyForDate(date) {
  const ids = MEAL_PLAN[date] || [];
  const recipes = ids.map(findRecipeById).filter(Boolean);
  return recipes.reduce((acc, r) => {
    acc.calories += (typeof r.calories === "number" ? r.calories : 0);
    acc.protein += (typeof r.protein === "number" ? r.protein : 0);
    acc.carbs += (typeof r.carbs === "number" ? r.carbs : 0);
    acc.fat += (typeof r.fat === "number" ? r.fat : 0);
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ---------- Macro goals ----------
const DEFAULT_GOALS = { calories: 2000, protein: 120, carbs: 200, fat: 65 };
function loadGoals() {
  try { return { ...DEFAULT_GOALS, ...JSON.parse(localStorage.getItem(GOALS_KEY) || "{}") }; }
  catch { return { ...DEFAULT_GOALS }; }
}
function saveGoals(g) { localStorage.setItem(GOALS_KEY, JSON.stringify(g)); }
let GOALS = loadGoals();

// ---------- Dates ----------
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
let selectedDate = todayISO();

function dateStripHTML() {
  const chips = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dow = i === 0 ? "Today" : i === 1 ? "Tmrw" : d.toLocaleDateString(undefined, { weekday: "short" });
    chips.push(`
      <button class="date-chip ${iso === selectedDate ? "active" : ""}" data-date="${iso}">
        <span class="dow">${dow}</span>
        <span class="dom">${d.getDate()}</span>
      </button>`);
  }
  return `<div class="date-strip">${chips.join("")}</div>`;
}
function attachDateStripHandlers(rerenderFn) {
  app.querySelectorAll(".date-chip").forEach(btn => {
    btn.addEventListener("click", () => { selectedDate = btn.dataset.date; rerenderFn(); });
  });
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
  let display = value;
  if (Number.isNaN(value)) display = "∞";
  else if (typeof value === "number") display = value.toLocaleString();
  return `
    <div class="macro-cell">
      <span class="icon">${icon}</span>
      <span class="val">${display}${unit}</span>
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

function bottomNavHTML(active) {
  const tabs = [
    { key: "library", href: "#/", icon: "🍽", label: "Library" },
    { key: "decide", href: "#/decide", icon: "🔀", label: "Decide" },
    { key: "plan", href: "#/plan", icon: "📅", label: "Plan" },
  ];
  const btns = tabs.map(t =>
    `<button class="nav-btn ${t.key === active ? "active" : ""}" onclick="location.hash='${t.href}'">
       <span class="nav-icon">${t.icon}</span><span class="nav-label">${t.label}</span>
     </button>`
  ).join("");
  return `<div class="nav-spacer"></div><nav class="bottom-nav">${btns}</nav>`;
}

function recipeCardHTML(r) {
  return `
    <div class="recipe-card ${r.isEasterEgg ? "egg-card" : ""}" data-category="${r.category}">
      <button class="card-tap" onclick="location.hash='#/recipe/${r.id}'">
        <div class="photo" style="background-image:url('assets/${r.image}')">
          <span class="cat-tag" ${r.isEasterEgg ? 'style="background:#5c7a1e"' : ""}>${r.isEasterEgg ? "☢️ Classified" : (CATEGORY_LABELS[r.category] || r.category)}</span>
        </div>
        <div class="info">
          <p class="title">${r.title}</p>
          <p class="cal">${typeof r.calories === "number" ? r.calories.toLocaleString() : r.calories} kcal · ${r.prep_time}</p>
        </div>
      </button>
      <div class="card-heart">${heartButton(r.id)}</div>
    </div>`;
}

function applyFilters() {
  const egg = matchedEasterEgg(searchQuery);
  if (egg) return egg;

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

  const egg = matchedEasterEgg(searchQuery);
  const eggBanner = egg
    ? `<p class="egg-banner">☢️ Uh oh. You found something you shouldn't have.</p>`
    : "";

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
    ${eggBanner}
    <div class="grid">${cards}</div>
    <footer class="tag-line">🐢 ${RECIPES.length} recipes and counting</footer>
    ${bottomNavHTML("library")}
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
  const r = RECIPES.find(x => x.id === id) || allEasterEggRecipes().find(x => x.id === id);
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
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">${CATEGORY_LABELS[r.category] || r.category}</div>
    </header>
    <div class="detail">
      <div class="detail-hero ${r.isEasterEgg ? "egg-card" : ""}" style="background-image:url('assets/${r.image}')">
        <span class="cat-tag" ${r.isEasterEgg ? 'style="background:#5c7a1e"' : `style="background:var(--${r.category})"`}>${r.isEasterEgg ? "☢️ Classified" : (CATEGORY_LABELS[r.category] || r.category)}</span>
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

// ---------- Decide (Tinder-style swipe) ----------
function shuffledDeck() {
  const arr = RECIPES.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
let decideDeck = null;
let decideIndex = 0;

function attachSwipeHandlers(cardEl, onSwipeLeft, onSwipeRight) {
  let startX = 0, dx = 0, dragging = false;

  function down(e) {
    dragging = true;
    startX = e.clientX;
    cardEl.setPointerCapture(e.pointerId);
    cardEl.style.transition = "none";
  }
  function move(e) {
    if (!dragging) return;
    dx = e.clientX - startX;
    cardEl.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    cardEl.style.transition = "transform 0.28s ease";
    if (dx > 90) {
      cardEl.style.transform = `translateX(700px) rotate(24deg)`;
      setTimeout(onSwipeRight, 180);
    } else if (dx < -90) {
      cardEl.style.transform = `translateX(-700px) rotate(-24deg)`;
      setTimeout(onSwipeLeft, 180);
    } else {
      cardEl.style.transform = `translateX(0) rotate(0)`;
    }
    dx = 0;
  }
  cardEl.addEventListener("pointerdown", down);
  cardEl.addEventListener("pointermove", move);
  cardEl.addEventListener("pointerup", up);
  cardEl.addEventListener("pointercancel", up);
}

function renderDecide() {
  if (!decideDeck) { decideDeck = shuffledDeck(); decideIndex = 0; }
  const r = decideDeck[decideIndex];
  const finished = !r;

  const stageHTML = finished
    ? `<div class="decide-empty">
         <p>You've swiped through every recipe! 🎉</p>
         <button class="primary-btn" id="reshuffle-btn">Reshuffle deck</button>
       </div>`
    : `<div class="decide-card" id="decide-card">
         <div class="decide-photo" style="background-image:url('assets/${r.image}')">
           <span class="cat-tag">${CATEGORY_LABELS[r.category] || r.category}</span>
         </div>
         <div class="decide-info">
           <h2>${r.title}</h2>
           <div class="decide-macros">
             <span>🔥 ${r.calories} kcal</span>
             <span>💪 ${r.protein}g protein</span>
             <span>◷ ${r.prep_time}</span>
           </div>
         </div>
       </div>`;

  app.innerHTML = `
    <header class="topbar">
      <div class="wordmark">Help Me Decide<small>Swipe right to add it to your plan</small></div>
      <span class="version-badge">v${APP_VERSION}</span>
    </header>
    ${dateStripHTML()}
    <div class="decide-stage">${stageHTML}</div>
    ${!finished ? `
    <div class="decide-actions">
      <button class="decide-btn skip" id="skip-btn" aria-label="Skip">✕</button>
      <button class="decide-btn add" id="add-btn" aria-label="Add to plan">❤️</button>
    </div>` : ""}
    ${bottomNavHTML("decide")}
  `;

  attachDateStripHandlers(renderDecide);

  if (finished) {
    document.getElementById("reshuffle-btn").addEventListener("click", () => {
      decideDeck = shuffledDeck(); decideIndex = 0; renderDecide();
    });
    return;
  }

  const next = () => { decideIndex++; renderDecide(); };
  const addAndNext = () => { addToPlan(selectedDate, r.id); next(); };

  document.getElementById("skip-btn").addEventListener("click", next);
  document.getElementById("add-btn").addEventListener("click", addAndNext);
  attachSwipeHandlers(document.getElementById("decide-card"), next, addAndNext);
}

// ---------- Plan (drag to build a day) ----------
function attachDragToPlan(sourceEl, recipeId) {
  let startX = 0, startY = 0, offsetX = 0, offsetY = 0;
  let clone = null, dragging = false, decided = false;

  function down(e) {
    startX = e.clientX; startY = e.clientY;
    decided = false; dragging = false;
    sourceEl.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!decided) {
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
        decided = true; dragging = true;
        const rect = sourceEl.getBoundingClientRect();
        offsetX = startX - rect.left; offsetY = startY - rect.top;
        clone = sourceEl.cloneNode(true);
        clone.classList.add("drag-clone");
        clone.style.width = rect.width + "px";
        clone.style.left = rect.left + "px";
        clone.style.top = rect.top + "px";
        document.body.appendChild(clone);
      } else if (Math.abs(dx) > 14) {
        decided = true; dragging = false;
      }
      if (!decided) return;
    }
    if (!dragging || !clone) return;
    clone.style.left = (e.clientX - offsetX) + "px";
    clone.style.top = (e.clientY - offsetY) + "px";
    const zone = document.getElementById("plan-dropzone");
    if (!zone) return;
    const zr = zone.getBoundingClientRect();
    const over = e.clientX > zr.left && e.clientX < zr.right && e.clientY > zr.top && e.clientY < zr.bottom;
    zone.classList.toggle("drag-over", over);
  }
  function up(e) {
    if (dragging && clone) {
      const zone = document.getElementById("plan-dropzone");
      if (zone) {
        const zr = zone.getBoundingClientRect();
        const over = e.clientX > zr.left && e.clientX < zr.right && e.clientY > zr.top && e.clientY < zr.bottom;
        zone.classList.remove("drag-over");
        if (over) { addToPlan(selectedDate, recipeId); renderPlan(); }
      }
      if (clone.parentNode) document.body.removeChild(clone);
    }
    clone = null; dragging = false; decided = false;
  }
  sourceEl.addEventListener("pointerdown", down);
  sourceEl.addEventListener("pointermove", move);
  sourceEl.addEventListener("pointerup", up);
  sourceEl.addEventListener("pointercancel", up);
}

function macroTallyRow(label, value, goal, unit) {
  const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const over = goal && value > goal;
  return `
    <div class="tally-row">
      <span class="tally-label">${label}</span>
      <div class="tally-track"><div class="tally-fill ${over ? "over" : ""}" style="width:${pct}%"></div></div>
      <span class="tally-val">${Math.round(value)}${unit} / ${goal}${unit}</span>
    </div>`;
}

function renderPlan() {
  const tally = tallyForDate(selectedDate);
  const ids = MEAL_PLAN[selectedDate] || [];
  const planned = ids.map(findRecipeById).filter(Boolean);

  const plannedRows = planned.length
    ? planned.map(r => `
        <div class="plan-row">
          <div class="plan-thumb" style="background-image:url('assets/${r.image}')"></div>
          <div class="plan-row-info">
            <p class="plan-row-title">${r.title}</p>
            <p class="plan-row-sub">${r.calories} kcal</p>
          </div>
          <button class="plan-remove" data-remove="${r.id}" aria-label="Remove">✕</button>
        </div>`).join("")
    : `<p class="empty-state small">Drag a recipe up from below to add it here.</p>`;

  const strip = RECIPES.map(r => `
    <div class="strip-card" id="strip-${r.id}">
      <div class="photo" style="background-image:url('assets/${r.image}')">
        <span class="cat-tag">${CATEGORY_LABELS[r.category] || r.category}</span>
      </div>
      <p class="strip-title">${r.title}</p>
    </div>`).join("");

  app.innerHTML = `
    <header class="topbar">
      <div class="wordmark">Meal Plan<small>Drag recipes into your day</small></div>
      <span class="version-badge">v${APP_VERSION}</span>
    </header>
    ${dateStripHTML()}

    <div class="section" style="padding:0 18px">
      <h2>Totals</h2>
      <div class="tally-card">
        ${macroTallyRow("Cals", tally.calories, GOALS.calories, "")}
        ${macroTallyRow("Protein", tally.protein, GOALS.protein, "g")}
        ${macroTallyRow("Carbs", tally.carbs, GOALS.carbs, "g")}
        ${macroTallyRow("Fat", tally.fat, GOALS.fat, "g")}
      </div>
      <button class="link-btn" onclick="location.hash='#/goals'">Edit my daily goals →</button>
    </div>

    <div class="section" style="padding:0 18px">
      <h2>Planned</h2>
      <div id="plan-dropzone" class="plan-dropzone">${plannedRows}</div>
    </div>

    <div class="section">
      <h2 style="padding:0 18px">Drag from your library ↑</h2>
      <div class="strip-row">${strip}</div>
    </div>
    ${bottomNavHTML("plan")}
  `;

  attachDateStripHandlers(renderPlan);

  app.querySelectorAll(".plan-remove").forEach(btn => {
    btn.addEventListener("click", () => { removeFromPlan(selectedDate, btn.dataset.remove); renderPlan(); });
  });

  RECIPES.forEach(r => {
    const el = document.getElementById("strip-" + r.id);
    if (el) attachDragToPlan(el, r.id);
  });
}

// ---------- Goals ----------
function renderGoals() {
  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">Daily Goals</div>
    </header>
    <div class="detail">
      <p style="color:var(--ink-soft);font-size:13px;margin-top:0">
        Set your daily targets — the Plan tab uses these to show how each day is tracking.
      </p>
      <div class="goals-form">
        <label>Calories<input type="number" id="goal-calories" value="${GOALS.calories}" inputmode="numeric"></label>
        <label>Protein (g)<input type="number" id="goal-protein" value="${GOALS.protein}" inputmode="numeric"></label>
        <label>Carbs (g)<input type="number" id="goal-carbs" value="${GOALS.carbs}" inputmode="numeric"></label>
        <label>Fat (g)<input type="number" id="goal-fat" value="${GOALS.fat}" inputmode="numeric"></label>
      </div>
      <button class="primary-btn" id="save-goals-btn" style="margin-top:18px;width:100%">Save Goals</button>
    </div>
  `;
  document.getElementById("save-goals-btn").addEventListener("click", () => {
    GOALS = {
      calories: Number(document.getElementById("goal-calories").value) || 0,
      protein: Number(document.getElementById("goal-protein").value) || 0,
      carbs: Number(document.getElementById("goal-carbs").value) || 0,
      fat: Number(document.getElementById("goal-fat").value) || 0,
    };
    saveGoals(GOALS);
    history.back();
  });
}

function router() {
  const hash = location.hash || "#/";
  const recipeMatch = hash.match(/^#\/recipe\/(.+)$/);
  if (recipeMatch) { renderDetail(recipeMatch[1]); return; }
  if (hash === "#/decide") { renderDecide(); return; }
  if (hash === "#/plan") { renderPlan(); return; }
  if (hash === "#/goals") { renderGoals(); return; }
  renderLibrary();
}

window.addEventListener("hashchange", router);

loadRecipes().then(router);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}
