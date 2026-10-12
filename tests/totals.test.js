import assert from "node:assert/strict";
import { latestEntry, priceDelta, isNewLow, perNightCents, priceAgeDays, isStale, stalePriceQueue } from "../js/lib/totals.js";

export const tests = [
  ["latestEntry picks the greatest checkedAt regardless of array order", () => {
    const prices = [
      { id: "b", amountCents: 200, checkedAt: "2026-03-01T00:00:00.000Z" },
      { id: "a", amountCents: 100, checkedAt: "2026-03-05T00:00:00.000Z" },
      { id: "c", amountCents: 150, checkedAt: "2026-02-01T00:00:00.000Z" },
    ];
    assert.equal(latestEntry(prices).id, "a");
  }],
  ["latestEntry breaks an exact checkedAt tie by the greater id", () => {
    const prices = [
      { id: "aaa", amountCents: 100, checkedAt: "2026-03-01T00:00:00.000Z" },
      { id: "zzz", amountCents: 200, checkedAt: "2026-03-01T00:00:00.000Z" },
    ];
    assert.equal(latestEntry(prices).id, "zzz");
  }],
  ["priceDelta is null with fewer than 2 entries", () => {
    assert.equal(priceDelta([]), null);
    assert.equal(priceDelta([{ id: "a", amountCents: 100, checkedAt: "2026-03-01T00:00:00.000Z" }]), null);
  }],
  ["priceDelta: up, down and no change", () => {
    const up = [
      { id: "a", amountCents: 100, checkedAt: "2026-03-01T00:00:00.000Z" },
      { id: "b", amountCents: 138, checkedAt: "2026-03-02T00:00:00.000Z" },
    ];
    assert.equal(priceDelta(up), 38);
    const down = [
      { id: "a", amountCents: 100, checkedAt: "2026-03-01T00:00:00.000Z" },
      { id: "b", amountCents: 88, checkedAt: "2026-03-02T00:00:00.000Z" },
    ];
    assert.equal(priceDelta(down), -12);
    const same = [
      { id: "a", amountCents: 100, checkedAt: "2026-03-01T00:00:00.000Z" },
      { id: "b", amountCents: 100, checkedAt: "2026-03-02T00:00:00.000Z" },
    ];
    assert.equal(priceDelta(same), 0);
  }],
  ["isNewLow is false with a single entry", () => {
    assert.equal(isNewLow([{ id: "a", amountCents: 100, checkedAt: "2026-03-01T00:00:00.000Z" }]), false);
  }],
  ["isNewLow is true only when the latest beats every earlier entry", () => {
    const newLow = [
      { id: "a", amountCents: 100, checkedAt: "2026-03-01T00:00:00.000Z" },
      { id: "b", amountCents: 90, checkedAt: "2026-03-02T00:00:00.000Z" },
      { id: "c", amountCents: 80, checkedAt: "2026-03-03T00:00:00.000Z" },
    ];
    assert.equal(isNewLow(newLow), true);
    const notNewLow = [
      { id: "a", amountCents: 80, checkedAt: "2026-03-01T00:00:00.000Z" },
      { id: "b", amountCents: 90, checkedAt: "2026-03-02T00:00:00.000Z" },
      { id: "c", amountCents: 85, checkedAt: "2026-03-03T00:00:00.000Z" },
    ];
    assert.equal(isNewLow(notNewLow), false);
  }],
  ["perNightCents divides the total for 9 nights", () => {
    assert.equal(perNightCents(90000, 9), 10000);
  }],
  ["perNightCents is null with no nights", () => {
    assert.equal(perNightCents(90000, null), null);
    assert.equal(perNightCents(90000, 0), null);
  }],
  ["priceAgeDays is null with no prices, 0 right after checking, and whole days later", () => {
    const now = new Date("2026-03-10T00:00:00.000Z");
    assert.equal(priceAgeDays([], now), null);
    assert.equal(priceAgeDays([{ id: "a", amountCents: 100, checkedAt: "2026-03-10T00:00:00.000Z" }], now), 0);
    assert.equal(priceAgeDays([{ id: "a", amountCents: 100, checkedAt: "2026-03-05T00:00:00.000Z" }], now), 5);
  }],
  ["isStale: no price is stale, 3 days is not yet stale, older than 3 days is", () => {
    const now = new Date("2026-03-10T00:00:00.000Z");
    assert.equal(isStale([], now), true);
    assert.equal(isStale([{ id: "a", amountCents: 100, checkedAt: "2026-03-07T00:00:00.000Z" }], now), false);
    assert.equal(isStale([{ id: "a", amountCents: 100, checkedAt: "2026-03-05T23:59:59.000Z" }], now), true);
  }],
  ["stalePriceQueue keeps only stale items, in screen order", () => {
    const now = new Date("2026-03-10T00:00:00.000Z");
    const items = [
      { id: "fresh", prices: [{ id: "a", amountCents: 100, checkedAt: "2026-03-09T00:00:00.000Z" }] },
      { id: "stale", prices: [{ id: "b", amountCents: 100, checkedAt: "2026-03-01T00:00:00.000Z" }] },
      { id: "none", prices: [] },
    ];
    assert.deepEqual(stalePriceQueue(items, now).map((i) => i.id), ["stale", "none"]);
  }],
];
