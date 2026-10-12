/** Build airport and city lookups from the compact airport data file. */
export function createAirportIndex(data) {
  const airports = Object.fromEntries(Object.entries(data).map(([code, value]) => {
    const [city, country, lat, lng] = value;
    return [code.toUpperCase(), { city, country, lat, lng }];
  }));

  function normalizedCode(code) {
    return String(code || "").trim().toUpperCase();
  }

  function info(code) {
    const airportCode = normalizedCode(code);
    return airports[airportCode] || airportCode;
  }

  function cityName(code) {
    const airport = info(code);
    return typeof airport === "string" ? airport : airport.city;
  }

  function cityKey(code) {
    const airport = info(code);
    return typeof airport === "string" ? airport : `${airport.city}, ${airport.country}`;
  }

  return { info, cityKey, cityName };
}
