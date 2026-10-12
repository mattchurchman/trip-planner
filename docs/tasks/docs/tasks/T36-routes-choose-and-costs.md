# T36 — Routes: choose ideas and options separately, clear costs

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** T35 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
For the selected traveler, **Choose idea** and **Choose this option** are separate toggles (press again to unchoose). Each card shows only its own cost, and a small summary shows the selected traveler's total. The **Check prices** button is gone.

## Read (only these)
- `SPEC.md` §7.6, §7.9 (as changed by T35)
- `docs/mock/routes-mock.html` (updated 2026-10-12: match it)
- `js/views/routes.js`, `js/views/routeRail.js`, `js/views/routeIdeas.js`, `js/views/pricePanel.js` (search `checkPrices`), `js/lib/choices.js` (exports only)

## Files you may change
- `js/views/routes.js`, `js/views/routeRail.js`, `js/views/routeIdeas.js`, `js/views/pricePanel.js`, `js/lib/totals.js` (remove `stalePriceQueue` if unused, + tests), `css/styles.css`, `SPEC.md` §7.6, §7.9, `docs/tasks/WORDING.md`

## Do
1. Idea switch: a **Choose idea** / **Chosen** toggle beside **Rename** / **Delete**; the idea chip shows a check when chosen by the selected traveler.
2. Home-flights card header: "{traveler}'s flights from home · $X" (picked flights only).
3. Option card: total = its flights only, labeled "per person"; a line "For: Matt, Sam" from automatic or overridden travelers; **Chosen** badge per selected traveler; other travelers who chose it shown as small initials.
4. Each hop row: a **Who's this for?** control (Automatic / pick travelers) using `setForTravelers`; overriding shows "Set by hand · Reset".
5. A sticky summary at the bottom of the tab: "{traveler}: home $A + option flights $B = $C" (at least, when missing).
6. Remove **Check prices** (button, dialog, and SPEC lines). Tapping a price stays the way to recheck.

## Don't
- Change pasting (T34) or the price button itself.

## Tests
`node tests/run-tests.js` passes.

## Done when
Choosing an option no longer changes the idea or another traveler; costs read clearly at 375 px.

## Owner check
1. Pick traveler A, **Choose idea**, then **Choose this option**. Switch to traveler B: nothing is chosen for B.
2. Choose a different option for B: the option card shows "For: B" only for that option's flights.
3. Set a flight's **Who's this for?** to A and B by hand, then **Reset**.
4. No **Check prices** button anywhere.
