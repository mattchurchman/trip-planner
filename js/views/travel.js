import {
  watchTrip,
  watchUsers,
  watchFlights,
  addFlight,
  updateFlight,
  deleteFlight,
  chooseFlight,
  watchStays,
  addStay,
  updateStay,
  deleteStay,
  voteOnStay,
  chooseStay,
  watchCosts,
  addCost,
  updateCost,
  deleteCost,
  logPriceEntry,
  deletePriceEntry,
} from "../store.js";
import { el, svgEl, setPending, confirmDialog, friendlyError, rankControl, field, dialogShell } from "../ui.js";
import { renderComments } from "./comments.js";
import { sortByRank } from "../lib/votes.js";
import { parseMoney, formatMoney } from "../lib/money.js";
import { nightsBetween, nightsLabel, relativeTime } from "../lib/dates.js";
import { latestEntry, priceDelta, isNewLow, perNightCents, sortByTimeAsc, computeTotals } from "../lib/totals.js";
import { safeUrl, googleFlightsSearchUrl, googleHotelsUrl, bookingUrl, airbnbUrl } from "../lib/links.js";
import { parseGoogleMapsUrl } from "../lib/mapsurl.js";

const PROVIDERS = [
  { value: "booking", label: "Booking.com" },
  { value: "airbnb", label: "Airbnb" },
  { value: "google_hotels", label: "Google Hotels" },
  { value: "hotel_direct", label: "Hotel direct" },
  { value: "other", label: "Other" },
];

function externalLinkRow(url, label) {
  return el("a", { className: "discover-link", href: url, target: "_blank", rel: "noopener noreferrer", textContent: label });
}

function buildSparkline(prices) {
  const amounts = sortByTimeAsc(prices).map((p) => p.amountCents);
  const width = 100;
  const height = 24;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const range = max - min || 1;
  const points = amounts
    .map((amount, i) => {
      const x = amounts.length === 1 ? width / 2 : (i / (amounts.length - 1)) * width;
      const y = height - ((amount - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "sparkline", "aria-hidden": "true" }, [
    svgEl("polyline", { points, fill: "none", stroke: "#1a73e8", "stroke-width": "2" }),
  ]);
}

/** The price panel from §7.8, shared by flight and stay cards. */
function buildPricePanel({ tripId, subcollection, docId, prices, myUid, usersById, currency }) {
  const latest = latestEntry(prices);
  const delta = priceDelta(prices);
  const newLow = isNewLow(prices);
  const errorHolder = el("div", { className: "field-error-holder" });

  const summaryParts = [];
  if (latest) {
    const when = latest.checkedAt ? relativeTime(new Date(latest.checkedAt)) : "";
    const byName = (usersById[latest.byUid] && usersById[latest.byUid].displayName) || "someone";
    summaryParts.push(
      el("p", { className: "price-latest", textContent: `${formatMoney(latest.amountCents, currency)} — checked ${when} by ${byName}` })
    );
    if (delta !== null) {
      let deltaText = "No change";
      if (delta > 0) deltaText = `▲ ${formatMoney(delta, currency)} higher`;
      else if (delta < 0) deltaText = `▼ ${formatMoney(-delta, currency)} lower`;
      summaryParts.push(el("p", { className: "price-delta", textContent: deltaText }));
    }
    if (newLow) summaryParts.push(el("span", { className: "badge-new-low", textContent: "New low" }));
    if (prices.length >= 2) summaryParts.push(buildSparkline(prices));
  } else {
    summaryParts.push(el("p", { className: "muted", textContent: "No price logged yet." }));
  }

  const amountInput = el("input", { type: "text", placeholder: "Amount", value: latest ? (latest.amountCents / 100).toFixed(2) : "" });
  const noteInput = el("input", { type: "text", placeholder: "Note (optional)" });
  const logBtn = el("button", { type: "button", className: "btn btn-small btn-primary", textContent: "Log price" });
  logBtn.addEventListener("click", async () => {
    errorHolder.replaceChildren();
    const cents = parseMoney(amountInput.value);
    if (cents === null || cents <= 0) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Enter a valid amount greater than $0." }));
      return;
    }
    const entry = { id: crypto.randomUUID(), amountCents: cents, checkedAt: new Date().toISOString(), byUid: myUid, note: noteInput.value.trim() };
    setPending(logBtn, true, "Logging…");
    try {
      await logPriceEntry(tripId, subcollection, docId, entry);
      noteInput.value = "";
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(logBtn, false);
    }
  });

  const historyToggle = el("button", { type: "button", className: "btn btn-link", textContent: `History (${prices.length})` });
  const historyList = el("ul", { className: "price-history", hidden: true });
  historyToggle.addEventListener("click", () => {
    historyList.hidden = !historyList.hidden;
  });
  historyList.append(
    ...[...prices]
      .sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : a.checkedAt > b.checkedAt ? -1 : 0))
      .map((entry) => {
        const when = entry.checkedAt ? new Date(entry.checkedAt).toLocaleString() : "";
        const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete" });
        deleteBtn.addEventListener("click", async () => {
          const confirmed = await confirmDialog(`Delete this price entry (${formatMoney(entry.amountCents, currency)})?`);
          if (!confirmed) return;
          try {
            await deletePriceEntry(tripId, subcollection, docId, entry);
          } catch (err) {
            errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
          }
        });
        return el("li", { className: "price-history-item" }, [
          el("span", { textContent: `${formatMoney(entry.amountCents, currency)} — ${when}${entry.note ? " — " + entry.note : ""}` }),
          deleteBtn,
        ]);
      })
  );

  return el("div", { className: "price-panel" }, [
    el("div", { className: "price-summary" }, summaryParts),
    el("p", { className: "muted price-hint" }, ["Check the price on the site first, then log what you saw."]),
    el("div", { className: "price-log-form" }, [amountInput, noteInput, logBtn]),
    errorHolder,
    historyToggle,
    historyList,
  ]);
}

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

