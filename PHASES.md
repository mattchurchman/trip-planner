# Build phases

Build one phase per session. Each phase ends with a working app that the owner can use and check. Section numbers like "§7.3" refer to `SPEC.md`.

The owner starts each session with a short message such as:

> Read CLAUDE.md, then build Phase 2 from PHASES.md.

---

## Phase 0 — Skeleton, sign-in and trips list

**Goal:** friends on the allowlist can sign in with Google and create, open and delete trips. Everyone else is kept out.

**Before starting:** the owner gives you their Firebase web config, the `firebaseConfig` object from the Firebase console. If they haven't, write the placeholder file and make the app show the setup message from §7.1.

**Build:**
- The file layout from §3.1. Create only the files this phase needs, plus `package.json`, `404.html` (redirect exactly as in §3.1), `firestore.rules` (exact text from §6), and `tests/run-tests.js`.
- `js/firebase.js`: pin one exact version of the modular Firebase Web SDK from the gstatic CDN (look up the current stable version number in Firebase's release notes). Initialize the app, Auth and Firestore, and re-export the functions used elsewhere.
- `js/app.js`: auth gate and access check (§7.1), a hash router, and the top bar (§4).
- `js/views/trips.js`: trips list, **New trip**, and **Delete** for the creator (§7.2). For now, a trip page just shows the trip name, the tab bar with only **Overview**, and a "More coming soon" note.
- `js/lib/money.js` and `js/lib/dates.js` with the functions from §11, plus tests.
- `css/styles.css`: the look from §4, including phone layout.

**Tests to write:** parsing money (valid and invalid examples, including `"$1,234.56"`→`123456`, `"0.1"`→`10`, `"12.345"`→null, `"abc"`→null, `"0"`→`0`; price logging in Phase 3 separately rejects 0), formatting, `split` (for example 1000 cents into 3 people gives `[334, 333, 333]` and the parts always sum to the whole), and nights between dates (9-night example, plus missing and reversed dates).

**Owner check:**
1. Open the live site while signed out and see the sign-in card.
2. Sign in with an email that is **not** on the allowlist and see the "isn't on the trip list yet" message and nothing else.
3. Sign in with an allowlisted email and see an empty trips list, with no sample trips.
4. Create a trip named "Test trip", reload the page, and confirm it's still there.
5. Have a friend on the allowlist sign in and confirm they see "Test trip".
6. The friend should not see **Delete** on your trip. You delete it, confirm, and it disappears for both of you.
7. On your phone, the page fits the screen with no sideways scrolling.

---

## Phase 1 — Overview: travelers, candidates, ranking, comments, discover links

**Goal:** the group can brainstorm destinations, rank them, discuss them, and pick one.

**Build:**
- `js/ui.js` rank control and `js/lib/votes.js` (§7.3).
- `js/views/comments.js` (§7.4).
- `js/views/overview.js`: editable trip details, travelers, candidates, **Choose this destination**, and the Discover panel (§7.5).
- `js/lib/links.js`: `safeUrl` (§9.5) and every builder in §9.1.
- Nominatim lookup for the destination (§9.4), used only by **Choose this destination**.
- Copy-link buttons with the fallback text field (§8).

**Tests to write:** vote score and sort order (including ties), summary text, "not ranked by me"; every link builder with and without dates (check exact output strings); `safeUrl` accepting http and https and rejecting `javascript:`, `data:`, `ftp:` and plain text.

**Owner check:**
1. Create a trip, then add two travelers (one app member and one name-only person) with home cities.
2. Add three candidate destinations with notes and a link.
3. Rank each one yourself; have a friend rank them too. The order and summaries update for both of you without reloading.
4. Click your own choice again and confirm it clears.
5. Comment on a candidate; your friend sees it and can reply.
6. While you're typing a comment, have your friend change a vote. Your typing is not lost.
7. **Google Flights Explore** opens Google's explore page.
8. Choose a destination. The status changes to Planning, and the Discover panel now shows flight searches for each traveler and hotel and idea searches. Open a few to make sure they land on sensible pages.

---

## Phase 2 — Places and map

**Goal:** everyone pins places, filters them by category and neighborhood, ranks them, and sees them on a map.

**Build:**
- Add the **Places** tab.
- `js/views/places.js`: list, map, filters, sort, add/edit/delete, the three location methods, and the list↔map linking (§7.6).
- `js/lib/mapsurl.js` (§9.3).
- Leaflet map setup (§3, §4 colors). Place search via Nominatim (§9.4).
- **Open in Google Maps** links (§9.2, first bullet).

**Tests to write:** `parseGoogleMapsUrl` on at least 8 examples:
- a `/place/…/@…/data=…!3d…!4d…` URL, where the `!3d!4d` coordinates must win over `@`
- an `@`-only URL
- a `?api=1&query=lat,lng` URL
- a `?q=lat,lng` URL
- a `maps.app.goo.gl` short link, which returns the short-link error
- a non-Google URL
- plain text
- out-of-range coordinates

Also test the Google Maps search link builder.

**Owner check:**
1. In Google Maps, open a restaurant, copy the full URL from the address bar, and paste it into **Add place**. The name and pin fill in.
2. Paste a `maps.app.goo.gl` share link and get the clear "short links" message.
3. Add a place with **Search**, and another with **Place on map**.
4. Add a place with no location. It shows "No map pin" and **Set location**.
5. Filter by Food plus one neighborhood; the map and list both narrow.
6. Click a list row, and the map opens that pin. Click a pin, and the list highlights that row.
7. Rank places; the "You haven't ranked N places" count goes down.
8. **Open in Google Maps** on a place opens the right spot.
9. Check that it's usable on your phone.

---

## Phase 3 — Flights, stays, prices and totals

**Goal:** each traveler records flight options, the group records stay options, prices are logged by hand, and per-person totals are clear.

**Build:**
- Add the **Flights & stays** tab.
- `js/views/travel.js`: flights per traveler, stays, shared costs, totals card (§7.7).
- Price panel with sparkline (§7.8).
- `js/lib/totals.js` (§11).
- Stays with coordinates appear on the Places map (§7.7).
- Removing a traveler cleans up `selectedFlights` (§7.5); make sure that works now.

**Tests to write:**
- latest entry with out-of-order arrays and a timestamp tie
- delta up, down and none
- new low (including when there's only one entry, which is not a new low)
- per-night for 9 nights
- totals for 2 travelers with different flights, a stay of `$1,000.01` and a shared cost of `$100.00`, where the per-person totals must add exactly to the combined total
- a partial total with the correct missing-items list when one flight has no price

**Owner check:**
1. Add two flight options for yourself, open **Search Google Flights**, and confirm it prefills your route and dates.
2. Log a price, then log a lower one. You see "▼ … lower" and **New low**, and the input stays filled with the latest price.
3. Choose one option. Your friend adds and chooses theirs.
4. Add two stays, one with a Booking.com link and one with just a name. Log a total for one, set a 9-night range, and check that the per-night price is right.
5. Rank the stays and choose one.
6. Add a shared cost of $100. The totals card shows each person's flight + half the stay + $50, and the sum matches the combined total.
7. Remove the price from one flight (delete its history entry). The card changes to **Partial total** and names what's missing.
8. Check that nothing ever shows a price you didn't type.

---

## Phase 4 — Day plans

**Goal:** turn ranked places into loose, flexible days you can open as walking routes.

**Build:**
- Add the **Days** tab.
- `js/views/days.js`: everything in §7.9, including the day map and walking-route links (§9.2, second bullet).
- Add route splitting to `links.js`.

**Tests to write:** walking-route builder with 2, 5, 10 and 14 places. Check the splitting, that each part starts where the previous one ended, the `%7C` encoding, and that places without coordinates are skipped. Also test the event-overlap check.

**Owner check:**
1. Set trip dates and press **Create days from trip dates**. You get one day per date, and pressing it again adds no duplicates.
2. Add places to Day 1, reorder them with ▲/▼, and remove one back to Unplanned.
3. The day map shows numbered pins joined in order.
4. **Open walking route** opens Google Maps walking directions through your stops in order.
5. An event with dates during the trip shows "Happening this day" for the right day.
6. Delete a day, and its places return to Unplanned.

---

## Phase 5 — Export to Google My Maps

**Goal:** get every pin into a shared Google My Maps map for use during the trip.

**Build:**
- `js/lib/exporters.js`: CSV (§10.1) and KML (§10.2).
- Export buttons, the left-out count, and the help box (§7.10) on the Places and Days tabs.

**Tests to write:** CSV header exact; quoting of commas, quotes and newlines; `\r\n` line endings; parse your own CSV back with a small test parser and get the same values. KML: longitude first, XML escaping of `& < > " '`, and one folder per category.

**Owner check:**
1. Download the CSV and open it in a spreadsheet. The columns match and names with commas look right.
2. In Google My Maps, create a map, import the CSV (Latitude/Longitude for location, Name for title), then **Style by → Category**. Pins land in the right places.
3. Import the KML into a second test map and check it too.
4. Share the My Maps map with a friend and open it on your phone.

---

## Phase 6 — Recap and public page

**Goal:** after the trip, capture what you loved and share it.

**Build:**
- Add the **Recap** tab.
- `js/views/recap.js`: album link, place reactions, Next time, Copy to a new trip, planned vs actual, publish and unpublish (§7.11).
- `recap.html` public page (§7.11, §5.5). It uses its own small script that reads only `publicRecaps/{tripId}` and needs no sign-in.

**Tests to write:** a pure function that builds the public recap object from places, reactions and users. It must use first names only, include no uids, emails or prices, and count loved/fine/skipped correctly. Also test the Next-time list logic.

**Owner check:**
1. Paste a shared album link, and it shows as a working link.
2. Mark a few places Loved, Fine and Skipped with notes and a photo link. Your friend adds theirs.
3. **Next time** lists the places no one reacted to plus the skipped ones. **Copy to a new trip** creates a new trip with those places, unranked.
4. Enter actual spend and see it next to the planned total.
5. **Publish recap**, then open the public link in a private/incognito window without signing in. You see the recap with no emails and no prices.
6. **Unpublish**, reload the public link, and see "This recap isn't published."

---

## Phase 7 (optional) — Review and polish

Use a stronger model for this one.

> Read CLAUDE.md and SPEC.md. Review the whole app against the spec without adding features. Check security (innerHTML, links, Firestore rules), that live updates never wipe forms, phone layout, keyboard access, and that every button works. List problems first, then fix them one at a time with tests where possible.
