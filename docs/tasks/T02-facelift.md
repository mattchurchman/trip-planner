# T02 — Facelift: colors, type, logo, tab icon

**Model:** Sonnet · **Depends on:** T01

## Goal
Restyle the whole app in the "warm and adventurous" look from SPEC §4: sunset terracotta and deep teal on warm sand, Fraunces headings, a logo in the top bar, and a colored icon in the browser tab.

## Why
The owner feels the app looks like a draft: no single color scheme, weak headings, flat spacing, and a generic browser tab.

## Files you may change
- `css/styles.css` (the main job)
- `index.html`, `help.html`, `recap.html`, `404.html` — `<head>` only: fonts link, favicon, `theme-color`, `<title>`; plus the logo in `help.html` and `recap.html` headers
- `js/app.js` — top bar logo, sign-in card logo, `document.title` per trip ("<trip name> · Trip Planner")
- Class names in `js/views/*.js` **only** where a heading needs to become a real `h1`/`h2`/`h3` or a section heading needs its action on the same row. Don't change any text.
- `img/logo.svg` and `img/favicon.svg` already exist. Use them as they are.

## Spec sections
§4 (all of it). Also skim §7.3 (rank control), §7.8 (price panel) and §7.9 (days) so you restyle those pieces too.

## Do
1. Replace the `:root` variables with exactly the tokens in SPEC §4 (colors, `--space-1`…`--space-7`, radii, shadows). Then go through the whole stylesheet and replace every raw color, spacing and radius value with a token. The only raw colors left should be the 11 category colors.
2. Fonts: one Google Fonts link for Fraunces 600/700 and Inter 400/500/600 with `display=swap`. Apply the type scale table.
3. Headings: every tab gets exactly one clear hierarchy — trip name `h1`, section `h2` with its main button on the same row (`display:flex; justify-content:space-between; align-items:center; gap`), card titles `h3`. Stack the heading and button on phones.
4. Buttons: primary / secondary / quiet / danger as described in §4, with visible `:focus-visible` rings in `--primary`, and one primary button per card or form.
5. Forms: the uppercase small label style; inputs 10 px radius with `--border` and a `--primary` focus ring; comfortable 12–16 px gaps.
6. Badges: status pill and "Chosen" pill in teal (`--secondary` on `--secondary-soft`), **New low** with `--sun`.
7. Top bar: logo 28 px + "Trip Planner" in Fraunces 700; sign-in card gets the 64 px logo above the name.
8. Every HTML page: `<link rel="icon" type="image/svg+xml" href="./img/favicon.svg">`, `<meta name="theme-color" content="#1f5f5b">`, and the titles from §4.
9. Add `@media (prefers-reduced-motion: reduce)` turning transitions off.
10. Check phone width (375 px): no sideways scrolling on any tab.

## Don't
- Change any words on screen (that's T07) or any behavior.
- Redesign the candidate cards' structure (T03) or reorder forms (T04, T05) — just restyle what's there.
- Add images other than the logo.

## Tests
No logic changes. `node tests/run-tests.js` must pass. Serve locally and check the signed-out page, help page and 404 page in a browser; take a screenshot at desktop and 375 px width if you can.

## Done when
`grep -nE "#[0-9a-fA-F]{3,6}" css/styles.css` shows only the `:root` tokens and the category colors. All pages have the favicon and theme color.

## Owner check
1. The browser tab shows the sunset pin icon and the page name.
2. The top bar shows the logo and "Trip Planner" in the new heading font.
3. Go through each tab: headings are clear, buttons look consistent, nothing is cramped or floating oddly.
4. On your phone, the top of the browser is teal (Android Chrome and Safari), and nothing scrolls sideways.
5. Press Tab repeatedly on a page: you can always see which control is focused.
