# T12 — Add stay dialog with "Where is it?"

**Model:** Sonnet · **Depends on:** T11

## Goal
Rebuild the **Add stay** and **Edit stay** dialogs to lead with the pasted link, like flights, and give every stay an easy way to get a map pin: look up its name, or paste a Google Maps link.

## Why
The price-pin map (T13) only works if stays have pins. Booking, Airbnb and Google Hotels links don't contain an address, and the app mustn't download the listing page, so the dialog has to make pinning a one-click step.

## Files you may change
- **new** `js/views/stayForm.js` — move both stay dialogs and `buildLocationDisclosure` out of `stays.js` into it, then rebuild them as one dialog with add/edit modes
- `js/views/stays.js` — import the dialog; **Set location** opens the edit dialog focused on **Where is it?**
- `js/lookup.js` — only if `nominatimSearch` needs a small change to search "<name>, <city>, <country>"
- `css/styles.css` — the stay dialog section only

## Spec sections
§7.7 "Stays" (the **Add stay dialog** sketch and bullets), §9.3 (reading Google Maps links: reuse `parseGoogleMapsUrl`), §9.4 (Nominatim: only on button press, one request a second), §9.2 (`googleMapsFindUrl`), §9.6 (`parseStayLink`).

## Do
1. Build the dialog **exactly as the §7.7 sketch**: link box, the "Don't have one yet?" search links, the "✓ Read from the link: …" line, then Name, Price you saw (total), Check-in / Check-out / Guests in one `.field-row`, Neighborhood, **Where is it?**, Note, then Cancel / Add stay.
2. **Where is it?**
   - A status line: "📍 Pin set" with a quiet **Clear**, or "No pin yet — you can add one later."
   - **Find "<name>" on the map**: disabled while Name is empty. When pressed, search Nominatim and list up to 5 results as buttons (the `display_name`). Picking one sets the pin and collapses the list. Show "Search results from OpenStreetMap" under the list. On no results: "Nothing found — try a Google Maps link instead."
   - **Paste a Google Maps link** (`<details>`): a link input read with `parseGoogleMapsUrl` on paste/input, plus **Find on Google Maps ↗** (`googleMapsFindUrl(name, city, country)`).
   - For Airbnb links, a muted hint: "Airbnb shows the exact spot only after booking — pin the neighborhood for now."
3. The price field and first price entry work as they do now (add mode only).
4. Edit mode: title "Edit stay", button **Save**, everything filled in from the stay. Opening it from **Set location** scrolls to **Where is it?** and focuses the Find button.
5. `stays.js` ends under 400 lines.

## Don't
- Fetch the stay's page, or try to read an address from the link.
- Use "Step" headings or new input styles (see CLAUDE.md "Reuse the app's UI patterns").
- Change the stay card beyond wiring **Set location**.

## Tests
No new pure logic is expected. If you add some (for example building the Nominatim query), put it in `js/lib/` with tests. `node tests/run-tests.js` passes.

## Done when
The dialog matches the sketch at 1280 px and 375 px, and adding a stay by name lookup sets `lat`/`lng`.

## Owner check
1. **Add stay** → paste a Booking.com hotel link. Name, dates and guests fill in.
2. Press **Find "<hotel name>" on the map** and pick the right result. It says "📍 Pin set".
3. Add an Airbnb link. It asks for the name and suggests pinning the neighborhood. Use **Paste a Google Maps link** to pin it.
4. On a stay with no pin, **Set location** opens the dialog at **Where is it?**.
5. Save a price in the dialog and it shows on the card.
