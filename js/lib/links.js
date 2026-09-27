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

function coordString(loc) {
  return `${loc.lat},${loc.lng}`;
}

/**
 * Walking-route directions link(s) for a day (§9.2). Places without coordinates
 * are skipped; order among the located ones is preserved. At most 8 waypoints
 * per link — a day with more than 10 located places splits into consecutive
 * "Route part N" links, each starting where the previous one ended. Returns
 * [] with fewer than 2 located places. `|` is encoded as %7C.
 */
export function walkingRouteLinks(places) {
  const points = (places || []).filter((p) => p && p.lat != null && p.lng != null);
  if (points.length < 2) return [];

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

function monthYearLabel(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * The 11 Overview "Discover" idea search queries (§9.1), for use with googleSearchUrl.
 * Deliberately destination-agnostic (no named sport/activity) so they read sensibly for
 * any city -- Google's own results surface whatever's regionally relevant (kayaking for
 * a coastal destination, skiing for a mountain one) without this app guessing or
 * hardcoding it, which would need a lookup or AI feature the spec rules out (§12).
 */
export function ideaQueries(city, startDate) {
  const monthYear = monthYearLabel(startDate);
  const withMonth = (base) => (monthYear ? `${base} ${monthYear}` : base);
  return [
    `${city} best food neighborhoods`,
    `${city} food tour`,
    `${city} walking tour`,
    `${city} history museum`,
    withMonth(`${city} events`),
    withMonth(`${city} concerts`),
    withMonth(`${city} seasonal festivals`),
    `outdoor activities near ${city}`,
    `adventure tours near ${city}`,
    `nature excursions near ${city}`,
    `day trips from ${city}`,
  ];
}
