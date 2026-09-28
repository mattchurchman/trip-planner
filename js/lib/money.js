// Pure money helpers: no DOM, no Firebase. See SPEC.md §11.

/**
 * Parses a user-typed amount into integer cents, or null if invalid.
 * Strips spaces, a leading currency symbol and thousands commas, then
 * requires ^\d+(\.\d{1,2})?$ so it never loses precision to floating point.
 */
export function parseMoney(input) {
  if (typeof input !== "string") return null;
  let text = input.replace(/\s+/g, "");
  // Strip a leading currency symbol but never a sign, so "-5" stays negative and
  // fails the test below instead of being silently read as $5.
  text = text.replace(/^[^\d.-]+/, "");
  text = text.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [wholePart, fractionPart = ""] = text.split(".");
  const centsPart = (fractionPart + "00").slice(0, 2);
  return Number(wholePart) * 100 + Number(centsPart);
}

/** Formats integer cents as a localized currency string. */
export function formatMoney(cents, currency = "USD", locale = undefined) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/**
 * Splits integer cents into n whole-cent shares that always sum to the
 * original amount. The first `remainder` shares get one extra cent.
 */
export function split(amountCents, n) {
  if (!Number.isInteger(amountCents) || !Number.isInteger(n) || n <= 0) {
    throw new Error("split requires an integer amount and a positive integer count");
  }
  const base = Math.floor(amountCents / n);
  const remainder = amountCents - base * n;
  return Array.from({ length: n }, (_, i) => (i < remainder ? base + 1 : base));
}
