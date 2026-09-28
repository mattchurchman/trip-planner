import assert from "node:assert/strict";
import { chosenFlightIds, isFlightChosen, chosenStayIds, isStayChosen } from "../js/lib/selection.js";

export const tests = [
  ["chosenFlightIds: missing selectedFlights returns an empty array", () => {
    assert.deepEqual(chosenFlightIds({}, "t1"), []);
    assert.deepEqual(chosenFlightIds({ selectedFlights: {} }, "t1"), []);
    assert.deepEqual(chosenFlightIds(null, "t1"), []);
  }],
  ["chosenFlightIds: a legacy single-id string counts as a one-item list", () => {
    const trip = { selectedFlights: { t1: "f1" } };
    assert.deepEqual(chosenFlightIds(trip, "t1"), ["f1"]);
  }],
  ["chosenFlightIds: the current array shape is returned as-is", () => {
    const trip = { selectedFlights: { t1: ["f1", "f2"] } };
    assert.deepEqual(chosenFlightIds(trip, "t1"), ["f1", "f2"]);
  }],
  ["isFlightChosen reflects chosenFlightIds for either shape", () => {
    assert.equal(isFlightChosen({ selectedFlights: { t1: "f1" } }, "t1", "f1"), true);
    assert.equal(isFlightChosen({ selectedFlights: { t1: "f1" } }, "t1", "f2"), false);
    assert.equal(isFlightChosen({ selectedFlights: { t1: ["f1", "f2"] } }, "t1", "f2"), true);
  }],

  ["chosenStayIds: missing fields returns an empty array", () => {
    assert.deepEqual(chosenStayIds({}), []);
    assert.deepEqual(chosenStayIds(null), []);
  }],
  ["chosenStayIds: the current selectedStayIds array alone", () => {
    assert.deepEqual(chosenStayIds({ selectedStayIds: ["s1", "s2"] }), ["s1", "s2"]);
  }],
  ["chosenStayIds: the legacy selectedStayId alone", () => {
    assert.deepEqual(chosenStayIds({ selectedStayId: "s1" }), ["s1"]);
  }],
  ["chosenStayIds: legacy and new fields merge without duplicates", () => {
    assert.deepEqual(chosenStayIds({ selectedStayIds: ["s1", "s2"], selectedStayId: "s2" }), ["s1", "s2"]);
    assert.deepEqual(chosenStayIds({ selectedStayIds: ["s1"], selectedStayId: "s2" }), ["s1", "s2"]);
  }],
  ["chosenStayIds: drops null/empty entries", () => {
    assert.deepEqual(chosenStayIds({ selectedStayIds: ["s1", null, ""] }), ["s1"]);
  }],
  ["isStayChosen reflects chosenStayIds across both shapes", () => {
    assert.equal(isStayChosen({ selectedStayId: "s1" }, "s1"), true);
    assert.equal(isStayChosen({ selectedStayIds: ["s1"] }, "s2"), false);
  }],
];
