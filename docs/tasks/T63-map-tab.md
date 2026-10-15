# T63 — Map: shared map bar, filters in a sheet, sticky map

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T59 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The Map tab opens on the map and the list, not on a wall of filters. A slim bar under the stop chips holds the group's shared My Maps link — **Open**, **Get KML** and **Import** — so importing the shared map is two taps. Filters live behind one **Filters** button, and on a computer the map stays in view while the list scrolls.

## Read (only these)
- `docs/R7.md` §7 "Map", §8
- `js/views/mapTab.js` lines 71–160 (layout, import button)
- `js/views/places.js` lines 46–140 (filters and sort UI)
- `js/views/importPlaces.js` lines 41–60 and 110–130 (title and instructions)
- `js/views/sharedLinks.js` (T59: `editLinkSheet` signature)
- `css/styles.css`: Map tab layout (`grep -n "Map tab layout" css/styles.css`, that block to the next comment), places filter rules (`grep -n "places-filters\|filter-" css/styles.css`)

## Files you may change
- `js/views/mapTab.js`, `js/views/places.js` (filters/sort UI only), `js/views/importPlaces.js` (instructions only), `css/styles.css` (Map tab rules), `docs/tasks/WORDING.md` (strings you add)

## Do
1. Shared map bar per R7 §8 point 2 (set and unset states), between the stop chips and the Places/Stays switch. **Add link** opens T59's `editLinkSheet`. Remove the old standalone **Import from My Maps** button.
2. Import dialog: when `trip.myMapsUrl` parses, show the two-step instructions with a **Get KML from our map ↗** link (`kmlUrl`); move the current ⋮ → Export text into a "Not working?" `<details>`.
3. Places toolbar: **Add place** (primary) + **Filters** (secondary, shows "Filters · 2" when two are active) + the search box on one row (wrapping on phones). **Filters** opens a sheet with category chips, neighborhood, "I haven't ranked yet" and sort; changes apply live; **Done** closes. Filter state behavior unchanged.
4. From 760 px: map `position: sticky` beside the list, top offset below the top bar.

## Don't
- Change filter logic, stays, pins, or the importer's parsing.

## Tests
`node tests/run-tests.js` passes. Demo `#/trip/t1/map` at 390 and 1280 px (two screenshots); with the seed's link set, open Import and check the two-step text (one screenshot).

## Done when
The first screen on a phone shows the shared map bar, the switch, the toolbar and the first places; the filter chips are only in the sheet.

## Owner check
1. Map tab: the bar shows "Our shared map" with **Open**, **Get KML** and **Import**.
2. Tap **Get KML**: a `.kml` file downloads (if Google shows a page instead, tell the agent — that link format may have changed). Then **Import** → pick that file → the places come in as before.
3. Tap **Filters**, pick Food: the list shows only food, and the button reads "Filters · 1".
4. On a computer, scroll the list: the map stays put.
