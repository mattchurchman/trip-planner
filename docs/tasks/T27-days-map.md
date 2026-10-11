# T27 — Plan days on the map

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** T25 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Days are created from the chosen route, and places are put on days by tapping pins.

## Read (only these)
- `docs/V4.md` §8 (Days bullet)
- `js/views/days.js`, `js/lib/route.js` (`stopsFor` return shape)

## Files you may change
- `js/views/days.js`, **new** `js/views/daysMap.js`, **new** `js/lib/dayplan.js` + `tests/dayplan.test.js`, `css/styles.css`, `docs/tasks/WORDING.md`

## Do
1. `dayplan.js` (pure): `daysFromStops(stops)` → one `{ date, cityKey, title }` per date (a travel day belongs to the city you arrive in); `missingDays(existingDays, wanted)` so the button never duplicates.
2. **Create days from route** replaces "create from dates" when an option is chosen.
3. Selecting a day shows its city's places on the map: pins already on that day are numbered in order, pins on other days carry that day's color, unplanned pins are plain.
4. Tapping a pin opens a small sheet: the place name, its Love/Like/Pass summary, and one button per day in that city, plus Remove from day.
5. Keep the list controls (reorder, remove) and the walking-route links. Loved places not yet planned are listed first under "Not planned".

## Don't
- Add drag and drop.

## Tests
Days from the Rome / Florence / Barcelona route; a zero-night pass-through; no duplicates when run twice.

## Done when
All tests pass; assigning from the map updates the list live; works at 375 px.

## Owner check
1. Days → **Create days from route**: one day per date, titled with the city.
2. Pick a day, tap a pin, choose that day: it joins the list and gets a number.
3. Open the day's walking route: Google Maps opens with the stops in order.
