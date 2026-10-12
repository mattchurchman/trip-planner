// The "Paste flight link" sheet and the "Move to…" dialog for earlier
// flights (V4 §4.5, §4.6) — the main way flights get into Routes.
import { el, field, dialogShell } from "../ui.js";
import { parseFlightLink } from "../lib/flightlink.js";
import { parseMoney, formatMoney } from "../lib/money.js";
import { flightLabel } from "../lib/itineraryFormat.js";
import { placePastedFlight, homeDirection, guessLandsDate, optionAutoName } from "../lib/route.js";
import { renderItinerary } from "./itinerary.js";
import { renderFlightRow } from "./routeRail.js";

function sortedOptionsFor(options, ideaId) {
  return options.filter((o) => o.ideaId === ideaId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Same shape as pricePanel.js's Log price — the add form's optional
 * "Price you saw" becomes the flight's first PriceEntry. */
function priceEntryFor(priceAmountCents, myUid) {
  return priceAmountCents
    ? { id: crypto.randomUUID(), amountCents: priceAmountCents, checkedAt: new Date().toISOString(), byUid: myUid, note: "" }
    : undefined;
}

/** The label a pasted flight gets, same rule as the hand-entered dialog (§7.7):
 * the outbound airlines in order, or "Option N" with no segments read. */
function labelFor(legs, optionCount) {
  const outboundCodes = (legs[0]?.segments || []).map((s) => s.airline);
  return flightLabel(outboundCodes.length ? outboundCodes : null, optionCount);
}

/**
 * The confirmation sheet (V4 §4.5 steps 2–4): paste or auto-filled link, the
 * itinerary read from it, the price Google showed (or a field when there
 * wasn't one), the landing date for an outbound home flight, and "Adding to"
 * with a way to change the idea or option. Resolves `null` on cancel, or
 * everything `routes.js` needs to call `addPastedFlight` and learn the
 * traveler's home airport (§4.5 step 3's one case for that).
 *
 * `homeFlightsByIdea` is the traveler's own home flights, keyed by idea id
 * (§4.5 compares endpoints idea by idea, for this traveler only); `flights`
 * is every flight in the trip, used only to count an option's existing hops
 * for the new flight's label. `defaultOptionId` is the option already open
 * on screen, when the button was pressed inside one — null elsewhere,
 * meaning "the idea's first option, or a new one named after this hop".
 */
export function pasteFlightDialog({ clipboardText, traveler, trip, airports, ideas, options, flights, homeFlightsByIdea, currentIdeaId, defaultOptionId, myUid }) {
  return dialogShell("paste-flight-dialog", (finish) => {
    const linkInput = el("textarea", {
      rows: 2,
      value: clipboardText || "",
      placeholder: "Paste the address from Google Flights…",
      attrs: { "aria-label": "Google Flights link" },
    });
    const linkErrorEl = el("p", { className: "field-error", hidden: true });
    const previewEl = el("div", { className: "flight-link-preview", hidden: true });

    const landsDateInput = el("input", { type: "date" });
    const landsDateRow = field("Lands on", landsDateInput);
    landsDateRow.hidden = true;

    const priceInput = el("input", { type: "text", placeholder: "e.g. 480.50" });
    const priceRow = field("Price you saw", priceInput);
    const priceHelperEl = el("p", { className: "muted", hidden: true });
    priceRow.hidden = true;
    let priceTouched = false;
    priceInput.addEventListener("input", () => {
      priceTouched = true;
    });

    const ideaSelect = el("select", { attrs: { "aria-label": "Idea" } });
    const optionSelect = el("select", { attrs: { "aria-label": "Option" } });
    const optionRow = field("Option", optionSelect);
    const targetEl = el("div", { className: "paste-flight-target" }, [
      el("p", { className: "muted", textContent: "Adding to:" }),
      field("Idea", ideaSelect),
      optionRow,
    ]);
    targetEl.hidden = true;

    let parsed = null;
    let placement = null;

    /** The name a brand-new option would take: what its one hop spells out
     * (V4 §4.4), e.g. "Florence" — not "Option 2". */
    function newOptionName() {
      const forNewIdea = ideaSelect.value === "__new__";
      const homeFlights = forNewIdea ? [] : homeFlightsByIdea[ideaSelect.value] || [];
      return optionAutoName({ option: null, hopFlights: [parsed], homeFlights, airports });
    }

    function populateOptionSelect() {
      const forNewIdea = ideaSelect.value === "__new__";
      const existing = forNewIdea ? [] : sortedOptionsFor(options, ideaSelect.value);
      optionSelect.replaceChildren(
        ...existing.map((o) => el("option", { value: o.id, textContent: o.name })),
        el("option", { value: "__new__", textContent: `New option: ${newOptionName()}` })
      );
      const preferred = !forNewIdea && defaultOptionId && existing.some((o) => o.id === defaultOptionId) ? defaultOptionId : existing[0]?.id;
      optionSelect.value = preferred || "__new__";
    }

    function applyPlacement() {
      if (!placement || !placement.role) {
        targetEl.hidden = true;
        return;
      }
      ideaSelect.replaceChildren(
        ...ideas.map((i) => el("option", { value: i.id, textContent: i.name })),
        el("option", { value: "__new__", textContent: `New idea: ${placement.newIdeaName || "New idea"}` })
      );
      ideaSelect.value = placement.ideaId || "__new__";
      optionRow.hidden = placement.role !== "hop";
      if (placement.role === "hop") populateOptionSelect();
      targetEl.hidden = false;
    }
    ideaSelect.addEventListener("change", () => {
      if (placement?.role === "hop") populateOptionSelect();
    });

    function applyLandsDate() {
      const showLands = placement?.role === "home" && (placement.direction === "out" || placement.direction === "both");
      landsDateRow.hidden = !showLands;
      if (showLands) landsDateInput.value = guessLandsDate(parsed.fromAirport, parsed.toAirport, parsed.outboundDate, airports) || "";
    }

    function applyPrice() {
      if (!parsed.price) {
        priceRow.hidden = false;
        priceHelperEl.hidden = true;
        return;
      }
      priceRow.hidden = false;
      priceHelperEl.hidden = false;
      if (parsed.price.currency === trip.currency) {
        if (!priceTouched) priceInput.value = (parsed.price.amountCents / 100).toFixed(2);
        priceHelperEl.textContent = `Google showed ${formatMoney(parsed.price.amountCents, parsed.price.currency)} — check it's still right.`;
      } else {
        if (!priceTouched) priceInput.value = "";
        const shown = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed.price.amountCents / 100);
        priceHelperEl.textContent = `Google showed ${shown} ${parsed.price.currency} — type the USD price if you know it.`;
      }
    }

    function showNothing(message) {
      parsed = null;
      placement = null;
      previewEl.hidden = true;
      landsDateRow.hidden = true;
      priceRow.hidden = true;
      targetEl.hidden = true;
      okBtn.disabled = true;
      linkErrorEl.textContent = message || "";
      linkErrorEl.hidden = !message;
    }

    function tryParse() {
      const text = linkInput.value.trim();
      if (!text) {
        showNothing(null);
        return;
      }
      const result = parseFlightLink(text);
      if (result.error) {
        showNothing(result.error);
        return;
      }
      parsed = result;
      placement = placePastedFlight({ parsed, traveler, ideas, homeFlightsByIdea, airports, currentIdeaId });
      if (!placement.role) {
        showNothing("We couldn't tell where this flight goes. Try the full address from Google Flights.");
        return;
      }
      linkErrorEl.hidden = true;
      previewEl.replaceChildren(
        el("p", { className: "link-parse-result link-parse-success", textContent: "✓ Read from the link" }),
        renderItinerary(parsed.legs)
      );
      previewEl.hidden = false;
      applyLandsDate();
      applyPrice();
      applyPlacement();
      okBtn.disabled = false;
    }
    linkInput.addEventListener("paste", () => setTimeout(tryParse, 0));
    linkInput.addEventListener("input", tryParse);

    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Add", disabled: true });

    const form = el("form", { method: "dialog", className: "flight-form" }, [
      el("h3", { textContent: "Paste flight link" }),
      field("Google Flights link", linkInput),
      linkErrorEl,
      previewEl,
      landsDateRow,
      priceRow,
      priceHelperEl,
      targetEl,
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      errorHolder.replaceChildren();
      if (!parsed || !placement || !placement.role) return;

      let priceAmountCents = null;
      if (priceInput.value.trim()) {
        priceAmountCents = parseMoney(priceInput.value);
        if (priceAmountCents === null || priceAmountCents <= 0) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "That price didn't look right — try something like 245 or 245.50." }));
          return;
        }
      } else if (parsed.price && parsed.price.currency === trip.currency) {
        priceAmountCents = parsed.price.amountCents;
      }

      const newIdea = ideaSelect.value === "__new__";
      const idea = newIdea ? { name: placement.newIdeaName || "New idea", order: ideas.length } : { id: ideaSelect.value };

      let option;
      let optionCountForLabel = 0;
      if (placement.role === "hop") {
        const existingOptions = newIdea ? [] : sortedOptionsFor(options, ideaSelect.value);
        const newOption = optionSelect.value === "__new__";
        option = newOption ? { name: newOptionName(), order: existingOptions.length } : { id: optionSelect.value };
        optionCountForLabel = newOption ? existingOptions.length : (flights || []).filter((f) => f.role === "hop" && f.optionId === option.id).length;
      }

      const existingHomeFlights = newIdea ? [] : homeFlightsByIdea[ideaSelect.value] || [];
      if (placement.role === "home") optionCountForLabel = existingHomeFlights.length;
      const alreadyPicked = placement.role === "home" && existingHomeFlights.some((f) => f.direction === placement.direction && f.picked !== false);

      // Dropped per-leg from/to, same as the hand-entry dialog: route.js
      // falls back to the flight doc's own fromAirport/toAirport for a leg
      // with no segments, so only date and segments need to be stored.
      const legs = (parsed.legs || []).map(({ date, segments }) => ({ date, segments }));

      finish({
        homeAirport: placement.homeAirport || null,
        travelerId: placement.role === "home" ? traveler.id : null,
        picked: placement.role === "home" ? !alreadyPicked : undefined,
        idea,
        option,
        flight: {
          legs,
          fromCity: parsed.fromPlace || "",
          fromAirport: parsed.fromAirport || "",
          toCity: parsed.toPlace || "",
          toAirport: parsed.toAirport || "",
          outboundDate: parsed.outboundDate || null,
          returnDate: parsed.returnDate || null,
          link: linkInput.value.trim(),
          role: placement.role,
          direction: placement.direction,
          landsDate: landsDateRow.hidden ? null : landsDateInput.value || null,
          label: labelFor(legs, optionCountForLabel),
          firstPriceEntry: priceEntryFor(priceAmountCents, myUid),
        },
      });
    });

    return { form, focusEl: linkInput };
  });
}

