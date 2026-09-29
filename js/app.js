import { auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, isConfigured } from "./firebase.js";
import { checkAllowlist, ensureUserDoc, watchTrip } from "./store.js";
import { el, setPending, friendlyError } from "./ui.js";
import { tripStage } from "./lib/stage.js";
import { renderTripsView } from "./views/trips.js";
import { renderOverviewPage } from "./views/overview.js";
import { renderPlacesPage } from "./views/places.js";
import { renderTravelPage } from "./views/travel.js";
import { renderDaysPage } from "./views/days.js";
import { renderRecapPage } from "./views/recap.js";

const TABS = [
  { key: "overview", label: "Overview", render: renderOverviewPage },
  { key: "places", label: "Places", render: renderPlacesPage },
  { key: "travel", label: "Flights & stays", render: renderTravelPage },
  { key: "days", label: "Days", render: renderDaysPage },
  { key: "recap", label: "Recap", render: renderRecapPage },
];

const root = document.getElementById("app");
let tripWatchers = [];
let removeRouter = null;

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
      el("img", { className: "center-card-logo", src: "./img/logo.svg", alt: "", width: 64, height: 64 }),
      el("h1", { textContent: "Trip Planner" }),
      el("p", { textContent: "Plan trips with your friends — from \"where should we go?\" to the recap." }),
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
    el("a", { className: "app-brand", href: "#/" }, [
      el("img", { className: "app-logo", src: "./img/logo.svg", alt: "", width: 28, height: 28 }),
      el("span", { className: "app-name", textContent: "Trip Planner" }),
    ]),
    el("div", { className: "top-bar-user" }, [
      el("a", { className: "btn btn-link", textContent: "Help", href: "./help.html", target: "_blank", rel: "noopener noreferrer" }),
      avatar,
      el("button", { className: "btn btn-link", textContent: "Sign out", onclick: () => signOut(auth) }),
    ]),
  ]);
}

function renderTripShell(main, tripId, myUid, tabKey) {
  const header = el("div", { className: "trip-header" });
  const tabBar = el(
    "nav",
    { className: "tab-bar" },
    TABS.map((tab) =>
      el("a", {
        className: `tab${tab.key === tabKey ? " tab-active" : ""}`,
        href: `#/trip/${tripId}/${tab.key}`,
        textContent: tab.label,
        attrs: tab.key === tabKey ? { "aria-current": "page" } : {},
      })
    )
  );
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
      document.title = `${trip.name} · Trip Planner`;
      const today = new Date().toISOString().slice(0, 10);
      const stage = tripStage(trip, today);
      const stageBadge = stage.key === "done"
        ? el("a", { className: `stage-badge stage-${stage.key}`, href: `#/trip/${tripId}/recap`, textContent: stage.label })
        : el("span", { className: `stage-badge stage-${stage.key}`, textContent: stage.label });
      header.replaceChildren(
        el("h1", { textContent: trip.name }),
        stageBadge
      );
    },
    (err) => header.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const activeTab = TABS.find((t) => t.key === tabKey) || TABS[0];
  const unsubContent = activeTab.render(content, tripId, myUid);

  return () => {
    unsubHeader();
    unsubContent();
  };
}

function route(user, main) {
  clearTripWatchers();
  const hash = location.hash || "#/";
  const tripMatch = hash.match(/^#\/trip\/([^/]+)(?:\/([a-z]+))?/);
  if (tripMatch) {
    const tripId = decodeURIComponent(tripMatch[1]);
    const tabKey = TABS.some((t) => t.key === tripMatch[2]) ? tripMatch[2] : "overview";
    tripWatchers.push(renderTripShell(main, tripId, user.uid, tabKey));
  } else {
    document.title = "Trip Planner";
    tripWatchers.push(renderTripsView(main, user));
  }
}

function startApp(user) {
  const main = el("main", { className: "app-main" });
  root.replaceChildren(renderTopBar(user), main);
  // Signing out and back in runs this again; without dropping the old listener
  // the previous one keeps routing into a detached <main> and re-subscribing.
  if (removeRouter) removeRouter();
  const onHashChange = () => route(user, main);
  window.addEventListener("hashchange", onHashChange);
  removeRouter = () => {
    window.removeEventListener("hashchange", onHashChange);
    removeRouter = null;
  };
  route(user, main);
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
    if (removeRouter) removeRouter();
    root.replaceChildren();
    if (user) {
      handleSignedIn(user);
    } else {
      showSignedOut();
    }
  });
}

init();
