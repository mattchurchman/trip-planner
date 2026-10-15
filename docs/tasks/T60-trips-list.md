# T60 — Trips list: readable cards

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** S
**Depends on:** T58 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
The trips list reads at a glance: each trip is one tappable card with a textured header, its stage, friendly dates ("Apr 10 – 22, 2027 · 12 nights"), who's going, and a ⋯ for Delete. Two columns on a computer.

## Read (only these)
- `docs/R7.md` §6 (cards, avatars, topo texture), §7 "Trips list"
- `js/views/trips.js` (all, 92 lines)
- `js/lib/dates.js` exports (`grep -n "^export" js/lib/dates.js`)
- `css/styles.css`: `grep -n "trip-card\|trips-" css/styles.css`, those blocks

## Files you may change
- `js/views/trips.js`, `css/styles.css` (trips list rules), `js/lib/dates.js` + `tests/dates.test.js` (only if `formatDateRange`/nights helpers are missing)

## Do
1. Header row: `h1` "Your trips" + **New trip** (primary, `plus` icon).
2. Card per R7 §7: 64 px header strip (forest + `topo-on-forest` when the start date is in the future, else `--sunk` + `topo-on-paper`), stage chip right in the strip; body with name, date line with nights, stacked `avatar()`s, ⋯ (from T58). The whole card is one link; ⋯ stops propagation.
3. Two-column grid from 760 px, max-width 760 px.
4. Empty state per R7 §6 ("No trips yet." + **New trip**).

## Don't
- Load anything per trip beyond the trip document (no flights, no ribbon — R7 §9).

## Tests
`node tests/run-tests.js` passes. Demo at 390 and 1280 px (two screenshots).

## Done when
No ISO dates on the list; card tap opens the trip; ⋯ → Delete still confirms.

## Owner check
1. Your trips show dates like "Apr 10 – 22, 2027 · 12 nights".
2. Tap anywhere on a card to open it. On a computer the cards sit two across.
