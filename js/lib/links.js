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

function monthYearLabel(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The 11 Overview "Discover" idea search queries (§9.1), for use with googleSearchUrl. */
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
    `rock climbing near ${city}`,
    `surfing near ${city}`,
    `skiing near ${city}`,
    `day trips from ${city}`,
  ];
}
