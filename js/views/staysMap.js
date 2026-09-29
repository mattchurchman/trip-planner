import { el } from "../ui.js";
import { latestEntry } from "../lib/totals.js";
import { nightsBetween } from "../lib/dates.js";
import { stayNumbers } from "../lib/optionSort.js";
import { stayPinLabel, topPlaces } from "../lib/staypins.js";
import { categoryColor } from "../lib/categories.js";
import { isStayChosen } from "../lib/selection.js";

const USER_MOVE_QUIET_MS = 30000;
const PULSE_MS = 1500;

/**
 * The stays price-pin map (§7.7.1). Renders into `container`, which the
 * caller places above the stay cards. `onPinClick(stayId)` fires when a pin
 * is clicked — the caller scrolls to and highlights that stay's card.
 */
export function createStaysMap(container, { onPinClick }) {
  let map = null;
  let pinLayer = null;
  let topPlacesLayer = null;
  let showTopPlaces = true;
  let userMovedAt = 0;
  let programmaticMove = false;
  const pinsByStayId = new Map();

  let latestPlaces = [];
  let latestTrip = null;

  const mapEl = el("div", { className: "stays-map" });
  const topPlacesCheckbox = el("input", { type: "checkbox", checked: true });
  const controlsEl = el("div", { className: "stays-map-controls" }, [
    el("label", { className: "checkbox-label" }, [topPlacesCheckbox, " Show our top places"]),
  ]);
  const captionEl = el("p", { className: "muted stays-map-caption", textContent: "Pins show the price per night. Teal pins are chosen." });
  const mapWrapEl = el("div", { className: "stays-map-wrap" }, [controlsEl, mapEl, captionEl]);
  const noteEl = el("p", { className: "muted", textContent: "Add a location to a stay to see it on the map." });

  container.replaceChildren(mapWrapEl, noteEl);

  function withProgrammaticMove(run) {
    programmaticMove = true;
    map.once("moveend", () => {
      programmaticMove = false;
    });
    run();
    // fitBounds/panTo fire no moveend at all when the view doesn't actually change.
    setTimeout(() => {
      programmaticMove = false;
    }, 500);
  }

  function ensureMap() {
    if (map || typeof window === "undefined" || !window.L) return;
    map = window.L.map(mapEl, { scrollWheelZoom: true });
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    pinLayer = window.L.layerGroup().addTo(map);
    topPlacesLayer = window.L.layerGroup();
    if (showTopPlaces) topPlacesLayer.addTo(map);
    map.setView([20, 0], 2);
    map.on("movestart zoomstart", () => {
      if (programmaticMove) return;
      userMovedAt = Date.now();
    });
  }

  topPlacesCheckbox.addEventListener("change", () => {
    showTopPlaces = topPlacesCheckbox.checked;
    if (!map) return;
    if (showTopPlaces) topPlacesLayer.addTo(map);
    else map.removeLayer(topPlacesLayer);
  });

  function renderTopPlacesLayer() {
    if (!topPlacesLayer || !latestTrip) return;
    topPlacesLayer.clearLayers();
    for (const place of topPlaces(latestPlaces, latestTrip.destinationId)) {
      const color = categoryColor(place.category);
      const marker = window.L.circleMarker([place.lat, place.lng], {
        radius: 5,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1,
      });
      marker.bindTooltip(place.name);
      marker.addTo(topPlacesLayer);
    }
  }

  function renderPinsLayer(located, trip, numbers) {
    pinLayer.clearLayers();
    pinsByStayId.clear();
    for (const stay of located) {
      const nights = nightsBetween(stay.checkIn, stay.checkOut);
      const latest = latestEntry(stay.prices);
      const label = stayPinLabel({
        number: numbers[stay.id],
        latestCents: latest ? latest.amountCents : null,
        nights,
        currency: trip.currency,
      });
      const chosen = isStayChosen(trip, stay.id);
      const pillEl = el("div", { className: `stay-pin${chosen ? " stay-pin-chosen" : ""}`, textContent: label });
      const icon = window.L.divIcon({ html: pillEl, className: "stay-pin-icon", iconSize: null });
      const marker = window.L.marker([stay.lat, stay.lng], { icon });
      marker.on("click", () => onPinClick && onPinClick(stay.id));
      marker.addTo(pinLayer);
      pinsByStayId.set(stay.id, { marker, pillEl });
    }
  }

  function fitBoundsIfIdle(located) {
    if (Date.now() - userMovedAt < USER_MOVE_QUIET_MS) return;
    const points = located.map((s) => [s.lat, s.lng]);
    if (showTopPlaces && latestTrip) {
      for (const place of topPlaces(latestPlaces, latestTrip.destinationId)) points.push([place.lat, place.lng]);
    }
    if (points.length === 0) return;
    withProgrammaticMove(() => map.fitBounds(points, { padding: [30, 30], maxZoom: 15 }));
  }

  return {
    update(stays, places, trip) {
      latestPlaces = places;
      latestTrip = trip;
      const located = stays.filter((s) => s.lat != null && s.lng != null);
      const hasAny = located.length > 0;
      mapWrapEl.hidden = !hasAny;
      noteEl.hidden = hasAny;
      if (!hasAny) return;

      ensureMap();
      // Numbers come from the full stays list (createdAt order, §7.7), so a
      // pin's number always matches the same stay's number on its card.
      renderPinsLayer(located, trip, stayNumbers(stays));
      renderTopPlacesLayer();
      fitBoundsIfIdle(located);
    },
    focusStay(stayId) {
      if (!map) return;
      const entry = pinsByStayId.get(stayId);
      if (!entry) return;
      withProgrammaticMove(() => map.panTo(entry.marker.getLatLng()));
      entry.pillEl.classList.add("stay-pin-pulse");
      setTimeout(() => entry.pillEl.classList.remove("stay-pin-pulse"), PULSE_MS);
    },
    destroy() {
      if (map) {
        map.remove();
        map = null;
      }
    },
  };
}
