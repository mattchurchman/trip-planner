# T44 — Routes: + Idea works; the total bar stays out of the way

**Tier:** B · **Model:** Sonnet · **Effort:** low · **Size:** S
**Depends on:** T41 · **If it fails twice:** Sonnet, effort medium
**Owner steps first:** none

## Goal
The **+ Idea** button adds an idea, and the floating total on Routes is a slim bar on phones that never covers the cards.

## The bug (known cause)
In `js/views/routes.js` line 57, `addIdeaBtn` is created and placed in the header but never given a click handler. Only `addIdeaEmptyBtn` (the empty-state one, line 75) calls `onAddIdea()`.

## Read (only these)
- `js/views/routes.js` lines 50–90, 205–220, 260–280
- `js/views/routeIdeas.js` lines 110–122 (`renderSummaryBar`)
- `css/styles.css` `.route-summary` (~line 2127–2160)

## Files you may change
- `js/views/routes.js`, `js/views/routeIdeas.js`, `css/styles.css` (`.route-summary` only)

## Do
1. Wire `addIdeaBtn` to `onAddIdea()` (pending state while the dialog's save runs, as `run()` already reports errors).
2. Compact total bar below 760 px: one line, ~44 px tall — `<Name>: $X` on the left and a small **Details ▾** toggle on the right that expands the breakdown (homes / hops / stays / costs and the missing-prices list) and collapses back. Remember open/closed per session in a variable. Sit it above the bottom tab bar, as now.
3. Add bottom padding to the Routes content equal to the bar's height so the last card can scroll fully into view.
4. Desktop (760 px+) keeps the current full bar.

## Don't
- Change how totals are calculated.

## Tests
`node tests/run-tests.js` passes. Load locally with no console errors.

## Done when
Both + Idea buttons add an idea, and on a 375 px screen the bar is one line and the last option card can be read in full.

## Owner check
1. Routes with at least one idea → tap **+ Idea** at the top → name it → it appears and is selected.
2. Phone: the total is a single slim line; **Details** opens the breakdown; scroll to the bottom and the last card isn't hidden.
