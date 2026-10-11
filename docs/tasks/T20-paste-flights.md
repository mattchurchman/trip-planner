# T20 — Paste a flight link and it files itself

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** T19 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
One tap on **Paste flight link** reads the copied Google Flights link, works out whether it is a flight from home or a hop, creates the idea or option if needed, and shows one confirmation before saving. This is the main way data gets into the app.

## Read (only these)
- `docs/V4.md` §4.5, §4.6
- `js/views/routes.js`, `js/views/flightForm.js`, `js/lib/route.js` (`placePastedFlight`, `guessLandsDate`)

## Files you may change
- **new** `js/views/pasteFlight.js`, `js/views/routes.js`, `js/ui.js` (`readClipboardText()` helper with a paste-box fallback), `js/store.js` (one function that creates idea/option and flight together in a batch)
- `js/views/travel.js`, `js/views/flights.js` (remove the old per-traveler Flights section), `css/styles.css`, `docs/tasks/WORDING.md`

## Do
1. **Paste flight link** button at the top of Routes and inside each open option.
2. Follow §4.5 steps 1–5 exactly. The confirmation sheet shows the itinerary with `renderItinerary`, the price Google showed, the landing date for outbound home flights (editable), and "Adding to: <idea> › <option>" with a control to change it.
3. When the link has no price, the sheet has an optional price field.
4. **Earlier flights**: a collapsed list of flights with no `role`, each with **Move to…** (sets role, idea, option or traveler) and Delete.
5. Remove the Flights section from the old Flights & stays tab; rename that tab **Stays** for now.

## Don't
- Fetch anything or try to resolve short links.
- Change `flightlink.js` or `route.js` unless a test proves a bug.

## Tests
Existing tests pass; add tests for any new pure helper.

## Done when
Pasting each sample link from `tests/flightlink.test.js` into the fallback box produces the right sheet. No console errors.

## Owner check
1. In Google Flights pick a round trip from home until you see the final price; copy the address bar.
2. Routes → **Paste flight link** → Add. A new idea appears, named for the city, with your flight and price.
3. Copy a one-way between two cities in the region, paste: it lands in the option, and the stops and nights update.
4. Do the same on your iPhone from Safari.
5. Paste a second option from home for the same city: it joins the same idea as an alternative.
