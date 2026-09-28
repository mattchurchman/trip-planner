# T01 — Split big files, one place for outside lookups

**Model:** Sonnet · **Depends on:** nothing

## Goal
Break the oversized view files into the smaller files listed in SPEC §3.1, and move all `fetch()` calls into a new `js/lookup.js`. **Nothing changes for the user**: every screen looks and behaves exactly as before.

## Why
`places.js` (766 lines), `travel.js` (745) and `overview.js` (496) are too big for a model to change safely, and the next five tasks all edit them. Nominatim is currently called from two different views with duplicated code.

## Files you may change
- `js/views/overview.js` → keeps travelers, trip details and Discover; candidates move to **new** `js/views/candidates.js`
- `js/views/places.js` → keeps the list, filters and map; the add/edit form and location picker move to **new** `js/views/placeForm.js`
- `js/views/travel.js` → keeps the tab shell, shared costs and totals card; flights move to **new** `js/views/flights.js`, stays to **new** `js/views/stays.js`, the price panel to **new** `js/views/pricePanel.js`
- **new** `js/lookup.js` — one `nominatimSearch(query)` (with the one-request-per-second limit from SPEC §9.4) used by both overview and places. Leave room for T03's Wikipedia lookup, but don't write it.

## Spec sections
§3.1 (file layout), §8 (listeners and forms), §9.4 (Nominatim).

## Do
- Move code; don't rewrite it. Keep function names where you can. Pass what a moved piece needs (trip, uid, map, callbacks) as arguments rather than using globals.
- Keep listener setup and cleanup exactly as it works now: every `onSnapshot` still unsubscribes when you leave the tab.
- Every file ends under ~400 lines (store.js and styles.css excepted).

## Don't
- Change any wording, styling, layout or behavior.
- Change `js/lib/`, `store.js` or the tests (except to import from new paths if needed).

## Tests
No new logic, so no new tests. `node tests/run-tests.js` must still pass.

## Done when
- The files above exist, each under ~400 lines, and `grep -rn "fetch(" js/` finds only `js/lookup.js`.
- Tests pass, the site loads locally with no console errors, and you've clicked each tab that doesn't need sign-in data as far as you can.

## Owner check
1. Open each tab of an existing trip. Everything looks and works the same as before.
2. On Places, add a place with **Search** — results still appear.
3. On Overview, choose a destination that has no coordinates — it still finds the city.
4. Add a flight option and a stay, log a price on each — all still works.
