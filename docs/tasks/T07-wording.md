# T07 — Clearer wording everywhere

**Model:** Haiku · **Depends on:** T02, T03, T04, T05, T06

## Goal
Apply `docs/tasks/WORDING.md` to every piece of text a traveler can see: headings, buttons, labels, empty states, errors, tooltips, dialogs and `help.html`.

## Why
The owner finds some labels unclear or jargon-y ("Candidate destinations", "Log price", "Partial total"), and at least one message is stale (it still mentions "Phase 2").

## Files you may change
- Text only in `js/app.js`, `js/ui.js`, `js/views/*.js`, `help.html`, `recap.html`, `index.html`
- `SPEC.md` — where the spec quotes a label you changed, update the quote; bump the version to 2.1 and add a changelog row "Wording pass (T07)"
- Tests, only where a test checks a string you changed (for example the ranking summary)

## Spec sections
§4 (tab names), §7 (quoted labels), §3.2 (help page must stay current).

## Do
1. Make every change in the table in `WORDING.md`.
2. Then read every screen's text against the **Voice** rules and fix anything else that breaks them. Keep a list.
3. Update `help.html` so its descriptions match the new names and the new link-first forms (T04, T05) and multi-choose (T06).
4. Make sure every icon-only button (▲ ▼ and similar) has an `aria-label` that says what it does ("Move up", "Move down").

## Don't
- Change layout, styling, behavior, data, or anything stored in Firestore. Category names stay exactly as they are (they're saved in the database).
- Rename tabs.

## Tests
`node tests/run-tests.js` passes. `grep -rn "Phase\|candidate" js/views/*.js` finds no text shown on screen (variable names are fine).

## Done when
Your summary includes a **before → after table of every string you changed beyond WORDING.md**, so the owner can veto any of them.

## Owner check
1. Read through each tab. Nothing sounds technical or confusing.
2. Empty screens (a brand-new trip) tell you what to do next.
3. Type a bad price: the error explains how to fix it.
4. Open **Help**: it describes the app as it works now.
5. Look over the before → after table and tell the model to revert any you don't like.
