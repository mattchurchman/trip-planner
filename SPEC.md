# Trip Planner — Specification

Spec version: **4.5** (October 2026)

This is the source of truth for what the app is and how it works. `docs/history/V4.md` (the agreed design for round 3) and `docs/history/R7.md` (the "Waypoint" look, round 7) are both folded into this file and are now history. The original build phases are in `docs/history/PHASES.md` (all built); current work is in `docs/tasks/`. The working rules for every coding agent are in `AGENTS.md`, and the words on screen are governed by `docs/tasks/WORDING.md`. If code and this spec disagree, the spec wins unless the owner approves a change and this file is updated in the same commit.

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
| Fonts | Google Fonts, one `<link>` in every page's `<head>`: Gabarito (display: headings, card titles, the lockup) and Figtree (body). No third font — prices and codes use the body font with tabular figures (§4) |
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
img/logo.svg          the top-bar lockup mark, 28 px
img/app-icon.svg      the larger mark on the sign-in card, 72 px
img/favicon.svg       browser-tab icon (the mark simplified for 16-32 px)
img/icons/            home-screen icons (icon-180.png for Apple touch, -192, -512), full bleed
img/topo-on-forest.svg, img/topo-on-paper.svg
                      the topographic texture (§4); sources for all of these live in docs/brand/
js/firebase-config.js the owner's Firebase web config (public values; safe to commit)
js/firebase.js        initializes Firebase, re-exports the functions the app uses
js/app.js             auth gate, router, top bar, tab bar
js/store.js           all Firestore reads, writes and listeners
js/ui.js              shared DOM helpers (el(), field(), row(), dialogShell(), icon(), menuButton(),
                      routeRibbon(), avatars, rank control, toast, download)
js/lookup.js          the only file that calls outside services with fetch(): Nominatim (§9.4),
                      plus loading the bundled airport file
js/data/airports.json IATA code -> city, country, lat, lng (§9.8)

js/lib/ — pure logic, no DOM and no Firebase, each with tests in tests/
  airports.js         build the airport/city index from airports.json (§9.8)
  airlines.js         airline code -> name ("AS" -> "Alaska")
  auth-errors.js      Firebase auth error codes -> plain sentences
  categories.js       the place categories, their colors and icons (§4)
  choices.js          per-traveler choices, who a cost is for, merged stops, the budget (§11)
  coverage.js         night coverage of a stop by its chosen stays (§7.7)
  dates.js            date math and formatting
  dayplan.js          dates of a route, and the days to create from it (§7.8)
  exporters.js        CSV and KML generation (§10)
  flightlink.js       read flights, stops, airlines and price from Google Flights URLs (§9.6)
  icons.js            the icon set: name -> SVG path data, drawn by icon() in ui.js (§4)
  itineraryFormat.js  leg date and flight label formatting
  kmlimport.js        read layers and pins from a My Maps KML export (§9.7)
  notes.js            clean and lay out a place note from My Maps (§9.7)
  links.js            external link builders and URL safety
  mapsurl.js          read coordinates and names from Google Maps URLs (§9.3)
  money.js            parse, format, split
  mymaps.js           read the group's shared Google My Maps link (§9.10)
  optionSort.js       stay sort order, stay numbering, the cheapest-first comparator
  protobuf.js         tiny reader for the binary data inside Google Flights links (§9.6)
  ribbon.js           the route ribbon's stops for the Overview summary card (§7.5)
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
  overview.js         Overview tab: summary card, budget, comments (§7.5)
  travelers.js        the Travelers card on Overview (§7.5)
  splitCosts.js       the Split costs list on Overview (§7.5)
  sharedLinks.js      the Shared links card on Overview: Album and Our My Maps (§7.5, §9.10)
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
  days.js             Days tab: the day chooser and the selected day (§7.8)
  dayTimeline.js      the selected day's numbered timeline and the "not planned" sheet (§7.8)
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

`help.html` is a static, standalone page for travelers (not the owner). It needs no sign-in and imports nothing from `js/` — plain HTML/CSS styled with `css/styles.css`, opened in a new tab from the round **?** button in the top bar (§4). Its sections run in workflow order: add to home screen and sign in, Overview (travelers), Routes (copying the right Google Flights link, pasting, options), checking prices, Map (My Maps import, stays), Days, taking the plan to Google Maps, then a short "Quick fixes" list drawn from the traveler-facing rows of `README.md` (nothing needing Firebase console access). Each section carries an `<!-- IMAGE: … -->` comment marking where a screenshot or GIF goes in a later round. Keep it current when a task changes what a tab does.

### 3.3 Home-screen app

`manifest.webmanifest` declares `display: standalone`, the name "Trip Planner", the icons in `img/icons/`, `"theme_color": "#1F4D3A"` and `"background_color": "#F6F2E9"`. Every HTML page sets `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `apple-touch-icon` → `img/icons/icon-180.png`, and two `<meta name="theme-color">` tags with `media` (`#F6F2E9` light, `#121815` dark). The home-screen icons are full bleed; the phone rounds the corners. Fixed bars pad with `env(safe-area-inset-*)` so nothing hides under the iPhone's home indicator.

The ready-made brand artwork lives in `docs/brand/` and is copied, never redrawn: `favicon.svg` → `img/favicon.svg`, `logo-small.svg` → `img/logo.svg`, `app-icon.svg` → `img/app-icon.svg`, `icons/icon-180|192|512.png` → `img/icons/`, `topo-on-forest.svg` and `topo-on-paper.svg` → `img/`. `logo-mark.svg`, `logo-small-inverse.svg` and `app-icon-fullbleed.svg` stay in `docs/brand/` as the sources for the PNGs.

## 4. Look and feel

The look is **"Waypoint"** (round 7): forest green on warm paper, calm, high contrast, phone first. `css/styles.css` is the only place these values are written down. The old reference `docs/mock/routes-mock.html` and `docs/R7.md` are both history; this section wins.

Principles, in order:

1. **One line of header.** The trip's name, dates and stage sit in the top bar on trip tabs; a big heading only where a page has nothing else to say (trips list, sign-in).
2. **Summary first, settings behind a tap.** Editable fields live in sheets opened from **Edit** or ⋯, not on the page.
3. **Rows, not boxes in boxes.** A list is one card with divided rows. A card never sits inside a card.
4. **Destructive actions live in ⋯ menus** with their existing confirmation, never as a standing red button.
5. **Forest is the only action color; marigold only marks things** (chosen, cheapest, stale, the logo pin).
6. **The dotted path is the brand**: the logo's path reappears as the route ribbon, the walking order on Days, and step connectors.

