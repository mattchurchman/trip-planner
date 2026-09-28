import {
  watchTrip,
  watchUsers,
  watchCandidates,
  updateTripFields,
  updateTravelers,
  adoptUnassignedPlaces,
  getTravelerFlights,
  removeTraveler,
  deleteFlight,
} from "../store.js";
import { el, setPending, confirmDialog, friendlyError, copyLinkButton, field, dialogShell, renderWhenIdle } from "../ui.js";
import { pendingDestinationPin } from "./places.js";
import { createCandidatesSection } from "./candidates.js";
import { nominatimSearch } from "../lookup.js";
import {
  googleFlightsExploreUrl,
  googleFlightsSearchUrl,
  googleHotelsUrl,
  bookingUrl,
  airbnbUrl,
  googleSearchUrl,
  ideaQueries,
} from "../lib/links.js";

const STATUSES = ["exploring", "planning", "booked", "done"];

function externalLinkRow(url, label) {
  const anchor = el("a", {
    className: "discover-link",
    href: url,
    target: "_blank",
    rel: "noopener noreferrer",
    textContent: label,
  });
  return el("div", { className: "discover-row" }, [anchor, copyLinkButton(url)]);
}

/** Renders the Overview tab (§7.5) into `container`. Returns a single unsubscribe function. */
export function renderOverviewPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let candidates = [];

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const tripDetailsEl = el("div", { className: "trip-details card" });
  const travelersEl = el("div", { className: "travelers-section card" });
  const travelerError = el("div", { className: "field-error-holder" });
  const discoverEl = el("div", { className: "discover-section card" });

  async function chooseDestination(candidate, button, errorHolder) {
    errorHolder.replaceChildren();
    setPending(button, true, "Setting…");
    try {
      let { lat, lng } = candidate;
      if (lat == null || lng == null) {
        const results = await nominatimSearch(`${candidate.city}, ${candidate.country}`);
        if (results && results.length > 0) {
          lat = Number(results[0].lat);
          lng = Number(results[0].lon);
        } else {
          lat = null;
          lng = null;
        }
      }
      const fields = {
        destination: { city: candidate.city, country: candidate.country, lat, lng, airport: candidate.airport || "" },
        destinationId: candidate.id,
      };
      if (trip.status === "exploring") fields.status = "planning";
      await updateTripFields(tripId, fields);
      await adoptUnassignedPlaces(tripId, candidate.id);
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(button, false);
    }
  }

  const candidatesSection = createCandidatesSection({ tripId, myUid, onChoose: chooseDestination });

  container.replaceChildren(loadErrorEl, tripDetailsEl, travelersEl, candidatesSection.element, discoverEl);

  function renderTripDetails() {
    const fieldError = el("div", { className: "field-error-holder" });
    const nameInput = el("input", { type: "text", value: trip.name });
    const statusSelect = el(
      "select",
      {},
      STATUSES.map((s) => el("option", { value: s, textContent: s, selected: s === trip.status }))
    );
    const startInput = el("input", { type: "date", value: trip.startDate || "" });
    const endInput = el("input", { type: "date", value: trip.endDate || "" });
    const currencyInput = el("input", { type: "text", value: trip.currency, maxLength: 3 });
    const notesInput = el("textarea", { rows: 3, value: trip.notes });

    function save(fields) {
      fieldError.replaceChildren();
      updateTripFields(tripId, fields).catch((err) => {
        fieldError.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      });
    }

    nameInput.addEventListener("change", () => {
      const value = nameInput.value.trim();
      if (!value) {
        fieldError.replaceChildren(el("p", { className: "field-error", textContent: "Trip name can't be blank." }));
        nameInput.value = trip.name;
        return;
      }
      save({ name: value });
    });
    statusSelect.addEventListener("change", () => save({ status: statusSelect.value }));
    startInput.addEventListener("change", () => save({ startDate: startInput.value || null }));
    endInput.addEventListener("change", () => {
      if (startInput.value && endInput.value && endInput.value < startInput.value) {
        fieldError.replaceChildren(
          el("p", { className: "field-error", textContent: "End date can't be before the start date." })
        );
        endInput.value = trip.endDate || "";
        return;
      }
      save({ endDate: endInput.value || null });
    });
    currencyInput.addEventListener("change", () => {
      const value = currencyInput.value.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(value)) {
        fieldError.replaceChildren(
          el("p", { className: "field-error", textContent: "Currency must be three letters, e.g. USD." })
        );
        currencyInput.value = trip.currency;
        return;
      }
      save({ currency: value });
    });
    notesInput.addEventListener("change", () => save({ notes: notesInput.value }));

    tripDetailsEl.replaceChildren(
      field("Trip name", nameInput),
      field("Status", statusSelect),
      el("div", { className: "field-row" }, [field("Start date", startInput), field("End date", endInput)]),
      field("Currency", currencyInput),
      field("Notes", notesInput),
      fieldError
    );
  }

  function travelerRow(traveler) {
    const nameInput = el("input", { type: "text", value: traveler.name, attrs: { "aria-label": "Traveler name" } });
    const cityInput = el("input", { type: "text", value: traveler.homeCity, placeholder: "Home city", attrs: { "aria-label": `Home city for ${traveler.name}` } });
    const airportInput = el("input", {
      type: "text",
      value: traveler.homeAirport,
      placeholder: "Airport",
      maxLength: 4,
      attrs: { "aria-label": `Home airport for ${traveler.name}` },
    });

    function commit(patch) {
      const travelers = trip.travelers.map((t) => (t.id === traveler.id ? { ...t, ...patch } : t));
      updateTravelers(tripId, travelers).catch((err) => {
        travelerError.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      });
    }
    nameInput.addEventListener("change", () => commit({ name: nameInput.value.trim() || traveler.name }));
    cityInput.addEventListener("change", () => commit({ homeCity: cityInput.value.trim() }));
    airportInput.addEventListener("change", () => commit({ homeAirport: airportInput.value.trim().toUpperCase() }));

    const removeBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Remove" });
    removeBtn.addEventListener("click", async () => {
      travelerError.replaceChildren();
      if (trip.travelers.length <= 1) {
        travelerError.replaceChildren(
          el("p", { className: "field-error", textContent: "At least one traveler must remain." })
        );
        return;
      }
      const confirmed = await confirmDialog(`Remove ${traveler.name}?`);
      if (!confirmed) return;
      const travelers = trip.travelers.filter((t) => t.id !== traveler.id);
      try {
        // Their flight options would otherwise be orphaned: the Flights tab lists
        // options per traveler, so nobody could see or delete them afterwards (§7.5).
        const theirFlights = await getTravelerFlights(tripId, traveler.id);
        if (theirFlights.length > 0) {
          const alsoDelete = await confirmDialog(
            `Also delete ${theirFlights.length} flight option${theirFlights.length === 1 ? "" : "s"} saved for ${traveler.name}?`
          );
          if (alsoDelete) {
            for (const flight of theirFlights) await deleteFlight(tripId, flight.id);
          }
        }
        await removeTraveler(tripId, travelers, traveler.id);
      } catch (err) {
        travelerError.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    return el("div", { className: "traveler-row" }, [nameInput, cityInput, airportInput, removeBtn]);
  }

  function addTravelerDialog() {
    return dialogShell("traveler-dialog", (finish) => {
      const existingUids = new Set((trip.travelers || []).map((t) => t.uid).filter(Boolean));
      const memberOptions = Object.entries(usersById)
        .filter(([uid]) => !existingUids.has(uid))
        .map(([uid, u]) => el("option", { value: uid, textContent: u.displayName || u.email }));
      const memberSelect = el("select", {}, [
        el("option", { value: "", textContent: "— Type a name instead —" }),
        ...memberOptions,
      ]);
      const nameInput = el("input", { type: "text", placeholder: "Name" });
      const errorHolder = el("div", { className: "field-error-holder" });
      const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
      const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Add" });
      const form = el("form", { method: "dialog" }, [
        field("App member", memberSelect),
        field("Or type a name", nameInput),
        errorHolder,
        el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
      ]);
      cancelBtn.addEventListener("click", () => finish(null));
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (memberSelect.value) {
          const u = usersById[memberSelect.value];
          finish({ uid: memberSelect.value, name: u.displayName || u.email });
        } else if (nameInput.value.trim()) {
          finish({ uid: null, name: nameInput.value.trim() });
        } else {
          errorHolder.replaceChildren(
            el("p", { className: "field-error", textContent: "Choose a member or type a name." })
          );
        }
      });
      return { form, focusEl: memberSelect };
    });
  }

  function renderTravelers() {
    const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add traveler" });
    addBtn.addEventListener("click", async () => {
      const result = await addTravelerDialog();
      if (!result) return;
      const newTraveler = { id: crypto.randomUUID(), name: result.name, uid: result.uid, homeCity: "", homeAirport: "" };
      try {
        await updateTravelers(tripId, [...(trip.travelers || []), newTraveler]);
      } catch (err) {
        travelerError.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });
    travelersEl.replaceChildren(
      el("div", { className: "travelers-header" }, [el("h2", { textContent: "Travelers" }), addBtn]),
      ...(trip.travelers || []).map(travelerRow),
      travelerError
    );
  }

  function renderDiscover() {
    const rows = [externalLinkRow(googleFlightsExploreUrl(), "Google Flights Explore")];
    const dest = trip.destination;
    if (dest) {
      if (dest.lat == null || dest.lng == null) {
        const setOnMapBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Set on map" });
        setOnMapBtn.addEventListener("click", () => {
          pendingDestinationPin.tripId = tripId;
          location.hash = `#/trip/${tripId}/places`;
        });
        rows.push(
          el("div", { className: "location-needed" }, [
            el("p", { className: "field-error", textContent: "Location needed for this destination." }),
            setOnMapBtn,
          ])
        );
      }
      for (const traveler of trip.travelers || []) {
        const url = googleFlightsSearchUrl({
          fromCity: traveler.homeCity || "?",
          fromAirport: traveler.homeAirport,
          toCity: dest.city,
          toAirport: dest.airport,
          outboundDate: trip.startDate,
          returnDate: trip.endDate,
        });
        rows.push(externalLinkRow(url, `Flights for ${traveler.name}`));
      }
      const adults = (trip.travelers || []).length || 1;
      rows.push(externalLinkRow(googleHotelsUrl(dest.city), "Search Google Hotels"));
      rows.push(
        externalLinkRow(
          bookingUrl({ city: dest.city, checkIn: trip.startDate, checkOut: trip.endDate, adults }),
          "Search Booking.com"
        )
      );
      rows.push(
        externalLinkRow(
          airbnbUrl({ city: dest.city, checkIn: trip.startDate, checkOut: trip.endDate, adults }),
          "Search Airbnb"
        )
      );
      for (const ideaQuery of ideaQueries(dest.city, trip.startDate)) {
        rows.push(externalLinkRow(googleSearchUrl(ideaQuery), ideaQuery));
      }
    }
    discoverEl.replaceChildren(el("h2", { textContent: "Discover" }), ...rows);
  }

  // Each section defers its own rebuild while someone is typing in it (§8), so a
  // live update to one never disturbs an edit in progress in another.
  function rerender() {
    if (!trip) return;
    renderWhenIdle(tripDetailsEl, renderTripDetails);
    renderWhenIdle(travelersEl, renderTravelers);
    candidatesSection.render(candidates, trip, usersById);
    renderDiscover();
  }

  const unsubTrip = watchTrip(
    tripId,
    (t) => {
      trip = t;
      if (trip) rerender();
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const unsubUsers = watchUsers(
    (u) => {
      usersById = u;
      rerender();
    },
    () => {}
  );
  const unsubCandidates = watchCandidates(
    tripId,
    (c) => {
      candidates = c;
      rerender();
    },
    (err) => candidatesSection.renderError(friendlyError(err))
  );

  return () => {
    unsubTrip();
    unsubUsers();
    unsubCandidates();
    candidatesSection.unsubscribe();
  };
}
