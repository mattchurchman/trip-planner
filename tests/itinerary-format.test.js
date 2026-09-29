import assert from "node:assert/strict";
import { formatLegDate, flightLabel } from "../js/lib/itineraryFormat.js";

export const tests = [
  ["formatLegDate: 2027-01-17 is a Sunday", () => {
    assert.equal(formatLegDate("2027-01-17"), "Sun 17 Jan");
  }],
  ["formatLegDate: 2027-01-24 is a Sunday", () => {
    assert.equal(formatLegDate("2027-01-24"), "Sun 24 Jan");
  }],
  ["formatLegDate: a year boundary reads correctly", () => {
    assert.equal(formatLegDate("2026-12-31"), "Thu 31 Dec");
  }],
  ["formatLegDate: null/invalid input returns null", () => {
    assert.equal(formatLegDate(null), null);
    assert.equal(formatLegDate(""), null);
    assert.equal(formatLegDate("not-a-date"), null);
  }],
  ["flightLabel: [AS, FJ, FJ, NZ] (3 stops) -> 'Alaska + 2 more · 3 stops'", () => {
    assert.equal(flightLabel(["AS", "FJ", "FJ", "NZ"], 0), "Alaska + 2 more · 3 stops");
  }],
  ["flightLabel: [DL] nonstop -> 'Delta · Nonstop'", () => {
    assert.equal(flightLabel(["DL"], 0), "Delta · Nonstop");
  }],
  ["flightLabel: [AS, FJ] (1 stop) -> 'Alaska + Fiji Airways · 1 stop'", () => {
    assert.equal(flightLabel(["AS", "FJ"], 0), "Alaska + Fiji Airways · 1 stop");
  }],
  ["flightLabel: unknown code 'ZZ' -> 'ZZ · Nonstop'", () => {
    assert.equal(flightLabel(["ZZ"], 0), "ZZ · Nonstop");
  }],
  ["flightLabel: no segments, traveler has 2 options -> 'Option 3'", () => {
    assert.equal(flightLabel(null, 2), "Option 3");
    assert.equal(flightLabel([], 2), "Option 3");
  }],
];
