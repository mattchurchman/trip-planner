import { el, field, dialogShell, setPending, friendlyError } from "../ui.js";
import { googleHotelsUrl, bookingUrl, airbnbUrl, googleMapsFindUrl } from "../lib/links.js";
import { parseStayLink } from "../lib/staylink.js";
import { parseGoogleMapsUrl } from "../lib/mapsurl.js";
import { parseMoney } from "../lib/money.js";
import { nominatimSearch } from "../lookup.js";

export const PROVIDERS = [
  { value: "booking", label: "Booking.com" },
  { value: "airbnb", label: "Airbnb" },
  { value: "google_hotels", label: "Google Hotels" },
  { value: "hotel_direct", label: "Hotel direct" },
  { value: "other", label: "Other" },
];

export function providerLabel(value) {
  return (PROVIDERS.find((p) => p.value === value) || PROVIDERS[PROVIDERS.length - 1]).label;
}

// A provider link that never carries the listing's name (§7.7, §9.6) — named so
// the result line can tell the traveler why they still need to type it.
const NO_NAME_NOTE = {
  airbnb: "Airbnb links don't include the listing name — type it below.",
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2027-01-17".."2027-01-24" -> "17–24 Jan" (same month), else "17 Jan – 24 Jan",
 * for the compact "✓ Read from the link" summary line only. */
function compactDateRange(checkIn, checkOut) {
  const inMatch = typeof checkIn === "string" && checkIn.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const outMatch = typeof checkOut === "string" && checkOut.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!inMatch || !outMatch) return null;
  const [, inY, inM, inD] = inMatch;
  const [, outY, outM, outD] = outMatch;
  const inMonth = MONTH_ABBR[Number(inM) - 1];
  const outMonth = MONTH_ABBR[Number(outM) - 1];
  if (inY === outY && inM === outM) return `${Number(inD)}–${Number(outD)} ${outMonth}`;
  return `${Number(inD)} ${inMonth} – ${Number(outD)} ${outMonth}`;
}

/** The "✓ Read from the link: …" (or couldn't-read) line's text and whether it's a success. */
function resultLineFor(parsed) {
  if (!parsed.provider) return { text: "Couldn't read this link — fill in the details below.", success: false };
  const parts = [providerLabel(parsed.provider)];
  if (parsed.name) parts.push(parsed.name);
  const dateRange = compactDateRange(parsed.checkIn, parsed.checkOut);
  if (dateRange) parts.push(dateRange);
  if (parsed.guests) parts.push(`${parsed.guests} guest${parsed.guests === 1 ? "" : "s"}`);
  let text = `✓ Read from the link: ${parts.join(" · ")}`;
  if (!parsed.name && NO_NAME_NOTE[parsed.provider]) text += ` ${NO_NAME_NOTE[parsed.provider]}`;
  return { text, success: true };
}

/**
 * The "Where is it?" section (§7.7 Do #2): a status line, "Find '<name>' on
 * the map" (Nominatim, disabled while Name is empty), and a "Paste a Google
 * Maps link" disclosure — the only two ways to pin a stay, since Booking/
 * Airbnb/Google Hotels links never carry an address and the app never
 * downloads the listing page (§2). Returns `{ element, findBtn, getLat,
 * getLng, setProviderHint }`; `findBtn` is also the edit-mode focus target
 * for "Set location" (§7.7's "scrolled to Where is it?").
 */
