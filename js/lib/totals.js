// Pure: latest price, deltas, per-traveler totals. See SPEC.md §11. No DOM, no Firebase.
import { split } from "./money.js";

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

/**
 * Per-traveler and combined totals (§11).
 * `selectedFlights`: trip.selectedFlights map (travelerId -> flightId).
 * `flightsById`: all of the trip's flight docs, keyed by id.
 * `stay`: the chosen stay doc, or null/undefined if none is chosen.
 * `sharedCosts`: array of cost docs, each split separately across all travelers.
 * Missing amounts count as 0 in the sums but are named in `missing`; `complete` is
 * false whenever anything's missing (never label a partial total complete).
 */
export function computeTotals({ travelers, selectedFlights, flightsById, stay, sharedCosts }) {
  const n = travelers.length;
  const missing = [];

  const flightAmounts = travelers.map((traveler) => {
    const flightId = selectedFlights[traveler.id];
    if (!flightId) {
      missing.push(`No flight chosen for ${traveler.name}`);
      return 0;
    }
    const flight = flightsById[flightId];
    const latest = flight && latestEntry(flight.prices);
    if (!latest) {
      missing.push(`No price logged for ${traveler.name}'s flight`);
      return 0;
    }
    return latest.amountCents;
  });

  let stayShares = travelers.map(() => 0);
  if (stay) {
    const latest = latestEntry(stay.prices);
    if (!latest) {
      missing.push(`No price logged for ${stay.name}`);
    } else {
      stayShares = split(latest.amountCents, n);
    }
  }

  const costShareTotals = travelers.map(() => 0);
  for (const cost of sharedCosts) {
    split(cost.amountCents, n).forEach((share, i) => {
      costShareTotals[i] += share;
    });
  }

  const travelerTotals = travelers.map((traveler, i) => ({
    travelerId: traveler.id,
    name: traveler.name,
    totalCents: flightAmounts[i] + stayShares[i] + costShareTotals[i],
  }));

  const combinedCents = travelerTotals.reduce((sum, t) => sum + t.totalCents, 0);

  return { travelerTotals, combinedCents, complete: missing.length === 0, missing };
}
