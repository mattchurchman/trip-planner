# T47 — "I live here": no home flight when the idea is your home

**Tier:** A · **Model:** Opus · **Effort:** high · **Size:** L
**Depends on:** T46 · **If it fails twice:** stop and ask the owner
**Owner steps first:** none

## Goal
A traveler who lives in an idea's city doesn't need a flight from home. The app notices this on its own when their home airport is in the idea's arrival city, and anyone can also switch it on by hand with **I live here — no flight needed**. Their route, totals and "complete" status then work without a home flight.

## Data change (owner-approved for this task)
Add to SPEC §5.3 `choices.<travelerId>`: `localIdeaIds: [ideaId]` — ideas this traveler is local to by hand. Write only with `arrayUnion` / `arrayRemove` on the field path `choices.<travelerId>.localIdeaIds`. Firestore rules don't constrain `choices` (check `firestore.rules`; if they do, stop and ask).

## Rules (put these in SPEC §7.6 and §11)
- **Local to an idea** = the idea's arrival city (`ideaEndpoints(...).inCode` from anyone's home flights on that idea, via `airports.cityKey`) equals the traveler's `homeAirport` city, **or** the idea id is in their `localIdeaIds`. Auto-detected local can't be switched off (show it ticked and disabled, "Matches your home airport").
- **Their stops:** start in the idea's arrival city on the earliest arrival date among other travelers on that idea, else `trip.startDate`; end on the latest home-flight departure among others, else `trip.endDate`. Hops from their chosen option apply as for anyone. Hops into their home city still make a stop (they may want a stay there or not — that's their call).
- **Totals:** home flights count $0 for them; "complete" doesn't require a picked home flight from a local traveler.

## Read (only these)
- `js/lib/choices.js` lines 25–60, 105–125, 195–283
- `js/lib/route.js` lines 100–200
- `js/views/routes.js` lines 120–200 (home flights section), `js/views/routeRail.js` (search for the home-flights card)
- `js/store.js`: search `setChoice`
- `tests/choices.test.js`
- `SPEC.md` §5.3, §7.6, §11, by section

## Files you may change
- `js/lib/choices.js`, `js/lib/route.js`, `tests/choices.test.js`, `tests/route.test.js`, `js/store.js` (one `setLocalIdea(tripId, travelerId, ideaId, on)`), `js/views/routes.js`, `js/views/routeRail.js`, `css/styles.css` (the toggle only), `SPEC.md` §5.3, §7.6, §11

## Do
1. Pure `isLocalToIdea({ traveler, trip, ideaId, flights, airports })` in `choices.js`, with tests (auto match, manual, neither, no airport set).
2. Feed it into `stopsByTraveler` and `travelerBreakdown` per the rules above; tests for both.
3. Routes, home-flights card for that traveler + idea: when local, replace the paste prompts with "No flight needed — <Name> lives in <City>" and the toggle. When not local, show the toggle as a small checkbox under the paste button.
4. Pending state and inline error on the toggle (AGENTS §4).

## Don't
- Delete flights a traveler already saved when they become local; just don't count them, and say so in one muted line.

## Tests
`node tests/run-tests.js` passes with the new cases.

## Done when
A traveler whose home airport is LIS shows "No flight needed" on a Lisbon idea, has stops for the trip dates, and the group total can be complete without a flight for them.

## Owner check
1. Set a traveler's home airport to the idea's arrival airport → Routes shows "No flight needed" for them, and Overview's costs don't list a missing flight for them.
2. On a different idea, tick **I live here** by hand → same result; untick → paste prompts come back.
