# Trip Planner — Specification

Spec version: **4.1** (October 2026)

This is the source of truth for what the app is and how it works. `docs/V4.md` (the agreed design for round 3) is folded into this file and is now history. The original build phases are in `PHASES.md` (all built); current work is in `docs/tasks/`. The working rules for every coding agent are in `AGENTS.md`, and the words on screen are governed by `docs/tasks/WORDING.md`. If code and this spec disagree, the spec wins unless the owner approves a change and this file is updated in the same commit.

---

## 1. What the app is

A private, free website where a small group of friends (roughly 3–8 people) plans trips together **before** they leave. It collects what the group finds elsewhere; it does not search for flights or hotels itself.

Exploring happens in Google Flights and Google Maps. The app lines up what was found — dates, prices, places — and helps the group narrow down. **Pasting a link does the data entry**: a pasted flight creates the destinations, dates and price without anyone typing them.

The group's process, which the app follows:

1. **Set the window.** A trip name, rough dates, who's coming and where each person flies from (Overview).
2. **Collect flights.** Each person pastes Google Flights links. The app files each one as a flight from home or a hop inside the region, under an *idea* ("Rome round trip") and an *option* ("Florence + Barcelona"). Where you sleep, and for how many nights, is worked out from the flights — never typed. The group picks one option (Routes).
3. **Collect places and stays.** Everyone pins places and stay options, grouped by the stops of the chosen route. Places get Love / Like / Pass. Chosen stays are checked against each stop's nights (Map).
4. **Plan days.** One day per date of the route, places assigned to days on a map, with walking-route links (Days).
5. **Take it with you.** The day-by-day plan exports as one map file for Google My Maps, opened in the Google Maps app during the trip.

Four tabs, in the order a group uses them: **Overview → Routes → Map → Days**.

| Tab | Job |
|---|---|
| Overview | Trip window, travelers and home airports, chosen route summary, budget, split costs, album link, trip comments (§7.5) |
| Routes | Flight ideas as a hierarchy, with stops and totals worked out from the flights (§7.6) |
| Map | Places and stays together, per stop (§7.7) |
| Days | Assign places to days on a map, and export the plan (§7.8) |

**Retired in 4.0.** The Recap tab and the public recap page, destination idea cards (candidates), the single trip "destination", voting on stays, and the separate Places and Flights & stays tabs.

## 2. Hard constraints

- **Cost is $0 with no credit card anywhere.** Use only: the Firebase **Spark** plan (Authentication, Cloud Firestore and Hosting), Leaflet with OpenStreetMap tiles, and OpenStreetMap Nominatim for occasional place search. Never use Firebase Cloud Storage, Cloud Functions, Blaze, the Google Maps JavaScript API, the Places API, or any paid or keyed API.
- **No live price data.** No flight or hotel price API, no scraping, no fake or sample prices. Every price is typed in — or confirmed — by a person after checking it themselves.
- **No photo uploads.** Photos live in an external shared album; the app stores links only.
- **Only approved people** (an allowlist of email addresses) can read or write anything.

## 3. Architecture (frozen)

| Part | Choice |
|---|---|
| Hosting | Firebase Hosting at `https://trip-planner-mattchurchman.web.app`, deployed by GitHub Actions (`.github/workflows/deploy.yml`) on every push to `master` after the tests pass. `master` is the default branch; there is no `main`. No service worker |
| Code | Plain HTML, CSS and JavaScript ES modules. No framework, no build step, no bundler, no npm dependencies, no TypeScript |
| Routing | Hash routes (`#/trip/<id>/map`) |
| Sign-in | Firebase Authentication: Google, plus email and password. `authDomain` is the app's own site, which is what makes iPhone sign-in stick (§7.1) |
| Database | Cloud Firestore (Standard edition) with the security rules in §6 |
| Firebase SDK | Modular Firebase Web SDK from `https://www.gstatic.com/firebasejs/<VERSION>/…`, one pinned version. Only `js/firebase.js` imports from the CDN; every other file imports from `./firebase.js` |
| Map | Leaflet **1.9.4** from `https://unpkg.com/leaflet@1.9.4/dist/` with OpenStreetMap standard tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png` and the attribution `© OpenStreetMap contributors` |
| Place search | Nominatim (§9.4), only when the user presses a Search button |
| Airports | `js/data/airports.json`, bundled (§9.8). No lookup service |
| Fonts | Google Fonts, one `<link>`: Bricolage Grotesque (headings), Instrument Sans (body), JetBrains Mono (codes, prices, dates) |
| Tests | `node tests/run-tests.js` using Node's built-in `assert`; no test libraries |

### 3.1 File layout

```
index.html            app shell; loads css/styles.css and js/app.js
help.html             static "how to use this app" page for travelers; no sign-in, no Firebase
404.html              redirects to the app home
manifest.webmanifest  home-screen app: name, standalone display, icons (§3.3)
package.json          {"type": "module", "private": true}  (no dependencies)
firebase.json         Firebase Hosting config: serves the repo root, ignores docs/tests/markdown
firestore.rules       security rules (owner pastes into the Firebase console)
css/styles.css
img/logo.svg          app logo (top bar, sign-in card)
img/favicon.svg       browser-tab icon (same artwork as logo.svg)
img/icons/            home-screen icons, including icon-180.png for Apple touch
js/firebase-config.js the owner's Firebase web config (public values; safe to commit)
js/firebase.js        initializes Firebase, re-exports the functions the app uses
js/app.js             auth gate, router, top bar, tab bar
js/store.js           all Firestore reads, writes and listeners
js/ui.js              shared DOM helpers (el(), field(), dialogShell(), rank control, toast, download)
js/lookup.js          the only file that calls outside services with fetch(): Nominatim (§9.4),
                      plus loading the bundled airport file
js/data/airports.json IATA code -> city, country, lat, lng (§9.8)

js/lib/ — pure logic, no DOM and no Firebase, each with tests in tests/
  airports.js         build the airport/city index from airports.json (§9.8)
  airlines.js         airline code -> name ("AS" -> "Alaska")
  auth-errors.js      Firebase auth error codes -> plain sentences
  categories.js       the place categories and their colors (§4)
  choices.js          per-traveler choices, who a cost is for, merged stops, the budget (§11)
  coverage.js         night coverage of a stop by its chosen stays (§7.7)
  dates.js            date math and formatting
  dayplan.js          dates of a route, and the days to create from it (§7.8)
  exporters.js        CSV and KML generation (§10)
  flightlink.js       read flights, stops, airlines and price from Google Flights URLs (§9.6)
  itineraryFormat.js  leg date and flight label formatting
  kmlimport.js        read layers and pins from a My Maps KML export (§9.7)
  links.js            external link builders and URL safety
  mapsurl.js          read coordinates and names from Google Maps URLs (§9.3)
  money.js            parse, format, split
  optionSort.js       stay sort order, stay numbering, the cheapest-first comparator
  protobuf.js         tiny reader for the binary data inside Google Flights links (§9.6)
  route.js            THE route rules: movements, stops, nights, totals, names, placement (§7.6)
  selection.js        read the chosen stays, including the pre-2.0 shapes (§5.3)
  stage.js            the automatic trip stage badge (§11)
  staylink.js         read provider, name, dates and guests from stay links (§9.6)
  staypins.js         stay map pin labels (§7.7)
  stops.js            nearest route stop to a pin, and stop-chip order (§7.7)
  totals.js           latest price, deltas, staleness, per-night
  votes.js            Love/Like/Pass scores, summaries and sort

