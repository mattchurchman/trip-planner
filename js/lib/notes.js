// Pure helpers for notes imported from Google My Maps (T69).

/** Turns My Maps' HTML description into simple, readable lines. */
export function cleanNoteText(text) {
  return String(text ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    // Decode this last so `&amp;lt;` remains the literal text `&lt;`.
    .replace(/&amp;/gi, "&")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** Reads a note as user-written lines and My Maps-style label/value fields. */
export function formatNote(text) {
  return cleanNoteText(text).split("\n").filter(Boolean).map((line) => {
    const match = line.match(/^([^:]{1,40}):\s*(.+)$/);
    const label = match?.[1].trim();
    const value = match?.[2].trim();
    if (label && value && !/^https?$/i.test(label)) {
      return { type: "field", label, values: value.split(" | ").map((part) => part.trim()).filter(Boolean) };
    }
    return { type: "text", text: line };
  });
}

/** Separates URLs from surrounding text so callers can make safe short links. */
export function splitLinks(text) {
  const pieces = [];
  const source = String(text ?? "");
  const urlPattern = /https?:\/\/[^\s]+/gi;
  let position = 0;

  for (const match of source.matchAll(urlPattern)) {
    const rawUrl = match[0];
    const url = rawUrl.replace(/[.,;)]+$/, "");
    const suffix = rawUrl.slice(url.length);
    let host;
    try {
      host = new URL(url).hostname.replace(/^www\./i, "");
    } catch {
      continue;
    }
    if (match.index > position) pieces.push({ text: source.slice(position, match.index) });
    pieces.push({ url, host });
    if (suffix) pieces.push({ text: suffix });
    position = match.index + rawUrl.length;
  }
  if (position < source.length || pieces.length === 0) pieces.push({ text: source.slice(position) });
  return pieces;
}
