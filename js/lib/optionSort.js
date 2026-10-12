// Pure: sort order and stable stay numbering for the Map tab's stays list
// (V4 §7) and the Routes tab's home flights (V4 §4.6). No DOM, no Firebase.
import { latestEntry, perNightCents } from "./totals.js";
import { nightsBetween } from "./dates.js";

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const latestPriceOf = (item) => latestEntry(item.prices)?.amountCents ?? null;

/** Ascending by amount, `null` (unpriced) sorted last. 0 when both are null. */
function comparePriceAsc(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

/** Comparator: cheapest latest price first, unpriced last — the order the
 * Routes tab lists a traveler's home flights in (V4 §4.6). */
export function byLatestPriceAsc(a, b) {
  return comparePriceAsc(latestPriceOf(a), latestPriceOf(b));
}

function perNightOf(stay) {
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const latest = latestEntry(stay.prices);
  if (!nights || !latest) return null;
  return perNightCents(latest.amountCents, nights);
}

/** Sort stays (§7.7, T24): chosen first, then not-Out before Out (Out stays
 * sort last), then lowest price per night (unpriced/nightless last).
 * `chosenIds` from `selection.js`'s `chosenStayIds`. */
export function sortStayOptions(stays, chosenIds = []) {
  return [...stays].sort((a, b) => {
    const aChosen = chosenIds.includes(a.id);
    const bChosen = chosenIds.includes(b.id);
    if (aChosen !== bChosen) return aChosen ? -1 : 1;

    const aOut = !!a.out;
    const bOut = !!b.out;
    if (aOut !== bOut) return aOut ? 1 : -1;

    const priceDiff = comparePriceAsc(perNightOf(a), perNightOf(b));
    if (priceDiff !== 0) return priceDiff;

    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
}

/** Each stay's stable display number (①…⑩): position in `createdAt` order,
 * oldest first, independent of the current display sort — computed once per
 * render so a stay's number never changes as it's chosen or reprised.
 * Returns `{ [stayId]: number }`. Exported for the stays map (T13) too. */
export function stayNumbers(stays) {
  const ordered = [...stays].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  const numbers = {};
  ordered.forEach((s, i) => {
    numbers[s.id] = i + 1;
  });
  return numbers;
}

const CIRCLED_DIGITS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

/** "3" -> "③"; falls back to "(n)" outside 1-10 (stays are capped at 10, §7.7). */
export function circledNumber(n) {
  return CIRCLED_DIGITS[n - 1] || `(${n})`;
}
