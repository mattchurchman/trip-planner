# T34 — Paste where it goes: one button per section

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** — · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The button you press decides where a flight goes. **Paste flight link** in the home-flights card adds a flight from home to that idea for the selected traveler (an outbound and a return pasted separately land in the same idea). **Paste flight link** in an option adds another flight to that option. The sheet no longer reads the clipboard by itself and no longer guesses.

## Read (only these)
- `SPEC.md` §7.6 (the "Pasting a flight is the way in" list)
- `js/views/routes.js` (`onPasteFlight`, `savePastedFlight`, `renderHomeFlightsCard`, `renderOptionsList`), `js/views/pasteFlight.js`, `js/lib/route.js` (`placePastedFlight`, `homeDirection`)

## Files you may change
- `js/views/routes.js`, `js/views/pasteFlight.js`, `js/views/routeRail.js`, `js/lib/route.js` (+ `tests/route.test.js`), `css/styles.css`, `SPEC.md` §7.6, `docs/tasks/WORDING.md`

## Do
1. SPEC §7.6 first: replace steps 1–4 with the scoped flow below.
2. Remove the top-of-tab paste button. Add **Paste flight link** inside the home-flights card (target: selected traveler + selected idea) and keep the one in each open option (target: that option).
3. With no ideas yet, the home-flights card's button creates the idea from the first pasted flight (current naming rules).
4. The sheet opens with an empty link box and focus in it; it parses on `paste` and `input` (already wired). Delete the `readClipboardText()` call in `onPasteFlight`.
5. Replace the **Adding to:** idea/option selects with one fixed line ("Adding to Rome round trip · Matt" or "Adding to Florence + Barcelona"). Home vs hop comes from the button, not `placePastedFlight`; keep `homeDirection` only to set `direction` (out/back/both) on home flights. Remove code and tests that become unused.
6. An option may hold any number of flights; each paste adds one.

## Don't
- Change how links are parsed (`flightlink.js`).
- Touch choosing or totals (T35/T36).

## Tests
Updated `route.test.js` passes, plus all others.

## Done when
Pasting from the option card always lands in that option; pasting an outbound and a return in the home-flights card puts both under the same idea.

## Owner check
1. Copy a Google Flights link, tap **Paste flight link** in the home-flights card, paste: details fill in at once. Add it.
2. Paste the return flight the same way: it joins the same idea.
3. Open an option, paste a flight there: it appears in that option, never in the home-flights card. Paste a second one: the option now has two.
