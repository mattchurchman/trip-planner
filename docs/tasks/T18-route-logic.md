# T18 — Route logic

**Tier:** A · **Model:** Opus · **Effort:** high · **Size:** M
**Depends on:** T17 · **If it fails twice:** ask the owner
**Owner steps first:** none

## Goal
One tested library that turns flights into stops, nights, totals, warnings and names, and decides where a pasted flight belongs. Every Routes screen builds on it.

## Read (only these)
- `docs/V4.md` §4.2, §4.4, §4.5
- `js/lib/flightlink.js` (the return-shape comment above `parseFlightLink`, and `legRoute`)
- `js/lib/totals.js` (`latestEntry`), `js/lib/airports.js`

## Files you may change
- **new** `js/lib/route.js`, **new** `tests/route.test.js`

## Do
Pure functions, taking the airport index as an argument:
1. `movements(hopFlights)` → `[{ from, to, date, flightId }]` sorted by date (undated last).
2. `stopsFor({ homeFlights, hopFlights, airports })` → `[{ cityKey, city, code, from, to, nights, warnings: [] }]` per §4.4, using the traveler's picked home flights.
3. `totalFor({ homeFlights, hopFlights })` → `{ cents, complete }`.
4. `ideaName(...)`, `optionName(...)`, `guessLandsDate(fromCode, toCode, date, airports)`.
5. `homeDirection(parsed, traveler, airports)` → `"both" | "out" | "back" | null` (null = not a home flight).
6. `placePastedFlight({ parsed, traveler, ideas, homeFlightsByIdea, airports })` → `{ role, direction, ideaId | null, newIdeaName | null }` per §4.5.

## Don't
- Touch the DOM, Firestore, or any screen.
- Change `flightlink.js`.

## Tests
Cover at least: Rome round trip with FCO→FLR, FLR→BCN, BCN→FCO (stops Rome 3, Florence 4, Barcelona 4, Rome 2 for landing 15 May, hops 18/22/26 May, home 28 May); a round-trip side trip (Athens → Istanbul → Athens gives three stops); London in / Madrid out naming; a hop leaving from the wrong city warns; dates out of order warn; no home flight yet; missing price makes the total incomplete; FCO vs CIA count as the same city; landing-date guess for DEN→FCO (+1 day) and FCO→ATH (same day); a pasted DEN⇄FCO link is a home flight in direction "both" and matches an existing Rome idea.

## Done when
All tests pass and `route.js` is under 400 lines.

## Owner check
Nothing to click yet. T19 puts this on screen.
