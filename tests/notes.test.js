import assert from "node:assert/strict";
import { cleanNoteText, formatNote, splitLinks } from "../js/lib/notes.js";

const example = "Latitude: 39.7489200<br>Longitude: -105.0084000<br>Address: 1000 Chopper Cir, Denver, CO 80204<br>Layer: 01 Events & Seasonal<br>Activity / Events: Avalanche vs Lightning; Nuggets vs Warriors<br>Date / Time (Denver local): Fri Oct 23, 7 PM (Avs vs Lightning) | Mon Oct 26, 8 PM (Nuggets vs Warriors)<br>Notes: One venue pin combines three selections.<br>Source URL: https://www.ballarena.com/misc/all-events<br>Other Sources: https://www.avalanchetix.com/5k";

export const tests = [
  ["formatNote: keeps every My Maps field in order and splits pipe values", () => {
    const blocks = formatNote(example);
    assert.equal(blocks.length, 9);
    assert.deepEqual(blocks.map((block) => block.label), ["Latitude", "Longitude", "Address", "Layer", "Activity / Events", "Date / Time (Denver local)", "Notes", "Source URL", "Other Sources"]);
    assert.deepEqual(blocks[5].values, ["Fri Oct 23, 7 PM (Avs vs Lightning)", "Mon Oct 26, 8 PM (Nuggets vs Warriors)"]);
    assert.equal(blocks[0].values[0], "39.7489200");
  }],
  ["formatNote: treats a hand-typed one-line note as text", () => {
    assert.deepEqual(formatNote("A hand-typed note"), [{ type: "text", text: "A hand-typed note" }]);
  }],
  ["formatNote: keeps mixed text and field lines", () => {
    assert.deepEqual(formatNote("Meet by the fountain\nHours: 9 AM | 5 PM"), [
      { type: "text", text: "Meet by the fountain" },
      { type: "field", label: "Hours", values: ["9 AM", "5 PM"] },
    ]);
  }],
  ["formatNote: does not mistake a URL for an https field", () => {
    assert.deepEqual(formatNote("https://x.com"), [{ type: "text", text: "https://x.com" }]);
  }],
  ["cleanNoteText: strips markup and decodes only one entity layer", () => {
    assert.equal(cleanNoteText("<b>Tom &amp; Jerry</b><br>&amp;lt;tag&gt; &quot;hi&quot; &#39;ok&#39; &nbsp;"), "Tom & Jerry\n&lt;tag> \"hi\" 'ok'");
  }],
  ["splitLinks: uses a short host and leaves trailing punctuation as text", () => {
    assert.deepEqual(splitLinks("See https://www.example.com/path.)"), [
      { text: "See " },
      { url: "https://www.example.com/path", host: "example.com" },
      { text: ".)" },
    ]);
  }],
];
