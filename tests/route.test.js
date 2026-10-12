import assert from "node:assert/strict";
import { createAirportIndex } from "../js/lib/airports.js";
import {
  movements,
  stopsFor,
  totalFor,
  ideaName,
  ideaEndpoints,
  optionName,
  optionAutoName,
  directionsToClear,
  guessLandsDate,
  homeDirection,
  placePastedFlight,
} from "../js/lib/route.js";

const airports = createAirportIndex({
  DEN: ["Denver", "US", 39.86, -104.67],
  FCO: ["Rome", "IT", 41.8, 12.25],
  CIA: ["Rome", "IT", 41.8, 12.6],
  FLR: ["Florence", "IT", 43.81, 11.2],
  PSA: ["Pisa", "IT", 43.68, 10.39],
  BCN: ["Barcelona", "ES", 41.3, 2.08],
  ATH: ["Athens", "GR", 37.94, 23.95],
  IST: ["Istanbul", "TR", 41.26, 28.74],
  LHR: ["London", "GB", 51.47, -0.45],
  MAD: ["Madrid", "ES", 40.49, -3.57],
});

const price = (cents) => [{ id: "p1", amountCents: cents, checkedAt: "2026-04-01T00:00:00.000Z" }];

/** A home flight. `direction` "both" means there and back on one booking. */
function home(fields) {
  return { id: "h1", role: "home", travelerId: "t1", picked: true, prices: price(78000), ...fields };
}

/** A hop inside the region. Shared by everyone, so no travelerId. */
function hop(id, fromAirport, toAirport, outboundDate, extra = {}) {
  return { id, role: "hop", fromAirport, toAirport, outboundDate, prices: price(6000), ...extra };
}

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

const stopSummary = (stops) => stops.map((s) => [s.city, s.nights]);

