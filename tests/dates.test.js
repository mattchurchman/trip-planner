import assert from "node:assert/strict";
import { nightsBetween, nightsLabel, relativeTime, rangesOverlap } from "../js/lib/dates.js";

export const tests = [
  ["nightsBetween counts whole nights between two dates", () => {
    assert.equal(nightsBetween("2026-06-01", "2026-06-10"), 9);
  }],
  ["nightsBetween returns null when a date is missing", () => {
    assert.equal(nightsBetween(null, "2026-06-10"), null);
    assert.equal(nightsBetween("2026-06-01", null), null);
  }],
  ["nightsBetween returns null when checkout isn't after checkin", () => {
    assert.equal(nightsBetween("2026-06-10", "2026-06-01"), null);
    assert.equal(nightsBetween("2026-06-01", "2026-06-01"), null);
  }],
  ["nightsLabel shows 'Dates needed' when nights can't be computed", () => {
    assert.equal(nightsLabel(null, null), "Dates needed");
  }],
  ["nightsLabel shows the night count when computable", () => {
    assert.equal(nightsLabel("2026-06-01", "2026-06-10"), "9 nights");
  }],
  ["relativeTime formats a few minutes ago", () => {
    const now = new Date("2026-01-01T00:10:00Z");
    const then = new Date("2026-01-01T00:05:00Z");
    assert.equal(relativeTime(then, now), "5 minutes ago");
  }],
  ["rangesOverlap is true for a partial overlap in either direction", () => {
    assert.equal(rangesOverlap("2026-06-01", "2026-06-05", "2026-06-03", "2026-06-10"), true);
    assert.equal(rangesOverlap("2026-06-03", "2026-06-10", "2026-06-01", "2026-06-05"), true);
  }],
  ["rangesOverlap is true when one range fully contains the other", () => {
    assert.equal(rangesOverlap("2026-06-01", "2026-06-10", "2026-06-03", "2026-06-05"), true);
  }],
  ["rangesOverlap is true for touching endpoints (inclusive)", () => {
    assert.equal(rangesOverlap("2026-06-01", "2026-06-05", "2026-06-05", "2026-06-10"), true);
  }],
  ["rangesOverlap is false for non-overlapping ranges", () => {
    assert.equal(rangesOverlap("2026-06-01", "2026-06-04", "2026-06-05", "2026-06-10"), false);
  }],
  ["rangesOverlap is false when any date is missing", () => {
    assert.equal(rangesOverlap(null, "2026-06-05", "2026-06-01", "2026-06-10"), false);
    assert.equal(rangesOverlap("2026-06-01", null, "2026-06-01", "2026-06-10"), false);
    assert.equal(rangesOverlap("2026-06-01", "2026-06-05", null, "2026-06-10"), false);
    assert.equal(rangesOverlap("2026-06-01", "2026-06-05", "2026-06-01", null), false);
  }],
];
