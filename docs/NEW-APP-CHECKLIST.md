# Checklist for any new app

Three things make a web app behave like a real app on iPhone and keep people signed in. Trip Planner was first built without them; Fight Club had them. Start every new app with all three.

## 1. Home-screen setup
- `manifest.webmanifest` with `display: standalone`, name, colors, 192 and 512 px PNG icons.
- In every page's `<head>`: `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, and an `apple-touch-icon` pointing at a **180 px square PNG with no transparent corners** (iPhone ignores SVG here).
- Pad fixed top and bottom bars with `env(safe-area-inset-top/bottom)`.

## 2. Host it where sign-in lives
- Use **Firebase Hosting** (free, no card) rather than GitHub Pages, deployed by a GitHub Actions workflow.
- Set `authDomain` in the Firebase config to the app's own address (`<project>.web.app`), and add `https://<project>.web.app/__/auth/handler` to the Google sign-in client's redirect addresses. iPhone Safari distrusts sign-in that hops between two different sites.

## 3. Sign-in that works on phones
- Google: redirect on phones and in the home-screen app, pop-up on desktop.
- Offer email and password too, with `autocomplete` set so the phone fills it with Face ID.
- Never rely on the pop-up alone.

## Check before calling it done
Add to the home screen, sign in, close the app fully, reopen. No browser bars, and still signed in.
