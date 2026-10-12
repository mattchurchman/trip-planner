import assert from "node:assert/strict";
import { chosenStayIds, isStayChosen } from "../js/lib/selection.js";

export const tests = [
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
