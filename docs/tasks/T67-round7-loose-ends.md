# T67 — Round 7 loose ends: two emoji, a raw color, three missing pending states

**Tier:** C · **Model:** Sonnet · **Effort:** medium · **Size:** S
**Depends on:** T66 · **If it fails twice:** Opus, medium
**Owner steps first:** none

## Goal
Five small spots that Round 7 missed are brought in line with `SPEC.md` §4 and `AGENTS.md` §4. Nothing changes about what any screen does or says beyond swapping two emoji for the matching icons. The T66 review found all five by reading the code; each one below names its file and line.

## Read (only these)
- `SPEC.md` §4 — the "Icons" paragraph and the "Components" bullet on buttons (grep for `**Icons.**` and `.btn-danger`)
- `AGENTS.md` §4
- `js/ui.js` — `setPending()` (around line 69), `icon()` and `menuButton()` only; don't read the file whole
- The five spots named under **Do**

## Files you may change
- `js/views/daysMap.js`, `js/views/pricePanel.js`, `js/views/stayForm.js`, `js/views/stays.js`, `js/views/sharedLinks.js`, `js/views/dayTimeline.js`
- `css/styles.css` only if a swapped icon needs a class to sit right next to its text

## Do
1. **`js/views/daysMap.js:67`** — the "Remove from day" button in the map-pin popup is `btn btn-small btn-danger`. After T58, `.btn-danger` is only used inside a confirmation dialog (`SPEC.md` §4, Buttons). Drop `btn-danger` so it's an ordinary small button. The popup is the one place a place leaves a day from the map, and it already closes the dialog on success — don't add a confirmation, just change the class.
2. **`js/views/pricePanel.js:29`** — the sparkline's `stroke` is the raw hex `#1a73e8`, left over from the pre-Waypoint palette. Use the forest token instead. An inline SVG attribute can't read a CSS variable, so set the stroke to `currentColor` and give `.sparkline` `color: var(--forest)` in the stylesheet, which is also how `icon()` already picks up its color.
3. **Two emoji that survived T56** (`SPEC.md` §4: "No emoji anywhere"). Replace each with `icon("place", { size: 14 })` before the text, the same way `externalLink()` in `ui.js` puts its arrow after the text:
   - `js/views/stayForm.js:71` — `"📍 Pin set "` in `updateStatus()`. Keep the `clearBtn` after it.
   - `js/views/stays.js:230` — `"📍 On the map"` on the `onMapBtn`.
4. **Three buttons that show an inline error but no pending state** (`AGENTS.md` §4: every button shows pending, success, or a specific error). Each one `await`s a write with nothing happening on screen meanwhile, so a slow connection looks like a dead button. Wrap each with the existing `setPending(button, true)` / `setPending(button, false)` from `js/ui.js` in a `try`/`finally`, leaving the existing `catch` and its inline error alone:
   - `js/views/sharedLinks.js` — `openEdit()` and `handleRemove()`, both in `sharedLinkRow()`. The button to put pending is the **Add link** button for an unset row; for a set row the work starts from a ⋯ menu item, so put the pending state on the row's own trailing control or disable the menu trigger while it saves — whichever reads better; say which you chose.
   - `js/views/dayTimeline.js` — the per-row **Add** button in `openNotPlannedSheet()`.
   - `js/views/daysMap.js` — the **Remove from day** button from step 1, and the day buttons above it if they have the same gap.
5. Leave `js/ui.js` (475 lines) and `js/views/routes.js` (474 lines) alone. T66 flagged both as over the ~400-line guide; "about 400" covers them and splitting a file for five lines is churn with no gain.

## Don't
- Don't change any wording on screen, any layout, or anything about what a button does.
- Don't add a confirmation dialog anywhere, or remove one.
- Don't touch `SPEC.md` — this task brings the code to the spec, not the other way round.

## Tests
`node tests/run-tests.js` passes. These are all view files, so there's nothing new to unit-test; serve locally and load the page to catch JavaScript errors.

## Done when
No `.btn-danger` outside a confirmation dialog, no emoji and no raw hex left in `js/views/`, and each of the three buttons shows a pending state while it saves.

## Owner check
1. On the Days tab, tap a pin and check that **Remove from day** is no longer red and still works.
2. On the Map tab, open a stay with a pin: the line reads "On the map" with a small pin icon, not an emoji.
3. Add a stay and check the "Pin set" line in the dialog looks right.
4. On Overview, add or change the **Our My Maps** link and watch the button while it saves — it should say "Saving…" rather than sitting there looking untapped.
5. Check a flight price with two or more entries and confirm the little price graph is green, not blue.
