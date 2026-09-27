import assert from "node:assert/strict";
import { buildPlacesCsv, buildPlacesKml, slugify, placesCsvFilename, placesKmlFilename } from "../js/lib/exporters.js";

// A minimal RFC 4180 parser, used only to round-trip our own generated CSV in tests.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += char;
        i += 1;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
    } else if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 2;
    } else {
      field += char;
      i += 1;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const days = [{ id: "d1", title: "Day 1", date: "2026-06-01" }];

const places = [
  {
    name: "Time Out Market",
    category: "Food",
    neighborhood: "Cais do Sodré",
    note: "Great lunch spot",
    lat: 38.7069999,
    lng: -9.1459999,
    link: null,
    googleMapsUrl: "https://www.google.com/maps/place/x",
    votes: { u1: "must", u2: "nice" },
    dayId: "d1",
  },
  {
    name: "Belém, Tower & Café",
    category: "Sight",
    neighborhood: "",
    note: 'A "must see" spot\nwith history',
    lat: 38.6916,
    lng: -9.2159,
    link: "https://example.com/belem",
    googleMapsUrl: null,
    votes: {},
    dayId: null,
  },
  {
    name: "No Pin Place",
    category: "Other",
    neighborhood: "",
    note: "",
    lat: null,
    lng: null,
    link: null,
    googleMapsUrl: null,
    votes: {},
    dayId: null,
  },
];

export const tests = [
  ["slugify lowercases and turns non-alphanumerics into hyphens", () => {
    assert.equal(slugify("Lisbon Trip!!"), "lisbon-trip");
    assert.equal(placesCsvFilename("Lisbon Trip!!"), "lisbon-trip-places.csv");
    assert.equal(placesKmlFilename("Lisbon Trip!!"), "lisbon-trip-places.kml");
  }],
  ["buildPlacesCsv: exact header, no bare rows", () => {
    const csv = buildPlacesCsv([], []);
    assert.equal(csv, "Name,Latitude,Longitude,Category,Neighborhood,Note,Link,Ranking,Day\r\n");
  }],
  ["buildPlacesCsv: excludes places with no pin, sorts by Category then Name", () => {
    const csv = buildPlacesCsv(places, days);
    const rows = parseCsv(csv);
    const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell !== ""));
    assert.equal(dataRows.length, 2);
    assert.equal(dataRows[0][0], "Time Out Market"); // Food < Sight
    assert.equal(dataRows[1][0], "Belém, Tower & Café");
  }],
  ["buildPlacesCsv: quotes commas/quotes/newlines and round-trips through a parser", () => {
    const csv = buildPlacesCsv(places, days);
    const rows = parseCsv(csv);
    const belemRow = rows.slice(1).find((r) => r[0].startsWith("Belém"));
    assert.equal(belemRow[0], "Belém, Tower & Café");
    assert.equal(belemRow[5], 'A "must see" spot\nwith history');
    assert.equal(belemRow[6], "https://example.com/belem");
  }],
  ["buildPlacesCsv: link falls back to googleMapsUrl when link is empty", () => {
    const csv = buildPlacesCsv(places, days);
    const rows = parseCsv(csv);
    const timeOutRow = rows.slice(1).find((r) => r[0] === "Time Out Market");
    assert.equal(timeOutRow[6], "https://www.google.com/maps/place/x");
  }],
  ["buildPlacesCsv: ranking summary and day label columns", () => {
    const csv = buildPlacesCsv(places, days);
    const rows = parseCsv(csv);
    const timeOutRow = rows.slice(1).find((r) => r[0] === "Time Out Market");
    assert.equal(timeOutRow[7], "1 must · 1 nice");
    assert.equal(timeOutRow[8], "Day 1");
    const belemRow = rows.slice(1).find((r) => r[0].startsWith("Belém"));
    assert.equal(belemRow[7], "");
    assert.equal(belemRow[8], "");
  }],
  ["buildPlacesCsv: latitude/longitude rounded to up to 6 decimals", () => {
    const csv = buildPlacesCsv(places, days);
    const rows = parseCsv(csv);
    const timeOutRow = rows.slice(1).find((r) => r[0] === "Time Out Market");
    assert.equal(timeOutRow[1], "38.707");
    assert.equal(timeOutRow[2], "-9.146");
  }],
  ["buildPlacesKml: longitude first in coordinates, escapes special characters", () => {
    const kml = buildPlacesKml("Rock & Roll Trip", places, days);
    assert.match(kml, /<name>Rock &amp; Roll Trip<\/name>/);
    assert.match(kml, /<coordinates>-9.146,38.707,0<\/coordinates>/);
    assert.match(kml, /Belém, Tower &amp; Café/);
    assert.match(kml, /&quot;must see&quot;/);
  }],
  ["buildPlacesKml: one Folder per category with located places, none for empty/unlocated categories", () => {
    const kml = buildPlacesKml("Trip", places, days);
    const folderNames = [...kml.matchAll(/<Folder>\s*<name>([^<]+)<\/name>/g)].map((m) => m[1]);
    assert.deepEqual(folderNames.sort(), ["Food", "Sight"]);
  }],
];
