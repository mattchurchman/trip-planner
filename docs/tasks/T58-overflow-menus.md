# T58 — Delete and Edit move into ⋯ menus

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T57 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
No screen shows a standing red Delete button any more. Each card or row that can be edited or removed gets one ⋯ button holding Edit, Delete and similar actions. Delete still asks for confirmation exactly as today.

## Read (only these)
- `docs/R7.md` §6 "Overflow menu"
- `js/ui.js` `confirmDialog` (lines 78–102) and `dialogShell` (239–280)
- Each site below, ±15 lines only: `grep -n "btn-danger\|\"Delete\"\|Delete idea\|Rename idea" js/views/*.js`

## Files you may change
- `js/ui.js` (add `menuButton`), `css/styles.css` (menu styles), and the view files at the sites listed below — only the button markup there

## Do
1. `menuButton(items, { label })` per R7 §6: `.icon-btn` with `icon("more")`; opens a popover anchored under it from 760 px and a bottom sheet below; items are buttons with an icon and text; danger items in `--bad`; Esc / outside tap closes; focus returns to the trigger; arrow keys move between items.
2. Switch these sites to a ⋯ menu (keep each handler and its confirmation as is):
   - Trips list card: Delete (creator only) — `trips.js`
   - Split cost rows: Edit, Delete — `splitCosts.js`
   - Flight rows on Routes: Edit, Delete — `routeRail.js` `renderFlightRow` and the hop row
   - Idea switch: Rename idea, Delete idea — `routeIdeas.js` (Choose idea stays a button)
   - Option cards: Rename, Delete — `routeRail.js`
   - Place row (open state): Edit, Edit location, Delete — `places.js`
   - Stay cards: Edit, Duplicate, Delete — `stays.js`
   - Day cards: Edit, Delete — `days.js`
   - Comments: Delete (author only) — `comments.js`
   - Price entries: Delete — `pricePanel.js`
3. `.btn-danger` remains only inside confirmation dialogs. Leave a comment at its CSS rule saying so.

## Don't
- Change what any action does, its confirmation text, or who may do it.

## Tests
`node tests/run-tests.js` passes. Serve the demo: open a ⋯ on Trips, Routes and Map with the keyboard (Tab, Enter, arrows, Esc) — no console errors.

## Done when
`grep -n "btn-danger" js/views/*.js` returns nothing; every listed site has a ⋯.

## Owner check
1. Trips list: no red Delete; ⋯ → Delete asks before deleting.
2. Routes: a flight's ⋯ has Edit and Delete; the idea's ⋯ has Rename and Delete.
3. On the phone, ⋯ opens a sheet from the bottom; tapping outside closes it.
