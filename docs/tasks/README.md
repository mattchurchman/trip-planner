# Task board

Each task is one session. The rules every agent follows are in `AGENTS.md`; models, effort and backup agents are in `docs/MODEL_TIERS.md`. Finished rounds are in [`HISTORY.md`](HISTORY.md).

## How to run a task

1. Clear the context or open a **new** session on the `trip-planner` repo.
2. Select the model and effort from the table.
3. Send one line, with the task number, model and effort filled in:

   > Read AGENTS.md, then do task T70. Model: Haiku. Effort: medium. You may push to master when tests pass.

4. If the task has **Owner steps first**, the agent lists them and waits for you.
5. When it finishes, wait a minute or two for the site to update, then click through the task's **Owner check**. If something fails, stay in the same session and describe what you did and what you saw.
6. The agent ends by telling you the next task and which model and effort to select. Start it only after this one is **Done**.

If a task fails twice, say "Revert the last commit" and rerun it in a fresh session on the model named in its **If it fails twice** line.

## Current round — Round 10

| # | Task | Model | Effort | Codex | Depends on | Status |
|---|---|---|---|---|---|---|
| T70 | [Slim the task board and fix stale doc references](T70-docs-cleanup.md) | Haiku | medium | GPT-5.6 Terra, low | T69 | Done (2026-10-21) |
| T08 | [Automatic trip stage instead of Status](T08-trip-stage.md) | Haiku | — | — | — | Appears built |
| T09 | [Coffee & cafés category](T09-coffee-category.md) | Haiku | — | — | — | Appears built |

## Round 11 — owner testing, Map and Days, 2026-10-21

| # | Task | Model | Effort | Codex | Depends on | Status |
|---|---|---|---|---|---|---|
| T71 | [Map tab: map visible on phones, vote from the list](T71-map-phone-and-quick-votes.md) | Sonnet | medium | GPT-5.6 Terra, medium | T70 | Needs review |
| T72 | [Days: show the day's note, spot empty days](T72-day-notes-and-empty-days.md) | Sonnet | medium | GPT-5.6 Terra, medium | T71 | Needs review |

**Order.** T70, then T71, then T72, one at a time. `SPEC.md` is already at 4.5 (§7.7, §7.8), so neither task edits it; the owner checks close the round.

```
Read AGENTS.md, then do task T71. Model: Sonnet. Effort: medium. You may push to master when tests pass.
Read AGENTS.md, then do task T72. Model: Sonnet. Effort: medium. You may push to master when tests pass.
```

Fixes found during an **Owner check** stay in that task's session (they're small and the context is warm). Anything bigger becomes a new task.

## Writing a new task

Copy `docs/tasks/_TEMPLATE.md`. Keep one task to one screen or one idea. If the task changes behavior, `SPEC.md` changes first. Add it to the board as **Needs review** and build it only after the owner says go.
