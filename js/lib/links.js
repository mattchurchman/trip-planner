// Pure external link builders and URL safety. See SPEC.md §9. Always encodeURIComponent values.

/** Normalizes text to an http(s) URL string, or null if unsafe/invalid (§9.5). */
export function safeUrl(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

/** True for clipboard text worth auto-filling into a link box (T42): a
 * scheme, a bare `www.`, or a bare domain-looking token — never plain text,
 * which may contain spaces or newlines a link never has. */
export function looksLikeLink(text) {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(trimmed);
}

export function googleFlightsExploreUrl() {
  return "https://www.google.com/travel/explore";
}

export function googleFlightsSearchUrl({ fromCity, fromAirport, toCity, toAirport, outboundDate, returnDate }) {
  const from = fromAirport || fromCity;
  const to = toAirport || toCity;
  let text = `Flights from ${from} to ${to}`;
  if (outboundDate) text += ` on ${outboundDate}`;
  if (returnDate) text += ` returning ${returnDate}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(text)}`;
}

export function googleHotelsUrl(city) {
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(`${city} hotels`)}`;
}

export function bookingUrl({ city, checkIn, checkOut, adults }) {
  let url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}`;
  if (checkIn) url += `&checkin=${encodeURIComponent(checkIn)}`;
  if (checkOut) url += `&checkout=${encodeURIComponent(checkOut)}`;
  url += `&group_adults=${encodeURIComponent(String(adults))}&no_rooms=1&group_children=0`;
  return url;
}

export function airbnbUrl({ city, checkIn, checkOut, adults }) {
  const params = [];
  if (checkIn) params.push(`checkin=${encodeURIComponent(checkIn)}`);
  if (checkOut) params.push(`checkout=${encodeURIComponent(checkOut)}`);
  params.push(`adults=${encodeURIComponent(String(adults))}`);
  return `https://www.airbnb.com/s/${encodeURIComponent(city)}/homes?${params.join("&")}`;
}

export function googleSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Opens a place on Google Maps by name + city (§9.2). Prefer a place's saved googleMapsUrl when it has one. */
export function googleMapsOpenUrl(name, city) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${city}`)}`;
}

/**
 * Step 1 of Add place (§7.6, §9.2): search Google Maps for what the user typed,
 * scoped to the destination. Joins the non-empty parts of text/city/country
 * with ", " — with no text, this searches the destination itself.
 */
export function googleMapsFindUrl(text, city, country) {
  const query = [text, city, country]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function coordString(loc) {
  return `${loc.lat},${loc.lng}`;
}

/**
 * Walking-route directions link(s) for a day (§9.2, T39). Places without
 * coordinates are skipped; order among the located ones is preserved. With a
 * located `home` (the day's chosen stay), the route starts and ends there
 * and every located place is a waypoint in between; otherwise the first
 * located place is the origin and the last is the destination, as before.
 * At most 8 waypoints per link — more than 10 points splits into consecutive
 * "Route part N" links, each starting where the previous one ended. Returns
 * [] with fewer than 2 located places (or, with a home, none at all). `|` is
 * encoded as %7C.
 */
export function walkingRouteLinks(places, home) {
  const located = (places || []).filter((p) => p && p.lat != null && p.lng != null);
  const hasHome = home && home.lat != null && home.lng != null;
  if (hasHome ? located.length < 1 : located.length < 2) return [];
  const points = hasHome ? [home, ...located, home] : located;

  const totalParts = Math.max(1, Math.ceil((points.length - 1) / 9));
  const links = [];
  let startIndex = 0;
  let partNumber = 1;
  while (startIndex < points.length - 1) {
    const segment = points.slice(startIndex, Math.min(startIndex + 10, points.length));
    const origin = segment[0];
    const destination = segment[segment.length - 1];
    const waypoints = segment.slice(1, -1);

    let url = `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${coordString(origin)}&destination=${coordString(destination)}`;
    if (waypoints.length > 0) {
      url += `&waypoints=${waypoints.map(coordString).join("%7C")}`;
    }
    links.push({ label: totalParts > 1 ? `Route part ${partNumber}` : "Open walking route", url });

    startIndex += segment.length - 1;
    partNumber += 1;
  }
  return links;
}
