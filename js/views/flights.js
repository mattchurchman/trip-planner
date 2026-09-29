import { addFlight, updateFlight, deleteFlight, chooseFlight, unchooseFlight } from "../store.js";
import { el, setPending, confirmDialog, friendlyError, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { safeUrl, googleFlightsSearchUrl } from "../lib/links.js";
import { isFlightChosen, chosenFlightIds } from "../lib/selection.js";
import { sortFlightOptions, cheapestFlightId } from "../lib/optionSort.js";
import { priceSummary, priceUpdater } from "./pricePanel.js";
import { renderItinerary } from "./itinerary.js";
import { addFlightFormDialog, editFlightFormDialog } from "./flightForm.js";

/** A flight's `legs` when it has one, otherwise a same-shaped fallback built
 * from the plain from/to/date fields (pre-3.0 flights, or one added without a
 * link) so the same itinerary block renders either way — with no stops or
 * flight-number line, per §7.7's "flight with no legs" bullet. */
function legsForCard(flight) {
  if (flight.legs && flight.legs.length > 0) return flight.legs;
  const legs = [];
  if (flight.outboundDate || flight.fromAirport || flight.fromCity) {
    legs.push({ date: flight.outboundDate, from: flight.fromAirport || flight.fromCity, to: flight.toAirport || flight.toCity, segments: [] });
  }
  if (flight.returnDate) {
    legs.push({ date: flight.returnDate, from: flight.toAirport || flight.toCity, to: flight.fromAirport || flight.fromCity, segments: [] });
  }
  return legs;
}

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

  function renderFlightCard(flight, traveler, trip, usersById, isCheapest) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const isChosen = isFlightChosen(trip, traveler.id, flight.id);

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

    const pills = [
      isChosen ? el("span", { className: "chosen-badge", textContent: "Chosen ✓" }) : null,
      isCheapest ? el("span", { className: "badge-new-low", textContent: "Cheapest" }) : null,
    ].filter(Boolean);

    const headerLeft = el("div", { className: "option-header-left" }, [el("h3", { textContent: flight.label || "Flight option" }), ...pills]);
    const summary = priceSummary({ prices: flight.prices || [], currency: trip.currency, usersById });
    const header = el("div", { className: "flight-card-header" }, [headerLeft, summary]);

    const { button: updateBtn, row: updateRow } = priceUpdater({
      tripId,
      subcollection: "flights",
      docId: flight.id,
      prices: flight.prices || [],
      myUid,
      currency: trip.currency,
    });

    const itinerary = renderItinerary(legsForCard(flight), { outboundDetails: flight.outboundDetails, returnDetails: flight.returnDetails });

    const editBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEditFlightDialog(flight, traveler, trip));
    const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete" });
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
    const openLink = safeLink ? el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Open on Google" }) : null;

    const { element: commentsEl, unsubscribe } = renderComments({ tripId, targetType: "flight", targetId: flight.id, myUid, usersById });
    flightCommentUnsubs.push(unsubscribe);

    const notes = flight.notes ? el("p", { className: "card-notes-clamp", textContent: flight.notes }) : null;

    return el("article", { className: `card flight-card${isChosen ? " flight-card-chosen" : ""}` }, [
      header,
      updateRow,
      itinerary,
      notes,
      el("div", { className: "flight-actions" }, [chooseBtn, updateBtn, openLink, editBtn, deleteBtn].filter(Boolean)),
      errorHolder,
      commentsEl,
    ].filter(Boolean));
  }

  function renderSection(flights, trip, usersById) {
    for (const unsub of flightCommentUnsubs) unsub();
    flightCommentUnsubs = [];

    const dest = trip.destination;
    const sections = (trip.travelers || []).map((traveler) => {
      const travelerFlights = flights.filter((f) => f.travelerId === traveler.id);
      const chosenIds = chosenFlightIds(trip, traveler.id);
      const sorted = sortFlightOptions(travelerFlights, chosenIds);
      const cheapestId = cheapestFlightId(travelerFlights);

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

      const grid =
        sorted.length === 0
          ? el("p", { className: "empty-state", textContent: "No flight options yet. Search Google Flights above, then add what you find." })
          : el("div", { className: "flight-options-grid" }, sorted.map((f) => renderFlightCard(f, traveler, trip, usersById, f.id === cheapestId)));

      return el("div", { className: "traveler-flights card" }, [
        el("h3", { textContent: `${traveler.name} from ${traveler.homeCity || "?"}` }),
        el("div", { className: "traveler-flights-actions" }, [addBtn, searchLink]),
        grid,
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
