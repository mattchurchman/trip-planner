# T70 — Slim the task board and fix stale doc references

**Tier:** C · **Model:** Haiku · **Effort:** medium · **Size:** S
**Codex:** GPT-5.6 Terra, low · **Depends on:** T69 · **If it fails twice:** Sonnet, medium (Codex: GPT-5.6 Terra, medium)
**Owner steps first:** none

## Goal
Every session reads `AGENTS.md` (7 KB) and `docs/tasks/README.md` (15 KB) before it starts. The board is about 85% finished history, has an old copy-paste block of T54–T66 kickoff lines and Round 3 "Order"/"Stopping points" notes sitting under Round 9, and both files and the template still point at history docs. After this task the board holds only what an agent needs to pick the next task (under 3 KB), history lives in one archive file, and nothing tells an agent to read V4, R7 or PHASES. No app code changes; no wording or meaning of any rule changes.

## Read (only these)
- `AGENTS.md` (whole — it is small)
- `docs/tasks/README.md` (whole — it is what you are splitting)
- `docs/tasks/_TEMPLATE.md`
- `SPEC.md` lines 1–8 only

## Files you may change
- `docs/tasks/README.md`
- `docs/tasks/HISTORY.md` (new)
- `docs/tasks/_TEMPLATE.md`
- `AGENTS.md`
- `SPEC.md` (header paragraph, lines 3–7, only)
- `docs/history/` (new folder) and the moved files below

## Do
1. Create `docs/tasks/HISTORY.md`. Move into it, unchanged, every finished round table (Round 3 through Round 9, Earlier rounds, Round 2) and its notes. Drop the stale T54–T66 kickoff block and the misplaced Round 3 "Order" / "Natural stopping points" paragraphs that sit after Round 9 — they duplicate notes already in their rounds. Fix links so they still open the task files.
2. Leave in `docs/tasks/README.md`: the title line, "How to run a task", one empty **Current round** table with the Round 9 columns (`# | Task | Model | Effort | Codex | Depends on | Status`), the T70 row, "Writing a new task", and one line linking to `HISTORY.md`. Keep T08 and T09 ("Appears built") as rows in the current table with that status, so they stay visible. Target under 3 KB.
3. `git mv PHASES.md docs/V4.md docs/R7.md docs/mock/routes-mock.html docs/history/`. Update the paths in `AGENTS.md` §2 and the `SPEC.md` header to `docs/history/…`. Don't touch old task files that mention them.
4. `AGENTS.md`: change "version 4.3" to "4.4"; delete "(from T14; before that, GitHub Pages)" and "(from T15)"; in step 1 add "Finished rounds are in `docs/tasks/HISTORY.md`; don't open it unless the owner asks." Nothing else.
5. `_TEMPLATE.md`: add the `**Codex:**` field the way T69 has it; replace the `docs/V4.md §…` example under Read with `` `SPEC.md` §… (by line range) ``.
6. Set T70 to **Done** on the board.

## Don't
- Change any rule's meaning in `AGENTS.md`, or any other part of `SPEC.md`.
- Edit, rename or move any `Txx-*.md` task file.
- Touch `js/`, `css/`, `tests/`, `README.md`, or anything the site serves.

## Tests
1. `node tests/run-tests.js` passes (nothing should change).
2. `wc -c docs/tasks/README.md` is under 3000.
3. `grep -rn "V4.md\|R7.md\|PHASES.md\|routes-mock" AGENTS.md SPEC.md docs/tasks/README.md docs/tasks/_TEMPLATE.md` shows only `docs/history/` paths.
4. Every link in `README.md` and `HISTORY.md` under `docs/tasks/` points to a file that exists (check with a one-line script).

## Done when
Board under 3 KB and the agent can still pick the next task from it; history in `HISTORY.md` with no rows lost (T01–T70 each appear once across the two files); no live doc points at the old history paths; tests pass.

## Owner check
1. Open `docs/tasks/README.md` on GitHub: it's short, and T70 shows Done.
2. Open `docs/tasks/HISTORY.md`: the old rounds are there and a task link opens.
3. The site still loads (nothing in it changed).