function stayFormDialog(existing, trip) {
  return dialogShell("stay-dialog", (finish) => {
    let stayLat = existing?.lat ?? null;
    let stayLng = existing?.lng ?? null;

    const nameInput = el("input", { type: "text", value: existing?.name || "" });
    const providerSelect = el(
      "select",
      {},
      PROVIDERS.map((p) => el("option", { value: p.value, textContent: p.label, selected: p.value === (existing?.provider || "other") }))
    );
    const linkInput = el("input", { type: "text", value: existing?.link || "" });
    const neighborhoodInput = el("input", { type: "text", value: existing?.neighborhood || "" });
    const checkInInput = el("input", { type: "date", value: existing?.checkIn ?? trip.startDate ?? "" });
    const checkOutInput = el("input", { type: "date", value: existing?.checkOut ?? trip.endDate ?? "" });
    const guestsInput = el("input", { type: "number", min: "1", value: existing?.guests ?? ((trip.travelers || []).length || 1) });
    const noteInput = el("textarea", { rows: 2, value: existing?.note || "" });
    const mapsLinkInput = el("input", { type: "text", placeholder: "Paste a Google Maps link (optional)" });
    const locationStatus = el("p", { className: "muted" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: existing ? "Save" : "Add" });

    function updateLocationStatus() {
      locationStatus.textContent = stayLat != null ? `Location set: ${stayLat.toFixed(5)}, ${stayLng.toFixed(5)}` : "No location set.";
    }
    updateLocationStatus();
    function tryParseLink() {
      if (!mapsLinkInput.value.trim()) return;
      errorHolder.replaceChildren();
      const result = parseGoogleMapsUrl(mapsLinkInput.value);
      if (result.error) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: result.error }));
        return;
      }
      stayLat = result.lat;
      stayLng = result.lng;
      updateLocationStatus();
      if (result.name && !nameInput.value.trim()) nameInput.value = result.name;
    }
    mapsLinkInput.addEventListener("paste", () => setTimeout(tryParseLink, 0));
    const useLinkBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Use this link" });
    useLinkBtn.addEventListener("click", tryParseLink);

    const form = el("form", { method: "dialog", className: "stay-form" }, [
      field("Name", nameInput),
      field("Provider", providerSelect),
      field("Link", linkInput),
      field("Neighborhood", neighborhoodInput),
      el("div", { className: "field-row" }, [field("Check-in", checkInInput), field("Check-out", checkOutInput)]),
      field("Guests", guestsInput),
      field("Note", noteInput),
      field("Location", el("div", { className: "location-method" }, [mapsLinkInput, useLinkBtn])),
      locationStatus,
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Name is required." }));
        return;
      }
      if (checkInInput.value && checkOutInput.value && checkOutInput.value <= checkInInput.value) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Check-out must be after check-in." }));
        return;
      }
      finish({
        name,
        provider: providerSelect.value,
        link: linkInput.value.trim() || null,
        neighborhood: neighborhoodInput.value.trim(),
        checkIn: checkInInput.value || null,
        checkOut: checkOutInput.value || null,
        guests: Math.max(1, parseInt(guestsInput.value, 10) || 1),
        note: noteInput.value.trim(),
        lat: stayLat,
        lng: stayLng,
      });
    });
    return { form, focusEl: nameInput };
  });
}

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
  let flightCommentUnsubs = [];
  let stayCommentUnsubs = [];

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const flightsSectionEl = el("div", { className: "flights-section" });
  const addStayBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Add stay" });
  const staysDiscoverEl = el("div", { className: "discover-section" });
  const staysListEl = el("div", { className: "stays-list" });
  const costsSectionEl = el("div", { className: "costs-section card" });
  const totalsCardEl = el("div", { className: "totals-card card" });

  container.replaceChildren(
    loadErrorEl,
    el("h2", { textContent: "Flights" }),
    flightsSectionEl,
    el("div", { className: "stays-header" }, [el("h2", { textContent: "Stays" }), addStayBtn]),
    staysDiscoverEl,
    staysListEl,
    el("h2", { textContent: "Shared costs" }),
    costsSectionEl,
    el("h2", { textContent: "Totals" }),
    totalsCardEl
  );

  addStayBtn.addEventListener("click", async () => {
    if (stays.length >= 10) return;
    const result = await stayFormDialog(null, trip);
    if (!result) return;
    try {
      await addStay(tripId, result, myUid);
    } catch (err) {
      loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  });

  async function openAddFlightDialog(traveler) {
    const result = await flightFormDialog(traveler, null, trip);
    if (!result) return;
    try {
      await addFlight(tripId, { ...result, travelerId: traveler.id }, myUid);
    } catch (err) {
      loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  }

  async function openEditFlightDialog(flight) {
    const traveler = (trip.travelers || []).find((t) => t.id === flight.travelerId) || { homeCity: "", homeAirport: "" };
    const result = await flightFormDialog(traveler, flight, trip);
    if (!result) return;
    try {
      await updateFlight(tripId, flight.id, result);
    } catch (err) {
      loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  }

  async function openEditStayDialog(stay) {
    const result = await stayFormDialog(stay, trip);
    if (!result) return;
    try {
      await updateStay(tripId, stay.id, result);
    } catch (err) {
      loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  }

  function renderFlightCard(flight, traveler, chosenId) {
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

  function renderFlightsSection() {
    for (const unsub of flightCommentUnsubs) unsub();
    flightCommentUnsubs = [];

    const dest = trip.destination;
    const sections = (trip.travelers || []).map((traveler) => {
      const travelerFlights = flights.filter((f) => f.travelerId === traveler.id);
      const chosenId = trip.selectedFlights && trip.selectedFlights[traveler.id];

      const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add flight option" });
      addBtn.addEventListener("click", () => openAddFlightDialog(traveler));

      const searchUrl = googleFlightsSearchUrl({
        fromCity: traveler.homeCity || "?",
        fromAirport: traveler.homeAirport,
        toCity: dest ? dest.city : "?",
        toAirport: dest ? dest.airport : "",
        outboundDate: trip.startDate,
        returnDate: trip.endDate,
      });
      const searchLink = el("a", { href: searchUrl, target: "_blank", rel: "noopener noreferrer", textContent: "Search Google Flights" });

      const cardRows = travelerFlights.length === 0 ? [el("p", { className: "empty-state", textContent: "No flight options yet." })] : travelerFlights.map((f) => renderFlightCard(f, traveler, chosenId));

      return el("div", { className: "traveler-flights card" }, [
        el("h3", { textContent: `${traveler.name} from ${traveler.homeCity || "?"}` }),
        el("div", { className: "traveler-flights-actions" }, [addBtn, searchLink]),
        ...cardRows,
      ]);
    });
    flightsSectionEl.replaceChildren(...sections);
  }

  function renderStayCard(stay) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const isChosen = stay.id === trip.selectedStayId;
    const nights = nightsBetween(stay.checkIn, stay.checkOut);
    const latest = latestEntry(stay.prices);
    const perNight = latest && nights ? perNightCents(latest.amountCents, nights) : null;

    const rank = rankControl({
      votes: stay.votes || {},
      myUid,
      usersById,
      onVote: (choice) =>
        voteOnStay(tripId, stay.id, myUid, choice).catch((err) =>
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
        ),
    });

    const chooseBtn = el("button", {
      type: "button",
      className: `btn btn-small${isChosen ? " badge-chosen" : ""}`,
      textContent: isChosen ? "Chosen" : "Choose",
      disabled: isChosen,
    });
    if (!isChosen) {
      chooseBtn.addEventListener("click", () =>
        chooseStay(tripId, stay.id).catch((err) => errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) })))
      );
    }

    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEditStayDialog(stay));
    const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog(`Delete ${stay.name}?`);
      if (!confirmed) return;
      try {
        await deleteStay(tripId, stay.id);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const safeLink = stay.link ? safeUrl(stay.link) : null;
    const details = [];
    if (stay.neighborhood) details.push(el("p", { className: "muted", textContent: stay.neighborhood }));
    if (safeLink) details.push(el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Link" }));
    const metaText = [nightsLabel(stay.checkIn, stay.checkOut), `${stay.guests} guest${stay.guests === 1 ? "" : "s"}`, perNight != null ? `${formatMoney(perNight, trip.currency)}/night` : null]
      .filter(Boolean)
      .join(" · ");
    details.push(el("p", { className: "muted", textContent: metaText }));
    if (stay.note) details.push(el("p", { textContent: stay.note }));

    const pricePanel = buildPricePanel({
      tripId,
      subcollection: "stays",
      docId: stay.id,
      prices: stay.prices || [],
      myUid,
      usersById,
      currency: trip.currency,
    });

    const { element: commentsEl, unsubscribe } = renderComments({ tripId, targetType: "stay", targetId: stay.id, myUid, usersById });
    stayCommentUnsubs.push(unsubscribe);

    return el("article", { className: `card stay-card${isChosen ? " stay-card-chosen" : ""}` }, [
      el("h3", { textContent: stay.name }),
      ...details,
      pricePanel,
      rank,
      el("div", { className: "stay-actions" }, [chooseBtn, editBtn, deleteBtn]),
      errorHolder,
      commentsEl,
    ]);
  }

  function renderStaysSection() {
    for (const unsub of stayCommentUnsubs) unsub();
    stayCommentUnsubs = [];

    const dest = trip.destination;
    const adults = (trip.travelers || []).length || 1;
    staysDiscoverEl.replaceChildren(
      externalLinkRow(googleHotelsUrl(dest ? dest.city : ""), "Search Google Hotels"),
      externalLinkRow(bookingUrl({ city: dest ? dest.city : "", checkIn: trip.startDate, checkOut: trip.endDate, adults }), "Search Booking.com"),
      externalLinkRow(airbnbUrl({ city: dest ? dest.city : "", checkIn: trip.startDate, checkOut: trip.endDate, adults }), "Search Airbnb")
    );

    addStayBtn.disabled = stays.length >= 10;

    const sorted = sortByRank(stays);
    if (sorted.length === 0) {
      staysListEl.replaceChildren(el("p", { className: "empty-state", textContent: "No stays yet." }));
    } else {
      staysListEl.replaceChildren(...sorted.map(renderStayCard));
    }
  }

  function renderCostsSection() {
    const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add shared cost" });
    addBtn.addEventListener("click", async () => {
      const result = await costFormDialog(null);
      if (!result) return;
      try {
        await addCost(tripId, result, myUid);
      } catch (err) {
        loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const rows = costs.map((cost) => {
      const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
      editBtn.addEventListener("click", async () => {
        const result = await costFormDialog(cost);
        if (!result) return;
        try {
          await updateCost(tripId, cost.id, result);
        } catch (err) {
          loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
        }
      });
      const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
      deleteBtn.addEventListener("click", async () => {
        const confirmed = await confirmDialog(`Delete "${cost.label}"?`);
        if (!confirmed) return;
        try {
          await deleteCost(tripId, cost.id);
        } catch (err) {
          loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
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
    costsSectionEl.replaceChildren(addBtn, ...body);
  }

  function renderTotalsCard() {
    const travelers = trip.travelers || [];
    const flightsById = Object.fromEntries(flights.map((f) => [f.id, f]));
    const stay = stays.find((s) => s.id === trip.selectedStayId) || null;
    const result = computeTotals({ travelers, selectedFlights: trip.selectedFlights || {}, flightsById, stay, sharedCosts: costs });

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
    renderFlightsSection();
    renderStaysSection();
    renderCostsSection();
    renderTotalsCard();
  }

  const unsubTrip = watchTrip(
    tripId,
    (t) => {
      trip = t;
      rerenderAll();
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
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
        renderFlightsSection();
        renderTotalsCard();
      }
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const unsubStays = watchStays(
    tripId,
    (s) => {
      stays = s;
      if (trip) {
        renderStaysSection();
        renderTotalsCard();
      }
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
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
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );

  return () => {
    unsubTrip();
    unsubUsers();
    unsubFlights();
    unsubStays();
    unsubCosts();
    for (const unsub of flightCommentUnsubs) unsub();
    for (const unsub of stayCommentUnsubs) unsub();
  };
}