**Color tokens.** Defined once on `:root` in `css/styles.css` and used only through the tokens (category colors and the avatar colors below are the only exceptions). The same three blocks hold the dark values: `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F6F2E9` | `#121815` | page ground ("paper") |
| `--surface` | `#FFFCF6` | `#1A221E` | cards, sheets, bars |
| `--sunk` | `#ECE5D6` | `#222C27` | segmented tracks, inset rows, empty states |
| `--line` | `#DED5C3` | `#2C3832` | borders, row dividers |
| `--ink` | `#1B2620` | `#E9EFE9` | text |
| `--muted` | `#5C665F` | `#9DAAA2` | secondary text, labels |
| `--forest` | `#1F4D3A` | `#8FD0AE` | the action color: primary buttons, links, focus ring, active tab |
| `--forest-soft` | `#DDE9DF` | `#1D3A2D` | behind forest text: active tab pill, countdown chip |
| `--on-forest` | `#F6F2E9` | `#0E2219` | text on solid forest |
| `--accent` | `#E9A23B` | `#F2B65A` | marigold **fills** only: Chosen badge, logo pin, new-low pill |
| `--on-accent` | `#2B1A02` | `#2B1A02` | text on solid marigold |
| `--accent-soft` | `#FBEBD0` | `#3A2A12` | behind accent text: Cheapest, stale |
| `--accent-ink` | `#8F5A0E` | `#F2B65A` | marigold **text** (never `--accent` for text on light) |
| `--good` | `#2F7A4F` | `#7FD3A0` | price went down |
| `--bad` | `#B4442E` | `#FF8A75` | errors, price went up, destructive menu items |
| `--on-color` | `#FFFFFF` | `#FFFFFF` | text on solid good/bad |

Every text pair above is at least 4.9:1. `--accent` on `--surface` is decoration only, never text.

**Aliases** kept so nothing breaks: `--teal: var(--forest)`, `--teal-soft: var(--forest-soft)`, `--on-teal: var(--on-forest)`, `--sun: var(--accent-ink)`, `--sun-soft: var(--accent-soft)`. New code uses the new names; the aliases stay.

Also: spacing `--space-1`…`--space-7` (4, 8, 12, 16, 24, 32, 48 px), `--r: 18px` (cards), `--radius: 12px` (buttons, inputs), `--radius-sm: 8px` (chips inside rows), `--radius-pill: 999px`, shadows tinted with ink `rgba(27, 38, 32, …)`, and `--ease: 160ms ease`. Cards use a border, not a shadow, at rest.

**Dark mode** follows the phone or computer setting (`prefers-color-scheme`). There is no toggle in the app.

**Type.** One Google Fonts `<link>` with `display=swap` in every page's `<head>`, loading **Gabarito** (600/700) and **Figtree** (400/500/600/700): `--display: "Gabarito", "Avenir Next", "Segoe UI", sans-serif` and `--body: "Figtree", "Helvetica Neue", Arial, sans-serif`. There is no mono font — `.mono` keeps its name but is the body font with `font-variant-numeric: tabular-nums` and weight 600, so prices and airport codes still line up.

**Six sizes, no others.** Every `font-size` in the stylesheet is one of these tokens; the only exception is `input`/`select`/`textarea`, which keep `max(16px, 1rem)` so iOS doesn't zoom.

| Token | Size / line-height | Font | Use |
|---|---|---|---|
| `--fs-title` | 26 / 1.15, weight 700, `letter-spacing: -0.02em` | display | the one `h1` (trips list, sign-in, the Days day title) |
| `--fs-section` | 19 / 1.25, weight 600 | display | `h2` section headings |
| `--fs-item` | 16 / 1.3, weight 600 | body | card titles, row names, `h3` |
| `--fs-body` | 15 / 1.5 | body | body text, buttons |
| `--fs-small` | 13 / 1.4 | body | secondary lines, captions |
| `--fs-label` | 11 / 1.3, weight 700, uppercase, `letter-spacing: 0.1em` | body | field labels, tiny section labels |

A big number (the Overview total) may use `--fs-title` with tabular figures. Nothing anywhere is larger than 32 px. Use exactly one `h1` per page and don't skip heading levels; every section heading sits on one row with its main action (stacked on phones).

**Icons.** One helper, `icon(name, { size = 20, label } = {})` in `js/ui.js`, builds an inline SVG: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, round caps and joins, `aria-hidden="true"` unless a `label` is given (then `role="img"` with that `aria-label`). The path data is the single source in **`js/lib/icons.js`** (`export const ICONS = { name: ["d1", …] }`, circles written as path arcs), with a test that every name is a non-empty array of strings. The set: `overview`, `routes`, `map`, `days`, `flight`, `stay`, `place`, `love`, `like`, `pass`, `travelers`, `price`, `more`, `plus`, `edit`, `trash`, `link`, `external`, `download`, `walk`, `food`, `coffee`, `help`, `close`, `chevron`. Add an icon only by adding it to `icons.js`.

Category → icon, for the icon tiles: every category has its own icon, named in the category table below (the `icon` column); a label not in the table (an older place) uses `place`. The category icons are Lucide shapes redrawn into `js/lib/icons.js` like the rest of the set. **No emoji anywhere**: votes are the `love`/`like`/`pass` icons, the Days map's home base is the `stay` icon, and the "↗" after external links is the `external` icon at 14 px (the CSS `::after` rule stays only as a fallback for links built without `icon()`). Text check marks in labels ("Chosen ✓") may stay.

**Navigation.** Under 760 px, a fixed bottom tab bar with an icon (from the set above) and a label per tab, plus the top bar below. From 760 px the tabs move into the top bar and the bottom bar is gone. The active tab is a `--forest-soft` pill behind its icon.

**Top bar (all trip tabs).** Under 760 px: the lockup mark (28 px), then a two-line title — the trip name (`--fs-item`, display font) over "Apr 10 – 22 · 3 travelers" (`--fs-small`, muted) — then the round **?** Help button and the avatar. From 760 px: the full lockup with "Trip Planner", the tabs, then the trip name and dates on the right before Help and the avatar. **There is no per-tab `h1` trip name or stage pill**; the stage chip lives on the Overview summary card.

**Lockup:** the mark plus "Trip Planner" in `--display` 700, 18 px, `letter-spacing: -0.02em`, 10 px gap. The mark is never recolored.

**Components.** Reuse what exists; don't invent a second way to do something the app already does.

