# T53 — Help page, wording and final review (Round 6)

**Tier:** A · **Model:** Opus · **Effort:** medium · **Size:** M
**Depends on:** T41–T52 · **If it fails twice:** stop and ask the owner
**Owner steps first:** none

## Goal
The help page and on-screen words describe Round 6, and `SPEC.md` matches the code (version 4.2).

## Read (only these)
- `git log --oneline -15` and `git diff <T40 commit>..HEAD --stat`
- `SPEC.md` §5.3, §5.4, §7.5–§7.9, §11, §13, by section
- `help.html`, `docs/tasks/WORDING.md`

## Files you may change
- `help.html`, `docs/tasks/WORDING.md`, `SPEC.md` (corrections, version bump to 4.2, §13 entry), `README.md` (troubleshooting rows)

## Do
1. Help: traveler cards and the edit sheet, paste fills itself (and iPhone's Paste bubble), checking a price, "I live here", stays listed per stop before any are added, compact places, day names and walking routes.
2. Walk each Round 6 change against SPEC; fix spec wording where the code is right; list (don't fix) code that disagrees.
3. Check every button added in T41–T52 has pending state and an inline error (AGENTS §4).
4. Bump SPEC to 4.2 with a short §13 entry.

## Don't
- Change app code beyond typos in on-screen words.

## Tests
`node tests/run-tests.js` passes.

## Done when
Help matches the app; mismatches are listed in the final message.

## Owner check
1. Open the help page on the phone and follow it once on a test trip.
