import { addPlace, updatePlace } from "../store.js";
import { el, setPending, friendlyError, field, dialogShell } from "../ui.js";
import { safeUrl, googleMapsFindUrl } from "../lib/links.js";
import { parseGoogleMapsUrl } from "../lib/mapsurl.js";
import { nominatimSearch } from "../lookup.js";
import { CATEGORIES } from "./places.js";

/**
 * The three location-entry methods from §7.6: find it on Google Maps then
 * paste the link (Steps 1–2), search (Nominatim, scoped to the destination),
 * or place on map — the latter two live under "Other ways to add a location".
 * `mapClickState` is a shared mutable flag/callback the page's Leaflet map
 * click handler reads. `onChange({lat, lng, googleMapsUrl, suggestedName?})`
 * fires whenever a location is picked or cleared.
 *
 * Returns `{ primaryElement, otherWaysElement, getLocation, reset }` rather
 * than one element so a caller with its own Step 3 in between (the Add place
 * form) can put it there, per §7.6's order: Step 1, Step 2, Step 3, then
 * "Other ways to add a location". Pass `stepLabels: true` for that add-form
 * context to show the numbered step headings; the inline Set/Edit location
 * panel (no Step 3 of its own) omits them but reuses the same Find button,
 * seeded with `findText` — the place's current name (§7.6).
 */
