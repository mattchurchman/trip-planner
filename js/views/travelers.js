// The Travelers card on Overview (V4 §9): who's coming, their home city and
// airport, and adding or removing someone. Split out of overview.js.
import { updateTravelers, getTravelerFlights, deleteFlight } from "../store.js";
import { el, field, dialogShell, confirmDialog, friendlyError } from "../ui.js";

/** "Add traveler": pick an app member, or type a name for someone who doesn't
 * use the app. Resolves `{ uid, name }`, or null on cancel. */
function addTravelerDialog(trip, usersById) {
  return dialogShell("traveler-dialog", (finish) => {
    const existingUids = new Set((trip.travelers || []).map((t) => t.uid).filter(Boolean));
    const memberOptions = Object.entries(usersById)
      .filter(([uid]) => !existingUids.has(uid))
      .map(([uid, u]) => el("option", { value: uid, textContent: u.displayName || u.email }));
    const memberSelect = el("select", {}, [el("option", { value: "", textContent: "— Type a name instead —" }), ...memberOptions]);
    const nameInput = el("input", { type: "text", placeholder: "Name" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Add" });
    const form = el("form", { method: "dialog" }, [
      field("App member", memberSelect),
      field("Or type a name", nameInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (memberSelect.value) {
        const u = usersById[memberSelect.value];
        finish({ uid: memberSelect.value, name: u.displayName || u.email });
      } else if (nameInput.value.trim()) {
        finish({ uid: null, name: nameInput.value.trim() });
      } else {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Choose a member or type a name." }));
      }
    });
    return { form, focusEl: memberSelect };
  });
}

const SAVE_DEBOUNCE_MS = 600;

/**
 * Fills `sectionEl` with the Travelers card. Errors go to `errorEl`, which the
 * caller keeps outside the rebuild so a message survives the next render.
 * Call again whenever the trip or the member list changes.
 *
 * Returns `flush()`: saves any pending (debounced) edits immediately. The
 * caller must run this when the view is torn down (tab switch), since a
 * removed input never fires `change` or `blur` on its own.
 */
export function renderTravelers(sectionEl, errorEl, { tripId, trip, usersById }) {
  const showError = (err) => errorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
  const flushFns = [];

  function commit(traveler, patch) {
    const travelers = trip.travelers.map((t) => (t.id === traveler.id ? { ...t, ...patch } : t));
    updateTravelers(tripId, travelers).catch(showError);
  }

  /** Wires `input` to save `getPatch(value)` 600ms after typing stops, and
   * right away on `change`/`blur`. Skips the write when nothing changed
   * since the last save. Registers a flush callback for teardown. */
  function debouncedField(traveler, input, initialValue, getPatch) {
    let lastSaved = initialValue;
    let timer = null;

    function commitNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const value = input.value;
      if (value === lastSaved) return;
      lastSaved = value;
      commit(traveler, getPatch(value));
    }

    input.addEventListener("input", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(commitNow, SAVE_DEBOUNCE_MS);
    });
    input.addEventListener("change", commitNow);
    input.addEventListener("blur", commitNow);
    flushFns.push(commitNow);
  }

  function travelerRow(traveler) {
    const nameInput = el("input", { type: "text", value: traveler.name, attrs: { "aria-label": "Traveler name" } });
    const cityInput = el("input", { type: "text", value: traveler.homeCity || "", placeholder: "Home city", attrs: { "aria-label": `Home city for ${traveler.name}` } });
    const airportInput = el("input", {
      type: "text",
      value: traveler.homeAirport || "",
      placeholder: "Airport",
      maxLength: 4,
      attrs: { "aria-label": `Home airport for ${traveler.name}` },
    });
    debouncedField(traveler, nameInput, traveler.name, (value) => ({ name: value.trim() || traveler.name }));
    debouncedField(traveler, cityInput, traveler.homeCity || "", (value) => ({ homeCity: value.trim() }));
    debouncedField(traveler, airportInput, traveler.homeAirport || "", (value) => ({ homeAirport: value.trim().toUpperCase() }));

    const removeBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Remove" });
    removeBtn.addEventListener("click", () => removeTraveler(traveler));

    return el("div", { className: "traveler-row" }, [nameInput, cityInput, airportInput, removeBtn]);
  }

  async function removeTraveler(traveler) {
    errorEl.replaceChildren();
    if (trip.travelers.length <= 1) {
      errorEl.replaceChildren(el("p", { className: "field-error", textContent: "At least one traveler must remain." }));
      return;
    }
    if (!(await confirmDialog(`Remove ${traveler.name}?`, "Remove"))) return;
    try {
      // Their flights would otherwise be orphaned: Routes lists home flights
      // per traveler, so nobody could see or delete them afterwards (§7.5).
      const theirFlights = await getTravelerFlights(tripId, traveler.id);
      if (theirFlights.length > 0) {
        const alsoDelete = await confirmDialog(
          `Also delete ${theirFlights.length} flight${theirFlights.length === 1 ? "" : "s"} saved for ${traveler.name}?`,
          "Delete"
        );
        if (alsoDelete) {
          for (const flight of theirFlights) await deleteFlight(tripId, flight.id);
        }
      }
      await updateTravelers(tripId, trip.travelers.filter((t) => t.id !== traveler.id));
    } catch (err) {
      showError(err);
    }
  }

  const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add traveler" });
  addBtn.addEventListener("click", async () => {
    const result = await addTravelerDialog(trip, usersById);
    if (!result) return;
    const newTraveler = { id: crypto.randomUUID(), name: result.name, uid: result.uid, homeCity: "", homeAirport: "" };
    updateTravelers(tripId, [...(trip.travelers || []), newTraveler]).catch(showError);
  });

  sectionEl.replaceChildren(
    el("div", { className: "travelers-header" }, [el("h2", { textContent: "Travelers" }), addBtn]),
    ...(trip.travelers || []).map(travelerRow),
    errorEl
  );

  return () => {
    for (const flush of flushFns) flush();
  };
}
