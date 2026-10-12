# T33 — No currency field; traveler details always save

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** S
**Depends on:** — · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Overview no longer asks for a currency: every trip is USD. Typing a traveler's name, home city or home airport and then switching tabs (or getting a live update) never loses what was typed.

## Read (only these)
- `SPEC.md` §5.3 (currency line), §7.5, §8
- `js/views/overview.js` (search `currency`), `js/views/travelers.js`, `js/ui.js` (`renderWhenIdle`)

## Files you may change
- `js/views/overview.js`, `js/views/travelers.js`, `js/views/pasteFlight.js` (currency lines only), `SPEC.md` §5.3, §7.5

## Do
1. Remove the Currency field and its handler from Overview. Leave the `currency` field on trip documents alone and keep formatting money with `trip.currency` (it is always "USD"). SPEC: currency is fixed at USD and not editable.
2. In `pasteFlight.js`, drop the "this trip uses {currency}" branch: a price in another currency shows "Google showed {amount} {code} — type the USD price if you know it."
3. Travelers: save each field on `input`, debounced 600 ms, and also on `change` and `blur`, skipping writes when the value hasn't changed. Flush any pending save when the view is torn down (tab switch) — `travelers.js` needs a returned `flush()` the caller runs on leave, or a `pagehide`/`visibilitychange` listener.
4. Make sure a snapshot rebuild of the travelers list is deferred while one of its inputs has focus (`renderWhenIdle`), so the field being typed in is never replaced.

## Don't
- Change how money is stored or formatted.

## Tests
`node tests/run-tests.js` passes.

## Done when
No currency field; typing a home city then tapping another tab keeps it every time.

## Owner check
1. Overview has no Currency field.
2. Type a home city, immediately tap **Routes**, come back: it's saved. Repeat 5 times on the phone.
