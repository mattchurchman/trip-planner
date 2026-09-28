// Pure: best-effort extraction of airports and dates from a pasted Google
// Flights link (§9.6). No DOM, no Firebase. Google Flights never puts prices,
// airlines or times in the link, so those are always typed by hand.
import { safeUrl } from "./links.js";

const NOT_A_LINK_ERROR = "That doesn't look like a Google Flights link.";
const SHORT_LINK_ERROR = "Short share links can't be read. Open it, then copy the full address from the browser bar.";
const COULDNT_READ_ERROR = "Couldn't read this link — fill in the details below.";

// Same shape as mapsurl.js's Google-host check (§9.3): pinned to real Google
// domains so a look-alike host like google.evil.com isn't trusted.
function isGoogleHost(hostname) {
  return /^(www\.)?google\.([a-z]{2}|com|co\.[a-z]{2}|com\.[a-z]{2})$/.test(hostname);
}

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const parsed = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === str;
}

function empty(error = null) {
  return { fromAirport: null, toAirport: null, outboundDate: null, returnDate: null, error };
}

/** Reads `?q=` in our own search-link format (§9.1): "Flights from <FROM> to
 * <TO>[ on <date>][ returning <date>]". FROM/TO count as airports only when
 * they're exactly three capital letters. */
function parseSearchQuery(q) {
  const match = q.match(/^Flights from (.+?) to (.+?)(?: on (\d{4}-\d{2}-\d{2}))?(?: returning (\d{4}-\d{2}-\d{2}))?$/);
  if (!match) return null;
  const [, from, to, outbound, ret] = match;
  return {
    fromAirport: /^[A-Z]{3}$/.test(from) ? from : null,
    toAirport: /^[A-Z]{3}$/.test(to) ? to : null,
    outboundDate: outbound || null,
    returnDate: ret || null,
    error: null,
  };
}

const DATE_RE = /\d{4}-\d{2}-\d{2}/g;
// Not a word-boundary/non-letter rule: the encoded data often puts a lowercase
// letter right after a code (e.g. "DENr"), which \b would treat as one token.
const AIRPORT_RE = /(?<![A-Z])[A-Z]{3}(?![A-Z])/g;

/** Decodes the `tfs=` parameter (base64url) and reads dates/airport codes as
 * plain text out of it, in order of appearance. Throws only on decode failure
 * (the caller turns that into the "couldn't read" error, never an exception). */
function parseTfs(tfs) {
  const padded = tfs.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const dates = [...decoded.matchAll(DATE_RE)].map((m) => m[0]).filter(isValidDate);
  const airports = [...decoded.matchAll(AIRPORT_RE)].map((m) => m[0]);
  return {
    fromAirport: airports[0] || null,
    toAirport: airports[1] || null,
    outboundDate: dates[0] || null,
    returnDate: dates[1] || null,
    error: null,
  };
}

/** Returns { fromAirport, toAirport, outboundDate, returnDate, error } per §9.6. */
export function parseFlightLink(text) {
  const safe = safeUrl(text);
  if (!safe) return empty(NOT_A_LINK_ERROR);
  const url = new URL(safe);
  const hostname = url.hostname.toLowerCase();

  // Short-link forms first (as mapsurl.js does for its analogous check): goo.gl
  // isn't a google.<tld> host, so the general check below would otherwise give
  // the generic "doesn't look like" error instead of pointing at the real fix.
  if (hostname === "goo.gl" || url.pathname.startsWith("/travel/flights/s/")) {
    return empty(SHORT_LINK_ERROR);
  }
  if (!isGoogleHost(hostname) || !url.pathname.startsWith("/travel/flights")) {
    return empty(NOT_A_LINK_ERROR);
  }

  let result = null;
  const q = url.searchParams.get("q");
  if (q) result = parseSearchQuery(q);

  if (!result) {
    const tfs = url.searchParams.get("tfs");
    if (tfs) {
      try {
        result = parseTfs(tfs);
      } catch {
        return empty(COULDNT_READ_ERROR);
      }
    }
  }

  if (!result) return empty(COULDNT_READ_ERROR);
  const foundNothing = !result.fromAirport && !result.toAirport && !result.outboundDate && !result.returnDate;
  return foundNothing ? empty(COULDNT_READ_ERROR) : result;
}
