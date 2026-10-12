// Pure: CSV and KML export for Google My Maps. See SPEC.md §10. No DOM, no Firebase.
import { voteSummary } from "./votes.js";
import { safeUrl } from "./links.js";

/** Lowercase, non-alphanumerics become "-", with leading/trailing "-" trimmed. */
export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function placesCsvFilename(tripName) {
  return `${slugify(tripName)}-places.csv`;
}

export function placesKmlFilename(tripName) {
  return `${slugify(tripName)}-places.kml`;
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function dayLabelFor(place, daysById) {
  const day = place.dayId ? daysById[place.dayId] : null;
  if (!day) return "";
  return day.title || day.date || "";
}

/** Located places only, as export rows, sorted by Category then Name (§10.1). */
function exportableRows(places, days) {
  const daysById = Object.fromEntries((days || []).map((d) => [d.id, d]));
  const rows = (places || [])
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      name: p.name,
      lat: round6(p.lat),
      lng: round6(p.lng),
      category: p.category,
      neighborhood: p.neighborhood || "",
      note: p.note || "",
      link: safeUrl(p.link) || safeUrl(p.googleMapsUrl) || "",
      ranking: voteSummary(p.votes || {}),
      day: dayLabelFor(p, daysById),
    }));
  rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return rows;
}

/** Excludes places without coordinates; use with the "left out" count shown before download. */
export function locatedCount(places) {
  return (places || []).filter((p) => p.lat != null && p.lng != null).length;
}

const CSV_HEADER = ["Name", "Latitude", "Longitude", "Category", "Neighborhood", "Note", "Link", "Ranking", "Day"];

function csvField(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** RFC 4180 CSV, UTF-8, no BOM, \r\n line endings, columns per §10.1. */
export function buildPlacesCsv(places, days) {
  const rows = exportableRows(places, days);
  const lines = [CSV_HEADER];
  for (const row of rows) {
    lines.push([row.name, row.lat, row.lng, row.category, row.neighborhood, row.note, row.link, row.ranking, row.day]);
  }
  return lines.map((line) => line.map(csvField).join(",")).join("\r\n") + "\r\n";
}

function xmlEscape(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** KML 2.2, one Folder per category with located places, longitude first (§10.2). */
export function buildPlacesKml(tripName, places, days) {
  const rows = exportableRows(places, days);
  const byCategory = new Map();
  for (const row of rows) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category).push(row);
  }

  const folders = [...byCategory.entries()]
    .map(([category, categoryRows]) => {
      const placemarks = categoryRows
        .map((row) => {
          const description = [row.neighborhood, row.note, row.link, row.ranking].filter(Boolean).map(xmlEscape).join("\n");
          return [
            "    <Placemark>",
            `      <name>${xmlEscape(row.name)}</name>`,
            `      <description>${description}</description>`,
            `      <Point><coordinates>${row.lng},${row.lat},0</coordinates></Point>`,
            "    </Placemark>",
          ].join("\n");
        })
        .join("\n");
      return [`  <Folder>`, `    <name>${xmlEscape(category)}</name>`, placemarks, `  </Folder>`].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    "<Document>",
    `  <name>${xmlEscape(tripName)}</name>`,
    folders,
    "</Document>",
    "</kml>",
    "",
  ].join("\n");
}

function dayFormatLabel(day) {
  if (!day.date) return day.title || "Untitled day";
  const date = new Date(day.date + "T00:00:00Z");
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()];
  const monthDay = date.getUTCDate();
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()];
  const title = day.title ? ` · ${day.title}` : "";
  return `${weekday} ${monthDay} ${month}${title}`;
}

/** KML 2.2, one Folder per day with places, one Stays folder, one Not planned folder. */
export function buildTripKml(tripName, places, days, chosenStays) {
  const daysById = Object.fromEntries((days || []).map((d) => [d.id, d]));
  const stayIds = new Set((chosenStays || []).map((s) => s.id));

  const dayFolders = (days || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((day) => {
      const dayPlaces = (places || []).filter((p) => p.lat != null && p.lng != null && p.dayId === day.id);
      if (dayPlaces.length === 0) return null;

      const placemarks = dayPlaces
        .map((p) => {
          const description = [p.neighborhood, p.note, safeUrl(p.link) || safeUrl(p.googleMapsUrl) || "", voteSummary(p.votes || {})]
            .filter(Boolean)
            .map(xmlEscape)
            .join("\n");
          return [
            "    <Placemark>",
            `      <name>${xmlEscape(p.name)}</name>`,
            `      <description>${description}</description>`,
            `      <Point><coordinates>${round6(p.lng)},${round6(p.lat)},0</coordinates></Point>`,
            "    </Placemark>",
          ].join("\n");
        })
        .join("\n");

      const folderName = dayFormatLabel(day);
      return [`  <Folder>`, `    <name>${xmlEscape(folderName)}</name>`, placemarks, `  </Folder>`].join("\n");
    })
    .filter(Boolean);

  const staysFolder = (chosenStays || [])
    .filter((s) => s.lat != null && s.lng != null)
    .map((stay) => {
      const dates = [stay.checkIn, stay.checkOut].filter(Boolean).join(" → ") || "";
      const description = [dates, safeUrl(stay.link) || ""].filter(Boolean).map(xmlEscape).join("\n");
      return [
        "    <Placemark>",
        `      <name>${xmlEscape(stay.name)}</name>`,
        `      <description>${description}</description>`,
        `      <Point><coordinates>${round6(stay.lng)},${round6(stay.lat)},0</coordinates></Point>`,
        "    </Placemark>",
      ].join("\n");
    })
    .join("\n");

  const staysFolderText = staysFolder
    ? [`  <Folder>`, `    <name>Stays</name>`, staysFolder, `  </Folder>`].join("\n")
    : null;

  const unplannedPlaces = (places || [])
    .filter((p) => p.lat != null && p.lng != null && p.dayId == null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const unplannedMarks = unplannedPlaces
    .map((p) => {
      const description = [p.neighborhood, p.note, safeUrl(p.link) || safeUrl(p.googleMapsUrl) || "", voteSummary(p.votes || {})]
        .filter(Boolean)
        .map(xmlEscape)
        .join("\n");
      return [
        "    <Placemark>",
        `      <name>${xmlEscape(p.name)}</name>`,
        `      <description>${description}</description>`,
        `      <Point><coordinates>${round6(p.lng)},${round6(p.lat)},0</coordinates></Point>`,
        "    </Placemark>",
      ].join("\n");
    })
    .join("\n");

  const unplannedFolderText = unplannedPlaces.length > 0
    ? [`  <Folder>`, `    <name>Not planned</name>`, unplannedMarks, `  </Folder>`].join("\n")
    : [`  <Folder>`, `    <name>Not planned</name>`, `  </Folder>`].join("\n");

  const allFolders = [...dayFolders, staysFolderText, unplannedFolderText].filter(Boolean).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    "<Document>",
    `  <name>${xmlEscape(tripName)}</name>`,
    allFolders,
    "</Document>",
    "</kml>",
    "",
  ].join("\n");
}
