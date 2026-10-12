// The top of the Routes tab (V4 §4.6): the traveler and idea switches, and
// the add / rename / delete dialogs for ideas and options. Split out of
// routes.js, which keeps the flights, the option cards and the watchers.
import { addIdea, updateIdea, deleteIdea, addOption, updateOption, deleteOption } from "../store.js";
import { el, confirmDialog, promptDialog } from "../ui.js";
import { formatMoney } from "../lib/money.js";

/** Prompts for a name (defaulting to `defaultName`), falling back to it if
 * the owner clears the field, then hands it to `create`. Null on cancel. */
async function promptAndCreate(label, defaultName, create) {
  const typed = await promptDialog(label, defaultName);
  if (typed === null) return null;
  return create(typed.trim() || defaultName);
}

/** Prompts to rename `entity`, then writes `name`/`nameEdited` via `update`.
 * No-ops on cancel or an empty name. A name typed here is `nameEdited`, so
 * the auto names in V4 §4.4 stop overwriting it. */
async function promptAndRename(entity, label, update) {
  const typed = await promptDialog(label, entity.name);
  if (typed === null) return;
  const name = typed.trim();
  if (!name) return;
  await update({ name, nameEdited: true });
}

/** Resolves the new idea's doc reference, or null on cancel. */
export function addIdeaDialog(tripId, ideas, myUid) {
  return promptAndCreate("Name this idea", `Idea ${ideas.length + 1}`, (name) =>
    addIdea(tripId, { name, nameEdited: true, order: ideas.length }, myUid)
  );
}

export function renameIdeaDialog(tripId, idea) {
  return promptAndRename(idea, "Rename this idea", (fields) => updateIdea(tripId, idea.id, fields));
}

export async function deleteIdeaDialog(tripId, idea) {
  if (await confirmDialog(`Delete "${idea.name}" and all its flights?`, "Delete")) await deleteIdea(tripId, idea.id);
}

/** Resolves the new option's doc reference, or null on cancel. `ideaOptions`
 * are the options already under this idea. */
export function addOptionDialog(tripId, idea, ideaOptions, myUid) {
  return promptAndCreate("Name this option", `Option ${ideaOptions.length + 1}`, (name) =>
    addOption(tripId, { ideaId: idea.id, name, nameEdited: true, order: ideaOptions.length }, myUid)
  );
}

export function renameOptionDialog(tripId, option) {
  return promptAndRename(option, "Rename this option", (fields) => updateOption(tripId, option.id, fields));
}

/** True once the option is gone, so the caller can forget it was open. */
export async function deleteOptionDialog(tripId, option) {
  if (!(await confirmDialog(`Delete "${option.name}" and its flights?`, "Delete"))) return false;
  await deleteOption(tripId, option.id);
  return true;
}

/** The traveler segmented control. Stops and totals always show for whoever
 * is selected here (V4 §4.6). */
export function renderTravelerSwitch(switchEl, { travelers, selectedTravelerId, onSelect }) {
  switchEl.replaceChildren(
    ...travelers.map((t) => {
      const btn = el("button", {
        type: "button",
        textContent: t.homeCity ? `${t.name} · ${t.homeCity}` : t.name,
        attrs: { "aria-pressed": String(t.id === selectedTravelerId) },
      });
      btn.addEventListener("click", () => onSelect(t.id));
      return btn;
    })
  );
}

/** The idea segmented control, plus Choose idea / Rename / Delete. A check on
 * a chip means the traveler on screen has chosen that idea (§7.6). */
export function renderIdeaSwitch(switchEl, actionsEl, { ideas, selectedIdeaId, chosenIdeaId, onSelect, onChoose, onRename, onDelete }) {
  switchEl.replaceChildren(
    ...ideas.map((idea) => {
      const chosen = idea.id === chosenIdeaId;
      const btn = el("button", {
        type: "button",
        textContent: chosen ? `${idea.name} ✓` : idea.name,
        attrs: { "aria-pressed": String(idea.id === selectedIdeaId) },
      });
      btn.addEventListener("click", () => onSelect(idea.id));
      return btn;
    })
  );
  const currentIdea = ideas.find((i) => i.id === selectedIdeaId);
  if (!currentIdea) {
    actionsEl.replaceChildren();
    return;
  }
  const isChosen = currentIdea.id === chosenIdeaId;
  const chooseBtn = el("button", {
    type: "button",
    className: `btn btn-small ${isChosen ? "badge-chosen" : "btn-primary"}`,
    textContent: isChosen ? "Chosen" : "Choose idea",
    attrs: { "aria-pressed": String(isChosen) },
  });
  chooseBtn.addEventListener("click", () => onChoose(currentIdea));
  const renameBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Rename idea" });
  renameBtn.addEventListener("click", () => onRename(currentIdea));
  const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete idea" });
  deleteBtn.addEventListener("click", () => onDelete(currentIdea));
  actionsEl.replaceChildren(chooseBtn, renameBtn, deleteBtn);
}

// Whether the compact phone bar's breakdown is expanded, remembered for the
// session (not persisted) so re-renders don't collapse it under the owner.
let detailsOpen = false;

/** The sticky summary at the bottom of the tab (§7.6): the traveler on screen
 * and what their own chosen flights add up to. `breakdown` comes from
 * `travelerBreakdown`; "at least" whenever a price or flight is missing.
 * Below 760px this collapses to one line with a Details toggle (T44); the
 * full line above stays for the 760px+ bar. */
export function renderSummaryBar(barEl, { traveler, breakdown, hasIdea, currency }) {
  const money = (cents) => formatMoney(cents, currency);
  const note = hasIdea ? "" : " (no idea chosen)";
  const prefix = breakdown.complete ? "" : "at least ";

  const toggleBtn = el("button", {
    type: "button",
    className: "btn btn-link route-summary-toggle",
    textContent: detailsOpen ? "Details ▲" : "Details ▾",
    attrs: { "aria-expanded": String(detailsOpen) },
  });
  toggleBtn.addEventListener("click", () => {
    detailsOpen = !detailsOpen;
    renderSummaryBar(barEl, { traveler, breakdown, hasIdea, currency });
  });

  const detailsEl = el(
    "div",
    { className: "route-summary-details", hidden: !detailsOpen },
    [
      el("p", { textContent: `Home flights: ${money(breakdown.homeCents)}` }),
      el("p", { textContent: `Option flights: ${money(breakdown.hopCents)}` }),
      el("p", { textContent: `Stays: ${money(breakdown.stayCents)}` }),
      el("p", { textContent: `Other costs: ${money(breakdown.costCents)}` }),
      ...(breakdown.missing.length
        ? [el("ul", { className: "route-summary-missing" }, breakdown.missing.map((m) => el("li", { textContent: m })))]
        : []),
    ]
  );

  barEl.replaceChildren(
    el("div", { className: "route-summary-row" }, [
      el("span", { className: "route-summary-full", textContent: `${traveler.name}: home ${money(breakdown.homeCents)} + option flights ${money(breakdown.hopCents)}${note}` }),
      el("b", { className: "mono route-summary-full", textContent: `= ${prefix}${money(breakdown.totalCents)}` }),
      el("span", { className: "route-summary-compact", textContent: `${traveler.name}: ${prefix}${money(breakdown.totalCents)}` }),
      toggleBtn,
    ]),
    detailsEl
  );
}
