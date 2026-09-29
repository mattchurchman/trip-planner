# T09 — Coffee & cafés category

**Model:** Haiku · **Depends on:** nothing

## Goal
Add a **Coffee & cafés** place category, recolor Museum & history, and move the category list into its own small file.

## Why
Coffee spots are a big part of how the owner's group travels, and filing them under Food buries them.

## Files you may change
- **new** `js/lib/categories.js`
- `js/views/places.js` (delete its `CATEGORIES` list, import from the new file)
- `js/views/placeForm.js` (import from the new file instead of `./places.js`)
- Any other file that turns out to hard-code category names or colors (search with `grep -rn "Museum & history\|#e8710a" js/ recap.html help.html`)
- `help.html` if it lists categories

## Spec sections
§4 (category table: the exact labels, order and colors).

## Do
1. `categories.js` exports `CATEGORIES` (an array of `{ label, color }` in the §4 order: Food, Coffee & cafés, Drinks & nightlife, …, Other) and `categoryColor(label)`, which returns the "Other" color for unknown labels.
2. Replace every local copy with imports.
3. The new label is exactly `Coffee & cafés` (with the é), because it's stored in the database as written.

## Don't
- Rename any existing category or change any saved place. Existing places keep their categories.
- Change colors other than Museum & history.
- Split or reorganize `places.js`, even though it's over 400 lines. That's a separate job.

## Tests
Add `tests/categories.test.js`: 12 categories; labels unique; "Coffee & cafés" is second; every color is a 6-digit hex; `categoryColor("nonsense")` equals Other's color.

## Done when
Tests pass and `grep -rn "Drinks & nightlife" js/` finds it only in `js/lib/categories.js`.

## Owner check
1. **Add place** → Category shows **Coffee & cafés** second in the list.
2. Add a café. Its map dot is brown; museums are now olive.
3. The Coffee & cafés filter chip on Places works.
4. Export the CSV and KML: the café appears with its category.
