import assert from "node:assert/strict";
import { stayPinLabel } from "../js/lib/staypins.js";

export const tests = [
  ["stayPinLabel shows the per-night price when nights are known: $1,260 over 7 nights", () => {
    assert.equal(stayPinLabel({ number: 3, latestCents: 126000, nights: 7, currency: "USD" }), "③ $180");
  }],
  ["stayPinLabel rounds the per-night price to the nearest whole unit: $1,000.01 over 3 nights", () => {
    assert.equal(stayPinLabel({ number: 1, latestCents: 100001, nights: 3, currency: "USD" }), "① $333");
  }],
  ["stayPinLabel shows the total, labeled, when nights are unknown", () => {
    assert.equal(stayPinLabel({ number: 2, latestCents: 126000, nights: null, currency: "USD" }), "② $1,260 total");
  }],
  ["stayPinLabel shows just the number when there's no price yet", () => {
    assert.equal(stayPinLabel({ number: 4, latestCents: null, nights: 7, currency: "USD" }), "④");
  }],
  ["stayPinLabel formats in the trip's currency", () => {
    assert.match(stayPinLabel({ number: 5, latestCents: 10000, nights: null, currency: "EUR" }), /€/);
  }],
];
