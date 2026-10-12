import {
  watchTrip,
  watchPlaces,
  updatePlace,
  watchDays,
  addDay,
  updateDay,
  deleteDayAndUnassignPlaces,
  watchFlights,
  watchOptions,
  watchStays,
} from "../store.js";
import { chosenStayIds } from "../lib/selection.js";
import { el, confirmDialog, friendlyError, field, dialogShell } from "../ui.js";
import { renderExportSection } from "./exportSection.js";
import { sortByRank, voteSummary, voteCounts } from "../lib/votes.js";
import { rangesOverlap } from "../lib/dates.js";
import { walkingRouteLinks } from "../lib/links.js";
import { datesBetween, daysFromStops, missingDays } from "../lib/dayplan.js";
import { stopsFor } from "../lib/route.js";
import { createDaysMap, dayColor } from "./daysMap.js";
import { loadAirports } from "../lookup.js";

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

function myTraveler(trip, myUid) {
  const travelers = trip.travelers || [];
  return travelers.find((t) => t.uid === myUid) || travelers[0] || null;
}

function hopFlightsFor(flights, optionId) {
  return flights.filter((f) => f.role === "hop" && f.optionId === optionId);
}

/** The chosen option's stops, from this traveler's picked home flights (same
 * convention the Map tab uses) plus that option's hops — the raw material
 * `daysFromStops` turns into one day per date (T27, V4 §8). */
function chosenStops(trip, myUid, flights, options, airports) {
  if (!trip.chosenOptionId || !airports) return [];
  const option = options.find((o) => o.id === trip.chosenOptionId);
  const traveler = option && myTraveler(trip, myUid);
  if (!traveler) return [];
  const homeFlights = flights.filter((f) => f.role === "home" && f.ideaId === option.ideaId && f.travelerId === traveler.id && f.picked !== false);
  return stopsFor({ homeFlights, hopFlights: hopFlightsFor(flights, option.id), airports });
}

