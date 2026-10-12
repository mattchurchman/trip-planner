# T38 — Stays: merged stops, stays find their stop, Choose button

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** T35 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Stays group under the merged route's stops without the user doing anything. A stay added from the top lands under the right stop. Every stay with a location shows as a price pin. The **Chosen** dropdown is replaced by buttons that match Routes.

## Read (only these)
- `SPEC.md` §7.7 Stays (as changed by T35)
- `js/views/stays.js`, `js/views/stayForm.js` (search `stopKey`), `js/views/mapTab.js` (search `stay`), `js/lib/stops.js`, `js/lib/coverage.js`, `js/lib/choices.js` (`mergeStops`)

## Files you may change
- `js/views/stays.js`, `js/views/stayForm.js`, `js/views/mapTab.js`, `js/lib/stops.js` (+ `tests/stops.test.js`), `js/lib/coverage.js` (+ tests), `css/styles.css`, `SPEC.md` §7.7, `docs/tasks/WORDING.md`

## Do
1. New pure helper `stopForStay(stay, mergedStops, cities)`: the stop whose dates contain the stay's check-in; else the nearest stop within 150 km of its pin; else `null`. Use it on save when `stopKey` is empty, and on render for stays whose `stopKey` no longer matches.
2. Night cells show how many travelers are there that night ("2 of 3"); coverage is complete when each night has a chosen stay.
3. Replace the status `<select>` with a **Choose** / **Chosen** toggle and an **Out** toggle (`.btn` styles, 44 px).
4. Stay card: **Who's this for?** like T36, defaulting to automatic.
5. Find why a located stay can miss the map: check the Stays switch, stop-chip filtering of stays with `stopKey: null`, and pins re-rendering after save. Fix the cause; a stay without a location shows "No map pin · Set location".

## Don't
- Change how stays are priced or parsed.

## Tests
New `stopForStay` and coverage tests pass, plus all others.

## Done when
A stay added from the top with dates inside a stop appears under that stop and on the map.

## Owner check
1. **Add stay** from the top with dates inside a stop and a location: it lands under that stop and shows a price pin.
2. Tap **Choose**: it turns teal on the map; the night cells fill.
3. No dropdown on stay cards.
