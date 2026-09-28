import { watchTrip, watchUsers, watchFlights, watchStays, watchCosts, addCost, updateCost, deleteCost } from "../store.js";
import { el, confirmDialog, friendlyError, field, dialogShell } from "../ui.js";
import { parseMoney, formatMoney } from "../lib/money.js";
import { computeTotals } from "../lib/totals.js";
import { chosenFlightIds, chosenStayIds } from "../lib/selection.js";
import { createFlightsSection } from "./flights.js";
import { createStaysSection } from "./stays.js";

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
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Enter a valid amount." }));
        return;
      }
      finish({ label, amountCents: cents, note: noteInput.value.trim() });
    });
    return { form, focusEl: labelInput };
  });
}

/** Renders the Flights & stays tab (§7.7). Returns a single unsubscribe function. */
export function renderTravelPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let flights = [];
  let stays = [];
  let costs = [];

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const costsSectionEl = el("div", { className: "costs-section card" });
  const totalsCardEl = el("div", { className: "totals-card card" });

  function onError(message) {
    loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
  }

  const flightsSection = createFlightsSection({ tripId, myUid, onError });
  const staysSection = createStaysSection({ tripId, myUid, onError });

  const addCostBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add shared cost" });
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
    flightsSection.element,
    staysSection.element,
    el("div", { className: "costs-header" }, [el("h2", { textContent: "Shared costs" }), addCostBtn]),
    costsSectionEl,
    el("h2", { textContent: "Totals" }),
    totalsCardEl
  );

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
        const confirmed = await confirmDialog(`Delete "${cost.label}"?`);
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

    const body = rows.length > 0 ? rows : [el("p", { className: "empty-state", textContent: "No shared costs yet." })];
    costsSectionEl.replaceChildren(...body);
  }

  function renderTotalsCard() {
    const travelers = trip.travelers || [];
    const flightsById = Object.fromEntries(flights.map((f) => [f.id, f]));
    const selectedFlightIdsByTraveler = Object.fromEntries(travelers.map((t) => [t.id, chosenFlightIds(trip, t.id)]));
    const chosenStays = chosenStayIds(trip)
      .map((id) => stays.find((s) => s.id === id))
      .filter(Boolean);
    const result = computeTotals({ travelers, selectedFlightIdsByTraveler, flightsById, stays: chosenStays, sharedCosts: costs });

    const rows = result.travelerTotals.map((t) =>
      el("div", { className: "totals-row" }, [el("span", { textContent: t.name }), el("span", { textContent: formatMoney(t.totalCents, trip.currency) })])
    );
    const combinedRow = el("div", { className: "totals-row totals-combined" }, [
      el("span", { textContent: "Combined" }),
      el("span", { textContent: formatMoney(result.combinedCents, trip.currency) }),
    ]);
    const heading = el("h3", { textContent: result.complete ? "Total" : "Partial total" });
    const body = [heading, ...rows, combinedRow];
    if (result.missing.length > 0) {
      body.push(el("ul", { className: "totals-missing" }, result.missing.map((m) => el("li", { textContent: m }))));
    }
    totalsCardEl.replaceChildren(...body);
  }

  function rerenderAll() {
    if (!trip) return;
    flightsSection.render(flights, trip, usersById);
    staysSection.render(stays, trip, usersById);
    renderCostsSection();
    renderTotalsCard();
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
  const unsubFlights = watchFlights(
    tripId,
    (f) => {
      flights = f;
      if (trip) {
        flightsSection.render(flights, trip, usersById);
        renderTotalsCard();
      }
    },
    (err) => onError(friendlyError(err))
  );
  const unsubStays = watchStays(
    tripId,
    (s) => {
      stays = s;
      if (trip) {
        staysSection.render(stays, trip, usersById);
        renderTotalsCard();
      }
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

  return () => {
    unsubTrip();
    unsubUsers();
    unsubFlights();
    unsubStays();
    unsubCosts();
    flightsSection.unsubscribe();
    staysSection.unsubscribe();
  };
}
