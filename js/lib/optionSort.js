// Pure: sort order, the "Cheapest" pick, and stable stay numbering for the
// Flights & stays tab (§7.7). No DOM, no Firebase.
import { latestEntry, perNightCents } from "./totals.js";
import { voteScore } from "./votes.js";
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

/** Sort flight options (§7.7): chosen first, then lowest latest price
 * (unpriced last), then newest first. `chosenIds` are that traveler's chosen
 * flight ids (from `selection.js`'s `chosenFlightIds`). */
export function sortFlightOptions(flights, chosenIds = []) {
  return [...flights].sort((a, b) => {
    const aChosen = chosenIds.includes(a.id);
    const bChosen = chosenIds.includes(b.id);
    if (aChosen !== bChosen) return aChosen ? -1 : 1;

    const priceDiff = comparePriceAsc(latestPriceOf(a), latestPriceOf(b));
    if (priceDiff !== 0) return priceDiff;

    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
}

/** The id of the cheapest-priced flight among `flights`, or `null` when
 * fewer than two have a logged price — a single priced option isn't worth
 * badging as "cheapest". */
export function cheapestFlightId(flights) {
  const priced = flights.filter((f) => latestPriceOf(f) != null);
  if (priced.length < 2) return null;
  return priced.reduce((min, f) => (latestPriceOf(f) < latestPriceOf(min) ? f : min)).id;
}

function perNightOf(stay) {
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const latest = latestEntry(stay.prices);
  if (!nights || !latest) return null;
  return perNightCents(latest.amountCents, nights);
}

/** Sort stay options (§7.7): chosen first, then rank score descending, then
 * lowest price per night (unpriced/nightless last). `chosenIds` from
 * `selection.js`'s `chosenStayIds`. */
export function sortStayOptions(stays, chosenIds = []) {
  return [...stays].sort((a, b) => {
    const aChosen = chosenIds.includes(a.id);
    const bChosen = chosenIds.includes(b.id);
    if (aChosen !== bChosen) return aChosen ? -1 : 1;

    const scoreDiff = voteScore(b.votes) - voteScore(a.votes);
    if (scoreDiff !== 0) return scoreDiff;

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
