# T24 — Stays by stop, with night coverage

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** T23 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Stays are grouped under the stops of the chosen route with dates filled in, can be marked Out or Chosen, and each stop shows which nights are covered and what the chosen stays cost.

## Read (only these)
- `docs/V4.md` §7
- `js/views/stays.js`, `js/views/stayForm.js`, `js/lib/selection.js`, `js/lib/route.js` (`stopsFor` return shape)

## Files you may change
- **new** `js/lib/coverage.js` + `tests/coverage.test.js`, `js/lib/optionSort.js` (+ test), `js/views/stays.js`, `js/views/stayForm.js`, `js/store.js` (`stopKey`, `out`, duplicate), `css/styles.css`, `docs/tasks/WORDING.md`

## Do
1. `coverage.js` (pure): `nightCoverage(stop, chosenStays)` → one entry per night: `covered`, `open` or `double`; `stayNights(stay)`; `stopStayTotal(chosenStays)`.
2. Group stays by stop in route order, then "No stop yet". **Add stay** inside a stop pre-fills check-in/out from the stop and sets `stopKey`. The form's link-first flow stays; add the clipboard paste helper beside the link box.
3. Status control per stay: Shortlisted / Out / Chosen. Out stays are dimmed and sorted last. Chosen uses the existing `selectedStayIds`.
4. **Duplicate** copies a stay (no prices) and opens the form on the copy.
5. Per stop: the coverage bar with a text summary ("2 of 4 nights covered"), chosen total, and per-person share.
6. With no chosen option, show all stays ungrouped and a hint to choose an option on Routes.

## Don't
- Change the map (T25) or the price control.

## Tests
A stay covering part of a stop; two stays splitting a stop exactly; overlap gives `double`; a stay outside the stop's dates covers nothing; missing dates.

## Done when
All tests pass; grouping and coverage render at 375 px.

## Owner check
1. With an option chosen, the Stays tab lists each city with its dates.
2. Add two stays in one city that split the nights; choose both: the bar shows every night covered and the total adds up.
3. Mark one **Out**: it drops to the bottom, dimmed.
