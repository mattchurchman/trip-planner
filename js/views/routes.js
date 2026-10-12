import {
  watchTrip,
  watchUsers,
  watchFlights,
  watchIdeas,
  addIdea,
  updateIdea,
  deleteIdea,
  watchOptions,
  addOption,
  updateOption,
  deleteOption,
  setChosenOption,
  setFlightPicked,
  addFlight,
  updateFlight,
  deleteFlight,
} from "../store.js";
import { el, confirmDialog, promptDialog, friendlyError, setPending, renderWhenIdle } from "../ui.js";
import { loadAirports } from "../lookup.js";
import { latestEntry } from "../lib/totals.js";
import { homeDirection, guessLandsDate, totalFor } from "../lib/route.js";
import { addFlightFormDialog, editFlightFormDialog } from "./flightForm.js";
import { renderFlightRow, renderOptionCard } from "./routeRail.js";

/** Direction groups that conflict with picking `direction` (V4 §4.4): picking
 * a "both" flight replaces any separate out/back picks and vice versa, since
 * they can't both be the way you get there. A flight with no resolved
 * direction (null) stands alone — nothing to clear. */
function directionsToClear(direction) {
  if (direction === "both") return ["out", "back", "both"];
  if (direction === "out" || direction === "back") return [direction, "both"];
  return [direction];
}