- **Buttons** (`.btn`): 44 px min height, `--radius`, 15 px / 600. Primary: `--forest` fill, `--on-forest` text. Secondary (plain `.btn`): `--surface`, 1 px `--line`, `--ink` text, hover border `--forest`. Quiet (`.btn-quiet`): no border, `--forest` text. Small (`.btn-small`): 36 px tall, 14 px, still a 44 px hit area. **`.btn-danger` is only used inside confirmation dialogs.** Icon button (`.icon-btn`): 40 px square, `--radius`, bordered, always with an `aria-label`.
- **Cards:** `--surface`, 1 px `--line`, `--r`, padding 16 px (20 px from 760 px), no shadow at rest. Never a card inside a card — inner groups become rows divided by 1 px `--line`.
- **Rows** (`.row`): min-height 48 px, padding 10–12 px by 16 px, flex with a 12 px gap: optional leading (avatar, number, icon tile), a text block (`--fs-item` name plus a `--fs-small` muted line), and trailing content (a value or ⋯).
- **Overflow menu** (`menuButton(items, { label })` in `js/ui.js`): an `.icon-btn` with the `more` icon and an `aria-label` naming what it acts on ("More actions for <name>"), opening a popover — a `<dialog>` under the button on desktop, a bottom sheet under 760 px — of items `{ label, icon, onSelect, danger }`. Danger items are `--bad` text and still run the existing confirmation. Esc or an outside tap closes it and focus returns to the button.
- **Chips:** pill, 32 px, `--surface` plus `--line`; selected is a `--forest` fill with `--on-forest` text. Category chips show a colored dot before the label.
- **Badges/pills:** 22 px, `--radius-pill`, 12 px / 600. Chosen: `--accent` with `--on-accent`. Cheapest and stale: `--accent-soft` with `--accent-ink`. Countdown: `--forest-soft` with `--forest`.
- **Segmented control** (`.seg`): a `--sunk` track with a `--surface` thumb; under 760 px it scrolls sideways inside its own track (never cut off, never overflowing the page) with the selected one scrolled into view.
- **Vote control:** three segments (the `love`/`like`/`pass` icons with counts); the viewer's own vote is the filled segment. The compact summary on a place row is the same icons at 15 px with counts, the viewer's vote in `--forest`.
- **Route ribbon** (`routeRibbon()` in `js/ui.js`, data from `ribbonStops()` in `js/lib/ribbon.js`): a home dot, one hollow dot per stop labeled "ROM · 5" (city code · nights), then a home dot in `--accent`, joined by a 2.5 px **dotted** connector. On a forest card it draws in `--on-forest`, on a surface card in `--forest`. Past 5 stops it shows the first 4, then "+N", then home.
- **Topographic texture:** `background-image: url(img/topo-on-forest.svg)` or `-on-paper`, `background-size: cover`, `background-position: right center`. Only on the Overview summary card, trip-card headers, the sign-in panel and empty states. Nowhere else.
- **Avatars:** 28–32 px circles. A traveler's color is stable, picked by traveler order from a fixed list of six muted colors (`--forest`, `#2F76A8`, `#A8507A`, `#B98522`, `#5463A6`, `#2F8A80` — the one place outside `categories.js` where raw colors are allowed). Stacked avatars overlap by 8 px with a 2 px `--surface` ring.
- **Dialogs and sheets:** behavior unchanged (`dialogShell()`, `field()`, `linkField()` — the one link box with its **Paste** button used by the flight, stay and place dialogs, re-reading on paste, on typing and after an auto-fill, so a link never needs pasting twice, T42). Styling: `--r` corners, a 4 px grab handle on phone sheets, a `--fs-section` title, actions right-aligned (full width on phone) with the primary last.
- **Empty states:** one icon (32 px, `--muted`), one sentence, one button, on `--sunk` with the topo-on-paper texture at the right.
- **Spacing rhythm:** 24 px between sections, 12 px between a section heading and its card, 8 px between rows-as-cards. A 16 px side gutter under 760 px; content max-width 880 px (760 px on the trips list and Overview).

**Rules.** Forest is the only action color; marigold only marks things. `--good`/`--bad` are only for price movement and errors. Tap targets are at least 44 px, every control has a visible label and a focus ring, and `prefers-reduced-motion` turns transitions off. Price movement is shown in words and arrows ("▼ $42 lower") as well as color. Every screen works at 375 px and at 1280 px with no horizontal scrolling. `input`, `select` and `textarea` are at least 16 px everywhere (iOS zooms on focus below that); pinch zoom is never disabled.

**Category colors** live in `js/lib/categories.js`; every other file imports them from there. They appear as a 9–10 px dot or an icon tint — never a filled pill with white text — and an icon tile behind a category icon uses the color at 14% (`color-mix(in srgb, <color> 14%, var(--surface))`). Menus and filters use this order:

| Category | Color | Icon |
|---|---|---|
| Food & Dining | `#C2602F` | `food` |
| Coffee & Cafés | `#8B6B4E` | `coffee` |
| Bars & Nightlife | `#7E5AA2` | `drinks` |
| Neighborhoods & Walks | `#2F8A80` | `walk` |
| Sights & Landmarks | `#2F76A8` | `sight` |
| Arts, Museums & Culture | `#8A7A33` | `museum` |
| Events & Seasonal | `#B8483F` | `event` |
| Sports & Recreation | `#6E8E2A` | `sports` |
| Nature & Outdoors | `#4F8A4E` | `nature` |
| Adventure & Experiences | `#B98522` | `adventure` |
| Day Trips | `#5463A6` | `daytrip` |
| Shopping & Markets | `#A8507A` | `shopping` |
| Other | `#6E7470` | `place` |

Places saved before 4.4 keep their old label (Food, Sight, Day trip and so on). The app doesn't translate them: the owner relabels them by hand. Until then they show the Other color and the `place` icon, and the Edit dialog keeps the old label as the selected option, marked "(old)", so saving without touching Category never changes it.

