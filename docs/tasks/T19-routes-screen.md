# T19 — Routes tab

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** L
**Depends on:** T16, T18 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
A new **Routes** tab shows ideas, each traveler's flights from home, and options with their stops, nights and totals, laid out like the mock.

## Read (only these)
- `docs/V4.md` §4.1, §4.2, §4.6
- `docs/mock/routes-mock.html` (the script's `render` function shows the structure)
- `js/store.js` (the flights functions and `TRIP_SUBCOLLECTIONS`), `js/views/flights.js`, `js/app.js` (`TABS`)

## Files you may change
- `js/store.js` (ideas and options: watch, add, update, delete; `setChosenOption`; `setFlightPicked`; add both collections to `TRIP_SUBCOLLECTIONS`)
- **new** `js/views/routes.js`, **new** `js/views/routeRail.js`
- `js/app.js` (add the tab after Overview), `css/styles.css` (a Routes section), `docs/tasks/WORDING.md`

## Do
1. Traveler switch and idea switch (segmented controls). Remember the selection per trip in memory, not in the database.
2. Home-flights card for the selected traveler: each alternative with route, dates, airline line, price, and **Use this** / **Using**.
3. Option cards: name, total ("at least" when incomplete), path line, Chosen and Cheapest badges, expandable rail of stops and flights with warnings on the stop they belong to. **Choose this option** / **Unchoose**.
4. Rename and delete for ideas and options (deleting asks first and deletes their flights). **+ Idea** and **+ Option** create empty ones with a name.
5. Each flight has Edit (the existing flight dialog) and Delete. Show the price with the existing price summary for now; T21 replaces it.
6. Use `renderWhenIdle` so live updates don't close what someone has open.

## Don't
- Build pasting (T20) or the new price control (T21).
- Remove the old Flights & stays tab yet.

## Tests
Existing tests pass. Any new pure helper goes in `js/lib/` with a test.

## Done when
With no ideas the tab shows a clear empty state pointing at **Paste flight link** (the button arrives in T20; until then **+ Idea**). No console errors at 375 px and 1280 px.

## Owner check
1. Open a trip → **Routes**. Add an idea and an option by hand, add a flight with the old dialog.
2. The option shows stops with nights and a total.
3. Choose the option: the Chosen badge appears and survives a refresh.
