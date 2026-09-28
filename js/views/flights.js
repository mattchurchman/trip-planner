import { addFlight, updateFlight, deleteFlight, chooseFlight, clearSelectedFlight } from "../store.js";
import { el, confirmDialog, friendlyError, field, dialogShell, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { safeUrl, googleFlightsSearchUrl } from "../lib/links.js";
import { buildPricePanel } from "./pricePanel.js";

function flightFormDialog(traveler, existing, trip) {
  return dialogShell("flight-dialog", (finish) => {
    const dest = trip.destination;
    const labelInput = el("input", { type: "text", value: existing?.label || "" });
    const fromCityInput = el("input", { type: "text", value: existing?.fromCity ?? traveler.homeCity ?? "" });
    const fromAirportInput = el("input", { type: "text", value: existing?.fromAirport ?? traveler.homeAirport ?? "" });
    const toCityInput = el("input", { type: "text", value: existing?.toCity ?? dest?.city ?? "" });
    const toAirportInput = el("input", { type: "text", value: existing?.toAirport ?? dest?.airport ?? "" });
    const outboundDateInput = el("input", { type: "date", value: existing?.outboundDate ?? trip.startDate ?? "" });
    const outboundDetailsInput = el("textarea", { rows: 2, value: existing?.outboundDetails || "" });
    const returnDateInput = el("input", { type: "date", value: existing?.returnDate ?? trip.endDate ?? "" });
    const returnDetailsInput = el("textarea", { rows: 2, value: existing?.returnDetails || "" });
    const linkInput = el("input", { type: "text", value: existing?.link || "" });
    const notesInput = el("textarea", { rows: 2, value: existing?.notes || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: existing ? "Save" : "Add" });

    const form = el("form", { method: "dialog", className: "flight-form" }, [
      field("Label", labelInput),
      el("div", { className: "field-row" }, [field("From city", fromCityInput), field("From airport", fromAirportInput)]),
      el("div", { className: "field-row" }, [field("To city", toCityInput), field("To airport", toAirportInput)]),
      el("div", { className: "field-row" }, [field("Outbound date", outboundDateInput), field("Return date", returnDateInput)]),
      field("Outbound details", outboundDetailsInput),
      field("Return details", returnDetailsInput),
      field("Link", linkInput),
      field("Notes", notesInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      finish({
        label: labelInput.value.trim(),
        fromCity: fromCityInput.value.trim(),
        fromAirport: fromAirportInput.value.trim().toUpperCase(),
        toCity: toCityInput.value.trim(),
        toAirport: toAirportInput.value.trim().toUpperCase(),
        outboundDate: outboundDateInput.value || null,
        outboundDetails: outboundDetailsInput.value.trim(),
        returnDate: returnDateInput.value || null,
        returnDetails: returnDetailsInput.value.trim(),
        link: linkInput.value.trim() || null,
        notes: notesInput.value.trim(),
      });
    });
    return { form, focusEl: labelInput };
  });
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

  async function openAddFlightDialog(traveler, trip) {
    const result = await flightFormDialog(traveler, null, trip);
    if (!result) return;
    try {
      await addFlight(tripId, { ...result, travelerId: traveler.id }, myUid);
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  async function openEditFlightDialog(flight, trip) {
    const traveler = (trip.travelers || []).find((t) => t.id === flight.travelerId) || { homeCity: "", homeAirport: "" };
    const result = await flightFormDialog(traveler, flight, trip);
    if (!result) return;
    try {
      await updateFlight(tripId, flight.id, result);
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  function renderFlightCard(flight, traveler, chosenId, trip, usersById) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const isChosen = flight.id === chosenId;

    const routeText = `${flight.fromAirport || flight.fromCity} → ${flight.toAirport || flight.toCity}`;
    const dateText = [flight.outboundDate, flight.returnDate].filter(Boolean).join(" – ") || "Dates not set";

    const chooseBtn = el("button", {
      type: "button",
      className: `btn btn-small${isChosen ? " badge-chosen" : ""}`,
      textContent: isChosen ? "Chosen" : "Choose",
      disabled: isChosen,
    });
    if (!isChosen) {
      chooseBtn.addEventListener("click", () =>
        chooseFlight(tripId, traveler.id, flight.id).catch((err) =>
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
        )
      );
    }

    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEditFlightDialog(flight, trip));
    const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog("Delete this flight option?");
      if (!confirmed) return;
      try {
        await deleteFlight(tripId, flight.id);
        if (trip.selectedFlights && trip.selectedFlights[flight.travelerId] === flight.id) {
          await clearSelectedFlight(tripId, flight.travelerId);
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
      el("div", { className: "flight-card-header" }, [el("strong", { textContent: routeText }), el("span", { className: "muted", textContent: dateText })]),
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
      const chosenId = trip.selectedFlights && trip.selectedFlights[traveler.id];

      const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add flight option" });
      addBtn.addEventListener("click", () => openAddFlightDialog(traveler, trip));

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
          ? [el("p", { className: "empty-state", textContent: "No flight options yet." })]
          : travelerFlights.map((f) => renderFlightCard(f, traveler, chosenId, trip, usersById));

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
