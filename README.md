# Trip Planner: owner's guide

A free, private website where you and a handful of friends plan trips together. You paste the Google Flights links you've found and the app works out where you'd sleep and for how many nights; you pin places and stays on a shared map, keep an eye on prices you've checked yourself, plan your days, and take the whole plan to Google Maps on your phone.

**The app lives at https://trip-planner-mattchurchman.web.app** — that's the link you send to friends, and the one to add to your phone's home screen.

This guide is for you, the owner. The coding model reads the other files:

| File | Who it's for | What it is |
|---|---|---|
| `README.md` | You | Setup, everyday use, troubleshooting |
| `AGENTS.md` | Every coding model | The working rules it must follow (`CLAUDE.md` and `GEMINI.md` just point at it) |
| `SPEC.md` | The coding model (and you) | Exactly what the app does and how data is stored |
| `docs/tasks/README.md` | You and the model | The task board: what's next, which model to use, the one line that starts it |
| `PHASES.md`, `docs/V4.md` | History | The original build steps and the round-3 design, both now folded into `SPEC.md` |

All the instructions live inside the repository, so any capable coding model can pick up the work. You don't need to paste long prompts. Each session starts with one sentence.

---

## 1. Where to build it

**Recommended: Claude Code, connected to your GitHub repository.** You can use it at claude.ai/code in a browser or in the Claude desktop app.

- It reads the spec and rules straight from your repo, writes the files, runs the tests, and pushes the code to GitHub for you.
- Each phase is a fresh session, which is exactly what smaller models need: a clean slate plus clear written instructions.
- You never copy code by hand. Copying code by hand is where non-developers usually get stuck.
- Claude Code comes with paid Claude plans. If your plan doesn't include it, see the alternatives below.

**Use a Claude Project for planning, not building.** A Project with `SPEC.md` uploaded is a good place to ask questions ("how would adding a packing list change the spec?") or to draft spec changes. Building in a Project means copying every file into GitHub by hand, which is slow and error-prone, so don't build there.

**Alternatives if Claude Code isn't available to you.** Because everything is in the repo, any AI coding tool that works inside a GitHub repository can follow the same files. Tell it: "Read AGENTS.md, then do task TNN from docs/tasks/README.md."

**Which model to use:**

Each task on the board names its own model and effort level — use what it says. Roughly: a mid-tier model such as Sonnet for ordinary tasks, a small fast one such as Haiku for wording and small fixes, and a top-tier one such as Opus for route logic, reviews, or anything that has already failed twice. `docs/MODEL_TIERS.md` has the equivalents for models from other vendors.

---

## 2. Setup (already done — here for reference, or to rebuild from scratch)

Screens may be labeled slightly differently than written here. Look for the closest match.

### A. GitHub repository

1. On github.com, click **+ → New repository**. Name it `trip-planner` and don't add any files. Click **Create repository**.
   - Only the code is public; your trip data lives in Firebase and is protected by the rules in step C.
2. On the empty repo page, click **uploading an existing file**. Drag in `README.md`, `AGENTS.md` and `SPEC.md`, then click **Commit changes**.

### B. Firebase (the free database, sign-in and hosting)

1. Go to console.firebase.google.com, sign in with your Google account, and click **Create a project**. Name it `trip-planner`. Turn **Google Analytics off**. Click **Create**.
   - New projects are on the free **Spark** plan. **Never click "Upgrade" or choose "Blaze."** Nothing in this app needs it.
