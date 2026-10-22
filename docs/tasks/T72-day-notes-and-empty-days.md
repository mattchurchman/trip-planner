# T72 — Days: show the day's note, spot empty days

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Codex:** GPT-5.6 Terra, medium · **Depends on:** T71 · **If it fails twice:** Opus, medium (Codex: GPT-5.6 Sol, medium)
**Owner steps first:** none

## Goal
Days already store a note (`days.notes`, editable in Edit day) but it is shown nowhere, and in a long trip the day chooser gives no clue which days are still empty. After this task the selected day shows its note under the header ("Rain likely", "Concert maybe tonight") with **+ Add note** when it has none, and every day chip shows its place count or an empty-day dot, with **Next empty ›** to jump through the gaps.

## Read (only these)
- `SPEC.md` §7.8 — the **day chooser** bullet and the header bullet (grep `T72`); they are the exact behavior
- `js/views/days.js` lines 20–110 (`dayFormDialog`, labels, `dayChip`) and 270–340 (`renderChooser`, `renderDayFocus`)
- `js/lib/dayplan.js` — exports list only (`grep -n '^export'`), and `tests/dayplan.test.js` lines 1–20 for test style
- `js/lib/notes.js` — `splitLinks` only; `js/views/places.js` — grep `splitLinks` to see how a note line is built with `externalLink`
- `css/styles.css` — grep `.day-chip` and `.day-focus` rules only
- `docs/tasks/WORDING.md` — the **Round 11** section

## Files you may change
- `js/lib/dayplan.js`, `tests/dayplan.test.js`
- `js/views/days.js`, `js/views/dayChooser.js` (new — `days.js` is 383 lines; move `dayChip` + `renderChooser` there so both files stay under 400)
- `css/styles.css` (`.day-chip*`, `.day-focus*` and new small blocks beside them)
- `docs/tasks/README.md` (board status)

## Do
1. **`dayplan.js`** (pure): `placeCountsByDay(days, places)` → `{ [dayId]: n }` (every day present, 0 when none); `nextEmptyDayId(sortedDays, counts, fromId)` → the first day after `fromId` with 0 places, wrapping round, `null` when none. Tests: counts include zero days; next-empty wraps; skips the selected day; null when all planned; places with a `dayId` not in `days` are ignored.
2. **`dayChooser.js`:** move `dayChip`/`renderChooser` here. A day chip gains a corner badge with its count (small type, `--forest`), or a `--sun` dot when 0; a day with a non-empty `notes` shows a 12 px `edit` icon under the number. `aria-label` per WORDING. Dashed "missing" chips and the **+** chip are unchanged.
3. **Status line under the chooser:** "{N} days with nothing planned" + **Next empty ›** (secondary small button) → selects `nextEmptyDayId(...)` and `scrollIntoView({ inline: "nearest", block: "nearest" })` its chip; "Every day has something planned" with no button when none are empty. Hidden when there are no days.
4. **Day note** in `renderDayFocus`: under the subtitle, one `<p>` per line of `day.notes`, built with `splitLinks` + `externalLink` (never `innerHTML`), in a tappable block (a `<button>` styled as plain text, 44 px min height) that opens Edit day; with no note, a text button **+ Add note** that does the same. `dayFormDialog` gets an option to focus the Notes box instead of the title; use it here.
5. Check at 375 px in `docs/demo/` with 14+ days: chips readable, no sideways page scroll, badge never covers the date.

## Don't
- Don't change the day data model, the timeline, the map, Walk it or Export.
- Don't add inline note editing or new fields (weather etc.) — the note is free text.
- Don't touch `SPEC.md` (already 4.5).

## Tests
`node tests/run-tests.js` passes, including the new `dayplan` tests.

## Done when
Empty days carry the dot, planned days a count; **Next empty ›** steps through empty days and wraps; the selected day's note shows (links short and tappable) and **+ Add note** / tapping the note opens Edit day on the Notes box.

## Owner check
1. Days on your phone: scroll the chip row — empty days have a small orange-ish dot, others a number.
2. Tap **Next empty ›** a few times: it hops between empty days and comes back round.
3. On a day with no note tap **+ Add note**, type "Rain likely", save: it shows under the header and the chip gets a small pencil mark.
4. Tap the note: Edit day opens with the cursor in Notes.
