import { logPriceEntry, deletePriceEntry } from "../store.js";
import { el, svgEl, setPending, confirmDialog, friendlyError } from "../ui.js";
import { parseMoney, formatMoney } from "../lib/money.js";
import { latestEntry, priceDelta, isNewLow, sortByTimeAsc, priceAgeDays, isStale } from "../lib/totals.js";
import { relativeTime } from "../lib/dates.js";
import { safeUrl } from "../lib/links.js";

// Whether a flight/stay's price-check row (and its History list) is open,
// and which half it's showing — kept per flight/stay so a card rebuilding
// around this on a live update doesn't close it out from under the person
// using it (§8) — same pattern as comments.js's threadState.
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

function openLink(link) {
  const url = link ? safeUrl(link) : null;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

/** Movement in words, with a class naming the color (§5). Null with fewer than 2 entries. */
function movement(prices, currency) {
  const delta = priceDelta(prices);
  if (delta === null) return null;
  if (delta > 0) return { text: `▲ ${formatMoney(delta, currency)} higher`, className: "price-higher" };
  if (delta < 0) return { text: `▼ ${formatMoney(-delta, currency)} lower`, className: "price-lower" };
  return { text: "No change", className: "price-same" };
}

/** "Checked today" / "Checked 1 day ago" / "Checked 3 days ago", for the age line (§5). */
function checkedAgoLabel(age) {
  if (age === 0) return "Checked today";
  return `Checked ${age} day${age === 1 ? "" : "s"} ago`;
}

/**
 * The price chip for a card header's right side (§5, §7.8): a tappable pill
 * with the amount, a refresh glyph and the word "Check" ("+ Add price" with
 * no price yet), 44px tall so it reads as a control, not plain text.
 * `onOpen` is called when the chip is tapped.
 */
function priceChip({ latest, currency, perNightCents, onOpen }) {
  if (!latest) {
    const btn = el("button", {
      type: "button",
      className: "price-chip price-chip-btn",
      attrs: { "aria-label": "Add price" },
    }, ["+ Add price"]);
    btn.addEventListener("click", onOpen);
    return btn;
  }

  // Stays store the TOTAL for the whole stay (§5.4); when a per-night figure
  // is given, label the primary line "total" so it isn't misread as nightly.
  const latestText = perNightCents != null ? `${formatMoney(latest.amountCents, currency)} total` : formatMoney(latest.amountCents, currency);
  const btn = el("button", {
    type: "button",
    className: "price-chip price-chip-btn",
    attrs: { "aria-label": `Check price, last ${latestText}` },
  }, [
    el("span", { className: "price-chip-amount", textContent: latestText }),
    el("span", { className: "price-chip-icon", "aria-hidden": "true", textContent: "↻" }),
    el("span", { className: "price-chip-label", textContent: "Check" }),
  ]);
  btn.addEventListener("click", onOpen);
  return btn;
}

/**
 * The price summary for a card header's right side (§5, §7.8): the price
 * chip (§5), an age line beneath it ("Checked today", or "Check price" with
 * a stale dot past 3 days), the change from the previous check with when it
 * was checked (who and the exact time sit in a `title` tooltip, not the
 * visible text), a New low pill, and a sparkline once there are 2+ entries.
 * `onOpen` is called when the chip is tapped.
 */
function priceSummary({ prices, currency, perNightCents = null, usersById = {}, now, onOpen }) {
  const latest = latestEntry(prices);
  const chip = priceChip({ latest, currency, perNightCents, onOpen });
  if (!latest) return el("div", { className: "price-summary" }, [chip]);

  const age = priceAgeDays(prices, now);
  const stale = isStale(prices, now);
  const when = latest.checkedAt ? relativeTime(new Date(latest.checkedAt), now) : "";
  const byName = (usersById[latest.byUid] && usersById[latest.byUid].displayName) || "someone";
  const exactTime = latest.checkedAt ? new Date(latest.checkedAt).toLocaleString() : "";

  const ageLine = el("div", { className: "price-age-line" }, [
    el("span", { className: "price-age muted", textContent: stale ? "Check price" : checkedAgoLabel(age) }),
    stale ? el("span", { className: "price-stale-dot", title: "Checked more than 3 days ago", "aria-label": "May be out of date" }) : null,
  ].filter(Boolean));

  const rows = [chip, ageLine];
  if (perNightCents != null) {
    rows.push(el("p", { className: "price-per-night muted", textContent: `${formatMoney(perNightCents, currency)} / night` }));
  }

  const move = movement(prices, currency);
  if (move) {
    const changeText = [move.text, when].filter(Boolean).join(" · ");
    rows.push(el("p", { className: `price-delta muted ${move.className}`, textContent: changeText, title: `${byName}${exactTime ? `, ${exactTime}` : ""}` }));
  }

  if (isNewLow(prices)) rows.push(el("span", { className: "badge-new-low", textContent: "New low" }));
  if (prices.length >= 2) rows.push(buildSparkline(prices));

  return el("div", { className: "price-summary" }, rows);
}

/** The amount + note + Save fields shared by "Changed" and "Add price". */
function amountFields({ tripId, subcollection, docId, latest, myUid, onSaved, onCancel }) {
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
      onSaved();
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(saveBtn, false);
    }
  });
  cancelBtn.addEventListener("click", () => {
    errorHolder.replaceChildren();
    onCancel();
  });

  return el("div", {}, [
    el("div", { className: "price-update-fields" }, [amountInput, noteInput, saveBtn, cancelBtn]),
    errorHolder,
  ]);
}

