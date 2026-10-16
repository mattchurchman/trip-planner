import { el, icon, friendlyError, setPending } from "../ui.js";
import { voteSummary } from "../lib/votes.js";

/** The selected day's pins, numbered by `dayOrder` (R7 §7 Days (b)): forest
 * fill, on-forest number — the app's one action color, not a per-day hue. */
function numberedIcon(number) {
  return window.L.divIcon({
    className: "day-marker-icon",
    html: `<div class="day-marker">${number}</div>`,
    iconSize: [24, 24],
  });
}

function plainMarker(place, opacity) {
  return window.L.circleMarker([place.lat, place.lng], {
    radius: 7,
    color: "var(--surface)",
    weight: 2,
    fillColor: "var(--muted)",
    fillOpacity: opacity,
  });
}

/** The chosen, located stay for the selected day (T39, T64, R7 §7 Days (b)):
 * the `stay` icon in an accent square, not the Map tab's price pill, so the
 * day's home base reads apart from its own numbered/plain pins. Its popup
 * names it, unlike the plain tooltip on place pins. */
function homeMarker(stay) {
  const squareEl = el("div", { className: "day-home-marker" }, [icon("stay", { size: 16 })]);
  const divIcon = window.L.divIcon({ html: squareEl, className: "day-home-marker-icon", iconSize: [32, 32] });
  const marker = window.L.marker([stay.lat, stay.lng], { icon: divIcon });
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
      setPending(btn, true);
      try {
        await onAssign(place, day.id);
        closeDialog();
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      } finally {
        setPending(btn, false);
      }
    });
    return btn;
  });

  const removeBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Remove from day" });
  removeBtn.hidden = !place.dayId;
  removeBtn.addEventListener("click", async () => {
    setPending(removeBtn, true);
    try {
      await onRemove(place);
      closeDialog();
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(removeBtn, false);
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
 * The Days tab's map (T27, T64, V4 §8, R7 §7 Days (b)): a Leaflet map of one
 * city's places — the selected day's as forest, numbered pins, the rest as
 * plain muted dots. Tapping a pin opens a sheet to assign or remove it.
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
   * `{ id, label }` in order, for the pin sheet's day buttons. `selectedDayId`:
   * whose pins get numbered. `homeStay` (T39): the selected day's chosen,
   * located stay, or null. */
  function render(cityPlaces, daysInCity, selectedDayId, homeStay) {
    ensureMap();
    if (!markerLayer) return;
    markerLayer.clearLayers();

    const located = (cityPlaces || []).filter((p) => p.lat != null && p.lng != null);
    const onSelected = located
      .filter((p) => p.dayId === selectedDayId)
      .sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0));

    for (const place of located) {
      let marker;
      if (place.dayId === selectedDayId) {
        const number = onSelected.indexOf(place) + 1;
        marker = window.L.marker([place.lat, place.lng], { icon: numberedIcon(number) });
      } else {
        marker = plainMarker(place, place.dayId ? 0.9 : 0.5);
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
      window.L.polyline(onSelected.map((p) => [p.lat, p.lng]), { dashArray: "6,6", color: "var(--forest)" }).addTo(markerLayer);
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
