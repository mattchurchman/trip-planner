import { watchTrip, watchUsers, watchPlaces, addPlace, updatePlace, deletePlace, voteOnPlace } from "../store.js";
import { el, setPending, confirmDialog, friendlyError, rankControl, field, dialogShell } from "../ui.js";
import { renderComments } from "./comments.js";
import { sortByRank, notRankedByMe, voteSummary, toMillis } from "../lib/votes.js";
import { safeUrl, googleMapsOpenUrl } from "../lib/links.js";
import { parseGoogleMapsUrl } from "../lib/mapsurl.js";

const CATEGORIES = [
  { label: "Food", color: "#e8710a" },
  { label: "Drinks & nightlife", color: "#9334e6" },
  { label: "Neighborhood walk", color: "#188038" },
  { label: "Sight", color: "#1a73e8" },
  { label: "Museum & history", color: "#795548" },
  { label: "Walking tour", color: "#00897b" },
  { label: "Event & seasonal", color: "#d93025" },
  { label: "Adventure", color: "#f9ab00" },
  { label: "Day trip", color: "#3949ab" },
  { label: "Shopping", color: "#c2185b" },
  { label: "Other", color: "#5f6368" },
];
const CATEGORY_COLOR = Object.fromEntries(CATEGORIES.map((c) => [c.label, c.color]));

async function nominatimSearch(query, limit = 5) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Search failed. Try again in a moment.");
  return response.json();
}

function openMapsUrlFor(place, destinationCity) {
  const saved = place.googleMapsUrl ? safeUrl(place.googleMapsUrl) : null;
  return saved || googleMapsOpenUrl(place.name, destinationCity || "");
}

function eventOverlapsTrip(place, trip) {
  if (!place.eventStart || !place.eventEnd || !trip.startDate || !trip.endDate) return false;
  return place.eventStart <= trip.endDate && place.eventEnd >= trip.startDate;
}

function applyFiltersAndSort(places, { filters, sortMode, trip, myUid }) {
  let filtered = places.filter((p) => {
    if (filters.categories.size > 0 && !filters.categories.has(p.category)) return false;
    if (filters.neighborhood && p.neighborhood !== filters.neighborhood) return false;
    if (filters.search) {
      const haystack = `${p.name} ${p.note}`.toLowerCase();
      if (!haystack.includes(filters.search.toLowerCase())) return false;
    }
    if (filters.eventsOnly && !eventOverlapsTrip(p, trip)) return false;
    return true;
  });
  if (filters.notRankedOnly) filtered = notRankedByMe(filtered, myUid);

  if (sortMode === "newest") return [...filtered].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  if (sortMode === "neighborhood") return [...filtered].sort((a, b) => (a.neighborhood || "").localeCompare(b.neighborhood || ""));
  if (sortMode === "category") return [...filtered].sort((a, b) => a.category.localeCompare(b.category));
  return sortByRank(filtered);
}

/**
 * The three location-entry methods from §7.6: paste a Google Maps link, search
 * (Nominatim, scoped to the destination), or place on map. `mapClickState` is a
 * shared mutable flag/callback the page's Leaflet map click handler reads.
 * `onChange({lat, lng, googleMapsUrl, suggestedName?})` fires whenever a location is picked or cleared.
 */
function buildLocationPicker({ trip, mapClickState, onChange }) {
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

  const linkInput = el("input", { type: "text", placeholder: "Paste a Google Maps link" });
  const useLinkBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Use this link" });
  useLinkBtn.addEventListener("click", () => {
    errorEl.replaceChildren();
    const result = parseGoogleMapsUrl(linkInput.value);
    if (result.error) {
      errorEl.replaceChildren(el("p", { className: "field-error", textContent: result.error }));
      return;
    }
    setLocation(result.lat, result.lng, safeUrl(linkInput.value), result.name);
  });

  const searchInput = el("input", { type: "text", placeholder: "Search by name" });
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
      const results = await nominatimSearch(fullQuery, 5);
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
  placeOnMapBtn.addEventListener("click", () => {
    placingArmed = !placingArmed;
    placeOnMapBtn.textContent = placingArmed ? "Click the map…" : "Place on map";
    mapClickState.armed = placingArmed;
    mapClickState.onPick = (latlng) => {
      setLocation(latlng.lat, latlng.lng, null, null);
      placingArmed = false;
      placeOnMapBtn.textContent = "Place on map";
      mapClickState.armed = false;
    };
  });

  const clearBtn = el("button", { type: "button", className: "btn btn-small btn-secondary", textContent: "Clear location" });
  clearBtn.addEventListener("click", () => setLocation(null, null, null, null));

  const elRoot = el("div", { className: "location-picker" }, [
    el("div", { className: "location-method" }, [linkInput, useLinkBtn]),
    el("div", { className: "location-method" }, [searchInput, searchBtn]),
    resultsEl,
    el("div", { className: "location-method" }, [placeOnMapBtn, clearBtn]),
    statusEl,
    errorEl,
  ]);

  return { element: elRoot, getLocation: () => ({ lat, lng, googleMapsUrl }), reset: () => setLocation(null, null, null, null) };
}

