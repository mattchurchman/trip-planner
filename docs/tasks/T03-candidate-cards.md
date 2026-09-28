# T03 — Destination idea cards with photos

**Model:** Sonnet · **Depends on:** T01, T02

## Goal
Rebuild the candidate destination cards on the Overview tab: a photo of the city, clear labels for each piece of information, and tidy spacing.

## Why
The owner says the cards are unattractive and hard to read: there are no labels for the information, the spacing is off, and a picture would make each destination easy to recognize.

## Files you may change
- `js/views/candidates.js`
- `js/lookup.js` — add `wikipediaSummary(title)`: fetches the §9.7 URL and returns the parsed JSON, or `null` on 404. Network errors throw.
- **new** `js/lib/photos.js` and **new** `tests/photos.test.js`
- `js/store.js` — add `setCandidatePhoto(tripId, candidateId, photo)` (single-field update of `photo`)
- `css/styles.css` — the candidate cards section

## Spec sections
§5.4 (`photo` field and the missing-vs-null rule), §7.5 (card layout and photo lookups), §9.7 (Wikipedia), §4 (tokens).

## Do
1. `js/lib/photos.js` (pure, no fetch):
   - `wikiSummaryUrl(title)` → the §9.7 URL (spaces to `_`, then `encodeURIComponent`).
   - `photoTitles(city, country)` → `[city, "city, country"]`, skipping blanks and duplicates.
   - `pickPhoto(json)` → `{ url, pageUrl }` or `null`, following the "usable" and "image size" rules in §9.7.
2. In `candidates.js`, a `findPhoto(city, country)` helper that tries each title in order via `lookup.js` and returns the first `pickPhoto` result, or `null` if none. If any request throws, return `undefined` (meaning "try again later") and save nothing.
3. Build the card exactly as listed in §7.5 (photo banner → title row → labeled `<dl>` → ranking → actions → comments). Put the grid and card styles in `styles.css`.
4. Photo lookups: after add, after an edit that changed city or country, and once for a card whose `photo` is missing. Keep a `Set` of candidate ids already being looked up this page load so live updates don't trigger repeat requests.
5. The image gets `alt`, `loading="lazy"`, `referrerpolicy="no-referrer"`, and an `error` handler that swaps in the gradient placeholder.

## Don't
- Store anything but `{ url, pageUrl }` or `null` in `photo`.
- Show an error to the user when a photo can't be found — the placeholder is the answer.
- Use any other image source (Unsplash, Google, etc.). They need keys or aren't allowed.

## Tests (`tests/photos.test.js`)
- `wikiSummaryUrl("Rio de Janeiro")` ends with `/page/summary/Rio_de_Janeiro`; a title with `,` and `é` is encoded.
- `photoTitles("Lisbon", "Portugal")` → both titles; `photoTitles("Lisbon", "")` → one.
- `pickPhoto`: a standard page with a thumbnail `…/thumb/a/ab/X.jpg/320px-X.jpg` → url with `640px-`; disambiguation page → `null`; no images → `null`; image on a host other than `upload.wikimedia.org` → `null`; only `originalimage` → that URL; `pageUrl` comes from `content_urls.desktop.page`.

## Done when
Tests pass, and a local page load shows cards with a photo or the gradient placeholder with no console errors (use a real trip if you can sign in; otherwise say so and describe what you checked).

## Owner check
1. On Overview, existing destination ideas now show a city photo within a few seconds (or the colored placeholder with the first letter).
2. Each card shows labeled rows — Why go, Rough price, When, Link — and hides the empty ones.
3. Add a new idea for a well-known city: its photo appears after saving.
4. Edit a card and change the city: the photo changes to the new city.
5. "Photo: Wikipedia ↗" opens the Wikipedia article.
6. On your phone, cards stack in one column and the photos aren't stretched.
