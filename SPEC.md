# Trip Planner — Specification

Spec version: **1.0** (September 2026)

This is the source of truth for what the app is and how it works. The build phases are in `PHASES.md`, and the working rules for the building model are in `CLAUDE.md`. If code and this spec disagree, the spec wins unless the owner approves a change and this file is updated in the same commit.

---

## 1. What the app is

A private, free website where a small group of friends (roughly 3–8 people) plans trips together **before** they leave. It collects what the group finds elsewhere; it does not search for flights or hotels itself.

The group's process, which the app follows:

1. **Explore.** Each person finds cheap or interesting destinations on Google Flights Explore (flexible dates, map mode) and adds them as *candidate destinations*. The group ranks the candidates and picks one.
2. **Collect places.** Everyone pins places in the chosen city: food first, spread across neighborhoods worth walking, plus walking tours, museums and historic sites, concerts and seasonal events, adventure activities (climbing, surfing, skiing), and day trips or excursions. The group ranks them.
3. **Flights and stays.** Each traveler records their own flight options from their home city. The group records stay options from Booking.com, Airbnb, Google Hotels or elsewhere, logs prices they have checked by hand, and ranks the stays. The app shows per-person totals.
4. **Loose days.** Places get grouped into flexible days, usually one or two neighborhoods per day. A day can be opened as a walking route in Google Maps.
5. **Export.** All pins export to Google My Maps, which the group uses on their phones during the trip.
6. **Recap (after the trip).** People mark places as loved, fine or skipped with a short note and a photo link, link a shared photo album, and can publish a read-only recap page.

## 2. Hard constraints

- **Cost is $0 with no credit card anywhere.** Use only: GitHub Pages (hosting), the Firebase **Spark** plan (Authentication and Cloud Firestore only), Leaflet with OpenStreetMap tiles, and OpenStreetMap Nominatim for occasional place search. Never use Firebase Cloud Storage, Cloud Functions, Firebase Hosting features that need Blaze, the Google Maps JavaScript API, the Places API, or any paid or keyed API.
- **No live price data.** No flight or hotel price API, no scraping, no fake or sample prices. Every price is typed in by a person after checking it themselves.
- **No photo uploads.** Photos live in an external shared album; the app stores links only.
- **Only approved people** (an allowlist of email addresses) can read or write anything, except a recap page that has been deliberately published.

## 3. Architecture (frozen)

