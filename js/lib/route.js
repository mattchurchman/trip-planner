// Route logic (V4 §4.4 and §4.5): flights in, stops / nights / totals / names out.
// Pure functions only — no DOM, no Firestore. The airport index (js/lib/airports.js)
// is always passed in, so nothing here loads data of its own.
//
// Flight docs and `parseFlightLink` results share their field names
// (fromAirport, toAirport, outboundDate, returnDate, legs), so the movement
// helpers below work on either one.

import { legRoute } from "./flightlink.js";
import { nightsBetween } from "./dates.js";
import { latestEntry } from "./totals.js";

// Sorts after every real "YYYY-MM-DD", so undated flights land at the end.
const UNDATED = "￿";

const DATES_BACKWARDS = "These dates overlap. Check the flight before and after this stop.";
const NO_DATE = "This flight has no date yet. Add one to work out the nights.";

function code(value) {
  return String(value || "").trim().toUpperCase();
}

function cityLabel(airportCode, airports) {
  const c = code(airportCode);
  return c ? String(airports.cityName(c) || c) : "";
}

/** True when both codes are known and sit in different cities (FCO and CIA don't). */
function differentCity(a, b, airports) {
  const left = code(a);
  const right = code(b);
  if (!left || !right) return false;
  return airports.cityKey(left) !== airports.cityKey(right);
}

/**
 * One flight's legs as movements `{ from, to, date, flightId }`.
 * A round trip is two: the second one is built from `returnDate` when the link
 * only gave us one leg.
 */
function flightMovements(flight) {
  if (!flight) return [];
  const flightId = flight.id || null;
  const legs = Array.isArray(flight.legs) ? flight.legs : [];
  const found = [];

  legs.forEach((leg, i) => {
    const route = legRoute(leg);
    const from = code(route[0] || (i === 0 ? flight.fromAirport : flight.toAirport));
    const to = code(route[route.length - 1] || (i === 0 ? flight.toAirport : flight.fromAirport));
    const segmentDate = leg && leg.segments && leg.segments[0] ? leg.segments[0].date : null;
    const date = leg.date || segmentDate || (i === 0 ? flight.outboundDate : flight.returnDate) || null;
    if (from || to) found.push({ from, to, date, flightId });
  });

  if (found.length === 0) {
    const from = code(flight.fromAirport);
    const to = code(flight.toAirport);
    if (from || to) found.push({ from, to, date: flight.outboundDate || null, flightId });
  }
  if (found.length === 1 && flight.returnDate) {
    const there = found[0];
    found.push({ from: there.to, to: there.from, date: flight.returnDate, flightId });
  }
  return found;
}

