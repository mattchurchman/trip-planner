# T42 — Paste once and it fills in: one link box for every dialog

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T41 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Pasting a link fills in everything below it the first time, every time, in every dialog (flight, stay, place). Opening a paste dialog from a tap reads the clipboard by itself, so on a phone the usual flow is: tap **Paste flight link** → check what it read → Save.

## The bug (known cause)
The read-out under the link box only runs on the `paste` event (`pasteFlight.js:146`, `placeForm.js:93`). When text arrives any other way — the Paste button setting `input.value`, iOS's keyboard Paste suggestion, autofill, typing — no `paste` event fires, so nothing appears until the owner cuts and pastes again. The flight sheet has no Paste button at all.

## Read (only these)
- `js/ui.js` lines 150–175 (`readClipboardText`, `field`)
- `js/views/pasteFlight.js` lines 40–160
- `js/views/stayForm.js` lines 195–240 (its `linkRow` and `tryParseLink`)
- `js/views/placeForm.js` lines 60–110
- `SPEC.md` §7.6 and §9.6, by section

## Files you may change
- `js/ui.js`, `js/views/pasteFlight.js`, `js/views/stayForm.js`, `js/views/placeForm.js`, `js/lib/links.js` (+ `tests/links.test.js`), `css/styles.css` (link row only), `SPEC.md` §7.6 (a few lines)

## Do
1. Add one helper to `ui.js`, e.g. `linkField({ placeholder, ariaLabel, onLink })` → `{ row, input, fill(text) }`: the text box plus a **Paste** button. It calls `onLink(text)` on `paste` (next tick), on `input` (debounced ~250 ms), and right after the button or `fill()` sets the value. Skip a call when the text hasn't changed since the last one.
2. Add pure `looksLikeLink(text)` to `js/lib/links.js` (trimmed, starts with `http://`/`https://` or a bare `www.`/known-domain link) with tests.
3. Use the helper in all three dialogs; delete their own copies of the button and listeners.
4. **Auto-read on open.** When a paste dialog opens from a button tap and the box is empty, call `readClipboardText()` once; if `looksLikeLink`, `fill()` it. If the browser refuses or shows its own Paste bubble, that's fine: the box and button still work. Never auto-read in edit mode or when the box already has text.
5. Keep the read-out under the box (`.link-parse-result`) visible and updated on every change, including "Couldn't read this link — fill in below".

## Don't
- Change what the link readers (`flightlink.js`, `staylink.js`, `mapsurl.js`) extract.
- Read the clipboard without a user tap starting it.

## Tests
`node tests/run-tests.js` passes, including new `looksLikeLink` cases.

## Done when
In all three dialogs, text arriving by paste, by the button, by auto-read or by typing shows the read-out without any second paste.

## Owner check
1. Phone: copy a Google Flights link, tap **Paste flight link** on Routes. The box fills (after tapping iPhone's Paste bubble if it shows) and the flights appear underneath straight away.
2. Same for a Booking/Airbnb link in Add stay and a Google Maps link in Add place.
3. Long-press → Paste into the box by hand: read-out still appears.
