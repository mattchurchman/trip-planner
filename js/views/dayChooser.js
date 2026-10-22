// The Days tab's day chooser (T64, T72, R7 §7 Days (a), §7.8): one 58px
// chip per day, moved out of days.js to keep that file under 400 lines.
// `renderChooser` builds the chips only — the caller appends its own
// **Add day** chip and owns the status line below the row.
import { el, icon } from "../ui.js";
import { formatLegDate } from "../lib/itineraryFormat.js";

/** `{ weekday, dateNum }` from a day's date ("Sat", "17"), or null undated
 * (T64, R7 §7 Days). Shared with `days.js` for the focused day's h1. */
export function dayWeekday(date) {
  const formatted = formatLegDate(date);
  if (!formatted) return null;
  const [weekday, dateNum] = formatted.split(" ");
  return { weekday, dateNum };
}

/** aria-label text for an existing day's chip (WORDING, Round 11):
 * "{chip date}, {N} places" or "{chip date}, nothing planned". */
function chipAriaLabel(dateLabel, count) {
  const plan = count === 0 ? "nothing planned" : `${count} place${count === 1 ? "" : "s"}`;
  return `${dateLabel}, ${plan}`;
}

/** The day chooser's 58px chip (R7 §7 Days (a); T72 adds the count badge /
 * empty dot and the note mark). `dashed` marks a route date with no day
 * yet, which carries no count or note mark since it isn't a day yet. */
export function dayChip({ top, num, dashed = false, selected = false, count = null, hasNote = false }, onClick) {
  const dateLabel = top ? `${top} ${num}` : num;
  const children = [el("span", { className: "day-chip-top", textContent: top }), el("span", { className: "day-chip-num", textContent: num })];
  if (count !== null) {
    children.push(
      count === 0
        ? el("span", { className: "day-chip-dot", attrs: { "aria-hidden": "true" } })
        : el("span", { className: "day-chip-badge", textContent: String(count), attrs: { "aria-hidden": "true" } })
    );
  }
  if (hasNote) children.push(icon("edit", { size: 12 }));
  const btn = el(
    "button",
    {
      type: "button",
      className: `day-chip${dashed ? " day-chip-dashed" : ""}${selected ? " day-chip-selected" : ""}`,
      attrs: { "aria-pressed": selected ? "true" : "false", "aria-label": count !== null ? chipAriaLabel(dateLabel, count) : null },
    },
    children
  );
  btn.addEventListener("click", onClick);
  return btn;
}

/** The day chooser's chips (R7 §7 Days (a)): existing days as chips (with
 * their place count / empty dot and note mark, T72), then route dates with
 * no day yet as dashed chips that create one. Returns the buttons to place
 * in the chooser row; the caller appends its own **Add day** chip. */
export function renderChooser({ sorted, missing, selectedDayId, counts, hasNote }, { onSelectDay, onCreateMissing }) {
  const dayButtons = sorted.map((day, index) => {
    const weekday = dayWeekday(day.date);
    return dayChip(
      {
        top: weekday ? weekday.weekday : "Day",
        num: weekday ? weekday.dateNum : String(index + 1),
        selected: day.id === selectedDayId,
        count: counts[day.id] ?? 0,
        hasNote: hasNote(day),
      },
      () => onSelectDay(day.id)
    );
  });
  const missingButtons = missing.map((spec) => {
    const weekday = dayWeekday(spec.date) || { weekday: "", dateNum: "?" };
    return dayChip({ top: weekday.weekday, num: weekday.dateNum, dashed: true }, () => onCreateMissing(spec));
  });
  return [...dayButtons, ...missingButtons];
}
