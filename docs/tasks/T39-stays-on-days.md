# T39 — Chosen stays on the Days map and walking routes

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** T38 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
On Days, the chosen stay for the selected day's night shows as a home pin, and **Open walking route** starts and ends there, so building a day's route starts from where you sleep.

## Read (only these)
- `SPEC.md` §7.8, §9.2
- `js/views/days.js`, `js/views/daysMap.js`, `js/lib/dayplan.js`, `js/lib/links.js` (search `walking`), `js/lib/staypins.js`

## Files you may change
- `js/views/days.js`, `js/views/daysMap.js`, `js/lib/dayplan.js` (+ tests), `js/lib/links.js` (+ `tests/links.test.js`), `css/styles.css`, `SPEC.md` §7.8, `docs/tasks/WORDING.md`

## Do
1. Pure `stayForDate(date, chosenStays)`: the chosen, located stay whose nights include that date (or the night before, for a departure day); `null` otherwise.
2. Days map: draw it with the stay pill style plus a house mark; its popup names it.
3. **Open walking route**: origin and destination are the stay when there is one, waypoints are the day's places in order. With no stay, current behavior.
4. Undated days: no stay.

## Don't
- Add drag-and-drop or change the KML export.

## Tests
New `stayForDate` and walking-route link tests pass, plus all others.

## Done when
A dated day inside a chosen stay shows its pin and the route starts and ends there.

## Owner check
1. Choose a stay with a location. On Days pick a date it covers: the house pin shows.
2. **Open walking route**: Google Maps starts and ends at the stay.
