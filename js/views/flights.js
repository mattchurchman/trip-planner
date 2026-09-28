import { addFlight, updateFlight, deleteFlight, chooseFlight, clearSelectedFlight } from "../store.js";
import { el, confirmDialog, friendlyError, field, dialogShell, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { safeUrl, googleFlightsSearchUrl } from "../lib/links.js";
import { parseFlightLink } from "../lib/flightlink.js";
import { parseMoney } from "../lib/money.js";
import { buildPricePanel } from "./pricePanel.js";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03-10" -> "10 Mar", for the Step 2 "✓ Filled in" summary (§7.7). */
function shortDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  return `${day} ${MONTH_ABBR[month - 1]}`;
}

/**
 * Add flight option, link first (§7.7): Step 1 search Google Flights, Step 2
 * paste the link (parsed on paste/input, §9.6), Step 3 pre-filled details plus
 * an optional "Price you saw". Resolves `{ ...flight fields, priceAmountCents }`
 * or `null` on cancel; the caller (which has `myUid`) turns a valid amount into
 * the flight's first PriceEntry.
 */
function addFlightFormDialog(traveler, trip) {
  return dialogShell("flight-dialog", (finish) => {
    const dest = trip.destination;

    const searchUrl = googleFlightsSearchUrl({
      fromCity: traveler.homeCity || "?",
      fromAirport: traveler.homeAirport,
      toCity: dest ? dest.city : "?",
      toAirport: dest ? dest.airport : "",
      outboundDate: trip.startDate,
      returnDate: trip.endDate,
    });
    const searchLink = el("a", {
      className: "btn btn-small",
      href: searchUrl,
      target: "_blank",
      rel: "noopener noreferrer",
      textContent: "Search Google Flights",
    });

    const linkInput = el("input", { type: "text", placeholder: "Paste the Google Flights link", attrs: { "aria-label": "Google Flights link" } });
    const parseResultEl = el("p", { className: "link-parse-result", hidden: true });

    const labelInput = el("input", { type: "text" });
    const fromCityInput = el("input", { type: "text", value: traveler.homeCity || "" });
    const fromAirportInput = el("input", { type: "text", value: traveler.homeAirport || "" });
    const toCityInput = el("input", { type: "text", value: dest?.city || "" });
    const toAirportInput = el("input", { type: "text", value: dest?.airport || "" });
    const outboundDateInput = el("input", { type: "date", value: trip.startDate || "" });
    const outboundDetailsInput = el("textarea", { rows: 2 });
    const returnDateInput = el("input", { type: "date", value: trip.endDate || "" });
    const returnDetailsInput = el("textarea", { rows: 2 });
    const notesInput = el("textarea", { rows: 2 });
    const priceInput = el("input", { type: "text", placeholder: "e.g. 480.50" });

    // What Step 3 was pre-filled with, so Step 2 only overwrites a field the
    // traveler hasn't customized away from that default (or left empty) — §7.7.
    const defaults = {
      fromAirport: fromAirportInput.value,
      toAirport: toAirportInput.value,
      outboundDate: outboundDateInput.value,
      returnDate: returnDateInput.value,
    };
    function fillIfDefault(input, key, value) {
      if (!value) return false;
      if (input.value === "" || input.value === defaults[key]) {
        input.value = value;
        return true;
      }
      return false;
    }

    function tryParseLink() {
      if (!linkInput.value.trim()) return;
      const result = parseFlightLink(linkInput.value);
      if (result.error) {
        parseResultEl.className = "link-parse-result";
        parseResultEl.textContent = "Couldn't read this link — fill in the details below.";
        parseResultEl.hidden = false;
        return;
      }
      // Both calls must run regardless of the other's result, so this can't
      // short-circuit on || — track each outcome, then OR the booleans.
      const filledFrom = fillIfDefault(fromAirportInput, "fromAirport", result.fromAirport);
      const filledTo = fillIfDefault(toAirportInput, "toAirport", result.toAirport);
      const filledAirports = filledFrom || filledTo;
      const filledOutbound = fillIfDefault(outboundDateInput, "outboundDate", result.outboundDate);
      const filledReturn = fillIfDefault(returnDateInput, "returnDate", result.returnDate);
      const filledDates = filledOutbound || filledReturn;

      const parts = [];
      if (filledAirports) parts.push(`${fromAirportInput.value || "?"} → ${toAirportInput.value || "?"}`);
      if (filledDates) {
        const range = [shortDate(outboundDateInput.value), shortDate(returnDateInput.value)].filter(Boolean).join(" – ");
        if (range) parts.push(range);
      }
      if (parts.length > 0) {
        parseResultEl.className = "link-parse-result link-parse-success";
        parseResultEl.textContent = `✓ Filled in: ${parts.join(", ")}. Add the airline, times and price yourself — Google doesn't put them in the link.`;
        parseResultEl.hidden = false;
      } else {
        parseResultEl.hidden = true;
      }
    }
    linkInput.addEventListener("paste", () => setTimeout(tryParseLink, 0));
    linkInput.addEventListener("input", tryParseLink);

    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Add" });

    const form = el("form", { method: "dialog", className: "flight-form" }, [
      el("h4", { textContent: "Step 1 · Find flights" }),
      searchLink,
      el("p", { className: "muted", textContent: "Pick a flight on Google Flights, then copy the address from your browser's address bar." }),

      el("h4", { textContent: "Step 2 · Paste the Google Flights link" }),
      linkInput,
      parseResultEl,

      el("h4", { textContent: "Step 3 · Details" }),
      field("Label", labelInput),
      el("div", { className: "field-row" }, [field("From city", fromCityInput), field("From airport", fromAirportInput)]),
      el("div", { className: "field-row" }, [field("To city", toCityInput), field("To airport", toAirportInput)]),
      el("div", { className: "field-row" }, [field("Outbound date", outboundDateInput), field("Return date", returnDateInput)]),
      field("Outbound details", outboundDetailsInput),
      field("Return details", returnDetailsInput),
      field("Notes", notesInput),
      field("Price you saw", priceInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      errorHolder.replaceChildren();
      let priceAmountCents = null;
      if (priceInput.value.trim()) {
        priceAmountCents = parseMoney(priceInput.value);
        if (priceAmountCents === null || priceAmountCents <= 0) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Enter a valid amount greater than $0." }));
          return;
        }
      }
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
        priceAmountCents,
      });
    });
    return { form, focusEl: linkInput };
  });
}

