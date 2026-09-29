# Trip Planner: owner's guide

A free, private website where you and a handful of friends plan trips together. You explore destinations, pin food, neighborhoods, tours, events and adventures on a shared map, compare flights and stays with prices you've checked, sketch loose day plans, export everything to Google My Maps, and afterward share a recap.

This guide is for you, the owner. The building model reads the other three files:

| File | Who it's for | What it is |
|---|---|---|
| `README.md` | You | Setup, how to run each build phase, troubleshooting |
| `CLAUDE.md` | The building model | Working rules it must follow |
| `SPEC.md` | The building model (and you) | Exactly what the app does and how data is stored |
| `PHASES.md` | The building model (and you) | Seven small build steps, each with a checklist you click through |

All the instructions live inside the repository, so any capable coding model can pick up the work. You don't need to paste long prompts. Each session starts with one sentence.

---

## 1. Where to build it

**Recommended: Claude Code, connected to your GitHub repository.** You can use it at claude.ai/code in a browser or in the Claude desktop app.

- It reads the spec and rules straight from your repo, writes the files, runs the tests, and pushes the code to GitHub for you.
- Each phase is a fresh session, which is exactly what smaller models need: a clean slate plus clear written instructions.
- You never copy code by hand. Copying code by hand is where non-developers usually get stuck.
- Claude Code comes with paid Claude plans. If your plan doesn't include it, see the alternatives below.

**Use a Claude Project for planning, not building.** A Project with `SPEC.md` uploaded is a good place to ask questions ("how would adding a packing list change the spec?") or to draft spec changes. Building in a Project means copying every file into GitHub by hand, which is slow and error-prone, so don't build there.

**Alternatives if Claude Code isn't available to you.** Because everything is in the repo, any AI coding tool that works inside a GitHub repository can follow the same files. Tell it: "Read CLAUDE.md, then build Phase N from PHASES.md."

**Which model to use:**

| Work | Model |
|---|---|
| Phases 0–6 | A mid-tier model such as Sonnet. The phases are sized for it |
| Small fixes ("the button label is wrong") | A small, fast model such as Haiku |
| Phase 7 review, or a phase that fails twice | A top-tier model such as Opus |

---

## 2. One-time setup (about 45 minutes)

Screens may be labeled slightly differently than written here. Look for the closest match.

### A. GitHub repository

1. On github.com, click **+ → New repository**. Name it `trip-planner`, set it to **Public**, and don't add any files. Click **Create repository**.
   - It must be public for GitHub Pages to be free. Only the code is public; your trip data lives in Firebase and is protected.
2. On the empty repo page, click **uploading an existing file**. Drag in `README.md`, `CLAUDE.md`, `SPEC.md` and `PHASES.md`, then click **Commit changes**.

### B. Firebase (the free database and sign-in)

1. Go to console.firebase.google.com, sign in with your Google account, and click **Create a project**. Name it `trip-planner`. Turn **Google Analytics off**. Click **Create**.
   - New projects are on the free **Spark** plan. **Never click "Upgrade" or choose "Blaze."** Nothing in this app needs it.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Pick your email as the support email, then click **Save**.
