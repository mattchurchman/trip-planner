# T28 — Take the plan to Google Maps

**Tier:** C · **Model:** Haiku · **Effort:** medium · **Size:** S
**Depends on:** T27 · **If it fails twice:** Sonnet
**Owner steps first:** none

## Goal
The export file has a layer per day and a Stays layer, ready to import into My Maps for use on the trip.

## Read (only these)
- `docs/V4.md` §8 (last bullet)
- `js/lib/exporters.js`, `tests/exporters.test.js`, `js/views/exportSection.js`

## Files you may change
- `js/lib/exporters.js`, `tests/exporters.test.js`, `js/views/exportSection.js`, `js/views/days.js` (pass stays in), `docs/tasks/WORDING.md`

## Do
1. `buildTripKml(tripName, places, days, chosenStays)`: one folder per day in order ("Tue 18 May · Florence"), places in day order with category, note, link and Love/Like/Pass summary in the description; a "Stays" folder (name, dates, link); a "Not planned" folder. Skip anything without coordinates.
2. Keep the CSV export working, with the new ranking words.
3. The export card explains the next step in two short lines and links to `help.html#google-maps`.

## Don't
- Change how the file is downloaded.

## Tests
Folder order and names, escaping, stays folder, unplanned folder, items without coordinates skipped.

## Done when
All tests pass.

## Owner check
1. Days → export the map file.
2. In My Maps: **Create a new map → Import** → pick the file. A layer per day appears.
3. Open the Google Maps app → You → Maps: your map is there.
