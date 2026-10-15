# T55 — New logo, app icon and favicon

**Tier:** C · **Model:** Haiku · **Effort:** low · **Size:** S
**Depends on:** T54 · **If it fails twice:** Sonnet
**Owner steps first:** none

## Goal
The browser tab, the top bar, the sign-in card and the phone home screen all show the new Waypoint mark (a dotted path ending in a gold pin). The files are already drawn; this task only puts them in place.

## Read (only these)
- `docs/R7.md` §4
- `js/app.js` `renderTopBar` (`grep -n "app-brand" js/app.js`, ±15 lines)
- `js/views/signin.js` (`grep -n "logo" js/views/signin.js`, ±10 lines)
- `css/styles.css`: `grep -n "app-brand\|app-name\|brand-logo\|signin-logo" css/styles.css`, those rules only

## Files you may change
- `img/favicon.svg`, `img/logo.svg`, `img/app-icon.svg` (new), `img/icons/*.png`, `img/topo-on-forest.svg` and `img/topo-on-paper.svg` (new) — copied from `docs/brand/` exactly
- `js/app.js` (lockup markup only), `js/views/signin.js` (logo `src` and size only), `css/styles.css` (lockup and sign-in logo rules only), `help.html` and `404.html` (logo `<img>` only)

## Do
1. Copy the files as R7 §4's table says (`cp`, don't redraw or edit them).
2. Top bar lockup: mark 28 px + "Trip Planner" (display font 700, 18 px, `letter-spacing: -0.02em`, gap 10 px).
3. Sign-in card: `img/app-icon.svg` at 72 px above the name.
4. Help and 404 headers use `img/logo.svg` at 28 px with the same lockup text style.

## Don't
- Touch anything else on the sign-in page (T65 does it) or the top bar's layout (T57/T60).

## Tests
`node tests/run-tests.js` passes; pages load with no console errors; `cmp docs/brand/favicon.svg img/favicon.svg` is silent.

## Done when
All four places show the new mark; the old orange sunset tile is gone from `img/`.

## Owner check
1. The browser tab shows a small green square with a gold pin.
2. On your iPhone, remove the old home-screen icon, open the site in Safari → Share → Add to Home Screen: the new green icon appears.
