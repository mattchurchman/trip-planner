# T71 — Map tab: map visible on phones, vote from the list

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Codex:** GPT-5.6 Terra, medium · **Depends on:** T70 · **If it fails twice:** Opus, medium (Codex: GPT-5.6 Sol, medium)
**Owner steps first:** none

## Goal
On a phone held upright the Map tab shows no map at all, and held sideways the map is taller than the screen. Place rows cut long names off and make you open a big card, scroll, vote and close it again. After this task: the map is always visible at the top on a phone and fits the screen sideways; each row shows the whole name (up to two lines) and a vote bar you tap without opening the row; and only one row is ever open.

**Likely cause of the missing map:** `.map-tab-map` has `flex: 1` inside a column flex box with no set height, so its `height: 40dvh` is overridden by a zero flex-basis and Leaflet's (empty-content) div collapses to 0 px. Confirm before fixing.

## Read (only these)
- `SPEC.md` §7.7 — the first four bullets and the **Each place is one compact row** bullet (grep `T71`); they are the exact behavior
- `css/styles.css` — `.map-tab-layout` through the first `@media (min-width: 760px)` after it (around lines 1528–1565), and `.place-row` through `.vote-compact-mine` (around 1646–1700); grep the top bar's height variable or selector to size the sideways map
- `js/views/places.js` lines 194–330 (`compactVoteSummary`, `renderPlaceRow`) and 385–400 (marker → row)
- `js/views/mapTab.js` — `focusMapPin` only (grep it)
- `js/views/` — grep `export function rankControl` and read that function only
- `docs/tasks/WORDING.md` — the **Round 11** section

## Files you may change
- `css/styles.css` (the rules above, plus new small blocks beside them)
- `js/views/places.js`, `js/views/mapTab.js` (`focusMapPin` only)
- `js/views/voteBar.js` (new — `places.js` is already 405 lines and must end under 400)
- `docs/tasks/README.md` (board status)

## Do
1. **Map on phones.** Under 760 px give `.map-tab-map` a fixed height (`35dvh`, `flex: none`), at the top of the tab, not sticky. From 760 px keep it sticky beside the list but `height: min(500px, calc(100dvh - <top bar height> - 2 × var(--space-4)))` so a sideways phone sees all of it. Call Leaflet's `invalidateSize()` after layout changes if pins land off-centre (orientation change).
2. **Show on map** (`focusMapPin`): under 760 px scroll the map into view first, then pan/open the popup as now.
3. **`js/views/voteBar.js`:** `voteBar({ votes, myUid, onVote })` → a group of three `<button>`s (`love`, `like`, `pass` icon + count), each 44 px tall, `aria-label` "Love · 2", `aria-pressed` for the viewer's own vote, filled `--forest` when pressed. Each click calls `event.preventDefault()` and `event.stopPropagation()` (it lives inside a `<summary>`) and then `onVote(choice)` with the same choice/clear behavior `rankControl` uses. Disable the bar while the write is pending; on error show the existing inline error.
4. **Row summary** (`renderPlaceRow`): category dot + name on line one, name wrapping to at most two lines (`-webkit-line-clamp: 2`, no `white-space: nowrap`), then the vote bar — its own line under 760 px, right of the name from 760 px. Replace `compactVoteSummary` with it (delete the old function and its CSS if unused). In the open body keep who-voted-what from `rankControl` but not a second set of vote buttons.
5. **One row open.** Replace the `openPlaceIds` Set with a single `openPlaceId`. Opening a row closes every other row and scrolls it with `scrollIntoView({ block: "nearest" })`. The marker → row path (around line 393) uses the same single id. A live update still never closes the open row.
6. Check 375 px upright and 844 × 390 sideways in `docs/demo/`: no sideways scroll, a name of 60 characters wraps to two lines, all three vote buttons visible.

## Don't
- Don't change votes data, `store.js`, sorting, filters, Stays, or the shared map bar.
- Don't make the phone map sticky or add a show/hide map toggle.
- Don't touch `SPEC.md` (already 4.5).

## Tests
`node tests/run-tests.js` passes (no new pure logic, so no new test file). Manual check in the demo as in step 6.

## Done when
Upright phone: map on top, list under it. Sideways: map and list side by side, map fully on screen. Voting from a closed row works and doesn't open it; long names show in full on two lines; opening a row closes the last one.

## Owner check
1. Phone upright → Map: the map is at the top; scroll down for the list; **Show on map** brings the map back up.
2. Turn the phone sideways: map beside the list, nothing cut off top or bottom.
3. Tap ❤ on a closed row: count goes up, row stays closed. Tap it again: your vote clears.
4. A place with a long name reads in full. Open one row, then another: the first closes.
