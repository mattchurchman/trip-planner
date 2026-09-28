import { addStay, updateStay, deleteStay, voteOnStay, chooseStay, clearSelectedStay } from "../store.js";
import { el, confirmDialog, friendlyError, rankControl, field, dialogShell, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { sortByRank } from "../lib/votes.js";
import { formatMoney, parseMoney } from "../lib/money.js";
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

// A provider link that never carries the listing's name (§7.7, §9.6) — named so
// Step 2's result message can tell the traveler why they still need to type it.
const NO_NAME_NOTE = {
  airbnb: "Airbnb links don't include the listing name — type it below.",
};

function externalLinkRow(url, label) {
  return el("a", { className: "discover-link", href: url, target: "_blank", rel: "noopener noreferrer", textContent: label });
}

/** The "Other ways to add a location" disclosure (§7.6 style, §7.7 Do #5):
 * a Google Maps link, the only location method a stay has today. Shared shape
 * between the add and edit dialogs, each with its own lat/lng state. */
function buildLocationDisclosure({ getLat, getLng, setLocation, nameInput }) {
  const mapsLinkInput = el("input", { type: "text", placeholder: "Paste a Google Maps link", attrs: { "aria-label": "Google Maps link for this stay" } });
  const locationStatus = el("p", { className: "muted" });
  const locationError = el("div", { className: "field-error-holder" });

  function updateStatus() {
    const lat = getLat();
    const lng = getLng();
    locationStatus.textContent = lat != null ? `Location set: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : "No location set.";
  }
  updateStatus();

  function tryParseLink() {
    if (!mapsLinkInput.value.trim()) return;
    locationError.replaceChildren();
    const result = parseGoogleMapsUrl(mapsLinkInput.value);
    if (result.error) {
      locationError.replaceChildren(el("p", { className: "field-error", textContent: result.error }));
      return;
    }
    setLocation(result.lat, result.lng);
    updateStatus();
    if (result.name && !nameInput.value.trim()) nameInput.value = result.name;
  }
  mapsLinkInput.addEventListener("paste", () => setTimeout(tryParseLink, 0));
  const useLinkBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Use this link" });
  useLinkBtn.addEventListener("click", tryParseLink);

  const toggle = el("button", { type: "button", className: "btn btn-link", textContent: "Other ways to add a location", attrs: { "aria-expanded": "false" } });
  const holder = el("div", { className: "other-location-methods", hidden: true }, [
    field("Location", el("div", { className: "location-method" }, [mapsLinkInput, useLinkBtn])),
    locationStatus,
    locationError,
  ]);
  toggle.addEventListener("click", () => {
    holder.hidden = !holder.hidden;
    toggle.setAttribute("aria-expanded", holder.hidden ? "false" : "true");
  });

  return el("div", {}, [toggle, holder]);
}

/**
 * Add stay, link first (§7.7): Step 1 search Booking.com/Airbnb/Google Hotels,
 * Step 2 paste the stay's link (parsed on paste/input, §9.6), Step 3 pre-filled
 * details plus an optional "Price you saw". The stay's own map location moves
 * under "Other ways to add a location" (Do #5). Resolves the new stay's fields
 * plus `priceAmountCents`, or `null` on cancel.
 */
function addStayFormDialog(trip) {
  return dialogShell("stay-dialog", (finish) => {
    let stayLat = null;
    let stayLng = null;
    const dest = trip.destination;
    const adults = (trip.travelers || []).length || 1;

    const searchLinks = el("div", { className: "traveler-flights-actions" }, [
      el("a", { className: "btn btn-small", href: googleHotelsUrl(dest ? dest.city : ""), target: "_blank", rel: "noopener noreferrer", textContent: "Search Google Hotels" }),
      el("a", {
        className: "btn btn-small",
        href: bookingUrl({ city: dest ? dest.city : "", checkIn: trip.startDate, checkOut: trip.endDate, adults }),
        target: "_blank",
        rel: "noopener noreferrer",
        textContent: "Search Booking.com",
      }),
      el("a", {
        className: "btn btn-small",
        href: airbnbUrl({ city: dest ? dest.city : "", checkIn: trip.startDate, checkOut: trip.endDate, adults }),
        target: "_blank",
        rel: "noopener noreferrer",
        textContent: "Search Airbnb",
      }),
    ]);

    const linkInput = el("input", { type: "text", placeholder: "Paste the stay's link", attrs: { "aria-label": "Stay link" } });
    const parseResultEl = el("p", { className: "link-parse-result", hidden: true });

    const nameInput = el("input", { type: "text" });
    const providerSelect = el("select", {}, PROVIDERS.map((p) => el("option", { value: p.value, textContent: p.label, selected: p.value === "other" })));
    const neighborhoodInput = el("input", { type: "text" });
    const checkInInput = el("input", { type: "date", value: trip.startDate || "" });
    const checkOutInput = el("input", { type: "date", value: trip.endDate || "" });
    const guestsInput = el("input", { type: "number", min: "1", value: adults });
    const noteInput = el("textarea", { rows: 2 });
    const priceInput = el("input", { type: "text", placeholder: "e.g. 480.50" });

    const defaults = {
      provider: providerSelect.value,
      checkIn: checkInInput.value,
      checkOut: checkOutInput.value,
      guests: guestsInput.value,
    };
    function fillIfDefault(input, key, value) {
      if (!value) return false;
      if (input.value === "" || input.value === defaults[key]) {
        input.value = String(value);
        return true;
      }
      return false;
    }

    function tryParseLink() {
      if (!linkInput.value.trim()) return;
      const parsed = parseStayLink(linkInput.value);
      if (!parsed.provider) {
        parseResultEl.className = "link-parse-result";
        parseResultEl.textContent = "Couldn't read this link — fill in the details below.";
        parseResultEl.hidden = false;
        return;
      }
      const filledProvider = fillIfDefault(providerSelect, "provider", parsed.provider);
      let filledName = false;
      if (parsed.name && !nameInput.value.trim()) {
        nameInput.value = parsed.name;
        filledName = true;
      }
      const filledCheckIn = fillIfDefault(checkInInput, "checkIn", parsed.checkIn);
      const filledCheckOut = fillIfDefault(checkOutInput, "checkOut", parsed.checkOut);
      const filledGuests = fillIfDefault(guestsInput, "guests", parsed.guests);

      const filledParts = [];
      if (filledProvider) filledParts.push("provider");
      if (filledName) filledParts.push("name");
      if (filledCheckIn || filledCheckOut) filledParts.push("dates");
      if (filledGuests) filledParts.push("guests");

      const sentences = [];
      if (filledParts.length > 0) sentences.push(`✓ Filled in: ${filledParts.join(", ")}.`);
      if (!parsed.name && NO_NAME_NOTE[parsed.provider]) sentences.push(NO_NAME_NOTE[parsed.provider]);
      const success = filledParts.length > 0;
      if (sentences.length === 0) sentences.push("Couldn't read this link — fill in the details below.");

      parseResultEl.className = success ? "link-parse-result link-parse-success" : "link-parse-result";
      parseResultEl.textContent = sentences.join(" ");
      parseResultEl.hidden = false;
    }
    linkInput.addEventListener("paste", () => setTimeout(tryParseLink, 0));
    linkInput.addEventListener("input", tryParseLink);

    const locationDisclosure = buildLocationDisclosure({
      getLat: () => stayLat,
      getLng: () => stayLng,
      setLocation: (lat, lng) => {
        stayLat = lat;
        stayLng = lng;
      },
      nameInput,
    });

    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Add" });

    const form = el("form", { method: "dialog", className: "stay-form" }, [
      el("h4", { textContent: "Step 1 · Find a place to stay" }),
      searchLinks,

      el("h4", { textContent: "Step 2 · Paste the stay's link" }),
      linkInput,
      parseResultEl,

      el("h4", { textContent: "Step 3 · Details" }),
      field("Name", nameInput),
      field("Provider", providerSelect),
      field("Neighborhood", neighborhoodInput),
      el("div", { className: "field-row" }, [field("Check-in", checkInInput), field("Check-out", checkOutInput)]),
      field("Guests", guestsInput),
      field("Note", noteInput),
      field("Price you saw (total for the stay)", priceInput),
      locationDisclosure,
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      errorHolder.replaceChildren();
      const name = nameInput.value.trim();
      if (!name) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Name is required." }));
        return;
      }
      if (checkInInput.value && checkOutInput.value && checkOutInput.value <= checkInInput.value) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Check-out must be after check-in." }));
        return;
      }
      let priceAmountCents = null;
      if (priceInput.value.trim()) {
        priceAmountCents = parseMoney(priceInput.value);
        if (priceAmountCents === null || priceAmountCents <= 0) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Enter a valid amount greater than $0." }));
          return;
        }
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
        priceAmountCents,
      });
    });
    return { form, focusEl: linkInput };
  });
}

/** Edit an existing stay: the plain details form, unchanged by this task except
 * that its map location now sits under "Other ways to add a location" (Do #5). */
function editStayFormDialog(stay, trip) {
  return dialogShell("stay-dialog", (finish) => {
    let stayLat = stay.lat ?? null;
    let stayLng = stay.lng ?? null;

    const nameInput = el("input", { type: "text", value: stay.name || "" });
    const providerSelect = el("select", {}, PROVIDERS.map((p) => el("option", { value: p.value, textContent: p.label, selected: p.value === (stay.provider || "other") })));
    const linkInput = el("input", { type: "text", value: stay.link || "" });
    const neighborhoodInput = el("input", { type: "text", value: stay.neighborhood || "" });
    const checkInInput = el("input", { type: "date", value: stay.checkIn ?? trip.startDate ?? "" });
    const checkOutInput = el("input", { type: "date", value: stay.checkOut ?? trip.endDate ?? "" });
    const guestsInput = el("input", { type: "number", min: "1", value: stay.guests ?? ((trip.travelers || []).length || 1) });
    const noteInput = el("textarea", { rows: 2, value: stay.note || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });

    const locationDisclosure = buildLocationDisclosure({
      getLat: () => stayLat,
      getLng: () => stayLng,
      setLocation: (lat, lng) => {
        stayLat = lat;
        stayLng = lng;
      },
      nameInput,
    });

    const form = el("form", { method: "dialog", className: "stay-form" }, [
      field("Name", nameInput),
      field("Provider", providerSelect),
      field("Link", linkInput),
      field("Neighborhood", neighborhoodInput),
      el("div", { className: "field-row" }, [field("Check-in", checkInInput), field("Check-out", checkOutInput)]),
      field("Guests", guestsInput),
      field("Note", noteInput),
      locationDisclosure,
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

  async function openEditStayDialog(stay, trip) {
    const result = await editStayFormDialog(stay, trip);
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
