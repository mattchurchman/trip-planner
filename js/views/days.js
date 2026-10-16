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
import { el, icon, confirmDialog, friendlyError, field, dialogShell, menuButton } from "../ui.js";
import { openExportSheet } from "./exportSection.js";
import { renderTimeline, openNotPlannedSheet } from "./dayTimeline.js";
import { walkingRouteLinks } from "../lib/links.js";
import { datesBetween, daysFromStops, missingDays, stayForDate } from "../lib/dayplan.js";
import { mergedStops } from "../lib/choices.js";
import { formatLegDate } from "../lib/itineraryFormat.js";
import { createDaysMap } from "./daysMap.js";
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

/** "<title> · <Sat 17 Oct>" when a day has both; the date alone with no
 * title, the title alone when undated (T50, §7.8). Used for the Edit/Delete
 * menu's `aria-label` and the pin sheet's per-day buttons — the day
 * chooser's own chips and the focused day's h1 use `dayWeekday`/`dayHeading`
 * instead (T64, R7 §7 Days). */
function dayLabel(day) {
  const dateLabel = formatLegDate(day.date);
  if (day.title && dateLabel) return `${day.title} · ${dateLabel}`;
  return day.title || dateLabel || "Undated day";
}

/** `{ weekday, dateNum }` from a day's date ("Sat", "17"), or null undated. */
function dayWeekday(date) {
  const formatted = formatLegDate(date);
  if (!formatted) return null;
  const [weekday, dateNum] = formatted.split(" ");
  return { weekday, dateNum };
}

/** The focused day's h1 (R7 §7 Days (b)): "{Weekday} · {city}" when both are
 * known, whichever one isn't otherwise, else its title or "Undated day". */
function dayHeading(day, stops) {
  const weekday = dayWeekday(day.date)?.weekday || null;
  const stop = day.cityKey ? (stops || []).find((s) => s.cityKey === day.cityKey) : null;
  const city = stop ? stop.city : day.title || null;
  if (weekday && city) return `${weekday} · ${city}`;
  return weekday || city || "Undated day";
}

/** The merged route's stops — everyone's, merged into one (§11) — which is the
 * raw material `daysFromStops` turns into one day per date (T27, V4 §8).
 * Carries each stop's coordinates (T50) so a day's home stay can be checked
 * against its own city rather than one from elsewhere in the trip. */
function chosenStops(trip, flights, options, airports) {
  if (!airports) return [];
  const stops = mergedStops({ travelers: trip.travelers || [], trip, options, flights, airports });
  return stops.map((stop) => {
    const info = stop.code ? airports.info(stop.code) : null;
    const located = info && typeof info === "object";
    return { ...stop, lat: located ? info.lat : null, lng: located ? info.lng : null };
  });
}

/** The day chooser's 58px chip (R7 §7 Days (a)): weekday + date number, or
 * "Day {n}" undated. `dashed` marks a route date with no day yet. */
function dayChip({ top, num, dashed = false, selected = false }, onClick) {
  const btn = el(
    "button",
    {
      type: "button",
      className: `day-chip${dashed ? " day-chip-dashed" : ""}${selected ? " day-chip-selected" : ""}`,
      attrs: { "aria-pressed": selected ? "true" : "false" },
    },
    [el("span", { className: "day-chip-top", textContent: top }), el("span", { className: "day-chip-num", textContent: num })]
  );
  btn.addEventListener("click", onClick);
  return btn;
}

/** Renders the Days tab (T27/T64, V4 §8, R7 §7 Days): a day chooser, that
 * day's map and numbered timeline, and Export. Returns a single unsubscribe
 * function. */
