const APP_VERSION = "3.1";

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
const COOK_LOG_KEY = "goobert-cook-log";
const PROTECTED_DAYS_KEY = "goobert-protected-days";
const STATS_META_KEY = "goobert-stats-meta";

const BACK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="#3A2F2B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// toISOString() converts to UTC, which silently shifts the calendar date for
// anyone west of UTC once it's evening/night locally (e.g. 10pm local can
// already be "tomorrow" in UTC). Use this everywhere we need a YYYY-MM-DD
// string for the user's actual local day instead.
function localISO(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// User-uploaded photos are stored as compressed base64 data URIs; built-in
// recipe photos are plain filenames under assets/. This resolves either.
function recipeImageUrl(r) {
  if (!r || !r.image) return "";
  return r.image.startsWith("data:") ? r.image : "assets/" + r.image;
}

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

// All saves go through this so a full-storage error (most likely from a
// large photo) never fails silently. Returns true/false so callers — 
// especially the recipe editor — can decide whether it's safe to navigate
// away or whether the user needs to fix something first.
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error("Storage write failed for", key, err);
    showGoobertToast("⚠️ Storage's full — couldn't save. Try a smaller photo or delete an old version.");
    return false;
  }
}
let RECIPES = [];

// ---- UI state ----
let activeCategory = "all";
let searchQuery = "";
let sortBy = "default";
let onlyHighProtein = false;
let onlyQuick = false;
let onlyFavourites = false;
let dietaryFilters = new Set();
const DIETARY_OPTIONS = ["vegetarian", "vegan", "gluten-free", "dairy-free"];

function loadFavourites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveFavourites(set) {
  return safeSetItem(FAV_KEY, JSON.stringify([...set]));
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
function savePlan(p) { return safeSetItem(PLAN_KEY, JSON.stringify(p)); }
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
// ---------- Recipe Versions (edits to preloaded recipes, without losing the original) ----------
const RECIPE_VERSIONS_KEY = "goobert-recipe-versions";
function loadRecipeVersions() {
  try { return JSON.parse(localStorage.getItem(RECIPE_VERSIONS_KEY) || "{}"); }
  catch { return {}; }
}
function saveRecipeVersions(v) { return safeSetItem(RECIPE_VERSIONS_KEY, JSON.stringify(v)); }
let RECIPE_VERSIONS = loadRecipeVersions();

// Returns { all: [v1 (original), ...saved versions], defaultVersionId }
function getRecipeVersions(baseRecipe) {
  const stored = RECIPE_VERSIONS[baseRecipe.id] || { versions: [], defaultVersionId: "v1" };
  const v1 = { versionId: "v1", versionLabel: "Original", ...baseRecipe };
  // Force-correct id on every read — this self-heals any version saved by the
  // v2.7 bug where saved versions had no id at all.
  const versions = stored.versions.map(v => ({ ...v, id: baseRecipe.id }));
  return { all: [v1, ...versions], defaultVersionId: stored.defaultVersionId || "v1" };
}
function getDefaultVersion(baseRecipe) {
  const { all, defaultVersionId } = getRecipeVersions(baseRecipe);
  return all.find(v => v.versionId === defaultVersionId) || all[0];
}
function addRecipeVersion(baseId, fields) {
  if (!RECIPE_VERSIONS[baseId]) RECIPE_VERSIONS[baseId] = { versions: [], defaultVersionId: "v1" };
  const entry = RECIPE_VERSIONS[baseId];
  const num = entry.versions.length + 2; // v1 is always the untouched original
  const versionId = "v" + num;
  entry.versions.push({ versionId, versionLabel: "Version " + num, ...fields, id: baseId });
  if (!saveRecipeVersions(RECIPE_VERSIONS)) {
    entry.versions.pop(); // keep memory consistent with what's actually persisted
    return null;
  }
  return versionId;
}
function setDefaultVersion(baseId, versionId) {
  if (!RECIPE_VERSIONS[baseId]) RECIPE_VERSIONS[baseId] = { versions: [], defaultVersionId: "v1" };
  const previous = RECIPE_VERSIONS[baseId].defaultVersionId;
  RECIPE_VERSIONS[baseId].defaultVersionId = versionId;
  if (!saveRecipeVersions(RECIPE_VERSIONS)) {
    RECIPE_VERSIONS[baseId].defaultVersionId = previous;
    return false;
  }
  return true;
}

// ---------- Custom (fully user-created) recipes ----------
const CUSTOM_RECIPES_KEY = "goobert-custom-recipes";
function loadCustomRecipes() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_RECIPES_KEY) || "[]"); }
  catch { return []; }
}
function saveCustomRecipes(list) { return safeSetItem(CUSTOM_RECIPES_KEY, JSON.stringify(list)); }
let CUSTOM_RECIPES = loadCustomRecipes();

function addCustomRecipe(fields) {
  const id = "CUSTOMRECIPE-" + Date.now();
  CUSTOM_RECIPES.push({ isCustomRecipe: true, ...fields, id });
  if (!saveCustomRecipes(CUSTOM_RECIPES)) {
    CUSTOM_RECIPES = CUSTOM_RECIPES.filter(r => r.id !== id);
    return null;
  }
  return id;
}
function updateCustomRecipe(id, fields) {
  const previous = CUSTOM_RECIPES;
  CUSTOM_RECIPES = CUSTOM_RECIPES.map(r => (r.id === id ? { ...r, ...fields, id, isCustomRecipe: true } : r));
  if (!saveCustomRecipes(CUSTOM_RECIPES)) {
    CUSTOM_RECIPES = previous;
    return false;
  }
  return true;
}
function deleteCustomRecipe(id) {
  CUSTOM_RECIPES = CUSTOM_RECIPES.filter(r => r.id !== id);
  saveCustomRecipes(CUSTOM_RECIPES);
}

// Every recipe that should show up in Library/Decide/Plan browsing: preloaded
// recipes (resolved to whichever version is set as default) + fully custom ones.
function allActiveRecipes() {
  return [...RECIPES.map(getDefaultVersion), ...CUSTOM_RECIPES];
}

function findRecipeById(id) {
  const base = RECIPES.find(r => r.id === id);
  if (base) return getDefaultVersion(base);
  const egg = allEasterEggRecipes().find(r => r.id === id);
  if (egg) return egg;
  const customRecipe = CUSTOM_RECIPES.find(r => r.id === id);
  if (customRecipe) return customRecipe;
  return CUSTOM_SNACKS.find(s => s.id === id);
}
function tallyForDate(date) {
  const ids = MEAL_PLAN[date] || [];
  const recipes = ids.map(findRecipeById).filter(Boolean);
  return recipes.reduce((acc, r) => {
    acc.calories += (typeof r.calories === "number" ? r.calories : 0);
    acc.protein += (typeof r.protein === "number" ? r.protein : 0);
    acc.carbs += (typeof r.carbs === "number" ? r.carbs : 0);
    acc.fat += (typeof r.fat === "number" ? r.fat : 0);
    acc.fiber += (typeof r.fiber === "number" && !Number.isNaN(r.fiber) ? r.fiber : 0);
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}

// ---------- Macro goals ----------
const DEFAULT_GOALS = { calories: 2000, protein: 120, carbs: 200, fat: 65, fiber: 28 };
function loadGoals() {
  try { return { ...DEFAULT_GOALS, ...JSON.parse(localStorage.getItem(GOALS_KEY) || "{}") }; }
  catch { return { ...DEFAULT_GOALS }; }
}
function saveGoals(g) { return safeSetItem(GOALS_KEY, JSON.stringify(g)); }
let GOALS = loadGoals();

// ---------- Which macros to show in Plan totals ----------
const TALLY_TOGGLES_KEY = "goobert-tally-toggles";
const DEFAULT_TALLY_TOGGLES = { calories: true, protein: true, carbs: true, fat: true, fiber: true };
function loadTallyToggles() {
  try { return { ...DEFAULT_TALLY_TOGGLES, ...JSON.parse(localStorage.getItem(TALLY_TOGGLES_KEY) || "{}") }; }
  catch { return { ...DEFAULT_TALLY_TOGGLES }; }
}
function saveTallyToggles(t) { return safeSetItem(TALLY_TOGGLES_KEY, JSON.stringify(t)); }
let TALLY_TOGGLES = loadTallyToggles();

const GOAL_FIELDS = [
  { key: "calories", label: "Calories", unit: " kcal" },
  { key: "protein", label: "Protein (g)", unit: "g" },
  { key: "carbs", label: "Carbs (g)", unit: "g" },
  { key: "fat", label: "Fat (g)", unit: "g" },
  { key: "fiber", label: "Fiber (g)", unit: "g" },
];

// ---------- Cook log (what's actually been made) ----------
function loadCookLog() {
  try { return JSON.parse(localStorage.getItem(COOK_LOG_KEY) || "[]"); }
  catch { return []; }
}
function saveCookLog(log) { return safeSetItem(COOK_LOG_KEY, JSON.stringify(log)); }
let COOK_LOG = loadCookLog();

function loadProtectedDays() {
  try { return JSON.parse(localStorage.getItem(PROTECTED_DAYS_KEY) || "[]"); }
  catch { return []; }
}
function saveProtectedDays(days) { return safeSetItem(PROTECTED_DAYS_KEY, JSON.stringify(days)); }
let PROTECTED_DAYS = loadProtectedDays();

function loadStatsMeta() {
  // TEST MODE: seeding 100 bonus cheat-day tokens so there's plenty to play
  // with while testing. Set testModeBonusTokens to 0 before a real launch.
  const defaults = { testModeBonusTokens: 100, milestonesAwarded: 0, longestStreak: 0 };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(STATS_META_KEY) || "{}") }; }
  catch { return defaults; }
}
function saveStatsMeta(m) { return safeSetItem(STATS_META_KEY, JSON.stringify(m)); }
let STATS_META = loadStatsMeta();

