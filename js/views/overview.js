import {
  watchTrip,
  watchUsers,
  watchCandidates,
  updateTripFields,
  updateTravelers,
  addCandidate,
  updateCandidate,
  deleteCandidate,
  voteOnCandidate,
} from "../store.js";
import { el, setPending, confirmDialog, friendlyError, rankControl, copyLinkButton, field, dialogShell } from "../ui.js";
import { renderComments } from "./comments.js";
import { sortByRank } from "../lib/votes.js";
import {
  safeUrl,
  googleFlightsExploreUrl,
  googleFlightsSearchUrl,
  googleHotelsUrl,
  bookingUrl,
  airbnbUrl,
  googleSearchUrl,
  ideaQueries,
} from "../lib/links.js";

const STATUSES = ["exploring", "planning", "booked", "done"];

async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Location search failed. Try again in a moment.");
  return response.json();
}

function candidateFormDialog(existing) {
  return dialogShell("candidate-dialog", (finish) => {
    const cityInput = el("input", { type: "text", value: existing?.city || "" });
    const countryInput = el("input", { type: "text", value: existing?.country || "" });
    const whyInput = el("textarea", { rows: 2, value: existing?.why || "" });
    const priceInput = el("input", { type: "text", value: existing?.roughPriceNote || "" });
    const dateIdeaInput = el("input", { type: "text", value: existing?.dateIdea || "" });
    const linkInput = el("input", { type: "text", value: existing?.link || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: existing ? "Save" : "Add" });

    const form = el("form", { method: "dialog", className: "candidate-form" }, [
      field("City", cityInput),
      field("Country", countryInput),
      field("Why", whyInput),
      field("Rough price note", priceInput),
      field("Date idea", dateIdeaInput),
      field("Link", linkInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const city = cityInput.value.trim();
      const country = countryInput.value.trim();
      if (!city || !country) {
        errorHolder.replaceChildren(
          el("p", { className: "field-error", textContent: "City and country are required." })
        );
        return;
      }
      finish({
        city,
        country,
        why: whyInput.value.trim(),
        roughPriceNote: priceInput.value.trim(),
        dateIdea: dateIdeaInput.value.trim(),
        link: linkInput.value.trim() || null,
      });
    });
    return { form, focusEl: cityInput };
  });
}

/** True only when the user is actively typing/selecting in a form control here —
 * not just when focus happens to be resting on a button inside the container
 * (e.g. right after a dialog it opened closes). Used to avoid wiping an
 * in-progress edit on a live update (§8) without also freezing the UI after
 * an action completes. */
function isEditingInside(container) {
  const active = document.activeElement;
  return container.contains(active) && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
}

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
  let candidateCommentUnsubscribes = [];

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const tripDetailsEl = el("div", { className: "trip-details card" });
  const travelersEl = el("div", { className: "travelers-section card" });
  const travelerError = el("div", { className: "field-error-holder" });
  const addCandidateBtn = el("button", {
    type: "button",
    className: "btn btn-primary",
    textContent: "Add candidate destination",
  });
  const candidateError = el("div", { className: "field-error-holder" });
  const candidatesEl = el("div", { className: "candidates-section" });
  const discoverEl = el("div", { className: "discover-section card" });

  container.replaceChildren(
    loadErrorEl,
    tripDetailsEl,
    travelersEl,
    el("div", { className: "candidates-header" }, [el("h2", { textContent: "Candidate destinations" }), addCandidateBtn]),
    el("p", { className: "muted section-hint", textContent: "Add places you're considering, then rank them together." }),
    candidateError,
    candidatesEl,
    discoverEl
  );

  addCandidateBtn.addEventListener("click", async () => {
    const result = await candidateFormDialog(null);
    if (!result) return;
    candidateError.replaceChildren();
    try {
      await addCandidate(tripId, result, myUid);
    } catch (err) {
      candidateError.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  });

  function renderTripDetails() {
    if (isEditingInside(tripDetailsEl)) return; // never wipe an active edit (§8)
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
    const nameInput = el("input", { type: "text", value: traveler.name });
    const cityInput = el("input", { type: "text", value: traveler.homeCity, placeholder: "Home city" });
    const airportInput = el("input", { type: "text", value: traveler.homeAirport, placeholder: "Airport", maxLength: 4 });

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
      const selectedFlights = { ...(trip.selectedFlights || {}) };
      delete selectedFlights[traveler.id];
      try {
        await updateTripFields(tripId, { travelers, selectedFlights });
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
    if (isEditingInside(travelersEl)) return; // never wipe an active edit (§8)
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
      el("h2", { textContent: "Travelers" }),
      ...(trip.travelers || []).map(travelerRow),
      addBtn,
      travelerError
    );
  }

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
      const fields = { destination: { city: candidate.city, country: candidate.country, lat, lng, airport: candidate.airport || "" } };
      if (trip.status === "exploring") fields.status = "planning";
      await updateTripFields(tripId, fields);
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(button, false);
    }
  }

  function renderCandidateCard(candidate) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const details = [];
    if (candidate.why) details.push(el("p", { textContent: candidate.why }));
    if (candidate.roughPriceNote) details.push(el("p", { className: "muted", textContent: candidate.roughPriceNote }));
    if (candidate.dateIdea) details.push(el("p", { className: "muted", textContent: candidate.dateIdea }));
    const safeLink = candidate.link ? safeUrl(candidate.link) : null;
    if (safeLink) {
      details.push(el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Link" }));
    }

    const rank = rankControl({
      votes: candidate.votes || {},
      myUid,
      usersById,
      onVote: (choice) => {
        voteOnCandidate(tripId, candidate.id, myUid, choice).catch((err) => {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
        });
      },
    });

    const chooseBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Choose this destination" });
    chooseBtn.addEventListener("click", () => chooseDestination(candidate, chooseBtn, errorHolder));

    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", async () => {
      const result = await candidateFormDialog(candidate);
      if (!result) return;
      try {
        await updateCandidate(tripId, candidate.id, result);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog(`Delete ${candidate.city}, ${candidate.country}?`);
      if (!confirmed) return;
      try {
        await deleteCandidate(tripId, candidate.id);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const { element: commentsEl, unsubscribe: commentsUnsub } = renderComments({
      tripId,
      targetType: "candidate",
      targetId: candidate.id,
      myUid,
      usersById,
    });
    candidateCommentUnsubscribes.push(commentsUnsub);

    return el("article", { className: "card candidate-card" }, [
      el("h3", { textContent: `${candidate.city}, ${candidate.country}` }),
      ...details,
      rank,
      el("div", { className: "candidate-actions" }, [chooseBtn, editBtn, deleteBtn]),
      errorHolder,
      commentsEl,
    ]);
  }

  function renderCandidates() {
    for (const unsub of candidateCommentUnsubscribes) unsub();
    candidateCommentUnsubscribes = [];
    const sorted = sortByRank(candidates);
    if (sorted.length === 0) {
      candidatesEl.replaceChildren(el("p", { className: "empty-state", textContent: "No candidates yet." }));
      return;
    }
    candidatesEl.replaceChildren(...sorted.map(renderCandidateCard));
  }

  function renderDiscover() {
    const rows = [externalLinkRow(googleFlightsExploreUrl(), "Google Flights Explore")];
    const dest = trip.destination;
    if (dest) {
      if (dest.lat == null || dest.lng == null) {
        rows.push(
          el("p", {
            className: "field-error",
            textContent: "Location needed for this destination — this will be set once the Places map is built (Phase 2).",
          })
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

  function rerender() {
    if (!trip) return;
    renderTripDetails();
    renderTravelers();
    renderCandidates();
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
    (err) => candidatesEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );

  return () => {
    unsubTrip();
    unsubUsers();
    unsubCandidates();
    for (const unsub of candidateCommentUnsubscribes) unsub();
  };
}
