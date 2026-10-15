# T66 — Final review and SPEC 4.3 (Round 7)

**Tier:** A · **Model:** Opus · **Effort:** medium · **Size:** M
**Depends on:** T54–T65 · **If it fails twice:** stop and ask the owner
**Owner steps first:** none

## Goal
`SPEC.md` matches the app as Round 7 left it (version 4.3), `docs/R7.md` is folded in and marked as history, and anything that slipped is listed for the owner.

## Read (only these)
- `git log --oneline -15` and `git diff 325875a..HEAD --stat` (325875a = T53)
- `docs/R7.md` §10 (where each part lands), then each R7 section as you fold it
- `SPEC.md` §3.3, §4, §5.3, §7.2, §7.5–§7.8, §9, §13 — by section
- `AGENTS.md` §2 and §4

## Files you may change
- `SPEC.md`, `docs/R7.md` (history banner + mapping table only), `AGENTS.md` §2/§4 (point at SPEC again), `docs/tasks/README.md`, `docs/tasks/WORDING.md`, `README.md` (troubleshooting rows)

## Do
1. Fold R7 into SPEC per R7 §10: tokens/type/icons/components into §4 (replace the old token table, fonts, category colors, and the mock reference), assets into §3.3, screens into §7.2 and §7.5–§7.8, My Maps link into §5.3/§7.5/§7.7/§9.10 (check T59's wording against the code).
2. Banner at the top of `docs/R7.md` like `docs/V4.md`'s, plus a mapping table. Point `AGENTS.md` §2 and §4 back at SPEC only.
3. Check, by reading code, and list (don't fix) anything that disagrees: no `btn-danger` outside confirmations; no raw hex outside the token blocks and `categories.js`; every `font-size` a token; every new button has pending and inline error (AGENTS §4); every ⋯ has an `aria-label`; no file over ~400 lines except `store.js`/`styles.css`.
4. SPEC version 4.3 with a §13 row summarizing Round 7.

## Don't
- Change app code beyond typos in on-screen words.

## Tests
`node tests/run-tests.js` passes.

## Done when
SPEC 4.3 describes the app; mismatches are listed in the final message.

## Owner check
1. Use a test trip end to end on your phone once: Overview → Routes → Map (import from your shared map) → Days → Export.
2. Tell the agent anything that looks off; stay in the same session for fixes.
