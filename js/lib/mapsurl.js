// Pure: read coordinates and names from Google Maps URLs. See SPEC.md §9.3.
import { safeUrl } from "./links.js";

function isGoogleHost(hostname) {
  if (hostname === "google.com" || hostname === "www.google.com" || hostname === "maps.google.com") return true;
  return /^(www\.)?google\.[a-z.]+$/.test(hostname);
}

function extractName(url) {
  const match = url.pathname.match(/\/place\/([^/]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1].replace(/\+/g, " "));
}

function validated(latStr, lngStr) {
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function extractCoordinates(url) {
  const dataMatch = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataMatch) return validated(dataMatch[1], dataMatch[2]);

  const queryParam = url.searchParams.get("query") || url.searchParams.get("q");
  if (queryParam) {
    const match = queryParam.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (match) return validated(match[1], match[2]);
  }

  const atMatch = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/);
  if (atMatch) return validated(atMatch[1], atMatch[2]);

  return null;
}

/** Returns { lat, lng, name, error } per SPEC.md §9.3's priority order and checks. */
export function parseGoogleMapsUrl(text) {
  const normalized = safeUrl(text);
  if (!normalized) {
    return { lat: null, lng: null, name: null, error: "That doesn't look like a Google Maps link." };
  }
  const url = new URL(normalized);
  const hostname = url.hostname.toLowerCase();

  if (hostname === "maps.app.goo.gl" || hostname === "goo.gl") {
    return {
      lat: null,
      lng: null,
      name: null,
      error:
        "Short share links can't be read here. Open the link, copy the full address from the browser bar, and paste that instead — or use Search or Place on map.",
    };
  }

  if (!isGoogleHost(hostname)) {
    return { lat: null, lng: null, name: null, error: "That doesn't look like a Google Maps link." };
  }

  const name = extractName(url);
  const coords = extractCoordinates(url);
  if (!coords) {
    return { lat: null, lng: null, name, error: "No location in this link — use Search or Place on map." };
  }
  return { lat: coords.lat, lng: coords.lng, name, error: null };
}
