# Cloudflare Pages Setup — Stage 1

Practical walkthrough for hosting the SAR POD Calculator v3 PWA on **Cloudflare Pages**. This is Stage 1 of the migration plan: the static SPA moves to Cloudflare, the existing upload Worker stays where it is, and the manual Upload / Upload All buttons keep working unchanged.

This document does not contain secrets, tokens, or API keys, and does not need any. The frontend has no environment variables.

---

## TL;DR

- **Product:** Cloudflare Pages.
- **Account:** `ian.bell.personal@gmail.com` (Cloudflare dashboard).
- **Source:** the GitHub repo that hosts this codebase (whichever name it ends up at — see "Before you begin").
- **Build command:** *(none)*
- **Build output directory:** `/`
- **Production branch:** `main`
- **Environment variables:** none required.
- **Custom domain:** optional. The auto-generated `<project>.pages.dev` URL works fine for Stage 1.
- **No `_redirects` needed** — the app uses hash routing, so every URL hits `index.html` naturally.
- **Service worker cache name** was bumped to `psar-pod-v19-cf-launch` so first-visit users get a clean install.

---

## Before you begin

### 1. (Strongly recommended) Decide on the GitHub repo name first

The local working folder is `SAR_POD_Calc_v3.0`, but the git remote still pushes to the v2-named GitHub repo (`SAR_POD__Calc_v2.0`). Cloudflare Pages will be wired to whichever GitHub repo you connect, and renaming a repo *after* Pages is wired requires re-pointing the Pages project. It is cheaper to rename now.

See `docs/V3_RENAME_PREFLIGHT_AUDIT.md` §3 for the three options. Recommendation: rename the GitHub repo to drop the v2 suffix, then update the local remote:

```
git remote set-url origin https://github.com/ibell2355/<new-name>.git
git remote -v
```

GitHub keeps a redirect from the old URL, so existing clones don't break.

### 2. Push the current branch to GitHub

Cloudflare Pages deploys from GitHub commits. Make sure everything you want on Cloudflare is pushed to `main` (or whichever branch you pick as Production).

```
git status
git push
```

### 3. Confirm you're signed into the right Cloudflare account

Sign in to https://dash.cloudflare.com with `ian.bell.personal@gmail.com`. This is the same account that hosts the existing upload Worker (`little-river-e034.ian-bell-personal.workers.dev`).

---

## Create the Pages project

1. In the Cloudflare dashboard, open **Workers & Pages → Create application → Pages → Connect to Git**.
2. Authorize Cloudflare on GitHub if prompted. Pick the SAR POD repo.
3. **Project name:** anything memorable — e.g. `sar-pod-calc` or `psar-pod-field-assistant`. The project name becomes the `*.pages.dev` subdomain.
4. **Production branch:** `main`.
5. **Framework preset:** *(None)* — this is a vanilla static site.
6. **Build command:** leave **blank**.
7. **Build output directory:** `/` (the repo root). Some Cloudflare UIs expect the directory relative to the repo root — if so, leave it blank or set to `.`. The intent is "serve the repo root as the site".
8. **Environment variables (Production / Preview):** none. Skip this section.
9. Click **Save and Deploy**.

The first deploy takes ~30–60 seconds. When it finishes you'll get a URL like `https://sar-pod-calc.pages.dev`.

---

## Files in the repo that Cloudflare Pages reads

| File | Why it matters |
|---|---|
| `_headers` | Tells Pages how to set HTTP response headers per path. Already configured to mark `service-worker.js` as no-cache and to give `manifest.webmanifest` the correct content type. **Do not** add long-cache rules for `index.html` or `service-worker.js`. |
| `service-worker.js` | The PWA service worker. **Must** be served fresh — handled by the `_headers` rule. |
| `manifest.webmanifest` | The PWA manifest. Served with `Content-Type: application/manifest+json` via `_headers`. |
| `index.html` | App-shell HTML. |
| `assets/`, `src/`, `config/` | Static content. |
| `package.json` | Fetched at runtime for the version stamp in the header. Already part of the SW precache list. |

No `_redirects` file. Hash routing (`#/`, `#/segment/...`, `#/reports`, `#/report/...`) means every URL hits `index.html` from the server's point of view — no SPA fallback configuration needed.

---

## Upload endpoint and CORS

Stage 1 keeps the upload endpoint absolute and unchanged. In `src/main.js`:

```js
const UPLOAD_ENDPOINT = 'https://little-river-e034.ian-bell-personal.workers.dev/api/reports';
```

This means **the existing Worker keeps handling uploads exactly as it does today.** Manual Upload and Upload All buttons keep working with no behavioral change.

### CORS reminder
The frontend's origin changes from `https://ibell2355.github.io` (GitHub Pages) to your new `*.pages.dev` (or custom) Cloudflare domain. If the upload Worker uses a **restricted CORS allowlist** rather than `Access-Control-Allow-Origin: *`, it must be updated to include the new origin **before** uploads will work from Cloudflare.

To check quickly: from your browser DevTools on the Cloudflare-hosted app, attempt one Upload. If the network panel shows a CORS error (e.g. blocked preflight, or "No 'Access-Control-Allow-Origin' header"), update the Worker's CORS config. If the upload succeeds, no Worker change was needed.

A later migration stage (Stage 3) co-locates the Worker on the same Cloudflare zone so the SPA can call a relative `/api/reports` and CORS goes away entirely. **Not for now.**

---

## Service worker / PWA notes