/** Renders the Days tab (§7.9, T27 V4 §8). Returns a single unsubscribe function. */
export function renderDaysPage(container, tripId, myUid) {
  let trip = null;
  let places = [];
  let scopedPlaces = [];
  let days = [];
  let flights = [];
  let options = [];
  let stays = [];
  let airports = null;
  let selectedDayId = null;

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const onError = (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
  const createDaysBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Create days from trip dates" });
  const addDayBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add day" });
  const daysListEl = el("div", { className: "days-list" });
  const unplannedEl = el("div", { className: "unplanned-pool card" });
  const exportSectionHolder = el("div", { className: "export-section-holder" });

  const daysMapSection = createDaysMap({
    onAssign: async (place, dayId) => {
      const countInDay = scopedPlaces.filter((p) => p.dayId === dayId).length;
      await updatePlace(tripId, place.id, { dayId, dayOrder: countInDay });
    },
    onRemove: async (place) => {
      await updatePlace(tripId, place.id, { dayId: null, dayOrder: null });
    },
  });

  container.replaceChildren(
    loadErrorEl,
    el("div", { className: "days-header" }, [el("h2", { textContent: "Days" }), createDaysBtn, addDayBtn]),
    daysMapSection.element,
    daysListEl,
    el("h2", { textContent: "Not planned" }),
    unplannedEl,
    exportSectionHolder
  );

  function nextOrder() {
    return days.length > 0 ? Math.max(...days.map((d) => d.order ?? 0)) + 1 : 0;
  }

  createDaysBtn.addEventListener("click", async () => {
    loadErrorEl.replaceChildren();
    try {
      let order = nextOrder();
      const stops = chosenStops(trip, myUid, flights, options, airports);
      if (stops.length > 0) {
        const missing = missingDays(days, daysFromStops(stops));
        for (const day of missing) {
          await addDay(tripId, { date: day.date, cityKey: day.cityKey, title: day.title, focus: "", notes: "", order }, myUid);
          order += 1;
        }
      } else {
        if (!trip.startDate || !trip.endDate) return;
        const existingDates = new Set(days.map((d) => d.date).filter(Boolean));
        const missingDates = datesBetween(trip.startDate, trip.endDate).filter((d) => !existingDates.has(d));
        for (const date of missingDates) {
          await addDay(tripId, { date, title: "", focus: "", notes: "", order }, myUid);
          order += 1;
        }
      }
    } catch (err) {
      onError(err);
    }
  });

  addDayBtn.addEventListener("click", async () => {
    try {
      await addDay(tripId, { date: null, title: "", focus: "", notes: "", order: nextOrder() }, myUid);
    } catch (err) {
      onError(err);
    }
  });

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
      const confirmed = await confirmDialog(`Delete ${dayLabel(day)}? Its places go back to Not planned.`, "Delete");
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
      const upBtn = el("button", {
        type: "button",
        className: "btn btn-link",
        textContent: "▲",
        disabled: index === 0,
        attrs: { "aria-label": `Move ${place.name} up` },
      });
      upBtn.addEventListener("click", () => movePlace(dayPlaces, index, -1));
      const downBtn = el("button", {
        type: "button",
        className: "btn btn-link",
        textContent: "▼",
        disabled: index === dayPlaces.length - 1,
        attrs: { "aria-label": `Move ${place.name} down` },
      });
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
      dayPlaces.length === 0
        ? el("p", { className: "empty-state", textContent: "No places yet. Tap a pin on the map, or add one from Not planned, below." })
        : el("ul", { className: "day-places" }, placeRows),
      routeLinks.length > 0 ? routeEl : null,
      errorHolder,
    ].filter(Boolean));
  }

  function buildAddToDaySelect(place, daysInCity) {
    const select = el("select", {}, [
      el("option", { value: "", textContent: "Add to day…" }),
      ...daysInCity.map((d) => el("option", { value: d.id, textContent: d.label })),
    ]);
    select.addEventListener("change", async () => {
      const dayId = select.value;
      if (!dayId) return;
      const countInDay = scopedPlaces.filter((p) => p.dayId === dayId).length;
      try {
        await updatePlace(tripId, place.id, { dayId, dayOrder: countInDay });
      } catch (err) {
        onError(err);
      }
    });
    return select;
  }

  function unplannedRow(place, daysInCity) {
    const happening = days.some((d) => d.date && rangesOverlap(place.eventStart, place.eventEnd, d.date, d.date));
    return el("li", { className: "unplanned-row" }, [
      el("span", { textContent: place.name }),
      el("span", { className: "muted", textContent: voteSummary(place.votes || {}) || "Not ranked yet" }),
      happening ? el("span", { className: "badge-new-low", textContent: "Happening this day" }) : null,
      buildAddToDaySelect(place, daysInCity),
    ].filter(Boolean));
  }

  function unplannedSection(title, list, daysInCity) {
    return el("div", { className: "unplanned-group" }, [
      el("h4", { textContent: title }),
      el("ul", { className: "unplanned-list" }, list.map((place) => unplannedRow(place, daysInCity))),
    ]);
  }

  /** Loved places not yet on a day come first (T27); the rest group by
   * neighborhood, as before. Scoped to the selected day's city when there is
   * one, else the whole trip (no route chosen yet). */
  function renderUnplanned(cityPlaces, daysInCity) {
    const unplanned = sortByRank(cityPlaces.filter((p) => p.dayId == null));
    if (unplanned.length === 0) {
      unplannedEl.replaceChildren(el("p", { className: "empty-state", textContent: "Nothing here yet — places without a day show up here." }));
      return;
    }
    const loved = unplanned.filter((p) => voteCounts(p.votes || {}).love > 0);
    const lovedIds = new Set(loved.map((p) => p.id));
    const rest = unplanned.filter((p) => !lovedIds.has(p.id));
    const groups = new Map();
    for (const place of rest) {
      const key = place.neighborhood || "No neighborhood";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(place);
    }
    const groupKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    const sections = [];
    if (loved.length > 0) sections.push(unplannedSection("Loved", loved, daysInCity));
    for (const key of groupKeys) sections.push(unplannedSection(key, groups.get(key), daysInCity));
    unplannedEl.replaceChildren(...sections);
  }

  function renderDays() {
    if (!trip) return;
    // Every place belongs to the trip's one route now (T23 dropped destination
    // ideas); the Map tab already treats the whole list this way.
    scopedPlaces = places;

    const stops = chosenStops(trip, myUid, flights, options, airports);
    createDaysBtn.textContent = stops.length > 0 ? "Create days from route" : "Create days from trip dates";
    createDaysBtn.disabled = stops.length === 0 && (!trip.startDate || !trip.endDate);

    const sorted = [...days].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!selectedDayId || !sorted.some((d) => d.id === selectedDayId)) selectedDayId = sorted[0] ? sorted[0].id : null;

    if (sorted.length === 0) {
      daysListEl.replaceChildren(
        el("p", { className: "empty-state", textContent: "No days yet. Use Create days from route (or from trip dates), or Add day to start one." })
      );
    } else {
      daysListEl.replaceChildren(...sorted.map(renderDayCard));
    }

    const selectedDay = sorted.find((d) => d.id === selectedDayId) || null;
    const cityKey = selectedDay ? selectedDay.cityKey || null : null;
    const daysInCity = sorted.filter((d) => (d.cityKey || null) === cityKey).map((d, i) => ({ id: d.id, label: dayLabel(d), color: dayColor(i) }));
    const cityPlaces = cityKey ? scopedPlaces.filter((p) => p.stopKey === cityKey) : scopedPlaces;

    daysMapSection.render(cityPlaces, daysInCity, selectedDay ? selectedDay.id : null);
    renderUnplanned(cityPlaces, daysInCity);
    const chosenStays = stays.filter((s) => chosenStayIds(trip).includes(s.id));
    exportSectionHolder.replaceChildren(renderExportSection({ trip, places: scopedPlaces, days, chosenStays }));
  }

  const unsubTrip = watchTrip(tripId, (t) => { trip = t; renderDays(); }, onError);
  const unsubPlaces = watchPlaces(tripId, (p) => { places = p; if (trip) renderDays(); }, onError);
  const unsubDays = watchDays(tripId, (d) => { days = d; if (trip) renderDays(); }, onError);
  const unsubFlights = watchFlights(tripId, (f) => { flights = f; if (trip) renderDays(); }, onError);
  const unsubOptions = watchOptions(tripId, (o) => { options = o; if (trip) renderDays(); }, onError);
  const unsubStays = watchStays(tripId, (s) => { stays = s; if (trip) renderDays(); }, onError);

  loadAirports()
    .then((loaded) => { airports = loaded; if (trip) renderDays(); })
    .catch(onError);

  return () => {
    unsubTrip();
    unsubPlaces();
    unsubDays();
    unsubFlights();
    unsubOptions();
    unsubStays();
    daysMapSection.destroy();
  };
}
