import {
  watchTrip,
  watchUsers,
  watchFlights,
  watchIdeas,
  watchOptions,
  watchStays,
  watchCosts,
  updateTripFields,
  updateTravelers,
  getTravelerFlights,
  removeTraveler,
  deleteFlight,
  addCost,
  updateCost,
  deleteCost,
} from "../store.js";
import { el, setPending, confirmDialog, friendlyError, field, dialogShell, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { parseMoney, formatMoney } from "../lib/money.js";
import { computeBudget } from "../lib/totals.js";
import { chosenStayIds } from "../lib/selection.js";
import { stopsFor, totalFor } from "../lib/route.js";
import { safeUrl } from "../lib/links.js";
import { loadAirports } from "../lookup.js";

function costFormDialog(existing) {
  return dialogShell("cost-dialog", (finish) => {
    const labelInput = el("input", { type: "text", value: existing?.label || "" });
    const amountInput = el("input", { type: "text", value: existing ? (existing.amountCents / 100).toFixed(2) : "" });
    const noteInput = el("input", { type: "text", value: existing?.note || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: existing ? "Save" : "Add" });
    const form = el("form", { method: "dialog" }, [
      field("Label", labelInput),
      field("Amount", amountInput),
      field("Note", noteInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const label = labelInput.value.trim();
      const cents = parseMoney(amountInput.value);
      if (!label) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Label is required." }));
        return;
      }
      if (cents === null || cents < 0) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "That amount didn't look right — try something like 245 or 245.50." }));
        return;
      }
      finish({ label, amountCents: cents, note: noteInput.value.trim() });
    });
    return { form, focusEl: labelInput };
  });
}

/** The traveler the budget and chosen-route summary focus on: whoever's
 * signed in, or the first traveler when nobody matches (§4.6's own pattern). */
function myTraveler(trip, myUid) {
  const travelers = trip.travelers || [];
  return travelers.find((t) => t.uid === myUid) || travelers[0] || null;
}

