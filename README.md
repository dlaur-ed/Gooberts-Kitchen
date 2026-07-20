# Goobert's Kitchen — MVP v0.1

Real app, replacing the test-shell build. This version has:
- **Recipe Library** — grid of recipe cards with category filter chips
- **Recipe Detail** — full digital recipe (macros, ingredients you can tap to
  check off, method, notes), styled to match the printable cards

Not in yet (next up): Search, Favourites.

## How data flows

```
recipes.csv  →  csv_to_json.py  →  data/recipes.json  →  app.js renders it
```

Whenever you add/edit a recipe in `recipes.csv`, run:
```
python csv_to_json.py
```
then re-upload `data/recipes.json` (and any new images in `assets/`) to GitHub.

## Deploying (same repo you already have)

This replaces the contents of the `Gooberts-Kitchen` repo you already have
live. Overwrite these files:
- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `service-worker.js`

Add these (new):
- `data/recipes.json` (upload into a `data/` folder — same subfolder trick as
  the icons: go to `github.com/USERNAME/Gooberts-Kitchen/upload/main/data`)
- `assets/*.png` — all the recipe photos (upload into `assets/` the same way)
- `recipes.csv` and `csv_to_json.py` (root level, for future updates)

The `icons/` folder you already have stays as-is — no changes there.

## After deploying

Close and reopen the app on both phones (force-close, don't just background
it) so the service worker picks up the new version. You should see the real
recipe grid instead of the "Framework Test" checklist page.

## What's simple/on purpose right now

- No search, no favourites yet — coming next
- No build tooling — plain HTML/CSS/JS, edit directly on GitHub like before
- Ingredient checkboxes don't persist between visits yet (that arrives with
  the Favourites/local-storage work)
