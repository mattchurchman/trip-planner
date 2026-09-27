import { auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, isConfigured } from "./firebase.js";
import { checkAllowlist, ensureUserDoc, watchTrip } from "./store.js";
import { el, setPending, friendlyError } from "./ui.js";
import { renderTripsView } from "./views/trips.js";
import { renderOverviewPage } from "./views/overview.js";

const root = document.getElementById("app");
let tripWatchers = [];

function clearTripWatchers() {
  for (const unsubscribe of tripWatchers) unsubscribe();
  tripWatchers = [];
}

function showSetupMessage() {
  root.replaceChildren(
    el("div", { className: "center-card" }, [
      el("h1", { textContent: "Trip Planner" }),
      el("p", { textContent: "Firebase isn't configured yet. Add your web config to js/firebase-config.js." }),
    ])
  );
}

function showSignedOut() {
  const signInBtn = el("button", { className: "btn btn-primary", textContent: "Sign in with Google" });
  const errorHolder = el("div", { className: "field-error-holder" });
  signInBtn.addEventListener("click", async () => {
    setPending(signInBtn, true, "Signing in…");
    errorHolder.replaceChildren();
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(signInBtn, false);
    }
  });
  root.replaceChildren(
    el("div", { className: "center-card" }, [
      el("h1", { textContent: "Trip Planner" }),
      el("p", { textContent: "Plan trips with your friends." }),
      signInBtn,
      errorHolder,
    ])
  );
}

function showNotAllowed(user) {
  root.replaceChildren(
    el("div", { className: "center-card" }, [
      el("p", {
        textContent: `You're signed in as ${user.email}, but this account isn't on the trip list yet. Ask the owner to add it.`,
      }),
      el("button", { className: "btn btn-secondary", textContent: "Sign out", onclick: () => signOut(auth) }),
    ])
  );
}

function renderTopBar(user) {
  const avatar = user.photoURL
    ? el("img", { className: "avatar", src: user.photoURL, alt: "" })
    : el("div", {
        className: "avatar avatar-initial",
        textContent: (user.displayName || user.email || "?")[0].toUpperCase(),
      });
  return el("header", { className: "top-bar" }, [
    el("a", { className: "app-name", textContent: "Trip Planner", href: "#/" }),
    el("div", { className: "top-bar-user" }, [
      avatar,
      el("button", { className: "btn btn-link", textContent: "Sign out", onclick: () => signOut(auth) }),
    ]),
  ]);
}

function renderTripShell(main, tripId, myUid) {
  const header = el("div", { className: "trip-header" });
  const tabBar = el("nav", { className: "tab-bar" }, [el("span", { className: "tab tab-active", textContent: "Overview" })]);
  const content = el("div", { className: "trip-content" });
  main.replaceChildren(el("div", { className: "trip-shell" }, [header, tabBar, content]));

  const unsubHeader = watchTrip(
    tripId,
    (trip) => {
      if (!trip) {
        header.replaceChildren(el("p", { textContent: "This trip couldn't be found." }));
        content.replaceChildren();
        return;
      }
      header.replaceChildren(
        el("h1", { textContent: trip.name }),
        el("p", { className: "trip-status", textContent: trip.status })
      );
    },
    (err) => header.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const unsubOverview = renderOverviewPage(content, tripId, myUid);

  return () => {
    unsubHeader();
    unsubOverview();
  };
}

function route(user, main) {
  clearTripWatchers();
  const hash = location.hash || "#/";
  const tripMatch = hash.match(/^#\/trip\/([^/]+)/);
  if (tripMatch) {
    tripWatchers.push(renderTripShell(main, decodeURIComponent(tripMatch[1]), user.uid));
  } else {
    tripWatchers.push(renderTripsView(main, user));
  }
}

function startApp(user) {
  const main = el("main", { className: "app-main" });
  root.replaceChildren(renderTopBar(user), main);
  route(user, main);
  window.addEventListener("hashchange", () => route(user, main));
}

async function handleSignedIn(user) {
  let allowlistSnap;
  try {
    allowlistSnap = await checkAllowlist(user.email);
  } catch (err) {
    root.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    return;
  }
  if (!allowlistSnap.exists()) {
    showNotAllowed(user);
    return;
  }
  try {
    await ensureUserDoc(user);
  } catch (err) {
    root.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    return;
  }
  startApp(user);
}

function init() {
  if (!isConfigured) {
    showSetupMessage();
    return;
  }
  onAuthStateChanged(auth, (user) => {
    clearTripWatchers();
    root.replaceChildren();
    if (user) {
      handleSignedIn(user);
    } else {
      showSignedOut();
    }
  });
}

init();
