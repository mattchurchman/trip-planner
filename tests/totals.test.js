import assert from "node:assert/strict";
import { latestEntry, priceDelta, isNewLow, perNightCents, computeTotals } from "../js/lib/totals.js";

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
  ["computeTotals sums two travelers' flights, half the stay each, and a shared cost, matching the combined total exactly", () => {
    const travelers = [
      { id: "t1", name: "Sam" },
      { id: "t2", name: "Alex" },
    ];
    const selectedFlightIdsByTraveler = { t1: ["f1"], t2: ["f2"] };
    const flightsById = {
      f1: { prices: [{ id: "p1", amountCents: 42000, checkedAt: "2026-03-01T00:00:00.000Z" }] },
      f2: { prices: [{ id: "p2", amountCents: 61000, checkedAt: "2026-03-01T00:00:00.000Z" }] },
    };
    const stays = [{ name: "Casa Alfama", prices: [{ id: "p3", amountCents: 100001, checkedAt: "2026-03-01T00:00:00.000Z" }] }];
    const sharedCosts = [{ amountCents: 10000 }];
    const result = computeTotals({ travelers, selectedFlightIdsByTraveler, flightsById, stays, sharedCosts });
    assert.equal(result.complete, true);
    assert.deepEqual(result.missing, []);
    const sumOfTravelerTotals = result.travelerTotals.reduce((sum, t) => sum + t.totalCents, 0);
    assert.equal(sumOfTravelerTotals, result.combinedCents);
    assert.equal(result.combinedCents, 42000 + 61000 + 100001 + 10000);
  }],
  ["computeTotals reports a partial total and names the flight's label when it has no price, without labeling it complete", () => {
    const travelers = [{ id: "t1", name: "Sam" }];
    const selectedFlightIdsByTraveler = { t1: ["f1"] };
    const flightsById = { f1: { label: "Nonstop, Tuesday out", prices: [] } };
    const result = computeTotals({ travelers, selectedFlightIdsByTraveler, flightsById, stays: [], sharedCosts: [] });
    assert.equal(result.complete, false);
    assert.deepEqual(result.missing, [`No price logged for Sam's flight "Nonstop, Tuesday out"`]);
    assert.equal(result.travelerTotals[0].totalCents, 0);
  }],
  ["computeTotals sums two chosen flights for the same traveler ($300.00 + $120.50)", () => {
    const travelers = [{ id: "t1", name: "Sam" }];
    const selectedFlightIdsByTraveler = { t1: ["f1", "f2"] };
    const flightsById = {
      f1: { label: "Outbound", prices: [{ id: "p1", amountCents: 30000, checkedAt: "2026-03-01T00:00:00.000Z" }] },
      f2: { label: "Return", prices: [{ id: "p2", amountCents: 12050, checkedAt: "2026-03-01T00:00:00.000Z" }] },
    };
    const result = computeTotals({ travelers, selectedFlightIdsByTraveler, flightsById, stays: [], sharedCosts: [] });
    assert.equal(result.complete, true);
    assert.equal(result.travelerTotals[0].totalCents, 30000 + 12050);
    assert.equal(result.combinedCents, 30000 + 12050);
  }],
  ["computeTotals splits two chosen stays across 3 travelers, shares adding exactly to the whole", () => {
    const travelers = [
      { id: "t1", name: "Sam" },
      { id: "t2", name: "Alex" },
      { id: "t3", name: "Jo" },
    ];
    const selectedFlightIdsByTraveler = { t1: [], t2: [], t3: [] };
    const stays = [
      { name: "Casa Alfama", prices: [{ id: "p1", amountCents: 100001, checkedAt: "2026-03-01T00:00:00.000Z" }] },
      { name: "Side trip stay", prices: [{ id: "p2", amountCents: 45000, checkedAt: "2026-03-01T00:00:00.000Z" }] },
    ];
    // Every traveler has 0 chosen flights here, so this is a Partial total (missing
    // flights) -- but the stay math itself must still add up exactly regardless.
    const result = computeTotals({ travelers, selectedFlightIdsByTraveler, flightsById: {}, stays, sharedCosts: [] });
    const sumOfTravelerTotals = result.travelerTotals.reduce((sum, t) => sum + t.totalCents, 0);
    assert.equal(sumOfTravelerTotals, 100001 + 45000);
  }],
  ["computeTotals: no stay chosen is still complete", () => {
    const travelers = [{ id: "t1", name: "Sam" }];
    const selectedFlightIdsByTraveler = { t1: ["f1"] };
    const flightsById = { f1: { label: "Only option", prices: [{ id: "p1", amountCents: 10000, checkedAt: "2026-03-01T00:00:00.000Z" }] } };
    const result = computeTotals({ travelers, selectedFlightIdsByTraveler, flightsById, stays: [], sharedCosts: [] });
    assert.equal(result.complete, true);
    assert.deepEqual(result.missing, []);
  }],
];
