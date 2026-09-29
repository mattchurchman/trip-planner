import { el } from "../ui.js";
import { legRoute, stopsLabel } from "../lib/flightlink.js";
import { airlineName } from "../lib/airlines.js";
import { formatLegDate } from "../lib/itineraryFormat.js";

const LEG_LABEL = ["OUT", "BACK"];

/** One leg's flight-number line: "AS 581 · FJ 871 · ...", each code carrying
 * the airline's full name as a title tooltip when known. */
function segmentsLine(segments) {
  const spans = segments.map((seg) => {
    const code = seg.airline || "?";
    const text = seg.flightNumber ? `${code} ${seg.flightNumber}` : code;
    return el("span", { textContent: text, title: airlineName(seg.airline) || undefined });
  });
  const withSeparators = spans.flatMap((span, i) => (i === 0 ? [span] : [" · ", span]));
  return el("p", { className: "itinerary-line muted" }, withSeparators);
}

/**
 * Renders the OUT/BACK itinerary block from a flight's `legs` (§7.7), shared
 * by the add/edit dialog's preview and the flight card (T11). `legs` is the
 * array shape from flightlink.js/the store: [{ date, segments }]. The
 * optional `outboundDetails`/`returnDetails` free-text "Times" fields render
 * as a third muted line per leg when non-empty (used by the card, not the
 * dialog preview, which shows only what the link itself carries).
 */
export function renderItinerary(legs, { outboundDetails = "", returnDetails = "" } = {}) {
  const detailsByIndex = [outboundDetails, returnDetails];

  const blocks = (legs || []).map((leg, i) => {
    const route = legRoute(leg).join(" → ");
    const dateText = formatLegDate(leg.date) || "Date not set";
    const hasSegments = leg.segments && leg.segments.length > 0;
    const stops = hasSegments ? leg.segments.length - 1 : null;
    const stopsText = stopsLabel(stops);

    const firstLine = el("div", { className: "itinerary-line itinerary-first" }, [
      el("span", { className: "itinerary-leftgroup" }, [
        el("span", { className: "itinerary-label", textContent: LEG_LABEL[i] || `LEG ${i + 1}` }),
        el("span", { textContent: dateText }),
        el("span", { textContent: route }),
      ]),
      stopsText ? el("span", { className: "itinerary-stops muted", textContent: stopsText }) : null,
    ].filter(Boolean));

    const rows = [firstLine];
    if (hasSegments) rows.push(segmentsLine(leg.segments));
    const detailsText = (detailsByIndex[i] || "").trim();
    if (detailsText) rows.push(el("p", { className: "itinerary-line muted", textContent: detailsText }));

    return el("div", { className: "itinerary-leg" }, rows);
  });

  return el("div", { className: "itinerary" }, blocks);
}
