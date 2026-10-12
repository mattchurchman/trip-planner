import assert from "node:assert/strict";
import { createAirportIndex } from "../js/lib/airports.js";

const airports = createAirportIndex({
  FCO: ["Rome", "IT", 41.8, 12.25],
  CIA: ["Rome", "IT", 41.8, 12.6],
  LHR: ["London", "GB", 51.47, -0.45],
  LGW: ["London", "GB", 51.15, -0.18],
  DEN: ["Denver", "US", 39.86, -104.67],
});

export const tests = [
  ["airports: Rome airports share a city key", () => {
    assert.equal(airports.cityKey("FCO"), airports.cityKey("CIA"));
  }],
  ["airports: London airports share a city key", () => {
    assert.equal(airports.cityKey("LHR"), airports.cityKey("LGW"));
  }],
  ["airports: airport info includes its city and country", () => {
    assert.deepEqual(airports.info("DEN"), { city: "Denver", country: "US", lat: 39.86, lng: -104.67 });
    assert.equal(airports.cityName("DEN"), "Denver");
  }],
  ["airports: unknown airports fall back to their code", () => {
    assert.equal(airports.info("ZZZ"), "ZZZ");
    assert.equal(airports.cityKey("ZZZ"), "ZZZ");
    assert.equal(airports.cityName("ZZZ"), "ZZZ");
  }],
  ["airports: codes are case-insensitive", () => {
    assert.equal(airports.cityKey("fco"), "Rome, IT");
  }],
];
