import assert from "node:assert/strict";
import { nearestStop, stopChips, stopForStay, stayStopKey } from "../js/lib/stops.js";

const PARIS = { stopKey: "Paris, France", lat: 48.8566, lng: 2.3522 };
const LONDON = { stopKey: "London, United Kingdom", lat: 51.5072, lng: -0.1276 };
const TOKYO = { stopKey: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 };

// Merged-route stops (cityKey + dates) with the coordinates mapTab adds.
const ROUTE = [
  { ...PARIS, cityKey: "Paris, France", from: "2026-06-01", to: "2026-06-05" },
  { ...LONDON, cityKey: "London, United Kingdom", from: "2026-06-05", to: "2026-06-08" },
];

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

  ["stopForStay: the stop whose dates contain the check-in wins, even far from the pin", () => {
    const stay = { checkIn: "2026-06-02", checkOut: "2026-06-04", lat: 45.0, lng: 0.5 };
    assert.equal(stopForStay(stay, ROUTE, ROUTE), "Paris, France");
  }],
  ["stopForStay: a check-in on a stop's last day belongs to the next stop", () => {
    assert.equal(stopForStay({ checkIn: "2026-06-05", checkOut: "2026-06-07" }, ROUTE, ROUTE), "London, United Kingdom");
  }],
  ["stopForStay: the last stop with no end date still takes a later check-in", () => {
    const open = [{ cityKey: "Paris, France", from: "2026-06-01", to: null }];
    assert.equal(stopForStay({ checkIn: "2026-06-20", checkOut: "2026-06-22" }, open, []), "Paris, France");
  }],
  ["stopForStay: dates outside every stop fall back to the nearest city within 150km", () => {
    const stay = { checkIn: "2026-09-01", checkOut: "2026-09-03", lat: 48.9, lng: 2.4 };
    assert.equal(stopForStay(stay, ROUTE, ROUTE), "Paris, France");
  }],
  ["stopForStay: no dates and a pin more than 150km from every city gives null", () => {
    assert.equal(stopForStay({ lat: 35.0, lng: 0.0 }, ROUTE, ROUTE), null);
  }],
  ["stopForStay: no dates and no pin gives null", () => {
    assert.equal(stopForStay({ name: "Somewhere" }, ROUTE, ROUTE), null);
    assert.equal(stopForStay({ checkIn: "2026-09-01" }, [], []), null);
  }],
  ["stopForStay: overlapping stops pick the one nearest the pin, else the first", () => {
    const overlap = [
      { ...PARIS, cityKey: "Paris, France", from: "2026-06-01", to: "2026-06-08" },
      { ...LONDON, cityKey: "London, United Kingdom", from: "2026-06-03", to: "2026-06-08" },
    ];
    const date = { checkIn: "2026-06-04", checkOut: "2026-06-06" };
    assert.equal(stopForStay({ ...date, lat: 51.5, lng: -0.1 }, overlap, overlap), "London, United Kingdom");
    assert.equal(stopForStay(date, overlap, overlap), "Paris, France");
  }],
  ["stayStopKey: keeps a stopKey that is still on the route", () => {
    const stay = { stopKey: "London, United Kingdom", checkIn: "2026-06-02", checkOut: "2026-06-04" };
    assert.equal(stayStopKey(stay, ROUTE, ROUTE), "London, United Kingdom");
  }],
  ["stayStopKey: a stopKey no longer on the route is worked out from the dates", () => {
    const stay = { stopKey: "Rome, Italy", checkIn: "2026-06-02", checkOut: "2026-06-04" };
    assert.equal(stayStopKey(stay, ROUTE, ROUTE), "Paris, France");
  }],
  ["stayStopKey: an empty stopKey is worked out too", () => {
    assert.equal(stayStopKey({ stopKey: null, checkIn: "2026-06-06", checkOut: "2026-06-07" }, ROUTE, ROUTE), "London, United Kingdom");
  }],
];
