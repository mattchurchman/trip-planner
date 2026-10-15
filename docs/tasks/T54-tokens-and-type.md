# T54 — Waypoint colors, fonts and six type sizes

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T53 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The whole app switches to the Waypoint palette (forest, marigold, warm paper) in light and dark, uses Gabarito and Figtree, and every piece of text uses one of six sizes. Nothing changes layout yet; screens just look calmer and warmer. Every later Round 7 task builds on these tokens.

## Read (only these)
- `docs/R7.md` §2, §3
- `css/styles.css`: the token blocks (lines 1–50), base type (50–135), `.mono` (`grep -n "\.mono"`); then `grep -n "font-size\|font-family" css/styles.css` for the list to replace — open only those lines
- The `<head>` of `index.html`, `help.html`, `404.html` (first 25 lines each)

## Files you may change
- `css/styles.css`, `index.html`, `help.html`, `404.html` (`<head>` only), `manifest.webmanifest`

## Do
1. Replace the three `:root` blocks with R7 §2's tokens, light and dark, plus the aliases (`--teal` → `--forest`, etc.). Update `--r`, `--radius`, add `--radius-sm`, retint shadows.
2. Add the six `--fs-*` tokens (R7 §3) and the font tokens. Swap the Google Fonts link in all three pages for R7 §3's exact link. Drop JetBrains Mono; restyle `.mono` as R7 §3 says.
3. Replace every `font-size` in `styles.css` with a `--fs-*` token (inputs/selects/textareas keep `max(16px, 1rem)`). Headings: `h1` title, `h2` section, `h3` item, `h4` label style. Delete the phone `h1 { font-size: 26px }` override (title is 26 everywhere now).
4. Search `styles.css` for raw hex colors outside the token blocks and category rules; replace with tokens.
5. `manifest.webmanifest` and the `theme-color` metas per R7 §4 (two metas with `media` for light/dark).

## Don't
- Change any markup outside `<head>`, any JavaScript, or any layout (padding, grid, flex). T57 does components; T60–T64 do screens.
- Rename existing CSS classes.

## Tests
`node tests/run-tests.js` passes. Serve locally, load `index.html` and `help.html`: no console errors. `grep -c "font-size:" css/styles.css` lines all use `var(--fs-` or the input `max(16px…)` rule.

## Done when
`grep -nE "#[0-9a-fA-F]{3,6}" css/styles.css` shows only the token blocks; no `JetBrains` anywhere; every `font-size` is a token.

## Owner check
1. Open the app on your phone in light mode: warm paper background, dark green buttons, new fonts.
2. Switch the phone to dark mode: near-black with mint-green buttons; everything readable.
3. Prices still line up in columns on Routes and Overview.
