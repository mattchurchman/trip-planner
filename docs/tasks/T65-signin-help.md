# T65 — Sign-in, help and 404 in the new look

**Tier:** C · **Model:** Haiku · **Effort:** medium · **Size:** S
**Depends on:** T64 · **If it fails twice:** Sonnet
**Owner steps first:** none

## Goal
The first thing a friend sees — the sign-in page — and the help and 404 pages match the new look, and the help page explains the shared My Maps link and the reshaped screens.

## Read (only these)
- `docs/R7.md` §7 "Sign-in, help, 404", §8 "Where it shows"
- `js/views/signin.js` (all, ~130 lines)
- `help.html` section headings (`grep -n "<h2\|<h3\|id=" help.html`), then only the sections you edit
- `docs/tasks/WORDING.md` sections "Shared My Maps link (T59)" and any Round 7 strings

## Files you may change
- `js/views/signin.js` (markup/classes), `css/styles.css` (sign-in and help rules), `help.html`, `404.html` (body only)

## Do
1. Sign-in: forest panel with topo texture, 72 px app icon, "Trip Planner", "Plan the trip together." (replaces the retired "…to the recap" line), then the existing card. Same controls and behavior.
2. Help: tokens, fonts and lockup; add a "Share your My Maps map" section (where to copy the link, where to paste it, **Get KML** → **Import**); update steps that mention moved controls (Delete and Edit in ⋯, Filters button, Export button on Days, Edit trip on Overview).
3. 404: lockup + one line + a **Back to your trips** primary button.

## Don't
- Change sign-in logic or any app screen.

## Tests
`node tests/run-tests.js` passes. Demo `?signedout#/` at 390 px (one screenshot); `help.html` loads with no console errors.

## Done when
No page mentions the recap; help covers every control R7 moved.

## Owner check
1. Sign out (or open a private window): the sign-in page shows the green panel and new icon.
2. Open Help from the **?** and find "Share your My Maps map".
