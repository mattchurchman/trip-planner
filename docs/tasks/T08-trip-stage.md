# T08 — Automatic trip stage instead of Status

**Model:** Haiku · **Depends on:** nothing

## Goal
Remove the Status dropdown. In its place, show a badge the app works out by itself: Exploring → Planning → "In 42 days" → Happening now → Trip's over.

## Why
Nobody updates the Status dropdown, so it says nothing useful. A countdown that updates itself is worth having on the trips list and at the top of each trip.

## Files you may change
- **new** `js/lib/stage.js` and **new** `tests/stage.test.js`
- `js/views/overview.js` — remove the Status field, the `STATUSES` list, and the line that sets `status` to "planning" when a destination is picked
- `js/views/trips.js` — card shows the stage badge instead of `trip.status`
- `js/app.js` — trip header badge
- `js/store.js` — `createTrip` stops writing `status`
- `css/styles.css` — badge colors
- `help.html` — if it mentions Status

## Spec sections
§11 (Trip stage: the exact rules and labels), §4 (stage badge colors), §5.3 (`status` is retired), §7.2, §7.5.

## Do
1. `tripStage(trip, today)` in `stage.js`, exactly as §11. `today` is a "YYYY-MM-DD" string passed in (never read the clock inside `js/lib/`). Add a tiny helper in the view to get the viewer's local date as "YYYY-MM-DD".
2. The badge is a pill: `<span class="stage-badge stage-<key>">`. Trips list uses `shortLabel`; trip header uses `label`.
3. When the stage is `done`, the header badge is a link to `#/trip/<id>/recap`.
4. Delete every read and write of `trip.status` in `js/`. Leave existing documents alone (no clean-up writes).

## Don't
- Touch `firestore.rules` or add any stored field.
- Change anything else on the Overview tab.

## Tests (`tests/stage.test.js`)
- No destination → exploring (even when dates are set).
- Destination, no start date → planning.
- Start date 42 days after today → "In 42 days"; 1 day after → "Tomorrow".
- Today equals the start date → now; today between start and end → now; today equals end → now.
- No end date: today = start → now; the day after → done.
- Day after the end → done, with label "Trip's over — add your recap" and shortLabel "Trip's over".
- Month and year boundaries count correctly (e.g. today 2026-12-30, start 2027-01-02 → "In 3 days").

## Done when
Tests pass and `grep -rn "\.status\b\|STATUSES" js/views js/app.js js/store.js` finds nothing about trip status.

## Owner check
1. The trips list shows a badge on each trip instead of the old status word.
2. A trip with no destination picked says **Exploring**. Pick a destination and it says **Planning**.
3. Set start and end dates in the future. It counts down ("In 42 days").
4. Overview no longer has a Status dropdown.
5. On a trip whose dates are in the past, the badge says "Trip's over — add your recap" and clicking it opens the Recap tab.
