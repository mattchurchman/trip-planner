# T68 — New category list, with an icon for each

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** S
**Codex:** GPT-5.6 Terra, medium · **Depends on:** T67 · **If it fails twice:** Opus, medium (Codex: GPT-5.6 Sol, medium)
**Owner steps first:** none

## Goal
The place categories become the 13 in `SPEC.md` §4 (the owner's new list, keeping Day Trips), with the colors and icons in that table. Every menu, filter, chip, map marker and timeline tile picks them up from `js/lib/categories.js`. Places saved with an old label are not translated — the owner relabels them by hand — but opening one in Edit and saving without touching Category must keep its old label.

## Read (only these)
- `SPEC.md` §4 — grep for `| Category | Color | Icon |` and read that table plus the paragraph after it; grep for `Category → icon` (one line)
- `js/lib/categories.js` (whole, 24 lines)
- `js/lib/icons.js` (whole, 49 lines) — shows the icon format: each icon is a list of SVG path `d` strings on a 24×24 grid, stroked, no fills, no `<circle>`
- `js/views/dayTimeline.js` lines 1–25 only
- `js/views/placeForm.js` lines 210–218 only (`editPlaceDialog`'s category select)
- `tests/categories.test.js` (whole)

## Files you may change
- `js/lib/categories.js`, `js/lib/icons.js`
- `js/views/dayTimeline.js` (lines 10–23 only), `js/views/placeForm.js` (`editPlaceDialog` only)
- `tests/categories.test.js`
- `docs/demo/demo-seed.js` (category labels only)
- `docs/tasks/README.md` (board status)

## Do
1. **`categories.js`**: replace `CATEGORIES` with the 13 rows of the §4 table, in that order, each `{ label, color, icon }`. Keep `categoryColor()` as it is. Add `categoryIcon(label)` returning the row's `icon`, or `"place"` for an unknown label. Update the header comment (drop "R7's muted set" wording that no longer fits; say the list is §4's).
2. **`icons.js`**: add the 9 missing icon names from the table — `drinks`, `sight`, `museum`, `event`, `sports`, `nature`, `adventure`, `daytrip`, `shopping` (`food`, `coffee`, `walk`, `place` exist). Base each on its Lucide icon (ISC licence, free to copy): martini, camera, landmark, calendar-days, trophy, trees, compass, route, shopping-bag. Write them in this file's format — path `d` strings only; turn any Lucide `<circle>`/`<rect>`/`<line>` into path commands (a circle is `M cx-r cy a r r 0 1 0 2r 0 a r r 0 1 0 -2r 0`, as `place` does). If you can't fetch Lucide, draw a simple equivalent at the same stroke weight; recognizable beats exact.
3. **`dayTimeline.js`**: delete `categoryIconName()` and use `categoryIcon()` from `categories.js` in `iconTile()`. Fix the comment that says to add icons only alongside R7.
4. **`placeForm.js` → `editPlaceDialog`**: if `place.category` isn't one of `CATEGORIES`' labels (and isn't empty), add one extra option at the top, value = the old label, text = `"<old label> (old)"`, selected. Otherwise unchanged. The Add dialog is untouched.
5. **`tests/categories.test.js`**: update to 13 entries, the new second label ("Coffee & Cafés"), new known-color checks; add: every row has an `icon` that exists in `ICONS`; `categoryIcon` falls back to `"place"`.
6. **`docs/demo/demo-seed.js`**: relabel the demo places to new labels (Museum & history → Arts, Museums & Culture; Neighborhood walk → Neighborhoods & Walks; Sight → Sights & Landmarks; Drinks & nightlife → Bars & Nightlife; Day trip → Day Trips; Food → Food & Dining; any others to their obvious new name). Labels only.

## Don't
- Don't translate or rewrite any stored place, and don't add an alias map — the owner relabels by hand.
- Don't touch the import dialog: imported layers still default to **Other**.
- Don't show category icons anywhere new; the Days timeline tile is the only place they appear.
- Don't touch `SPEC.md` (already updated to 4.4), `tests/exporters.test.js` (its "Sight" is just test data), or `css/styles.css`.

## Tests
`node tests/run-tests.js` passes. Then serve `docs/demo/` (see `docs/demo/README.md`) and load the Map and Days tabs once to catch JavaScript errors and look at the new icons at 18 px.

## Done when
The Map filters, Add/Edit category menus and markers show the 13 new categories in order; every Days timeline tile has its own icon; an old-label place opens in Edit with "<label> (old)" selected.

## Owner check
1. Map → Filters: the category chips are the 13 new ones, in your order, ending in Day Trips, Shopping & Markets, Other.
2. Add a place and open the Category menu: same 13.
3. Open an older place (still on an old label, e.g. "Food") with Edit: Category shows "Food (old)". Change it to "Food & Dining", save, and its dot changes color.
4. Days: each place in the timeline has an icon that fits its category.
5. If a color or icon reads badly on your phone, say which — a color is a one-line change in `categories.js`.
