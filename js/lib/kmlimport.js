// Pure: reads a My Maps KML export into layers and pins (T26, V4 §6). Plain
// string/regex parsing, not DOMParser, so it runs in Node tests too. No DOM,
// no Firebase.

import { cleanNoteText } from "./notes.js";

const EARTH_RADIUS_M = 6371000;

export const KMZ_MESSAGE =
  'This looks like a KMZ file. In My Maps, use ⋮ → Export to KML/KMZ and tick "Export as KML instead of KMZ", then pick that file instead.';

function decodeEntities(text) {
  return String(text ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Decodes a KML text node: a CDATA block verbatim, or entity-escaped plain text. */
function decodeText(raw) {
  if (raw == null) return "";
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/);
  return (cdata ? cdata[1] : decodeEntities(raw)).trim();
}

function extractTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`));
  return match ? decodeText(match[1]) : "";
}

/** One `<Placemark>`'s pin, or `null` for a line/shape (no `<Point>`) or a pin with no usable coordinates. */
function parsePlacemark(xml) {
  const pointMatch = xml.match(/<Point[^>]*>([\s\S]*?)<\/Point>/);
  if (!pointMatch) return null; // LineString/Polygon: a route line or shape, not a pin.
  const coordsText = extractTag(pointMatch[1], "coordinates");
  const parts = coordsText.split(",").map((part) => Number(part.trim()));
  const [lng, lat] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    name: extractTag(xml, "name"),
    lat,
    lng,
    note: cleanNoteText(extractTag(xml, "description")),
  };
}

function parsePlacemarks(xml) {
  return [...xml.matchAll(/<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g)]
    .map((m) => parsePlacemark(m[1]))
    .filter(Boolean);
}

/**
 * Reads a My Maps KML export. Resolves `{ layers, error }`: on success
 * `layers` is `[{ name, pins: [{ name, lat, lng, note }] }]`, one per
 * `<Folder>` (its own `<name>`) plus, when any `<Placemark>` sits outside a
 * folder, a trailing `{ name: "", pins }` group for those. Lines and shapes
 * (no `<Point>`) are skipped. A KMZ file (binary, starts with "PK") resolves
 * `{ layers: [], error: KMZ_MESSAGE }` instead of being parsed.
 */
export function parseKml(text) {
  if (typeof text === "string" && text.startsWith("PK")) {
    return { layers: [], error: KMZ_MESSAGE };
  }

  const source = String(text ?? "");
  const documentMatch = source.match(/<Document[^>]*>([\s\S]*)<\/Document>/);
  const documentXml = documentMatch ? documentMatch[1] : source;

  const layers = [];
  let rest = documentXml;
  for (const match of documentXml.matchAll(/<Folder[^>]*>([\s\S]*?)<\/Folder>/g)) {
    const folderXml = match[1];
    layers.push({ name: extractTag(folderXml, "name"), pins: parsePlacemarks(folderXml) });
    rest = rest.replace(match[0], "");
  }

  const unfiledPins = parsePlacemarks(rest);
  if (unfiledPins.length > 0) layers.push({ name: "", pins: unfiledPins });

  return { layers, error: null };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Which of `pins` already exist among `places` (T26): same name, ignoring
 * case, and within 50 meters. Returns a parallel array of booleans.
 */
export function findDuplicates(pins, places) {
  return (pins || []).map((pin) => {
    const pinName = String(pin.name || "").trim().toLowerCase();
    return (places || []).some((place) => {
      if (String(place.name || "").trim().toLowerCase() !== pinName) return false;
      if (place.lat == null || place.lng == null || pin.lat == null || pin.lng == null) return false;
      return haversineMeters(pin.lat, pin.lng, place.lat, place.lng) <= 50;
    });
  });
}
