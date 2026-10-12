// The option card and its rail of stops/flights (V4 §4.1, §4.6). Split out of
// routes.js because the rail — working out stops from flights, then drawing
// them as a track of nodes with the hop flights hanging off it — is its own
// chunk of layout, reused nowhere else.
import { el, setPending } from "../ui.js";
import { formatMoney } from "../lib/money.js";
import { nightsLabel } from "../lib/dates.js";
import { formatLegDate } from "../lib/itineraryFormat.js";
import { stopsFor, movements, totalFor, ideaEndpoints } from "../lib/route.js";
import { byLatestPriceAsc } from "../lib/optionSort.js";
import { forTravelers } from "../lib/choices.js";
import { priceCheck } from "./pricePanel.js";
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
 * itinerary, the price check control (§5), and whatever action buttons the
 * caller supplies before Edit/Delete.
 */
export function renderFlightRow(flight, { tripId, myUid, currency, usersById, onEdit, onDelete, leadingActions = [], extra = null } = {}) {
  const itinerary = renderItinerary(legsForCard(flight), { outboundDetails: flight.outboundDetails, returnDetails: flight.returnDetails });
  const { summary, row } = priceCheck({
    tripId,
    subcollection: "flights",
    docId: flight.id,
    prices: flight.prices || [],
    link: flight.link,
    currency,
    usersById,
    myUid,
  });

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
    row,
    itinerary,
    extra,
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
 * "Who's this for?" on a hop (§7.6): who the flight's price counts for —
 * worked out from who chose the option, or set by hand. `ids` is the
 * resolved list; `onSet(ids)` takes a list of traveler ids, or null for
 * automatic again.
 */
function forControl(flight, { ctx, travelers, editing, onToggle, onSet }) {
  const ids = forTravelers(flight, "hop", ctx);
  const byHand = Array.isArray(flight.forTravelerIds);
  const names = travelers.filter((t) => ids.includes(t.id)).map((t) => t.name);

  const toggleBtn = el("button", { type: "button", className: "btn btn-link route-for-btn", textContent: editing ? "Done" : "Who's this for?" });
  toggleBtn.addEventListener("click", onToggle);
  const line = el("div", { className: "route-for" }, [
    el("span", { className: "muted", textContent: "For: " }),
    el("b", { textContent: names.length ? names.join(", ") : "no one yet" }),
    el("span", { className: "muted", textContent: byHand ? " · Set by hand" : " · Automatic" }),
  ]);
  if (byHand) {
    const resetBtn = el("button", { type: "button", className: "btn btn-link route-for-btn", textContent: "Reset" });
    resetBtn.addEventListener("click", () => onSet(null));
    line.append(resetBtn);
  }
  line.append(toggleBtn);
  if (!editing) return line;

  const pill = (label, pressed, onClick) => {
    const btn = el("button", { type: "button", className: "route-for-pill", textContent: label, attrs: { "aria-pressed": String(pressed) } });
    btn.addEventListener("click", onClick);
    return btn;
  };
  const pills = el("div", { className: "route-for-pills" }, [
    pill("Automatic", !byHand, () => onSet(null)),
    ...travelers.map((t) =>
      pill(t.name, byHand && ids.includes(t.id), () => {
        const next = new Set(ids);
        if (next.has(t.id)) next.delete(t.id);
        else next.add(t.id);
        onSet(travelers.filter((x) => next.has(x.id)).map((x) => x.id));
      })
    ),
  ]);
  return el("div", { className: "route-for-edit" }, [line, pills]);
}

/**
 * Builds one option's card (§7.6): name, its own flights' cost per person, who
 * it's for, path line, Chosen/Cheapest badges (and initials of the other
 * travelers who chose it), and — when `isOpen` — the rail of stops with each
 * hop flight hanging between them, plus Choose this option / Unchoose, Paste
 * flight link, Rename and Delete.
 */
export function renderOptionCard({
  idea,
  option,
  traveler,
  homeFlights,
  hopFlights,
  airports,
  trip,
  tripId,
  myUid,
  usersById,
  ctx,
  travelers,
  othersChosen,
  forEditingId,
  isOpen,
  isChosen,
  isCheapest,
  onToggle,
  onToggleFor,
  onSetFor,
  onChoose,
  onRename,
  onDelete,
  onPasteFlight,
  onEditFlight,
  onDeleteFlight,
}) {
  const stops = stopsFor({ homeFlights, hopFlights, airports });
  const hops = movements(hopFlights);
  // Only this option's own flights: the flights from home are the same under every option.
  const { cents, complete } = totalFor({ homeFlights: [], hopFlights });
  const forNames = travelers.filter((t) => hopFlights.some((f) => forTravelers(f, "hop", ctx).includes(t.id))).map((t) => t.name);
  const hopFlightsById = Object.fromEntries(hopFlights.map((f) => [f.id, f]));
  const path = [...new Set(stops.map((s) => s.city).filter(Boolean))].join(" → ");

  const badges = [
    isChosen ? el("span", { className: "chosen-badge", textContent: `Chosen by ${traveler.name} ✓` }) : null,
    ...othersChosen.map((t) => el("span", { className: "route-initial", textContent: t.name.charAt(0).toUpperCase(), attrs: { title: `Chosen by ${t.name}`, "aria-label": `Chosen by ${t.name}` } })),
    isCheapest ? el("span", { className: "badge-new-low", textContent: "Cheapest" }) : null,
  ].filter(Boolean);

  const flightsText = `${hopFlights.length} flight${hopFlights.length === 1 ? "" : "s"} · ${isOpen ? "hide" : "show"} details`;
  const totalText = hopFlights.length === 0 || complete ? formatMoney(cents, trip.currency) : `At least ${formatMoney(cents, trip.currency)}`;

  const headerBtn = el(
    "button",
    { type: "button", className: "route-option-head", attrs: { "aria-expanded": isOpen ? "true" : "false" } },
    [
      el("div", { className: "row" }, [
        el("span", { className: "route-option-name", textContent: option.name }),
        el("span", { className: "route-option-total mono", textContent: totalText }),
      ]),
      el("div", { className: "row" }, [
        el("span", { className: "muted", textContent: path || "No flights yet" }),
        el("span", { className: "muted", textContent: "per person" }),
      ]),
      el("div", { className: "row" }, [
        el("span", { className: "muted", textContent: hopFlights.length ? `For: ${forNames.length ? forNames.join(", ") : "no one yet"}` : "" }),
        el("span", { className: "muted", textContent: flightsText }),
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
              tripId,
              myUid,
              currency: trip.currency,
              usersById,
              onEdit: () => onEditFlight(flight),
              onDelete: () => onDeleteFlight(flight),
              extra: forControl(flight, {
                ctx,
                travelers,
                editing: forEditingId === flight.id,
                onToggle: () => onToggleFor(flight),
                onSet: (ids) => onSetFor(flight, ids),
              }),
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

  const pasteFlightBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Paste flight link" });
  pasteFlightBtn.addEventListener("click", onPasteFlight);
  const chooseBtn = el("button", { type: "button", className: "btn btn-primary", textContent: isChosen ? "Unchoose" : "Choose this option" });
  chooseBtn.addEventListener("click", onChoose);
  const renameBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Rename" });
  renameBtn.addEventListener("click", onRename);
  const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete" });
  deleteBtn.addEventListener("click", onDelete);

  card.append(
    el("div", { className: "route-option-body" }, [
      rail,
      el("div", { className: "route-option-foot" }, [chooseBtn, pasteFlightBtn, renameBtn, deleteBtn]),
    ])
  );
  return card;
}

/**
 * The home-flights card (V4 §4.6): every alternative the selected traveler has
 * for this idea, cheapest first, each with Use this / Using, and its own
 * **Paste flight link** (T34) — always targeting this traveler and idea.
 * `onTogglePick` gets the flight and its siblings (the other alternatives),
 * since picking one un-picks the ones it replaces. Returns the card's
 * children, ready for `replaceChildren`.
 */
export function homeFlightsCardBody({ traveler, homeFlights, trip, tripId, myUid, usersById, onEdit, onDelete, onTogglePick, onPasteFlight }) {
  function row(flight) {
    const picked = flight.picked !== false;
    const useBtn = el("button", { type: "button", className: "btn btn-small", textContent: picked ? "Using" : "Use this" });
    useBtn.addEventListener("click", async () => {
      setPending(useBtn, true, picked ? "Removing…" : "Using…");
      await onTogglePick(flight, homeFlights);
      setPending(useBtn, false);
    });
    const node = renderFlightRow(flight, {
      tripId,
      myUid,
      currency: trip.currency,
      usersById,
      onEdit: () => onEdit(flight),
      onDelete: () => onDelete(flight),
      leadingActions: [useBtn],
    });
    if (picked) node.classList.add("flight-card-chosen");
    return node;
  }

  // Only the flights being used count toward the total shown here.
  const picked = totalFor({ homeFlights, hopFlights: [] });
  const heading = el("h3", {
    textContent: `${traveler.name}'s flights from home${picked.cents > 0 || picked.complete ? ` · ${picked.complete ? "" : "at least "}${formatMoney(picked.cents, trip.currency)}` : ""}`,
  });
  const pasteBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Paste flight link" });
  pasteBtn.addEventListener("click", onPasteFlight);

  if (homeFlights.length === 0) {
    return [heading, el("p", { className: "empty-state", textContent: `No flights yet for ${traveler.name}.` }), pasteBtn];
  }
  return [heading, ...[...homeFlights].sort(byLatestPriceAsc).map(row), pasteBtn];
}
