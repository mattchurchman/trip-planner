import { watchTrip, watchUsers, watchFlights, watchIdeas, watchOptions, watchStays, watchCosts, updateTripFields } from "../store.js";
import { el, field, friendlyError, dialogShell, setPending, routeRibbon } from "../ui.js";
import { renderComments } from "./comments.js";
import { renderTravelers } from "./travelers.js";
import { addCostButton, renderSplitCosts } from "./splitCosts.js";
import { renderSharedLinks } from "./sharedLinks.js";
import { formatMoney } from "../lib/money.js";
import { choiceFor, mergedStops, tripBudget } from "../lib/choices.js";
import { chosenStayIds } from "../lib/selection.js";
import { ribbonStops } from "../lib/ribbon.js";
import { tripStage } from "../lib/stage.js";
import { loadAirports } from "../lookup.js";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

/** The Edit trip sheet (R7 §7.2): name, start and end date, same validation
 * and save logic the inline fields used before T61 moved them off the page. */
function editTripDialog(trip, tripId) {
  return dialogShell("trip-dialog", (finish) => {
    const nameInput = el("input", { type: "text", value: trip.name });
    const startInput = el("input", { type: "date", value: trip.startDate || "" });
    const endInput = el("input", { type: "date", value: trip.endDate || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const saveBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });

    const form = el("form", { method: "dialog" }, [
      el("h3", { textContent: "Edit trip" }),
      field("Trip name", nameInput),
      el("div", { className: "field-row trip-dates-row" }, [field("Start date", startInput), field("End date", endInput)]),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, saveBtn]),
    ]);

    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorHolder.replaceChildren();
      const name = nameInput.value.trim();
      if (!name) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Trip name can't be blank." }));
        return;
      }
      if (startInput.value && endInput.value && endInput.value < startInput.value) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "End date can't be before the start date." }));
        return;
      }
      setPending(saveBtn, true);
      try {
        await updateTripFields(tripId, { name, startDate: startInput.value || null, endDate: endInput.value || null });
        finish({ name });
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
        setPending(saveBtn, false);
      }
    });

    return { form, focusEl: nameInput };
  });
}

