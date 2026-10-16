import assert from "node:assert/strict";
import { ICONS } from "../js/lib/icons.js";

const R7_NAMES = [
  "overview", "routes", "map", "days", "flight", "stay", "place", "love", "like", "pass",
  "travelers", "price", "more", "plus", "edit", "trash", "link", "external", "download",
  "walk", "food", "coffee", "help", "close", "chevron",
];

export const tests = [
  ["Every ICONS entry is a non-empty array of non-empty strings", () => {
    for (const [name, paths] of Object.entries(ICONS)) {
      assert.ok(Array.isArray(paths) && paths.length > 0, `${name} should be a non-empty array`);
      for (const d of paths) {
        assert.equal(typeof d, "string", `${name} has a non-string path`);
        assert.ok(d.length > 0, `${name} has an empty path`);
      }
    }
  }],
  ["Every icon named in R7 §5 exists in ICONS", () => {
    for (const name of R7_NAMES) {
      assert.ok(name in ICONS, `missing icon: ${name}`);
    }
  }],
];
