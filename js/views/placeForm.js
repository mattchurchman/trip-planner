import { addPlace, updatePlace } from "../store.js";
import { el, setPending, friendlyError, field, dialogShell } from "../ui.js";
import { safeUrl } from "../lib/links.js";
import { parseGoogleMapsUrl } from "../lib/mapsurl.js";
import { nominatimSearch } from "../lookup.js";
import { CATEGORIES } from "./places.js";

/**
 * The three location-entry methods from §7.6: paste a Google Maps link, search
 * (Nominatim, scoped to the destination), or place on map. `mapClickState` is a
 * shared mutable flag/callback the page's Leaflet map click handler reads.
 * `onChange({lat, lng, googleMapsUrl, suggestedName?})` fires whenever a location is picked or cleared.
 */
export function buildLocationPicker({ trip, mapClickState, onChange }) {
  let lat = null;
  let lng = null;
  let googleMapsUrl = null;
  let placingArmed = false;

  const statusEl = el("p", { className: "muted location-status" });
  const errorEl = el("div", { className: "field-error-holder" });

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

  const linkInput = el("input", { type: "text", placeholder: "Paste a Google Maps link", attrs: { "aria-label": "Google Maps link" } });
  const useLinkBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Use this link" });
  function tryParseLink() {
    if (!linkInput.value.trim()) return;
    errorEl.replaceChildren();
    const result = parseGoogleMapsUrl(linkInput.value);
    if (result.error) {
      errorEl.replaceChildren(el("p", { className: "field-error", textContent: result.error }));
      return;
    }
    setLocation(result.lat, result.lng, safeUrl(linkInput.value), result.name);
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
    const dest = trip.destination;
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

  const elRoot = el("div", { className: "location-picker" }, [
    el("div", { className: "location-method location-method-primary" }, [linkInput, useLinkBtn]),
    el("div", { className: "location-status-row" }, [statusEl, clearBtn]),
    errorEl,
    otherWaysToggle,
    otherWaysHolder,
  ]);

  return { element: elRoot, getLocation: () => ({ lat, lng, googleMapsUrl }), reset: () => setLocation(null, null, null, null) };
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
 * a location picker pre-armed to update that place. */
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
      holder.appendChild(picker.element);
    }
  });
  return el("div", { className: "set-location-wrap" }, [toggleBtn, holder]);
}

/** The "Add place" form (§7.6), including its own location picker. Renders into
 * `addPanelHolder` and calls `onAdded()` after a successful add so the caller can
 * collapse the panel. */
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

  const locationPicker = buildLocationPicker({
    trip,
    mapClickState,
    onChange: (payload) => {
      if (payload.suggestedName && !nameInput.value.trim()) nameInput.value = payload.suggestedName;
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
      field("Name", nameInput),
      field("Category", categorySelect),
      field("Neighborhood", neighborhoodInput),
      field("Note", noteInput),
      field("Link", linkInput),
      el("div", { className: "field-row" }, [field("Event start", eventStartInput), field("Event end", eventEndInput)]),
      el("h4", { textContent: "Location (optional)" }),
      locationPicker.element,
      errorHolder,
      submitBtn,
    ])
  );
}
