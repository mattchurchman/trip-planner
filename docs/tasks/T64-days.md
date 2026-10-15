# T64 — Days: day chooser and a numbered timeline

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** L
**Depends on:** T63 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Days works one day at a time: a row of date chips picks the day, the map shows its places as numbered pins, and below it the same numbers form a timeline joined by a dotted line. Reordering, removing and the "Not planned" pool move into ⋯ and a sheet, and Export becomes one button that also offers the group's shared map.

## Read (only these)
- `docs/R7.md` §7 "Days", §8 point 4
- `SPEC.md` §7.8 (by section)
- `js/views/days.js` (all, ~370 lines — read in two halves)
- `js/views/daysMap.js` lines 1–80 (pins)
- `js/views/exportSection.js` (all, short)
- `css/styles.css`: Days blocks (`grep -n "day-\|days-\|not-planned\|export-" css/styles.css`)

## Files you may change
- `js/views/days.js`, `js/views/daysMap.js` (pin markup only), `js/views/exportSection.js`, `css/styles.css`, `docs/tasks/WORDING.md` (strings you add)
- If `days.js` would pass ~400 lines, move the timeline into `js/views/dayTimeline.js` (new)

## Do
1. Day chooser per R7 §7 Days (a): existing days as chips in `order`; route dates without a day as dashed chips that create the day (existing add-day logic with that date and the city title rule from `dayplan.js`); **Create days from route** only when there are no days.
2. Selected day: map pins numbered by `dayOrder` (`--forest`, `--on-forest` number); header `h1` per R7; **Walk it** uses the existing walking-route link; ⋯ holds Edit day, Delete day.
3. Timeline rows: number, category icon tile (R7 §5 mapping), name, "Category · neighborhood", vote count; dotted connector between rows; each row's ⋯ holds Move up, Move down, Remove from day (keep the existing `aria-label`s on those actions).
4. **+ Add from not planned · N** opens a sheet listing the pool (Loved first) with **Add** per row.
5. Export: one `download` icon button in the Days header opening a sheet with the existing export content, plus **Open our shared map ↗** when `trip.myMapsUrl` is set.
6. Tapping a pin keeps today's behavior (choose a day / Remove from day).

## Don't
- Change `dayplan.js`, export formats, or walking-route URLs. Add drag-and-drop (SPEC §12).

## Tests
`node tests/run-tests.js` passes. Demo `#/trip/t1/days` at 390 and 1280 px (two screenshots); open the Not planned sheet (one more).

## Done when
One day shows at a time; pins and timeline numbers match; Move up/down and Remove still work from the keyboard.

## Owner check
1. On Days, tap Mon 12: the map and list switch to that day; numbers on the pins match the list.
2. Use ⋯ → Move down on the first place: both the list and the pin numbers update.
3. Tap a dashed date: a new day appears for it.
4. Tap the download button: Export shows, with **Open our shared map** if you added the link.
