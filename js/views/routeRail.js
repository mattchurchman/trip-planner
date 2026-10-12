// The option card and its rail of stops/flights (V4 §4.1, §4.6). Split out of
// routes.js because the rail — working out stops from flights, then drawing
// them as a track of nodes with the hop flights hanging off it — is its own
// chunk of layout, reused nowhere else.
import { el } from "../ui.js";
import { formatMoney } from "../lib/money.js";
import { nightsLabel } from "../lib/dates.js";
import { formatLegDate } from "../lib/itineraryFormat.js";
import { stopsFor, movements, totalFor, ideaEndpoints } from "../lib/route.js";
import { priceSummary } from "./pricePanel.js";
import { renderItinerary } from "./itinerary.js";

/** Same fallback as flights.js's legsForCard: a flight's `legs` when it has
 * them, otherwise a same-shaped stand-in built from the plain fields. */
function legsForCard(flight) {
  if (flight.legs && flight.legs.length > 0) return flight.legs;
  const legs = [];
  if (flight.outboundDate || flight.fromAirport) {
    legs.push({ date: flight.outboundDate, from: flight.fromAirport, to: flight.toAirport, segments: [] });
  }
  if (flight.returnDate) {
    legs.push({ date: flight.returnDate, from: flight.toAirport, to: flight.fromAirport, segments: [] });
  }
  return legs;
}

/**
 * One flight's compact row inside the rail or the home-flights card: its
 * itinerary, the price summary (§7.8 — T21 replaces this control), and
 * whatever action buttons the caller supplies before Edit/Delete.
 */
export function renderFlightRow(flight, { currency, usersById, onEdit, onDelete, leadingActions = [] } = {}) {
  const itinerary = renderItinerary(legsForCard(flight), { outboundDetails: flight.outboundDetails, returnDetails: flight.returnDetails });
  const summary = priceSummary({ prices: flight.prices || [], currency, usersById });

  const editBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Edit" });
  editBtn.addEventListener("click", onEdit);
  const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete" });
  deleteBtn.addEventListener("click", onDelete);

  const header = el("div", { className: "flight-card-header" }, [
    el("div", { className: "option-header-left" }, [flight.label ? el("span", { textContent: flight.label }) : null].filter(Boolean)),
    summary,
  ]);

  return el("div", { className: "route-flight-row" }, [
    header,
    itinerary,
    el("div", { className: "flight-actions" }, [...leadingActions, editBtn, deleteBtn]),
  ]);
}

function stopLine(stop) {
  const dateText = `${formatLegDate(stop.from) || "Date not set"} – ${formatLegDate(stop.to) || "Date not set"}`;
  return el("div", { className: "route-stop" }, [
    el("span", {}, [el("b", { textContent: stop.city || stop.code || "Unknown" }), " ", el("span", { className: "mono muted", textContent: stop.code })]),
    el("span", { className: "muted", textContent: `${nightsLabel(stop.from, stop.to)} · ${dateText}` }),
  ]);
}

function warningBlocks(stop) {
  return stop.warnings.map((message) => el("p", { className: "route-warn", textContent: message }));
}

function railNode(isHome) {
  return el("div", { className: "route-rail-track" }, [
    el("span", { className: `route-rail-node${isHome ? " route-rail-node-home" : ""}` }),
    el("span", { className: "route-rail-stem" }),
  ]);
}

/**
 * Builds one option's card (V4 §4.6): name, total, path line, Chosen/Cheapest
 * badges, and — when `isOpen` — the rail of stops with each hop flight
 * hanging between them, plus Choose this option / Unchoose, Add flight,
 * Rename and Delete.
 */
