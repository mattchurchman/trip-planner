# T41 — Phone foundation: no zoom, clean header, matching fields

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T40 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The app feels like a phone app: tapping a field never zooms the page, the top bar reads "Trip Planner" with a Help button in the app's own style, and date fields look like every other field. This is the base the rest of Round 6 builds on, so later tasks don't each re-solve it.

## Read (only these)
- `AGENTS.md` §4 (phone first rule)
- `SPEC.md` §4 (look and feel), by section
- `css/styles.css`: `:root` tokens (lines 1–60), `input, select, textarea` (~line 298), `.app-brand`/`.app-name` (~410–430), `a[target="_blank"]::after` (~129), the phone media block (~2200)
- `js/app.js` lines 110–140 (top bar)
- `js/views/overview.js` lines 50–90 (trip dates)

## Files you may change
- `css/styles.css`, `js/app.js`, `js/views/overview.js` (dates layout only), `SPEC.md` §4 (one line per rule you add)

## Do
1. **No zoom on focus.** iPhone zooms into any field under 16 px. Set `input, select, textarea` to `font-size: max(16px, 1rem)` everywhere (dialogs included). Do not use `maximum-scale` or `user-scalable=no` — pinch zoom must keep working.
2. **Date fields match.** Give `input[type="date"]` the same height (44 px min), border, radius, padding and font as text inputs; `-webkit-appearance: none`, `text-align: left`, and an explicit `min-width: 0; width: 100%` so iOS doesn't size it oddly. Check dark mode too.
3. **Trip dates don't touch.** On Overview, Start and End sit side by side with a clear gap from 480 px up and stack below that.
4. **Header reads "Trip Planner".** Show the logo plus "Trip Planner" at every width. On phones the trip name moves to its own line under the bar (smaller, muted, truncated with ellipsis) instead of squeezing the app name out.
5. **Help button matches.** Replace the text link with a round icon button ("?" glyph, `aria-label="Help"`), same size and border as the account avatar, theme colors from tokens, no ↗ arrow (exclude it from the `::after` rule). It still opens `help.html` in a new tab.
6. **Base phone rules.** No horizontal page scroll at 375 px (`overflow-x: clip` on the app shell only if needed after fixing the real overflow), tap targets 44 px, `env(safe-area-inset-*)` respected by the top bar.

## Don't
- Restyle screens beyond the items above (T51–T52 do the per-screen pass).
- Add raw colors; tokens only.

## Tests
`node tests/run-tests.js` passes. Serve locally and load the page with no console errors.

## Done when
Every item above is in, and the sign-in page and help page still look right at 375 px.

## Owner check
1. On the phone, tap any text field (trip name, a traveler, a paste box): the page does not zoom.
2. Top bar shows the logo + "Trip Planner"; the trip name sits under it. The Help "?" matches the avatar button.
3. Overview: Start and End dates have space between them and look like the other fields.
