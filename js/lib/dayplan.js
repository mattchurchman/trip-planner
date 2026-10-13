// Pure: turning a chosen route's stops into days (T27, V4 §8). No DOM, no Firebase.
import { stayNights } from "./coverage.js";
import { distanceKm } from "./stops.js";

const HOME_STAY_MAX_KM = 50;

/** Every "YYYY-MM-DD" date from `start` to `end`, inclusive. */
export function datesBetween(start, end) {
  const dates = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return dates;
}

/**
 * One `{ date, cityKey, title }` per date of the route's stops (T27, V4 §8).
 * Stops are processed in order and each one claims every date from its
 * `from` to its `to`, so a later stop always overwrites an earlier one's
 * claim on their shared turnover date — a travel day belongs to the city you
 * arrive in. The very last stop also keeps its final date, since there's no
 * later stop to claim it. A stop missing either date is skipped.
 */
export function daysFromStops(stops) {
  const owner = new Map();
  for (const stop of stops || []) {
    if (!stop || !stop.from || !stop.to) continue;
    for (const date of datesBetween(stop.from, stop.to)) {
      owner.set(date, stop);
    }
  }
  return [...owner.keys()].sort().map((date) => {
    const stop = owner.get(date);
    return { date, cityKey: stop.cityKey, title: stop.city };
  });
}

/**
 * The chosen, located stay whose nights include `date` (T39, §7.8, T50): a
 * dated day inside a stay's check-in/check-out range shows that stay as home
 * base. A departure day (the morning after the last night) still counts
 * (tonight's bed wins over a checkout-only match when both exist), since you
 * slept there the night before. With `cityKey` and `cities` (a list of
 * `{ stopKey|cityKey, lat, lng }`, e.g. from a merged route), a stay more
 * than ~50km from that city's stop is ignored — a travel day's home base is
 * never the previous city's hotel. `null` with no date, or no match.
 */
export function stayForDate(date, chosenStays, cityKey, cities) {
  if (!date) return null;
  const cityCoord = cityKey
    ? (cities || []).find((c) => c && (c.stopKey === cityKey || c.cityKey === cityKey) && c.lat != null && c.lng != null)
    : null;
  const candidates = (chosenStays || []).filter((stay) => {
    if (!stay || stay.lat == null || stay.lng == null) return false;
    return !cityCoord || distanceKm(stay.lat, stay.lng, cityCoord.lat, cityCoord.lng) <= HOME_STAY_MAX_KM;
  });
  return candidates.find((stay) => stayNights(stay).includes(date)) || candidates.find((stay) => date === stay.checkOut) || null;
}

/** The entries in `wanted` whose date isn't already an existing day's date, so
 * creating days from the route never duplicates one already on the board. */
export function missingDays(existingDays, wanted) {
  const existingDates = new Set((existingDays || []).map((d) => d.date).filter(Boolean));
  return (wanted || []).filter((w) => !existingDates.has(w.date));
}
