import { el, field, dialogShell } from "../ui.js";
import { googleFlightsSearchUrl } from "../lib/links.js";
import { parseFlightLink } from "../lib/flightlink.js";
import { flightLabel } from "../lib/itineraryFormat.js";
import { renderItinerary } from "./itinerary.js";

const hasSegments = (legs) => (legs || []).some((leg) => leg.segments && leg.segments.length > 0);

/**
 * The Edit flight dialog (§7.7, V4 §4.5): link box, a "✓ Read from the link"
 * preview (`renderItinerary`) once a link with real segments is read, a
 * collapsed "Edit route and dates" disclosure, then Label, Times, Notes.
 * Pasting a link is how flights get *added* (V4 §4.5); this is the by-hand
 * fallback for fixing one that's already saved.
 *
 * Resolves the updated fields (including `legs`), or `null` on cancel.
 */
export function editFlightFormDialog(flight, traveler, trip) {
  return dialogShell("flight-dialog", (finish) => {
    const fromCityInput = el("input", { type: "text", value: flight?.fromCity ?? traveler?.homeCity ?? "" });
    const fromAirportInput = el("input", { type: "text", value: flight?.fromAirport ?? traveler?.homeAirport ?? "" });
    const toCityInput = el("input", { type: "text", value: flight?.toCity ?? "" });
    const toAirportInput = el("input", { type: "text", value: flight?.toAirport ?? "" });
    const outboundDateInput = el("input", { type: "date", value: flight?.outboundDate ?? trip.startDate ?? "" });
    const returnDateInput = el("input", { type: "date", value: flight?.returnDate ?? trip.endDate ?? "" });

    const detailsEl = el("details", {}, [
      el("summary", { textContent: "Edit route and dates" }),
      el("div", { className: "field-row" }, [field("From city", fromCityInput), field("From airport", fromAirportInput)]),
      el("div", { className: "field-row" }, [field("To city", toCityInput), field("To airport", toAirportInput)]),
      el("div", { className: "field-row" }, [field("Outbound date", outboundDateInput), field("Return date", returnDateInput)]),
    ]);

    // Seeded from this flight's own route (V4 §4.2 dropped the trip-wide
    // destination), falling back to the traveler's home airport.
    const searchUrl = googleFlightsSearchUrl({
      fromCity: flight?.fromCity || traveler?.homeCity || "?",
      fromAirport: flight?.fromAirport || traveler?.homeAirport,
      toCity: flight?.toCity || "?",
      toAirport: flight?.toAirport || "",
      outboundDate: flight?.outboundDate || trip.startDate,
      returnDate: flight?.returnDate || trip.endDate,
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

    let currentLegs = flight?.legs || [];

    let labelTouched = Boolean(flight?.label);
    const labelInput = el("input", { type: "text", value: flight?.label || "" });
    labelInput.addEventListener("input", () => {
      labelTouched = true;
    });

    const outboundDetailsInput = el("input", { type: "text", placeholder: "e.g. Leaves 6:05 AM, lands 11:40 PM", value: flight?.outboundDetails || "" });
    const returnDetailsInput = el("input", { type: "text", placeholder: "e.g. Leaves 6:05 AM, lands 11:40 PM", value: flight?.returnDetails || "" });
    const notesInput = el("textarea", { rows: 2, value: flight?.notes || "" });

    function applyLabelDefault() {
      if (labelTouched) return;
      const outboundCodes = (currentLegs[0]?.segments || []).map((s) => s.airline);
      labelInput.value = flightLabel(outboundCodes.length ? outboundCodes : null, 0);
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

    // The preview starts straight from the saved flight's legs — the saved
    // link is never re-parsed until a new one is pasted.
    if (hasSegments(currentLegs)) showPreview();
    else hidePreview();
    applyLabelDefault();

    function tryParseLink() {
      const text = linkInput.value.trim();
      linkErrorEl.hidden = true;
      linkErrorEl.textContent = "";

      if (!text) {
        currentLegs = [];
        hidePreview();
        applyLabelDefault();
        return;
      }

      const result = parseFlightLink(text);
      if (result.error) {
        linkErrorEl.textContent = result.error;
        linkErrorEl.hidden = false;
        currentLegs = [];
        hidePreview();
        applyLabelDefault();
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

      if (hasSegments(currentLegs)) showPreview();
      else hidePreview();
      applyLabelDefault();
    }
    linkInput.addEventListener("paste", () => setTimeout(tryParseLink, 0));
    linkInput.addEventListener("input", tryParseLink);

    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });

    const form = el("form", { method: "dialog", className: "flight-form" }, [
      el("h3", { textContent: "Edit flight" }),
      field("Google Flights link", linkInput),
      hintP,
      linkErrorEl,
      previewEl,
      detailsEl,
      field("Label", labelInput),
      el("div", { className: "field-row" }, [field("Outbound", outboundDetailsInput), field("Return", returnDetailsInput)]),
      field("Notes", notesInput),
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
        legs: currentLegs.map(({ date, segments }) => ({ date, segments })),
        link: linkInput.value.trim() || null,
        notes: notesInput.value.trim(),
      });
    });
    return { form, focusEl: linkInput };
  });
}
