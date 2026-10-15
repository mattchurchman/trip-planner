# Demo mode (for checking layouts)

The app needs a Google or email sign-in, which agents can't do. `serve.sh` serves a **copy** of the app where `js/firebase.js` is swapped for an in-memory stand-in (`firebase-stub.js`) loaded with one sample trip (`demo-seed.js`: Italy & Spain, three travelers, flights, places, stays, days, costs, comments).

```
bash docs/demo/serve.sh          # http://localhost:8001
```

- `#/` trips list · `#/trip/t1/overview` · `/routes` · `/map` · `/days` · `?signedout#/` for the sign-in card.
- Edits work until you reload; nothing is saved anywhere.
- Map tiles and Google Fonts need internet; without it the map is grey and fonts fall back. Layout is still checkable.
- When a task changes the data model (a new trip field, say), add a sample value to `demo-seed.js` in the same commit.

Use it only when a task's **Tests** say to: screenshots cost tokens. This folder is never deployed (`firebase.json` ignores `docs/**`).
