# T13 — Stays price-pin map

**Model:** Sonnet · **Depends on:** T12

## Goal
Add a map at the top of the Stays section. Each stay appears as a numbered price pin ("③ $180"), and the group's top-ranked places appear as small dots, so everyone can see which stay is close to what they want to do.

## Why
The owner wants to compare stays the way Google Maps and Airbnb show them: by where they are and what they cost.

## Files you may change
- **new** `js/views/staysMap.js` — `createStaysMap(container, { onPinClick })` returning `{ update(stays, places, trip), focusStay(stayId), destroy() }`
- `js/views/stays.js` — mount the map above the cards, pass it stays and places, make "📍 On the map" call `focusStay`, and handle pin clicks (scroll + highlight the card)
- `js/views/travel.js` — only to start or stop a places listener for the tab if the stays section doesn't already have places (follow §8: one listener, unsubscribed when leaving the tab)
- **new** `js/lib/staypins.js` and **new** `tests/staypins.test.js`
- `css/styles.css` — the stays map section only

## Spec sections
§7.7.1 (every bullet), §7.7 stay **number** rule (reuse T11's helper), §7.3 (rank score, for "top places"), §11 (per night), §4 (tokens, category colors via `categories.js`).

## Do
1. `staypins.js` (pure):
   - `stayPinLabel({ number, latestCents, nights, currency })` → "③ $180", "③ $1,260 total" or "③". Per night is rounded to whole units, formatted with the trip currency.
   - `topPlaces(places, destinationId)` → the located places for that destination with rank score ≥ 2.
2. Pins: `L.marker` with `L.divIcon({ html: pillElement, className: "stay-pin-icon", iconSize: null })`. Build `pillElement` with `el()`/`textContent`, never an HTML string. Chosen stays get the `stay-pin-chosen` class.
3. Top places: `L.circleMarker`, radius 5, category color, name as tooltip. Put them in a layer group that the "Show our top places" checkbox (checked by default) adds or removes.
4. Fit bounds per §7.7.1, including the "don't refit for 30 s after the user moves the map" rule (listen to `movestart` from user interaction, i.e. not while your own `fitBounds` is running).
5. Pin click → `onPinClick(stayId)` → scroll the card into view and add the existing highlight class for 1.5 s. "📍 On the map" → `focusStay(id)` pans there and adds a short pulse class to the pill.
6. No located stays: hide the map and show the one-line note.
7. Clean up on tab exit: `map.remove()` and the listener unsubscribe.

## Don't
- Put the stay name or any user text into an HTML string.
- Change the Places tab's map.
- Add price pins anywhere but this map.

## Tests (`tests/staypins.test.js`)
- `stayPinLabel`: $1,260 over 7 nights → "③ $180"; $1,000.01 over 3 nights → "① $333"; nights unknown → "② $1,260 total"; no price → "④"; EUR formats with €.
- `topPlaces`: excludes other destinations, unlocated places, and scores below 2; includes a place with one Must.

## Done when
Tests pass; the map shows at 1280 px and 375 px; pins and cards are linked both ways.

## Owner check
1. Give two or three stays a pin and a price. The map at the top of Stays shows "① $180"-style pins.
2. Choose a stay. Its pin turns teal.
3. Click a pin. The page scrolls to that stay's card and highlights it. Click "📍 On the map" on a card, and the map moves to its pin.
4. Your top-ranked places show as small colored dots. Untick "Show our top places" and they disappear.
5. Pan the map, then have a friend add a price. The map doesn't jump back.
6. On your phone the map is shorter and the pins are readable.
