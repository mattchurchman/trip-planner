# Trip Planner — Specification

Spec version: **3.0** (September 2026)

This is the source of truth for what the app is and how it works. The original build phases are in `PHASES.md` (all built); current work is in `docs/tasks/`. The working rules for the building model are in `CLAUDE.md`. If code and this spec disagree, the spec wins unless the owner approves a change and this file is updated in the same commit.

---

## 1. What the app is

A private, free website where a small group of friends (roughly 3–8 people) plans trips together **before** they leave. It collects what the group finds elsewhere; it does not search for flights or hotels itself.

The group's process, which the app follows:

1. **Explore.** Each person finds cheap or interesting destinations on Google Flights Explore (flexible dates, map mode) and adds them as *destination ideas*. The group ranks the ideas and picks one.
2. **Collect places.** Everyone pins places in the chosen city: food first, spread across neighborhoods worth walking, plus walking tours, museums and historic sites, concerts and seasonal events, adventure activities (whatever's regionally relevant — climbing, surfing, skiing, kayaking...), and day trips or excursions. The group ranks them.
3. **Flights and stays.** Each traveler records their own flight options from their home city. The group records stay options from Booking.com, Airbnb, Google Hotels or elsewhere, saves prices they have checked by hand, and ranks the stays. The app shows per-person totals.
4. **Loose days.** Places get grouped into flexible days, usually one or two neighborhoods per day. A day can be opened as a walking route in Google Maps.
5. **Export.** All pins export to Google My Maps, which the group uses on their phones during the trip.
6. **Recap (after the trip).** People mark places as loved, fine or skipped with a short note and a photo link, link a shared photo album, and can publish a read-only recap page.

## 2. Hard constraints

- **Cost is $0 with no credit card anywhere.** Use only: GitHub Pages (hosting), the Firebase **Spark** plan (Authentication and Cloud Firestore only), Leaflet with OpenStreetMap tiles, OpenStreetMap Nominatim for occasional place search, and the public Wikipedia page-summary API for destination photos (§9.7). Never use Firebase Cloud Storage, Cloud Functions, Firebase Hosting features that need Blaze, the Google Maps JavaScript API, the Places API, or any paid or keyed API.
- **No live price data.** No flight or hotel price API, no scraping, no fake or sample prices. Every price is typed in by a person after checking it themselves.
- **No photo uploads.** Photos live in an external shared album; the app stores links only.
- **Only approved people** (an allowlist of email addresses) can read or write anything, except a recap page that has been deliberately published.

## 3. Architecture (frozen)

| Part | Choice |
|---|---|
| Hosting | GitHub Pages, served from the `master` branch (this repo's default branch), repository root |
| Code | Plain HTML, CSS and JavaScript ES modules. No framework, no build step, no npm dependencies, no TypeScript |
| Routing | Hash routes (`#/trip/<id>/places`) so GitHub Pages never needs server routing |
| Sign-in | Firebase Authentication, Google provider, popup sign-in |
| Database | Cloud Firestore (Standard edition) with the security rules in section 6 |
| Firebase SDK | Modular Firebase Web SDK loaded from `https://www.gstatic.com/firebasejs/<VERSION>/…`. Pin one exact version. Only `js/firebase.js` imports from the CDN; every other file imports from `./firebase.js` |
| Map | Leaflet **1.9.4** from `https://unpkg.com/leaflet@1.9.4/dist/` with OpenStreetMap standard tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png` and the attribution `© OpenStreetMap contributors` |
| Place search | Nominatim (section 9.4), only when the user presses a Search button |
| Destination photos | Wikipedia REST page summary (section 9.7); no key, no account |
| Fonts | Google Fonts: Fraunces (headings) and Inter (everything else) |
| Tests | `node tests/run-tests.js` using Node's built-in `assert`; no test libraries |

### 3.1 File layout

```
index.html            app shell; loads css/styles.css and js/app.js
recap.html            public read-only recap page (Phase 6)
help.html             static "how to use this app" page for travelers; no sign-in, no Firebase
404.html              redirects to the app home (see note below)
package.json          {"type": "module", "private": true}  (no dependencies)
firestore.rules       security rules (owner pastes into the Firebase console)
css/styles.css
img/logo.svg          app logo (top bar, sign-in card, recap page)
img/favicon.svg       browser-tab icon (same artwork as logo.svg)
js/firebase-config.js the owner's Firebase web config (public values; safe to commit)
js/firebase.js        initializes Firebase, re-exports the functions the app uses
js/app.js             auth gate, router, top bar
js/store.js           all Firestore reads, writes and listeners
js/ui.js              shared DOM helpers (el(), status messages, confirm, rank control)
js/lookup.js          the only file that calls outside services with fetch(): Nominatim (§9.4) and Wikipedia (§9.7)
js/lib/categories.js  pure: the place categories and their colors (§4)
js/lib/stage.js       pure: the automatic trip stage badge (§11)
js/lib/money.js       pure: parse, format, split
js/lib/dates.js       pure: date math and formatting
js/lib/votes.js       pure: ranking scores and summaries
js/lib/links.js       pure: external link builders and URL safety
js/lib/mapsurl.js     pure: read coordinates and names from Google Maps URLs
js/lib/protobuf.js    pure: tiny reader for the binary data inside Google Flights links (§9.6)
js/lib/flightlink.js  pure: read flights, stops, airlines and price from Google Flights URLs (§9.6)
js/lib/airlines.js    pure: airline code -> name ("AS" -> "Alaska")
js/lib/staylink.js    pure: read provider, name, dates and guests from stay links (§9.6)
js/lib/photos.js      pure: build Wikipedia lookup URLs and pick a usable photo (§9.7)
js/lib/selection.js   pure: read chosen flights/stays, including the pre-2.0 shapes (§5.3)
js/lib/totals.js      pure: latest price, deltas, per-traveler totals
js/lib/exporters.js   pure: CSV and KML generation
js/views/trips.js     trips list
js/views/overview.js  trip overview, travelers, discover links
js/views/candidates.js destination idea cards and form (§7.5)
js/views/places.js    places list, filters and map
js/views/placeForm.js add/edit place form and the location picker (§7.6)
js/views/travel.js    Flights & stays tab shell, split costs, totals card
js/views/flights.js   flight options per traveler: section and cards (§7.7)
js/views/flightForm.js add/edit flight dialog (§7.7)
js/views/stays.js     stay options: section and cards (§7.7)
js/views/stayForm.js  add/edit stay dialog (§7.7)
js/views/staysMap.js  the stays price-pin map (§7.7)
js/views/pricePanel.js price panel shared by flights and stays (§7.8)
js/views/days.js      day plans
js/views/recap.js     recap editing and publishing
js/views/comments.js  comment thread component
tests/run-tests.js    imports every tests/*.test.js and reports pass/fail
tests/*.test.js
```

**The site is served from a subpath** (`https://<user>.github.io/trip-planner/`). Every reference to a file of this app (scripts, styles, links to `recap.html`) must be relative, such as `./js/app.js`, and never start with `/`. `404.html` redirects with `location.replace(location.origin + '/' + location.pathname.split('/')[1] + '/')`.

Files under `js/lib/` must not touch the DOM or import Firebase, so Node can test them directly. Keep each file under about 400 lines; split if needed.

### 3.2 Help page

`help.html` is a static, standalone page for travelers (not the owner) so they don't need to ask the trip owner or a coding model what a button does. It needs no sign-in and imports nothing from `js/` — plain HTML/CSS content only, styled with `css/styles.css`, opened via a **Help** link in the top bar (§4) that opens it in a new tab so it never interrupts the trip the traveler was looking at. Content: a one-paragraph "what this is," the tabs in the order a group actually uses them (Overview → Places → Flights & stays → Days → Recap) with one or two sentences on what each does, and a short troubleshooting list drawn from the *traveler-facing* rows of the owner's `README.md` troubleshooting table (skip anything requiring Firebase console access, which only the owner can do). Keep it current when a later phase changes what a tab does.

## 4. Look and feel

**Direction: warm and adventurous** — sunset terracotta and deep teal on warm sand, like a modern travel poster. Calm enough to read for a long time; the color comes from photos, accents and badges, not from filling every surface.

**Color tokens.** Define these once as CSS custom properties on `:root` in `css/styles.css` and use only the tokens elsewhere (category colors below are the one exception). Contrast ratios in brackets were checked against the background they sit on; don't swap a color without re-checking it reaches 4.5:1 for text.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#faf6f0` | page background (warm sand) |
| `--surface` | `#ffffff` | cards, dialogs, top bar |
| `--surface-muted` | `#f3ece2` | inset areas: form sections, empty states, table headers |
| `--text` | `#1f2a2e` | body text [13.6:1 on bg] |
| `--muted` | `#6b6f6a` | secondary text, labels [4.7:1 on bg] |
| `--primary` | `#b4472f` | terracotta: primary buttons (white text [5.4:1]), links, focus rings, active tab |
| `--primary-hover` | `#9a3a25` | hover/pressed state of primary |
| `--primary-soft` | `#fbe9e3` | pressed rank button background, highlighted row |
| `--secondary` | `#1f5f5b` | deep teal: "Chosen" badges, stage badge, secondary buttons' text/border [7.4:1] |
| `--secondary-soft` | `#e3efed` | background behind teal badges |
| `--sun` | `#f2a541` | small highlights only (New low badge, logo) — never text on white |
| `--border` | `#eadfd3` | card and input borders |
| `--danger` | `#b3261e` | errors and destructive buttons |
| `--success` | `#1e7a46` | success messages |
| `--hero-gradient` | `linear-gradient(135deg, #f2a541, #c8553d)` | decorative only: logo, photo placeholders, sign-in card header. Never put body text on it |

**Type.** Load Fraunces (weights 600, 700) and Inter (400, 500, 600) in one Google Fonts `<link>` with `display=swap`.

| Element | Font | Size / line height | Weight |
|---|---|---|---|
| Trip name (page `h1`) | Fraunces | 2rem / 1.15 (1.625rem on phones) | 700 |
| Section heading (`h2`, e.g. "Destination ideas") | Fraunces | 1.375rem / 1.25 | 600 |
| Card title (`h3`, e.g. a city or place name) | Inter | 1.0625rem / 1.3 | 600 |
| Field label, small caps-style label | Inter | 0.75rem / 1.3, uppercase, letter-spacing 0.06em | 600, `--muted` |
| Body | Inter | 0.9375rem / 1.55 | 400 |

Every section heading sits with its main action on the same row (heading left, button right; stacked on phones). Use exactly one `h1` per page, and don't skip heading levels.

**Spacing.** Use a 4 px scale (4, 8, 12, 16, 24, 32, 48) through tokens `--space-1` … `--space-7`. Cards have 16 px padding (20 px on desktop), 16 px gaps between cards, 32 px between page sections. Radius: 14 px for cards, 10 px for buttons and inputs, 999 px for pills.

**Surfaces and motion.** Cards are white with a 1 px `--border` and a soft shadow; interactive cards lift slightly on hover. Transitions are ~160 ms; respect `prefers-reduced-motion` by turning them off.

**Brand.** `img/logo.svg` (a white map pin and low sun over teal hills on a sunset square) appears at 28 px beside the words "Trip Planner" (Fraunces 700) in the top bar, at 64 px on the sign-in card, and on `recap.html` and `help.html`. Every HTML page links `img/favicon.svg` as its icon (`<link rel="icon" type="image/svg+xml" href="./img/favicon.svg">`) and sets `<meta name="theme-color" content="#1f5f5b">` so phone browsers tint their toolbar teal. Each page's `<title>` names where you are: "Trip Planner", "<trip name> · Trip Planner", "Help · Trip Planner", "<trip name> recap · Trip Planner".

**Layout.**
- Top bar: sticky, white, soft shadow; logo + name on the left; **Help** (opens `help.html` in a new tab), the signed-in user's avatar or initial, and **Sign out** on the right.
- Trip page: trip name and the pill-shaped stage badge (§11) at the top, then tabs **Overview · Places · Flights & stays · Days · Recap** (active tab: `--primary` text with a 3 px underline; others get a light hover background).
- Desktop: list and map side by side on the Places tab. Phone (under 760 px): one column, map above list, all controls reachable, no horizontal scrolling.
- Links are colored `--primary`, weight 500; a link that opens a new tab ends with a small "↗".
- Buttons: primary (solid `--primary`, white text), secondary (white, `--secondary` border and text), quiet (text only), danger (text `--danger`, solid only inside a confirmation dialog). One primary button per card or form.
- Category colors, used on map markers and list chips. They live in `js/lib/categories.js`; every other file imports them from there. Order in menus and filters is the order below:

| Category | Color |
|---|---|
| Food | `#e8710a` |
| Coffee & cafés | `#795548` |
| Drinks & nightlife | `#9334e6` |
| Neighborhood walk | `#188038` |
| Sight | `#1a73e8` |
| Museum & history | `#827717` |
| Walking tour | `#00897b` |
| Event & seasonal | `#d93025` |
| Adventure | `#f9ab00` |
| Day trip | `#3949ab` |
| Shopping | `#c2185b` |
| Other | `#5f6368` |

- **Stage badge** colors (§11): Exploring and Planning use `--surface-muted` with `--muted` text; a countdown ("In 42 days") uses `--secondary-soft` with `--secondary` text; "Happening now" uses `--sun` with `--text`; "Trip's over" uses `--primary-soft` with `--primary` text.
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
currency: string                     // "USD"
notes: string
destination: null | {
  city: string, country: string,
  lat: number | null, lng: number | null,   // null until a location is found
  airport: string                    // IATA code or "" if unknown
}
destinationId: string | null         // the chosen candidate's id; stamped onto places (§5.4) so
                                      // switching destinations later doesn't mix their place pools
startDate: string | null             // "YYYY-MM-DD"
endDate: string | null
travelers: [ {
  id: string,                        // UUID; never reused or remapped
  name: string,
  uid: string | null,                // linked app user, if any
  homeCity: string,
  homeAirport: string                // IATA code or ""
} ]
selectedFlights: { [travelerId]: [flightId] } // map of arrays; a traveler may choose several
                                      // flights (e.g. extra legs); may be empty
selectedStayIds: [stayId]            // the group may choose several stays (e.g. a second
                                      // area or a side trip); may be empty
albumUrl: string | null              // shared photo album (Phase 6)
actualSpendCents: { [travelerId]: integer }   // Phase 6; may be empty
createdBy: uid
createdAt: timestamp
updatedAt: timestamp
```

A new trip starts with `currency: "USD"`, empty `notes`, `destination: null`, null dates, one traveler (the creator, linked by uid, with empty home fields), empty maps, and `selectedStayIds: []`.

**Choosing several (since 2.0).** Add or remove one choice at a time with `arrayUnion` / `arrayRemove` on `selectedFlights.<travelerId>` or `selectedStayIds`, so two people choosing at once never overwrite each other.

**`status` is retired (3.0).** Trips made before 3.0 have a `status` field. Leave it alone: nothing reads or writes it any more, and the stage badge is computed instead (§11).

**Trips made before 2.0** may still hold the old shapes: a `selectedFlights` value that is a single flight id string, and a `selectedStayId` string field. `js/lib/selection.js` reads both shapes (a string counts as a one-item list; `selectedStayId` is merged into the stay list). The first time someone changes a legacy value, write the whole field as a list (`selectedFlights.<travelerId>: [old, new]`, or `selectedStayIds: [old, new]` plus `selectedStayId: deleteField()`) instead of using `arrayUnion`, because `arrayUnion` on a string would silently discard the old choice.

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
photo: null | {                      // destination photo from Wikipedia (§9.7)
  url: string,                       // https://upload.wikimedia.org/… image
  pageUrl: string                    // the Wikipedia article, for the credit link
}
```

`photo` is the one field that may be **missing**: missing means "not looked up yet", `null` means "looked up, nothing usable found". Candidates made before 2.0 have no `photo` field; the card looks it up once and saves the result (§7.5).

**`places/{id}`**
```
name: string
destinationId: string | null         // the trip's destinationId when this place was added (§5.3);
                                      // the Places tab shows only places matching the trip's current one
category: one of the 12 categories in section 4, stored as the exact label
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
outboundDetails: string              // free text; since 3.0 used for times, e.g. "Leaves 6:05 AM, lands 11:40 PM"
legs: [ {                            // read from a Google Flights link (§9.6); [] when unknown
  date: string | null,               // "YYYY-MM-DD"; legs[0] is outbound, legs[1] (if any) is return
  segments: [ { from: string, to: string, date: string | null,
                airline: string | null, flightNumber: string | null } ]   // one per flight taken
} ]
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

- Signed out: a centered card with the app name, one sentence ("Plan trips with your friends — from "where should we go?" to the recap."), and **Sign in with Google** (popup).
- After sign-in, read `allowlist/<lowercase email>`. If it does not exist, show: "You're signed in as <email>, but this account isn't on the trip list yet. Ask the owner to add it." plus **Sign out**. Load nothing else.
- If allowed, write the `users/{uid}` document, then show the trips list.
- If Firebase is not configured (placeholder values still in `js/firebase-config.js`), show a setup message naming that file instead of a broken page.

### 7.2 Trips list (`#/`)

- **New trip** asks for a name and creates the trip (section 5.3 defaults), then opens its Overview.
- Cards show name, the stage badge (§11), destination city (or "Still exploring"), dates, traveler names, and last updated time. They are sorted by `updatedAt`, newest first.
- **Delete** appears only for the trip's creator. It asks for confirmation, then deletes every document in all seven subcollections in batches of up to 400, then `publicRecaps/{tripId}` if it exists, then the trip document.

### 7.3 Ranking (used for candidates, places and stays)

- A three-option control per item: **Must**, **Nice**, **Skip**. The current user's choice appears pressed (`aria-pressed="true"`). Pressing your current choice again clears it (`deleteField()`).
- Write only `votes.<my uid>`.
- Score: Must = +2, Nice = +1, Skip = −1, no vote = 0. A summary such as "2 must · 1 nice · 1 skip" is shown next to the control. Hovering or tapping the summary lists who chose what, using display names from `users`.
- Default sort: score descending, then more Must votes, then newest `createdAt`.
- The filter **I haven't ranked yet** shows items where the current user has no vote. Show a count on each tab ("You haven't ranked 4 places").

### 7.4 Comments

Any candidate, place, flight, stay, or the trip itself can have a thread. Show the count, expand inline, newest last, with the author's name and relative time. Only the author sees **Delete** on their own comment.

### 7.5 Overview tab

- Editable: trip name (non-blank), start and end dates (end not before start), currency (three uppercase letters), notes.
- **Travelers:** add a traveler by choosing an app member or typing a name; edit name, home city and home airport; remove with confirmation. At least one traveler must remain. Removing a traveler also deletes that traveler's entry in `selectedFlights`, and asks whether to delete their flight options.
- **Destination ideas** (shown prominently while exploring, collapsed afterward): add, edit, delete, rank, comment. Cards sit in a responsive grid (`repeat(auto-fill, minmax(280px, 1fr))`, one column on phones). Each card, top to bottom:
  1. **Photo banner**, 16:9, `object-fit: cover`, `alt="<city>, <country>"`, `loading="lazy"`, with a small "Photo: Wikipedia ↗" credit linking to `photo.pageUrl` in the bottom corner. When `photo` is `null`, or the image fails to load, show the same-size banner in `--hero-gradient` with the city's first letter large in white Fraunces — never a broken-image icon. While a lookup is running, show the gradient banner.
  2. **Title row:** city as `h3`, country beneath in `--muted`; a teal "Chosen" pill if this is the trip's current destination.
  3. **Labeled details**, as a definition list (`<dl>`) with the small uppercase label style from §4: **Why go**, **Rough price**, **When**, **Link** ("Open link ↗"). Hide a row when its value is empty; if all four are empty, show "No details yet — use Edit to add some." in `--muted`.
  4. **Ranking** row: the rank control and its summary.
  5. **Actions** row: **Pick this destination** (primary; hidden on the chosen card), **Edit** and **Delete** (quiet).
  6. **Comments**, collapsed to a count.
- **Photo lookups.** When a candidate is added, or edited so that its city or country changed, look up a photo (§9.7) after saving and write `photo` with a single-field update. When a card renders with `photo` missing, look it up once (at most one lookup running per candidate per page load) and save the result. A failed network request saves nothing, so it's retried next visit. Photo lookups never block saving and never show an error to the user.
- **Pick this destination** on a candidate sets `trip.destination` from the candidate and `trip.destinationId` to the candidate's id. If the candidate has no coordinates, run a Nominatim search for "city, country" and use the first result. If nothing is found, store `lat` and `lng` as `null` and show a "We couldn't find this city on the map" note with a **Set on map** action (the next click on the Places map sets the destination's coordinates). While the destination has no coordinates, the map centers on the trip's pins, or shows the whole world if there are none. The group can change the destination later — existing places aren't deleted, just hidden on the Places tab (§7.6) until that destination is chosen again.
- **Search the web** panel of external links (section 9.1). While exploring it shows Google Flights Explore. Once a destination exists, it also shows per-traveler flight searches, stay searches, and idea searches.

### 7.6 Places tab

- Requires a chosen destination (`trip.destinationId`). If none is set yet, show a message pointing to **Pick this destination** on the Overview tab instead of the list, map and Add place form.
- Only places whose `destinationId` matches the trip's current `destinationId` are shown, listed, mapped, counted or exported. Places from a previously-chosen destination are not deleted — they reappear if that destination is chosen again (§7.5).
- A list and a Leaflet map showing the same filtered set.
- Filters: category (multi-select chips), neighborhood (dropdown built from existing values), text search on name and note, **I haven't ranked yet**, and "Events during trip dates". Sort: Group favorites (default), Newest, Neighborhood, Category.
- **Add place** form, in this order — the Google Maps link comes first because it alone captures an exact name, coordinates and a reusable link:
  1. **Step 1 · Find it on Google Maps.** A short search box ("What are you looking for?") and a **Find on Google Maps ↗** button that opens `googleMapsFindUrl` (§9.2) in a new tab. Under it, one line: "Find the place, copy the address from your browser's address bar, then paste it below."
  2. **Step 2 · Paste the Google Maps link.** The link field, focused-looking and full width. Parses automatically on paste or input (§9.3). When coordinates are found, fill the location and — if they're still empty — the name, then show "✓ Pin found" with the name. When the name box of Step 1 has text and the name field is empty, copy it into the name field too.
  3. **Step 3 · Details:** name (required), category (required), neighborhood, note, website or booking link, event start and end.
  4. **Other ways to add a location** (collapsed disclosure): Search (Nominatim) and Place on map, described below.

  Location methods:
  1. **Paste a Google Maps link** (above).
  2. **Search** by name, which runs a Nominatim search limited to the destination (section 9.4) and lets the user pick one of up to 5 results. Shown, along with method 3, under a secondary "Other ways to add a location" disclosure.
  3. **Place on map**, which switches to a mode where the next map click sets the coordinates.

  A place may be saved with no location. It shows "No map pin" and is excluded from the map and exports.
- Map: centered on the destination (or on the pins). Each place is an `L.circleMarker` in its category color. The popup shows name, category, neighborhood, note, the rank summary, **Open in Google Maps**, and **Edit**. Clicking a list row pans to its marker and opens the popup, and clicking a marker scrolls to and highlights its row.
- Each place row in the list, and each map popup, has **Open in Google Maps ↗** (§9.2).
- Every place has a location action using the same three methods as Add place, including the **Find on Google Maps ↗** button prefilled with the place's name: **Set location** when it has no pin yet, **Edit location** when it does — a pasted link's coordinates aren't always the actual pin (e.g. a link copied while the map view was panned/zoomed away from the marker carries the view's center, not the place's), so there must always be a way to correct one without deleting the place.
- Edit and delete (with confirmation) any place.

### 7.7 Flights & stays tab

The tab is for **comparing options side by side**, so cards are compact and scannable, and the add dialogs start from a pasted link. Every dialog here uses the same dialog shell, `field()` helper, `.field-row`, `.dialog-actions` and button classes as every other dialog in the app — no new form patterns, no numbered "Step" headings.

#### Flights

One section per traveler, titled "<name> from <home city>", with **Add flight option** on the heading row. Cards sit in a grid, `repeat(auto-fill, minmax(340px, 1fr))`, one column on phones. Sort: chosen first, then lowest latest price, then newest. The cheapest priced option in each traveler's section gets a small "Cheapest" pill.

**Add flight option dialog** (one column, max-width 560 px), top to bottom:

```
Google Flights link
[ Paste the address from Google Flights…                              ]
Pick your flights on Google Flights, then copy the address bar. Search Google Flights ↗

(after a successful read)
✓ Read from the link
  OUT  Sun 17 Jan   JFK → SFO → NAN → AKL → CHC   3 stops
       Alaska 581 · Fiji Airways 871 · Fiji Airways 411 · Air New Zealand 559
  BACK Sun 24 Jan   CHC → NAN → SFO → JFK   2 stops
       Fiji Airways 450 · Fiji Airways 870 · Alaska 29
▸ Edit route and dates                     (collapsed disclosure: from/to city + airport, dates)

Label            [ Alaska + 2 more · 3 stops ]
Price you saw    [ 1,673.13 ]   Google showed $1,673.13 when you copied this link — check it's still right.
Times (optional) [ Outbound: Leaves 6:05 AM, lands 11:40 PM ]  [ Return: … ]
Notes            [ ]
                                                   [Cancel] [Add flight]
```

- The link is parsed on paste and on input (§9.6). The preview uses the **same itinerary component as the card** below.
- When the link can't be read, or there's no link, **Edit route and dates** is open and shows its fields, pre-filled from the traveler's home, the trip destination and the trip dates. A short link shows its error under the link box. When a read succeeds, the route and dates come from the link and the disclosure stays collapsed (still openable to correct them).
- **Label** is pre-filled: with segments, the outbound airlines' names in order without repeats ("Delta", "Alaska + Fiji Airways", or "Alaska + 2 more" for three or more) then " · " and the outbound stops ("Nonstop", "1 stop", "3 stops"); without segments, "Option N" (N = that traveler's option count + 1). Always editable.
- **Price you saw** is pre-filled from the link's price when its currency matches the trip currency, with the helper line above. If the currency differs, leave it empty and say "Google showed 1,673.13 EUR — this trip uses USD, so type the price in USD." When valid, it becomes the first price entry; when invalid, show the money error and don't save.
- Saved: the link as `link`, `legs` from the parser (just `date` and `segments`), from/to airports and dates (from the link or the fields), cities, label, times into `outboundDetails`/`returnDetails`, notes.

**Edit flight** uses the same dialog with **Save**; pasting a new link re-reads it and replaces `legs`, route and dates (the price field is then offered, not auto-saved).

**Flight card:**

```
┌────────────────────────────────────────────────────────────────┐
│ Alaska + 2 more · 3 stops   [Chosen ✓] [Cheapest]    $1,673.13  │
│                                         ▼ $40 lower · 2 days ago│
│ OUT   Sun 17 Jan  JFK → SFO → NAN → AKL → CHC          3 stops  │
│       AS 581 · FJ 871 · FJ 411 · NZ 559                         │
│       Leaves 6:05 AM, lands 11:40 PM                            │
│ BACK  Sun 24 Jan  CHC → NAN → SFO → JFK                2 stops  │
│       FJ 450 · FJ 870 · AS 29                                   │
│ Notes, at most two lines…                                       │
│ [Choose]  Update price   Open on Google ↗   Edit   Delete   💬 2│
└────────────────────────────────────────────────────────────────┘
```

- **Header row:** label (h3) and pills on the left; the price summary (§7.8) on the right.
- **Itinerary:** one block per leg. First line: "OUT"/"BACK" in the small uppercase label style, the leg date as "Sun 17 Jan", the route (airports joined by " → "), and the stops right-aligned. Second line (muted): flight numbers as "AS 581", each with the airline's name as a `title` tooltip. Third line (muted, only when not empty): the times text. A flight with no `legs` shows the same block from `fromAirport/toAirport` (or the cities), the dates and the details text, and no stops.
- **Footer:** **Choose/Unchoose** (secondary button, becomes a teal "Chosen ✓" pill plus a quiet **Unchoose**), **Update price** (§7.8), **Open on Google ↗** (the saved link), **Edit**, **Delete** (quiet), and the comment count that expands the thread.
- Choosing: **Choose** adds the option to `selectedFlights.<travelerId>`; **Unchoose** removes it. A traveler may choose any number of options. Deleting an option also removes it from `selectedFlights`.

#### Stays

**Stays** (up to 10 options), with **Add stay** on the heading row. Each stay has a **number** — its position when all stays are sorted by `createdAt`, oldest first — shown as a round badge (①, ②…) on its card and on its map pin, so people can say "number 3".

**Stays map** at the top of the section (§7.7.1 below), then the cards in the same grid as flights. Sort: chosen first, then rank score, then lowest price per night.

**Add stay dialog** (same shell and max-width as flights):

```
Link to the stay
[ Paste a Booking.com, Airbnb, Google Hotels or other link…          ]
Don't have one yet? Google Hotels ↗  Booking.com ↗  Airbnb ↗
✓ Read from the link: Booking.com · Casa Alfama · 17–24 Jan · 4 guests

Name            [ Casa Alfama ]
Price you saw   [ ]   (total for the whole stay)
Check-in [ ]  Check-out [ ]   Guests [ 4 ]
Neighborhood    [ ]
Where is it?    No pin yet.   [Find “Casa Alfama” on the map]   Paste a Google Maps link ▸
Note            [ ]
                                                     [Cancel] [Add stay]
```

- The link is parsed on paste and input (§9.6); fill provider, name, dates and guests only into empty or still-default fields, then say what was read and what wasn't ("Airbnb links don't include the listing name — type it below.").
- **Where is it?** is always visible because the map depends on it:
  - **Find "<name>" on the map** runs a Nominatim search (§9.4) for the name in the destination when pressed, and lists up to 5 results to pick from. Disabled while the name is empty.
  - **Paste a Google Maps link** (a disclosure) takes a Google Maps link, read with §9.3, plus a **Find on Google Maps ↗** link built with `googleMapsFindUrl(name, city, country)`.
  - The status line reads "📍 Pin set" (with **Clear**) or "No pin yet — you can add one later."
- Booking, Airbnb and Google Hotels links don't contain an address, and the app must not download the listing page (§2), so the pin always comes from one of those two actions. Airbnb only reveals the exact spot after booking; tell people to pin the neighborhood.
- **Guests** defaults to the number of travelers; check-in and check-out to the trip dates. **Price you saw** works as for flights.

**Edit stay** uses the same dialog with **Save**.

**Stay card:**

```
┌────────────────────────────────────────────────────────────────┐
│ ③ Casa Alfama   Booking.com   [Chosen ✓]       $1,260 total     │
│                                                $180 / night     │
│                                        ▼ $40 lower · 2 days ago │
│ Alfama · Sun 17 – Sun 24 Jan · 7 nights · 4 guests              │
│ 📍 On the map   (or: No pin yet · Set location)                 │
│ Must  Nice  Skip     2 must · 1 nice                            │
│ Note, at most two lines…                                        │
│ [Choose]  Update price   Open link ↗   Edit   Delete   💬 1     │
└────────────────────────────────────────────────────────────────┘
```

- **Set location** opens the edit dialog scrolled to **Where is it?**. Clicking "📍 On the map" highlights its pin.
- **Choose** adds the stay to `selectedStayIds` and **Unchoose** removes it; any number may be chosen. Deleting a stay also removes it from `selectedStayIds`.

##### 7.7.1 Stays map

- A Leaflet map (same tiles and attribution as Places), 320 px tall on desktop and 240 px on phones, above the stay cards. Shown when at least one stay has coordinates; otherwise a one-line note: "Add a location to a stay to see it on the map."
- **Price pins:** each located stay is an `L.marker` with an `L.divIcon` pill showing its number and price, e.g. "③ $180". Show the price **per night** rounded to whole units when nights are known; otherwise the total with "total" ("③ $1,260 total"); with no price, just "③". Build the pill's text with `textContent` (no user text in HTML strings — give `divIcon` an element via `html: element`).
- Pill style: white background, `--primary` border and text, 999 px radius, soft shadow. Chosen stays: `--secondary` background with white text. Hover or focus raises the pill above the others.
- Clicking a pin scrolls to its card and highlights it for 1.5 s; the card's "📍 On the map" pans to and pulses its pin.
- **Our top places:** a "Show our top places" checkbox (on by default) adds the destination's located places with a rank score ≥ 2 (§7.3) as small category-colored dots (radius 5) with the place name as a tooltip, so the group can see which stay is close to what they want to do. They aren't clickable beyond the tooltip.
- The map fits all located stays (and top places when shown) with padding, and refits when those change — but not while someone has panned or zoomed the map in the last 30 seconds.
- A caption under the map: "Pins show the price per night. Teal pins are chosen."
- The Places tab keeps showing stays as before (§7.6); it doesn't get price pins.

#### Split costs

Add, edit and delete a label, amount and note. Split equally across all travelers.

#### Totals card

One row per traveler: flights (all their chosen flights added up) + stays share (their share of every chosen stay) + split costs share = total. Then an "Everyone together" total. If anything is missing, label the card **Total so far (missing some prices)** and list what is missing, such as "No flight chosen for Sam", "No price logged for Sam's flight "Nonstop, Tuesday out"" or "No price logged for Casa Alfama". Never show a missing price as $0.

### 7.8 Price panel (flights and stays)

The price is a small part of each card, not a panel of its own.

- **Summary** (right side of the card header): the latest price in 1.25 rem semibold; for stays, the per-night price under it in `--muted`; then one small line with the change from the previous check ("▲ $38 higher", "▼ $12 lower", "No change") and when it was checked ("2 days ago", with who and the exact time as a `title` tooltip); a **New low** pill when the latest amount is lower than every earlier one; and a 64×16 px sparkline of all entries when there are 2 or more. With no price yet, show "No price yet" in `--muted`.
- **Update price** (a quiet button in the footer; "Add price" when there's none) opens a one-line row under the header: amount input pre-filled with the latest amount, an optional note, **Save price** and **Cancel**, with the placeholder/help text "Check the site first, then save what you saw." **Save price** appends a PriceEntry with `arrayUnion`. Amounts accept "$1,234.56", "1234.56", "1234" and "1234.5"; anything that isn't a positive amount gets an inline error. The row closes after saving.
- **History** (a quiet link at the end of the summary's change line, shown when there are 2+ entries) expands the full list, newest first. Each entry has a delete action (with confirmation) that uses `arrayRemove` on the exact entry object.
- Opening Update price or History must not be undone by a live update (§8).

### 7.9 Days tab

- **Create days from trip dates** makes one day per date from start to end, skipping dates that already have a day. **Add day** makes an undated day. Days are sorted by `order`.
- Each day card shows date or label, title, focus, notes, its places in `dayOrder`, and actions to edit or delete the day. Deleting a day moves its places back to Not in a day yet.
- The **Not in a day yet** pool lists places with `dayId: null`, grouped by neighborhood and sorted by rank. Each has an **Add to day** menu.
- Within a day, **▲** and **▼** buttons (each with an `aria-label` naming the place and direction, e.g. "Move Time Out Market up") reorder places and **Remove** returns a place to Not in a day yet. Do not use drag-and-drop.
- Events whose `eventStart`–`eventEnd` range overlaps a dated day show a hint "Happening this day" in the Not in a day yet pool for that day.
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
- **How was it?:** for each place in the trip, each user can set Loved, Fine or Skipped, a note, and an optional photo link (a link to one photo in the shared album). Write only `recap.<my uid>`.
- **Didn't get to:** places no one marked Loved, Fine or Skipped, listed as "Didn't get to", plus places marked Skipped. **Copy to a new trip** creates a new trip (no destination yet) whose places are copies of these places (new IDs, votes and recap cleared, `dayId` null).
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

Idea searches on the Overview "Search the web" panel, where `<city>` is the destination city and `<Month YYYY>` comes from the start date (leave it out if there's no date):

- `<city> best food neighborhoods`
- `<city> food tour`
- `<city> walking tour`
- `<city> history museum`
- `<city> events <Month YYYY>`
- `<city> concerts <Month YYYY>`
- `<city> seasonal festivals <Month YYYY>`
- `outdoor activities near <city>`
- `adventure tours near <city>`
- `nature excursions near <city>`
- `day trips from <city>`

These are deliberately destination-agnostic (no named sport) so they read sensibly for any city — a hardcoded activity like "skiing" makes no sense for most destinations, and the app can't intelligently pick a region-appropriate one without a lookup or AI feature, both out of scope (§12).

### 9.2 Google Maps links

- Open a place: `https://www.google.com/maps/search/?api=1&query=` + encode(`<name>, <city>`). When the place has a saved `googleMapsUrl` accepted by `safeUrl`, open that link instead.
- Find a place (`googleMapsFindUrl(text, city, country)`): `https://www.google.com/maps/search/?api=1&query=` + encode of the non-empty parts of `<text>, <city>, <country>` joined with ", ". With no text it searches the destination itself.
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
- Show "Search results from OpenStreetMap" under the results.
- On network failure, show an inline error and suggest Place on map.

### 9.5 URL safety

`safeUrl(text)` trims the text and returns the normalized URL string only when `new URL()` parses it and the protocol is `http:` or `https:`. Otherwise it returns `null`.

### 9.6 Reading flight and stay links (`flightlink.js`, `staylink.js`)

Both are best-effort and never block typing details by hand. The app reads **only the link text the user pasted**; it never downloads the linked page (§2).

**Google Flights — built and tested (3.0).** `js/lib/flightlink.js` and `js/lib/protobuf.js` are written and covered by `tests/flightlink.test.js` using real links the owner copied on 2026-09-28. **Don't rewrite them;** use their exports. If a real link reads wrongly, add it as a failing test first, then fix.

`parseFlightLink(text)` returns:

```
fromAirport, toAirport, outboundDate, returnDate   // string or null
fromPlace, toPlace       // city names, only when the link names cities instead of airports
legs: [ { date, from, to, segments: [ { from, to, date, airline, flightNumber } ] } ]
outboundStops, returnStops   // number, or null when unknown (a search page before flights are picked)
price: { amountCents, currency } | null   // what Google showed when the link was copied
error                    // null, or one of the messages below
```

Also exported: `stopsLabel(n)` ("Nonstop", "1 stop", "3 stops"), `legRoute(leg)` (airports in order), and from `airlines.js`, `airlineName(code)` ("AS" → "Alaska", unknown → null).

What a link contains depends on where it was copied:

| Copied from | Route & dates | Stops, airlines, flight numbers | Price |
|---|---|---|---|
| The **booking** page (after picking the outbound and return flights) | ✓ | ✓ | ✓ |
| The search results page | ✓ (airports or cities) | — | — |
| **Share** button (`/travel/flights/s/…`) | can't be read: error asks for the address-bar link | | |

How it reads the link (for reference): `tfs` is base64url protocol-buffer data. Field 3 repeats once per leg; in a leg, field 2 is the date, field 4 repeats once per segment (`1` from, `2` date, `3` to, `5` airline code, `6` flight number), and fields 13/14 are the origin/destination (`1` kind: 1 = airport, 2 = city id; `2` value). `tcfs` maps city ids to names. `tfu` field 1 is base64 text of a message whose field 3 is the price (`1` amount in minor units, `2` decimal places, `3` currency). If the structured read fails, it falls back to scanning `tfs` for date and airport-code text.

Errors: "That doesn't look like a Google Flights link." · "Short share links can't be read. Open it, then copy the full address from your browser's address bar and paste that." · "Couldn't read this link — fill in the details below."

The price from a link is a **suggestion the user confirms** by saving it, which keeps the rule that every saved price is one a person checked (§2).

`parseStayLink(text)` returns `{ provider, name, checkIn, checkOut, guests }`, each `null` when not found: Booking.com (`/hotel/<cc>/<slug>.html` → title-cased name; `checkin`, `checkout`, `group_adults`), Airbnb (`check_in`/`checkin`, `check_out`/`checkout`, `adults`; no name), Google Hotels (`/travel/hotels` → provider; the `q` parameter, if present, as the name). Any other valid link sets provider `other`.

### 9.7 Destination photos (Wikipedia)

- Lookup URL: `https://en.wikipedia.org/api/rest_v1/page/summary/` + encode(title) with spaces as `_`. Try the title `<city>` first; if that result is unusable, try `<city>, <country>`. Stop after those two requests.
- A result is usable when its `type` is `"standard"` (not `"disambiguation"`), and it has `thumbnail.source` or `originalimage.source` that passes `safeUrl` and whose host is `upload.wikimedia.org`.
- Image size: take `thumbnail.source`; if it contains `/<n>px-`, replace `<n>` with `640` to get a sharper image. If there's no thumbnail, use `originalimage.source`.
- Save `{ url, pageUrl }` where `pageUrl` is `content_urls.desktop.page`. The credit shown on the card is "Photo: Wikipedia ↗" linking to that page, which links to the photo's author and license.
- `js/lib/photos.js` builds the URLs and picks the photo from the JSON (tested with sample JSON). The `fetch` itself lives in `js/lookup.js`.

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
- **Traveler total:** the latest price of each of that traveler's chosen flights, added up, + their share of each chosen stay's latest price + their share of each split cost, where each stay and each cost is split separately.
- **Everyone together:** the sum of traveler totals.
- **Complete:** every traveler has at least one chosen flight, every chosen flight has at least one price, and every chosen stay has at least one price (choosing no stay is fine). Otherwise it's a **Total so far (missing some prices)** with a list of missing items. Missing amounts count as 0 in the sum, but they are listed, and the total is never labeled complete.
- **Trip stage** (`stage.js`, `tripStage(trip, today)`, where `today` is the viewer's local date as "YYYY-MM-DD"). Returns `{ key, label, shortLabel }`:
  - no `destinationId` → `exploring`, "Exploring"
  - a destination but no `startDate` → `planning`, "Planning"
  - today before `startDate` → `upcoming`, "In N days" (N = whole days until the start; 1 → "Tomorrow")
  - today from `startDate` through `endDate` (or through `startDate` when there's no end) → `now`, "Happening now"
  - today after that → `done`, label "Trip's over — add your recap", shortLabel "Trip's over"
  The trips list uses `shortLabel`; the trip header uses `label`, and when the stage is `done` the badge links to the Recap tab.
- Store no derived values (latest price, totals, per-night, delta, stage) in Firestore. Compute them when rendering.

## 12. Out of scope

Do not build any of these: flight or hotel price fetching, booking or payments, photo uploads, chat or notifications, offline mode, a native app, user roles beyond the allowlist, currency conversion, drag-and-drop, email invitations, analytics, or any AI features inside the app.

## 13. Changing this spec

Changes are made by the owner (or a model the owner asks). Edit this file first, bump the spec version at the top, note the change below, then build it.

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-26 | First version |
| 1.1 | 2026-09-27 | Added `trips.destinationId` and `places.destinationId` so the Places tab scopes to the currently-chosen destination instead of mixing places across destination changes (§5.3, §5.4, §7.5, §7.6). Places tab now requires a chosen destination. Add place's link-paste method is now primary/auto-parsing, with Search and Place on map moved under a secondary disclosure (§7.6). |
| 1.2 | 2026-09-27 | Added `help.html`, a static traveler-facing help page (no sign-in), and a **Help** link in the top bar that opens it (§3.2, §4). |
| 1.3 | 2026-09-27 | Every place now gets a location action regardless of whether it already has a pin (**Edit location** vs **Set location**) — a pasted link's coordinates aren't always the real pin, and there was previously no way to correct one without deleting the place (§7.6). Replaced the three hardcoded activity-specific Discover idea queries (rock climbing/surfing/skiing) with destination-agnostic ones (outdoor activities/adventure tours/nature excursions near \<city\>), since a fixed sport makes no sense for most destinations and the app has no compliant way to guess a region-appropriate one (§1, §9.1). |
| 1.4 | 2026-09-27 | Visual refresh at the owner's request — the flat, single-blue "draft" look is now a card-shadow/hover-lift, gradient-accent design with the Inter font, pill-shaped status/badges, and an external-link marker; no behavior changed (§4). |
| 2.0 | 2026-09-27 | Owner feedback round 1 (tasks in `docs/tasks/`). New warm "sunset + teal" look with exact color, type and spacing tokens, a logo, favicon and phone toolbar color (§4). Candidate cards redesigned with labeled details and a free Wikipedia photo (§5.4, §7.5, §9.7). Add place, Add flight option and Add stay now lead with finding the item on Google and pasting its link, which fills in what it can; flight links are read by new `flightlink.js` (§7.6, §7.7, §9.2, §9.6). Any number of flights per traveler and stays per trip can be chosen, and totals add them all (§5.3, §7.7, §11). Big view files split up and outside lookups moved to `js/lookup.js` (§3.1). Documented `staylink.js`, which existed without a spec entry. |
| 2.1 | 2026-09-28 | Wording pass (T07): applied `docs/tasks/WORDING.md` across every screen — "Destination ideas", "Pick this destination", "Search the web", "I haven't ranked yet", "Group favorites", "Save price", "Split costs", "Everyone together", "Total so far (missing some prices)", "How was it?", "Didn't get to", "Read this link", "Search results from OpenStreetMap", and updated empty-state/error text. Confirmation dialogs now name the action ("Delete", "Unpublish", "Publish") instead of a generic "Confirm". The **▲**/**▼** day-reorder buttons get an `aria-label` naming the place and direction. No layout, styling, behavior or stored data changed; category names are untouched. |
| 3.0 | 2026-09-28 | Owner feedback round 2 (tasks T08–T13). Trip `status` retired in favor of an automatic stage badge with a countdown (§4, §5.3, §7.2, §7.5, §11). Added the **Coffee & cafés** category; Museum & history recolored olive; categories moved to `categories.js` (§4). Google Flights links are now fully decoded — every segment's airports, date, airline and flight number, plus the price Google showed — by a tested `flightlink.js`/`protobuf.js`; flights store the result in a new `legs` field (§5.4, §9.6). Flight and stay add dialogs, cards and the price display redesigned for comparing options (§7.7, §7.8). Stays get numbers, a **Where is it?** section with a name lookup, and a price-pin map with the group's top places (§7.7.1). Hosting branch corrected to `master` (§3). |
