// Pure: read a trip's shared Google My Maps link. See SPEC.md §9.10.
import { safeUrl } from "./links.js";

const MID_RE = /^[A-Za-z0-9_-]{10,}$/;

/** Returns { mid, url, viewUrl, kmlUrl } for a Google My Maps link, or null
 * when it isn't one (including a plain Google Maps place link, which has no
 * `/maps/d/` path). `url` is the pasted link after `safeUrl()`. */
export function parseMyMapsUrl(text) {
  const normalized = safeUrl(text);
  if (!normalized) return null;
  let url;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "google.com" && hostname !== "www.google.com") return null;
  if (!url.pathname.includes("/maps/d/")) return null;

  const mid = url.searchParams.get("mid");
  if (!mid || !MID_RE.test(mid)) return null;

  return {
    mid,
    url: normalized,
    viewUrl: `https://www.google.com/maps/d/viewer?mid=${mid}`,
    kmlUrl: `https://www.google.com/maps/d/kml?mid=${mid}&forcekml=1`,
  };
}

/** True for a short share link (`maps.app.goo.gl/…`, `goo.gl/maps/…`) that
 * can't be read without fetching it (§2) — the caller asks for the full
 * address-bar link instead. */
export function isShortMapsLink(text) {
  const normalized = safeUrl(text);
  if (!normalized) return false;
  let url;
  try {
    url = new URL(normalized);
  } catch {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "maps.app.goo.gl") return true;
  if (hostname === "goo.gl" && url.pathname.startsWith("/maps/")) return true;
  return false;
}
