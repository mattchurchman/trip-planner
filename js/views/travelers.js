// The Travelers card on Overview (V4 §9): who's coming, their home city and
// airport, and adding or removing someone. Split out of overview.js.
import { updateTravelers, getTravelerFlights, deleteFlight } from "../store.js";
import { el, field, dialogShell, confirmDialog, friendlyError, setPending } from "../ui.js";

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

/**
 * The Edit traveler sheet: Name, Home city, Home airport, Save/Cancel, and
 * "Remove traveler" as a quiet danger link at the bottom. `getTrip()` always
 * returns the trip as it stands right now, not the one captured when the
 * card was last drawn, so a Save or Remove here never overwrites an edit
 * that landed on the trip while this sheet was open. Resolves once the sheet
 * closes; the caller doesn't need the result, since every write (save or
 * remove) already happened before it resolves.
 */
function editTravelerDialog(traveler, { tripId, getTrip }) {
  return dialogShell("traveler-dialog", (finish) => {
    const nameInput = el("input", { type: "text", value: traveler.name, attrs: { "aria-label": "Traveler name" } });
    const cityInput = el("input", { type: "text", value: traveler.homeCity || "", placeholder: "Home city" });
    const airportInput = el("input", {
      type: "text",
      value: traveler.homeAirport || "",
      placeholder: "Airport",
      maxLength: 4,
      attrs: { "aria-label": "Home airport" },
    });

    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const saveBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });
    const removeBtn = el("button", { type: "button", className: "btn btn-link btn-danger-link", textContent: "Remove traveler" });

    const form = el("form", { method: "dialog" }, [
      el("h3", { textContent: "Edit traveler" }),
      field("Name", nameInput),
      field("Home city", cityInput),
      field("Home airport", airportInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, saveBtn]),
      removeBtn,
    ]);

    cancelBtn.addEventListener("click", () => finish(null));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorHolder.replaceChildren();
      const patch = {
        name: nameInput.value.trim() || traveler.name,
        homeCity: cityInput.value.trim(),
        homeAirport: airportInput.value.trim().toUpperCase(),
      };
      setPending(saveBtn, true);
      try {
        const latest = getTrip();
        const travelers = latest.travelers.map((t) => (t.id === traveler.id ? { ...t, ...patch } : t));
        await updateTravelers(tripId, travelers);
        finish(patch);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
        setPending(saveBtn, false);
      }
    });

    removeBtn.addEventListener("click", async () => {
      errorHolder.replaceChildren();
      if (getTrip().travelers.length <= 1) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "At least one traveler must remain." }));
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
        await updateTravelers(tripId, getTrip().travelers.filter((t) => t.id !== traveler.id));
        finish(null);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    return { form, focusEl: nameInput };
  });
}

/**
 * Fills `sectionEl` with the Travelers card: one read-only card per traveler
 * (avatar, name, home city/airport line, **Edit**) plus **Add traveler**.
 * Errors go to `errorEl`, which the caller keeps outside the rebuild so a
 * message survives the next render. Call again whenever the trip or the
 * member list changes.
 *
 * `getTrip()` (not a `trip` snapshot) is how the Edit sheet always writes
 * from the current trip even if it's still open when a live update lands.
 */
export function renderTravelers(sectionEl, errorEl, { tripId, getTrip, usersById, myUid }) {
  const showError = (err) => errorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
  const trip = getTrip();

  function openEdit(traveler) {
    editTravelerDialog(traveler, { tripId, getTrip });
  }

  function travelerCard(traveler) {
    const avatar = el("div", { className: "avatar avatar-initial traveler-card-avatar", textContent: (traveler.name || "?")[0].toUpperCase() });
    const nameText = traveler.uid && traveler.uid === myUid ? `${traveler.name} (you)` : traveler.name;
    const nameLine = el("p", { className: "traveler-card-name", textContent: nameText });
    const detailText =
      traveler.homeCity || traveler.homeAirport
        ? [traveler.homeCity, traveler.homeAirport].filter(Boolean).join(" · ")
        : "Add home city and airport";
    const detailLine = el("p", { className: "traveler-card-detail muted", textContent: detailText });
    const editBtn = el("button", { type: "button", className: "btn btn-small traveler-card-edit", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEdit(traveler));
    return el("div", { className: "card traveler-card" }, [
      avatar,
      el("div", { className: "traveler-card-info" }, [nameLine, detailLine]),
      editBtn,
    ]);
  }

  const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add traveler" });
  addBtn.addEventListener("click", async () => {
    const result = await addTravelerDialog(trip, usersById);
    if (!result) return;
    const newTraveler = { id: crypto.randomUUID(), name: result.name, uid: result.uid, homeCity: "", homeAirport: "" };
    try {
      await updateTravelers(tripId, [...(trip.travelers || []), newTraveler]);
      openEdit(newTraveler);
    } catch (err) {
      showError(err);
    }
  });

  sectionEl.replaceChildren(
    el("div", { className: "travelers-header" }, [el("h2", { textContent: "Travelers" }), addBtn]),
    ...(trip.travelers || []).map(travelerCard),
    errorEl
  );
}
