// Pure: reads a pasted Google Flights link (SPEC §9.6). No DOM, no Firebase.
//
// Google Flights packs the whole search into the `tfs` parameter as base64url
// "protocol buffer" data (decoded by protobuf.js). Once someone has clicked
// through to specific flights, that includes every segment's airports, date,
// airline and flight number, and a second parameter, `tfu`, carries the price
// Google showed on that page. Departure/arrival times are never in the link.
//
// Field numbers below were worked out from real links the owner pasted on
// 2026-09-28 (see tests/flightlink.test.js). If Google changes its format,
// parsing falls back to the older plain-text scan, then to "couldn't read".
import { safeUrl } from "./links.js";
import { base64UrlToBytes, bytesToText, decodeMessage, all, textOf, numberOf, messageOf } from "./protobuf.js";

export const NOT_A_LINK_ERROR = "That doesn't look like a Google Flights link.";
export const SHORT_LINK_ERROR =
  "Short share links can't be read. Open it, then copy the full address from your browser's address bar and paste that.";
export const COULDNT_READ_ERROR = "Couldn't read this link — fill in the details below.";

// tfs field numbers.
const TFS_LEG = 3; //            repeated: one per direction (outbound, return)
const LEG_DATE = 2; //           "YYYY-MM-DD"
const LEG_SEGMENT = 4; //        repeated: one per flight actually taken
const LEG_ORIGIN = 13; //        { 1: kind, 2: value }
const LEG_DESTINATION = 14; //   same shape as origin
const PLACE_KIND = 1; //         1 = airport code, 2 = city ("/m/…" id)
const PLACE_VALUE = 2;
const SEG_FROM = 1;
const SEG_DATE = 2;
const SEG_TO = 3;
const SEG_AIRLINE = 5;
const SEG_FLIGHT_NUMBER = 6;
// tfu: field 1 is base64 text wrapping another message whose field 3 is the price.
const TFU_INNER = 1;
const INNER_PRICE = 3; //        { 1: amount in minor units, 2: decimal places, 3: currency }

function isGoogleHost(hostname) {
  return /^(www\.)?google\.([a-z]{2}|com|co\.[a-z]{2}|com\.[a-z]{2})$/.test(hostname);
}

function isValidDate(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const parsed = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === str;
}

const isAirport = (code) => typeof code === "string" && /^[A-Z]{3}$/.test(code);

function emptyResult(error = null) {
  return {
    fromAirport: null,
    toAirport: null,
    outboundDate: null,
    returnDate: null,
    fromPlace: null,
    toPlace: null,
    legs: [],
    outboundStops: null,
    returnStops: null,
    price: null,
    error,
  };
}

/** Our own search-link format (§9.1): "Flights from X to Y[ on D][ returning D]". */
function parseSearchQuery(q) {
  const match = q.match(/^Flights from (.+?) to (.+?)(?: on (\d{4}-\d{2}-\d{2}))?(?: returning (\d{4}-\d{2}-\d{2}))?$/);
  if (!match) return null;
  const [, from, to, outbound, ret] = match;
  const result = emptyResult();
  result.fromAirport = isAirport(from) ? from : null;
  result.toAirport = isAirport(to) ? to : null;
  result.outboundDate = outbound || null;
  result.returnDate = ret || null;
  return result;
}

function readPlace(entries) {
  if (!entries) return { airport: null, placeId: null };
  const kind = numberOf(entries, PLACE_KIND);
  const value = textOf(entries, PLACE_VALUE);
  if (kind === 1 && isAirport(value)) return { airport: value, placeId: null };
  return { airport: null, placeId: value || null };
}

function readSegment(entries) {
  const segment = {
    from: textOf(entries, SEG_FROM),
    to: textOf(entries, SEG_TO),
    date: textOf(entries, SEG_DATE),
    airline: textOf(entries, SEG_AIRLINE),
    flightNumber: textOf(entries, SEG_FLIGHT_NUMBER),
  };
  if (!isAirport(segment.from) || !isAirport(segment.to)) return null;
  if (!isValidDate(segment.date)) segment.date = null;
  if (!/^[A-Z0-9]{2}$/.test(segment.airline || "")) segment.airline = null;
  if (!/^\d{1,4}$/.test(segment.flightNumber || "")) segment.flightNumber = null;
  return segment;
}

