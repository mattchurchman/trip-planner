# T08 — Better link parsing and more efficient flight/stay cards

**Model:** Sonnet · **Depends on:** T05, T06, T07

## Goal
Get more out of a pasted Google Flights / stay link (a best-effort stop count, and a stay's coordinates when the link happens to carry them), default an untitled flight option's label to "Option N", and shrink the price panel's footprint on both cards so the price box doesn't dominate the card.

## Why
The owner's feedback: (1) parsing should get more out of a real link than just airports/dates — specifically how many stops a flight has; (2) an untitled flight option should get a sane default name instead of blank; (3) stays should pick up location info from the link, not only from a separate Google Maps paste; (4) the price panel (the tan/"brown" box) is visually too dominant on both flight and stay cards.

A stay photo was considered and explicitly dropped this round — there's no free, non-scraping, keyless source for a photo of a *specific* listing (Wikipedia only covers notable/indexed places), and the one free option that exists (Wikimedia Commons' geosearch) would return a photo *near* the coordinates, not of the actual property, which risks being misleading. Skip it.

## Files you may change
- `js/lib/flightlink.js` and `tests/flightlink.test.js`
- `js/lib/staylink.js` and `tests/staylink.test.js`
- `js/store.js` — flight label default
- `js/views/flights.js`, `js/views/stays.js`, `js/views/pricePanel.js`
- `css/styles.css` — the price panel and flight/stay card sections only

## Spec sections
§5.4 (flight/stay fields — no new fields needed), §7.7 (Add flight/stay forms, card contents), §7.8 (price panel), §9.6 (link parsing).

## Do
1. **Stop count (flightlink.js).** The `tfs=` blob encodes each leg's airports as repeated from/to pairs; a nonstop round trip has exactly 4 airport-code matches (2 for a one-way), and each connection adds one more pair. Add a best-effort `estimateStops(airports, hasReturn)` (or fold into `parseFlightLink`) that returns the extra pairs beyond the nonstop baseline, divided by 2. **This is reverse-engineered from one real nonstop sample with no real connecting-flight sample to verify against — say so clearly in code comments, the PR/summary, and ask the owner to sanity-check it against one of their own connecting-flight links.** Never let a wrong guess here block or corrupt the rest of parsing.
2. **Surface the stop count.** When a stop count > 0 is found, prefill it into "Outbound details" (only if that field is still empty) as "1 stop" / "N stops", and mention it in the "✓ Filled in: …" Step 2 message. Nonstop needs no mention.
3. **Flight label default (store.js + flights.js).** When adding a flight option with a blank label, default it to "Option N", where N is one more than how many flight options that traveler already has (count client-side from the flights already loaded — no extra read). Show this as the label field's pre-filled value in Step 3, not a silent fallback, so the traveler sees and can change it.
4. **Stay location from the link (staylink.js).** `parseStayLink` already returns `provider/name/checkIn/checkOut/guests`; add best-effort `lat`/`lng` when the URL happens to carry coordinates (check common param spellings across all three providers). Say plainly in code comments that most real share links from Booking.com/Airbnb/Google Hotels don't carry coordinates, so this will often find nothing — the separate "Other ways to add a location" stays the primary path. When found, feed it into the stay's existing `lat`/`lng` fields (§5.4) the same way a pasted Google Maps link already does, and update the location status shown in the form.
5. **Price panel, less dominant (pricePanel.js + CSS).** Keep the price summary (latest price, delta, New low badge, sparkline) always visible. Move the amount/note/**Save price** row behind a toggle, collapsed by default, the same pattern already used for History. Don't remove or rename anything — purely a show/hide change.
6. **Stay card, a bit more detail.** Add the actual check-in–check-out dates to the stay card's meta line (today it only shows a night count) — same short "10 Mar – 18 Mar" style flights already use.

## Don't
- Add any new Firestore field. `lat`/`lng` and the details/notes text fields already exist — everything here fits inside them.
- Add any new outside service call (confirmed with the owner: no stay photo this round).
- Change how `googleFlightsSearchUrl`/`googleHotelsUrl`/etc. build their search links, or how Search/Place-on-map work.
- Touch the Choose/Unchoose behavior (T06) or the totals card.

## Tests
- `flightlink.test.js`: a nonstop round trip (existing sample) reports 0 stops; a synthetic one-stop round trip built to the same structural pattern (documented as unverified against real Google data) reports 1; a one-way version uses the 2-airport baseline.
- `staylink.test.js`: a Booking.com/Airbnb/Google Hotels link with `lat`/`lng`-shaped params returns them; the existing links without any return `lat: null, lng: null`.

## Done when
Tests pass. A flight card's price box is no longer the tallest thing on the card by default. Loading the app locally shows no console errors.

## Owner check
1. Add a flight option, leave the label blank: it saves as "Option 1" (or the next number).
2. Paste a real Google Flights link for a connecting itinerary you've actually searched: check whether the stop count it fills in looks right — this is the one part of this task I couldn't verify against real data myself.
3. On a flight or stay card, the price box now starts collapsed to just the latest price line; **Log a price** (or similar) reveals the input.
4. Paste a stay link that you know carries a map location (for example one copied from a map view): see if the location fills in. Most ordinary share links won't have this — that's expected.
5. A stay card now shows its actual dates, not just a night count.
