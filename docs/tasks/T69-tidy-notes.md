# T69 — Tidy place notes from My Maps

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** S
**Codex:** GPT-5.6 Terra, medium · **Depends on:** T68 · **If it fails twice:** Opus, medium (Codex: GPT-5.6 Sol, medium)
**Owner steps first:** none

## Goal
A place imported from My Maps currently shows its note as one run-on line with literal `<br>` tags, because My Maps sends its data-table columns as HTML (`Address: …<br>Layer: …<br>Notes: …`). Notes become readable: cleaned of HTML on import and when edited, and laid out on the place row as a label/value list with short links. Different maps carry different columns, so **nothing may assume which labels exist** — every field is shown, in its original order; trimming redundant data is the user's job in My Maps. Places already imported look right too, without re-importing.

Real example of a stored note (one line in the app today):
```
Latitude: 39.7489200<br>Longitude: -105.0084000<br>Address: 1000 Chopper Cir, Denver, CO 80204<br>Layer: 01 Events & Seasonal<br>Activity / Events: Avalanche vs Lightning; Nuggets vs Warriors<br>Date / Time (Denver local): Fri Oct 23, 7 PM (Avs vs Lightning) | Mon Oct 26, 8 PM (Nuggets vs Warriors)<br>Notes: One venue pin combines three selections.<br>Source URL: https://www.ballarena.com/misc/all-events<br>Other Sources: https://www.avalanchetix.com/5k
```

## Read (only these)
- `SPEC.md` §9.7 — the **Notes from My Maps** bullet (grep `Notes from My Maps`); it is the exact behavior
- `js/lib/kmlimport.js` lines 1–45 (`decodeEntities`, `parsePlacemark`)
- `js/views/places.js` lines 208–216 (`renderPlaceRow`'s `bodyDetails`)
- `js/views/placeForm.js` lines 210–220 (`editPlaceDialog`)
- `js/ui.js` — `externalLink()` only (grep it; around line 60)
- `css/styles.css` — grep `.place-row-body` and read that rule only
- `tests/kmlimport.test.js` lines 1–20, to copy the test style

## Files you may change
- `js/lib/notes.js` (new), `tests/notes.test.js` (new)
- `js/lib/kmlimport.js`, `tests/kmlimport.test.js`
- `js/views/places.js` (`renderPlaceRow` note line only), `js/views/placeForm.js` (`editPlaceDialog` note prefill only)
- `css/styles.css` (one new small block after `.place-row-body`)
- `docs/tasks/README.md` (board status)

## Do
1. **`js/lib/notes.js`** (pure, no DOM), per §9.7:
   - `cleanNoteText(text)`: `<br>`, `<br/>`, `<br />` (any case) and `</p>`, `</div>` → `\n`; strip every other tag; decode `&amp; &lt; &gt; &quot; &#39; &apos; &nbsp;` (decode `&amp;` last); trim each line; drop blank lines; join with `\n`. Plain text without tags comes back unchanged apart from trimming.
   - `formatNote(text)`: run `cleanNoteText`, then one block per line, in order — `{ type: "field", label, values: [...] }` when the line matches `Label: value` (label 1–40 chars, no `/`, not `http`/`https`; value non-empty; values split on ` | ` and trimmed), else `{ type: "text", text }`.
   - `splitLinks(text)`: returns `[{ text }` | `{ url, host }]` pieces — `http(s)://…` runs up to whitespace become `{ url, host }` with `host` = hostname minus a leading `www.`; trailing `.,;)` stays outside the URL.
2. **`tests/notes.test.js`**: the example note above (8 fields in order, Date/Time value split in two, Latitude kept); a hand-typed one-line note → one text block; mixed text and field lines; `https://x.com` alone is text, not a field "https"; entities and `<b>` stripped; `&amp;lt;` decodes to `&lt;` not `<`; `splitLinks` host and trailing punctuation.
3. **`kmlimport.js`**: `parsePlacemark`'s `note` goes through `cleanNoteText`. Add one test in `kmlimport.test.js` that a `<br>` description becomes lines.
4. **`places.js`** → replace the note `<p>` with a small helper in the same file:
   - Blocks are all text → one `<p>` per line (a one-line hand-typed note looks exactly as before).
   - Otherwise a `<dl class="note-fields">`: each field is a `<dt>` (label) and a `<dd>` per value; text lines are a `<p>` in their place.
   - Every value/line is built from `splitLinks`: text pieces as text nodes, URL pieces with `externalLink(url, host)`. Never `innerHTML`.
5. **`placeForm.js` → `editPlaceDialog`**: the Note textarea is filled with `cleanNoteText(place.note || "")`, so old `<br>` notes are clean when edited and saved clean.
6. **`css/styles.css`**: `.note-fields` — `dt` in `--muted` at the small `--fs-*` size, `dd` with no left margin and a little gap before the next `dt`; long words/URLs wrap (`overflow-wrap: anywhere`). Tokens only, and it must fit at 375 px with no sideways scroll.

## Don't
- Don't hide, rename, reorder or special-case any label (no "skip Latitude", no "Source URL fills Link").
- Don't change the place data model, the search filter, the exports, or what the importer does besides cleaning the note.
- Don't touch `SPEC.md` (already 4.4) or the import dialog.

## Tests
`node tests/run-tests.js` passes. Serve `docs/demo/` and add a note in the demo with a few `Label: value` lines and a URL, then open the row at 375 px to check the layout.

## Done when
The example note shows as a tidy label/value list with two dates on separate lines and links reading "ballarena.com ↗" and "avalanchetix.com ↗"; a plain note looks unchanged; an old note opens in Edit without `<br>` tags.

## Owner check
1. Map → open an already-imported place (e.g. the Ball Arena pin): the note is a list — Address, Activity / Events, Date / Time and so on — each on its own line, dates split, links short and tappable.
2. Open a place with a note you typed yourself: it looks as before.
3. Edit the Ball Arena place: the Note box shows clean lines, no `<br>`. Save without changes; the card still looks right.
4. Import a fresh KML from your map: new places look the same as step 1.
5. On your phone, nothing runs off the right edge.
