import {
  watchTrip,
  watchUsers,
  watchFlights,
  watchIdeas,
  watchOptions,
  updateOption,
  setChoice,
  setForTravelers,
  setFlightPicked,
  setLocalIdea,
  addPastedFlight,
  updateFlight,
  deleteFlight,
  updateTravelers,
} from "../store.js";
import { el, confirmDialog, friendlyError, renderWhenIdle } from "../ui.js";
import { loadAirports } from "../lookup.js";
import { totalFor, optionAutoName, directionsToClear } from "../lib/route.js";
import { choiceFor, budgetContext, travelerBreakdown, localIdeaInfo, localRoute } from "../lib/choices.js";
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
  renderSummaryBar,
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
  let forEditingId = null;

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const travelerSwitchEl = el("div", { className: "seg", attrs: { role: "group", "aria-label": "Traveler" } });
  const ideaSwitchEl = el("div", { className: "seg", attrs: { role: "group", "aria-label": "Idea" } });
  const ideaActionsEl = el("div", { className: "route-idea-actions" });
  const homeFlightsSectionEl = el("div", { className: "route-home card" });
  const optionsListEl = el("div", { className: "route-options-list" });
  const addIdeaBtn = el("button", { type: "button", className: "btn btn-small", textContent: "+ Idea" });
  addIdeaBtn.addEventListener("click", () => onAddIdea());
  const addOptionBtn = el("button", { type: "button", className: "btn btn-small", textContent: "+ Option" });
  const earlierFlightsEl = el("div", { className: "route-earlier", hidden: true });
  const summaryEl = el("div", { className: "route-summary", attrs: { "aria-live": "polite" } });

  const mainWrap = el("div", { className: "routes-main" }, [
    el("div", { className: "who" }, [el("span", { className: "label", textContent: "Flights from home for" }), travelerSwitchEl]),
    el("section", {}, [
      el("div", { className: "row" }, [el("h2", { textContent: "Ideas for this window" }), addIdeaBtn]),
      ideaSwitchEl,
      ideaActionsEl,
    ]),
    homeFlightsSectionEl,
    el("section", {}, [el("div", { className: "row" }, [el("h2", { textContent: "Options once you land" }), addOptionBtn]), optionsListEl]),
    summaryEl,
  ]);
  const pasteEmptyBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Paste flight link" });
  pasteEmptyBtn.addEventListener("click", () => onPasteHomeFlight());
  const addIdeaEmptyBtn = el("button", { type: "button", className: "btn btn-small", textContent: "+ Idea" });
  addIdeaEmptyBtn.addEventListener("click", () => onAddIdea());
  const emptyWrap = el("div", { className: "card" }, [
    el("p", { className: "empty-state", textContent: "No ideas yet. Paste a flight link to start, or add an idea yourself." }),
    el("div", { className: "route-idea-actions" }, [pasteEmptyBtn, addIdeaEmptyBtn]),
  ]);
  mainWrap.hidden = true;

  container.replaceChildren(loadErrorEl, mainWrap, emptyWrap, earlierFlightsEl);

  // The summary bar is sticky and floats over whatever is last in the flow
  // (T44); keep that much room below it so the last card can scroll clear.
  const summaryResizeObserver = new ResizeObserver(() => {
    mainWrap.style.paddingBottom = summaryEl.hidden ? "" : `${summaryEl.offsetHeight}px`;
  });
  summaryResizeObserver.observe(summaryEl);

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

  /** Opens the Paste flight link sheet (T34) from the home-flights card: a
   * home flight for the traveler and idea currently selected. With no ideas
   * yet, this creates the first one from the flight pasted. */
  function onPasteHomeFlight() {
    return run(async () => {
      const traveler = travelers().find((t) => t.id === selectedTravelerId);
      if (!traveler) {
        onError("Add a traveler on Overview first.");
        return;
      }
      const idea = ideas.find((i) => i.id === selectedIdeaId);
      const target = {
        role: "home",
        ideaId: idea ? idea.id : null,
        ideaName: idea ? idea.name : null,
        homeFlights: idea ? homeFlightsFor(idea.id, traveler.id) : [],
      };
      const result = await pasteFlightDialog({ target, traveler, trip, airports, myUid });
      if (!result) return;
      await savePastedFlight(result, traveler);
    });
  }

  /** Opens the Paste flight link sheet (T34) from inside an open option: a
   * hop, always added to that option, however many it already holds. */
  function onPasteHopFlight(option) {
    return run(async () => {
      const target = {
        role: "hop",
        ideaId: option.ideaId,
        optionId: option.id,
        optionName: option.name,
        hopFlightsCount: hopFlightsFor(option.id).length,
      };
      const result = await pasteFlightDialog({ target, traveler: null, trip, airports, myUid });
      if (!result) return;
      await savePastedFlight(result, null);
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
    addIdeaBtn.disabled = true;
    addIdeaEmptyBtn.disabled = true;
    return run(async () => {
      const ref = await addIdeaDialog(tripId, ideas, myUid);
      if (ref) selectedIdeaId = ref.id;
    }).finally(() => {
      addIdeaBtn.disabled = false;
      addIdeaEmptyBtn.disabled = false;
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

  /** The traveler on screen chooses (or unchooses) this option — theirs only (§7.6). */
  function onChooseOption(option, traveler) {
    const chosen = choiceFor(trip, traveler.id, options).optionId;
    return run(() => setChoice(tripId, traveler.id, { optionId: chosen === option.id ? null : option.id }));
  }

  /** The traveler on screen chooses (or unchooses) this idea — theirs only,
   * and apart from their option (§7.6). Unchoosing it also drops an option
   * under it, which would otherwise keep the idea looking chosen (§11). */
  function onChooseIdea(idea, traveler) {
    if (!traveler) return Promise.resolve();
    const current = choiceFor(trip, traveler.id, options);
    if (current.ideaId !== idea.id) return run(() => setChoice(tripId, traveler.id, { ideaId: idea.id }));
    const optionHere = options.some((o) => o.id === current.optionId && o.ideaId === idea.id);
    return run(() => setChoice(tripId, traveler.id, optionHere ? { ideaId: null, optionId: null } : { ideaId: null }));
  }

  /** The traveler on screen ticks (or unticks) **I live here** for this idea
   * (§7.6) — theirs only. Returns a message for the toggle to show inline
   * instead of the banner, since the toggle is where the tap happened. */
  async function onToggleLocal(idea, traveler, on) {
    try {
      await setLocalIdea(tripId, traveler.id, idea.id, on);
      return null;
    } catch (err) {
      return friendlyError(err);
    }
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
        localInfo: localIdeaInfo({ traveler, trip, ideaId: idea.id, flights, airports }),
        onToggleLocal: (on) => onToggleLocal(idea, traveler, on),
        onEdit: (flight) => onEditFlight(flight, traveler),
        onDelete: onDeleteFlight,
        onTogglePick: toggleUseThisFlight,
        onPasteFlight: onPasteHomeFlight,
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

    const ctx = budgetContext({ trip, travelers: travelers(), options, flights, airports });
    // Null unless the traveler on screen lives in this idea's city, when their
    // rail runs on the group's dates instead of flights they don't need (§7.6).
    const local = localRoute({ traveler, trip, ideaId: idea.id, flights, airports });
    const totalsCents = ideaOptions.map((o) => totalFor({ homeFlights: [], hopFlights: hopFlightsFor(o.id) }).cents);
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
          ctx,
          travelers: travelers(),
          othersChosen: travelers().filter((t) => t.id !== traveler.id && ctx.choices[t.id].optionId === option.id),
          forEditingId,
          isOpen: openOptionIds.has(option.id),
          local,
          isChosen: ctx.choices[traveler.id].optionId === option.id,
          isCheapest: cheapestCents !== null && totalsCents[i] === cheapestCents,
          onToggle: () => {
            if (openOptionIds.has(option.id)) openOptionIds.delete(option.id);
            else openOptionIds.add(option.id);
            renderDynamicSections();
          },
          onToggleFor: (flight) => {
            forEditingId = forEditingId === flight.id ? null : flight.id;
            renderDynamicSections();
          },
          onSetFor: (flight, ids) => run(() => setForTravelers(tripId, "flights", flight.id, ids)),
          onChoose: () => onChooseOption(option, traveler),
          onRename: () => run(() => renameOptionDialog(tripId, option)),
          onDelete: () => onDeleteOption(option),
          onPasteFlight: () => onPasteHopFlight(option),
          onEditFlight: (flight) => onEditFlight(flight, null),
          onDeleteFlight: (flight) => onDeleteFlight(flight),
        })
      )
    );
  }

  function renderSummary() {
    const traveler = travelers().find((t) => t.id === selectedTravelerId);
    summaryEl.hidden = !traveler || !airports;
    if (summaryEl.hidden) return;
    const ctx = budgetContext({ trip, travelers: travelers(), options, flights, airports });
    const breakdown = travelerBreakdown({ travelerId: traveler.id, ctx, flights, stays: [], costs: [] });
    renderSummaryBar(summaryEl, { traveler, breakdown, hasIdea: Boolean(ctx.choices[traveler.id].ideaId), currency: trip.currency });
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
      chosenIdeaId: selectedTravelerId ? choiceFor(trip, selectedTravelerId, options).ideaId : null,
      onSelect: (id) => {
        selectedIdeaId = id;
        renderDynamicSections();
      },
      onChoose: (idea) => onChooseIdea(idea, travelers().find((t) => t.id === selectedTravelerId)),
      onRename: (idea) => run(() => renameIdeaDialog(tripId, idea)),
      onDelete: (idea) => run(() => deleteIdeaDialog(tripId, idea)),
    });
    renderHomeFlightsCard();
    renderOptionsList();
    renderSummary();
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
    summaryResizeObserver.disconnect();
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}