export function buildLocationPicker({ trip, mapClickState, onChange, findText = "", onFindTextChange, stepLabels = false }) {
  let lat = null;
  let lng = null;
  let googleMapsUrl = null;
  let placingArmed = false;
  const dest = trip && trip.destination;

  const statusEl = el("p", { className: "muted location-status" });
  const errorEl = el("div", { className: "field-error-holder" });
  const pinFoundEl = el("p", { className: "location-pin-found", hidden: true });

  function updateStatus() {
    statusEl.textContent = lat != null && lng != null ? `Location set: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : "No location set yet.";
  }
  updateStatus();

  function setLocation(newLat, newLng, mapsUrl, suggestedName) {
    lat = newLat;
    lng = newLng;
    googleMapsUrl = mapsUrl || null;
    updateStatus();
    onChange({ lat, lng, googleMapsUrl, suggestedName });
  }

  // Step 1 · Find it on Google Maps (§7.6, §9.2).
  const findQueryInput = el("input", {
    type: "text",
    value: findText,
    placeholder: "What are you looking for?",
    attrs: { "aria-label": "What are you looking for?" },
  });
  const findLink = el("a", {
    className: "btn btn-small",
    href: googleMapsFindUrl(findText, dest && dest.city, dest && dest.country),
    target: "_blank",
    rel: "noopener noreferrer",
    textContent: "Find on Google Maps",
  });
  findQueryInput.addEventListener("input", () => {
    findLink.href = googleMapsFindUrl(findQueryInput.value, dest && dest.city, dest && dest.country);
    if (onFindTextChange) onFindTextChange(findQueryInput.value);
  });

  // Step 2 · Paste the Google Maps link (§7.6, §9.3).
  const linkInput = el("input", { type: "text", placeholder: "Paste a Google Maps link", attrs: { "aria-label": "Google Maps link" } });
  const useLinkBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Use this link" });
  function tryParseLink() {
    if (!linkInput.value.trim()) return;
    errorEl.replaceChildren();
    pinFoundEl.hidden = true;
    const result = parseGoogleMapsUrl(linkInput.value);
    if (result.error) {
      errorEl.replaceChildren(el("p", { className: "field-error", textContent: result.error }));
      return;
    }
    setLocation(result.lat, result.lng, safeUrl(linkInput.value), result.name);
    pinFoundEl.textContent = result.name ? `✓ Pin found: ${result.name}` : "✓ Pin found";
    pinFoundEl.hidden = false;
  }
  useLinkBtn.addEventListener("click", tryParseLink);
  // Auto-parse as soon as a link is pasted (§7.6) — a paste event fires before the
  // input's value updates, so read it on the next tick. The button stays as a
  // fallback for a manually typed/edited link.
  linkInput.addEventListener("paste", () => setTimeout(tryParseLink, 0));

  const searchInput = el("input", { type: "text", placeholder: "Search by name", attrs: { "aria-label": "Search for a place by name" } });
  const searchBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Search" });
  const resultsEl = el("ul", { className: "search-results" });
  searchBtn.addEventListener("click", async () => {
    errorEl.replaceChildren();
    resultsEl.replaceChildren();
    const query = searchInput.value.trim();
    if (!query) return;
    const fullQuery = dest ? `${query}, ${dest.city}, ${dest.country}` : query;
    setPending(searchBtn, true, "Searching…");
    try {
      const results = await nominatimSearch(fullQuery);
      if (results.length === 0) {
        resultsEl.replaceChildren(el("li", { className: "muted", textContent: "No results. Try Place on map instead." }));
      } else {
        resultsEl.replaceChildren(
          ...results.map((r) => {
            const btn = el("button", { type: "button", className: "btn btn-small search-result", textContent: r.display_name });
            btn.addEventListener("click", () => {
              setLocation(Number(r.lat), Number(r.lon), null, null);
              resultsEl.replaceChildren();
            });
            return el("li", {}, [btn]);
          }),
          el("li", { className: "muted", textContent: "Search by OpenStreetMap Nominatim" })
        );
      }
    } catch (err) {
      errorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(searchBtn, false);
    }
  });

  const placeOnMapBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Place on map" });
  function disarmPlacing() {
    placingArmed = false;
    placeOnMapBtn.textContent = "Place on map";
    placeOnMapBtn.setAttribute("aria-pressed", "false");
    mapClickState.armed = false;
    mapClickState.onPick = null;
    mapClickState.disarm = null;
  }
  placeOnMapBtn.setAttribute("aria-pressed", "false");
  placeOnMapBtn.addEventListener("click", () => {
    if (placingArmed) {
      disarmPlacing();
      return;
    }
    // Only one picker can own the map's next click; cancel whoever had it so
    // their button doesn't stay stuck reading "Click the map…".
    if (mapClickState.disarm) mapClickState.disarm();
    placingArmed = true;
    placeOnMapBtn.textContent = "Click the map…";
    placeOnMapBtn.setAttribute("aria-pressed", "true");
    mapClickState.armed = true;
    mapClickState.disarm = disarmPlacing;
    mapClickState.onPick = (latlng) => {
      setLocation(latlng.lat, latlng.lng, null, null);
      disarmPlacing();
    };
  });

  const clearBtn = el("button", { type: "button", className: "btn btn-small btn-secondary", textContent: "Clear location" });
  clearBtn.addEventListener("click", () => setLocation(null, null, null, null));

  const otherWaysToggle = el("button", {
    type: "button",
    className: "btn btn-link",
    textContent: "Other ways to add a location",
    attrs: { "aria-expanded": "false" },
  });
  const otherWaysHolder = el("div", { className: "other-location-methods", hidden: true }, [
    el("div", { className: "location-method" }, [searchInput, searchBtn]),
    resultsEl,
    el("div", { className: "location-method" }, [placeOnMapBtn]),
  ]);
  otherWaysToggle.addEventListener("click", () => {
    otherWaysHolder.hidden = !otherWaysHolder.hidden;
    otherWaysToggle.setAttribute("aria-expanded", otherWaysHolder.hidden ? "false" : "true");
  });

  const primaryElement = el("div", { className: "location-picker" }, [
    stepLabels ? el("h4", { textContent: "Step 1 · Find it on Google Maps" }) : null,
    el("div", { className: "location-method" }, [findQueryInput, findLink]),
    el("p", { className: "muted", textContent: "Find the place, copy the address from your browser's address bar, then paste it below." }),
    stepLabels ? el("h4", { textContent: "Step 2 · Paste the Google Maps link" }) : null,
    el("div", { className: "location-method location-method-primary" }, [linkInput, useLinkBtn]),
    pinFoundEl,
    el("div", { className: "location-status-row" }, [statusEl, clearBtn]),
    errorEl,
  ].filter(Boolean));

  const otherWaysElement = el("div", {}, [otherWaysToggle, otherWaysHolder]);

  return {
    primaryElement,
    otherWaysElement,
    getLocation: () => ({ lat, lng, googleMapsUrl }),
    reset: () => {
      setLocation(null, null, null, null);
      findQueryInput.value = "";
      findLink.href = googleMapsFindUrl("", dest && dest.city, dest && dest.country);
      pinFoundEl.hidden = true;
      errorEl.replaceChildren();
    },
  };
}

export function editPlaceDialog(place) {
  return dialogShell("place-edit-dialog", (finish) => {
    const nameInput = el("input", { type: "text", value: place.name });
    const categorySelect = el(
      "select",
      {},
      CATEGORIES.map((c) => el("option", { value: c.label, textContent: c.label, selected: c.label === place.category }))
    );
    const neighborhoodInput = el("input", { type: "text", value: place.neighborhood });
    const noteInput = el("textarea", { rows: 2, value: place.note });
    const linkInput = el("input", { type: "text", value: place.link || "" });
    const eventStartInput = el("input", { type: "date", value: place.eventStart || "" });
    const eventEndInput = el("input", { type: "date", value: place.eventEnd || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });

    const form = el("form", { method: "dialog", className: "place-edit-form" }, [
      field("Name", nameInput),
      field("Category", categorySelect),
      field("Neighborhood", neighborhoodInput),
      field("Note", noteInput),
      field("Link", linkInput),
      el("div", { className: "field-row" }, [field("Event start", eventStartInput), field("Event end", eventEndInput)]),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Name is required." }));
        return;
      }
      finish({
        name,
        category: categorySelect.value,
        neighborhood: neighborhoodInput.value.trim(),
        note: noteInput.value.trim(),
        link: linkInput.value.trim() || null,
        eventStart: eventStartInput.value || null,
        eventEnd: eventEndInput.value || null,
      });
    });
    return { form, focusEl: nameInput };
  });
}

/** The inline location editor on a place row (§7.6): a toggle button that reveals
 * a location picker pre-armed to update that place, its Find button prefilled
 * with the place's own name. */
export function buildSetLocationInline({ place, trip, tripId, mapClickState, onError }) {
  const hasLocation = place.lat != null && place.lng != null;
  const toggleBtn = el("button", { type: "button", className: "btn btn-small", textContent: hasLocation ? "Edit location" : "Set location" });
  const holder = el("div", { className: "set-location-holder", hidden: true });
  toggleBtn.addEventListener("click", () => {
    holder.hidden = !holder.hidden;
    if (!holder.hidden && holder.children.length === 0) {
      const picker = buildLocationPicker({
        trip,
        mapClickState,
        findText: place.name,
        onChange: async (payload) => {
          // A null location here is the explicit "Clear location" press — the
          // picker never fires onChange on its own — so removing a wrong pin works.
          const cleared = payload.lat == null;
          try {
            await updatePlace(tripId, place.id, {
              lat: payload.lat,
              lng: payload.lng,
              googleMapsUrl: cleared ? null : payload.googleMapsUrl || place.googleMapsUrl || null,
            });
            holder.hidden = true;
          } catch (err) {
            onError(friendlyError(err));
          }
        },
      });
      holder.append(picker.primaryElement, picker.otherWaysElement);
    }
  });
  return el("div", { className: "set-location-wrap" }, [toggleBtn, holder]);
}

/** The "Add place" form (§7.6): Step 1 (find it on Google Maps), Step 2 (paste
 * the link), Step 3 (details), then "Other ways to add a location". Renders
 * into `addPanelHolder` and calls `onAdded()` after a successful add so the
 * caller can collapse the panel. */
export function buildAddPlacePanel({ trip, tripId, myUid, mapClickState, addPanelHolder, onAdded }) {
  const nameInput = el("input", { type: "text" });
  const categorySelect = el("select", {}, [
    el("option", { value: "", textContent: "Choose a category", disabled: true, selected: true }),
    ...CATEGORIES.map((c) => el("option", { value: c.label, textContent: c.label })),
  ]);
  const neighborhoodInput = el("input", { type: "text" });
  const noteInput = el("textarea", { rows: 2 });
  const linkInput = el("input", { type: "text" });
  const eventStartInput = el("input", { type: "date" });
  const eventEndInput = el("input", { type: "date" });
  const errorHolder = el("div", { className: "field-error-holder" });
  const submitBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Add place" });

  // Name stays synced to Step 1's search box as the user types (§7.6) until
  // either they edit Name themselves, or Step 2 parses a real place name off
  // a pasted link — either way that's a deliberate value, not to be clobbered
  // by further typing in Step 1. Checking "is Name empty" alone would only
  // ever copy the first keystroke, since the field stops being empty after that.
  let nameAutoFilled = true;
  nameInput.addEventListener("input", () => {
    nameAutoFilled = false;
  });

  const locationPicker = buildLocationPicker({
    trip,
    mapClickState,
    stepLabels: true,
    onChange: (payload) => {
      if (payload.suggestedName && nameAutoFilled) {
        nameInput.value = payload.suggestedName;
        nameAutoFilled = false;
      }
    },
    // Step 1's search text doubles as a name suggestion once Step 3 comes into view (§7.6).
    onFindTextChange: (text) => {
      if (nameAutoFilled) nameInput.value = text;
    },
  });

  submitBtn.addEventListener("click", async () => {
    errorHolder.replaceChildren();
    const name = nameInput.value.trim();
    const category = categorySelect.value;
    if (!name || !category) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Name and category are required." }));
      return;
    }
    const { lat, lng, googleMapsUrl } = locationPicker.getLocation();
    setPending(submitBtn, true, "Adding…");
    try {
      await addPlace(
        tripId,
        {
          name,
          destinationId: trip.destinationId,
          category,
          neighborhood: neighborhoodInput.value.trim(),
          note: noteInput.value.trim(),
          link: linkInput.value.trim() || null,
          eventStart: eventStartInput.value || null,
          eventEnd: eventEndInput.value || null,
          lat,
          lng,
          googleMapsUrl,
        },
        myUid
      );
      nameInput.value = "";
      categorySelect.value = "";
      neighborhoodInput.value = "";
      noteInput.value = "";
      linkInput.value = "";
      eventStartInput.value = "";
      eventEndInput.value = "";
      nameAutoFilled = true;
      locationPicker.reset();
      onAdded();
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(submitBtn, false);
    }
  });

  addPanelHolder.replaceChildren(
    el("div", { className: "add-place-panel card" }, [
      locationPicker.primaryElement,
      el("h4", { textContent: "Step 3 · Details" }),
      field("Name", nameInput),
      field("Category", categorySelect),
      field("Neighborhood", neighborhoodInput),
      field("Note", noteInput),
      field("Link", linkInput),
      el("div", { className: "field-row" }, [field("Event start", eventStartInput), field("Event end", eventEndInput)]),
      locationPicker.otherWaysElement,
      errorHolder,
      submitBtn,
    ])
  );
}
