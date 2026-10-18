// The Days tab's numbered timeline (T64, R7 §7 Days (c)): the selected
// day's places as numbered rows with a dotted connector between them, a
// category icon tile, name/category/neighborhood, vote count, and a ⋯ menu
// for Move up / Move down / Remove from day. No DOM state of its own --
// call `renderTimeline` again whenever the day's places change.
import { el, icon, menuButton, row, friendlyError, setPending } from "../ui.js";
import { sortByRank, voteSummary } from "../lib/votes.js";
import { categoryColor, categoryIcon } from "../lib/categories.js";

function iconTile(category) {
  return el("span", { className: "icon-tile", style: `--cat:${categoryColor(category)}` }, [
    icon(categoryIcon(category), { size: 18 }),
  ]);
}

function subtitleFor(place) {
  return place.neighborhood ? `${place.category} · ${place.neighborhood}` : place.category;
}

function timelineRow(place, index, isLast, { onMove, onRemove }) {
  const menu = menuButton(
    [
      index > 0 && { label: "Move up", icon: "chevron", onSelect: () => onMove(place, -1) },
      !isLast && { label: "Move down", icon: "chevron", onSelect: () => onMove(place, 1) },
      { label: "Remove from day", icon: "close", onSelect: () => onRemove(place) },
    ],
    { label: `More actions for ${place.name}` }
  );

  return el("li", { className: "timeline-row" }, [
    el("div", { className: "timeline-marker" }, [
      el("span", { className: "timeline-number", textContent: String(index + 1) }),
      isLast ? null : el("div", { className: "timeline-connector" }),
    ]),
    iconTile(place.category),
    el("div", { className: "list-row-text" }, [
      el("span", { className: "list-row-title", textContent: place.name }),
      el("span", { className: "list-row-subtitle", textContent: subtitleFor(place) }),
    ]),
    el("span", { className: "muted timeline-votes", textContent: voteSummary(place.votes || {}) || "Not ranked yet" }),
    menu,
  ]);
}

/**
 * `dayPlaces` must already be sorted by `dayOrder`. `onMove(place, direction)`
 * and `onRemove(place)` are async and may throw; the caller catches and shows
 * the error (they're passed straight through from the menu item).
 */
export function renderTimeline(dayPlaces, { onMove, onRemove }) {
  if (dayPlaces.length === 0) {
    return el("p", { className: "empty-state", textContent: "No places yet. Tap a pin on the map, or add one from Not planned, below." });
  }
  return el(
    "ol",
    { className: "day-timeline" },
    dayPlaces.map((place, index) => timelineRow(place, index, index === dayPlaces.length - 1, { onMove, onRemove }))
  );
}

/** The "+ Add from not planned" sheet (T64, R7 §7 Days (e)): the pool,
 * Loved first (already how `sortByRank` orders it), each row's own **Add**
 * calling `onAdd(place)` — async, may throw; the sheet shows the error and
 * stays open. */
export function openNotPlannedSheet(unplanned, { onAdd }) {
  const dialog = el("dialog", { className: "app-dialog not-planned-sheet" });
  const errorHolder = el("div", { className: "field-error-holder" });
  function closeDialog() {
    dialog.close();
    dialog.remove();
  }

  const rows = sortByRank(unplanned).map((place) => {
    const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add" });
    addBtn.addEventListener("click", async () => {
      setPending(addBtn, true);
      try {
        await onAdd(place);
        closeDialog();
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      } finally {
        setPending(addBtn, false);
      }
    });
    return row({ title: place.name, subtitle: voteSummary(place.votes || {}) || "Not ranked yet", trailing: addBtn });
  });
  const listEl =
    rows.length === 0
      ? el("p", { className: "empty-state", textContent: "Nothing here yet — places without a day show up here." })
      : el("div", { className: "card" }, rows);

  const closeBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Close" });
  closeBtn.addEventListener("click", closeDialog);
  dialog.replaceChildren(el("h3", { textContent: "Not planned" }), listEl, errorHolder, el("div", { className: "dialog-actions" }, [closeBtn]));
  dialog.addEventListener("cancel", closeDialog);
  document.body.appendChild(dialog);
  dialog.showModal();
}