export function renderOptionCard({
  idea,
  option,
  traveler,
  homeFlights,
  hopFlights,
  airports,
  trip,
  usersById,
  isOpen,
  isChosen,
  isCheapest,
  onToggle,
  onChoose,
  onRename,
  onDelete,
  onAddFlight,
  onEditFlight,
  onDeleteFlight,
}) {
  const stops = stopsFor({ homeFlights, hopFlights, airports });
  const hops = movements(hopFlights);
  const { cents, complete } = totalFor({ homeFlights, hopFlights });
  const hopFlightsById = Object.fromEntries(hopFlights.map((f) => [f.id, f]));
  const path = [...new Set(stops.map((s) => s.city).filter(Boolean))].join(" → ");

  const badges = [
    isChosen ? el("span", { className: "chosen-badge", textContent: "Chosen ✓" }) : null,
    isCheapest ? el("span", { className: "badge-new-low", textContent: "Cheapest" }) : null,
  ].filter(Boolean);

  const detailsText = `${hopFlights.length} flight${hopFlights.length === 1 ? "" : "s"} · ${isOpen ? "hide" : "show"} details`;

  const headerBtn = el(
    "button",
    { type: "button", className: "route-option-head", attrs: { "aria-expanded": isOpen ? "true" : "false" } },
    [
      el("div", { className: "row" }, [
        el("span", { className: "route-option-name", textContent: option.name }),
        el("span", { className: "route-option-total mono", textContent: `${complete ? "" : "At least "}${formatMoney(cents, trip.currency)}` }),
      ]),
      el("div", { className: "row" }, [
        el("span", { className: "muted", textContent: path || "No flights yet" }),
        el("span", { className: "muted", textContent: detailsText }),
      ]),
      badges.length ? el("div", { className: "route-option-badges" }, badges) : null,
    ].filter(Boolean)
  );
  headerBtn.addEventListener("click", onToggle);

  const card = el("article", { className: `route-option${isChosen ? " route-option-chosen" : ""}` }, [headerBtn]);
  if (!isOpen) return card;

  const rail = el("ol", { className: "route-rail" });
  if (stops.length === 0) {
    rail.append(el("li", {}, [el("p", { className: "empty-state", textContent: "No flights yet for this option. Add one below." })]));
  }
  const seenFlightIds = new Set();
  stops.forEach((stop, i) => {
    const right = el("div", {}, [stopLine(stop), ...warningBlocks(stop)]);
    const movement = hops[i];
    if (movement) {
      const flight = hopFlightsById[movement.flightId] || null;
      if (flight && !seenFlightIds.has(flight.id)) {
        seenFlightIds.add(flight.id);
        right.append(
          el("div", { className: "route-hop" }, [
            renderFlightRow(flight, {
              currency: trip.currency,
              usersById,
              onEdit: () => onEditFlight(flight),
              onDelete: () => onDeleteFlight(flight),
            }),
          ])
        );
      } else if (flight) {
        right.append(el("p", { className: "muted", textContent: `Return half of ${flight.label || "the flight above"}` }));
      }
    }
    rail.append(el("li", { className: "route-rail-item" }, [railNode(false), right]));
  });

  if (stops.length > 0) {
    const { outCode } = ideaEndpoints(homeFlights);
    const lastStop = stops[stops.length - 1];
    const homeLine = el("div", { className: "route-stop" }, [
      el("span", {}, [el("b", { textContent: "Fly home" }), " ", el("span", { className: "mono muted", textContent: `${outCode || lastStop.code || "?"} → ${traveler.homeAirport || traveler.homeCity || "home"}` })]),
      el("span", { className: "muted", textContent: formatLegDate(lastStop.to) || "Date not set" }),
    ]);
    rail.append(el("li", { className: "route-rail-item" }, [railNode(true), homeLine]));
  }

  const addFlightBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add flight" });
  addFlightBtn.addEventListener("click", onAddFlight);
  const chooseBtn = el("button", { type: "button", className: "btn btn-primary", textContent: isChosen ? "Unchoose" : "Choose this option" });
  chooseBtn.addEventListener("click", onChoose);
  const renameBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Rename" });
  renameBtn.addEventListener("click", onRename);
  const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete" });
  deleteBtn.addEventListener("click", onDelete);

  card.append(
    el("div", { className: "route-option-body" }, [
      rail,
      el("div", { className: "route-option-foot" }, [chooseBtn, addFlightBtn, renameBtn, deleteBtn]),
    ])
  );
  return card;
}
