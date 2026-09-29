import assert from "node:assert/strict";
import { sortFlightOptions, cheapestFlightId, sortStayOptions, stayNumbers, circledNumber } from "../js/lib/optionSort.js";

const price = (cents) => (cents == null ? [] : [{ id: "p1", amountCents: cents, checkedAt: "2026-01-01T00:00:00.000Z", byUid: "u1", note: "" }]);

export const tests = [
  ["sortFlightOptions: chosen first, then lowest price, unpriced last", () => {
    const flights = [
      { id: "a", prices: price(300), createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", prices: price(100), createdAt: "2026-01-02T00:00:00.000Z" },
      { id: "c", prices: [], createdAt: "2026-01-03T00:00:00.000Z" },
      { id: "d", prices: price(500), createdAt: "2026-01-04T00:00:00.000Z" }, // chosen
    ];
    const sorted = sortFlightOptions(flights, ["d"]);
    assert.deepEqual(sorted.map((f) => f.id), ["d", "b", "a", "c"]);
  }],
  ["sortFlightOptions: ties on price/chosen break by newest first", () => {
    const flights = [
      { id: "old", prices: price(100), createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "new", prices: price(100), createdAt: "2026-01-05T00:00:00.000Z" },
    ];
    const sorted = sortFlightOptions(flights, []);
    assert.deepEqual(sorted.map((f) => f.id), ["new", "old"]);
  }],
  ["cheapestFlightId: null with fewer than two priced options", () => {
    assert.equal(cheapestFlightId([{ id: "a", prices: price(100) }]), null);
    assert.equal(cheapestFlightId([{ id: "a", prices: [] }, { id: "b", prices: [] }]), null);
  }],
  ["cheapestFlightId: the lowest-priced id among two or more priced options", () => {
    const flights = [
      { id: "a", prices: price(300) },
      { id: "b", prices: price(100) },
      { id: "c", prices: [] },
    ];
    assert.equal(cheapestFlightId(flights), "b");
  }],
  ["sortStayOptions: chosen first, then rank score, then lowest per-night price", () => {
    const stays = [
      { id: "a", votes: { u1: "must" }, prices: price(70000), checkIn: "2026-01-01", checkOut: "2026-01-08", createdAt: "2026-01-01T00:00:00.000Z" }, // score 2, $100/night
      { id: "b", votes: { u1: "nice" }, prices: price(35000), checkIn: "2026-01-01", checkOut: "2026-01-08", createdAt: "2026-01-01T00:00:00.000Z" }, // score 1, $50/night
      { id: "c", votes: { u1: "must" }, prices: price(1000000), checkIn: "2026-01-01", checkOut: "2026-01-08", createdAt: "2026-01-01T00:00:00.000Z" }, // chosen, score 2 but cheap-doesn't matter
    ];
    const sorted = sortStayOptions(stays, ["c"]);
    assert.deepEqual(sorted.map((s) => s.id), ["c", "a", "b"]);
  }],
  ["stayNumbers: a stay's number doesn't change when it becomes chosen (chosen status plays no part in numbering)", () => {
    const stays = [
      { id: "a", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    const before = stayNumbers(stays);
    // Choosing "b" only reorders the *display* sort, never the numbering input.
    const displaySorted = sortStayOptions(stays, ["b"]);
    const after = stayNumbers(displaySorted);
    assert.deepEqual(before, after);
    assert.equal(after.b, 2);
  }],
  ["stayNumbers: follows createdAt order oldest first, 1-indexed", () => {
    const stays = [
      { id: "third", createdAt: "2026-01-03T00:00:00.000Z" },
      { id: "first", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "second", createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    assert.deepEqual(stayNumbers(stays), { third: 3, first: 1, second: 2 });
  }],
  ["stayNumbers: stable regardless of the array's input order (independent of display sort)", () => {
    const stays = [
      { id: "first", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "second", createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    const numbersA = stayNumbers(stays);
    const numbersB = stayNumbers([...stays].reverse());
    assert.deepEqual(numbersA, numbersB);
  }],
  ["circledNumber: 1-10 map to circled digits, outside range falls back", () => {
    assert.equal(circledNumber(1), "①");
    assert.equal(circledNumber(10), "⑩");
    assert.equal(circledNumber(11), "(11)");
  }],
];
