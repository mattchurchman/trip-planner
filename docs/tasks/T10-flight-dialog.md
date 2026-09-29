# T10 — Add flight dialog reads the whole link

**Model:** Sonnet · **Depends on:** nothing (do T08/T09 first if you like; they don't overlap)

## Goal
Rebuild the **Add flight option** and **Edit flight** dialogs around a pasted Google Flights link. The link fills in the route, dates, stops, airlines, flight numbers and the price Google showed. Save the flights themselves in a new `legs` field.

## Why
The owner copies flights from Google Flights. The link carries far more than the old dialog used, and the first T08 attempt made the dialog longer and messier instead of simpler.

## Already done for you
`js/lib/flightlink.js`, `js/lib/protobuf.js` and `js/lib/airlines.js` are **built and tested against real links** (see `tests/flightlink.test.js`). Use `parseFlightLink`, `stopsLabel`, `legRoute` and `airlineName`. Don't change these files unless a test proves a bug.

## Files you may change
- **new** `js/views/flightForm.js` — move `addFlightFormDialog` and `editFlightFormDialog` out of `flights.js` into this file and rebuild them as one dialog with add/edit modes
- **new** `js/views/itinerary.js` — `renderItinerary(legs, { outboundDetails, returnDetails })`, the OUT/BACK block from the card sketch in SPEC §7.7. Used by this dialog's preview now and by the cards in T11.
- `js/views/flights.js` — import the dialog; pass `legs` through to the store
- `js/store.js` — `addFlight`/`updateFlight` accept and save `legs` (new flights without a link save `legs: []`)
- `css/styles.css` — the flight dialog and the itinerary block only

## Spec sections
§7.7 "Flights" (the **Add flight option dialog** sketch and every bullet under it), §5.4 (`legs`), §9.6 (what each kind of link contains).

## Do
1. Build the dialog **exactly as the §7.7 sketch**, top to bottom: link box + tip line with **Search Google Flights ↗**; the "✓ Read from the link" preview (using `renderItinerary`); an **Edit route and dates** `<details>` holding the from/to city + airport and date fields; then Label, Price you saw, Times (optional: outbound and return, side by side in a `.field-row`), Notes; then Cancel / Add flight.
2. Parse on `paste` and `input`. On success: fill the route/date fields from the link (overwriting their defaults), show the preview, keep the disclosure closed, pre-fill Label and Price per §7.7. On error or no link: hide the preview and open the disclosure. A short link shows its error message right under the link box.
3. Label: pre-fill per §7.7 only while the user hasn't typed in it (track that). Same for Price.
4. Price currency: compare `result.price.currency` with `trip.currency`. Show the matching helper line from §7.7 either way.
5. Save `legs` as `result.legs.map(({ date, segments }) => ({ date, segments }))`, or `[]` when there was no readable link.
6. Edit mode: title "Edit flight", button **Save**, fields filled from the flight, the preview built from `flight.legs`. A newly pasted link re-reads and replaces `legs`, route and dates. It never logs a price itself: the price field only appears in add mode.
7. `itinerary.js`: date as "Sun 17 Jan" (build it from the date string in UTC, so the day doesn't shift); flight numbers as "AS 581" with `title` set to the airline name when known.

## Don't
- Use "Step 1/2/3" headings, new input styles, or a two-column dialog. Use `dialogShell`, `field()`, `.field-row`, `<details>`, and the existing buttons.
- Change the flight **card** (T11), the price panel, or choosing.
- Fetch anything.

## Tests
Add `tests/itinerary-format.test.js` for any pure helpers you create (put them in `js/lib/`), for example the auto-label rule: `[AS, FJ, FJ, NZ]` with 3 stops → "Alaska + 2 more · 3 stops"; `[DL]` nonstop → "Delta · Nonstop"; `[AS, FJ]` → "Alaska + Fiji Airways · 1 stop"; unknown code "ZZ" → "ZZ · Nonstop"; no segments → "Option 3" when the traveler has 2 options.

## Done when
Tests pass; the dialog opens, reads the two sample links from `tests/flightlink.test.js` when pasted (test locally by opening the dialog function in a scratch page if you can't sign in), and matches the sketch at 1280 px and 375 px. `flights.js` is under 400 lines.

## Owner check
1. On Google Flights, pick an outbound **and** return flight until you reach the page showing the final price. Copy the address bar.
2. **Add flight option** → paste. You should see both legs with every stop and flight number, the label filled in (e.g. "Alaska + 2 more · 3 stops"), and the price with "Google showed $… — check it's still right."
3. Add it. Paste a link copied from the **search results** page instead: route and dates fill in, no stops or price.
4. Paste a **Share** link: it asks for the address-bar link.
5. With no link, open **Edit route and dates** and add a flight by hand.
6. **Edit** a flight and paste a different link: the route updates.