2. **Build → Authentication → Get started → Sign-in method.** Enable **Google** (pick your email as the support email) and **Email/Password**. Click **Save**.
3. **Build → Firestore Database → Create database.** If asked, choose **Standard** edition. Pick a location near you (it can't be changed later) and **Start in production mode**.
4. **Build → Hosting → Get started**, and accept the default site. That's what gives you `https://trip-planner-mattchurchman.web.app`.
5. Add everyone who may use the app, including yourself. In Firestore → **Data**, click **Start collection** and set the collection ID to `allowlist`. For each person:
   - **Document ID:** their email in lowercase, for example `sam.jones@gmail.com`.
   - Add a field: name `name`, type string, value `Sam`.
   - Use **Add document** for each additional person.
6. Click the **gear icon → Project settings → Your apps → Web (`</>`)**. Give the app any nickname and **do** tick Firebase Hosting. Click **Register app**. You'll see a block that starts with `const firebaseConfig = {`; its values belong in `js/firebase-config.js`, where `authDomain` must be the app's own `web.app` address — that's what makes sign-in stick on an iPhone.
7. **Authentication → Settings → Authorized domains → Add domain.** Enter `trip-planner-mattchurchman.web.app`.

### C. Turn on the security rules

1. On GitHub, open the new `firestore.rules` file and click the **copy** icon.
2. In Firebase → **Firestore Database → Rules**, replace everything with what you copied, then click **Publish**.

Production mode starts fully locked, so until you publish these rules the app shows "You don't have access" to everyone. **Don't skip this step**, and never switch the rules to "test mode," which would open your data to anyone.

### D. Turn on the website

1. In Firebase → **Project settings → Service accounts**, generate a new private key. Keep the downloaded JSON file private and out of the repository.
2. In GitHub → **Settings → Secrets and variables → Actions**, add `FIREBASE_SERVICE_ACCOUNT` with the complete JSON file contents and `FIREBASE_PROJECT_ID` with `trip-planner-mattchurchman`.
3. Every push to `master` runs the tests and, when they pass, deploys the site automatically. After a minute or two, open `https://trip-planner-mattchurchman.web.app`. This is the link you send to friends.

### E. Check it

Open the live site, sign in, make a trip and add a traveler. If that works, you're set up.

---

## 3. Improving the app

The app is built and in use. Improvements now live as small task files in `docs/tasks/`. Open `docs/tasks/README.md` for the board: what's next, which model and effort to pick, and the one line that starts it.

The loop for each task:

1. **Start a new Claude Code session** on the repo (or `/clear` the one you have). A fresh session per task keeps the model focused.
2. Select the model and effort the board names for that task.
3. Send the board's one-liner, for example: **"Read AGENTS.md, then do task T31. Model: Sonnet. Effort: medium. You may push to master when tests pass."**
4. When it finishes, wait 1–2 minutes for the deployment, then reload the site.
5. Go through that task's **Owner check** list.
6. If something fails, stay in the same session and describe exactly what you did and what you saw. For errors, open the browser console (Chrome on Mac: ⌥⌘J, Windows: Ctrl+Shift+J) and paste the red text.
7. Move on only when the whole checklist passes.

A few habits that keep this working:

- **One task per session.** Don't ask for extra features in the middle of one.
- **Change the design before the code.** If you want something new, ask: "Write this as a task file, don't build it yet." Review it, then start it as its own session.
- **If a task goes badly,** ask: "Revert the last commit." Then try again in a fresh session on the model its **If it fails twice** line names.
- **If a task asks you to re-publish `firestore.rules`,** repeat step C.

---

## 4. Everyday use

**The address:** https://trip-planner-mattchurchman.web.app

**On your phone:** open that address in Safari (iPhone) or Chrome (Android), then **Share → Add to Home Screen**. It opens like an app, and signing in sticks.

**Adding a friend:**

1. In Firebase → **Firestore Database → Data**, open the `allowlist` collection and click **Add document**.
2. **Document ID:** their email, all lowercase, no spaces (any email works now, not just Google ones).
3. Add one field: name `name`, type string, value their first name.
4. Send them the address. They can sign in with Google, or create an account with that email and a password — a brand-new password account gets one confirmation email first.

**Removing someone:** delete their `allowlist` document. They lose access the next time the app loads.

**Your trip workflow in the app:**

1. **Overview:** name the trip, set the rough dates, add everyone and their home airport.
2. **Routes:** on Google Flights, pick the actual flights you'd book, copy the whole address from the browser bar, then tap **Paste flight link**. The app files it under an idea ("Rome round trip") and works out the stops and nights by itself. Add hop flights the same way to build options like "Florence + Barcelona", then **Choose idea** and **Choose this option** — each traveler chooses for themselves, and everything else follows from everyone's choices together.
3. **Prices:** tap any price to open the link you saved and answer "Still $64?" — **Same** or **Changed**. A sun-colored dot means nobody has checked it in over 3 days.
4. **Map:** pin places (paste a full Google Maps link from the address bar, or import a Google My Maps layer as KML) and add stays per stop. Give places **Love / Like / Pass**. The night bar under each stop shows which nights your chosen stays cover.
5. **Days:** **Create days from route** makes one day per date, then tap pins on the map to put places on days. **Open walking route** sends a day to Google Maps.
6. **Take it with you:** on Days, tap **Take it to Google Maps** to download the plan, import it into Google My Maps, and open that map in the Google Maps app during the trip. `help.html` (the **Help** link in the top bar) has the step-by-step for friends.

**Photos:** use a shared Google Photos album (works for everyone with a Google account) or an iCloud shared album (best if everyone has an iPhone). Paste the album link on Overview. Photos stay there; the app only stores links, which keeps it free.

---

## 5. Staying free

- Firebase must stay on the **Spark** plan. If Firebase ever asks you to upgrade, say no. The app is built to never need it.
- Firebase Hosting is included on Firebase's free Spark plan for this small app.
- The map (OpenStreetMap) and place search (Nominatim) need no keys or accounts.
- Firestore's free daily limits are far above what a handful of friends will use. You can check usage under **Firestore → Usage**.

---

## 6. Troubleshooting

| What you see | Likely fix |
|---|---|
| "unauthorized-domain" when signing in | In Firebase → Authentication → Settings → Authorized domains, add `trip-planner-mattchurchman.web.app` |
| The sign-in popup doesn't appear | Allow popups for your site in the browser. On a phone the app uses a redirect instead, not a popup |
| Signing in on an iPhone keeps logging you out | Make sure you opened the `web.app` address, not an older one. Sign-in only sticks on the app's own domain |
| "Check your email, then tap Continue" won't clear | Open the confirmation email on the same device first, then tap Continue. It's only ever needed once per password account |
| "isn't on the trip list yet" for someone you added | The allowlist document ID must be their exact email, all lowercase, with no spaces |
| Everything says "You don't have access" | The rules weren't published. Redo step C |
| The site shows a 404 page | Wait a few minutes after the first deployment, then check the latest GitHub Actions run |
| Your latest changes don't show | Wait 1–2 minutes for the GitHub Actions deployment, then reload |
| A pasted flight link says it can't be read | You copied the **Share** link. Open it, then copy the whole address out of the browser's address bar instead |
| "This looks like a KMZ file" when importing places | In My Maps, use ⋮ → Export to KML/KMZ and tick "Export as KML instead of KMZ" |
| Overview says "Not chosen yet" for someone who did choose | Choosing is per traveler. On Routes, pick that person's name at the top first — the Choose buttons only ever set the traveler on screen |
| The Map's city chips say to choose an option on Routes | Nobody has chosen an option yet, so there's no route to group by. Until then the chips list every city across every option |
| A stay sits under "No stop yet" | Its check-in falls outside every city's dates and its pin isn't near one. Fix the dates or set its location and it moves itself |
| A total says "at least" | Something counted in it has no price. The budget card on Overview lists exactly what's missing — a missing price is never counted as $0 |
| Routes shows a warning on a stop | It's telling you the flights don't line up — for example the next one leaves from a different city. Fix the flight, or ignore it if you know why |
| The map is blank | Open the browser console, copy the red error, and give it to the model |

---

## 7. What the app deliberately doesn't do

It doesn't fetch live flight or hotel prices, because no free, legitimate source exists anymore — every price in the app is one a person checked and saved. It also doesn't book anything, host photos, or sync live with Google My Maps. You find options on Google Flights, Google Hotels, Booking.com and Airbnb, and the app is where the group collects, compares and decides.
