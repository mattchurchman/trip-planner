// Pure: stay map pin labels for the Map tab (V4 §8). No DOM, no Firebase.
import { circledNumber } from "./optionSort.js";
import { perNightCents } from "./totals.js";

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
