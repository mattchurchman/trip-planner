# T23 — Slim Overview, remove Recap and destination ideas

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T21 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Overview becomes the trip's summary page. The Recap tab, the public recap page and the destination idea cards are removed.

## Read (only these)
- `docs/V4.md` §9, §1 (the "Removed" line)
- `js/views/overview.js`, `js/views/travel.js` (costs and totals parts), `js/lib/totals.js`, `js/lib/stage.js`
- `firestore.rules`

## Files you may change
- `js/views/overview.js`, `js/views/travel.js`, `js/lib/totals.js`, `js/lib/stage.js` (+ their tests), `js/app.js`, `js/store.js`
- delete: `js/views/candidates.js`, `js/views/recap.js`, `js/lib/recap.js`, `tests/recap.test.js`, `recap.html`, `js/lib/photos.js` + its test and `wikipediaSummary` in `js/lookup.js` if nothing else uses them
- `firestore.rules` (remove `publicRecaps`), `css/styles.css`, `docs/tasks/WORDING.md`

## Do
1. Overview sections in order: trip name and window dates; travelers (name, home city, home airport); chosen route (path line and the selected traveler's total, linking to Routes; a hint if none is chosen); budget; album link; trip comments.
2. Budget from pure functions in `totals.js` with tests: per traveler = picked home flights for the chosen option's idea + that option's hops; plus chosen stays and shared costs split equally; per-person total.
3. Move the shared costs list here from `travel.js`.
4. Album link: one field, saved to the existing `albumUrl`, shown as a link.
5. Remove the Recap tab and everything only it used. The "Trip's over" badge no longer links anywhere.
6. Leave old `candidates` documents in the database; just stop showing them.

## Don't
- Delete data, or change stays (T24).

## Tests
Budget cases: no chosen option; missing prices; two travelers with different home flights; costs split.

## Done when
All tests pass, no file imports a deleted module, no console errors.

## Owner check
1. Overview shows your window, travelers, chosen route and a per-person total that matches Routes.
2. Paste an album link: it opens.
3. The Recap tab is gone.
4. Copy the new `firestore.rules` into Firebase console → Firestore → Rules → Publish.