/** Edit an existing flight option: the plain details form, unchanged by this task. */
function editFlightFormDialog(flight) {
  return dialogShell("flight-dialog", (finish) => {
    const labelInput = el("input", { type: "text", value: flight.label || "" });
    const fromCityInput = el("input", { type: "text", value: flight.fromCity || "" });
    const fromAirportInput = el("input", { type: "text", value: flight.fromAirport || "" });
    const toCityInput = el("input", { type: "text", value: flight.toCity || "" });
    const toAirportInput = el("input", { type: "text", value: flight.toAirport || "" });
    const outboundDateInput = el("input", { type: "date", value: flight.outboundDate || "" });
    const outboundDetailsInput = el("textarea", { rows: 2, value: flight.outboundDetails || "" });
    const returnDateInput = el("input", { type: "date", value: flight.returnDate || "" });
    const returnDetailsInput = el("textarea", { rows: 2, value: flight.returnDetails || "" });
    const linkInput = el("input", { type: "text", value: flight.link || "" });
    const notesInput = el("textarea", { rows: 2, value: flight.notes || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });

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
    const result = await addFlightFormDialog(traveler, trip);
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

  async function openEditFlightDialog(flight) {
    const result = await editFlightFormDialog(flight);
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
    editBtn.addEventListener("click", () => openEditFlightDialog(flight));
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
