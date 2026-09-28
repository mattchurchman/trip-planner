// Shared DOM helpers. No Firebase imports here.
import { voteSummary } from "./lib/votes.js";

/** Creates an element. props supports className, textContent, onX handlers,
 * an `attrs` object for raw attributes, and any other DOM property. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === "attrs") {
      for (const [attrName, attrValue] of Object.entries(value)) {
        if (attrValue === false || attrValue == null) continue;
        node.setAttribute(attrName, attrValue === true ? "" : attrValue);
      }
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node[key] = value;
    }
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/** Creates an SVG element (e.g. for the price sparkline, §7.8) with the given attributes. */
export function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child != null) node.appendChild(child);
  }
  return node;
}

/** Toggles a button between its normal label and a pending label, disabling it while pending. */
export function setPending(button, pending, pendingText = "Saving…") {
  if (pending) {
    if (button.dataset.originalText === undefined) button.dataset.originalText = button.textContent;
    button.textContent = pendingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText ?? button.textContent;
    delete button.dataset.originalText;
    button.disabled = false;
  }
}

/** Translates a Firestore/auth error into a message the owner's friends can act on. */
export function friendlyError(err) {
  if (err && err.code === "permission-denied") {
    return "You don't have access. Are you signed in with the approved account?";
  }
  return (err && err.message) || "Something went wrong. Try again in a moment.";
}

/** Shows a native, accessible confirm dialog. `confirmLabel` names the action
 * itself ("Delete", "Remove", "Publish") rather than a generic "Confirm", per
 * the wording guide's "say what a button does, as a verb." Resolves true/false. */
export function confirmDialog(message, confirmLabel = "Confirm") {
  return new Promise((resolve) => {
    const dialog = el("dialog", { className: "app-dialog" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "button", className: "btn btn-danger", textContent: confirmLabel });
    dialog.append(
      el("p", { textContent: message }),
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn])
    );
    document.body.appendChild(dialog);

    function finish(result) {
      dialog.close();
      dialog.remove();
      resolve(result);
    }
    cancelBtn.addEventListener("click", () => finish(false));
    okBtn.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", () => finish(false));
    dialog.showModal();
    okBtn.focus();
  });
}

/** Shows a native, accessible text-input dialog. Resolves the typed string, or null if cancelled. */
export function promptDialog(message, defaultValue = "") {
  return new Promise((resolve) => {
    const dialog = el("dialog", { className: "app-dialog" });
    const input = el("input", { type: "text", value: defaultValue, className: "prompt-input" });
    const label = el("label", { className: "prompt-label" }, [el("span", { textContent: message }), input]);
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });
    const form = el("form", { method: "dialog" }, [
      label,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    dialog.appendChild(form);
    document.body.appendChild(dialog);

    function finish(result) {
      dialog.close();
      dialog.remove();
      resolve(result);
    }
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      finish(input.value);
    });
    dialog.addEventListener("cancel", () => finish(null));
    dialog.showModal();
    input.focus();
    input.select();
  });
}

/**
 * Renders now, or waits until the user has finished typing inside `container`
 * (§8: a live update must never wipe an in-progress edit). Deferring rather than
 * simply skipping matters — a skipped render would otherwise leave the section
 * stale until some later snapshot happens to arrive while nothing is focused.
 */
export function renderWhenIdle(container, render) {
  const active = document.activeElement;
  const editing = container.contains(active) && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
  if (!editing) {
    render();
    return;
  }
  if (container.dataset.renderDeferred) return;
  container.dataset.renderDeferred = "1";
  container.addEventListener("focusout", function whenDone(event) {
    // Focus moving to another control in the same section is still editing.
    if (container.contains(event.relatedTarget)) return;
    container.removeEventListener("focusout", whenDone);
    delete container.dataset.renderDeferred;
    render();
  });
}

/** A labeled form field: a <label> wrapping a caption span and the given input/select/textarea. */
export function field(labelText, input) {
  return el("label", { className: "field" }, [el("span", { textContent: labelText }), input]);
}

/**
 * Builds and shows a modal <dialog> around a form. `buildForm(finish)` must
 * synchronously return `{ form, focusEl? }`; call `finish(result)` from a
 * submit/cancel handler to resolve. Resolves `null` on cancel (button or Esc).
 */
export function dialogShell(className, buildForm) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { className: `app-dialog app-dialog-form ${className}` });
    const { form, focusEl } = buildForm((result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    });
    dialog.appendChild(form);
    document.body.appendChild(dialog);
    dialog.addEventListener("cancel", () => {
      dialog.remove();
      resolve(null);
    });
    dialog.showModal();
    (focusEl || form).focus();
  });
}

/** The pressed/toggle Must/Nice/Skip summary shown next to it; tap to see who chose what (§7.3). */
function rankSummary(votes, usersById) {
  const summaryText = voteSummary(votes) || "Not ranked yet";
  const entries = Object.entries(votes || {});
  const toggleBtn = el("button", {
    type: "button",
    className: "rank-summary-toggle",
    textContent: summaryText,
    attrs: { "aria-expanded": "false" },
  });
  if (entries.length === 0) return el("div", { className: "rank-summary" }, [toggleBtn]);

  const details = el(
    "ul",
    { className: "rank-summary-details", hidden: true },
    entries.map(([uid, choice]) => {
      const name = (usersById[uid] && usersById[uid].displayName) || "Someone";
      return el("li", { textContent: `${name}: ${choice}` });
    })
  );
  toggleBtn.addEventListener("click", () => {
    details.hidden = !details.hidden;
    toggleBtn.setAttribute("aria-expanded", details.hidden ? "false" : "true");
  });
  return el("div", { className: "rank-summary" }, [toggleBtn, details]);
}

// What each rank choice means, shown as a tooltip (wording guide).
const RANK_TOOLTIPS = { must: "Must go", nice: "Nice to have", skip: "Skip it" };

/**
 * The Must/Nice/Skip control (§7.3). Pressing the current choice again clears it.
 * `onVote(choice | null)` is called with the new choice; the caller writes votes.<uid>.
 */
export function rankControl({ votes = {}, myUid, usersById = {}, onVote }) {
  const current = votes[myUid] ?? null;
  const buttons = el(
    "div",
    { className: "rank-buttons" },
    ["must", "nice", "skip"].map((choice) => {
      const pressed = current === choice;
      const btn = el("button", {
        type: "button",
        className: `btn btn-small rank-btn rank-${choice}${pressed ? " rank-btn-pressed" : ""}`,
        textContent: choice[0].toUpperCase() + choice.slice(1),
        title: RANK_TOOLTIPS[choice],
        attrs: { "aria-pressed": pressed ? "true" : "false" },
      });
      btn.addEventListener("click", () => onVote(pressed ? null : choice));
      return btn;
    })
  );
  return el("div", { className: "rank-control" }, [buttons, rankSummary(votes, usersById)]);
}

/** A "Copy link" button using the Clipboard API, falling back to a selectable text field (§8). */
export function copyLinkButton(url) {
  const btn = el("button", { type: "button", className: "btn btn-small", textContent: "Copy link" });
  const fallback = el("input", {
    type: "text",
    value: url,
    className: "copy-fallback",
    readOnly: true,
    hidden: true,
  });
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      setPending(btn, true, "Copied!");
      setTimeout(() => setPending(btn, false), 1500);
    } catch {
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
    }
  });
  return el("span", { className: "copy-link" }, [btn, fallback]);
}

/** Triggers a browser download of in-memory content, e.g. an export file (§7.10). */
export function downloadFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
