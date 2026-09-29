import { el, field, dialogShell } from "../ui.js";
import { googleFlightsSearchUrl } from "../lib/links.js";
import { parseFlightLink } from "../lib/flightlink.js";
import { parseMoney, formatMoney } from "../lib/money.js";
import { flightLabel } from "../lib/itineraryFormat.js";
import { renderItinerary } from "./itinerary.js";

/** Plain "1,673.13 EUR" (amount + ISO code, no locale symbol) for the price
 * helper line when the link's currency differs from the trip's (§7.7) —
 * showing a foreign symbol here could read as if it were the trip's own. */
function formatAmountWithCode(amountCents, currency) {
  const amount = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountCents / 100);
  return `${amount} ${currency}`;
}

const hasSegments = (legs) => (legs || []).some((leg) => leg.segments && leg.segments.length > 0);

/**
 * The Add flight option / Edit flight dialog (§7.7), built exactly to the
 * spec sketch: link box, a "✓ Read from the link" preview (`renderItinerary`)
 * once a link with real segments is read, a collapsed "Edit route and dates"
 * disclosure, then Label, Price you saw (add mode only), Times, Notes.
 *
 * `flight` is null in add mode. `optionCount` is the traveler's existing
 * option count, used for the "Option N" label default. Resolves the new/
 * updated fields (including `legs` and, in add mode, `priceAmountCents`), or
 * `null` on cancel.
 */