function isCooked(date, recipeId) {
  return COOK_LOG.some(e => e.date === date && e.recipeId === recipeId);
}
function toggleCooked(date, recipeId, category) {
  if (isCooked(date, recipeId)) {
    COOK_LOG = COOK_LOG.filter(e => !(e.date === date && e.recipeId === recipeId));
  } else {
    COOK_LOG.push({ date, recipeId, category, timestamp: Date.now() });
  }
  saveCookLog(COOK_LOG);
  refreshStreakAndTokens();
}
function isDayLogged(dateISO) {
  return COOK_LOG.some(e => e.date === dateISO) || PROTECTED_DAYS.includes(dateISO);
}
function computeCurrentStreak() {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const todayIso = localISO(cursor);

  // A cheat token spent on today shouldn't inflate today's streak count —
  // only an actual cooked meal counts for "today." Once today is over and
  // becomes a past day, isDayLogged() (which does count protected days)
  // takes over, so the streak is still protected — it just isn't awarded
  // early.
  const todayActuallyCooked = COOK_LOG.some(e => e.date === todayIso);
  if (!todayActuallyCooked) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (true) {
    const ci = localISO(cursor);
    if (isDayLogged(ci)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}
function refreshStreakAndTokens() {
  const streak = computeCurrentStreak();
  if (streak > STATS_META.longestStreak) STATS_META.longestStreak = streak;
  const milestones = Math.floor(streak / 7);
  if (milestones > STATS_META.milestonesAwarded) {
    STATS_META.milestonesAwarded = milestones;
  }
  saveStatsMeta(STATS_META);
  return streak;
}
// Tokens earned in total (test-mode bonus + streak milestones), independent
// of whether any have been spent yet.
function totalTokensEarned() {
  return STATS_META.testModeBonusTokens + STATS_META.milestonesAwarded;
}
// Available balance = earned minus currently-protected days. Since the date
// strip never shows past dates, every protected day you can still see and
// toggle is, by definition, today-or-future — meaning a spend only becomes
// truly permanent once its calendar day passes out of view. That gives us
// "reversible until end of day" for free, with no extra locking logic needed.
function availableCheatTokens() {
  return Math.max(0, totalTokensEarned() - PROTECTED_DAYS.length);
}
function toggleCheatDay(date) {
  if (PROTECTED_DAYS.includes(date)) {
    PROTECTED_DAYS = PROTECTED_DAYS.filter(d => d !== date);
  } else {
    if (availableCheatTokens() <= 0) return false;
    PROTECTED_DAYS.push(date);
  }
  saveProtectedDays(PROTECTED_DAYS);
  refreshStreakAndTokens();
  return true;
}
function mostCookedList(limit = 5) {
  const counts = {};
  COOK_LOG.forEach(e => { counts[e.recipeId] = (counts[e.recipeId] || 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({ recipe: findRecipeById(id), count }))
    .filter(x => x.recipe);
}
function categoryBreakdown() {
  const counts = { breakfast: 0, snack: 0, dinner: 0, treat: 0 };
  COOK_LOG.forEach(e => { if (counts[e.category] !== undefined) counts[e.category]++; });
  return counts;
}
function recentHistory(limit = 10) {
  return COOK_LOG.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

// ---------- Custom Snack Library ----------
const CUSTOM_SNACKS_KEY = "goobert-custom-snacks";
function loadCustomSnacks() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_SNACKS_KEY) || "[]"); }
  catch { return []; }
}
function saveCustomSnacks(list) { return safeSetItem(CUSTOM_SNACKS_KEY, JSON.stringify(list)); }
let CUSTOM_SNACKS = loadCustomSnacks();

function addCustomSnack(snack) {
  const id = "CUSTOM-" + Date.now();
  CUSTOM_SNACKS.push({ id, category: "snack", isCustomSnack: true, ...snack });
  if (!saveCustomSnacks(CUSTOM_SNACKS)) {
    CUSTOM_SNACKS = CUSTOM_SNACKS.filter(s => s.id !== id);
    return null;
  }
  return id;
}
function deleteCustomSnack(id) {
  CUSTOM_SNACKS = CUSTOM_SNACKS.filter(s => s.id !== id);
  saveCustomSnacks(CUSTOM_SNACKS);
}
// A spontaneous snack log (unlike toggleCooked, this always appends —
// you might reasonably eat the same snack twice in one day).
function logSnackEaten(date, snack) {
  COOK_LOG.push({ date, recipeId: snack.id, category: snack.category, timestamp: Date.now() });
  saveCookLog(COOK_LOG);
  refreshStreakAndTokens();
}

// ---------- Achievements ----------
const ACHIEVEMENTS_KEY = "goobert-achievements-unlocked";
function loadUnlockedAchievements() {
  try { return JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || "{}"); }
  catch { return {}; }
}
function saveUnlockedAchievements(m) { return safeSetItem(ACHIEVEMENTS_KEY, JSON.stringify(m)); }
let UNLOCKED_ACHIEVEMENTS = loadUnlockedAchievements();

// ---------- Mascot tap tracking (feeds hidden achievements) ----------
const MASCOT_TAPS_KEY = "goobert-mascot-taps";
function loadMascotTaps() {
  const n = Number(localStorage.getItem(MASCOT_TAPS_KEY));
  return Number.isFinite(n) ? n : 0;
}
let MASCOT_TAPS = loadMascotTaps();
function incrementMascotTaps() {
  MASCOT_TAPS++;
  safeSetItem(MASCOT_TAPS_KEY, String(MASCOT_TAPS));
}

// Best-guess unlock conditions — the original design doc named these without
// defining exact thresholds, so these are reasonable interpretations, easy
// to retune later. `hidden: true` achievements stay a mystery ("???") on the
// Achievements screen until unlocked, per the design doc's intent.
const ACHIEVEMENTS = [
  { id: "fresh-start", icon: "🌱", name: "Fresh Start", desc: "Cook your first meal", check: () => COOK_LOG.length >= 1 },
  { id: "first-breakfast", icon: "🌅", name: "First Breakfast", desc: "Cook a breakfast recipe", check: () => COOK_LOG.some(e => e.category === "breakfast") },
  { id: "home-chef", icon: "👨‍🍳", name: "Home Chef", desc: "Cook 10 meals total", check: () => COOK_LOG.length >= 10 },
  { id: "recipe-collector", icon: "📖", name: "Recipe Collector", desc: "Favourite 5 recipes", check: () => FAVOURITES.size >= 5 },
  { id: "deck-builder", icon: "🗂️", name: "Deck Builder", desc: "Plan 7 different recipes", check: () => new Set(Object.values(MEAL_PLAN).flat()).size >= 7 },
  { id: "one-good-week", icon: "🔥", name: "One Good Week", desc: "Reach a 7-day streak", check: () => STATS_META.longestStreak >= 7 },
  { id: "habit-builder", icon: "💪", name: "Habit Builder", desc: "Reach a 14-day streak", check: () => STATS_META.longestStreak >= 14 },
  { id: "variety-champion", icon: "🎨", name: "Variety Champion", desc: "Cook from every category", check: () => Object.values(categoryBreakdown()).every(c => c > 0) },
  { id: "date-night", icon: "🍷", name: "Date Night", desc: "Cook a dinner on a Fri or Sat", check: () => COOK_LOG.some(e => e.category === "dinner" && [5, 6].includes(new Date(e.date + "T00:00:00").getDay())) },
  { id: "teamwork", icon: "🤝", name: "Teamwork", desc: "Plan 3+ meals in one day", check: () => Object.values(MEAL_PLAN).some(list => list.length >= 3) },
  { id: "boop", icon: "👆", name: "Boop!", desc: "Tap Baby Goobert", hidden: true, check: () => MASCOT_TAPS >= 1 },
  { id: "best-friends", icon: "🤗", name: "Best Friends", desc: "Interact with Baby Goobert 100 times", hidden: true, check: () => MASCOT_TAPS >= 100 },
];

