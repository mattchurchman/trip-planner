# T14 — Home-screen app and Firebase Hosting

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** nothing · **If it fails twice:** Opus
**Owner steps first:**
1. Firebase console → gear → **Project settings → Service accounts → Generate new private key**. A file downloads. Keep it out of the repo.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**. Add `FIREBASE_SERVICE_ACCOUNT` (paste the whole file's contents) and `FIREBASE_PROJECT_ID` (`trip-planner-mattchurchman`).
3. Tell the agent "secrets added".

## Goal
The app is served from `https://trip-planner-mattchurchman.web.app`, redeploys itself on every push to `master`, and opens full screen with its own icon when added to an iPhone home screen.

## Read (only these)
- `docs/V4.md` §3
- `firebase.json`, the `<head>` of `index.html`, `help.html`, `recap.html`, `404.html`

## Files you may change
- `firebase.json`, **new** `.github/workflows/deploy.yml`, **new** `manifest.webmanifest`
- the `<head>` of every `.html` file
- `css/styles.css` (safe-area padding on the top bar only)
- `README.md` (replace the GitHub Pages steps with the new address and how deploys work)

## Do
1. `firebase.json`: add `hosting` with `"public": "."`, an `ignore` list (`docs/**`, `tests/**`, `**/*.md`, `firebase.json`, `firestore.rules`, `package.json`, `.github/**`, `**/.*`), and a `no-cache` header for `.html`, `.js`, `.css` and `.webmanifest` so updates show up without a hard refresh.
2. `deploy.yml`: on push to `master`, check out, run `node tests/run-tests.js`, then deploy with `FirebaseExtended/action-hosting-deploy@v0` (`channelId: live`, the two secrets, no `repoToken`). `permissions: contents: read`.
3. `manifest.webmanifest`: name and short name "Trip Planner", `display: standalone`, `start_url: "./"`, theme and background colors from the current tokens, icons `img/icons/icon-192.png` and `icon-512.png` (already in the repo).
4. Every HTML head: manifest link, `viewport-fit=cover`, the three `apple-mobile-web-app-*` tags, `apple-touch-icon` → `img/icons/icon-180.png`.
5. Top bar: add `env(safe-area-inset-top)` padding so it clears the iPhone status bar in full-screen mode.

## Don't
- Add a service worker, change sign-in (T15), or restyle anything (T16).
- Turn off GitHub Pages. The old address keeps working until T15 is checked.

## Tests
Existing tests pass. Validate `firebase.json` and the manifest parse as JSON.

## Done when
The workflow run is green and the new address loads the app. If the push is refused because it contains a workflow file, give the owner the file to add through GitHub's web editor and say so.

## Owner check
1. Open `https://trip-planner-mattchurchman.web.app` on a computer: the app loads and Google sign-in works as before.
2. On iPhone Safari, open the new address → Share → **Add to Home Screen**. The icon is the Trip Planner logo.
3. Open it from the icon: no Safari bars. (Sign-in from the icon is fixed in T15.)
