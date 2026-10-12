# Task board

Each task is one session. The rules every agent follows are in `AGENTS.md`; models, effort and backup agents are in `docs/MODEL_TIERS.md`.

## How to run a task

1. Clear the context or open a **new** session on the `trip-planner` repo.
2. Select the model and effort from the table.
3. Send one line, with the task number, model and effort filled in:

   > Read AGENTS.md, then do task T14. Model: Sonnet. Effort: medium. You may push to master when tests pass.

4. If the task has **Owner steps first**, the agent lists them and waits for you.
5. When it finishes, wait a minute or two for the site to update, then click through the task's **Owner check**. If something fails, stay in the same session and describe what you did and what you saw.
6. The agent ends by telling you the next task and which model and effort to select. Start it only after this one is **Done**.

If a task fails twice, say "Revert the last commit" and rerun it in a fresh session on the model named in its **If it fails twice** line.

## Round 3 — the V4 overhaul (now folded into `SPEC.md` 4.0)

| # | Task | Model | Effort | Depends on | Status |
|---|---|---|---|---|---|
| T14 | [Home-screen app and Firebase Hosting](T14-app-shell-hosting.md) | Sonnet | medium | — | Done (2026-10-11) |
| T15 | [Sign-in that sticks on iPhone](T15-sign-in.md) | Sonnet | high | T14 | Done (2026-10-11) |
| T16 | [New look and phone navigation](T16-design-refresh.md) | Sonnet | high | T15 | Done (2026-10-11) |
| T17 | [Airport lookup](T17-airports.md) | Sonnet | low | — | Done (2026-10-11) |
| T18 | [Route logic](T18-route-logic.md) | Opus | high | T17 | Done (2026-10-11) |
| T19 | [Routes tab](T19-routes-screen.md) | Sonnet | high | T16, T18 | Done (2026-10-11) |
| T20 | [Paste a flight link and it files itself](T20-paste-flights.md) | Sonnet | high | T19 | Done (2026-10-11) |
| T21 | [Two-tap price check](T21-price-check.md) | Sonnet | medium | T20 | Done (2026-10-11) |
| T22 | [Love / Like / Pass](T22-love-like-pass.md) | Haiku | medium | T16 | Done (2026-10-11) |
| T23 | [Slim Overview, remove Recap and destination ideas](T23-overview-cleanup.md) | Sonnet | medium | T21 | Done (2026-10-11) |
| T24 | [Stays by stop, with night coverage](T24-stays-by-stop.md) | Sonnet | high | T23 | Done (2026-10-11) |
| T25 | [One Map tab for places and stays](T25-map-tab.md) | Sonnet | high | T22, T24 | Done (2026-10-11) |
| T26 | [Import places from Google My Maps](T26-mymaps-import.md) | Sonnet | medium | T25 | Done (2026-10-11) |
| T27 | [Plan days on the map](T27-days-map.md) | Sonnet | high | T25 | Done (2026-10-12) |
| T28 | [Take the plan to Google Maps](T28-export-google.md) | Haiku | medium | T27 | Done (2026-10-12) |
| T29 | [Help page for the new flow](T29-help.md) | Haiku | medium | T28 | Done (2026-10-12) |
| T30 | [Final review and SPEC 4.0](T30-review-spec.md) | Opus | high | T29 | Done (2026-10-12) |

**Round 3 is finished.** `docs/V4.md` is folded into `SPEC.md` 4.0, which is the single source of truth again — read `SPEC.md`, not V4, for anything new.

## Round 4 — found during the T30 review

| # | Task | Model | Effort | Depends on | Status |
|---|---|---|---|---|---|
| T31 | [Give the search links a city again](T31-search-link-cities.md) | Sonnet | medium | T30 | Done (2026-10-12) |

## Round 5 — owner testing, 2026-10-12 (spec 4.1)

