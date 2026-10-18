import assert from "node:assert/strict";
import { CATEGORIES, categoryColor, categoryIcon } from "../js/lib/categories.js";
import { ICONS } from "../js/lib/icons.js";

export const tests = [
  ["CATEGORIES has exactly 13 entries", () => {
    assert.equal(CATEGORIES.length, 13);
  }],
  ["All category labels are unique", () => {
    const labels = CATEGORIES.map((c) => c.label);
    const unique = new Set(labels);
    assert.equal(labels.length, unique.size);
  }],
  ["Coffee & Cafés is the second category", () => {
    assert.equal(CATEGORIES[1].label, "Coffee & Cafés");
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
    assert.equal(categoryColor("Food & Dining"), "#C2602F");
    assert.equal(categoryColor("Coffee & Cafés"), "#8B6B4E");
    assert.equal(categoryColor("Arts, Museums & Culture"), "#8A7A33");
    assert.equal(categoryColor("Other"), "#6E7470");
  }],
  ["Every category icon exists in ICONS", () => {
    for (const category of CATEGORIES) assert.ok(ICONS[category.icon], `Missing icon for ${category.label}`);
  }],
  ["categoryIcon falls back to place for unknown labels", () => {
    assert.equal(categoryIcon("Old category"), "place");
    assert.equal(categoryIcon(""), "place");
  }],
];
