import assert from "node:assert/strict";
import { stayPinLabel, topPlaces } from "../js/lib/staypins.js";

export const tests = [
  ["stayPinLabel shows the per-night price when nights are known: $1,260 over 7 nights", () => {
    assert.equal(stayPinLabel({ number: 3, latestCents: 126000, nights: 7, currency: "USD" }), "③ $180");
  }],
  ["stayPinLabel rounds the per-night price to the nearest whole unit: $1,000.01 over 3 nights", () => {
    assert.equal(stayPinLabel({ number: 1, latestCents: 100001, nights: 3, currency: "USD" }), "① $333");
  }],
  ["stayPinLabel shows the total, labeled, when nights are unknown", () => {
    assert.equal(stayPinLabel({ number: 2, latestCents: 126000, nights: null, currency: "USD" }), "② $1,260 total");
  }],
  ["stayPinLabel shows just the number when there's no price yet", () => {
    assert.equal(stayPinLabel({ number: 4, latestCents: null, nights: 7, currency: "USD" }), "④");
  }],
  ["stayPinLabel formats in the trip's currency", () => {
    assert.match(stayPinLabel({ number: 5, latestCents: 10000, nights: null, currency: "EUR" }), /€/);
  }],
  ["topPlaces excludes places from a different destination", () => {
    const places = [{ destinationId: "a", lat: 1, lng: 1, votes: { u: "must" } }];
    assert.deepEqual(topPlaces(places, "b"), []);
  }],
  ["topPlaces excludes places with no location", () => {
    const places = [{ destinationId: "a", lat: null, lng: null, votes: { u: "must" } }];
    assert.deepEqual(topPlaces(places, "a"), []);
  }],
  ["topPlaces excludes places scoring below 2", () => {
    const places = [{ destinationId: "a", lat: 1, lng: 1, votes: { u: "nice" } }];
    assert.deepEqual(topPlaces(places, "a"), []);
  }],
  ["topPlaces includes a place with one Must (score 2)", () => {
    const places = [{ id: "p1", destinationId: "a", lat: 1, lng: 1, votes: { u: "must" } }];
    assert.deepEqual(topPlaces(places, "a").map((p) => p.id), ["p1"]);
  }],
];
