import { el, downloadFile } from "../ui.js";
import { buildPlacesCsv, buildPlacesKml, buildTripKml, placesCsvFilename, placesKmlFilename, tripKmlFilename, locatedCount } from "../lib/exporters.js";

/**
 * The Export section on the Days tab (V4 §8): the day-by-day map file for
 * Google My Maps, the plain places CSV/KML, and the left-out-pins count.
 * Stateless -- call again whenever trip/places/days change.
 */
export function renderExportSection({ trip, places, days, chosenStays = [] }) {
  const leftOutCount = places.length - locatedCount(places);

  const csvBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Download CSV for Google My Maps" });
  csvBtn.addEventListener("click", () => {
    downloadFile(placesCsvFilename(trip.name), buildPlacesCsv(places, days), "text/csv;charset=utf-8");
  });

  const kmlBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Download KML" });
  kmlBtn.addEventListener("click", () => {
    downloadFile(placesKmlFilename(trip.name), buildPlacesKml(trip.name, places, days), "application/vnd.google-earth.kml+xml");
  });

  const tripKmlBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Take it to Google Maps" });
  tripKmlBtn.addEventListener("click", () => {
    downloadFile(tripKmlFilename(trip.name), buildTripKml(trip.name, places, days, chosenStays), "application/vnd.google-earth.kml+xml");
  });

  return el(
    "div",
    { className: "export-section card" },
    [
      el("h3", { textContent: "Export" }),
      leftOutCount > 0
        ? el("p", {
            className: "muted",
            textContent: `${leftOutCount} place${leftOutCount === 1 ? "" : "s"} ${leftOutCount === 1 ? "has" : "have"} no pin and will be left out.`,
          })
        : null,
      el("div", { className: "export-actions" }, [csvBtn, kmlBtn]),
      el("p", {
        className: "muted export-help",
        textContent:
          'In Google My Maps: Create a new map → Import → choose the CSV → pick Latitude/Longitude for location and Name for the title → then "Style by" Category. Share the map with your friends from My Maps.',
      }),
      el("div", { className: "export-actions" }, [tripKmlBtn]),
      el("p", {
        className: "muted export-help",
      }, [
        el("span", { textContent: "Take the plan to Google Maps: " }),
        el("a", { href: "help.html#google-maps", textContent: "Download the map file → import into Google My Maps → open in the Google Maps app." }),
      ]),
    ].filter(Boolean)
  );
}
