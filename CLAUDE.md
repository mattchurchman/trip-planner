# Working rules for this repository

You are working on **Trip Planner**, a small private website for a group of friends. The app is built and in use; you are here to do one task from `docs/tasks/`. The owner is not a developer, so explain things in plain language and avoid jargon.

## Read first, every session

1. This file.
2. The task file you were given, for example `docs/tasks/T03-candidate-cards.md`. It lists the files you may change and the `SPEC.md` sections you need.
3. Those `SPEC.md` sections. `SPEC.md` is the source of truth; you don't need to read all of it.

Do only that task. Stay inside the files it lists. If the task can't be done without touching another file, touch as little as possible and say which file and why in your summary. Don't fix, restyle or "improve" anything else you notice — write it down under "Noticed but didn't change" in your summary instead, so the owner can turn it into a task.

Check the task's **Depends on** line. If a task it depends on isn't marked Done in `docs/tasks/README.md`, stop and tell the owner.

`PHASES.md` is the history of how the app was first built. Don't build from it.

## Fixed decisions (do not change)

- Plain HTML, CSS and JavaScript ES modules. No frameworks (no React, Vue, Svelte), no build tools, no bundlers, no TypeScript, and no npm packages.
- Hosting is GitHub Pages from the repository root on `main`.
- Firebase **Spark (free) plan only**: Google sign-in and Cloud Firestore. Never use or suggest Cloud Storage, Cloud Functions, the Blaze plan, or anything that needs a credit card.
- The map is Leaflet 1.9.4 with OpenStreetMap tiles. Never use the Google Maps JavaScript API, the Places API, or any API key.
- The only outside services the app may call are Nominatim (place search) and the Wikipedia page-summary API (destination photos), both from `js/lookup.js`. Everything else is a plain link the user opens.
- No flight or hotel price APIs, no scraping, and no sample or made-up data in the app.
- The data model and security rules in `SPEC.md` are exact. If you think something must change, **stop and ask the owner**. If they agree, update `SPEC.md` (and bump its version) in the same commit as the code.

If you cannot build a requirement as written, say so plainly and name the requirement. Do not quietly substitute something different, leave a button that does nothing, or claim something works when you have not checked it.

## Code rules

- Pure logic goes in `js/lib/` with no DOM and no Firebase imports, and it gets tests in `tests/`.
- Only `js/firebase.js` imports from the Firebase CDN, only `js/store.js` talks to Firestore, and only `js/lookup.js` calls `fetch()`.
- Build DOM with `createElement` and `textContent`. Never put user or database text into `innerHTML`.
- Links from data pass through `safeUrl()` and open with `target="_blank" rel="noopener noreferrer"`.
- Update Firestore fields individually (field paths, `arrayUnion`, `arrayRemove`), because several people edit at the same time.
- Live updates must never wipe a form someone is typing in (see SPEC section 8).
- Every button does something real and shows a pending state, success, or a specific error.
- Keep files under about 400 lines (`js/store.js` and `css/styles.css` are allowed exceptions). Use clear names and short comments where the reason isn't obvious.
- Style only with the tokens in SPEC §4 (`var(--primary)`, `var(--space-4)` …). Don't type raw colors, except the category colors. Put new CSS in the section of `styles.css` for the screen you're working on.
- Words on screen follow `docs/tasks/WORDING.md` once task T07 is done.

## Checking your work

1. Run `node tests/run-tests.js`. Every test must pass before you finish.
2. Serve the site locally (`python3 -m http.server 8000`) and load it to catch JavaScript errors where you can.
3. Google sign-in usually cannot be completed in your environment. Don't pretend otherwise. List what you verified yourself, and hand the owner the **Owner check** list from the task file so they can click through it on the live site.

## Finishing a task

When the task is done and tests pass:

1. In `docs/tasks/README.md`, change the task's status to **Done** and add today's date.
2. Commit with the message `T0N: <short summary>` and push to `main` (ask first if the owner hasn't said pushing is fine).
3. Tell the owner, in plain language:
   - what you changed
   - what you tested and how
   - anything you could not do or had to ask about
   - "Noticed but didn't change": problems outside the task
   - the Owner check list, copied from the task file
   - any Firebase console step they need to do (for example, re-pasting `firestore.rules`)

## If the owner reports a bug

Ask for the exact message they saw, or have them open the browser console (Chrome on Mac: ⌥⌘J; Windows: Ctrl+Shift+J) and paste the red error text. Fix the cause, add a test when the bug is in `js/lib/`, and don't rewrite unrelated code.