**Stage badge** colors (§11): Exploring, Planning and "Trip's over" use `--sunk` with `--muted` text; a countdown ("In 42 days") uses `--forest-soft` with `--forest` text; "Happening now" uses `--accent` with `--on-accent` text.

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
  [travelerId]: {
    ideaId: string | null,
    optionId: string | null,
    localIdeaIds: [ideaId]           // ideas this traveler lives in — no flight from home (§7.6)
  }
}
selectedStayIds: [stayId]            // the group may choose several stays; may be empty
albumUrl: string | null              // shared photo album
myMapsUrl: string | null             // the group's shared Google My Maps map (§9.10); trips made before 4.3 may not have it; read as null
createdBy: uid
createdAt: timestamp
updatedAt: timestamp
```

A new trip starts with `currency: "USD"`, empty `notes`, null dates, one traveler (the creator, linked by uid, with empty home fields), `choices: {}`, `selectedStayIds: []`, `albumUrl: null` and `myMapsUrl: null`.

**Choosing a route (`choices`).** Every traveler chooses for themselves, and the idea and the option are two separate choices: choosing an option does not choose its idea, and nothing one traveler chooses changes another's. Write one field at a time with a field path (`choices.<travelerId>.ideaId`, `choices.<travelerId>.optionId`), never the whole map, so two people choosing at once never overwrite each other. A traveler with no entry falls back to the retired `chosenOptionId` (and that option's idea), so trips from before 4.1 still show the choice they had. Nothing writes `chosenOptionId` again. The two ids are independent and may disagree — a traveler can be looking at one idea's flights while their option belongs to another.

**Living in the idea's city (`localIdeaIds`).** The ideas a traveler has ticked **I live here — no flight needed** on, so no flight from home is counted or missing for them (§7.6). Add or remove one at a time with `arrayUnion` / `arrayRemove` on the field path `choices.<travelerId>.localIdeaIds`, never the whole map. The list holds only the ideas ticked **by hand**: being local because a home airport matches the idea's arrival city is worked out when rendering and never stored (§11). A traveler with no entry, or an entry without the field, has ticked nothing.

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
category: one of the 13 categories in §4, stored as the exact label (older places may hold a pre-4.4 label)
neighborhood: string                 // free text, e.g. "Alfama"
note: string
lat: number | null, lng: number | null
googleMapsUrl: string | null         // the link the user pasted, if any
link: string | null                  // website, tour booking page, event page
eventStart: string | null            // retired T49; no longer read or written, old values left alone
eventEnd: string | null              // retired T49; no longer read or written, old values left alone
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

- Signed out: a forest panel with the topo texture carrying the 72 px app icon, "Trip Planner" and "Plan the trip together.", over a surface card with **Continue with Google** and email-and-password beside it — sign in, create account, forgot password — with `autocomplete` set so iPhone offers Face ID fill.
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

- The one `h1` "Your trips" and **New trip** (primary, `plus` icon) share a row. **New trip** asks for a name and creates the trip (§5.3 defaults), then opens its Overview.
- Each trip is a card: a 64 px header strip carrying the topo texture (`topo-on-forest` on `--forest` for a trip whose dates are still ahead, `topo-on-paper` on `--sunk` otherwise) with the stage badge (§11) at its right; then the name (`--fs-item`, display font), "Apr 10 – 22, 2027 · 12 nights" (or "Dates not set"), the travelers as stacked avatars, and ⋯. The whole card links to the trip; the ⋯ button stops the click from reaching it. Two columns from 760 px. Sorted by `updatedAt`, newest first.
- **Delete** is the only item in that ⋯ menu and appears only for the trip's creator. It asks for confirmation, then deletes every document in all the subcollections in batches of up to 400, then the trip document.
- No route ribbon here: it would need every trip's flights, which the list doesn't load.

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

Top to bottom (R7 §7, T61): summary card, Travelers, Budget, Shared links, Trip comments. No form fields show until a sheet is opened — trip name and dates aren't on the page itself.

1. **Summary card** (`overview.js`, forest, topo texture): "Your route" label with the stage chip at the right; the route ribbon (`routeRibbon()` in `ui.js`, data from `ribbonStops()` in `js/lib/ribbon.js`) drawn over the merged stops (§11), or "No route chosen yet — pick one on Routes" linking to Routes when there's no route or no travelers yet; a divider; then "Your total" (the signed-in traveler's, or the first traveler's, with "at least $X" while a price is missing, §11) on the left, and that traveler's "{idea} · {option}" (or "Not chosen yet") with "Group $X" on the right. A quiet **Edit trip** link under the card opens a sheet with name, start and end date (non-blank name, end not before start) — the only place these fields appear.
2. **Travelers** (`travelers.js`): an `h2` and a quiet **+ Add**, then travelers as a wrapping row of chips (avatar, name, home airport code). Tapping a chip opens the existing Edit sheet (name, home city, home airport, saved together with one **Save**); **Remove traveler** sits at the bottom of that sheet with confirmation. Add by choosing an app member or typing a name; adding opens the new traveler's Edit sheet straight away. At least one traveler must remain. Removing someone asks whether to delete their flights too, since Routes lists home flights per traveler and nobody could reach them afterwards.
3. **Budget**: one row per traveler with their total ("at least $X" while a price is missing), each a collapsed `<details>` opening to four parts — Flights from home, Option flights, Stays, Split costs — that add up to it. Then an "Everyone together" row. Split costs (`splitCosts.js`) are a collapsible row group in the same card ("Split costs · 2 · $2,010"), opening to one row per cost with its ⋯ (Edit, Delete) and **Add a split cost** at the end; add, edit and delete a label, amount, note and **Who's this for?** (Everyone, or chosen travelers), split equally between the travelers it's for (§11) — a cost for some shows "÷ 2 · Matt, Sam". If anything is missing, the card is headed **Total so far (missing some prices)** and lists what's missing. Never show a missing price as $0 (§11).
4. **Shared links** (`sharedLinks.js`): a card with two rows, **Album** and **Our My Maps**. Unset: a muted hint and **Add link**, opening a small sheet with the shared `linkField()` and **Save**. Set: **Open ↗** and a ⋯ menu (Change link, Remove link — Remove asks first). Album validates with §9.5; Our My Maps validates and works out its KML address per §9.10.
5. **Trip comments** at the bottom (§7.4).

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
2. The sheet opens with focus in its text box. If the box is empty, it reads the clipboard once on open and fills itself when that looks like a link (T42); either way it parses on `paste`, on typing and via its own **Paste** button, never needing a second paste. Parse with `parseFlightLink` (§9.6). A short share link shows its own message.
3. One confirmation sheet shows what was read (itinerary, dates, airline, the price Google showed, the landing date for an outbound flight) and a fixed **Adding to:** line naming the idea and traveler (home) or the option (hop) — there's nothing to pick. One tap on **Add** saves the flight, and a new idea when this is the first one, in a single batch — so a dropped connection never leaves a flight pointing at an idea that was never written.
4. The first home flight in a direction is `picked`; later alternatives are not until the user picks them.

**Names** come from the flights until someone renames them (`nameEdited`):

- Idea: "Rome round trip" when the in and out cities match, else "London in, Madrid out".
- Option: the hop cities other than the city you landed in, joined with " + ", or "Stay in Rome" with no hops. A hop joining an option widens its name ("Florence" → "Florence + Barcelona"); a renamed option is left alone.

**Stops, warnings and totals** (`route.js`, pure and tested):

- **Movements**: an option's hops flattened into legs `{ from, to, date }`, sorted by date, undated last. A round-trip hop is two legs.
- **Stops** for one traveler: start at the city their picked outbound home flight lands in, on its `landsDate` (or its departure date). Each movement closes the current stop and opens the next in the destination city. The last stop ends on the date of their picked flight home. Nights are the days between. With no home flight yet, start from the first movement and show the first stop with no start date.
- **Warnings**, shown on the stop they belong to: the next flight leaves from a different city than the one you're in; the dates run backwards; the flight home leaves from a different city than the last stop; a flight has no date.
- **Total per traveler**: the latest price of each of their picked home flights plus the latest price of every hop they are for (§11). If any is missing, the total reads "at least $X". An option card shows only its own flights' cost (see below); the traveler's total is the summary at the bottom of the tab.
- **Landing date guess**: a destination more than 60° of longitude east of the origin defaults `landsDate` to the day after departure, otherwise the same day. Always editable.

**"I live here": no flight from home.** A traveler who lives in an idea's city doesn't need a flight from home, and the app works that out on its own.

- **Local to an idea** = the idea's arrival city (`ideaEndpoints(...).inCode` from *anyone's* home flights on that idea, read through `airports.cityKey`) is the city of the traveler's `homeAirport`, **or** the idea id is in their `localIdeaIds` (§5.3). An auto-detected match can't be switched off: the tick shows on and disabled, with "Matches your home airport" beside it. Anyone can tick it by hand for the traveler on screen.
- **Their stops** come from the group instead of flights they don't need: they start in the idea's arrival city on the earliest arrival date among the other travelers on that idea, or else `trip.startDate`; they end on the latest home-flight departure among those others, or else `trip.endDate`. Hops from their chosen option apply exactly as for anyone else, so a hop back into their own city still makes a stop of its own — they may want a stay there, or not. Being local gives them stops even before they choose an option, and none of this ever raises a missing-flight warning, because there is no flight to be missing.
- **Totals:** flights from home count $0 for them, and "complete" never asks a local traveler for a picked home flight (§11).
- Flights they saved before they became local are **never deleted**: they stay in the card, uncounted, under one muted line saying so.

**The screen** (R7 §7, T62):

- A traveler segmented control and an idea segmented control, both following the segmented-control rules in §4 — they scroll sideways in their own track on a phone and are never cut off. The idea switch's **Rename** and **Delete** live in its trailing ⋯; **Choose idea** (**Chosen** once chosen) is the one button beside it. It sets `choices.<travelerId>.ideaId` for the traveler on screen only, and pressing it again unchooses it. A check on the idea chip means the traveler on screen has chosen that idea. Unchoosing an idea also clears that traveler's option when it sits under that idea (otherwise §11's fallback would keep the idea looking chosen). Travelers may have different dates; stops and totals always show for the selected traveler. Both selections live in memory only and reset when the tab is left.
- **The home-flights card** is headed "{traveler}'s flights from home · $X" (the flights being used only, "at least" when one has no price) and lists every alternative the selected traveler has for this idea, cheapest first with unpriced last. **A flight card is a two-column grid**: on the left the airline line and the OUT/BACK rows, on the right the price chip (§7.9) with its age underneath. The **New low** and **Cheapest** badges sit inline after the airline name, so they never push the left column down. **Use this** is a secondary button and **Using** a forest-soft pill with a check; Edit and Delete are in the card's ⋯. Picking a both-ways flight clears any separate out/back picks and vice versa. Under the **Paste flight link** button sits the small **I live here — no flight needed** tick. When the traveler is local, the card instead reads "No flight needed — {traveler} lives in {city}" with the tick below it and no paste prompts, no money in its heading, and the rail ends at "Already home" rather than a flight home. The tick shows pending while it saves and puts any error inline beside itself, not in the tab's banner.
- **Option cards** have the name in `--fs-item` with the price right-aligned in tabular figures and "per person" in `--fs-small` under it. They show the cost of the option's own flights only, labeled "per person" (the flights from home are the same under every option, so they are not repeated), a line "For: Matt, Sam" (everyone any of its flights is for, §11), the path line, a **Chosen by {traveler} ✓** badge when the traveler on screen chose it, small initials for the other travelers who chose it, and a **Cheapest** badge. They open to reveal the rail: stops as dots with their nights and warnings, and the hop flights inset between them. **Choose this option** sets `choices.<travelerId>.optionId` **for the traveler on screen only** — it never changes their idea or anyone else's choice — and pressing it on their chosen option unchooses it. Map, Stays and Days read the merged route built from everyone's choices (§11), not one traveler's.
- **Each hop** has a **Who's this for?** control: **Automatic** (everyone who chose the option) or a hand-picked set of travelers, saved as `forTravelerIds`. A hand-picked set reads "Set by hand" with a **Reset** link back to automatic.
- **A summary pinned to the bottom of the tab** reads "{traveler}: home $A + option flights $B = $C" for the traveler on screen, using their own chosen idea and every hop they are for (§11), and "at least $C" while anything is missing. It adds "(no idea chosen)" while the traveler on screen has no idea at all (so no option either, §11's fallback having nothing to work from), which is why their home figure reads $0. The page reserves 96 px of bottom padding so the bar never covers the last card. **Rename** and **Delete** on an option are in its ⋯.
- The price on every flight is the control (§7.9) — there is no separate "Recheck" link.
- **Earlier flights** (no `role`, saved before 4.0) sit in a collapsed list with **Move to…** (pick a traveler's home flights, or a shared hop under an idea and option) and **Delete**.
- Editing a flight by hand stays available (`flightForm.js`, opened from a flight's **Edit**) as the fallback, not the path. Pasting a new link into it re-reads the route, dates and legs.

### 7.7 Map tab

One Leaflet map with place pins and stay price pins together, and one list below it (beside it from 760 px).

- **Stop chips** across the top: **All**, then each city of the merged route in route order (first occurrence wins when the route visits a city twice), then **Elsewhere**. They filter the map and the list together. With nobody having chosen an option, the chips list every city across every option and a hint says to choose one on Routes.
- Under the chips sits the **shared map bar** (§9.10, R7 §8): the `map` icon and "Our shared map" with **Open ↗**, **Get KML** (the `download` icon, opening `kmlUrl` in a new tab) and **Import**; when no link is set, "Add your group's My Maps link to import it in two taps" with **Add link** (the same sheet as Overview) and **Import** still available. There is no floating "Import from My Maps" button — it lives here.
- A **Places / Stays** switch under that bar picks which list shows below the map.
- **On phones (under 760 px)** the map sits at the top of the tab at `35dvh` and scrolls away with the page; it is never zero height, so a phone held upright always shows it. **Show on map** scrolls the page back up to the map before panning (T71).
- From 760 px the map is `position: sticky` under the top bar, beside the list, and never taller than the screen below the top bar (`min(500px, …)`), so a phone held sideways shows the whole map beside the list (T71).

**Places**

- Filters collapse behind one **Filters** button, which shows a count ("Filters · 2") when any are on and opens a sheet holding category (multi-select chips), neighborhood (a dropdown built from existing values), text search on name and note, **I haven't ranked yet**, and the sort (Group favorites by default, then Newest, Neighborhood, Category). **Add place** is a primary button on the same row as **Filters**.
- **Each place is one compact row** (T49, T71): the category dot and the name — wrapping to at most two lines, never cut off on one — then a **vote bar**: three buttons, `love`/`like`/`pass` icon plus count, 44 px tall, the viewer's own vote filled in `--forest`. Tapping one votes right from the list, with the same behavior as voting in the open row (tapping your current vote clears it), and never opens or closes the row. Under 760 px the vote bar is its own line under the name; from 760 px it sits at the right of the same line. Tapping the name opens the row to show neighborhood, note (laid out by `notes.js`, §9.7), link, who voted what, comments, Show on map, Edit and Delete. **Only one row is open at a time:** opening one closes any other, and the opened row scrolls so its top is in view. A live update never closes a row someone has open. Clicking a marker scrolls to and opens its row.
- **Add place**, in this order, because a Google Maps link alone captures an exact name, coordinates and a reusable link:
  1. **Find it on Google Maps.** A search box and a **Find on Google Maps ↗** button (§9.2), plus the shared link box (§4) — **Paste** fills it from the clipboard, and opening the dialog from a tap reads the clipboard once by itself when the box is empty (T42).
  2. **Paste the Google Maps link.** Parsed on paste or input (§9.3); found coordinates fill the location and, if empty, the name, then "✓ Pin found".
  3. **Details:** name (required), category (required), neighborhood, note, website or booking link.
  4. **Other ways to add a location** (collapsed): Search (Nominatim, §9.4) and Place on map (the next map click sets the coordinates).
- `stopKey` is set on save to the nearest route city within 150 km (`stops.js`), or `null` for "Elsewhere".
- Every place has **Set location** / **Edit location** using the same three methods — a pasted link's coordinates aren't always the real pin, so there must always be a way to correct one without deleting the place. A place may be saved with no location; it shows "No map pin" and is left out of the map and exports.
- Each row and popup has **Open in Google Maps ↗** (§9.2), plus Edit and Delete (with confirmation).
- **Which city a place-search link uses (T31):** there's no trip-wide destination any more, so **Find on Google Maps**, its Nominatim search, and **Open in Google Maps ↗** all use the stop chip currently selected above the map — the one city the traveler is looking at. With **All**, **Elsewhere**, or no chip selected yet (no route chosen), they search with no city at all rather than guessing one.
- **Import from My Maps**: when the trip has a shared map link, the dialog's instructions are two steps — "1. **Get KML from our map ↗** (downloads it)", "2. Pick the downloaded file" — and the older ⋮ → Export instructions move into a "Not working?" `<details>`. Otherwise the user exports KML from My Maps (with "Export as KML instead of KMZ" ticked) and picks the file. The dialog shows a per-layer summary, gives each layer a category, skips pins matching an existing place (same name, within 50 m), and adds the rest in one batch, storing the layer name on each place. A KMZ file gets a message explaining the tick box (§9.7).

**Stays**

- A stay belongs to a stop. Stays are grouped under the merged route's stops, with anything unmatched under **No stop yet**. The stop is worked out for you (`stopForStay`, `stops.js`): the stop whose dates contain the stay's check-in (a stop runs up to, not including, its last day); else the nearest stop within 150 km of its pin; else none. It is saved as `stopKey` when a stay is added or edited without a valid one, and re-worked on screen (never written back) when a saved `stopKey` is no longer on the route. A stay added from a stop group keeps that stop. The map's stop chips use the same rule, so a stay's card and its pin always agree. Up to 10 stays per trip. Each has a stable **number** — its position in `createdAt` order — shown as ① ② … on its card and its map pin.
- Status per stay, as two buttons (no dropdown): **Choose** / **Chosen** (in `selectedStayIds`) and **Out** (dimmed, sorted last), 44 px tall like the buttons on Routes. A stay is never both: choosing an Out stay brings it back in, and marking a chosen stay Out unchooses it. Sort: chosen first, then not-Out before Out, then lowest price per night.
- **Night coverage** per stop: one cell per night showing its date, how many travelers sleep in that city that night ("2 of 3", from the merged stop's `nights`), and whether the chosen stays leave it open, cover it (✓) or double-book it (×2). The summary reads "{N} of {N} nights covered", or "All {N} nights covered ✓" once every night has a chosen stay, followed by the chosen total and the per-person share (`coverage.js`).
- **Who's this for?** on each stay card works like the hop control on Routes (§7.6): **Automatic** (the travelers who sleep in the stop on the stay's nights, §11) or a hand-picked set saved as `forTravelerIds`, with **Reset**.
- **Every stop is listed as soon as there is a route** (T48), stays or not: a stop with none shows its dates and nights, an empty coverage bar, its hotel search links, the line "No stays yet for {city}." and **Add stay**. The "No stays yet. Search above, then paste a link to add one." message is only for a trip with no route **and** no stays.
- **Add stay** from a stop pre-fills check-in and check-out with that stop's dates, and guests with the number of travelers. **Duplicate** copies a stay without its price and opens it for editing, for splitting one stay into two.
- The add/edit dialog reads a pasted link for provider, dates, guests and sometimes the name (§9.6), through the same shared link box as the other two dialogs (§4): **Paste** beside it, an auto-read of the clipboard when it opens empty from a tap, and a read-out that never needs a second paste (T42). The price is typed. **Where is it?** is always visible because the map depends on it: **Find "<name>" on the map** (Nominatim), or a Google Maps link (§9.3). Booking, Airbnb and Google Hotels links carry no address and the app must not download the page (§2), so the pin always comes from one of those two actions. The dialog's search links (Nominatim and Find on Google Maps) use the stay's own stop's city (adding from a stop, or editing a stay that already has one) — `null`, searching with no city, when it doesn't have one yet (T31).
- A stay with no location shows "No map pin · Set location" and is left off the map. **Price pins:** each located stay is an `L.marker` with an `L.divIcon` pill showing its number and price — per night rounded to whole units when nights are known ("③ $180"), otherwise the total ("③ $1,260 total"), or just "③" with no price. Build the pill with an element and `textContent`, never an HTML string. Chosen stays get a teal fill. Clicking a pin scrolls to its card and highlights it.
- **Hotel search links** (Google Hotels, Booking.com, Airbnb) sit inside each stop's group, using that stop's own city and dates (§9.1) — there's no trip-wide destination any more, and a stop's own city is more accurate than one city for the whole trip (T31). Hidden for stays with **No stop yet** and before a route is chosen, where no city is known.

### 7.8 Days tab

- **A horizontal day chooser** across the top: one 58 px square chip per day (weekday label over the date number; an undated day reads "Day 4"). **Each chip shows how planned it is (T72):** a small count badge in its corner with the number of places on that day, or, with none, a `--sun` dot (the marking color, like a stale price) — so an empty day stands out in a long row. A day with a note shows a tiny `edit` icon under the number. Under the chooser one line reads "{N} days with nothing planned" with **Next empty ›**, which selects the next empty day after the selected one (wrapping round) and scrolls its chip into view; with none it reads "Every day has something planned" and no button. A date of the route with no day yet is a dashed chip that creates that day when tapped, with the same logic as **Add day**. **Create days from route** stays as a button while no days exist at all.
- **Create days from route** makes one day per date of the merged route, titled with that date's city; a travel day belongs to the city you arrive in, and dates that already have a day are skipped (`dayplan.js`). Before anyone has chosen an option, the same button reads **Create days from trip dates**. **Add day** makes an undated day. Days are sorted by `order`.
- Selecting a day shows that city's places on the map as pins numbered and colored by day. Tapping a pin offers the days to put the place on, or **Remove from day** when it's already on one.
- **Home base (T39, T50):** a dated day inside a chosen, located stay's nights (`stayForDate`, `dayplan.js`; a departure day still counts, since you slept there the night before, but tonight's bed wins when both match) shows that stay on the map with the stay pill style plus a house mark, popup naming it. A stay more than ~50km from the day's own city is ignored, so a travel day's home base is never the previous city's hotel. Undated days never show one.
- Below the map, the selected day's header is the page's one `h1`, "{Weekday} · {city}" — the date alone with no title, the title alone when undated, "Undated day" when it has neither — with "Focus · N places" under it and **Walk it** (secondary, `routes` icon) beside it. **The day's note** (`days.notes`) shows under that line, one paragraph per line, links read like place notes (`splitLinks`, §9.7) — for planning reminders like "Rain likely" or "Concert maybe tonight". Tapping it, or **+ Add note** when there is none, opens the Edit day sheet with the Notes box focused (T72). **Edit day** and **Delete day** are in the header's ⋯. Deleting a day returns its places to the pool.
- **The day's places are a numbered timeline** (`dayTimeline.js`): per row a number circle, the category icon tile, the name, "Category · neighborhood" and the vote count, with a 2.5 px dotted connector between rows. **Move up**, **Move down** and **Remove from day** are in each row's ⋯, keeping their `aria-label`s. No drag-and-drop.
- The **not planned** pool — the selected day's city's places with no `dayId`, Loved first — is behind a dashed **+ Add from not planned · N** button that opens a sheet of those rows, each with its own **Add**.
- **Walk it** builds Google Maps directions through the day's located places in order; with a home base (T39, above), the route starts and ends at the stay instead of the first and last place (§9.2).
- **Export** (§10) is one `download` icon button in the top bar on this tab, opening a sheet with **Take it to Google Maps** (the day-by-day map file), the plain places CSV and KML, how many places have no pin and will be left out, a link to the help page's import steps, and **Open our shared map ↗** when the trip has a My Maps link (§9.10).

### 7.9 Price control (flights and stays)

Prices are a snapshot: a Google Flights link carries the price Google showed when it was copied. The app never fetches a price.

- **The price is a chip** (T45): the amount, a refresh glyph and the word **Check**, 44px tall so it reads as a control rather than plain text. Under it sits an age line — **Checked today** / **Checked 3 days ago** — that switches to **Check price** with a sun-colored dot once the price is older than 3 days. For stays, the per-night price shows beneath the total. Then one line with the change from the previous check ("▲ $38 higher", "▼ $12 lower", "No change") and when it was checked, with who and the exact time as a `title` tooltip; a **New low** pill when the latest amount beats every earlier one; and a small sparkline once there are 2 or more entries. With no price yet, the chip reads **+ Add price**.
- Tapping the chip opens the saved link in a new tab and reveals one row: "Opened the link in a new tab. Is it still $64?" with **Same** and **Changed** as full-width buttons. **Same** logs a new entry at the same amount; **Changed** shows a number field (focused automatically) and **Save price**. With no link saved, nothing opens but the question is still asked. After a check, the movement is shown in words and color.
- Amounts accept "$1,234.56", "1234.56", "1234" and "1234.5"; anything that isn't a positive amount gets an inline error.
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
- Walking route for a day: `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=<lat,lng>&destination=<lat,lng>&waypoints=<lat,lng>|<lat,lng>…` using the first located place as origin and the last as destination, or (T39) the day's home base stay as both origin and destination with every located place as a waypoint, when there is one. At most 8 waypoints per link; more than 10 points splits into consecutive links ("Route part 1", "Route part 2"…), each starting where the previous ended. Encode `|` as `%7C`.

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
- **Notes from My Maps** (`notes.js`). A My Maps description arrives as HTML with one `Label: value` per line separated by `<br>`; which labels appear depends entirely on how the user built their map, so nothing assumes particular labels. `cleanNoteText(text)` turns `<br>` (any spelling) and `</p>`/`</div>` into line breaks, drops every other tag, decodes entities and trims each line; the importer stores notes through it, and the place Edit dialog fills its Note box through it. `formatNote(text)` reads a cleaned or uncleaned note into blocks: a line shaped `Label: value` (a label of 1–40 characters with no `/`, and not `http`/`https`) is a **field**, its value split into separate lines at ` | `; any other line is **text**. Every field and line is shown — the app hides nothing; trimming the data is up to the user, in My Maps. On a place row a note that is only text looks as it always did; one with fields shows them as a label/value list. Any `http(s)` URL in a value or line is a link (through `safeUrl`, §9.5) that reads as its host name without `www.` followed by the external icon. Nothing in a note is ever inserted as HTML.

### 9.8 Airports (`airports.json`, `airports.js`)

`js/data/airports.json` maps IATA code → `[city, country, lat, lng]` for airports with scheduled service (source: OurAirports, public domain). `js/lookup.js` fetches it once, on demand, and `createAirportIndex` exposes `info(code)`, `cityName(code)` and `cityKey(code)` ("Rome, IT" — FCO and CIA share a key, so a flight from one and back to the other is still a round trip). An unknown code falls back to the code itself.

### 9.10 Reading Google My Maps links (`mymaps.js`)

`parseMyMapsUrl(text)` returns `{ mid, url, viewUrl, kmlUrl }`, or `null` when the text isn't a My Maps link. `url` is the pasted link after `safeUrl()` (§9.5). Accepts `https://www.google.com/maps/d/<anything>?mid=<id>…` and `https://google.com/maps/d/…`, including `/u/0/edit`, `/viewer` and `/embed` — any path under `/maps/d/`, any other query parameters (`usp=sharing`, `ll=…`) ignored. `mid` must match `[A-Za-z0-9_-]{10,}`; missing or too short returns `null`, as does a plain Google Maps place link (no `/maps/d/` path) or anything that fails `safeUrl`.

