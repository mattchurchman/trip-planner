# T32 — Google sign-in on phones

**Tier:** B · **Model:** Sonnet · **Effort:** high · **Size:** M
**Depends on:** — · **If it fails twice:** Opus
**Owner steps first:**
1. Go to `console.cloud.google.com/apis/credentials`, pick the project `trip-planner-mattchurchman`, open **Web client (auto created by Google Service)**.
2. Under **Authorized JavaScript origins** make sure `https://trip-planner-mattchurchman.web.app` is listed. Under **Authorized redirect URIs** make sure `https://trip-planner-mattchurchman.web.app/__/auth/handler` is listed. Add whichever is missing and **Save** (changes can take 5 minutes).
3. Firebase console → **Authentication → Settings → Authorized domains**: `trip-planner-mattchurchman.web.app` is listed.
4. On the phone, try **Continue with Google** in Safari (not the home-screen app). Tell the agent: which entries you had to add, and whether Safari now works.

## Goal
Google sign-in works in phone Safari. In the iPhone home-screen app it either works or, if iOS can't hand the result back to the app, the app says so plainly and offers a path that does work. No silent sheet that goes nowhere.

## Read (only these)
- `SPEC.md` §7.1
- `js/app.js` (`useRedirectSignIn`, `showSignedOut`, `init`), `js/views/signin.js`, `js/lib/auth-errors.js`

## Files you may change
- `js/app.js`, `js/views/signin.js`, `js/lib/auth-errors.js` (+ `tests/auth-errors.test.js`), `SPEC.md` §7.1, `help.html` (sign-in section only), `docs/tasks/WORDING.md`

## Do
1. If the owner says Safari works after the owner steps: the cause was the missing redirect address. Go to step 3.
2. If Safari still fails: ask the owner for the red text in Safari's console (Settings → Safari → Advanced → Web Inspector, from a Mac) or the exact on-screen message, then fix the cause. Don't guess.
3. Home-screen app (`display-mode: standalone` or `navigator.standalone`): try redirect sign-in. If `getRedirectResult` returns nothing and no user appears after the redirect, show under the Google button: "On iPhone, Google sign-in can't return to the home-screen app. Sign in with email and password here, or sign in once in Safari." Remember the failed attempt in `sessionStorage` (inside try/catch) so the message shows on the return.
4. Keep the existing redirect-on-phone / popup-on-desktop split.

## Don't
- Add a sign-in method, a service, or any paid Firebase feature.
- Change `firebase-config.js` `authDomain`.

## Tests
`node tests/run-tests.js` passes; add a test for any new error mapping.

## Done when
Phone Safari signs in with Google; the home-screen app signs in or shows the message above.

## Owner check
1. Phone Safari → **Continue with Google** → you land in the app.
2. Home-screen app → **Continue with Google** → you land in the app, or see the message and can sign in with email.
