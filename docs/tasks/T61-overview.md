# T61 — Overview: summary first, settings behind a tap

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** L
**Depends on:** T59 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Overview opens on a green summary card — the route as a dotted ribbon, your total, the group total and the countdown — then travelers as chips, a compact budget with split costs folded in, the shared links, and the latest comment. Trip name and dates are edited in a sheet, not shown as a form at the top.

## Read (only these)
- `docs/R7.md` §6 (route ribbon, rows, topo), §7 "Overview"
- `SPEC.md` §7.5 and §11 "Budget"/"at least" rules (by section)
- `js/views/overview.js` (all, ~280 lines)
- `js/lib/choices.js` exports `mergedStops`, `tripBudget`, `travelerBreakdown` (signatures only: `grep -n "^export function" js/lib/choices.js`)
- `js/views/travelers.js` and `js/views/splitCosts.js`: exported function signatures and the render entry points only
- `css/styles.css`: Overview blocks (`grep -n "overview\|budget\|traveler-card\|split-cost" css/styles.css`)

## Files you may change
- `js/lib/ribbon.js` (new) + `tests/ribbon.test.js` (new)
- `js/ui.js` (`routeRibbon`), `js/views/overview.js`, `js/views/travelers.js` (chip rendering only; the Edit sheet is unchanged), `js/views/splitCosts.js` (row rendering only), `css/styles.css`
- `SPEC.md` §7.5 (describe the new order)

## Do
1. `ribbon.js`: `ribbonStops(mergedStops, airports)` → `[{ code, label, nights }]` with home first/last flagged; >5 stops → first 4, `{ more: N }`, home. Tests: none, one, five, seven stops; a city visited twice appears twice.
2. `routeRibbon(stops, { onDark })` in `ui.js` per R7 §6.
3. Rebuild Overview in R7 §7's order: summary card (with stage chip moved here, "No route chosen yet" state linking to Routes), Travelers chips (tap → existing Edit sheet; **+ Add** keeps current add flow), Budget card (traveler rows keep their `<details>` breakdown; split costs become a collapsible row group in the same card, each cost a row with its ⋯), Shared links card (from T59), latest comment row opening the existing thread.
4. **Edit trip** (quiet link under the summary card) opens a sheet with name, start, end, using the existing validation and save logic.
5. "Your total" uses the signed-in user's traveler, else the first traveler; keep every "at least" and missing-price rule.

## Don't
- Change budget math, traveler editing, split-cost logic or comment behavior. A live update must never close an open sheet or wipe typing (SPEC §8).

## Tests
`node tests/run-tests.js` passes. Demo `#/trip/t1/overview` at 390 and 1280 px, light and dark (four screenshots max).

## Done when
The page's first screen on a phone shows the summary card and travelers without scrolling; no form fields are visible until **Edit trip** is tapped.

## Owner check
1. Open a trip: the green card shows your route as dots (DEN → ROM → BCN …) with nights, your total and the group total.
2. Tap **Edit trip**: change the end date, Save, and it updates.
3. Tap a traveler chip: their Edit sheet opens as before.
4. Open Split costs inside Budget: each cost has a ⋯ with Edit and Delete.
