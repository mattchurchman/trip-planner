# AGENTS.md — working rules for any coding agent

Read this fully at the start of every session. It is the only file every agent reads; everything else is loaded when a task asks for it.

Project: **Trip Planner**, a small private web app a few friends use to plan trips. It is built and in use. The owner is not a developer: explain things in plain language and avoid jargon.

## 1. Session protocol (follow exactly)

**One task per session. Never start a second task in the same session.**

1. Open `docs/tasks/README.md`. Your task is the one the owner names, or else the first **To do** row whose dependencies are all **Done**.
2. Open only that task file (`docs/tasks/Txx-*.md`).
3. **Model check.** The task header names a model and an effort level. If the owner's message names the same model (or a stronger one), continue. If it names a weaker one or none, stop and say:
   `Task Txx is written for <model> at <effort> effort. Switch to that, clear the context, and send the kickoff line again. Reply "continue" to go ahead on the current model anyway.`
   Agents from other vendors: use `docs/MODEL_TIERS.md` to find your matching tier.
4. If the task has **Owner steps first** that the owner hasn't confirmed, copy those steps to the owner and wait.
5. Check **Depends on**. If a dependency isn't **Done** on the board, stop and tell the owner.
6. Read only what the task lists under **Read**. Search for symbols instead of opening whole folders. Open big files (`SPEC.md`, `css/styles.css`, `js/store.js`) by section or line range, never whole.
7. Do the task. Change only the files it lists. If it truly can't be done without another file, touch as little as possible and say which file and why.
8. Run the checks in section 5. Fix until they pass.
9. On the board, set the task to **Done** with today's date. Commit as `Txx: <short summary>`. Push to `master` only if the owner said pushing is fine.
10. End with this message (fill in the brackets):

```
Txx done: <one line>
What changed: <2-4 plain-language bullets>
Checked: <what you ran or looked at> · Could not check: <what the owner must look at>
Noticed but didn't change: <problems outside the task, or "nothing">
Owner check: <the list from the task file>
<Any Firebase or GitHub step the owner must do>

Next: Tyy — <title>
Before you continue:
  1. Clear the context (/clear) or start a new session.
  2. Select model <model>, effort <effort>.
  3. Send: Read AGENTS.md, then do task Tyy. Model: <model>. Effort: <effort>. You may push to master when tests pass.
```

**If blocked** (the plan is unclear, something outside the task is broken, a requirement can't be built as written): don't guess and don't quietly build something different. Ask the owner one precise question and stop.

**Never invent work.** Don't write and build your own task in one session. If the owner asks for something with no task, write the task file in the shape of `docs/tasks/_TEMPLATE.md`, add it to the board as **Needs review**, and stop.

## 2. Where the truth lives

- `SPEC.md` (version 4.0) is the design. It is the only source of truth: T30 folded `docs/V4.md` into it.
- `docs/V4.md` is history now. Don't build from it; where it differs from `SPEC.md`, **SPEC wins**.
- `docs/mock/routes-mock.html` is the owner-approved look and Routes layout. Match it.
- `docs/tasks/WORDING.md` governs words on screen.
- `PHASES.md` is history. Don't build from it.

The data model and security rules are exact. If you think one must change beyond what your task says, stop and ask.

## 3. Fixed decisions (do not change)

- **Free, no card, ever.** Firebase **Spark** plan only: Authentication, Firestore, Hosting. Never Cloud Functions, Cloud Storage, Blaze, or any service that asks for payment details.
- Plain HTML, CSS and JavaScript ES modules. No frameworks, no build step, no bundler, no TypeScript, no npm packages in the app.
- Hosting is **Firebase Hosting**, deployed by GitHub Actions on every push to `master` (from T14; before that, GitHub Pages). `master` is the default branch; there is no `main`.
- Sign-in is Google or email and password (from T15), gated by the `allowlist` collection.
- The map is Leaflet 1.9.4 with OpenStreetMap tiles. Never the Google Maps JavaScript API, the Places API, or any API key.
- The only outside services the app calls are Nominatim and the Wikipedia summary API, both from `js/lookup.js`. Everything else is a link the user opens.
- No flight or hotel price APIs, no scraping, no made-up data in the app. Prices come from pasted links or the user.

## 4. Code rules

- Pure logic lives in `js/lib/` with no DOM and no Firebase imports, and gets tests in `tests/`.
- Only `js/firebase.js` imports the Firebase CDN, only `js/store.js` talks to Firestore, only `js/lookup.js` calls `fetch()` for outside services.
- Build DOM with `createElement` and `textContent`. Never put user or database text in `innerHTML`.
- Links from data go through `safeUrl()` and open with `target="_blank" rel="noopener noreferrer"`.
- Update Firestore fields individually (field paths, `arrayUnion`, `arrayRemove`); several people edit at once.
- Live updates must never wipe a form someone is typing in (`SPEC.md` §8).
- Every button does something real and shows pending, success, or a specific error.
- Keep files under about 400 lines (`js/store.js` and `css/styles.css` excepted).
- Style only with the design tokens (V4 §2 once T16 is done). No raw colors except category colors.
- Reuse existing UI pieces (`dialogShell()`, `field()`, `.btn` classes, `<details>`). Don't invent a second way to do something the app already does.
- Phone first. Every screen works at 375 px wide with 44 px tap targets, and at 1280 px.

## 5. Checks (every task)

1. `node tests/run-tests.js` — every test passes.
2. Serve locally (`python3 -m http.server 8000`) and load the page to catch JavaScript errors.
3. You usually can't sign in from your environment. Don't pretend otherwise: list what you verified and hand the owner the task's **Owner check**.

## 6. Token rules

- Don't paste file contents back to the owner. Don't re-read a file you just wrote.
- Summarize failing output (test name and first error line), don't paste logs.
- Keep the final message to the template above.

## 7. If the owner reports a bug

Ask for the exact message or the red text from the browser console. Fix the cause, add a test when the bug is in `js/lib/`, and don't rewrite unrelated code.
