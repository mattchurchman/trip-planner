import { watchTrip, watchUsers, watchPlaces, updatePlace, deletePlace, voteOnPlace, watchStays, watchDays, updateTripFields } from "../store.js";
import { el, confirmDialog, friendlyError, rankControl, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { renderExportSection } from "./exportSection.js";
import { editPlaceDialog, buildSetLocationInline, buildAddPlacePanel } from "./placeForm.js";
import { sortByRank, notRankedByMe, voteSummary, toMillis } from "../lib/votes.js";
import { safeUrl, googleMapsOpenUrl } from "../lib/links.js";
import { rangesOverlap } from "../lib/dates.js";
import { CATEGORIES, categoryColor } from "../lib/categories.js";

/**
 * Armed by the Overview tab's "Set on map" action when a chosen destination has no
 * coordinates (§7.5). The next click on this tab's map sets them. Module state rather
 * than storage because switching tabs rebuilds the view but never reloads the page.
 */
export const pendingDestinationPin = { tripId: null };

function openMapsUrlFor(place, destinationCity) {
  const saved = place.googleMapsUrl ? safeUrl(place.googleMapsUrl) : null;
  return saved || googleMapsOpenUrl(place.name, destinationCity || "");
}

function applyFiltersAndSort(places, { filters, sortMode, trip, myUid }) {
  let filtered = places.filter((p) => {
    if (filters.categories.size > 0 && !filters.categories.has(p.category)) return false;
    if (filters.neighborhood && p.neighborhood !== filters.neighborhood) return false;
    if (filters.search) {
      const haystack = `${p.name} ${p.note}`.toLowerCase();
      if (!haystack.includes(filters.search.toLowerCase())) return false;
    }
    if (filters.eventsOnly && !rangesOverlap(p.eventStart, p.eventEnd, trip.startDate, trip.endDate)) return false;
    return true;
  });
  if (filters.notRankedOnly) filtered = notRankedByMe(filtered, myUid);

  if (sortMode === "newest") return [...filtered].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  if (sortMode === "neighborhood") return [...filtered].sort((a, b) => (a.neighborhood || "").localeCompare(b.neighborhood || ""));
  if (sortMode === "category") return [...filtered].sort((a, b) => a.category.localeCompare(b.category));
  return sortByRank(filtered);
}

/** Renders the Places tab (§7.6) into `container`. Returns a single unsubscribe function. */
export function renderPlacesPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let places = [];
  let stays = [];
  let days = [];
  let placeCommentUnsubscribes = [];
  let map = null;
  let markerLayer = null;
  let stayMarkerLayer = null;
  let mapCentered = false;
  let addPanelBuilt = false;
  let showStays = true;
  const markersById = new Map();
  const mapClickState = { armed: false, onPick: null, disarm: null };
  const filters = { categories: new Set(), neighborhood: "", search: "", notRankedOnly: false, eventsOnly: false };
  let sortMode = "rank";
  let lastNeighborhoodsKey = "";

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const addPanelToggle = el("button", { type: "button", className: "btn btn-primary", textContent: "Add place", attrs: { "aria-expanded": "false" } });
  const addPanelHolder = el("div", { className: "add-place-holder", hidden: true });
  const filtersEl = el("div", { className: "places-filters card" });
  const rankCountEl = el("p", { className: "muted rank-count" });
  const listEl = el("div", { className: "places-list" });
  const mapEl = el("div", { className: "places-map" });
  const listMapWrap = el("div", { className: "places-list-map" }, [listEl, mapEl]);
  const noDestinationEl = el("p", { className: "empty-state", textContent: "Pick a destination on the Overview tab to start adding places.", hidden: true });
  const destinationPinHintEl = el("p", { className: "field-error destination-pin-hint", hidden: true });
  const exportSectionHolder = el("div", { className: "export-section-holder" });

  function onError(message) {
    loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
  }

  addPanelToggle.addEventListener("click", () => {
    addPanelHolder.hidden = !addPanelHolder.hidden;
    addPanelToggle.setAttribute("aria-expanded", addPanelHolder.hidden ? "false" : "true");
  });

  container.replaceChildren(
    loadErrorEl,
    el("div", { className: "places-header" }, [el("h2", { textContent: "Places" }), addPanelToggle]),
    noDestinationEl,
    destinationPinHintEl,
    addPanelHolder,
    filtersEl,
    rankCountEl,
    listMapWrap,
    exportSectionHolder
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

  const showStaysCheckbox = el("input", { type: "checkbox", checked: true });
  showStaysCheckbox.addEventListener("change", () => {
    showStays = showStaysCheckbox.checked;
    renderStayMarkers();
  });

  const sortSelect = el(
    "select",
    {},
    [
      { value: "rank", label: "Group favorites" },
      { value: "newest", label: "Newest" },
      { value: "neighborhood", label: "Neighborhood" },
      { value: "category", label: "Category" },
    ].map((o) => el("option", { value: o.value, textContent: o.label }))
  );
  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    renderList();
  });

  /** An inline filter control with a visible caption (§4: every control is labeled). */
  function filterLabel(caption, control) {
    return el("label", { className: "filter-label" }, [el("span", { textContent: caption }), control]);
  }

  filtersEl.replaceChildren(
    categoryChipsEl,
    el("div", { className: "filters-row" }, [
      filterLabel("Neighborhood", neighborhoodSelect),
      filterLabel("Search", searchInput),
      el("label", { className: "checkbox-label" }, [notRankedCheckbox, " I haven't ranked yet"]),
      el("label", { className: "checkbox-label" }, [eventsCheckbox, " Events during trip dates"]),
      el("label", { className: "checkbox-label" }, [showStaysCheckbox, " Show stays"]),
      filterLabel("Sort by", sortSelect),
    ])
  );

  function updateNeighborhoodOptions() {
    if (document.activeElement === neighborhoodSelect) return;
    const neighborhoods = [
      ...new Set(
        places
          .filter((p) => p.destinationId === trip.destinationId)
          .map((p) => p.neighborhood)
          .filter(Boolean)
      ),
    ].sort();
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
    stayMarkerLayer = window.L.layerGroup().addTo(map);
    map.setView([20, 0], 2);
    map.on("click", async (e) => {
      if (pendingDestinationPin.tripId === tripId) {
        pendingDestinationPin.tripId = null;
        try {
          await updateTripFields(tripId, {
            destination: { ...trip.destination, lat: e.latlng.lat, lng: e.latlng.lng },
          });
          mapCentered = false;
        } catch (err) {
          onError(friendlyError(err));
        }
        renderDestinationPinHint();
        return;
      }
      if (mapClickState.armed && mapClickState.onPick) mapClickState.onPick(e.latlng);
    });
  }

  /** The prompt shown while "Set on map" is armed from the Overview tab (§7.5). */
  function renderDestinationPinHint() {
    const armed = pendingDestinationPin.tripId === tripId;
    destinationPinHintEl.hidden = !armed;
    if (armed) {
      destinationPinHintEl.textContent = "Click the map to set this destination's location.";
    }
  }

  /** Stays with coordinates appear as larger markers on this map (§7.7), toggled by "Show stays". */
  function renderStayMarkers() {
    if (!stayMarkerLayer) return;
    stayMarkerLayer.clearLayers();
    if (!showStays) return;
    for (const stay of stays) {
      if (stay.lat == null || stay.lng == null) continue;
      const marker = window.L.circleMarker([stay.lat, stay.lng], {
        radius: 9,
        color: "#fff",
        weight: 2,
        fillColor: "#202124",
        fillOpacity: 1,
      });
      marker.bindTooltip(`Stay: ${stay.name}`);
      marker.addTo(stayMarkerLayer);
    }
  }

  function centerMapIfNeeded() {
    if (!map || mapCentered) return;
    const dest = trip && trip.destination;
    if (dest && dest.lat != null && dest.lng != null) {
      map.setView([dest.lat, dest.lng], 13);
      mapCentered = true;
    } else {
      const located = places.filter((p) => p.destinationId === trip.destinationId && p.lat != null && p.lng != null);
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
      onError(friendlyError(err));
    }
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
      const confirmed = await confirmDialog(`Delete ${place.name}?`, "Delete");
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

    function panToMarker() {
      if (!hasLocation || !map) return;
      const marker = markersById.get(place.id);
      if (!marker) return;
      map.panTo(marker.getLatLng());
      marker.openPopup();
    }

    // Keyboard users can't reach the row's click-to-pan, so the name itself is the
    // control when there's a pin to pan to (§4: reachable by keyboard).
    const nameEl = hasLocation
      ? el("button", {
          type: "button",
          className: "place-name-btn",
          textContent: place.name,
          attrs: { "aria-label": `${place.name} — show on map` },
          onclick: panToMarker,
        })
      : el("strong", { textContent: place.name });

    const row = el(
      "article",
      { className: "card place-row", attrs: { "data-place-id": place.id } },
      [
        el("div", { className: "place-row-title" }, [
          el("span", { className: "category-chip", textContent: place.category, style: `background:${categoryColor(place.category)}` }),
          nameEl,
        ]),
        el("p", { className: "muted", textContent: place.neighborhood || "" }),
        ...details,
        hasLocation ? null : el("p", { className: "field-error", textContent: "No map pin" }),
        buildSetLocationInline({ place, trip, tripId, mapClickState, onError }),
        rank,
        el("div", { className: "place-actions" }, [openBtn, editBtn, deleteBtn]),
        errorHolder,
        commentsEl,
      ].filter(Boolean)
    );

    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, textarea, select")) return;
      panToMarker();
    });

    return row;
  }

  /** Current filtered set. Recomputed on demand so a deferred row rebuild
   * (renderWhenIdle) still renders the newest data rather than a stale snapshot. */
  function currentFiltered() {
    const placesForDestination = places.filter((p) => p.destinationId === trip.destinationId);
    return applyFiltersAndSort(placesForDestination, { filters, sortMode, trip, myUid });
  }

  function renderRows() {
    for (const unsub of placeCommentUnsubscribes) unsub();
    placeCommentUnsubscribes = [];
    const filtered = currentFiltered();
    if (filtered.length === 0) {
      listEl.replaceChildren(el("p", { className: "empty-state", textContent: "No places match these filters. Try adjusting them." }));
    } else {
      listEl.replaceChildren(...filtered.map(renderPlaceRow));
    }
  }

  function renderList() {
    if (!trip) return;

    const hasDestination = Boolean(trip.destinationId);
    noDestinationEl.hidden = hasDestination;
    addPanelToggle.hidden = !hasDestination;
    filtersEl.hidden = !hasDestination;
    rankCountEl.hidden = !hasDestination;
    listMapWrap.hidden = !hasDestination;
    exportSectionHolder.hidden = !hasDestination;
    if (!hasDestination) {
      addPanelHolder.hidden = true;
      return;
    }

    ensureMap();
    renderDestinationPinHint();
    updateNeighborhoodOptions();

    const placesForDestination = places.filter((p) => p.destinationId === trip.destinationId);
    exportSectionHolder.replaceChildren(renderExportSection({ trip, places: placesForDestination, days }));
    const filtered = currentFiltered();
    const notRankedCount = notRankedByMe(placesForDestination, myUid).length;
    rankCountEl.textContent =
      notRankedCount > 0
        ? `You haven't ranked ${notRankedCount} place${notRankedCount === 1 ? "" : "s"}.`
        : placesForDestination.length > 0
          ? "You've ranked every place."
          : "";

    // Rows carry comment drafts and open location pickers, so hold the rebuild
    // until the user stops typing (§8). Markers below refresh either way.
    renderWhenIdle(listEl, renderRows);

    if (markerLayer) {
      markerLayer.clearLayers();
      markersById.clear();
      for (const place of filtered) {
        if (place.lat == null || place.lng == null) continue;
        const color = categoryColor(place.category);
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
    renderStayMarkers();
    centerMapIfNeeded();
  }

  const unsubTrip = watchTrip(
    tripId,
    (t) => {
      trip = t;
      if (trip && !addPanelBuilt) {
        addPanelBuilt = true;
        buildAddPlacePanel({
          trip,
          tripId,
          myUid,
          mapClickState,
          addPanelHolder,
          onAdded: () => {
            addPanelHolder.hidden = true;
            addPanelToggle.setAttribute("aria-expanded", "false");
          },
        });
      }
      if (trip) renderList();
    },
    (err) => onError(friendlyError(err))
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
  const unsubStays = watchStays(
    tripId,
    (s) => {
      stays = s;
      ensureMap();
      renderStayMarkers();
    },
    () => {}
  );
  const unsubDays = watchDays(
    tripId,
    (d) => {
      days = d;
      if (trip) renderList();
    },
    () => {}
  );

  return () => {
    unsubTrip();
    unsubUsers();
    unsubPlaces();
    unsubStays();
    unsubDays();
    for (const unsub of placeCommentUnsubscribes) unsub();
    if (map) {
      map.remove();
      map = null;
    }
  };
}
