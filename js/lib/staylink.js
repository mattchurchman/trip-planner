// Pure: best-effort extraction of provider, name, dates and guests from a pasted
// stay booking link (Booking.com, Airbnb, Google Hotels). No DOM, no Firebase.
// Any field that can't be determined is null, leaving the user free to fill it
// in by hand -- this never blocks manual entry.
import { safeUrl } from "./links.js";

function titleCaseSlug(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function firstParam(url, names) {
  for (const name of names) {
    const value = url.searchParams.get(name);
    if (value) return value;
  }
  return null;
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validated(latStr, lngStr) {
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Best-effort coordinates from a stay link's query params, per §9.6 / T08. Most
 * real Booking.com/Airbnb/Google Hotels share links don't carry a point location
 * at all (Airbnb's own lat/lng params are a search map's bounding box, not the
 * listing) -- this only catches the minority of links that happen to include
 * one. "Other ways to add a location" (a pasted Google Maps link, or Search /
 * Place on map) stays the primary way to set a stay's spot. */
function extractCoordinates(url) {
  const latStr = firstParam(url, ["lat", "latitude"]);
  const lngStr = firstParam(url, ["lng", "lon", "long", "longitude"]);
  if (latStr && lngStr) {
    const coords = validated(latStr, lngStr);
    if (coords) return coords;
  }
  const combined = firstParam(url, ["ll"]);
  if (combined) {
    const match = combined.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (match) {
      const coords = validated(match[1], match[2]);
      if (coords) return coords;
    }
  }
  return null;
}

/** Returns { provider, name, checkIn, checkOut, guests, lat, lng }, each null when not found. */
export function parseStayLink(text) {
  const result = { provider: null, name: null, checkIn: null, checkOut: null, guests: null, lat: null, lng: null };
  const normalized = safeUrl(text);
  if (!normalized) return result;
  const url = new URL(normalized);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname.endsWith("booking.com")) {
    result.provider = "booking";
    const match = url.pathname.match(/\/hotel\/[a-z]{2}\/([a-z0-9-]+?)(?:\.[a-z-]+)?\.html$/i);
    if (match) result.name = titleCaseSlug(match[1]);
    const checkIn = firstParam(url, ["checkin"]);
    const checkOut = firstParam(url, ["checkout"]);
    if (isIsoDate(checkIn)) result.checkIn = checkIn;
    if (isIsoDate(checkOut)) result.checkOut = checkOut;
    const adults = Number(firstParam(url, ["group_adults"]));
    if (adults > 0) result.guests = adults;
  } else if (hostname.endsWith("airbnb.com")) {
    result.provider = "airbnb";
    const checkIn = firstParam(url, ["check_in", "checkin"]);
    const checkOut = firstParam(url, ["check_out", "checkout"]);
    if (isIsoDate(checkIn)) result.checkIn = checkIn;
    if (isIsoDate(checkOut)) result.checkOut = checkOut;
    const adults = Number(firstParam(url, ["adults"]));
    if (adults > 0) result.guests = adults;
  } else if (hostname.endsWith("google.com") && url.pathname.includes("/travel/hotels")) {
    result.provider = "google_hotels";
    result.name = firstParam(url, ["q"]);
  } else {
    result.provider = "other";
  }

  const coords = extractCoordinates(url);
  if (coords) {
    result.lat = coords.lat;
    result.lng = coords.lng;
  }

  return result;
}
