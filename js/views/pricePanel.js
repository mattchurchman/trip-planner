import { logPriceEntry, deletePriceEntry } from "../store.js";
import { el, svgEl, setPending, confirmDialog, friendlyError } from "../ui.js";
import { parseMoney, formatMoney } from "../lib/money.js";
import { latestEntry, priceDelta, isNewLow, sortByTimeAsc } from "../lib/totals.js";
import { relativeTime } from "../lib/dates.js";

function buildSparkline(prices) {
  const amounts = sortByTimeAsc(prices).map((p) => p.amountCents);
  const width = 100;
  const height = 24;
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

/** The price panel from §7.8, shared by flight and stay cards. */
export function buildPricePanel({ tripId, subcollection, docId, prices, myUid, usersById, currency }) {
  const latest = latestEntry(prices);
  const delta = priceDelta(prices);
  const newLow = isNewLow(prices);
  const errorHolder = el("div", { className: "field-error-holder" });

  const summaryParts = [];
  if (latest) {
    const when = latest.checkedAt ? relativeTime(new Date(latest.checkedAt)) : "";
    const byName = (usersById[latest.byUid] && usersById[latest.byUid].displayName) || "someone";
    summaryParts.push(
      el("p", { className: "price-latest", textContent: `${formatMoney(latest.amountCents, currency)} — checked ${when} by ${byName}` })
    );
    if (delta !== null) {
      let deltaText = "No change";
      if (delta > 0) deltaText = `▲ ${formatMoney(delta, currency)} higher`;
      else if (delta < 0) deltaText = `▼ ${formatMoney(-delta, currency)} lower`;
      summaryParts.push(el("p", { className: "price-delta", textContent: deltaText }));
    }
    if (newLow) summaryParts.push(el("span", { className: "badge-new-low", textContent: "New low" }));
    if (prices.length >= 2) summaryParts.push(buildSparkline(prices));
  } else {
    summaryParts.push(el("p", { className: "muted", textContent: "No price logged yet." }));
  }

  const amountInput = el("input", {
    type: "text",
    placeholder: "Amount",
    value: latest ? (latest.amountCents / 100).toFixed(2) : "",
    attrs: { "aria-label": "Price you checked" },
  });
  const noteInput = el("input", { type: "text", placeholder: "Note (optional)", attrs: { "aria-label": "Note about this price" } });
  const logBtn = el("button", { type: "button", className: "btn btn-small btn-primary", textContent: "Log price" });
  logBtn.addEventListener("click", async () => {
    errorHolder.replaceChildren();
    const cents = parseMoney(amountInput.value);
    if (cents === null || cents <= 0) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Enter a valid amount greater than $0." }));
      return;
    }
    const entry = { id: crypto.randomUUID(), amountCents: cents, checkedAt: new Date().toISOString(), byUid: myUid, note: noteInput.value.trim() };
    setPending(logBtn, true, "Logging…");
    try {
      await logPriceEntry(tripId, subcollection, docId, entry);
      noteInput.value = "";
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(logBtn, false);
    }
  });

  const historyToggle = el("button", {
    type: "button",
    className: "btn btn-link",
    textContent: `History (${prices.length})`,
    attrs: { "aria-expanded": "false" },
  });
  const historyList = el("ul", { className: "price-history", hidden: true });
  historyToggle.addEventListener("click", () => {
    historyList.hidden = !historyList.hidden;
    historyToggle.setAttribute("aria-expanded", historyList.hidden ? "false" : "true");
  });
  historyList.append(
    ...[...prices]
      .sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : a.checkedAt > b.checkedAt ? -1 : 0))
      .map((entry) => {
        const when = entry.checkedAt ? new Date(entry.checkedAt).toLocaleString() : "";
        const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete" });
        deleteBtn.addEventListener("click", async () => {
          const confirmed = await confirmDialog(`Delete this price entry (${formatMoney(entry.amountCents, currency)})?`);
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

  return el("div", { className: "price-panel" }, [
    el("div", { className: "price-summary" }, summaryParts),
    el("p", { className: "muted price-hint" }, ["Check the price on the site first, then log what you saw."]),
    el("div", { className: "price-log-form" }, [amountInput, noteInput, logBtn]),
    errorHolder,
    historyToggle,
    historyList,
  ]);
}
