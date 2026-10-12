# T46 — Night math: the idea city ends at the first hop, and a return visit is its own stop

**Tier:** A · **Model:** Opus · **Effort:** high · **Size:** M
**Depends on:** T40 · **If it fails twice:** stop and ask the owner
**Owner steps first:** none

## Goal
Stays, coverage bars and Days show the nights people actually sleep in each city. Once a traveler has chosen an option, they sleep in the idea's arrival city only until that option's first hop flight leaves (owner's rule, 2026-10-12). A city visited twice is two stops with their own dates, not one stop stretched over the whole trip.

## Likely cause (prove it with a test first)
`mergeStops` in `js/lib/choices.js` merges by `cityKey` and takes `from` = earliest, `to` = latest. On a trip like DEN→**LIS** Oct 1, hop LIS→OPO Oct 2, hop OPO→**LIS** Oct 14, home LIS→DEN Oct 15, the two Lisbon visits merge into one stop **Oct 1 → Oct 15**, so the Stays group, its default check-in/out and the Days "create from route" all treat Lisbon as the whole trip. `nights[]` per date is still right, which is why things "almost" line up.

Also confirm `stopsFor` (`js/lib/route.js` ~159) closes the arrival stop at the first hop's date (0 nights when the hop is the same day) and that nothing re-extends it.

## Read (only these)
- `js/lib/route.js` lines 100–195
- `js/lib/choices.js` lines 105–185
- `js/lib/coverage.js`, `js/lib/dayplan.js` lines 1–60, `js/lib/stops.js` lines 40–98
- `tests/choices.test.js`, `tests/route.test.js`, `tests/coverage.test.js` (to copy their style)
- `SPEC.md` §11 "Merged stops", by section
- `js/views/stays.js` lines 20–45 (`groupByStop`) — read only, to see what keys it relies on

## Files you may change
- `js/lib/choices.js`, `js/lib/route.js`, `js/lib/coverage.js`, `js/lib/dayplan.js`, `js/lib/stops.js`, their tests, `SPEC.md` §11
- `js/views/stays.js`, `js/views/days.js`, `js/views/mapTab.js` **only** where they read a merged stop's key, if the key changes

## Do
1. Write failing tests for the trip above (one traveler, and two travelers where only one returns to Lisbon). Expected merged stops: Lisbon Oct 1–2 (1 night), Porto Oct 2–14, Lisbon Oct 14–15 (1 night).
2. Change merging so stops merge only when the visits overlap or touch in time (same city, overlapping/adjacent date ranges across travelers). Separate visits become separate stops in route order. Give each a stable `stopKey` (e.g. `cityKey` for the first visit, `cityKey#2` for the second) so existing saved `stopKey`s on stays keep matching the first visit.
3. Make `stayStopKey`/`stopForStay` pick the visit whose dates contain the stay's check-in, then fall back to the first visit.
4. Undated stops keep today's behavior (merge by city, placed last).
5. Update SPEC §11 "Merged stops" in plain words.

## Don't
- Change the data model, security rules, or how stopsFor names cities.
- Restyle any screen.

## Tests
`node tests/run-tests.js` passes, including the new cases. Existing tests may only change where they asserted the old whole-trip merge; say which in the final message.

## Done when
The Lisbon example produces three stops with the dates above, and stays/days/map still group correctly for trips without a return visit.

## Owner check
1. On your test trip, Map → Stays: the idea city's group shows only the nights before the first hop (and a separate group if you come back to it).
2. Days → Create days from route: no day is filed under the idea city after you've left it.
