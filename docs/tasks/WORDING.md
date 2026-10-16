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
| Still $X? | Opened the link in a new tab. Is it still $X? | Price panel |
| Add price | + Add price (chip) | Price panel |
| 3d (age label) | Checked today / Checked 3 days ago, or Check price once stale | Price panel |
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
| Choose idea / Chosen | Routes, beside Rename idea and Delete idea (press again to unchoose) |
| Choose this option / Unchoose | Routes, option card |
| {traveler}'s flights from home · $X | Routes, home-flights card heading (flights being used only) |
| per person · For: Matt, Sam · Chosen by {name} ✓ | Routes, option card (cost of its own flights only) |
| Who's this for? / Automatic / Set by hand · Reset | Routes, each hop flight |
| Who's this for? · Everyone · ÷ 2 · Matt, Sam | Overview, split cost dialog and rows |
| Not chosen yet | Overview, Route line for a traveler with no choice |
| Flights from home / Option flights / Stays / Split costs | Overview, Budget, inside each traveler |
| {name}: home $A + option flights $B = $C | Routes, summary pinned to the bottom ("at least $C" while something is missing) |
| Add flight | Routes, home-flights card and an open option (opens the existing flight dialog; T20 replaces this with pasting a link) |
| No ideas yet. Add one to start planning flights. | Routes, empty tab |
| No flights yet for {name}. Add one below. | Routes, empty home-flights card |
| No options yet. Add one above to start building stops. | Routes, idea with no options |
| No flights yet for this option. Add one below. | Routes, open option with no hops yet |

## Stays by stop (T24)

| Wording | Where |
|---|---|
| Choose / Chosen | Stays, toggle button on each stay card (Chosen = teal) |
| Out | Stays, toggle button on each stay card — dims the card and sorts it last |
| For: {names} · Automatic / Set by hand · Who's this for? | Stays, on each stay card (same as hops on Routes) |
| 2 of 3 | Stays, each night cell: travelers sleeping in that city that night |
| All {N} nights covered ✓ | Stays, a stop whose every night has a chosen stay |
| No map pin · Set location | Stays, a stay with no location |
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

## Days on the map (T27)

