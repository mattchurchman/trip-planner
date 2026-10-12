# T45 — Price check you can see

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T41 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Anyone looking at a flight or stay can tell, without being told, that the price can be updated and how old it is. Same behavior as today (tap → opens the link → "Still $X?" Same/Changed), just obvious.

## Read (only these)
- `js/views/pricePanel.js` lines 200–292 (`priceCheck` and the row it opens)
- `css/styles.css`: search for the price button and price row classes used there
- `docs/mock/routes-mock.html` (the approved look)
- `SPEC.md` §7.9 and §11 (price age, staleness), by section
- `docs/tasks/WORDING.md`

## Files you may change
- `js/views/pricePanel.js`, `css/styles.css` (price control only), `SPEC.md` §7.9, `docs/tasks/WORDING.md`

## Do
1. Make the price a clearly tappable chip, not plain text: the amount plus a small refresh icon (inline SVG or "↻" glyph) and the word **Check** on screens 375 px+ (icon only if the card header is too tight). Border + background from tokens, 44 px tap height, `aria-label="Check price, last $X"`.
2. Under the amount (or in the chip's second line) show the age: **Checked today / 3 days ago**. When stale (§11: none or over 3 days) show the sun dot and switch the wording to **Check price**.
3. No price yet: the chip reads **+ Add price** (not an empty or "—" number).
4. When the row opens, the first line explains the step in plain words, e.g. "Opened the link in a new tab. Is it still $480?" with **Same** / **Changed** as full buttons. **Changed** focuses the amount box.
5. Apply to every place `priceCheck` is used (flight cards, option hops, stay cards) — it's one component, so this should be one change.

## Don't
- Change price history, staleness math or the data model.

## Tests
`node tests/run-tests.js` passes. Load locally with no console errors.

## Done when
A first-time user sees a price chip that says it can be checked, and its age, on every flight and stay card.

## Owner check
1. Hand the phone to someone who hasn't used the app and ask them to update a flight's price. They find it without help.
2. A price older than 3 days shows the sun dot and **Check price**; a stay with no price shows **+ Add price**.
