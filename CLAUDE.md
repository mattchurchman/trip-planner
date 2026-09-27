# Working rules for this repository

You are building **Trip Planner**, a small private website for a group of friends. The owner is not a developer, so explain things in plain language and avoid jargon.

## Read first, every session

1. This file.
2. `SPEC.md`, which describes what the app is and how it works. It is the source of truth.
3. The phase you were asked to build in `PHASES.md`.

Build only that phase. Do not start the next phase, and do not "improve" earlier phases unless the phase instructions or the owner ask you to.

## Fixed decisions (do not change)

- Plain HTML, CSS and JavaScript ES modules. No frameworks (no React, Vue, Svelte), no build tools, no bundlers, no TypeScript, and no npm packages.
- Hosting is GitHub Pages from the repository root on `main`.
- Firebase **Spark (free) plan only**: Google sign-in and Cloud Firestore. Never use or suggest Cloud Storage, Cloud Functions, the Blaze plan, or anything that needs a credit card.
- The map is Leaflet 1.9.4 with OpenStreetMap tiles. Never use the Google Maps JavaScript API, the Places API, or any API key.
- No flight or hotel price APIs, no scraping, and no sample or made-up data in the app.
- The data model and security rules in `SPEC.md` are exact. If you think something must change, **stop and ask the owner**. If they agree, update `SPEC.md` (and bump its version) in the same commit as the code.

If you cannot build a requirement as written, say so plainly and name the requirement. Do not quietly substitute something different, leave a button that does nothing, or claim something works when you have not checked it.

## Code rules

- Pure logic goes in `js/lib/` with no DOM and no Firebase imports, and it gets tests in `tests/`.
- Only `js/firebase.js` imports from the Firebase CDN, and only `js/store.js` talks to Firestore.
- Build DOM with `createElement` and `textContent`. Never put user or database text into `innerHTML`.
- Links from data pass through `safeUrl()` and open with `target="_blank" rel="noopener noreferrer"`.
- Update Firestore fields individually (field paths, `arrayUnion`, `arrayRemove`), because several people edit at the same time.
- Live updates must never wipe a form someone is typing in (see SPEC section 8).
- Every button does something real and shows a pending state, success, or a specific error.
- Keep files under about 400 lines. Use clear names and short comments where the reason isn't obvious.

## Checking your work

1. Run `node tests/run-tests.js`. Every test must pass before you finish.
2. Serve the site locally (`python3 -m http.server 8000`) and load it to catch JavaScript errors where you can.
3. Google sign-in usually cannot be completed in your environment. Don't pretend otherwise. List what you verified yourself, and hand the owner the **Owner check** list from the phase so they can click through it on the live site.

## Finishing a phase

When the phase is done and tests pass:

1. Commit with the message `Phase N: <short summary>` and push to `main` (ask first if the owner hasn't said pushing is fine).
2. Tell the owner, in plain language:
   - what you built
   - what you tested and how
   - anything you could not do or had to ask about
   - the Owner check list, copied from `PHASES.md`
   - any Firebase console step they need to do (for example, re-pasting `firestore.rules`)

## If the owner reports a bug

Ask for the exact message they saw, or have them open the browser console (Chrome on Mac: ⌥⌘J; Windows: Ctrl+Shift+J) and paste the red error text. Fix the cause, add a test when the bug is in `js/lib/`, and don't rewrite unrelated code.
