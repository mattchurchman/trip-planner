# T22 — Love / Like / Pass

**Tier:** C · **Model:** Haiku · **Effort:** medium · **Size:** S
**Depends on:** T16 (can run any time after it) · **If it fails twice:** Sonnet
**Owner steps first:** none

## Goal
Places are rated Love, Like or Pass with one tap. Stays no longer show voting.

## Read (only these)
- `docs/V4.md` §6 (first bullet)
- `js/lib/votes.js`, `tests/votes.test.js`
- the vote buttons in `js/views/places.js` and `js/views/stays.js` (search for `vote`)

## Files you may change
- `js/lib/votes.js`, `tests/votes.test.js`, `js/views/places.js`, `js/views/stays.js`, `js/views/days.js` (labels only), `js/lib/exporters.js` (the ranking text), `css/styles.css`, `docs/tasks/WORDING.md`

## Do
1. In `votes.js` add `normalizeVote(value)` (must→love, nice→like, skip→pass) and use it everywhere votes are read, so old trips keep working. New votes save as `love`, `like`, `pass`.
2. Sorting: most Loves, then most Likes, Pass-only last.
3. Places: three buttons, the chosen one filled; tapping it again clears your pick. Show each person's pick as their initial.
4. Stays: remove the vote buttons and vote summary. Keep the data.

## Don't
- Change the map pins (T25) or the database field name.

## Tests
Old and new values sort the same way; mixed old/new data; clearing a vote.

## Done when
All tests pass; places show the new buttons; stays show none.

## Owner check
1. On a place, tap **Love**: it moves up. Tap it again: cleared.
2. A place a friend rated before still shows their pick.
