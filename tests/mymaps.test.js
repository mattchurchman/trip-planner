import assert from "node:assert/strict";
import { parseMyMapsUrl, isShortMapsLink } from "../js/lib/mymaps.js";

const MID = "1AbC2dEfG3hIjK4lMnO";

export const tests = [
  ["parseMyMapsUrl accepts the edit link", () => {
    const result = parseMyMapsUrl(`https://www.google.com/maps/d/edit?mid=${MID}`);
    assert.equal(result.mid, MID);
    assert.equal(result.url, `https://www.google.com/maps/d/edit?mid=${MID}`);
  }],
  ["parseMyMapsUrl accepts the viewer link", () => {
    const result = parseMyMapsUrl(`https://www.google.com/maps/d/viewer?mid=${MID}`);
    assert.equal(result.mid, MID);
  }],
  ["parseMyMapsUrl accepts /u/0/edit", () => {
    const result = parseMyMapsUrl(`https://www.google.com/maps/d/u/0/edit?mid=${MID}`);
    assert.equal(result.mid, MID);
  }],
  ["parseMyMapsUrl accepts the embed link", () => {
    const result = parseMyMapsUrl(`https://www.google.com/maps/d/embed?mid=${MID}`);
    assert.equal(result.mid, MID);
  }],
  ["parseMyMapsUrl accepts google.com without www", () => {
    const result = parseMyMapsUrl(`https://google.com/maps/d/edit?mid=${MID}`);
    assert.equal(result.mid, MID);
  }],
  ["parseMyMapsUrl ignores extra params", () => {
    const result = parseMyMapsUrl(`https://www.google.com/maps/d/edit?mid=${MID}&usp=sharing&ll=51.5%2C-0.1`);
    assert.equal(result.mid, MID);
  }],
  ["parseMyMapsUrl builds the viewUrl and kmlUrl", () => {
    const result = parseMyMapsUrl(`https://www.google.com/maps/d/edit?mid=${MID}`);
    assert.equal(result.viewUrl, `https://www.google.com/maps/d/viewer?mid=${MID}`);
    assert.equal(result.kmlUrl, `https://www.google.com/maps/d/kml?mid=${MID}&forcekml=1`);
  }],
  ["parseMyMapsUrl returns null with no mid", () => {
    assert.equal(parseMyMapsUrl("https://www.google.com/maps/d/edit"), null);
  }],
  ["parseMyMapsUrl returns null when mid is too short", () => {
    assert.equal(parseMyMapsUrl("https://www.google.com/maps/d/edit?mid=short"), null);
  }],
  ["parseMyMapsUrl returns null for a normal Google Maps place link", () => {
    assert.equal(parseMyMapsUrl("https://www.google.com/maps/place/Eiffel+Tower/@48.8,2.2,17z"), null);
  }],
  ["parseMyMapsUrl returns null for javascript:", () => {
    assert.equal(parseMyMapsUrl("javascript:alert(1)"), null);
  }],
  ["parseMyMapsUrl returns null for plain text", () => {
    assert.equal(parseMyMapsUrl("not a link"), null);
  }],
  ["isShortMapsLink is true for maps.app.goo.gl", () => {
    assert.equal(isShortMapsLink("https://maps.app.goo.gl/AbCdEfG"), true);
  }],
  ["isShortMapsLink is true for goo.gl/maps", () => {
    assert.equal(isShortMapsLink("https://goo.gl/maps/AbCdEfG"), true);
  }],
  ["isShortMapsLink is false for a full My Maps link", () => {
    assert.equal(isShortMapsLink(`https://www.google.com/maps/d/edit?mid=${MID}`), false);
  }],
  ["isShortMapsLink is false for plain text", () => {
    assert.equal(isShortMapsLink("not a link"), false);
  }],
];
