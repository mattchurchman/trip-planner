# T57 — Shared pieces: buttons, cards, rows, chips, top bar

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** L
**Depends on:** T56 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The building blocks every screen uses — buttons, cards, rows, chips, badges, segmented controls, dialogs, avatars, category colors, the top bar — match R7 once, in the stylesheet and a few helpers, so the per-screen tasks only rearrange. The per-tab big trip name disappears; the top bar carries it.

## Read (only these)
- `docs/R7.md` §2 (category colors, stage badge), §6, §7 "Top bar"
- `js/lib/categories.js`
- `js/app.js` `renderTopBar` and `renderTripShell` (lines 115–200)
- `js/views/` — find where each tab renders its `h1` and stage pill: `grep -n "stage-badge\|tripStage\|\"h1\"" js/views/*.js`; open ±10 lines each
- `css/styles.css` by rule: `.btn*`, `.card`, `.chip*`, `.seg*`, `.badge*`/`.pill*`, `.avatar*`, `.icon-btn`, `dialog`, `.app-header`/top bar, `.tab-bar` (use `grep -n` for each selector; open only those blocks)

## Files you may change
- `css/styles.css`, `js/lib/categories.js`, `tests/categories.test.js`, `js/ui.js` (add `avatar(traveler, index)` and `row({...})` helpers), `js/app.js` (top bar only), and in `js/views/*.js` **only** the lines that render the per-tab `h1` + stage pill (remove them)

## Do
1. Category colors → R7 §2's muted set (same order, labels). Update the test's expected values if it checks colors.
2. Restyle per R7 §6: `.btn` family, `.icon-btn`, cards (border not shadow), chips (category dot via `::before` with a `--cat` custom property), badges, segmented control (scroll inside its track under 760 px, selected scrolled into view with `scrollIntoView({ block: "nearest", inline: "center" })`), dialogs/sheets (grab handle on phones), avatars (stable color by traveler order).
3. Add `.row` styles and a `row({ leading, title, subtitle, trailing, href, onClick })` helper; add `avatar()`; use them nowhere yet except where T57 itself needs them.
4. Top bar per R7 §7: two-line trip title on phones (name + "Apr 10 – 22 · 3 travelers"), tabs with active forest-soft pill; desktop shows trip name + dates on the right. Use `formatDateRange` from `js/lib/dates.js` if it exists, else add `formatDateRange(start, end)` there with tests ("Apr 10 – 22, 2027", across months "Mar 28 – Apr 8, 2027", across years, one missing → "Dates not set").
5. Remove the per-tab `h1` trip name and stage pill from Overview, Routes, Map and Days (the stage chip comes back on Overview in T61).
6. Spacing rhythm and page gutters from R7 §6.

## Don't
- Rearrange any screen's sections (T60–T64), add the ⋯ menu (T58), or change wording.

## Tests
`node tests/run-tests.js` passes. Serve the demo (`bash docs/demo/serve.sh`) and look at `#/trip/t1/overview` and `#/trip/t1/routes` at 390 px and 1280 px, light and dark — four screenshots maximum.

## Done when
No tab shows the 30 px trip name block; buttons, chips and cards match R7 §6; no horizontal scroll at 375 px.

## Owner check
1. Open a trip on your phone: the trip name and dates sit in the top bar; the page starts with content right away.
2. Buttons are all the same height; green ones are the main action.
3. On Map, category labels are softer colors with a dot, not bright filled pills.
