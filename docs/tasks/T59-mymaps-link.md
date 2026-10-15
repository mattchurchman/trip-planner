# T59 — The trip's shared Google My Maps link

**Tier:** B · **Model:** Sonnet · **Effort:** medium · **Size:** M
**Depends on:** T58 · **If it fails twice:** Opus
**Owner steps first:** none

## Goal
A trip can hold the link to the group's shared Google My Maps map. It's added and opened from a **Shared links** card on Overview (which also takes over the Album link), and the app works out from the link a "download as KML" address that later tasks use to make importing a two-tap job.

## Read (only these)
- `docs/R7.md` §8
- `SPEC.md` §5.3 and §7.5 (by section), §9.5 (`safeUrl`)
- `js/views/overview.js` lines 25–50 and 145–165 (album card)
- `js/ui.js` `linkField` (186–238), `dialogShell` (239–280)
- `js/store.js` `createTrip` (lines 62–90)
- `docs/tasks/WORDING.md` §"Names for things"

## Files you may change
- `SPEC.md` (§5.3 field, §7.5 Shared links, new §9.10 "Reading Google My Maps links") — **first**
- `js/lib/mymaps.js` (new), `tests/mymaps.test.js` (new)
- `js/store.js` (`createTrip`: `myMapsUrl: null`)
- `js/views/sharedLinks.js` (new): `renderSharedLinks(...)` and `editLinkSheet(...)`
- `js/views/overview.js` (swap the album card for the shared links card), `css/styles.css` (rows only)
- `docs/demo/demo-seed.js` (give `t1` a sample `myMapsUrl`), `docs/tasks/WORDING.md` (new section)

## Do
1. SPEC first: add `myMapsUrl: string | null` to §5.3 (with "trips made before 4.3 may not have it; read as null"), the Shared links card to §7.5, and §9.10 with R7 §8's parsing rules.
2. `mymaps.js`: `parseMyMapsUrl(text)` and `isShortMapsLink(text)` exactly as R7 §8. Tests: edit, viewer, `/u/0/edit`, embed, `google.com` without `www`, extra params (`&usp=sharing`, `&ll=…`), `mid` missing or too short → null, a normal Google Maps place link → null, `javascript:` → null, short links → `isShortMapsLink` true, and the exact `viewUrl`/`kmlUrl` strings.
3. `sharedLinks.js`: one card, two rows built with `row()` — "Album" (`link` icon) and "Our My Maps" (`map` icon). Unset: muted hint + **Add link**. Set: **Open ↗** (`externalLink`) + ⋯ (Change link, Remove link; Remove asks first). **Add/Change** opens `editLinkSheet` with the shared `linkField()`, live validation messages from R7 §8 (album keeps its current `safeUrl` rule), **Save** with pending and inline error. Writes with `updateTripFields`.
4. Overview shows the card where the album card was. Remove the old album code.
5. WORDING: add "Shared My Maps link (T59)" with every string you used.

## Don't
- Touch the Map tab or Days (T63, T64). Fetch anything from Google.

## Tests
`node tests/run-tests.js` passes with the new tests. Serve the demo and check the card on Overview at 390 px (one screenshot).

## Done when
A My Maps link can be added, opened, changed and removed; a short link and a non-My-Maps link each show their message and don't save.

## Owner check
1. In Google My Maps, open your shared map → **Share** → copy the link. On Overview → Shared links → Our My Maps → **Add link**, paste, **Save**.
2. **Open ↗** opens the map. Ask a friend to check they see it too.
3. Try pasting a normal Google Maps place link: it says it isn't a My Maps link.