| Wording | Where |
|---|---|
| Not planned | Days, the pool of places not yet on a day (replaces "Not in a day yet" now the list is scoped to the selected day's city, with Loved places shown first) |
| Create days from route | Days, the create button once an option is chosen on Routes |
| Create days from trip dates | Days, the same button before an option is chosen |
| Remove from day | Days, pin-tap sheet, shown only when the place is already on a day |
| No days yet for this city. | Days, pin-tap sheet, when the selected day's city has no days yet |

## Import from My Maps (T26)

| Wording | Where |
|---|---|
| Import from My Maps | Map, toolbar button that opens the import dialog |
| Export your map from My Maps: ⋮ → Export to KML/KMZ, tick "Export as KML instead of KMZ". | Import dialog |
| This looks like a KMZ file. In My Maps, use ⋮ → Export to KML/KMZ and tick "Export as KML instead of KMZ", then pick that file instead. | Import dialog, KMZ file picked |
| No pins found in that file. | Import dialog, a KML with no usable Placemarks |
| Add {n} places / Add {n} places ({m} already here) | Import dialog's confirm button |

## Paste flight link (T20, scoped by T34)

| Wording | Where |
|---|---|
| Paste flight link | Routes — inside the home-flights card (a home flight) and inside each open option (a hop); the button decides where the flight goes |
| No ideas yet. Paste a flight link to start, or add an idea yourself. | Routes, empty tab |
| No flights yet for {name}. | Routes, empty home-flights card |
| Adding to {idea} · {traveler} / Adding to {option} | Paste sheet, the fixed line naming where this flight will land |
| Earlier flights ({N}) | Routes, collapsed list of flights saved before Routes existed |

## Round 5 gaps, found in the T40 review

| Wording | Where |
|---|---|
| For: no one yet | Routes and Stays, "Who's this for?" line when the set is empty (a hop nobody has chosen, say) |
| Done | Routes and Stays, the "Who's this for?" button while its name pills are open |
| {name}: home $A + option flights $B (no idea chosen) = $C | Routes, the bottom summary for a traveler who has chosen an option but no idea |
| {total} total · {share} each | Stays, under a stop's coverage bar — "so far" after the total while a chosen stay has no price |
| Straight lines show the order, not the walking path. Tap a pin to add it to a day. | Days, caption under the map |
| Route part 1 / Route part 2 | Days, instead of **Open walking route** when a day needs more than one Google Maps link |

## Stays on the Days map (T39)

| Wording | Where |
|---|---|
| 🏠 {stay name} | Days, the house pin of the day's chosen stay — the stay's name alone in its popup ("Stay" when it has no name) |

## Shared My Maps link (T59)

| Wording | Where |
|---|---|
| Shared links | Overview, the card holding Album and Our My Maps |
| Our My Maps | Overview, Shared links row (`map` icon) |
| Add the group's shared map | Overview, Our My Maps row, unset |
| Add your shared photo album | Overview, Album row, unset |
| Add link | Overview, Shared links row, unset |
| Open ↗ | Overview, Shared links row, set |
| Change link | Overview, Shared links row ⋯ menu |
| Remove link | Overview, Shared links row ⋯ menu |
| Remove the {row} link? | Overview, Shared links, Remove confirmation |
| That's a short link. Open it, then copy the address from the browser bar and paste that. | Our My Maps sheet, a `maps.app.goo.gl` / `goo.gl/maps` link |
| That doesn't look like a Google My Maps link (it should contain google.com/maps/d/). | Our My Maps sheet, anything else that isn't a My Maps link |
| That doesn't look like a link. | Album sheet, a link that fails URL safety |
| Paste a link first. | Either sheet, Save pressed with nothing typed |

## Round 6, the phone pass (T41–T52)

| Wording | Where |
|---|---|
| Help (as the round **?** button's `aria-label`) | Top bar, beside the account avatar — no text link, no ↗ arrow |
| Edit | Overview, on each traveler card — opens the sheet with name, home city and airport |
| {Name} (you) | Overview, the signed-in person's traveler card |
| Add home city and airport | Overview, a traveler card with both fields empty |
| Save / Cancel / Remove traveler | Overview, traveler edit sheet (Remove is a quiet danger link at the bottom) |
| At least one traveler must remain. | Overview, traveler edit sheet, Remove on the last traveler |
| Paste | Every link box (flight, stay, place) — fills it from the clipboard; the box also reads the clipboard once when the sheet opens |
| Couldn't read this link — fill in the details below. | Any link box, when the text isn't a link it understands |
| Check / Check price / + Add price | Price chip (§7.9): the amount plus ↻ and **Check**, **Check price** once over 3 days old, **+ Add price** with no price yet |
| Checked today / Checked {N} days ago | Price chip, the age line under the amount |
| Details ▾ / Details ▲ | Routes, the slim bottom total bar on phones — opens and closes the breakdown |
| I live here — no flight needed | Routes, under **Paste flight link** in the home-flights card |
| Matches your home airport | Routes, beside the tick when the home airport already says they live there (ticked and not switchable) |
| No flight needed — {name} lives in {city} | Routes, the home-flights card for a local traveler (no money in its heading) |
| Already home | Routes, the end of a local traveler's rail, in place of a flight home |
| Flights saved here stay put, but they don't count while {name} lives in {city}. | Routes, under flights saved before the traveler became local |
| No stays yet for {city}. | Stays, a stop group with no stays — shown with its dates, nights, empty night bar, search links and **Add stay** |
| No stays yet. Search above, then paste a link to add one. | Stays, only when there's no route **and** no stays |
| {city} · {Day, Mon D} | Days, a day card's header — the date alone with no title, the title alone when undated, **Undated day** when it has neither |

Round 6 retires the event fields: **Add place** no longer asks for event dates, the "Events during trip dates" filter is gone, and Days no longer shows "Happening this day". Put a date in the place's note instead.

## Phone sign-in (T32)

| Wording | Where |
|---|---|
| On iPhone, Google sign-in can't return to the home-screen app. Sign in with email and password here, or sign in once in Safari. | Sign-in screen, shown only after a Google sign-in attempt from the home-screen app comes back with no user |
| Move to… | Earlier flights row — picks a traveler (home) or a shared hop, plus the idea and option |