/** The "Opened the link... Is it still $64?" row (§5): Same logs a fresh entry at the same amount; Changed swaps in `amountFields`. */
function askRow({ tripId, subcollection, docId, latest, currency, myUid, onSame, onChanged }) {
  const errorHolder = el("div", { className: "field-error-holder" });
  const sameBtn = el("button", { type: "button", className: "btn btn-primary", textContent: "Same" });
  const changedBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Changed" });

  sameBtn.addEventListener("click", async () => {
    errorHolder.replaceChildren();
    setPending(sameBtn, true, "Saving…");
    try {
      await logPriceEntry(tripId, subcollection, docId, {
        id: crypto.randomUUID(),
        amountCents: latest.amountCents,
        checkedAt: new Date().toISOString(),
        byUid: myUid,
        note: "",
      });
      onSame();
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(sameBtn, false);
    }
  });
  changedBtn.addEventListener("click", onChanged);

  return el("div", {}, [
    el("div", { className: "price-ask-row" }, [
      el("p", { className: "price-ask", textContent: `Opened the link in a new tab. Is it still ${formatMoney(latest.amountCents, currency)}?` }),
      el("div", { className: "price-ask-actions" }, [sameBtn, changedBtn]),
    ]),
    errorHolder,
  ]);
}

/** History disclosure (§5): price history and delete, as they were before T21. */
function historySection({ tripId, subcollection, docId, prices, currency, stateKey, saved }) {
  if (prices.length < 2) return null;
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
  const errorHolder = el("div", { className: "field-error-holder" });
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
  return el("div", {}, [historyToggle, historyList, errorHolder]);
}

/**
 * The price button for a card header (§5) plus the row it opens right under
 * the header: tapping the price opens the saved link and reveals **Still
 * $X?** (Same/Changed), or — with no price yet — the amount field straight
 * away. Returns `{ summary, row }`; the caller places `summary` in the
 * header's right side and `row` right under the header. `link` is the
 * flight/stay's saved booking link (opened on tap; no link just asks).
 */
export function priceCheck({ tripId, subcollection, docId, prices, link, currency, perNightCents = null, usersById = {}, myUid, now = new Date() }) {
  const stateKey = `${tripId}:${subcollection}:${docId}`;
  const saved = rowState.get(stateKey) || { open: false, mode: "ask", historyOpen: false };
  const latest = latestEntry(prices);

  const row = el("div", { className: "price-check-row", hidden: !saved.open });

  function closeRow() {
    row.hidden = true;
    saved.open = false;
    rowState.set(stateKey, saved);
  }

  function renderRowBody() {
    const body =
      latest && saved.mode === "ask"
        ? askRow({
            tripId,
            subcollection,
            docId,
            latest,
            currency,
            myUid,
            onSame: closeRow,
            onChanged: () => {
              saved.mode = "changed";
              rowState.set(stateKey, saved);
              renderRowBody();
            },
          })
        : amountFields({
            tripId,
            subcollection,
            docId,
            latest,
            myUid,
            onSaved: closeRow,
            onCancel: latest ? () => { saved.mode = "ask"; rowState.set(stateKey, saved); renderRowBody(); } : closeRow,
          });
    const history = historySection({ tripId, subcollection, docId, prices, currency, stateKey, saved });
    const hint =
      latest && saved.mode === "ask"
        ? null
        : el("p", { className: "muted price-hint" }, ["Check the price on the site first, then save what you saw."]);
    row.replaceChildren(...(hint ? [hint] : []), body, ...(history ? [history] : []));
    if (latest && saved.mode === "changed") {
      const amountInput = row.querySelector(".price-update-fields input[type=text]");
      if (amountInput) amountInput.focus();
    }
  }
  renderRowBody();

  function openRow() {
    saved.mode = latest ? "ask" : "changed";
    saved.open = true;
    rowState.set(stateKey, saved);
    row.hidden = false;
    renderRowBody();
    openLink(link);
  }

  const summary = priceSummary({
    prices,
    currency,
    perNightCents,
    usersById,
    now,
    onOpen: () => (row.hidden ? openRow() : closeRow()),
  });

  return { summary, row };
}
