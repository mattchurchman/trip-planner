import assert from "node:assert/strict";
import { ribbonStops } from "../js/lib/ribbon.js";

function stop(code, nights, city) {
  return { code, city, nights: Array.from({ length: nights }, (_, i) => ({ date: `d${i}`, travelerIds: [] })) };
}

export const tests = [
  ["no stops is just the two home dots", () => {
    const result = ribbonStops([], null);
    assert.equal(result.length, 2);
    assert.equal(result[0].home, true);
    assert.equal(result[1].home, true);
  }],
  ["one stop sits between the two home dots", () => {
    const result = ribbonStops([stop("ROM", 5)], null);
    assert.equal(result.length, 3);
    assert.equal(result[0].home, true);
    assert.deepEqual(result[1], { code: "ROM", label: "ROM", nights: 5 });
    assert.equal(result[2].home, true);
  }],
  ["five stops show in full, with no +N", () => {
    const stops = ["ROM", "BCN", "LIS", "POR", "MAD"].map((code) => stop(code, 2));
    const result = ribbonStops(stops, null);
    assert.equal(result.length, 7);
    assert.equal(result.some((e) => e.more), false);
    assert.deepEqual(result.slice(1, 6).map((e) => e.code), ["ROM", "BCN", "LIS", "POR", "MAD"]);
  }],
  ["seven stops collapse to the first 4 plus a +N", () => {
    const stops = ["ROM", "BCN", "LIS", "POR", "MAD", "NYC", "SFO"].map((code) => stop(code, 1));
    const result = ribbonStops(stops, null);
    assert.equal(result.length, 7);
    assert.equal(result[0].home, true);
    assert.deepEqual(result.slice(1, 5).map((e) => e.code), ["ROM", "BCN", "LIS", "POR"]);
    assert.deepEqual(result[5], { more: 3 });
    assert.equal(result[6].home, true);
  }],
  ["a city visited twice appears twice", () => {
    const stops = [stop("LIS", 1), stop("POR", 12), stop("LIS", 1)];
    const result = ribbonStops(stops, null);
    const codes = result.filter((e) => !e.home).map((e) => e.code);
    assert.deepEqual(codes, ["LIS", "POR", "LIS"]);
  }],
  ["airports.cityName fills in the label when given", () => {
    const airports = { cityName: (code) => (code === "ROM" ? "Rome" : code) };
    const result = ribbonStops([stop("ROM", 3)], airports);
    assert.equal(result[1].label, "Rome");
  }],
];