`viewUrl` is `https://www.google.com/maps/d/viewer?mid=<mid>`. `kmlUrl` is `https://www.google.com/maps/d/kml?mid=<mid>&forcekml=1` — downloads the whole map as KML, which `kmlimport.js` (§9.7) reads.

`isShortMapsLink(text)` is `true` for `maps.app.goo.gl/…` and `goo.gl/maps/…`: these can't be read without fetching the page (§2), so the field asks the user to open the link and paste the full address instead. The app never fetches a My Maps link itself — only the existing KML importer, from a file the user downloaded by hand.

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
- **Price age and staleness:** whole days since the latest check. No price at all, or an age over 3 days, counts as stale (the sun dot).
- **Nights:** whole days between two dates computed in UTC, and only when both exist and the second is later. Otherwise show "Dates needed".
- **Per night:** the latest stay total divided by nights, rounded to the nearest cent for display only. Never stored.
- **Equal split** `split(amountCents, n)`: `base = floor(amount / n)` and `remainder = amount − base × n`. The first `remainder` travelers (in `travelers` array order) get `base + 1`, the rest get `base`. The shares always add up exactly to the amount.
- **Night coverage:** one cell per night of a stop; a night is covered when exactly one chosen stay spans it, double-booked when two or more do, open when none does.
- **A traveler's choice** (`choiceFor(trip, travelerId, options)`): their `choices` entry, or — when they have none — the retired `chosenOptionId` and that option's idea (§5.3). Returns `{ ideaId, optionId }`, either of which may be null. Someone who has chosen an option but no idea reads as being on that option's own idea: it's the only idea their home flights could come from.
- **Living in the idea's city** (`isLocalToIdea({ traveler, trip, ideaId, flights, airports })`, and `localIdeaInfo` for the same answer with its reason): true when the idea's arrival city — `ideaEndpoints` over *anyone's* home flights on that idea, by `airports.cityKey` — is the city of the traveler's `homeAirport`, or when the idea is in their `localIdeaIds` (§5.3). Nothing is stored: the match is worked out on every render. `localRoute(...)` turns that into the endpoints standing in for their flights — the idea's arrival city, from the earliest the *others* on that idea land to the latest they leave, falling back to `trip.startDate` / `trip.endDate`, and to their own home airport for the city when no flight on the idea says where it goes. A local traveler's home flights count $0, are never "missing", and give them stops even with no option chosen (§7.6).
- **Who an item is for** (`forTravelers(item, kind, ctx)`): a non-null `forTravelerIds` wins, narrowed to travelers who still exist. Otherwise it is worked out:

  | Item | Travelers | How the price is split |
  |---|---|---|
  | Home flight | the traveler it belongs to | its price only — the price is per person |
  | Hop | everyone whose chosen option is its option | the full price to each — the price is per person |
  | Stay | everyone sleeping on any of its nights, read from their own stops | the total split equally |
  | Split cost | everyone | split equally |

  A stay nobody is present for — including one with no dates, and any stay before anyone has stops — is for everyone, so a price is never left unpaid.
