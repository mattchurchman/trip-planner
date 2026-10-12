import assert from "node:assert/strict";
import { latestEntry, priceDelta, isNewLow, perNightCents, computeBudget, priceAgeDays, isStale, stalePriceQueue } from "../js/lib/totals.js";

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
  ["computeBudget: no chosen route names every traveler as missing, but still totals the stays and costs", () => {
    const travelers = [
      { id: "t1", name: "Sam" },
      { id: "t2", name: "Alex" },
    ];
    const stays = [{ name: "Casa Alfama", prices: [{ id: "p1", amountCents: 100001, checkedAt: "2026-03-01T00:00:00.000Z" }] }];
    const sharedCosts = [{ amountCents: 10000 }];
    const result = computeBudget({ travelers, homeFlightsByTraveler: {}, hopFlights: [], stays, sharedCosts });
    assert.equal(result.complete, false);
    assert.deepEqual(result.missing, ["No flight chosen for Sam", "No flight chosen for Alex"]);
    const sumOfTravelerTotals = result.travelerTotals.reduce((sum, t) => sum + t.totalCents, 0);
    assert.equal(sumOfTravelerTotals, result.combinedCents);
    assert.equal(result.combinedCents, 100001 + 10000);
  }],
  ["computeBudget names a home flight's label when it has no price, without labeling the budget complete", () => {
    const travelers = [{ id: "t1", name: "Sam" }];
    const homeFlightsByTraveler = { t1: [{ label: "Nonstop, Tuesday out", prices: [] }] };
    const result = computeBudget({ travelers, homeFlightsByTraveler, hopFlights: [], stays: [], sharedCosts: [] });
    assert.equal(result.complete, false);
    assert.deepEqual(result.missing, [`No price logged for Sam's flight "Nonstop, Tuesday out"`]);
    assert.equal(result.travelerTotals[0].totalCents, 0);
  }],
  ["computeBudget sums two travelers' different home flights plus the shared hop, matching the combined total exactly", () => {
    const travelers = [
      { id: "t1", name: "Sam" },
      { id: "t2", name: "Alex" },
    ];
    const homeFlightsByTraveler = {
      t1: [{ label: "Sam's flight", prices: [{ id: "p1", amountCents: 42000, checkedAt: "2026-03-01T00:00:00.000Z" }] }],
      t2: [{ label: "Alex's flight", prices: [{ id: "p2", amountCents: 61000, checkedAt: "2026-03-01T00:00:00.000Z" }] }],
    };
    const hopFlights = [{ label: "Shared hop", prices: [{ id: "p3", amountCents: 5000, checkedAt: "2026-03-01T00:00:00.000Z" }] }];
    const result = computeBudget({ travelers, homeFlightsByTraveler, hopFlights, stays: [], sharedCosts: [] });
    assert.equal(result.complete, true);
    assert.deepEqual(result.missing, []);
    assert.equal(result.travelerTotals[0].totalCents, 42000 + 5000);
    assert.equal(result.travelerTotals[1].totalCents, 61000 + 5000);
    assert.equal(result.combinedCents, 42000 + 61000 + 5000 + 5000);
  }],
  ["computeBudget splits a shared cost across 3 travelers, shares adding exactly to the whole", () => {
    const travelers = [
      { id: "t1", name: "Sam" },
      { id: "t2", name: "Alex" },
      { id: "t3", name: "Jo" },
    ];
    const sharedCosts = [{ amountCents: 10001 }];
    const result = computeBudget({ travelers, homeFlightsByTraveler: {}, hopFlights: [], stays: [], sharedCosts });
    const sumOfTravelerTotals = result.travelerTotals.reduce((sum, t) => sum + t.totalCents, 0);
    assert.equal(sumOfTravelerTotals, 10001);
  }],
  ["computeBudget: no stay chosen is still complete", () => {
    const travelers = [{ id: "t1", name: "Sam" }];
    const homeFlightsByTraveler = { t1: [{ label: "Only option", prices: [{ id: "p1", amountCents: 10000, checkedAt: "2026-03-01T00:00:00.000Z" }] }] };
    const result = computeBudget({ travelers, homeFlightsByTraveler, hopFlights: [], stays: [], sharedCosts: [] });
    assert.equal(result.complete, true);
    assert.deepEqual(result.missing, []);
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
