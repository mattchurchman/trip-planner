import { addFlight, updateFlight, deleteFlight, chooseFlight, unchooseFlight } from "../store.js";
import { el, setPending, confirmDialog, friendlyError, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { safeUrl, googleFlightsSearchUrl } from "../lib/links.js";
import { isFlightChosen } from "../lib/selection.js";
import { buildPricePanel } from "./pricePanel.js";
import { addFlightFormDialog, editFlightFormDialog } from "./flightForm.js";

/**
 * Builds the Flights section of the Flights & stays tab (§7.7): one card of
 * flight options per traveler. Call `render(flights, trip, usersById)` whenever
 * trip/flights/users change — it defers rebuilding on its own while someone is
 * editing inside it (§8).
 */
export function createFlightsSection({ tripId, myUid, onError }) {
  let flightCommentUnsubs = [];
  const flightsSectionEl = el("div", { className: "flights-section" });

  async function openAddFlightDialog(traveler, trip, optionCount) {
    const result = await addFlightFormDialog(traveler, trip, optionCount);
    if (!result) return;
    const { priceAmountCents, ...fields } = result;
    const firstPriceEntry = priceAmountCents
      ? { id: crypto.randomUUID(), amountCents: priceAmountCents, checkedAt: new Date().toISOString(), byUid: myUid, note: "" }
      : undefined;
    try {
      await addFlight(tripId, { ...fields, travelerId: traveler.id, firstPriceEntry }, myUid);
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  async function openEditFlightDialog(flight, traveler, trip) {
    const result = await editFlightFormDialog(flight, traveler, trip);
    if (!result) return;
    try {
      await updateFlight(tripId, flight.id, result);
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  function renderFlightCard(flight, traveler, trip, usersById) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const isChosen = isFlightChosen(trip, traveler.id, flight.id);

    const routeText = `${flight.fromAirport || flight.fromCity} → ${flight.toAirport || flight.toCity}`;
    const dateText = [flight.outboundDate, flight.returnDate].filter(Boolean).join(" – ") || "Dates not set";

    // A traveler may choose any number of options (§7.7) — Choose/Unchoose toggles
    // this one option; the "Chosen ✓" badge is a separate, purely visual indicator.
    const chooseBtn = el("button", { type: "button", className: "btn btn-small", textContent: isChosen ? "Unchoose" : "Choose" });
    chooseBtn.addEventListener("click", async () => {
      setPending(chooseBtn, true, isChosen ? "Removing…" : "Choosing…");
      try {
        if (isChosen) await unchooseFlight(tripId, trip, traveler.id, flight.id);
        else await chooseFlight(tripId, trip, traveler.id, flight.id);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      } finally {
        setPending(chooseBtn, false);
      }
    });
    const chosenBadge = isChosen ? el("span", { className: "chosen-badge", textContent: "Chosen ✓" }) : null;

    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEditFlightDialog(flight, traveler, trip));
    const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog("Delete this flight option?", "Delete");
      if (!confirmed) return;
      try {
        await deleteFlight(tripId, flight.id);
        if (isFlightChosen(trip, flight.travelerId, flight.id)) {
          await unchooseFlight(tripId, trip, flight.travelerId, flight.id);
        }
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const safeLink = flight.link ? safeUrl(flight.link) : null;
    const details = [];
    if (flight.label) details.push(el("p", { className: "muted", textContent: flight.label }));
    if (flight.outboundDetails) details.push(el("p", { textContent: `Outbound: ${flight.outboundDetails}` }));
    if (flight.returnDetails) details.push(el("p", { textContent: `Return: ${flight.returnDetails}` }));
    if (flight.notes) details.push(el("p", { textContent: flight.notes }));
    if (safeLink) details.push(el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Link" }));

    const pricePanel = buildPricePanel({
      tripId,
      subcollection: "flights",
      docId: flight.id,
      prices: flight.prices || [],
      myUid,
      usersById,
      currency: trip.currency,
    });

    const { element: commentsEl, unsubscribe } = renderComments({ tripId, targetType: "flight", targetId: flight.id, myUid, usersById });
    flightCommentUnsubs.push(unsubscribe);

    return el("article", { className: `card flight-card${isChosen ? " flight-card-chosen" : ""}` }, [
      el("div", { className: "flight-card-header" }, [el("strong", { textContent: routeText }), el("span", { className: "muted", textContent: dateText }), chosenBadge].filter(Boolean)),
      ...details,
      pricePanel,
      el("div", { className: "flight-actions" }, [chooseBtn, editBtn, deleteBtn]),
      errorHolder,
      commentsEl,
    ]);
  }

  function renderSection(flights, trip, usersById) {
    for (const unsub of flightCommentUnsubs) unsub();
    flightCommentUnsubs = [];

    const dest = trip.destination;
    const sections = (trip.travelers || []).map((traveler) => {
      const travelerFlights = flights.filter((f) => f.travelerId === traveler.id);

      const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add flight option" });
      addBtn.addEventListener("click", () => openAddFlightDialog(traveler, trip, travelerFlights.length));

      const searchUrl = googleFlightsSearchUrl({
        fromCity: traveler.homeCity || "?",
        fromAirport: traveler.homeAirport,
        toCity: dest ? dest.city : "?",
        toAirport: dest ? dest.airport : "",
        outboundDate: trip.startDate,
        returnDate: trip.endDate,
      });
      const searchLink = el("a", { href: searchUrl, target: "_blank", rel: "noopener noreferrer", textContent: "Search Google Flights" });

      const cardRows =
        travelerFlights.length === 0
          ? [el("p", { className: "empty-state", textContent: "No flight options yet. Search Google Flights above, then add what you find." })]
          : travelerFlights.map((f) => renderFlightCard(f, traveler, trip, usersById));

      return el("div", { className: "traveler-flights card" }, [
        el("h3", { textContent: `${traveler.name} from ${traveler.homeCity || "?"}` }),
        el("div", { className: "traveler-flights-actions" }, [addBtn, searchLink]),
        ...cardRows,
      ]);
    });
    flightsSectionEl.replaceChildren(...sections);
  }

  const element = el("div", {}, [el("h2", { textContent: "Flights" }), flightsSectionEl]);

  return {
    element,
    render(flights, trip, usersById) {
      renderWhenIdle(flightsSectionEl, () => renderSection(flights, trip, usersById));
    },
    unsubscribe() {
      for (const unsub of flightCommentUnsubs) unsub();
    },
  };
}
