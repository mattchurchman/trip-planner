# T15 — Sign-in that sticks on iPhone

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** T14 · **If it fails twice:** Opus
**Owner steps first:**
1. Firebase console → **Authentication → Sign-in method → Add new provider → Email/Password → Enable** (leave "Email link" off) → Save.
2. Go to `console.cloud.google.com/apis/credentials`, pick the project `trip-planner-mattchurchman`, open the **Web client (auto created by Google Service)** entry. Under **Authorized JavaScript origins** add `https://trip-planner-mattchurchman.web.app`. Under **Authorized redirect URIs** add `https://trip-planner-mattchurchman.web.app/__/auth/handler`. Save.
3. Tell the agent "sign-in settings done".

## Goal
Signing in works from the iPhone home-screen app and stays signed in. People can use Google or an email and password.

## Read (only these)
- `docs/V4.md` §3
- `js/firebase.js`, `js/firebase-config.js`, `js/app.js` (the sign-in and `init` parts)
- `firestore.rules` (read only)

## Files you may change
- `js/firebase-config.js` (`authDomain` → `trip-planner-mattchurchman.web.app`)
- `js/firebase.js` (export the extra auth functions)
- **new** `js/views/signin.js`; `js/app.js` (use it; remove the old sign-in card)
- `css/styles.css` (sign-in screen), `docs/tasks/WORDING.md`

## Do
1. Google button: `signInWithRedirect` when the screen is a phone or the app runs full screen (`matchMedia("(display-mode: standalone)")` or `navigator.standalone`), otherwise `signInWithPopup`. Call `getRedirectResult` on load and show its error if any.
2. Email and password form with three modes: sign in, create account, forgot password (`sendPasswordResetEmail`). Inputs use `autocomplete="email"`, `"current-password"` / `"new-password"`.
3. After creating a password account, send `sendEmailVerification` and show "Check your email to confirm, then tap Continue". Continue reloads the user and refreshes the token (`user.reload()`, `getIdToken(true)`) before running the allowlist check. Offer "Send it again".
4. Friendly messages for wrong password, unknown email, weak password, email already used.
5. Keep the existing "not on the trip list" screen.

## Don't
- Change `firestore.rules` or the allowlist.
- Add email-link (passwordless) sign-in.

## Tests
Existing tests pass. Put any pure helper (for example the error-code → message map) in `js/lib/` with a test.

## Done when
Loads without console errors at 375 px and 1280 px; the three form modes switch correctly; you have listed what you could not verify without signing in.

## Owner check
1. Computer: sign out, sign in with Google. Works.
2. iPhone: delete the old home-screen icon, add the new address to the home screen, open it, **Continue with Google**. You land in the app.
3. Close the app fully, wait a minute, reopen from the icon: still signed in.
4. Create a password account with an allow-listed email, confirm the email, tap Continue: you're in. Sign out and back in with Face ID fill.
5. When all of that works: GitHub repo → **Settings → Pages → Source: None**, and send friends the new address.
