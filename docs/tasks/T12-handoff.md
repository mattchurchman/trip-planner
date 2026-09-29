# T12 handoff — Add stay dialog with "Where is it?"

Written by the previous session because its context window filled up mid-task.
This file is **not** part of the permanent task set — delete it once T12 is
marked Done in `docs/tasks/README.md`. Read `T12-stay-dialog.md` first (the
actual task spec); this file only records what's been built and what's left.

## Status: code complete, NOT yet verified in a browser, NOT committed

All the code changes described below exist in the working tree but have not
been committed. Nothing has been pushed. `docs/tasks/README.md` still says
T12 is "To do" — leave it that way until you've verified the work.

## What's done

1. **New `js/views/stayForm.js`** — the rebuilt Add stay / Edit stay dialog,
   plus `buildLocationDisclosure`'s replacement (`buildWhereIsIt`), moved out
   of `stays.js` per the task's file list. Exports:
   - `addStayFormDialog(trip)`
   - `editStayFormDialog(stay, trip, focusLocation = false)` — `focusLocation`
     is used by the card's **Set location** action; it sets `focusEl` to the
     "Where is it?" Find button, which auto-scrolls it into view.
   - `PROVIDERS`, `providerLabel(value)` — moved here from `stays.js` since
     the dialog no longer has a manual Provider field (see below) but the
     card still needs the label for its provider pill.

   Structure follows the exact §7.7 sketch order: link box → "Don't have one
   yet?" search links → "✓ Read from the link: …" result line → Name → Price
   you saw (add mode only) → Check-in/Check-out/Guests in one `.field-row` →
   Neighborhood → **Where is it?** → Note → Cancel/Add stay (or Save).

   **Where is it?** (`buildWhereIsIt`): status line ("📍 Pin set" + Clear, or
   "No pin yet — you can add one later"), a `Find "<name>" on the map` button
   (disabled while Name is empty; runs `nominatimSearch` for
   `"<name>, <city>, <country>"` on click, lists up to 5 results, "Search
   results from OpenStreetMap" caption, "Nothing found — try a Google Maps
   link instead." on empty results), a `<details>` "Paste a Google Maps link"
   disclosure (parsed with `parseGoogleMapsUrl` on paste/input, plus a
   **Find on Google Maps ↗** link built from the current Name), and a muted
   Airbnb hint ("Airbnb shows the exact spot only after booking — pin the
   neighborhood for now") shown only when the current provider is `airbnb`.

   **Important design decision, not explicit in the task file**: the sketch
   in SPEC §7.7 has **no manual Provider field** (Do #1's field list is Name,
   Price, Check-in/out/Guests, Neighborhood, Where is it?, Note — Provider
   isn't in it). So `provider` is now purely derived: it's whatever
   `parseStayLink` last returned (default `"other"` if never parsed), tracked
   internally (`currentProvider`), never shown as a dropdown. This matches the
   sketch literally but is a behavior change from the old dialog (which had a
   `<select>`). If the owner's Owner-check reveals they actually want to be
   able to set/correct provider by hand (e.g. for a `hotel_direct` stay with
   no link at all), that's the first thing to reconsider — possibly a
   quiet/optional provider control tucked near Neighborhood.

   Per SPEC §7.7 (verified against the current spec text, not just the task
   file): stay fields use **fill-only-if-still-default** semantics on a
   pasted link (`fillIfDefault`, same pattern as the pre-T12 dialog) — NOT
   flights' T10 "always overwrite" rule. Don't change this without re-reading
   §7.7's Stays bullet ("fill provider, name, dates and guests only into
   empty or still-default fields").

   The "✓ Read from the link" line shows actual parsed values, e.g. "Booking.
   com · Casa Alfama · 17–24 Jan · 4 guests", via a local `resultLineFor()` +
   `compactDateRange()` (same-month elision: "17–24 Jan" vs cross-month "17
   Jan – 24 Jan"). Failure case: "Couldn't read this link — fill in the
   details below." (when `parsed.provider` is null, i.e. not even a valid
   URL — `parseStayLink` returns `"other"` for any other valid link, so that
   alone is never the failure signal).

2. **`js/views/stays.js` rewritten** (199 lines, was 505) — dialogs and
   `buildLocationDisclosure` deleted; imports `addStayFormDialog`,
   `editStayFormDialog`, `providerLabel` from `./stayForm.js`. Card rendering
   itself is **unchanged from T11** except `openEditStayDialog` now takes and
   forwards a `focusLocation` param, and the card's **Set location** button
   (shown when `stay.lat == null`) now calls `openEditStayDialog(stay, trip,
   true)` instead of `false`/omitted.

3. **`css/styles.css`**: extended the T10 `.flight-form details/summary/h3`
   rules to also match `.stay-form` (the new dialog reuses the same disclosure
   pattern), and added a small `.where-is-it` block (just spacing — it
   otherwise rides on the existing `.field` and `.search-results` styles, no
   new visual language).

## Verification status

- `node tests/run-tests.js` — **175 passed, 0 failed** (last run before this
  handoff). No new pure logic was added (the task's Tests section allows
  this — `compactDateRange` is a tiny local formatting helper, not exported,
  same judgment call as flights' analogous compact-format helpers).
- `node -c` syntax-checked both changed/new files — clean.
- **Not yet done**: opening the dialog in a real/scratch browser session to
  confirm it renders per the sketch, that pasting a real Booking.com/Airbnb
  link fills fields correctly, that Find-on-the-map + Nominatim search works
  end to end, that the Google Maps link disclosure sets a pin, that **Set
  location** on a card actually scrolls to and focuses the Find button, and
  that the dialog matches the sketch at 1280px and 375px (this file's author
  was mid-way through exactly this check — a browser tab was about to be
  opened via `mcp__claude-in-chrome__*` — when the session was interrupted).

## What to do next

1. Read `T12-stay-dialog.md` and `SPEC.md` §7.7 "Stays" (the Add stay dialog
   sketch/bullets) and §9.3/§9.4/§9.2/§9.6 if you need the exact link-reading
   rules — don't take this handoff's summary as a substitute for the spec.
2. Start a local server (`python3 -m http.server 8000` from the repo root)
   and open it in a browser tool. Firebase sign-in won't work in this
   environment — the T10/T11 handoffs (see recent commit messages) used the
   trick of `import()`-ing the view module directly in the page's console
   and calling `addStayFormDialog(traveler-less trip mock)` /
   `editStayFormDialog(mockStay, mockTrip, true)` with hand-built mock data,
   bypassing Firestore entirely, then reading back the resolved dialog result
   via `window.__something = await dialogPromise`. Do the same here:
   - Mock a `trip` with `destination`, `startDate`, `endDate`, `currency`,
     `travelers`.
   - Mock a `stay` with `lat: null` (to see the "no pin" path) and one with
     `lat`/`lng` set (to see "📍 Pin set").
   - Paste a **real** Booking.com/Airbnb/Google Hotels link (see
     `tests/staylink.test.js` for safe real-shaped examples, or construct one)
     into the link input and confirm the result line and field fills.
   - Click **Find "<name>" on the map** — this hits the real Nominatim API
     (no key needed, but it's a live network call and rate-limited to 1/sec
     by `lookup.js`) — confirm results render and picking one sets the pin.
   - Open the "Paste a Google Maps link" disclosure and paste a real Google
     Maps URL; confirm it sets the pin and the error paths (short link,
     non-Google link) still work (reuses `parseGoogleMapsUrl`, already
     tested in `tests/mapsurl.test.js` — just confirm wiring, not the parser).
   - Check `focusLocation: true` actually focuses/scrolls to the Find button.
   - Resize/force the dialog to ~375px (the real window in this sandbox
     sometimes won't resize below ~1256px — earlier sessions worked around
     this by setting `dialog.style.maxWidth = dialog.style.width = '375px'`
     directly via JS on the `<dialog>` element) and confirm no overflow.
3. Fix anything that doesn't match. Re-run `node tests/run-tests.js`.
4. Update `docs/tasks/README.md`: change T12's row from "To do" to
   "Done (YYYY-MM-DD)" (use today's actual date).
5. `git add -A`, commit (see recent commit messages on this branch — T10/T11 —
   for the expected message style: a summary paragraph per major change,
   what was verified and how, a closing "Tests: N passed, 0 failed" line).
   Use whatever attribution trailer is currently in force for this session
   (check the system reminder / ask the user if unsure — don't guess or
   reuse a stale one from an old commit).
6. `git pull --rebase origin master` then `git push origin master`. If a
   push conflict shows up (another session landed T12 or a later task first),
   resolve per `docs/tasks/README.md`'s merge-conflict guidance, don't force.
7. Delete this file (`docs/tasks/T12-handoff.md`) once T12 is committed and
   pushed — it has served its purpose.
8. T13 ("Stays price-pin map") depends on T12 and is next.

## Files touched (uncommitted at handoff time)

```
 M css/styles.css
 M js/views/stays.js
?? js/views/stayForm.js
```

No changes to `js/store.js`, `js/lookup.js`, or any `js/lib/` file were
needed for T12 as built — `nominatimSearch` already accepts an arbitrary
query string, `parseGoogleMapsUrl` and `parseStayLink` already exist from
earlier work and needed no changes.
