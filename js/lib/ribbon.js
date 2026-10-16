/**
 * Turns the merged stops (`mergedStops` in choices.js) into what the route
 * ribbon draws (R7 §6): a home dot, one entry per stop — `{ code, label,
 * nights }` — and a home dot. A city visited twice keeps both its stops,
 * since `mergedStops` already gives each visit its own entry. More than 5
 * stops shows only the first 4, then one `{ more: N }` entry for the rest,
 * before the closing home dot.
 */
export function ribbonStops(stops, airports) {
  const entries = (stops || []).map((stop) => stopEntry(stop, airports));
  const home = () => ({ home: true });
  if (entries.length > 5) {
    return [home(), ...entries.slice(0, 4), { more: entries.length - 4 }, home()];
  }
  return [home(), ...entries, home()];
}

function stopEntry(stop, airports) {
  const code = (stop && stop.code) || "";
  const label = (code && airports && airports.cityName(code)) || (stop && stop.city) || code;
  const nights = (stop && stop.nights && stop.nights.length) || 0;
  return { code, label, nights };
}