function refreshAchievements() {
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (!UNLOCKED_ACHIEVEMENTS[a.id] && a.check()) {
      UNLOCKED_ACHIEVEMENTS[a.id] = Date.now();
      newlyUnlocked.push(a);
    }
  });
  if (newlyUnlocked.length) saveUnlockedAchievements(UNLOCKED_ACHIEVEMENTS);
  return newlyUnlocked;
}

// ---------- Real-Life Rewards ----------
const REWARDS_KEY = "goobert-rewards";
function loadRewards() {
  try { return JSON.parse(localStorage.getItem(REWARDS_KEY) || "[]"); }
  catch { return []; }
}
function saveRewards(list) { return safeSetItem(REWARDS_KEY, JSON.stringify(list)); }
let REWARDS = loadRewards();

const REWARD_TRIGGER_LABELS = {
  streak: "day streak",
  totalCooked: "meals cooked",
  uniqueRecipes: "unique recipes tried",
  categoryCooked: "meals cooked in one category",
};

function rewardProgress(reward) {
  switch (reward.triggerType) {
    case "streak": return STATS_META.longestStreak;
    case "totalCooked": return COOK_LOG.length;
    case "uniqueRecipes": return new Set(COOK_LOG.map(e => e.recipeId)).size;
    case "categoryCooked": return COOK_LOG.filter(e => e.category === reward.category).length;
    default: return 0;
  }
}
function addReward(reward) {
  REWARDS.push({ id: "REWARD-" + Date.now(), unlocked: false, unlockedAt: null, ...reward });
  saveRewards(REWARDS);
}
function deleteReward(id) {
  REWARDS = REWARDS.filter(r => r.id !== id);
  saveRewards(REWARDS);
}
function refreshRewards() {
  const newlyUnlocked = [];
  REWARDS.forEach(r => {
    if (!r.unlocked && rewardProgress(r) >= r.target) {
      r.unlocked = true;
      r.unlockedAt = Date.now();
      newlyUnlocked.push(r);
    }
  });
  if (newlyUnlocked.length) saveRewards(REWARDS);
  return newlyUnlocked;
}

// Runs all the "did anything cross a threshold" checks in one place, and
// surfaces a Goobert toast for anything newly unlocked. Call at the top of
// any screen render so progress stays live everywhere.
function refreshProgress() {
  const streak = refreshStreakAndTokens();
  const newAchievements = refreshAchievements();
  const newRewards = refreshRewards();
  newAchievements.forEach(a => showGoobertToast(`🏆 Achievement unlocked: ${a.name}!`));
  newRewards.forEach(r => showGoobertToast(`🎁 Reward unlocked: ${r.name}!`));
  return streak;
}

// ---------- Goobert toast (floating reaction bubble) ----------
const GOOBERT_LINES = [
  "Nice work! 🍽️",
  "Baby Goobert is proud of you!",
  "Look at you go! 🌟",
  "That's the spirit!",
  "Yum, great choice!",
  "Where is my chocolate cake? 🍰",
  "Nom nom nom.",
  "You're on a roll!",
  "Baby Goobert approves.",
  "Delicious decision-making.",
];
const GOOBERT_TREAT_LINES = [
  "Ooh, cake?! Baby Goobert approves 🍰",
  "A treat! Baby Goobert's favourite kind of day.",
  "Sweet pick! Baby Goobert is drooling.",
  "FINALLY. Someone gets it.",
  "Is that... chocolate? 👀",
];
const GOOBERT_TAP_LINES = [
  "Hi!! 🥰",
  "Where is my chocolate cake?",
  "*happy sloth noises*",
  "Boop!",
  "Don't rush me, I'm a sloth.",
  "Feed me snacks.",
  "You woke me up.",
];

// Tracks the last line shown per pool so the same line never plays twice
// in a row — call this instead of picking randomly directly.
const _lastGoobertLine = {};
function pickGoobertLine(pool, key) {
  if (pool.length <= 1) return pool[0] || "";
  let line;
  do {
    line = pool[Math.floor(Math.random() * pool.length)];
  } while (line === _lastGoobertLine[key]);
  _lastGoobertLine[key] = line;
  return line;
}