function readLeg(entries) {
  const segments = all(entries, LEG_SEGMENT)
    .map((e) => {
      try {
        return readSegment(decodeMessage(e.value));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const origin = readPlace(messageOf(entries, LEG_ORIGIN));
  const destination = readPlace(messageOf(entries, LEG_DESTINATION));
  const date = textOf(entries, LEG_DATE);
  return {
    date: isValidDate(date) ? date : null,
    from: segments.length ? segments[0].from : origin.airport,
    to: segments.length ? segments[segments.length - 1].to : destination.airport,
    fromPlaceId: origin.placeId,
    toPlaceId: destination.placeId,
    segments,
  };
}

/** `tcfs` (present on some links) maps "/m/…" city ids to names. */
function readPlaceNames(tcfs) {
  const names = new Map();
  if (!tcfs) return names;
  try {
    for (const entry of decodeMessage(base64UrlToBytes(tcfs))) {
      if (entry.type !== "bytes") continue;
      let inner;
      try {
        inner = decodeMessage(entry.value);
      } catch {
        continue;
      }
      const id = textOf(inner, 1);
      const name = [textOf(inner, 2), textOf(inner, 3)].find((t) => t && /^[^/\u0000-\u001f]+$/.test(t) && !isValidDate(t));
      if (id && id.startsWith("/m/") && name) names.set(id, name);
    }
  } catch {
    // Names are a nicety; ignore anything unreadable.
  }
  return names;
}

/** The price Google showed when the link was copied: { amountCents, currency } or null. */
export function readLinkPrice(tfu) {
  if (!tfu) return null;
  try {
    const outer = decodeMessage(base64UrlToBytes(tfu));
    const innerText = textOf(outer, TFU_INNER);
    if (!innerText) return null;
    const inner = decodeMessage(base64UrlToBytes(innerText));
    const price = messageOf(inner, INNER_PRICE);
    if (!price) return null;
    const amount = numberOf(price, 1);
    const decimals = numberOf(price, 2) ?? 2;
    const currency = textOf(price, 3);
    if (!amount || amount <= 0 || !/^[A-Z]{3}$/.test(currency || "") || decimals < 0 || decimals > 4) return null;
    const amountCents = Math.round(amount * 10 ** (2 - decimals));
    return amountCents > 0 ? { amountCents, currency } : null;
  } catch {
    return null;
  }
}

function parseTfsProtobuf(tfs, tcfs) {
  const top = decodeMessage(base64UrlToBytes(tfs));
  const legs = all(top, TFS_LEG).map((e) => readLeg(decodeMessage(e.value)));
  if (legs.length === 0) return null;
  const names = readPlaceNames(tcfs);
  const [outbound, ret] = legs;
  const result = emptyResult();
  result.legs = legs;
  result.fromAirport = outbound.from;
  result.toAirport = outbound.to;
  result.outboundDate = outbound.date;
  result.returnDate = ret ? ret.date : null;
  result.fromPlace = names.get(outbound.fromPlaceId) || null;
  result.toPlace = names.get(outbound.toPlaceId) || null;
  result.outboundStops = outbound.segments.length ? outbound.segments.length - 1 : null;
  result.returnStops = ret && ret.segments.length ? ret.segments.length - 1 : null;
  return result;
}

// Fallback for links the structured reader can't make sense of: dates and
// airport codes read as plain text, in order of appearance. The airport rule
// isn't a word boundary because codes are often followed by a lowercase byte.
function parseTfsText(tfs) {
  const decoded = bytesToText(base64UrlToBytes(tfs));
  const dates = [...decoded.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]).filter(isValidDate);
  const airports = [...decoded.matchAll(/(?<![A-Z])[A-Z]{3}(?![A-Z])/g)].map((m) => m[0]);
  const result = emptyResult();
  result.fromAirport = airports[0] || null;
  result.toAirport = airports[1] || null;
  result.outboundDate = dates[0] || null;
  result.returnDate = dates[1] || null;
  return result;
}

const foundNothing = (r) => !r.fromAirport && !r.toAirport && !r.outboundDate && !r.returnDate && !r.fromPlace && !r.toPlace;

/**
 * Returns {
 *   fromAirport, toAirport, outboundDate, returnDate,   // strings or null
 *   fromPlace, toPlace,                                 // city names when the link only has cities
 *   legs: [{ date, from, to, segments: [{ from, to, date, airline, flightNumber }] }],
 *   outboundStops, returnStops,                         // numbers, or null when unknown
 *   price: { amountCents, currency } | null,           // what Google showed; the user confirms it
 *   error                                               // null, or a message to show
 * }
 */
export function parseFlightLink(text) {
  const safe = safeUrl(text);
  if (!safe) return emptyResult(NOT_A_LINK_ERROR);
  const url = new URL(safe);
  const hostname = url.hostname.toLowerCase();

  if (hostname === "goo.gl" || url.pathname.startsWith("/travel/flights/s/")) return emptyResult(SHORT_LINK_ERROR);
  if (!isGoogleHost(hostname) || !url.pathname.startsWith("/travel/flights")) return emptyResult(NOT_A_LINK_ERROR);

  let result = null;
  const q = url.searchParams.get("q");
  if (q) result = parseSearchQuery(q);

  const tfs = url.searchParams.get("tfs");
  if (!result && tfs) {
    try {
      result = parseTfsProtobuf(tfs, url.searchParams.get("tcfs"));
    } catch {
      result = null;
    }
    if (!result || foundNothing(result)) {
      try {
        result = parseTfsText(tfs);
      } catch {
        return emptyResult(COULDNT_READ_ERROR);
      }
    }
  }

  if (!result || foundNothing(result)) return emptyResult(COULDNT_READ_ERROR);
  result.price = readLinkPrice(url.searchParams.get("tfu"));
  return result;
}

/** Stops as words: 0 -> "Nonstop", 1 -> "1 stop", 2 -> "2 stops", null -> null. */
export function stopsLabel(stops) {
  if (stops == null) return null;
  return stops === 0 ? "Nonstop" : `${stops} stop${stops === 1 ? "" : "s"}`;
}

/** A leg's airports in order, e.g. ["JFK", "SFO", "NAN", "AKL", "CHC"]. */
export function legRoute(leg) {
  if (!leg || !leg.segments || leg.segments.length === 0) return [leg && leg.from, leg && leg.to].filter(Boolean);
  return [leg.segments[0].from, ...leg.segments.map((s) => s.to)];
}
