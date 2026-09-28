# T06 — Choose several flights and stays

**Model:** Sonnet (use Opus if it fails once — this task changes stored data) · **Depends on:** T05

## Goal
Let each traveler choose any number of flight options, and the group choose any number of stays. Totals add up everything chosen.

## Why
Trips have extra legs, side trips and stays in two areas. Today choosing a second option silently replaces the first. The owner doesn't want a complicated "side trip" feature — just don't lock people into one choice.

## Files you may change
- **new** `js/lib/selection.js` and **new** `tests/selection.test.js`
- `js/lib/totals.js` and `tests/totals.test.js`
- `js/store.js` — choose/unchoose functions, new-trip defaults, delete cleanup
- `js/views/flights.js`, `js/views/stays.js`, `js/views/travel.js` (totals card)
- `js/views/overview.js` (removing a traveler), `js/views/recap.js` (planned total), `js/views/places.js` (stay markers, if they mark the chosen stay)
- `css/styles.css` — only if the Chosen badge needs it

## Spec sections
§5.3 (new fields and **the pre-2.0 rules — read carefully**), §7.7 (Choose / Unchoose, delete cleanup, totals card), §11 (traveler total, complete).

## Do
1. `selection.js` (pure):
   - `chosenFlightIds(trip, travelerId)` → array; handles missing, a legacy string, or an array.
   - `chosenStayIds(trip)` → array merging `selectedStayIds` and legacy `selectedStayId`, no duplicates, no null.
   - `isFlightChosen`, `isStayChosen` helpers.
2. `store.js`:
   - `chooseFlight` / `unchooseFlight(tripId, trip, travelerId, flightId)`: if the current value is a legacy string, write the full list (§5.3); otherwise `arrayUnion` / `arrayRemove` on `selectedFlights.<travelerId>`.
   - `chooseStay` / `unchooseStay(tripId, trip, stayId)`: if a legacy `selectedStayId` exists, write the full `selectedStayIds` list and `selectedStayId: deleteField()` in one update; otherwise `arrayUnion` / `arrayRemove`.
   - Deleting a flight or stay removes its id from the selections (same legacy handling).
   - New trips start with `selectedStayIds: []` and no `selectedStayId`.
3. `totals.js`: `computeTotals` takes `selectedFlightIdsByTraveler` and `stays` (the chosen ones) and follows §11. Keep the rule that shares always add up exactly; split each stay and each cost separately.
4. UI: **Choose** ↔ **Unchoose** toggle with a pending state; teal "Chosen ✓" badge on every chosen option. The totals card lists per-traveler flights, stays share, costs share, total, and the missing items in §7.7's wording.
5. Update every other place that read `selectedStayId` or a single `selectedFlights` value (search the whole `js/` folder) to use `selection.js`.

## Don't
- Change `firestore.rules` (not needed: the trip-update rule already allows this).
- Run a bulk migration over all trips. Old trips convert one field at a time, only when someone changes a choice.

## Tests
- `selection.test.js`: missing, legacy string, array, and legacy+new stay fields merging without duplicates.
- `totals.test.js` (keep the existing cases passing, updated to the new inputs): a traveler with two chosen flights ($300.00 + $120.50); two chosen stays ($1,000.01 and $450.00) split across 3 travelers, with shares adding exactly to the whole; one chosen flight without a price → Partial total naming that flight's label; no stay chosen → still complete.

## Done when
Tests pass, and `grep -rn "selectedStayId\b" js/` finds it only inside `selection.js` and the legacy branch of `store.js`.

## Owner check
1. On an **existing** trip that already had a chosen flight and stay: they still show as Chosen and the totals are unchanged.
2. Choose a second flight for yourself. Both say "Chosen ✓" and your total adds both.
3. Choose a second stay. Everyone's stay share goes up, and the per-person totals still add up to the combined total.
4. **Unchoose** one of them. The total drops back.
5. With a friend, both choose different stays at the same moment. Both stay chosen.
6. Delete a chosen flight option. It disappears from the totals.
7. Recap tab: the planned total matches the Flights & stays total.
