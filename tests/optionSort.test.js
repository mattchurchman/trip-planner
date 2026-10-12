import assert from "node:assert/strict";
import { byLatestPriceAsc, sortStayOptions, stayNumbers, circledNumber } from "../js/lib/optionSort.js";

const price = (cents) => (cents == null ? [] : [{ id: "p1", amountCents: cents, checkedAt: "2026-01-01T00:00:00.000Z", byUid: "u1", note: "" }]);

export const tests = [
  ["byLatestPriceAsc: cheapest latest price first, unpriced last", () => {
    const flights = [
      { id: "a", prices: price(300) },
      { id: "b", prices: price(100) },
      { id: "c", prices: [] },
      { id: "d", prices: price(200) },
    ];
    assert.deepEqual([...flights].sort(byLatestPriceAsc).map((f) => f.id), ["b", "d", "a", "c"]);
  }],
  ["byLatestPriceAsc: two unpriced flights tie, so the input order holds", () => {
    const flights = [{ id: "a", prices: [] }, { id: "b", prices: [] }];
    assert.deepEqual([...flights].sort(byLatestPriceAsc).map((f) => f.id), ["a", "b"]);
  }],
  ["sortStayOptions: chosen first, then not-Out before Out, then lowest per-night price", () => {
    const stays = [
      { id: "a", prices: price(70000), checkIn: "2026-01-01", checkOut: "2026-01-08", createdAt: "2026-01-01T00:00:00.000Z" }, // $100/night
      { id: "b", prices: price(35000), checkIn: "2026-01-01", checkOut: "2026-01-08", createdAt: "2026-01-01T00:00:00.000Z" }, // $50/night
      { id: "c", prices: price(1000000), checkIn: "2026-01-01", checkOut: "2026-01-08", createdAt: "2026-01-01T00:00:00.000Z" }, // chosen, expensive-doesn't matter
      { id: "d", out: true, prices: price(1), checkIn: "2026-01-01", checkOut: "2026-01-08", createdAt: "2026-01-01T00:00:00.000Z" }, // Out, cheapest but sorts last
    ];
    const sorted = sortStayOptions(stays, ["c"]);
    assert.deepEqual(sorted.map((s) => s.id), ["c", "b", "a", "d"]);
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
