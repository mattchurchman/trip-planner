# T05 — Flights & stays: paste a link first

**Model:** Sonnet · **Depends on:** T01, T02

## Goal
Make **Add flight option** and **Add stay** start from searching and pasting a link. The link fills in whatever it contains, and you can enter the price you saw in the same form.

## Why
The owner finds flights and stays on Google Flights, Booking.com and Airbnb. Pasting the link should do most of the typing. Today the link field sits halfway down the form.

## What a link can and can't fill in (tell the owner this)
- **Google Flights link:** airports and dates. Not the price, airline or times — Google doesn't put them in the address.
- **Booking.com:** hotel name, dates, guests. **Airbnb:** dates and guests, not the listing name. **Google Hotels:** sometimes the name.
- Prices are always typed by hand (SPEC §2: no scraping).

## Files you may change
- **new** `js/lib/flightlink.js` and **new** `tests/flightlink.test.js`
- `js/lib/staylink.js` (add Google Hotels `q` → name, and provider `other` for other valid links) and `tests/staylink.test.js` (exists; add cases)
- `js/views/flights.js`, `js/views/stays.js` (form order, parsing, "Price you saw")
- `js/store.js` — let `addFlight` / `addStay` accept an optional first price entry
- `css/styles.css` — Flights & stays section only

## Spec sections
§7.7 (both forms), §7.8 (price entry rules), §9.6 (link parsing), §11 (money parsing).

## Do
1. `parseFlightLink(text)` exactly as in §9.6, including the error messages.
2. Reorder both add forms into Step 1 / Step 2 / Step 3 as in §7.7, with visible step labels.
3. Parse on `paste` and `input`. Fill only fields that are empty or still hold their pre-filled defaults (track the defaults you set). Show the "✓ Filled in: …" line naming what was filled, plus what the link can't provide.
4. "Price you saw": optional; parsed with the existing money parser; must be > 0. When valid, create the document with `prices: [ { id, amountCents, checkedAt, byUid, note: "" } ]` in the same write. When invalid, show the money error and don't save.
5. Stays: move the stay's own map-location input under an "Other ways to add a location" disclosure.

## Don't
- Fetch the linked page, or add any price lookup.
- Change the price panel, totals, or how "Choose" works (T06 does that).

## Tests
`tests/flightlink.test.js`:
- This `tfs` link reads DEN → LIS, out 2026-03-10, back 2026-03-17:
  `https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTAzLTEwagcIARIDREVOcgcIARIDTElTGh4SCjIwMjYtMDMtMTdqBwgBEgNMSVNyBwgBEgNERU5AAUgBcAGCAQsI____________AZgBAQ&hl=en`
- A one-way `tfs` (build one: base64url of bytes containing `2026-05-01`, `SFO`, `NRT`) → return date `null`.
- Our own `?q=Flights from DEN to LIS on 2026-03-10 returning 2026-03-17` link; and one with city names instead of codes → airports `null`, dates read.
- `/travel/flights/s/abc123` → short-link error. Non-Google URL and plain text → "doesn't look like" error. Garbage `tfs=!!!` → "Couldn't read" error, no throw.

`tests/staylink.test.js`: Booking.com name/dates/guests; Airbnb dates/guests with `name: null`; Google Hotels with `q`; another site → provider `other`.

## Done when
Tests pass; both forms show the three steps on desktop and at 375 px.

## Owner check
1. Under your name, open **Add flight option** and press **Search Google Flights ↗**. Pick a flight on Google, copy the address bar, paste it into Step 2. The airports and dates fill in and it tells you what to add by hand. (If it says it couldn't read your link, send the link to the model — it's a useful test case.)
2. Type the price you saw, add the airline and times, save. The option appears with that price already logged.
3. **Add stay:** paste a Booking.com hotel link. Name, dates and guests fill in. Try an Airbnb link: dates fill in and it asks you to type the name.
4. Type a price of "abc": you get an error and nothing is saved.
