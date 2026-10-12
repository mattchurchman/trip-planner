# T40 — Help page, wording and final review (Round 5)

**Tier:** A · **Model:** Opus · **Effort:** medium · **Size:** M
**Depends on:** T32–T39 · **If it fails twice:** stop and ask the owner
**Owner steps first:** none

## Goal
The help page and on-screen words describe the new flow, and the spec matches the code.

## Read (only these)
- `SPEC.md` §7, §11, §13 (by section)
- `help.html`, `docs/tasks/WORDING.md`
- `git log --oneline -12` and `git diff <T31 commit>..HEAD --stat` to see what changed

## Files you may change
- `help.html`, `docs/tasks/WORDING.md`, `SPEC.md` (corrections and §13 entry only), `README.md` (troubleshooting rows)

## Do
1. Help: per-section paste buttons, choosing ideas and options per traveler, "Who's this for?", how totals add up, stays finding their stop, the house pin on Days, iPhone sign-in advice from T32.
2. Walk each changed screen's code against SPEC; fix spec wording where the code is right, and list (don't fix) code that disagrees.
3. Check every button added in T32–T39 has a pending state and an inline error (AGENTS §4).

## Don't
- Change app code beyond typos in on-screen words.

## Tests
`node tests/run-tests.js` passes.

## Done when
Help matches the app; mismatches are listed in the final message.

## Owner check
1. Open the help page on the phone and follow it once on a test trip.
