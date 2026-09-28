import assert from "node:assert/strict";
import { parseGoogleMapsUrl } from "../js/lib/mapsurl.js";

export const tests = [
  ["parseGoogleMapsUrl: !3d!4d wins over @ and fills the name", () => {
    const url =
      "https://www.google.com/maps/place/Time+Out+Market+Lisboa/@38.7069,-9.1459,17z/data=!4m6!3m5!1s0xd193470:0x0!8m2!3d38.70687!4d-9.14591!16s%2Fg%2F1tdvdxxz";
    const result = parseGoogleMapsUrl(url);
    assert.equal(result.lat, 38.70687);
    assert.equal(result.lng, -9.14591);
    assert.equal(result.name, "Time Out Market Lisboa");
    assert.equal(result.error, null);
  }],
  ["parseGoogleMapsUrl: @-only URL uses the view-center coordinates, no name", () => {
    const result = parseGoogleMapsUrl("https://www.google.com/maps/@38.7169,-9.1399,15z");
    assert.equal(result.lat, 38.7169);
    assert.equal(result.lng, -9.1399);
    assert.equal(result.name, null);
    assert.equal(result.error, null);
  }],
  ["parseGoogleMapsUrl: ?api=1&query=lat,lng URL", () => {
    const result = parseGoogleMapsUrl("https://www.google.com/maps/search/?api=1&query=38.7169,-9.1399");
    assert.equal(result.lat, 38.7169);
    assert.equal(result.lng, -9.1399);
    assert.equal(result.error, null);
  }],
  ["parseGoogleMapsUrl: ?q=lat,lng URL", () => {
    const result = parseGoogleMapsUrl("https://www.google.com/maps?q=38.7169,-9.1399");
    assert.equal(result.lat, 38.7169);
    assert.equal(result.lng, -9.1399);
    assert.equal(result.error, null);
  }],
  ["parseGoogleMapsUrl: maps.app.goo.gl short link returns the short-link error", () => {
    const result = parseGoogleMapsUrl("https://maps.app.goo.gl/abc123XYZ");
    assert.equal(result.lat, null);
    assert.match(result.error, /Short share links/);
  }],
  ["parseGoogleMapsUrl: non-Google URL is rejected", () => {
    const result = parseGoogleMapsUrl("https://www.bing.com/maps?q=38.7169,-9.1399");
    assert.equal(result.lat, null);
    assert.equal(result.error, "That doesn't look like a Google Maps link.");
  }],
  ["parseGoogleMapsUrl: plain text is rejected", () => {
    const result = parseGoogleMapsUrl("just some text, not a url");
    assert.equal(result.lat, null);
    assert.equal(result.error, "That doesn't look like a Google Maps link.");
  }],
  ["parseGoogleMapsUrl: a look-alike host like google.evil.com is rejected", () => {
    for (const host of ["google.evil.com", "www.google.attacker.io", "google.ev.de", "notgoogle.com"]) {
      const result = parseGoogleMapsUrl(`https://${host}/maps/place/Nice+Cafe/@38.7,-9.1,17z`);
      assert.equal(result.lat, null, `${host} should not yield coordinates`);
      assert.equal(result.error, "That doesn't look like a Google Maps link.");
    }
  }],
  ["parseGoogleMapsUrl: real Google country domains are accepted", () => {
    for (const host of ["google.co.uk", "www.google.de", "google.com.au", "maps.google.com"]) {
      const result = parseGoogleMapsUrl(`https://${host}/maps/place/Nice+Cafe/@38.7,-9.1,17z`);
      assert.equal(result.lat, 38.7, `${host} should parse`);
      assert.equal(result.error, null);
    }
  }],
  ["parseGoogleMapsUrl: out-of-range coordinates are treated as no location", () => {
    const result = parseGoogleMapsUrl("https://www.google.com/maps/@200,200,15z");
    assert.equal(result.lat, null);
    assert.equal(result.lng, null);
    assert.equal(result.error, "No location in this link — use Search or Place on map.");
  }],
];
