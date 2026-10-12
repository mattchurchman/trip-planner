# T32 — Google sign-in on phones

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** — · **If it fails twice:** Opus
**Owner steps first:**
Known (2026-10-12): Google sign-in **works in Chrome** on the phone and **fails in Safari**, so the Google Cloud and Firebase settings are fine. The cause is Safari-specific.
1. Tell the agent: iPhone or Mac Safari; whether Google opened as a full page or a small window; and which of these changed anything: a normal (not Private) tab, deleting the site's data (Settings → Apps → Safari → Advanced → Website Data → "trip-planner"), **Block All Cookies** off, **Prevent Cross-Site Tracking** off.

## Goal
Google sign-in works in phone Safari. In the iPhone home-screen app it either works or, if iOS can't hand the result back to the app, the app says so plainly and offers a path that does work. No silent sheet that goes nowhere.

## Read (only these)
- `SPEC.md` §7.1
- `js/app.js` (`useRedirectSignIn`, `showSignedOut`, `init`), `js/views/signin.js`, `js/lib/auth-errors.js`

## Files you may change
- `js/app.js`, `js/views/signin.js`, `js/lib/auth-errors.js` (+ `tests/auth-errors.test.js`), `SPEC.md` §7.1, `help.html` (sign-in section only), `docs/tasks/WORDING.md`

## Do
1. From the owner's answers, find why Safari loses the result Chrome keeps: which branch runs (`useRedirectSignIn`), whether `getRedirectResult` resolves with a user, and whether `onAuthStateChanged` fires after the return. Check Safari's known redirect/popup limits for Firebase JS 12.x against our setup (`authDomain` is the hosting domain). If it's still unclear, ask the owner for the red text in Safari's console (Web Inspector from a Mac) and stop. Don't guess.
2. Fix the cause. If the fix is a setting the owner must keep (e.g. Cross-Site Tracking), show that advice on the sign-in screen in Safari only when sign-in fails.
3. Home-screen app (`display-mode: standalone` or `navigator.standalone`): try redirect sign-in. If `getRedirectResult` returns nothing and no user appears after the redirect, show under the Google button: "On iPhone, Google sign-in can't return to the home-screen app. Sign in with email and password here, or sign in once in Safari." Remember the failed attempt in `sessionStorage` (inside try/catch) so the message shows on the return.
4. Keep the existing redirect-on-phone / popup-on-desktop split.

## Don't
- Add a sign-in method, a service, or any paid Firebase feature.
- Change `firebase-config.js` `authDomain`.

## Tests
`node tests/run-tests.js` passes; add a test for any new error mapping.

## Done when
Phone Safari signs in with Google (with default Safari settings); the home-screen app signs in or shows the message above.

## Owner check
1. Phone Safari → **Continue with Google** → you land in the app.
2. Home-screen app → **Continue with Google** → you land in the app, or see the message and can sign in with email.