| Part | Choice |
|---|---|
| Hosting | GitHub Pages, served from the `main` branch, repository root |
| Code | Plain HTML, CSS and JavaScript ES modules. No framework, no build step, no npm dependencies, no TypeScript |
| Routing | Hash routes (`#/trip/<id>/places`) so GitHub Pages never needs server routing |
| Sign-in | Firebase Authentication, Google provider, popup sign-in |
| Database | Cloud Firestore (Standard edition) with the security rules in section 6 |
| Firebase SDK | Modular Firebase Web SDK loaded from `https://www.gstatic.com/firebasejs/<VERSION>/…`. Pin one exact version. Only `js/firebase.js` imports from the CDN; every other file imports from `./firebase.js` |
| Map | Leaflet **1.9.4** from `https://unpkg.com/leaflet@1.9.4/dist/` with OpenStreetMap standard tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png` and the attribution `© OpenStreetMap contributors` |
| Place search | Nominatim (section 9.4), only when the user presses a Search button |
| Tests | `node tests/run-tests.js` using Node's built-in `assert`; no test libraries |

### 3.1 File layout

```
index.html            app shell; loads css/styles.css and js/app.js
recap.html            public read-only recap page (Phase 6)
404.html              redirects to the app home (see note below)
package.json          {"type": "module", "private": true}  (no dependencies)
firestore.rules       security rules (owner pastes into the Firebase console)
css/styles.css
js/firebase-config.js the owner's Firebase web config (public values; safe to commit)
js/firebase.js        initializes Firebase, re-exports the functions the app uses
js/app.js             auth gate, router, top bar
js/store.js           all Firestore reads, writes and listeners
js/ui.js              shared DOM helpers (el(), status messages, confirm, rank control)
js/lib/money.js       pure: parse, format, split
js/lib/dates.js       pure: date math and formatting
js/lib/votes.js       pure: ranking scores and summaries
js/lib/links.js       pure: external link builders and URL safety
js/lib/mapsurl.js     pure: read coordinates and names from Google Maps URLs
js/lib/totals.js      pure: latest price, deltas, per-traveler totals
js/lib/exporters.js   pure: CSV and KML generation
js/views/trips.js     trips list
js/views/overview.js  trip overview, travelers, candidates, discover links
js/views/places.js    places list and map
js/views/travel.js    flights, stays, shared costs, totals
js/views/days.js      day plans
js/views/recap.js     recap editing and publishing
js/views/comments.js  comment thread component
tests/run-tests.js    imports every tests/*.test.js and reports pass/fail
tests/*.test.js
```

**The site is served from a subpath** (`https://<user>.github.io/trip-planner/`). Every reference to a file of this app (scripts, styles, links to `recap.html`) must be relative, such as `./js/app.js`, and never start with `/`. `404.html` redirects with `location.replace(location.origin + '/' + location.pathname.split('/')[1] + '/')`.

Files under `js/lib/` must not touch the DOM or import Firebase, so Node can test them directly. Keep each file under about 400 lines; split if needed.

## 4. Look and feel

Aim for the calm, practical feel of Google's travel tools.

- White cards on a light gray page (`#f6f8fb`), one blue accent (`#1a73e8`), dark text (`#1f2933`), 8 px rounded corners, soft 1 px borders, and the system font stack.
- Top bar: app name, signed-in user's avatar or initial, **Sign out**.
- Trip page: trip name and status at the top, with tabs **Overview · Places · Flights & stays · Days · Recap**. Only show tabs whose phase has been built.
- Desktop: list and map side by side on the Places tab. Phone (under 760 px): one column, map above list, all controls reachable, no horizontal scrolling.
- Category colors, used on map markers and list chips:

| Category | Color |
|---|---|
| Food | `#e8710a` |
| Drinks & nightlife | `#9334e6` |
| Neighborhood walk | `#188038` |
| Sight | `#1a73e8` |
| Museum & history | `#795548` |
| Walking tour | `#00897b` |
| Event & seasonal | `#d93025` |
| Adventure | `#f9ab00` |
| Day trip | `#3949ab` |
| Shopping | `#c2185b` |
| Other | `#5f6368` |

- Price movement is shown with words and arrows (for example "▼ $42 lower") as well as color.
- Every control has a visible label, is reachable by keyboard and shows a focus outline.

## 5. Data model (Cloud Firestore)

Conventions:

- Money is stored as integer cents in a field ending in `Cents`. `$741.24` is stored as `74124`. Each trip has one `currency` (ISO code, default `"USD"`) and every amount in the trip uses it.
- Calendar dates are strings `"YYYY-MM-DD"`. Document timestamps (`createdAt`, `updatedAt`) use Firestore `serverTimestamp()`. Timestamps inside arrays (price entries) are ISO 8601 UTC strings from `new Date().toISOString()`, because `serverTimestamp()` cannot be used inside arrays.
- IDs are Firestore auto-IDs, except array items (travelers, price entries), which use `crypto.randomUUID()`.
- Optional values are stored as `null`, never left missing, so every document of a type has the same fields.
- **Concurrent editing:** several people may edit at once. Always update single fields with `updateDoc` and field paths (for example `votes.<uid>`), use `arrayUnion` and `arrayRemove` for price entries, and never read a whole document, change it and write it all back. The one exception is the `travelers` array, which changes rarely.

### 5.1 `allowlist/{email}`

The document ID is a lowercase email address. The owner creates these by hand in the Firebase console.

```
name: string            // friendly name, e.g. "Sam"
```

### 5.2 `users/{uid}`

Written by each user for themselves on every sign-in.

```
displayName: string
email: string           // lowercase
photoURL: string | null
lastSeenAt: timestamp
```

### 5.3 `trips/{tripId}`

```
name: string                         // required, non-blank
status: "exploring" | "planning" | "booked" | "done"
currency: string                     // "USD"
notes: string
destination: null | {
  city: string, country: string,
  lat: number | null, lng: number | null,   // null until a location is found
  airport: string                    // IATA code or "" if unknown
}
startDate: string | null             // "YYYY-MM-DD"
endDate: string | null
travelers: [ {
  id: string,                        // UUID; never reused or remapped
  name: string,
  uid: string | null,                // linked app user, if any
  homeCity: string,
  homeAirport: string                // IATA code or ""
} ]
selectedFlights: { [travelerId]: flightId }   // map; may be empty
selectedStayId: string | null
albumUrl: string | null              // shared photo album (Phase 6)
actualSpendCents: { [travelerId]: integer }   // Phase 6; may be empty
createdBy: uid
createdAt: timestamp
updatedAt: timestamp
```

A new trip starts with `status: "exploring"`, `currency: "USD"`, empty `notes`, `destination: null`, null dates, one traveler (the creator, linked by uid, with empty home fields), and empty maps.

### 5.4 Subcollections of a trip

All live under `trips/{tripId}/`. Every document has `addedBy` (uid), `createdAt` and `updatedAt`, not repeated below.

**`candidates/{id}`**: a possible destination while exploring.
```
city: string, country: string
why: string                          // what makes it appealing
roughPriceNote: string               // free text, e.g. "~$450 RT from DEN in March"
dateIdea: string                     // free text, e.g. "late March, 6–8 nights"
link: string | null                  // e.g. a Google Flights link someone found
lat: number | null, lng: number | null
airport: string                      // IATA or ""
votes: { [uid]: "must" | "nice" | "skip" }
```

**`places/{id}`**
```
name: string
category: one of the 11 categories in section 4, stored as the exact label
neighborhood: string                 // free text, e.g. "Alfama"
note: string
lat: number | null, lng: number | null
googleMapsUrl: string | null         // the link the user pasted, if any
link: string | null                  // website, tour booking page, event page
eventStart: string | null            // "YYYY-MM-DD"; for events and seasonal things
eventEnd: string | null
dayId: string | null                 // Phase 4
dayOrder: number | null              // Phase 4; position within the day
votes: { [uid]: "must" | "nice" | "skip" }
recap: { [uid]: { rating: "loved" | "fine" | "skipped", note: string, photoUrl: string | null } }  // Phase 6
```

**`flights/{id}`**: one flight option for one traveler. A traveler may have several options.
```
travelerId: string
label: string                        // e.g. "Nonstop, Tuesday out"
fromCity: string, fromAirport: string
toCity: string, toAirport: string
outboundDate: string | null
outboundDetails: string              // free text: airline, flight numbers, times, stops
returnDate: string | null
returnDetails: string
link: string | null                  // the Google Flights (or airline) link they used
notes: string
prices: [ PriceEntry ]
```

**`stays/{id}`**
```
name: string
provider: "booking" | "airbnb" | "google_hotels" | "hotel_direct" | "other"
link: string | null
neighborhood: string
lat: number | null, lng: number | null
checkIn: string | null, checkOut: string | null
guests: integer (≥ 1)
note: string
prices: [ PriceEntry ]               // each amount is the TOTAL for the whole stay
votes: { [uid]: "must" | "nice" | "skip" }
```

**`costs/{id}`**: shared costs split equally.
```
label: string                        // e.g. "Rental car", "Food estimate"
amountCents: integer (≥ 0)
note: string
```

**`days/{id}`**
```
date: string | null                  // "YYYY-MM-DD"
title: string                        // e.g. "Alfama + Graça"
focus: string                        // neighborhoods or theme
notes: string
order: number                        // sort key for days
```

**`comments/{id}`**
```
targetType: "trip" | "candidate" | "place" | "flight" | "stay"
targetId: string                     // the trip id when targetType is "trip"
text: string                         // 1–2000 characters
```

**PriceEntry** (item inside a `prices` array)
```
id: string                           // UUID
amountCents: integer (≥ 1)
checkedAt: string                    // ISO 8601 UTC
byUid: string
note: string
```

### 5.5 `publicRecaps/{tripId}` (Phase 6)

A read-only snapshot, written only when someone presses **Publish recap**. It contains only what is listed here: no emails, no uids and no prices.

```
tripName: string, city: string, country: string
startDate: string | null, endDate: string | null
albumUrl: string | null
publishedAt: timestamp
places: [ {
  name, category, neighborhood,
  lat: number | null, lng: number | null,
  loved: integer, fine: integer, skipped: integer,
  notes: [ { by: string, text: string } ],   // "by" is the first name only
  photoUrl: string | null                    // first non-null photo link
} ]
```

## 6. Security rules (exact)

`firestore.rules` must contain exactly this. The owner pastes it into Firebase console → Firestore → Rules → Publish.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function myEmail() {
      return request.auth.token.email.lower();
    }

    function allowed() {
      return signedIn()
        && request.auth.token.email_verified == true
        && exists(/databases/$(database)/documents/allowlist/$(myEmail()));
    }

    match /allowlist/{email} {
      allow read: if signedIn() && myEmail() == email;
      allow write: if false;
    }

    match /users/{uid} {
      allow read: if allowed();
      allow write: if allowed() && request.auth.uid == uid;
    }

    match /trips/{tripId} {
      allow read: if allowed();
      allow create: if allowed()
        && request.resource.data.createdBy == request.auth.uid;
      allow update: if allowed()
        && request.resource.data.createdBy == resource.data.createdBy;
      allow delete: if allowed()
        && resource.data.createdBy == request.auth.uid;

      match /{subcollection}/{docId} {
        allow read, write: if allowed();
      }
    }

    match /publicRecaps/{tripId} {
      allow read: if true;
      allow write: if allowed();
    }
  }
}
```

The Firebase web config in `js/firebase-config.js` is public by design. The rules above, not secrecy, protect the data.

## 7. Behavior

### 7.1 Sign-in and access

- Signed out: a centered card with the app name, one sentence ("Plan trips with your friends."), and **Sign in with Google** (popup).
- After sign-in, read `allowlist/<lowercase email>`. If it does not exist, show: "You're signed in as <email>, but this account isn't on the trip list yet. Ask the owner to add it." plus **Sign out**. Load nothing else.
- If allowed, write the `users/{uid}` document, then show the trips list.
- If Firebase is not configured (placeholder values still in `js/firebase-config.js`), show a setup message naming that file instead of a broken page.

### 7.2 Trips list (`#/`)

- **New trip** asks for a name and creates the trip (section 5.3 defaults), then opens its Overview.
- Cards show name, status, destination city (or "Still exploring"), dates, traveler names, and last updated time. They are sorted by `updatedAt`, newest first.
- **Delete** appears only for the trip's creator. It asks for confirmation, then deletes every document in all seven subcollections in batches of up to 400, then `publicRecaps/{tripId}` if it exists, then the trip document.

### 7.3 Ranking (used for candidates, places and stays)

- A three-option control per item: **Must**, **Nice**, **Skip**. The current user's choice appears pressed (`aria-pressed="true"`). Pressing your current choice again clears it (`deleteField()`).
- Write only `votes.<my uid>`.
- Score: Must = +2, Nice = +1, Skip = −1, no vote = 0. A summary such as "2 must · 1 nice · 1 skip" is shown next to the control. Hovering or tapping the summary lists who chose what, using display names from `users`.
- Default sort: score descending, then more Must votes, then newest `createdAt`.
- The filter **Not ranked by me** shows items where the current user has no vote. Show a count on each tab ("You haven't ranked 4 places").

### 7.4 Comments

Any candidate, place, flight, stay, or the trip itself can have a thread. Show the count, expand inline, newest last, with the author's name and relative time. Only the author sees **Delete** on their own comment.

### 7.5 Overview tab

- Editable: trip name (non-blank), status, start and end dates (end not before start), currency (three uppercase letters), notes.
- **Travelers:** add a traveler by choosing an app member or typing a name; edit name, home city and home airport; remove with confirmation. At least one traveler must remain. Removing a traveler also deletes that traveler's entry in `selectedFlights`, and asks whether to delete their flight options.
- **Candidate destinations** (shown prominently while exploring, collapsed afterward): add, edit, delete, rank, comment. Each card shows city, country, why, rough price note, date idea and link.
- **Choose this destination** on a candidate sets `trip.destination` from the candidate. If the candidate has no coordinates, run a Nominatim search for "city, country" and use the first result. If nothing is found, store `lat` and `lng` as `null` and show a "Location needed" note with a **Set on map** action (the next click on the Places map sets the destination's coordinates). While the destination has no coordinates, the map centers on the trip's pins, or shows the whole world if there are none. It then sets status to `planning` if it was `exploring`. The group can change the destination later.
- **Discover** panel of external links (section 9.1). While exploring it shows Google Flights Explore. Once a destination exists, it also shows per-traveler flight searches, stay searches, and idea searches.

### 7.6 Places tab

- A list and a Leaflet map showing the same filtered set.
- Filters: category (multi-select chips), neighborhood (dropdown built from existing values), text search on name and note, **Not ranked by me**, and "Events during trip dates". Sort: Ranking (default), Newest, Neighborhood, Category.
- **Add place** form: name (required), category (required), neighborhood, note, link, event start and end, and a location in one of three ways:
  1. **Paste a Google Maps link.** Parse it with section 9.3. If coordinates are found, fill them in and, if the name field is empty, fill in the name.
  2. **Search** by name, which runs a Nominatim search limited to the destination (section 9.4) and lets the user pick one of up to 5 results.
  3. **Place on map**, which switches to a mode where the next map click sets the coordinates.

  A place may be saved with no location. It shows "No map pin" and is excluded from the map and exports.
- Map: centered on the destination (or on the pins). Each place is an `L.circleMarker` in its category color. The popup shows name, category, neighborhood, note, the rank summary, **Open in Google Maps**, and **Edit**. Clicking a list row pans to its marker and opens the popup, and clicking a marker scrolls to and highlights its row.
- Places without coordinates are listed with a **Set location** action.
- Edit and delete (with confirmation) any place.

### 7.7 Flights & stays tab

**Flights.** One section per traveler, titled "<name> from <home city>".
- **Add flight option** fields match section 5.4. Pre-fill from and to from the traveler's home and the trip destination. Pre-fill dates from the trip dates.
- Beside the form, show **Search Google Flights** (section 9.1) for that traveler.
- Each option shows its details, link, notes, price panel (7.8) and comments. **Choose** sets `selectedFlights.<travelerId>`. The chosen option shows a "Chosen" badge, and choosing another replaces it.

**Stays** (up to 10 options).
- Add, edit and delete. Fields match section 5.4. Guests default to the number of travelers, and check-in and check-out default to the trip dates.
- Beside the form, show **Search Google Hotels**, **Search Booking.com** and **Search Airbnb** (section 9.1).
- Each stay shows its price panel, nights, guests, price per night (when computable), rank control and comments. **Choose** sets `selectedStayId`.
- A stay with coordinates also appears on the Places map as a larger `L.circleMarker` (radius 9, fill `#202124`, white 2 px border) with the tooltip "Stay: <name>". Stays can be hidden with a "Show stays" checkbox.

**Shared costs.** Add, edit and delete a label, amount and note. Split equally across all travelers.

**Totals card.** One row per traveler: flight + stay share + shared costs share = total. Then a combined total. If anything is missing, label the card **Partial total** and list what is missing, such as "No flight chosen for Sam", "No price logged for Sam's flight" or "No price logged for Casa Alfama". Never show a missing price as $0.

### 7.8 Price panel (flights and stays)

- Shows the latest price, when it was checked and by whom, the change from the previous check (for example "▲ $38 higher", "▼ $12 lower", "No change"), a **New low** badge when the latest amount is lower than every earlier one, and a small inline SVG sparkline of all entries in time order (only when there are 2 or more).
- An amount input pre-filled with the latest amount, an optional note, and **Log price**, which appends a PriceEntry with `arrayUnion`. Amounts accept "$1,234.56", "1234.56", "1234" and "1234.5", and anything that is not a positive amount is rejected with an inline error.
- **History** expands the full list, newest first. Each entry has a delete action (with confirmation) that uses `arrayRemove` on the exact entry object.
- A reminder next to the input: "Check the price on the site first, then log what you saw."

### 7.9 Days tab

- **Create days from trip dates** makes one day per date from start to end, skipping dates that already have a day. **Add day** makes an undated day. Days are sorted by `order`.
- Each day card shows date or label, title, focus, notes, its places in `dayOrder`, and actions to edit or delete the day. Deleting a day moves its places back to Unplanned.
- The **Unplanned** pool lists places with `dayId: null`, grouped by neighborhood and sorted by rank. Each has an **Add to day** menu.
- Within a day, **▲** and **▼** buttons reorder places and **Remove** returns a place to Unplanned. Do not use drag-and-drop.
- Events whose `eventStart`–`eventEnd` range overlaps a dated day show a hint "Happening this day" in the Unplanned pool for that day.
- **Day map:** selecting a day shows its places as numbered markers joined by a dashed straight line in order. A caption reads "Straight lines show the order, not the walking path."
- **Open walking route** builds Google Maps directions links (section 9.2) through the day's located places in order.

### 7.10 Export

Available from the Places tab and the Days tab.

- **Download CSV for Google My Maps**: section 10.1.
- **Download KML**: section 10.2.
- Before downloading, show how many places have no pin and will be left out.
- A short help box: "In Google My Maps: Create a new map → Import → choose the CSV → pick Latitude/Longitude for location and Name for the title → then 'Style by' Category. Share the map with your friends from My Maps."

### 7.11 Recap tab (Phase 6)

- **Photo album link:** paste a Google Photos or iCloud shared album link into `albumUrl`, validated with section 9.5.
- **Place reactions:** for each place in the trip, each user can set Loved, Fine or Skipped, a note, and an optional photo link (a link to one photo in the shared album). Write only `recap.<my uid>`.
- **Next time:** places no one marked Loved, Fine or Skipped, listed as "Didn't get to", plus places marked Skipped. **Copy to a new trip** creates a new trip in `exploring` status whose places are copies of these places (new IDs, votes and recap cleared, `dayId` null).
- **Planned vs actual:** each traveler can enter their actual spend (`actualSpendCents.<travelerId>`). This is shown beside the planned total from section 11.
- **Publish recap** writes `publicRecaps/{tripId}` (section 5.5) after a confirmation that lists what becomes public: trip name, city, dates, album link, place names and locations, reaction counts, notes with first names only, and photo links. **Unpublish** deletes it. Show the public link `recap.html?trip=<tripId>` with **Copy link**.
- `recap.html` needs no sign-in. It reads only `publicRecaps/{tripId}` and shows a map with markers sized or colored by loves, a list sorted by loves, notes, photo links, and the album link. If the recap doesn't exist, it says "This recap isn't published."

## 8. Rendering and state rules

- Use `onSnapshot` listeners for the open trip document and the subcollections the current tab needs. Unsubscribe when leaving the trip or tab. Never create a listener inside a render function.
- Keep open forms and dialogs **outside** containers that are re-rendered by snapshot updates. A live update must never wipe what someone is typing or close their form.
- Every write shows a pending state (button disabled, "Saving…"), then either a quiet success (the list updates) or an inline error near the control that keeps the user's input. Translate `permission-denied` to "You don't have access. Are you signed in with the approved account?"
- Build DOM with `document.createElement` and `textContent`. Never put user or database text into `innerHTML`.
- Any link from data or user input gets rendered as `<a>` only when `safeUrl()` (section 9.5) accepts it, and it opens with `target="_blank" rel="noopener noreferrer"`.
- Every **Copy link** button uses `navigator.clipboard.writeText`. If that fails, it shows a read-only, pre-selected text field containing the link.
- Show times in the viewer's locale and relative when recent ("5 min ago").

## 9. External links and lookups

All builders live in `js/lib/links.js` (and `mapsurl.js`) and are unit tested. Always use `encodeURIComponent` for values.

### 9.1 Discovery and check links

| Link | URL |
|---|---|
| Google Flights Explore | `https://www.google.com/travel/explore` |
| Google Flights search | `https://www.google.com/travel/flights?q=` + encode(`Flights from <FROM> to <TO> on <YYYY-MM-DD> returning <YYYY-MM-DD>`). FROM and TO use the airport code if present, otherwise the city. Omit the " on …" and " returning …" parts when dates are missing |
| Google Hotels | `https://www.google.com/travel/hotels?q=` + encode(`<city> hotels`) |
| Booking.com search | `https://www.booking.com/searchresults.html?ss=<city>&checkin=<YYYY-MM-DD>&checkout=<YYYY-MM-DD>&group_adults=<n>&no_rooms=1&group_children=0` (leave out the date parameters when dates are missing) |
| Airbnb search | `https://www.airbnb.com/s/<encoded city>/homes?checkin=<YYYY-MM-DD>&checkout=<YYYY-MM-DD>&adults=<n>` (leave out missing dates) |
| Google search idea | `https://www.google.com/search?q=` + encode(query) |

Idea searches on the Overview Discover panel, where `<city>` is the destination city and `<Month YYYY>` comes from the start date (leave it out if there's no date):

- `<city> best food neighborhoods`
- `<city> food tour`
- `<city> walking tour`
- `<city> history museum`
- `<city> events <Month YYYY>`
- `<city> concerts <Month YYYY>`
- `<city> seasonal festivals <Month YYYY>`
- `rock climbing near <city>`
- `surfing near <city>`
- `skiing near <city>`
- `day trips from <city>`

### 9.2 Google Maps links

- Open a place: `https://www.google.com/maps/search/?api=1&query=` + encode(`<name>, <city>`). When the place has a saved `googleMapsUrl` accepted by `safeUrl`, open that link instead.
- Walking route for a day: `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=<lat,lng>&destination=<lat,lng>&waypoints=<lat,lng>|<lat,lng>…` using the first located place as origin and the last as destination. Use at most 8 waypoints per link. If a day has more than 10 located places, split into consecutive links ("Route part 1", "Route part 2"…), each starting where the previous one ended. Encode `|` as `%7C`.

### 9.3 Reading Google Maps URLs (`mapsurl.js`)

`parseGoogleMapsUrl(text)` returns `{ lat, lng, name, error }`:

1. If the value passes `safeUrl` and the host is `maps.app.goo.gl` or `goo.gl`, return the error "Short share links can't be read here. Open the link, copy the full address from the browser bar, and paste that instead — or use Search or Place on map." (Check this first.)
2. Otherwise the value must pass `safeUrl` and the host must be `google.com`, `www.google.com`, `maps.google.com`, or a `google.<country>` / `www.google.<country>` domain (for example `google.co.uk`). If not, return the error "That doesn't look like a Google Maps link."
3. Coordinates, in this priority order:
   - `!3d<lat>!4d<lng>`, which is the place's own position.
   - `query=<lat>,<lng>` or `q=<lat>,<lng>` in the query string.
   - `@<lat>,<lng>,`, which is the map view center; use it only if nothing above matched.
4. Name: the path segment after `/place/`, URL-decoded, with `+` turned into spaces.
5. Accept only latitudes from −90 to 90 and longitudes from −180 to 180.
6. If no coordinates are found, return the name if one exists and the error "No location in this link — use Search or Place on map."

### 9.4 Nominatim search

- URL: `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=` + encode(`<query>, <destination city>, <destination country>`). For a destination lookup, the query is `<city>, <country>`.
- Run only when a Search button is pressed, never on each keystroke. Allow at most one request per second (queue or disable the button briefly).
- Show each result's `display_name` and use its `lat` and `lon` (strings, so convert them to numbers).
- Show "Search by OpenStreetMap Nominatim" under the results.
- On network failure, show an inline error and suggest Place on map.

### 9.5 URL safety

`safeUrl(text)` trims the text and returns the normalized URL string only when `new URL()` parses it and the protocol is `http:` or `https:`. Otherwise it returns `null`.

## 10. Export formats (`exporters.js`)

Both exports include only places with coordinates. Downloads use a `Blob` and a temporary `<a download>`.

### 10.1 CSV

- Filename: `<trip name slug>-places.csv` (lowercase, non-alphanumerics become `-`).
- UTF-8, no BOM, `\r\n` line endings, and RFC 4180 quoting (quote any field containing a comma, quote or newline, and double any internal quotes).
- Columns in this exact order: `Name, Latitude, Longitude, Category, Neighborhood, Note, Link, Ranking, Day`.
  - Latitude and Longitude have up to 6 decimals.
  - Link is `link`, else `googleMapsUrl`, else empty.
  - Ranking is the summary text, e.g. `2 must · 1 nice`, or empty.
  - Day is the day's title or date, or empty.
- Rows are sorted by Category, then Name.

### 10.2 KML

- Filename: `<trip name slug>-places.kml`.
- KML 2.2 with a `<Document>` named after the trip and one `<Folder>` per category that has places.
- Each `<Placemark>` has `<name>`, a `<description>` (neighborhood, note, link and ranking on separate lines), and `<Point><coordinates>lng,lat,0</coordinates></Point>`. Longitude comes first.
- Escape `& < > " '` in all text.

## 11. Calculations (`totals.js`, `money.js`, `dates.js`)

- **Parse money:** strip spaces, a currency symbol and thousands commas, then require `^\d+(\.\d{1,2})?$`, and convert to integer cents without floating-point error (split on `.`). Return `null` when invalid.
- **Format money:** `Intl.NumberFormat(locale, { style: "currency", currency })` on `cents / 100`.
- **Latest entry:** the entry with the greatest `checkedAt`. On an exact tie, the greater `id` wins. Array order means nothing.
- **Delta:** latest minus second-latest (by the same ordering). There is no delta with fewer than 2 entries.
- **New low:** there are 2 or more entries and the latest amount is strictly less than every other entry's amount.
- **Nights:** whole days between check-in and check-out computed in UTC, and only when both exist and check-out is later. Otherwise show "Dates needed".
- **Per night:** the latest stay total divided by nights, rounded to the nearest cent for display only. Never store it.
- **Equal split** `split(amountCents, n)`: `base = floor(amount / n)` and `remainder = amount − base × n`. The first `remainder` travelers (in `travelers` array order) get `base + 1`, and the rest get `base`. The shares always add up exactly to the amount.
- **Traveler total:** latest price of that traveler's chosen flight + their share of the chosen stay's latest price + their share of each shared cost, where each cost is split separately.
- **Combined total:** the sum of traveler totals.
- **Complete:** every traveler has a chosen flight with at least one price, and either no stay is chosen or the chosen stay has at least one price. Otherwise it's a **Partial total** with a list of missing items. Missing amounts count as 0 in the sum, but they are listed, and the total is never labeled complete.
- Store no derived values (latest price, totals, per-night, delta) in Firestore. Compute them when rendering.

## 12. Out of scope

Do not build any of these: flight or hotel price fetching, booking or payments, photo uploads, chat or notifications, offline mode, a native app, user roles beyond the allowlist, currency conversion, drag-and-drop, email invitations, analytics, or any AI features inside the app.

## 13. Changing this spec

Changes are made by the owner (or a model the owner asks). Edit this file first, bump the spec version at the top, note the change below, then build it.

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-26 | First version |
