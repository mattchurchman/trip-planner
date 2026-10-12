import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseKml, findDuplicates, KMZ_MESSAGE } from "../js/lib/kmlimport.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const sampleKml = readFileSync(path.join(fixturesDir, "sample.kml"), "utf8");
const ownerKml = readFileSync(path.join(fixturesDir, "owner-trip.kml"), "utf8");

export const tests = [
  ["parseKml: one layer per Folder, plus a trailing unfiled group", () => {
    const { layers, error } = parseKml(sampleKml);
    assert.equal(error, null);
    assert.deepEqual(layers.map((l) => l.name), ["Food & Drink", "Sights", ""]);
  }],

  ["parseKml: reads name, coordinates (lng,lat order) and note, decoding CDATA", () => {
    const { layers } = parseKml(sampleKml);
    const [pin] = layers[0].pins.filter((p) => p.name.includes("Café"));
    assert.equal(pin.name, 'Café "Central"');
    assert.equal(pin.lat, 38.7077);
    assert.equal(pin.lng, -9.1393);
    assert.equal(pin.note, "Great pastéis de nata");
  }],

  ["parseKml: decodes escaped entities in text nodes", () => {
    const { layers } = parseKml(sampleKml);
    const pin = layers[1].pins.find((p) => p.name === "Belem Tower");
    assert.equal(pin.note, "<b>Iconic</b> & historic");
  }],

  ["parseKml: skips a LineString (route), keeping only the pin in that folder", () => {
    const { layers } = parseKml(sampleKml);
    assert.equal(layers[0].pins.length, 1);
    assert.ok(!layers[0].pins.some((p) => p.name === "Riverside Walk"));
  }],

  ["parseKml: a Placemark outside any Folder lands in the unfiled group", () => {
    const { layers } = parseKml(sampleKml);
    const unfiled = layers.find((l) => l.name === "");
    assert.equal(unfiled.pins.length, 1);
    assert.equal(unfiled.pins[0].name, "Unfiled Pin");
  }],

  ["parseKml: a KMZ file (binary, starts with PK) returns the KMZ message and no layers", () => {
    const { layers, error } = parseKml("PK whatever binary bytes");
    assert.equal(error, KMZ_MESSAGE);
    assert.deepEqual(layers, []);
  }],

  ["parseKml: the owner's real My Maps export", () => {
    const { layers, error } = parseKml(ownerKml);
    assert.equal(error, null);
    assert.equal(layers.length, 1);
    assert.equal(layers[0].name, "Food");
    assert.equal(layers[0].pins.length, 1);
    assert.equal(layers[0].pins[0].name, "Cafe Portugal");
    assert.equal(layers[0].pins[0].lat, 38.714096);
    assert.equal(layers[0].pins[0].lng, -9.140165);
  }],

  ["findDuplicates: same name ignoring case and within 50m is a duplicate", () => {
    const pins = [
      { name: "Belem Tower", lat: 38.6916, lng: -9.2159 },
      { name: "Unfiled Pin", lat: 38.72, lng: -9.15 },
    ];
    const places = [{ name: "belem tower", lat: 38.69162, lng: -9.21591 }];
    assert.deepEqual(findDuplicates(pins, places), [true, false]);
  }],

  ["findDuplicates: same name far away (over 50m) is not a duplicate", () => {
    const pins = [{ name: "Belem Tower", lat: 38.6916, lng: -9.2159 }];
    const places = [{ name: "Belem Tower", lat: 38.70, lng: -9.20 }];
    assert.deepEqual(findDuplicates(pins, places), [false]);
  }],
];