function cheapestFirst(a, b) {
  const pa = latestEntry(a.prices)?.amountCents ?? null;
  const pb = latestEntry(b.prices)?.amountCents ?? null;
  if (pa == null && pb == null) return 0;
  if (pa == null) return 1;
  if (pb == null) return -1;
  return pa - pb;
}

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

  const mainWrap = el("div", { className: "routes-main" }, [
    el("div", { className: "who" }, [el("span", { className: "label", textContent: "Flights from home for" }), travelerSwitchEl]),
    el("section", {}, [
      el("div", { className: "row" }, [el("h2", { textContent: "Ideas for this window" }), addIdeaBtn]),
      ideaSwitchEl,
      ideaActionsEl,
    ]),
    homeFlightsSectionEl,
    el("section", {}, [el("div", { className: "row" }, [el("h2", { textContent: "Options once you land" }), addOptionBtn]), optionsListEl]),
  ]);
  const emptyWrap = el("div", { className: "card" }, [
    el("p", { className: "empty-state", textContent: "No ideas yet. Add one to start planning flights." }),
    el("button", { type: "button", className: "btn btn-primary", textContent: "+ Idea" }),
  ]);
  emptyWrap.querySelector("button").addEventListener("click", () => onAddIdea());
  mainWrap.hidden = true;

  container.replaceChildren(loadErrorEl, mainWrap, emptyWrap);

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

  function priceEntryFor(priceAmountCents) {
    return priceAmountCents
      ? { id: crypto.randomUUID(), amountCents: priceAmountCents, checkedAt: new Date().toISOString(), byUid: myUid, note: "" }
      : undefined;
  }

  /** Prompts for a name (defaulting to `defaultName`), falling back to it if
   * the owner clears the field, then hands it to `create`. Null on cancel. */
  async function promptAndCreate(label, defaultName, create) {
    const typed = await promptDialog(label, defaultName);
    if (typed === null) return null;
    return create(typed.trim() || defaultName);
  }

  /** Prompts to rename `entity`, then writes `name`/`nameEdited` via `update`.
   * No-ops on cancel or an empty name. */
  async function promptAndRename(entity, label, update) {
    const typed = await promptDialog(label, entity.name);
    if (typed === null) return;
    const name = typed.trim();
    if (!name) return;
    await update({ name, nameEdited: true });
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

  function onAddHomeFlight(traveler, idea, siblings) {
    return run(async () => {
      const result = await addFlightFormDialog(traveler, trip, siblings.length);
      if (!result) return;
      const { priceAmountCents, ...fields } = result;
      const direction = homeDirection(fields, traveler, airports);
      const landsDate = direction === "out" || direction === "both" ? guessLandsDate(fields.fromAirport, fields.toAirport, fields.outboundDate, airports) : null;
      const alreadyPicked = siblings.some((f) => f.direction === direction && f.picked !== false);
      await addFlight(
        tripId,
        { ...fields, travelerId: traveler.id, firstPriceEntry: priceEntryFor(priceAmountCents), role: "home", ideaId: idea.id, direction, landsDate, picked: !alreadyPicked },
        myUid
      );
    });
  }

  function onAddHopFlight(option, idea) {
    return run(async () => {
      const result = await addFlightFormDialog(null, trip, hopFlightsFor(option.id).length);
      if (!result) return;
      const { priceAmountCents, ...fields } = result;
      await addFlight(
        tripId,
        { ...fields, travelerId: null, firstPriceEntry: priceEntryFor(priceAmountCents), role: "hop", ideaId: idea.id, optionId: option.id, picked: true },
        myUid
      );
    });
  }

  function onAddIdea() {
    return run(async () => {
      const ref = await promptAndCreate("Name this idea", `Idea ${ideas.length + 1}`, (name) =>
        addIdea(tripId, { name, nameEdited: true, order: ideas.length }, myUid)
      );
      if (ref) selectedIdeaId = ref.id;
    });
  }

  function onRenameIdea(idea) {
    return run(() => promptAndRename(idea, "Rename this idea", (fields) => updateIdea(tripId, idea.id, fields)));
  }

  function onDeleteIdea(idea) {
    return run(async () => {
      if (await confirmDialog(`Delete "${idea.name}" and all its flights?`, "Delete")) await deleteIdea(tripId, idea.id);
    });
  }

  function onAddOption(idea) {
    return run(async () => {
      const ideaOptions = options.filter((o) => o.ideaId === idea.id);
      const ref = await promptAndCreate("Name this option", `Option ${ideaOptions.length + 1}`, (name) =>
        addOption(tripId, { ideaId: idea.id, name, nameEdited: true, order: ideaOptions.length }, myUid)
      );
      if (ref) openOptionIds.add(ref.id);
    });
  }

  function onRenameOption(option) {
    return run(() => promptAndRename(option, "Rename this option", (fields) => updateOption(tripId, option.id, fields)));
  }

  function onDeleteOption(option) {
    return run(async () => {
      if (await confirmDialog(`Delete "${option.name}" and its flights?`, "Delete")) {
        await deleteOption(tripId, option.id);
        openOptionIds.delete(option.id);
      }
    });
  }

  function onChooseOption(option) {
    return run(() => setChosenOption(tripId, trip.chosenOptionId === option.id ? null : option.id));
  }

  function homeFlightRow(flight, traveler, siblings) {
    const picked = flight.picked !== false;
    const useBtn = el("button", { type: "button", className: "btn btn-small", textContent: picked ? "Using" : "Use this" });
    useBtn.addEventListener("click", async () => {
      setPending(useBtn, true, picked ? "Removing…" : "Using…");
      await toggleUseThisFlight(flight, siblings);
      setPending(useBtn, false);
    });
    const row = renderFlightRow(flight, {
      currency: trip.currency,
      usersById,
      onEdit: () => onEditFlight(flight, traveler),
      onDelete: () => onDeleteFlight(flight),
      leadingActions: [useBtn],
    });
    if (picked) row.classList.add("flight-card-chosen");
    return row;
  }

  function renderTravelerSwitch() {
    travelerSwitchEl.replaceChildren(
      ...travelers().map((t) => {
        const btn = el("button", {
          type: "button",
          textContent: t.homeCity ? `${t.name} · ${t.homeCity}` : t.name,
          attrs: { "aria-pressed": String(t.id === selectedTravelerId) },
        });
        btn.addEventListener("click", () => {
          selectedTravelerId = t.id;
          renderDynamicSections();
        });
        return btn;
      })
    );
  }

  function renderIdeaSwitch() {
    ideaSwitchEl.replaceChildren(
      ...ideas.map((idea) => {
        const btn = el("button", { type: "button", textContent: idea.name, attrs: { "aria-pressed": String(idea.id === selectedIdeaId) } });
        btn.addEventListener("click", () => {
          selectedIdeaId = idea.id;
          renderDynamicSections();
        });
        return btn;
      })
    );
    const currentIdea = ideas.find((i) => i.id === selectedIdeaId);
    if (!currentIdea) {
      ideaActionsEl.replaceChildren();
      return;
    }
    const renameBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Rename idea" });
    renameBtn.addEventListener("click", () => onRenameIdea(currentIdea));
    const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete idea" });
    deleteBtn.addEventListener("click", () => onDeleteIdea(currentIdea));
    ideaActionsEl.replaceChildren(renameBtn, deleteBtn);
  }

  function renderHomeFlightsCard() {
    const traveler = travelers().find((t) => t.id === selectedTravelerId);
    const idea = ideas.find((i) => i.id === selectedIdeaId);
    if (!airports || !traveler || !idea) {
      homeFlightsSectionEl.replaceChildren(el("p", { className: "muted", textContent: !airports ? "Loading…" : "Add a traveler on Overview first." }));
      return;
    }
    const travelerHomeFlights = homeFlightsFor(idea.id, traveler.id);
    const sorted = [...travelerHomeFlights].sort(cheapestFirst);
    const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add flight" });
    addBtn.addEventListener("click", () => onAddHomeFlight(traveler, idea, travelerHomeFlights));

    const body =
      sorted.length === 0
        ? [el("p", { className: "empty-state", textContent: `No flights yet for ${traveler.name}. Add one below.` })]
        : sorted.map((f) => homeFlightRow(f, traveler, travelerHomeFlights));

    homeFlightsSectionEl.replaceChildren(el("h3", { textContent: `${traveler.name}'s flights to and from the region` }), ...body, addBtn);
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
          onRename: () => onRenameOption(option),
          onDelete: () => onDeleteOption(option),
          onAddFlight: () => onAddHopFlight(option, idea),
          onEditFlight: (flight) => onEditFlight(flight, null),
          onDeleteFlight: (flight) => onDeleteFlight(flight),
        })
      )
    );
  }

  function renderDynamicSections() {
    if (!trip) return;
    if (ideas.length === 0) {
      mainWrap.hidden = true;
      emptyWrap.hidden = false;
      return;
    }
    mainWrap.hidden = false;
    emptyWrap.hidden = true;

    if (!travelers().some((t) => t.id === selectedTravelerId)) {
      selectedTravelerId = (travelers().find((t) => t.uid === myUid) || travelers()[0] || {}).id ?? null;
    }
    if (!ideas.some((i) => i.id === selectedIdeaId)) {
      selectedIdeaId = ideas[0]?.id ?? null;
    }

    renderTravelerSwitch();
    renderIdeaSwitch();
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

  const unsubTrip = watchTrip(
    tripId,
    (t) => {
      trip = t;
      renderAll();
    },
    (err) => onError(friendlyError(err))
  );
  const unsubUsers = watchUsers(
    (u) => {
      usersById = u;
      renderAll();
    },
    () => {}
  );
  const unsubFlights = watchFlights(
    tripId,
    (f) => {
      flights = f;
      renderAll();
    },
    (err) => onError(friendlyError(err))
  );
  const unsubIdeas = watchIdeas(
    tripId,
    (i) => {
      ideas = i;
      renderAll();
    },
    (err) => onError(friendlyError(err))
  );
  const unsubOptions = watchOptions(
    tripId,
    (o) => {
      options = o;
      renderAll();
    },
    (err) => onError(friendlyError(err))
  );

  return () => {
    unsubTrip();
    unsubUsers();
    unsubFlights();
    unsubIdeas();
    unsubOptions();
  };
}