- **A traveler's total** (`travelerBreakdown`): their picked home flights under *their* chosen idea, plus every hop they're for, plus their share of each chosen stay and each split cost, each split separately. Returns `{ homeCents, hopCents, stayCents, costCents, totalCents, complete, missing }`. For a traveler local to their chosen idea, `homeCents` is 0 and no home flight is ever listed as missing — including one they saved before they were local, which stays in Firestore, uncounted.
- **Everyone together:** the sum of traveler totals.
- **Complete:** every traveler who needs a flight from home has at least one picked, every counted flight has a price, and every chosen stay has a price (choosing no stay is fine). Otherwise it's a **Total so far (missing some prices)** with a list of what's missing. Missing amounts count as 0 in the sum, but they are listed and the total is never labeled complete.
- **Merged stops** (`mergeStops`): one route for the whole group, built from each traveler's own stops — their chosen idea's picked home flights and their chosen option's hops, through `stopsFor`. A traveler with no chosen option adds nothing, unless they live in their chosen idea's city, where `localRoute`'s endpoints give them stops anyway. Two visits to the same city become **one stop only while their dates overlap or touch** — several travelers in the city at once, or one arriving the day another leaves. A city the trip comes back to later is a **second stop with its own dates**, so the city you fly into ends at your first hop: on a trip that lands in Lisbon on 1 Oct, hops to Porto on the 2nd, flies back to Lisbon on the 14th and home on the 15th, the stops are Lisbon 1–2 Oct (one night), Porto 2–14 Oct, Lisbon 14–15 Oct (one night) — not one Lisbon stop across the whole trip.
  - Each stop carries a `stopKey`: a city's first visit keeps the plain `cityKey`, later visits are `cityKey#2`, `cityKey#3`, in route order. Stays saved against the first visit therefore keep matching, and `cityKey` stays the same on every visit (`cityKeyOf(stopKey)` reads it back).
  - Within a stop, `from` is the earliest and `to` the latest, with `nights: [{ date, travelerIds }]` saying who sleeps there each night and `travelerIds` for the stop as a whole. Stops are in order of first arrival, undated last; an undated visit joins its city's first stop, or makes one of its own when the city has no dated visit.
  - Stays groups (§7.7), the night coverage bars and Days creation (§7.8) read one stop per visit. The map's **stop chips stay one per city** (§7.7): a stay on a return visit filters under that city like any other.
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
| 4.1 | 2026-10-12 | **Round 5, owner testing (T32–T40).** Google sign-in works on phones; the currency field is gone (every trip is USD) and traveler details always save; pasting a flight is scoped to the button you press, so there's no guessing where it lands (§7.6). **Every traveler now chooses their own idea and their own option, as two separate choices** (`trips.choices`, §5.3): one person's choice never moves another's, and `chosenOptionId` is retired to a read-only fallback so older trips keep the choice they had. Flights, stays and costs carry `forTravelerIds`, which says who the price is for — worked out automatically and overridable (§5.4, §11). Map, Stays and Days read one merged route built from everyone's choices rather than a single traveler's (§7.7, §7.8, §11), and the stage badge counts the trip as planned once anyone has chosen an option. New `js/lib/choices.js` holds the choices, the splits, the merged stops and the budget, which moved out of `totals.js`. On **Routes**, **Choose idea** sits beside Rename and Delete, an option card prices only its own flights ("per person") and names who they're for, and a summary pinned to the bottom adds up the traveler on screen (§7.6). **Overview**'s budget became one openable row per traveler — flights from home, option flights, stays, split costs — above "Everyone together" (§7.5). **Stays** group under the merged stops and find their own stop from their dates or their pin, with **Choose** / **Out** as two buttons (§7.7). A day on **Days** shows its chosen stay as a house pin and starts and ends its walking route there (§7.8, §9.2). The **Check prices** sweep over stale prices is gone (T36): a price is still checked by tapping it, and the sun dot is all staleness does now (§7.9, §11). Help, `docs/tasks/WORDING.md` and this file were brought back in line with the code in T40. |
| 4.2 | 2026-10-12 | **Round 6, the phone pass (T41–T53).** The app behaves like a phone app: fields never zoom the page (16 px everywhere, pinch zoom still on), date fields match the others, the top bar keeps "Trip Planner" with the trip name on its own line and a round **?** Help button, and every screen was gone through at 375 px — Trips, Overview and Routes (T51), Map and Days (T52) — fixing overflow at the cause, mobile-first, with dialogs as bottom sheets (§3.2, §4). One shared link box now serves the flight, stay and place dialogs: it reads the clipboard once when it opens empty and re-reads on paste, typing or its **Paste** button, so a link never needs pasting twice (§4, §7.6, §7.7). Travelers are cards on Overview with one **Edit** sheet and one **Save** (§7.5). On **Routes**, **+ Idea** works, and on phones the total is a slim one-line bar with **Details** (§7.6). The price is a **chip** — amount, ↻, **Check** — with its age under it and **+ Add price** when there's none (§7.9). **"I live here — no flight needed"** (`choices.<travelerId>.localIdeaIds`): a traveler whose home airport is the idea's arrival city needs no flight from home, counts $0 and is never "missing", and anyone can tick it by hand (§5.3, §7.6, §11). Night math fixed: two visits to a city merge **only while their dates overlap or touch**, so the city you fly into ends at your first hop and a return is a second stop with its own `stopKey` (§11). **Stays** lists every stop as soon as there's a route, before any stay exists (§7.7). Places became compact rows that open for the rest, and the event fields and their filter are retired (§5.4, §7.7). Day headers read "{city} · {Day, Mon D}", and a day's home base and walking route only ever use a stay in that day's own city (§7.8). Help, `docs/tasks/WORDING.md`, `README.md` and this file were brought back in line with the code in T53. |
| 4.3 | 2026-10-16 | **Round 7, "Waypoint" (T54–T66).** `docs/R7.md` folded in and retired; `docs/mock/routes-mock.html` is no longer the token source. A new look: forest green on warm paper, with marigold reserved for marking things, **six font sizes and no others**, Gabarito and Figtree (JetBrains Mono dropped — prices use tabular figures in the body font), 18 px cards with a border and no shadow, and the aliases `--teal`/`--sun` kept pointing at the new tokens (§4). New logo, app icon, favicon, home-screen icons and a topographic texture, all ready-made in `docs/brand/` (§3.3, §4). **One icon set and no emoji** (`js/lib/icons.js` + `icon()` in `ui.js`): votes, the Days home base and the external-link "↗" are all icons now (§4). Shared pieces were redrawn once — buttons, cards, rows, chips, badges, the segmented control, dialogs and empty states — with **a card never inside a card** (§4). **Delete and Edit moved into ⋯ menus** (`menuButton()`), so `.btn-danger` is only used inside a confirmation (§4). **The per-tab trip-name heading and stage pill are gone**: the trip name, dates and stage live in the top bar, and the stage chip on the Overview summary card (§4, §7.5). New feature: **the trip's shared Google My Maps link** (`trips.myMapsUrl`, `js/lib/mymaps.js`) on Overview, in a shared map bar on Map that makes importing two taps, and in the Days export sheet (§5.3, §7.5, §7.7, §7.8, §9.10). Every screen was reshaped: the trips list as readable cards (§7.2), Overview as a route-ribbon summary card with settings behind a tap (§7.5), Routes as two-column flight cards with switches that scroll (§7.6), Map with filters in a sheet and a sticky map (§7.7), Days with a day chooser and a numbered timeline (§7.8), plus sign-in, help and 404 (§3.2, §7.1). |
| 4.5 | 2026-10-21 | **Round 11, owner testing (T71–T72).** Map on phones: the map shows above the list when the phone is upright and fits the screen when it's sideways; vote Love/Like/Pass straight from a place row, names wrap instead of being cut off, and only one row is open at a time (§7.7). Days: the day's note shows under its header with **+ Add note**, and the day chooser marks how many places each day has, flags empty days, and offers **Next empty ›** (§7.8). |
| 4.4 | 2026-10-18 | **Round 9, owner testing (T68–T69).** New category list — 13 categories in the owner's order, keeping Day Trips, with colors carried over by meaning and two new ones, and every category its own icon (§4); older labels are relabelled by the owner by hand and survive an unchanged Edit (§4, §5.4). Notes imported from My Maps are cleaned on import and shown as a label/value list with short links, with no assumptions about which labels a map has (§7.7, §9.7). |
