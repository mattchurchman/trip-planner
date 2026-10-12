import { el, friendlyError } from "../ui.js";
import { voteSummary } from "../lib/votes.js";

// Cycled by a day's position among its city's days (T27, V4 §8) — distinct
// from the category palette so a place's own color never clashes with a
// day's color.
const DAY_COLORS = ["#1a73e8", "#e8710a", "#9334e6", "#188038", "#c2185b", "#00897b", "#827717", "#3949ab"];

export function dayColor(index) {
  return DAY_COLORS[index % DAY_COLORS.length];
}

function numberedIcon(number, color) {
  return window.L.divIcon({
    className: "day-marker-icon",
    html: `<div class="day-marker" style="background:${color}">${number}</div>`,
    iconSize: [24, 24],
  });
}

function plainMarker(place, color, opacity) {
  return window.L.circleMarker([place.lat, place.lng], { radius: 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: opacity });
}

/** The chosen stay for the selected day (T39, §7.8): the stay pill style
 * (`.stay-pin`/`.stay-pin-chosen` from the Map tab) plus a house mark, so the
 * day's home base stands out among the day's own numbered/plain pins. Its
 * popup names it, unlike the plain tooltip on place pins. */
function homeMarker(stay) {
  const pillEl = el("div", { className: "stay-pin stay-pin-chosen day-home-pin" }, [
    el("span", { textContent: "🏠" }),
    el("span", { textContent: stay.name || "Stay" }),
  ]);
  const icon = window.L.divIcon({ html: pillEl, className: "stay-pin-icon", iconSize: null });
  const marker = window.L.marker([stay.lat, stay.lng], { icon });
  marker.bindPopup(stay.name || "Stay");
  return marker;
}

/** The sheet a tapped pin opens (T27): the place, its vote summary, one
 * button per day in its city, and Remove from day. `daysInCity` is
 * `{ id, label, color }` in order; `onAssign`/`onRemove` are async and may throw. */
function openPinSheet({ place, daysInCity, onAssign, onRemove }) {
  const dialog = el("dialog", { className: "app-dialog day-pin-sheet" });
  const errorHolder = el("div", { className: "field-error-holder" });

  function closeDialog() {
    dialog.close();
    dialog.remove();
  }

  const dayButtons = daysInCity.map((day) => {
    const current = place.dayId === day.id;
    const btn = el("button", {
      type: "button",
      className: `btn btn-small${current ? " badge-chosen" : ""}`,
      textContent: current ? `✓ ${day.label}` : day.label,
      disabled: current,
    });
    btn.addEventListener("click", async () => {
      try {
        await onAssign(place, day.id);
        closeDialog();
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });
    return btn;
  });

  const removeBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Remove from day" });
  removeBtn.hidden = !place.dayId;
  removeBtn.addEventListener("click", async () => {
    try {
      await onRemove(place);
      closeDialog();
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  });

  const closeBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Close" });
  closeBtn.addEventListener("click", closeDialog);

  dialog.replaceChildren(
    el("div", { className: "day-pin-sheet-body" }, [
      el("h3", { textContent: place.name }),
      el("p", { className: "muted", textContent: voteSummary(place.votes || {}) || "Not ranked yet" }),
      daysInCity.length > 0
        ? el("div", { className: "day-pin-sheet-actions" }, dayButtons)
        : el("p", { className: "muted", textContent: "No days yet for this city." }),
      removeBtn,
      errorHolder,
      el("div", { className: "dialog-actions" }, [closeBtn]),
    ])
  );
  dialog.addEventListener("cancel", closeDialog);
  document.body.appendChild(dialog);
  dialog.showModal();
}

/**
 * The Days tab's map (T27, V4 §8): a Leaflet map of one city's places, pins
 * numbered and colored by whichever of that city's days they're on, plain
 * when unplanned. Tapping a pin opens a sheet to assign or remove it.
 * `onAssign(place, dayId)` and `onRemove(place)` are async and may throw;
 * the sheet shows the error and stays open.
 */
export function createDaysMap({ onAssign, onRemove }) {
  let map = null;
  let markerLayer = null;

  const mapEl = el("div", { className: "day-map" });
  const captionEl = el("p", { className: "muted day-map-caption" }, ["Straight lines show the order, not the walking path. Tap a pin to add it to a day."]);
  const element = el("div", { className: "days-map-wrap" }, [mapEl, captionEl]);

  function ensureMap() {
    if (map || typeof window === "undefined" || !window.L) return;
    map = window.L.map(mapEl, { scrollWheelZoom: true });
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    markerLayer = window.L.layerGroup().addTo(map);
    map.setView([20, 0], 2);
  }

  /** `cityPlaces`: this city's places (any day, or none). `daysInCity`:
   * `{ id, label, color }` in order. `selectedDayId`: whose pins get numbered.
   * `homeStay` (T39): the selected day's chosen, located stay, or null. */
  function render(cityPlaces, daysInCity, selectedDayId, homeStay) {
    ensureMap();
    if (!markerLayer) return;
    markerLayer.clearLayers();

    const byId = new Map(daysInCity.map((d) => [d.id, d]));
    const located = (cityPlaces || []).filter((p) => p.lat != null && p.lng != null);
    const onSelected = located
      .filter((p) => p.dayId === selectedDayId)
      .sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0));
    const selectedColor = (byId.get(selectedDayId) || {}).color || dayColor(0);

    for (const place of located) {
      const onDay = place.dayId ? byId.get(place.dayId) : null;
      let marker;
      if (place.dayId === selectedDayId) {
        const number = onSelected.indexOf(place) + 1;
        marker = window.L.marker([place.lat, place.lng], { icon: numberedIcon(number, selectedColor) });
      } else if (onDay) {
        marker = plainMarker(place, onDay.color, 0.9);
      } else {
        marker = plainMarker(place, "#9aa5a3", 0.5);
      }
      marker.bindTooltip(place.name);
      marker.on("click", () =>
        openPinSheet({
          place,
          daysInCity,
          onAssign,
          onRemove,
        })
      );
      marker.addTo(markerLayer);
    }

    if (onSelected.length >= 2) {
      window.L.polyline(onSelected.map((p) => [p.lat, p.lng]), { dashArray: "6,6", color: selectedColor }).addTo(markerLayer);
    }

    const hasHome = homeStay && homeStay.lat != null && homeStay.lng != null;
    if (hasHome) homeMarker(homeStay).addTo(markerLayer);

    const boundsPoints = hasHome ? [...located, homeStay] : located;
    if (boundsPoints.length > 0) {
      map.fitBounds(boundsPoints.map((p) => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 16 });
    } else {
      map.setView([20, 0], 2);
    }
  }

  function destroy() {
    if (map) {
      map.remove();
      map = null;
    }
  }

  return { element, render, destroy };
}
