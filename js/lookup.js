// The only file that calls outside services with fetch(): Nominatim (§9.4).
import { createAirportIndex } from "./lib/airports.js";

let lastNominatimAt = 0;
let airportsPromise;

/** Load the bundled airport index once, when a route needs it. */
export function loadAirports() {
  if (!airportsPromise) {
    airportsPromise = fetch("./js/data/airports.json")
      .then((response) => {
        if (!response.ok) throw new Error("Airport list failed to load.");
        return response.json();
      })
      .then(createAirportIndex);
  }
  return airportsPromise;
}

/** Place search shared by the Overview destination lookup and the Places location
 * picker (§9.4). Limit is fixed at 5 per the spec's URL; a destination lookup only
 * ever reads the first result. */
export async function nominatimSearch(query) {
  // Nominatim's usage policy allows at most one request per second, so queue
  // rather than fire on every press.
  const wait = Math.max(0, 1000 - (Date.now() - lastNominatimAt));
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimAt = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Search failed. Try again in a moment.");
  return response.json();
}
