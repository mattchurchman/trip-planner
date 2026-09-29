import assert from "node:assert/strict";
import { parseStayLink } from "../js/lib/staylink.js";

export const tests = [
  ["parseStayLink: Booking.com URL extracts provider, name, dates and guests", () => {
    const result = parseStayLink(
      "https://www.booking.com/hotel/pt/casa-alfama.en-gb.html?checkin=2026-06-01&checkout=2026-06-10&group_adults=2&aid=123"
    );
    assert.equal(result.provider, "booking");
    assert.equal(result.name, "Casa Alfama");
    assert.equal(result.checkIn, "2026-06-01");
    assert.equal(result.checkOut, "2026-06-10");
    assert.equal(result.guests, 2);
  }],
  ["parseStayLink: Booking.com URL without a locale suffix still extracts the name", () => {
    const result = parseStayLink("https://www.booking.com/hotel/pt/casa-alfama.html");
    assert.equal(result.provider, "booking");
    assert.equal(result.name, "Casa Alfama");
    assert.equal(result.checkIn, null);
  }],
  ["parseStayLink: Airbnb URL extracts provider, dates and guests but no name", () => {
    const result = parseStayLink("https://www.airbnb.com/rooms/12345678?check_in=2026-06-01&check_out=2026-06-10&adults=3");
    assert.equal(result.provider, "airbnb");
    assert.equal(result.name, null);
    assert.equal(result.checkIn, "2026-06-01");
    assert.equal(result.checkOut, "2026-06-10");
    assert.equal(result.guests, 3);
  }],
  ["parseStayLink: Airbnb URL with no query params still detects the provider", () => {
    const result = parseStayLink("https://www.airbnb.com/rooms/12345678");
    assert.equal(result.provider, "airbnb");
    assert.equal(result.checkIn, null);
    assert.equal(result.guests, null);
  }],
  ["parseStayLink: Google Hotels URL with no q param detects the provider only", () => {
    const result = parseStayLink("https://www.google.com/travel/hotels/entity/abc123");
    assert.equal(result.provider, "google_hotels");
    assert.equal(result.name, null);
  }],
  ["parseStayLink: Google Hotels URL reads the name from q when present", () => {
    const result = parseStayLink("https://www.google.com/travel/hotels/entity/abc123?q=Casa+Alfama");
    assert.equal(result.provider, "google_hotels");
    assert.equal(result.name, "Casa Alfama");
  }],
  ["parseStayLink: any other valid link is provider 'other'", () => {
    const result = parseStayLink("https://www.marriott.com/hotels/travel/lisbon");
    assert.equal(result.provider, "other");
    assert.equal(result.name, null);
  }],
  ["parseStayLink: malformed date query params are ignored", () => {
    const result = parseStayLink("https://www.booking.com/hotel/pt/casa-alfama.html?checkin=not-a-date");
    assert.equal(result.checkIn, null);
  }],
  ["parseStayLink: plain text returns all nulls", () => {
    const result = parseStayLink("just some text");
    assert.deepEqual(result, {
      provider: null,
      name: null,
      checkIn: null,
      checkOut: null,
      guests: null,
      lat: null,
      lng: null,
    });
  }],
  ["parseStayLink: Booking.com URL with lat/latitude params returns coordinates", () => {
    const result = parseStayLink(
      "https://www.booking.com/hotel/pt/casa-alfama.html?checkin=2026-06-01&latitude=38.7139&longitude=-9.1334"
    );
    assert.equal(result.lat, 38.7139);
    assert.equal(result.lng, -9.1334);
  }],
  ["parseStayLink: Airbnb URL with a combined ll= param returns coordinates", () => {
    const result = parseStayLink("https://www.airbnb.com/rooms/12345678?ll=38.7139,-9.1334");
    assert.equal(result.lat, 38.7139);
    assert.equal(result.lng, -9.1334);
  }],
  ["parseStayLink: Google Hotels URL with lat/lng params returns coordinates", () => {
    const result = parseStayLink("https://www.google.com/travel/hotels/entity/abc123?lat=38.7139&lng=-9.1334");
    assert.equal(result.lat, 38.7139);
    assert.equal(result.lng, -9.1334);
  }],
  ["parseStayLink: an existing link with no coordinate params returns lat: null, lng: null", () => {
    const result = parseStayLink(
      "https://www.booking.com/hotel/pt/casa-alfama.en-gb.html?checkin=2026-06-01&checkout=2026-06-10&group_adults=2"
    );
    assert.equal(result.lat, null);
    assert.equal(result.lng, null);
  }],
  ["parseStayLink: an out-of-range lat/lng pair is ignored", () => {
    const result = parseStayLink("https://www.airbnb.com/rooms/12345678?lat=200&lng=-9.1334");
    assert.equal(result.lat, null);
    assert.equal(result.lng, null);
  }],
];
