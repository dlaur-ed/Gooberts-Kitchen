# Goobert's Kitchen — PWA Test Build

This is the bare framework: an installable, offline-capable app shell with no
real features yet. The goal is just to prove it works on both phones before
building anything on top.

## Deploy it (pick one — both are free and take ~2 minutes)

### Option A: Netlify Drop (fastest, no account needed to start)
1. Go to https://app.netlify.com/drop
2. Drag the whole `goobert-pwa` folder onto the page
3. You'll get a live URL like `https://random-name-123.netlify.app`

### Option B: GitHub Pages (better if you'll keep iterating)
1. Create a new GitHub repo, push these files to it
2. Repo Settings → Pages → set source to the `main` branch, root folder
3. Your URL will be `https://yourusername.github.io/reponame/`

## Test it on both phones

1. Open the deployed URL in **Safari on her iPhone**
   - Tap the **Share** icon → **Add to Home Screen** → **Add**
   - Open the app from the Home Screen icon (not Safari) — the checklist
     should show "Running as installed app: Yes"
2. Open the same URL in **Chrome on your Android**
   - Chrome should show an **Install** prompt automatically (or via the
     ⋮ menu → "Install app")
3. On either phone, turn on Airplane Mode and reopen the app from the Home
   Screen — it should still load and the checklist should say "Offline" but
   still show a loaded page. That confirms the service worker cache works.

## What's in here

- `index.html` — the test page + live checklist (loaded / offline support /
  installed / connection status)
- `manifest.json` — tells the phone this is installable, sets the app name,
  icon, and colors
- `service-worker.js` — caches the app shell so it still opens offline
- `icons/` — placeholder bowl icon (192px + 512px) — swap these out once
  Baby Goobert artwork is ready for the icon

## Next step

Once this is confirmed working on both phones, we build the real MVP on top
of this shell: Recipe Library, Recipe Detail (from your printable cards),
Search, Favourites.
