import { addStay, updateStay, deleteStay, voteOnStay, chooseStay, unchooseStay } from "../store.js";
import { el, setPending, confirmDialog, friendlyError, rankControl, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { nightsBetween } from "../lib/dates.js";
import { formatLegDate } from "../lib/itineraryFormat.js";
import { latestEntry, perNightCents } from "../lib/totals.js";
import { safeUrl, googleHotelsUrl, bookingUrl, airbnbUrl } from "../lib/links.js";
import { isStayChosen, chosenStayIds } from "../lib/selection.js";
import { sortStayOptions, stayNumbers, circledNumber } from "../lib/optionSort.js";
import { priceSummary, priceUpdater } from "./pricePanel.js";
import { addStayFormDialog, editStayFormDialog, providerLabel } from "./stayForm.js";
import { createStaysMap } from "./staysMap.js";

function externalLinkRow(url, label) {
  return el("a", { className: "discover-link", href: url, target: "_blank", rel: "noopener noreferrer", textContent: label });
}

/**
 * Builds the Stays section of the Flights & stays tab (§7.7): the header with
 * its Add button, discover links, and the ranked list of stay cards. Call
 * `render(stays, trip, usersById, places)` whenever trip/stays/users/places
 * change — it defers rebuilding the list on its own while someone is editing
 * inside it (§8). `places` feeds only the map's "our top places" layer.
 */
export function createStaysSection({ tripId, myUid, onError }) {
  let stayCommentUnsubs = [];
  let currentTrip = null;
  let currentStays = [];

  const addStayBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Add stay" });
  const staysDiscoverEl = el("div", { className: "discover-section" });
  const staysMapHolder = el("div", { className: "stays-map-holder" });
  const staysListEl = el("div", { className: "stays-list" });

  const staysMap = createStaysMap(staysMapHolder, {
    onPinClick: (stayId) => {
      const card = staysListEl.querySelector(`[data-stay-id="${stayId}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("stay-card-highlight");
      setTimeout(() => card.classList.remove("stay-card-highlight"), 1500);
    },
  });

  addStayBtn.addEventListener("click", async () => {
    if (currentStays.length >= 10) return;
    const result = await addStayFormDialog(currentTrip);
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
  });

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

    const rank = rankControl({
      votes: stay.votes || {},
      myUid,
      usersById,
      onVote: (choice) =>
        voteOnStay(tripId, stay.id, myUid, choice).catch((err) =>
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
        ),
    });

    // The group may choose any number of stays (§7.7) — Choose/Unchoose toggles
    // this one; the "Chosen ✓" badge is a separate, purely visual indicator.
    const chooseBtn = el("button", { type: "button", className: "btn btn-small", textContent: isChosen ? "Unchoose" : "Choose" });
    chooseBtn.addEventListener("click", async () => {
      setPending(chooseBtn, true, isChosen ? "Removing…" : "Choosing…");
      try {
        if (isChosen) await unchooseStay(tripId, trip, stay.id);
        else await chooseStay(tripId, trip, stay.id);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      } finally {
        setPending(chooseBtn, false);
      }
    });

    const editBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEditStayDialog(stay, trip));
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
    const summary = priceSummary({ prices: stay.prices || [], currency: trip.currency, perNightCents: perNight, usersById });
    const header = el("div", { className: "flight-card-header stay-card-title" }, [headerLeft, summary]);

    const { button: updateBtn, row: updateRow } = priceUpdater({
      tripId,
      subcollection: "stays",
      docId: stay.id,
      prices: stay.prices || [],
      myUid,
      currency: trip.currency,
    });

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

    return el("article", { className: `card stay-card${isChosen ? " stay-card-chosen" : ""}`, attrs: { "data-stay-id": stay.id } }, [
      header,
      updateRow,
      el("p", { className: "muted", textContent: metaText }),
      locationLine,
      rank,
      note,
      el("div", { className: "stay-actions" }, [chooseBtn, updateBtn, openLink, editBtn, deleteBtn].filter(Boolean)),
      errorHolder,
      commentsEl,
    ].filter(Boolean));
  }

  function renderSection(stays, trip, usersById) {
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

    // Numbers are stable (createdAt order) and independent of the display sort below.
    const numbers = stayNumbers(stays);
    const sorted = sortStayOptions(stays, chosenStayIds(trip));
    if (sorted.length === 0) {
      staysListEl.replaceChildren(el("p", { className: "empty-state", textContent: "No stays yet. Search above, then paste a link to add one." }));
    } else {
      staysListEl.replaceChildren(...sorted.map((s) => renderStayCard(s, trip, usersById, numbers[s.id])));
    }
  }

  const element = el("div", {}, [
    el("div", { className: "stays-header" }, [el("h2", { textContent: "Stays" }), addStayBtn]),
    staysDiscoverEl,
    staysMapHolder,
    staysListEl,
  ]);

  return {
    element,
    render(stays, trip, usersById, places = []) {
      currentTrip = trip;
      currentStays = stays;
      // The map isn't a form, so it updates immediately even while a card
      // elsewhere in the list is deferred by renderWhenIdle below (§8).
      staysMap.update(stays, places, trip);
      renderWhenIdle(staysListEl, () => renderSection(stays, trip, usersById));
    },
    unsubscribe() {
      for (const unsub of stayCommentUnsubs) unsub();
      staysMap.destroy();
    },
  };
}
