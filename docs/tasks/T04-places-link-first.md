# T04 — Places: find on Google Maps first

**Model:** Haiku (move to Sonnet if it struggles) · **Depends on:** T01, T02

## Goal
Make adding a place start from Google Maps: a button that opens Google Maps searching for what you typed, then the paste-the-link box, then the details. Also give each place in the list its own **Open in Google Maps ↗** link.

## Why
The owner uses Google Maps to find the real place, then brings it back to the app. The form should follow that order instead of asking for the name and category first.

## Files you may change
- `js/views/placeForm.js` (form order, Find button, "✓ Pin found")
- `js/views/places.js` (Open in Google Maps link on each list row)
- `js/lib/links.js` — add `googleMapsFindUrl(text, city, country)`
- `tests/links.test.js`
- `css/styles.css` — Places section only

## Spec sections
§7.6 (Add place order, location action, list rows), §9.2 (`googleMapsFindUrl`), §9.3 (parsing, already built).

## Do
1. Add `googleMapsFindUrl` exactly as in §9.2.
2. Reorder the Add place form into Step 1 / Step 2 / Step 3 / "Other ways to add a location" as in §7.6. Label each step visibly ("1 · Find it on Google Maps", etc.).
3. Step 1: text box + **Find on Google Maps ↗** (a real `<a target="_blank" rel="noopener noreferrer">` whose `href` updates as you type), plus the one-line instruction.
4. Step 2: the existing Google Maps link input, parsed on `paste` and `input`. On success show "✓ Pin found: <name>". Show parse errors inline, as now.
5. When the Step 1 box has text and the name field is empty, fill the name from it.
6. The Set/Edit location panel for an existing place gets the same Find button prefilled with that place's name.
7. Each list row gets **Open in Google Maps ↗** using the existing `googleMapsOpenUrl`.

## Don't
- Change how links are parsed (`mapsurl.js`), the data saved, or the Search/Place-on-map behavior.
- Change wording outside the Add place form and location panel.

## Tests
In `tests/links.test.js`: `googleMapsFindUrl("tacos", "Lisbon", "Portugal")` → `https://www.google.com/maps/search/?api=1&query=tacos%2C%20Lisbon%2C%20Portugal`; empty text → just the city and country; empty country → no trailing comma; special characters encoded.

## Done when
Tests pass and the form shows the three steps in order on desktop and at 375 px.

## Owner check
1. Open **Add place**. The first thing you see is "Find it on Google Maps".
2. Type "coffee" and press **Find on Google Maps ↗**. Google Maps opens searching for coffee in your destination.
3. Pick a café, copy the address bar, paste it into Step 2. You see "✓ Pin found" and the name fills in.
4. Choose a category and add it. It appears in the list and on the map.
5. Each place in the list has **Open in Google Maps ↗**, and it opens the right spot.
6. On a place, **Edit location** also has the Find button.
