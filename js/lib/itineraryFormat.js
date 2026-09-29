// Pure: formatting helpers shared by the flight dialog's preview and the
// flight card's itinerary block (§7.7). No DOM, no Firebase.
import { stopsLabel } from "./flightlink.js";
import { airlineName } from "./airlines.js";

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2027-01-17" -> "Sun 17 Jan". Built from the date string in UTC so the
 * weekday never shifts with the viewer's local timezone. */
export function formatLegDate(dateStr) {
  if (typeof dateStr !== "string") return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return `${WEEKDAY_ABBR[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH_ABBR[date.getUTCMonth()]}`;
}

/**
 * The auto-label rule (§7.7): with outbound airline codes, the airlines'
 * names in order without repeats ("Delta", "Alaska + Fiji Airways", "Alaska
 * + 2 more" for three or more) then " · " and the stop count; with no codes
 * (no segments read from a link), "Option N" where N = optionCount + 1.
 */
export function flightLabel(airlineCodes, optionCount) {
  if (!airlineCodes || airlineCodes.length === 0) return `Option ${optionCount + 1}`;

  const names = [];
  const seen = new Set();
  for (const code of airlineCodes) {
    if (!code || seen.has(code)) continue;
    seen.add(code);
    names.push(airlineName(code) || code);
  }

  let airlinesText;
  if (names.length <= 1) airlinesText = names[0] || "Unknown airline";
  else if (names.length === 2) airlinesText = `${names[0]} + ${names[1]}`;
  else airlinesText = `${names[0]} + ${names.length - 1} more`;

  const stops = airlineCodes.length - 1;
  return `${airlinesText} · ${stopsLabel(stops)}`;
}