/** Renders the Overview tab (V4 §9). Returns a single unsubscribe function. */
export function renderOverviewPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let flights = [];
  let ideas = [];
  let options = [];
  let stays = [];
  let costs = [];
  let airports = null;

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const tripDetailsEl = el("div", { className: "trip-details card" });
  const travelersEl = el("div", { className: "travelers-section card" });
  const travelerError = el("div", { className: "field-error-holder" });
  const routeSummaryEl = el("div", { className: "route-summary card" });
  const costsSectionEl = el("div", { className: "costs-section card" });
  const totalsCardEl = el("div", { className: "totals-card card" });
  const albumEl = el("div", { className: "card" });
  const commentsEl = el("div", {});

  function onError(message) {
    loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
  }

  const addCostBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add a split cost" });
  addCostBtn.addEventListener("click", async () => {
    const result = await costFormDialog(null);
    if (!result) return;
    try {
      await addCost(tripId, result, myUid);
    } catch (err) {
      onError(friendlyError(err));
    }
  });

  container.replaceChildren(
    loadErrorEl,
    tripDetailsEl,
    travelersEl,
    routeSummaryEl,
    el("div", { className: "costs-header" }, [el("h2", { textContent: "Split costs" }), addCostBtn]),
    costsSectionEl,
    el("h2", { textContent: "Budget" }),
    totalsCardEl,
    albumEl,
    commentsEl
  );

  function renderTripDetails() {
    const fieldError = el("div", { className: "field-error-holder" });
    const nameInput = el("input", { type: "text", value: trip.name });
    const startInput = el("input", { type: "date", value: trip.startDate || "" });
    const endInput = el("input", { type: "date", value: trip.endDate || "" });
    const currencyInput = el("input", { type: "text", value: trip.currency, maxLength: 3 });

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

    tripDetailsEl.replaceChildren(
      field("Trip name", nameInput),
      el("div", { className: "field-row" }, [field("Start date", startInput), field("End date", endInput)]),
      field("Currency", currencyInput),
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
      const confirmed = await confirmDialog(`Remove ${traveler.name}?`, "Remove");
      if (!confirmed) return;
      const travelers = trip.travelers.filter((t) => t.id !== traveler.id);
      try {
        // Their flight options would otherwise be orphaned: Routes lists options
        // per traveler, so nobody could see or delete them afterwards (§7.5).
        const theirFlights = await getTravelerFlights(tripId, traveler.id);
        if (theirFlights.length > 0) {
          const alsoDelete = await confirmDialog(
            `Also delete ${theirFlights.length} flight option${theirFlights.length === 1 ? "" : "s"} saved for ${traveler.name}?`,
            "Delete"
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

  /** This trip's chosen option, as `{ idea, option }`, or null when nothing's
   * chosen or the chosen option no longer exists. */
  function chosenRoute() {
    if (!trip.chosenOptionId) return null;
    const option = options.find((o) => o.id === trip.chosenOptionId);
    if (!option) return null;
    const idea = ideas.find((i) => i.id === option.ideaId);
    if (!idea) return null;
    return { idea, option };
  }

  function renderRouteSummary() {
    const hint = el("p", { className: "empty-state" }, [
      "No route chosen yet. Go to ",
      el("a", { href: `#/trip/${tripId}/routes`, textContent: "Routes" }),
      " to pick one.",
    ]);
    const route = chosenRoute();
    const traveler = myTraveler(trip, myUid);
    if (!route || !traveler || !airports) {
      routeSummaryEl.replaceChildren(el("h2", { textContent: "Route" }), hint);
      return;
    }
    const homeFlights = flights.filter(
      (f) => f.role === "home" && f.ideaId === route.idea.id && f.travelerId === traveler.id && f.picked !== false
    );
    const hopFlights = flights.filter((f) => f.role === "hop" && f.optionId === route.option.id);
    const stops = stopsFor({ homeFlights, hopFlights, airports });
    const path = [...new Set(stops.map((s) => s.city).filter(Boolean))].join(" → ");
    const { cents, complete } = totalFor({ homeFlights, hopFlights });

    routeSummaryEl.replaceChildren(
      el("h2", { textContent: "Route" }),
      el("p", {}, [el("a", { href: `#/trip/${tripId}/routes`, textContent: path || route.option.name })]),
      el("p", { className: "muted" }, [
        `${traveler.name}: ${complete ? "" : "at least "}${formatMoney(cents, trip.currency)}`,
      ])
    );
  }

  function renderCostsSection() {
    const rows = costs.map((cost) => {
      const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
      editBtn.addEventListener("click", async () => {
        const result = await costFormDialog(cost);
        if (!result) return;
        try {
          await updateCost(tripId, cost.id, result);
        } catch (err) {
          onError(friendlyError(err));
        }
      });
      const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
      deleteBtn.addEventListener("click", async () => {
        const confirmed = await confirmDialog(`Delete "${cost.label}"?`, "Delete");
        if (!confirmed) return;
        try {
          await deleteCost(tripId, cost.id);
        } catch (err) {
          onError(friendlyError(err));
        }
      });
      return el(
        "div",
        { className: "cost-row" },
        [
          el("span", { textContent: cost.label }),
          el("span", { textContent: formatMoney(cost.amountCents, trip.currency) }),
          cost.note ? el("span", { className: "muted", textContent: cost.note }) : null,
          editBtn,
          deleteBtn,
        ].filter(Boolean)
      );
    });

    const body = rows.length > 0 ? rows : [el("p", { className: "empty-state", textContent: "No split costs yet. Add one for things like a rental car or groceries." })];
    costsSectionEl.replaceChildren(...body);
  }

  function renderTotalsCard() {
    const travelers = trip.travelers || [];
    const route = chosenRoute();
    const homeFlightsByTraveler = {};
    for (const traveler of travelers) {
      homeFlightsByTraveler[traveler.id] = route
        ? flights.filter((f) => f.role === "home" && f.ideaId === route.idea.id && f.travelerId === traveler.id && f.picked !== false)
        : [];
    }
    const hopFlights = route ? flights.filter((f) => f.role === "hop" && f.optionId === route.option.id) : [];
    const chosenStays = chosenStayIds(trip)
      .map((id) => stays.find((s) => s.id === id))
      .filter(Boolean);
    const result = computeBudget({ travelers, homeFlightsByTraveler, hopFlights, stays: chosenStays, sharedCosts: costs });

    const rows = result.travelerTotals.map((t) =>
      el("div", { className: "totals-row" }, [el("span", { textContent: t.name }), el("span", { textContent: formatMoney(t.totalCents, trip.currency) })])
    );
    const combinedRow = el("div", { className: "totals-row totals-combined" }, [
      el("span", { textContent: "Everyone together" }),
      el("span", { textContent: formatMoney(result.combinedCents, trip.currency) }),
    ]);
    const heading = el("h3", { textContent: result.complete ? "Total" : "Total so far (missing some prices)" });
    const body = [heading, ...rows, combinedRow];
    if (result.missing.length > 0) {
      body.push(el("ul", { className: "totals-missing" }, result.missing.map((m) => el("li", { textContent: m }))));
    }
    totalsCardEl.replaceChildren(...body);
  }

  function renderAlbum() {
    const fieldError = el("div", { className: "field-error-holder" });
    const urlInput = el("input", { type: "text", value: trip.albumUrl || "", placeholder: "https://photos.app.goo.gl/…" });
    urlInput.addEventListener("change", () => {
      fieldError.replaceChildren();
      const value = urlInput.value.trim();
      updateTripFields(tripId, { albumUrl: value || null }).catch((err) => {
        fieldError.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      });
    });
    const url = trip.albumUrl ? safeUrl(trip.albumUrl) : null;
    const children = [el("h2", { textContent: "Album" }), field("Album link", urlInput), fieldError];
    if (url) children.push(el("a", { href: url, target: "_blank", rel: "noopener noreferrer", textContent: "Open album" }));
    albumEl.replaceChildren(...children);
  }

  let unsubComments = null;

  // Comments keep their own draft/open state across recreation (comments.js),
  // so rebuilding this on every render — to pick up fresh usersById — is safe.
  function renderTripComments() {
    if (unsubComments) unsubComments();
    const { element, unsubscribe } = renderComments({ tripId, targetType: "trip", targetId: tripId, myUid, usersById });
    commentsEl.replaceChildren(el("h2", { textContent: "Trip comments" }), element);
    unsubComments = unsubscribe;
  }

  // Each section defers its own rebuild while someone is typing in it (§8), so a
  // live update to one never disturbs an edit in progress in another.
  function rerender() {
    if (!trip) return;
    renderWhenIdle(tripDetailsEl, renderTripDetails);
    renderWhenIdle(travelersEl, renderTravelers);
    renderRouteSummary();
    renderCostsSection();
    renderTotalsCard();
    renderAlbum();
    renderTripComments();
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
  const unsubFlights = watchFlights(
    tripId,
    (f) => {
      flights = f;
      if (trip) {
        renderRouteSummary();
        renderTotalsCard();
      }
    },
    (err) => onError(friendlyError(err))
  );
  const unsubIdeas = watchIdeas(
    tripId,
    (i) => {
      ideas = i;
      if (trip) {
        renderRouteSummary();
        renderTotalsCard();
      }
    },
    (err) => onError(friendlyError(err))
  );
  const unsubOptions = watchOptions(
    tripId,
    (o) => {
      options = o;
      if (trip) {
        renderRouteSummary();
        renderTotalsCard();
      }
    },
    (err) => onError(friendlyError(err))
  );
  const unsubStays = watchStays(
    tripId,
    (s) => {
      stays = s;
      if (trip) renderTotalsCard();
    },
    (err) => onError(friendlyError(err))
  );
  const unsubCosts = watchCosts(
    tripId,
    (c) => {
      costs = c;
      if (trip) {
        renderCostsSection();
        renderTotalsCard();
      }
    },
    (err) => onError(friendlyError(err))
  );

  loadAirports()
    .then((loaded) => {
      airports = loaded;
      if (trip) renderRouteSummary();
    })
    .catch((err) => onError(friendlyError(err)));

  return () => {
    unsubTrip();
    unsubUsers();
    unsubFlights();
    unsubIdeas();
    unsubOptions();
    unsubStays();
    unsubCosts();
    if (unsubComments) unsubComments();
  };
}
