# T62 — Routes: tidy flight cards and switches

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** T58 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Routes keeps its structure but reads cleanly: the traveler and idea switches never get cut off on a phone, a flight card keeps the airline and times on the left and the price on the right without big gaps, the chosen flight is obvious, and the pinned total never covers the last card.

## Read (only these)
- `docs/R7.md` §6 (segmented, badges), §7 "Routes"
- `js/views/routeRail.js` lines 30–70 (`renderFlightRow`) and 315–384 (`homeFlightsCardBody`)
- `js/views/routeIdeas.js` lines 77–120 (`renderIdeaSwitch`)
- `css/styles.css`: Routes section (from `grep -n "Routes tab (V4" css/styles.css` to the end of the "Earlier flights" block), the price chip (`grep -n "price chip" css/styles.css`), `.flight-card-header`

## Files you may change
- `js/views/routeRail.js`, `js/views/routeIdeas.js` (markup and classes only), `css/styles.css` (Routes, flight card and price chip rules)

## Do
1. Flight card: CSS grid `1fr auto`; left = airline line with inline badges (New low, Cheapest), then OUT/BACK rows; right = the price chip with its age line under it, top-aligned. No empty band between the airline line and OUT.
2. **Use this** = secondary small button; **Using** = `--forest-soft` pill with a check, not a button-looking box (it stays clickable to unpick, with an `aria-pressed`).
3. Idea row: segmented ideas + one **Choose idea**/**Chosen** button + ⋯ (Rename, Delete from T58). Traveler switch the same segmented rules (scrolls, selected in view).
4. Reserve bottom padding on the Routes page equal to the pinned bar's height + 16 px (phones) so the last option card is fully visible.
5. Option cards per R7 §7(e).

## Don't
- Change route math, choosing logic, paste flow or the price panel's behavior.

## Tests
`node tests/run-tests.js` passes. Demo `#/trip/t1/routes` at 390 and 1280 px (two screenshots); scroll to the bottom at 390 px (one more).

## Done when
At 390 px: all three traveler names are reachable; a flight card has no gap above OUT; the last option card clears the total bar.

## Owner check
1. On your phone, swipe the traveler switch: every name is reachable and the chosen one stays in view.
2. The flight you're using has a green "Using ✓" pill; the others show **Use this**.
3. Scroll to the bottom: the last option is fully visible above the total bar.
