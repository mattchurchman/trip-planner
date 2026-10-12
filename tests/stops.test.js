import assert from "node:assert/strict";
import { nearestStop, stopChips } from "../js/lib/stops.js";

const PARIS = { stopKey: "Paris, France", lat: 48.8566, lng: 2.3522 };
const LONDON = { stopKey: "London, United Kingdom", lat: 51.5072, lng: -0.1276 };
const TOKYO = { stopKey: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 };

export const tests = [
  ["nearestStop picks the closest city", () => {
    assert.equal(nearestStop(48.86, 2.35, [PARIS, LONDON, TOKYO]), "Paris, France");
  }],
  ["nearestStop returns null beyond 150km", () => {
    assert.equal(nearestStop(35.0, 0.0, [PARIS, LONDON]), null);
  }],
  ["nearestStop handles missing coordinates", () => {
    assert.equal(nearestStop(null, null, [PARIS]), null);
    assert.equal(nearestStop(48.86, 2.35, []), null);
    assert.equal(nearestStop(48.86, 2.35, [{ stopKey: "No coords" }]), null);
  }],
  ["stopChips follows route order, deduping a repeated city", () => {
    const stops = [
      { cityKey: "Paris, France", city: "Paris" },
      { cityKey: "Rome, Italy", city: "Rome" },
      { cityKey: "Paris, France", city: "Paris" },
    ];
    assert.deepEqual(stopChips(stops, []), [
      { stopKey: "Paris, France", city: "Paris" },
      { stopKey: "Rome, Italy", city: "Rome" },
    ]);
  }],
  ["stopChips falls back to allCities when there's no chosen route", () => {
    const all = [{ stopKey: "Paris, France", city: "Paris" }];
    assert.deepEqual(stopChips([], all), all);
    assert.deepEqual(stopChips(null, all), all);
  }],
];
