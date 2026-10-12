import { watchTrip, watchUsers, watchFlights, watchIdeas, watchOptions, watchStays, watchCosts, updateTripFields } from "../store.js";
import { el, friendlyError, field, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { renderTravelers } from "./travelers.js";
import { addCostButton, renderSplitCosts } from "./splitCosts.js";
import { formatMoney } from "../lib/money.js";
import { choiceFor, tripBudget } from "../lib/choices.js";
import { chosenStayIds } from "../lib/selection.js";
import { safeUrl } from "../lib/links.js";
import { loadAirports } from "../lookup.js";

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
  const routeSummaryEl = el("div", { className: "overview-route card" });
  const costsSectionEl = el("div", { className: "costs-section card" });
  const totalsCardEl = el("div", { className: "totals-card card" });
  const albumEl = el("div", { className: "card" });
  const commentsEl = el("div", {});

  function onError(message) {
    loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
  }

  const addCostBtn = addCostButton({ tripId, myUid, getTravelers: () => (trip && trip.travelers) || [], onError: (err) => onError(friendlyError(err)) });

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
    tripDetailsEl.replaceChildren(
      field("Trip name", nameInput),
      el("div", { className: "field-row trip-dates-row" }, [field("Start date", startInput), field("End date", endInput)]),
      fieldError
    );
  }

  function renderRouteSummary() {
    const heading = el("h2", { textContent: "Route" });
    const travelers = trip.travelers || [];
    const routesLink = (text) => el("a", { href: `#/trip/${tripId}/routes`, textContent: text });
    if (travelers.length === 0) {
      routeSummaryEl.replaceChildren(heading, el("p", { className: "empty-state" }, ["Add a traveler, then pick routes on ", routesLink("Routes"), "."]));
      return;
    }
    const lines = travelers.map((traveler) => {
      const choice = choiceFor(trip, traveler.id, options);
      const idea = ideas.find((i) => i.id === choice.ideaId);
      const option = options.find((o) => o.id === choice.optionId);
      const parts = [idea && idea.name, option && option.name].filter(Boolean);
      return el("p", { className: "overview-route-line" }, [
        el("b", { textContent: traveler.name }),
        " · ",
        parts.length > 0 ? routesLink(parts.join(" · ")) : routesLink("Not chosen yet"),
      ]);
    });
    routeSummaryEl.replaceChildren(heading, ...lines);
  }

  function renderTotalsCard() {
    const travelers = trip.travelers || [];
    const chosenStays = chosenStayIds(trip)
      .map((id) => stays.find((s) => s.id === id))
      .filter(Boolean);
    const result = tripBudget({ trip, travelers, options, flights, stays: chosenStays, costs, airports });
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

  function renderTravelersCard() {
    renderTravelers(travelersEl, travelerError, { tripId, getTrip: () => trip, usersById, myUid });
  }

  function renderCostsSection() {
    renderSplitCosts(costsSectionEl, { tripId, trip, costs, onError: (err) => onError(friendlyError(err)) });
  }

  // Each section defers its own rebuild while someone is typing in it (§8), so a
  // live update to one never disturbs an edit in progress in another.
  function rerender() {
    if (!trip) return;
    renderWhenIdle(tripDetailsEl, renderTripDetails);
    renderWhenIdle(travelersEl, renderTravelersCard);
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
