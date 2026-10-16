import { auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut, onAuthStateChanged, isConfigured } from "./firebase.js";
import { checkAllowlist, ensureUserDoc, watchTrip } from "./store.js";
import { el, icon, friendlyError } from "./ui.js";
import { formatDateRange } from "./lib/dates.js";
import { renderTripsView } from "./views/trips.js";
import { renderOverviewPage } from "./views/overview.js";
import { renderRoutesPage } from "./views/routes.js";
import { renderMapPage } from "./views/mapTab.js";
import { renderDaysPage } from "./views/days.js";
import { renderSignIn, renderEmailConfirmation } from "./views/signin.js";

const TABS = [
  { key: "overview", label: "Overview", icon: "overview", render: renderOverviewPage },
  { key: "routes", label: "Routes", icon: "routes", render: renderRoutesPage },
  { key: "map", label: "Map", icon: "map", render: renderMapPage },
  { key: "days", label: "Days", icon: "days", render: renderDaysPage },
];
// Old links from before T25 (§8) still land somewhere useful.
const LEGACY_TAB_REDIRECTS = { places: "map", travel: "map" };

const root = document.getElementById("app");
let tripWatchers = [];
let removeRouter = null;
let redirectError = "";

const GOOGLE_REDIRECT_ATTEMPT_KEY = "googleRedirectAttempted";

// Safari can restore this page from its back-forward cache after the Google
// redirect round trip instead of loading it fresh, so our code never reruns
// to pick up the sign-in that Firebase already completed. A reload forces
// that fresh run. Other browsers rarely hit this, and a reload is harmless
// either way.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});

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

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function useRedirectSignIn() {
  return window.matchMedia("(max-width: 767px)").matches || isStandaloneApp();
}

function showSignedOut() {
  root.replaceChildren(renderSignIn({
    google: () => {
      if (isStandaloneApp()) {
        try {
          sessionStorage.setItem(GOOGLE_REDIRECT_ATTEMPT_KEY, "1");
        } catch {
          // Safari private mode or a full storage can refuse this; the
          // fallback message below just won't show if sign-in doesn't return.
        }
      }
      return useRedirectSignIn()
        ? signInWithRedirect(auth, new GoogleAuthProvider())
        : signInWithPopup(auth, new GoogleAuthProvider());
    },
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
    el("nav", { className: "top-tabs", attrs: { "aria-label": "Trip sections" } }),
    el("div", { className: "trip-title" }, [
      el("span", { className: "trip-title-name", textContent: "" }),
      el("span", { className: "trip-title-meta", textContent: "" }),
    ]),
    el("div", { className: "top-bar-user" }, [
      el("a", {
        className: "icon-btn",
        textContent: "?",
        href: "./help.html",
        target: "_blank",
        rel: "noopener noreferrer",
        attrs: { "aria-label": "Help" },
      }),
      accountMenu,
    ]),
  ]);
}

function tabLink(tab, tripId, tabKey) {
  const tabIcon = icon(tab.icon, { size: 20 });
  tabIcon.classList.add("tab-icon");
  return el("a", {
    className: `tab${tab.key === tabKey ? " tab-active" : ""}`,
    href: `#/trip/${tripId}/${tab.key}`,
    attrs: tab.key === tabKey ? { "aria-current": "page" } : {},
  }, [tabIcon, el("span", { textContent: tab.label })]);
}

function renderTripShell(main, tripId, myUid, tabKey) {
  const tabBar = el("nav", { className: "tab-bar", attrs: { "aria-label": "Trip sections" } }, TABS.map((tab) => tabLink(tab, tripId, tabKey)));
  root.querySelector(".top-tabs").replaceChildren(...TABS.map((tab) => tabLink(tab, tripId, tabKey)));
  root.querySelector(".top-bar").classList.add("has-trip");
  const content = el("div", { className: "trip-content" });
  main.replaceChildren(el("div", { className: "trip-shell" }, [tabBar, content]));

  const unsubHeader = watchTrip(
    tripId,
    (trip) => {
      const nameEl = root.querySelector(".trip-title-name");
      const metaEl = root.querySelector(".trip-title-meta");
      if (!trip) {
        nameEl.textContent = "";
        metaEl.textContent = "";
        content.replaceChildren(el("p", { textContent: "This trip couldn't be found." }));
        return;
      }
      document.title = `${trip.name} · Trip Planner`;
      nameEl.textContent = trip.name;
      const travelerCount = (trip.travelers || []).length;
      metaEl.textContent = `${formatDateRange(trip.startDate, trip.endDate)} · ${travelerCount} traveler${travelerCount === 1 ? "" : "s"}`;
    },
    (err) => content.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const activeTab = TABS.find((t) => t.key === tabKey) || TABS[0];
  const unsubContent = activeTab.render(content, tripId, myUid);

  return () => {
    unsubHeader();
    unsubContent();
    root.querySelector(".top-bar").classList.remove("has-trip");
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
  let hadRedirectAttempt = false;
  try {
    hadRedirectAttempt = sessionStorage.getItem(GOOGLE_REDIRECT_ATTEMPT_KEY) === "1";
    sessionStorage.removeItem(GOOGLE_REDIRECT_ATTEMPT_KEY);
  } catch {
    // Can't read the flag back; worst case the fallback message doesn't show.
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
      if (hadRedirectAttempt && isStandaloneApp()) {
        redirectError = "On iPhone, Google sign-in can't return to the home-screen app. Sign in with email and password here, or sign in once in Safari.";
        hadRedirectAttempt = false;
      }
      showSignedOut();
    }
  });
}

init();
