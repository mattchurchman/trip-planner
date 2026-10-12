import {
  watchTrip,
  watchUsers,
  watchFlights,
  watchIdeas,
  watchOptions,
  updateOption,
  setChosenOption,
  setFlightPicked,
  addPastedFlight,
  updateFlight,
  deleteFlight,
  updateTravelers,
} from "../store.js";
import { el, confirmDialog, friendlyError, renderWhenIdle, readClipboardText } from "../ui.js";
import { loadAirports } from "../lookup.js";
import { totalFor, optionAutoName, directionsToClear } from "../lib/route.js";
import { editFlightFormDialog } from "./flightForm.js";
import { pasteFlightDialog, moveFlightDialog, renderEarlierFlights } from "./pasteFlight.js";
import { renderOptionCard, homeFlightsCardBody } from "./routeRail.js";
import {
  addIdeaDialog,
  renameIdeaDialog,
  deleteIdeaDialog,
  addOptionDialog,
  renameOptionDialog,
  deleteOptionDialog,
  renderTravelerSwitch,
  renderIdeaSwitch,
} from "./routeIdeas.js";

/** Renders the Routes tab (V4 §4). Returns a single unsubscribe function. */
export function renderRoutesPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let flights = [];
  let ideas = [];
  let options = [];
  let airports = null;

  // Remembered in memory only (V4 §4.6), not written to the trip — resets
  // whenever this view is left and reopened.
  let selectedTravelerId = null;
  let selectedIdeaId = null;
  const openOptionIds = new Set();

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const travelerSwitchEl = el("div", { className: "seg", attrs: { role: "group", "aria-label": "Traveler" } });
  const ideaSwitchEl = el("div", { className: "seg", attrs: { role: "group", "aria-label": "Idea" } });
  const ideaActionsEl = el("div", { className: "route-idea-actions" });
  const homeFlightsSectionEl = el("div", { className: "route-home card" });
  const optionsListEl = el("div", { className: "route-options-list" });
  const addIdeaBtn = el("button", { type: "button", className: "btn btn-small", textContent: "+ Idea" });
  const addOptionBtn = el("button", { type: "button", className: "btn btn-small", textContent: "+ Option" });
  const earlierFlightsEl = el("div", { className: "route-earlier", hidden: true });

  const pasteTopBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Paste flight link" });
  pasteTopBtn.addEventListener("click", () => onPasteFlight(null));

  const mainWrap = el("div", { className: "routes-main" }, [
    el("div", { className: "row" }, [el("h2", { textContent: "Add a flight" }), pasteTopBtn]),
    el("div", { className: "who" }, [el("span", { className: "label", textContent: "Flights from home for" }), travelerSwitchEl]),
    el("section", {}, [
      el("div", { className: "row" }, [el("h2", { textContent: "Ideas for this window" }), addIdeaBtn]),
      ideaSwitchEl,
      ideaActionsEl,
    ]),
    homeFlightsSectionEl,
    el("section", {}, [el("div", { className: "row" }, [el("h2", { textContent: "Options once you land" }), addOptionBtn]), optionsListEl]),
  ]);
  const pasteEmptyBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Paste flight link" });
  pasteEmptyBtn.addEventListener("click", () => onPasteFlight(null));
  const addIdeaEmptyBtn = el("button", { type: "button", className: "btn btn-small", textContent: "+ Idea" });
  addIdeaEmptyBtn.addEventListener("click", () => onAddIdea());
  const emptyWrap = el("div", { className: "card" }, [
    el("p", { className: "empty-state", textContent: "No ideas yet. Paste a flight link to start, or add an idea yourself." }),
    el("div", { className: "route-idea-actions" }, [pasteEmptyBtn, addIdeaEmptyBtn]),
  ]);
  mainWrap.hidden = true;

  container.replaceChildren(loadErrorEl, mainWrap, emptyWrap, earlierFlightsEl);

  function onError(message) {
    loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
  }

  /** Runs a write, routing any failure to the error banner — the one place
   * every handler below reports an error, so each stays a single try-free line. */
  async function run(action) {
    try {
      await action();
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  function travelers() {
    return trip?.travelers || [];
  }

  function homeFlightsFor(ideaId, travelerId) {
    return flights.filter((f) => f.role === "home" && f.ideaId === ideaId && f.travelerId === travelerId);
  }

  function hopFlightsFor(optionId) {
    return flights.filter((f) => f.role === "hop" && f.optionId === optionId);
  }

  function toggleUseThisFlight(flight, siblings) {
    if (flight.picked !== false) return run(() => setFlightPicked(tripId, flight.id, false));
    const clearSet = new Set(directionsToClear(flight.direction));
    const toClear = siblings.filter((f) => f.id !== flight.id && f.picked !== false && clearSet.has(f.direction));
    return run(() => Promise.all([...toClear.map((f) => setFlightPicked(tripId, f.id, false)), setFlightPicked(tripId, flight.id, true)]));
  }

  function onEditFlight(flight, traveler) {
    return run(async () => {
      const result = await editFlightFormDialog(flight, traveler, trip);
      if (result) await updateFlight(tripId, flight.id, result);
    });
  }

  function onDeleteFlight(flight) {
    return run(async () => {
      if (await confirmDialog("Delete this flight?", "Delete")) await deleteFlight(tripId, flight.id);
    });
  }

  /** Opens the Paste flight link sheet (V4 §4.5) for the traveler currently
   * selected. `defaultOptionId` pins the hop target when this was pressed
   * inside an already-open option; null means "work it out" (the idea's
   * first option, or a new one named after the hop). */
  function onPasteFlight(defaultOptionId) {
    return run(async () => {
      const traveler = travelers().find((t) => t.id === selectedTravelerId);
      if (!traveler) {
        onError("Add a traveler on Overview first.");
        return;
      }
      const homeFlightsByIdea = {};
      for (const idea of ideas) homeFlightsByIdea[idea.id] = homeFlightsFor(idea.id, traveler.id);
      const clipboardText = await readClipboardText();
      const result = await pasteFlightDialog({
        clipboardText,
        traveler,
        trip,
        airports,
        ideas,
        options,
        flights,
        homeFlightsByIdea,
        currentIdeaId: selectedIdeaId,
        defaultOptionId,
        myUid,
      });
      if (!result) return;
      await savePastedFlight(result, traveler);
    });
  }

  /** Saves what the paste sheet resolved: creates the idea and/or option in
   * the same batch when they're new, and learns the traveler's home airport
   * the one time §4.5 step 3 calls for it. */
  async function savePastedFlight(result, traveler) {
    if (result.homeAirport && !traveler.homeAirport) {
      await updateTravelers(tripId, travelers().map((t) => (t.id === traveler.id ? { ...t, homeAirport: result.homeAirport } : t)));
    }

    const newFlight = { ...result.flight, travelerId: result.travelerId, picked: result.picked };
    const saved = await addPastedFlight(tripId, { flight: newFlight, idea: result.idea, option: result.option }, myUid);

    selectedIdeaId = saved.ideaId;
    if (saved.optionId) {
      openOptionIds.add(saved.optionId);
      await renameOptionForItsHops(saved, newFlight);
    }
  }

  /** A hop joining an option it didn't name yet widens that name (V4 §4.4):
   * "Florence" becomes "Florence + Barcelona". Options someone has renamed by
   * hand, and ones this paste just created, are left as they are. */
  async function renameOptionForItsHops(saved, newFlight) {
    const option = options.find((o) => o.id === saved.optionId);
    if (!option || !airports) return;
    const name = optionAutoName({
      option,
      hopFlights: [...hopFlightsFor(option.id), newFlight],
      homeFlights: homeFlightsFor(saved.ideaId, selectedTravelerId),
      airports,
    });
    if (name) await updateOption(tripId, option.id, { name, nameEdited: false });
  }

  function onMoveFlight(flight) {
    return run(async () => {
      const result = await moveFlightDialog({ flight, travelers: travelers(), ideas, options, airports });
      if (result) await updateFlight(tripId, flight.id, result);
    });
  }

  function onAddIdea() {
    return run(async () => {
      const ref = await addIdeaDialog(tripId, ideas, myUid);
      if (ref) selectedIdeaId = ref.id;
    });
  }

  function onAddOption(idea) {
    return run(async () => {
      const ref = await addOptionDialog(tripId, idea, options.filter((o) => o.ideaId === idea.id), myUid);
      if (ref) openOptionIds.add(ref.id);
    });
  }

  function onDeleteOption(option) {
    return run(async () => {
      if (await deleteOptionDialog(tripId, option)) openOptionIds.delete(option.id);
    });
  }

  function onChooseOption(option) {
    return run(() => setChosenOption(tripId, trip.chosenOptionId === option.id ? null : option.id));
  }

  function renderHomeFlightsCard() {
    const traveler = travelers().find((t) => t.id === selectedTravelerId);
    const idea = ideas.find((i) => i.id === selectedIdeaId);
    if (!airports || !traveler || !idea) {
      homeFlightsSectionEl.replaceChildren(el("p", { className: "muted", textContent: !airports ? "Loading…" : "Add a traveler on Overview first." }));
      return;
    }
    homeFlightsSectionEl.replaceChildren(
      ...homeFlightsCardBody({
        traveler,
        homeFlights: homeFlightsFor(idea.id, traveler.id),
        trip,
        tripId,
        myUid,
        usersById,
        onEdit: (flight) => onEditFlight(flight, traveler),
        onDelete: onDeleteFlight,
        onTogglePick: toggleUseThisFlight,
      })
    );
  }

  function renderOptionsList() {
    const idea = ideas.find((i) => i.id === selectedIdeaId);
    const traveler = travelers().find((t) => t.id === selectedTravelerId);
    addOptionBtn.onclick = idea ? () => onAddOption(idea) : null;
    if (!idea || !traveler || !airports) {
      optionsListEl.replaceChildren();
      return;
    }
    const travelerHomeFlights = homeFlightsFor(idea.id, traveler.id);
    const ideaOptions = options.filter((o) => o.ideaId === idea.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (ideaOptions.length === 0) {
      optionsListEl.replaceChildren(el("p", { className: "empty-state", textContent: "No options yet. Add one above to start building stops." }));
      return;
    }

    const totalsCents = ideaOptions.map((o) => totalFor({ homeFlights: travelerHomeFlights, hopFlights: hopFlightsFor(o.id) }).cents);
    const cheapestCents = ideaOptions.length > 1 ? Math.min(...totalsCents) : null;

    optionsListEl.replaceChildren(
      ...ideaOptions.map((option, i) =>
        renderOptionCard({
          idea,
          option,
          traveler,
          homeFlights: travelerHomeFlights,
          hopFlights: hopFlightsFor(option.id),
          airports,
          trip,
          tripId,
          myUid,
          usersById,
          isOpen: openOptionIds.has(option.id),
          isChosen: trip.chosenOptionId === option.id,
          isCheapest: cheapestCents !== null && totalsCents[i] === cheapestCents,
          onToggle: () => {
            if (openOptionIds.has(option.id)) openOptionIds.delete(option.id);
            else openOptionIds.add(option.id);
            renderDynamicSections();
          },
          onChoose: () => onChooseOption(option),
          onRename: () => run(() => renameOptionDialog(tripId, option)),
          onDelete: () => onDeleteOption(option),
          onPasteFlight: () => onPasteFlight(option.id),
          onEditFlight: (flight) => onEditFlight(flight, null),
          onDeleteFlight: (flight) => onDeleteFlight(flight),
        })
      )
    );
  }

  /** Flights saved before V4 gave flights a `role` (V4 §4.6), shown regardless
   * of whether any idea exists yet, so nothing from before this round goes
   * missing. */
  function renderEarlierFlightsSection() {
    const node = renderEarlierFlights({
      flights,
      trip,
      tripId,
      myUid,
      usersById,
      onMove: onMoveFlight,
      onEdit: (flight) => onEditFlight(flight, null),
      onDelete: (flight) => onDeleteFlight(flight),
    });
    earlierFlightsEl.hidden = !node;
    earlierFlightsEl.replaceChildren(...(node ? [node] : []));
  }

  function renderDynamicSections() {
    if (!trip) return;
    if (!travelers().some((t) => t.id === selectedTravelerId)) {
      selectedTravelerId = (travelers().find((t) => t.uid === myUid) || travelers()[0] || {}).id ?? null;
    }
    renderEarlierFlightsSection();

    if (ideas.length === 0) {
      mainWrap.hidden = true;
      emptyWrap.hidden = false;
      return;
    }
    mainWrap.hidden = false;
    emptyWrap.hidden = true;

    if (!ideas.some((i) => i.id === selectedIdeaId)) {
      selectedIdeaId = ideas[0]?.id ?? null;
    }

    renderTravelerSwitch(travelerSwitchEl, {
      travelers: travelers(),
      selectedTravelerId,
      onSelect: (id) => {
        selectedTravelerId = id;
        renderDynamicSections();
      },
    });
    renderIdeaSwitch(ideaSwitchEl, ideaActionsEl, {
      ideas,
      selectedIdeaId,
      onSelect: (id) => {
        selectedIdeaId = id;
        renderDynamicSections();
      },
      onRename: (idea) => run(() => renameIdeaDialog(tripId, idea)),
      onDelete: (idea) => run(() => deleteIdeaDialog(tripId, idea)),
    });
    renderHomeFlightsCard();
    renderOptionsList();
  }

  function renderAll() {
    renderWhenIdle(mainWrap, renderDynamicSections);
  }

  loadAirports()
    .then((loaded) => {
      airports = loaded;
      renderAll();
    })
    .catch((err) => onError(friendlyError(err)));

  /** Every live feed does the same thing: store its slice, redraw. */
  function feed(watch, store) {
    return watch(
      tripId,
      (value) => {
        store(value);
        renderAll();
      },
      (err) => onError(friendlyError(err))
    );
  }

  const unsubscribes = [
    feed(watchTrip, (v) => (trip = v)),
    feed(watchFlights, (v) => (flights = v)),
    feed(watchIdeas, (v) => (ideas = v)),
    feed(watchOptions, (v) => (options = v)),
    // Names and avatars only, so a failure here isn't worth a banner.
    watchUsers((v) => {
      usersById = v;
      renderAll();
    }, () => {}),
  ];

  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}
