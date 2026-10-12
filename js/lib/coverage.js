// Pure: which nights of a stop are covered by the chosen stays, and what
// those stays cost (V4 §7, T24). No DOM, no Firebase.
import { nightsBetween } from "./dates.js";
import { latestEntry } from "./totals.js";

/** "YYYY-MM-DD" plus `n` days, in UTC. */
function addDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** The nights a stay covers, as "YYYY-MM-DD" check-in dates — one per night.
 * Empty when checkIn/checkOut is missing or checkout isn't after checkin. */
export function stayNights(stay) {
  const nights = nightsBetween(stay && stay.checkIn, stay && stay.checkOut);
  if (nights === null) return [];
  const dates = [];
  for (let i = 0; i < nights; i++) dates.push(addDays(stay.checkIn, i));
  return dates;
}

/**
 * One entry per night of `stop` (a merged stop: `from`/`to` dates), earliest
 * first: `{ date, status, travelerIds }` where `status` is "open" (no chosen
 * stay covers that night), "covered" (exactly one does) or "double" (two or
 * more do), and `travelerIds` is who sleeps in this city that night, from the
 * stop's `nights` list (T38) — `null` when the stop doesn't carry one. Empty
 * when the stop has no dates.
 */
export function nightCoverage(stop, chosenStays) {
  const nights = nightsBetween(stop && stop.from, stop && stop.to);
  if (nights === null) return [];
  const covering = (chosenStays || []).map(stayNights);
  const entries = [];
  for (let i = 0; i < nights; i++) {
    const date = addDays(stop.from, i);
    const count = covering.reduce((sum, dates) => sum + (dates.includes(date) ? 1 : 0), 0);
    const there = Array.isArray(stop.nights) ? stop.nights.find((n) => n.date === date) : null;
    entries.push({
      date,
      status: count === 0 ? "open" : count === 1 ? "covered" : "double",
      travelerIds: Array.isArray(stop.nights) ? (there ? there.travelerIds : []) : null,
    });
  }
  return entries;
}

/** `nightCoverage`'s tally: how many nights have a chosen stay, and whether
 * every one does (T38). A stop with no dated nights is never complete. */
export function coverageSummary(entries) {
  const total = (entries || []).length;
  const covered = (entries || []).filter((e) => e.status !== "open").length;
  return { covered, total, complete: total > 0 && covered === total };
}

/** The chosen stays' combined latest price for one stop. `complete` is false
 * when any of them has no price logged yet (missing counts as 0). */
export function stopStayTotal(chosenStays) {
  let cents = 0;
  let complete = true;
  for (const stay of chosenStays || []) {
    const latest = latestEntry(stay.prices);
    if (!latest) complete = false;
    else cents += latest.amountCents;
  }
  return { cents, complete };
}
