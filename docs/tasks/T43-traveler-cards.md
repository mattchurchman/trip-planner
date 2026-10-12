# T43 — Travelers as cards with a Save sheet

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T41 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
Each traveler is an easy-to-tell-apart card, and editing one is a single sheet with all their fields and one **Save** — no more typing one field, tapping away, and waiting.

## The bug (known cause)
`js/views/travelers.js` saves each field ~600 ms after typing stops. The save updates the trip, the trip's live update re-runs `renderTravelers`, and `replaceChildren` swaps in new inputs, so the field being typed in disappears and focus is lost. `commit()` also builds the travelers list from the `trip` captured at render time, so two quick edits can overwrite each other.

## Read (only these)
- `js/views/travelers.js` (whole, 151 lines)
- `js/views/overview.js`: where `renderTravelers` is called and its `flush` is used
- `js/ui.js`: `dialogShell`, `field`, `setPending`
- `SPEC.md` §7.5 and §8, by section

## Files you may change
- `js/views/travelers.js`, `js/views/overview.js` (call site only), `css/styles.css` (traveler card styles), `SPEC.md` §7.5

## Do
1. **Card per traveler** (read-only): initial avatar circle (same look as the top-bar avatar), name in bold, one muted line `Home city · AIRPORT` (or "Add home city and airport" as a prompt when empty), an **Edit** button (44 px). Cards separated with the existing card/border tokens so two travelers never blur together. Mark the signed-in user's card "(you)".
2. **Edit sheet** via `dialogShell`: Name, Home city, Home airport (uppercase, max 4), **Save** / **Cancel**, and **Remove traveler** at the bottom as a quiet danger link (keeps the existing confirm and "also delete their flights" steps). Save shows pending, closes on success, shows an inline error on failure.
3. On Save, write from the **latest** trip, not the render-time copy: keep a `getTrip()` getter (or re-read the current `trip` passed on each render) and replace only that traveler's entry.
4. Remove the debounce/flush machinery; `renderTravelers` no longer needs to return a flush. Update the caller.
5. **Add traveler** stays as it is, then opens the new traveler's Edit sheet so home city/airport can be filled straight away.

## Don't
- Change the `travelers` data shape or security rules.
- Touch other Overview cards.

## Tests
`node tests/run-tests.js` passes. Load locally with no console errors.

## Done when
Editing a traveler is one sheet and one Save, and a live update while the sheet is open doesn't close or wipe it.

## Owner check
1. Overview → Edit a traveler → change name, city and airport in one go → Save. All three stick.
2. Two travelers are clearly separate cards on the phone.
3. Add traveler → the edit sheet opens for them.
