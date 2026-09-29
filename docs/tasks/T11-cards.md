# T11 — Compact flight and stay cards

**Model:** Sonnet · **Depends on:** T10

## Goal
Redesign the flight and stay cards so options are easy to compare side by side. The price becomes a small summary in the card header, and logging a price moves behind an **Update price** button.

## Why
The owner finds the cards' use of space inefficient, and they don't show enough to tell two flight options apart. The price panel takes over each card.

## Files you may change
- `js/views/flights.js` (card, grid, sort, Cheapest pill)
- `js/views/stays.js` (card, numbering, grid, sort)
- `js/views/pricePanel.js` (rebuilt as a header summary + an Update price row + History)
- `js/views/itinerary.js` (from T10; small fixes only)
- `css/styles.css` — flight card, stay card and price sections

## Spec sections
§7.7 (the **Flight card** and **Stay card** sketches and bullets, the stay **number** rule, grid and sort), §7.8 (price summary and Update price), §8 (live updates must not close an open Update price row).

## Do
1. **Price** (`pricePanel.js`) now exports two pieces: `priceSummary(...)` for the header's right side, and `priceUpdater(...)` which returns the **Update price** button and the row it opens. The row holds amount, note, Save price, Cancel, and a History link when there are 2+ entries. Keep every existing behavior (arrayUnion, validation messages, delete-from-history with confirmation).
2. **Flight card** exactly as the sketch: header (label + pills | price summary), `renderItinerary`, notes clamped to two lines (`-webkit-line-clamp: 2`), footer actions. "Open on Google ↗" only when the link passes `safeUrl`.
3. **Flight grid and sort:** `repeat(auto-fill, minmax(340px, 1fr))`; chosen first, then lowest latest price (unpriced last), then newest. "Cheapest" pill on the lowest-priced option in each traveler's section (none if fewer than 2 are priced).
4. **Stay card** exactly as the sketch: number badge (①…⑩, from `createdAt` order, oldest first; compute once per render and export the helper for T13), name, provider pill, Chosen pill | price summary with total and per night; the meta line (neighborhood · dates · nights · guests, skipping empty parts); location line ("📍 On the map" or "No pin yet · **Set location**", which opens the existing edit dialog); rank control; note; footer.
5. **Stay grid and sort:** same grid; chosen first, then rank score, then lowest per-night price.
6. The footer's Choose/Unchoose keeps T06's behavior exactly.

## Don't
- Change the dialogs (T10 did flights; T12 does stays) or any stored data.
- Add the stays map (T13). Leave "📍 On the map" as plain text for now; T13 makes it clickable.
- Invent new button or pill styles. Reuse `.btn`, `.btn-small`, `.btn-quiet` (or whatever the existing quiet class is) and the existing pill classes.

## Tests
Put any pure helpers (sort order, cheapest pick, stay numbering) in `js/lib/` with tests: sort puts chosen first, then price, and unpriced last; cheapest is null with fewer than two priced options; numbering follows `createdAt` and is stable when a stay is chosen. `node tests/run-tests.js` passes.

## Done when
Both card types match their sketches at 1280 px (two or three cards per row) and 375 px (one per row). No price input is visible until **Update price** is pressed.

## Owner check
1. Flights & stays: flight options sit side by side on a laptop. Each shows both legs with stops and flight numbers.
2. The price is at the top right with the change under it. There's no big price box.
3. **Update price** → type a price → **Save price**. The summary updates and the row closes. **History** still lists and deletes entries.
4. The cheapest option in your section says **Cheapest**.
5. Stays are numbered ①, ②, ③… and show total and per-night prices.
6. While your friend saves a price, your open Update price row doesn't close.
7. On your phone, cards stack one per row and nothing overflows.