function editPlaceDialog(place) {
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

/** Renders the Places tab (§7.6) into `container`. Returns a single unsubscribe function. */
export function renderPlacesPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let places = [];
  let placeCommentUnsubscribes = [];
  let map = null;
  let markerLayer = null;
  let mapCentered = false;
  let addPanelBuilt = false;
  const markersById = new Map();
  const mapClickState = { armed: false, onPick: null };
  const filters = { categories: new Set(), neighborhood: "", search: "", notRankedOnly: false, eventsOnly: false };
  let sortMode = "rank";
  let lastNeighborhoodsKey = "";

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const addPanelToggle = el("button", { type: "button", className: "btn btn-primary", textContent: "Add place" });
  const addPanelHolder = el("div", { className: "add-place-holder", hidden: true });
  const filtersEl = el("div", { className: "places-filters card" });
  const rankCountEl = el("p", { className: "muted rank-count" });
  const listEl = el("div", { className: "places-list" });
  const mapEl = el("div", { className: "places-map" });
  const listMapWrap = el("div", { className: "places-list-map" }, [listEl, mapEl]);

  addPanelToggle.addEventListener("click", () => {
    addPanelHolder.hidden = !addPanelHolder.hidden;
  });

  container.replaceChildren(
    loadErrorEl,
    el("div", { className: "places-header" }, [el("h2", { textContent: "Places" }), addPanelToggle]),
    addPanelHolder,
    filtersEl,
    rankCountEl,
    listMapWrap
  );

  // --- Filters bar: built once; each control drives `filters`/`sortMode` and
  // calls renderList() itself, so typing/selecting here is never disturbed by
  // live updates (§8) the way a full rebuild-on-snapshot would risk. ---
  const categoryChipsEl = el("div", { className: "category-chips" });
  for (const c of CATEGORIES) {
    const chip = el("button", {
      type: "button",
      className: "chip",
      textContent: c.label,
      style: `border-color:${c.color};color:${c.color}`,
    });
    chip.addEventListener("click", () => {
      if (filters.categories.has(c.label)) {
        filters.categories.delete(c.label);
        chip.classList.remove("chip-active");
        chip.style.cssText = `border-color:${c.color};color:${c.color}`;
      } else {
        filters.categories.add(c.label);
        chip.classList.add("chip-active");
        chip.style.cssText = `background:${c.color};color:#fff;border-color:${c.color}`;
      }
      renderList();
    });
    categoryChipsEl.appendChild(chip);
  }

  const neighborhoodSelect = el("select", {}, [el("option", { value: "", textContent: "All neighborhoods" })]);
  neighborhoodSelect.addEventListener("change", () => {
    filters.neighborhood = neighborhoodSelect.value;
    renderList();
  });

  const searchInput = el("input", { type: "text", placeholder: "Search name or note" });
  searchInput.addEventListener("input", () => {
    filters.search = searchInput.value;
    renderList();
  });

  const notRankedCheckbox = el("input", { type: "checkbox" });
  notRankedCheckbox.addEventListener("change", () => {
    filters.notRankedOnly = notRankedCheckbox.checked;
    renderList();
  });

  const eventsCheckbox = el("input", { type: "checkbox" });
  eventsCheckbox.addEventListener("change", () => {
    filters.eventsOnly = eventsCheckbox.checked;
    renderList();
  });

  const sortSelect = el(
    "select",
    {},
    [
      { value: "rank", label: "Ranking" },
      { value: "newest", label: "Newest" },
      { value: "neighborhood", label: "Neighborhood" },
      { value: "category", label: "Category" },
    ].map((o) => el("option", { value: o.value, textContent: o.label }))
  );
  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    renderList();
  });

  filtersEl.replaceChildren(
    categoryChipsEl,
    el("div", { className: "filters-row" }, [
      neighborhoodSelect,
      searchInput,
      el("label", { className: "checkbox-label" }, [notRankedCheckbox, " Not ranked by me"]),
      el("label", { className: "checkbox-label" }, [eventsCheckbox, " Events during trip dates"]),
      sortSelect,
    ])
  );

  function updateNeighborhoodOptions() {
    if (document.activeElement === neighborhoodSelect) return;
    const neighborhoods = [...new Set(places.map((p) => p.neighborhood).filter(Boolean))].sort();
    const key = neighborhoods.join("|");
    if (key === lastNeighborhoodsKey) return;
    lastNeighborhoodsKey = key;
    const current = filters.neighborhood;
    neighborhoodSelect.replaceChildren(
      el("option", { value: "", textContent: "All neighborhoods" }),
      ...neighborhoods.map((n) => el("option", { value: n, textContent: n }))
    );
    const stillExists = neighborhoods.includes(current);
    neighborhoodSelect.value = stillExists ? current : "";
    filters.neighborhood = neighborhoodSelect.value;
  }

  // --- Map ---
  function ensureMap() {
    if (map || typeof window === "undefined" || !window.L) return;
    map = window.L.map(mapEl, { scrollWheelZoom: true });
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    markerLayer = window.L.layerGroup().addTo(map);
    map.setView([20, 0], 2);
    map.on("click", (e) => {
      if (mapClickState.armed && mapClickState.onPick) mapClickState.onPick(e.latlng);
    });
  }

  function centerMapIfNeeded() {
    if (!map || mapCentered) return;
    const dest = trip && trip.destination;
    if (dest && dest.lat != null && dest.lng != null) {
      map.setView([dest.lat, dest.lng], 13);
      mapCentered = true;
    } else {
      const located = places.filter((p) => p.lat != null && p.lng != null);
      if (located.length > 0) {
        map.fitBounds(located.map((p) => [p.lat, p.lng]), { padding: [30, 30] });
        mapCentered = true;
      }
    }
  }

  function buildPopup(place) {
    const wrap = el("div", { className: "map-popup" });
    wrap.append(
      el("strong", { textContent: place.name }),
      el("p", { className: "muted", textContent: [place.category, place.neighborhood].filter(Boolean).join(" · ") })
    );
    if (place.note) wrap.append(el("p", { textContent: place.note }));
    wrap.append(el("p", { className: "muted", textContent: voteSummary(place.votes || {}) || "Not ranked yet" }));
    const openLink = el("a", {
      href: openMapsUrlFor(place, trip.destination && trip.destination.city),
      target: "_blank",
      rel: "noopener noreferrer",
      textContent: "Open in Google Maps",
    });
    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEditDialog(place));
    wrap.append(el("div", { className: "map-popup-actions" }, [openLink, editBtn]));
    return wrap;
  }

  async function openEditDialog(place) {
    const result = await editPlaceDialog(place);
    if (!result) return;
    try {
      await updatePlace(tripId, place.id, result);
    } catch (err) {
      loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  }

  function buildSetLocationInline(place) {
    const toggleBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Set location" });
    const holder = el("div", { className: "set-location-holder", hidden: true });
    toggleBtn.addEventListener("click", () => {
      holder.hidden = !holder.hidden;
      if (!holder.hidden && holder.children.length === 0) {
        const picker = buildLocationPicker({
          trip,
          mapClickState,
          onChange: async (payload) => {
            if (payload.lat == null) return;
            try {
              await updatePlace(tripId, place.id, {
                lat: payload.lat,
                lng: payload.lng,
                googleMapsUrl: payload.googleMapsUrl || place.googleMapsUrl || null,
              });
              holder.hidden = true;
            } catch (err) {
              loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
            }
          },
        });
        holder.appendChild(picker.element);
      }
    });
    return el("div", { className: "set-location-wrap" }, [toggleBtn, holder]);
  }

  function renderPlaceRow(place) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const hasLocation = place.lat != null && place.lng != null;

    const details = [];
    if (place.note) details.push(el("p", { textContent: place.note }));
    const safeLink = place.link ? safeUrl(place.link) : null;
    if (safeLink) details.push(el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Link" }));

    const rank = rankControl({
      votes: place.votes || {},
      myUid,
      usersById,
      onVote: (choice) =>
        voteOnPlace(tripId, place.id, myUid, choice).catch((err) =>
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
        ),
    });

    const openBtn = el("a", {
      className: "btn btn-small",
      href: openMapsUrlFor(place, trip.destination && trip.destination.city),
      target: "_blank",
      rel: "noopener noreferrer",
      textContent: "Open in Google Maps",
    });
    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEditDialog(place));
    const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog(`Delete ${place.name}?`);
      if (!confirmed) return;
      try {
        await deletePlace(tripId, place.id);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const { element: commentsEl, unsubscribe: commentsUnsub } = renderComments({
      tripId,
      targetType: "place",
      targetId: place.id,
      myUid,
      usersById,
    });
    placeCommentUnsubscribes.push(commentsUnsub);

    const row = el(
      "article",
      { className: "card place-row", attrs: { "data-place-id": place.id } },
      [
        el("div", { className: "place-row-title" }, [
          el("span", { className: "category-chip", textContent: place.category, style: `background:${CATEGORY_COLOR[place.category] || CATEGORY_COLOR.Other}` }),
          el("strong", { textContent: place.name }),
        ]),
        el("p", { className: "muted", textContent: place.neighborhood || "" }),
        ...details,
        hasLocation ? null : el("p", { className: "field-error", textContent: "No map pin" }),
        hasLocation ? null : buildSetLocationInline(place),
        rank,
        el("div", { className: "place-actions" }, [openBtn, editBtn, deleteBtn]),
        errorHolder,
        commentsEl,
      ].filter(Boolean)
    );

    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, textarea, select")) return;
      if (!hasLocation || !map) return;
      const marker = markersById.get(place.id);
      if (marker) {
        map.panTo(marker.getLatLng());
        marker.openPopup();
      }
    });

    return row;
  }

  function renderList() {
    if (!trip) return;
    ensureMap();
    updateNeighborhoodOptions();

    const filtered = applyFiltersAndSort(places, { filters, sortMode, trip, myUid });
    const notRankedCount = notRankedByMe(places, myUid).length;
    rankCountEl.textContent =
      notRankedCount > 0 ? `You haven't ranked ${notRankedCount} place${notRankedCount === 1 ? "" : "s"}.` : places.length > 0 ? "You've ranked every place." : "";

    for (const unsub of placeCommentUnsubscribes) unsub();
    placeCommentUnsubscribes = [];

    if (filtered.length === 0) {
      listEl.replaceChildren(el("p", { className: "empty-state", textContent: "No places match these filters." }));
    } else {
      listEl.replaceChildren(...filtered.map(renderPlaceRow));
    }

    if (markerLayer) {
      markerLayer.clearLayers();
      markersById.clear();
      for (const place of filtered) {
        if (place.lat == null || place.lng == null) continue;
        const color = CATEGORY_COLOR[place.category] || CATEGORY_COLOR.Other;
        const marker = window.L.circleMarker([place.lat, place.lng], { radius: 7, color, fillColor: color, fillOpacity: 0.85, weight: 2 });
        marker.bindPopup(buildPopup(place));
        marker.on("click", () => {
          const row = listEl.querySelector(`[data-place-id="${place.id}"]`);
          if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            row.classList.add("place-row-highlight");
            setTimeout(() => row.classList.remove("place-row-highlight"), 1500);
          }
        });
        marker.addTo(markerLayer);
        markersById.set(place.id, marker);
      }
    }
    centerMapIfNeeded();
  }

  function buildAddPlacePanel() {
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
        addPanelHolder.hidden = true;
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

  const unsubTrip = watchTrip(
    tripId,
    (t) => {
      trip = t;
      if (trip && !addPanelBuilt) {
        addPanelBuilt = true;
        buildAddPlacePanel();
      }
      if (trip) renderList();
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const unsubUsers = watchUsers(
    (u) => {
      usersById = u;
      renderList();
    },
    () => {}
  );
  const unsubPlaces = watchPlaces(
    tripId,
    (p) => {
      places = p;
      renderList();
    },
    (err) => listEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );

  return () => {
    unsubTrip();
    unsubUsers();
    unsubPlaces();
    for (const unsub of placeCommentUnsubscribes) unsub();
    if (map) {
      map.remove();
      map = null;
    }
  };
}
