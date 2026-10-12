// Pure: latest price, deltas, staleness, per-night. See SPEC.md §11. No DOM, no Firebase.

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** checkedAt desc, ties broken by the greater id. Array order means nothing. */
function sortByTimeDesc(prices) {
  return [...prices].sort((a, b) => {
    const timeDiff = toMillis(b.checkedAt) - toMillis(a.checkedAt);
    if (timeDiff !== 0) return timeDiff;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/** Ascending checkedAt order, for a sparkline. */
export function sortByTimeAsc(prices) {
  return [...(prices || [])].sort((a, b) => {
    const timeDiff = toMillis(a.checkedAt) - toMillis(b.checkedAt);
    if (timeDiff !== 0) return timeDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** The entry with the greatest checkedAt; ties go to the greater id. Null if empty. */
export function latestEntry(prices) {
  if (!prices || prices.length === 0) return null;
  return sortByTimeDesc(prices)[0];
}

/** Latest minus second-latest amount; null with fewer than 2 entries. */
export function priceDelta(prices) {
  if (!prices || prices.length < 2) return null;
  const [latest, previous] = sortByTimeDesc(prices);
  return latest.amountCents - previous.amountCents;
}

/** True only with 2+ entries and the latest strictly below every other entry. */
export function isNewLow(prices) {
  if (!prices || prices.length < 2) return false;
  const latest = latestEntry(prices);
  return prices.every((p) => p.id === latest.id || latest.amountCents < p.amountCents);
}

/** Latest total divided by nights, rounded to the nearest cent for display only — never store it. */
export function perNightCents(totalCents, nights) {
  if (!nights || nights <= 0) return null;
  return Math.round(totalCents / nights);
}

/** Whole days between the latest check and `now`; null with no entries. */
export function priceAgeDays(prices, now = new Date()) {
  const latest = latestEntry(prices);
  if (!latest) return null;
  return Math.floor((toMillis(now) - toMillis(latest.checkedAt)) / 86400000);
}

/** Stale (§5): no price yet, or the latest check is older than 3 days. */
export function isStale(prices, now = new Date()) {
  const age = priceAgeDays(prices, now);
  return age === null || age > 3;
}

/** The stale items among `items` (each with a `prices` array), in the given screen order. */
export function stalePriceQueue(items, now = new Date()) {
  return (items || []).filter((item) => isStale(item.prices, now));
}

// The per-traveler budget lives in js/lib/choices.js now (§11): it needs each
// traveler's own choice and stops, and those need `latestEntry` from here.
