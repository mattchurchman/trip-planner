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
  googleMapsFindUrl,
  walkingRouteLinks,
} from "../js/lib/links.js";

function pt(lat, lng) {
  return { lat, lng };
}

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
  ["googleMapsFindUrl joins text, city and country", () => {
    assert.equal(
      googleMapsFindUrl("tacos", "Lisbon", "Portugal"),
      "https://www.google.com/maps/search/?api=1&query=tacos%2C%20Lisbon%2C%20Portugal"
    );
  }],
  ["googleMapsFindUrl with no text searches just the destination", () => {
    assert.equal(
      googleMapsFindUrl("", "Lisbon", "Portugal"),
      "https://www.google.com/maps/search/?api=1&query=Lisbon%2C%20Portugal"
    );
  }],
  ["googleMapsFindUrl with no country has no trailing comma", () => {
    assert.equal(googleMapsFindUrl("tacos", "Lisbon", ""), "https://www.google.com/maps/search/?api=1&query=tacos%2C%20Lisbon");
  }],
  ["googleMapsFindUrl encodes special characters", () => {
    assert.equal(
      googleMapsFindUrl("café & bar", "São Paulo", "Brazil"),
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("café & bar, São Paulo, Brazil")}`
    );
  }],
  ["walkingRouteLinks with 2 places: single link, no waypoints", () => {
    const links = walkingRouteLinks([pt(1, 1), pt(2, 2)]);
    assert.equal(links.length, 1);
    assert.equal(links[0].label, "Open walking route");
    assert.equal(links[0].url, "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=1,1&destination=2,2");
  }],
  ["walkingRouteLinks with 5 places: one link with 3 waypoints in order", () => {
    const places = [pt(0, 0), pt(1, 1), pt(2, 2), pt(3, 3), pt(4, 4)];
    const links = walkingRouteLinks(places);
    assert.equal(links.length, 1);
    assert.equal(
      links[0].url,
      "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=0,0&destination=4,4&waypoints=1,1%7C2,2%7C3,3"
    );
  }],
  ["walkingRouteLinks with 10 places: still one link, right at the 8-waypoint cap", () => {
    const places = Array.from({ length: 10 }, (_, i) => pt(i, i));
    const links = walkingRouteLinks(places);
    assert.equal(links.length, 1);
    assert.equal(links[0].label, "Open walking route");
    const waypointsPart = links[0].url.split("waypoints=")[1];
    assert.equal(waypointsPart.split("%7C").length, 8);
  }],
  ["walkingRouteLinks with 14 places splits into parts, each starting where the previous ended", () => {
    const places = Array.from({ length: 14 }, (_, i) => pt(i, i));
    const links = walkingRouteLinks(places);
    assert.equal(links.length, 2);
    assert.equal(links[0].label, "Route part 1");
    assert.equal(links[1].label, "Route part 2");
    assert.match(links[0].url, /origin=0,0/);
    assert.match(links[0].url, /destination=9,9/);
    assert.match(links[1].url, /origin=9,9/); // part 2 starts where part 1 ended
    assert.match(links[1].url, /destination=13,13/);
  }],
  ["walkingRouteLinks skips places without coordinates, preserving order of the rest", () => {
    const places = [pt(0, 0), { lat: null, lng: null }, pt(2, 2), { lat: 3, lng: null }, pt(4, 4)];
    const links = walkingRouteLinks(places);
    assert.equal(links.length, 1);
    assert.equal(
      links[0].url,
      "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=0,0&destination=4,4&waypoints=2,2"
    );
  }],
  ["walkingRouteLinks returns nothing with fewer than 2 located places", () => {
    assert.deepEqual(walkingRouteLinks([]), []);
    assert.deepEqual(walkingRouteLinks([pt(0, 0)]), []);
    assert.deepEqual(walkingRouteLinks([pt(0, 0), { lat: null, lng: null }]), []);
  }],
];
