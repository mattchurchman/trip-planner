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
    assert.deepEqual(result, { provider: null, name: null, checkIn: null, checkOut: null, guests: null });
  }],
];