export const tests = [
  ["movements: a round-trip hop becomes two legs, sorted by date with undated last", () => {
    const legs = movements([
      hop("f2", "FLR", "BCN", "2026-05-22"),
      hop("f9", "BCN", "PSA", null),
      hop("f1", "ATH", "IST", "2026-05-03", { returnDate: "2026-05-06" }),
    ]);
    assert.deepEqual(legs.map((l) => [l.from, l.to, l.date, l.flightId]), [
      ["ATH", "IST", "2026-05-03", "f1"],
      ["IST", "ATH", "2026-05-06", "f1"],
      ["FLR", "BCN", "2026-05-22", "f2"],
      ["BCN", "PSA", null, "f9"],
    ]);
  }],

  ["stopsFor: Rome round trip with two hops gives Rome 3, Florence 4, Barcelona 4, Rome 2", () => {
    const stops = stopsFor({ homeFlights: [romeHome], hopFlights: romeHops, airports });
    assert.deepEqual(stopSummary(stops), [["Rome", 3], ["Florence", 4], ["Barcelona", 4], ["Rome", 2]]);
    assert.deepEqual(stops[0].from, "2026-05-15");
    assert.deepEqual(stops[3].to, "2026-05-28");
    assert.deepEqual(stops.flatMap((s) => s.warnings), []);
    assert.equal(stops[0].cityKey, "Rome, IT");
  }],

  ["stopsFor: a round-trip side trip gives three stops", () => {
    const stops = stopsFor({
      homeFlights: [home({
        fromAirport: "DEN",
        toAirport: "ATH",
        outboundDate: "2026-05-31",
        landsDate: "2026-06-01",
        returnDate: "2026-06-10",
        direction: "both",
      })],
      hopFlights: [hop("f1", "ATH", "IST", "2026-06-03", { returnDate: "2026-06-06" })],
      airports,
    });
    assert.deepEqual(stopSummary(stops), [["Athens", 2], ["Istanbul", 3], ["Athens", 4]]);
  }],

  ["stopsFor: separate flights out and home, landing on the departure date when landsDate is unset", () => {
    const stops = stopsFor({
      homeFlights: [
        home({ id: "out", fromAirport: "DEN", toAirport: "LHR", outboundDate: "2026-05-15", direction: "out" }),
        home({ id: "back", fromAirport: "MAD", toAirport: "DEN", outboundDate: "2026-05-25", direction: "back" }),
      ],
      hopFlights: [hop("f1", "LHR", "MAD", "2026-05-20")],
      airports,
    });
    assert.deepEqual(stopSummary(stops), [["London", 5], ["Madrid", 5]]);
    assert.equal(stops[0].from, "2026-05-15");
  }],

  ["stopsFor: an unpicked home flight is ignored", () => {
    const stops = stopsFor({
      homeFlights: [
        home({ id: "cheap", fromAirport: "DEN", toAirport: "FCO", outboundDate: "2026-05-14", landsDate: "2026-05-15", returnDate: "2026-05-28", direction: "both", picked: false }),
        home({ id: "used", fromAirport: "DEN", toAirport: "ATH", outboundDate: "2026-05-14", landsDate: "2026-05-15", returnDate: "2026-05-20", direction: "both" }),
      ],
      hopFlights: [],
      airports,
    });
    assert.deepEqual(stopSummary(stops), [["Athens", 5]]);
  }],

  ["stopsFor: a hop leaving from the wrong city warns on the stop it belongs to", () => {
    const stops = stopsFor({
      homeFlights: [romeHome],
      hopFlights: [hop("f1", "FLR", "BCN", "2026-05-18")],
      airports,
    });
    assert.deepEqual(stops[0].warnings, ["Your next flight leaves from Florence, but you're in Rome."]);
    // The same itinerary now ends in Barcelona, so the flight home is adrift too.
    assert.deepEqual(stops[1].warnings, ["Your flight home leaves from Rome, but you're in Barcelona."]);
  }],

  ["stopsFor: a flight home from the wrong city warns on the last stop", () => {
    const stops = stopsFor({
      homeFlights: [
        home({ id: "out", fromAirport: "DEN", toAirport: "FCO", outboundDate: "2026-05-14", landsDate: "2026-05-15", direction: "out" }),
        home({ id: "back", fromAirport: "FCO", toAirport: "DEN", outboundDate: "2026-05-28", direction: "back" }),
      ],
      hopFlights: [hop("f1", "FCO", "BCN", "2026-05-20")],
      airports,
    });
    assert.deepEqual(stops[1].warnings, ["Your flight home leaves from Rome, but you're in Barcelona."]);
  }],

  ["stopsFor: dates that run backwards warn and leave the nights blank", () => {
    const stops = stopsFor({
      homeFlights: [romeHome],
      hopFlights: [hop("f1", "FCO", "FLR", "2026-05-12")],
      airports,
    });
    assert.equal(stops[0].nights, null);
    assert.deepEqual(stops[0].warnings, ["These dates overlap. Check the flight before and after this stop."]);
  }],

  ["stopsFor: a hop with no date warns and sorts last", () => {
    const stops = stopsFor({
      homeFlights: [romeHome],
      hopFlights: [hop("f1", "FCO", "FLR", null)],
      airports,
    });
    assert.deepEqual(stops[0].warnings, ["This flight has no date yet. Add one to work out the nights."]);
    assert.equal(stops[0].nights, null);
  }],

  ["stopsFor: with no home flight yet the first stop has no start date", () => {
    const stops = stopsFor({ homeFlights: [], hopFlights: romeHops, airports });
    assert.deepEqual(stopSummary(stops), [["Rome", null], ["Florence", 4], ["Barcelona", 4], ["Rome", null]]);
    assert.equal(stops[0].from, null);
    assert.equal(stops[3].to, null);
    assert.deepEqual(stops.flatMap((s) => s.warnings), []);
  }],

  ["stopsFor: nothing at all gives no stops", () => {
    assert.deepEqual(stopsFor({ homeFlights: [], hopFlights: [], airports }), []);
  }],

  ["stopsFor: FCO and CIA count as the same city, so no wrong-city warning", () => {
    const stops = stopsFor({
      homeFlights: [romeHome],
      hopFlights: [hop("f1", "CIA", "BCN", "2026-05-18"), hop("f2", "BCN", "CIA", "2026-05-22")],
      airports,
    });
    assert.deepEqual(stopSummary(stops), [["Rome", 3], ["Barcelona", 4], ["Rome", 6]]);
    assert.deepEqual(stops.flatMap((s) => s.warnings), []);
  }],

  ["totalFor: picked home flight plus every hop", () => {
    const total = totalFor({ homeFlights: [romeHome], hopFlights: romeHops });
    assert.deepEqual(total, { cents: 78000 + 6000 * 3, complete: true });
  }],

  ["totalFor: a missing price makes the total incomplete but still counts the rest", () => {
    const total = totalFor({
      homeFlights: [romeHome],
      hopFlights: [hop("f1", "FCO", "FLR", "2026-05-18", { prices: [] })],
    });
    assert.deepEqual(total, { cents: 78000, complete: false });
  }],

  ["totalFor: unpicked home flights don't count, and nothing picked isn't complete", () => {
    const unpicked = home({ picked: false, direction: "both", fromAirport: "DEN", toAirport: "FCO" });
    assert.deepEqual(totalFor({ homeFlights: [unpicked], hopFlights: [] }), { cents: 0, complete: false });
  }],

  ["ideaName: same city in and out is a round trip", () => {
    assert.equal(ideaName({ inCode: "FCO", outCode: "FCO", airports }), "Rome round trip");
    assert.equal(ideaName({ inCode: "FCO", outCode: "CIA", airports }), "Rome round trip");
  }],

  ["ideaName: different cities read in and out", () => {
    assert.equal(ideaName({ inCode: "LHR", outCode: "MAD", airports }), "London in, Madrid out");
  }],

  ["ideaName: one side only, or nothing known", () => {
    assert.equal(ideaName({ inCode: "ATH", outCode: null, airports }), "Athens trip");
    assert.equal(ideaName({ inCode: null, outCode: null, airports }), "New route");
  }],

  ["ideaEndpoints: reads the in and out cities from an idea's home flights", () => {
    assert.deepEqual(ideaEndpoints([romeHome]), { inCode: "FCO", outCode: "FCO" });
    assert.deepEqual(ideaEndpoints([
      home({ id: "out", fromAirport: "DEN", toAirport: "LHR", outboundDate: "2026-05-15", direction: "out" }),
      home({ id: "back", fromAirport: "MAD", toAirport: "DEN", outboundDate: "2026-05-25", direction: "back" }),
    ]), { inCode: "LHR", outCode: "MAD" });
  }],

  ["optionName: hop cities other than the one you landed in", () => {
    assert.equal(optionName({ hopFlights: romeHops, arrivalCode: "FCO", airports }), "Florence + Barcelona");
  }],

  ["optionName: no hops means staying put", () => {
    assert.equal(optionName({ hopFlights: [], arrivalCode: "FCO", airports }), "Stay in Rome");
    assert.equal(optionName({ hopFlights: [], arrivalCode: "", airports }), "Stay in one place");
  }],

  ["optionAutoName: an unedited option takes the name its hops spell out", () => {
    const option = { id: "o1", name: "Option 1", nameEdited: false };
    assert.equal(optionAutoName({ option, hopFlights: romeHops, homeFlights: [romeHome], airports }), "Florence + Barcelona");
  }],

  ["optionAutoName: null for an option someone has renamed by hand", () => {
    const option = { id: "o1", name: "The cheap one", nameEdited: true };
    assert.equal(optionAutoName({ option, hopFlights: romeHops, homeFlights: [romeHome], airports }), null);
  }],

  ["optionAutoName: null when the name already reads that way, so nothing is rewritten", () => {
    const option = { id: "o1", name: "Florence + Barcelona", nameEdited: false };
    assert.equal(optionAutoName({ option, hopFlights: romeHops, homeFlights: [romeHome], airports }), null);
  }],

  ["optionAutoName: an option about to be created always gets a name", () => {
    assert.equal(optionAutoName({ option: null, hopFlights: [], homeFlights: [romeHome], airports }), "Stay in Rome");
    assert.equal(optionAutoName({ option: null, hopFlights: romeHops, homeFlights: [], airports }), "Florence + Barcelona + Rome");
  }],

  ["directionsToClear: a both-ways pick replaces every other pick", () => {
    assert.deepEqual(directionsToClear("both"), ["out", "back", "both"]);
  }],

  ["directionsToClear: a one-way pick replaces its own direction and any both-ways pick", () => {
    assert.deepEqual(directionsToClear("out"), ["out", "both"]);
    assert.deepEqual(directionsToClear("back"), ["back", "both"]);
  }],

  ["directionsToClear: a flight with no direction stands alone", () => {
    assert.deepEqual(directionsToClear(null), [null]);
  }],

  ["guessLandsDate: far enough east lands the next day, otherwise the same day", () => {
    assert.equal(guessLandsDate("DEN", "FCO", "2026-05-14", airports), "2026-05-15");
    assert.equal(guessLandsDate("FCO", "ATH", "2026-05-14", airports), "2026-05-14");
    assert.equal(guessLandsDate("FCO", "DEN", "2026-05-28", airports), "2026-05-28");
  }],

  ["guessLandsDate: no date, or an airport we don't know, changes nothing", () => {
    assert.equal(guessLandsDate("DEN", "FCO", null, airports), null);
    assert.equal(guessLandsDate("DEN", "ZZZ", "2026-05-14", airports), "2026-05-14");
  }],

  ["homeDirection: a round trip from home goes both ways", () => {
    const traveler = { id: "t1", homeAirport: "DEN", homeCity: "Denver" };
    const parsed = { fromAirport: "DEN", toAirport: "FCO", outboundDate: "2026-05-14", returnDate: "2026-05-28" };
    assert.equal(homeDirection(parsed, traveler, airports), "both");
  }],

  ["homeDirection: one-way out, one-way back, and a flight that never touches home", () => {
    const traveler = { id: "t1", homeAirport: "DEN", homeCity: "Denver" };
    assert.equal(homeDirection({ fromAirport: "DEN", toAirport: "LHR", outboundDate: "2026-05-15" }, traveler, airports), "out");
    assert.equal(homeDirection({ fromAirport: "MAD", toAirport: "DEN", outboundDate: "2026-05-25" }, traveler, airports), "back");
    assert.equal(homeDirection({ fromAirport: "FCO", toAirport: "FLR", outboundDate: "2026-05-18" }, traveler, airports), null);
  }],

  ["homeDirection: the home city counts even without a home airport", () => {
    const traveler = { id: "t1", homeAirport: "", homeCity: "Rome" };
    assert.equal(homeDirection({ fromAirport: "CIA", toAirport: "BCN", outboundDate: "2026-05-18" }, traveler, airports), "out");
  }],

  ["placePastedFlight: a round trip home flight into the idea already selected names nothing new", () => {
    const result = placePastedFlight({
      parsed: { fromAirport: "DEN", toAirport: "FCO", outboundDate: "2026-05-14", returnDate: "2026-05-28" },
      traveler: { id: "t1", homeAirport: "DEN", homeCity: "Denver" },
      ideaId: "rome",
      airports,
    });
    assert.deepEqual(result, { direction: "both", newIdeaName: null, homeAirport: null });
  }],

  ["placePastedFlight: a one-way flight to a different city still joins the idea on screen", () => {
    const result = placePastedFlight({
      parsed: { fromAirport: "DEN", toAirport: "LHR", outboundDate: "2026-05-15" },
      traveler: { id: "t1", homeAirport: "DEN", homeCity: "Denver" },
      ideaId: "rome",
      airports,
    });
    assert.deepEqual(result, { direction: "out", newIdeaName: null, homeAirport: null });
  }],

  ["placePastedFlight: with no idea yet, it names one from the flight", () => {
    const result = placePastedFlight({
      parsed: { fromAirport: "DEN", toAirport: "LHR", outboundDate: "2026-05-15" },
      traveler: { id: "t1", homeAirport: "DEN", homeCity: "Denver" },
      ideaId: null,
      airports,
    });
    assert.deepEqual(result, { direction: "out", newIdeaName: "London trip", homeAirport: null });
  }],

  ["placePastedFlight: a flight that doesn't touch a known home still guesses a direction", () => {
    const result = placePastedFlight({
      parsed: { fromAirport: "FCO", toAirport: "FLR", outboundDate: "2026-05-18" },
      traveler: { id: "t1", homeAirport: "DEN", homeCity: "Denver" },
      ideaId: "rome",
      airports,
    });
    assert.deepEqual(result, { direction: "out", newIdeaName: null, homeAirport: null });
  }],

  ["placePastedFlight: the very first flight teaches us the traveler's home airport", () => {
    const result = placePastedFlight({
      parsed: { fromAirport: "FCO", toAirport: "ATH", outboundDate: "2026-05-18", returnDate: "2026-05-25" },
      traveler: { id: "t1", homeAirport: "", homeCity: "" },
      ideaId: null,
      airports,
    });
    assert.deepEqual(result, {
      direction: "both",
      newIdeaName: "Athens round trip",
      homeAirport: "FCO",
    });
  }],

  ["placePastedFlight: a link we couldn't read places nothing", () => {
    const result = placePastedFlight({
      parsed: { fromAirport: null, toAirport: null, legs: [], error: "We couldn't read that link." },
      traveler: { id: "t1", homeAirport: "DEN" },
      ideaId: null,
      airports,
    });
    assert.deepEqual(result, { direction: null, newIdeaName: null, homeAirport: null });
  }],
];
