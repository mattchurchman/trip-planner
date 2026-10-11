# T21 — Two-tap price check

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T20 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The price itself is the control. Tap it, Google opens on that flight, come back and answer **Same** or **Changed**. A **Check prices** button walks through every stale price.

## Read (only these)
- `docs/V4.md` §5
- `js/views/pricePanel.js`, `js/lib/totals.js`

## Files you may change
- `js/views/pricePanel.js`, `js/lib/totals.js` (+ `tests/totals.test.js`), `js/views/routes.js`, `js/views/routeRail.js`, `js/views/stays.js`, `css/styles.css`, `docs/tasks/WORDING.md`

## Do
1. Pure helpers with tests: `priceAgeDays(prices, now)`, `isStale(prices, now)` (older than 3 days or no price), `stalePriceQueue(items, now)`.
2. Rebuild the price summary per §5: price button, age label, stale dot, the Still/Same/Changed row, movement in words and color. Keep History behind the existing disclosure.
3. **Check prices** on each option and above the stays list: steps through stale items in screen order, opening each link and asking the same question, with Skip and a "3 of 7" counter.
4. Keep the open row from closing on live updates (the existing `rowState` pattern).

## Don't
- Fetch prices or re-read a pasted link for a new price.
- Use a "Recheck" text link.

## Tests
New helper tests pass, plus all existing ones.

## Done when
The flow works on a flight and on a stay, at 375 px with 44 px buttons.

## Owner check
1. Tap a flight's price: Google opens. Come back, tap **Same**: it shows "No change" and a fresh age.
2. Tap again, **Changed**, enter a new number: the total updates and the change shows as higher or lower.
3. **Check prices** on an option walks through the old ones.
