import { watchTrip, watchUsers, watchFlights, watchIdeas, watchOptions, watchStays, watchCosts, updateTripFields } from "../store.js";
import { el, friendlyError, field, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { renderTravelers } from "./travelers.js";
import { addCostButton, renderSplitCosts } from "./splitCosts.js";
import { formatMoney } from "../lib/money.js";
import { choiceFor, tripBudget } from "../lib/choices.js";
import { chosenStayIds } from "../lib/selection.js";
import { stopsFor, totalFor } from "../lib/route.js";
import { safeUrl } from "../lib/links.js";
import { loadAirports } from "../lookup.js";

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

  const addCostBtn = addCostButton({ tripId, myUid, onError: (err) => onError(friendlyError(err)) });

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
      el("div", { className: "field-row" }, [field("Start date", startInput), field("End date", endInput)]),
      fieldError
    );
  }

  /** One traveler's own chosen route, as `{ idea, option }`, or null when they
   * haven't chosen or what they chose no longer exists (§5.3). */
  function chosenRoute(traveler) {
    if (!traveler) return null;
    const choice = choiceFor(trip, traveler.id, options);
    const option = choice.optionId ? options.find((o) => o.id === choice.optionId) : null;
    if (!option) return null;
    const idea = ideas.find((i) => i.id === choice.ideaId);
    if (!idea) return null;
    return { idea, option };
  }

  function renderRouteSummary() {
    const hint = el("p", { className: "empty-state" }, [
      "No route chosen yet. Go to ",
      el("a", { href: `#/trip/${tripId}/routes`, textContent: "Routes" }),
      " to pick one.",
    ]);
    const traveler = myTraveler(trip, myUid);
    const route = chosenRoute(traveler);
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

  function renderTotalsCard() {
    const travelers = trip.travelers || [];
    const chosenStays = chosenStayIds(trip)
      .map((id) => stays.find((s) => s.id === id))
      .filter(Boolean);
    const result = tripBudget({ trip, travelers, options, flights, stays: chosenStays, costs, airports });

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

  let flushTravelers = () => {};
  function renderTravelersCard() {
    flushTravelers = renderTravelers(travelersEl, travelerError, { tripId, trip, usersById });
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

  // Backup for cases a tab switch doesn't trigger this module's own teardown
  // first (e.g. the phone's PWA going to the background).
  function onVisibilityChange() {
    if (document.visibilityState === "hidden") flushTravelers();
  }
  function onPageHide() {
    flushTravelers();
  }
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);

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
    flushTravelers();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
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
