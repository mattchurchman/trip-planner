# T26 — Import places from Google My Maps

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T25 · **If it fails twice:** Opus
**Owner steps first:** export one of your My Maps as KML (⋮ → Export to KML/KMZ → tick "Export as KML instead of KMZ") and attach it, so the reader is tested on a real file.

## Goal
Pick a My Maps KML file and its pins become places, grouped by layer, without duplicates.

## Read (only these)
- `docs/V4.md` §6 (import bullet)
- `js/lib/exporters.js` (for the KML shape the app writes), `js/store.js` (`addPlace`)

## Files you may change
- **new** `js/lib/kmlimport.js` + `tests/kmlimport.test.js` (+ a small fixture in `tests/fixtures/`), **new** `js/views/importPlaces.js`, `js/views/mapTab.js` (the button), `js/store.js` (batch add), `css/styles.css`, `docs/tasks/WORDING.md`

## Do
1. `kmlimport.js` (pure, plain string parsing so it runs in Node tests): `parseKml(text)` → `{ layers: [{ name, pins: [{ name, lat, lng, note }] }], error }`. Handle folders as layers, pins outside any folder, CDATA and escaped text, and skip lines and shapes. A file starting with `PK` returns the KMZ message.
2. `findDuplicates(pins, places)`: same name ignoring case and within 50 m.
3. Dialog: choose file → summary per layer (name, pin count, a category select defaulting to Other) → "Add 23 places (4 already here)". Save in batches with `layer`, `stopKey`, and the note.
4. Show the result as a toast and refresh the map.

## Don't
- Upload the file anywhere or support KMZ unzip.

## Tests
The owner's file (trimmed) and a hand-made fixture: two layers, an unfiled pin, a line to skip, special characters, duplicates.

## Done when
All tests pass and the owner's file imports with the right counts.

## Owner check
1. Map → **Import from My Maps** → pick your file. The layer list and counts look right.
2. Add them: pins appear under the right cities.
3. Import the same file again: it says everything is already here.