function showGoobertToast(message) {
  const existing = document.querySelector(".goobert-toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "goobert-toast";
  el.innerHTML = `<img src="assets/baby_goobert.png" alt="">  <span>${message}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

// ---------- Help tooltips ----------
const SCREEN_HELP = {
  library: "Browse all your recipes here. Use search, the category chips, and filters to find something. Tap Baby Goobert for a surprise, or use the Snack Corner and Add Recipe buttons below the grid.",
  decide: "Can't decide what to eat? Pick a category, then swipe right (or tap ❤️) on anything that sounds good — it gets added to your plan for the selected day. Swipe left or tap ✕ to skip. 🔀 reshuffles the deck.",
  plan: "Build a day's meals by dragging recipes up from the strip below into your Planned list. Check items off once you've actually made them — that's what counts toward your streak, not just planning them.",
  goals: "Set your daily macro targets here. Uncheck anything you don't want cluttering up the Plan totals — you can always turn it back on later.",
  snacks: "Shows snack ideas that fit whatever's left in your day's macro budget. Add your own custom snacks below, or tap 'I ate this' to log one on the spot without planning it first.",
};
function helpButtonHTML(key) {
  return `<button class="help-btn" data-help="${key}" aria-label="Help">?</button>`;
}
function showHelpModal(text) {
  const existing = document.querySelector(".help-modal-backdrop");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "help-modal-backdrop";
  el.innerHTML = `<div class="help-modal"><img src="assets/baby_goobert.png" alt=""><p>${text}</p><button class="primary-btn" id="help-close-btn">Got it</button></div>`;
  document.body.appendChild(el);
  el.addEventListener("click", (e) => { if (e.target === el) el.remove(); });
  document.getElementById("help-close-btn").addEventListener("click", () => el.remove());
}
// Delegated once on body so help buttons work across every re-render without
// needing a fresh listener attached each time a screen redraws.
document.body.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-help]");
  if (btn && SCREEN_HELP[btn.dataset.help]) showHelpModal(SCREEN_HELP[btn.dataset.help]);
});

// ---------- Dates ----------
function todayISO() {
  return localISO(new Date());
}
let selectedDate = todayISO();

function dateStripHTML() {
  const chips = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = localISO(d);
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
  const hasPhoto = !!r.image;
  return `
    <div class="recipe-card ${r.isEasterEgg ? "egg-card" : ""}" data-category="${r.category}">
      <button class="card-tap" onclick="location.hash='#/recipe/${r.id}'">
        <div class="photo ${hasPhoto ? "" : "no-photo"}" style="${hasPhoto ? `background-image:url('${recipeImageUrl(r)}')` : ""}">
          ${hasPhoto ? "" : `<span class="no-photo-icon">🍽️</span>`}
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

  let list = allActiveRecipes();

  if (activeCategory !== "all") list = list.filter(r => r.category === activeCategory);
  if (onlyHighProtein) list = list.filter(r => r.protein >= 20);
  if (onlyQuick) list = list.filter(r => parseMinutes(r.prep_time) <= 15);
  if (onlyFavourites) list = list.filter(r => FAVOURITES.has(r.id));
  if (dietaryFilters.size) list = list.filter(r => [...dietaryFilters].every(tag => (r.dietary_tags || []).includes(tag)));

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
  const streak = refreshProgress();
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
  const dietaryChips = DIETARY_OPTIONS.map(tag =>
    `<button class="filter-chip ${dietaryFilters.has(tag) ? "active" : ""}" data-diet="${tag}">${tag}</button>`
  ).join("");

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
      <div class="header-badges">
        <button class="streak-badge" onclick="location.hash='#/stats'" aria-label="View stats">🔥 ${streak}</button>
        <span class="version-badge">v${APP_VERSION}</span>
      </div>
      ${helpButtonHTML("library")}
    </header>
    <div class="search-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#6B5F58" stroke-width="2"/><path d="M21 21l-4.3-4.3" stroke="#6B5F58" stroke-width="2" stroke-linecap="round"/></svg>
      <input type="text" id="search-input" placeholder="Search recipes or ingredients…" value="${searchQuery.replace(/"/g, "&quot;")}" />
    </div>
    <div class="filter-row">${categoryChips}</div>
    <div class="filter-row secondary">${toggleChips}</div>
    <div class="filter-row secondary">${dietaryChips}</div>
    <div class="sort-row">
      <select id="sort-select">${sortSelectOptions}</select>
    </div>
    ${eggBanner}
    <div class="grid">${cards}</div>

    <div class="goobert-corner">
      <div class="goobert-mascot-wrap">
        <img src="assets/baby_goobert.png" class="goobert-mascot-img" id="goobert-mascot" alt="Baby Goobert" />
        <div class="speech-bubble" id="goobert-bubble"></div>
      </div>
      <div class="goobert-corner-links">
        <button class="snack-corner-btn" onclick="location.hash='#/snacks'">🦥 Snack Corner</button>
        <button class="snack-corner-btn" id="add-recipe-btn">➕ Add a Recipe</button>
      </div>
    </div>

    <footer class="tag-line">🐢 ${allActiveRecipes().length} recipes and counting</footer>
    ${bottomNavHTML("library")}
  `;

  const mascotEl = document.getElementById("goobert-mascot");
  const bubbleEl = document.getElementById("goobert-bubble");
  if (mascotEl && bubbleEl) {
    mascotEl.addEventListener("click", () => {
      mascotEl.classList.remove("bounce");
      void mascotEl.offsetWidth; // restart animation even on repeated taps
      mascotEl.classList.add("bounce");
      bubbleEl.textContent = pickGoobertLine(GOOBERT_TAP_LINES, "tap");
      bubbleEl.classList.add("show");
      setTimeout(() => bubbleEl.classList.remove("show"), 2000);
      incrementMascotTaps();
      refreshAchievements().forEach(a => showGoobertToast(`🏆 Achievement unlocked: ${a.name}!`));
    });
  }

  document.getElementById("add-recipe-btn").addEventListener("click", () => {
    editorContext = { mode: "new-custom", baseId: null, prefill: {} };
    location.hash = "#/editor";
  });

  app.querySelectorAll(".filter-chip[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => { activeCategory = btn.dataset.cat; renderLibrary(); });
  });
  document.getElementById("chip-fav").addEventListener("click", () => { onlyFavourites = !onlyFavourites; renderLibrary(); });
  document.getElementById("chip-protein").addEventListener("click", () => { onlyHighProtein = !onlyHighProtein; renderLibrary(); });
  document.getElementById("chip-quick").addEventListener("click", () => { onlyQuick = !onlyQuick; renderLibrary(); });
  app.querySelectorAll(".filter-chip[data-diet]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.diet;
      if (dietaryFilters.has(tag)) dietaryFilters.delete(tag);
      else dietaryFilters.add(tag);
      renderLibrary();
    });
  });
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

function renderDetail(id, previewVersionId) {
  const base = RECIPES.find(x => x.id === id);
  const isBaseRecipe = !!base;
  const customRecipe = !isBaseRecipe ? CUSTOM_RECIPES.find(x => x.id === id) : null;
  const egg = (!isBaseRecipe && !customRecipe) ? allEasterEggRecipes().find(x => x.id === id) : null;

  let r, versionInfo = null;
  if (isBaseRecipe) {
    versionInfo = getRecipeVersions(base);
    r = (previewVersionId && versionInfo.all.find(v => v.versionId === previewVersionId)) || getDefaultVersion(base);
  } else {
    r = customRecipe || egg;
  }

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

  const versionChipsHTML = isBaseRecipe
    ? `<div class="filter-row version-row">${versionInfo.all.map(v =>
        `<button class="filter-chip ${v.versionId === r.versionId ? "active" : ""}" data-version="${v.versionId}">${v.versionLabel}${v.versionId === versionInfo.defaultVersionId ? " ⭐" : ""}</button>`
      ).join("")}</div>`
    : "";

  const isDefault = isBaseRecipe && r.versionId === versionInfo.defaultVersionId;
  const canEdit = isBaseRecipe || !!customRecipe;
  const actionRow = canEdit
    ? `<div class="detail-actions">
        ${isBaseRecipe && !isDefault ? `<button class="secondary-btn" id="set-default-btn">⭐ Set as Default</button>` : ""}
        <button class="secondary-btn" id="edit-recipe-btn">✏️ Edit${isBaseRecipe ? " (saves as new version)" : ""}</button>
        ${customRecipe ? `<button class="secondary-btn danger" id="delete-recipe-btn">🗑️ Delete</button>` : ""}
      </div>`
    : "";

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">${CATEGORY_LABELS[r.category] || r.category}</div>
    </header>
    ${versionChipsHTML}
    <div class="detail">
      <div class="detail-hero ${r.isEasterEgg ? "egg-card" : ""}" style="background-image:url('${recipeImageUrl(r)}')">
        <span class="cat-tag" ${r.isEasterEgg ? 'style="background:#5c7a1e"' : `style="background:var(--${r.category})"`}>${r.isEasterEgg ? "☢️ Classified" : (CATEGORY_LABELS[r.category] || r.category)}</span>
        <div class="hero-heart">${heartButton(r.id, "lg")}</div>
      </div>
      <h1>${r.title}</h1>
      ${actionRow}
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
    renderDetail(id, previewVersionId);
  });

  if (isBaseRecipe) {
    app.querySelectorAll("[data-version]").forEach(btn => {
      btn.addEventListener("click", () => renderDetail(id, btn.dataset.version));
    });
    const setDefaultBtn = document.getElementById("set-default-btn");
    if (setDefaultBtn) {
      setDefaultBtn.addEventListener("click", () => {
        setDefaultVersion(id, r.versionId);
        renderDetail(id, r.versionId);
      });
    }
  }
  const editBtn = document.getElementById("edit-recipe-btn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      editorContext = { mode: isBaseRecipe ? "new-version" : "edit-custom", baseId: id, prefill: r };
      location.hash = "#/editor";
    });
  }
  const deleteBtn = document.getElementById("delete-recipe-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (confirm("Delete this recipe? This can't be undone.")) {
        deleteCustomRecipe(id);
        location.hash = "#/";
      }
    });
  }

  window.scrollTo(0, 0);
}

// ---------- Decide (Tinder-style swipe) ----------
const DECIDE_CATEGORIES = ["breakfast", "snack", "dinner", "treat"];
let decideCategory = "breakfast";
let decideDeck = null;
let decideIndex = 0;
let decideDeckKey = null;

function shuffledDeck(category) {
  const arr = allActiveRecipes().filter(r => r.category === category);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function ensureDecideDeck() {
  const key = `${selectedDate}|${decideCategory}`;
  if (decideDeckKey !== key) {
    decideDeck = shuffledDeck(decideCategory);
    decideIndex = 0;
    decideDeckKey = key;
  }
}
function categoryHasPlanned(cat) {
  const ids = MEAL_PLAN[selectedDate] || [];
  return ids.some(id => {
    const r = findRecipeById(id);
    return r && r.category === cat;
  });
}
function decideCategoryChipsHTML() {
  const chips = DECIDE_CATEGORIES.map(cat => `
    <button class="filter-chip ${cat === decideCategory ? "active" : ""}" data-decide-cat="${cat}">
      ${CATEGORY_LABELS[cat]}${categoryHasPlanned(cat) ? ' <span class="chosen-dot">✓</span>' : ""}
    </button>`).join("");
  return `<div class="filter-row">${chips}</div>`;
}

function attachSwipeHandlers(cardEl, skipBtn, addBtn, likeStamp, skipStamp, onSwipeLeft, onSwipeRight) {
  let startX = 0, dx = 0, dragging = false;

  function resetBtns() {
    skipBtn.style.boxShadow = "";
    skipBtn.style.transform = "";
    addBtn.style.boxShadow = "";
    addBtn.style.transform = "";
    likeStamp.style.opacity = "0";
    skipStamp.style.opacity = "0";
  }
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
    const intensity = Math.min(Math.abs(dx) / 120, 1);
    if (dx > 4) {
      addBtn.style.transform = `scale(${1 + intensity * 0.25})`;
      addBtn.style.boxShadow = `0 6px 20px rgba(217,111,145,${0.2 + intensity * 0.4})`;
      skipBtn.style.transform = "";
      skipBtn.style.boxShadow = "";
      likeStamp.style.opacity = String(intensity);
      skipStamp.style.opacity = "0";
    } else if (dx < -4) {
      skipBtn.style.transform = `scale(${1 + intensity * 0.25})`;
      skipBtn.style.boxShadow = `0 6px 20px rgba(58,47,43,${0.2 + intensity * 0.4})`;
      addBtn.style.transform = "";
      addBtn.style.boxShadow = "";
      skipStamp.style.opacity = String(intensity);
      likeStamp.style.opacity = "0";
    } else {
      resetBtns();
    }
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    cardEl.style.transition = "transform 0.28s ease";
    resetBtns();
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
  ensureDecideDeck();
  const r = decideDeck[decideIndex];
  const finished = !r;

  const stageHTML = finished
    ? `<div class="decide-empty">
         <p>You've swiped through every ${CATEGORY_LABELS[decideCategory].toLowerCase()} recipe! 🎉</p>
         <button class="primary-btn" id="reshuffle-btn">Reshuffle deck</button>
       </div>`
    : `<div class="decide-card" id="decide-card">
         <div class="decide-photo" style="background-image:url('${recipeImageUrl(r)}')">
           <span class="stamp stamp-like" id="stamp-like">LIKE</span>
           <span class="stamp stamp-skip" id="stamp-skip">SKIP</span>
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
      ${helpButtonHTML("decide")}
    </header>
    ${dateStripHTML()}
    ${decideCategoryChipsHTML()}
    <div class="decide-stage">${stageHTML}</div>
    ${!finished ? `
    <div class="decide-actions">
      <button class="decide-btn skip" id="skip-btn" aria-label="Skip">✕</button>
      <button class="decide-btn shuffle" id="shuffle-btn" aria-label="Reshuffle">🔀</button>
      <button class="decide-btn add" id="add-btn" aria-label="Add to plan">❤️</button>
    </div>` : ""}
    ${bottomNavHTML("decide")}
  `;

  attachDateStripHandlers(renderDecide);
  app.querySelectorAll(".filter-chip[data-decide-cat]").forEach(btn => {
    btn.addEventListener("click", () => { decideCategory = btn.dataset.decideCat; renderDecide(); });
  });

  if (finished) {
    document.getElementById("reshuffle-btn").addEventListener("click", () => {
      decideDeck = shuffledDeck(decideCategory); decideIndex = 0; renderDecide();
    });
    return;
  }

  const next = () => { decideIndex++; renderDecide(); };
  const addAndNext = () => {
    addToPlan(selectedDate, r.id);
    if (r.category === "treat") {
      showGoobertToast(pickGoobertLine(GOOBERT_TREAT_LINES, "treat"));
    }
    next();
  };

  document.getElementById("skip-btn").addEventListener("click", next);
  document.getElementById("add-btn").addEventListener("click", addAndNext);
  document.getElementById("shuffle-btn").addEventListener("click", () => {
    decideDeck = shuffledDeck(decideCategory); decideIndex = 0; renderDecide();
  });
  attachSwipeHandlers(
    document.getElementById("decide-card"),
    document.getElementById("skip-btn"),
    document.getElementById("add-btn"),
    document.getElementById("stamp-like"),
    document.getElementById("stamp-skip"),
    next,
    addAndNext
  );
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

let planCategory = "breakfast";

function renderPlan() {
  refreshProgress();
  const tally = tallyForDate(selectedDate);
  const ids = MEAL_PLAN[selectedDate] || [];
  const planned = ids.map(findRecipeById).filter(Boolean);

  const plannedRows = planned.length
    ? planned.map(r => {
        const cooked = isCooked(selectedDate, r.id);
        return `
        <div class="plan-row">
          <button class="cook-check ${cooked ? "checked" : ""}" data-cook="${r.id}" data-cook-cat="${r.category}" aria-label="Mark as made">${cooked ? "✓" : ""}</button>
          <div class="plan-thumb" style="background-image:url('${recipeImageUrl(r)}')"></div>
          <div class="plan-row-info">
            <p class="plan-row-title">${r.title}</p>
            <p class="plan-row-sub">${r.calories} kcal</p>
          </div>
          <button class="plan-remove" data-remove="${r.id}" aria-label="Remove">✕</button>
        </div>`;
      }).join("")
    : `<p class="empty-state small">Drag a recipe up from below to add it here.</p>`;

  const categoryChips = DECIDE_CATEGORIES.map(cat => `
    <button class="filter-chip ${cat === planCategory ? "active" : ""}" data-plan-cat="${cat}">${CATEGORY_LABELS[cat]}</button>
  `).join("") + `<button class="filter-chip ${planCategory === "favourites" ? "active" : ""}" data-plan-cat="favourites">♥ Favourites</button>`;

  const stripRecipes = planCategory === "favourites"
    ? allActiveRecipes().filter(r => FAVOURITES.has(r.id))
    : allActiveRecipes().filter(r => r.category === planCategory);
  const emptyStripLabel = planCategory === "favourites" ? "favourite" : CATEGORY_LABELS[planCategory].toLowerCase();
  const strip = stripRecipes.length
    ? stripRecipes.map(r => `
        <div class="strip-card" id="strip-${r.id}">
          <div class="photo" style="background-image:url('${recipeImageUrl(r)}')">
            <span class="cat-tag">${CATEGORY_LABELS[r.category] || r.category}</span>
          </div>
          <p class="strip-title">${r.title}</p>
        </div>`).join("")
    : `<p class="empty-state small">No ${emptyStripLabel} recipes yet.</p>`;

  const cookedOnSelected = COOK_LOG.some(e => e.date === selectedDate);
  const cheatUsedOnSelected = PROTECTED_DAYS.includes(selectedDate);
  const availTokens = availableCheatTokens();

  let cheatAction = "";
  if (cookedOnSelected) {
    cheatAction = `<span class="cheat-covered">✓ Day covered</span>`;
  } else if (cheatUsedOnSelected) {
    cheatAction = `<button class="cheat-btn used" id="use-cheat-btn">✓ Cheat day used — tap to undo</button>`;
  } else if (availTokens > 0) {
    cheatAction = `<button class="cheat-btn" id="use-cheat-btn">Use one for this day</button>`;
  }

  const cheatRow = `
    <div class="cheat-row">
      <span class="cheat-tokens">🎟 ${availTokens} cheat day${availTokens === 1 ? "" : "s"} available</span>
      ${cheatAction}
    </div>`;

  app.innerHTML = `
    <header class="topbar">
      <div class="wordmark">Meal Plan<small>Drag recipes into your day</small></div>
      <span class="version-badge">v${APP_VERSION}</span>
      ${helpButtonHTML("plan")}
    </header>
    ${dateStripHTML()}
    ${cheatRow}

    <div class="section" style="padding:0 18px">
      <h2>Totals</h2>
      <div class="tally-card">
        ${TALLY_TOGGLES.calories ? macroTallyRow("Cals", tally.calories, GOALS.calories, " kcal") : ""}
        ${TALLY_TOGGLES.protein ? macroTallyRow("Protein", tally.protein, GOALS.protein, "g") : ""}
        ${TALLY_TOGGLES.carbs ? macroTallyRow("Carbs", tally.carbs, GOALS.carbs, "g") : ""}
        ${TALLY_TOGGLES.fat ? macroTallyRow("Fat", tally.fat, GOALS.fat, "g") : ""}
        ${TALLY_TOGGLES.fiber ? macroTallyRow("Fiber", tally.fiber, GOALS.fiber, "g") : ""}
        ${Object.values(TALLY_TOGGLES).every(v => !v) ? `<p class="empty-state small">No macros selected. Turn some back on in your goals.</p>` : ""}
      </div>
      <button class="link-btn" onclick="location.hash='#/goals'">Edit my daily goals →</button>
    </div>

    <div class="section" style="padding:0 18px">
      <h2>Planned</h2>
      <div id="plan-dropzone" class="plan-dropzone">${plannedRows}</div>
    </div>

    <div class="section">
      <h2 style="padding:0 18px">Drag from your library ↑</h2>
      <div class="filter-row">${categoryChips}</div>
      <div class="strip-row">${strip}</div>
    </div>

    <div class="section" style="padding:0 18px">
      <button class="snack-corner-wide-btn" onclick="location.hash='#/snacks'">
        🦥 Feeling snacky? Visit Baby Goobert's Snack Corner
      </button>
    </div>
    ${bottomNavHTML("plan")}
  `;

  attachDateStripHandlers(renderPlan);
  app.querySelectorAll(".filter-chip[data-plan-cat]").forEach(btn => {
    btn.addEventListener("click", () => { planCategory = btn.dataset.planCat; renderPlan(); });
  });

  app.querySelectorAll(".plan-remove").forEach(btn => {
    btn.addEventListener("click", () => { removeFromPlan(selectedDate, btn.dataset.remove); renderPlan(); });
  });

  app.querySelectorAll(".cook-check").forEach(btn => {
    btn.addEventListener("click", () => {
      const wasCooked = isCooked(selectedDate, btn.dataset.cook);
      toggleCooked(selectedDate, btn.dataset.cook, btn.dataset.cookCat);
      if (!wasCooked) {
        showGoobertToast(pickGoobertLine(GOOBERT_LINES, "general"));
      }
      renderPlan();
    });
  });

  const useCheatBtn = document.getElementById("use-cheat-btn");
  if (useCheatBtn) {
    useCheatBtn.addEventListener("click", () => {
      toggleCheatDay(selectedDate);
      renderPlan();
    });
  }

  stripRecipes.forEach(r => {
    const el = document.getElementById("strip-" + r.id);
    if (el) attachDragToPlan(el, r.id);
  });
}

// ---------- Goals ----------
function renderGoals() {
  const fieldsHTML = GOAL_FIELDS.map(f => `
    <div class="goal-field">
      <label class="goal-input-label">
        ${f.label}
        <input type="number" id="goal-${f.key}" value="${GOALS[f.key]}" inputmode="numeric">
      </label>
      <label class="goal-toggle">
        <input type="checkbox" id="toggle-${f.key}" ${TALLY_TOGGLES[f.key] ? "checked" : ""}>
        Show in Plan totals
      </label>
    </div>`).join("");

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">Daily Goals</div>
      ${helpButtonHTML("goals")}
    </header>
    <div class="detail">
      <p style="color:var(--ink-soft);font-size:13px;margin-top:0">
        Set your daily targets — the Plan tab uses these to show how each day is tracking.
        Uncheck anything you don't want cluttering up the totals.
      </p>
      <div class="goals-form">${fieldsHTML}</div>
      <button class="primary-btn" id="save-goals-btn" style="margin-top:18px;width:100%">Save Goals</button>
    </div>
  `;
  document.getElementById("save-goals-btn").addEventListener("click", () => {
    const newGoals = {};
    const newToggles = {};
    GOAL_FIELDS.forEach(f => {
      newGoals[f.key] = Number(document.getElementById(`goal-${f.key}`).value) || 0;
      newToggles[f.key] = document.getElementById(`toggle-${f.key}`).checked;
    });
    GOALS = newGoals;
    TALLY_TOGGLES = newToggles;
    saveGoals(GOALS);
    saveTallyToggles(TALLY_TOGGLES);
    history.back();
  });
}

