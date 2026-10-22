import { updatePlace, deletePlace, voteOnPlace } from "../store.js";
import { el, confirmDialog, externalLink, friendlyError, rankControl, renderWhenIdle, menuButton } from "../ui.js";
import { renderComments } from "./comments.js";
import { editPlaceDialog, buildSetLocationInline, buildAddPlacePanel } from "./placeForm.js";
import { voteBar } from "./voteBar.js";
import { sortByRank, notRankedByMe, toMillis } from "../lib/votes.js";
import { safeUrl, googleMapsOpenUrl } from "../lib/links.js";
import { CATEGORIES, categoryColor } from "../lib/categories.js";
import { formatNote, splitLinks } from "../lib/notes.js";

function openMapsUrlFor(place, selectedCity) {
  const saved = place.googleMapsUrl ? safeUrl(place.googleMapsUrl) : null;
  return saved || googleMapsOpenUrl(place.name, selectedCity || "");
}

function applyFiltersAndSort(places, { filters, sortMode, myUid }) {
  let filtered = places.filter((p) => {
    if (filters.categories.size > 0 && !filters.categories.has(p.category)) return false;
    if (filters.neighborhood && p.neighborhood !== filters.neighborhood) return false;
    if (filters.search) {
      const haystack = `${p.name} ${p.note}`.toLowerCase();
      if (!haystack.includes(filters.search.toLowerCase())) return false;
    }
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
 * `render(places, trip, usersById, selectedCity)` whenever trip/places/users
 * or the chosen stop chip change — `places` is already narrowed to the
 * current chip by the caller. `onFocusOnMap(place)` pans the shared map
 * (owned by the caller, T25) to that place's pin; `cities` is the live list
 * the caller keeps updated, used to work out a new pin's `stopKey` (V4 §6).
 * `selectedCity` (T31, §7.7) is the city name of the stop chip currently
 * selected on the Map tab, or `null` with "All"/"Elsewhere"/no chip — there's
 * no trip-wide destination any more, so every Google Maps search link uses
 * this instead.
 */
export function createPlacesSection({ tripId, myUid, onError, mapClickState, onFocusOnMap, cities = [] }) {
  let trip = null;
  let usersById = {};
  let places = [];
  let selectedCity = null;
  let placeCommentUnsubscribes = [];
  let addPanelBuilt = false;
  let addPanel = null;
  const filters = { categories: new Set(), neighborhood: "", search: "", notRankedOnly: false };
  let openPlaceId = null;
  let sortMode = "rank";
  let lastNeighborhoodsKey = "";

  const addPanelToggle = el("button", { type: "button", className: "btn btn-primary", textContent: "Add place", attrs: { "aria-expanded": "false" } });
  const addPanelHolder = el("div", { className: "add-place-holder", hidden: true });
  const filtersBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Filters", onclick: () => openFiltersSheet() });
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

  const searchInput = el("input", { type: "text", placeholder: "Search name or note", attrs: { "aria-label": "Search name or note" } });
  searchInput.addEventListener("input", () => {
    filters.search = searchInput.value;
    renderList();
  });

  const notRankedCheckbox = el("input", { type: "checkbox" });
  notRankedCheckbox.addEventListener("change", () => {
    filters.notRankedOnly = notRankedCheckbox.checked;
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

  /** Opens the Filters sheet (R7 §7 "Map"): category chips, neighborhood,
   * "I haven't ranked yet" and sort, applying live — Done just closes it. The
   * search box stays on the toolbar, outside the sheet. */
  function openFiltersSheet() {
    const doneBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Done" });
    const form = el("form", { method: "dialog" }, [
      el("h3", { textContent: "Filters" }),
      categoryChipsEl,
      el("div", { className: "filters-row" }, [
        filterLabel("Neighborhood", neighborhoodSelect),
        el("label", { className: "checkbox-label" }, [notRankedCheckbox, " I haven't ranked yet"]),
        filterLabel("Sort by", sortSelect),
      ]),
      el("div", { className: "dialog-actions" }, [doneBtn]),
    ]);
    const dialog = el("dialog", { className: "app-dialog app-dialog-form filters-dialog" }, [form]);
    document.body.appendChild(dialog);
    doneBtn.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => dialog.remove());
    dialog.showModal();
  }

  /** Active filter dimensions (categories, neighborhood, not-ranked-yet) for
   * the "Filters · N" button label — sort isn't a filter, so it's excluded. */
  function activeFilterCount() {
    return (filters.categories.size > 0 ? 1 : 0) + (filters.neighborhood ? 1 : 0) + (filters.notRankedOnly ? 1 : 0);
  }

  function updateFiltersBtnLabel() {
    const count = activeFilterCount();
    filtersBtn.textContent = count > 0 ? `Filters · ${count}` : "Filters";
  }

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

  function linkedNoteText(text) {
    return splitLinks(text).map((piece) => piece.url ? externalLink(piece.url, piece.host) : piece.text).filter(Boolean);
  }

  function renderNote(note) {
    const blocks = formatNote(note);
    if (blocks.every((block) => block.type === "text")) {
      return el("div", {}, blocks.map((block) => el("p", {}, linkedNoteText(block.text))));
    }
    return el("dl", { className: "note-fields" }, blocks.flatMap((block) => {
      if (block.type === "text") return [el("p", {}, linkedNoteText(block.text))];
      return [
        el("dt", { textContent: block.label }),
        ...block.values.map((value) => el("dd", {}, linkedNoteText(value))),
      ];
    }));
  }

  function renderPlaceRow(place) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const hasLocation = place.lat != null && place.lng != null;

    const bodyDetails = [];
    if (place.neighborhood) bodyDetails.push(el("p", { className: "muted", textContent: place.neighborhood }));
    if (place.note) bodyDetails.push(renderNote(place.note));
    const safeLink = place.link ? safeUrl(place.link) : null;
    if (safeLink) bodyDetails.push(el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Link" }));

    const castVote = (choice) =>
      voteOnPlace(tripId, place.id, myUid, choice).catch((err) =>
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
      );
    const rank = rankControl({ votes: place.votes || {}, myUid, usersById, onVote: castVote }); // who-voted-what only (§7.7)
    rank.querySelector(".rank-buttons")?.remove();

    const showOnMapBtn = hasLocation
      ? el("button", { type: "button", className: "btn btn-small", textContent: "Show on map", onclick: () => onFocusOnMap(place) })
      : null;
    const openBtn = el("a", {
      className: "btn btn-small",
      href: openMapsUrlFor(place, selectedCity),
      target: "_blank",
      rel: "noopener noreferrer",
      textContent: "Open in Google Maps",
    });
    const locationInline = buildSetLocationInline({ place, city: selectedCity, tripId, mapClickState, onError, cities });
    const locationToggleBtn = locationInline.querySelector("button");
    if (locationToggleBtn) locationToggleBtn.hidden = true;
    const menu = menuButton(
      [
        { label: "Edit", icon: "edit", onSelect: () => openEditDialog(place) },
        { label: hasLocation ? "Edit location" : "Set location", icon: "place", onSelect: () => locationToggleBtn?.click() },
        {
          label: "Delete",
          icon: "trash",
          danger: true,
          onSelect: async () => {
            const confirmed = await confirmDialog(`Delete ${place.name}?`, "Delete");
            if (!confirmed) return;
            try {
              await deletePlace(tripId, place.id);
            } catch (err) {
              errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
            }
          },
        },
      ],
      { label: `More actions for ${place.name}` }
    );

    const { element: commentsEl, unsubscribe: commentsUnsub } = renderComments({
      tripId,
      targetType: "place",
      targetId: place.id,
      myUid,
      usersById,
    });
    placeCommentUnsubscribes.push(commentsUnsub);

    const row = el("details", {
      className: "card place-row",
      open: openPlaceId === place.id,
      attrs: { "data-place-id": place.id },
      ontoggle: () => {
        if (row.open) {
          openPlaceId = place.id;
          for (const other of listEl.querySelectorAll(".place-row")) {
            if (other !== row) other.open = false;
          }
          row.scrollIntoView({ block: "nearest" });
        } else if (openPlaceId === place.id) {
          openPlaceId = null;
        }
      },
    });

    const vote = voteBar({ votes: place.votes || {}, myUid, onVote: castVote });
    const summary = el("summary", { className: "place-row-summary" }, [
      el("span", { className: "category-chip", textContent: place.category, style: `background:${categoryColor(place.category)}` }),
      el("span", { className: "place-row-name", textContent: place.name }),
      vote,
    ]);

    const body = el(
      "div",
      { className: "place-row-body" },
      [
        ...bodyDetails,
        hasLocation ? null : el("p", { className: "field-error", textContent: "No map pin" }),
        locationInline,
        rank,
        el("div", { className: "place-actions" }, [showOnMapBtn, openBtn, menu].filter(Boolean)),
        errorHolder,
        commentsEl,
      ].filter(Boolean)
    );

    row.append(summary, body);
    return row;
  }

  /** Current filtered set. Recomputed on demand so a deferred row rebuild
   * (renderWhenIdle) still renders the newest data rather than a stale snapshot. */
  function currentFiltered() {
    return applyFiltersAndSort(places, { filters, sortMode, myUid });
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
    updateFiltersBtnLabel();

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
    el("div", { className: "places-toolbar" }, [addPanelToggle, filtersBtn, searchInput]),
    addPanelHolder,
    rankCountEl,
    listEl,
  ]);

  return {
    element,
    render(newPlaces, newTrip, newUsersById, newSelectedCity = null) {
      trip = newTrip;
      usersById = newUsersById;
      places = newPlaces;
      selectedCity = newSelectedCity;
      if (trip && !addPanelBuilt) {
        addPanelBuilt = true;
        addPanel = buildAddPlacePanel({
          tripId,
          myUid,
          mapClickState,
          addPanelHolder,
          cities,
          getCity: () => selectedCity,
          onAdded: () => {
            addPanelHolder.hidden = true;
            addPanelToggle.setAttribute("aria-expanded", "false");
          },
        });
      }
      if (addPanel) addPanel.refreshCity();
      renderList();
    },
    focusCard(placeId) {
      openPlaceId = placeId;
      for (const other of listEl.querySelectorAll(".place-row")) {
        if (other.dataset.placeId !== String(placeId)) other.open = false;
      }
      const row = listEl.querySelector(`[data-place-id="${placeId}"]`);
      if (!row) return;
      row.open = true;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("place-row-highlight");
      setTimeout(() => row.classList.remove("place-row-highlight"), 1500);
    },
    unsubscribe() {
      for (const unsub of placeCommentUnsubscribes) unsub();
    },
  };
}
