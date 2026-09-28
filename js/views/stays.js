import { addStay, updateStay, deleteStay, voteOnStay, chooseStay, clearSelectedStay } from "../store.js";
import { el, confirmDialog, friendlyError, rankControl, field, dialogShell, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { sortByRank } from "../lib/votes.js";
import { formatMoney } from "../lib/money.js";
import { nightsBetween, nightsLabel } from "../lib/dates.js";
import { latestEntry, perNightCents } from "../lib/totals.js";
import { safeUrl, googleHotelsUrl, bookingUrl, airbnbUrl } from "../lib/links.js";
import { parseGoogleMapsUrl } from "../lib/mapsurl.js";
import { parseStayLink } from "../lib/staylink.js";
import { buildPricePanel } from "./pricePanel.js";

const PROVIDERS = [
  { value: "booking", label: "Booking.com" },
  { value: "airbnb", label: "Airbnb" },
  { value: "google_hotels", label: "Google Hotels" },
  { value: "hotel_direct", label: "Hotel direct" },
  { value: "other", label: "Other" },
];

function externalLinkRow(url, label) {
  return el("a", { className: "discover-link", href: url, target: "_blank", rel: "noopener noreferrer", textContent: label });
}

function stayFormDialog(existing, trip) {
  return dialogShell("stay-dialog", (finish) => {
    let stayLat = existing?.lat ?? null;
    let stayLng = existing?.lng ?? null;

    const nameInput = el("input", { type: "text", value: existing?.name || "" });
    const providerSelect = el(
      "select",
      {},
      PROVIDERS.map((p) => el("option", { value: p.value, textContent: p.label, selected: p.value === (existing?.provider || "other") }))
    );
    const linkInput = el("input", { type: "text", value: existing?.link || "" });
    const neighborhoodInput = el("input", { type: "text", value: existing?.neighborhood || "" });
    const checkInInput = el("input", { type: "date", value: existing?.checkIn ?? trip.startDate ?? "" });
    const checkOutInput = el("input", { type: "date", value: existing?.checkOut ?? trip.endDate ?? "" });
    const guestsInput = el("input", { type: "number", min: "1", value: existing?.guests ?? ((trip.travelers || []).length || 1) });
    const noteInput = el("textarea", { rows: 2, value: existing?.note || "" });
    const mapsLinkInput = el("input", { type: "text", placeholder: "Paste a Google Maps link (optional)", attrs: { "aria-label": "Google Maps link for this stay" } });
    const locationStatus = el("p", { className: "muted" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: existing ? "Save" : "Add" });

    function updateLocationStatus() {
      locationStatus.textContent = stayLat != null ? `Location set: ${stayLat.toFixed(5)}, ${stayLng.toFixed(5)}` : "No location set.";
    }
    updateLocationStatus();
    function tryParseLink() {
      if (!mapsLinkInput.value.trim()) return;
      errorHolder.replaceChildren();
      const result = parseGoogleMapsUrl(mapsLinkInput.value);
      if (result.error) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: result.error }));
        return;
      }
      stayLat = result.lat;
      stayLng = result.lng;
      updateLocationStatus();
      if (result.name && !nameInput.value.trim()) nameInput.value = result.name;
    }
    mapsLinkInput.addEventListener("paste", () => setTimeout(tryParseLink, 0));
    const useLinkBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Use this link" });
    useLinkBtn.addEventListener("click", tryParseLink);

    // Auto-fill whatever a pasted Booking.com/Airbnb/Google Hotels link reveals;
    // anything it can't determine is left for the user to fill in by hand.
    function tryParseStayLink() {
      const parsed = parseStayLink(linkInput.value);
      if (parsed.provider) providerSelect.value = parsed.provider;
      if (parsed.name && !nameInput.value.trim()) nameInput.value = parsed.name;
      if (parsed.checkIn) checkInInput.value = parsed.checkIn;
      if (parsed.checkOut) checkOutInput.value = parsed.checkOut;
      if (parsed.guests) guestsInput.value = parsed.guests;
    }
    linkInput.addEventListener("paste", () => setTimeout(tryParseStayLink, 0));

    const form = el("form", { method: "dialog", className: "stay-form" }, [
      field("Name", nameInput),
      field("Provider", providerSelect),
      field("Link", linkInput),
      field("Neighborhood", neighborhoodInput),
      el("div", { className: "field-row" }, [field("Check-in", checkInInput), field("Check-out", checkOutInput)]),
      field("Guests", guestsInput),
      field("Note", noteInput),
      field("Location", el("div", { className: "location-method" }, [mapsLinkInput, useLinkBtn])),
      locationStatus,
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
      if (checkInInput.value && checkOutInput.value && checkOutInput.value <= checkInInput.value) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Check-out must be after check-in." }));
        return;
      }
      finish({
        name,
        provider: providerSelect.value,
        link: linkInput.value.trim() || null,
        neighborhood: neighborhoodInput.value.trim(),
        checkIn: checkInInput.value || null,
        checkOut: checkOutInput.value || null,
        guests: Math.max(1, parseInt(guestsInput.value, 10) || 1),
        note: noteInput.value.trim(),
        lat: stayLat,
        lng: stayLng,
      });
    });
    return { form, focusEl: nameInput };
  });
}

