import assert from "node:assert/strict";
import { nightCoverage, coverageSummary, stayNights, stopStayTotal } from "../js/lib/coverage.js";

const price = (cents) => (cents == null ? [] : [{ id: "p1", amountCents: cents, checkedAt: "2026-01-01T00:00:00.000Z", byUid: "u1", note: "" }]);
const stop = (from, to) => ({ city: "Rome", code: "FCO", from, to });

export const tests = [
  ["stayNights: one entry per night, empty with missing or backwards dates", () => {
    assert.deepEqual(stayNights({ checkIn: "2026-06-01", checkOut: "2026-06-04" }), ["2026-06-01", "2026-06-02", "2026-06-03"]);
    assert.deepEqual(stayNights({ checkIn: "2026-06-01", checkOut: null }), []);
    assert.deepEqual(stayNights({ checkIn: "2026-06-04", checkOut: "2026-06-01" }), []);
  }],

  ["nightCoverage: a stay covering part of the stop leaves the rest open", () => {
    const entries = nightCoverage(stop("2026-06-01", "2026-06-05"), [{ checkIn: "2026-06-01", checkOut: "2026-06-03" }]);
    assert.deepEqual(entries, [
      { date: "2026-06-01", status: "covered", travelerIds: null },
      { date: "2026-06-02", status: "covered", travelerIds: null },
      { date: "2026-06-03", status: "open", travelerIds: null },
      { date: "2026-06-04", status: "open", travelerIds: null },
    ]);
  }],

  ["nightCoverage: two stays splitting the stop exactly cover every night once", () => {
    const entries = nightCoverage(stop("2026-06-01", "2026-06-05"), [
      { checkIn: "2026-06-01", checkOut: "2026-06-03" },
      { checkIn: "2026-06-03", checkOut: "2026-06-05" },
    ]);
    assert.ok(entries.every((e) => e.status === "covered"));
  }],

  ["nightCoverage: overlapping stays give double on the shared nights", () => {
    const entries = nightCoverage(stop("2026-06-01", "2026-06-04"), [
      { checkIn: "2026-06-01", checkOut: "2026-06-03" },
      { checkIn: "2026-06-02", checkOut: "2026-06-04" },
    ]);
    assert.deepEqual(entries.map((e) => e.status), ["covered", "double", "covered"]);
  }],

  ["nightCoverage: a stay entirely outside the stop's dates covers nothing", () => {
    const entries = nightCoverage(stop("2026-06-01", "2026-06-03"), [{ checkIn: "2026-05-01", checkOut: "2026-05-03" }]);
    assert.deepEqual(entries.map((e) => e.status), ["open", "open"]);
  }],

  ["nightCoverage: empty with a missing stop or stay date", () => {
    assert.deepEqual(nightCoverage(stop(null, "2026-06-03"), [{ checkIn: "2026-06-01", checkOut: "2026-06-02" }]), []);
    assert.deepEqual(nightCoverage(stop("2026-06-01", "2026-06-03"), [{ checkIn: null, checkOut: "2026-06-02" }]), [
      { date: "2026-06-01", status: "open", travelerIds: null },
      { date: "2026-06-02", status: "open", travelerIds: null },
    ]);
  }],

  ["stopStayTotal: sums the latest price of each chosen stay", () => {
    const result = stopStayTotal([{ prices: price(10000) }, { prices: price(5000) }]);
    assert.deepEqual(result, { cents: 15000, complete: true });
  }],

  ["stopStayTotal: incomplete when any chosen stay has no price yet", () => {
    const result = stopStayTotal([{ prices: price(10000) }, { prices: [] }]);
    assert.deepEqual(result, { cents: 10000, complete: false });
  }],

  ["stopStayTotal: zero and complete with no chosen stays", () => {
    assert.deepEqual(stopStayTotal([]), { cents: 0, complete: true });
  }],

  ["nightCoverage: a merged stop's nights say who is there each night", () => {
    const merged = {
      ...stop("2026-06-01", "2026-06-04"),
      nights: [
        { date: "2026-06-01", travelerIds: ["a", "b", "c"] },
        { date: "2026-06-02", travelerIds: ["a", "b"] },
      ],
    };
    const entries = nightCoverage(merged, []);
    assert.deepEqual(entries.map((e) => e.travelerIds), [["a", "b", "c"], ["a", "b"], []]);
  }],

  ["coverageSummary: complete only when every night has a chosen stay", () => {
    const entries = nightCoverage(stop("2026-06-01", "2026-06-04"), [{ checkIn: "2026-06-01", checkOut: "2026-06-03" }]);
    assert.deepEqual(coverageSummary(entries), { covered: 2, total: 3, complete: false });
    const full = nightCoverage(stop("2026-06-01", "2026-06-04"), [{ checkIn: "2026-06-01", checkOut: "2026-06-04" }]);
    assert.deepEqual(coverageSummary(full), { covered: 3, total: 3, complete: true });
  }],

  ["coverageSummary: a double-booked night still counts as covered", () => {
    const entries = nightCoverage(stop("2026-06-01", "2026-06-03"), [
      { checkIn: "2026-06-01", checkOut: "2026-06-03" },
      { checkIn: "2026-06-02", checkOut: "2026-06-03" },
    ]);
    assert.equal(coverageSummary(entries).complete, true);
  }],

  ["coverageSummary: a stop with no dated nights is not complete", () => {
    assert.deepEqual(coverageSummary([]), { covered: 0, total: 0, complete: false });
  }],
];