// ---------- Stats ----------
function renderStats() {
  const streak = refreshProgress();
  const totalCooked = COOK_LOG.length;
  const breakdown = categoryBreakdown();
  const topList = mostCookedList(5);
  const recent = recentHistory(10);

  const statThumb = (r) => r.isCustomSnack
    ? `<div class="stat-thumb emoji-thumb">🍎</div>`
    : `<div class="stat-thumb" style="background-image:url('${recipeImageUrl(r)}')"></div>`;

  const topHTML = topList.length
    ? topList.map((x, i) => `
        <div class="stat-row">
          <span class="stat-rank">#${i + 1}</span>
          ${statThumb(x.recipe)}
          <div class="stat-row-info">
            <p class="stat-row-title">${x.recipe.title}</p>
            <p class="stat-row-sub">${x.count}× cooked</p>
          </div>
        </div>`).join("")
    : `<p class="empty-state small">Nothing cooked yet — check off a meal on the Plan tab to get started.</p>`;

  const recentHTML = recent.map(e => {
    const r = findRecipeById(e.recipeId);
    if (!r) return "";
    return `
      <div class="stat-row">
        ${statThumb(r)}
        <div class="stat-row-info">
          <p class="stat-row-title">${r.title}</p>
          <p class="stat-row-sub">${e.date}</p>
        </div>
      </div>`;
  }).join("");

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">Your Stats</div>
    </header>
    <div class="detail">
      <div class="stats-hero">
        <div class="stats-hero-item">
          <span class="stats-num">🔥 ${streak}</span>
          <span class="stats-label">Current Streak</span>
        </div>
        <div class="stats-hero-item">
          <span class="stats-num">${STATS_META.longestStreak}</span>
          <span class="stats-label">Longest Streak</span>
        </div>
        <div class="stats-hero-item">
          <span class="stats-num">🎟 ${availableCheatTokens()}</span>
          <span class="stats-label">Cheat Days</span>
        </div>
      </div>

      <div class="section">
        <h2>Total Meals Cooked</h2>
        <p class="stats-total">${totalCooked}</p>
      </div>

      <div class="section">
        <div class="shortcut-row">
          <button class="shortcut-card" onclick="location.hash='#/achievements'">
            <span class="shortcut-icon">🏆</span>
            <span class="shortcut-label">Achievements</span>
            <span class="shortcut-sub">${Object.keys(UNLOCKED_ACHIEVEMENTS).length}/${ACHIEVEMENTS.length}</span>
          </button>
          <button class="shortcut-card" onclick="location.hash='#/rewards'">
            <span class="shortcut-icon">🎁</span>
            <span class="shortcut-label">Rewards</span>
            <span class="shortcut-sub">${REWARDS.filter(r => r.unlocked).length}/${REWARDS.length}</span>
          </button>
          <button class="shortcut-card" onclick="location.hash='#/snacks'">
            <span class="shortcut-icon">🦥</span>
            <span class="shortcut-label">Snack Corner</span>
          </button>
          <button class="shortcut-card" onclick="location.hash='#/calendar'">
            <span class="shortcut-icon">📅</span>
            <span class="shortcut-label">Calendar</span>
          </button>
        </div>
      </div>

      <div class="section">
        <h2>By Category</h2>
        <div class="tally-card">
          <div class="cat-breakdown-row"><span>🌅 Breakfast</span><span>${breakdown.breakfast}</span></div>
          <div class="cat-breakdown-row"><span>🥕 Snack</span><span>${breakdown.snack}</span></div>
          <div class="cat-breakdown-row"><span>🍽 Dinner</span><span>${breakdown.dinner}</span></div>
          <div class="cat-breakdown-row"><span>🎉 Treat</span><span>${breakdown.treat}</span></div>
        </div>
      </div>

      <div class="section">
        <h2>Most Cooked</h2>
        ${topHTML}
      </div>

      ${recent.length ? `<div class="section"><h2>Recent History</h2>${recentHTML}</div>` : ""}
    </div>
  `;
}

// ---------- Snack Corner ----------
function renderSnackCorner() {
  refreshProgress();
  const tally = tallyForDate(selectedDate);
  const remainingCal = Math.max(0, GOALS.calories - tally.calories);
  const remainingProtein = Math.max(0, GOALS.protein - tally.protein);

  const allSnacks = [...allActiveRecipes().filter(r => r.category === "snack"), ...CUSTOM_SNACKS];
  const fitting = allSnacks
    .filter(s => typeof s.calories === "number" && s.calories <= remainingCal + 40)
    .sort((a, b) => b.protein - a.protein);

  const snackThumb = (s) => s.isCustomSnack
    ? `<div class="stat-thumb emoji-thumb">🍎</div>`
    : `<div class="stat-thumb" style="background-image:url('${recipeImageUrl(s)}')"></div>`;

  const suggestionHTML = fitting.length
    ? fitting.map(s => `
        <div class="snack-suggest-row">
          ${snackThumb(s)}
          <div class="stat-row-info">
            <p class="stat-row-title">${s.title}</p>
            <p class="stat-row-sub">${s.calories} kcal · ${s.protein}g protein</p>
          </div>
          <button class="snack-eat-btn" data-snack="${s.id}">I ate this</button>
        </div>`).join("")
    : `<p class="empty-state small">Nothing fits your remaining budget right now — nice work today! 🎉</p>`;

  const customListHTML = CUSTOM_SNACKS.length
    ? CUSTOM_SNACKS.map(s => `
        <div class="snack-suggest-row">
          <div class="stat-thumb emoji-thumb">🍎</div>
          <div class="stat-row-info">
            <p class="stat-row-title">${s.title}</p>
            <p class="stat-row-sub">${s.calories} kcal</p>
          </div>
          <button class="plan-remove" data-delete-snack="${s.id}" aria-label="Delete">✕</button>
        </div>`).join("")
    : `<p class="empty-state small">No custom snacks yet — add your own below.</p>`;

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">Baby Goobert's Snack Corner</div>
      ${helpButtonHTML("snacks")}
    </header>
    <div class="detail">
      <div class="snack-remaining-card">
        <img src="assets/baby_goobert.png" class="snack-corner-mascot" alt="">
        <div>
          <p class="snack-remaining-num">${remainingCal} kcal left today</p>
          <p class="snack-remaining-sub">${remainingProtein}g protein left</p>
        </div>
      </div>

      <div class="section">
        <h2>Fits your day</h2>
        ${suggestionHTML}
      </div>

      <div class="section">
        <h2>Your Custom Snacks</h2>
        ${customListHTML}
        <button class="primary-btn" id="add-snack-btn" style="width:100%;margin-top:10px">+ Add a snack</button>
        <div id="add-snack-form" class="add-form" style="display:none">
          <input type="text" id="snack-title" placeholder="Snack name" />
          <div class="form-grid-4">
            <input type="number" id="snack-calories" placeholder="Cals" inputmode="numeric">
            <input type="number" id="snack-protein" placeholder="Protein g" inputmode="numeric">
            <input type="number" id="snack-carbs" placeholder="Carbs g" inputmode="numeric">
            <input type="number" id="snack-fat" placeholder="Fat g" inputmode="numeric">
          </div>
          <button class="primary-btn" id="save-snack-btn" style="width:100%">Save Snack</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("add-snack-btn").addEventListener("click", () => {
    document.getElementById("add-snack-form").style.display = "flex";
  });
  document.getElementById("save-snack-btn").addEventListener("click", () => {
    const title = document.getElementById("snack-title").value.trim();
    if (!title) return;
    const id = addCustomSnack({
      title,
      calories: Number(document.getElementById("snack-calories").value) || 0,
      protein: Number(document.getElementById("snack-protein").value) || 0,
      carbs: Number(document.getElementById("snack-carbs").value) || 0,
      fat: Number(document.getElementById("snack-fat").value) || 0,
    });
    if (!id) return; // safeSetItem already surfaced the error toast
    renderSnackCorner();
  });
  app.querySelectorAll("[data-delete-snack]").forEach(btn => {
    btn.addEventListener("click", () => { deleteCustomSnack(btn.dataset.deleteSnack); renderSnackCorner(); });
  });
  app.querySelectorAll("[data-snack]").forEach(btn => {
    btn.addEventListener("click", () => {
      const snack = allSnacks.find(s => s.id === btn.dataset.snack);
      if (!snack) return;
      logSnackEaten(selectedDate, snack);
      showGoobertToast(`Yum! Logged ${snack.title} 🍪`);
      renderSnackCorner();
    });
  });
}

// ---------- Achievements ----------
function renderAchievements() {
  refreshProgress();
  const rows = ACHIEVEMENTS.map(a => {
    const unlocked = !!UNLOCKED_ACHIEVEMENTS[a.id];
    const isSecret = a.hidden && !unlocked;
    return `
      <div class="achievement-row ${unlocked ? "unlocked" : "locked"}">
        <span class="achievement-icon">${unlocked ? a.icon : isSecret ? "❓" : "🔒"}</span>
        <div class="stat-row-info">
          <p class="stat-row-title">${isSecret ? "???" : a.name}</p>
          <p class="stat-row-sub">${isSecret ? "A secret achievement. Keep exploring…" : a.desc}</p>
        </div>
      </div>`;
  }).join("");

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">Achievements<small>${Object.keys(UNLOCKED_ACHIEVEMENTS).length} of ${ACHIEVEMENTS.length} unlocked</small></div>
    </header>
    <div class="detail">${rows}</div>
  `;
}

