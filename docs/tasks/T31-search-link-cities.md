# T31 — Give the search links a city again

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T30 · **If it fails twice:** Opus
**Owner steps first:** read the question in **Decide first** below and answer it in your kickoff message.

## Goal
Every "search for this somewhere else" link carries the city it should. Round 3 removed the trip's single `destination` (V4 §4.2), and four links were quietly still reading it, so they now search for nothing: Google Hotels, Booking.com and Airbnb open with an empty city, and the Add place / Edit location "Find on Google Maps" button searches the whole world instead of where you're going. The trip cards in the list also always say "Still exploring".

Found during the T30 review. Nothing is broken enough to stop a trip, but the links are useless as they stand.

## Decide first (owner)
A trip now has several cities, not one, so each link has to be told which. Say which you'd rather have:

- **A — follow the screen.** The hotel links move into each stop's group on the Stays list and use that stop's city; the place-search links use the stop chip currently selected on the Map tab. Most accurate, and it means a little more layout change on both lists.
- **B — one city per trip, picked automatically.** Every link uses the first city of the chosen route (where you land). Simplest, and wrong whenever you're adding something for a later stop.
- **C — leave the links out.** Delete the hotel search row and the "Find on Google Maps" button, and rely on pasting links you found yourself.

The agent builds exactly one of these; it must not mix them.

## Read (only these)
- `SPEC.md` §7.7 (Map tab), §9.1, §9.2, §7.2
- `js/views/stays.js` (`renderSection`), `js/views/stayForm.js` (`buildStayDialog`), `js/views/placeForm.js` (`buildLocationPicker`), `js/views/places.js` (`openMapsUrlFor`), `js/views/mapTab.js` (how the selected chip and `cities` are tracked), `js/views/trips.js` (`renderCard`)

## Files you may change
- `js/views/stays.js`, `js/views/stayForm.js`, `js/views/placeForm.js`, `js/views/places.js`, `js/views/mapTab.js`, `js/views/trips.js`, `css/styles.css`, `SPEC.md`, `docs/tasks/WORDING.md`

## Do
1. Build the option the owner picked. Thread the city through as a plain string argument — don't reintroduce `trip.destination` or any trip-wide destination field, and don't write anything new to Firestore.
2. Fix the trip cards in the list: they read `trip.destination`, which no trip has any more, so every card says "Still exploring". Show the chosen route's cities, or drop that line — whichever reads better with the stage badge beside it.
3. Where a link has no city to use (no chosen option yet), either hide the link or show it without a city on purpose, and say which in `SPEC.md`.
4. Update `SPEC.md` §7.7 and §9.1 to describe which city each link uses, and add any new or changed on-screen words to `docs/tasks/WORDING.md`.

## Don't
- Don't add a "trip destination" field back to the data model.
- Don't restyle anything beyond what moving these controls needs.
- Don't touch the Routes tab.

## Tests
All tests pass. Any pure "which city" helper lives in `js/lib/` with its own tests. No file over about 400 lines.

## Done when
Every hotel and maps search link opens with a real city in it, or is deliberately gone, and no file reads `trip.destination` any more.

## Owner check
1. On Map → Stays, tap **Search Booking.com** and check the page opens on the right city.
2. On Map → Places, open **Add place**, type "coffee", tap **Find on Google Maps** and check the results are in the right city.
3. On the trips list, check each card says something true about where you're going.
4. Do the same on a trip with no route chosen yet, and check nothing looks broken.