/**
 * "Move to…" for an earlier flight — one with no `role` (V4 §4.6) — onto a
 * traveler's home flights or a shared hop. Resolves the fields to pass to
 * `updateFlight`, or `null` on cancel.
 */
export function moveFlightDialog({ flight, travelers, ideas, options, airports }) {
  return dialogShell("move-flight-dialog", (finish) => {
    const kindSelect = el(
      "select",
      {},
      [
        ...travelers.map((t) => el("option", { value: `home:${t.id}`, textContent: `Home flight for ${t.name}` })),
        el("option", { value: "hop", textContent: "Hop flight (shared by everyone)" }),
      ]
    );
    const ideaSelect = el("select", {}, ideas.map((i) => el("option", { value: i.id, textContent: i.name })));
    const optionSelect = el("select", {});
    const optionRow = field("Option", optionSelect);

    function populateOptions() {
      const ideaOptions = sortedOptionsFor(options, ideaSelect.value);
      optionSelect.replaceChildren(...ideaOptions.map((o) => el("option", { value: o.id, textContent: o.name })));
    }
    function applyKind() {
      optionRow.hidden = kindSelect.value !== "hop";
      if (!optionRow.hidden) populateOptions();
    }
    kindSelect.addEventListener("change", applyKind);
    ideaSelect.addEventListener("change", () => {
      if (!optionRow.hidden) populateOptions();
    });
    applyKind();

    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Move" });
    const form = el("form", { method: "dialog" }, [
      el("h3", { textContent: "Move this flight" }),
      ideas.length === 0 ? el("p", { className: "field-error", textContent: "Add an idea on Routes first, then move this flight to it." }) : field("Goes with", kindSelect),
      ideas.length === 0 ? null : field("Idea", ideaSelect),
      ideas.length === 0 ? null : optionRow,
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ].filter(Boolean));
    if (ideas.length === 0) okBtn.disabled = true;

    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (ideas.length === 0) return;
      if (kindSelect.value === "hop") {
        if (!optionSelect.value) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Add an option under this idea first, then move this flight to it." }));
          return;
        }
        finish({ role: "hop", ideaId: ideaSelect.value, optionId: optionSelect.value, travelerId: null, direction: null, landsDate: null });
        return;
      }
      const travelerId = kindSelect.value.slice("home:".length);
      const traveler = travelers.find((t) => t.id === travelerId);
      const direction = homeDirection(flight, traveler, airports);
      const landsDate = direction === "out" || direction === "both" ? guessLandsDate(flight.fromAirport, flight.toAirport, flight.outboundDate, airports) : null;
      finish({ role: "home", ideaId: ideaSelect.value, optionId: null, travelerId, direction, landsDate, picked: true });
    });
    return { form, focusEl: kindSelect };
  });
}

/**
 * The collapsed "Earlier flights" list (V4 §4.6): flights saved before
 * Routes gave flights a role, each with Move to… and Delete. `null` when
 * there are none, so the caller can hide its holder element entirely.
 */
export function renderEarlierFlights({ flights, trip, tripId, myUid, usersById, onMove, onEdit, onDelete }) {
  const list = flights.filter((f) => !f.role);
  if (list.length === 0) return null;
  const rows = list.map((flight) => {
    const moveBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Move to…" });
    moveBtn.addEventListener("click", () => onMove(flight));
    return renderFlightRow(flight, {
      tripId,
      myUid,
      currency: trip.currency,
      usersById,
      onEdit: () => onEdit(flight),
      onDelete: () => onDelete(flight),
      leadingActions: [moveBtn],
    });
  });
  return el("details", {}, [el("summary", { textContent: `Earlier flights (${list.length})` }), ...rows]);
}