3. **Build → Firestore Database → Create database.** If asked, choose **Standard** edition. Pick a location near you (it can't be changed later) and **Start in production mode**.
4. Add everyone who may use the app, including yourself. In Firestore → **Data**, click **Start collection** and set the collection ID to `allowlist`. For each person:
   - **Document ID:** their Google email in lowercase, for example `sam.jones@gmail.com`.
   - Add a field: name `name`, type string, value `Sam`.
   - Use **Add document** for each additional person.
5. Click the **gear icon → Project settings → Your apps → Web (`</>`)**. Give the app any nickname and **don't** tick Firebase Hosting. Click **Register app**. You'll see a block that starts with `const firebaseConfig = {`. Copy that whole block and keep it handy for Phase 0.
6. **Authentication → Settings → Authorized domains → Add domain.** Enter `<your-github-username>.github.io`, for example `alexr.github.io`.

### C. Build Phase 0

1. Open Claude Code and connect it to your `trip-planner` repository.
2. Send:

   > Read CLAUDE.md, then build Phase 0 from PHASES.md. You may push to master when tests pass. Here is my Firebase config: *(paste the firebaseConfig block)*

3. Wait for it to finish. It will list what it built and give you an **Owner check** list.

### D. Turn on the security rules

1. On GitHub, open the new `firestore.rules` file and click the **copy** icon.
2. In Firebase → **Firestore Database → Rules**, replace everything with what you copied, then click **Publish**.

Production mode starts fully locked, so until you publish these rules the app shows "You don't have access" to everyone. **Don't skip this step**, and never switch the rules to "test mode," which would open your data to anyone.

### E. Turn on the website

1. In your GitHub repo, go to **Settings → Pages**. Under **Build and deployment**, set the source to **Deploy from a branch**, the branch to `master`, and the folder to `/ (root)`. Click **Save**.
2. After a minute or two, the page shows your site address: `https://<your-github-username>.github.io/trip-planner/`. This is the link you send to friends.

### F. Check Phase 0

Go through the **Owner check** list for Phase 0 in `PHASES.md` on the live site. If everything passes, you're set up.

---

## 3. Improving the app (current)

The original phases are all built. Improvements now live as small task files in `docs/tasks/`. Open `docs/tasks/README.md` for the list, which model to use for each, and the one-line message that starts a task. The loop is the same as below: fresh session, one task, click through its Owner check, move on.

## 3b. Building each remaining phase (history)

For phases 1 through 6 (and optionally 7), the loop is:

1. **Start a new Claude Code session** on the repo. Starting fresh each phase keeps smaller models focused.
2. Send: **"Read CLAUDE.md, then build Phase N from PHASES.md. You may push to master when tests pass."**
3. When it finishes, wait 1–2 minutes for GitHub Pages to update, then hard-refresh the site (Mac: ⌘⇧R, Windows: Ctrl+Shift+R).
4. Go through that phase's **Owner check** list, with a friend where the list says so.
5. If something fails, stay in the same session and describe exactly what you did and what you saw. For errors, open the browser console (Chrome on Mac: ⌥⌘J, Windows: Ctrl+Shift+J) and paste the red text.
6. Move on only when the whole checklist passes.

A few habits that keep this working:

- **One phase per session.** Don't ask for extra features in the middle of a phase.
- **Change the spec before the code.** If you want something new, ask in a session: "Update SPEC.md and PHASES.md to add X. Don't build it yet." Review the change, then build it as its own step.
- **If a phase goes badly,** ask: "Revert the last commit." Then try again in a fresh session, possibly with a stronger model.
- **If a phase asks you to re-publish `firestore.rules`,** repeat step D.

---

## 4. Everyday use

**Adding a friend:** add their lowercase Google email to the `allowlist` collection in Firebase (step B4), then send them the site link. **Removing someone:** delete their `allowlist` document.

**Your trip workflow in the app:**

1. **Overview:** add candidate destinations you found on Google Flights Explore, rank them (Must / Nice / Skip), and choose one.
2. **Places:** pin food, neighborhoods, tours, museums, events, adventures and day trips. The easiest way is to paste a full Google Maps link from the browser address bar. Rank them.
3. **Flights & stays:** each person adds flight options, and the group adds stays from Booking, Airbnb or Google Hotels. Log prices you've checked yourself, choose, and read the totals.
4. **Days:** group places into loose days and open them as walking routes.
5. **Export:** download the CSV and import it into Google My Maps for use on your phones during the trip.
6. **Recap** (after the trip): link your shared photo album, react to places, and publish a recap page if you want.

**Photos:** use a shared Google Photos album (works for everyone with a Google account) or an iCloud shared album (best if everyone has an iPhone). Photos stay there; the app only stores links, which keeps it free.

---

## 5. Staying free

- Firebase must stay on the **Spark** plan. If Firebase ever asks you to upgrade, say no. The app is built to never need it.
- GitHub Pages is free for public repositories.
- The map (OpenStreetMap) and place search (Nominatim) need no keys or accounts.
- Firestore's free daily limits are far above what a handful of friends will use. You can check usage under **Firestore → Usage**.

---

## 6. Troubleshooting

| What you see | Likely fix |
|---|---|
| "unauthorized-domain" when signing in | Step B6: add `<username>.github.io` to Authorized domains |
| The sign-in popup doesn't appear | Allow popups for your site in the browser |
| "isn't on the trip list yet" for someone you added | The allowlist document ID must be their exact Google email, all lowercase, with no spaces |
| Everything says "You don't have access" | The rules weren't published. Redo step D |
| The site shows a 404 page | Pages isn't turned on (step E), or wait a few minutes after the first push |
| Your latest changes don't show | Wait 1–2 minutes, then hard-refresh |
| The map is blank | Open the browser console, copy the red error, and give it to the model |

---

## 7. What the app deliberately doesn't do

It doesn't fetch live flight or hotel prices, because no free, legitimate source exists anymore. It also doesn't book anything, host photos, or sync live with Google My Maps. You find options on Google Flights, Google Hotels, Booking.com and Airbnb, and the app is where the group collects, compares and decides. The app's Discover links take you to those sites with your details prefilled.
