import assert from "node:assert/strict";
import { wikiSummaryUrl, photoTitles, pickPhoto } from "../js/lib/photos.js";

export const tests = [
  ["wikiSummaryUrl: spaces become underscores", () => {
    assert.equal(wikiSummaryUrl("Rio de Janeiro"), "https://en.wikipedia.org/api/rest_v1/page/summary/Rio_de_Janeiro");
  }],
  ["wikiSummaryUrl: a title with a comma and an accented letter is encoded", () => {
    const url = wikiSummaryUrl("Lisbon, Portugal");
    assert.ok(url.includes("Lisbon%2C_Portugal"), url);
    const accented = wikiSummaryUrl("Bogotá");
    assert.ok(accented.includes("Bogot%C3%A9") || accented.includes(encodeURIComponent("Bogotá")), accented);
  }],

  ["photoTitles: city and country give both titles", () => {
    assert.deepEqual(photoTitles("Lisbon", "Portugal"), ["Lisbon", "Lisbon, Portugal"]);
  }],
  ["photoTitles: no country gives one title, not a duplicate", () => {
    assert.deepEqual(photoTitles("Lisbon", ""), ["Lisbon"]);
  }],
  ["photoTitles: blank city and country gives no titles", () => {
    assert.deepEqual(photoTitles("", ""), []);
  }],

  ["pickPhoto: a standard page's thumbnail is upsized to 640px", () => {
    const json = {
      type: "standard",
      thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/320px-X.jpg" },
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Lisbon" } },
    };
    const result = pickPhoto(json);
    assert.equal(result.url, "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/640px-X.jpg");
    assert.equal(result.pageUrl, "https://en.wikipedia.org/wiki/Lisbon");
  }],
  ["pickPhoto: a disambiguation page is unusable", () => {
    const json = {
      type: "disambiguation",
      thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/320px-X.jpg" },
    };
    assert.equal(pickPhoto(json), null);
  }],
  ["pickPhoto: no images at all is unusable", () => {
    const json = { type: "standard", content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/X" } } };
    assert.equal(pickPhoto(json), null);
  }],
  ["pickPhoto: an image on a host other than upload.wikimedia.org is unusable", () => {
    const json = {
      type: "standard",
      thumbnail: { source: "https://evil.example.com/thumb/a/ab/X.jpg/320px-X.jpg" },
    };
    assert.equal(pickPhoto(json), null);
  }],
  ["pickPhoto: falls back to originalimage when there's no thumbnail, unchanged", () => {
    const json = {
      type: "standard",
      originalimage: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg" },
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/X" } },
    };
    const result = pickPhoto(json);
    assert.equal(result.url, "https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg");
  }],
  ["pickPhoto: pageUrl comes from content_urls.desktop.page", () => {
    const json = {
      type: "standard",
      originalimage: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg" },
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Rio_de_Janeiro" } },
    };
    assert.equal(pickPhoto(json).pageUrl, "https://en.wikipedia.org/wiki/Rio_de_Janeiro");
  }],
  ["pickPhoto: null json (e.g. a 404) is unusable", () => {
    assert.equal(pickPhoto(null), null);
  }],
];