// ---------- Real-Life Rewards ----------
function renderRewards() {
  refreshProgress();
  const rows = REWARDS.length
    ? REWARDS.map(r => {
        const progress = rewardProgress(r);
        const pct = Math.min(100, Math.round((progress / r.target) * 100));
        const catNote = r.triggerType === "categoryCooked" ? ` (${CATEGORY_LABELS[r.category]})` : "";
        return `
          <div class="reward-row ${r.unlocked ? "unlocked" : ""}">
            <div class="reward-row-top">
              <p class="stat-row-title">${r.unlocked ? "🎉 " : ""}${r.name}</p>
              <button class="plan-remove" data-delete-reward="${r.id}" aria-label="Delete">✕</button>
            </div>
            <p class="stat-row-sub">${progress} / ${r.target} ${REWARD_TRIGGER_LABELS[r.triggerType]}${catNote}</p>
            <div class="tally-track"><div class="tally-fill ${r.unlocked ? "reward-done" : ""}" style="width:${pct}%"></div></div>
          </div>`;
      }).join("")
    : `<p class="empty-state small">No rewards yet — add one below.</p>`;

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">Real-Life Rewards</div>
    </header>
    <div class="detail">
      ${rows}
      <button class="primary-btn" id="add-reward-btn" style="width:100%;margin-top:14px">+ Add a Reward</button>
      <div id="add-reward-form" class="add-form" style="display:none">
        <input type="text" id="reward-name" placeholder="Reward (e.g. Sushi date)" />
        <select id="reward-trigger">
          <option value="streak">Reach a day streak</option>
          <option value="totalCooked">Cook X meals total</option>
          <option value="uniqueRecipes">Try X unique recipes</option>
          <option value="categoryCooked">Cook X meals in one category</option>
        </select>
        <select id="reward-category" style="display:none">
          <option value="breakfast">Breakfast</option>
          <option value="snack">Snack</option>
          <option value="dinner">Dinner</option>
          <option value="treat">Treat</option>
        </select>
        <input type="number" id="reward-target" placeholder="Target number" inputmode="numeric" />
        <button class="primary-btn" id="save-reward-btn" style="width:100%">Save Reward</button>
      </div>
    </div>
  `;

  document.getElementById("add-reward-btn").addEventListener("click", () => {
    document.getElementById("add-reward-form").style.display = "flex";
  });
  document.getElementById("reward-trigger").addEventListener("change", (e) => {
    document.getElementById("reward-category").style.display = e.target.value === "categoryCooked" ? "block" : "none";
  });
  document.getElementById("save-reward-btn").addEventListener("click", () => {
    const name = document.getElementById("reward-name").value.trim();
    const target = Number(document.getElementById("reward-target").value) || 0;
    if (!name || !target) return;
    addReward({
      name,
      triggerType: document.getElementById("reward-trigger").value,
      category: document.getElementById("reward-category").value,
      target,
    });
    renderRewards();
  });
  app.querySelectorAll("[data-delete-reward]").forEach(btn => {
    btn.addEventListener("click", () => { deleteReward(btn.dataset.deleteReward); renderRewards(); });
  });
}

// ---------- Recipe Editor (new custom recipe, new version, or edit custom) ----------
let editorContext = null; // { mode: 'new-version'|'edit-custom'|'new-custom', baseId, prefill }
let editorPhotoDataUrl = null;

function compressAndPreviewPhoto(file, previewEl, onDone) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 800;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
        else { w = Math.round(w * (maxDim / h)); h = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      if (previewEl) previewEl.style.backgroundImage = `url('${dataUrl}')`;
      onDone(dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderEditor() {
  if (!editorContext) { location.hash = "#/"; return; }
  const { mode, prefill } = editorContext;
  const p = prefill || {};
  editorPhotoDataUrl = null;

  const titleText = mode === "new-custom" ? "Add a Recipe" : mode === "new-version" ? "Edit Recipe (New Version)" : "Edit Recipe";
  const catOptions = DECIDE_CATEGORIES.map(c => `<option value="${c}" ${p.category === c ? "selected" : ""}>${CATEGORY_LABELS[c]}</option>`).join("");

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">${titleText}</div>
    </header>
    <div class="detail">
      <div class="editor-photo" id="editor-photo" style="${p.image ? `background-image:url('${recipeImageUrl(p)}')` : ""}">
        <label class="editor-photo-label">
          📷 ${p.image ? "Change Photo" : "Add Photo"}
          <input type="file" accept="image/*" id="editor-photo-input" style="display:none">
        </label>
      </div>

      <div class="add-form">
        <input type="text" id="ed-title" placeholder="Recipe name" value="${(p.title || "").replace(/"/g, "&quot;")}">
        <select id="ed-category">${catOptions}</select>

        <div class="form-grid-4">
          <input type="number" id="ed-calories" placeholder="Calories" value="${p.calories ?? ""}" inputmode="numeric">
          <input type="number" id="ed-protein" placeholder="Protein g" value="${p.protein ?? ""}" inputmode="numeric">
          <input type="number" id="ed-carbs" placeholder="Carbs g" value="${p.carbs ?? ""}" inputmode="numeric">
          <input type="number" id="ed-fat" placeholder="Fat g" value="${p.fat ?? ""}" inputmode="numeric">
        </div>
        <input type="number" id="ed-fiber" placeholder="Fiber g" value="${p.fiber ?? ""}" inputmode="numeric">

        <div class="form-grid-4">
          <input type="text" id="ed-servings" placeholder="Servings" value="${p.servings || ""}">
          <input type="text" id="ed-prep-time" placeholder="Prep time" value="${p.prep_time || ""}">
          <input type="number" id="ed-difficulty" placeholder="Difficulty 1-5" value="${p.difficulty ?? ""}" inputmode="numeric">
          <input type="number" id="ed-dishes" placeholder="Dishes 1-5" value="${p.dishes ?? ""}" inputmode="numeric">
        </div>

        <label class="ed-label">Ingredients (one per line)</label>
        <textarea id="ed-ingredients" rows="5" placeholder="200g Greek yogurt&#10;1 tbsp honey">${(p.ingredients || []).join("\n")}</textarea>

        <label class="ed-label">Method (one step per line)</label>
        <textarea id="ed-method" rows="5" placeholder="Mix everything together.&#10;Serve chilled.">${(p.method || []).join("\n")}</textarea>

        <label class="ed-label">Notes (one per line, optional)</label>
        <textarea id="ed-notes" rows="3">${(p.notes || []).join("\n")}</textarea>

        <input type="text" id="ed-tags" placeholder="Tags, comma separated" value="${(p.tags || []).join(", ")}">
        <input type="text" id="ed-dietary" placeholder="Dietary, e.g. vegetarian, gluten-free" value="${(p.dietary_tags || []).join(", ")}">

        <label class="ed-checkbox"><input type="checkbox" id="ed-freezer" ${p.freezer_friendly ? "checked" : ""}> Freezer friendly</label>
        <label class="ed-checkbox"><input type="checkbox" id="ed-mealprep" ${p.meal_prep_friendly ? "checked" : ""}> Meal prep friendly</label>
      </div>

      <button class="primary-btn" id="save-editor-btn" style="width:100%;margin-top:16px">Save Recipe</button>
    </div>
  `;

  document.getElementById("editor-photo-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    compressAndPreviewPhoto(file, document.getElementById("editor-photo"), (dataUrl) => {
      editorPhotoDataUrl = dataUrl;
    });
  });

  document.getElementById("save-editor-btn").addEventListener("click", () => {
    const title = document.getElementById("ed-title").value.trim();
    if (!title) { alert("Give it a name first!"); return; }

    const fields = {
      title,
      category: document.getElementById("ed-category").value,
      calories: Number(document.getElementById("ed-calories").value) || 0,
      protein: Number(document.getElementById("ed-protein").value) || 0,
      carbs: Number(document.getElementById("ed-carbs").value) || 0,
      fat: Number(document.getElementById("ed-fat").value) || 0,
      fiber: Number(document.getElementById("ed-fiber").value) || 0,
      servings: document.getElementById("ed-servings").value.trim() || "1",
      prep_time: document.getElementById("ed-prep-time").value.trim() || "—",
      total_time: document.getElementById("ed-prep-time").value.trim() || "—",
      difficulty: Number(document.getElementById("ed-difficulty").value) || 1,
      dishes: Number(document.getElementById("ed-dishes").value) || 1,
      image: editorPhotoDataUrl || p.image || "",
      ingredients: document.getElementById("ed-ingredients").value.split("\n").map(s => s.trim()).filter(Boolean),
      method: document.getElementById("ed-method").value.split("\n").map(s => s.trim()).filter(Boolean),
      notes: document.getElementById("ed-notes").value.split("\n").map(s => s.trim()).filter(Boolean),
      tags: document.getElementById("ed-tags").value.split(",").map(s => s.trim()).filter(Boolean),
      dietary_tags: document.getElementById("ed-dietary").value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
      freezer_friendly: document.getElementById("ed-freezer").checked,
      meal_prep_friendly: document.getElementById("ed-mealprep").checked,
    };

    if (mode === "new-version") {
      const newVersionId = addRecipeVersion(editorContext.baseId, fields);
      if (!newVersionId) return; // safeSetItem already surfaced the error toast
      showGoobertToast("New version saved! 📝");
      const baseId = editorContext.baseId;
      editorContext = null;
      location.hash = "#/recipe/" + baseId;
      // ensure the new (non-default) version is what's shown after navigating
      setTimeout(() => renderDetail(baseId, newVersionId), 0);
    } else if (mode === "edit-custom") {
      const ok = updateCustomRecipe(editorContext.baseId, fields);
      if (!ok) return;
      showGoobertToast("Recipe updated! 📝");
      const baseId = editorContext.baseId;
      editorContext = null;
      location.hash = "#/recipe/" + baseId;
    } else {
      const newId = addCustomRecipe(fields);
      if (!newId) return;
      showGoobertToast("Recipe added! 🎉");
      editorContext = null;
      location.hash = "#/recipe/" + newId;
    }
  });
}

