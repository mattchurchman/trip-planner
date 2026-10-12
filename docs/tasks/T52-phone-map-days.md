# T52 — Phone pass: Map (places + stays) and Days

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** L
**Depends on:** T48–T51 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Same standard as T51 for the Map and Days tabs: at 375 px, no zooming, no sideways scrolling, the map and the list share the screen sensibly, and every control is thumb-sized.

## Read (only these)
- `AGENTS.md` §4
- `css/styles.css`: map tab, map container, stop chips, places, stays, coverage bar, days, days map sections (search class names from the views)
- `js/views/mapTab.js`, `js/views/stays.js`, `js/views/days.js`, `js/views/daysMap.js` — class names only

## Files you may change
- `css/styles.css`; view files only to add a wrapper/class a layout needs

## Do
1. Map on phones: map height ~40 dvh at the top, list below; the stop chips row scrolls sideways inside itself. Leaflet controls not covered by the top bar or tab bar.
2. Stays groups: header (city, dates, nights) on one or two lines, coverage bar full width, search links wrap as small buttons, stay cards stack price under name.
3. Days: day card header (label, actions) wraps cleanly; place rows keep up/down/remove as 44 px buttons; "Add to day" select is full width.
4. Mobile-first rules as in T51; fix overflow at the cause.
5. Check with a headless browser at 375×812 if available; otherwise list what the owner must look at.

## Don't
- Change behavior or wording; layout only.

## Tests
`node tests/run-tests.js` passes. Load locally with no console errors.

## Done when
No horizontal scroll and no element wider than the screen on Map and Days at 375 px.

## Owner check
1. On the phone, Map tab: scroll places and stays, tap pins, open a place — no pinching.
2. Days tab: create days, add places, reorder, open a walking route — no pinching.
