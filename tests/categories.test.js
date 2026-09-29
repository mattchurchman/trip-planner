import assert from "node:assert/strict";
import { CATEGORIES, categoryColor } from "../js/lib/categories.js";

export const tests = [
  ["CATEGORIES has exactly 12 entries", () => {
    assert.equal(CATEGORIES.length, 12);
  }],
  ["All category labels are unique", () => {
    const labels = CATEGORIES.map((c) => c.label);
    const unique = new Set(labels);
    assert.equal(labels.length, unique.size);
  }],
  ["Coffee & cafés is the second category", () => {
    assert.equal(CATEGORIES[1].label, "Coffee & cafés");
  }],
  ["Every color is a 6-digit hex code", () => {
    for (const category of CATEGORIES) {
      assert.match(category.color, /^#[0-9a-f]{6}$/i, `Invalid color for ${category.label}`);
    }
  }],
  ["categoryColor returns Other's color for unknown label", () => {
    const otherColor = CATEGORIES[CATEGORIES.length - 1].color;
    assert.equal(categoryColor("Nonsense"), otherColor);
    assert.equal(categoryColor(""), otherColor);
    assert.equal(categoryColor("xyz"), otherColor);
  }],
  ["categoryColor returns correct color for known labels", () => {
    assert.equal(categoryColor("Food"), "#e8710a");
    assert.equal(categoryColor("Coffee & cafés"), "#795548");
    assert.equal(categoryColor("Museum & history"), "#827717");
    assert.equal(categoryColor("Other"), "#5f6368");
  }],
];
