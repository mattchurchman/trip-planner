import { updatePlace, deletePlace, voteOnPlace } from "../store.js";
import { el, confirmDialog, friendlyError, rankControl, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { editPlaceDialog, buildSetLocationInline, buildAddPlacePanel } from "./placeForm.js";
import { sortByRank, notRankedByMe, voteSummary, toMillis } from "../lib/votes.js";
import { safeUrl, googleMapsOpenUrl } from "../lib/links.js";
import { rangesOverlap } from "../lib/dates.js";
import { CATEGORIES, categoryColor } from "../lib/categories.js";

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

/**
 * Builds the Places list of the Map tab (T25): the Add button, filters, and
 * places grouped by nothing in particular (the stop chips above do the
 * grouping, by filtering which places are passed to `render`). Call
 * `render(places, trip, usersById)` whenever trip/places/users or the chosen
 * stop chip change — `places` is already narrowed to the current chip by the
 * caller. `onFocusOnMap(place)` pans the shared map (owned by
 * the caller, T25) to that place's pin; `cities` is the live list the
 * caller keeps updated, used to work out a new pin's `stopKey` (V4 §6).
 */
export function createPlacesSection({ tripId, myUid, onError, mapClickState, onFocusOnMap, cities = [] }) {
  let trip = null;
  let usersById = {};
  let places = [];
  let placeCommentUnsubscribes = [];
  let addPanelBuilt = false;
  const filters = { categories: new Set(), neighborhood: "", search: "", notRankedOnly: false, eventsOnly: false };
  let sortMode = "rank";
  let lastNeighborhoodsKey = "";

  const addPanelToggle = el("button", { type: "button", className: "btn btn-primary", textContent: "Add place", attrs: { "aria-expanded": "false" } });
  const addPanelHolder = el("div", { className: "add-place-holder", hidden: true });
  const filtersEl = el("div", { className: "places-filters card" });
  const rankCountEl = el("p", { className: "muted rank-count" });
  const listEl = el("div", { className: "places-list" });

  addPanelToggle.addEventListener("click", () => {
    addPanelHolder.hidden = !addPanelHolder.hidden;
    addPanelToggle.setAttribute("aria-expanded", addPanelHolder.hidden ? "false" : "true");
  });

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
      filterLabel("Sort by", sortSelect),
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

    // Keyboard users can't reach the row's click-to-pan, so the name itself is the
    // control when there's a pin to pan to (§4: reachable by keyboard).
    const nameEl = hasLocation
      ? el("button", {
          type: "button",
          className: "place-name-btn",
          textContent: place.name,
          attrs: { "aria-label": `${place.name} — show on map` },
          onclick: () => onFocusOnMap(place),
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
        buildSetLocationInline({ place, trip, tripId, mapClickState, onError, cities }),
        rank,
        el("div", { className: "place-actions" }, [openBtn, editBtn, deleteBtn]),
        errorHolder,
        commentsEl,
      ].filter(Boolean)
    );

    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, textarea, select")) return;
      if (hasLocation) onFocusOnMap(place);
    });

    return row;
  }

  /** Current filtered set. Recomputed on demand so a deferred row rebuild
   * (renderWhenIdle) still renders the newest data rather than a stale snapshot. */
  function currentFiltered() {
    return applyFiltersAndSort(places, { filters, sortMode, trip, myUid });
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
    updateNeighborhoodOptions();

    const notRankedCount = notRankedByMe(places, myUid).length;
    rankCountEl.textContent =
      notRankedCount > 0
        ? `You haven't ranked ${notRankedCount} place${notRankedCount === 1 ? "" : "s"}.`
        : places.length > 0
          ? "You've ranked every place."
          : "";

    // Rows carry comment drafts and open location pickers, so hold the rebuild
    // until the user stops typing (§8).
    renderWhenIdle(listEl, renderRows);
  }

  const element = el("div", {}, [
    el("div", { className: "places-header" }, [addPanelToggle]),
    addPanelHolder,
    filtersEl,
    rankCountEl,
    listEl,
  ]);

  return {
    element,
    render(newPlaces, newTrip, newUsersById) {
      trip = newTrip;
      usersById = newUsersById;
      places = newPlaces;
      if (trip && !addPanelBuilt) {
        addPanelBuilt = true;
        buildAddPlacePanel({
          trip,
          tripId,
          myUid,
          mapClickState,
          addPanelHolder,
          cities,
          onAdded: () => {
            addPanelHolder.hidden = true;
            addPanelToggle.setAttribute("aria-expanded", "false");
          },
        });
      }
      renderList();
    },
    focusCard(placeId) {
      const row = listEl.querySelector(`[data-place-id="${placeId}"]`);
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("place-row-highlight");
      setTimeout(() => row.classList.remove("place-row-highlight"), 1500);
    },
    unsubscribe() {
      for (const unsub of placeCommentUnsubscribes) unsub();
    },
  };
}
