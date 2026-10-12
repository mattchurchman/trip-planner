import assert from "node:assert/strict";
import { createAirportIndex } from "../js/lib/airports.js";
import { stopsFor } from "../js/lib/route.js";
import { datesBetween, daysFromStops, missingDays, stayForDate } from "../js/lib/dayplan.js";

const airports = createAirportIndex({
  DEN: ["Denver", "US", 39.86, -104.67],
  FCO: ["Rome", "IT", 41.8, 12.25],
  FLR: ["Florence", "IT", 43.81, 11.2],
  BCN: ["Barcelona", "ES", 41.3, 2.08],
});

const price = (cents) => [{ id: "p1", amountCents: cents, checkedAt: "2026-04-01T00:00:00.000Z" }];
const home = (fields) => ({ id: "h1", role: "home", travelerId: "t1", picked: true, prices: price(78000), ...fields });
const hop = (id, fromAirport, toAirport, outboundDate) => ({ id, role: "hop", fromAirport, toAirport, outboundDate, prices: price(6000) });

// Rome round trip: land 15 May, Florence 18th, Barcelona 22nd, back to Rome 26th, home 28th.
const romeHome = home({
  fromAirport: "DEN",
  toAirport: "FCO",
  outboundDate: "2026-05-14",
  landsDate: "2026-05-15",
  returnDate: "2026-05-28",
  direction: "both",
});
const romeHops = [
  hop("f1", "FCO", "FLR", "2026-05-18"),
  hop("f2", "FLR", "BCN", "2026-05-22"),
  hop("f3", "BCN", "FCO", "2026-05-26"),
];
const romeStops = stopsFor({ homeFlights: [romeHome], hopFlights: romeHops, airports });

export const tests = [
  ["datesBetween: inclusive range", () => {
    assert.deepEqual(datesBetween("2026-05-15", "2026-05-18"), ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"]);
    assert.deepEqual(datesBetween("2026-05-15", "2026-05-15"), ["2026-05-15"]);
  }],

  ["daysFromStops: Rome / Florence / Barcelona route gives 14 days, turnover days go to the arrival city", () => {
    const days = daysFromStops(romeStops);
    assert.equal(days.length, 14);
    assert.deepEqual(days.map((d) => d.date), [
      "2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18", "2026-05-19", "2026-05-20",
      "2026-05-21", "2026-05-22", "2026-05-23", "2026-05-24", "2026-05-25", "2026-05-26",
      "2026-05-27", "2026-05-28",
    ]);
    // 17th is the last day still in Rome; the 18th is the travel day and belongs to Florence.
    assert.equal(days.find((d) => d.date === "2026-05-17").title, "Rome");
    assert.equal(days.find((d) => d.date === "2026-05-18").title, "Florence");
    // Same turnover rule on the Florence -> Barcelona and Barcelona -> Rome days.
    assert.equal(days.find((d) => d.date === "2026-05-22").title, "Barcelona");
    assert.equal(days.find((d) => d.date === "2026-05-26").title, "Rome");
    // The last stop also keeps its final (fly-home) date, since there's no later stop to claim it.
    assert.equal(days.find((d) => d.date === "2026-05-28").title, "Rome");
    assert.equal(days[0].cityKey, "Rome, IT");
  }],

  ["daysFromStops: a zero-night pass-through stop gets no day of its own", () => {
    const stops = [
      { cityKey: "A", city: "A", from: "2026-01-01", to: "2026-01-03" },
      { cityKey: "B", city: "B", from: "2026-01-03", to: "2026-01-03" }, // 0 nights, same-day connection
      { cityKey: "C", city: "C", from: "2026-01-03", to: "2026-01-05" },
    ];
    const days = daysFromStops(stops);
    assert.equal(days.length, 5);
    assert.ok(!days.some((d) => d.cityKey === "B"));
    // The shared turnover date ends up with the city actually reached that day.
    assert.equal(days.find((d) => d.date === "2026-01-03").cityKey, "C");
  }],

  ["daysFromStops: skips a stop with no dates instead of crashing", () => {
    const stops = [{ cityKey: "A", city: "A", from: null, to: null }];
    assert.deepEqual(daysFromStops(stops), []);
  }],

  ["missingDays: nothing is missing the second time, so the button never duplicates", () => {
    const wanted = daysFromStops(romeStops);
    const firstRun = missingDays([], wanted);
    assert.equal(firstRun.length, 14);
    const existingDays = firstRun.map((d, i) => ({ id: `d${i}`, date: d.date }));
    assert.deepEqual(missingDays(existingDays, wanted), []);
  }],

  ["missingDays: only the dates not already on the board", () => {
    const wanted = [{ date: "2026-05-15", cityKey: "Rome, IT", title: "Rome" }, { date: "2026-05-18", cityKey: "Florence, IT", title: "Florence" }];
    const existing = [{ id: "d1", date: "2026-05-15" }];
    assert.deepEqual(missingDays(existing, wanted), [wanted[1]]);
  }],

  ["stayForDate: matches a night inside the stay", () => {
    const stay = { id: "s1", checkIn: "2026-06-01", checkOut: "2026-06-04", lat: 41.9, lng: 12.5 };
    assert.equal(stayForDate("2026-06-02", [stay]), stay);
  }],

  ["stayForDate: matches the departure day, the morning after the last night", () => {
    const stay = { id: "s1", checkIn: "2026-06-01", checkOut: "2026-06-04", lat: 41.9, lng: 12.5 };
    assert.equal(stayForDate("2026-06-04", [stay]), stay);
  }],

  ["stayForDate: null outside the stay's range", () => {
    const stay = { id: "s1", checkIn: "2026-06-01", checkOut: "2026-06-04", lat: 41.9, lng: 12.5 };
    assert.equal(stayForDate("2026-06-05", [stay]), null);
    assert.equal(stayForDate("2026-05-31", [stay]), null);
  }],

  ["stayForDate: skips a chosen stay with no pin", () => {
    const stay = { id: "s1", checkIn: "2026-06-01", checkOut: "2026-06-04", lat: null, lng: null };
    assert.equal(stayForDate("2026-06-02", [stay]), null);
  }],

  ["stayForDate: null for an undated day or with no chosen stays", () => {
    assert.equal(stayForDate(null, [{ checkIn: "2026-06-01", checkOut: "2026-06-04", lat: 1, lng: 1 }]), null);
    assert.equal(stayForDate("2026-06-02", []), null);
    assert.equal(stayForDate("2026-06-02", undefined), null);
  }],

  ["stayForDate: picks the first matching stay on a double-booked night", () => {
    const first = { id: "s1", checkIn: "2026-06-01", checkOut: "2026-06-04", lat: 1, lng: 1 };
    const second = { id: "s2", checkIn: "2026-06-02", checkOut: "2026-06-05", lat: 2, lng: 2 };
    assert.equal(stayForDate("2026-06-02", [first, second]), first);
  }],
];
