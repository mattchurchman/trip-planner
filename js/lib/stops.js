// Pure: the nearest route-stop lookup and stop-chip ordering for the Map tab
// (T25, V4 §8). No DOM, no Firebase.

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * The `stopKey` of the closest city to `(lat, lng)`, or `null` when none is
 * within `maxKm` (150km default, V4 §6) or a coordinate is missing.
 * `cities` is a list of `{ stopKey, lat, lng }`; entries missing a
 * coordinate or a `stopKey` are skipped.
 */
export function nearestStop(lat, lng, cities, maxKm = 150) {
  if (lat == null || lng == null) return null;
  let bestKey = null;
  let bestKm = Infinity;
  for (const city of cities || []) {
    if (!city || !city.stopKey || city.lat == null || city.lng == null) continue;
    const km = haversineKm(lat, lng, city.lat, city.lng);
    if (km < bestKm) {
      bestKm = km;
      bestKey = city.stopKey;
    }
  }
  return bestKm <= maxKm ? bestKey : null;
}

/**
 * Stop chips for the Map tab (V4 §8): one per distinct city, in route
 * order, first occurrence wins when the route visits a city twice. Falls
 * back to `allCities` (every city across every option, V4 §8) when
 * `chosenStops` is empty — there's no chosen route yet.
 */
export function stopChips(chosenStops, allCities) {
  const source = chosenStops && chosenStops.length > 0 ? chosenStops : allCities || [];
  const seen = new Set();
  const chips = [];
  for (const entry of source) {
    const stopKey = entry.stopKey || entry.cityKey;
    if (!stopKey || seen.has(stopKey)) continue;
    seen.add(stopKey);
    chips.push({ stopKey, city: entry.city || stopKey });
  }
  return chips;
}
