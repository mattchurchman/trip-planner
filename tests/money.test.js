import assert from "node:assert/strict";
import { parseMoney, formatMoney, split } from "../js/lib/money.js";

export const tests = [
  ["parseMoney parses a symbol and thousands comma", () => {
    assert.equal(parseMoney("$1,234.56"), 123456);
  }],
  ["parseMoney parses a single decimal digit", () => {
    assert.equal(parseMoney("0.1"), 10);
  }],
  ["parseMoney rejects three decimal digits", () => {
    assert.equal(parseMoney("12.345"), null);
  }],
  ["parseMoney rejects non-numeric text", () => {
    assert.equal(parseMoney("abc"), null);
  }],
  ["parseMoney accepts zero", () => {
    assert.equal(parseMoney("0"), 0);
  }],
  ["parseMoney accepts a plain integer", () => {
    assert.equal(parseMoney("1234"), 123400);
  }],
  ["parseMoney rejects a negative amount instead of flipping its sign", () => {
    assert.equal(parseMoney("-5"), null);
    assert.equal(parseMoney("-12.50"), null);
    assert.equal(parseMoney("-$5"), null);
    assert.equal(parseMoney("$-5"), null);
  }],
  ["formatMoney formats cents as currency", () => {
    assert.equal(formatMoney(123456, "USD", "en-US"), "$1,234.56");
  }],
  ["split divides evenly", () => {
    assert.deepEqual(split(999, 3), [333, 333, 333]);
  }],
  ["split gives the remainder to the first travelers and sums exactly", () => {
    const shares = split(1000, 3);
    assert.deepEqual(shares, [334, 333, 333]);
    assert.equal(shares.reduce((a, b) => a + b, 0), 1000);
  }],
];
