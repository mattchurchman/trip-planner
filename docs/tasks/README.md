# Task board

Round 1 of owner feedback (spec version 2.0). Each task is one Claude Code session.

## How to run a task

1. Open a **new** Claude Code session on the `trip-planner` repo and pick the model from the table.
2. Send one line:

   > Read CLAUDE.md, then do task T01 from docs/tasks/. You may push to master when tests pass.

3. When it finishes, wait 1–2 minutes and hard-refresh the live site (Mac ⌘⇧R, Windows Ctrl+Shift+R).
4. Click through the task's **Owner check**. If something fails, stay in the same session and describe what you did and what you saw.
5. Start the next task only after this one is marked **Done**.

If a task fails twice, revert it ("Revert the last commit") and retry in a fresh session with the next model up.

## Tasks

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
| T08 | [Automatic trip stage instead of Status](T08-trip-stage.md) | Haiku | — | To do |
| T09 | [Coffee & cafés category](T09-coffee-category.md) | Haiku | — | To do |
| T10 | [Add flight dialog reads the whole link](T10-flight-dialog.md) | Sonnet | — | Done (2026-09-28) |
| T11 | [Compact flight and stay cards](T11-cards.md) | Sonnet | T10 | Done (2026-09-28) |
| T12 | [Add stay dialog with "Where is it?"](T12-stay-dialog.md) | Sonnet | T11 | To do |
| T13 | [Stays price-pin map](T13-stays-map.md) | Sonnet | T12 | To do |

## Order, and running tasks at the same time

The simple, safe path is **one at a time, top to bottom**. Each task pushes to `master` before the next starts, so nothing collides.

Once T01 and T02 are done, T03, T04 and T05 touch different screens and *can* run at the same time in separate sessions, even on different models (for example T04 on Haiku while T05 runs on Sonnet). The catch: they all add CSS to `styles.css`, so whichever pushes second may hit a "merge conflict". If that happens, tell that session: "Pull the latest master, fix the conflict keeping both changes, run the tests, and push." If that sounds like more hassle than it's worth, stay sequential — it's only a few extra minutes per task.

T06 must wait for T05 (same screen). T07 goes last because it touches words on every screen.

**Round 2:** T08 and T09 are small Haiku jobs on different screens; do them first, in either order (or at the same time). T10 → T11 → T12 → T13 all change the Flights & stays tab, so run them one after another.

## Writing a new task

Copy the shape of an existing task file: **Goal**, **Why**, **Depends on**, **Files you may change**, **Spec sections**, **Do**, **Don't**, **Tests**, **Done when**, **Owner check**. Keep one task to one screen or one idea — small, specific tasks are what let Haiku and Sonnet do good work. If the task changes behavior, update `SPEC.md` first (bump the version, add a changelog row).
