import { watchTrip, watchUsers, watchPlaces, watchStays, watchFlights, watchOptions, addPlacesBatch, updateTripFields } from "../store.js";
import { el, icon, externalLink, friendlyError, toast } from "../ui.js";
import { importFromMyMapsDialog } from "./importPlaces.js";
import { editLinkSheet } from "./sharedLinks.js";
import { parseMyMapsUrl, isShortMapsLink } from "../lib/mymaps.js";
import { loadAirports } from "../lookup.js";
import { stopsFor } from "../lib/route.js";
import { mergedStops, budgetContext } from "../lib/choices.js";
import { nearestStop, stopChips, stayStopKey, cityKeyOf } from "../lib/stops.js";
import { categoryColor } from "../lib/categories.js";
import { voteCounts } from "../lib/votes.js";
import { stayNumbers } from "../lib/optionSort.js";
import { stayPinLabel } from "../lib/staypins.js";
import { latestEntry } from "../lib/totals.js";
import { nightsBetween } from "../lib/dates.js";
import { isStayChosen } from "../lib/selection.js";
import { createPlacesSection } from "./places.js";
import { createStaysSection } from "./stays.js";

const ELSEWHERE = "elsewhere";

/** `stopsFor`'s stops, each carrying its airport's coordinates and a `stopKey`
 * for `nearestStop`/`stopChips` (V4 §6, §8): a merged stop's own key (a return
 * visit's is `cityKey#2`, §11), or its `cityKey` for a stop straight out of
 * `stopsFor`. */
function withCoords(stops, airports) {
  return stops.map((stop) => {
    const info = stop.code ? airports.info(stop.code) : null;
    const located = info && typeof info === "object";
    return { ...stop, stopKey: stop.stopKey || stop.cityKey, lat: located ? info.lat : null, lng: located ? info.lng : null };
  });
}

function hopFlightsFor(flights, optionId) {
  return flights.filter((f) => f.role === "hop" && f.optionId === optionId);
}

/** The merged route — every traveler's own stops, merged into one (§11). */
function chosenStops(trip, flights, options, airports) {
  return withCoords(mergedStops({ travelers: trip.travelers || [], trip, options, flights, airports }), airports);
}

/** Every city across every option (V4 §8), for the stop chips before a
 * route is chosen. Approximate: pools every traveler's picked home flights
 * for each idea rather than picking one, since there's no "the" traveler yet. */
function allOptionCities(flights, options, airports) {
  const seen = new Set();
  const cities = [];
  for (const option of options) {
    const homeFlights = flights.filter((f) => f.role === "home" && f.ideaId === option.ideaId && f.picked !== false);
    for (const stop of withCoords(stopsFor({ homeFlights, hopFlights: hopFlightsFor(flights, option.id), airports }), airports)) {
      if (stop.stopKey && !seen.has(stop.stopKey)) {
        seen.add(stop.stopKey);
        cities.push(stop);
      }
    }
  }
  return cities;
}

function placePinStyle(place) {
  const counts = voteCounts(place.votes || {});
  const color = categoryColor(place.category);
  const loved = counts.love > 0;
  const passOnly = counts.love === 0 && counts.like === 0 && counts.pass > 0;
  return { radius: loved ? 10 : 7, color: loved ? "#fff" : color, weight: loved ? 3 : 2, fillColor: color, fillOpacity: passOnly ? 0.35 : 0.85 };
}

/** Renders the Map tab (T25, V4 §8): one Leaflet map with place and stay
 * pins together, stop chips that filter both and fit the map, and a
 * Places/Stays switch for the list underneath. Returns a single unsubscribe
 * function. */