/** Every hop in an option as movements, earliest first, undated ones last. */
export function movements(hopFlights) {
  const all = [];
  for (const flight of hopFlights || []) all.push(...flightMovements(flight));
  const key = (movement) => movement.date || UNDATED;
  return all.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

// A home flight counts unless `picked` is false, so a caller may also hand us a
// list it has already filtered.
const isPicked = (flight) => Boolean(flight) && flight.picked !== false;

/** The leg that takes you to the region, for a home flight going out. */
function outboundLegOf(flight) {
  if (!flight || (flight.direction !== "both" && flight.direction !== "out")) return null;
  return flightMovements(flight)[0] || null;
}

/** The leg that takes you home. A "both" flight needs its second leg for this. */
function homewardLegOf(flight) {
  if (!flight) return null;
  const legs = flightMovements(flight);
  if (flight.direction === "back") return legs[0] || null;
  if (flight.direction === "both") return legs.length > 1 ? legs[legs.length - 1] : null;
  return null;
}

/** Where and when the traveler lands, from their picked home flights. */
function arrivalOf(homeFlights) {
  for (const flight of (homeFlights || []).filter(isPicked)) {
    const leg = outboundLegOf(flight);
    if (leg) return { code: leg.to, date: flight.landsDate || leg.date || null };
  }
  return null;
}

/** Where and when the traveler leaves for home, from their picked home flights. */
function departureOf(homeFlights) {
  for (const flight of (homeFlights || []).filter(isPicked)) {
    const leg = homewardLegOf(flight);
    if (leg) return { code: leg.from, date: leg.date || null };
  }
  return null;
}

/** The city you fly into and the city you fly home from, for one idea's home flights. */
export function ideaEndpoints(homeFlights) {
  const flights = homeFlights || [];
  let inCode = null;
  let outCode = null;
  for (const flight of flights) {
    const out = outboundLegOf(flight);
    if (out && !inCode) inCode = out.to;
    const back = homewardLegOf(flight);
    if (back && !outCode) outCode = back.from;
  }
  return { inCode, outCode };
}

function newStop(airportCode, from, airports) {
  const c = code(airportCode);
  return {
    cityKey: c ? airports.cityKey(c) : "",
    city: cityLabel(c, airports),
    code: c,
    from: from || null,
    to: null,
    nights: null,
    warnings: [],
  };
}

/** Nights between two dates: 0 for a same-day stop, null when we can't tell. */
function nightsFor(from, to) {
  if (!from || !to) return null;
  const nights = nightsBetween(from, to);
  if (nights !== null) return nights;
  return from === to ? 0 : null;
}

function closeStop(stop, to) {
  stop.to = to || null;
  stop.nights = nightsFor(stop.from, stop.to);
  if (stop.from && stop.to && stop.to < stop.from) stop.warnings.push(DATES_BACKWARDS);
}

/**
 * Every stop for one traveler (V4 §4.4): where they sleep and for how many nights,
 * worked out from their picked home flights plus the option's hops. Never typed.
 * Each stop carries its own plain-language warnings.
 */
export function stopsFor({ homeFlights, hopFlights, airports }) {
  const hops = movements(hopFlights);
  const arrival = arrivalOf(homeFlights);
  const departure = departureOf(homeFlights);
  const start = arrival || (hops.length ? { code: hops[0].from, date: null } : null);
  if (!start) return [];

  const stops = [];
  let open = newStop(start.code, start.date, airports);
  if (arrival && !arrival.date) open.warnings.push(NO_DATE);

  for (const hop of hops) {
    if (differentCity(hop.from, open.code, airports)) {
      open.warnings.push(`Your next flight leaves from ${cityLabel(hop.from, airports)}, but you're in ${open.city}.`);
    }
    if (!hop.date) open.warnings.push(NO_DATE);
    closeStop(open, hop.date);
    stops.push(open);
    open = newStop(hop.to, hop.date, airports);
  }

  if (departure) {
    if (differentCity(departure.code, open.code, airports)) {
      open.warnings.push(`Your flight home leaves from ${cityLabel(departure.code, airports)}, but you're in ${open.city}.`);
    }
    if (!departure.date) open.warnings.push(NO_DATE);
    closeStop(open, departure.date);
  }
  stops.push(open);
  return stops;
}

/**
 * What this option costs one traveler: the latest price of each picked home
 * flight plus the latest price of every hop. `complete` is false whenever a
 * price is missing (show it as "at least $X") or nothing is picked yet.
 */
export function totalFor({ homeFlights, hopFlights }) {
  const counted = [...(homeFlights || []).filter(isPicked), ...(hopFlights || [])];
  let cents = 0;
  let complete = counted.length > 0;
  for (const flight of counted) {
    const latest = latestEntry(flight && flight.prices);
    if (!latest || typeof latest.amountCents !== "number") complete = false;
    else cents += latest.amountCents;
  }
  return { cents, complete };
}

/**
 * The name an idea gets until someone edits it: "Rome round trip" when you fly
 * in and out of the same city, "London in, Madrid out" when you don't.
 */
export function ideaName({ inCode, outCode, airports }) {
  const into = cityLabel(inCode, airports);
  const back = cityLabel(outCode, airports);
  if (into && back) {
    return differentCity(inCode, outCode, airports) ? `${into} in, ${back} out` : `${into} round trip`;
  }
  if (into && !back) return `${into} trip`;
  if (back) return `${back} trip`;
  return "New route";
}

/**
 * The name an option gets until someone edits it: the hop cities other than the
 * city you landed in, joined with " + ", or "Stay in Rome" when there are no hops.
 */
export function optionName({ hopFlights, arrivalCode, airports }) {
  const arrivalKey = code(arrivalCode) ? airports.cityKey(code(arrivalCode)) : null;
  const seen = new Set();
  const names = [];
  for (const hop of movements(hopFlights)) {
    const label = cityLabel(hop.to, airports);
    if (!label) continue;
    const key = airports.cityKey(hop.to);
    if (key === arrivalKey || seen.has(key)) continue;
    seen.add(key);
    names.push(label);
  }
  if (names.length) return names.join(" + ");
  const base = cityLabel(arrivalCode, airports);
  return base ? `Stay in ${base}` : "Stay in one place";
}

/**
 * The auto name an option should be carrying now (V4 §4.4), or `null` to leave
 * it alone — someone has renamed it by hand, or it already reads that way.
 * Pass `option: null` for one about to be created: it always takes the auto name.
 * `homeFlights` are the idea's home flights, which say which city you land in.
 */
export function optionAutoName({ option, hopFlights, homeFlights, airports }) {
  if (option && option.nameEdited) return null;
  const name = optionName({ hopFlights, arrivalCode: ideaEndpoints(homeFlights).inCode, airports });
  return option && option.name === name ? null : name;
}

/**
 * The direction groups a newly picked home flight has to clear (V4 §4.4):
 * picking a "both" flight replaces any separate out/back picks and vice versa,
 * since they can't both be the way you get there. A flight with no resolved
 * direction (null) stands alone — nothing to clear.
 */
export function directionsToClear(direction) {
  if (direction === "both") return ["out", "back", "both"];
  if (direction === "out" || direction === "back") return [direction, "both"];
  return [direction];
}

/**
 * The day you land, guessed: more than 60° of longitude east of where you took
 * off means the day after departure, otherwise the same day. Always editable.
 */
export function guessLandsDate(fromCode, toCode, date, airports) {
  if (!date) return null;
  const from = airports.info(code(fromCode));
  const to = airports.info(code(toCode));
  if (typeof from === "string" || typeof to === "string") return date;
  if (to.lng - from.lng <= 60) return date;
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) return date;
  return new Date(ms + 86400000).toISOString().slice(0, 10);
}

