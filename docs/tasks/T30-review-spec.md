# T30 — Final review and SPEC 4.0

**Tier:** A · **Model:** Opus · **Effort:** high · **Size:** L
**Depends on:** T29 · **If it fails twice:** ask the owner
**Owner steps first:** none

## Goal
The code matches the design, nothing dead is left behind, and `SPEC.md` describes the app as it is.

## Read (only these)
- `docs/V4.md` (all), `docs/tasks/README.md`
- `SPEC.md` section by section as you rewrite it
- Code by search, not by reading every file

## Files you may change
- `SPEC.md`, `README.md`, `docs/V4.md` (mark as folded into SPEC), `css/styles.css`, any file where you fix a defect you can show

## Do
1. Review each V4 section against the code. List gaps and bugs. Fix small ones; write anything larger as a **Needs review** task.
2. Remove dead code and CSS: unused exports, the old token aliases from T16, classes nothing uses, store functions nothing calls.
3. Check `firestore.rules` still fits the data (no `publicRecaps`; trip subcollections cover `ideas` and `options`).
4. Rewrite `SPEC.md` as version 4.0: fold V4 in, delete what was removed, keep sections that didn't change. Add a changelog row.
5. Update the owner's guide in `README.md` (everyday use, the new address, how to add a friend).

## Don't
- Add features or restyle.

## Tests
All tests pass. No file over about 400 lines except the two allowed.

## Done when
A findings list is in your final message, split into fixed and not fixed.

## Owner check
Plan one real trip start to finish on your phone and note anything that felt slow or confusing. That list is the start of the next round.
