import assert from "node:assert/strict";
import { tripStage } from "../js/lib/stage.js";

export const tests = [
  ["tripStage: no destination → exploring", () => {
    const result = tripStage({ destinationId: null, startDate: "2026-12-25" }, "2026-09-28");
    assert.equal(result.key, "exploring");
    assert.equal(result.label, "Exploring");
  }],
  ["tripStage: destination, no start date → planning", () => {
    const result = tripStage({ destinationId: "abc", startDate: null }, "2026-09-28");
    assert.equal(result.key, "planning");
    assert.equal(result.label, "Planning");
  }],
  ["tripStage: start date 42 days away → 'In 42 days'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2026-11-09" }, "2026-09-28");
    assert.equal(result.key, "upcoming");
    assert.equal(result.label, "In 42 days");
  }],
  ["tripStage: start date 1 day away → 'Tomorrow'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2026-09-29" }, "2026-09-28");
    assert.equal(result.key, "upcoming");
    assert.equal(result.label, "Tomorrow");
  }],
  ["tripStage: today equals start date → 'Happening now'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2026-09-28", endDate: "2026-10-05" }, "2026-09-28");
    assert.equal(result.key, "now");
    assert.equal(result.label, "Happening now");
  }],
  ["tripStage: today between start and end → 'Happening now'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2026-09-25", endDate: "2026-10-05" }, "2026-09-28");
    assert.equal(result.key, "now");
    assert.equal(result.label, "Happening now");
  }],
  ["tripStage: today equals end date → 'Happening now'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2026-09-25", endDate: "2026-09-28" }, "2026-09-28");
    assert.equal(result.key, "now");
  }],
  ["tripStage: no end date, today equals start → 'Happening now'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2026-09-28" }, "2026-09-28");
    assert.equal(result.key, "now");
  }],
  ["tripStage: no end date, day after start → 'Trip's over'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2026-09-28" }, "2026-09-29");
    assert.equal(result.key, "done");
    assert.equal(result.label, "Trip's over — add your recap");
    assert.equal(result.shortLabel, "Trip's over");
  }],
  ["tripStage: day after end date → 'Trip's over'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2026-09-25", endDate: "2026-09-28" }, "2026-09-29");
    assert.equal(result.key, "done");
  }],
  ["tripStage: month boundary (2026-12-30 to 2027-01-02, today 2026-12-30) → 'In 3 days'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2027-01-02" }, "2026-12-30");
    assert.equal(result.key, "upcoming");
    assert.equal(result.label, "In 3 days");
  }],
  ["tripStage: year boundary (2026-12-31 to 2027-01-01, today 2026-12-31) → 'Tomorrow'", () => {
    const result = tripStage({ destinationId: "abc", startDate: "2027-01-01" }, "2026-12-31");
    assert.equal(result.key, "upcoming");
    assert.equal(result.label, "Tomorrow");
  }],
];