js/views/
  signin.js           sign-in and email-confirmation screens (§7.1)
  trips.js            trips list (§7.2)
  overview.js         Overview tab: trip window, route summary, budget, album, comments (§7.5)
  travelers.js        the Travelers card on Overview (§7.5)
  splitCosts.js       the Split costs list on Overview (§7.5)
  routes.js           Routes tab: flights, options, watchers (§7.6)
  routeIdeas.js       Routes: traveler/idea switches and the idea/option dialogs (§7.6)
  routeRail.js        Routes: the option card, its rail of stops, the home-flights card (§7.6)
  pasteFlight.js      the Paste flight link sheet and Move to… (§7.6)
  flightForm.js       edit an already-saved flight by hand (§7.6)
  itinerary.js        the shared itinerary block (legs, airports, flight numbers)
  mapTab.js           Map tab: the shared map, stop chips, Places/Stays switch (§7.7)
  places.js           the Places list of the Map tab (§7.7)
  placeForm.js        add/edit place and the location picker (§7.7)
  importPlaces.js     the Import from My Maps dialog (§7.7, §9.7)
  stays.js            the Stays list of the Map tab, grouped by stop (§7.7)
  stayForm.js         add/edit stay dialog (§7.7)
  days.js             Days tab (§7.8)
  daysMap.js          the Days tab's map of numbered, day-colored pins (§7.8)
  exportSection.js    the Export section on Days (§7.8, §10)
  pricePanel.js       the price control shared by flights and stays (§7.9)
  comments.js         comment thread component (§7.4)

