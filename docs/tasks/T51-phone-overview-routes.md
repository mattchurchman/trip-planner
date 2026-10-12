# T51 — Phone pass: Trips list, Overview and Routes

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** L
**Depends on:** T41–T47 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
At 375 px wide, the Trips list, Overview and Routes need no zooming, no sideways scrolling and no squinting: one column, full-width cards, 44 px tap targets, readable type. Desktop (1280 px) still looks as it does now.

## Read (only these)
- `AGENTS.md` §4 (phone first)
- `css/styles.css`: the sections for trips list, overview, travelers, routes, `.seg`, dialogs, and the phone media blocks (open by section; search class names from the view files)
- `js/views/overview.js`, `js/views/routes.js`, `js/views/routeRail.js` — class names only (search, don't read whole)
- `docs/mock/routes-mock.html` (approved look)

## Files you may change
- `css/styles.css`; view files only to add a wrapper/class a layout needs

## Do
1. Hunt overflow first: fixed `width`/`min-width`, multi-column grids without a phone fallback, long unbroken text (airport codes, links: `overflow-wrap: anywhere`), tables. Fix each at the cause.
2. Write rules mobile-first: base styles for phones, `@media (min-width: 760px)` for wider. Convert any `max-width` phone overrides you touch in these screens.
3. Segmented controls (travelers, ideas) scroll sideways inside themselves with no page scroll; selected chip scrolls into view.
4. Dialogs on phones: full-width bottom sheet, max-height 90 dvh, content scrolls inside, buttons stay visible, safe-area padding.
5. Option cards and flight rows: stack price under the route text when narrow; no text under 13 px.
6. Check with a headless browser at 375×812 if one is available (e.g. Playwright on `docs/mock/routes-mock.html` and the sign-in page); otherwise reason from the CSS and list what the owner must look at.

## Don't
- Change behavior or wording; layout only.
- Touch Map or Days styles (T52).

## Tests
`node tests/run-tests.js` passes. Load locally with no console errors.

## Done when
No horizontal scroll and no element wider than the screen on these three screens at 375 px.

## Owner check
1. On the phone, open a trip and go through Trips list → Overview → Routes without pinching once. Note anything that still needs zooming.
2. Open the paste flight sheet and the traveler edit sheet: both fit and their buttons are reachable.