function buildFlightDialog({ isEdit, traveler, trip, flight, optionCount }) {
  return dialogShell("flight-dialog", (finish) => {
    const dest = trip.destination;

    const fromCityInput = el("input", { type: "text", value: flight?.fromCity ?? traveler?.homeCity ?? "" });
    const fromAirportInput = el("input", { type: "text", value: flight?.fromAirport ?? traveler?.homeAirport ?? "" });
    const toCityInput = el("input", { type: "text", value: flight?.toCity ?? dest?.city ?? "" });
    const toAirportInput = el("input", { type: "text", value: flight?.toAirport ?? dest?.airport ?? "" });
    const outboundDateInput = el("input", { type: "date", value: flight?.outboundDate ?? trip.startDate ?? "" });
    const returnDateInput = el("input", { type: "date", value: flight?.returnDate ?? trip.endDate ?? "" });

    const detailsEl = el("details", {}, [
      el("summary", { textContent: "Edit route and dates" }),
      el("div", { className: "field-row" }, [field("From city", fromCityInput), field("From airport", fromAirportInput)]),
      el("div", { className: "field-row" }, [field("To city", toCityInput), field("To airport", toAirportInput)]),
      el("div", { className: "field-row" }, [field("Outbound date", outboundDateInput), field("Return date", returnDateInput)]),
    ]);

    const searchUrl = googleFlightsSearchUrl({
      fromCity: traveler?.homeCity || "?",
      fromAirport: traveler?.homeAirport,
      toCity: dest ? dest.city : "?",
      toAirport: dest ? dest.airport : "",
      outboundDate: trip.startDate,
      returnDate: trip.endDate,
    });
    const searchLink = el("a", { href: searchUrl, target: "_blank", rel: "noopener noreferrer", textContent: "Search Google Flights" });
    const hintP = el("p", { className: "muted" }, ["Pick your flights on Google Flights, then copy the address bar. ", searchLink]);

    const linkInput = el("input", {
      type: "text",
      value: flight?.link || "",
      placeholder: "Paste the address from Google Flights…",
      attrs: { "aria-label": "Google Flights link" },
    });
    const linkErrorEl = el("p", { className: "field-error", hidden: true });
    const previewEl = el("div", { className: "flight-link-preview", hidden: true });

    let currentLegs = isEdit ? flight?.legs || [] : [];
    let currentPrice = null;

    let labelTouched = Boolean(flight?.label);
    const labelInput = el("input", { type: "text", value: flight?.label || "" });
    labelInput.addEventListener("input", () => {
      labelTouched = true;
    });

    let priceTouched = false;
    const priceInput = isEdit ? null : el("input", { type: "text", placeholder: "e.g. 480.50" });
    const priceHelperEl = isEdit ? null : el("p", { className: "muted", hidden: true });
    if (priceInput) {
      priceInput.addEventListener("input", () => {
        priceTouched = true;
      });
    }

    const outboundDetailsInput = el("input", { type: "text", placeholder: "e.g. Leaves 6:05 AM, lands 11:40 PM", value: flight?.outboundDetails || "" });
    const returnDetailsInput = el("input", { type: "text", placeholder: "e.g. Leaves 6:05 AM, lands 11:40 PM", value: flight?.returnDetails || "" });
    const notesInput = el("textarea", { rows: 2, value: flight?.notes || "" });

    function applyLabelDefault() {
      if (labelTouched) return;
      const outboundCodes = (currentLegs[0]?.segments || []).map((s) => s.airline);
      labelInput.value = flightLabel(outboundCodes.length ? outboundCodes : null, optionCount);
    }

    function applyPriceDefault() {
      if (isEdit) return;
      if (!currentPrice) {
        priceHelperEl.hidden = true;
        return;
      }
      if (currentPrice.currency === trip.currency) {
        if (!priceTouched) priceInput.value = (currentPrice.amountCents / 100).toFixed(2);
        priceHelperEl.textContent = `Google showed ${formatMoney(currentPrice.amountCents, currentPrice.currency)} when you copied this link — check it's still right.`;
      } else {
        if (!priceTouched) priceInput.value = "";
        priceHelperEl.textContent = `Google showed ${formatAmountWithCode(currentPrice.amountCents, currentPrice.currency)} — this trip uses ${trip.currency}, so type the price in ${trip.currency}.`;
      }
      priceHelperEl.hidden = false;
    }

    function showPreview() {
      previewEl.replaceChildren(
        el("p", { className: "link-parse-result link-parse-success", textContent: "✓ Read from the link" }),
        renderItinerary(currentLegs)
      );
      previewEl.hidden = false;
      detailsEl.open = false;
    }

    function hidePreview() {
      previewEl.hidden = true;
      detailsEl.open = true;
    }

    // Initial state: edit mode shows the preview straight from the saved
    // flight's legs (never re-parses the saved link until a new paste).
    if (hasSegments(currentLegs)) showPreview();
    else hidePreview();
    applyLabelDefault();
    applyPriceDefault();

    function tryParseLink() {
      const text = linkInput.value.trim();
      linkErrorEl.hidden = true;
      linkErrorEl.textContent = "";

      if (!text) {
        currentLegs = [];
        currentPrice = null;
        hidePreview();
        applyLabelDefault();
        applyPriceDefault();
        return;
      }

      const result = parseFlightLink(text);
      if (result.error) {
        linkErrorEl.textContent = result.error;
        linkErrorEl.hidden = false;
        currentLegs = [];
        currentPrice = null;
        hidePreview();
        applyLabelDefault();
        applyPriceDefault();
        return;
      }

      // A successful read overwrites the route/date fields outright (§7.7).
      if (result.fromAirport) fromAirportInput.value = result.fromAirport;
      if (result.toAirport) toAirportInput.value = result.toAirport;
      if (result.fromPlace) fromCityInput.value = result.fromPlace;
      if (result.toPlace) toCityInput.value = result.toPlace;
      if (result.outboundDate) outboundDateInput.value = result.outboundDate;
      if (result.returnDate) returnDateInput.value = result.returnDate;

      currentLegs = result.legs || [];
      currentPrice = result.price;

      if (hasSegments(currentLegs)) showPreview();
      else hidePreview();
      applyLabelDefault();
      applyPriceDefault();
    }
    linkInput.addEventListener("paste", () => setTimeout(tryParseLink, 0));
    linkInput.addEventListener("input", tryParseLink);

    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: isEdit ? "Save" : "Add flight" });

    const formChildren = [
      el("h3", { textContent: isEdit ? "Edit flight" : "Add flight option" }),
      field("Google Flights link", linkInput),
      hintP,
      linkErrorEl,
      previewEl,
      detailsEl,
      field("Label", labelInput),
    ];
    if (!isEdit) {
      formChildren.push(field("Price you saw", priceInput), priceHelperEl);
    }
    formChildren.push(
      el("div", { className: "field-row" }, [field("Outbound", outboundDetailsInput), field("Return", returnDetailsInput)]),
      field("Notes", notesInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn])
    );

    const form = el("form", { method: "dialog", className: "flight-form" }, formChildren);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      errorHolder.replaceChildren();
      let priceAmountCents = null;
      if (!isEdit && priceInput.value.trim()) {
        priceAmountCents = parseMoney(priceInput.value);
        if (priceAmountCents === null || priceAmountCents <= 0) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "That price didn't look right — try something like 245 or 245.50." }));
          return;
        }
      }
      const fields = {
        label: labelInput.value.trim(),
        fromCity: fromCityInput.value.trim(),
        fromAirport: fromAirportInput.value.trim().toUpperCase(),
        toCity: toCityInput.value.trim(),
        toAirport: toAirportInput.value.trim().toUpperCase(),
        outboundDate: outboundDateInput.value || null,
        outboundDetails: outboundDetailsInput.value.trim(),
        returnDate: returnDateInput.value || null,
        returnDetails: returnDetailsInput.value.trim(),
        legs: currentLegs.map(({ date, segments }) => ({ date, segments })),
        link: linkInput.value.trim() || null,
        notes: notesInput.value.trim(),
      };
      if (!isEdit) fields.priceAmountCents = priceAmountCents;
      finish(fields);
    });
    return { form, focusEl: linkInput };
  });
}

export function addFlightFormDialog(traveler, trip, optionCount) {
  return buildFlightDialog({ isEdit: false, traveler, trip, flight: null, optionCount });
}

export function editFlightFormDialog(flight, traveler, trip) {
  return buildFlightDialog({ isEdit: true, traveler, trip, flight, optionCount: 0 });
}
