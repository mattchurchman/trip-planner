import { addStay, updateStay, deleteStay, duplicateStay, chooseStay, unchooseStay } from "../store.js";
import { el, confirmDialog, friendlyError, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { nightsBetween } from "../lib/dates.js";
import { formatLegDate } from "../lib/itineraryFormat.js";
import { latestEntry, perNightCents } from "../lib/totals.js";
import { formatMoney } from "../lib/money.js";
import { safeUrl, googleHotelsUrl, bookingUrl, airbnbUrl } from "../lib/links.js";
import { isStayChosen, chosenStayIds } from "../lib/selection.js";
import { sortStayOptions, stayNumbers, circledNumber } from "../lib/optionSort.js";
import { nightCoverage, stopStayTotal } from "../lib/coverage.js";
import { priceCheck, checkPricesButton } from "./pricePanel.js";
import { addStayFormDialog, editStayFormDialog, providerLabel } from "./stayForm.js";
import { createStaysMap } from "./staysMap.js";

function externalLinkRow(url, label) {
  return el("a", { className: "discover-link", href: url, target: "_blank", rel: "noopener noreferrer", textContent: label });
}

/**
 * Groups `stays` by the stop of the chosen route whose `cityKey` matches
 * their `stopKey` (T24), in route order; stays with no match, or whose
 * `stopKey` no longer matches any stop, land in "No stop yet". A route that
 * returns to the same city twice shares one group, keyed by its first visit.
 */
function groupByStop(stays, stops) {
  const groups = [];
  const byKey = new Map();
  for (const stop of stops) {
    if (!stop.cityKey || byKey.has(stop.cityKey)) continue;
    const group = { stop, stays: [] };
    byKey.set(stop.cityKey, group);
    groups.push(group);
  }
  const noStop = [];
  for (const stay of stays) {
    const group = stay.stopKey && byKey.get(stay.stopKey);
    if (group) group.stays.push(stay);
    else noStop.push(stay);
  }
  return { groups, noStop };
}

/**
 * Builds the Stays section of the Stays tab (§7.7, V4 §7): the header with
 * its Add button, discover links, and stays grouped by the stop of the
 * chosen route, each with a night-coverage bar and total — or, with no
 * route chosen, every stay ungrouped and a hint to choose one. Call
 * `render(stays, trip, usersById, places, stops)` whenever trip/stays/users/
 * places/the chosen route's stops change — it defers rebuilding the list on
 * its own while someone is editing inside it (§8). `places` feeds only the
 * map's "our top places" layer. `stops` is `stopsFor`'s result for the
 * chosen option, or `null` when none is chosen yet.
 */
export function createStaysSection({ tripId, myUid, onError }) {
  let stayCommentUnsubs = [];
  let currentTrip = null;
  let currentStays = [];

  const addStayBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Add stay" });
  const staysDiscoverEl = el("div", { className: "discover-section" });
  const staysMapHolder = el("div", { className: "stays-map-holder" });
  const checkPricesEl = el("div", { className: "stays-check-prices" });
  const routeHintEl = el("p", { className: "empty-state" }, [
    "No route chosen yet. ",
    el("a", { href: `#/trip/${tripId}/routes`, textContent: "Choose an option on Routes" }),
    " to group stays by city.",
  ]);
  const staysListEl = el("div", {});

  const staysMap = createStaysMap(staysMapHolder, {
    onPinClick: (stayId) => {
      const card = staysListEl.querySelector(`[data-stay-id="${stayId}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("stay-card-highlight");
      setTimeout(() => card.classList.remove("stay-card-highlight"), 1500);
    },
  });

  async function handleAddStay(stopDefaults) {
    if (currentStays.length >= 10) return;
    const result = await addStayFormDialog(currentTrip, stopDefaults);
    if (!result) return;
    const { priceAmountCents, ...fields } = result;
    const firstPriceEntry = priceAmountCents
      ? { id: crypto.randomUUID(), amountCents: priceAmountCents, checkedAt: new Date().toISOString(), byUid: myUid, note: "" }
      : undefined;
    try {
      await addStay(tripId, { ...fields, firstPriceEntry }, myUid);
    } catch (err) {
      onError(friendlyError(err));
    }
  }
  addStayBtn.addEventListener("click", () => handleAddStay(null));

  async function openEditStayDialog(stay, trip, focusLocation = false) {
    const result = await editStayFormDialog(stay, trip, focusLocation);
    if (!result) return;
    try {
      await updateStay(tripId, stay.id, result);
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  function renderStayCard(stay, trip, usersById, number) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const isChosen = isStayChosen(trip, stay.id);
    const nights = nightsBetween(stay.checkIn, stay.checkOut);
    const latest = latestEntry(stay.prices);
    const perNight = latest && nights ? perNightCents(latest.amountCents, nights) : null;

    // Status (§7.7, T24): Shortlisted (default), Out (dimmed, sorted last) or
    // Chosen (the existing selectedStayIds). Choosing/un-choosing and the Out
    // flag are independent writes, so every combination the select offers is
    // reachable from any starting state.
    const statusSelect = el(
      "select",
      { attrs: { "aria-label": `${stay.name} status` } },
      [
        el("option", { value: "shortlisted", textContent: "Shortlisted" }),
        el("option", { value: "out", textContent: "Out" }),
        el("option", { value: "chosen", textContent: "Chosen" }),
      ]
    );
    statusSelect.value = isChosen ? "chosen" : stay.out ? "out" : "shortlisted";
    statusSelect.addEventListener("change", async () => {
      const wantChosen = statusSelect.value === "chosen";
      const wantOut = statusSelect.value === "out";
      statusSelect.disabled = true;
      try {
        if (wantChosen !== isChosen) {
          if (wantChosen) await chooseStay(tripId, trip, stay.id);
          else await unchooseStay(tripId, trip, stay.id);
        }
        if (wantOut !== !!stay.out) {
          await updateStay(tripId, stay.id, { out: wantOut });
        }
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      } finally {
        statusSelect.disabled = false;
      }
    });

    const editBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEditStayDialog(stay, trip));
    const duplicateBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Duplicate" });
    duplicateBtn.addEventListener("click", async () => {
      try {
        const ref = await duplicateStay(tripId, stay, myUid);
        openEditStayDialog({ ...stay, id: ref.id, prices: [], out: false, votes: {} }, trip);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });
    const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog(`Delete ${stay.name}?`, "Delete");
      if (!confirmed) return;
      try {
        await deleteStay(tripId, stay.id);
        if (isStayChosen(trip, stay.id)) {
          await unchooseStay(tripId, trip, stay.id);
        }
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const headerLeft = el("div", { className: "option-header-left" }, [
      el("h3", {}, [el("span", { className: "stay-number", textContent: circledNumber(number) }), ` ${stay.name}`]),
      el("span", { className: "provider-pill", textContent: providerLabel(stay.provider) }),
      isChosen ? el("span", { className: "chosen-badge", textContent: "Chosen ✓" }) : null,
    ].filter(Boolean));
    const { summary, row: priceRow } = priceCheck({
      tripId,
      subcollection: "stays",
      docId: stay.id,
      prices: stay.prices || [],
      link: stay.link,
      currency: trip.currency,
      perNightCents: perNight,
      usersById,
      myUid,
    });
    const header = el("div", { className: "flight-card-header stay-card-title" }, [headerLeft, summary]);

    const dateRange = [formatLegDate(stay.checkIn), formatLegDate(stay.checkOut)].filter(Boolean).join(" – ") || null;
    const metaText = [stay.neighborhood || null, dateRange, nights != null ? `${nights} night${nights === 1 ? "" : "s"}` : null, `${stay.guests} guest${stay.guests === 1 ? "" : "s"}`]
      .filter(Boolean)
      .join(" · ");

    let locationLine;
    if (stay.lat != null) {
      const onMapBtn = el("button", { type: "button", className: "btn btn-link", textContent: "📍 On the map" });
      onMapBtn.addEventListener("click", () => staysMap.focusStay(stay.id));
      locationLine = el("p", { className: "muted" }, [onMapBtn]);
    } else {
      const setLocationBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Set location" });
      setLocationBtn.addEventListener("click", () => openEditStayDialog(stay, trip, true));
      locationLine = el("p", { className: "muted" }, ["No pin yet · ", setLocationBtn]);
    }

    const safeLink = stay.link ? safeUrl(stay.link) : null;
    const openLink = safeLink ? el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Open link" }) : null;

    const { element: commentsEl, unsubscribe } = renderComments({ tripId, targetType: "stay", targetId: stay.id, myUid, usersById });
    stayCommentUnsubs.push(unsubscribe);

    const note = stay.note ? el("p", { className: "card-notes-clamp", textContent: stay.note }) : null;

    return el("article", { className: `card stay-card${isChosen ? " stay-card-chosen" : ""}${stay.out ? " stay-card-out" : ""}`, attrs: { "data-stay-id": stay.id } }, [
      header,
      priceRow,
      el("p", { className: "muted", textContent: metaText }),
      locationLine,
      note,
      el("div", { className: "stay-actions" }, [statusSelect, openLink, editBtn, duplicateBtn, deleteBtn].filter(Boolean)),
      errorHolder,
      commentsEl,
    ].filter(Boolean));
  }

  /** The coverage bar, its "X of Y nights covered" summary, and (once at
   * least one stay here is chosen) the chosen total and per-person share. */
  function renderCoverage(stop, chosenStaysHere, trip) {
    const entries = nightCoverage(stop, chosenStaysHere);
    if (entries.length === 0) return null;
    const coveredCount = entries.filter((e) => e.status !== "open").length;
    const bar = el(
      "div",
      { className: "coverage-bar" },
      entries.map((e) => el("span", { className: `coverage-cell coverage-${e.status}`, attrs: { title: `${formatLegDate(e.date)}: ${e.status}` } }))
    );
    const summary = el("p", { className: "muted coverage-summary", textContent: `${coveredCount} of ${entries.length} night${entries.length === 1 ? "" : "s"} covered` });
    const children = [bar, summary];
    if (chosenStaysHere.length > 0) {
      const { cents, complete } = stopStayTotal(chosenStaysHere);
      const n = (trip.travelers || []).length || 1;
      children.push(
        el("p", {
          className: "stop-total",
          textContent: `${formatMoney(cents, trip.currency)}${complete ? "" : " so far"} total · ${formatMoney(Math.round(cents / n), trip.currency)} each`,
        })
      );
    }
    return el("div", { className: "coverage" }, children);
  }

  function renderStopGroup(stop, sortedStays, trip, usersById, numbers, chosenIds) {
    const chosenHere = sortedStays.filter((s) => chosenIds.includes(s.id));
    const dateRange = [formatLegDate(stop.from), formatLegDate(stop.to)].filter(Boolean).join(" – ") || null;

    const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add stay" });
    addBtn.disabled = currentStays.length >= 10;
    addBtn.addEventListener("click", () => handleAddStay({ checkIn: stop.from, checkOut: stop.to, stopKey: stop.cityKey }));

    const header = el("div", { className: "stop-group-header" }, [
      el("h3", {}, [stop.city || stop.code || "Unknown", dateRange ? el("span", { className: "muted", textContent: ` · ${dateRange}` }) : null].filter(Boolean)),
      addBtn,
    ]);

    return el("section", { className: "stop-group" }, [
      header,
      renderCoverage(stop, chosenHere, trip),
      el("div", { className: "stays-list" }, sortedStays.map((s) => renderStayCard(s, trip, usersById, numbers[s.id]))),
    ].filter(Boolean));
  }

  function renderNoStopGroup(sortedStays, trip, usersById, numbers) {
    return el("section", { className: "stop-group" }, [
      el("div", { className: "stop-group-header" }, [el("h3", { textContent: "No stop yet" })]),
      el("div", { className: "stays-list" }, sortedStays.map((s) => renderStayCard(s, trip, usersById, numbers[s.id]))),
    ]);
  }

  function renderSection(stays, trip, usersById, stops) {
    for (const unsub of stayCommentUnsubs) unsub();
    stayCommentUnsubs = [];

    const dest = trip.destination;
    const adults = (trip.travelers || []).length || 1;
    staysDiscoverEl.replaceChildren(
      externalLinkRow(googleHotelsUrl(dest ? dest.city : ""), "Search Google Hotels"),
      externalLinkRow(bookingUrl({ city: dest ? dest.city : "", checkIn: trip.startDate, checkOut: trip.endDate, adults }), "Search Booking.com"),
      externalLinkRow(airbnbUrl({ city: dest ? dest.city : "", checkIn: trip.startDate, checkOut: trip.endDate, adults }), "Search Airbnb")
    );

    addStayBtn.disabled = stays.length >= 10;
    routeHintEl.hidden = stops !== null;

    if (stays.length === 0) {
      staysListEl.replaceChildren(el("p", { className: "empty-state", textContent: "No stays yet. Search above, then paste a link to add one." }));
      checkPricesEl.replaceChildren(checkPricesButton({ items: [], tripId, currency: trip.currency, myUid }));
      return;
    }

    // Numbers are stable (createdAt order) and independent of the display sort below.
    const numbers = stayNumbers(stays);
    const chosenIds = chosenStayIds(trip);
    const screenOrder = [];
    let sections;

    if (stops === null) {
      const sorted = sortStayOptions(stays, chosenIds);
      screenOrder.push(...sorted);
      sections = [el("div", { className: "stays-list" }, sorted.map((s) => renderStayCard(s, trip, usersById, numbers[s.id])))];
    } else {
      const { groups, noStop } = groupByStop(stays, stops);
      sections = groups.map(({ stop, stays: groupStays }) => {
        const sorted = sortStayOptions(groupStays, chosenIds);
        screenOrder.push(...sorted);
        return renderStopGroup(stop, sorted, trip, usersById, numbers, chosenIds);
      });
      if (noStop.length > 0) {
        const sorted = sortStayOptions(noStop, chosenIds);
        screenOrder.push(...sorted);
        sections.push(renderNoStopGroup(sorted, trip, usersById, numbers));
      }
    }

    checkPricesEl.replaceChildren(
      checkPricesButton({
        items: screenOrder.map((s) => ({ subcollection: "stays", docId: s.id, prices: s.prices || [], link: s.link, label: s.name })),
        tripId,
        currency: trip.currency,
        myUid,
      })
    );
    staysListEl.replaceChildren(...sections);
  }

  const element = el("div", {}, [
    el("div", { className: "stays-header" }, [el("h2", { textContent: "Stays" }), addStayBtn]),
    staysDiscoverEl,
    staysMapHolder,
    checkPricesEl,
    routeHintEl,
    staysListEl,
  ]);

  return {
    element,
    render(stays, trip, usersById, places = [], stops = null) {
      currentTrip = trip;
      currentStays = stays;
      // The map isn't a form, so it updates immediately even while a card
      // elsewhere in the list is deferred by renderWhenIdle below (§8).
      staysMap.update(stays, places, trip);
      renderWhenIdle(staysListEl, () => renderSection(stays, trip, usersById, stops));
    },
    unsubscribe() {
      for (const unsub of stayCommentUnsubs) unsub();
      staysMap.destroy();
    },
  };
}