tests/run-tests.js    imports every tests/*.test.js and reports pass/fail
tests/*.test.js
tests/fixtures/       sample KML files for the import tests
```

Files under `js/lib/` must not touch the DOM or import Firebase, so Node can test them directly. Keep each file under about 400 lines (`js/store.js` and `css/styles.css` excepted); split if needed. Only `js/store.js` talks to Firestore, and only `js/lookup.js` calls `fetch()` for outside services.

### 3.2 Help page

`help.html` is a static, standalone page for travelers (not the owner). It needs no sign-in and imports nothing from `js/` — plain HTML/CSS styled with `css/styles.css`, opened from a **Help** link in the top bar in a new tab. Its sections run in workflow order: add to home screen and sign in, Routes (copying the right Google Flights link, pasting, options), checking prices, Map (My Maps import, stays), Days, taking the plan to Google Maps, then a short "Quick fixes" list drawn from the traveler-facing rows of `README.md` (nothing needing Firebase console access). Each section carries an `<!-- IMAGE: … -->` comment marking where a screenshot or GIF goes in a later round. Keep it current when a task changes what a tab does.

### 3.3 Home-screen app

`manifest.webmanifest` declares `display: standalone`, the name "Trip Planner" and the icons in `img/icons/`. Every HTML page sets `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, and `apple-touch-icon` → `img/icons/icon-180.png`. Fixed bars pad with `env(safe-area-inset-*)` so nothing hides under the iPhone's home indicator.

## 4. Look and feel

The owner-approved reference is `docs/mock/routes-mock.html`; its `<style>` block is the token source. Calm, high contrast, phone first.

**Color tokens.** Defined once on `:root` in `css/styles.css` and used only through the tokens (category colors below are the one exception). Dark values are redefined under `@media (prefers-color-scheme: dark)`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f4f6f5` | `#0d1514` | page background |
| `--surface` | `#ffffff` | `#16211f` | cards, dialogs, bars |
| `--sunk` | `#e9eeec` | `#1e2c2a` | inset areas: segmented controls, empty states |
| `--line` | `#d5dedb` | `#2c3d3a` | card and input borders |
| `--ink` | `#12211f` | `#e8f0ee` | body text |
| `--muted` | `#566864` | `#9db0ac` | secondary text, labels |
| `--teal` | `#0f5f59` | `#5cc7bd` | the action color: primary buttons, links, focus rings, active tab |
| `--teal-soft` | `#d9ecea` | `#173a37` | background behind teal badges and pressed controls |
| `--on-teal` | `#ffffff` | `#06211f` | text on a solid teal fill |
| `--sun` | `#c2570c` | `#f2a25c` | small highlights only: cheapest, stale price, warnings |
| `--sun-soft` | `#fde8d6` | `#3c2613` | background behind sun highlights |
| `--good` / `--bad` | `#17703f` / `#b3261e` | `#6fd39a` / `#ff8a80` | price movement and errors only |
| `--on-color` | `#ffffff` | — | text on a solid `--good`/`--bad` fill |

Also: spacing `--space-1`…`--space-7` (4, 8, 12, 16, 24, 32, 48 px), `--r: 16px` with `--radius-card`, `--radius` (10 px) and `--radius-pill` (999 px), the `--shadow-sm/-md/-lift` shadows, and `--ease: 160ms ease`.

**Dark mode** follows the phone or computer setting (`prefers-color-scheme`). There is no toggle in the app.

**Type.** One Google Fonts `<link>` with `display=swap`: Bricolage Grotesque (headings, 600/700), Instrument Sans (body, 400/500/600), JetBrains Mono (airport codes, prices and column dates, with tabular numbers). Field labels are small uppercase with letter-spacing, in `--muted`. Use exactly one `h1` per page and don't skip heading levels; every section heading sits on one row with its main action (stacked on phones).

**Navigation.** Under 760 px, a fixed bottom tab bar with an icon and label per tab, plus a slim top bar holding the logo, trip name, **Help** and the account menu. From 760 px, the tabs move into the top bar and the bottom bar is hidden.

**Components.** Reuse what exists: `dialogShell()`, `field()`, the `.btn` classes (plain, primary, quiet, small, danger), the segmented control (`.seg`), chips, kind pills, badges, the option card, the rail (stops as dots with hop flights inset), and the toast. Don't invent a second way to do something the app already does.

**Rules.** Teal is the only action color. Sun is for small highlights. `--good`/`--bad` are only for price movement and errors. Tap targets are at least 44 px, every control has a visible label and focus ring, and `prefers-reduced-motion` turns transitions off. Price movement is shown in words and arrows ("▼ $42 lower") as well as color. Every screen works at 375 px and at 1280 px, with no horizontal scrolling.

**Category colors** live in `js/lib/categories.js`; every other file imports them from there. Menus and filters use this order:

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

**Stage badge** colors (§11): Exploring and Planning use `--sunk` with `--muted` text; a countdown ("In 42 days") uses `--teal-soft` with `--teal` text; "Happening now" uses `--sun-soft` with `--sun` text; "Trip's over" uses `--sunk` with `--muted` text.

## 5. Data model (Cloud Firestore)

Conventions:

- Money is stored as integer cents in a field ending in `Cents`. `$741.24` is stored as `74124`. Every trip's `currency` is fixed at `"USD"` (not editable in the UI) and every amount in the trip uses it.
- Calendar dates are strings `"YYYY-MM-DD"`. Document timestamps (`createdAt`, `updatedAt`) use Firestore `serverTimestamp()`. Timestamps inside arrays (price entries) are ISO 8601 UTC strings from `new Date().toISOString()`, because `serverTimestamp()` cannot be used inside arrays.
- IDs are Firestore auto-IDs, except array items (travelers, price entries), which use `crypto.randomUUID()`.
- Optional values are stored as `null`, never left missing, so every document of a type has the same fields.
- **Concurrent editing:** several people may edit at once. Always update single fields with `updateDoc` and field paths (for example `votes.<uid>`), use `arrayUnion` and `arrayRemove` for price entries, and never read a whole document, change it and write it all back. The one exception is the `travelers` array, which changes rarely.
- **Nothing derived is stored.** Stops, nights, totals, per-night prices, deltas and the stage are computed when rendering (§11).

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
startDate: string | null             // "YYYY-MM-DD"
endDate: string | null
travelers: [ {
  id: string,                        // UUID; never reused or remapped
  name: string,
  uid: string | null,                // linked app user, if any
  homeCity: string,
  homeAirport: string                // IATA code or ""
} ]
choices: {                           // one entry per traveler who has chosen (§7.6)
  [travelerId]: { ideaId: string | null, optionId: string | null }
}
selectedStayIds: [stayId]            // the group may choose several stays; may be empty
albumUrl: string | null              // shared photo album
createdBy: uid
createdAt: timestamp
updatedAt: timestamp
```

A new trip starts with `currency: "USD"`, empty `notes`, null dates, one traveler (the creator, linked by uid, with empty home fields), `choices: {}`, `selectedStayIds: []` and `albumUrl: null`.

**Choosing a route (`choices`).** Every traveler chooses for themselves, and the idea and the option are two separate choices: choosing an option does not choose its idea, and nothing one traveler chooses changes another's. Write one field at a time with a field path (`choices.<travelerId>.ideaId`, `choices.<travelerId>.optionId`), never the whole map, so two people choosing at once never overwrite each other. A traveler with no entry falls back to the retired `chosenOptionId` (and that option's idea), so trips from before 4.1 still show the choice they had. Nothing writes `chosenOptionId` again. The two ids are independent and may disagree — a traveler can be looking at one idea's flights while their option belongs to another.

**Choosing stays.** Add or remove one at a time with `arrayUnion` / `arrayRemove` on `selectedStayIds`, so two people choosing at once never overwrite each other.

**Retired fields.** Trips made before 4.0 may still hold `destination`, `destinationId`, `selectedFlights`, `actualSpendCents` and `status`. Nothing reads or writes them any more: leave the old values alone. A traveler's picked flights are now the `picked` flag on each flight document, and the stage badge is computed from `choices` and the dates (§11). `chosenOptionId` is retired as of 4.1: it is still **read** as the fallback for a traveler with no `choices` entry, and never written. Don't delete it from existing trips.

**Trips made before 2.0** may hold a `selectedStayId` string field. `js/lib/selection.js` merges it into the stay list. The first time someone changes a legacy value, write the whole field as a list (`selectedStayIds: [old, new]` plus `selectedStayId: deleteField()`) instead of using `arrayUnion`, because `arrayUnion` on a value living in the wrong field wouldn't touch it at all.

### 5.4 Subcollections of a trip

All live under `trips/{tripId}/`. Every document has `addedBy` (uid), `createdAt` and `updatedAt`, not repeated below.

**`ideas/{id}`**: one shape of trip, e.g. "Rome round trip" or "London in, Madrid out".
```
name: string
nameEdited: boolean                  // true once a person renamed it, which stops the auto name (§7.6)
order: number
```

**`options/{id}`**: one way to spend the time once you've landed, e.g. "Florence + Barcelona".
```
ideaId: string
name: string
nameEdited: boolean
order: number
```

**`flights/{id}`**: either a flight from home for one traveler, or a hop shared by everyone.
```
role: "home" | "hop"                 // missing = saved before 4.0 ("earlier flight", §7.6)
ideaId: string | null
optionId: string | null              // hops only
travelerId: string | null            // home flights only; hops are shared
direction: "both" | "out" | "back" | null   // home flights only
landsDate: string | null             // outbound home flights: the day you land
picked: boolean                      // home flights only; counts toward this traveler's total
forTravelerIds: [travelerId] | null  // who the price is for; null = work it out (§11)
label: string                        // e.g. "Alaska + 2 more · 3 stops"
fromCity: string, fromAirport: string
toCity: string, toAirport: string
outboundDate: string | null
outboundDetails: string              // free text times, e.g. "Leaves 6:05 AM, lands 11:40 PM"
legs: [ {                            // read from a Google Flights link (§9.6); [] when unknown
  date: string | null,               // legs[0] is outbound, legs[1] (if any) is the way back
  segments: [ { from: string, to: string, date: string | null,
                airline: string | null, flightNumber: string | null } ]
} ]
returnDate: string | null
returnDetails: string
link: string | null                  // the Google Flights link it came from
notes: string
prices: [ PriceEntry ]
```

**`places/{id}`**
```
name: string
category: one of the 12 categories in §4, stored as the exact label
neighborhood: string                 // free text, e.g. "Alfama"
note: string
lat: number | null, lng: number | null
googleMapsUrl: string | null         // the link the user pasted, if any
link: string | null                  // website, tour booking page, event page
eventStart: string | null            // "YYYY-MM-DD"; for events and seasonal things
eventEnd: string | null
stopKey: string | null               // nearest route city within 150 km, set on save;
                                      // null shows under "Elsewhere" (§7.7)
layer: string                        // the My Maps layer it was imported from, or ""
dayId: string | null
dayOrder: number | null              // position within the day
votes: { [uid]: "love" | "like" | "pass" }
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
stopKey: string | null               // which stop of the route this stay is for (§7.7)
out: boolean                         // ruled out: dimmed and sorted last
forTravelerIds: [travelerId] | null  // who the price is split between; null = work it out (§11)
prices: [ PriceEntry ]               // each amount is the TOTAL for the whole stay
```

**`costs/{id}`**: split costs, divided equally.
```
label: string                        // e.g. "Rental car", "Food estimate"
amountCents: integer (≥ 0)
forTravelerIds: [travelerId] | null  // who the cost is split between; null = everyone (§11)
note: string
```

**`days/{id}`**
```
date: string | null                  // "YYYY-MM-DD"
title: string                        // e.g. "Florence" or "Alfama + Graça"
focus: string                        // neighborhoods or theme
notes: string
order: number                        // sort key for days
```

**`comments/{id}`**
```
targetType: "trip" | "place" | "stay"
targetId: string                     // the trip id when targetType is "trip"
text: string                         // 1–2000 characters
```

Threads written before 4.0 may have `targetType: "candidate"` or `"flight"`. They are never shown now; a trip delete still clears them.

**PriceEntry** (item inside a `prices` array)
```
id: string                           // UUID
amountCents: integer (≥ 1)
checkedAt: string                    // ISO 8601 UTC
byUid: string
note: string
```

**`candidates/{id}`** is retired (4.0). Nothing writes it; a trip delete still clears it so nothing is left behind from before.

## 6. Security rules (exact)

`firestore.rules` must contain exactly this. The owner pastes it into Firebase console → Firestore → Rules → Publish. One per-trip rule covers every subcollection, so new ones (`ideas`, `options`) need no rule change.

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
  }
}
```

`email_verified == true` is why a new password account gets a one-time confirmation email (§7.1). Google accounts are already verified.

## 7. Behavior

### 7.1 Sign-in and access

- Signed out: a centered card with the logo, the app name, one sentence, **Continue with Google**, and email-and-password beside it — sign in, create account, forgot password — with `autocomplete` set so iPhone offers Face ID fill.
- Google uses `signInWithRedirect` on phones and in the home-screen app, and `signInWithPopup` on desktop. `authDomain` is the app's own site (`trip-planner-mattchurchman.web.app`), which is what makes the redirect stick on iPhone.
- Safari can restore the page from its back-forward cache after the Google redirect instead of loading it fresh, which would leave sign-in looking like it silently did nothing. A `pageshow` listener reloads the page when that happens (§7.1, T32).
- In the iPhone home-screen app, iOS sometimes can't hand the redirect result back to the installed app at all. If a Google sign-in attempt there returns with no user, the sign-in screen shows "On iPhone, Google sign-in can't return to the home-screen app. Sign in with email and password here, or sign in once in Safari." (remembered across the redirect in `sessionStorage`, T32).
- A brand-new password account is sent a confirmation email and sees "Check your email, then tap **Continue**" until it is verified — the rules require `email_verified` (§6).
- After sign-in, read `allowlist/<lowercase email>`. If it doesn't exist, show "You're signed in as <email>, but this account isn't on the trip list yet. Ask the owner to add it." plus **Sign out**, and load nothing else.
- If allowed, write the `users/{uid}` document, then show the trips list.
- If Firebase is not configured (placeholder values still in `js/firebase-config.js`), show a setup message naming that file instead of a broken page.
- Firebase auth error codes become plain sentences through `js/lib/auth-errors.js`.
- Per-trip membership (different groups per trip) is not built: everyone on the allowlist sees every trip.

### 7.2 Trips list (`#/`)

- **New trip** asks for a name and creates the trip (§5.3 defaults), then opens its Overview.
- Cards show name, the stage badge (§11), dates, traveler names, and when it was last updated. They are sorted by `updatedAt`, newest first.
- **Delete** appears only for the trip's creator. It asks for confirmation, then deletes every document in all the subcollections in batches of up to 400, then the trip document.

### 7.3 Love / Like / Pass (places only)

- A three-option control per place: **Love**, **Like**, **Pass** (tooltips "Love it", "Like it", "Pass"). The current user's choice appears pressed (`aria-pressed="true"`); pressing it again clears it (`deleteField()`). Write only `votes.<my uid>`.
- Each person's pick shows as their initial beside the control.
- Score: Love = +2, Like = +1, Pass = −1, no vote = 0. Values written before 4.0 are read as must→love, nice→like, skip→pass.
- Default sort: most Loves, then most Likes, then newest `createdAt`; Pass-only last.
- The filter **I haven't ranked yet** shows places where the current user has no vote, with a count ("You haven't ranked 4 places").
- On the map, Loved pins are larger with a ring, and Pass-only pins are dimmed.
- Stays are not voted on (4.0): they have a status instead (§7.7).

### 7.4 Comments

Any place, stay, or the trip itself can have a thread. Show the count, expand inline, newest last, with the author's name and relative time. Only the author sees **Delete** on their own comment. A thread keeps its draft and open state across a live update (§8).

### 7.5 Overview tab

- Editable: trip name (non-blank), start and end dates (end not before start). Currency is fixed at USD and not shown as a field.
- **Travelers** (`travelers.js`): add by choosing an app member or typing a name; edit name, home city and home airport inline; **Remove** with confirmation. At least one traveler must remain. Removing someone asks whether to delete their flights too, since Routes lists home flights per traveler and nobody could reach them afterwards.
- **Route**: the signed-in traveler's own chosen option as a one-line path ("Rome → Florence → Barcelona → Rome", linking to Routes) with their total beneath it, shown as "at least $X" when a price is missing. With nothing chosen, a hint pointing at Routes.
- **Split costs** (`splitCosts.js`): add, edit and delete a label, amount and note. Split equally between the travelers the cost is for — everyone, unless it says otherwise (§11).
- **Budget**: one row per traveler — their picked home flights for *their own* chosen idea, plus every hop, chosen stay and split cost they're for — then an "Everyone together" row. If anything is missing, the card is headed **Total so far (missing some prices)** and lists what's missing. Never show a missing price as $0 (§11).
- **Album**: paste a Google Photos or iCloud shared album link into `albumUrl`, validated with §9.5, with **Open album** once it's set.
- **Trip comments** at the bottom (§7.4).

### 7.6 Routes tab

The hierarchy:

```
Trip window
└─ Idea            e.g. "Rome round trip", "London in, Madrid out"
   ├─ Flights from home, per traveler (each traveler's own dates and prices)
   └─ Option       e.g. "Florence + Barcelona"
      └─ Hops      flights inside the region, shared by everyone, priced per person
```

Stops — where you sleep and for how many nights — are **never typed**. They are worked out from the flights by `js/lib/route.js`.

**Pasting a flight is the way in, and the button you press decides where it goes.** There's no clipboard-reading, guessing paste button at the top of the tab anymore.

1. **Paste flight link** in the home-flights card always adds a flight from home, for the traveler and idea currently selected (an outbound and a return pasted separately land in the same idea). With no ideas yet, it creates the idea from the first flight pasted, naming it as below, and may learn the traveler's home airport from that flight's origin. **Paste flight link** inside an open option always adds a hop to that option, however many it already holds.
2. The sheet opens empty, with focus in its text box, and parses on `paste` and on typing — it never reads the clipboard itself. Parse with `parseFlightLink` (§9.6). A short share link shows its own message.
3. One confirmation sheet shows what was read (itinerary, dates, airline, the price Google showed, the landing date for an outbound flight) and a fixed **Adding to:** line naming the idea and traveler (home) or the option (hop) — there's nothing to pick. One tap on **Add** saves the flight, and a new idea when this is the first one, in a single batch — so a dropped connection never leaves a flight pointing at an idea that was never written.
4. The first home flight in a direction is `picked`; later alternatives are not until the user picks them.

**Names** come from the flights until someone renames them (`nameEdited`):

- Idea: "Rome round trip" when the in and out cities match, else "London in, Madrid out".
- Option: the hop cities other than the city you landed in, joined with " + ", or "Stay in Rome" with no hops. A hop joining an option widens its name ("Florence" → "Florence + Barcelona"); a renamed option is left alone.

**Stops, warnings and totals** (`route.js`, pure and tested):

- **Movements**: an option's hops flattened into legs `{ from, to, date }`, sorted by date, undated last. A round-trip hop is two legs.
- **Stops** for one traveler: start at the city their picked outbound home flight lands in, on its `landsDate` (or its departure date). Each movement closes the current stop and opens the next in the destination city. The last stop ends on the date of their picked flight home. Nights are the days between. With no home flight yet, start from the first movement and show the first stop with no start date.
- **Warnings**, shown on the stop they belong to: the next flight leaves from a different city than the one you're in; the dates run backwards; the flight home leaves from a different city than the last stop; a flight has no date.
- **Total per traveler**: the latest price of each picked home flight plus the latest price of every hop in the option. If any is missing, the total reads "at least $X".
- **Landing date guess**: a destination more than 60° of longitude east of the origin defaults `landsDate` to the day after departure, otherwise the same day. Always editable.

**The screen**, matching `docs/mock/routes-mock.html`:

- A traveler segmented control and an idea segmented control (with **Rename idea** / **Delete idea**). Travelers may have different dates; stops and totals always show for the selected traveler. Both selections live in memory only and reset when the tab is left.
- **The home-flights card** lists every alternative the selected traveler has for this idea, cheapest first with unpriced last, each with **Use this** / **Using**. Picking a both-ways flight clears any separate out/back picks and vice versa.
- **Option cards** show the option's total, the path line, **Chosen** and **Cheapest** badges, and open to reveal the rail: stops as dots with their nights and warnings, and the hop flights inset between them. **Choose this option** sets `choices.<travelerId>.optionId` **for the traveler on screen only** — another traveler's choice never moves with it — and pressing it on their chosen option unchooses it. Map, Stays and Days read the merged route built from everyone's choices (§11), not one traveler's.
- The price on every flight is the control (§7.9) — there is no separate "Recheck" link.
- **Earlier flights** (no `role`, saved before 4.0) sit in a collapsed list with **Move to…** (pick a traveler's home flights, or a shared hop under an idea and option) and **Delete**.
- Editing a flight by hand stays available (`flightForm.js`, opened from a flight's **Edit**) as the fallback, not the path. Pasting a new link into it re-reads the route, dates and legs.

### 7.7 Map tab

One Leaflet map with place pins and stay price pins together, and one list below it (beside it from 760 px).

- **Stop chips** across the top: **All**, then each city of the merged route in route order (first occurrence wins when the route visits a city twice), then **Elsewhere**. They filter the map and the list together. With nobody having chosen an option, the chips list every city across every option and a hint says to choose one on Routes.
- A **Places / Stays** switch under the chips picks which list shows below the map.

**Places**

- Filters: category (multi-select chips), neighborhood (dropdown built from existing values), text search on name and note, **I haven't ranked yet**, and events during the trip dates. Sort: Group favorites (default), Newest, Neighborhood, Category.
- Each place is an `L.circleMarker` in its category color. Loved pins are larger with a ring, Pass-only pins are dimmed. Clicking a list row pans to its marker; clicking a marker scrolls to and highlights its row.
- **Add place**, in this order, because a Google Maps link alone captures an exact name, coordinates and a reusable link:
  1. **Find it on Google Maps.** A search box and a **Find on Google Maps ↗** button (§9.2), plus **Paste** to fill the link box from the clipboard.
  2. **Paste the Google Maps link.** Parsed on paste or input (§9.3); found coordinates fill the location and, if empty, the name, then "✓ Pin found".
  3. **Details:** name (required), category (required), neighborhood, note, website or booking link, event start and end.
  4. **Other ways to add a location** (collapsed): Search (Nominatim, §9.4) and Place on map (the next map click sets the coordinates).
- `stopKey` is set on save to the nearest route city within 150 km (`stops.js`), or `null` for "Elsewhere".
- Every place has **Set location** / **Edit location** using the same three methods — a pasted link's coordinates aren't always the real pin, so there must always be a way to correct one without deleting the place. A place may be saved with no location; it shows "No map pin" and is left out of the map and exports.
- Each row and popup has **Open in Google Maps ↗** (§9.2), plus Edit and Delete (with confirmation).
- **Which city a place-search link uses (T31):** there's no trip-wide destination any more, so **Find on Google Maps**, its Nominatim search, and **Open in Google Maps ↗** all use the stop chip currently selected above the map — the one city the traveler is looking at. With **All**, **Elsewhere**, or no chip selected yet (no route chosen), they search with no city at all rather than guessing one.
- **Import from My Maps**: the user exports KML from My Maps (with "Export as KML instead of KMZ" ticked) and picks the file. The dialog shows a per-layer summary, gives each layer a category, skips pins matching an existing place (same name, within 50 m), and adds the rest in one batch, storing the layer name on each place. A KMZ file gets a message explaining the tick box (§9.7).

**Stays**

- A stay belongs to a stop. Stays are grouped under the merged route's stops, with anything unmatched under **No stop yet**. Up to 10 stays per trip. Each has a stable **number** — its position in `createdAt` order — shown as ① ② … on its card and its map pin.
- Status per stay: shortlisted (default), **Out** (dimmed, sorted last) or **Chosen** (in `selectedStayIds`). Sort: chosen first, then not-Out before Out, then lowest price per night.
- **Night coverage** per stop: one cell per night showing covered, not covered, or double-booked by the chosen stays, with "{N} of {N} nights covered", the chosen total and the per-person share (`coverage.js`).
- **Add stay** from a stop pre-fills check-in and check-out with that stop's dates, and guests with the number of travelers. **Duplicate** copies a stay without its price and opens it for editing, for splitting one stay into two.
- The add/edit dialog reads a pasted link for provider, dates, guests and sometimes the name (§9.6), with **Paste** beside the link box. The price is typed. **Where is it?** is always visible because the map depends on it: **Find "<name>" on the map** (Nominatim), or a Google Maps link (§9.3). Booking, Airbnb and Google Hotels links carry no address and the app must not download the page (§2), so the pin always comes from one of those two actions. The dialog's search links (Nominatim and Find on Google Maps) use the stay's own stop's city (adding from a stop, or editing a stay that already has one) — `null`, searching with no city, when it doesn't have one yet (T31).
- **Price pins:** each located stay is an `L.marker` with an `L.divIcon` pill showing its number and price — per night rounded to whole units when nights are known ("③ $180"), otherwise the total ("③ $1,260 total"), or just "③" with no price. Build the pill with an element and `textContent`, never an HTML string. Chosen stays get a teal fill. Clicking a pin scrolls to its card and highlights it.
- **Hotel search links** (Google Hotels, Booking.com, Airbnb) sit inside each stop's group, using that stop's own city and dates (§9.1) — there's no trip-wide destination any more, and a stop's own city is more accurate than one city for the whole trip (T31). Hidden for stays with **No stop yet** and before a route is chosen, where no city is known.

### 7.8 Days tab

- **Create days from route** makes one day per date of the merged route, titled with that date's city; a travel day belongs to the city you arrive in, and dates that already have a day are skipped (`dayplan.js`). Before anyone has chosen an option, the same button reads **Create days from trip dates**. **Add day** makes an undated day. Days are sorted by `order`.
- Selecting a day shows that city's places on the map as pins numbered and colored by day. Tapping a pin offers the days to put the place on, or **Remove from day** when it's already on one.
- Each day card shows its date or label, title, focus, notes and its places in `dayOrder`, with **▲** / **▼** to reorder (each with an `aria-label` naming the place and direction) and **Remove** to send a place back to the pool. No drag-and-drop. Deleting a day returns its places to the pool.
- The **Not planned** pool lists the selected day's city's places with no `dayId`, Loved first.
- Events whose `eventStart`–`eventEnd` range overlaps a dated day show "Happening this day".
- **Open walking route** builds Google Maps directions through the day's located places in order (§9.2).
- **Export** (§10): **Take it to Google Maps** downloads the day-by-day map file, and the plain places CSV and KML are there too. The box says how many places have no pin and will be left out, and links to the help page's import steps.

### 7.9 Price control (flights and stays)

Prices are a snapshot: a Google Flights link carries the price Google showed when it was copied. The app never fetches a price.

- **The price is a button.** Beside it sits a small age label ("3d") with a sun-colored dot once it is older than 3 days. For stays, the per-night price shows beneath the total. Then one line with the change from the previous check ("▲ $38 higher", "▼ $12 lower", "No change") and when it was checked, with who and the exact time as a `title` tooltip; a **New low** pill when the latest amount beats every earlier one; and a small sparkline once there are 2 or more entries. With no price yet, the button reads **Add price**.
- Tapping the price opens the saved link in a new tab and reveals one row: **Still $64?** with **Same** and **Changed**. **Same** logs a new entry at the same amount; **Changed** shows a number field and **Save price**. With no link saved, nothing opens but the question is still asked. After a check, the movement is shown in words and color.
- Amounts accept "$1,234.56", "1234.56", "1234" and "1234.5"; anything that isn't a positive amount gets an inline error.
- **Check prices** on an option, and on the stays list, walks through every price older than 3 days, one at a time, in screen order. It is disabled when nothing is stale.
- **History** (shown with 2+ entries) expands the full list, newest first, each with a delete action (with confirmation) using `arrayRemove` on the exact entry object.
- Opening a price row or History must not be undone by a live update (§8).

## 8. Rendering and state rules

- Use `onSnapshot` listeners for the open trip document and the subcollections the current tab needs. Unsubscribe when leaving the trip or tab. Never create a listener inside a render function.
- Keep open forms and dialogs **outside** containers that are re-rendered by snapshot updates, and defer a section's rebuild while someone is typing in it (`renderWhenIdle`). A live update must never wipe what someone is typing or close their form.
- Every write shows a pending state (button disabled, "Saving…"), then either a quiet success (the list updates) or an inline error near the control that keeps the user's input. Translate `permission-denied` to "You don't have access. Are you signed in with the approved account?"
- Build DOM with `document.createElement` and `textContent`. Never put user or database text into `innerHTML`.
- Any link from data or user input is rendered as `<a>` only when `safeUrl()` (§9.5) accepts it, and opens with `target="_blank" rel="noopener noreferrer"`.
- Show times in the viewer's locale, and relative when recent ("5 min ago").

## 9. External links and lookups

All builders live in `js/lib/links.js` (and `mapsurl.js`) and are unit tested. Always use `encodeURIComponent` for values.

### 9.1 Search links

`<city>` for Google Hotels, Booking.com and Airbnb is the one stop's city they're grouped under on the Stays list (§7.7), never a trip-wide destination (T31) — there is none.

| Link | URL |
|---|---|
| Google Flights search | `https://www.google.com/travel/flights?q=` + encode(`Flights from <FROM> to <TO> on <YYYY-MM-DD> returning <YYYY-MM-DD>`). FROM and TO use the airport code if present, otherwise the city. Omit the " on …" and " returning …" parts when dates are missing |
| Google Hotels | `https://www.google.com/travel/hotels?q=` + encode(`<city> hotels`) |
| Booking.com search | `https://www.booking.com/searchresults.html?ss=<city>&checkin=<YYYY-MM-DD>&checkout=<YYYY-MM-DD>&group_adults=<n>&no_rooms=1&group_children=0` (leave out the date parameters when dates are missing) |
| Airbnb search | `https://www.airbnb.com/s/<encoded city>/homes?checkin=<YYYY-MM-DD>&checkout=<YYYY-MM-DD>&adults=<n>` (leave out missing dates) |

### 9.2 Google Maps links

- Open a place: `https://www.google.com/maps/search/?api=1&query=` + encode(`<name>, <city>`). When the place has a saved `googleMapsUrl` accepted by `safeUrl`, open that instead. `<city>` is the Map tab's selected stop chip (§7.7), or empty with none selected.
- Find a place (`googleMapsFindUrl(text, city, country)`): `https://www.google.com/maps/search/?api=1&query=` + encode of the non-empty parts of `<text>, <city>, <country>` joined with ", ". `country` is unused since T31 — callers pass the Map tab's selected stop chip's city alone, or a stay's own stop's city.
- Walking route for a day: `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=<lat,lng>&destination=<lat,lng>&waypoints=<lat,lng>|<lat,lng>…` using the first located place as origin and the last as destination. At most 8 waypoints per link; a day with more than 10 located places splits into consecutive links ("Route part 1", "Route part 2"…), each starting where the previous ended. Encode `|` as `%7C`.

### 9.3 Reading Google Maps URLs (`mapsurl.js`)

`parseGoogleMapsUrl(text)` returns `{ lat, lng, name, error }`:

1. If the value passes `safeUrl` and the host is `maps.app.goo.gl` or `goo.gl`, return the error "Short share links can't be read here. Open the link, copy the full address from the browser bar, and paste that instead — or use Search or Place on map." (Check this first.)
2. Otherwise the value must pass `safeUrl` and the host must be `google.com`, `www.google.com`, `maps.google.com`, or a `google.<country>` / `www.google.<country>` domain. If not, return "That doesn't look like a Google Maps link."
3. Coordinates, in this priority order: `!3d<lat>!4d<lng>` (the place's own position), then `query=<lat>,<lng>` or `q=<lat>,<lng>`, then `@<lat>,<lng>,` (the map view center) only if nothing above matched.
4. Name: the path segment after `/place/`, URL-decoded, with `+` turned into spaces.
5. Accept only latitudes from −90 to 90 and longitudes from −180 to 180.
6. With no coordinates, return the name if there is one and the error "No location in this link — use Search or Place on map."

### 9.4 Nominatim search

- URL: `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=` + encode(query).
- Run only when a Search button is pressed, never on each keystroke. At most one request per second (`js/lookup.js` queues).
- Show each result's `display_name` and use its `lat` and `lon` (strings, so convert them to numbers).
- Show "Search results from OpenStreetMap" under the results.
- On network failure, show an inline error and suggest Place on map.

### 9.5 URL safety

`safeUrl(text)` trims the text and returns the normalized URL string only when `new URL()` parses it and the protocol is `http:` or `https:`. Otherwise it returns `null`.

### 9.6 Reading flight and stay links (`flightlink.js`, `staylink.js`)

Both are best-effort and never block typing details by hand. The app reads **only the link text the user pasted**; it never downloads the linked page (§2).

**Google Flights — built and tested.** `js/lib/flightlink.js` and `js/lib/protobuf.js` are covered by `tests/flightlink.test.js` using real links the owner copied. **Don't rewrite them;** use their exports. If a real link reads wrongly, add it as a failing test first, then fix.

`parseFlightLink(text)` returns:

```
fromAirport, toAirport, outboundDate, returnDate   // string or null
fromPlace, toPlace       // city names, only when the link names cities instead of airports
legs: [ { date, from, to, segments: [ { from, to, date, airline, flightNumber } ] } ]
outboundStops, returnStops   // number, or null when unknown (a search page before flights are picked)
price: { amountCents, currency } | null   // what Google showed when the link was copied
error                    // null, or one of the messages below
```

Also exported: `stopsLabel(n)` ("Nonstop", "1 stop", "3 stops"), `legRoute(leg)` (airports in order), `readLinkPrice(tfu)`, and from `airlines.js`, `airlineName(code)` ("AS" → "Alaska", unknown → null).

What a link contains depends on where it was copied:

| Copied from | Route & dates | Stops, airlines, flight numbers | Price |
|---|---|---|---|
| The **booking** page (after picking the outbound and return flights) | ✓ | ✓ | ✓ |
| The search results page | ✓ (airports or cities) | — | — |
| **Share** button (`/travel/flights/s/…`) | can't be read: the error asks for the address-bar link | | |

How it reads the link (for reference): `tfs` is base64url protocol-buffer data. Field 3 repeats once per leg; in a leg, field 2 is the date, field 4 repeats once per segment (`1` from, `2` date, `3` to, `5` airline code, `6` flight number), and fields 13/14 are the origin/destination (`1` kind: 1 = airport, 2 = city id; `2` value). `tcfs` maps city ids to names. `tfu` field 1 is base64 text of a message whose field 3 is the price (`1` amount in minor units, `2` decimal places, `3` currency). If the structured read fails, it falls back to scanning `tfs` for date and airport-code text.

Errors: "That doesn't look like a Google Flights link." · "Short share links can't be read. Open it, then copy the full address from your browser's address bar and paste that." · "Couldn't read this link — fill in the details below."

The price from a link is a **suggestion the user confirms** by saving it, which keeps the rule that every saved price is one a person checked (§2).

`parseStayLink(text)` returns `{ provider, name, checkIn, checkOut, guests }`, each `null` when not found: Booking.com (`/hotel/<cc>/<slug>.html` → title-cased name; `checkin`, `checkout`, `group_adults`), Airbnb (`check_in`/`checkin`, `check_out`/`checkout`, `adults`; no name), Google Hotels (`/travel/hotels` → provider; the `q` parameter, if present, as the name). Any other valid link sets provider `other`.

### 9.7 Reading a My Maps KML export (`kmlimport.js`)

- `parseKml(text)` resolves `{ layers, error }`. On success, `layers` is `[{ name, pins: [{ name, lat, lng, note }] }]`, one per `<Folder>` (using its own `<name>`), plus a trailing `{ name: "", pins }` group for any `<Placemark>` outside a folder. Lines and shapes (no `<Point>`) are skipped.
- A KMZ file (binary, starting with "PK") resolves `{ layers: [], error: KMZ_MESSAGE }` instead of being parsed, where the message explains the "Export as KML instead of KMZ" tick box.
- `findDuplicates(pins, places)` matches a pin to an existing place by the same name within 50 m, so importing the same map twice adds nothing.
- The file is read in the browser with `FileReader`; nothing is uploaded anywhere.

### 9.8 Airports (`airports.json`, `airports.js`)

`js/data/airports.json` maps IATA code → `[city, country, lat, lng]` for airports with scheduled service (source: OurAirports, public domain). `js/lookup.js` fetches it once, on demand, and `createAirportIndex` exposes `info(code)`, `cityName(code)` and `cityKey(code)` ("Rome, IT" — FCO and CIA share a key, so a flight from one and back to the other is still a round trip). An unknown code falls back to the code itself.

## 10. Export formats (`exporters.js`)

Every export includes only places with coordinates. Downloads use a `Blob` and a temporary `<a download>`. Escape `& < > " '` in all KML text, and never put user text into an HTML string.

### 10.1 Day-by-day map (KML)

- Filename: `<trip name slug>-day-by-day.kml`.
- KML 2.2 with a `<Document>` named after the trip, one `<Folder>` per day (named by the day's title or date) holding that day's places in `dayOrder`, a **Stays** folder with the chosen stays, and a **Not planned** folder with the located places that aren't on a day (always present, even when empty).
- This is what **Take it to Google Maps** downloads. The help page explains importing it into My Maps and opening that map in the Google Maps app.

### 10.2 Places CSV

- Filename: `<trip name slug>-places.csv` (lowercase, non-alphanumerics become `-`).
- UTF-8, no BOM, `\r\n` line endings, and RFC 4180 quoting (quote any field containing a comma, quote or newline, and double any internal quotes).
- Columns in this exact order: `Name, Latitude, Longitude, Category, Neighborhood, Note, Link, Ranking, Day`.
  - Latitude and Longitude have up to 6 decimals.
  - Link is `link`, else `googleMapsUrl`, else empty.
  - Ranking is the summary text, e.g. `2 love · 1 like`, or empty.
  - Day is the day's title or date, or empty.
- Rows are sorted by Category, then Name.

### 10.3 Places KML

- Filename: `<trip name slug>-places.kml`.
- KML 2.2 with a `<Document>` named after the trip and one `<Folder>` per category that has places.
- Each `<Placemark>` has `<name>`, a `<description>` (neighborhood, note, link and ranking on separate lines), and `<Point><coordinates>lng,lat,0</coordinates></Point>`. Longitude comes first.

## 11. Calculations (`totals.js`, `money.js`, `dates.js`, `route.js`, `coverage.js`, `stage.js`, `choices.js`)

- **Parse money:** strip spaces, a currency symbol and thousands commas, then require `^\d+(\.\d{1,2})?$`, and convert to integer cents without floating-point error (split on `.`). Return `null` when invalid.
- **Format money:** `Intl.NumberFormat(locale, { style: "currency", currency })` on `cents / 100`.
- **Latest entry:** the entry with the greatest `checkedAt`. On an exact tie, the greater `id` wins. Array order means nothing.
- **Delta:** latest minus second-latest (by the same ordering). There is no delta with fewer than 2 entries.
- **New low:** there are 2 or more entries and the latest amount is strictly less than every other entry's amount.
- **Price age and staleness:** whole days since the latest check. No price at all, or an age over 3 days, counts as stale (the sun dot, and the **Check prices** queue).
- **Nights:** whole days between two dates computed in UTC, and only when both exist and the second is later. Otherwise show "Dates needed".
- **Per night:** the latest stay total divided by nights, rounded to the nearest cent for display only. Never stored.
- **Equal split** `split(amountCents, n)`: `base = floor(amount / n)` and `remainder = amount − base × n`. The first `remainder` travelers (in `travelers` array order) get `base + 1`, the rest get `base`. The shares always add up exactly to the amount.
- **Night coverage:** one cell per night of a stop; a night is covered when exactly one chosen stay spans it, double-booked when two or more do, open when none does.
- **A traveler's choice** (`choiceFor(trip, travelerId, options)`): their `choices` entry, or — when they have none — the retired `chosenOptionId` and that option's idea (§5.3). Returns `{ ideaId, optionId }`, either of which may be null. Someone who has chosen an option but no idea reads as being on that option's own idea: it's the only idea their home flights could come from.
- **Who an item is for** (`forTravelers(item, kind, ctx)`): a non-null `forTravelerIds` wins, narrowed to travelers who still exist. Otherwise it is worked out:

  | Item | Travelers | How the price is split |
  |---|---|---|
  | Home flight | the traveler it belongs to | its price only — the price is per person |
  | Hop | everyone whose chosen option is its option | the full price to each — the price is per person |
  | Stay | everyone sleeping on any of its nights, read from their own stops | the total split equally |
  | Split cost | everyone | split equally |

  A stay nobody is present for — including one with no dates, and any stay before anyone has stops — is for everyone, so a price is never left unpaid.
- **A traveler's total** (`travelerBreakdown`): their picked home flights under *their* chosen idea, plus every hop they're for, plus their share of each chosen stay and each split cost, each split separately. Returns `{ homeCents, hopCents, stayCents, costCents, totalCents, complete, missing }`.
- **Everyone together:** the sum of traveler totals.
- **Complete:** every traveler has at least one picked home flight, every counted flight has a price, and every chosen stay has a price (choosing no stay is fine). Otherwise it's a **Total so far (missing some prices)** with a list of what's missing. Missing amounts count as 0 in the sum, but they are listed and the total is never labeled complete.
- **Merged stops** (`mergeStops`): one route for the whole group, built from each traveler's own stops — their chosen idea's picked home flights and their chosen option's hops, through `stopsFor`. A traveler with no chosen option adds nothing. Stops are merged by `cityKey` in order of first arrival (undated last): `from` is the earliest, `to` the latest, with `nights: [{ date, travelerIds }]` saying who sleeps there each night, and `travelerIds` for the stop as a whole. Map chips, Stays groups, Days creation and `stopKey` matching all read merged stops.
- **Trip stage** (`tripStage(trip, today)`, where `today` is the viewer's local date as "YYYY-MM-DD"). Returns `{ key, label, shortLabel }`:
  - nobody has chosen an option → `exploring`, "Exploring"
  - someone has chosen an option but there's no `startDate` → `planning`, "Planning"
  - today before `startDate` → `upcoming`, "In N days" (N = whole days until the start; 1 → "Tomorrow")
  - today from `startDate` through `endDate` (or through `startDate` when there's no end) → `now`, "Happening now"
  - today after that → `done`, "Trip's over"
- Store no derived values in Firestore. Compute them when rendering.

## 12. Out of scope

Do not build any of these: flight or hotel price fetching, booking or payments, photo uploads, chat or notifications, offline mode, a native app, user roles beyond the allowlist, currency conversion, drag-and-drop, email invitations, analytics, or any AI features inside the app.

Agreed as later rounds, not now: automatic price refresh, reading short share links, per-trip membership, a photo map from picture locations, and images and GIFs on the help page.

## 13. Changing this spec

Changes are made by the owner (or a model the owner asks). Edit this file first, bump the spec version at the top, note the change below, then build it.

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-26 | First version |
| 1.1 | 2026-09-27 | Added `trips.destinationId` and `places.destinationId` so the Places tab scoped to the chosen destination. Places tab required a chosen destination. Add place led with pasting a Google Maps link. |
| 1.2 | 2026-09-27 | Added `help.html`, a static traveler-facing help page, and a **Help** link in the top bar. |
| 1.3 | 2026-09-27 | Every place got a location action whether or not it had a pin (**Edit location** vs **Set location**). Replaced the hardcoded activity-specific idea queries with destination-agnostic ones. |
| 1.4 | 2026-09-27 | Visual refresh: card shadows, hover lift, gradient accents, Inter, pill badges. No behavior changed. |
| 2.0 | 2026-09-27 | Owner feedback round 1. Warm "sunset + teal" look with exact tokens, a logo and favicon. Candidate cards with labeled details and a Wikipedia photo. Add place / flight / stay led with pasting a link; `flightlink.js` added. Any number of flights per traveler and stays per trip could be chosen. Big view files split; outside lookups moved to `js/lookup.js`. |
| 2.1 | 2026-09-28 | Wording pass (T07) across every screen, per `docs/tasks/WORDING.md`. Confirmation dialogs name their action. Day-reorder buttons got `aria-label`s. |
| 3.0 | 2026-09-28 | Owner feedback round 2 (T08–T13). Trip `status` retired for an automatic stage badge. Added **Coffee & cafés**. Google Flights links fully decoded into `legs` by `flightlink.js`/`protobuf.js`. Flight and stay dialogs, cards and the price display redesigned for comparing. Stays got numbers, **Where is it?** and a price-pin map. |
| 4.0 | 2026-10-12 | **Round 3, the V4 overhaul (T14–T30).** `docs/V4.md` folded in and retired. Four tabs, **Overview → Routes → Map → Days** (§1); the Recap tab and public recap page, destination ideas (candidates), the trip-wide `destination`, voting on stays, and the separate Places and Flights & stays tabs are all gone (§1, §5.3, §5.4). New look and phone navigation from `docs/mock/routes-mock.html`: teal-on-light tokens, dark mode, Bricolage Grotesque / Instrument Sans / JetBrains Mono, a bottom tab bar under 760 px (§4). Moved to Firebase Hosting with GitHub Actions, a home-screen manifest, and sign-in that sticks on iPhone (Google redirect plus email and password, `email_verified` required) (§3, §3.3, §6, §7.1). **Routes** replaces flight comparison: ideas, options and hops, with stops and nights worked out from the flights by `route.js`, auto names, warnings, and pasting a Google Flights link as the main data entry (§5.4, §7.6). Prices became a snapshot you confirm, with an age label, a stale dot past 3 days and a **Check prices** walk-through (§7.9). Places use **Love / Like / Pass** and carry a `stopKey` and `layer`; places can be imported from a Google My Maps KML export (§5.4, §7.3, §7.7, §9.7). Stays belong to a stop, with Out/Chosen status, **Duplicate**, and night coverage (§5.4, §7.7). One **Map** tab holds places and stays together behind stop chips, and **Days** plans days on a map and exports the whole plan as one KML for Google Maps (§7.7, §7.8, §10.1). Airports are bundled (§9.8). Wikipedia destination photos and `photos.js` removed with the candidates that used them. |
| 4.1 | 2026-10-12 | **Round 5, owner testing (T32–T35).** Google sign-in works on phones; the currency field is gone (every trip is USD) and traveler details always save; pasting a flight is scoped to the button you press, so there's no guessing where it lands (§7.6). **Every traveler now chooses their own idea and their own option, as two separate choices** (`trips.choices`, §5.3): one person's choice never moves another's, and `chosenOptionId` is retired to a read-only fallback so older trips keep the choice they had. Flights, stays and costs carry `forTravelerIds`, which says who the price is for — worked out automatically and overridable (§5.4, §11). Map, Stays and Days read one merged route built from everyone's choices rather than a single traveler's (§7.7, §7.8, §11), and the stage badge counts the trip as planned once anyone has chosen an option. New `js/lib/choices.js` holds the choices, the splits, the merged stops and the budget, which moved out of `totals.js`. |
