# T56 — One icon set, no emoji

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T54 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Every icon in the app comes from one consistent line-icon set (24 px grid, 1.75 stroke, round ends) through one helper. The vote emoji, the 🏠 on the Days map and the text "↗" arrows are replaced, so icons look the same on every phone.

## Read (only these)
- `docs/R7.md` §5
- `js/ui.js` `svgEl` (lines 30–41)
- `js/app.js` `TABS` (lines 12–20) and `tabLink` (`grep -n "function tabLink" js/app.js`, ±20)
- `js/views/places.js` lines 165–190 (vote summary), `js/ui.js` `rankControl` (lines 281–303)
- `js/views/daysMap.js` lines 20–40 (house pin)
- `css/styles.css`: `grep -n 'target="_blank"\]' css/styles.css` and the tab bar rules (`grep -n "tab-bar\|tab-icon" css/styles.css`)

## Files you may change
- `js/lib/icons.js` (new), `tests/icons.test.js` (new), `js/ui.js`, `js/app.js` (tab icons only), `js/views/places.js` (vote summary only), `js/views/daysMap.js` (house pin only), `css/styles.css` (icon sizing, tab bar icon, external-link rule)

## Do
1. `js/lib/icons.js`: `export const ICONS` with every name and path from R7 §5, exactly. Test: each entry is a non-empty array of non-empty strings; the names in R7 §5 all exist.
2. `icon(name, { size, label })` in `js/ui.js` as R7 §5 describes (`currentColor`, `aria-hidden` unless labeled). An unknown name returns an empty `<span>` and logs one `console.warn`.
3. Tab bar and top tabs use `icon()` for overview/routes/map/days; remove the inline path strings from `TABS`.
4. `rankControl` and the place-row vote summary use the `love`/`like`/`pass` icons with counts; the viewer's own vote is `--forest`.
5. Days map home-base pin uses `icon("stay")` instead of 🏠.
6. External links: add a helper `externalLink(href, text)` in `js/ui.js` that appends `icon("external", { size: 14 })` and sets `target`/`rel`; keep the CSS `::after` arrow only for links that don't have an `.ext-icon` child (`a[target="_blank"]:not(:has(.ext-icon))::after`). Don't rewrite every existing link — later tasks switch screens over as they touch them.

## Don't
- Restyle buttons or cards (T57). Change any wording.

## Tests
`node tests/run-tests.js` passes including the new icon test. Serve locally: no console errors.

## Done when
No ♥ 👍 👎 🏠 characters remain in `js/` (`grep -rn "👍\|👎\|🏠\|\"♥\"" js/` is empty) and the tab bar draws from `ICONS`.

## Owner check
1. The four tabs at the bottom of your phone show matching line icons.
2. On Map, a place's votes show heart / thumbs-up / circle-x icons, the same on iPhone and Android.
3. On Days, the hotel shows a bed icon instead of a house emoji.
