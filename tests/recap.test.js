import assert from "node:assert/strict";
import { buildPublicRecap, nextTimePlaces, noOneReacted } from "../js/lib/recap.js";

const trip = {
  name: "Lisbon Trip",
  destination: { city: "Lisbon", country: "Portugal" },
  startDate: "2026-06-01",
  endDate: "2026-06-10",
  albumUrl: "https://photos.google.com/share/abc",
};

const usersById = {
  u1: { displayName: "Sam Rivera", email: "sam@example.com" },
  u2: { displayName: "Alex", email: "alex@example.com" },
};

const places = [
  {
    name: "Time Out Market",
    category: "Food",
    neighborhood: "Cais do Sodré",
    lat: 38.707,
    lng: -9.146,
    recap: {
      u1: { rating: "loved", note: "Amazing food hall", photoUrl: "https://photos.google.com/p1" },
      u2: { rating: "loved", note: "", photoUrl: null },
    },
  },
  {
    name: "Skipped Museum",
    category: "Museum & history",
    neighborhood: "",
    lat: null,
    lng: null,
    recap: {
      u1: { rating: "skipped", note: "Ran out of time", photoUrl: null },
    },
  },
  {
    name: "Never Visited Overlook",
    category: "Sight",
    neighborhood: "",
    lat: 38.71,
    lng: -9.13,
    recap: {},
  },
];

export const tests = [
  ["buildPublicRecap: no uids, emails or prices anywhere in the output", () => {
    const result = buildPublicRecap(trip, places, usersById);
    const json = JSON.stringify(result);
    assert.equal(json.includes("sam@example.com"), false);
    assert.equal(json.includes("alex@example.com"), false);
    assert.equal(json.includes("u1"), false);
    assert.equal(json.includes("u2"), false);
    assert.equal(json.includes("Cents"), false);
  }],
  ["buildPublicRecap: notes use first names only", () => {
    const result = buildPublicRecap(trip, places, usersById);
    const marketNotes = result.places.find((p) => p.name === "Time Out Market").notes;
    assert.deepEqual(marketNotes, [{ by: "Sam", text: "Amazing food hall" }]);
  }],
  ["buildPublicRecap: counts loved/fine/skipped correctly per place", () => {
    const result = buildPublicRecap(trip, places, usersById);
    const market = result.places.find((p) => p.name === "Time Out Market");
    assert.deepEqual({ loved: market.loved, fine: market.fine, skipped: market.skipped }, { loved: 2, fine: 0, skipped: 0 });
    const museum = result.places.find((p) => p.name === "Skipped Museum");
    assert.deepEqual({ loved: museum.loved, fine: museum.fine, skipped: museum.skipped }, { loved: 0, fine: 0, skipped: 1 });
  }],
  ["buildPublicRecap: keeps the first non-null photo link only", () => {
    const result = buildPublicRecap(trip, places, usersById);
    const market = result.places.find((p) => p.name === "Time Out Market");
    assert.equal(market.photoUrl, "https://photos.google.com/p1");
  }],
  ["buildPublicRecap: carries trip name, destination, dates and album link", () => {
    const result = buildPublicRecap(trip, places, usersById);
    assert.equal(result.tripName, "Lisbon Trip");
    assert.equal(result.city, "Lisbon");
    assert.equal(result.country, "Portugal");
    assert.equal(result.startDate, "2026-06-01");
    assert.equal(result.albumUrl, "https://photos.google.com/share/abc");
  }],
  ["nextTimePlaces: includes unreacted places and any Skipped place, excludes fully Loved/Fine ones", () => {
    const result = nextTimePlaces(places).map((p) => p.name);
    assert.deepEqual(result.sort(), ["Never Visited Overlook", "Skipped Museum"]);
  }],
  ["noOneReacted distinguishes 'Didn't get to' from Skipped", () => {
    assert.equal(noOneReacted(places[0]), false); // Time Out Market: reacted
    assert.equal(noOneReacted(places[1]), false); // Skipped Museum: reacted (skipped)
    assert.equal(noOneReacted(places[2]), true); // Never Visited Overlook: no reactions
  }],
];
