// The Split costs list on Overview (V4 §9): the things everyone shares, like
// a rental car or groceries. Split out of overview.js.
import { addCost, updateCost, deleteCost } from "../store.js";
import { el, field, dialogShell, confirmDialog } from "../ui.js";
import { parseMoney, formatMoney } from "../lib/money.js";

/** Add / Edit a split cost. Resolves `{ label, amountCents, note,
 * forTravelerIds }` (null = everyone), or null on cancel. `existing` is null
 * when adding. */
function costFormDialog(existing, travelers) {
  return dialogShell("cost-dialog", (finish) => {
    const labelInput = el("input", { type: "text", value: existing?.label || "" });
    const amountInput = el("input", { type: "text", value: existing ? (existing.amountCents / 100).toFixed(2) : "" });
    const noteInput = el("input", { type: "text", value: existing?.note || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    // null means everyone; otherwise the ids picked so far.
    let picked = Array.isArray(existing?.forTravelerIds)
      ? travelers.filter((t) => existing.forTravelerIds.includes(t.id)).map((t) => t.id)
      : null;
    const pillsEl = el("div", { className: "route-for-pills" });
    function renderPills() {
      const pill = (label, pressed, onClick) => {
        const btn = el("button", { type: "button", className: "route-for-pill", textContent: label, attrs: { "aria-pressed": String(pressed) } });
        btn.addEventListener("click", onClick);
        return btn;
      };
      pillsEl.replaceChildren(
        pill("Everyone", picked === null, () => {
          picked = null;
          renderPills();
        }),
        ...travelers.map((t) =>
          pill(t.name, picked !== null && picked.includes(t.id), () => {
            const next = new Set(picked || []);
            if (next.has(t.id)) next.delete(t.id);
            else next.add(t.id);
            picked = travelers.filter((x) => next.has(x.id)).map((x) => x.id);
            renderPills();
          })
        )
      );
    }
    renderPills();
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: existing ? "Save" : "Add" });
    const form = el("form", { method: "dialog" }, [
      field("Label", labelInput),
      field("Amount", amountInput),
      field("Note", noteInput),
      el("div", { className: "field" }, [el("span", { textContent: "Who's this for?" }), pillsEl]),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const label = labelInput.value.trim();
      const cents = parseMoney(amountInput.value);
      if (!label) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Label is required." }));
        return;
      }
      if (cents === null || cents < 0) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "That amount didn't look right — try something like 245 or 245.50." }));
        return;
      }
      if (picked !== null && picked.length === 0) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Pick at least one person, or choose Everyone." }));
        return;
      }
      const everyone = picked === null || picked.length === travelers.length;
      finish({ label, amountCents: cents, note: noteInput.value.trim(), forTravelerIds: everyone ? null : picked });
    });
    return { form, focusEl: labelInput };
  });
}

/** The "Add a split cost" button. `onError` takes a caught error. */
export function addCostButton({ tripId, myUid, getTravelers, onError }) {
  const btn = el("button", { type: "button", className: "btn btn-small", textContent: "Add a split cost" });
  btn.addEventListener("click", async () => {
    const result = await costFormDialog(null, getTravelers());
    if (!result) return;
    try {
      await addCost(tripId, result, myUid);
    } catch (err) {
      onError(err);
    }
  });
  return btn;
}

/** Fills `sectionEl` with one row per split cost. Call again whenever the
 * costs or the trip's currency change. */
export function renderSplitCosts(sectionEl, { tripId, trip, costs, onError }) {
  async function run(action) {
    try {
      await action();
    } catch (err) {
      onError(err);
    }
  }

  const rows = costs.map((cost) => {
    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", () =>
      run(async () => {
        const result = await costFormDialog(cost, trip.travelers || []);
        if (result) await updateCost(tripId, cost.id, result);
      })
    );
    const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", () =>
      run(async () => {
        if (await confirmDialog(`Delete "${cost.label}"?`, "Delete")) await deleteCost(tripId, cost.id);
      })
    );
    const travelers = trip.travelers || [];
    const forIds = Array.isArray(cost.forTravelerIds) ? travelers.filter((t) => cost.forTravelerIds.includes(t.id)) : null;
    const forText = forIds && forIds.length < travelers.length ? `÷ ${forIds.length} · ${forIds.map((t) => t.name).join(", ")}` : null;
    return el(
      "div",
      { className: "cost-row" },
      [
        el("span", { textContent: cost.label }),
        el("span", { textContent: formatMoney(cost.amountCents, trip.currency) }),
        forText ? el("span", { className: "muted", textContent: forText }) : null,
        cost.note ? el("span", { className: "muted", textContent: cost.note }) : null,
        editBtn,
        deleteBtn,
      ].filter(Boolean)
    );
  });

  sectionEl.replaceChildren(
    ...(rows.length > 0
      ? rows
      : [el("p", { className: "empty-state", textContent: "No split costs yet. Add one for things like a rental car or groceries." })])
  );
}