// ---------- Calendar (monthly cooked-day heatmap) ----------
let calendarMonthOffset = 0;
function renderCalendar() {
  refreshProgress();
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + calendarMonthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const monthLabel = base.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayISO();

  let cells = "";
  for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = localISO(new Date(year, month, d));
    const count = COOK_LOG.filter(e => e.date === iso).length;
    const isCheatOnly = count === 0 && PROTECTED_DAYS.includes(iso);
    let cls = "cal-cell";
    if (count >= 3) cls += " level-3";
    else if (count === 2) cls += " level-2";
    else if (count === 1) cls += " level-1";
    if (isCheatOnly) cls += " cal-cheat";
    if (iso === todayStr) cls += " cal-today";
    cells += `<div class="${cls}">${d}${isCheatOnly ? "🎟" : ""}</div>`;
  }

  app.innerHTML = `
    <header class="topbar">
      <button class="back-btn" onclick="history.back()">${BACK_SVG}</button>
      <div class="wordmark">Calendar</div>
    </header>
    <div class="detail">
      <div class="cal-nav">
        <button id="cal-prev" class="secondary-btn">← Prev</button>
        <span class="cal-month-label">${monthLabel}</span>
        <button id="cal-next" class="secondary-btn">Next →</button>
      </div>
      <div class="cal-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend">
        <span><i class="cal-dot level-1"></i>1 meal</span>
        <span><i class="cal-dot level-2"></i>2 meals</span>
        <span><i class="cal-dot level-3"></i>3+ meals</span>
        <span>🎟 cheat day</span>
      </div>
    </div>
  `;

  document.getElementById("cal-prev").addEventListener("click", () => { calendarMonthOffset--; renderCalendar(); });
  document.getElementById("cal-next").addEventListener("click", () => { calendarMonthOffset++; renderCalendar(); });
}

function router() {
  const hash = location.hash || "#/";
  const recipeMatch = hash.match(/^#\/recipe\/(.+)$/);
  if (recipeMatch) { renderDetail(recipeMatch[1]); return; }
  if (hash === "#/decide") { renderDecide(); return; }
  if (hash === "#/plan") { renderPlan(); return; }
  if (hash === "#/goals") { renderGoals(); return; }
  if (hash === "#/stats") { renderStats(); return; }
  if (hash === "#/snacks") { renderSnackCorner(); return; }
  if (hash === "#/achievements") { renderAchievements(); return; }
  if (hash === "#/rewards") { renderRewards(); return; }
  if (hash === "#/editor") { renderEditor(); return; }
  if (hash === "#/calendar") { renderCalendar(); return; }
  renderLibrary();
}

window.addEventListener("hashchange", router);

loadRecipes().then(router);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}
