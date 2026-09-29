import assert from "node:assert/strict";
import { parseFlightLink, stopsLabel, legRoute, readLinkPrice } from "../js/lib/flightlink.js";
import { airlineName } from "../js/lib/airlines.js";

// Real links the owner copied from Google Flights on 2026-09-28, after picking
// specific flights (the "booking" page that shows the final price).
const JFK_CHC =
  "https://www.google.com/travel/flights/booking?tfs=CBwQAhqoARIKMjAyNy0wMS0xNyIfCgNKRksSCjIwMjctMDEtMTcaA1NGTyoCQVMyAzU4MSIfCgNTRk8SCjIwMjctMDEtMTcaA05BTioCRkoyAzg3MSIfCgNOQU4SCjIwMjctMDEtMTkaA0FLTCoCRkoyAzQxMSIfCgNBS0wSCjIwMjctMDEtMTkaA0NIQyoCTloyAzU1OWoHCAESA0pGS3INCAISCS9tLzAyeWM1YhqGARIKMjAyNy0wMS0yNCIfCgNDSEMSCjIwMjctMDEtMjQaA05BTioCRkoyAzQ1MCIfCgNOQU4SCjIwMjctMDEtMjQaA1NGTyoCRkoyAzg3MCIeCgNTRk8SCjIwMjctMDEtMjQaA0pGSyoCQVMyAjI5ag0IAhIJL20vMDJ5YzVicgcIARIDSkZLQAFIAXABggELCP___________wGYAQE&tfu=CnxDalJJWTBFNFRHTllVMVZ4YmpCQlFqUnBWMUZDUnkwdExTMHRMUzB0TFMwdGIzbGxOMEZCUVVGQlIzRTNRV2R2UVZkRlN6WkJFaEJHU2pRMU1IeEdTamczTUh4QlV6STVHZ3NJa1pzS0VBSWFBMVZUUkRnY2NKR2JDZz09EgIIACIA";
const LGA_PIT =
  "https://www.google.com/travel/flights/booking?tfs=CBwQAhpLEgoyMDI3LTAxLTAxIiAKA0xHQRIKMjAyNy0wMS0wMRoDUElUKgJETDIENTY5NGoNCAISCS9tLzAyXzI4NnIMCAISCC9tLzA2OHAyGksSCjIwMjctMDEtMDgiIAoDUElUEgoyMDI3LTAxLTA4GgNMR0EqAkRMMgQ1MzA1agwIAhIIL20vMDY4cDJyDQgCEgkvbS8wMl8yODZAAUgBcAGCAQsI____________AZgBAbIBCxIJL20vMDJ5YzVi&tfu=CmxDalJJWm0weFZsSXRUREZ2WjNOQlEwdEJPWGRDUnkwdExTMHRMUzB0TFMxNWJHeGpNMEZCUVVGQlIzRTNSM1YzVDA1b1lWZEJFZ1pFVERVek1EVWFDd2lZNHdFUUFob0RWVk5FT0J4d21PTUISAggAIgA&tcfs=ChUKCS9tLzAyXzI4NhoITmV3IFlvcmsSMwoJL20vMDJ5YzViEgxDaHJpc3RjaHVyY2gaGAoKMjAyNy0wMS0xNxIKMjAyNy0wMS0yNFIEYAF4AQ";
const SHARE = "https://www.google.com/travel/flights/s/MCpS6oM6ZHqfSeeeA";

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
  ["parseFlightLink: real 3-stop round trip reads every segment, stops and price", () => {
    const r = parseFlightLink(JFK_CHC);
    assert.equal(r.error, null);
    assert.equal(r.fromAirport, "JFK");
    assert.equal(r.toAirport, "CHC");
    assert.equal(r.outboundDate, "2027-01-17");
    assert.equal(r.returnDate, "2027-01-24");
    assert.equal(r.outboundStops, 3);
    assert.equal(r.returnStops, 2);
    assert.deepEqual(legRoute(r.legs[0]), ["JFK", "SFO", "NAN", "AKL", "CHC"]);
    assert.deepEqual(legRoute(r.legs[1]), ["CHC", "NAN", "SFO", "JFK"]);
    assert.deepEqual(r.legs[0].segments[0], { from: "JFK", to: "SFO", date: "2027-01-17", airline: "AS", flightNumber: "581" });
    assert.deepEqual(r.legs[0].segments[3], { from: "AKL", to: "CHC", date: "2027-01-19", airline: "NZ", flightNumber: "559" });
    assert.equal(r.legs[1].segments[2].flightNumber, "29");
    assert.deepEqual(r.price, { amountCents: 167313, currency: "USD" });
  }],
  ["parseFlightLink: real nonstop round trip, with city names from tcfs", () => {
    const r = parseFlightLink(LGA_PIT);
    assert.equal(r.error, null);
    assert.equal(r.fromAirport, "LGA");
    assert.equal(r.toAirport, "PIT");
    assert.equal(r.outboundDate, "2027-01-01");
    assert.equal(r.returnDate, "2027-01-08");
    assert.equal(r.outboundStops, 0);
    assert.equal(r.returnStops, 0);
    assert.equal(r.fromPlace, "New York");
    assert.deepEqual(r.legs[0].segments, [{ from: "LGA", to: "PIT", date: "2027-01-01", airline: "DL", flightNumber: "5694" }]);
    assert.deepEqual(r.legs[1].segments, [{ from: "PIT", to: "LGA", date: "2027-01-08", airline: "DL", flightNumber: "5305" }]);
    assert.deepEqual(r.price, { amountCents: 29080, currency: "USD" });
  }],
  ["parseFlightLink: a search-page link (no flights picked yet) has airports and dates but unknown stops and no price", () => {
    const r = parseFlightLink(
      "https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTAzLTEwagcIARIDREVOcgcIARIDTElTGh4SCjIwMjYtMDMtMTdqBwgBEgNMSVNyBwgBEgNERU5AAUgBcAGCAQsI____________AZgBAQ"
    );
    assert.equal(r.fromAirport, "DEN");
    assert.equal(r.toAirport, "LIS");
    assert.equal(r.outboundStops, null);
    assert.equal(r.returnStops, null);
    assert.equal(r.price, null);
  }],
  ["parseFlightLink: the owner's real share link gives the short-link error", () => {
    assert.match(parseFlightLink(SHARE).error, /Short share links/);
  }],
  ["readLinkPrice: missing or garbage tfu gives null without throwing", () => {
    assert.equal(readLinkPrice(null), null);
    assert.equal(readLinkPrice("!!!"), null);
    assert.equal(readLinkPrice("AAAA"), null);
  }],
  ["stopsLabel and airlineName", () => {
    assert.equal(stopsLabel(0), "Nonstop");
    assert.equal(stopsLabel(1), "1 stop");
    assert.equal(stopsLabel(3), "3 stops");
    assert.equal(stopsLabel(null), null);
    assert.equal(airlineName("FJ"), "Fiji Airways");
    assert.equal(airlineName("as"), "Alaska");
    assert.equal(airlineName("ZZ"), null);
  }],
];
