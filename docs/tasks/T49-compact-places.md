# T49 — Map places: compact rows that open up; no event dates

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T41 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The places list on the Map tab stays easy to scan with 30+ places: each place is one short row — **category, name, votes** — and tapping it opens the rest. Event dates and the "Events during trip dates" filter are gone; people can use the note instead.

## Read (only these)
- `js/views/places.js` lines 15–47 (filters), 100–150 (filter controls), 178–282 (`renderPlaceRow`, list)
- `js/views/placeForm.js` lines 220–262 (details fields)
- `js/views/days.js` lines 260–272 (the "Happening this day" check)
- `js/lib/votes.js` exports (for the vote summary)
- `SPEC.md` §5.4 places fields (~line 318), §7.7 (~533–538), §7.8 (~564)

## Files you may change
- `js/views/places.js`, `js/views/placeForm.js`, `js/views/days.js` (remove the event line only), `js/store.js` (stop writing `eventStart`/`eventEnd` on new/edited places), `css/styles.css` (place row styles), `SPEC.md` (the lines above)

## Do
1. **Collapsed row** (~56 px, 44 px tap target): category color dot + icon/short label, place name (one line, ellipsis), and a compact vote summary (e.g. ♥2 👍1, plus your own vote highlighted). Nothing else.
2. **Expanded** (tap the row; one open at a time is fine): neighborhood, note, link, the Love/Like/Pass buttons, comments, Show on map, Edit, Delete — the content the big card shows today. Use `<details>` or an `aria-expanded` button, per AGENTS "reuse".
3. Tapping a map pin still scrolls to and **opens** that place's row (keep `focusCard` working).
4. **Remove events:** the filter checkbox and `filters.eventsOnly`, the two date fields in the place form, the "Happening this day" line on Days. Stop writing the fields in `store.js`. Leave existing values in Firestore alone; mark both fields **retired** in SPEC §5.4.
5. Live updates must not collapse a row someone has open (keep open ids in a Set across renders, as Routes does with `openOptionIds`).

## Don't
- Change voting, sorting or the other filters.

## Tests
`node tests/run-tests.js` passes (update any test that expected event filtering). Load locally with no console errors.

## Done when
20 places fit in about two phone screens, and every action still works from the expanded row.

## Owner check
1. Map tab on the phone: places are short rows showing category, name and votes.
2. Tap one: it opens with votes, note, link, comments, Edit. Tap a map pin: its row opens.
3. Add/Edit place no longer asks for event dates; the events filter is gone.
