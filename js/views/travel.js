import { watchTrip, watchUsers, watchStays, watchPlaces, watchFlights, watchOptions } from "../store.js";
import { el, friendlyError } from "../ui.js";
import { loadAirports } from "../lookup.js";
import { stopsFor } from "../lib/route.js";
import { createStaysSection } from "./stays.js";

function myTraveler(trip, myUid) {
  const travelers = trip.travelers || [];
  return travelers.find((t) => t.uid === myUid) || travelers[0] || null;
}

/** Renders the Stays tab (§7.7; V4 §4.6 moved flights to Routes, T23 moved
 * split costs and totals to Overview). Returns a single unsubscribe function. */
export function renderTravelPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let stays = [];
  let places = []; // for the stays map's "our top places" layer (§7.7.1); not used elsewhere here
  let flights = [];
  let options = [];
  let airports = null;

  const loadErrorEl = el("div", { className: "field-error-holder" });

  function onError(message) {
    loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
  }

  const staysSection = createStaysSection({ tripId, myUid, onError });

  container.replaceChildren(loadErrorEl, staysSection.element);

  // Stays group under the chosen route's stops (T24), from this traveler's
  // point of view — same "my traveler" convention Overview's route summary
  // uses, since travelers may have different home-flight dates.
  function currentStops() {
    if (!trip || !trip.chosenOptionId || !airports) return null;
    const option = options.find((o) => o.id === trip.chosenOptionId);
    if (!option) return null;
    const traveler = myTraveler(trip, myUid);
    if (!traveler) return null;
    const homeFlights = flights.filter((f) => f.role === "home" && f.ideaId === option.ideaId && f.travelerId === traveler.id && f.picked !== false);
    const hopFlights = flights.filter((f) => f.role === "hop" && f.optionId === option.id);
    return stopsFor({ homeFlights, hopFlights, airports });
  }

  function rerenderAll() {
    if (!trip) return;
    staysSection.render(stays, trip, usersById, places, currentStops());
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
      rerenderAll();
    },
    (err) => onError(friendlyError(err))
  );
  const unsubPlaces = watchPlaces(
    tripId,
    (p) => {
      places = p;
      rerenderAll();
    },
    () => {}
  );
  const unsubFlights = watchFlights(
    tripId,
    (f) => {
      flights = f;
      rerenderAll();
    },
    (err) => onError(friendlyError(err))
  );
  const unsubOptions = watchOptions(
    tripId,
    (o) => {
      options = o;
      rerenderAll();
    },
    (err) => onError(friendlyError(err))
  );

  loadAirports()
    .then((loaded) => {
      airports = loaded;
      rerenderAll();
    })
    .catch((err) => onError(friendlyError(err)));

  return () => {
    unsubTrip();
    unsubUsers();
    unsubStays();
    unsubPlaces();
    unsubFlights();
    unsubOptions();
    staysSection.unsubscribe();
  };
}
