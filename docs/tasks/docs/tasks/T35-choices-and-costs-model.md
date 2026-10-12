# T35 — Per-traveler choices, "who's it for", merged stops (spec + logic)

**Tier:** A · **Model:** Opus · **Effort:** high · **Size:** L
**Depends on:** T34 · **If it fails twice:** stop and ask the owner
**Owner steps first:** none

## Goal
Each traveler chooses their own idea and their own option, as two separate actions. Every cost knows who it is for, filled in automatically and overridable. Map, Stays and Days read one merged route built from everyone's choices. This task writes the spec, the data helpers and the pure logic with tests. It does **not** rebuild screens (T36–T39), but it must leave every screen working on the new fields.

## The design (owner-approved 2026-10-12)

**Choices** — on the trip doc:
```
choices: { [travelerId]: { ideaId: string | null, optionId: string | null } }
```
Written with field paths (`choices.<travelerId>.ideaId`) so two people never overwrite each other. Choosing an option does not choose its idea, and nothing one traveler chooses changes another's. `chosenOptionId` is retired: on read, a traveler with no `choices` entry inherits the old `chosenOptionId` (and that option's idea). Never write `chosenOptionId` again.

**Who it's for** — new field on `flights`, `stays`, `costs`:
```
forTravelerIds: [travelerId] | null   // null = automatic
```
Automatic values:
| Item | Automatic travelers | Split |
|---|---|---|
| Home flight | `[travelerId]` | its price only (price is per person) |
| Hop | travelers whose chosen option is its option | full price to each (price is per person) |
| Stay | travelers present on any of its nights (from their own stops) — everyone if no one has stops yet | total split equally among them |
| Split cost | everyone | split equally |

**A traveler's total** = their picked home flights *under their chosen idea* + hops they're for + their stay shares + their cost shares. Missing prices keep the "at least $X" rule (§11). Returns a breakdown `{ homeCents, hopCents, stayCents, costCents, totalCents, complete, missing }`.

**Merged stops** — each traveler's stops come from `stopsFor` with their own chosen idea's picked home flights and their chosen option's hops. Merge by `cityKey` in order of first arrival: `from` = earliest, `to` = latest, plus `nights: [{ date, travelerIds }]`. A traveler with no chosen option adds nothing. Map chips, Stays groups, Days creation and `stopKey` matching all use merged stops. The trip stage counts as "route chosen" when any traveler has an option.

## Read (only these)
- `SPEC.md` §5.3, §5.4 (flights, stays, costs), §7.5, §7.6, §7.7 (Stays), §7.8, §11
- `js/lib/route.js` (`stopsFor`, `totalFor`), `js/lib/totals.js` (`computeBudget`), `js/lib/coverage.js`, `js/lib/selection.js`, `js/lib/stage.js`, `js/lib/dayplan.js` (search `stops`)
- `js/store.js`: search `chosenOptionId`, `setChosenOption`, `addCost`, `updateCost`
- Callers of `chosenOptionId`: `grep -rn chosenOptionId js`

## Files you may change
- `SPEC.md` (§5.3, §5.4, §7.5–§7.8, §11, §13 change log → 4.1)
- New `js/lib/choices.js` + `tests/choices.test.js`: `choiceFor(trip, travelerId, options)` (with the legacy fallback), `forTravelers(item, kind, ctx)`, `travelerBreakdown(...)`, `mergeStops(perTravelerStops)`
- `js/lib/route.js`, `js/lib/totals.js`, `js/lib/coverage.js`, `js/lib/stage.js`, `js/lib/dayplan.js` and their tests
- `js/store.js`: `setChoice(tripId, travelerId, { ideaId?, optionId? })`, `setForTravelers(tripId, subcollection, id, ids | null)`; remove `setChosenOption`
- Minimal wiring only in `js/views/routes.js`, `overview.js`, `mapTab.js`, `days.js`, `stays.js` so they read `choices`/merged stops instead of `chosenOptionId` (the existing **Choose this option** button calls `setChoice` for the selected traveler). No new UI.
- `firestore.rules` only if needed (it doesn't validate trip fields today — confirm and leave it)

## Do
1. SPEC first, exactly as above, then helpers with tests, then the wiring.
2. Tests must cover: legacy fallback; choosing an option leaves the idea alone; hop automatic travelers; stay split when one traveler leaves early; override beats automatic; merged stop range and per-night travelers; total breakdown with a missing price.

## Don't
- Build the new Routes, Overview or Stays UI.
- Delete old fields from existing documents.

## Tests
`node tests/run-tests.js` passes, including the new file.

## Done when
All screens load and use the new model; old trips still show their previous choice.

## Owner check
1. Open an existing trip: Routes, Map and Days look as before (the old choice carried over).
2. On Routes switch traveler, press **Choose this option** on a different option: the first traveler's choice doesn't change.
