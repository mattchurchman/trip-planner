import assert from "node:assert/strict";
import {
  safeUrl,
  googleFlightsExploreUrl,
  googleFlightsSearchUrl,
  googleHotelsUrl,
  bookingUrl,
  airbnbUrl,
  googleSearchUrl,
  googleMapsOpenUrl,
} from "../js/lib/links.js";

export const tests = [
  ["safeUrl accepts https", () => {
    assert.equal(safeUrl("https://example.com/a b"), "https://example.com/a%20b");
  }],
  ["safeUrl accepts http", () => {
    assert.equal(safeUrl("http://example.com"), "http://example.com/");
  }],
  ["safeUrl rejects javascript:", () => {
    assert.equal(safeUrl("javascript:alert(1)"), null);
  }],
  ["safeUrl rejects data:", () => {
    assert.equal(safeUrl("data:text/html,hi"), null);
  }],
  ["safeUrl rejects ftp:", () => {
    assert.equal(safeUrl("ftp://example.com/file"), null);
  }],
  ["safeUrl rejects plain text", () => {
    assert.equal(safeUrl("not a url"), null);
  }],
  ["googleFlightsExploreUrl is the fixed explore URL", () => {
    assert.equal(googleFlightsExploreUrl(), "https://www.google.com/travel/explore");
  }],
  ["googleFlightsSearchUrl uses airport codes and both dates", () => {
    const url = googleFlightsSearchUrl({
      fromCity: "Denver",
      fromAirport: "DEN",
      toCity: "Lisbon",
      toAirport: "LIS",
      outboundDate: "2026-03-10",
      returnDate: "2026-03-18",
    });
    assert.equal(
      url,
      "https://www.google.com/travel/flights?q=Flights%20from%20DEN%20to%20LIS%20on%202026-03-10%20returning%202026-03-18"
    );
  }],
  ["googleFlightsSearchUrl falls back to city and omits missing dates", () => {
    const url = googleFlightsSearchUrl({
      fromCity: "Denver",
      fromAirport: "",
      toCity: "Lisbon",
      toAirport: "",
      outboundDate: null,
      returnDate: null,
    });
    assert.equal(url, "https://www.google.com/travel/flights?q=Flights%20from%20Denver%20to%20Lisbon");
  }],
  ["googleHotelsUrl encodes the city query", () => {
    assert.equal(googleHotelsUrl("Lisbon"), "https://www.google.com/travel/hotels?q=Lisbon%20hotels");
  }],
  ["bookingUrl includes dates when present", () => {
    const url = bookingUrl({ city: "Lisbon", checkIn: "2026-03-10", checkOut: "2026-03-18", adults: 2 });
    assert.equal(
      url,
      "https://www.booking.com/searchresults.html?ss=Lisbon&checkin=2026-03-10&checkout=2026-03-18&group_adults=2&no_rooms=1&group_children=0"
    );
  }],
  ["bookingUrl omits missing dates", () => {
    const url = bookingUrl({ city: "Lisbon", checkIn: null, checkOut: null, adults: 2 });
    assert.equal(
      url,
      "https://www.booking.com/searchresults.html?ss=Lisbon&group_adults=2&no_rooms=1&group_children=0"
    );
  }],
  ["airbnbUrl includes dates when present", () => {
    const url = airbnbUrl({ city: "Lisbon", checkIn: "2026-03-10", checkOut: "2026-03-18", adults: 2 });
    assert.equal(url, "https://www.airbnb.com/s/Lisbon/homes?checkin=2026-03-10&checkout=2026-03-18&adults=2");
  }],
  ["airbnbUrl omits missing dates", () => {
    const url = airbnbUrl({ city: "Lisbon", checkIn: null, checkOut: null, adults: 2 });
    assert.equal(url, "https://www.airbnb.com/s/Lisbon/homes?adults=2");
  }],
  ["googleSearchUrl encodes the query", () => {
    assert.equal(googleSearchUrl("Lisbon food tour"), "https://www.google.com/search?q=Lisbon%20food%20tour");
  }],
  ["googleMapsOpenUrl encodes name and city", () => {
    assert.equal(
      googleMapsOpenUrl("Time Out Market", "Lisbon"),
      "https://www.google.com/maps/search/?api=1&query=Time%20Out%20Market%2C%20Lisbon"
    );
  }],
];
