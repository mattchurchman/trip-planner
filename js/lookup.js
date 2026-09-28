// The only file that calls outside services with fetch(): Nominatim (§9.4)
// and Wikipedia (§9.7).
import { wikiSummaryUrl } from "./lib/photos.js";

let lastNominatimAt = 0;

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

/** Destination photo lookup (§9.7). Returns the parsed summary JSON, or `null`
 * when the title has no article (404) — a missing article isn't an error, it
 * just means the caller should try its next title or give up quietly. Any
 * other failure (offline, a non-404 error status) throws. */
export async function wikipediaSummary(title) {
  const response = await fetch(wikiSummaryUrl(title));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Photo lookup failed.");
  return response.json();
}
