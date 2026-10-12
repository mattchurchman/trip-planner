# T37 — Overview: each traveler's costs, split costs with "who's it for"

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T35 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The Budget card shows one row per traveler with four parts — flights from home, option flights, stays, split costs — and their total, then everyone together. Split costs can be for everyone or for chosen people.

## Read (only these)
- `SPEC.md` §7.5, §11 (as changed by T35)
- `js/views/overview.js` (Route and Budget sections), `js/views/splitCosts.js`, `js/lib/choices.js` (exports only)

## Files you may change
- `js/views/overview.js`, `js/views/splitCosts.js`, `css/styles.css`, `SPEC.md` §7.5, `docs/tasks/WORDING.md`

## Do
1. Route section: one line per traveler with their chosen idea and option names ("Sam · Rome round trip · Florence + Barcelona"), or "Not chosen yet" linking to Routes.
2. Budget: per traveler, a collapsed `<details>` with the four parts and the total from `travelerBreakdown`; "at least" and the missing list as today.
3. Split cost dialog: add **Who's this for?** (Everyone / pick travelers); the row shows "÷ 2 · Matt, Sam" when not everyone.

## Don't
- Change how stays or flights are priced.

## Tests
`node tests/run-tests.js` passes.

## Done when
Every traveler's total adds up from its four visible parts.

## Owner check
1. Two travelers on different options: their option-flight amounts differ.
2. Add a split cost for one person only: only their stays/costs line moves.