/**
 * Builds the Stays section of the Flights & stays tab (§7.7): the header with
 * its Add button, discover links, and the ranked list of stay cards. Call
 * `render(stays, trip, usersById)` whenever trip/stays/users change — it defers
 * rebuilding the list on its own while someone is editing inside it (§8).
 */
export function createStaysSection({ tripId, myUid, onError }) {
  let stayCommentUnsubs = [];
  let currentTrip = null;
  let currentStays = [];

  const addStayBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Add stay" });
  const staysDiscoverEl = el("div", { className: "discover-section" });
  const staysListEl = el("div", { className: "stays-list" });

  addStayBtn.addEventListener("click", async () => {
    if (currentStays.length >= 10) return;
    const result = await stayFormDialog(null, currentTrip);
    if (!result) return;
    try {
      await addStay(tripId, result, myUid);
    } catch (err) {
      onError(friendlyError(err));
    }
  });

  async function openEditStayDialog(stay, trip) {
    const result = await stayFormDialog(stay, trip);
    if (!result) return;
    try {
      await updateStay(tripId, stay.id, result);
    } catch (err) {
      onError(friendlyError(err));
    }
  }

  function renderStayCard(stay, trip, usersById) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const isChosen = stay.id === trip.selectedStayId;
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

    const chooseBtn = el("button", {
      type: "button",
      className: `btn btn-small${isChosen ? " badge-chosen" : ""}`,
      textContent: isChosen ? "Chosen" : "Choose",
      disabled: isChosen,
    });
    if (!isChosen) {
      chooseBtn.addEventListener("click", () =>
        chooseStay(tripId, stay.id).catch((err) => errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) })))
      );
    }

    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", () => openEditStayDialog(stay, trip));
    const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog(`Delete ${stay.name}?`);
      if (!confirmed) return;
      try {
        await deleteStay(tripId, stay.id);
        if (trip.selectedStayId === stay.id) {
          await clearSelectedStay(tripId);
        }
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const safeLink = stay.link ? safeUrl(stay.link) : null;
    const details = [];
    if (stay.neighborhood) details.push(el("p", { className: "muted", textContent: stay.neighborhood }));
    if (safeLink) details.push(el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Link" }));
    const metaText = [nightsLabel(stay.checkIn, stay.checkOut), `${stay.guests} guest${stay.guests === 1 ? "" : "s"}`, perNight != null ? `${formatMoney(perNight, trip.currency)}/night` : null]
      .filter(Boolean)
      .join(" · ");
    details.push(el("p", { className: "muted", textContent: metaText }));
    if (stay.note) details.push(el("p", { textContent: stay.note }));

    const pricePanel = buildPricePanel({
      tripId,
      subcollection: "stays",
      docId: stay.id,
      prices: stay.prices || [],
      myUid,
      usersById,
      currency: trip.currency,
    });

    const { element: commentsEl, unsubscribe } = renderComments({ tripId, targetType: "stay", targetId: stay.id, myUid, usersById });
    stayCommentUnsubs.push(unsubscribe);

    return el("article", { className: `card stay-card${isChosen ? " stay-card-chosen" : ""}` }, [
      el("h3", { textContent: stay.name }),
      ...details,
      pricePanel,
      rank,
      el("div", { className: "stay-actions" }, [chooseBtn, editBtn, deleteBtn]),
      errorHolder,
      commentsEl,
    ]);
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

    const sorted = sortByRank(stays);
    if (sorted.length === 0) {
      staysListEl.replaceChildren(el("p", { className: "empty-state", textContent: "No stays yet." }));
    } else {
      staysListEl.replaceChildren(...sorted.map((s) => renderStayCard(s, trip, usersById)));
    }
  }

  const element = el("div", {}, [
    el("div", { className: "stays-header" }, [el("h2", { textContent: "Stays" }), addStayBtn]),
    staysDiscoverEl,
    staysListEl,
  ]);

  return {
    element,
    render(stays, trip, usersById) {
      currentTrip = trip;
      currentStays = stays;
      renderWhenIdle(staysListEl, () => renderSection(stays, trip, usersById));
    },
    unsubscribe() {
      for (const unsub of stayCommentUnsubs) unsub();
    },
  };
}
