// Pure: stay map pin labels and the "our top places" filter for the stays
// price-pin map (§7.7.1). No DOM, no Firebase.
import { circledNumber } from "./optionSort.js";
import { perNightCents } from "./totals.js";
import { voteScore } from "./votes.js";

function formatWholeUnits(amountCents, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

/**
 * A stay's map pin label (§7.7.1): "③ $180" (per night, rounded to the
 * nearest whole unit, when nights are known), "③ $1,260 total" (nights
 * unknown), or just "③" (no price yet).
 */
export function stayPinLabel({ number, latestCents, nights, currency = "USD" }) {
  const badge = circledNumber(number);
  if (latestCents == null) return badge;
  const perNight = nights ? perNightCents(latestCents, nights) : null;
  if (perNight != null) return `${badge} ${formatWholeUnits(perNight, currency)}`;
  return `${badge} ${formatWholeUnits(latestCents, currency)} total`;
}

/**
 * Located places for `destinationId` with a rank score of 2 or more (§7.3),
 * for the stays map's "Show our top places" layer.
 */
export function topPlaces(places, destinationId) {
  return places.filter(
    (p) => p.destinationId === destinationId && p.lat != null && p.lng != null && voteScore(p.votes) >= 2
  );
}
