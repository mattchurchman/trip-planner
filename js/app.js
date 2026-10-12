import { auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut, onAuthStateChanged, isConfigured } from "./firebase.js";
import { checkAllowlist, ensureUserDoc, watchTrip } from "./store.js";
import { el, svgEl, friendlyError } from "./ui.js";
import { tripStage } from "./lib/stage.js";
import { renderTripsView } from "./views/trips.js";
import { renderOverviewPage } from "./views/overview.js";
import { renderRoutesPage } from "./views/routes.js";
import { renderMapPage } from "./views/mapTab.js";
import { renderDaysPage } from "./views/days.js";
import { renderSignIn, renderEmailConfirmation } from "./views/signin.js";

const TABS = [
  { key: "overview", label: "Overview", icon: "M4 11l8-7 8 7v9h-5v-6H9v6H4z", render: renderOverviewPage },
  { key: "routes", label: "Routes", icon: "M1 18l7-7 5 5 9-9M16 7h7v7", render: renderRoutesPage },
  { key: "map", label: "Map", icon: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", render: renderMapPage },
  { key: "days", label: "Days", icon: "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4", render: renderDaysPage },
];
// Old links from before T25 (§8) still land somewhere useful.
const LEGACY_TAB_REDIRECTS = { places: "map", travel: "map" };

const root = document.getElementById("app");
let tripWatchers = [];
let removeRouter = null;
let redirectError = "";

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

function useRedirectSignIn() {
  return window.matchMedia("(max-width: 767px)").matches
    || window.matchMedia("(display-mode: standalone)").matches
    || navigator.standalone === true;
}

function showSignedOut() {
  root.replaceChildren(renderSignIn({
    google: () => useRedirectSignIn()
      ? signInWithRedirect(auth, new GoogleAuthProvider())
      : signInWithPopup(auth, new GoogleAuthProvider()),
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    create: async (email, password) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(credential.user);
    },
    reset: async (email) => {
      await sendPasswordResetEmail(auth, email);
      return "Check your email for a password-reset link.";
    },
  }, redirectError));
  redirectError = "";
}

function showEmailConfirmation(user, error = "") {
  root.replaceChildren(renderEmailConfirmation(user, {
    continue: async () => {
      await user.reload();
      await user.getIdToken(true);
      if (!user.emailVerified) return "That email is not confirmed yet. Open the link, then try again.";
      await handleSignedIn(user);
      return "";
    },
    resend: async () => {
      await sendEmailVerification(user);
      return "We sent another confirmation email.";
    },
    signOut: () => signOut(auth),
  }, error));
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
  const accountMenu = el("details", { className: "account-menu" }, [
    el("summary", { attrs: { "aria-label": "Account menu" } }, [avatar]),
    el("div", { className: "account-menu-panel" }, [
      el("button", { className: "btn btn-quiet", textContent: "Sign out", onclick: () => signOut(auth) }),
    ]),
  ]);
  return el("header", { className: "top-bar" }, [
    el("a", { className: "app-brand", href: "#/" }, [
      el("img", { className: "app-logo", src: "./img/logo.svg", alt: "", width: 28, height: 28 }),
      el("span", { className: "app-name", textContent: "Trip Planner" }),
    ]),
    el("span", { className: "top-trip-name", textContent: "" }),
    el("nav", { className: "top-tabs", attrs: { "aria-label": "Trip sections" } }),
    el("div", { className: "top-bar-user" }, [
      el("a", { className: "btn btn-link", textContent: "Help", href: "./help.html", target: "_blank", rel: "noopener noreferrer" }),
      accountMenu,
    ]),
  ]);
}

function tabLink(tab, tripId, tabKey) {
  const icon = svgEl("svg", { class: "tab-icon", viewBox: "0 0 24 24", "aria-hidden": "true" }, [
    svgEl("path", { d: tab.icon }),
  ]);
  return el("a", {
    className: `tab${tab.key === tabKey ? " tab-active" : ""}`,
    href: `#/trip/${tripId}/${tab.key}`,
    attrs: tab.key === tabKey ? { "aria-current": "page" } : {},
  }, [icon, el("span", { textContent: tab.label })]);
}

function renderTripShell(main, tripId, myUid, tabKey) {
  const header = el("div", { className: "trip-header" });
  const tabBar = el("nav", { className: "tab-bar", attrs: { "aria-label": "Trip sections" } }, TABS.map((tab) => tabLink(tab, tripId, tabKey)));
  root.querySelector(".top-tabs").replaceChildren(...TABS.map((tab) => tabLink(tab, tripId, tabKey)));
  const content = el("div", { className: "trip-content" });
  main.replaceChildren(el("div", { className: "trip-shell" }, [header, tabBar, content]));

  const unsubHeader = watchTrip(
    tripId,
    (trip) => {
      if (!trip) {
        root.querySelector(".top-trip-name").textContent = "";
        header.replaceChildren(el("p", { textContent: "This trip couldn't be found." }));
        content.replaceChildren();
        return;
      }
      document.title = `${trip.name} · Trip Planner`;
      root.querySelector(".top-trip-name").textContent = trip.name;
      const today = new Date().toISOString().slice(0, 10);
      const stage = tripStage(trip, today);
      const stageBadge = el("span", { className: `stage-badge stage-${stage.key}`, textContent: stage.label });
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
    const redirect = LEGACY_TAB_REDIRECTS[tripMatch[2]];
    if (redirect) {
      location.hash = `#/trip/${tripMatch[1]}/${redirect}`;
      return;
    }
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
  if (!user.emailVerified) {
    showEmailConfirmation(user);
    return;
  }
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

async function init() {
  if (!isConfigured) {
    showSetupMessage();
    return;
  }
  getRedirectResult(auth).catch((error) => {
    redirectError = error.message || "Google sign-in didn't finish. Try again.";
    if (!auth.currentUser) showSignedOut();
  });
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