export function renderDaysPage(container, tripId, myUid) {
  let trip = null;
  let places = [];
  let days = [];
  let flights = [];
  let options = [];
  let stays = [];
  let airports = null;
  let selectedDayId = null;

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const onError = (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));

  const chooserEl = el("div", { className: "day-chooser" });
  const addDayChip = el("button", { type: "button", className: "day-chip day-chip-add", attrs: { "aria-label": "Add day" } }, [icon("plus", { size: 20 })]);
  const exportBtn = el("button", { type: "button", className: "icon-btn", attrs: { "aria-label": "Export" } }, [icon("download", { size: 20 })]);
  const daysHeaderEl = el("div", { className: "days-header" }, [chooserEl, exportBtn]);

  const createDaysBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Create days from trip dates" });
  const emptyStateEl = el("div", { className: "card" }, [
    el("p", { className: "empty-state", textContent: "No days yet. Use Create days from route (or from trip dates) to start." }),
    createDaysBtn,
  ]);

  const daysMapSection = createDaysMap({
    onAssign: async (place, dayId) => {
      const countInDay = places.filter((p) => p.dayId === dayId).length;
      await updatePlace(tripId, place.id, { dayId, dayOrder: countInDay });
    },
    onRemove: async (place) => {
      await updatePlace(tripId, place.id, { dayId: null, dayOrder: null });
    },
  });

  const dayTitleEl = el("h1", { className: "day-focus-title" });
  const daySubtitleEl = el("p", { className: "muted" });
  const walkWrapEl = el("div", { className: "day-routes" });
  const dayMenuHolder = el("div", {});
  const timelineHolder = el("div", {});
  const notPlannedBtn = el("button", { type: "button", className: "btn btn-small btn-dashed" });

  const dayFocusEl = el("section", { className: "day-focus", hidden: true }, [
    daysMapSection.element,
    el("div", { className: "day-focus-header" }, [
      el("div", {}, [dayTitleEl, daySubtitleEl]),
      el("div", { className: "day-focus-actions" }, [walkWrapEl, dayMenuHolder]),
    ]),
    timelineHolder,
    notPlannedBtn,
  ]);

  container.replaceChildren(loadErrorEl, daysHeaderEl, emptyStateEl, dayFocusEl);

  function nextOrder() {
    return days.length > 0 ? Math.max(...days.map((d) => d.order ?? 0)) + 1 : 0;
  }

  async function createDaysFromRouteOrDates(stops) {
    try {
      let order = nextOrder();
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
  }
  createDaysBtn.addEventListener("click", () => createDaysFromRouteOrDates(chosenStops(trip, flights, options, airports)));

  addDayChip.addEventListener("click", async () => {
    try {
      const ref = await addDay(tripId, { date: null, title: "", focus: "", notes: "", order: nextOrder() }, myUid);
      selectedDayId = ref.id;
    } catch (err) {
      onError(err);
    }
  });

  async function movePlace(dayPlaces, place, direction) {
    const index = dayPlaces.indexOf(place);
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= dayPlaces.length) return;
    const reordered = [...dayPlaces];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    try {
      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].dayOrder !== i) await updatePlace(tripId, reordered[i].id, { dayOrder: i });
      }
    } catch (err) {
      onError(err);
    }
  }

  async function removeFromDay(place) {
    try {
      await updatePlace(tripId, place.id, { dayId: null, dayOrder: null });
    } catch (err) {
      onError(err);
    }
  }

  exportBtn.addEventListener("click", () => {
    const chosenStays = stays.filter((s) => chosenStayIds(trip).includes(s.id));
    openExportSheet({ trip, places, days, chosenStays, myMapsUrl: trip.myMapsUrl });
  });

  function dayMenu(day, dayPlaces) {
    return menuButton(
      [
        {
          label: "Edit day",
          icon: "edit",
          onSelect: async () => {
            const result = await dayFormDialog(day);
            if (!result) return;
            try {
              await updateDay(tripId, day.id, result);
            } catch (err) {
              onError(err);
            }
          },
        },
        {
          label: "Delete day",
          icon: "trash",
          danger: true,
          onSelect: async () => {
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
              onError(err);
            }
          },
        },
      ],
      { label: `More actions for ${dayLabel(day)}` }
    );
  }

  /** Builds the day chooser row: existing days as chips, route dates with no
   * day yet as dashed chips that create one (T64, R7 §7 Days (a)). */
  function renderChooser(sorted, missing) {
    const dayButtons = sorted.map((day, index) => {
      const weekday = dayWeekday(day.date);
      return dayChip(
        { top: weekday ? weekday.weekday : "Day", num: weekday ? weekday.dateNum : String(index + 1), selected: day.id === selectedDayId },
        () => {
          selectedDayId = day.id;
          renderDays();
        }
      );
    });
    const missingButtons = missing.map((spec) => {
      const weekday = dayWeekday(spec.date) || { weekday: "", dateNum: "?" };
      return dayChip({ top: weekday.weekday, num: weekday.dateNum, dashed: true }, async () => {
        try {
          const order = nextOrder();
          const ref = await addDay(tripId, { date: spec.date, cityKey: spec.cityKey, title: spec.title, focus: "", notes: "", order }, myUid);
          selectedDayId = ref.id;
        } catch (err) {
          onError(err);
        }
      });
    });
    chooserEl.replaceChildren(...dayButtons, ...missingButtons, addDayChip);
  }

  function renderDayFocus(day, stops, chosenStaysList) {
    const dayPlaces = places.filter((p) => p.dayId === day.id).sort((a, b) => (a.dayOrder ?? 0) - (b.dayOrder ?? 0));
    const homeStay = stayForDate(day.date, chosenStaysList, day.cityKey, stops);
    const cityPlaces = day.cityKey ? places.filter((p) => p.stopKey === day.cityKey) : places;
    const daysInCity = days
      .filter((d) => (d.cityKey || null) === (day.cityKey || null))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((d) => ({ id: d.id, label: dayLabel(d) }));

    dayTitleEl.textContent = dayHeading(day, stops);
    const count = dayPlaces.length;
    const countLabel = `${count} place${count === 1 ? "" : "s"}`;
    daySubtitleEl.textContent = day.focus ? `${day.focus} · ${countLabel}` : countLabel;

    walkWrapEl.replaceChildren(
      ...walkingRouteLinks(dayPlaces, homeStay).map((link) =>
        el("a", { href: link.url, target: "_blank", rel: "noopener noreferrer", className: "btn btn-secondary btn-small" }, [
          icon("routes", { size: 16 }),
          link.label,
        ])
      )
    );
    dayMenuHolder.replaceChildren(dayMenu(day, dayPlaces));

    timelineHolder.replaceChildren(
      renderTimeline(dayPlaces, {
        onMove: (place, direction) => movePlace(dayPlaces, place, direction),
        onRemove: (place) => removeFromDay(place),
      })
    );

    const unplanned = cityPlaces.filter((p) => p.dayId == null);
    notPlannedBtn.textContent = `+ Add from not planned · ${unplanned.length}`;
    notPlannedBtn.onclick = () =>
      openNotPlannedSheet(unplanned, {
        onAdd: (place) => updatePlace(tripId, place.id, { dayId: day.id, dayOrder: places.filter((p) => p.dayId === day.id).length }),
      });

    daysMapSection.render(cityPlaces, daysInCity, day.id, homeStay);
  }

  function renderDays() {
    if (!trip) return;
    const stops = chosenStops(trip, flights, options, airports);
    const chosenStaysList = stays.filter((s) => chosenStayIds(trip).includes(s.id));

    const sorted = [...days].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (sorted.length === 0) {
      createDaysBtn.textContent = stops.length > 0 ? "Create days from route" : "Create days from trip dates";
      createDaysBtn.disabled = stops.length === 0 && (!trip.startDate || !trip.endDate);
      emptyStateEl.hidden = false;
      chooserEl.hidden = true;
      dayFocusEl.hidden = true;
    } else {
      emptyStateEl.hidden = true;
      chooserEl.hidden = false;
      dayFocusEl.hidden = false;
      if (!selectedDayId || !sorted.some((d) => d.id === selectedDayId)) selectedDayId = sorted[0].id;
      const missing = missingDays(days, daysFromStops(stops));
      renderChooser(sorted, missing);
      renderDayFocus(sorted.find((d) => d.id === selectedDayId), stops, chosenStaysList);
    }
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