- `_headers` sets `Cache-Control: no-cache, no-store, must-revalidate` on `/service-worker.js` so SW updates always reach users on the next page load.
- The SW cache name was bumped to `psar-pod-v19-cf-launch` (in `service-worker.js` and the cache-eviction snippet at the top of `index.html`). On the first Cloudflare deploy, every user gets a clean precache.
- Users who previously installed the PWA from `https://ibell2355.github.io/SAR_POD__Calc_v2.0/` are tied to that origin. They will **not** auto-migrate to the Cloudflare hostname — they will continue to use the GitHub Pages install until they navigate to the new URL and install from there. Plan to communicate the new URL out-of-band.

---

## Test checklist after the first deploy

Run through these on the `*.pages.dev` URL (or your custom domain).

### Cloudflare Pages preview URL
- [ ] Open the production URL printed by the Pages dashboard. Confirm a 200 response and that the app shell renders.
- [ ] Open any **preview URL** Cloudflare generates for a pull request branch. Confirm it loads identically. This proves preview deploys work and your DNS settings (if any) only attach to production.

### App load
- [ ] Browser DevTools → Network: confirm `index.html`, `src/main.js`, `src/ui/styles.css`, `service-worker.js`, `manifest.webmanifest`, and `config/SAR_POD_V3_config.yaml` all return 200.
- [ ] Confirm the version stamp in the page header shows the current `package.json` version (currently `3.1.1`).
- [ ] DevTools → Application → Manifest: confirm icons and theme color load with no warnings.
- [ ] DevTools → Application → Service Workers: confirm `service-worker.js` is **activated and running**, with `Cache-Control: no-cache` on its response.

### Hash routes
- [ ] Visit `/#/`, `/#/reports`, and an existing segment editor URL `/#/segment/<id>`. Each should render the right view without a server 404.
- [ ] Hard-reload (Ctrl+Shift+R) on a non-default hash route. Confirm `index.html` still loads (the hash never reaches the server, so this is expected — but worth visually confirming).

### Mobile PWA installability
- [ ] Open the production URL on an Android Chrome browser. You should see the "Add to Home Screen" prompt, or be able to install via the browser menu.
- [ ] On iOS Safari, install via Share → "Add to Home Screen". Confirm the home-screen icon uses `assets/icon-192.png` and the standalone window has the correct theme color (`#183859`).
- [ ] Launch the installed app from the home screen. Confirm it opens in standalone mode (no browser chrome).

### Offline behavior
- [ ] After the first successful load, turn the device offline (airplane mode, or DevTools → Network → Offline).
- [ ] Reload the page. The app shell, styles, JS, vegetation reference images, and YAML config should all load from cache.
- [ ] Navigate between hash routes offline. They should work.
- [ ] Edit a segment offline. Confirm the "Saved" indicator still flips through the debounced save cycle (IndexedDB writes succeed offline).
- [ ] Return online and refresh. State persists.

### Upload and Upload All
- [ ] Online, with at least one segment created: click **Upload** on a segment. Expect a green "Upload successful" toast and the segment badge changing to "Uploaded".
- [ ] Edit a previously-uploaded segment. The badge should flip to "Updated since upload".
- [ ] Click **Upload All** on the Reports page with multiple segments. Each should upload in sequence; the status line should show progress.
- [ ] DevTools → Network: confirm the POST goes to `https://little-river-e034.ian-bell-personal.workers.dev/api/reports` and returns 2xx.
- [ ] If you see a CORS error in the console, update the Worker's CORS allowlist to include the new Cloudflare origin and re-test.

---

## Rollback

The GitHub Pages deployment is **not** removed by setting up Cloudflare Pages. Both can coexist.

If anything is broken on Cloudflare and you need to roll back instantly:

1. Stop directing users to the Cloudflare URL — the existing GitHub Pages URL (`https://ibell2355.github.io/SAR_POD__Calc_v2.0/` or whatever it has been renamed to) is still live and still works.
2. Optional: in the Cloudflare dashboard, **pause** the Pages project or delete the custom domain binding. Pausing keeps the deploy history so you can resume later without re-importing.
3. If a specific commit broke Cloudflare, you can also roll back to an earlier deployment from the Pages dashboard (**Deployments → ⋯ → Rollback**) without touching git.

Because the upload endpoint did not change in Stage 1, there is no Worker-side rollback to do.

---

## What is *not* done in Stage 1

These are intentionally deferred to later stages:

- **DNS / custom domain cutover.** Stage 1 uses the `*.pages.dev` URL. A custom domain is a separate Stage 2 step.
- **Co-locating the Worker.** The upload endpoint stays absolute. Moving to a same-origin `/api/reports` is Stage 3.
- **Monorepo split** (`apps/web`, `worker`, `packages/core`, `packages/shared`). Stage 4–5.
- **Event-triggered upload / offline upload queue.** Stage 6.
- **Desktop app integration.** Out of scope here; will be evaluated from its own repo.
- **Portable JSON report export / import.** Captured as a principle in `docs/FUTURE_ARCHITECTURE_NOTES.md`; not built yet.

See `docs/REPO_CONTEXT_FOR_CLOUDFLARE_MIGRATION.md` §8 for the full staged plan.

---

## Manual steps Ian still needs to do

1. **(Optional but recommended)** Rename the GitHub repo to drop the v2 suffix and run `git remote set-url origin https://github.com/ibell2355/<new-name>.git`.
2. **Sign in to Cloudflare** at `ian.bell.personal@gmail.com` and create the Pages project per the steps above.
3. **Smoke-test on the `*.pages.dev` URL** using the checklist in this document.
4. **If the upload fails with a CORS error**, update the existing Worker's CORS allowlist to include the new Cloudflare origin and re-test.
5. **Communicate the new URL** to anyone using the field-installed PWA, since their existing install is tied to the GitHub Pages origin.
