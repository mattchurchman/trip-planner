import assert from "node:assert/strict";
import { parseFlightLink } from "../js/lib/flightlink.js";

export const tests = [
  ["parseFlightLink: a real tfs link reads DEN -> LIS, out and back dates", () => {
    const url =
      "https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTAzLTEwagcIARIDREVOcgcIARIDTElTGh4SCjIwMjYtMDMtMTdqBwgBEgNMSVNyBwgBEgNERU5AAUgBcAGCAQsI____________AZgBAQ&hl=en";
    const result = parseFlightLink(url);
    assert.equal(result.fromAirport, "DEN");
    assert.equal(result.toAirport, "LIS");
    assert.equal(result.outboundDate, "2026-03-10");
    assert.equal(result.returnDate, "2026-03-17");
    assert.equal(result.error, null);
  }],
  ["parseFlightLink: a one-way tfs link has a null return date", () => {
    // base64url of "junk2026-05-01junkSFOjunkNRTjunk" -- one date, two airports.
    const url = "https://www.google.com/travel/flights?tfs=anVuazIwMjYtMDUtMDFqdW5rU0ZPanVua05SVGp1bms";
    const result = parseFlightLink(url);
    assert.equal(result.fromAirport, "SFO");
    assert.equal(result.toAirport, "NRT");
    assert.equal(result.outboundDate, "2026-05-01");
    assert.equal(result.returnDate, null);
    assert.equal(result.error, null);
  }],
  ["parseFlightLink: our own ?q= search link with airport codes", () => {
    const url =
      "https://www.google.com/travel/flights?q=" +
      encodeURIComponent("Flights from DEN to LIS on 2026-03-10 returning 2026-03-17");
    const result = parseFlightLink(url);
    assert.equal(result.fromAirport, "DEN");
    assert.equal(result.toAirport, "LIS");
    assert.equal(result.outboundDate, "2026-03-10");
    assert.equal(result.returnDate, "2026-03-17");
    assert.equal(result.error, null);
  }],
  ["parseFlightLink: our own ?q= search link with city names has null airports but reads dates", () => {
    const url =
      "https://www.google.com/travel/flights?q=" +
      encodeURIComponent("Flights from Denver to Lisbon on 2026-03-10 returning 2026-03-17");
    const result = parseFlightLink(url);
    assert.equal(result.fromAirport, null);
    assert.equal(result.toAirport, null);
    assert.equal(result.outboundDate, "2026-03-10");
    assert.equal(result.returnDate, "2026-03-17");
    assert.equal(result.error, null);
  }],
  ["parseFlightLink: a short share link path returns the short-link error", () => {
    const result = parseFlightLink("https://www.google.com/travel/flights/s/abc123");
    assert.equal(result.fromAirport, null);
    assert.match(result.error, /Short share links/);
  }],
  ["parseFlightLink: a goo.gl host returns the short-link error", () => {
    const result = parseFlightLink("https://goo.gl/travel/abc123");
    assert.match(result.error, /Short share links/);
  }],
  ["parseFlightLink: a non-Google URL is rejected", () => {
    const result = parseFlightLink("https://example.com/travel/flights?q=x");
    assert.equal(result.error, "That doesn't look like a Google Flights link.");
  }],
  ["parseFlightLink: plain text is rejected", () => {
    const result = parseFlightLink("not a link");
    assert.equal(result.error, "That doesn't look like a Google Flights link.");
  }],
  ["parseFlightLink: garbage tfs value gives the couldn't-read error without throwing", () => {
    assert.doesNotThrow(() => {
      const result = parseFlightLink("https://www.google.com/travel/flights?tfs=!!!");
      assert.equal(result.error, "Couldn't read this link — fill in the details below.");
      assert.equal(result.fromAirport, null);
    });
  }],
  ["parseFlightLink: a Google Flights link with nothing readable gives the couldn't-read error", () => {
    const result = parseFlightLink("https://www.google.com/travel/flights");
    assert.equal(result.error, "Couldn't read this link — fill in the details below.");
  }],
];
