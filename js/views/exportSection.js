import { el, downloadFile } from "../ui.js";
import { buildPlacesCsv, buildPlacesKml, placesCsvFilename, placesKmlFilename, locatedCount } from "../lib/exporters.js";

/**
 * The Export section shared by the Places and Days tabs (§7.10): CSV/KML
 * downloads, the left-out-pins count, and the Google My Maps help box.
 * Stateless -- call again whenever trip/places/days change.
 */
export function renderExportSection({ trip, places, days }) {
  const leftOutCount = places.length - locatedCount(places);

  const csvBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Download CSV for Google My Maps" });
  csvBtn.addEventListener("click", () => {
    downloadFile(placesCsvFilename(trip.name), buildPlacesCsv(places, days), "text/csv;charset=utf-8");
  });

  const kmlBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Download KML" });
  kmlBtn.addEventListener("click", () => {
    downloadFile(placesKmlFilename(trip.name), buildPlacesKml(trip.name, places, days), "application/vnd.google-earth.kml+xml");
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
    ].filter(Boolean)
  );
}
