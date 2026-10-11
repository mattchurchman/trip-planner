# T16 — New look and phone navigation

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** L
**Depends on:** T15 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The whole app wears the approved look from the mock: new colors, type, buttons and cards, automatic dark mode, and a bottom tab bar on phones.

## Read (only these)
- `docs/V4.md` §2
- `docs/mock/routes-mock.html` — the `<style>` block and the `nav` markup
- `css/styles.css` — read the token block and section headings first, then work section by section
- `js/app.js` (`renderTopBar`, `renderTripShell`)

## Files you may change
- `css/styles.css`, the font `<link>` in every `.html`, `js/app.js` (top bar and tab bar markup only), `js/ui.js` (add a `toast(message)` helper if none exists)

## Do
1. Replace the `:root` tokens with the V4 set, light and dark, in the three-block shape used in the mock. Keep the old token **names** as aliases (`--primary: var(--teal)` and so on) so no screen breaks; T30 removes the aliases.
2. Swap the fonts and the type scale. Headings Bricolage Grotesque, body Instrument Sans, prices/codes/dates JetBrains Mono via one `.mono` class.
3. Restyle the shared pieces once: buttons, inputs, cards, dialogs, pills, badges. Add the mock's segmented control, chip and toast as reusable classes.
4. Navigation: under 760 px a fixed bottom tab bar with icon and label; from 760 px the tabs sit in the top bar. Top bar becomes logo, trip name, Help, and an account menu holding Sign out. Pad fixed bars with the safe-area insets and give the page bottom padding so nothing hides behind the bar.
5. Make sure no screen has raw colors that break in dark mode (search `styles.css` for `#`), category colors excepted. Leaflet tiles stay as they are.

## Don't
- Change what any screen does, its layout structure, or its wording.
- Rename CSS classes used by the JavaScript.

## Tests
Existing tests pass.

## Done when
Every tab loads without console errors; you compared the sign-in screen and at least the trips list against the mock's tokens at 375 px and 1280 px, in light and dark; no horizontal scrolling at 375 px.

## Owner check
1. On your iPhone the tab bar sits at the bottom and clears the home indicator.
2. Switch the phone to dark mode: every screen stays readable.
3. Click through each tab on a computer: everything still works, nothing overlaps.
4. Tell the agent anything that looks off; stay in the same session for fixes.
