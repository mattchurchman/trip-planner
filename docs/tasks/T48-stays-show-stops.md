# T48 — Stays show every stop before any stay is added

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** S
**Depends on:** T46 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
As soon as a route is chosen, Map → Stays lists each stop with its dates, night count, empty coverage bar, hotel search links and an **Add stay** for that stop — before anyone has pasted a stay.

## The bug (known cause)
`js/views/stays.js` ~line 357: `if (stays.length === 0)` replaces the whole list with "No stays yet…" and returns before the stop groups are built. Groups only appear once one stay exists.

## Read (only these)
- `js/views/stays.js` lines 20–110 and 340–412
- `SPEC.md` §7.7 (Stays part), by section

## Files you may change
- `js/views/stays.js`, `css/styles.css` (empty-group hint only), `SPEC.md` §7.7 (one sentence)

## Do
1. When `stops` has entries, always render the groups, even with zero stays. Each empty group shows its dates/nights, the empty coverage bar, the search links, a one-line hint "No stays yet for <City>", and **Add stay** pre-filled with that stop's check-in/out (`stopDefaults` already exists).
2. Only show the old "No stays yet. Search above…" message when there is no route **and** no stays.
3. Keep the "No stop yet" group for stays that match nothing.

## Don't
- Change grouping logic (T46 owns it).

## Tests
`node tests/run-tests.js` passes. Load locally with no console errors.

## Done when
A trip with a chosen route and no stays shows one group per stop with working search links and Add stay.

## Owner check
1. On a trip with routes chosen and no stays, open Map → Stays: every stop is listed with its dates and search links.
2. Tap **Add stay** in a group: check-in/out are already that stop's dates.
