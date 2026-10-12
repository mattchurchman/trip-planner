import { watchTrip, watchUsers, watchStays, watchPlaces } from "../store.js";
import { el, friendlyError } from "../ui.js";
import { createStaysSection } from "./stays.js";

/** Renders the Stays tab (§7.7; V4 §4.6 moved flights to Routes, T23 moved
 * split costs and totals to Overview). Returns a single unsubscribe function. */
export function renderTravelPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let stays = [];
  let places = []; // for the stays map's "our top places" layer (§7.7.1); not used elsewhere here

  const loadErrorEl = el("div", { className: "field-error-holder" });

  function onError(message) {
    loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
  }

  const staysSection = createStaysSection({ tripId, myUid, onError });

  container.replaceChildren(loadErrorEl, staysSection.element);

  function rerenderAll() {
    if (!trip) return;
    staysSection.render(stays, trip, usersById, places);
  }

  const unsubTrip = watchTrip(
    tripId,
    (t) => {
      trip = t;
      rerenderAll();
    },
    (err) => onError(friendlyError(err))
  );
  const unsubUsers = watchUsers(
    (u) => {
      usersById = u;
      rerenderAll();
    },
    () => {}
  );
  const unsubStays = watchStays(
    tripId,
    (s) => {
      stays = s;
      if (trip) staysSection.render(stays, trip, usersById, places);
    },
    (err) => onError(friendlyError(err))
  );
  const unsubPlaces = watchPlaces(
    tripId,
    (p) => {
      places = p;
      if (trip) staysSection.render(stays, trip, usersById, places);
    },
    () => {}
  );

  return () => {
    unsubTrip();
    unsubUsers();
    unsubStays();
    unsubPlaces();
    staysSection.unsubscribe();
  };
}
