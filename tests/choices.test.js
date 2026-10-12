import assert from "node:assert/strict";
import { createAirportIndex } from "../js/lib/airports.js";
import {
  choiceFor,
  hasAnyOption,
  forTravelers,
  stopsByTraveler,
  mergeStops,
  mergedStops,
  budgetContext,
  travelerBreakdown,
  tripBudget,
} from "../js/lib/choices.js";

const airports = createAirportIndex({
  DEN: ["Denver", "US", 39.86, -104.67],
  SEA: ["Seattle", "US", 47.44, -122.3],
  FCO: ["Rome", "IT", 41.8, 12.25],
  FLR: ["Florence", "IT", 43.81, 11.2],
  BCN: ["Barcelona", "ES", 41.3, 2.08],
});

const price = (cents) => [{ id: `p${cents}`, amountCents: cents, checkedAt: "2026-04-01T00:00:00.000Z" }];

const sam = { id: "t1", name: "Sam" };
const alex = { id: "t2", name: "Alex" };
const jo = { id: "t3", name: "Jo" };

const options = [
  { id: "o1", ideaId: "i1", name: "Florence + Barcelona" },
  { id: "o2", ideaId: "i2", name: "Stay in Rome" },
];

/** A home flight from Denver to Rome, out on the 15th and home on the 26th. */
function home(fields) {
  return {
    id: "h1",
    role: "home",
    ideaId: "i1",
    travelerId: "t1",
    direction: "both",
    picked: true,
    label: "Nonstop",
    fromAirport: "DEN",
    toAirport: "FCO",
    outboundDate: "2026-05-15",
    landsDate: "2026-05-15",
    returnDate: "2026-05-26",
    prices: price(78000),
    ...fields,
  };
}

function hop(id, fromAirport, toAirport, outboundDate, extra = {}) {
  return { id, role: "hop", ideaId: "i1", optionId: "o1", label: `${fromAirport}→${toAirport}`, fromAirport, toAirport, outboundDate, prices: price(6000), ...extra };
}

// Sam and Alex both fly Denver–Rome and both choose option o1; the hops take
// the group to Florence on the 18th and Barcelona on the 22nd.
const hops = [hop("f1", "FCO", "FLR", "2026-05-18"), hop("f2", "FLR", "BCN", "2026-05-22")];

const bothChose = { choices: { t1: { ideaId: "i1", optionId: "o1" }, t2: { ideaId: "i1", optionId: "o1" } } };

function flightsFor(travelers) {
  return [...travelers.map((t, i) => home({ id: `h${i + 1}`, travelerId: t.id, label: `${t.name}'s flight` })), ...hops];
}

const ctxFor = (trip, travelers, flights) => budgetContext({ trip, travelers, options, flights, airports });

