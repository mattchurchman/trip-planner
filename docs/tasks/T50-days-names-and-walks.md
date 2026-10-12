# T50 — Days: names carry the date; walking routes stay inside the day

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** S
**Depends on:** T46 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Every day card reads like "Lisbon · Sat, Oct 17", and a day card's **Open walking route** covers only that card's places and that night's hotel in the same city — never a stop from elsewhere in the trip.

## Likely causes (prove each with a test first)
- **Names:** `daysFromStops` (`js/lib/dayplan.js` ~24) sets `title: stop.city`, and `dayLabel` (`js/views/days.js` ~50) shows only the title, so the date never appears.
- **Walking route:** the places are already per day (`days.js` ~151), but the start/end point comes from `stayForDate` (`dayplan.js` ~44), which returns the **first** chosen stay whose nights include the date **or whose checkout is that date**. On a travel day that is the previous city's hotel, so the route runs from the last city to today's places and back. Reproduce with the owner's report before changing anything; if the cause differs, fix the real one and say so.

## Read (only these)
- `js/lib/dayplan.js` (whole, ~70 lines), `tests/dayplan.test.js`
- `js/lib/links.js` lines 80–114 (`walkingRouteLinks`), `tests/links.test.js` (its walking cases)
- `js/views/days.js` lines 50–60, 150–235, 325–335
- `js/lib/itineraryFormat.js` line 11 (`formatLegDate`)

## Files you may change
- `js/lib/dayplan.js`, `js/lib/links.js`, their tests, `js/views/days.js`, `SPEC.md` §7.8 (two lines)

## Do
1. **Label at render, not in data:** `dayLabel(day)` → `<title> · <Sat, Oct 17>` when the day has both, the date alone when there's no title, the title alone when undated. Existing days pick it up with no migration. Keep `title: city` for new days.
2. **Home stay for a day:** prefer a stay whose nights include the date (tonight's bed); only fall back to a stay checking out that day. When the day has a `cityKey`, ignore stays whose pin is more than ~50 km from that city's stop (reuse `nearestStop`/distance helpers in `js/lib/stops.js` if present). Tests: travel day between two cities; single-city trip; no stays.
3. Use the same rule for the Days map's home pin (`days.js` ~331).
4. If a day has fewer than 2 located places and no same-city home stay, show no route button (current rule, keep it).

## Don't
- Change how days are created beyond the label, or the route link format.

## Tests
`node tests/run-tests.js` passes with the new cases.

## Done when
Day headers show city and date, and on a travel day the walking route starts and ends at the new city's hotel.

## Owner check
1. Days → Create days from route: headers read "<City> · <Day, Mon D>".
2. On the day you arrive in a new city, add two places and tap **Open walking route**: Google Maps shows only those two plus that night's hotel.