/** Renders the Overview tab (R7 §7.2). Returns a single unsubscribe function. */
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
  const summaryCardEl = el("div", { className: "card overview-summary-card" });
  const editTripBtn = el("button", { type: "button", className: "btn btn-quiet overview-edit-trip", textContent: "Edit trip" });
  const travelersEl = el("div", { className: "travelers-section card" });
  const travelerError = el("div", { className: "field-error-holder" });
  const totalsCardEl = el("div", { className: "totals-card card" });
  const sharedLinksEl = el("div", {});
  const commentsEl = el("div", {});

  function onError(message) {
    loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
  }

  const addCostBtn = addCostButton({ tripId, myUid, getTravelers: () => (trip && trip.travelers) || [], onError: (err) => onError(friendlyError(err)) });

  editTripBtn.addEventListener("click", () => editTripDialog(trip, tripId));

  container.replaceChildren(
    loadErrorEl,
    summaryCardEl,
    editTripBtn,
    travelersEl,
    el("h2", { textContent: "Budget" }),
    totalsCardEl,
    sharedLinksEl,
    commentsEl
  );

  function chosenStays() {
    return chosenStayIds(trip)
      .map((id) => stays.find((s) => s.id === id))
      .filter(Boolean);
  }

  function renderSummaryCard() {
    const travelers = trip.travelers || [];
    const stage = tripStage(trip, todayString());
    const stageBadge = el("span", { className: `stage-badge stage-${stage.key}`, textContent: stage.shortLabel });
    const header = el("div", { className: "overview-summary-header" }, [
      el("span", { className: "overview-summary-label", textContent: "Your route" }),
      stageBadge,
    ]);

    const routesLink = el("a", { href: `#/trip/${tripId}/routes`, textContent: "Routes" });
    let routeBody;
    if (airports && travelers.length > 0) {
      const merged = mergedStops({ travelers, trip, options, flights, airports });
      routeBody = merged.length > 0
        ? routeRibbon(ribbonStops(merged, airports), { onDark: true })
        : el("p", { className: "empty-state" }, ["No route chosen yet — pick one on ", routesLink, "."]);
    } else {
      routeBody = el("p", { className: "empty-state" }, ["No route chosen yet — pick one on ", routesLink, "."]);
    }

    let totalsRow = null;
    const me = travelers.find((t) => t.uid === myUid) || travelers[0] || null;
    if (me) {
      const budget = tripBudget({ trip, travelers, options, flights, stays: chosenStays(), costs, airports });
      const mine = budget.travelerTotals.find((t) => t.travelerId === me.id);
      const choice = choiceFor(trip, me.id, options);
      const idea = ideas.find((i) => i.id === choice.ideaId);
      const option = options.find((o) => o.id === choice.optionId);
      const routeLabel = [idea && idea.name, option && option.name].filter(Boolean).join(" · ") || "Not chosen yet";
      const mineCents = (mine && mine.totalCents) || 0;
      const minePrefix = mine && !mine.complete ? "at least " : "";
      totalsRow = el("div", { className: "overview-summary-totals" }, [
        el("div", { className: "overview-summary-mine" }, [
          el("span", { className: "overview-summary-mine-label", textContent: "Your total" }),
          el("span", { className: "overview-summary-mine-amount", textContent: `${minePrefix}${formatMoney(mineCents, trip.currency)}` }),
        ]),
        el("div", { className: "overview-summary-group" }, [
          el("span", { className: "overview-summary-group-route", textContent: routeLabel }),
          el("span", { className: "overview-summary-group-amount", textContent: `Group ${formatMoney(budget.combinedCents, trip.currency)}` }),
        ]),
      ]);
    }

    summaryCardEl.replaceChildren(...[header, routeBody, el("hr", { className: "overview-summary-divider" }), totalsRow].filter(Boolean));
  }

  function renderTotalsCard() {
    const travelers = trip.travelers || [];
    const result = tripBudget({ trip, travelers, options, flights, stays: chosenStays(), costs, airports });
    const money = (cents) => formatMoney(cents, trip.currency);
    const part = (label, cents) =>
      el("div", { className: "totals-part" }, [el("span", { textContent: label }), el("span", { textContent: money(cents) })]);

    const rows = result.travelerTotals.map((t) =>
      el("details", { className: "totals-traveler" }, [
        el("summary", { className: "totals-row" }, [
          el("span", { textContent: t.name }),
          el("span", { textContent: `${t.complete ? "" : "at least "}${money(t.totalCents)}` }),
        ]),
        part("Flights from home", t.homeCents),
        part("Option flights", t.hopCents),
        part("Stays", t.stayCents),
        part("Split costs", t.costCents),
      ])
    );
    const combinedRow = el("div", { className: "totals-row totals-combined" }, [
      el("span", { textContent: "Everyone together" }),
      el("span", { textContent: money(result.combinedCents) }),
    ]);

    const costsRowsEl = el("div", { className: "split-costs-rows" });
    renderSplitCosts(costsRowsEl, { tripId, trip, costs, onError: (err) => onError(friendlyError(err)) });
    const costsTotalCents = costs.reduce((sum, c) => sum + (c.amountCents || 0), 0);
    const costsGroup = el("details", { className: "totals-traveler split-costs-group" }, [
      el("summary", { className: "totals-row" }, [
        el("span", { textContent: "Split costs" }),
        el("span", { textContent: `${costs.length} · ${money(costsTotalCents)}` }),
      ]),
      costsRowsEl,
      addCostBtn,
    ]);

    const heading = el("h3", { textContent: result.complete ? "Total" : "Total so far (missing some prices)" });
    const body = [heading, ...rows, combinedRow, costsGroup];
    if (result.missing.length > 0) {
      body.push(el("ul", { className: "totals-missing" }, result.missing.map((m) => el("li", { textContent: m }))));
    }
    totalsCardEl.replaceChildren(...body);
  }

  function renderSharedLinksCard() {
    renderSharedLinks(sharedLinksEl, { tripId, trip, onError: (err) => onError(friendlyError(err)) });
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

  function renderTravelersCard() {
    renderTravelers(travelersEl, travelerError, { tripId, getTrip: () => trip, usersById, myUid });
  }

  // Every section here opens its edits in a sheet, not an inline field, so a
  // live update rebuilding it never disturbs typing in progress (§8).
  function rerender() {
    if (!trip) return;
    renderSummaryCard();
    renderTravelersCard();
    renderTotalsCard();
    renderSharedLinksCard();
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
        renderSummaryCard();
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
        renderSummaryCard();
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
        renderSummaryCard();
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
        renderSummaryCard();
        renderTotalsCard();
      }
    },
    (err) => onError(friendlyError(err))
  );
  const unsubCosts = watchCosts(
    tripId,
    (c) => {
      costs = c;
      if (trip) renderTotalsCard();
    },
    (err) => onError(friendlyError(err))
  );

  loadAirports()
    .then((loaded) => {
      airports = loaded;
      if (trip) renderSummaryCard();
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
