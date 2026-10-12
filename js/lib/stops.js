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

const keyOf = (stop) => (stop && (stop.stopKey || stop.cityKey)) || null;

/**
 * The stop a stay belongs to (T38, §7.7), as its `stopKey`, or `null`:
 * the merged-route stop whose dates contain the stay's check-in (a stop
 * runs from its first night up to, not including, the day it ends — a
 * check-in on that last day is the next stop's night), else the nearest
 * city within 150km of its pin. When several stops overlap the check-in
 * (travelers in different cities at once), the one nearest the pin wins.
 * `mergedStops` carry `from`/`to`/`cityKey`; `cities` is `nearestStop`'s list.
 */
export function stopForStay(stay, mergedStops, cities) {
  if (!stay) return null;
  const hasPin = stay.lat != null && stay.lng != null;
  if (stay.checkIn) {
    const containing = (mergedStops || []).filter(
      (stop) => keyOf(stop) && stop.from && stop.from <= stay.checkIn && (!stop.to || stay.checkIn < stop.to)
    );
    if (containing.length === 1 || (containing.length > 1 && !hasPin)) return keyOf(containing[0]);
    if (containing.length > 1) {
      const coords = new Map((cities || []).map((c) => [keyOf(c), c]));
      const km = (stop) => {
        const c = coords.get(keyOf(stop));
        return c && c.lat != null && c.lng != null ? haversineKm(stay.lat, stay.lng, c.lat, c.lng) : Infinity;
      };
      return keyOf(containing.reduce((best, stop) => (km(stop) < km(best) ? stop : best)));
    }
  }
  return hasPin ? nearestStop(stay.lat, stay.lng, cities) : null;
}

/**
 * The stop a stay shows under today: its own `stopKey` while that is still a
 * stop of the current route (or a known city), otherwise whatever
 * `stopForStay` works out — never written back, so changing the route never
 * needs a mass-write.
 */
export function stayStopKey(stay, mergedStops, cities) {
  const own = stay && stay.stopKey;
  if (own && [...(mergedStops || []), ...(cities || [])].some((stop) => keyOf(stop) === own)) return own;
  return stopForStay(stay, mergedStops, cities);
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
