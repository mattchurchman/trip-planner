# T25 — One Map tab for places and stays

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** L
**Depends on:** T22, T24 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Places and stays share one map and one tab, filtered by stop. The tab order becomes Overview, Routes, Map, Days.

## Read (only these)
- `docs/V4.md` §8 (Map tab bullet), §6 (pins and `stopKey`)
- `js/views/places.js` (map setup and list rendering), `js/views/staysMap.js`, `js/lib/staypins.js`, `js/views/travel.js`, `js/app.js` (`TABS`)

## Files you may change
- **new** `js/views/mapTab.js`, **new** `js/lib/stops.js` + `tests/stops.test.js`
- `js/views/places.js`, `js/views/placeForm.js`, `js/views/stays.js`, `js/views/staysMap.js`, `js/store.js`, `js/app.js`, `css/styles.css`, `docs/tasks/WORDING.md`
- delete `js/views/travel.js` once nothing imports it

## Do
1. `stops.js` (pure): `nearestStop(lat, lng, cities, maxKm = 150)` → `stopKey | null`; `stopChips(chosenStops, allCities)`.
2. Set `stopKey` when a place or stay is saved with coordinates. For existing ones without it, work it out when displaying (don't mass-write).
3. `mapTab.js`: one Leaflet map with place pins (category color; Loved larger with a ring; Pass-only dimmed) and stay price pins. Stop chips filter both and fit the map to that stop. A Places / Stays switch changes the list under the map (beside it from 760 px). Tapping a pin scrolls to and highlights its card.
4. Places stop filtering by `destinationId`. Add the clipboard paste helper beside the Google Maps link box.
5. Tabs: remove Places and Stays, add Map. Old links `#/trip/x/places` and `/travel` go to Map.

## Don't
- Build import (T26) or change Days (T27).
- Create a second Leaflet map on this tab.

## Tests
`nearestStop` picks the closest city, returns null beyond 150 km, handles missing coordinates; chip order follows the route.

## Done when
All tests pass; both pin types show together; no console errors; files under 400 lines (split if needed).

## Owner check
1. Map shows your places and stay prices together.
2. Tap a city chip: the map zooms there and both lists narrow.
3. Add a place by pasting a Google Maps link: it appears under the right city without you choosing one.