| # | Task | Model | Effort | Depends on | Status |
|---|---|---|---|---|---|
| T32 | [Google sign-in on phones](T32-phone-sign-in.md) | Sonnet | high | — | Done (2026-10-12) |
| T33 | [No currency field; traveler details always save](T33-overview-fixes.md) | Sonnet | medium | — | Done (2026-10-12) |
| T34 | [Paste where it goes: one button per section](T34-scoped-paste.md) | Sonnet | high | — | Done (2026-10-12) |
| T35 | [Per-traveler choices, "who's it for", merged stops](T35-choices-and-costs-model.md) | Opus | high | T34 | Done (2026-10-12) |
| T36 | [Routes: choose ideas and options separately, clear costs](T36-routes-choose-and-costs.md) | Sonnet | high | T35 | Done (2026-10-12) |
| T37 | [Overview: each traveler's costs](T37-overview-costs.md) | Sonnet | medium | T35 | Done (2026-10-12) |
| T38 | [Stays: merged stops, stays find their stop, Choose button](T38-stays-merged.md) | Sonnet | high | T35 | Done (2026-10-12) |
| T39 | [Chosen stays on the Days map and walking routes](T39-stays-on-days.md) | Sonnet | high | T38 | Done (2026-10-12) |
| T40 | [Help page, wording and final review](T40-review-round5.md) | Opus | medium | T32–T39 | To do |

**Order.** T32 and T33 touch nothing else and can run any time. T34 → T35 → T36 → T37 → T38 → T39 → T40 one at a time; T36–T38 all depend only on T35 but share screens, so don't run them side by side.

**Order.** Top to bottom is the safe path. Two tasks can be done early or alongside others because they touch nothing else: **T17** (any time before T18) and **T22** (any time after T16). Everything else changes shared screens, so run those one at a time.

**Natural stopping points** where the app is fully usable: after T15 (sign-in fixed), after T21 (Routes complete), after T25 (Map complete), after T30.

## Earlier rounds (history)

| # | Task | Model | Depends on | Status |
|---|---|---|---|---|
| T01 | [Split big files, one place for outside lookups](T01-split-files.md) | Sonnet | — | Done (2026-09-27) |
| T02 | [Facelift: colors, type, logo, tab icon](T02-facelift.md) | Sonnet | T01 | Done (2026-09-27) |
| T03 | [Destination idea cards with photos](T03-candidate-cards.md) | Sonnet | T01, T02 | Done (2026-09-27) |
| T04 | [Places: find on Google Maps first](T04-places-link-first.md) | Haiku (Sonnet if it struggles) | T01, T02 | Done (2026-09-27) |
| T05 | [Flights & stays: paste a link first](T05-travel-link-first.md) | Sonnet | T01, T02 | Done (2026-09-27) |
| T06 | [Choose several flights and stays](T06-multi-select.md) | Sonnet (Opus if it fails once) | T05 | Done (2026-09-28) |
| T07 | [Clearer wording everywhere](T07-wording.md) | Haiku | T02–T06 | Done (2026-09-28) |

### Round 2 (spec 3.0)

The first "T08" (link parsing and card changes, 2026-09-28) was reverted. These replace it. The Google Flights link reader is **already built and tested** (`js/lib/flightlink.js`), so no task has to guess at it.

| # | Task | Model | Depends on | Status |
|---|---|---|---|---|
| T08 | [Automatic trip stage instead of Status](T08-trip-stage.md) | Haiku | — | Appears built (found in code 2026-10-11) |
| T09 | [Coffee & cafés category](T09-coffee-category.md) | Haiku | — | Appears built (found in code 2026-10-11) |
| T10 | [Add flight dialog reads the whole link](T10-flight-dialog.md) | Sonnet | — | Done (2026-09-28) |
| T11 | [Compact flight and stay cards](T11-cards.md) | Sonnet | T10 | Done (2026-09-28) |
| T12 | [Add stay dialog with "Where is it?"](T12-stay-dialog.md) | Sonnet | T11 | Done (2026-09-28) |
| T13 | [Stays price-pin map](T13-stays-map.md) | Sonnet | T12 | Done (2026-09-28) |


## Writing a new task

Copy `docs/tasks/_TEMPLATE.md`. Keep one task to one screen or one idea. If the task changes behavior, `SPEC.md` changes first. Add it to the board as **Needs review** and build it only after the owner says go.
