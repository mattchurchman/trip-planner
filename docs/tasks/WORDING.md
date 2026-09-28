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
| Candidate destinations | Destination ideas | Overview heading |
| Add candidate destination | Add a destination idea | Overview |
| No candidates yet. | No ideas yet. Add a place you'd love to go — Google Flights Explore is a good place to look. | Overview |
| Choose this destination | Pick this destination | Candidate card |
| Discover | Search the web | Overview panel heading |
| Must / Nice / Skip | Must / Nice / Skip (keep), with tooltips "Must go", "Nice to have", "Skip it" | Rank control |
| Ranking (sort) | Group favorites | Places sort |
| Not ranked by me | I haven't ranked yet | Filters |
| Unplanned | Not in a day yet | Days tab |
| Log price | Save price | Price panel |
| No price logged yet. | No price yet. Check the site, then save what you saw. | Price panel |
| Shared costs | Split costs | Flights & stays |
| Add shared cost | Add a split cost | Flights & stays |
| Partial total | Total so far (missing some prices) | Totals card |
| Combined | Everyone together | Totals card |
| Place reactions | How was it? | Recap |
| Next time | Didn't get to | Recap |
| Use this link | Read this link | Location picker |
| Location needed for this destination — this will be set once the Places map is built (Phase 2). | We couldn't find this city on the map. Use **Set on map** on the Places tab to place it. | Overview (stale text — must change) |
| Search by OpenStreetMap Nominatim | Search results from OpenStreetMap | Search results credit |
| Plan trips with your friends. | Plan trips with your friends — from "where should we go?" to the recap. | Sign-in card |
| No trips yet. Start one! | No trips yet. Start one with **New trip**. | Trips list |

Tab names stay: **Overview · Places · Flights & stays · Days · Recap**.
