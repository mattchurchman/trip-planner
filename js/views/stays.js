import { addStay, updateStay, deleteStay, duplicateStay, chooseStay, unchooseStay, setForTravelers } from "../store.js";
import { el, confirmDialog, friendlyError, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { nightsBetween } from "../lib/dates.js";
import { formatLegDate } from "../lib/itineraryFormat.js";
import { latestEntry, perNightCents } from "../lib/totals.js";
import { formatMoney } from "../lib/money.js";
import { safeUrl, googleHotelsUrl, bookingUrl, airbnbUrl } from "../lib/links.js";
import { isStayChosen, chosenStayIds } from "../lib/selection.js";
import { sortStayOptions, stayNumbers, circledNumber } from "../lib/optionSort.js";
import { nightCoverage, coverageSummary, stopStayTotal } from "../lib/coverage.js";
import { stayStopKey } from "../lib/stops.js";
import { priceCheck } from "./pricePanel.js";
import { addStayFormDialog, editStayFormDialog, providerLabel } from "./stayForm.js";
import { forControl } from "./forControl.js";

function externalLinkRow(url, label) {
  return el("a", { className: "discover-link", href: url, target: "_blank", rel: "noopener noreferrer", textContent: label });
}

/**
 * Groups `stays` by the stop of the merged route they belong to (T24, T38), in
 * route order: the stay's own `stopKey` while it still matches a stop,
 * otherwise the stop its check-in dates or pin point to (`stayStopKey`). Stays
 * that match nothing land in "No stop yet". A route that returns to the same
 * city gets a group per visit (T46, §11), each with its own dates — the stop's
 * `stopKey` keys the group, not its city.
 */
function groupByStop(stays, stops) {
  const groups = [];
  const byKey = new Map();
  for (const stop of stops) {
    const key = stop.stopKey || stop.cityKey;
    if (!key || byKey.has(key)) continue;
    const group = { stop, stays: [] };
    byKey.set(key, group);
    groups.push(group);
  }
  const noStop = [];
  for (const stay of stays) {
    const key = stayStopKey(stay, stops, stops);
    const group = key && byKey.get(key);
    if (group) group.stays.push(stay);
    else noStop.push(stay);
  }
  return { groups, noStop };
}

/**
 * Builds the Stays section of the Map tab (V4 §7, §8): the header with its
 * Add button, and stays grouped by the stop of the chosen route, each with
 * its own hotel search links (T31, §9.1), a night-coverage bar and total —
 * or, with no route chosen, every stay ungrouped and a hint to choose one.
 * Call `render(stays,
 * trip, usersById, stops, ctx)` whenever trip/stays/users/the merged route
 * (or the stop chip filtering `stays`, T25) change — it defers rebuilding the
 * list on its own while someone is editing inside it (§8). `stops` is the
 * merged route (§11), or `null` when nobody has chosen an option yet; `ctx`
 * is `budgetContext`'s result, for each stay's "Who's this for?". `onFocusOnMap(stay)` pans the caller's shared map (T25) to
 * that stay's pin; `focusCard(stayId)` (returned below) is the inverse,
 * called by the caller when that pin is tapped.
 */
export function createStaysSection({ tripId, myUid, onError, onFocusOnMap }) {
  let stayCommentUnsubs = [];
  let currentTrip = null;
  let currentStays = [];
  let currentStops = null;
  let currentUsers = {};
  let currentCtx = null;
  let forEditingId = null;

  const addStayBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Add stay" });
  const routeHintEl = el("p", { className: "empty-state" }, [
    "No route chosen yet. ",
    el("a", { href: `#/trip/${tripId}/routes`, textContent: "Choose an option on Routes" }),
    " to group stays by city.",
  ]);
  const staysListEl = el("div", {});

  async function handleAddStay(stopDefaults) {
    if (currentStays.length >= 10) return;
    const result = await addStayFormDialog(currentTrip, stopDefaults);
    if (!result) return;
    const { priceAmountCents, ...fields } = result;
    // A stay added from the top finds its stop from its dates or pin (T38).
    fields.stopKey = stayStopKey(fields, currentStops || [], currentStops || []);
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

  /** The city of the stop a stay belongs to (T31, §7.7), for its edit
   * dialog's search links — `null` when the stay has no stop yet or no
   * route is chosen, same as everywhere else here. */
  function cityForStay(stay) {
    const key = stayStopKey(stay, currentStops || [], currentStops || []);
    const stop = key ? (currentStops || []).find((s) => (s.stopKey || s.cityKey) === key) : null;
    return stop ? stop.city : null;
  }

  async function openEditStayDialog(stay, trip, focusLocation = false) {
    const result = await editStayFormDialog(stay, trip, focusLocation, cityForStay(stay));
    if (!result) return;
    // Only fills in a missing or outdated stop; a stop that still fits stays put.
    const key = stayStopKey({ ...stay, ...result }, currentStops || [], currentStops || []);
    if (key && key !== stay.stopKey) result.stopKey = key;
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

    // Status (§7.7, T38): Choose/Chosen and Out are two toggles, and a stay is
    // never both — choosing a stay that is Out brings it back in, and marking
    // a chosen stay Out unchooses it.
    const chooseBtn = el("button", {
      type: "button",
      className: `btn btn-small stay-toggle ${isChosen ? "badge-chosen" : "btn-primary"}`,
      textContent: isChosen ? "Chosen" : "Choose",
      attrs: { "aria-pressed": String(isChosen), "aria-label": `Choose ${stay.name}` },
    });
    const outBtn = el("button", {
      type: "button",
      className: "btn btn-small btn-secondary stay-toggle stay-out-btn",
      textContent: "Out",
      attrs: { "aria-pressed": String(!!stay.out), "aria-label": `${stay.name} is out` },
    });
    async function changeStatus(write) {
      chooseBtn.disabled = true;
      outBtn.disabled = true;
      try {
        await write();
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      } finally {
        chooseBtn.disabled = false;
        outBtn.disabled = false;
      }
    }
    chooseBtn.addEventListener("click", () =>
      changeStatus(async () => {
        if (isChosen) return unchooseStay(tripId, trip, stay.id);
        await chooseStay(tripId, trip, stay.id);
        if (stay.out) await updateStay(tripId, stay.id, { out: false });
      })
    );
    outBtn.addEventListener("click", () =>
      changeStatus(async () => {
        if (stay.out) return updateStay(tripId, stay.id, { out: false });
        if (isChosen) await unchooseStay(tripId, trip, stay.id);
        await updateStay(tripId, stay.id, { out: true });
      })
    );

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
      onMapBtn.addEventListener("click", () => onFocusOnMap(stay));
      locationLine = el("p", { className: "muted" }, [onMapBtn]);
    } else {
      const setLocationBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Set location" });
      setLocationBtn.addEventListener("click", () => openEditStayDialog(stay, trip, true));
      locationLine = el("p", { className: "muted" }, ["No map pin · ", setLocationBtn]);
    }

    const safeLink = stay.link ? safeUrl(stay.link) : null;
    const openLink = safeLink ? el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Open link" }) : null;

    const { element: commentsEl, unsubscribe } = renderComments({ tripId, targetType: "stay", targetId: stay.id, myUid, usersById });
    stayCommentUnsubs.push(unsubscribe);

    const note = stay.note ? el("p", { className: "card-notes-clamp", textContent: stay.note }) : null;

    const forLine = currentCtx
      ? forControl(stay, "stay", {
          ctx: currentCtx,
          travelers: trip.travelers || [],
          editing: forEditingId === stay.id,
          onToggle: () => {
            forEditingId = forEditingId === stay.id ? null : stay.id;
            renderSection(currentStays, currentTrip, currentUsers, currentStops);
          },
          onSet: (ids) =>
            setForTravelers(tripId, "stays", stay.id, ids).catch((err) =>
              errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
            ),
        })
      : null;

    return el("article", { className: `card stay-card${isChosen ? " stay-card-chosen" : ""}${stay.out ? " stay-card-out" : ""}`, attrs: { "data-stay-id": stay.id } }, [
      header,
      priceRow,
      el("p", { className: "muted", textContent: metaText }),
      locationLine,
      note,
      forLine,
      el("div", { className: "stay-actions" }, [chooseBtn, outBtn, openLink, editBtn, duplicateBtn, deleteBtn].filter(Boolean)),
      errorHolder,
      commentsEl,
    ].filter(Boolean));
  }

  /** One cell per night: the date, how many of the travelers sleep in this
   * city that night ("2 of 3"), and a mark for covered / double-booked — plus
   * the "X of Y nights covered" summary, and (once at least one stay here is
   * chosen) the chosen total and per-person share. */
  function renderCoverage(stop, chosenStaysHere, trip) {
    const entries = nightCoverage(stop, chosenStaysHere);
    if (entries.length === 0) return null;
    const travelerCount = (trip.travelers || []).length;
    const { covered, total, complete } = coverageSummary(entries);
    const marks = { open: "", covered: " ✓", double: " ×2" };
    const words = { open: "no stay chosen", covered: "covered", double: "double-booked" };
    const bar = el(
      "div",
      { className: "coverage-bar" },
      entries.map((e) => {
        const date = (formatLegDate(e.date) || e.date).split(" ").slice(1).join(" ");
        const who = e.travelerIds ? `${e.travelerIds.length} of ${travelerCount}` : null;
        return el(
          "span",
          {
            className: `coverage-cell coverage-${e.status}`,
            attrs: { title: `${formatLegDate(e.date)}: ${words[e.status]}${who ? `, ${who} travelers` : ""}` },
          },
          [el("span", { className: "coverage-date", textContent: `${date}${marks[e.status]}` }), who ? el("span", { className: "coverage-who", textContent: who }) : null].filter(Boolean)
        );
      })
    );
    const summary = el("p", {
      className: `muted coverage-summary${complete ? " coverage-summary-complete" : ""}`,
      textContent: complete ? `All ${total} night${total === 1 ? "" : "s"} covered ✓` : `${covered} of ${total} night${total === 1 ? "" : "s"} covered`,
    });
    const children = [bar, summary];
    if (chosenStaysHere.length > 0) {
      const { cents, complete: priced } = stopStayTotal(chosenStaysHere);
      const n = travelerCount || 1;
      children.push(
        el("p", {
          className: "stop-total",
          textContent: `${formatMoney(cents, trip.currency)}${priced ? "" : " so far"} total · ${formatMoney(Math.round(cents / n), trip.currency)} each`,
        })
      );
    }
    return el("div", { className: "coverage" }, children);
  }

  function renderStopGroup(stop, sortedStays, trip, usersById, numbers, chosenIds, adults) {
    const chosenHere = sortedStays.filter((s) => chosenIds.includes(s.id));
    const dateRange = [formatLegDate(stop.from), formatLegDate(stop.to)].filter(Boolean).join(" – ") || null;

    const addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add stay" });
    addBtn.disabled = currentStays.length >= 10;
    addBtn.addEventListener("click", () => handleAddStay({ checkIn: stop.from, checkOut: stop.to, stopKey: stop.stopKey || stop.cityKey, city: stop.city }));

    const header = el("div", { className: "stop-group-header" }, [
      el("h3", {}, [stop.city || stop.code || "Unknown", dateRange ? el("span", { className: "muted", textContent: ` · ${dateRange}` }) : null].filter(Boolean)),
      addBtn,
    ]);

    // Hotel search links use this stop's own city and dates (T31, §9.1) —
    // most accurate, and there's no trip-wide destination any more. Hidden
    // with no city to search (shouldn't happen for a real stop, but a bad
    // airport code could leave one blank).
    const discover = stop.city
      ? el("div", { className: "discover-section" }, [
          externalLinkRow(googleHotelsUrl(stop.city), "Search Google Hotels"),
          externalLinkRow(bookingUrl({ city: stop.city, checkIn: stop.from, checkOut: stop.to, adults }), "Search Booking.com"),
          externalLinkRow(airbnbUrl({ city: stop.city, checkIn: stop.from, checkOut: stop.to, adults }), "Search Airbnb"),
        ])
      : null;

    const noStaysHint =
      sortedStays.length === 0 ? el("p", { className: "empty-state empty-state-small", textContent: `No stays yet for ${stop.city || stop.code || "this stop"}.` }) : null;

    return el("section", { className: "stop-group" }, [
      header,
      discover,
      renderCoverage(stop, chosenHere, trip),
      noStaysHint,
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

    const adults = (trip.travelers || []).length || 1;

    addStayBtn.disabled = stays.length >= 10;
    routeHintEl.hidden = stops !== null;

    if (stays.length === 0 && stops === null) {
      staysListEl.replaceChildren(el("p", { className: "empty-state", textContent: "No stays yet. Search above, then paste a link to add one." }));
      return;
    }

    // Numbers are stable (createdAt order) and independent of the display sort below.
    const numbers = stayNumbers(stays);
    const chosenIds = chosenStayIds(trip);
    let sections;

    if (stops === null) {
      const sorted = sortStayOptions(stays, chosenIds);
      sections = [el("div", { className: "stays-list" }, sorted.map((s) => renderStayCard(s, trip, usersById, numbers[s.id])))];
    } else {
      const { groups, noStop } = groupByStop(stays, stops);
      sections = groups.map(({ stop, stays: groupStays }) => {
        const sorted = sortStayOptions(groupStays, chosenIds);
        return renderStopGroup(stop, sorted, trip, usersById, numbers, chosenIds, adults);
      });
      if (noStop.length > 0) {
        const sorted = sortStayOptions(noStop, chosenIds);
        sections.push(renderNoStopGroup(sorted, trip, usersById, numbers));
      }
    }

    staysListEl.replaceChildren(...sections);
  }

  const element = el("div", {}, [
    el("div", { className: "stays-header" }, [addStayBtn]),
    routeHintEl,
    staysListEl,
  ]);

  return {
    element,
    render(stays, trip, usersById, stops = null, ctx = null) {
      currentTrip = trip;
      currentStays = stays;
      currentStops = stops;
      currentUsers = usersById;
      currentCtx = ctx;
      renderWhenIdle(staysListEl, () => renderSection(stays, trip, usersById, stops));
    },
    focusCard(stayId) {
      const card = staysListEl.querySelector(`[data-stay-id="${stayId}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("stay-card-highlight");
      setTimeout(() => card.classList.remove("stay-card-highlight"), 1500);
    },
    unsubscribe() {
      for (const unsub of stayCommentUnsubs) unsub();
    },
  };
}