export const tests = [
  ["choiceFor: a traveler with no entry inherits the retired chosenOptionId and that option's idea", () => {
    const trip = { chosenOptionId: "o1" };
    assert.deepEqual(choiceFor(trip, "t1", options), { ideaId: "i1", optionId: "o1" });
    assert.deepEqual(choiceFor({ chosenOptionId: null }, "t1", options), { ideaId: null, optionId: null });
  }],

  ["choiceFor: an entry of their own wins over the legacy field, for that traveler only", () => {
    const trip = { chosenOptionId: "o1", choices: { t1: { ideaId: "i2", optionId: "o2" } } };
    assert.deepEqual(choiceFor(trip, "t1", options), { ideaId: "i2", optionId: "o2" });
    assert.deepEqual(choiceFor(trip, "t2", options), { ideaId: "i1", optionId: "o1" });
  }],

  ["choiceFor: choosing an option leaves the chosen idea alone", () => {
    // Sam is reading idea i1 but chose an option belonging to i2 — both stand.
    const trip = { choices: { t1: { ideaId: "i1", optionId: "o2" } } };
    assert.deepEqual(choiceFor(trip, "t1", options), { ideaId: "i1", optionId: "o2" });
    // And with no idea chosen at all, the option's own idea stands in.
    assert.deepEqual(choiceFor({ choices: { t1: { optionId: "o2" } } }, "t1", options), { ideaId: "i2", optionId: "o2" });
  }],

  ["hasAnyOption: true once anyone has chosen, or from the legacy field", () => {
    assert.equal(hasAnyOption({ choices: {} }), false);
    assert.equal(hasAnyOption({ choices: { t1: { ideaId: "i1", optionId: null } } }), false);
    assert.equal(hasAnyOption({ choices: { t1: { ideaId: null, optionId: "o1" } } }), true);
    assert.equal(hasAnyOption({ chosenOptionId: "o1" }), true);
  }],

  ["forTravelers: a hop is for whoever chose its option; a home flight is for its own traveler", () => {
    const travelers = [sam, alex, jo];
    const trip = { choices: { t1: { ideaId: "i1", optionId: "o1" }, t2: { ideaId: "i1", optionId: "o1" }, t3: { ideaId: "i2", optionId: "o2" } } };
    const ctx = ctxFor(trip, travelers, flightsFor(travelers));
    assert.deepEqual(forTravelers(hops[0], "hop", ctx), ["t1", "t2"]);
    assert.deepEqual(forTravelers(home({ travelerId: "t2" }), "home", ctx), ["t2"]);
    // A hop belonging to no option is for nobody; a split cost is for everyone.
    assert.deepEqual(forTravelers({ optionId: null }, "hop", ctx), []);
    assert.deepEqual(forTravelers({ amountCents: 100 }, "cost", ctx), ["t1", "t2", "t3"]);
  }],

  ["forTravelers: an override beats the automatic answer, and drops travelers who've left the trip", () => {
    const travelers = [sam, alex];
    const ctx = ctxFor(bothChose, travelers, flightsFor(travelers));
    assert.deepEqual(forTravelers({ ...hops[0], forTravelerIds: ["t2"] }, "hop", ctx), ["t2"]);
    assert.deepEqual(forTravelers(home({ travelerId: "t1", forTravelerIds: ["t1", "t2"] }), "home", ctx), ["t1", "t2"]);
    assert.deepEqual(forTravelers({ amountCents: 100, forTravelerIds: ["t2", "gone"] }, "cost", ctx), ["t2"]);
  }],

  ["forTravelers: a stay is for whoever sleeps there, and for everyone when nobody has stops yet", () => {
    const travelers = [sam, alex];
    // Alex flies home from Florence on the 22nd, so only Sam is in Barcelona.
    const flights = [
      home({ id: "h1", travelerId: "t1", label: "Sam's flight" }),
      home({ id: "h2", travelerId: "t2", label: "Alex's flight", toAirport: "FCO", returnDate: "2026-05-22", fromAirport: "DEN" }),
      ...hops,
    ];
    const ctx = ctxFor(bothChose, travelers, flights);
    const barcelona = { name: "Hotel BCN", checkIn: "2026-05-22", checkOut: "2026-05-26", prices: price(40000) };
    const rome = { name: "Casa Roma", checkIn: "2026-05-15", checkOut: "2026-05-18", prices: price(30000) };
    assert.deepEqual(forTravelers(barcelona, "stay", ctx), ["t1"]);
    assert.deepEqual(forTravelers(rome, "stay", ctx), ["t1", "t2"]);
    // No dates, and nobody with stops at all, both fall back to everyone.
    assert.deepEqual(forTravelers({ name: "No dates" }, "stay", ctx), ["t1", "t2"]);
    assert.deepEqual(forTravelers(rome, "stay", ctxFor({ choices: {} }, travelers, flights)), ["t1", "t2"]);
  }],

  ["stopsByTraveler: a traveler with no chosen option adds nothing", () => {
    const travelers = [sam, alex];
    const trip = { choices: { t1: { ideaId: "i1", optionId: "o1" } } };
    const perTraveler = stopsByTraveler({ travelers, trip, options, flights: flightsFor(travelers), airports });
    assert.deepEqual(perTraveler.map((e) => e.travelerId), ["t1", "t2"]);
    assert.equal(perTraveler[0].stops.length, 3);
    assert.deepEqual(perTraveler[1].stops, []);
  }],

  ["mergeStops: one entry per city, earliest arrival first, widest date range, with who sleeps each night", () => {
    const travelers = [sam, alex];
    // Alex arrives in Rome a day later than Sam and leaves from Florence early.
    const flights = [
      home({ id: "h1", travelerId: "t1", label: "Sam's flight" }),
      home({ id: "h2", travelerId: "t2", label: "Alex's flight", outboundDate: "2026-05-16", landsDate: "2026-05-16", returnDate: "2026-05-22" }),
      ...hops,
    ];
    const merged = mergedStops({ travelers, trip: bothChose, options, flights, airports });
    assert.deepEqual(merged.map((s) => s.city), ["Rome", "Florence", "Barcelona"]);

    const rome = merged[0];
    assert.equal(rome.from, "2026-05-15"); // Sam's arrival, the earliest
    assert.equal(rome.to, "2026-05-18"); // the hop out, shared
    assert.deepEqual(rome.travelerIds, ["t1", "t2"]);
    assert.deepEqual(rome.nights, [
      { date: "2026-05-15", travelerIds: ["t1"] }, // Alex isn't there yet
      { date: "2026-05-16", travelerIds: ["t1", "t2"] },
      { date: "2026-05-17", travelerIds: ["t1", "t2"] },
    ]);

    // Alex reaches Barcelona on the 22nd but flies home the same day, so the
    // stop is both of theirs and every night in it is Sam's alone.
    const barcelona = merged[2];
    assert.deepEqual(barcelona.travelerIds, ["t1", "t2"]);
    assert.equal(barcelona.from, "2026-05-22");
    assert.equal(barcelona.to, "2026-05-26");
    assert.equal(barcelona.nights.length, 4);
    assert.ok(barcelona.nights.every((n) => n.travelerIds.join(",") === "t1"));
  }],

  ["mergeStops: an undated stop sorts last and contributes no nights", () => {
    const merged = mergeStops([
      { travelerId: "t1", stops: [{ cityKey: "rome-it", city: "Rome", code: "FCO", from: null, to: null }] },
      { travelerId: "t2", stops: [{ cityKey: "barcelona-es", city: "Barcelona", code: "BCN", from: "2026-05-22", to: "2026-05-24" }] },
    ]);
    assert.deepEqual(merged.map((s) => s.city), ["Barcelona", "Rome"]);
    assert.deepEqual(merged[1].nights, []);
    assert.deepEqual(merged[0].nights.map((n) => n.date), ["2026-05-22", "2026-05-23"]);
  }],

  ["travelerBreakdown: home flights, hops, stay shares and cost shares, under their own chosen idea", () => {
    const travelers = [sam, alex];
    const flights = flightsFor(travelers);
    const ctx = ctxFor(bothChose, travelers, flights);
    const stays = [{ name: "Casa Roma", checkIn: "2026-05-15", checkOut: "2026-05-18", prices: price(30000) }];
    const costs = [{ label: "Rental car", amountCents: 10000 }];
    const result = travelerBreakdown({ travelerId: "t1", ctx, flights, stays, costs });
    assert.deepEqual(
      { home: result.homeCents, hop: result.hopCents, stay: result.stayCents, cost: result.costCents },
      { home: 78000, hop: 12000, stay: 15000, cost: 5000 }
    );
    assert.equal(result.totalCents, 78000 + 12000 + 15000 + 5000);
    assert.equal(result.complete, true);
    assert.deepEqual(result.missing, []);
  }],

  ["travelerBreakdown: a missing price counts as 0, is named, and never reads as complete", () => {
    const travelers = [sam];
    const flights = [home({ travelerId: "t1", label: "Nonstop, Tuesday out", prices: [] })];
    const ctx = ctxFor({ choices: { t1: { ideaId: "i1", optionId: "o1" } } }, travelers, flights);
    const stays = [{ name: "Casa Roma", checkIn: "2026-05-15", checkOut: "2026-05-18", prices: [] }];
    const result = travelerBreakdown({ travelerId: "t1", ctx, flights, stays, costs: [] });
    assert.equal(result.totalCents, 0);
    assert.equal(result.complete, false);
    assert.deepEqual(result.missing, [`No price logged for Sam's flight "Nonstop, Tuesday out"`, "No price logged for Casa Roma"]);
  }],

  ["travelerBreakdown: a stay one traveler leaves early is split only between the people sleeping there", () => {
    const travelers = [sam, alex];
    const flights = [
      home({ id: "h1", travelerId: "t1", label: "Sam's flight" }),
      home({ id: "h2", travelerId: "t2", label: "Alex's flight", returnDate: "2026-05-22" }),
      ...hops,
    ];
    const ctx = ctxFor(bothChose, travelers, flights);
    const stays = [{ name: "Hotel BCN", checkIn: "2026-05-22", checkOut: "2026-05-26", prices: price(40000) }];
    const forSam = travelerBreakdown({ travelerId: "t1", ctx, flights, stays, costs: [] });
    const forAlex = travelerBreakdown({ travelerId: "t2", ctx, flights, stays, costs: [] });
    assert.equal(forSam.stayCents, 40000);
    assert.equal(forAlex.stayCents, 0);
    assert.deepEqual(forAlex.missing, []);
  }],

  ["travelerBreakdown: an override on a cost beats the automatic split", () => {
    const travelers = [sam, alex];
    const flights = flightsFor(travelers);
    const ctx = ctxFor(bothChose, travelers, flights);
    const costs = [{ label: "Alex's visa", amountCents: 9000, forTravelerIds: ["t2"] }];
    assert.equal(travelerBreakdown({ travelerId: "t1", ctx, flights, stays: [], costs }).costCents, 0);
    assert.equal(travelerBreakdown({ travelerId: "t2", ctx, flights, stays: [], costs }).costCents, 9000);
  }],

  ["tripBudget: nobody has chosen, so every traveler is missing a flight but stays and costs still total", () => {
    const travelers = [sam, alex];
    const stays = [{ name: "Casa Alfama", prices: price(100001) }];
    const result = tripBudget({ trip: { choices: {} }, travelers, options, flights: [], stays, costs: [{ amountCents: 10000 }], airports });
    assert.equal(result.complete, false);
    assert.deepEqual(result.missing, ["No flight chosen for Sam", "No flight chosen for Alex"]);
    assert.equal(result.travelerTotals.reduce((sum, t) => sum + t.totalCents, 0), result.combinedCents);
    assert.equal(result.combinedCents, 100001 + 10000);
  }],

  ["tripBudget: two travelers' own flights plus the shared hops, adding up exactly", () => {
    const travelers = [sam, alex];
    const flights = [
      home({ id: "h1", travelerId: "t1", label: "Sam's flight", prices: price(42000) }),
      home({ id: "h2", travelerId: "t2", label: "Alex's flight", prices: price(61000) }),
      hop("f1", "FCO", "FLR", "2026-05-18", { prices: price(5000) }),
    ];
    const result = tripBudget({ trip: bothChose, travelers, options, flights, stays: [], costs: [], airports });
    assert.equal(result.complete, true);
    assert.deepEqual(result.missing, []);
    assert.equal(result.travelerTotals[0].totalCents, 42000 + 5000);
    assert.equal(result.travelerTotals[1].totalCents, 61000 + 5000);
    assert.equal(result.combinedCents, 42000 + 61000 + 5000 + 5000);
  }],

  ["tripBudget: a split cost across 3 travelers, shares adding exactly to the whole", () => {
    const travelers = [sam, alex, jo];
    const result = tripBudget({ trip: { choices: {} }, travelers, options, flights: [], stays: [], costs: [{ amountCents: 10001 }], airports });
    assert.equal(result.travelerTotals.reduce((sum, t) => sum + t.totalCents, 0), 10001);
  }],

  ["tripBudget: an old trip with only chosenOptionId still totals the way it used to", () => {
    const travelers = [sam];
    const flights = [home({ travelerId: "t1", prices: price(42000) }), hop("f1", "FCO", "FLR", "2026-05-18", { prices: price(5000) })];
    const result = tripBudget({ trip: { chosenOptionId: "o1" }, travelers, options, flights, stays: [], costs: [], airports });
    assert.equal(result.complete, true);
    assert.equal(result.combinedCents, 47000);
  }],

  ["tripBudget: choosing no stay is still complete", () => {
    const travelers = [sam];
    const flights = [home({ travelerId: "t1", prices: price(10000) })];
    const result = tripBudget({ trip: bothChose, travelers, options, flights, stays: [], costs: [], airports });
    assert.equal(result.complete, true);
    assert.deepEqual(result.missing, []);
  }],
];
