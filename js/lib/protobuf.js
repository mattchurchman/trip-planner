// Pure: a tiny, read-only decoder for "protocol buffers", the compact binary
// format Google Flights packs into its link parameters (tfs, tfu). No DOM, no
// Firebase. We don't have Google's schema, so this decodes generically into
// { field, type, value } entries and flightlink.js knows which numbered fields
// mean what (worked out from real links, SPEC §9.6).

/** base64url (or plain base64) text -> Uint8Array. Throws on bad input. */
export function base64UrlToBytes(text) {
  let s = String(text).trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*=*$/.test(s)) throw new Error("not base64");
  s = s.replace(/=+$/, "");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Reads a varint starting at `pos`. Returns [value, nextPos]. Values above
// Number.MAX_SAFE_INTEGER (Google uses 2^64-1 as a "no limit" marker) come
// back as null, since nothing we read needs them.
function readVarint(bytes, pos) {
  let result = 0n;
  let shift = 0n;
  for (let i = 0; i < 10; i++) {
    if (pos >= bytes.length) throw new Error("truncated varint");
    const byte = bytes[pos++];
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return [result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null, pos];
    }
    shift += 7n;
  }
  throw new Error("varint too long");
}

/**
 * Decodes one message level. Returns an array of entries:
 *   { field: number, type: "varint", value: number|null }
 *   { field: number, type: "bytes",  value: Uint8Array }
 * Fixed-width fields are skipped. Throws if the bytes aren't a valid message,
 * which is how callers tell "this nested blob is a string, not a message".
 */
export function decodeMessage(bytes) {
  const entries = [];
  let pos = 0;
  while (pos < bytes.length) {
    const [key, afterKey] = readVarint(bytes, pos);
    if (key === null || key === 0) throw new Error("bad key");
    pos = afterKey;
    const field = Math.floor(key / 8);
    const wireType = key % 8;
    if (wireType === 0) {
      const [value, next] = readVarint(bytes, pos);
      entries.push({ field, type: "varint", value });
      pos = next;
    } else if (wireType === 2) {
      const [length, next] = readVarint(bytes, pos);
      if (length === null || next + length > bytes.length) throw new Error("bad length");
      entries.push({ field, type: "bytes", value: bytes.subarray(next, next + length) });
      pos = next + length;
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      throw new Error(`unsupported wire type ${wireType}`);
    }
    if (pos > bytes.length) throw new Error("truncated");
  }
  return entries;
}

/** Bytes -> text (UTF-8). */
export function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

// Small helpers for walking decoded entries.
export function all(entries, field) {
  return entries.filter((e) => e.field === field);
}

export function first(entries, field) {
  return entries.find((e) => e.field === field) || null;
}

/** Text of the first bytes-field `field`, or null. */
export function textOf(entries, field) {
  const entry = first(entries, field);
  return entry && entry.type === "bytes" ? bytesToText(entry.value) : null;
}

/** Number of the first varint-field `field`, or null. */
export function numberOf(entries, field) {
  const entry = first(entries, field);
  return entry && entry.type === "varint" ? entry.value : null;
}

/** Decodes the first bytes-field `field` as a nested message, or null. */
export function messageOf(entries, field) {
  const entry = first(entries, field);
  if (!entry || entry.type !== "bytes") return null;
  try {
    return decodeMessage(entry.value);
  } catch {
    return null;
  }
}