export function renderMapPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let places = [];
  let stays = [];
  let flights = [];
  let options = [];
  let airports = null;

  let map = null;
  let placeLayer = null;
  let stayLayer = null;
  let everFitted = false;
  let selectedChip = null; // null = "All"; ELSEWHERE; or a stopKey
  let listMode = "places";
  const mapClickState = { armed: false, onPick: null, disarm: null };
  const cities = []; // mutated in place; read live by the places section's forms
  let routeStops = []; // the merged route (§11), empty until someone chooses an option
  const placeMarkersById = new Map();
  const stayMarkersById = new Map();

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const mapBarEl = el("div", { className: "map-bar card" });
  const chipsEl = el("div", { className: "category-chips stop-chips" });
  const noRouteHintEl = el("p", { className: "muted", hidden: true, textContent: "Choose an option on Routes to group this by your actual route." });
  const switchEl = el("div", { className: "seg", attrs: { role: "group", "aria-label": "Show" } });
  const mapEl = el("div", { className: "map-tab-map" });
  const placesHolder = el("div", {});
  const staysHolder = el("div", { hidden: true });
  const listEl = el("div", { className: "map-tab-list" }, [switchEl, placesHolder, staysHolder]);
  const layoutEl = el("div", { className: "map-tab-layout" }, [listEl, mapEl]);

  function onError(message) {
    loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
  }

  function focusMapPin(kind, id) {
    if (!map) return;
    const marker = (kind === "place" ? placeMarkersById : stayMarkersById).get(id);
    if (!marker) return;
    if (window.innerWidth < 760) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
    map.panTo(marker.getLatLng());
  }

  const placesSection = createPlacesSection({
    tripId,
    myUid,
    onError,
    mapClickState,
    cities,
    onFocusOnMap: (place) => focusMapPin("place", place.id),
  });
  const staysSection = createStaysSection({
    tripId,
    myUid,
    onError,
    onFocusOnMap: (stay) => focusMapPin("stay", stay.id),
  });
  placesHolder.replaceChildren(placesSection.element);
  staysHolder.replaceChildren(staysSection.element);

  const placesBtn = el("button", { type: "button", textContent: "Places", attrs: { "aria-pressed": "true" } });
  const staysBtn = el("button", { type: "button", textContent: "Stays", attrs: { "aria-pressed": "false" } });
  function setListMode(mode) {
    listMode = mode;
    placesBtn.setAttribute("aria-pressed", String(mode === "places"));
    staysBtn.setAttribute("aria-pressed", String(mode === "stays"));
    placesHolder.hidden = mode !== "places";
    staysHolder.hidden = mode !== "stays";
  }
  placesBtn.addEventListener("click", () => setListMode("places"));
  staysBtn.addEventListener("click", () => setListMode("stays"));
  switchEl.replaceChildren(placesBtn, staysBtn);

  container.replaceChildren(loadErrorEl, chipsEl, mapBarEl, noRouteHintEl, layoutEl);

  /** Validates a pasted My Maps link for the "Add link" sheet (mirrors
   * `sharedLinks.js`'s own, which isn't exported). */
  function myMapsMessage(text) {
    if (parseMyMapsUrl(text)) return null;
    if (isShortMapsLink(text)) return "That's a short link. Open it, then copy the address from the browser bar and paste that.";
    return "That doesn't look like a Google My Maps link (it should contain google.com/maps/d/).";
  }

  async function openAddMyMapsLinkSheet() {
    const value = await editLinkSheet({
      title: "Our My Maps link",
      placeholder: "https://www.google.com/maps/d/edit?mid=…",
      ariaLabel: "My Maps link",
      initialValue: trip?.myMapsUrl || "",
      validate: myMapsMessage,
    });
    if (value === null) return;
    try {
      await updateTripFields(tripId, { myMapsUrl: value });
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  async function openImportDialog() {
    const result = await importFromMyMapsDialog({ places, myMapsLink: trip ? parseMyMapsUrl(trip.myMapsUrl || "") : null });
    if (!result || result.toAdd.length === 0) return;
    try {
      await addPlacesBatch(
        tripId,
        result.toAdd.map((pin) => ({
          name: pin.name,
          category: pin.category,
          note: pin.note,
          lat: pin.lat,
          lng: pin.lng,
          layer: pin.layer,
          stopKey: nearestStop(pin.lat, pin.lng, cities),
        })),
        myUid
      );
      toast(
        result.duplicateCount > 0
          ? `Added ${result.toAdd.length} places (${result.duplicateCount} already here).`
          : `Added ${result.toAdd.length} places.`
      );
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  /** The shared map bar (R7 §8 point 2), between the stop chips and the
   * Places/Stays switch: the group's My Maps link, set or not, plus Import. */
  function renderMapBar() {
    const parsed = trip ? parseMyMapsUrl(trip.myMapsUrl || "") : null;
    const importBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Import", onclick: openImportDialog });
    if (parsed) {
      mapBarEl.replaceChildren(
        icon("map", { size: 20 }),
        el("span", { className: "map-bar-text", textContent: "Our shared map" }),
        el("div", { className: "map-bar-actions" }, [
          externalLink(parsed.url, "Open ↗"),
          el("a", { className: "btn btn-small", href: parsed.kmlUrl, target: "_blank", rel: "noopener noreferrer", textContent: "Get KML" }),
          importBtn,
        ])
      );
    } else {
      mapBarEl.replaceChildren(
        icon("map", { size: 20 }),
        el("span", { className: "map-bar-text muted", textContent: "Add your group's My Maps link to import it in two taps" }),
        el("div", { className: "map-bar-actions" }, [
          el("button", { type: "button", className: "btn btn-small", textContent: "Add link", onclick: openAddMyMapsLinkSheet }),
          importBtn,
        ])
      );
    }
  }

  function ensureMap() {
    if (map || typeof window === "undefined" || !window.L) return;
    map = window.L.map(mapEl, { scrollWheelZoom: true });
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    placeLayer = window.L.layerGroup().addTo(map);
    stayLayer = window.L.layerGroup().addTo(map);
    map.setView([20, 0], 2);
    map.on("click", (e) => {
      if (mapClickState.armed && mapClickState.onPick) mapClickState.onPick(e.latlng);
    });
    // The fixed phone height and the sticky desktop one both change size on
    // rotation; Leaflet caches its size, so pins drift off-centre without this.
    window.addEventListener("orientationchange", () => setTimeout(() => map.invalidateSize(), 200));
  }

  function isKnownCity(stopKey) {
    return cities.some((c) => c.stopKey === stopKey);
  }

  /** A place/stay's stop for chip filtering (V4 §6): its own `stopKey` when
   * set, else the nearest current stop worked out from its pin — never
   * written back, so an outdated option change never needs a mass-write. */
  function effectiveStopKey(item) {
    if (item.stopKey) return item.stopKey;
    if (item.lat != null && item.lng != null) return nearestStop(item.lat, item.lng, cities);
    return null;
  }

  /** A stay's stop for chip filtering (T38): the same rule the Stays list
   * groups by, so a stay's pin and its card always agree on where it is. */
  function effectiveStayKey(stay) {
    return stayStopKey(stay, routeStops, cities);
  }

  /** Chips are one per city, so a stay or place on a return visit
   * ("Lisbon, PT#2", §11) filters under that city like any other. */
  function matchesChip(stopKey) {
    if (selectedChip == null) return true;
    const key = cityKeyOf(stopKey);
    if (selectedChip === ELSEWHERE) return !key || !isKnownCity(key);
    return key === selectedChip;
  }

  /** The city name place-search links should use (T31, §7.7, §9.2): the stop
   * chip currently selected, or `null` for "All"/"Elsewhere"/no chip — there's
   * no trip-wide destination any more. */
  function selectedCityName() {
    if (selectedChip == null || selectedChip === ELSEWHERE) return null;
    const city = cities.find((c) => c.stopKey === selectedChip);
    return city ? city.city : null;
  }

  function chipButton(label, key) {
    const btn = el("button", { type: "button", className: "chip", textContent: label });
    if (selectedChip === key) btn.classList.add("chip-active");
    btn.addEventListener("click", () => {
      selectedChip = key;
      rerenderAll(true);
    });
    return btn;
  }

  function renderChips(chips) {
    if (chips.length === 0) {
      chipsEl.hidden = true;
      return;
    }
    chipsEl.hidden = false;
    chipsEl.replaceChildren(chipButton("All", null), ...chips.map((c) => chipButton(c.city, c.stopKey)), chipButton("Elsewhere", ELSEWHERE));
  }

  function renderPins(visiblePlaces, visibleStays) {
    ensureMap();
    if (!map) return;
    placeLayer.clearLayers();
    placeMarkersById.clear();
    for (const place of visiblePlaces) {
      if (place.lat == null || place.lng == null) continue;
      const marker = window.L.circleMarker([place.lat, place.lng], placePinStyle(place));
      marker.bindTooltip(place.name);
      marker.on("click", () => {
        setListMode("places");
        placesSection.focusCard(place.id);
      });
      marker.addTo(placeLayer);
      placeMarkersById.set(place.id, marker);
    }

    stayLayer.clearLayers();
    stayMarkersById.clear();
    const numbers = stayNumbers(stays);
    for (const stay of visibleStays) {
      if (stay.lat == null || stay.lng == null) continue;
      const nights = nightsBetween(stay.checkIn, stay.checkOut);
      const latest = latestEntry(stay.prices);
      const label = stayPinLabel({ number: numbers[stay.id], latestCents: latest ? latest.amountCents : null, nights, currency: trip.currency });
      const chosen = isStayChosen(trip, stay.id);
      const pillEl = el("div", { className: `stay-pin${chosen ? " stay-pin-chosen" : ""}`, textContent: label });
      const icon = window.L.divIcon({ html: pillEl, className: "stay-pin-icon", iconSize: null });
      const marker = window.L.marker([stay.lat, stay.lng], { icon });
      marker.on("click", () => {
        setListMode("stays");
        staysSection.focusCard(stay.id);
      });
      marker.addTo(stayLayer);
      stayMarkersById.set(stay.id, marker);
    }
  }

  /** Moves the map to the chip's city or the visible pins; true when it had
   * something real to show (false = the empty world view). */
  function fitMap(visiblePlaces, visibleStays) {
    if (!map) return false;
    if (selectedChip && selectedChip !== ELSEWHERE) {
      const city = cities.find((c) => c.stopKey === selectedChip);
      if (city && city.lat != null && city.lng != null) {
        map.setView([city.lat, city.lng], 12);
        return true;
      }
    }
    const points = [...visiblePlaces, ...visibleStays].filter((p) => p.lat != null && p.lng != null).map((p) => [p.lat, p.lng]);
    if (points.length > 0) {
      map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
      return true;
    }
    map.setView([20, 0], 2);
    return false;
  }

  function rerenderAll(forceFit = false) {
    if (!trip) return;
    renderMapBar();
    const chosen = airports ? chosenStops(trip, flights, options, airports) : [];
    routeStops = chosen;
    const fallback = chosen.length === 0 && airports ? allOptionCities(flights, options, airports) : [];
    cities.splice(0, cities.length, ...(chosen.length > 0 ? chosen : fallback));
    const chips = stopChips(chosen, fallback);
    if (selectedChip !== null && selectedChip !== ELSEWHERE && !isKnownCity(selectedChip)) selectedChip = null;
    renderChips(chips);
    noRouteHintEl.hidden = chosen.length > 0 || fallback.length === 0;

    const visiblePlaces = places.filter((p) => matchesChip(effectiveStopKey(p)));
    const visibleStays = stays.filter((s) => matchesChip(effectiveStayKey(s)));

    placesSection.render(visiblePlaces, trip, usersById, selectedCityName());
    const ctx = budgetContext({ trip, travelers: trip.travelers || [], options, flights, airports });
    staysSection.render(visibleStays, trip, usersById, chosen.length > 0 ? chosen : null, ctx);
    renderPins(visiblePlaces, visibleStays);
    // The first render usually lands before places and stays have loaded, so
    // only stop re-fitting once the map has had real pins to show.
    if (forceFit || !everFitted) everFitted = fitMap(visiblePlaces, visibleStays) || everFitted;
  }

  const unsubTrip = watchTrip(tripId, (t) => { trip = t; rerenderAll(); }, (err) => onError(friendlyError(err)));
  const unsubUsers = watchUsers((u) => { usersById = u; rerenderAll(); }, () => {});
  const unsubPlaces = watchPlaces(tripId, (p) => { places = p; rerenderAll(); }, (err) => onError(friendlyError(err)));
  const unsubStays = watchStays(tripId, (s) => { stays = s; rerenderAll(); }, (err) => onError(friendlyError(err)));
  const unsubFlights = watchFlights(tripId, (f) => { flights = f; rerenderAll(); }, (err) => onError(friendlyError(err)));
  const unsubOptions = watchOptions(tripId, (o) => { options = o; rerenderAll(); }, (err) => onError(friendlyError(err)));

  loadAirports()
    .then((loaded) => {
      airports = loaded;
      rerenderAll();
    })
    .catch((err) => onError(friendlyError(err)));

  return () => {
    unsubTrip();
    unsubUsers();
    unsubPlaces();
    unsubStays();
    unsubFlights();
    unsubOptions();
    placesSection.unsubscribe();
    staysSection.unsubscribe();
    if (map) {
      map.remove();
      map = null;
    }
  };
}
