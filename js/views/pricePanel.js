import { logPriceEntry, deletePriceEntry } from "../store.js";
import { el, svgEl, setPending, confirmDialog, friendlyError } from "../ui.js";
import { parseMoney, formatMoney } from "../lib/money.js";
import { latestEntry, priceDelta, isNewLow, sortByTimeAsc } from "../lib/totals.js";
import { relativeTime } from "../lib/dates.js";

// Whether the Update-price row and its History list are open, kept per flight/
// stay so a card rebuilding around this on a live update doesn't close it out
// from under the person using it (§8) — same pattern as comments.js's threadState.
const rowState = new Map();

function buildSparkline(prices) {
  const amounts = sortByTimeAsc(prices).map((p) => p.amountCents);
  const width = 64;
  const height = 16;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const range = max - min || 1;
  const points = amounts
    .map((amount, i) => {
      const x = amounts.length === 1 ? width / 2 : (i / (amounts.length - 1)) * width;
      const y = height - ((amount - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "sparkline", "aria-hidden": "true" }, [
    svgEl("polyline", { points, fill: "none", stroke: "#1a73e8", "stroke-width": "2" }),
  ]);
}

/**
 * The price summary for a card header's right side (§7.8): the latest price
 * (large), an optional per-night line (stays only — pass `perNightCents`),
 * the change from the previous check with when it was checked (who and the
 * exact time sit in a `title` tooltip, not the visible text), a New low pill,
 * and a sparkline once there are 2+ entries. "No price yet" with none.
 */
export function priceSummary({ prices, currency, perNightCents = null, usersById = {} }) {
  const latest = latestEntry(prices);
  if (!latest) {
    return el("div", { className: "price-summary" }, [el("p", { className: "muted", textContent: "No price yet" })]);
  }

  const delta = priceDelta(prices);
  const newLow = isNewLow(prices);
  const when = latest.checkedAt ? relativeTime(new Date(latest.checkedAt)) : "";
  const byName = (usersById[latest.byUid] && usersById[latest.byUid].displayName) || "someone";
  const exactTime = latest.checkedAt ? new Date(latest.checkedAt).toLocaleString() : "";

  // Stays store the TOTAL for the whole stay (§5.4); when a per-night figure
  // is given, label the primary line "total" so it isn't misread as nightly.
  const latestText = perNightCents != null ? `${formatMoney(latest.amountCents, currency)} total` : formatMoney(latest.amountCents, currency);
  const rows = [el("p", { className: "price-latest", textContent: latestText })];
  if (perNightCents != null) {
    rows.push(el("p", { className: "price-per-night muted", textContent: `${formatMoney(perNightCents, currency)} / night` }));
  }

  let deltaText = null;
  if (delta !== null) {
    if (delta > 0) deltaText = `▲ ${formatMoney(delta, currency)} higher`;
    else if (delta < 0) deltaText = `▼ ${formatMoney(-delta, currency)} lower`;
    else deltaText = "No change";
  }
  const changeText = [deltaText, when].filter(Boolean).join(" · ");
  if (changeText) {
    rows.push(el("p", { className: "price-delta muted", textContent: changeText, title: `${byName}${exactTime ? `, ${exactTime}` : ""}` }));
  }

  if (newLow) rows.push(el("span", { className: "badge-new-low", textContent: "New low" }));
  if (prices.length >= 2) rows.push(buildSparkline(prices));

  return el("div", { className: "price-summary" }, rows);
}

/**
 * The footer's **Update price** ("Add price" with none yet) button and the
 * row it opens (§7.8): amount, note, Save price, Cancel, and — with 2+
 * entries — a History link expanding the full list (delete with confirmation,
 * `arrayRemove` on the exact entry). Returns `{ button, row }`; the caller
 * places `button` among the footer actions and `row` right under the header.
 */
export function priceUpdater({ tripId, subcollection, docId, prices, myUid, currency }) {
  const stateKey = `${tripId}:${subcollection}:${docId}`;
  const saved = rowState.get(stateKey) || { open: false, historyOpen: false };
  const latest = latestEntry(prices);
  const errorHolder = el("div", { className: "field-error-holder" });

  const amountInput = el("input", {
    type: "text",
    placeholder: "Amount",
    value: latest ? (latest.amountCents / 100).toFixed(2) : "",
    attrs: { "aria-label": "Price you checked" },
  });
  const noteInput = el("input", { type: "text", placeholder: "Note (optional)", attrs: { "aria-label": "Note about this price" } });
  const saveBtn = el("button", { type: "button", className: "btn btn-small btn-primary", textContent: "Save price" });
  const cancelBtn = el("button", { type: "button", className: "btn btn-small btn-secondary", textContent: "Cancel" });

  function closeRow() {
    row.hidden = true;
    saved.open = false;
    rowState.set(stateKey, saved);
  }

  saveBtn.addEventListener("click", async () => {
    errorHolder.replaceChildren();
    const cents = parseMoney(amountInput.value);
    if (cents === null || cents <= 0) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "That price didn't look right — try something like 245 or 245.50." }));
      return;
    }
    const entry = { id: crypto.randomUUID(), amountCents: cents, checkedAt: new Date().toISOString(), byUid: myUid, note: noteInput.value.trim() };
    setPending(saveBtn, true, "Saving…");
    try {
      await logPriceEntry(tripId, subcollection, docId, entry);
      noteInput.value = "";
      closeRow();
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(saveBtn, false);
    }
  });
  cancelBtn.addEventListener("click", () => {
    errorHolder.replaceChildren();
    closeRow();
  });

  const rowChildren = [
    el("p", { className: "muted price-hint" }, ["Check the price on the site first, then save what you saw."]),
    el("div", { className: "price-update-fields" }, [amountInput, noteInput, saveBtn, cancelBtn]),
    errorHolder,
  ];

  if (prices.length >= 2) {
    const historyToggle = el("button", {
      type: "button",
      className: "btn btn-link",
      textContent: `History (${prices.length})`,
      attrs: { "aria-expanded": saved.historyOpen ? "true" : "false" },
    });
    const historyList = el("ul", { className: "price-history", hidden: !saved.historyOpen });
    historyToggle.addEventListener("click", () => {
      historyList.hidden = !historyList.hidden;
      historyToggle.setAttribute("aria-expanded", historyList.hidden ? "false" : "true");
      saved.historyOpen = !historyList.hidden;
      rowState.set(stateKey, saved);
    });
    historyList.append(
      ...[...prices]
        .sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : a.checkedAt > b.checkedAt ? -1 : 0))
        .map((entry) => {
          const when = entry.checkedAt ? new Date(entry.checkedAt).toLocaleString() : "";
          const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete" });
          deleteBtn.addEventListener("click", async () => {
            const confirmed = await confirmDialog(`Delete this price entry (${formatMoney(entry.amountCents, currency)})?`, "Delete");
            if (!confirmed) return;
            try {
              await deletePriceEntry(tripId, subcollection, docId, entry);
            } catch (err) {
              errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
            }
          });
          return el("li", { className: "price-history-item" }, [
            el("span", { textContent: `${formatMoney(entry.amountCents, currency)} — ${when}${entry.note ? " — " + entry.note : ""}` }),
            deleteBtn,
          ]);
        })
    );
    rowChildren.push(historyToggle, historyList);
  }

  const row = el("div", { className: "price-update-row", hidden: !saved.open }, rowChildren);

  const button = el("button", { type: "button", className: "btn btn-link btn-small", textContent: latest ? "Update price" : "Add price" });
  button.addEventListener("click", () => {
    row.hidden = !row.hidden;
    saved.open = !row.hidden;
    rowState.set(stateKey, saved);
    if (!row.hidden) amountInput.focus();
  });

  return { button, row };
}
