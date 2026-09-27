import {
  watchTrip,
  watchPlaces,
  updatePlace,
  watchDays,
  addDay,
  updateDay,
  deleteDayAndUnassignPlaces,
} from "../store.js";
import { el, confirmDialog, friendlyError, field, dialogShell } from "../ui.js";
import { renderExportSection } from "./exportSection.js";
import { sortByRank, voteSummary } from "../lib/votes.js";
import { rangesOverlap } from "../lib/dates.js";
import { walkingRouteLinks } from "../lib/links.js";

function dateRange(start, end) {
  const dates = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return dates;
}

function dayFormDialog(existing) {
  return dialogShell("day-dialog", (finish) => {
    const dateInput = el("input", { type: "date", value: existing?.date || "" });
    const titleInput = el("input", { type: "text", value: existing?.title || "" });
    const focusInput = el("input", { type: "text", value: existing?.focus || "" });
    const notesInput = el("textarea", { rows: 2, value: existing?.notes || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });
    const form = el("form", { method: "dialog" }, [
      field("Date (optional)", dateInput),
      field("Title", titleInput),
      field("Focus", focusInput),
      field("Notes", notesInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      finish({ date: dateInput.value || null, title: titleInput.value.trim(), focus: focusInput.value.trim(), notes: notesInput.value.trim() });
    });
    return { form, focusEl: titleInput };
  });
}

function dayLabel(day) {
  return day.title || day.date || "Undated day";
}

/** Renders the Days tab (§7.9). Returns a single unsubscribe function. */
export function renderDaysPage(container, tripId, myUid) {
  let trip = null;
  let places = [];
  let scopedPlaces = []; // places matching trip.destinationId -- never mix in a previous destination's places
  let days = [];
  let selectedDayId = null;
  let map = null;
  let markerLayer = null;

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const createFromDatesBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Create days from trip dates" });
  const addDayBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add day" });
  const daysListEl = el("div", { className: "days-list" });
  const dayMapEl = el("div", { className: "day-map" });
  const dayMapCaption = el("p", { className: "muted day-map-caption" }, ["Straight lines show the order, not the walking path."]);
  const unplannedEl = el("div", { className: "unplanned-pool card" });
  const exportSectionHolder = el("div", { className: "export-section-holder" });

  container.replaceChildren(
    loadErrorEl,
    el("div", { className: "days-header" }, [el("h2", { textContent: "Days" }), createFromDatesBtn, addDayBtn]),
    el("div", { className: "days-map-wrap" }, [dayMapEl, dayMapCaption]),
    daysListEl,
    el("h2", { textContent: "Unplanned" }),
    unplannedEl,
    exportSectionHolder
  );

  function nextOrder() {
    return days.length > 0 ? Math.max(...days.map((d) => d.order ?? 0)) + 1 : 0;
  }

  createFromDatesBtn.addEventListener("click", async () => {
    if (!trip.startDate || !trip.endDate) return;
    loadErrorEl.replaceChildren();
    const existingDates = new Set(days.map((d) => d.date).filter(Boolean));
    const missing = dateRange(trip.startDate, trip.endDate).filter((d) => !existingDates.has(d));
    try {
      let order = nextOrder();
      for (const date of missing) {
        await addDay(tripId, { date, title: "", focus: "", notes: "", order }, myUid);
        order += 1;
      }
    } catch (err) {
      loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  });

  addDayBtn.addEventListener("click", async () => {
    try {
      await addDay(tripId, { date: null, title: "", focus: "", notes: "", order: nextOrder() }, myUid);
    } catch (err) {
      loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  });

  function ensureMap() {
    if (map || typeof window === "undefined" || !window.L) return;
    map = window.L.map(dayMapEl, { scrollWheelZoom: true });
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    markerLayer = window.L.layerGroup().addTo(map);
    map.setView([20, 0], 2);
  }

  function renderDayMap(dayPlaces) {
    ensureMap();
    if (!markerLayer) return;
    markerLayer.clearLayers();
    const located = dayPlaces.filter((p) => p.lat != null && p.lng != null);
    located.forEach((place, i) => {
      const icon = window.L.divIcon({ className: "day-marker-icon", html: `<div class="day-marker">${i + 1}</div>`, iconSize: [24, 24] });
      const marker = window.L.marker([place.lat, place.lng], { icon });
      marker.bindTooltip(place.name);
      marker.addTo(markerLayer);
    });
    if (located.length >= 2) {
      window.L.polyline(
        located.map((p) => [p.lat, p.lng]),
        { dashArray: "6,6", color: "#1a73e8" }
      ).addTo(markerLayer);
    }
    if (located.length > 0) {
      map.fitBounds(
        located.map((p) => [p.lat, p.lng]),
        { padding: [30, 30], maxZoom: 16 }
      );
    } else {
      map.setView([20, 0], 2);
    }
  }

  async function movePlace(dayPlaces, index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= dayPlaces.length) return;
    const reordered = [...dayPlaces];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].dayOrder !== i) {
        await updatePlace(tripId, reordered[i].id, { dayOrder: i });
      }
    }
  }

  function renderDayCard(day) {
    const dayPlaces = scopedPlaces.filter((p) => p.dayId === day.id).sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0));
    const errorHolder = el("div", { className: "field-error-holder" });

    const selectBtn = el("button", {
      type: "button",
      className: `btn btn-small${day.id === selectedDayId ? " badge-chosen" : ""}`,
      textContent: "Show on map",
    });
    selectBtn.addEventListener("click", () => {
      selectedDayId = day.id;
      renderDays();
    });

    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", async () => {
      const result = await dayFormDialog(day);
      if (!result) return;
      try {
        await updateDay(tripId, day.id, result);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog(`Delete ${dayLabel(day)}? Its places return to Unplanned.`);
      if (!confirmed) return;
      try {
        await deleteDayAndUnassignPlaces(
          tripId,
          day.id,
          dayPlaces.map((p) => p.id)
        );
        if (selectedDayId === day.id) selectedDayId = null;
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const placeRows = dayPlaces.map((place, index) => {
      const upBtn = el("button", { type: "button", className: "btn btn-link", textContent: "▲", disabled: index === 0 });
      upBtn.addEventListener("click", () => movePlace(dayPlaces, index, -1));
      const downBtn = el("button", { type: "button", className: "btn btn-link", textContent: "▼", disabled: index === dayPlaces.length - 1 });
      downBtn.addEventListener("click", () => movePlace(dayPlaces, index, 1));
      const removeBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Remove" });
      removeBtn.addEventListener("click", () =>
        updatePlace(tripId, place.id, { dayId: null, dayOrder: null }).catch((err) =>
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
        )
      );
      return el("li", { className: "day-place-row" }, [
        el("span", { textContent: place.name }),
        upBtn,
        downBtn,
        removeBtn,
      ]);
    });

    const routeLinks = walkingRouteLinks(dayPlaces);
    const routeEl = el(
      "div",
      { className: "day-routes" },
      routeLinks.map((link) => el("a", { href: link.url, target: "_blank", rel: "noopener noreferrer", textContent: link.label, className: "btn btn-small" }))
    );

    return el("article", { className: "card day-card" }, [
      el("div", { className: "day-card-header" }, [
        el("h3", { textContent: dayLabel(day) }),
        el("div", { className: "day-card-actions" }, [selectBtn, editBtn, deleteBtn]),
      ]),
      day.focus ? el("p", { className: "muted", textContent: day.focus }) : null,
      day.notes ? el("p", { textContent: day.notes }) : null,
      dayPlaces.length === 0 ? el("p", { className: "empty-state", textContent: "No places yet." }) : el("ul", { className: "day-places" }, placeRows),
      routeLinks.length > 0 ? routeEl : null,
      errorHolder,
    ].filter(Boolean));
  }

  function buildAddToDaySelect(place) {
    const select = el("select", {}, [
      el("option", { value: "", textContent: "Add to day…" }),
      ...days.map((d) => el("option", { value: d.id, textContent: dayLabel(d) })),
    ]);
    select.addEventListener("change", async () => {
      const dayId = select.value;
      if (!dayId) return;
      const countInDay = scopedPlaces.filter((p) => p.dayId === dayId).length;
      try {
        await updatePlace(tripId, place.id, { dayId, dayOrder: countInDay });
      } catch (err) {
        loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });
    return select;
  }

  function renderUnplanned() {
    const unplanned = sortByRank(scopedPlaces.filter((p) => p.dayId == null));
    if (unplanned.length === 0) {
      unplannedEl.replaceChildren(el("p", { className: "empty-state", textContent: "Nothing unplanned." }));
      return;
    }
    const groups = new Map();
    for (const place of unplanned) {
      const key = place.neighborhood || "No neighborhood";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(place);
    }
    const groupKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    const sections = groupKeys.map((key) => {
      const rows = groups.get(key).map((place) => {
        const happening = days.some((d) => d.date && rangesOverlap(place.eventStart, place.eventEnd, d.date, d.date));
        return el("li", { className: "unplanned-row" }, [
          el("span", { textContent: place.name }),
          el("span", { className: "muted", textContent: voteSummary(place.votes || {}) || "Not ranked yet" }),
          happening ? el("span", { className: "badge-new-low", textContent: "Happening this day" }) : null,
          buildAddToDaySelect(place),
        ].filter(Boolean));
      });
      return el("div", { className: "unplanned-group" }, [el("h4", { textContent: key }), el("ul", { className: "unplanned-list" }, rows)]);
    });
    unplannedEl.replaceChildren(...sections);
  }

  function renderDays() {
    if (!trip) return;
    scopedPlaces = places.filter((p) => p.destinationId === trip.destinationId);
    createFromDatesBtn.disabled = !trip.startDate || !trip.endDate;
    const sorted = [...days].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!selectedDayId && sorted.length > 0) selectedDayId = sorted[0].id;
    if (sorted.length === 0) {
      daysListEl.replaceChildren(el("p", { className: "empty-state", textContent: "No days yet." }));
    } else {
      daysListEl.replaceChildren(...sorted.map(renderDayCard));
    }
    const selectedDay = sorted.find((d) => d.id === selectedDayId);
    const selectedDayPlaces = selectedDay
      ? scopedPlaces.filter((p) => p.dayId === selectedDay.id).sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0))
      : [];
    renderDayMap(selectedDayPlaces);
    renderUnplanned();
    exportSectionHolder.replaceChildren(renderExportSection({ trip, places: scopedPlaces, days }));
  }

  const unsubTrip = watchTrip(
    tripId,
    (t) => {
      trip = t;
      renderDays();
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const unsubPlaces = watchPlaces(
    tripId,
    (p) => {
      places = p;
      if (trip) renderDays();
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const unsubDays = watchDays(
    tripId,
    (d) => {
      days = d;
      if (trip) renderDays();
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );

  return () => {
    unsubTrip();
    unsubPlaces();
    unsubDays();
    if (map) {
      map.remove();
      map = null;
    }
  };
}