/** True when this airport is the traveler's home airport or home city. */
function isHome(airportCode, traveler, airports) {
  const c = code(airportCode);
  if (!c) return false;
  const home = code(traveler && traveler.homeAirport);
  if (home && airports.cityKey(c) === airports.cityKey(home)) return true;
  const homeCity = String((traveler && traveler.homeCity) || "").trim().toLowerCase();
  if (!homeCity) return false;
  return cityLabel(c, airports).toLowerCase() === homeCity;
}

/**
 * Is this pasted link a flight from home, and which way does it go?
 * "both" = there and back, "out" = to the region, "back" = home again,
 * null = it never touches home, so it's a hop.
 */
export function homeDirection(parsed, traveler, airports) {
  const legs = flightMovements(parsed);
  if (legs.length === 0) return null;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const leaves = isHome(first.from, traveler, airports);
  const returns = isHome(last.to, traveler, airports);
  if (leaves && returns && legs.length > 1) return "both";
  if (leaves) return "out";
  if (returns) return "back";
  if (legs.some((leg) => isHome(leg.from, traveler, airports))) return "out";
  if (legs.some((leg) => isHome(leg.to, traveler, airports))) return "back";
  return null;
}

/** The in and out cities of a pasted link, read the way `direction` says to. */
function endpointsFor(legs, direction) {
  if (legs.length === 0) return { inCode: null, outCode: null };
  const first = legs[0];
  const last = legs[legs.length - 1];
  if (direction === "out") return { inCode: last.to, outCode: null };
  if (direction === "back") return { inCode: null, outCode: first.from };
  return { inCode: first.to, outCode: last.from };
}

/** A direction to fall back on when the flight doesn't touch a known home
 * airport or city: "both" for a link that comes back to where it started,
 * otherwise "out". */
function guessDirection(legs, airports) {
  const last = legs[legs.length - 1];
  return legs.length > 1 && !differentCity(last.to, legs[0].from, airports) ? "both" : "out";
}

/**
 * Where a flight pasted into the home-flights card lands (V4 §4.5): the
 * direction it goes (out/back/both) for the traveler on screen, and — only
 * when `ideaId` is null, because there's no idea to select yet — the name a
 * new idea takes and the home airport to learn, when the traveler doesn't
 * have one. Which idea and traveler a home flight joins, and which option a
 * hop joins, is the screen's call: the button pressed already says so, so
 * there's no `role` to work out here.
 */
export function placePastedFlight({ parsed, traveler, ideaId, airports }) {
  const legs = flightMovements(parsed);
  if (legs.length === 0) return { direction: null, newIdeaName: null, homeAirport: null };

  const direction = homeDirection(parsed, traveler, airports) || guessDirection(legs, airports);
  if (ideaId) return { direction, newIdeaName: null, homeAirport: null };

  const ends = endpointsFor(legs, direction);
  return {
    direction,
    newIdeaName: ideaName({ ...ends, airports }),
    homeAirport: code(traveler && traveler.homeAirport) ? null : legs[0].from || null,
  };
}
