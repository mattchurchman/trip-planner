// Pure: build the Wikipedia photo-lookup URL and pick a usable photo from its
// JSON response (§9.7). The fetch itself lives in js/lookup.js.
import { safeUrl } from "./links.js";

/** The §9.7 lookup URL for a page title: spaces become underscores, then the
 * whole title is percent-encoded. */
export function wikiSummaryUrl(title) {
  return `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** The two titles to try in order (§7.5, §9.7): the city alone, then "city,
 * country". Blank parts and an exact duplicate of the first title are skipped. */
export function photoTitles(city, country) {
  const titles = [];
  const trimmedCity = (city || "").trim();
  const trimmedCountry = (country || "").trim();
  if (trimmedCity) titles.push(trimmedCity);
  const combined = [trimmedCity, trimmedCountry].filter(Boolean).join(", ");
  if (combined && !titles.includes(combined)) titles.push(combined);
  return titles;
}

function usableImageUrl(url) {
  if (!url) return null;
  const safe = safeUrl(url);
  if (!safe) return null;
  let host;
  try {
    host = new URL(safe).hostname;
  } catch {
    return null;
  }
  return host === "upload.wikimedia.org" ? safe : null;
}

/** Reads one Wikipedia page-summary JSON and returns `{ url, pageUrl }` for a
 * usable photo, or `null` (§9.7: not "standard", or no usable image). */
export function pickPhoto(json) {
  if (!json || json.type !== "standard") return null;

  const thumbUrl = usableImageUrl(json.thumbnail && json.thumbnail.source);
  const originalUrl = usableImageUrl(json.originalimage && json.originalimage.source);

  let url = null;
  if (thumbUrl) {
    // Sharper image: swap the thumbnail's width for 640, e.g. ".../320px-X.jpg" -> ".../640px-X.jpg".
    url = thumbUrl.replace(/\/(\d+)px-/, "/640px-");
  } else if (originalUrl) {
    url = originalUrl;
  }
  if (!url) return null;

  const pageUrl = json.content_urls && json.content_urls.desktop && json.content_urls.desktop.page;
  return { url, pageUrl: pageUrl || null };
}