function buildWhereIsIt({ nameInput, dest, initialLat, initialLng }) {
  let lat = initialLat;
  let lng = initialLng;

  const clearBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Clear" });
  const statusEl = el("p", { className: "muted" });
  function updateStatus() {
    if (lat != null) statusEl.replaceChildren("📍 Pin set ", clearBtn);
    else statusEl.textContent = "No pin yet — you can add one later.";
  }
  clearBtn.addEventListener("click", () => {
    lat = null;
    lng = null;
    updateStatus();
  });

  const findBtn = el("button", { type: "button", className: "btn btn-small" });
  function updateFindLabel() {
    const name = nameInput.value.trim();
    findBtn.textContent = name ? `Find "${name}" on the map` : "Find on the map";
    findBtn.disabled = !name;
  }
  nameInput.addEventListener("input", updateFindLabel);

  const findErrorHolder = el("div", { className: "field-error-holder" });
  const resultsEl = el("ul", { className: "search-results", hidden: true });
  findBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    findErrorHolder.replaceChildren();
    const query = [name, dest && dest.city, dest && dest.country].filter(Boolean).join(", ");
    setPending(findBtn, true, "Searching…");
    try {
      const results = await nominatimSearch(query);
      if (results.length === 0) {
        resultsEl.replaceChildren(el("li", { className: "muted", textContent: "Nothing found — try a Google Maps link instead." }));
      } else {
        resultsEl.replaceChildren(
          ...results.map((r) => {
            const pickBtn = el("button", { type: "button", className: "btn btn-small search-result", textContent: r.display_name });
            pickBtn.addEventListener("click", () => {
              lat = Number(r.lat);
              lng = Number(r.lon);
              updateStatus();
              resultsEl.hidden = true;
              resultsEl.replaceChildren();
            });
            return el("li", {}, [pickBtn]);
          }),
          el("li", { className: "muted", textContent: "Search results from OpenStreetMap" })
        );
      }
      resultsEl.hidden = false;
    } catch (err) {
      findErrorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(findBtn, false);
    }
  });

  const mapsLinkInput = el("input", { type: "text", placeholder: "Paste a Google Maps link", attrs: { "aria-label": "Google Maps link for this stay" } });
  const mapsLinkError = el("div", { className: "field-error-holder" });
  const findOnGoogleMapsLink = el("a", {
    href: googleMapsFindUrl(nameInput.value, dest && dest.city, dest && dest.country),
    target: "_blank",
    rel: "noopener noreferrer",
    textContent: "Find on Google Maps",
  });
  nameInput.addEventListener("input", () => {
    findOnGoogleMapsLink.href = googleMapsFindUrl(nameInput.value, dest && dest.city, dest && dest.country);
  });
  function tryParseMapsLink() {
    if (!mapsLinkInput.value.trim()) return;
    mapsLinkError.replaceChildren();
    const result = parseGoogleMapsUrl(mapsLinkInput.value);
    if (result.error) {
      mapsLinkError.replaceChildren(el("p", { className: "field-error", textContent: result.error }));
      return;
    }
    lat = result.lat;
    lng = result.lng;
    updateStatus();
  }
  mapsLinkInput.addEventListener("paste", () => setTimeout(tryParseMapsLink, 0));
  mapsLinkInput.addEventListener("input", tryParseMapsLink);

  const mapsDetails = el("details", {}, [
    el("summary", { textContent: "Paste a Google Maps link" }),
    mapsLinkInput,
    findOnGoogleMapsLink,
    mapsLinkError,
  ]);

  const airbnbHint = el("p", { className: "muted", textContent: "Airbnb shows the exact spot only after booking — pin the neighborhood for now.", hidden: true });

  updateFindLabel();
  updateStatus();

  const element = el("div", { className: "field where-is-it" }, [
    el("span", { textContent: "Where is it?" }),
    statusEl,
    findBtn,
    findErrorHolder,
    resultsEl,
    mapsDetails,
    airbnbHint,
  ]);

  return {
    element,
    findBtn,
    getLat: () => lat,
    getLng: () => lng,
    setProviderHint(provider) {
      airbnbHint.hidden = provider !== "airbnb";
    },
  };
}

/**
 * The Add stay / Edit stay dialog (§7.7): link box, "Don't have one yet?"
 * search links, the "✓ Read from the link" result line, then Name, Price you
 * saw (add mode only), Check-in/Check-out/Guests, Neighborhood, Where is it?,
 * Note. `focusLocation` (edit mode only) opens straight to "Where is it?",
 * for the card's **Set location** action. Resolves the stay's fields (plus
 * `priceAmountCents` in add mode), or `null` on cancel.
 */
