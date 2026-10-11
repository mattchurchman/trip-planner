# T29 — Help page for the new flow

**Tier:** C · **Model:** Haiku · **Effort:** medium · **Size:** S
**Depends on:** T28 · **If it fails twice:** Sonnet
**Owner steps first:** none

## Goal
`help.html` explains the app as it now works, in workflow order, in plain short text.

## Read (only these)
- `docs/V4.md` §10, §1, §4.5, §5, §6 (import), §8
- `help.html`, `docs/tasks/WORDING.md`

## Files you may change
- `help.html`, `css/styles.css` (help section only), `docs/tasks/WORDING.md`

## Do
1. Sections with ids, in this order: `home-screen` (add to iPhone home screen, sign in), `routes` (which Google Flights link to copy and when the price is in it, pasting, ideas and options, other travelers), `prices`, `map` (pasting a place, importing from My Maps, stays and night coverage), `days`, `google-maps` (export, import into My Maps, open in the Google Maps app).
2. Each section: a one-line "what this is for", then numbered steps of one sentence each. A short "If it doesn't work" list where relevant (short share links, KMZ files, a price missing from the link).
3. Put `<!-- IMAGE: what to show -->` where a screenshot or GIF will go in a later round.
4. A contents list at the top. Use the app's exact button names.

## Don't
- Describe features that were removed, or add images.

## Tests
Existing tests pass. Every in-page link target exists.

## Done when
The page reads cleanly at 375 px in light and dark.

## Owner check
Read it top to bottom once while using the app. Tell the agent any step that didn't match what you saw.
