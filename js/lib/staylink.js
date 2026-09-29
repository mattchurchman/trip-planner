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

/** Returns { provider, name, checkIn, checkOut, guests }, each null when not found. */
export function parseStayLink(text) {
  const result = { provider: null, name: null, checkIn: null, checkOut: null, guests: null };
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

  return result;
}