function buildStayDialog({ isEdit, stay, trip, focusLocation }) {
  return dialogShell("stay-dialog", (finish) => {
    const dest = trip.destination;
    const adults = (trip.travelers || []).length || 1;

    const linkInput = el("input", {
      type: "text",
      value: stay?.link || "",
      placeholder: "Paste a Booking.com, Airbnb, Google Hotels or other link…",
      attrs: { "aria-label": "Stay link" },
    });
    const resultLine = el("p", { className: "link-parse-result", hidden: true });

    const nameInput = el("input", { type: "text", value: stay?.name || "" });
    const priceInput = isEdit ? null : el("input", { type: "text", placeholder: "e.g. 480.50" });
    const checkInInput = el("input", { type: "date", value: stay?.checkIn ?? trip.startDate ?? "" });
    const checkOutInput = el("input", { type: "date", value: stay?.checkOut ?? trip.endDate ?? "" });
    const guestsInput = el("input", { type: "number", min: "1", value: stay?.guests ?? adults });
    const neighborhoodInput = el("input", { type: "text", value: stay?.neighborhood || "" });
    const noteInput = el("textarea", { rows: 2, value: stay?.note || "" });

    let currentProvider = stay?.provider || "other";
    const whereIsIt = buildWhereIsIt({ nameInput, dest, initialLat: stay?.lat ?? null, initialLng: stay?.lng ?? null });
    whereIsIt.setProviderHint(currentProvider);

    // What Check-in/Check-out/Guests were pre-filled with, so a pasted link
    // only overwrites a field the traveler hasn't customized (§7.7's "only
    // into empty or still-default fields" — unlike flights, which overwrites).
    const defaults = { checkIn: checkInInput.value, checkOut: checkOutInput.value, guests: guestsInput.value };
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
      const { text, success } = resultLineFor(parsed);
      resultLine.className = success ? "link-parse-result link-parse-success" : "link-parse-result";
      resultLine.textContent = text;
      resultLine.hidden = false;
      if (!success) return;

      currentProvider = parsed.provider;
      whereIsIt.setProviderHint(currentProvider);
      if (parsed.name && !nameInput.value.trim()) {
        nameInput.value = parsed.name;
        // Setting .value directly doesn't fire "input" — nudge it so the Find
        // button's label/enabled state and the Google Maps link pick up the name.
        nameInput.dispatchEvent(new Event("input"));
      }
      fillIfDefault(checkInInput, "checkIn", parsed.checkIn);
      fillIfDefault(checkOutInput, "checkOut", parsed.checkOut);
      fillIfDefault(guestsInput, "guests", parsed.guests);
    }
    linkInput.addEventListener("paste", () => setTimeout(tryParseLink, 0));
    linkInput.addEventListener("input", tryParseLink);

    const searchLinksLine = el("p", { className: "muted" }, [
      "Don't have one yet? ",
      el("a", { href: googleHotelsUrl(dest ? dest.city : ""), target: "_blank", rel: "noopener noreferrer", textContent: "Google Hotels" }),
      " ",
      el("a", {
        href: bookingUrl({ city: dest ? dest.city : "", checkIn: trip.startDate, checkOut: trip.endDate, adults }),
        target: "_blank",
        rel: "noopener noreferrer",
        textContent: "Booking.com",
      }),
      " ",
      el("a", {
        href: airbnbUrl({ city: dest ? dest.city : "", checkIn: trip.startDate, checkOut: trip.endDate, adults }),
        target: "_blank",
        rel: "noopener noreferrer",
        textContent: "Airbnb",
      }),
    ]);

    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: isEdit ? "Save" : "Add stay" });

    const formChildren = [
      el("h3", { textContent: isEdit ? "Edit stay" : "Add stay" }),
      field("Link to the stay", linkInput),
      searchLinksLine,
      resultLine,
      field("Name", nameInput),
    ];
    if (!isEdit) formChildren.push(field("Price you saw (total for the whole stay)", priceInput));
    formChildren.push(
      el("div", { className: "field-row" }, [field("Check-in", checkInInput), field("Check-out", checkOutInput), field("Guests", guestsInput)]),
      field("Neighborhood", neighborhoodInput),
      whereIsIt.element,
      field("Note", noteInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn])
    );

    const form = el("form", { method: "dialog", className: "stay-form" }, formChildren);
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
      if (!isEdit && priceInput.value.trim()) {
        priceAmountCents = parseMoney(priceInput.value);
        if (priceAmountCents === null || priceAmountCents <= 0) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "That price didn't look right — try something like 245 or 245.50." }));
          return;
        }
      }
      const fields = {
        name,
        provider: currentProvider,
        link: linkInput.value.trim() || null,
        neighborhood: neighborhoodInput.value.trim(),
        checkIn: checkInInput.value || null,
        checkOut: checkOutInput.value || null,
        guests: Math.max(1, parseInt(guestsInput.value, 10) || 1),
        note: noteInput.value.trim(),
        lat: whereIsIt.getLat(),
        lng: whereIsIt.getLng(),
      };
      if (!isEdit) fields.priceAmountCents = priceAmountCents;
      finish(fields);
    });

    return { form, focusEl: focusLocation ? whereIsIt.findBtn : linkInput };
  });
}

export function addStayFormDialog(trip) {
  return buildStayDialog({ isEdit: false, stay: null, trip });
}

export function editStayFormDialog(stay, trip, focusLocation = false) {
  return buildStayDialog({ isEdit: true, stay, trip, focusLocation });
}
