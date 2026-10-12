# Wording guide

How Trip Planner talks. Every agent follows this once T07 is done. The owner can edit this file at any time; the words here win over older wording in SPEC.md.

## Voice

- Talk like a friend who's organizing the trip: plain, short, warm. "Where could we go?" not "Candidate destinations".
- Say what a button does, as a verb: **Add place**, **Save price**, **Pick this destination**.
- Empty screens say what to do next, not only that nothing is there: "No places yet. Add the first one — food spots are a good start."
- Errors say what's wrong and how to fix it, in one sentence, without blaming anyone: "That price didn't look right — try something like 245 or 245.50."
- Use sentence case everywhere ("Add stay", not "Add Stay"). No exclamation marks except in celebratory moments.
- Never mention phases, code, Firebase or file names to travelers. The only exception is the owner-only setup message.

## Names for things (use these consistently)

| Old wording | New wording | Where |
|---|---|---|
| Must / Nice / Skip | Love / Like / Pass, with tooltips "Love it", "Like it", "Pass" | Rank control |
| Ranking (sort) | Group favorites | Places sort |
| Not ranked by me | I haven't ranked yet | Filters |
| Unplanned | Not in a day yet | Days tab |
| Log price | Save price | Price panel |
| No price logged yet. | No price yet. Check the site, then save what you saw. | Price panel |
| Shared costs | Split costs | Flights & stays |
| Add shared cost | Add a split cost | Flights & stays |
| Partial total | Total so far (missing some prices) | Totals card |
| Combined | Everyone together | Totals card |
| Use this link | Read this link | Location picker |
| Search by OpenStreetMap Nominatim | Search results from OpenStreetMap | Search results credit |
| Plan trips with your friends. | Plan trips with your friends — from "where should we go?" to the recap. | Sign-in screen |
| No trips yet. Start one! | No trips yet. Start one with **New trip**. | Trips list |

Tab names: **Overview · Routes · Map · Days** (T23 removes Recap; T25 merges Places and Stays into Map).

## Routes (T19, V4 round 3)

| Wording | Where |
|---|---|
| Ideas for this window / + Idea / Rename idea / Delete idea | Routes, idea switch |
| Options once you land / + Option / Rename / Delete | Routes, option cards |
| Use this / Using | Routes, home-flights card |
| Choose this option / Unchoose | Routes, option card |
| Add flight | Routes, home-flights card and an open option (opens the existing flight dialog; T20 replaces this with pasting a link) |
| No ideas yet. Add one to start planning flights. | Routes, empty tab |
| No flights yet for {name}. Add one below. | Routes, empty home-flights card |
| No options yet. Add one above to start building stops. | Routes, idea with no options |
| No flights yet for this option. Add one below. | Routes, open option with no hops yet |

## Stays by stop (T24)

| Wording | Where |
|---|---|
| Shortlisted / Out / Chosen | Stays, status select on each stay card |
| No stop yet | Stays, the group for stays with no matching stop |
| {N} of {N} nights covered | Stays, each stop's coverage bar |
| No route chosen yet. Choose an option on Routes to group stays by city. | Stays, shown instead of grouping until an option is chosen |
| Duplicate | Stays, copies a stay (no price) and opens it for editing — for splitting one stay into two |
| Paste | Stays, Add/Edit stay dialog — fills the link box from the clipboard |

## Map tab (T25)

| Wording | Where |
|---|---|
| All / {city} / Elsewhere | Map, stop chips above the map — "Elsewhere" is a place or stay with no stop nearby |
| Choose an option on Routes to group this by your actual route. | Map, shown under the chips until an option is chosen (chips list every city across every option until then) |
| Places / Stays | Map, the switch under the chips that picks which list shows below the map |
| Paste | Map, "Add place" and the inline location editor — fills the Google Maps link box from the clipboard |

## Import from My Maps (T26)

| Wording | Where |
|---|---|
| Import from My Maps | Map, toolbar button that opens the import dialog |
| Export your map from My Maps: ⋮ → Export to KML/KMZ, tick "Export as KML instead of KMZ". | Import dialog |
| This looks like a KMZ file. In My Maps, use ⋮ → Export to KML/KMZ and tick "Export as KML instead of KMZ", then pick that file instead. | Import dialog, KMZ file picked |
| No pins found in that file. | Import dialog, a KML with no usable Placemarks |
| Add {n} places / Add {n} places ({m} already here) | Import dialog's confirm button |

## Paste flight link (T20)

| Wording | Where |
|---|---|
| Paste flight link | Routes, top of the tab and inside each open option — replaces Add flight as the way in |
| No ideas yet. Paste a flight link to start, or add an idea yourself. | Routes, empty tab |
| No flights yet for {name}. Paste a flight link above. | Routes, empty home-flights card |
| Adding to: | Paste sheet, the idea/option it will join (with selects to change either) |
| Earlier flights ({N}) | Routes, collapsed list of flights saved before Routes existed |
| Move to… | Earlier flights row — picks a traveler (home) or a shared hop, plus the idea and option |
