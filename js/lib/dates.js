// Pure date helpers: no DOM, no Firebase. See SPEC.md §11.

/**
 * Whole nights between two "YYYY-MM-DD" dates, computed in UTC.
 * Returns null when either date is missing or checkout isn't after checkin.
 */
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end <= start) return null;
  return Math.round((end - start) / 86400000);
}

/** Display label for a night count, or "Dates needed" when it can't be computed. */
export function nightsLabel(checkIn, checkOut) {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights === null) return "Dates needed";
  return `${nights} night${nights === 1 ? "" : "s"}`;
}

/**
 * True when two "YYYY-MM-DD" date ranges overlap (inclusive of touching endpoints).
 * False if any of the four dates is missing. A single day's range is `(date, date)`.
 * Used for the Places "Events during trip dates" filter and the Days "Happening
 * this day" hint (§7.6, §7.9).
 */
export function rangesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && endA >= startB;
}

/** Relative time label such as "5 minutes ago", for recent timestamps (§8). */
export function relativeTime(date, now = new Date()) {
  const then = date instanceof Date ? date : new Date(date);
  const diffSec = Math.round((now - then) / 1000);
  const divisions = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let value = diffSec;
  let unit = "second";
  for (const [amount, name] of divisions) {
    unit = name;
    if (Math.abs(value) < amount) break;
    value = Math.round(value / amount);
  }
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return rtf.format(-value, unit);
}
